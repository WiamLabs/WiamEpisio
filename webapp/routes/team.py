"""Team dashboard routes — for approved team members (editor, moderator, admin, engineer, marketing, translator).
Also includes public /careers page and public role applications."""
import json
import logging
import os
from datetime import datetime, timedelta
from flask import Blueprint, render_template, request, flash, redirect, url_for, jsonify, abort, session, current_app
from flask_login import login_required, current_user
from sqlalchemy import func
from ..extensions import db, csrf
from functools import wraps

log = logging.getLogger(__name__)

team_bp = Blueprint('team', __name__, url_prefix='/team')


def _qa_alert_recipients():
    """Collect founder + engineer team emails for QA alerting."""
    from ..models import User
    recipients = set()

    cfg_founder = (current_app.config.get('FOUNDER_EMAIL') or '').strip().lower()
    if cfg_founder:
        recipients.add(cfg_founder)

    for i in range(1, 5):
        e = (os.environ.get(f'FOUNDER_EMAIL_{i}') or '').strip().lower()
        if e:
            recipients.add(e)

    try:
        founders = User.query.filter_by(role='founder').all()
        for u in founders:
            e = (u.email or '').strip().lower()
            if e:
                recipients.add(e)
    except Exception:
        pass

    try:
        users = User.query.filter(User.status != 'deleted').all()
        for u in users:
            email = (u.email or '').strip().lower()
            if not email:
                continue
            if u.role == 'engineer':
                recipients.add(email)
                continue
            try:
                roles = set(u.get_roles())
            except Exception:
                roles = set()
            if 'engineer' in roles:
                recipients.add(email)
    except Exception:
        pass

    return sorted(recipients)


def _extract_bug_entries(payload):
    metrics = payload.get('metrics') if isinstance(payload.get('metrics'), dict) else {}
    suites = metrics.get('suites') if isinstance(metrics.get('suites'), list) else []
    bugs = []
    for s in suites:
        s_status = str(s.get('status', '')).lower()
        label = (s.get('label') or '').strip()
        key = f"{payload.get('suite', 'qa')}::{label or 'unknown'}"
        bugs.append({
            'key': key,
            'label': label or 'unknown',
            'status': 'pass' if s_status == 'pass' else 'fail',
            'detail': (s.get('detail') or 'Failed check').strip(),
        })
    if bugs:
        return bugs
    # Fallback: no granular suite list; treat whole report as one bug/state.
    report_status = str(payload.get('status', 'unknown')).lower()
    return [{
        'key': f"{payload.get('suite', 'qa')}::global",
        'label': payload.get('suite', 'global'),
        'status': 'pass' if report_status == 'pass' else 'fail',
        'detail': (payload.get('summary') or 'No details').strip(),
    }]


def _last_bug_event(action, bug_key):
    from ..models import AuditLog
    rows = AuditLog.query.filter(
        AuditLog.action == action
    ).order_by(AuditLog.created_at.desc()).limit(200).all()
    for row in rows:
        try:
            info = json.loads(row.details_json or '{}')
        except Exception:
            info = {}
        if info.get('bug_key') == bug_key:
            return row
    return None


def _send_bug_alerts_and_resolutions(payload):
    """Per bug: new alert within minutes; reminders hourly; resolve when fixed."""
    from ..models import AuditLog
    from ..services.email_service import send_general_notification

    recipients = _qa_alert_recipients()
    if not recipients:
        return {'alerts': 0, 'resolves': 0, 'reason': 'no_recipients'}

    suite_name = payload.get('suite') or 'wiamapp-qa'
    run_url = payload.get('run_url') or f"{current_app.config.get('APP_URL', 'https://wiamapp.com').rstrip('/')}/team?view=qa_tester"
    score = payload.get('score')
    now = datetime.utcnow()
    bugs = _extract_bug_entries(payload)
    alerts_sent = 0
    resolves_sent = 0

    for bug in bugs:
        bug_key = bug['key']
        status = bug['status']
        detail = bug['detail']
        label = bug['label']
        ts = now.strftime('%Y-%m-%d %H:%M:%S UTC')

        last_alert = _last_bug_event('QA_BUG_ALERT_EMAIL', bug_key)
        last_resolve = _last_bug_event('QA_BUG_RESOLVED_EMAIL', bug_key)
        is_open = bool(last_alert and (not last_resolve or last_alert.created_at > last_resolve.created_at))

        if status == 'fail':
            # Email cadence per bug_key (Resend / Render protection):
            #   - First-ever detection (no prior QA_BUG_ALERT_EMAIL row):
            #     send immediately.
            #   - Same bug still open AND last alert was >= 1 hour ago:
            #     send hourly reminder until the bug is fixed.
            #   - Same bug was resolved earlier and is reappearing:
            #     send only if >= 3 minutes since the last alert
            #     (anti-flap window — prevents tight loops if a flaky
            #     test bounces between pass/fail).
            #   - Otherwise: silent. With 1h cadence per bug + 3min
            #     anti-flap, the steady-state worst case is ~24 emails
            #     per bug per day, which sits comfortably inside Resend
            #     free-tier limits (3,000/day).
            should_send = False
            alert_type = 'new'
            if not last_alert:
                should_send = True
            else:
                elapsed = now - last_alert.created_at
                if is_open and elapsed >= timedelta(hours=1):
                    should_send = True
                    alert_type = 'hourly'
                elif elapsed >= timedelta(minutes=3) and not is_open:
                    should_send = True

            if should_send:
                subject = f'[WiamApp QA BUG] {label} ({alert_type})'
                msg = (
                    f'Automated QA detected a bug.\n\n'
                    f'When: {ts}\n'
                    f'Suite: {suite_name}\n'
                    f'Bug: {label}\n'
                    f'Status: FAIL\n'
                    f'Score: {score}\n'
                    f'Run: {run_url}\n\n'
                    f'Likely source:\n- {detail}\n\n'
                    'Why this happened:\n'
                    '- Recent code/config change in this feature path.\n'
                    '- API/auth/integrity mismatch or UI route regression.\n\n'
                    'How to fix:\n'
                    '- Reproduce using the same suite/label.\n'
                    '- Check logs around this exact feature path.\n'
                    '- Patch + rerun; reminder will continue hourly until pass.'
                )
                for email in recipients:
                    send_general_notification(
                        email,
                        subject,
                        msg,
                        cta_text='Open QA Dashboard',
                        cta_link=f"{current_app.config.get('APP_URL', 'https://wiamapp.com').rstrip('/')}/team?view=qa_tester",
                    )
                db.session.add(AuditLog(
                    actor_user_id=0,
                    action='QA_BUG_ALERT_EMAIL',
                    target_type='QA',
                    target_id=None,
                    details_json=json.dumps({
                        'suite': suite_name,
                        'bug_key': bug_key,
                        'bug_label': label,
                        'status': status,
                        'score': score,
                        'recipients': recipients,
                        'run_url': run_url,
                        'detail': detail,
                        'alert_type': alert_type,
                    }),
                    ip_address=request.headers.get('X-Forwarded-For', request.remote_addr),
                ))
                alerts_sent += 1
            continue

        # status == pass for this bug entry
        if is_open:
            subject = f'[WiamApp QA FIXED] {label} resolved'
            msg = (
                f'Automated QA confirms this bug is resolved.\n\n'
                f'When resolved: {ts}\n'
                f'Suite: {suite_name}\n'
                f'Bug: {label}\n'
                f'Status: PASS\n'
                f'Run: {run_url}\n\n'
                'Hourly reminders for this bug are now stopped.'
            )
            for email in recipients:
                send_general_notification(
                    email,
                    subject,
                    msg,
                    cta_text='View QA Feed',
                    cta_link=f"{current_app.config.get('APP_URL', 'https://wiamapp.com').rstrip('/')}/team?view=qa_tester",
                )
            db.session.add(AuditLog(
                actor_user_id=0,
                action='QA_BUG_RESOLVED_EMAIL',
                target_type='QA',
                target_id=None,
                details_json=json.dumps({
                    'suite': suite_name,
                    'bug_key': bug_key,
                    'bug_label': label,
                    'status': status,
                    'recipients': recipients,
                    'run_url': run_url,
                }),
                ip_address=request.headers.get('X-Forwarded-For', request.remote_addr),
            ))
            resolves_sent += 1

    return {'alerts': alerts_sent, 'resolves': resolves_sent, 'reason': 'ok'}


def _last_audit_event(action):
    """Most recent AuditLog row for a given action, or None."""
    from ..models import AuditLog
    return (
        AuditLog.query.filter(AuditLog.action == action)
        .order_by(AuditLog.created_at.desc())
        .first()
    )


def _aggregate_recent_runtime_exceptions(window_hours=1):
    """Group QA_RUNTIME_EXCEPTION audit rows captured in the last
    ``window_hours`` by (endpoint, exception_class). Returns a list of
    dicts with: endpoint, exception_class, count, first_seen, last_seen,
    sample_message.

    Each unique combo becomes a single 'bug' for the watchdog dispatcher,
    which means the same endpoint blowing up 200 times in one hour fires
    ONE email instead of 200 (anti-spam by design).
    """
    from ..models import AuditLog
    cutoff = datetime.utcnow() - timedelta(hours=window_hours)
    rows = (
        AuditLog.query.filter(
            AuditLog.action == 'QA_RUNTIME_EXCEPTION',
            AuditLog.created_at >= cutoff,
        )
        .order_by(AuditLog.created_at.desc())
        .limit(500)
        .all()
    )
    buckets = {}
    for row in rows:
        try:
            info = json.loads(row.details_json or '{}')
        except Exception:
            continue
        endpoint = info.get('endpoint') or 'unknown'
        exc_class = info.get('exception_class') or 'Exception'
        key = f"{endpoint}::{exc_class}"
        b = buckets.setdefault(key, {
            'endpoint': endpoint,
            'exception_class': exc_class,
            'count': 0,
            'first_seen': row.created_at,
            'last_seen': row.created_at,
            'sample_message': info.get('exception_str') or '',
        })
        b['count'] += 1
        if row.created_at and row.created_at < b['first_seen']:
            b['first_seen'] = row.created_at
        if row.created_at and row.created_at > b['last_seen']:
            b['last_seen'] = row.created_at
    return list(buckets.values())


def _maybe_send_system_online_or_heartbeat(payload, recipients, dispatch):
    """Confirm the QA pipeline is alive even when nothing is broken.

    - First webhook ever (and no bug alert just sent) → 'System Online' email.
    - Subsequent green runs → at most one daily 'Heartbeat' email per 24 hours.
    - Suppressed entirely if the bug dispatcher already sent an alert/resolve
      for this same run, so the founder is never double-pinged.
    """
    from ..models import AuditLog
    from ..services.email_service import send_general_notification

    if not recipients:
        return {'sent': 0, 'kind': None, 'reason': 'no_recipients'}

    if (dispatch or {}).get('alerts', 0) > 0 or (dispatch or {}).get('resolves', 0) > 0:
        return {'sent': 0, 'kind': None, 'reason': 'covered_by_dispatch'}

    suite_name = payload.get('suite') or 'wiamapp-qa'
    score = payload.get('score')
    summary = (payload.get('summary') or '').strip()
    overall_status = str(payload.get('status', 'unknown')).lower()
    run_url = payload.get('run_url') or (
        f"{current_app.config.get('APP_URL', 'https://wiamapp.com').rstrip('/')}/team?view=qa_tester"
    )
    dashboard_url = (
        f"{current_app.config.get('APP_URL', 'https://wiamapp.com').rstrip('/')}/team?view=qa_tester"
    )
    now = datetime.utcnow()
    ts = now.strftime('%Y-%m-%d %H:%M:%S UTC')

    last_online = _last_audit_event('QA_SYSTEM_ONLINE_EMAIL')
    last_heartbeat = _last_audit_event('QA_DAILY_HEARTBEAT_EMAIL')

    if not last_online:
        subject = '[WiamApp QA] System Online — automation pipeline confirmed'
        msg = (
            'Your enterprise QA automation pipeline has just delivered its first end-to-end signal.\n\n'
            f'When: {ts}\n'
            f'Suite: {suite_name}\n'
            f'Status: {overall_status.upper()}\n'
            f'Score: {score}\n'
            f'Run: {run_url}\n\n'
            'From now on you will receive:\n'
            '- Immediate alerts on any bug (within minutes of detection).\n'
            '- Hourly reminders while a bug remains open.\n'
            '- Resolution emails when a bug is fixed.\n'
            '- A daily heartbeat email while everything is green, so the pipeline is never silently dead.\n\n'
            'CEO rest mode is now active.'
        )
        for email in recipients:
            send_general_notification(
                email, subject, msg,
                cta_text='Open QA Dashboard',
                cta_link=dashboard_url,
            )
        db.session.add(AuditLog(
            actor_user_id=0,
            action='QA_SYSTEM_ONLINE_EMAIL',
            target_type='QA',
            target_id=None,
            details_json=json.dumps({
                'suite': suite_name,
                'recipients': recipients,
                'run_url': run_url,
                'score': score,
                'status': overall_status,
            }),
            ip_address=request.headers.get('X-Forwarded-For', request.remote_addr),
        ))
        return {'sent': len(recipients), 'kind': 'system_online', 'reason': 'first_run'}

    if overall_status != 'pass':
        return {'sent': 0, 'kind': None, 'reason': 'not_green'}

    if last_heartbeat and (now - last_heartbeat.created_at) < timedelta(hours=24):
        return {'sent': 0, 'kind': None, 'reason': 'heartbeat_throttled'}

    subject = '[WiamApp QA] Daily heartbeat — all systems green'
    msg = (
        'Daily QA pipeline heartbeat: everything is green.\n\n'
        f'When: {ts}\n'
        f'Suite: {suite_name}\n'
        f'Status: PASS\n'
        f'Score: {score}\n'
        f'Run: {run_url}\n\n'
        f'{summary}\n\n'
        'You are receiving this once per day to confirm the QA pipeline is alive. '
        'If anything breaks, you will be alerted immediately.'
    )
    for email in recipients:
        send_general_notification(
            email, subject, msg,
            cta_text='Open QA Dashboard',
            cta_link=dashboard_url,
        )
    db.session.add(AuditLog(
        actor_user_id=0,
        action='QA_DAILY_HEARTBEAT_EMAIL',
        target_type='QA',
        target_id=None,
        details_json=json.dumps({
            'suite': suite_name,
            'recipients': recipients,
            'run_url': run_url,
            'score': score,
            'summary': summary[:200],
        }),
        ip_address=request.headers.get('X-Forwarded-For', request.remote_addr),
    ))
    return {'sent': len(recipients), 'kind': 'daily_heartbeat', 'reason': 'ok'}

TEAM_ROLES = ('overall_boss', 'admin', 'team_lead', 'editor', 'moderator', 'engineer', 'marketing', 'translator', 'support', 'finance', 'analyst', 'community_manager', 'qa_tester')

# Roles that are founder-appointed only — never shown on public careers page
FOUNDER_APPOINTED_ROLES = {'overall_boss'}

# ---------------------------------------------------------------------------
# Role metadata for the public /careers page
# ---------------------------------------------------------------------------
ROLE_INFO = {
    'editor': {
        'type': 'editor',
        'title': 'Content Editor',
        'description': 'Review stories, help creators improve their work, and curate the best reading experience on WiamApp.',
        'icon': 'bi-pencil-square',
        'color': '#60a5fa',
        'tags': ['Content Review', 'Proofreading', 'Quality Assurance', 'Remote'],
    },
    'moderator': {
        'type': 'moderator',
        'title': 'Community Moderator',
        'description': 'Keep WiamApp safe, welcoming, and fun for all readers and creators. Enforce community guidelines.',
        'icon': 'bi-shield-check',
        'color': '#4ade80',
        'tags': ['Community Safety', 'Content Moderation', 'User Support', 'Remote'],
    },
    'admin': {
        'type': 'admin',
        'title': 'Platform Administrator',
        'description': 'Manage the WiamApp platform — content moderation, user support, creator applications, and more.',
        'icon': 'bi-gear-wide-connected',
        'color': '#f59e0b',
        'tags': ['Platform Management', 'User Support', 'Operations', 'Remote'],
    },
    'engineer': {
        'type': 'engineer',
        'title': 'Software Engineer',
        'description': 'Build the future of storytelling in Africa. Work on Flask, PostgreSQL, APIs, and more.',
        'icon': 'bi-code-slash',
        'color': '#a78bfa',
        'tags': ['Python', 'Flask', 'PostgreSQL', 'Full-Stack', 'Remote'],
    },
    'marketing': {
        'type': 'marketing',
        'title': 'Marketing & Growth',
        'description': 'Help WiamApp reach millions of readers and creators across Africa and the world.',
        'icon': 'bi-graph-up-arrow',
        'color': '#f472b6',
        'tags': ['Social Media', 'Growth', 'Content Marketing', 'Remote'],
    },
    'translator': {
        'type': 'translator',
        'title': 'Translator',
        'description': 'Help translate stories and the WiamApp platform into more languages to reach readers everywhere.',
        'icon': 'bi-translate',
        'color': '#38bdf8',
        'tags': ['Translation', 'Localization', 'Multilingual', 'Remote'],
    },
    'support': {
        'type': 'support',
        'title': 'User Support',
        'description': 'Help users with account issues, feedback, and questions. Be the friendly face of WiamApp.',
        'icon': 'bi-headset',
        'color': '#38bdf8',
        'tags': ['User Support', 'Feedback', 'Account Help', 'Remote'],
    },
    'finance': {
        'type': 'finance',
        'title': 'Finance Manager',
        'description': 'Manage revenue, creator payouts, coin economy, and platform financial health.',
        'icon': 'bi-wallet2',
        'color': '#d4a843',
        'tags': ['Revenue', 'Payouts', 'Finance', 'Remote'],
    },
    'analyst': {
        'type': 'analyst',
        'title': 'Data Analyst',
        'description': 'Analyze platform data, user behavior, and content performance to drive growth.',
        'icon': 'bi-bar-chart-line',
        'color': '#a78bfa',
        'tags': ['Analytics', 'Data', 'Insights', 'Remote'],
    },
    'overall_boss': {
        'type': 'overall_boss',
        'title': 'Overall Boss',
        'description': 'Second-in-command to the Founder. Oversees all teams, approves major decisions, and leads platform operations.',
        'icon': 'bi-star',
        'color': '#d4a843',
        'tags': ['Leadership', 'Operations', 'Strategy', 'Remote'],
    },
    'team_lead': {
        'type': 'team_lead',
        'title': 'Team Lead',
        'description': 'Lead a department, coordinate team members, review work, and report to leadership.',
        'icon': 'bi-person-badge',
        'color': '#fbbf24',
        'tags': ['Leadership', 'Management', 'Coordination', 'Remote'],
    },
    'community_manager': {
        'type': 'community_manager',
        'title': 'Community Manager',
        'description': 'Engage readers, run events and challenges, manage social presence, and grow the WiamApp community.',
        'icon': 'bi-people',
        'color': '#ec4899',
        'tags': ['Community', 'Events', 'Social Media', 'Engagement', 'Remote'],
    },
    'qa_tester': {
        'type': 'qa_tester',
        'title': 'QA Tester',
        'description': 'Test new features before release, report bugs, verify fixes, and ensure platform quality.',
        'icon': 'bi-bug',
        'color': '#ef4444',
        'tags': ['Testing', 'QA', 'Bug Reporting', 'Quality', 'Remote'],
    },
}


def team_required(f):
    """Decorator: user must be logged in AND have a team role."""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if current_user.role == 'founder':
            return f(*args, **kwargs)
        # Check RBAC roles
        user_roles = current_user.get_roles()
        if any(r in TEAM_ROLES for r in user_roles):
            return f(*args, **kwargs)
        # Legacy fallback
        if current_user.role in TEAM_ROLES:
            return f(*args, **kwargs)
        flash('You do not have access to the Team Dashboard.', 'error')
        return redirect(url_for('home.index'))
    return decorated


# ═══════════════════════════════════════════════════════════════════════════
# PUBLIC: Careers page + role application
# ═══════════════════════════════════════════════════════════════════════════

@team_bp.route('/careers')
def careers():
    """Public careers page — browse open roles and apply."""
    from ..models import ApplicationForm, User, Content, CreatorProfile

    # Check which roles have active forms
    active_forms = ApplicationForm.query.filter_by(is_active=True).all()
    active_types = {f.form_type for f in active_forms}

    roles = []
    for key, info in ROLE_INFO.items():
        if key in FOUNDER_APPOINTED_ROLES:
            continue  # founder-appointed roles are never public
        role_data = dict(info)
        role_data['is_open'] = key in active_types
        roles.append(role_data)

    # Sort: open roles first
    roles.sort(key=lambda r: (0 if r['is_open'] else 1, r['title']))

    open_roles = sum(1 for r in roles if r['is_open'])
    total_users = User.query.count()
    total_stories = Content.query.filter(Content.deleted_at.is_(None)).count()
    total_creators = User.query.filter(User.role.in_(['creator', 'founder'])).count()

    return render_template('careers.html',
        roles=roles,
        open_roles=open_roles,
        total_users=total_users,
        total_stories=total_stories,
        total_creators=total_creators,
    )


@team_bp.route('/careers/apply/<role_type>', methods=['GET', 'POST'])
@csrf.exempt
def apply_role(role_type):
    """Public application form for a specific team role."""
    from ..models import ApplicationForm, ApplicationResponse
    import secrets as _secrets

    if role_type not in ROLE_INFO or role_type in FOUNDER_APPOINTED_ROLES:
        abort(404)

    role_info = ROLE_INFO[role_type]

    # Find the active form for this role
    form = ApplicationForm.query.filter_by(form_type=role_type, is_active=True).first()
    if not form:
        flash('Applications for this role are currently closed.', 'info')
        return redirect(url_for('team.careers'))

    fields = json.loads(form.fields_json or '[]')
    errors = {}
    success = False
    submitted_email = ''

    if request.method == 'POST':
        answers = {}
        for field in fields:
            name = field['name']
            ftype = field.get('type', 'text')

            if ftype == 'checkbox':
                val = 'yes' if request.form.get(name) else ''
            else:
                val = request.form.get(name, '').strip()

            answers[name] = val

            if field.get('required') and not val:
                errors[name] = f'{field["label"]} is required'

        if not errors:
            email = answers.get('email', '').lower().strip()
            name = answers.get('full_name', '')

            if not email or '@' not in email:
                errors['email'] = 'A valid email address is required'
            elif email == 'wiamlabs@gmail.com':
                errors['email'] = 'This email cannot be used for applications. Please use your personal email.'
            else:
                # Check for duplicate application — allow re-apply if rejected
                existing = ApplicationResponse.query.filter_by(
                    form_id=form.id, applicant_email=email
                ).first()
                if existing and existing.status == 'accepted':
                    errors['email'] = 'You have already been accepted for this role.'
                elif existing and existing.status in ('pending',) and existing.is_submitted:
                    errors['email'] = 'You already have a pending application. We will review it soon.'
                else:
                    # Delete old rejected/unsent application so they can re-apply fresh
                    if existing:
                        db.session.delete(existing)
                        db.session.commit()
                    token = _secrets.token_urlsafe(32)
                    resp = ApplicationResponse(
                        form_id=form.id,
                        form_type=form.form_type,
                        applicant_email=email,
                        applicant_name=name,
                        token=token,
                        answers_json=json.dumps(answers),
                        submitted_at=None,  # not yet — pending email verification
                        email_verified=False,
                    )
                    db.session.add(resp)
                    db.session.commit()
                    log.info("Application saved (pending verification): %s for %s", email, role_type)

                    # Send verification code to applicant's personal email
                    try:
                        from ..services.email_service import create_and_send_code
                        sent = create_and_send_code(email, 'team_apply')
                        if sent:
                            session['app_verify_token'] = token
                            session['app_verify_email'] = email
                            return redirect(url_for('team.verify_application_email'))
                        else:
                            errors['email'] = 'Could not send verification email. Please try again.'
                            db.session.delete(resp)
                            db.session.commit()
                    except Exception as e:
                        log.warning("Verification email failed: %s", e)
                        errors['email'] = 'Could not send verification email. Please try again.'
                        db.session.delete(resp)
                        db.session.commit()

    return render_template('team_apply.html',
        role_info=role_info,
        fields=fields,
        errors=errors,
        values=request.form if request.method == 'POST' else {},
        success=success,
        submitted_email=submitted_email,
    )


@team_bp.route('/careers/verify-email', methods=['GET', 'POST'])
@csrf.exempt
def verify_application_email():
    """Verify applicant's personal email before the application is fully submitted."""
    from ..models import ApplicationResponse
    token = session.get('app_verify_token')
    email = session.get('app_verify_email')
    if not token or not email:
        flash('No pending application to verify.', 'error')
        return redirect(url_for('team.careers'))

    resp = ApplicationResponse.query.filter_by(token=token).first()
    if not resp:
        flash('Application not found.', 'error')
        session.pop('app_verify_token', None)
        session.pop('app_verify_email', None)
        return redirect(url_for('team.careers'))

    if request.method == 'POST':
        code = request.form.get('code', '').strip()
        if not code:
            flash('Please enter the verification code.', 'error')
            return render_template('team_verify_email.html', email=email)

        from ..services.email_service import verify_code
        vc = verify_code(email, code, 'team_apply')
        if not vc:
            flash('Invalid or expired code. Please try again.', 'error')
            return render_template('team_verify_email.html', email=email)

        # Mark application as verified and submitted
        resp.email_verified = True
        resp.submitted_at = datetime.utcnow()
        db.session.commit()
        log.info("Application email verified and submitted: %s", email)

        # Notify founder
        try:
            from ..services.email_service import send_new_application_alert
            from ..models import User, ApplicationForm
            founder = User.query.filter_by(role='founder').first()
            form = ApplicationForm.query.get(resp.form_id)
            if founder and founder.email and form:
                role_info = ROLE_INFO.get(form.form_type, {})
                send_new_application_alert(
                    founder.email, resp.applicant_name, email,
                    role_info.get('title', form.form_type.title())
                )
        except Exception as e:
            log.warning("Could not send application alert to founder: %s", e)

        session.pop('app_verify_token', None)
        session.pop('app_verify_email', None)
        flash('Email verified! Your application has been submitted. You will hear from us soon.', 'success')
        return redirect(url_for('team.careers'))

    return render_template('team_verify_email.html', email=email)


# ═══════════════════════════════════════════════════════════════════════════
# TEAM DASHBOARD (authenticated team members)
# ═══════════════════════════════════════════════════════════════════════════

def _base_ctx():
    """Common context data all team dashboards share."""
    from ..models import Content, User
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    # Use RBAC role name for display, not legacy column
    rbac_roles = current_user.get_roles()
    display_role = 'founder'
    if current_user.role == 'founder':
        display_role = 'founder'
    elif rbac_roles:
        display_role = rbac_roles[0]
    else:
        display_role = current_user.role or 'team'
    return {
        'role': display_role,
        'current_time': now,
        'total_users': User.query.count(),
        'new_users_week': User.query.filter(User.date_joined >= week_ago).count(),
        'total_stories': Content.query.filter(Content.deleted_at.is_(None)).count(),
        'total_published': Content.query.filter(
            Content.status.in_(Content.PUBLISHED_STATUSES),
            Content.deleted_at.is_(None)
        ).count(),
    }


def _editor_ctx(ctx):
    """Add editor-specific data."""
    from ..models import Content
    week_ago = ctx['current_time'] - timedelta(days=7)
    ctx['stories_pending_review'] = Content.query.filter(
        Content.status == 'draft',
        Content.deleted_at.is_(None),
    ).order_by(Content.created_at.desc()).limit(20).all()
    ctx['recently_published'] = Content.query.filter(
        Content.status.in_(Content.PUBLISHED_STATUSES),
        Content.deleted_at.is_(None),
        Content.published_at >= week_ago,
    ).order_by(Content.published_at.desc()).limit(20).all()
    return ctx


def _moderator_ctx(ctx):
    """Add moderator-specific data."""
    from ..models import Content, Review
    ctx['recent_reviews'] = Review.query.order_by(Review.created_at.desc()).limit(20).all()
    ctx['reported_count'] = Content.query.filter(
        Content.deleted_at.is_(None), Content.status == 'flagged',
    ).count()
    ctx['flagged_stories'] = Content.query.filter(
        Content.status == 'flagged', Content.deleted_at.is_(None),
    ).order_by(Content.created_at.desc()).limit(10).all()
    return ctx


def _admin_ctx(ctx):
    """Add admin-specific data."""
    from ..models import User, CreatorProfile, Content, PlatformConfig
    month_ago = ctx['current_time'] - timedelta(days=30)
    ctx['active_users_month'] = User.query.filter(User.last_active >= month_ago).count()
    ctx['total_creators'] = User.query.filter(User.role.in_(['creator', 'founder'])).count()
    ctx['reported_count'] = Content.query.filter(
        Content.deleted_at.is_(None), Content.status == 'flagged',
    ).count()
    ctx['pending_apps'] = User.query.filter(User.creator_application_status == 'pending').count()
    ctx['recent_users'] = User.query.order_by(User.date_joined.desc()).limit(15).all()
    ctx['pending_creators'] = User.query.filter(
        User.creator_application_status == 'pending'
    ).order_by(User.date_joined.desc()).all()
    ctx['platform_cfg'] = PlatformConfig.get()
    return ctx


def _marketing_ctx(ctx):
    """Add marketing-specific data."""
    from ..models import User, Favorite, Rating
    ctx['user_growth'] = []
    for i in range(7):
        day = ctx['current_time'] - timedelta(days=6 - i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = User.query.filter(
            User.date_joined >= day_start, User.date_joined < day_end
        ).count()
        ctx['user_growth'].append({'day': day_start.strftime('%a'), 'count': count})
    ctx['total_favorites'] = Favorite.query.count()
    ctx['total_ratings'] = Rating.query.count()
    return ctx


def _engineer_ctx(ctx):
    """Add engineer-specific data."""
    import sys, platform
    ctx['python_version'] = sys.version.split()[0]
    ctx['platform'] = platform.platform()
    ctx['db_tables'] = len(db.metadata.tables)
    return ctx


def _translator_ctx(ctx):
    """Add translator-specific data."""
    from ..models import Content
    ctx['published_stories'] = Content.query.filter(
        Content.status.in_(Content.PUBLISHED_STATUSES),
        Content.deleted_at.is_(None),
    ).order_by(Content.views.desc()).limit(30).all()
    return ctx


def _support_ctx(ctx):
    """Add support-specific data."""
    from ..models import Feedback, BotUnmatchedMessage, User
    month_ago = ctx['current_time'] - timedelta(days=30)
    ctx['open_feedback'] = Feedback.query.filter(
        Feedback.status.in_(['new', 'read'])
    ).count() if hasattr(Feedback, 'status') else 0
    ctx['resolved_feedback_30d'] = Feedback.query.filter(
        Feedback.status == 'resolved',
        Feedback.created_at >= month_ago,
    ).count() if hasattr(Feedback, 'status') else 0
    ctx['recent_feedback'] = Feedback.query.order_by(
        Feedback.created_at.desc()
    ).limit(15).all()
    ctx['unmatched_questions'] = BotUnmatchedMessage.query.filter(
        BotUnmatchedMessage.resolved != True
    ).count()
    ctx['unmatched_list'] = BotUnmatchedMessage.query.filter(
        BotUnmatchedMessage.resolved != True
    ).order_by(BotUnmatchedMessage.created_at.desc()).limit(15).all()
    ctx['banned_users'] = User.query.filter(
        User.status.in_(['banned', 'suspended', 'blocked'])
    ).order_by(User.date_joined.desc()).limit(20).all()
    return ctx


def _finance_ctx(ctx):
    """Add finance-specific data."""
    from ..models import (
        CoinTransaction, EliteSubscription, PlatformConfig,
        CreatorEarnings, CreatorPayout, CreatorPayoutSettings,
        CreatorProfile, RevenueRule, User, CoinBalance,
    )
    cfg = PlatformConfig.get()
    # Revenue
    all_purchase_coins = db.session.query(
        func.coalesce(func.sum(CoinTransaction.amount), 0)
    ).filter(CoinTransaction.type == 'purchase').scalar() or 0
    from ..services.monetization import COIN_TO_GHS as _CTG
    ctx['coin_revenue_ghs'] = abs(all_purchase_coins) * _CTG
    ctx['total_purchases'] = CoinTransaction.query.filter_by(type='purchase').count()
    ctx['active_subs'] = EliteSubscription.query.filter_by(status='active').count()
    ctx['sub_revenue_ghs'] = ctx['active_subs'] * cfg.elite_price_ghs
    ctx['total_revenue_ghs'] = ctx['coin_revenue_ghs'] + ctx['sub_revenue_ghs']
    month_start = ctx['current_time'].replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_coins = db.session.query(
        func.coalesce(func.sum(CoinTransaction.amount), 0)
    ).filter(CoinTransaction.type == 'purchase', CoinTransaction.created_at >= month_start).scalar() or 0
    ctx['month_revenue_ghs'] = abs(month_coins) * _CTG + ctx['sub_revenue_ghs']
    # Coins in circulation
    ctx['total_coins_circulation'] = db.session.query(
        func.coalesce(func.sum(CoinBalance.balance), 0)
    ).scalar() or 0
    # Payouts
    ctx['pending_payouts'] = CreatorPayout.query.filter(
        CreatorPayout.status.in_(['pending', 'processing'])
    ).count()
    ctx['total_paid_out'] = db.session.query(
        func.coalesce(func.sum(CreatorPayout.amount_ghs), 0)
    ).filter(CreatorPayout.status == 'sent').scalar() or 0
    ctx['total_payouts_count'] = CreatorPayout.query.filter_by(status='sent').count()
    # Recent payouts
    recent_p = CreatorPayout.query.order_by(CreatorPayout.created_at.desc()).limit(15).all()
    creator_ids = list({p.creator_id for p in recent_p})
    c_map = {u.wiam_id: u for u in User.query.filter(User.wiam_id.in_(creator_ids)).all()} if creator_ids else {}
    for p in recent_p:
        u = c_map.get(p.creator_id)
        p.creator_name = u.display_name if u else None
    ctx['recent_payouts'] = recent_p
    # Revenue rules
    ctx['revenue_rules'] = RevenueRule.query.order_by(RevenueRule.rule_type).all()
    # Top earners
    earner_rows = db.session.query(
        CreatorEarnings.creator_id,
        func.sum(CreatorEarnings.total_coins).label('tc'),
        func.sum(CreatorEarnings.creator_share_ghs).label('cg'),
    ).group_by(CreatorEarnings.creator_id).order_by(func.sum(CreatorEarnings.total_coins).desc()).limit(10).all()
    earner_ids = [r[0] for r in earner_rows]
    e_map = {u.wiam_id: u for u in User.query.filter(User.wiam_id.in_(earner_ids)).all()} if earner_ids else {}
    ep_map = {p.wiam_id: p for p in CreatorProfile.query.filter(CreatorProfile.wiam_id.in_(earner_ids)).all()} if earner_ids else {}
    ctx['top_earners'] = [{
        'name': (ep_map[r[0]].pen_name if r[0] in ep_map else (e_map[r[0]].display_name if r[0] in e_map else f'ID:{r[0]}')),
        'total_coins': r[1] or 0,
        'creator_ghs': r[2] or 0.0,
    } for r in earner_rows]
    return ctx


def _analyst_ctx(ctx):
    """Add analyst-specific data (read-only analytics)."""
    from ..models import (
        Content, User, Rating, Favorite, WebBookContent,
        ChapterComment, CreatorProfile, CoinTransaction,
        EliteSubscription, PlatformConfig,
    )
    from sqlalchemy import func as sqfunc
    week_ago = ctx['current_time'] - timedelta(days=7)
    # Reads
    ctx['total_reads'] = db.session.query(
        func.coalesce(func.sum(Content.views), 0)
    ).filter(Content.deleted_at.is_(None)).scalar() or 0
    # Creators
    ctx['total_creators'] = User.query.filter(User.role.in_(['creator', 'founder'])).count()
    # Rating
    avg_r = db.session.query(func.avg(Rating.rating)).scalar()
    ctx['avg_rating'] = float(avg_r) if avg_r else 0.0
    ctx['total_ratings'] = Rating.query.count()
    ctx['total_favorites'] = 0  # Favorites feature removed
    ctx['total_comments'] = ChapterComment.query.count()
    ctx['total_chapters'] = WebBookContent.query.count()
    # User growth
    ctx['user_growth'] = []
    for i in range(7):
        day = ctx['current_time'] - timedelta(days=6 - i)
        ds = day.replace(hour=0, minute=0, second=0, microsecond=0)
        de = ds + timedelta(days=1)
        count = User.query.filter(User.date_joined >= ds, User.date_joined < de).count()
        ctx['user_growth'].append({'day': ds.strftime('%a'), 'count': count})
    # Top stories
    top = Content.query.filter(
        Content.status.in_(Content.PUBLISHED_STATUSES),
        Content.deleted_at.is_(None),
    ).order_by(Content.views.desc().nullslast()).limit(10).all()
    for s in top:
        avg = db.session.query(func.avg(Rating.rating)).filter(Rating.content_id == s.id).scalar()
        s.avg_rating = float(avg) if avg else None
    ctx['top_stories'] = top
    # Revenue (read-only)
    all_purchase_coins = db.session.query(
        func.coalesce(func.sum(CoinTransaction.amount), 0)
    ).filter(CoinTransaction.type == 'purchase').scalar() or 0
    from ..services.monetization import COIN_TO_GHS as _CTG2
    ctx['coin_revenue_ghs'] = abs(all_purchase_coins) * _CTG2
    ctx['total_purchases'] = CoinTransaction.query.filter_by(type='purchase').count()
    cfg = PlatformConfig.get()
    ctx['active_subs'] = EliteSubscription.query.filter_by(status='active').count()
    return ctx


def _overall_boss_ctx(ctx):
    """Overall Boss sees everything — combined admin + editor + moderator + finance."""
    for builder in [_admin_ctx, _editor_ctx, _moderator_ctx, _marketing_ctx]:
        try:
            builder(ctx)
        except Exception as e:
            log.error("_overall_boss_ctx sub-builder %s failed: %s", builder.__name__, e)
    # Finance context is optional — may fail if tables not fully migrated
    try:
        _finance_ctx(ctx)
    except Exception as e:
        log.warning("Finance context unavailable for overall_boss: %s", e)
    return ctx


def _team_lead_ctx(ctx):
    """Team Lead sees editor + moderator overview."""
    _editor_ctx(ctx)
    _moderator_ctx(ctx)
    _marketing_ctx(ctx)
    return ctx


def _community_manager_ctx(ctx):
    """Community Manager: reader engagement, social stats, events."""
    from ..models import User, Content, Follow, BulletinPost, Feedback
    month_ago = ctx['current_time'] - timedelta(days=30)
    ctx['total_users'] = User.query.count()
    ctx['new_users_30d'] = User.query.filter(User.date_joined >= month_ago).count()
    ctx['total_follows'] = Follow.query.count()
    ctx['total_creators'] = User.query.filter(User.role.in_(['creator', 'founder'])).count()
    try:
        ctx['bulletin_posts_30d'] = BulletinPost.query.filter(
            BulletinPost.created_at >= month_ago,
            BulletinPost.deleted_at.is_(None),
        ).count()
    except Exception:
        ctx['bulletin_posts_30d'] = 0
    ctx['open_feedback'] = Feedback.query.filter(
        Feedback.status.in_(['new', 'read'])
    ).count() if hasattr(Feedback, 'status') else 0
    ctx['recent_feedback'] = Feedback.query.order_by(
        Feedback.created_at.desc()
    ).limit(10).all()
    return ctx


def _qa_tester_ctx(ctx):
    """QA Tester: platform health + AI-assisted launch readiness insights."""
    from ..models import Content, User, PlatformConfig, FeatureFlag, AuditLog
    ctx['total_stories'] = Content.query.filter(Content.deleted_at.is_(None)).count()
    ctx['total_users'] = User.query.count()
    ctx['published_stories'] = Content.query.filter(
        Content.status.in_(Content.PUBLISHED_STATUSES),
        Content.deleted_at.is_(None),
    ).count()
    ctx['flagged_stories'] = Content.query.filter(
        Content.status == 'flagged',
        Content.deleted_at.is_(None),
    ).count()
    try:
        ctx['feature_flags'] = FeatureFlag.query.order_by(FeatureFlag.key).all()
    except Exception:
        ctx['feature_flags'] = []
    try:
        cfg = PlatformConfig.get()
        ctx['platform_config'] = cfg
    except Exception:
        ctx['platform_config'] = None

    # --- AI QA summary (rule-based, deterministic) ---
    total = max(1, int(ctx.get('total_stories') or 0))
    flagged = int(ctx.get('flagged_stories') or 0)
    flagged_pct = round((flagged / total) * 100, 2)
    ctx['flagged_ratio_pct'] = flagged_pct

    play_required = bool(current_app.config.get('PLAY_INTEGRITY_REQUIRED_FOR_TRIAL', False))
    play_enforced = bool(current_app.config.get('PLAY_INTEGRITY_ENFORCE', False))
    ios_required = bool(current_app.config.get('IOS_INTEGRITY_REQUIRED_FOR_TRIAL', False))
    ios_enforced = bool(current_app.config.get('IOS_INTEGRITY_ENFORCE', False))
    ctx['integrity_config'] = {
        'play_required': play_required,
        'play_enforced': play_enforced,
        'ios_required': ios_required,
        'ios_enforced': ios_enforced,
    }

    security_actions = (
        'TRIAL_INTEGRITY_CHECK',
        'TRIAL_IOS_INTEGRITY_CHECK',
        'TRIAL_ANDROID_NONCE_REJECTED',
        'TRIAL_IOS_NONCE_REJECTED',
        'PLAY_INTEGRITY_VERIFY',
        'IOS_INTEGRITY_VERIFY',
    )
    day_ago = datetime.utcnow() - timedelta(hours=24)
    recent_audits = AuditLog.query.filter(
        AuditLog.created_at >= day_ago,
        AuditLog.action.in_(security_actions),
    ).order_by(AuditLog.created_at.desc()).limit(120).all()
    failures = 0
    for a in recent_audits:
        payload = str(a.details_json or '').lower()
        if ('allow_trial' in payload and 'false' in payload) or ('rejected' in payload):
            failures += 1
    ctx['security_audit_24h'] = {
        'events': len(recent_audits),
        'failures': failures,
    }

    # Recent CI/automation reports posted by QA pipeline
    raw_reports = AuditLog.query.filter(
        AuditLog.action == 'QA_AUTOMATION_REPORT'
    ).order_by(AuditLog.created_at.desc()).limit(20).all()
    reports = []
    pass_count = 0
    fail_count = 0
    for r in raw_reports:
        try:
            payload = json.loads(r.details_json or '{}')
        except Exception:
            payload = {}
        status = (payload.get('status') or 'unknown').lower()
        if status == 'pass':
            pass_count += 1
        elif status in ('fail', 'failed'):
            fail_count += 1
        reports.append({
            'suite': payload.get('suite') or 'unknown',
            'status': status,
            'score': payload.get('score'),
            'environment': payload.get('environment') or 'unknown',
            'platform': payload.get('platform') or 'mixed',
            'run_url': payload.get('run_url') or '',
            'summary': payload.get('summary') or '',
            'created_at': r.created_at,
        })
    ctx['qa_automation_reports'] = reports
    ctx['qa_automation_stats'] = {
        'total': len(reports),
        'pass': pass_count,
        'fail': fail_count,
    }
    ctx['qa_alert_recipients_preview'] = _qa_alert_recipients()

    blockers = []
    warnings = []
    checks = []
    score = 100

    # Check 1: abuse hardening coverage
    hardening_ok = play_required and play_enforced and ios_required and ios_enforced
    if hardening_ok:
        checks.append({'name': 'Trial anti-abuse hardening', 'status': 'pass', 'detail': 'Android + iOS integrity required and enforced.'})
    else:
        checks.append({'name': 'Trial anti-abuse hardening', 'status': 'fail', 'detail': 'Integrity not fully required/enforced on both platforms.'})
        blockers.append('Integrity hardening is not fully enforced on both Android and iOS.')
        score -= 30

    # Check 2: content health baseline
    if flagged_pct <= 2.5:
        checks.append({'name': 'Flagged content ratio', 'status': 'pass', 'detail': f'{flagged_pct}% flagged stories (healthy).'})
    elif flagged_pct <= 6:
        checks.append({'name': 'Flagged content ratio', 'status': 'warn', 'detail': f'{flagged_pct}% flagged stories (watch list).'})
        warnings.append('Flagged content ratio is rising; increase moderation pass before launch.')
        score -= 8
    else:
        checks.append({'name': 'Flagged content ratio', 'status': 'fail', 'detail': f'{flagged_pct}% flagged stories (too high).'})
        blockers.append('Flagged content ratio is too high for clean launch quality.')
        score -= 20

    # Check 3: security signal visibility
    if len(recent_audits) > 0:
        checks.append({'name': 'Security signal telemetry', 'status': 'pass', 'detail': f'{len(recent_audits)} security events logged in 24h.'})
    else:
        checks.append({'name': 'Security signal telemetry', 'status': 'warn', 'detail': 'No integrity/trial security events recorded in last 24h.'})
        warnings.append('No recent security telemetry; run trial tests to validate anti-abuse in production.')
        score -= 6

    score = max(0, min(100, score))
    release_state = 'READY' if (not blockers and score >= 80) else 'NOT_READY'
    ctx['qa_ai_summary'] = {
        'score': score,
        'state': release_state,
        'blockers': blockers,
        'warnings': warnings,
        'checks': checks,
    }
    return ctx


@team_bp.route('/qa/automation/report', methods=['POST'])
@csrf.exempt
def qa_automation_report():
    """
    Receive CI QA results and store them for QA dashboard visibility.
    Protected by shared secret header.
    """
    from ..models import AuditLog
    secret = (current_app.config.get('QA_AUTOMATION_WEBHOOK_SECRET') or '').strip()
    provided = (request.headers.get('X-QA-Webhook-Secret') or '').strip()
    if not secret:
        return jsonify({'ok': False, 'error': 'QA webhook is not configured on server'}), 503
    if not provided or provided != secret:
        return jsonify({'ok': False, 'error': 'Unauthorized webhook request'}), 401

    data = request.get_json(silent=True) or {}
    payload = {
        'suite': (data.get('suite') or 'enterprise-ceo-rest-mode').strip(),
        'status': (data.get('status') or 'unknown').strip().lower(),
        'score': int(data.get('score') or 0),
        'environment': (data.get('environment') or 'ci').strip(),
        'platform': (data.get('platform') or 'mixed').strip(),
        'run_url': (data.get('run_url') or '').strip(),
        'summary': (data.get('summary') or '').strip(),
        'metrics': data.get('metrics') if isinstance(data.get('metrics'), dict) else {},
    }

    log_row = AuditLog(
        actor_user_id=0,
        action='QA_AUTOMATION_REPORT',
        target_type='QA',
        target_id=None,
        details_json=json.dumps(payload),
        ip_address=request.headers.get('X-Forwarded-For', request.remote_addr),
    )
    db.session.add(log_row)
    dispatch = {'alerts': 0, 'resolves': 0, 'reason': 'not_run'}
    heartbeat = {'sent': 0, 'kind': None, 'reason': 'not_run'}
    try:
        dispatch = _send_bug_alerts_and_resolutions(payload)
    except Exception as e:
        log.error("QA automation alert dispatch failed: %s", e)
        dispatch = {'alerts': 0, 'resolves': 0, 'reason': f'dispatch_error:{type(e).__name__}'}
    try:
        heartbeat = _maybe_send_system_online_or_heartbeat(
            payload, _qa_alert_recipients(), dispatch
        )
    except Exception as e:
        log.error("QA heartbeat dispatch failed: %s", e)
        heartbeat = {'sent': 0, 'kind': None, 'reason': f'heartbeat_error:{type(e).__name__}'}
    db.session.commit()
    return jsonify({'ok': True, 'saved': True, 'dispatch': dispatch, 'heartbeat': heartbeat})


@team_bp.route('/qa/watchdog/probe', methods=['POST'])
@csrf.exempt
def qa_watchdog_probe():
    """
    Receive synthetic-probe results (from CI or local runner) and feed them
    through the existing QA dispatcher so each target gets:
      - immediate alert on first failure,
      - hourly reminder while still failing,
      - resolution email on recovery,
      - heartbeat coverage on green periods.

    Protected by the same shared secret as the automation report endpoint.
    Expected JSON body:
        {
            "suite": "watchdog-production",   # optional, default applied
            "run_url": "https://...",
            "probes": [
                {"target": "GET /health", "url": "...", "ok": true,
                 "status_code": 200, "latency_ms": 123, "max_latency_ms": 5000},
                ...
            ]
        }
    """
    from ..models import AuditLog
    from ..services.qa_watchdog import build_payload as _watchdog_build_payload

    secret = (current_app.config.get('QA_AUTOMATION_WEBHOOK_SECRET') or '').strip()
    provided = (request.headers.get('X-QA-Webhook-Secret') or '').strip()
    if not secret:
        return jsonify({'ok': False, 'error': 'QA webhook is not configured on server'}), 503
    if not provided or provided != secret:
        return jsonify({'ok': False, 'error': 'Unauthorized webhook request'}), 401

    data = request.get_json(silent=True) or {}
    probes = data.get('probes') if isinstance(data.get('probes'), list) else []
    suite_name = (data.get('suite') or 'watchdog-production').strip() or 'watchdog-production'
    run_url = (data.get('run_url') or '').strip()

    payload = _watchdog_build_payload(
        probes,
        suite_name=suite_name,
        run_url=run_url,
        environment=(data.get('environment') or 'github-actions').strip(),
        platform=(data.get('platform') or 'wiamapp-backend').strip(),
    )

    # Roll up runtime exceptions captured by the got_request_exception
    # signal in the last hour. Each unique (endpoint, exception_class)
    # combination becomes a synthetic probe entry so the existing bug
    # dispatcher gets to alert on it with the same 1-hour cadence as
    # everything else (no separate email pipeline to babysit).
    runtime_exception_count = 0
    try:
        runtime_buckets = _aggregate_recent_runtime_exceptions(window_hours=1)
        runtime_exception_count = sum(b.get('count', 0) for b in runtime_buckets)
        if runtime_buckets:
            existing_suites = payload['metrics'].get('suites', [])
            for b in runtime_buckets:
                label = f"runtime::{b['endpoint']}::{b['exception_class']}"
                detail = (
                    f"{b['count']}x in last hour — sample: "
                    f"{b.get('sample_message', '')[:200]}"
                )
                existing_suites.append({
                    'label': label,
                    'status': 'fail',
                    'detail': detail,
                })
            payload['metrics']['suites'] = existing_suites
            payload['status'] = 'fail'
            if isinstance(payload.get('summary'), str) and payload['summary']:
                payload['summary'] = (
                    f"{payload['summary']} | "
                    f"{len(runtime_buckets)} unique runtime exception(s) "
                    f"({runtime_exception_count} total) in last hour"
                )
            else:
                payload['summary'] = (
                    f"{len(runtime_buckets)} unique runtime exception(s) "
                    f"({runtime_exception_count} total) in last hour"
                )
    except Exception as e:
        log.error("QA watchdog runtime-exception roll-up failed: %s", e)

    log_row = AuditLog(
        actor_user_id=0,
        action='QA_WATCHDOG_REPORT',
        target_type='QA',
        target_id=None,
        details_json=json.dumps(payload),
        ip_address=request.headers.get('X-Forwarded-For', request.remote_addr),
    )
    db.session.add(log_row)

    dispatch = {'alerts': 0, 'resolves': 0, 'reason': 'not_run'}
    heartbeat = {'sent': 0, 'kind': None, 'reason': 'not_run'}
    try:
        dispatch = _send_bug_alerts_and_resolutions(payload)
    except Exception as e:
        log.error("QA watchdog dispatch failed: %s", e)
        dispatch = {'alerts': 0, 'resolves': 0, 'reason': f'dispatch_error:{type(e).__name__}'}
    try:
        heartbeat = _maybe_send_system_online_or_heartbeat(
            payload, _qa_alert_recipients(), dispatch
        )
    except Exception as e:
        log.error("QA watchdog heartbeat failed: %s", e)
        heartbeat = {'sent': 0, 'kind': None, 'reason': f'heartbeat_error:{type(e).__name__}'}
    db.session.commit()

    return jsonify({
        'ok': True,
        'saved': True,
        'suite': suite_name,
        'overall_status': payload.get('status'),
        'probes_in': len(probes),
        'runtime_exceptions_last_hour': runtime_exception_count,
        'dispatch': dispatch,
        'heartbeat': heartbeat,
    })


# Template map: role → (template_path, context_builders)
_ROLE_DASHBOARDS = {
    'overall_boss':      ('team/overall_boss_dashboard.html', [_overall_boss_ctx]),
    'admin':             ('team/admin_dashboard.html',        [_admin_ctx]),
    'team_lead':         ('team/team_lead_dashboard.html',    [_team_lead_ctx]),
    'editor':            ('team/editor_dashboard.html',       [_editor_ctx]),
    'moderator':         ('team/moderator_dashboard.html',    [_moderator_ctx]),
    'engineer':          ('team/engineer_dashboard.html',     [_engineer_ctx]),
    'marketing':         ('team/marketing_dashboard.html',    [_marketing_ctx]),
    'translator':        ('team/translator_dashboard.html',   [_translator_ctx]),
    'support':           ('team/support_dashboard.html',      [_support_ctx]),
    'finance':           ('team/finance_dashboard.html',      [_finance_ctx]),
    'analyst':           ('team/analyst_dashboard.html',      [_analyst_ctx]),
    'community_manager': ('team/community_manager_dashboard.html', [_community_manager_ctx]),
    'qa_tester':         ('team/qa_tester_dashboard.html',    [_qa_tester_ctx]),
}


@team_bp.route('/')
@team_required
def dashboard():
    """Main team dashboard — routes each role to their dedicated dashboard."""
    try:
        ctx = _base_ctx()
    except Exception as e:
        log.error("Team dashboard _base_ctx failed: %s", e)
        flash('Dashboard temporarily unavailable. Please try again.', 'error')
        return redirect(url_for('profile.my_profile'))

    # Founder and Overall Boss can switch between any dashboard via ?view= parameter
    is_superuser = current_user.role == 'founder'
    user_roles = current_user.get_roles()
    if not is_superuser:
        is_superuser = 'overall_boss' in user_roles

    view_as = request.args.get('view', '')
    ctx['all_dashboards'] = list(_ROLE_DASHBOARDS.keys()) if is_superuser else []
    ctx['current_view'] = view_as
    ctx['is_superuser'] = is_superuser

    if is_superuser and view_as and view_as in _ROLE_DASHBOARDS:
        # Founder/Overall Boss switching to a specific role dashboard
        template, builders = _ROLE_DASHBOARDS[view_as]
        for builder in builders:
            try:
                builder(ctx)
            except Exception as e:
                log.error("Dashboard builder %s failed: %s", builder.__name__, e)
        ctx['role'] = 'founder' if current_user.role == 'founder' else 'overall_boss'
        ri = ROLE_INFO.get(view_as, {})
        ctx['role_title'] = ri.get('title', view_as.replace('_', ' ').title())
        ctx['role_icon'] = ri.get('icon', 'bi-person-badge')
        return render_template(template, **ctx)

    # Default: Founder and Overall Boss get the full overview dashboard
    if is_superuser:
        try:
            _overall_boss_ctx(ctx)
        except Exception as e:
            log.error("Superuser dashboard context failed: %s", e)
        _r = 'founder' if current_user.role == 'founder' else 'overall_boss'
        ctx['role'] = _r
        ctx['role_title'] = 'Founder' if _r == 'founder' else 'Overall Boss'
        ctx['role_icon'] = 'bi-star-fill' if _r == 'founder' else 'bi-star'
        return render_template('team/overall_boss_dashboard.html', **ctx)

    # Regular team members: use RBAC roles to determine which dashboard
    # Priority order: admin > team_lead > editor > moderator > others
    for role_name in ['admin', 'team_lead', 'editor', 'moderator',
                      'engineer', 'marketing', 'translator', 'support', 'finance', 'analyst',
                      'community_manager', 'qa_tester']:
        if role_name in user_roles and role_name in _ROLE_DASHBOARDS:
            template, builders = _ROLE_DASHBOARDS[role_name]
            for builder in builders:
                try:
                    builder(ctx)
                except Exception as e:
                    log.error("Dashboard builder %s failed: %s", builder.__name__, e)
            # Inject role metadata for greeting partial
            ri = ROLE_INFO.get(role_name, {})
            ctx.setdefault('role', role_name)
            ctx['role_title'] = ri.get('title', role_name.replace('_', ' ').title())
            ctx['role_icon'] = ri.get('icon', 'bi-person-badge')
            return render_template(template, **ctx)

    # Fallback — generic editor dashboard
    try:
        _editor_ctx(ctx)
    except Exception:
        pass
    ctx.setdefault('role', 'editor')
    ctx['role_title'] = 'Content Editor'
    ctx['role_icon'] = 'bi-pencil-square'
    return render_template('team/editor_dashboard.html', **ctx)


def _has_team_access(user, required_role):
    """Check if user has access to a team tool (write actions).
    Founder and Overall Boss have access to ALL team tools.
    Team Lead has access to editor + moderator + marketing tools.
    Otherwise, user must have the specific role.
    """
    if user.role == 'founder':
        return True
    roles = set(user.get_roles())
    if 'overall_boss' in roles:
        return True
    if 'team_lead' in roles and required_role in ('editor', 'moderator', 'marketing'):
        return True
    if required_role == 'admin' and user.role == 'admin':
        return True
    return required_role in roles or user.role == required_role


def _has_team_read_access(user):
    """Check if user has any team role — for shared read-only views
    (user list, flagged stories) that all team members can see."""
    if user.role == 'founder':
        return True
    if getattr(user, 'is_team_account', False):
        return True
    roles = set(user.get_roles())
    return bool(roles & set(TEAM_ROLES))


# ═══════════════════════════════════════════════════════════════════════════
# EDITOR ACTIONS
# ═══════════════════════════════════════════════════════════════════════════

@team_bp.route('/editor/review/<int:story_id>')
@team_required
def editor_review(story_id):
    """Review a story's details and chapters — accessible to all team members (read-only)."""
    if not _has_team_read_access(current_user):
        abort(403)
    from ..models import Content, WebBookContent, User
    story = Content.query.get_or_404(story_id)
    chapters = WebBookContent.query.filter_by(content_id=story_id).order_by(
        WebBookContent.chapter_number
    ).all()
    author = User.query.filter_by(wiam_id=story.creator_wiam_id).first()
    return render_template('team_editor_review.html', story=story, chapters=chapters, author=author)


@team_bp.route('/editor/approve/<int:story_id>', methods=['POST'])
@team_required
def editor_approve(story_id):
    """Editor: approve a story (change status to published)."""
    if not _has_team_access(current_user, 'editor'):
        abort(403)
    from ..models import Content
    story = Content.query.get_or_404(story_id)
    if story.status == 'draft':
        story.status = 'published'
        story.published_at = datetime.utcnow()
        db.session.commit()
        flash(f'"{story.title}" has been approved and published.', 'success')
        log.info("Editor %s approved story %s", current_user.display_name, story_id)
    else:
        flash('Story is not in draft status.', 'warning')
    return redirect(url_for('team.dashboard'))


@team_bp.route('/editor/request-revision/<int:story_id>', methods=['POST'])
@team_required
def editor_request_revision(story_id):
    """Editor: request revision on a story."""
    if not _has_team_access(current_user, 'editor'):
        abort(403)
    from ..models import Content
    story = Content.query.get_or_404(story_id)
    note = request.form.get('note', '').strip()
    if story.status in ('draft', 'published'):
        story.status = 'revision_requested'
        db.session.commit()
        flash(f'Revision requested for "{story.title}".', 'info')
        log.info("Editor %s requested revision for story %s: %s", current_user.display_name, story_id, note)
    return redirect(url_for('team.dashboard'))


# ═══════════════════════════════════════════════════════════════════════════
# MODERATOR ACTIONS
# ═══════════════════════════════════════════════════════════════════════════

@team_bp.route('/mod/flag/<int:story_id>', methods=['POST'])
@team_required
def mod_flag_story(story_id):
    """Moderator: flag a story for guideline violations."""
    if not _has_team_access(current_user, 'moderator'):
        abort(403)
    from ..models import Content
    story = Content.query.get_or_404(story_id)
    reason = request.form.get('reason', '').strip()
    story.status = 'flagged'
    db.session.commit()
    flash(f'"{story.title}" has been flagged.', 'warning')
    log.info("Moderator %s flagged story %s: %s", current_user.display_name, story_id, reason)
    return redirect(url_for('team.dashboard'))


@team_bp.route('/mod/unflag/<int:story_id>', methods=['POST'])
@team_required
def mod_unflag_story(story_id):
    """Moderator: unflag a story (restore to published)."""
    if not _has_team_access(current_user, 'moderator'):
        abort(403)
    from ..models import Content
    story = Content.query.get_or_404(story_id)
    if story.status == 'flagged':
        story.status = 'published'
        db.session.commit()
        flash(f'"{story.title}" has been unflagged and restored.', 'success')
        log.info("Moderator %s unflagged story %s", current_user.display_name, story_id)
    return redirect(url_for('team.dashboard'))


@team_bp.route('/mod/ban-user/<int:user_id>', methods=['POST'])
@team_required
def mod_ban_user(user_id):
    """Moderator: ban a user."""
    if not _has_team_access(current_user, 'moderator'):
        abort(403)
    from ..models import User
    user = User.query.get_or_404(user_id)
    if user.is_founder or user.is_admin:
        flash('Cannot ban admins or the founder.', 'error')
        return redirect(url_for('team.dashboard'))
    reason = request.form.get('reason', '').strip()
    user.status = 'banned'
    db.session.commit()
    flash(f'{user.display_name} has been banned.', 'warning')
    log.info("Moderator %s banned user %s (id=%s): %s", current_user.display_name, user.display_name, user_id, reason)
    return redirect(url_for('team.dashboard'))


@team_bp.route('/mod/unban-user/<int:user_id>', methods=['POST'])
@team_required
def mod_unban_user(user_id):
    """Moderator: unban a user."""
    if not _has_team_access(current_user, 'moderator'):
        abort(403)
    from ..models import User
    user = User.query.get_or_404(user_id)
    if user.status == 'banned':
        user.status = 'active'
        db.session.commit()
        flash(f'{user.display_name} has been unbanned.', 'success')
        log.info("Moderator %s unbanned user %s (id=%s)", current_user.display_name, user.display_name, user_id)
    return redirect(url_for('team.dashboard'))


@team_bp.route('/mod/flagged-stories')
@team_required
def mod_flagged_stories():
    """View all flagged stories — accessible to all team members (read-only)."""
    if not _has_team_read_access(current_user):
        abort(403)
    from ..models import Content
    flagged = Content.query.filter(
        Content.status == 'flagged',
        Content.deleted_at.is_(None),
    ).order_by(Content.created_at.desc()).all()
    return render_template('team_flagged.html', flagged=flagged)


@team_bp.route('/admin/auth-gate/save', methods=['POST'])
@team_required
def save_auth_gate():
    """Admin: save auth gate settings — block/unblock login and registration."""
    if not _has_team_access(current_user, 'admin'):
        abort(403)
    import json as _json
    from ..models import PlatformConfig, AuditLog
    from datetime import datetime

    cfg = PlatformConfig.get()
    old_login = cfg.auth_login_blocked
    old_reg = cfg.auth_registration_blocked

    cfg.auth_login_blocked = request.form.get('login_blocked', 'false').lower() in ('true', '1', 'on', 'yes')
    cfg.auth_registration_blocked = request.form.get('registration_blocked', 'false').lower() in ('true', '1', 'on', 'yes')

    login_until = request.form.get('login_blocked_until', '').strip()
    reg_until = request.form.get('registration_blocked_until', '').strip()
    cfg.auth_login_blocked_until = datetime.fromisoformat(login_until) if login_until else None
    cfg.auth_registration_blocked_until = datetime.fromisoformat(reg_until) if reg_until else None

    login_msg = request.form.get('login_blocked_message', '').strip()
    reg_msg = request.form.get('registration_blocked_message', '').strip()
    if login_msg:
        cfg.auth_login_blocked_message = login_msg
    if reg_msg:
        cfg.auth_registration_blocked_message = reg_msg

    cfg.auth_gate_updated_by = current_user.wiam_id
    cfg.auth_gate_updated_at = datetime.utcnow()
    cfg.updated_at = datetime.utcnow()

    db.session.add(AuditLog(
        actor_user_id=current_user.wiam_id,
        action='AUTH_GATE_CHANGED',
        target_type='PLATFORM',
        details_json=_json.dumps({
            'login_blocked': {'old': old_login, 'new': cfg.auth_login_blocked},
            'registration_blocked': {'old': old_reg, 'new': cfg.auth_registration_blocked},
            'login_until': str(cfg.auth_login_blocked_until),
            'reg_until': str(cfg.auth_registration_blocked_until),
        }),
        ip_address=request.remote_addr,
    ))

    db.session.commit()
    flash('Auth gate settings saved. Changes take effect immediately.', 'success')
    return redirect(url_for('team.dashboard'))


# ═══════════════════════════════════════════════════════════════════════════
# ADMIN ACTIONS (team admins, not the admin dashboard)
# ═══════════════════════════════════════════════════════════════════════════

@team_bp.route('/admin/users')
@team_required
def admin_user_list():
    """User list — accessible to all team members (read-only view)."""
    if not _has_team_read_access(current_user):
        abort(403)
    from ..models import User
    q = request.args.get('q', '').strip()
    role_filter = request.args.get('role', '')
    status_filter = request.args.get('status', '')
    page = max(1, request.args.get('page', 1, type=int))
    per_page = 50

    query = User.query
    if q:
        query = query.filter(
            db.or_(
                User.first_name.ilike(f'%{q}%'),
                User.last_name.ilike(f'%{q}%'),
                User.username.ilike(f'%{q}%'),
                User.email.ilike(f'%{q}%'),
            )
        )
    if role_filter:
        query = query.filter_by(role=role_filter)
    if status_filter:
        query = query.filter_by(status=status_filter)

    total = query.count()
    users = query.order_by(User.date_joined.desc()).offset((page - 1) * per_page).limit(per_page).all()
    total_pages = (total + per_page - 1) // per_page

    return render_template('team_admin_users.html',
        users=users, q=q, role_filter=role_filter, status_filter=status_filter,
        page=page, total_pages=total_pages, total=total,
    )


@team_bp.route('/feedback/<int:fb_id>/reply', methods=['POST'])
@team_required
def reply_feedback(fb_id):
    """Team member replies to user feedback — sends notification to user."""
    from ..models import Feedback, Notification
    fb = Feedback.query.get_or_404(fb_id)
    reply_text = request.form.get('reply', '').strip()
    if not reply_text:
        flash('Reply cannot be empty.', 'error')
        return redirect(url_for('team.dashboard'))

    fb.reply = reply_text
    fb.replied_by = current_user.wiam_id
    fb.replied_at = datetime.utcnow()
    fb.status = 'resolved'

    try:
        notif = Notification(
            user_id=fb.user_id,
            type='system',
            title='Reply to Your Feedback',
            message=reply_text[:200],
            link='/profile/feedback',
        )
        db.session.add(notif)
    except Exception as e:
        log.error("Failed to notify user about feedback reply: %s", e)

    db.session.commit()
    flash(f'Reply sent to {fb.user_name or "user"}.', 'success')
    return redirect(url_for('team.dashboard'))

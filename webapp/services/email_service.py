"""
WiamApp — Branded Email Service
================================
All outgoing emails use the unified branded template with WiamApp logo,
gold/dark colour scheme, and professional footer.

Centralised dispatcher: all emails go through the DB queue (w_email_jobs).
A background worker processes them one-by-one with a 4-second delay to
respect Resend's 2 req/sec free-tier limit.
"""
import smtplib
import logging
import random
import string
import os
import time
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from flask import current_app

log = logging.getLogger(__name__)

# ── Email queue worker state ─────────────────────────────────────────────────
_worker_running = False
_worker_lock = threading.Lock()


# ─── helpers ──────────────────────────────────────────────────────────────────

def _app_url():
    try:
        return current_app.config.get('APP_URL', 'https://wiamapp.com').rstrip('/')
    except RuntimeError:
        return os.environ.get('APP_URL', 'https://wiamapp.com').rstrip('/')


def _logo_url():
    return f"{_app_url()}/static/img/WiamLogo.png"


def generate_code(length=6):
    """Generate a random numeric verification code."""
    return ''.join(random.choices(string.digits, k=length))


# ─── branded HTML wrapper ─────────────────────────────────────────────────────

def branded_email(body_html, preheader=''):
    """Wrap *body_html* in the WiamApp branded email shell.

    The shell provides:
    • Dark background (#08081a) with centred white-card-style inner
    • WiamApp logo at top
    • Footer with About · Terms · Privacy · Careers · Help links
    • © WiamApp
    """
    url = _app_url()
    logo = _logo_url()

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>WiamApp</title>
<style>
  body,table,td,a{{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}}
  body{{margin:0;padding:0;width:100%!important;background:#08081a;}}
  img{{border:0;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}}
</style>
</head>
<body style="margin:0;padding:0;background:#08081a;">
<!-- preheader (hidden preview text) -->
<div style="display:none;font-size:1px;color:#08081a;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">{preheader}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#08081a;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

  <!-- LOGO -->
  <tr><td align="center" style="padding:32px 0 20px;">
    <a href="{url}" target="_blank">
      <img src="{logo}" alt="WiamApp" width="64" height="64" style="width:64px;height:64px;object-fit:contain;display:block;">
    </a>
  </td></tr>

  <!-- BODY CARD -->
  <tr><td style="background:#111118;border-radius:16px;padding:36px 32px 32px;border:1px solid rgba(255,255,255,0.06);">
    {body_html}
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:28px 0 8px;text-align:center;">
    <!-- footer links -->
    <div style="margin-bottom:14px;">
      <a href="{url}/about" style="color:#888;font-size:12px;text-decoration:none;margin:0 8px;">About</a>
      <span style="color:#333;">·</span>
      <a href="{url}/terms" style="color:#888;font-size:12px;text-decoration:none;margin:0 8px;">Terms</a>
      <span style="color:#333;">·</span>
      <a href="{url}/privacy" style="color:#888;font-size:12px;text-decoration:none;margin:0 8px;">Privacy</a>
      <span style="color:#333;">·</span>
      <a href="{url}/careers" style="color:#888;font-size:12px;text-decoration:none;margin:0 8px;">Careers</a>
      <span style="color:#333;">·</span>
      <a href="{url}/feedback" style="color:#888;font-size:12px;text-decoration:none;margin:0 8px;">Help</a>
    </div>
    <p style="margin:0 0 6px;color:#555;font-size:11px;">&copy; {datetime.utcnow().year} WiamApp</p>
    <p style="margin:0;color:#444;font-size:11px;">
      <a href="{url}" style="color:#d4a843;text-decoration:none;">wiamapp.com</a>
      &nbsp;·&nbsp; Powered by WiamLabs
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>"""


# ─── reusable inner-body building blocks ──────────────────────────────────────

def _heading(text, color='#e0e0e0'):
    return f'<h1 style="margin:0 0 6px;font-family:Georgia,serif;font-size:22px;font-weight:700;color:{color};text-align:center;">{text}</h1>'


def _subheading(text):
    return f'<p style="margin:0 0 24px;color:#888;font-size:13px;text-align:center;">{text}</p>'


def _paragraph(text):
    return f'<p style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;font-size:15px;line-height:1.65;color:#ccc;">{text}</p>'


def _code_block(code):
    return f'''<div style="margin:20px 0;padding:18px;background:#08081a;border:1px solid rgba(212,168,67,0.2);border-radius:12px;text-align:center;">
  <span style="font-family:'Courier New',monospace;font-size:36px;font-weight:800;letter-spacing:10px;color:#d4a843;">{code}</span>
</div>'''


def _button(text, link, color='#d4a843'):
    return f'''<div style="text-align:center;margin:24px 0;">
  <a href="{link}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,{color},#b8860b);color:#000;padding:14px 40px;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:0.3px;">{text}</a>
</div>'''


def _divider():
    return '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;">'


def _note(text, color='#888'):
    return f'<p style="margin:0;font-size:12px;color:{color};text-align:center;">{text}</p>'


def _info_box(html_content, border_color='rgba(212,168,67,0.15)', bg='rgba(212,168,67,0.04)'):
    return f'<div style="margin:20px 0;padding:18px 22px;background:{bg};border:1px solid {border_color};border-radius:14px;">{html_content}</div>'


# ─── SMTP send ────────────────────────────────────────────────────────────────

def _cfg(key, default=''):
    """Get config value from Flask app config, then fall back to env var."""
    try:
        val = current_app.config.get(key)
        if val is not None:
            return val
    except RuntimeError:
        pass
    return os.environ.get(key, default)


def _resolve_ipv4(hostname):
    """Resolve hostname to an IPv4 address. Many cloud hosts (Render, Railway)
    lack IPv6 connectivity so smtp.gmail.com's AAAA record causes Errno 101."""
    import socket
    try:
        results = socket.getaddrinfo(hostname, None, socket.AF_INET)
        if results:
            ipv4 = results[0][4][0]
            log.info("Resolved %s → %s (IPv4)", hostname, ipv4)
            return ipv4
    except socket.gaierror:
        pass
    return hostname  # fallback to original hostname


_resend_last_call = 0.0
_resend_lock = threading.Lock()

def _send_via_resend(to_email, subject, html_body, from_email):
    """Send email via Resend HTTP API (port 443, never blocked by cloud hosts).

    Set RESEND_FROM env var to a verified sender on Resend (e.g. onboarding@resend.dev
    for the free sandbox, or noreply@yourdomain.com after verifying your domain).
    Falls back to from_email (SMTP_FROM / SMTP_USER).
    """
    global _resend_last_call
    import requests as http_req
    api_key = (_cfg('RESEND_API_KEY') or '').strip()
    if not api_key:
        return None  # not configured
    resend_from = (_cfg('RESEND_FROM') or '').strip() or from_email

    # Rate limit: Resend allows 2 req/sec — enforce 600ms minimum gap
    with _resend_lock:
        now = time.time()
        elapsed = now - _resend_last_call
        if elapsed < 0.6:
            time.sleep(0.6 - elapsed)
        _resend_last_call = time.time()

    try:
        log.info("Resend API: sending to %s from %s — %s", to_email, resend_from, subject)
        resp = http_req.post(
            'https://api.resend.com/emails',
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            json={
                'from': f'WiamEpisio <{resend_from}>',
                'to': [to_email],
                'subject': subject,
                'html': html_body,
            },
            timeout=15,
        )
        if resp.status_code in (200, 201):
            log.info("Email SENT via Resend API to %s — %s", to_email, subject)
            return True
        else:
            log.error("Resend API error %d: %s", resp.status_code, resp.text[:300])
            return False
    except Exception as e:
        log.error("Resend API exception: %s", e)
        return False


def _is_deleted_user(email):
    """Return True if the email belongs to a soft-deleted user placeholder."""
    if not email:
        return True
    return email.endswith('@deleted.wiamapp')


def send_email(to_email, subject, html_body):
    """Send an email. Uses Resend HTTP API if RESEND_API_KEY is set (recommended
    for Render/Railway where SMTP ports 587/465 are blocked). Falls back to SMTP.
    """
    # Guard: never send to deleted-user placeholder addresses
    if _is_deleted_user(to_email):
        log.info("Email skipped (deleted user): %s", to_email)
        return False

    import ssl as _ssl

    smtp_host = (_cfg('SMTP_HOST') or '').strip()
    smtp_user = (_cfg('SMTP_USER') or '').strip()
    smtp_pass = (_cfg('SMTP_PASS') or '').strip().replace(' ', '')
    from_email = (_cfg('SMTP_FROM') or smtp_user or 'noreply@wiamapp.com').strip()

    # 1) Try Resend HTTP API first (works on Render — uses HTTPS port 443)
    resend_result = _send_via_resend(to_email, subject, html_body, from_email)
    if resend_result is True:
        return True
    # If Resend is configured but failed, still try SMTP as a backup
    if resend_result is False:
        log.warning("Resend delivery failed for %s — trying SMTP fallback", to_email)

    # 2) Fall back to SMTP
    smtp_port = int(_cfg('SMTP_PORT') or 587)

    if not smtp_host or not smtp_user or not smtp_pass:
        log.warning("Email not configured (no RESEND_API_KEY and no SMTP) — email to %s not sent. Subject: %s",
                     to_email, subject)
        return False

    # Force IPv4 — Render/Railway lack IPv6, smtp.gmail.com AAAA causes Errno 101
    smtp_ip = _resolve_ipv4(smtp_host)

    log.info("SMTP send to %s | host=%s(%s) port=%s user=%s pass_len=%d from=%s",
             to_email, smtp_host, smtp_ip, smtp_port, smtp_user, len(smtp_pass), from_email)

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = f'WiamApp <{from_email}>'
    msg['To'] = to_email
    msg['Reply-To'] = from_email
    msg.attach(MIMEText(html_body, 'html'))

    # Create SSL context
    ctx = _ssl.create_default_context()

    # Strategy: try configured port method first, then fallback
    methods = []
    if smtp_port == 465:
        methods = [('ssl', 465), ('starttls', 587)]
    elif smtp_port == 587:
        methods = [('starttls', 587), ('ssl', 465)]
    else:
        methods = [('starttls', smtp_port), ('ssl', 465)]

    last_error = None
    for method, port in methods:
        try:
            if method == 'ssl':
                log.info("Trying SMTP_SSL %s:%d ...", smtp_ip, port)
                with smtplib.SMTP_SSL(smtp_ip, port, timeout=10, context=ctx) as server:
                    server.ehlo(smtp_host)
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)
            else:
                log.info("Trying SMTP+STARTTLS %s:%d ...", smtp_ip, port)
                with smtplib.SMTP(smtp_ip, port, timeout=10) as server:
                    server.ehlo(smtp_host)
                    server.starttls(context=ctx)
                    server.ehlo(smtp_host)
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)
            log.info("Email SENT via %s:%d to %s — %s", method, port, to_email, subject)
            return True
        except smtplib.SMTPAuthenticationError as e:
            log.error("SMTP AUTH FAIL (%s:%d): code=%s err=%s",
                       method, port, e.smtp_code, e.smtp_error)
            return False
        except Exception as e:
            last_error = str(e)
            log.warning("SMTP %s:%d failed for %s: %s — trying next method", method, port, to_email, e)
            continue

    log.error("All SMTP methods failed for %s. Subject: %s. Last error: %s", to_email, subject, last_error)
    return False


def send_branded(to_email, subject, body_html, preheader=''):
    """Wrap body_html in the branded template, then send."""
    full = branded_email(body_html, preheader)
    return send_email(to_email, subject, full)


# ─── Email Queue System ──────────────────────────────────────────────────────


def _is_duplicate(to_email, subject, minutes=5):
    """Check if same email+subject was queued in the last N minutes (dedup)."""
    try:
        from ..models import EmailJob
        from ..extensions import db
        cutoff = datetime.utcnow() - timedelta(minutes=minutes)
        dup = EmailJob.query.filter(
            EmailJob.to_email == to_email,
            EmailJob.subject == subject,
            EmailJob.created_at >= cutoff,
            EmailJob.status.in_(['pending', 'sending', 'sent']),
        ).first()
        return dup is not None
    except Exception:
        return False


def enqueue_email(to_email, subject, html_body, priority=2):
    """Add an email to the DB queue. Priority 1 = urgent, 2 = normal.

    Returns the EmailJob or None if skipped (deleted user / duplicate).
    """
    if _is_deleted_user(to_email):
        log.info("Email skipped — deleted user: %s", to_email)
        return None
    if _is_duplicate(to_email, subject):
        log.info("Email skipped — duplicate within 5 min: %s — %s", to_email, subject)
        return None
    try:
        from ..models import EmailJob
        from ..extensions import db
        job = EmailJob(
            to_email=to_email,
            subject=subject,
            html_body=html_body,
            priority=priority,
            status='pending',
        )
        db.session.add(job)
        db.session.commit()
        log.info("Email queued #%d → %s — %s (P%d)", job.id, to_email, subject[:60], priority)
        _ensure_worker_running()
        return job
    except Exception as e:
        log.error("Failed to enqueue email to %s: %s", to_email, e)
        return None


def enqueue_branded(to_email, subject, body_html, preheader='', priority=2):
    """Wrap body_html in branded template, then queue."""
    full = branded_email(body_html, preheader)
    return enqueue_email(to_email, subject, full, priority)


def _ensure_worker_running():
    """Start the background email worker if not already running."""
    global _worker_running
    with _worker_lock:
        if _worker_running:
            return
        _worker_running = True
    try:
        app = current_app._get_current_object()
        t = threading.Thread(target=_email_worker, args=(app,), daemon=True)
        t.start()
    except Exception as e:
        log.error("Failed to start email worker: %s", e)
        with _worker_lock:
            _worker_running = False


def _email_worker(app):
    """Background worker: process email_jobs one-by-one with 4s ± 500ms delay."""
    global _worker_running
    log.info("Email worker started")
    try:
        with app.app_context():
            from ..models import EmailJob
            from ..extensions import db

            consecutive_empty = 0
            while consecutive_empty < 3:
                job = EmailJob.query.filter_by(status='pending').order_by(
                    EmailJob.priority.asc(),
                    EmailJob.created_at.asc(),
                ).first()

                if not job:
                    consecutive_empty += 1
                    time.sleep(2)
                    continue

                consecutive_empty = 0
                job.status = 'sending'
                job.attempts += 1
                db.session.commit()

                success = send_email(job.to_email, job.subject, job.html_body)

                if success:
                    job.status = 'sent'
                    job.sent_at = datetime.utcnow()
                    job.error = None
                else:
                    if job.attempts >= 3:
                        job.status = 'failed'
                        job.error = 'Max retries exceeded'
                    else:
                        job.status = 'pending'
                        job.error = '429 rate limit — will retry'
                db.session.commit()

                delay = 4.0 + random.uniform(-0.5, 0.5)
                time.sleep(delay)
    except Exception as e:
        log.error("Email worker crashed: %s", e)
    finally:
        with _worker_lock:
            _worker_running = False
        log.info("Email worker stopped")


def get_queue_status():
    """Return queue stats for the founder dashboard."""
    try:
        from ..models import EmailJob
        pending = EmailJob.query.filter_by(status='pending').count()
        sending = EmailJob.query.filter_by(status='sending').count()
        sent_today = EmailJob.query.filter(
            EmailJob.status == 'sent',
            EmailJob.sent_at >= datetime.utcnow().replace(hour=0, minute=0, second=0),
        ).count()
        failed = EmailJob.query.filter_by(status='failed').count()
        recent_failures = EmailJob.query.filter_by(status='failed').order_by(
            EmailJob.created_at.desc()
        ).limit(20).all()
        return {
            'pending': pending,
            'sending': sending,
            'sent_today': sent_today,
            'failed': failed,
            'recent_failures': recent_failures,
            'worker_running': _worker_running,
        }
    except Exception:
        return {'pending': 0, 'sending': 0, 'sent_today': 0, 'failed': 0, 'recent_failures': [], 'worker_running': False}


# ─── Verification code emails ────────────────────────────────────────────────

def send_verification_code(email, code, purpose='register'):
    """Send a branded verification code email (WiamEpisio)."""
    if purpose == 'register':
        subject = 'Verify Your Email — WiamEpisio'
        body = (
            _heading('Welcome to WiamEpisio!', '#d4a843')
            + _subheading('Verify your email to get started')
            + _paragraph('Enter this code to verify your email address:')
            + _code_block(code)
            + _note('This code expires in <strong>15 minutes</strong>. If you didn\'t create an account, ignore this email.')
        )
        preheader = f'Your WiamEpisio verification code is {code}'

    elif purpose == 'reset':
        subject = 'Reset Your Password — WiamEpisio'
        body = (
            _heading('Password Reset')
            + _subheading('We received a request to reset your password')
            + _paragraph('Enter this code to reset your password:')
            + _code_block(code)
            + _note('This code expires in <strong>15 minutes</strong>. If you didn\'t request this, ignore this email.')
        )
        preheader = f'Your password reset code is {code}'

    elif purpose == 'two_factor':
        subject = 'Login Verification — WiamEpisio'
        body = (
            _heading('Two-Factor Verification')
            + _subheading('An extra layer of security for your account')
            + _paragraph('Enter this code to complete your sign-in:')
            + _code_block(code)
            + _note('This code expires in <strong>10 minutes</strong>. If this wasn\'t you, change your password immediately.')
        )
        preheader = f'Your 2FA code is {code}'
    else:
        subject = 'Verification Code — WiamEpisio'
        body = _paragraph(f'Your verification code is:') + _code_block(code)
        preheader = f'Code: {code}'

    return send_branded(email, subject, body, preheader)


def _verification_email_parts(email, code, purpose):
    """Build subject/body/preheader for enqueue fallback."""
    if purpose == 'register':
        return (
            'Verify Your Email — WiamEpisio',
            (
                _heading('Welcome to WiamEpisio!', '#d4a843')
                + _subheading('Verify your email to get started')
                + _paragraph('Enter this code to verify your email address:')
                + _code_block(code)
                + _note('This code expires in <strong>15 minutes</strong>.')
            ),
            f'Your WiamEpisio verification code is {code}',
        )
    if purpose == 'reset':
        return (
            'Reset Your Password — WiamEpisio',
            (
                _heading('Password Reset')
                + _paragraph('Enter this code to reset your password:')
                + _code_block(code)
            ),
            f'Your password reset code is {code}',
        )
    return (
        'Verification Code — WiamEpisio',
        _paragraph('Your verification code is:') + _code_block(code),
        f'Code: {code}',
    )


def email_delivery_configured():
    """True if Resend or SMTP credentials are present (does not prove delivery works)."""
    api_key = (_cfg('RESEND_API_KEY') or '').strip()
    smtp_host = (_cfg('SMTP_HOST') or '').strip()
    smtp_user = (_cfg('SMTP_USER') or '').strip()
    smtp_pass = (_cfg('SMTP_PASS') or '').strip().replace(' ', '')
    return bool(api_key) or bool(smtp_host and smtp_user and smtp_pass)


def create_and_send_code(email, purpose, user_id=None):
    """Persist a verification code, then deliver by sync send or queue fallback.

    Returns the VerificationCode on success (sent or queued), or None if neither path works.
    """
    from ..models import VerificationCode
    from ..extensions import db

    email = (email or '').strip().lower()
    if not email:
        log.error("create_and_send_code called with empty email (purpose=%s)", purpose)
        return None

    old_codes = VerificationCode.query.filter_by(
        email=email, purpose=purpose, is_used=False
    ).all()
    for oc in old_codes:
        oc.is_used = True
    if old_codes:
        db.session.commit()

    code = generate_code(6)
    ttl = 15 if purpose != 'two_factor' else 10
    vc = VerificationCode(
        user_id=user_id,
        email=email,
        code=code,
        purpose=purpose,
        expires_at=datetime.utcnow() + timedelta(minutes=ttl),
    )
    db.session.add(vc)
    db.session.commit()

    if not email_delivery_configured():
        log.error(
            "Verification email blocked — no RESEND_API_KEY and no SMTP configured "
            "(purpose=%s, to=%s)",
            purpose, email,
        )
        try:
            vc.is_used = True
            db.session.commit()
        except Exception:
            db.session.rollback()
        return None

    log.info("Sending verification code to %s for %s", email, purpose)
    sent = send_verification_code(email, code, purpose)
    if sent:
        return vc

    # Sync delivery failed (common on hosts that block SMTP) — queue for worker retry
    subject, body, preheader = _verification_email_parts(email, code, purpose)
    try:
        job = enqueue_branded(email, subject, body, preheader, priority=1)
        if job:
            log.warning(
                "Verification email sync failed for %s — queued job id=%s",
                email, getattr(job, 'id', '?'),
            )
            return vc
        # Same subject already pending/sent recently — treat as success so retries work
        if _is_duplicate(email, subject):
            log.info(
                "Verification email already queued/sent recently for %s — returning ok",
                email,
            )
            return vc
    except Exception as e:
        log.error("Verification enqueue also failed for %s: %s", email, e)

    # Roll back unused code so user can retry cleanly
    try:
        vc.is_used = True
        db.session.commit()
    except Exception:
        db.session.rollback()
    log.error("Verification email failed for %s (purpose=%s)", email, purpose)
    return None


# ─── Pre-built email types (callable from anywhere) ──────────────────────────

def send_welcome_email(email, name=''):
    """Send a welcome email after successful registration."""
    greeting = f'Hi {name},' if name else 'Hi there,'
    body = (
        _heading('Welcome to WiamEpisio!', '#d4a843')
        + _subheading('African vertical drama')
        + _paragraph(f'{greeting}')
        + _paragraph('Welcome to WiamEpisio — short drama series made for your phone.')
        + _button('Start Watching', f'{_app_url()}')
    )
    return enqueue_branded(email, 'Welcome to WiamEpisio!', body, 'Welcome to WiamEpisio', priority=2)


def send_creator_eligible_email(email, name=''):
    """Notify creator they've reached monetization eligibility."""
    greeting = f'Dear {name},' if name else 'Dear Creator,'
    body = (
        _heading('You\'re Eligible for Monetization!', '#4ade80')
        + _subheading('Congratulations on reaching this milestone')
        + _paragraph(f'{greeting}')
        + _paragraph('Great news! Your audience has grown enough that you\'re now eligible to <strong style="color:#4ade80;">earn money</strong> from your series on WiamEpisio.')
        + _paragraph('To start receiving payouts, connect your bank details in WiamStudio.')
        + _button('Open Studio', f'{_app_url()}')
        + _note('This is a huge milestone. Keep creating!')
    )
    return enqueue_branded(email, 'You\'re Eligible for Payouts — WiamEpisio', body, 'Congrats! You can now earn on WiamEpisio', priority=2)


def send_payout_email(email, name='', amount='0', currency='GHS', period=''):
    """Notify creator about a payout."""
    greeting = f'Dear {name},' if name else 'Dear Creator,'
    body = (
        _heading('Payout Processed!', '#4ade80')
        + _subheading(f'{period}' if period else 'Monthly Creator Payout')
        + _paragraph(f'{greeting}')
        + _paragraph(f'Your creator payout of <strong style="color:#4ade80;font-size:18px;">{currency} {amount}</strong> has been sent to your registered Mobile Money account.')
        + _info_box(
            f'<table style="width:100%;border-collapse:collapse;">'
            f'<tr><td style="padding:6px 0;color:#888;font-size:13px;">Amount:</td><td style="color:#4ade80;font-weight:700;font-size:15px;">{currency} {amount}</td></tr>'
            f'<tr><td style="padding:6px 0;color:#888;font-size:13px;">Status:</td><td style="color:#4ade80;font-size:13px;">✓ Sent</td></tr>'
            f'<tr><td style="padding:6px 0;color:#888;font-size:13px;">Period:</td><td style="color:#ccc;font-size:13px;">{period or "This month"}</td></tr>'
            f'</table>',
            'rgba(74,222,128,0.15)', 'rgba(74,222,128,0.04)'
        )
        + _paragraph('Please allow 1-2 business days for the funds to reflect in your account. If you have any questions, please contact us via the Feedback page.')
        + _button('View Earnings', f'{_app_url()}/creator/dashboard')
    )
    return enqueue_branded(email, f'Payout of {currency} {amount} — WiamApp', body, f'Your payout of {currency} {amount} has been processed', priority=2)


def send_elite_email(email, name='', book_title=''):
    """Notify creator their story was promoted to WiamElite."""
    greeting = f'Dear {name},' if name else 'Dear Creator,'
    body = (
        _heading('✦ WiamElite — Story Promoted!', '#d4a843')
        + _subheading('Your story joined the Hall of Fame')
        + _paragraph(f'{greeting}')
        + _paragraph(f'Incredible news! Your story <strong style="color:#d4a843;">"{book_title}"</strong> has been promoted to <strong style="color:#d4a843;">WiamElite</strong> — our exclusive Hall of Fame for the very best stories on the platform.')
        + _paragraph('This is WiamApp\'s highest honour, earned through exceptional storytelling and a dedicated readership. Your story will now be featured prominently across the platform.')
        + _button('View Your Story in Elite', f'{_app_url()}/elite')
        + _note('WiamElite status is reviewed periodically. Keep engaging your readers to maintain it!')
    )
    return enqueue_branded(email, f'✦ "{book_title}" Promoted to WiamElite!', body, f'Your story "{book_title}" is now in the WiamElite Hall of Fame', priority=2)


def send_application_invite(email, name, form_title, form_url):
    """Send an application form invitation."""
    greeting = f'Dear {name},' if name else 'Dear Applicant,'
    body = (
        _heading(form_title, '#d4a843')
        + _subheading('WiamApp Team Application')
        + _paragraph(f'{greeting}')
        + _paragraph(f'You have been invited to apply for a position at <strong style="color:#d4a843;">WiamApp</strong>. Please fill out the application form by clicking the button below.')
        + _button('Fill Application Form', form_url)
        + _note('This link is unique to you. Do not share it with anyone.')
    )
    return enqueue_branded(email, f'WiamApp — {form_title}', body, f'You\'ve been invited to apply for {form_title} at WiamApp', priority=2)


def send_application_accepted(email, name, role_title, notes=''):
    """Send application accepted email."""
    url = _app_url()
    body = (
        _heading('Application Approved!', '#4ade80')
        + _subheading(f'{role_title} Position')
        + _paragraph(f'Dear <strong style="color:#d4a843;">{name}</strong>,')
        + _paragraph(f'We are thrilled to inform you that your application for the <strong style="color:#d4a843;">{role_title}</strong> position at WiamApp has been <strong style="color:#4ade80;">approved</strong>!')
        + _paragraph('Welcome to the WiamApp team! We\'re excited to have you on board.')
        + _paragraph('You will receive another email shortly with your <strong style="color:#d4a843;">login credentials</strong>. Once you log in, you can access your personal <strong style="color:#d4a843;">{0} Dashboard</strong> where you\'ll find all the tools you need for your role.'.format(role_title))
        + _paragraph(f'<strong>Important:</strong> You must have a WiamApp account to access your dashboard. Your credentials will be in the next email.')
        + (f'{_info_box(_paragraph(f"<strong style=color:#4ade80>Note from the team:</strong> {notes}"), "rgba(74,222,128,0.2)", "rgba(74,222,128,0.04)")}' if notes else '')
        + _button('Visit WiamApp', url)
    )
    return enqueue_branded(email, f'Congratulations! Your WiamApp {role_title} Application is Approved', body, f'Your application for {role_title} at WiamApp has been approved!', priority=2)


def send_application_rejected(email, name, role_title, notes=''):
    """Send application rejected email."""
    body = (
        _heading('Application Update')
        + _subheading(f'{role_title} Position')
        + _paragraph(f'Dear <strong style="color:#d4a843;">{name}</strong>,')
        + _paragraph(f'Thank you for your interest in the <strong>{role_title}</strong> position at WiamApp and for taking the time to apply.')
        + _paragraph('After careful review, we\'ve decided not to move forward with your application at this time. This doesn\'t reflect on your abilities — we received many strong applications and had to make difficult choices.')
        + _paragraph('We encourage you to apply again in the future as new positions open up. We truly appreciate your interest in WiamApp.')
        + (f'{_info_box(_paragraph(f"<strong style=color:#d4a843>Feedback:</strong> {notes}"))}' if notes else '')
        + _paragraph('Best regards,<br><strong style="color:#d4a843;">The WiamApp Team</strong>')
    )
    return enqueue_branded(email, f'WiamApp {role_title} Application — Update', body, f'Update on your {role_title} application', priority=2)


def send_team_credentials(email, name, role_title, wiam_id):
    """Send WIAMid team account credentials email with strong security warnings."""
    url = _app_url()
    body = (
        _heading('Your WiamApp Team Credentials', '#d4a843')
        + _subheading(f'{role_title} — WiamApp Team')
        + _paragraph(f'Dear <strong style="color:#d4a843;">{name}</strong>,')
        + _paragraph('Congratulations! Your WiamApp team account has been created. Below are your <strong>secure login credentials</strong>.')
        + _info_box(
            f'<table style="width:100%;border-collapse:collapse;">'
            f'<tr><td style="padding:8px 0;color:#888;font-size:14px;width:120px;">Login Email:</td><td style="color:#e0e0e0;font-size:14px;font-weight:600;">wiamlabs@gmail.com</td></tr>'
            f'<tr><td style="padding:8px 0;color:#888;font-size:14px;">Your WIAMid:</td><td style="color:#d4a843;font-size:16px;font-weight:700;font-family:monospace;letter-spacing:1px;">{wiam_id}</td></tr>'
            f'<tr><td style="padding:8px 0;color:#888;font-size:14px;">Role:</td><td style="color:#4ade80;font-size:14px;font-weight:600;">{role_title}</td></tr>'
            f'<tr><td style="padding:8px 0;color:#888;font-size:14px;">Dashboard:</td><td style="color:#60a5fa;font-size:14px;"><a href="{url}/team" style="color:#60a5fa;text-decoration:underline;">{url}/team</a></td></tr>'
            f'</table>'
        )
        + _paragraph(
            '<div style="background:#2a1a1a;border:2px solid #f87171;border-radius:8px;padding:14px;margin:16px 0;">'
            '<strong style="color:#f87171;font-size:15px;">⚠ CRITICAL SECURITY WARNING</strong><br><br>'
            '<span style="color:#fca5a5;">1. <strong>DO NOT share</strong> your WIAMid with anyone — it is your personal access key.</span><br>'
            '<span style="color:#fca5a5;">2. <strong>DO NOT screenshot</strong> or copy it to unsecured locations.</span><br>'
            '<span style="color:#fca5a5;">3. Your WIAMid <strong>expires every 15 days</strong> — a new one will be sent to this email automatically.</span><br>'
            '<span style="color:#fca5a5;">4. If you suspect your WIAMid has been compromised, contact the Founder <strong>immediately</strong>.</span><br>'
            '<span style="color:#fca5a5;">5. <strong>wiamlabs@gmail.com</strong> is the platform login email — it is NOT your personal email.</span>'
            '</div>'
        )
        + _paragraph('<strong>How to log in:</strong><br>1. Go to the login page<br>2. Enter <code style="color:#d4a843;">wiamlabs@gmail.com</code> as email<br>3. Enter your <code style="color:#d4a843;">WIAMid</code> as password<br>4. You will be taken directly to your Team Dashboard')
        + _button('Log In Now', f'{url}/login')
    )
    return enqueue_branded(email, f'[CONFIDENTIAL] Your WiamApp WIAMid — {role_title}', body, f'Your WiamApp team credentials are ready', priority=1)


def send_team_id_rotation(email, name, new_wiam_id):
    """Send new WIAMid after 15-day rotation with strong security warnings."""
    url = _app_url()
    body = (
        _heading('Your WIAMid Has Been Rotated', '#d4a843')
        + _paragraph(f'Dear <strong style="color:#d4a843;">{name}</strong>,')
        + _paragraph('Your previous WIAMid has <strong>expired</strong> and a new one has been generated for your security. Please use the new credentials below to log in.')
        + _info_box(
            f'<table style="width:100%;border-collapse:collapse;">'
            f'<tr><td style="padding:8px 0;color:#888;font-size:14px;width:120px;">Login Email:</td><td style="color:#e0e0e0;font-size:14px;font-weight:600;">wiamlabs@gmail.com</td></tr>'
            f'<tr><td style="padding:8px 0;color:#888;font-size:14px;">New WIAMid:</td><td style="color:#d4a843;font-size:16px;font-weight:700;font-family:monospace;letter-spacing:1px;">{new_wiam_id}</td></tr>'
            f'</table>'
        )
        + _paragraph(
            '<div style="background:#2a1a1a;border:2px solid #f87171;border-radius:8px;padding:14px;margin:16px 0;">'
            '<strong style="color:#f87171;font-size:15px;">⚠ SECURITY REMINDER</strong><br><br>'
            '<span style="color:#fca5a5;">• Your old WIAMid is now <strong>permanently invalid</strong>.</span><br>'
            '<span style="color:#fca5a5;">• <strong>DO NOT share</strong> this new ID with anyone.</span><br>'
            '<span style="color:#fca5a5;">• This ID expires in <strong>15 days</strong> — a new one will be sent automatically.</span><br>'
            '<span style="color:#fca5a5;">• If you did not expect this rotation, contact the Founder <strong>immediately</strong>.</span>'
            '</div>'
        )
        + _button('Log In With New WIAMid', f'{url}/login')
    )
    return enqueue_branded(email, '[CONFIDENTIAL] Your New WIAMid — WiamApp', body, 'Your WIAMid has been rotated', priority=1)


def send_team_id_expiry_warning(email, name, days_left):
    """Send warning email N days before WIAMid expiry."""
    url = _app_url()
    body = (
        _heading('WIAMid Expiring Soon', '#f59e0b')
        + _paragraph(f'Dear <strong style="color:#d4a843;">{name}</strong>,')
        + _paragraph(f'Your current WIAMid will expire in <strong style="color:#f59e0b;">{days_left} day{"s" if days_left != 1 else ""}</strong>. A new WIAMid will be generated and sent to this email automatically when it expires.')
        + _paragraph('No action is needed — just be aware that your current credentials will stop working soon and you will receive a new WIAMid.')
        + _button('Go to Dashboard', f'{url}/team')
    )
    return enqueue_branded(email, f'WIAMid Expires in {days_left} Days — WiamApp', body, f'Your WIAMid expires in {days_left} days', priority=2)


def send_role_assigned(email, name, role_title):
    """Notify a user they've been assigned a team role by the founder."""
    url = _app_url()
    body = (
        _heading('You\'ve Been Assigned a Role!', '#d4a843')
        + _subheading(f'{role_title} — WiamApp Team')
        + _paragraph(f'Dear <strong style="color:#d4a843;">{name}</strong>,')
        + _paragraph(f'The WiamApp founder has assigned you the <strong style="color:#4ade80;">{role_title}</strong> role on the platform. You now have access to the Team Dashboard with tools and features for your role.')
        + _info_box(
            f'<table style="width:100%;border-collapse:collapse;">'
            f'<tr><td style="padding:8px 0;color:#888;font-size:14px;width:100px;">Role:</td><td style="color:#4ade80;font-size:14px;font-weight:600;">{role_title}</td></tr>'
            f'<tr><td style="padding:8px 0;color:#888;font-size:14px;">Dashboard:</td><td style="color:#60a5fa;font-size:14px;"><a href="{url}/team/dashboard" style="color:#60a5fa;text-decoration:underline;">Team Dashboard</a></td></tr>'
            f'</table>'
        )
        + _paragraph('Log in to WiamApp and access your Team Dashboard from the menu to get started.')
        + _button('Go to Team Dashboard', f'{url}/team/dashboard')
        + _paragraph('Welcome to the team! 🎉<br><strong style="color:#d4a843;">The WiamApp Team</strong>')
    )
    return enqueue_branded(email, f'You\'ve been assigned {role_title} role — WiamApp', body, f'You are now a {role_title} on WiamApp', priority=2)


def send_new_application_alert(founder_email, applicant_name, applicant_email, role_title):
    """Notify the founder that a new public career application was submitted."""
    url = _app_url()
    body = (
        _heading('New Team Application', '#d4a843')
        + _subheading(f'{role_title} Position')
        + _paragraph(f'A new application has been submitted through the public Careers page:')
        + _info_box(
            f'<table style="width:100%;border-collapse:collapse;">'
            f'<tr><td style="padding:8px 0;color:#888;font-size:14px;width:100px;">Name:</td><td style="color:#e0e0e0;font-size:14px;font-weight:600;">{applicant_name or "Not provided"}</td></tr>'
            f'<tr><td style="padding:8px 0;color:#888;font-size:14px;">Email:</td><td style="color:#60a5fa;font-size:14px;">{applicant_email}</td></tr>'
            f'<tr><td style="padding:8px 0;color:#888;font-size:14px;">Role:</td><td style="color:#4ade80;font-size:14px;font-weight:600;">{role_title}</td></tr>'
            f'</table>'
        )
        + _paragraph('Review this application in the Founder Dashboard under Forms & Applications.')
        + _button('Review Applications', f'{url}/founder/forms')
    )
    return enqueue_branded(founder_email, f'New {role_title} Application — WiamApp', body, f'New career application from {applicant_name or applicant_email}', priority=2)


def send_general_notification(email, subject, message, cta_text='', cta_link=''):
    """Send a general branded notification email via the queue."""
    body = (
        _heading(subject)
        + _paragraph(message)
        + (_button(cta_text, cta_link) if cta_text and cta_link else '')
    )
    return enqueue_branded(email, subject, body, message[:100], priority=2)


# ─── Verification code verify ─────────────────────────────────────────────────

def verify_code(email, code, purpose):
    """Verify a code. Returns the VerificationCode if valid, None otherwise."""
    from ..models import VerificationCode
    from ..extensions import db

    vc = VerificationCode.query.filter_by(
        email=email, code=code, purpose=purpose, is_used=False
    ).order_by(VerificationCode.created_at.desc()).first()

    if not vc:
        return None
    if vc.is_expired:
        return None

    vc.is_used = True
    db.session.commit()
    return vc

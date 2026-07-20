"""
WiamBot Routes — V1 Help Center Chat + V2 Apex Contract Submission
"""
import json
import logging
from datetime import datetime

from flask import Blueprint, request, jsonify, render_template, redirect, url_for, flash
from flask_login import login_required, current_user

from webapp.extensions import db, csrf
from webapp.models import (
    BotUnmatchedMessage, ApexSubmission,
)
from webapp.services.wiambot import (
    chat, CREATOR_TEMPLATES, analyze_manuscript,
    validate_apex_submission, score_apex_submission, check_cooldown,
    APEX_PASS_SCORE,
)

log = logging.getLogger(__name__)
bot_bp = Blueprint('wiambot', __name__)


# ── V1: Chat API ────────────────────────────────────────────────────────

@bot_bp.route('/api/bot/chat', methods=['POST'])
@login_required
@csrf.exempt
def bot_chat():
    """Main WiamBot chat endpoint."""
    data = request.get_json(silent=True) or {}
    message = (data.get('message') or '').strip()
    if not message or len(message) < 2:
        return jsonify({'error': 'Message too short'}), 400
    if len(message) > 1000:
        return jsonify({'error': 'Message too long (max 1000 chars)'}), 400

    result = chat(message, current_user.wiam_id, db.session)
    return jsonify(result)


@bot_bp.route('/api/bot/templates')
@login_required
def bot_templates():
    """Return creator support templates."""
    return jsonify({'templates': CREATOR_TEMPLATES})


@bot_bp.route('/api/bot/analyze', methods=['POST'])
@login_required
@csrf.exempt
def bot_analyze():
    """Analyze manuscript text and return heuristic feedback."""
    data = request.get_json(silent=True) or {}
    text = (data.get('text') or '').strip()
    if not text or len(text) < 50:
        return jsonify({'error': 'Text too short (minimum 50 characters)'}), 400

    uid = current_user.wiam_id if current_user.is_authenticated else None
    result = analyze_manuscript(text, user_id=uid)
    return jsonify(result)


# ── V1: Chat Page ───────────────────────────────────────────────────────

@bot_bp.route('/help')
@login_required
def help_center():
    """WiamBot Help Center page with chat widget."""
    return render_template('wiambot/chat.html')


# ── V1: Creator Support Page ────────────────────────────────────────────

@bot_bp.route('/creator-tools')
@login_required
def creator_tools():
    """Creator writing tools — templates and manuscript analyzer."""
    return render_template('wiambot/creator_tools.html', templates=CREATOR_TEMPLATES)


# ── V2: Apex Submission ─────────────────────────────────────────────────

@bot_bp.route('/apex/submit', methods=['GET', 'POST'])
@login_required
def apex_submit():
    """Wiam Apex contract submission form."""
    # Check cooldown
    can_submit, cooldown_msg = check_cooldown(current_user.wiam_id, db.session)

    if request.method == 'POST':
        if not can_submit:
            flash(cooldown_msg, 'error')
            return redirect(url_for('wiambot.apex_submit'))

        data = {
            'pen_name': request.form.get('pen_name', '').strip(),
            'email': request.form.get('email', '').strip(),
            'country': request.form.get('country', '').strip(),
            'title': request.form.get('title', '').strip(),
            'genre': request.form.get('genre', '').strip(),
            'logline': request.form.get('logline', '').strip(),
            'synopsis': request.form.get('synopsis', '').strip(),
            'chapter_1': request.form.get('chapter_1', '').strip(),
            'chapter_2': request.form.get('chapter_2', '').strip(),
            'outline': request.form.get('outline', '').strip(),
            'posting_commitment': request.form.get('posting_commitment', '').strip(),
            'originality_declaration': request.form.get('originality_declaration') == 'on',
        }

        # Validate required fields
        errors = validate_apex_submission(data)
        if errors:
            for e in errors:
                flash(e, 'error')
            return redirect(url_for('wiambot.apex_submit'))

        # Score the submission (heuristic as baseline)
        score_result = score_apex_submission(data, db.session)

        # Create submission record first (so AI review can reference it)
        sub = ApexSubmission(
            user_id=current_user.wiam_id,
            pen_name=data['pen_name'],
            email=data['email'],
            country=data['country'],
            title=data['title'],
            genre=data['genre'],
            logline=data['logline'],
            synopsis=data['synopsis'],
            chapter_1=data['chapter_1'],
            chapter_2=data['chapter_2'],
            outline=data['outline'],
            posting_commitment=data['posting_commitment'],
            originality_declaration=data['originality_declaration'],
            total_score=score_result['total_score'],
            score_breakdown=json.dumps(score_result['scores']),
            flags=json.dumps(score_result['flags']),
            strengths=json.dumps(score_result['strengths']),
            weaknesses=json.dumps(score_result['weaknesses']),
            max_similarity=score_result['max_similarity'],
            status='pending_review' if score_result['passed'] else 'rejected',
        )
        db.session.add(sub)
        db.session.commit()

        # Try AI review from The Apex Board (enhances heuristic score)
        try:
            from webapp.services.apex_ai import review_submission
            ai_result = review_submission(sub.id)
            if ai_result and isinstance(ai_result, dict):
                sub.total_score = ai_result.get('total_score', sub.total_score)
                sub.score_breakdown = json.dumps(ai_result.get('scores', {}))
                sub.strengths = json.dumps(ai_result.get('strengths', []))
                sub.weaknesses = json.dumps(ai_result.get('weaknesses', []))
                verdict = ai_result.get('verdict', 'rejected')
                if verdict == 'approved':
                    sub.status = 'pending_review'
                elif verdict == 'revision_needed':
                    sub.status = 'revision_requested'
                else:
                    sub.status = 'rejected'
                sub.admin_notes = ai_result.get('board_notes', '')
                db.session.commit()
                score_result['total_score'] = sub.total_score
                score_result['passed'] = verdict in ('approved', 'revision_needed')
        except Exception as e:
            log.warning("AI review unavailable, using heuristic score: %s", e)

        if score_result['passed']:
            flash(f'Your submission scored {score_result["total_score"]}/100 and has been sent for review!', 'success')
        else:
            flash(f'Your submission scored {score_result["total_score"]}/100. Minimum required: {APEX_PASS_SCORE}. See feedback below.', 'error')

        return redirect(url_for('wiambot.apex_status', submission_id=sub.id))

    # GET — show form
    existing = ApexSubmission.query.filter_by(
        user_id=current_user.wiam_id,
    ).order_by(ApexSubmission.created_at.desc()).limit(5).all()

    return render_template('wiambot/apex_submit.html',
                           can_submit=can_submit, cooldown_msg=cooldown_msg,
                           existing=existing)


@bot_bp.route('/apex/status/<int:submission_id>')
@login_required
def apex_status(submission_id):
    """View Apex submission status and feedback."""
    sub = ApexSubmission.query.filter_by(
        id=submission_id, user_id=current_user.wiam_id,
    ).first_or_404()
    return render_template('wiambot/apex_status.html', sub=sub)


# ── Founder: Apex Review Panel ──────────────────────────────────────────

@bot_bp.route('/founder/apex-review')
@login_required
def apex_review():
    """Founder panel for reviewing Apex submissions."""
    if not getattr(current_user, 'is_founder', False):
        return redirect(url_for('home.index'))

    pending = ApexSubmission.query.filter_by(status='pending_review').order_by(
        ApexSubmission.created_at.desc()
    ).all()
    recent = ApexSubmission.query.filter(
        ApexSubmission.status.in_(['signed', 'rejected', 'revision_requested']),
    ).order_by(ApexSubmission.updated_at.desc()).limit(20).all()

    stats = {
        'total': ApexSubmission.query.count(),
        'pending': ApexSubmission.query.filter_by(status='pending_review').count(),
        'signed': ApexSubmission.query.filter_by(status='signed').count(),
        'rejected': ApexSubmission.query.filter_by(status='rejected').count(),
    }
    if stats['total'] > 0:
        stats['pass_rate'] = f"{stats['signed'] / stats['total'] * 100:.1f}%"
    else:
        stats['pass_rate'] = '0%'

    return render_template('founder/apex_review.html',
                           pending=pending, recent=recent, stats=stats)


@bot_bp.route('/founder/apex-review/<int:submission_id>')
@login_required
def apex_review_detail(submission_id):
    """View a specific Apex submission detail for review."""
    if not getattr(current_user, 'is_founder', False):
        return redirect(url_for('home.index'))

    sub = ApexSubmission.query.get_or_404(submission_id)
    return render_template('founder/apex_review_detail.html', sub=sub)


@bot_bp.route('/founder/apex-review/<int:submission_id>/action', methods=['POST'])
@login_required
def apex_review_action(submission_id):
    """Approve, reject, or request revision on an Apex submission."""
    if not getattr(current_user, 'is_founder', False):
        return redirect(url_for('home.index'))

    sub = ApexSubmission.query.get_or_404(submission_id)
    action = request.form.get('action')
    notes = request.form.get('notes', '').strip()

    if action == 'approve':
        sub.status = 'signed'
        flash(f'Apex contract APPROVED for "{sub.title}"!', 'success')
    elif action == 'reject':
        sub.status = 'rejected'
        flash(f'Submission "{sub.title}" rejected.', 'warning')
    elif action == 'revision':
        sub.status = 'revision_requested'
        flash(f'Revision requested for "{sub.title}".', 'info')
    else:
        flash('Invalid action.', 'error')
        return redirect(url_for('wiambot.apex_review_detail', submission_id=sub.id))

    sub.admin_notes = notes
    sub.reviewed_by = current_user.wiam_id
    sub.reviewed_at = datetime.utcnow()
    sub.updated_at = datetime.utcnow()
    db.session.commit()

    return redirect(url_for('wiambot.apex_review'))

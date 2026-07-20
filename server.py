"""
WiamApp Server — Flask web application with AI-powered features.
Production entrypoint for Render (gunicorn) or local dev.

- Flask serves all web routes on port 8080
- WiamBot uses Gemini AI for chat and content review
- Shares PostgreSQL database (Neon)
"""
import os
import threading
import logging
from dotenv import load_dotenv

load_dotenv()

import json as _json

class _JsonFormatter(logging.Formatter):
    """Structured JSON log formatter for production observability."""
    def format(self, record):
        entry = {
            'ts': self.formatTime(record, '%Y-%m-%dT%H:%M:%S'),
            'level': record.levelname,
            'logger': record.name,
            'msg': record.getMessage(),
        }
        if record.exc_info and record.exc_info[0]:
            entry['error'] = self.formatException(record.exc_info)
        return _json.dumps(entry, default=str)

_handler = logging.StreamHandler()
_handler.setFormatter(_JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[_handler])
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 1. Create the Flask web application
# ---------------------------------------------------------------------------
logger.info("Creating Flask web app...")
from webapp import create_app

flask_app = create_app()

# ---------------------------------------------------------------------------
# 2. Health check endpoint
# ---------------------------------------------------------------------------
@flask_app.route('/health')
def health():
    return 'OK', 200


@flask_app.route('/health/version')
def health_version():
    """Prove which git commit Render is running (set automatically by Render)."""
    from flask import jsonify
    return jsonify(
        ok=True,
        commit=(os.environ.get('RENDER_GIT_COMMIT') or os.environ.get('GIT_COMMIT') or 'unknown')[:12],
        branch=os.environ.get('RENDER_GIT_BRANCH') or 'unknown',
        slim=(os.environ.get('EPISIO_SLIM') or '1'),
        service=os.environ.get('RENDER_SERVICE_NAME') or 'unknown',
    ), 200

# ---------------------------------------------------------------------------
# 3. Background scheduled jobs (eligibility check + monthly payouts)
# ---------------------------------------------------------------------------
import time
import urllib.request
from datetime import datetime, timedelta

SELF_URL = os.environ.get('APP_URL', '').rstrip('/')

if not SELF_URL:
    logger.warning(
        "APP_URL is unset — in-process keep-alive cannot ping /health; "
        "Render free-tier services may idle-sleep (~15 min) and return 503 on first wake."
    )


def _keep_alive():
    """Ping /health on a tight interval so Render free tier stays warm (spin-down ~15 min idle)."""
    while True:
        try:
            if SELF_URL:
                urllib.request.urlopen(f"{SELF_URL}/health", timeout=15)
        except Exception:
            pass
        time.sleep(300)  # 5 minutes


keep_alive_thread = threading.Thread(target=_keep_alive, daemon=True)
keep_alive_thread.start()
logger.info("Keep-alive ping started (every 5 min when APP_URL is set).")


def _run_scheduled_jobs():
    """Run eligibility check daily and payouts on the 1st of each month."""
    while True:
        try:
            now = datetime.utcnow()
            with flask_app.app_context():
                # Daily eligibility check (run at ~02:00 UTC)
                if now.hour == 2:
                    logger.info("Running daily eligibility check...")
                    from webapp.services.monetization import run_eligibility_check_all
                    results = run_eligibility_check_all()
                    logger.info("Eligibility check results: %s", results)

                # Daily WiamElite algorithm (run at ~04:00 UTC)
                if now.hour == 4:
                    logger.info("Running WiamElite algorithm...")
                    from webapp.services.elite import run_elite_algorithm
                    results = run_elite_algorithm()
                    logger.info("WiamElite results: %s", results)

                # Daily AI home curation — DISABLED (was never wired into home page)
                # Home page uses pure SQL queries. Re-enable when needed.
                # if now.hour == 5:
                #     logger.info("Running AI home curation...")
                #     from webapp.services.ai_curation import run_daily_curation
                #     results = run_daily_curation()
                #     logger.info("AI curation results: %s", results)

                # Daily Apex Board AI (run at ~06:00 UTC — ~3 Gemini calls)
                if now.hour == 6:
                    logger.info("Running Apex Board daily session...")
                    from webapp.services.apex_ai import run_daily_apex_board
                    results = run_daily_apex_board()
                    logger.info("Apex Board results: %s", results)

                # Daily trust score refresh (run at ~07:00 UTC — S15)
                if now.hour == 7:
                    logger.info("Running daily trust score refresh...")
                    try:
                        from webapp.services.trust_engine import compute_reader_trust
                        from webapp.models import User
                        active_users = User.query.filter(
                            User.status == 'active',
                            User.last_active >= now - timedelta(days=30),
                        ).limit(500).all()
                        refreshed = 0
                        for u in active_users:
                            try:
                                compute_reader_trust(u.id, save=True)
                                refreshed += 1
                            except Exception:
                                pass
                        logger.info("Trust scores refreshed for %d users", refreshed)
                    except Exception as te:
                        logger.error("Trust refresh error: %s", te)

                # WIAMid auto-rotation: rotate expired team IDs (run at ~08:00 UTC)
                if now.hour == 8:
                    logger.info("Running WIAMid auto-rotation check...")
                    try:
                        from webapp.models import User, TeamIdHistory
                        from webapp.auth import generate_wiam_id, WIAM_ID_EXPIRY_DAYS
                        from webapp.services.email_service import send_team_id_rotation
                        from webapp.extensions import db

                        expired = User.query.filter(
                            User.is_team_account == True,
                            User.status == 'active',
                            User.team_id_expires_at <= now,
                            User.team_wiam_id_hash.isnot(None),
                        ).all()
                        rotated = 0
                        for tu in expired:
                            try:
                                TeamIdHistory.query.filter_by(user_id=tu.id, is_active=True).update({
                                    'is_active': False, 'expired_at': now
                                })
                                new_id = generate_wiam_id()
                                tu.set_password(new_id)
                                tu.team_wiam_id_hash = tu.password_hash
                                tu.team_id_issued_at = now
                                tu.team_id_expires_at = now + timedelta(days=WIAM_ID_EXPIRY_DAYS)
                                db.session.add(TeamIdHistory(
                                    user_id=tu.id,
                                    wiam_id_hash=tu.team_wiam_id_hash,
                                    issued_at=now,
                                    is_active=True,
                                ))
                                db.session.commit()
                                if tu.team_personal_email:
                                    send_team_id_rotation(tu.team_personal_email, tu.display_name, new_id)
                                rotated += 1
                            except Exception as re:
                                logger.error("WIAMid rotation failed for user %s: %s", tu.id, re)
                                db.session.rollback()
                        logger.info("WIAMid rotation: %d IDs rotated", rotated)
                    except Exception as re:
                        logger.error("WIAMid rotation job error: %s", re)

                # WIAMid expiry warning: warn 2 days before (run at ~09:00 UTC)
                if now.hour == 9:
                    try:
                        from webapp.models import User
                        from webapp.services.email_service import send_team_id_expiry_warning
                        warn_threshold = now + timedelta(days=2)
                        expiring_soon = User.query.filter(
                            User.is_team_account == True,
                            User.status == 'active',
                            User.team_id_expires_at <= warn_threshold,
                            User.team_id_expires_at > now,
                            User.team_wiam_id_hash.isnot(None),
                        ).all()
                        for tu in expiring_soon:
                            days_left = max(1, (tu.team_id_expires_at - now).days)
                            if tu.team_personal_email:
                                send_team_id_expiry_warning(tu.team_personal_email, tu.display_name, days_left)
                        if expiring_soon:
                            logger.info("WIAMid expiry warnings sent to %d team members", len(expiring_soon))
                    except Exception as we:
                        logger.error("WIAMid expiry warning error: %s", we)

                # Monthly payout (run on 1st of month at ~03:00 UTC)
                if now.day == 1 and now.hour == 3:
                    logger.info("Running monthly payout processing...")
                    from webapp.services.monetization import process_monthly_payouts
                    results = process_monthly_payouts()
                    logger.info("Payout results: %s", results)
        except Exception as e:
            logger.error("Scheduled job error: %s", e)

        # Sleep for 1 hour between checks
        time.sleep(3600)


scheduler_thread = threading.Thread(target=_run_scheduled_jobs, daemon=True)
scheduler_thread.start()
logger.info("Background scheduler started.")

# ---------------------------------------------------------------------------
# 4. Run with gunicorn in production, or Flask dev server locally
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    logger.info(f"Starting server on port {port}...")
    flask_app.run(host='0.0.0.0', port=port, debug=False)

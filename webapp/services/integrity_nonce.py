from itsdangerous import URLSafeTimedSerializer, BadData
from flask import current_app


def _serializer():
    secret = current_app.config.get('SECRET_KEY', 'dev-secret')
    return URLSafeTimedSerializer(secret_key=secret, salt='wiam.integrity.nonce.v1')


def mint_integrity_nonce(user_id, platform):
    payload = {
        'uid': int(user_id),
        'platform': (platform or '').strip().lower(),
    }
    return _serializer().dumps(payload)


def verify_integrity_nonce(token, expected_user_id, expected_platform, max_age_seconds=300):
    if not token:
        return False, 'missing_nonce'
    try:
        data = _serializer().loads(token, max_age=max_age_seconds)
    except BadData:
        return False, 'invalid_or_expired_nonce'

    uid = int(data.get('uid') or 0)
    platform = (data.get('platform') or '').strip().lower()
    if uid != int(expected_user_id):
        return False, 'nonce_user_mismatch'
    if platform != (expected_platform or '').strip().lower():
        return False, 'nonce_platform_mismatch'
    return True, 'ok'


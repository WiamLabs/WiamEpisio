"""
Google Play Integrity verification helpers.

This is designed as a rollout-safe path:
- If PLAY_INTEGRITY_ENFORCE is false, verification is skipped (allow).
- If enforced, token signature/claims are validated and verdicts are checked.
"""
from datetime import datetime
import jwt
from flask import current_app


def _cfg(key, default=None):
    return current_app.config.get(key, default)


def _allowed_device_verdicts():
    raw = _cfg('PLAY_INTEGRITY_ALLOWED_DEVICE_VERDICTS', '') or ''
    return {x.strip() for x in raw.split(',') if x.strip()}


def verify_play_integrity_token(token, expected_nonce=None):
    """
    Verify a Play Integrity JWS token.
    Returns dict:
      {
        ok, skipped, allow_trial, reason,
        payload, nonce_ok, app_ok, device_ok, licensing_ok, risk_score
      }
    """
    enforce = bool(_cfg('PLAY_INTEGRITY_ENFORCE', False))
    if not enforce:
        return {
            'ok': True,
            'skipped': True,
            'allow_trial': True,
            'reason': 'play_integrity_enforcement_disabled',
            'payload': {},
            'nonce_ok': True,
            'app_ok': True,
            'device_ok': True,
            'licensing_ok': True,
            'risk_score': 0,
        }

    if not token:
        return {
            'ok': False,
            'skipped': False,
            'allow_trial': False,
            'reason': 'missing_play_integrity_token',
            'payload': {},
            'nonce_ok': False,
            'app_ok': False,
            'device_ok': False,
            'licensing_ok': False,
            'risk_score': 100,
        }

    try:
        jwks_url = _cfg('PLAY_INTEGRITY_JWKS_URL', 'https://www.googleapis.com/oauth2/v3/certs')
        jwk_client = jwt.PyJWKClient(jwks_url)
        signing_key = jwk_client.get_signing_key_from_jwt(token)

        audience = _cfg('PLAY_INTEGRITY_AUDIENCE', '') or None
        kwargs = {
            'algorithms': ['RS256'],
            'options': {'verify_signature': True, 'verify_exp': True, 'verify_iat': True},
        }
        if audience:
            kwargs['audience'] = audience

        payload = jwt.decode(token, signing_key.key, **kwargs)
    except Exception as exc:
        return {
            'ok': False,
            'skipped': False,
            'allow_trial': False,
            'reason': f'integrity_token_invalid:{type(exc).__name__}',
            'payload': {},
            'nonce_ok': False,
            'app_ok': False,
            'device_ok': False,
            'licensing_ok': False,
            'risk_score': 100,
        }

    request_details = payload.get('requestDetails') or {}
    app_integrity = payload.get('appIntegrity') or {}
    device_integrity = payload.get('deviceIntegrity') or {}
    account_details = payload.get('accountDetails') or {}

    token_nonce = request_details.get('nonce') or payload.get('nonce')
    nonce_ok = bool(token_nonce and expected_nonce and token_nonce == expected_nonce)

    app_verdict = app_integrity.get('appRecognitionVerdict', '')
    package_name = app_integrity.get('packageName', '')
    licensing_verdict = account_details.get('appLicensingVerdict', '')
    device_verdicts = device_integrity.get('deviceRecognitionVerdict') or []

    require_play_recognized = bool(_cfg('PLAY_INTEGRITY_REQUIRE_PLAY_RECOGNIZED', True))
    require_licensed = bool(_cfg('PLAY_INTEGRITY_REQUIRE_LICENSED', False))
    expected_package = _cfg('PLAY_INTEGRITY_PACKAGE_NAME', '') or ''

    app_ok = (not require_play_recognized) or (app_verdict == 'PLAY_RECOGNIZED')
    if expected_package and package_name:
        app_ok = app_ok and (package_name == expected_package)

    allowed_device = _allowed_device_verdicts()
    device_ok = bool(device_verdicts) and any(v in allowed_device for v in device_verdicts)
    licensing_ok = (not require_licensed) or (licensing_verdict == 'LICENSED')

    allow_trial = bool(nonce_ok and app_ok and device_ok and licensing_ok)

    risk = 0
    if not nonce_ok:
        risk += 35
    if not app_ok:
        risk += 35
    if not device_ok:
        risk += 30
    if not licensing_ok:
        risk += 20
    risk = min(100, risk)

    return {
        'ok': True,
        'skipped': False,
        'allow_trial': allow_trial,
        'reason': 'ok' if allow_trial else 'integrity_requirements_not_met',
        'payload': payload,
        'nonce_ok': nonce_ok,
        'app_ok': app_ok,
        'device_ok': device_ok,
        'licensing_ok': licensing_ok,
        'risk_score': risk,
        'checked_at': datetime.utcnow().isoformat(),
    }


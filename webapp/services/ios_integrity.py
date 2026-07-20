"""
iOS integrity verification helper (rollout-safe).

Note:
- With IOS_INTEGRITY_ENFORCE=false: verification is skipped (allow).
- With IOS_INTEGRITY_ENFORCE=true: token is required and basic shape checks apply.
"""
from datetime import datetime
import jwt
from flask import current_app


def _cfg(key, default=None):
    return current_app.config.get(key, default)


def verify_ios_integrity_token(token, expected_nonce=None):
    enforce = bool(_cfg('IOS_INTEGRITY_ENFORCE', False))
    if not enforce:
        return {
            'ok': True,
            'skipped': True,
            'allow_trial': True,
            'reason': 'ios_integrity_enforcement_disabled',
            'nonce_ok': True,
            'token_ok': True,
            'risk_score': 0,
            'checked_at': datetime.utcnow().isoformat(),
        }

    t = (token or '').strip()
    if not t:
        return {
            'ok': False,
            'skipped': False,
            'allow_trial': False,
            'reason': 'missing_ios_integrity_token',
            'nonce_ok': False,
            'token_ok': False,
            'risk_score': 100,
            'checked_at': datetime.utcnow().isoformat(),
        }

    token_ok = len(t) >= 32
    nonce_ok = False
    signature_ok = False
    claims_ok = False
    reason = 'ios_token_sanity_only'

    require_signature = bool(_cfg('IOS_INTEGRITY_REQUIRE_JWT_SIGNATURE', False))
    jwks_url = (_cfg('IOS_INTEGRITY_JWKS_URL', '') or '').strip()
    audience = (_cfg('IOS_INTEGRITY_AUDIENCE', '') or '').strip() or None
    issuer = (_cfg('IOS_INTEGRITY_ISSUER', '') or '').strip() or None

    # Strict path for JWT-based attestation tokens if configured.
    if t.count('.') == 2 and jwks_url:
        try:
            jwk_client = jwt.PyJWKClient(jwks_url)
            signing_key = jwk_client.get_signing_key_from_jwt(t)
            kwargs = {
                'algorithms': ['RS256', 'ES256'],
                'options': {'verify_signature': True, 'verify_exp': True, 'verify_iat': True},
            }
            if audience:
                kwargs['audience'] = audience
            payload = jwt.decode(t, signing_key.key, **kwargs)
            if issuer:
                if payload.get('iss') != issuer:
                    return {
                        'ok': True,
                        'skipped': False,
                        'allow_trial': False,
                        'reason': 'issuer_mismatch',
                        'nonce_ok': False,
                        'token_ok': token_ok,
                        'signature_ok': True,
                        'claims_ok': False,
                        'risk_score': 85,
                        'checked_at': datetime.utcnow().isoformat(),
                    }
            signature_ok = True
            claims_ok = True
            token_nonce = payload.get('nonce') or payload.get('challenge')
            nonce_ok = bool(expected_nonce and token_nonce == expected_nonce)
            reason = 'ok' if nonce_ok else 'nonce_mismatch'
        except Exception as exc:
            if require_signature:
                return {
                    'ok': False,
                    'skipped': False,
                    'allow_trial': False,
                    'reason': f'ios_integrity_jwt_invalid:{type(exc).__name__}',
                    'nonce_ok': False,
                    'token_ok': token_ok,
                    'signature_ok': False,
                    'claims_ok': False,
                    'risk_score': 100,
                    'checked_at': datetime.utcnow().isoformat(),
                }
            # Fall through to sanity mode if signature is optional.

    # Sanity fallback path (still requires nonce binding).
    if not nonce_ok and expected_nonce:
        nonce_ok = (expected_nonce in t)
        if nonce_ok and reason != 'ok':
            reason = 'nonce_embedded_match'
    if not expected_nonce:
        nonce_ok = False
        reason = 'missing_expected_nonce'

    allow = bool(token_ok and nonce_ok)
    risk = 0 if allow else 80
    return {
        'ok': True,
        'skipped': False,
        'allow_trial': allow,
        'reason': 'ok' if allow else reason,
        'nonce_ok': nonce_ok,
        'token_ok': token_ok,
        'signature_ok': signature_ok,
        'claims_ok': claims_ok,
        'risk_score': risk,
        'checked_at': datetime.utcnow().isoformat(),
    }


// © 2026 WiamApp. Powered by WiamLabs
// WiamSafety Section 9 — HMAC helpers (product side only).
// Core lives in wiamlabs-studio/wiamsafety — we only verify inbound webhooks
// and optionally notify Core when a reset finishes.

import crypto from 'crypto';

export const WIAMSAFETY_PRODUCT_CODE = 'WA';

export function getWiamSafetyHmacSecret() {
  return process.env.WIAMSAFETY_HMAC_SECRET || '';
}

export function getWiamSafetyCoreUrl() {
  return (process.env.WIAMSAFETY_CORE_URL || 'https://safety.wiamlabs.com').replace(/\/$/, '');
}

export function hmacSha256Hex(secret, body) {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

export function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value).normalize('NFKC'), 'utf8').digest('hex');
}

export function timingSafeEqualHex(a, b) {
  try {
    const ba = Buffer.from(String(a || ''), 'hex');
    const bb = Buffer.from(String(b || ''), 'hex');
    if (ba.length === 0 || ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Verify X-WiamSafety-Signature against raw request body. */
export function verifyWiamSafetySignature(rawBody, signatureHeader, secret) {
  if (!secret || secret.length < 16) return false;
  if (!signatureHeader || rawBody == null) return false;
  const provided = String(signatureHeader).replace(/^sha256=/i, '').trim();
  const expected = hmacSha256Hex(secret, typeof rawBody === 'string' ? rawBody : String(rawBody));
  return timingSafeEqualHex(expected, provided);
}

/**
 * Optional callback: tell Core the product reset finished.
 * Failures are logged only — never block the user-facing reset.
 */
export async function notifyWiamSafetyResetComplete(referenceId) {
  const secret = getWiamSafetyHmacSecret();
  const coreUrl = getWiamSafetyCoreUrl();
  if (!secret || !referenceId) return { skipped: true };

  const body = JSON.stringify({
    referenceId,
    productCode: WIAMSAFETY_PRODUCT_CODE,
  });
  const signature = hmacSha256Hex(secret, body);

  try {
    const res = await fetch(`${coreUrl}/v1/reset/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Product-Signature': signature,
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[wiamsafety] reset/complete failed:', res.status, text.slice(0, 200));
      return { ok: false, status: res.status };
    }
    return { ok: true };
  } catch (err) {
    console.warn('[wiamsafety] reset/complete error:', err.message);
    return { ok: false, error: err.message };
  }
}

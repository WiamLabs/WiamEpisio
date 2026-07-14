// © 2026 WiamApp. Powered by WiamLabs
// Shared password-reset email flow (forgot-password + WiamSafety handoff).
// Never accepts or sets a plaintext password here — only emails a reset link + OTP.

import { supabaseAdmin } from './supabaseAdmin.js';

/**
 * Trigger WiamApp's existing Brevo reset email for a user email.
 * Same behaviour as POST /api/auth/forgot-password.
 * @returns {{ ok: true, emailed: boolean } | { ok: false, error: string }}
 */
export async function sendPasswordResetForEmail(rawEmail) {
  const cleanEmail = String(rawEmail || '').trim().toLowerCase();
  if (!cleanEmail) return { ok: false, error: 'Email is required.' };

  const redirectTo = process.env.PASSWORD_RESET_REDIRECT_URL
    || 'https://wiamapp.com/reset-password';

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email: cleanEmail,
    options: { redirectTo },
  });

  if (error) {
    console.warn('[password-reset]', error.message);
    // Enumeration-safe: treat as soft success (no email to send)
    return { ok: true, emailed: false };
  }

  const actionLink = data?.properties?.action_link;
  if (!actionLink) {
    console.warn('[password-reset] No action_link returned');
    return { ok: true, emailed: false };
  }

  let finalLink = actionLink;
  try {
    const u = new URL(actionLink);
    u.searchParams.set('redirect_to', redirectTo);
    finalLink = u.toString();
  } catch {
    finalLink = actionLink;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await supabaseAdmin.from('otp_codes').update({ used: true }).eq('email', cleanEmail).eq('used', false);
  const { error: otpErr } = await supabaseAdmin.from('otp_codes').insert({
    email: cleanEmail,
    code: otp,
    expires_at: expiresAt.toISOString(),
  });
  if (otpErr) throw otpErr;

  const { sendPasswordResetEmail } = await import('./resend.js');
  await sendPasswordResetEmail(cleanEmail, finalLink, otp);

  return { ok: true, emailed: true };
}

/**
 * Look up user email by WiamApp user id (productUserId from WiamSafety).
 */
export async function getUserEmailById(userId) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.email ? String(data.email).trim().toLowerCase() : null;
}

// © 2026 WiamApp. Powered by WiamLabs
// backend/lib/resend.js
// Transactional email via the Resend REST API (https://resend.com).
// Uses native fetch (Node 18+) — no SDK dependency required.
//
// Required env var (set on Render):
//   RESEND_API_KEY   -> your Resend API key (re_...)
// Optional:
//   EMAIL_FROM       -> verified sender, e.g. "WiamApp <noreply@wiamapp.com>"
//
// If RESEND_API_KEY is not set, emails are skipped (logged) instead of
// crashing the request — so the app keeps working before email is configured.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM      = process.env.EMAIL_FROM || 'WiamApp <noreply@wiamapp.com>';

// ─── Brand-wrapped HTML layout ────────────────────────────────
function layout(heading, bodyHtml) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="max-width:520px;margin:0 auto;padding:24px;">
      <div style="background:#0D0D2B;border-radius:12px 12px 0 0;padding:20px 24px;">
        <span style="color:#D4A017;font-size:20px;font-weight:700;">WiamApp</span>
      </div>
      <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:24px;">
        <h2 style="margin:0 0 12px;font-size:18px;color:#0D0D2B;">${heading}</h2>
        ${bodyHtml}
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px;">
        © ${new Date().getFullYear()} WiamApp · Powered by WiamLabs
      </p>
    </div>
  </body>
</html>`;
}

// ─── Core sender ──────────────────────────────────────────────
export async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.warn(`[resend] RESEND_API_KEY not set — skipping email to ${to} ("${subject}")`);
    return { skipped: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[resend] Failed to send to ${to}: ${res.status} ${text}`);
      return { error: text };
    }
    return await res.json();
  } catch (err) {
    console.error(`[resend] Error sending to ${to}:`, err.message);
    return { error: err.message };
  }
}

// ─── Verification approved ────────────────────────────────────
export async function sendDocumentApprovedEmail(email, fullName) {
  return sendEmail({
    to: email,
    subject: 'Your WiamApp identity is verified ✅',
    html: layout(
      'Identity verified',
      `<p>Hi ${fullName || 'there'},</p>
       <p>Great news — your identity has been <strong>verified</strong>.
       Your verified badge is now active on your profile.</p>
       <p>You can head back into the app and continue right away.</p>`
    ),
  });
}

// ─── Verification submitted — sets expectations, especially for
// workers who registered on the web before the app is distributed ──
export async function sendVerificationSubmittedEmail(email, fullName) {
  return sendEmail({
    to: email,
    subject: "You're all set — here's what happens next",
    html: layout(
      'Verification submitted',
      `<p>Hi ${fullName || 'there'},</p>
       <p>Thanks for completing your WiamApp worker profile. Here's exactly
       what happens now:</p>
       <ol style="padding-left:18px;line-height:1.7;">
         <li>Our team reviews your ID and photo — usually within 24 hours.</li>
         <li>You'll get an email the moment you're approved.</li>
         <li>Download the WiamApp mobile app and log in with this same
             email and password — your profile, bio, and rate are already
             saved and waiting for you.</li>
       </ol>
       <p>No action needed from you right now — we'll email you again
       as soon as there's an update.</p>`
    ),
  });
}

// ─── Verification rejected ────────────────────────────────────
export async function sendDocumentRejectedEmail(email, fullName, reason) {
  return sendEmail({
    to: email,
    subject: 'Action required — verification update',
    html: layout(
      'Verification needs another look',
      `<p>Hi ${fullName || 'there'},</p>
       <p>We couldn't verify your documents this time.</p>
       <p style="background:#fef2f2;border-left:4px solid #ef4444;padding:10px 14px;border-radius:4px;">
         <strong>Reason:</strong> ${reason || 'Not specified'}
       </p>
       <p>Please open the app and resubmit clear, valid documents.</p>`
    ),
  });
}

// ─── Booking notification (generic) ───────────────────────────
export async function sendBookingEmail(email, fullName, details = {}) {
  const { title = 'Booking update', message = '' } = details;
  return sendEmail({
    to: email,
    subject: title,
    html: layout(
      title,
      `<p>Hi ${fullName || 'there'},</p>
       <p>${message || 'There is an update on your booking. Open the WiamApp to view details.'}</p>`
    ),
  });
}

// ─── Password reset (WiamApp-branded — never send via Supabase mailer) ──
export async function sendPasswordResetEmail(email, resetUrl) {
  return sendEmail({
    to: email,
    subject: 'Reset your WiamApp password',
    html: layout(
      'Reset your password',
      `<p>We received a request to reset the password for your WiamApp account.</p>
       <p style="margin:24px 0;">
         <a href="${resetUrl}"
            style="display:inline-block;background:#D4A017;color:#0D0D2B;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:10px;">
           Choose a new password
         </a>
       </p>
       <p style="font-size:13px;color:#6b7280;line-height:1.5;">
         This link expires soon. If you did not request a reset, you can ignore this email — your password stays the same.
       </p>
       <p style="font-size:12px;color:#9ca3af;word-break:break-all;">Or open this link:<br/>${resetUrl}</p>`
    ),
  });
}

export default {
  sendEmail,
  sendDocumentApprovedEmail,
  sendDocumentRejectedEmail,
  sendVerificationSubmittedEmail,
  sendBookingEmail,
  sendPasswordResetEmail,
};

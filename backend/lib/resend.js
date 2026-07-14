// © 2026 WiamApp. Powered by WiamLabs
// backend/lib/resend.js
// WiamApp transactional email — Brevo only.
// (Resend is for other WiamLabs products: WiamPass, WiamAI, WiamTrade — not this app.)
//
// Env (Render):
//   BREVO_API_KEY      -> https://app.brevo.com → SMTP & API
//   EMAIL_FROM         -> "WiamApp <noreply@wiamapp.com>" (must be verified in Brevo)
//   EMAIL_FROM_NAME    -> optional display name (default WiamApp)
//   EMAIL_FROM_ADDRESS -> optional bare address if EMAIL_FROM is not "Name <email>"

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_FROM    = process.env.EMAIL_FROM || 'WiamApp <noreply@wiamapp.com>';

function parseFrom(from) {
  const m = String(from || '').match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].replace(/^["']|["']$/g, '') || 'WiamApp', email: m[2].trim() };
  if (process.env.EMAIL_FROM_ADDRESS) {
    return {
      name: process.env.EMAIL_FROM_NAME || 'WiamApp',
      email: process.env.EMAIL_FROM_ADDRESS,
    };
  }
  return { name: 'WiamApp', email: String(from).trim() || 'noreply@wiamapp.com' };
}

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

// ─── Core sender (Brevo) ──────────────────────────────────────
// Pass required: true for OTP / password-reset so callers get a real failure
// instead of a silent skip when BREVO_API_KEY is missing or Brevo rejects.
export async function sendEmail({ to, subject, html, required = false }) {
  if (!BREVO_API_KEY) {
    const msg = `BREVO_API_KEY not set — cannot email ${to} ("${subject}")`;
    console.warn(`[brevo] ${msg}`);
    if (required) throw new Error('Email service is not configured. Please try again later.');
    return { skipped: true };
  }

  try {
    const sender = parseFrom(EMAIL_FROM);
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: sender.name, email: sender.email },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[brevo] Failed to send to ${to}: ${res.status} ${text}`);
      if (required) {
        throw new Error('Could not send email. Check that the sender domain is verified in Brevo.');
      }
      return { error: text };
    }
    return await res.json().catch(() => ({ ok: true }));
  } catch (err) {
    if (required && !/Could not send email|Email service is not configured/i.test(err.message)) {
      console.error(`[brevo] Error sending to ${to}:`, err.message);
      throw new Error('Could not send email. Please try again in a moment.');
    }
    if (required) throw err;
    console.error(`[brevo] Error sending to ${to}:`, err.message);
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
// App: use the 6-digit code on ResetPasswordScreen.
// Web: use the link → https://wiamapp.com/reset-password
export async function sendPasswordResetEmail(email, resetUrl, code) {
  const codeBlock = code
    ? `<p>Or enter this code in the WiamApp:</p>
       <p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#0D0D2B;margin:12px 0 24px;">${code}</p>`
    : '';

  return sendEmail({
    to: email,
    subject: 'Reset your WiamApp password',
    required: true,
    html: layout(
      'Reset your password',
      `<p>We received a request to reset the password for your WiamApp account.</p>
       ${codeBlock}
       <p style="margin:24px 0;">
         <a href="${resetUrl}"
            style="display:inline-block;background:#D4A017;color:#0D0D2B;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:10px;">
           Choose a new password on the web
         </a>
       </p>
       <p style="font-size:13px;color:#6b7280;line-height:1.5;">
         The code and link expire in about 15 minutes. If you did not request a reset, ignore this email — your password stays the same.
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

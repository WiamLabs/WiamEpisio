# WiamApp email + password reset branding
### © 2026 WiamApp. Powered by WiamLabs

## Provider
**Brevo** (you may know it as the old “Sendinblue” brand — not “Bravo”).
Same API already used on the WiamLabs website.

Set on Render:
```
BREVO_API_KEY=xkeysib-...
EMAIL_FROM=WiamApp <noreply@wiamapp.com>
PASSWORD_RESET_REDIRECT_URL=https://wiamapp.com/reset-password
```

Verify the sender domain / address in Brevo → **Senders, Domains & Dedicated IPs**.

OTP, verification, and password-reset emails all go through `backend/lib/resend.js`,
which now sends via **Brevo first** (Resend only if Brevo is missing/fails).

Password reset no longer uses Supabase’s mailer — so users should not see “Supabase Auth”.

## Fix the localhost reset link (one-time in Supabase)
Auth → **URL Configuration**:
1. Site URL = `https://wiamapp.com`
2. Redirect URLs include `https://wiamapp.com/reset-password`

Without that, links can still bounce to `localhost:3000`.

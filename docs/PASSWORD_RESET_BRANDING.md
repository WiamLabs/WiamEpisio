# WiamApp email + password reset branding
### © 2026 WiamApp. Powered by WiamLabs

## Provider split (WiamLabs)
| Product | Email provider |
|---------|----------------|
| **WiamApp** (this app) | **Brevo** |
| WiamLabs website | Brevo |
| WiamPass / WiamAI / WiamTrade | **Resend** |

Do **not** put `RESEND_API_KEY` on the WiamApp Render service.

## WiamApp (Brevo)
Set on Render:
```
BREVO_API_KEY=xkeysib-...
EMAIL_FROM=WiamApp <noreply@wiamapp.com>
PASSWORD_RESET_REDIRECT_URL=https://wiamapp.com/reset-password
```

Verify the sender in Brevo → **Senders, Domains & Dedicated IPs**.

OTP, verification, bookings, and password-reset emails go through `backend/lib/resend.js` → Brevo only.

Password reset does **not** use Supabase’s mailer — users should not see “Supabase Auth”.

## Fix the localhost reset link (one-time in Supabase)
Auth → **URL Configuration**:
1. Site URL = `https://wiamapp.com`
2. Redirect URLs include `https://wiamapp.com/reset-password`

Without that, links can still bounce to `localhost:3000`.

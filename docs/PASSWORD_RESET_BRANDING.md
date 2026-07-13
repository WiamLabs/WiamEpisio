# Password reset — WiamApp branding (not Supabase mail)
### © 2026 WiamApp. Powered by WiamLabs

## What users should see
- From: **WiamApp** (`EMAIL_FROM`)
- Subject: Reset your WiamApp password
- Link opens: `https://wiamapp.com/reset-password` (not localhost)

## How it works now
`POST /api/auth/forgot-password` uses Supabase Admin `generateLink` (no email sent by Supabase), then **Resend** sends the branded email.

## One-time Supabase dashboard settings (required)
Auth → URL Configuration:
1. **Site URL** = `https://wiamapp.com` (not `http://localhost:3000`)
2. **Redirect URLs** add:
   - `https://wiamapp.com/reset-password`
   - `https://wiamapp.com/**` (optional wildcard)

If Site URL stays on localhost, mobile users get `localhost refused to connect` after clicking the link.

## Render env
```
PASSWORD_RESET_REDIRECT_URL=https://wiamapp.com/reset-password
EMAIL_FROM=WiamApp <noreply@wiamapp.com>
RESEND_API_KEY=re_...
```

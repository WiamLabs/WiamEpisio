# WiamApp — Testing Plan Corrections
### Checked line-by-line against the real backend code, July 2026

Short answer to "are we done": **not yet** — see the running list at the
bottom. Your testing plan's structure and phases are good and usable.
But if you set up Render with the exact env var names in your plan, the
backend will start (no crash) but several features will silently fail —
chat moderation, ID document uploads, and subscription webhooks won't
work, and you won't get an error telling you why. Fixing the list below
before Phase 1 checkboxes saves you a lot of confused testing later.

---

## 1. Env vars — what to change

### Remove (not used anywhere in the code)
- `JWT_SECRET` — not used. Auth uses Supabase's own session tokens, not a custom JWT.
- `EXPO_ACCESS_TOKEN` — not used. Push notifications don't need this.
- `APP_URL` / `API_URL` — not referenced anywhere. Harmless to add, but does nothing.
- `PAYSTACK_PUBLIC_KEY` — this one goes in **EAS secrets** (mobile app), not Render. The backend never reads it.
- `PAYSTACK_WEBHOOK_SECRET` — not read by the webhook handler as written. (If you want real signature verification here, tell me and I'll add it — right now the endpoint trusts the payload, which is fine for testing but should be tightened before real money moves.)

### Rename (same idea, different actual variable name in code)
| Your plan says | Code actually reads |
|---|---|
| `SUPABASE_SECRET_KEY` | ✅ correct, keep as-is |
| `SUPABASE_ANON_KEY` | not used by the **backend** at all (only the mobile app and marketing site need an anon key) |
| `R2_ACCOUNT_ID` | not used directly — you need the full `CLOUDFLARE_R2_ENDPOINT` URL instead (see below) |
| `R2_ACCESS_KEY_ID` | `CLOUDFLARE_R2_ACCESS_KEY_ID` |
| `R2_SECRET_ACCESS_KEY` | `CLOUDFLARE_R2_SECRET_ACCESS_KEY` |
| `R2_BUCKET_NAME` | `CLOUDFLARE_R2_BUCKET_NAME` |
| `R2_PUBLIC_URL` | `CLOUDFLARE_R2_PUBLIC_URL` |

### Missing entirely from your plan (must add or features fail silently)
| Variable | Why it's required |
|---|---|
| `CLOUDFLARE_R2_ENDPOINT` | The actual R2 S3-compatible endpoint URL (Cloudflare dashboard → R2 → bucket → Settings). Without it, **every** photo/voice upload fails. |
| `R2_PRIVATE_ACCESS_KEY`, `R2_PRIVATE_SECRET_KEY`, `R2_PRIVATE_BUCKET_NAME`, `R2_PRIVATE_ENDPOINT` | ID documents and business registration certs upload to a **second, private** bucket on purpose, so they're never publicly accessible. Needs its own R2 bucket + its own API token. Without this, ID upload during verification fails. |
| `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`, or `CEREBRAS_API_KEY` (at least ONE) | Every chat message gets AI-moderated before sending. Zero of these configured = **every chat message fails to send**, on purpose, not a bug. Cerebras is fastest and free (1M tokens/day, no card). |
| `CRON_SECRET` | The nightly ranking/eligibility/reminder cron jobs check this as a header (`X-Cron-Secret`) before running. Without it set (and matched in cron-job.org), those jobs will 401 and never run. |
| `REVENUECAT_WEBHOOK_SECRET` | Worker Pro subscriptions bought through the App Store/Play Store (in-app purchase) go through RevenueCat, not Paystack. This is a **separate purchase path from Paystack subscribe** — you need a RevenueCat account too if you want subscriptions to work through the stores. |
| `OPEN_EXCHANGE_RATES_APP_ID` | Powers GHS/NGN/other currency conversion display. Free tier at openexchangerates.org. |
| `WIAMID_SALT` | Any random string — used to generate each user's WiaMID. Just needs to exist. |

**Bottom line:** the real required list is longer than your plan's, mainly because of the private-bucket-for-ID-docs and AI-chat-moderation pieces. Full authoritative list lives in `backend/.env.example` in the zip — it's auto-generated from every `process.env.X` reference in the code, so it can't drift.

## 1.5 Mobile app (EAS) — one name is wrong

Your plan says `EXPO_PUBLIC_API_URL`. The actual code everywhere in the
app (checked every `lib/api/*.js` file) reads `EXPO_PUBLIC_BACKEND_URL`.
Use that exact name in `eas secret:create`, or the app will build fine
but every single API call will fail silently (undefined URL).

---

## 2. Endpoint checklist corrections (Phase 1.3)

| Your plan says | Reality |
|---|---|
| `POST /api/webhooks/paystack` | ✅ correct — exists exactly as written |
| *(not listed)* | `POST /api/webhooks/revenuecat` also exists — add this to your checklist if you're testing store subscriptions |
| `GET /api/chat/:bookingId` | Doesn't exist as a REST route. Chat messages are read directly from Supabase by the app (real-time subscription), not through the Express backend. Only `POST /api/chat/send` and `POST /api/chat/send-voice` are real backend routes — those are the ones AI-moderation runs through. |
| `POST /api/uploads/id-document` | Route path is right, but it uploads to the **private** R2 bucket — test this one specifically once `R2_PRIVATE_*` vars are set, separately from avatar/portfolio uploads. |
| Everything else in your Phase 1.3 list | Confirmed present and matches. |

---

## 3. Where things actually stand right now (your real question)

**Not done yet — in progress, here's exactly what's left:**
1. Web registration for workers/customers (Phase 5 of your plan) — you were right to flag this. The Marketing site currently has **no working registration form at all** — the "Become a Worker" button on the homepage points to `app.wiamapp.com/register?role=worker`, a subdomain that was never built. I'm building the real page now (this same session) — a mobile-friendly registration form on the Marketing site that calls the real `/api/auth/register` endpoint, with OTP verification, category picker, and referral code capture.
2. Monorepo restructure — you also asked for this last message: one GitHub repo instead of pushing three projects separately, with Render auto-deploying each service from its own subfolder. Building that now too.

**Confirmed already working (from earlier sessions, re-verified against code just now):** the 24 backend routes including the new referrals/disputes ones, escrow payment flow, worker verification (with the bug I fixed), trust/rankings/quotes/emergency systems.

I'm continuing straight into the registration page + monorepo work now — next message will have the actual files, not just this analysis.

---

## 4. Final status — are we done?

**Yes, for "get the web presence ready to test."** Everything below is
now real, built into the repo, not just planned:

- Web registration for customers AND workers, with OTP
- Workers who register on the web now get a **real next step**, not
  just a wait: complete bio + rate, then upload ID + selfie straight
  from the browser (camera capture on phone), submitted to the same
  admin queue the mobile app uses. Skippable at each step, but no
  longer a dead end.
- A "what happens next" email fires the moment verification is submitted
- Password reset for the business portal (`/forgot-password` →
  `/reset-password`, shared across all roles)
- `sitemap.xml` + `robots.txt` for SEO
- One domain, no subdomains — `wiamapp.com/business/*` proxies
  transparently to the business portal, invisible to the browser

**Deliberately not built:** an admin panel — you're building your own
Studio for that across the whole WiamLabs product line, so every
`backend/routes/admin.js` action (15 of them) is left ready and waiting
for your Studio to call, untouched.

**Still open, lower priority:** signature verification on the Paystack
webhook (currently trusts the payload — fine for testing, not for real
money later), RevenueCat subscription testing if you use store purchases.

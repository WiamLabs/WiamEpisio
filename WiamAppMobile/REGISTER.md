# Play Store registration runbook for WiamApp

Step-by-step actions you (the human) need to perform to publish WiamApp on
Google Play. Code-side prep is already done in this PR; this file lists the
external steps and the `eas-cli` commands you run on your laptop.

For the why behind each step, see
`WiamAppMobile/docs/PLAY_RELEASE_CHECKLIST.md`.

---

## 0. Open the slow-path account first (do this *today*)

Google Play Developer registration takes 2-7 days for new accounts (ID +
address verification), and once approved there is a *14-day mandatory closed
testing window* before you can apply for Production access. So this is the
critical-path item — start it before everything else.

- **URL:** https://play.google.com/console/signup
- **Cost:** $25 one-time
- **Need:** government photo ID, valid credit card, address that matches the ID
- **Account type:** Organization (if WiamLabs is a registered business) or
  Individual otherwise

Parallel: open the Apple Developer account ($99/yr) at
https://developer.apple.com/programs/enroll/ if you also want iOS.

## 1. Set up the three external services that own the env vars

`eas.json` references three placeholders that *must* be replaced before the
first production build. See `WiamAppMobile/EAS_SETUP.md` for the exact steps.
Quick summary:

1. **RevenueCat** (https://app.revenuecat.com) — create project + iOS app +
   Android app, copy public API keys into `EXPO_PUBLIC_RC_APPLE_KEY` and
   `EXPO_PUBLIC_RC_GOOGLE_KEY`.
2. **Google Cloud project** (https://console.cloud.google.com) — create
   project, enable Play Integrity API, copy the 12-digit project number into
   `EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER`. Link it inside
   Play Console → Setup → App integrity.
3. **Play service account** (only needed for `eas submit` automation) — create
   in Google Cloud, grant Play Console "Release manager" role, save JSON as
   `WiamAppMobile/play-service-account.json` (gitignored).

## 2. Run `eas init` (interactive — needs you at the keyboard)

Once your Expo account exists (sign up free at https://expo.dev), open
PowerShell at the repo root and run:

```powershell
cd C:\WiamLight\WiamAppMobile
npx eas-cli login
npx eas-cli init
```

`eas init` will:

- Ask which Expo account to associate the project with.
- Confirm the slug (`WiamAppMobile`) — accept the default.
- Rewrite `app.json` so `extra.eas.projectId` becomes a real UUID like
  `7cd8a4a7-09f2-4b1e-8a31-...` (replacing the current placeholder
  `"wiamapp-mobile"`).

Commit that change immediately so the QA workflow's `playstore-readiness` job
sees it on the next push:

```powershell
git add WiamAppMobile/app.json
git commit -m "chore(eas): bind real EAS projectId after eas init"
git push
```

## 3. First production Android build

```powershell
cd C:\WiamLight\WiamAppMobile
npx eas-cli build --profile production --platform android
```

EAS will:

- Generate a production keystore (or reuse one if you already have it). Say
  yes — let EAS manage it. The keystore is what your app is signed with;
  losing it = losing the app.
- Upload your code to EAS Build cloud.
- Compile the AAB. Takes 15-45 minutes; you can close the terminal and watch
  progress at https://expo.dev/accounts/<your-username>/projects/wiamappmobile/builds.

After the build succeeds, download the AAB from the dashboard.

## 4. Capture the signing-key SHA-256 (unblocks deep links)

```powershell
cd C:\WiamLight\WiamAppMobile
npx eas-cli credentials -p android
```

Pick "Production" → "Keystore" → it prints the SHA-256 fingerprint (a long
uppercase hex string with colons, like `AB:CD:12:...:EF`).

Set it on Render so `https://wiamapp.com/.well-known/assetlinks.json` returns
the right value:

- Render dashboard → your service → Environment → Add env var
- Name: `ANDROID_APP_SHA256_FINGERPRINTS`
- Value: paste the SHA-256 (or comma-separated list if you have an upload key
  AND a Play App Signing key)
- Save & deploy

Verify:

```powershell
curl.exe https://wiamapp.com/.well-known/assetlinks.json
```

It should return a JSON array containing your package name and the
fingerprint. If it returns `[]`, the env var didn't take effect on Render yet.

## 5. Manual upload to Play Console (Internal Testing track)

Inside Play Console → your app → Testing → Internal testing → Create release:

- Upload the AAB you downloaded in step 3.
- Fill in the Release name (auto-suggested) and "What's new" notes.
- Tester list: create a new list, add at least 12 email addresses, share the
  opt-in URL.
- **Roll out to Internal testing** (this is staging, not Production — safe).

## 6. Fill in the Play Console listing forms

Required forms (Play Console nags you with red banners until they're done):

- **Main store listing** — short description (≤80 chars), full description
  (≤4000 chars), app icon (already in `WiamAppMobile/assets/icon.png`),
  feature graphic (1024×500 PNG, you'll need to make this), screenshots
  (at least 2 phone screenshots, 16:9 or 9:16, 320-3840 px on the long edge).
- **App access** — provide test login credentials so reviewers can sign in.
  (Use a real account; don't disable login.)
- **Ads** → "Yes, my app contains ads". (You're using AdMob.)
- **Content rating** — fill the questionnaire honestly. WiamApp will likely
  rate Teen / Mature depending on user-generated content.
- **Target audience and content** — set primary age range. If 13-17 is in
  scope, you must complete the Families policy disclosures.
- **Data safety** — declare every data type you collect. Cross-check against
  `webapp/templates/privacy.html` for the canonical list.
  Required entries based on the codebase:
  - Email address (account)
  - Name (account)
  - Photos (avatar uploads)
  - Phone number (optional; only if user fills it in)
  - In-app actions (analytics)
  - Device IDs (anti-fraud)
  - Purchase history (IAP)
  - Approximate location (yes if you keep IPs in logs)
- **Privacy policy URL** — `https://wiamapp.com/privacy`
- **Account deletion URL** — `https://wiamapp.com/data-deletion` (this exists
  thanks to the route added in this PR)

## 7. Promote to Closed testing → Production

- After internal testers have used the app and you've fixed obvious bugs,
  promote the release to **Closed testing**. New developer accounts must run
  Closed testing for **14 consecutive days** with **at least 12 active
  testers** before applying for Production access.
- After 14 days, click "Apply for Production" — Google reviews in 1-3 days.
- Once approved, you can promote any release to Production directly.

## 8. Post-launch monitoring (already wired)

The `qa-enterprise-ceo-rest-mode` workflow auto-probes:

- All public URLs (including the new `/data-deletion`,
  `/.well-known/assetlinks.json`, and `/.well-known/apple-app-site-association`).
- The Render service status (no failed deploy events).
- Backend health endpoints.

If any probe fails, the bug dispatcher emails you. Daily heartbeat email
confirms the pipeline is alive even when nothing is broken.

---

## Quick reference: which file does what

| File | What it controls |
| --- | --- |
| `WiamAppMobile/app.json` | Static app config (package, version, icons, plugins, deep-link host). |
| `WiamAppMobile/eas.json` | Per-build-profile env vars + submit config. |
| `WiamAppMobile/EAS_SETUP.md` | How to fill the three placeholder env vars. |
| `WiamAppMobile/REGISTER.md` (this file) | The full registration runbook. |
| `WiamAppMobile/docs/PLAY_RELEASE_CHECKLIST.md` | Checklist + timeline expectations. |
| `webapp/routes/seo.py` | `/data-deletion`, `/.well-known/assetlinks.json`, `/.well-known/apple-app-site-association`. |
| `docs/AGENT_MEMORY.md` | Cross-session memory (which step are we on, blockers). |
| `scripts/qa/readiness_probe.py` | Reproduce the 41/43 endpoint probe. |

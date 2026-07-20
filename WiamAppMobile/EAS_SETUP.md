# EAS build setup — fill these in before the first production build

`eas.json` references three placeholder values that production builds need.
If you run `eas build --profile production` before replacing them, the resulting
APK/AAB will:

- Have **no in-app purchases** — `iap.js` will log `[IAP] No RevenueCat API key`
  and the wallet screen will show no coin packs / subscriptions.
- Have **no Play Integrity attestation** — backend will refuse purchases that
  reach `/security/play-integrity/verify`.

So Play reviewers will see a broken money flow and reject the listing.

---

## 1. RevenueCat keys (`REPLACE_ME_REVENUECAT_*_PUBLIC_KEY`)

These are RevenueCat's *platform-specific public API keys* — they start with
`appl_` (iOS) or `goog_` (Android). They are **safe to commit and ship in the
client bundle** (per [RevenueCat docs](https://docs.revenuecat.com/docs/authentication)).
The secret REST API key (used only on Render for the backend) is different and
must NOT go here.

Where to find them:

1. Sign up at https://app.revenuecat.com
2. Create a Project named "WiamApp"
3. Add an **App** for iOS (bundle id `com.wiamapp.mobile`)
4. Add another **App** for Android (package name `com.wiamapp.mobile`)
5. For each app, go to *Project Settings → API keys → App-specific API keys*
6. Copy the **public** key for each platform

Then replace in `eas.json` (all three profiles — development, preview,
production):

```json
"EXPO_PUBLIC_RC_APPLE_KEY": "appl_xxxxxxxxxxxxxxxxxxxxxxxx",
"EXPO_PUBLIC_RC_GOOGLE_KEY": "goog_xxxxxxxxxxxxxxxxxxxxxxxx",
```

## 2. Play Integrity cloud project number (`REPLACE_ME_GOOGLE_CLOUD_PROJECT_NUMBER`)

This is a 12-digit number identifying the Google Cloud project linked to the
Play Integrity API. NOT secret — visible to anyone who decompiles the APK.

Where to find it:

1. Go to https://console.cloud.google.com
2. Create a project (name suggestion: "WiamApp Mobile")
3. Enable the **Play Integrity API** for that project (APIs & Services → Library)
4. Top of the dashboard → click the project → copy the **Project number**
   (the long 12-digit number, NOT the project ID/slug)
5. In Google Play Console → Setup → App integrity → Play Integrity API →
   link this Cloud project number to your app.

Then replace in `eas.json`:

```json
"EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER": "123456789012"
```

## 3. Play service account JSON (`play-service-account.json`)

Required only for `eas submit --platform android` (automated upload). The first
manual upload to Play Console doesn't need it.

How to create it:

1. https://console.cloud.google.com/iam-admin/serviceaccounts
2. Create a service account → grant role *Service Account User*
3. Google Play Console → Users and permissions → Invite user → paste the
   service-account email → grant *Release manager* (or finer-grained: *Releases*)
4. Back in Cloud Console → service account → Keys → Add key → JSON →
   save the downloaded file as `WiamAppMobile/play-service-account.json`
5. The file is **gitignored** at the repo root — never commit it.

---

## After all 3 are filled in

Verify locally:

```bash
cd WiamAppMobile
npx eas-cli build:configure          # validates eas.json shape
npx eas-cli build --profile production --platform android --no-wait
```

The `--no-wait` flag returns immediately; the build runs in EAS cloud. Watch
progress at https://expo.dev/accounts/<you>/projects/wiamappmobile/builds.

# WiamApp — Testing & Build Plan
### © 2026 WiamApp. Powered by WiamLabs
#### Prepared for: WiamApp Development Team
#### Prepared by: Martin Wiafe (Founder, WiamLabs)
#### Date: July 2026

---

## OVERVIEW

This document covers the complete plan for building, testing, and distributing WiamApp to testers before the official launch on Google Play Store and Apple App Store.

WiamApp has two parts that work together:
- **WiamApp Backend** — Express.js API running on Render (the engine, runs 24/7)
- **WiamAppExpo** — React Native mobile app built with Expo (what users install on their phones)

Your laptop is only needed when writing new code or submitting a new build. Once deployed, Render and Supabase run everything 24/7 without you.

---

## PHASE 1: COMPLETE THE BACKEND SETUP FIRST

Before any mobile build, the WiamApp backend must be fully configured and working on Render. The mobile app cannot function without these environment variables.

### 1.1 WiamApp Backend Environment Variables (Add to Render)

These are the ONLY env vars for WiamApp. Do not mix with WiamPass variables — they are separate projects on separate Render services.

| Variable | What it is | Where to get it |
|---|---|---|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `production` |
| `SUPABASE_URL` | WiamApp Supabase project URL | Supabase → WiamApp project → Settings → API |
| `SUPABASE_SECRET_KEY` | WiamApp Supabase service role key | Supabase → WiamApp project → Settings → API → service_role key |
| `SUPABASE_ANON_KEY` | WiamApp Supabase anon key | Supabase → WiamApp project → Settings → API → anon key |
| `JWT_SECRET` | Secret for signing tokens | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PAYSTACK_SECRET_KEY` | Paystack secret key | Paystack Dashboard → Settings → API Keys |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key | Paystack Dashboard → Settings → API Keys |
| `PAYSTACK_WEBHOOK_SECRET` | Paystack webhook secret | Paystack Dashboard → Webhooks → your webhook secret |
| `R2_ACCOUNT_ID` | Cloudflare account ID | Cloudflare Dashboard → R2 Overview (right side) |
| `R2_ACCESS_KEY_ID` | R2 API access key | Cloudflare → R2 → Manage R2 API Tokens |
| `R2_SECRET_ACCESS_KEY` | R2 API secret key | Cloudflare → R2 → Manage R2 API Tokens |
| `R2_BUCKET_NAME` | R2 bucket name | `wiamapp-assets` |
| `R2_PUBLIC_URL` | Public URL for serving files | Enable Public Dev URL on wiamapp-assets bucket → copy generated URL |
| `RESEND_API_KEY` | Email sending API key | resend.com → API Keys |
| `EMAIL_FROM` | Sender email address | `WiamApp <noreply@wiamapp.com>` |
| `EXPO_ACCESS_TOKEN` | For sending push notifications | expo.dev → Account Settings → Access Tokens |
| `APP_URL` | Frontend URL | `https://wiamapp.com` |
| `API_URL` | Backend URL | `https://wiamapp-backend.onrender.com` (your actual Render URL) |

### 1.2 WiamApp Mobile App Environment Variables (EAS Secrets)

These go into Expo EAS — NOT Render. These are used by the mobile app itself:

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_API_URL` | `https://wiamapp-backend.onrender.com` |
| `EXPO_PUBLIC_SUPABASE_URL` | Your WiamApp Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your WiamApp Supabase anon key |
| `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY` | Your Paystack public key |

### 1.3 Backend Verification Checklist

Before building the mobile app, confirm every core API endpoint works using Postman or any API testing tool:

- [ ] POST /api/auth/register — creates a new user and sends OTP email
- [ ] POST /api/auth/verify-otp — verifies OTP and returns JWT token
- [ ] POST /api/auth/login — returns valid JWT token
- [ ] POST /api/auth/forgot-password — sends reset email via Resend
- [ ] GET /api/workers — returns list of workers with correct data
- [ ] GET /api/workers/:id — returns single worker profile
- [ ] POST /api/bookings — creates a booking correctly
- [ ] PATCH /api/bookings/:id/accept — worker accepts booking
- [ ] PATCH /api/bookings/:id/complete — marks job as complete
- [ ] POST /api/payments/paystack/initiate — returns valid Paystack payment URL
- [ ] POST /api/webhooks/paystack — processes payment confirmation correctly
- [ ] POST /api/uploads/avatar — uploads photo to Cloudflare R2 correctly
- [ ] POST /api/uploads/portfolio — uploads portfolio photo to R2 correctly
- [ ] POST /api/uploads/id-document — uploads ID to R2 correctly
- [ ] POST /api/emergency — dispatches emergency to nearby workers
- [ ] GET /api/rankings — returns correct worker rankings
- [ ] POST /api/quotes — creates a quote request correctly
- [ ] GET /api/chat/:bookingId — returns chat messages correctly
- [ ] POST /api/safety/sos — triggers SOS alert correctly
- [ ] GET /api/notifications — returns notifications for user

**Do not build the mobile app until all of the above are confirmed working.**

---

## PHASE 2: SET UP EAS (EXPO APPLICATION SERVICES)

EAS is Expo's cloud build service. It builds your APK (Android) and IPA (iOS) files on Expo's cloud servers. Your laptop only needs to be on while submitting the build command — after that Expo's servers handle everything automatically.

### 2.1 Create an Expo Account
1. Go to expo.dev
2. Sign up or log in under the WiamLabs organization
3. Create a new project called `WiamApp`
4. Note your Project ID — you will need it for app.json

### 2.2 Install EAS CLI
Run this on the development machine:
```bash
npm install -g eas-cli
eas login
```

### 2.3 Initialize EAS in the Project
Inside the WiamAppExpo folder:
```bash
cd WiamAppExpo
eas init
```

### 2.4 Update app.json
Your app.json already exists and is mostly correct. Just update the projectId:
```json
{
  "expo": {
    "name": "WiamApp",
    "slug": "wiamapp",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#08081A"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.wiamlabs.wiamapp",
      "buildNumber": "1"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#08081A"
      },
      "package": "com.wiamlabs.wiamapp",
      "versionCode": 1
    },
    "extra": {
      "eas": {
        "projectId": "REPLACE_WITH_YOUR_ACTUAL_EAS_PROJECT_ID"
      }
    }
  }
}
```

### 2.5 Create eas.json
Create a new file called `eas.json` in the WiamAppExpo root folder:
```json
{
  "cli": {
    "version": ">= 10.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### 2.6 Add EAS Secrets
Add the mobile app environment variables to EAS so the app knows where your backend is:
```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value https://wiamapp-backend.onrender.com
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value YOUR_SUPABASE_URL
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR_SUPABASE_ANON_KEY
eas secret:create --scope project --name EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY --value YOUR_PAYSTACK_PUBLIC_KEY
```

Or add them directly in the Expo dashboard under your project → Secrets.

---

## PHASE 3: BUILD FOR INTERNAL TESTING

### 3.1 Build Android APK
Run this from inside the WiamAppExpo folder:
```bash
eas build --platform android --profile preview
```

- Build runs on Expo's cloud servers — your laptop can close after submitting the command
- Build takes approximately 10-20 minutes
- When complete, EAS sends you a download link for the APK file
- Download the APK and save it — this is what you share with Android testers

### 3.2 Build iOS for TestFlight
```bash
eas build --platform ios --profile preview
```

**Important:** iOS builds require an Apple Developer account ($99/year). If this is not yet active, prioritize Android testing first — APK distribution is completely free.

### 3.3 Submit iOS Build to TestFlight
```bash
eas submit --platform ios
```

This automatically uploads the iOS build to App Store Connect where you invite testers via TestFlight.

---

## PHASE 4: DISTRIBUTE TO TESTERS (WORKS ANYWHERE IN GHANA OR THE WORLD)

### 4.1 Android Distribution — Share APK Remotely

**Step 1:** Upload the APK file to Google Drive
**Step 2:** Copy the shareable download link
**Step 3:** Send the link to testers via WhatsApp, email, or any messaging app
**Step 4:** Testers do this on their Android phone:
  - Go to Settings → Security or Privacy
  - Enable "Install from unknown sources" or "Allow from this source"
  - Open the download link → download the APK → tap to install
  - Done — WiamApp is installed and ready

**No Play Store needed. No developer account needed. Works for anyone anywhere.**

### 4.2 iOS Distribution via TestFlight — Invite Remotely

**Step 1:** Go to appstoreconnect.apple.com
**Step 2:** Find your WiamApp → TestFlight tab
**Step 3:** Click "Add Testers" → enter each tester's Apple ID email address
**Step 4:** Apple sends each tester an email invitation automatically
**Step 5:** Tester downloads the free TestFlight app from the App Store
**Step 6:** Opens TestFlight → accepts the invitation → installs WiamApp

**Works for testers anywhere in the world — you never need to meet them in person.**

### 4.3 Tester Limits
- Android APK — unlimited testers, share with anyone
- iOS TestFlight — up to 10,000 external testers for free

### 4.4 When You Release an Update
Every time you fix something and want testers to get the update:
1. Push the new code to GitHub (Render auto-deploys the backend instantly)
2. Run `eas build --platform android --profile preview` for a new APK
3. Share the new APK download link with Android testers
4. For iOS — EAS submit again, TestFlight updates automatically for testers

---

## PHASE 5: WORKER WEB REGISTRATION (BEFORE APP IS ON STORES)

Workers do not need the app installed to register. They can sign up through the web portal today, and their account will be fully ready when the app launches.

### 5.1 What to Build
Create a dedicated mobile-optimised worker registration page at:
`app.wiamapp.com/register/worker`

The page must allow workers to:
- Enter full name, phone number, email, and password
- Select their city and service category (from your 12 categories)
- Upload their ID photo directly from their phone camera
- Set their hourly rate and write a short bio
- Submit for admin verification

### 5.2 How it Works End to End
1. Worker clicks the registration link on their phone browser — no download needed
2. Fills in their details and uploads ID through the browser
3. Account is created in Supabase immediately
4. Admin approves their verification through the admin panel
5. Worker is now fully in the system — verified, profile complete
6. When the app launches on stores, worker downloads it and logs in with the same email and password they created on the web
7. Everything is already there — profile, verified badge, categories, portfolio — nothing to redo

### 5.3 Where to Recruit Workers Right Now
- Post the registration link in WhatsApp groups for artisans in Accra (electricians, plumbers, cleaners, carpenters)
- Post in Facebook groups: "Accra Artisans," "Ghana Electricians Network," "Cleaners in Accra," "Handymen Ghana"
- Visit NVTI (National Vocational Training Institute) campuses — talk to instructors and recent graduates
- Create a QR code for the registration link and print on simple A5 flyers to hand out in person
- Visit Abossey Okai (car/auto workers) and trade areas where artisans gather

### 5.4 Founding Worker Benefit — Use This to Convince Them
Tell the first 100 workers who register and complete verification:
- 3 months of Pro subscription completely free (worth GHS 240 in real value)
- A permanent "Founding Member" badge on their profile that no later worker can ever get
- Priority placement in search results during the entire beta testing period
- Direct access to Martin (Founder) for feedback and support

**Target: 50 verified workers in Accra before releasing to the public.**

---

## PHASE 6: COMPLETE TESTING CHECKLIST

The founder and development team must personally test every flow below on both an Android phone and an iPhone before releasing to external testers.

### Authentication
- [ ] Register as a new customer — OTP email arrives correctly
- [ ] Register as a new worker — OTP email arrives correctly
- [ ] Login as customer with correct credentials
- [ ] Login as worker with correct credentials
- [ ] Wrong password shows correct error message
- [ ] Forgot password email arrives and reset works
- [ ] Logout clears session completely

### Worker Verification Flow
- [ ] Worker can upload ID document photo from phone camera
- [ ] Worker can take verification selfie
- [ ] ID and selfie upload correctly to Cloudflare R2
- [ ] Admin receives notification of pending verification
- [ ] Admin can approve or reject from admin panel
- [ ] Worker receives push notification when verified
- [ ] Verified badge appears correctly on worker profile

### Customer Booking Flow
- [ ] Customer can browse workers by all 12 categories
- [ ] Search returns correct results
- [ ] Worker profile shows correct information, portfolio, and reviews
- [ ] Customer can book a worker with date, time, location, and description
- [ ] Worker receives push notification of new booking
- [ ] Worker can accept the booking
- [ ] Worker can decline the booking with a reason
- [ ] Customer receives push notification of acceptance or decline

### Payment Flow
- [ ] Customer initiates Paystack payment for a booking
- [ ] Paystack payment page opens correctly in WebView
- [ ] Payment completes and webhook fires correctly
- [ ] Payment is held in escrow correctly
- [ ] Worker sees booking as paid and confirmed
- [ ] Worker marks job as complete
- [ ] Customer receives notification to confirm completion
- [ ] Customer confirms — payment releases to worker automatically
- [ ] Both parties receive payment confirmation notification
- [ ] Earnings appear correctly on worker dashboard

### Dispute Flow
- [ ] Customer can raise a dispute before confirming completion
- [ ] Admin receives dispute notification
- [ ] Admin reviews and makes a decision
- [ ] Escrow releases or refunds based on admin decision
- [ ] Both parties notified of outcome

### Emergency Mode
- [ ] Customer can activate emergency mode
- [ ] Emergency correctly targets the right category
- [ ] Nearby available workers in that category receive the request
- [ ] First worker to accept gets the job
- [ ] 20% emergency premium applied correctly to the price
- [ ] Both parties notified immediately

### Chat
- [ ] Customer and worker can message each other after booking is confirmed
- [ ] Messages appear in real time for both parties
- [ ] Push notification received when new message arrives
- [ ] Read receipts show correctly
- [ ] Chat history persists when app is closed and reopened

### Quotes
- [ ] Customer can request a custom quote from a worker
- [ ] Worker receives quote request notification
- [ ] Worker responds with a price
- [ ] Customer receives quote response notification
- [ ] Customer can accept or decline the quote
- [ ] Accepted quote converts to a confirmed booking correctly

### Safety / SOS
- [ ] SOS button is visible during an active booking for both customer and worker
- [ ] Triggering SOS sends alert to admin correctly
- [ ] Emergency contacts are notified
- [ ] SOS event logged correctly in database

### Worker Dashboard
- [ ] Stats show correct numbers (total jobs, earnings, rating, response rate)
- [ ] Worker can toggle availability on/off
- [ ] Worker can update bio, hourly rate, and profile photo
- [ ] Worker can add and delete portfolio photos
- [ ] Worker can create a Spotlight post
- [ ] Spotlight post appears on customer home screen
- [ ] Worker can view their ranking by city and category
- [ ] Availability calendar works correctly

### Subscription
- [ ] Worker can view all three subscription tiers (Free, Basic, Pro)
- [ ] Subscription purchase via Paystack works correctly
- [ ] Commission rate updates correctly after subscription changes
- [ ] Pro worker appears higher in search results than Free worker
- [ ] Subscription expiry handled correctly — worker notified before expiry

### Business Features
- [ ] Business can register and apply for Business account
- [ ] Business dashboard shows correct overview stats
- [ ] Business can add and manage team members
- [ ] Business can assign bookings to specific team members
- [ ] Consolidated invoicing generates correctly
- [ ] Recurring contracts create correctly

### Notifications
- [ ] Push notifications arrive when app is closed (background)
- [ ] Push notifications arrive when app is open (foreground)
- [ ] Tapping notification opens the correct screen in the app
- [ ] Notification badge count shows correctly on app icon
- [ ] All notifications marked as read correctly

---

## PHASE 7: PUBLISHING TO STORES (FUTURE — AFTER TESTING IS COMPLETE)

Do not publish to stores until the testing phase is fully complete and the core booking loop works reliably without any critical bugs.

### Google Play Store
```bash
# Build production AAB (Android App Bundle — required for Play Store)
eas build --platform android --profile production
```

Steps:
1. Create Google Play Developer account ($25 one-time fee) at play.google.com/console
2. Create new app → fill in store listing
3. Upload AAB file to the Production track
4. Complete content rating questionnaire
5. Set up pricing (free app)
6. Submit for review — typically 1-3 days

### Apple App Store
```bash
# Build production IPA
eas build --platform ios --profile production

# Submit to App Store Connect
eas submit --platform ios
```

Steps:
1. Apple Developer account required ($99/year) at developer.apple.com
2. Create app in App Store Connect
3. Complete store listing, screenshots, description
4. Submit for App Store Review — typically 1-7 days

### Required Before Submitting to Either Store
- [ ] Privacy Policy page is live at a public URL (e.g. wiamapp.com/privacy)
- [ ] Terms of Service page is live at a public URL (e.g. wiamapp.com/terms)
- [ ] Data deletion option exists inside the app (required by both stores)
- [ ] App does not crash on any tested device
- [ ] All test/placeholder content removed from the app
- [ ] App icon is final — 1024x1024px PNG, no transparency
- [ ] Splash screen is final
- [ ] Screenshots prepared for required device sizes
- [ ] App description written (short and long versions)
- [ ] Age rating completed
- [ ] All permissions have clear usage descriptions (camera, location, notifications, microphone, Face ID) — these are already in your app.json ✅

---

## HOW THE SYSTEM WORKS TOGETHER (FOR THE DEVELOPER)

```
TESTER'S PHONE
     ↓  (HTTP requests)
RENDER (WiamApp Backend — Express.js)
     ↓  (database queries)
SUPABASE (PostgreSQL database)
     ↓  (file storage)
CLOUDFLARE R2 (photos, IDs, portfolios)
     ↓  (payments)
PAYSTACK (GHS + NGN payment processing)
     ↓  (emails)
RESEND (OTP, booking confirmations, receipts)
     ↓  (push notifications)
EXPO PUSH NOTIFICATION SERVICE
```

**Your laptop is only needed when:**
- Writing new code
- Running `eas build` to generate a new APK/IPA
- Pushing updates to GitHub

**Everything else runs 24/7 without you:**
- Render hosts and runs the backend API
- Supabase stores all data
- Cloudflare R2 stores all files
- Testers can use the app at 3am while you are sleeping

---

## IMPORTANT NOTES FOR THE DEVELOPER

1. WiamApp and WiamPass are two completely separate projects with separate Render services, separate Supabase projects, separate Cloudflare R2 buckets, and separate env vars. Never mix their environment variables.

2. Never put real API keys or secrets in the codebase or in GitHub. All secrets go in Render environment variables (for the backend) and EAS Secrets (for the mobile app).

3. Every code change to the backend: push to GitHub → Render auto-deploys in 2-3 minutes.

4. Every code change to the mobile app: push to GitHub → run `eas build` → share new APK link with testers.

5. Keep a changelog every time you send a new APK to testers. They need to know what changed and what to test in each version.

6. Test on real physical devices — not emulators. Paystack payments, camera for ID upload, push notifications, and GPS for nearby workers all behave differently on real devices.

7. iOS requires an Apple Developer account for TestFlight. If not yet active, focus on Android testing first.

---

*This document should be reviewed and updated by the development team as the project progresses.*
*© 2026 WiamApp. Powered by WiamLabs.*

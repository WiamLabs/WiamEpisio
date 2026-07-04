\#  
████████████████████████████████████████████████████████████  
\# WIAMAPP — MASTER PLAN V4 FINAL  
\# The Complete Strict End-to-End Blueprint — Now With Global Multi-Country Architecture  
\# © 2026 WiamApp. Powered by WiamLabs  
\# Founder: Martin | wiamapp.com  
\# Version: 4.0 FINAL STRICT — Updated: June 2026 — Merged V3 + Extension Pack  
\# ████████████████████████████████████████████████████████████

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MANDATORY READING ORDER FOR ALL AI TOOLS AND DEVELOPERS:

1\. Read this entire document before writing ONE line of code  
2\. Never skip any section  
3\. If something is unclear — ask before building  
4\. Every decision references this document  
5\. No feature is added that is not in this plan  
6\. No feature is removed that is in this plan  
7\. Cursor, Windsurf, Claude — all follow this STRICTLY

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

═══════════════════════════════════════════════════════════════  
SECTION 0 — HOW TO READ THIS PLAN  
═══════════════════════════════════════════════════════════════

This document uses the following format:

\[DB\]      \= This decision affects the Supabase database  
\[BACKEND\] \= This decision affects the Render Node.js server  
\[MOBILE\]  \= This decision affects the Expo React Native app  
\[WEBSITE\] \= This decision affects the wiamapp.com Next.js site  
\[ALL\]     \= This decision affects all layers

When you see \[DB→BACKEND→MOBILE\] it means:  
The data starts in the database,  
goes through the backend API,  
and arrives at the mobile screen.

Every important data flow in this plan is written exactly like that.  
No connection is left undefined.  
No endpoint is left undocumented.  
No screen is left without knowing where its data comes from.

This is the rule: If the data flow is not written in this plan,  
it does not get built. Period.

═══════════════════════════════════════════════════════════════  
SECTION 1 — VISION AND IDENTITY  
═══════════════════════════════════════════════════════════════

WHAT WIAMAPP IS:  
WiamApp is Africa's most trusted digital service marketplace.  
It connects customers who need skilled workers with verified  
professionals ready to work in real time in their city.

WHAT WIAMAPP IS NOT:  
\- Not a social media platform  
\- Not an entertainment app  
\- Not a messaging-only app  
\- Not a job board (workers do not apply — customers book them)

THE TWO PROBLEMS SOLVED:  
For Customers: Cannot find reliable, verified workers quickly  
For Workers: Cannot find consistent customers and build formal reputation

COMPANY: WiamLabs  
PRODUCT: WiamApp  
DOMAIN: wiamapp.com  
API: api.wiamapp.com  
TEAM OPS: app.wiamlabs.com (WiamLabs internal — NOT on wiamapp.com)  
GITHUB: github.com/WiamLabs/WiamApp (Private)  
COPYRIGHT: © 2026 WiamApp. Powered by WiamLabs

BRAND COLORS — THE ABSOLUTE LAW:  
Navy:        \#08081A  — dark backgrounds, worker screens  
Gold:        \#D4A017  — ALL buttons — NEVER changes between themes  
White:       \#FFFFFF  — light mode backgrounds  
Online:      \#22C55E  — green dot for active users  
Success:     \#22C55E  — confirmed, approved, done  
Error:       \#EF4444  — rejected, failed, danger  
Warning:     \#F59E0B  — pending, under review  
Info Blue:   \#3B82F6  — Blue badge color

ABSOLUTE COLOR RULES:  
1\. Gold (\#D4A017) buttons stay gold in BOTH light and dark mode  
2\. Worker screens always use Navy background — no exceptions  
3\. Customer screens default to White  
4\. NEVER hardcode any color — always import from constants/colors.js  
5\. Every screen file starts with: // © 2026 WiamApp. Powered by WiamLabs

═══════════════════════════════════════════════════════════════  
SECTION 2 — COMPLETE SYSTEM ARCHITECTURE  
═══════════════════════════════════════════════════════════════

This is how every part of WiamApp connects:

┌─────────────────────────────────────────────────────────┐  
│                    WIAMAPP SYSTEM                       │  
│                                                         │  
│  ┌─────────────┐        ┌──────────────────────────┐   │  
│  │  EXPO APP   │◄──────►│  RENDER BACKEND           │   │  
│  │ (iOS/Android│        │  api.wiamapp.com          │   │  
│  │  React Native│       │  Node.js \+ Express V3     │   │  
│  └──────┬──────┘        └──────────┬───────────────┘   │  
│         │                          │                     │  
│         │                    ┌─────▼──────┐             │  
│         │                    │  SUPABASE  │             │  
│         └───────────────────►│  PostgreSQL│             │  
│         (Auth \+ Realtime)    │  Auth      │             │  
│                              │  Realtime  │             │  
│                              └─────┬──────┘             │  
│                                    │                     │  
│  ┌──────────────┐         ┌────────▼───────┐           │  
│  │ WIAMAPP.COM  │         │ CLOUDFLARE R2  │           │  
│  │ Next.js Site │◄───────►│ File Storage   │           │  
│  │ Cloudflare   │         │ Public+Private │           │  
│  └──────────────┘         └────────────────┘           │  
│                                                         │  
│  ┌──────────────┐   ┌──────────┐   ┌────────────────┐  │  
│  │  REVENUECAT  │   │  RESEND  │   │    PAYSTACK    │  │  
│  │  In-App Subs │   │  Emails  │   │  Payments      │  │  
│  └──────────────┘   └──────────┘   └────────────────┘  │  
└─────────────────────────────────────────────────────────┘

DATA FLOW RULES — STRICT:

Rule 1: Mobile app NEVER calls Supabase directly for protected data  
        Mobile app → Backend API → Supabase (via service role key)  
        Exception: Auth signin/signup and Realtime subscriptions only

Rule 2: Mobile app calls Supabase directly ONLY for:  
        \- supabase.auth.signIn / signUp / signOut  
        \- supabase.channel().on() for realtime (messages, notifications)  
        \- Public reads with RLS protection (worker profiles, categories)

Rule 3: Sensitive operations ALWAYS go through backend:  
        \- File uploads → Backend → R2  
        \- Payments → Backend → Paystack  
        \- Subscriptions → RevenueCat → Webhook → Backend → Supabase  
        \- Document signing → Backend → R2 (15 min expiry)  
        \- Admin actions → Backend → Supabase (service role)

Rule 4: Every backend route validates JWT before processing  
        No exception. No route bypasses auth without explicit reason.

Rule 5: Every database change is written as a migration file  
        Never change the database manually without a migration file  
        Migrations numbered sequentially: 001, 002, 003...

Rule 6: All money stored as USD decimal in database  
        Display layer converts to local currency using exchange rates  
        The subscription\_config table controls all prices  
        Prices are changeable from admin dashboard — never hardcoded

═══════════════════════════════════════════════════════════════  
SECTION 3 — ALL APIS NEEDED (WHERE TO GET EACH)  
═══════════════════════════════════════════════════════════════

Every API used in WiamApp is listed here with where to get it  
and exactly where in the project it is used.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

API 1: SUPABASE  
Get at: supabase.com → Your Project → Settings → API  
Keys needed:  
  SUPABASE\_URL              → .env AND Render environment  
  SUPABASE\_ANON\_KEY         → .env only (mobile app and website)  
  SUPABASE\_SECRET\_KEY       → Render environment ONLY (never in app)  
Used in:  
  Mobile app: lib/supabase.js (anon key only)  
  Backend: backend/lib/supabaseAdmin.js (secret key)  
  Website: supabase client (anon key only)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

API 2: CLOUDFLARE R2  
Get at: dash.cloudflare.com → R2 → Create Token  
Keys needed:  
  CLOUDFLARE\_R2\_ENDPOINT          → Render environment  
  CLOUDFLARE\_R2\_ACCESS\_KEY\_ID     → Render environment  
  CLOUDFLARE\_R2\_SECRET\_ACCESS\_KEY → Render environment  
  CLOUDFLARE\_R2\_BUCKET\_NAME       → Render environment  
  CLOUDFLARE\_R2\_PUBLIC\_URL        → .env AND Render environment  
Two buckets needed:  
  wiamapp-public  → avatars, portfolios, voice, spotlight media  
  wiamapp-private → ID documents, selfies (signed URLs only)  
Used in:  
  Backend: backend/lib/r2Client.js

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

API 3: RESEND  
Get at: resend.com → API Keys → Create Key  
Keys needed:  
  RESEND\_API\_KEY → Render environment ONLY  
Used in:  
  Backend: backend/lib/resend.js  
  Triggers: OTP emails, approval/rejection emails, booking emails

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

API 4: PAYSTACK  
Get at: dashboard.paystack.com → Settings → API Keys  
Keys needed:  
  PAYSTACK\_SECRET\_KEY     → Render environment ONLY (backend)  
  PAYSTACK\_PUBLIC\_KEY     → Website (Paystack.js, public key is safe)  
Used in:  
  Backend: backend/routes/payments.js (booking payments)  
  Website: Paystack checkout (subscription payments)  
  NOT in mobile app — booking payment opens Paystack WebView

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

API 5: REVENUECAT  
Get at: revenuecat.com → Project → API Keys  
Keys needed:  
  EXPO\_PUBLIC\_REVENUECAT\_IOS\_KEY     → .env (safe for mobile)  
  EXPO\_PUBLIC\_REVENUECAT\_ANDROID\_KEY → .env (safe for mobile)  
  REVENUECAT\_WEBHOOK\_SECRET          → Render environment ONLY  
Used in:  
  Mobile app: lib/api/revenuecat.js (purchase subscriptions)  
  Backend: backend/routes/webhooks.js (receive purchase events)  
Products to create in App Store Connect AND Google Play Console:  
  com.wiamlabs.wiamapp.basic\_monthly    — $2.50/month  
  com.wiamlabs.wiamapp.pro\_monthly      — $7.00/month  
  com.wiamlabs.wiamapp.spotlight\_standard — $1.50 consumable  
  com.wiamlabs.wiamapp.spotlight\_featured — $3.00 consumable  
  com.wiamlabs.wiamapp.spotlight\_premium  — $6.00 consumable  
  com.wiamlabs.wiamapp.spotlight\_business — $13.00 consumable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

API 6: OPEN EXCHANGE RATES  
Get at: openexchangerates.org → Dashboard → App ID  
Keys needed:  
  OPEN\_EXCHANGE\_RATES\_APP\_ID → Render environment  
Free tier: 1,000 requests/month (daily fetch \= 30/month)  
Used in:  
  Backend: backend/lib/exchangeRates.js  
  Converts USD prices to GHS, NGN, etc. for display

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

API 7: EXPO PUSH NOTIFICATIONS  
Get at: No account needed — built into Expo  
Keys needed: None — handled by Expo automatically  
Used in:  
  Mobile app: expo-notifications package  
  Backend: backend/lib/pushNotifications.js  
  Workers and customers receive push alerts for all booking events

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

API 8: SMILE IDENTITY (Phase 2 only — not MVP)  
Get at: portal.smileidentity.com  
Keys needed:  
  SMILE\_IDENTITY\_PARTNER\_ID → Render environment  
  SMILE\_IDENTITY\_API\_KEY    → Render environment  
  SMILE\_IDENTITY\_ENV        → sandbox (testing) or production  
For MVP: Manual admin document review replaces this  
Add in Phase 2 when revenue allows (\~$0.70 per worker verification)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

API 9: WIAMID (Internal — no external API)  
This is our own system built in backend/routes/team.js  
No third-party service needed  
All team authentication handled internally

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMPLETE .env FILE FOR MOBILE APP:  
(Put in WiamAppExpo/.env — NEVER in GitHub)

EXPO\_PUBLIC\_SUPABASE\_URL=https://your-project.supabase.co  
EXPO\_PUBLIC\_SUPABASE\_ANON\_KEY=your-anon-key  
EXPO\_PUBLIC\_BACKEND\_URL=https://api.wiamapp.com  
EXPO\_PUBLIC\_REVENUECAT\_IOS\_KEY=appl\_xxxxx  
EXPO\_PUBLIC\_REVENUECAT\_ANDROID\_KEY=goog\_xxxxx  
EXPO\_PUBLIC\_CLOUDINARY\_CLOUD\_NAME=your-cloud-name  
EXPO\_PUBLIC\_CLOUDINARY\_UPLOAD\_PRESET=wiamapp\_unsigned  
EXPO\_PUBLIC\_APP\_ENV=development  
EXPO\_PUBLIC\_DEFAULT\_COUNTRY=Ghana  
EXPO\_PUBLIC\_DEFAULT\_CURRENCY=GHS

COMPLETE RENDER ENVIRONMENT VARIABLES:  
(Put in Render → Your Service → Environment)

SUPABASE\_URL=https://your-project.supabase.co  
SUPABASE\_SECRET\_KEY=your-service-role-key  
CLOUDFLARE\_R2\_ENDPOINT=https://accountid.r2.cloudflarestorage.com  
CLOUDFLARE\_R2\_ACCESS\_KEY\_ID=your-r2-access-key  
CLOUDFLARE\_R2\_SECRET\_ACCESS\_KEY=your-r2-secret  
CLOUDFLARE\_R2\_BUCKET\_NAME=wiamapp  
CLOUDFLARE\_R2\_PUBLIC\_URL=https://pub-xxx.r2.dev  
RESEND\_API\_KEY=re\_xxxxx  
PAYSTACK\_SECRET\_KEY=sk\_live\_xxxxx  
REVENUECAT\_WEBHOOK\_SECRET=your-webhook-secret  
OPEN\_EXCHANGE\_RATES\_APP\_ID=your-app-id  
WIAMID\_SALT=a-very-long-random-secret-string-for-code-hashing  
SMILE\_IDENTITY\_PARTNER\_ID=add-in-phase-2  
SMILE\_IDENTITY\_API\_KEY=add-in-phase-2  
SMILE\_IDENTITY\_ENV=sandbox  
NODE\_ENV=production  
PORT=3000

═══════════════════════════════════════════════════════════════
SECTION 3B — PLATFORM ARCHITECTURE AND WHO USES WHAT
(NEW IN V3 JUNE 2026 UPDATE)
═══════════════════════════════════════════════════════════════

THIS IS THE MASTER SEPARATION RULE.
Every developer and AI tool must read this before building anything.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THREE INTERFACES — ONE BACKEND — ONE DATABASE:

INTERFACE 1 — EXPO MOBILE APP (iOS + Android)
Used by: Customers, Individual Workers, Business accounts (field use)
Submitted to: Apple App Store + Google Play Store
All core features live here: booking, payment, chat, GPS, verification

INTERFACE 2 — WIAMAPP.COM WEBSITE (Next.js)
Public pages: marketing, browse workers, download links, careers, terms, privacy
Business portal: wiamapp.com/business/* (Starter, Growth, Enterprise)
Used by: Business account owners and managers — on laptop and desktop computer

INTERFACE 3 — APP.WIAMLABS.COM (Next.js — separate Vercel deployment)
Used by: WiamLabs internal team members ONLY (Team WiamLabs — product ops for WiamApp)
Login: app.wiamlabs.com/team (WiaMid code)
Founder: app.wiamlabs.com/founder
Never accessible to customers, workers, or business accounts
WHY wiamlabs.com: Staff answer "I work at WiamLabs." Internal tools live on the company domain, not the product domain.

ALL THREE share: api.wiamapp.com (same backend) + Supabase (same database)
One backend. One database. Three interfaces.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHO USES WHAT — THE ABSOLUTE RULE:

CUSTOMERS:
- Expo mobile app ONLY
- No web dashboard. No wiamapp.com login.
- Browse, book, pay, review — all on mobile only

INDIVIDUAL WORKERS (Free, Basic, Pro):
- Expo mobile app ONLY
- No web dashboard. No wiamapp.com login.
- Receive jobs, check in, get paid — all on mobile only

BUSINESS ACCOUNTS (Starter, Growth, Enterprise):
- Expo mobile app (field work, quick bookings, on the move)
- wiamapp.com/business/* (office work, analytics, team management, laptop)
- BOTH platforms. Same account. Same data. Always in sync.
- Login URL: wiamapp.com/business/login
- They NEVER see app.wiamlabs.com (WiamLabs team ops)

WIAMLABS INTERNAL TEAM (Team WiamLabs):
- app.wiamlabs.com ONLY for WiamApp platform ops
- Never use Expo app for their work
- Never access wiamapp.com/business/* (business portal)
- They can view user data for support — through their own team tools only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THE SEPARATION RULE — NON-NEGOTIABLE:

Business portal: wiamapp.com/business/*        (product domain — paying business clients)
WiamApp team ops: app.wiamlabs.com/*           (company domain — WiamLabs staff only)

These are TWO DIFFERENT DOMAINS.
Two different login systems.
Two different sets of data shown.
A business account user can NEVER reach app.wiamlabs.com.
A team member can NEVER reach wiamapp.com/business/*.
This is enforced at the backend level on every single request.
Not just in the UI. In the backend auth middleware. Always.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WEBVIEW RULE INSIDE EXPO — CRITICAL FOR APP STORE APPROVAL:

WebView is ALLOWED inside Expo ONLY for these content pages:
- Terms of Service
- Privacy Policy
- Help Center articles
- Careers page (wiamapp.com/careers)

WebView is FORBIDDEN inside Expo for:
- Booking flow
- Payment
- Chat
- Verification
- Any dashboard
- Any form that submits user data

REASON: Apple App Store and Google Play WILL REJECT an app
that wraps its core product in a WebView.
Core features must always be real native Expo screens.
Content-only pages in WebView are acceptable and approved.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BUILD ORDER — FOLLOW THIS EXACTLY:

PHASE 1 (Now):
Expo mobile app — all screens from Section 21

PHASE 2 (After mobile is stable):
wiamapp.com public pages — Home, Browse, Premium, Careers, Terms, Privacy

PHASE 3 (After first business clients):
wiamapp.com/business/* — Business web dashboard (all three tiers)
app.wiamlabs.com — WiamLabs internal WiamApp ops dashboard

PHASE 4 (Year 2):
Enterprise API access
Full analytics for all business tiers
Worker public profiles indexed by Google (SEO + free app installs)

DO NOT BUILD React Native Web.
It produces ugly UI on desktop — looks like a phone squashed into a browser.
Business owners on laptops deserve real web UI.
The correct approach is Next.js for web, Expo for mobile. No compromise.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


═══════════════════════════════════════════════════════════════
SECTION 3C — GLOBAL EXPANSION AND MULTI-COUNTRY ARCHITECTURE
═══════════════════════════════════════════════════════════════

WHY THIS SECTION EXISTS:

WiamApp launches in Ghana only. But every architectural decision
made today must already support Nigeria, Kenya, South Africa, and
eventually any country in the world — without a single rebuild.
This section is the law for how that happens.

THE CORE RULE:

WiamApp is not "the Ghana app." WiamApp is one global system with
a country switch. Ghana is simply the first country turned ON.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THE COUNTRY TABLE — THE SINGLE SOURCE OF TRUTH:

DATABASE TABLE: countries

CREATE TABLE countries (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name                VARCHAR(100) NOT NULL UNIQUE,
  iso_code            VARCHAR(5) NOT NULL UNIQUE,        -- GH, NG, KE, ZA
  flag_emoji          VARCHAR(10),
  phone_code          VARCHAR(10) NOT NULL,              -- +233, +234
  currency_code       VARCHAR(10) NOT NULL,              -- GHS, NGN, KES
  currency_symbol     VARCHAR(10),
  is_active           BOOLEAN DEFAULT FALSE,             -- master ON/OFF switch
  is_accepting_workers BOOLEAN DEFAULT FALSE,
  is_accepting_customers BOOLEAN DEFAULT FALSE,
  is_accepting_business BOOLEAN DEFAULT FALSE,
  payment_provider    VARCHAR(50) DEFAULT 'paystack',    -- paystack, flutterwave, stripe
  id_document_types   JSONB,                              -- country-specific ID list
  launch_date         DATE,
  timezone            VARCHAR(50) DEFAULT 'Africa/Accra',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO countries (name, iso_code, flag_emoji, phone_code, currency_code,
  currency_symbol, is_active, is_accepting_workers, is_accepting_customers,
  is_accepting_business, payment_provider, launch_date) VALUES
  ('Ghana', 'GH', '🇬🇭', '+233', 'GHS', 'GH₵', TRUE,  TRUE,  TRUE,  TRUE,  'paystack',     '2026-06-01'),
  ('Nigeria', 'NG', '🇳🇬', '+234', 'NGN', '₦',   FALSE, FALSE, FALSE, FALSE, 'paystack',     NULL),
  ('Kenya', 'KE', '🇰🇪', '+254', 'KES', 'KSh', FALSE, FALSE, FALSE, FALSE, 'flutterwave',  NULL),
  ('South Africa', 'ZA', '🇿🇦', '+27', 'ZAR', 'R',   FALSE, FALSE, FALSE, FALSE, 'flutterwave',  NULL);

RULE: Only Ghana has is_active = TRUE at launch.
RULE: Every other country sits in the table, fully modeled, switched OFF.
RULE: Turning on a new country is a database update, never a code deploy.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EVERY EXISTING TABLE GETS A country_id COLUMN:

This is the single most important rule in this entire extension.
Every table that holds a user, a booking, a worker profile, a
business, a job posting, or any location-bound record must carry
country_id from day one — even while only Ghana exists.

ALTER TABLE users              ADD COLUMN country_id UUID REFERENCES countries(id);
ALTER TABLE worker_profiles    ADD COLUMN country_id UUID REFERENCES countries(id);
ALTER TABLE business_profiles  ADD COLUMN country_id UUID REFERENCES countries(id);
ALTER TABLE bookings           ADD COLUMN country_id UUID REFERENCES countries(id);
ALTER TABLE categories         ADD COLUMN country_id UUID REFERENCES countries(id);
                                -- NULL country_id on categories means "global category"
ALTER TABLE job_postings       ADD COLUMN country_id UUID REFERENCES countries(id);
ALTER TABLE subscription_config ADD COLUMN country_id UUID REFERENCES countries(id);
                                -- NULL means "uses the default USD price"

WHY THIS MATTERS NOW, NOT LATER:
Retrofitting country_id onto a live production table with millions
of rows is dangerous and slow. Adding it as an unused, defaulted
column today costs nothing and removes that risk completely.

EVERY backend query that lists workers, bookings, or businesses
MUST filter by country_id even when only one country exists.
This is not optional scaffolding — it is the query pattern from
day one, so Nigeria activation never requires touching this logic.

Example — the existing worker search query from Section 18 becomes:

GET /api/workers?country=GH&city=Accra&limit=20

Backend:
  const country = await getCountryByCode(req.query.country);
  const workers = await supabaseAdmin
    .from('worker_profiles')
    .select('*')
    .eq('country_id', country.id)
    .eq('location_city', req.query.city);

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HOW A NEW USER PICKS THEIR COUNTRY:

RegisterScreen detects the device's country automatically via
expo-localization, then shows it as a pre-selected dropdown the
user can change. The dropdown only lists countries where
is_active = TRUE — a user physically cannot register into a
country that has not launched yet.

If a user's device country is not yet active (e.g. someone in
Lagos opens the app before Nigeria launches), the app shows a
WAITLIST screen instead of the normal registration form:

  "WiamApp is not in Nigeria yet."
  "Join the waitlist — we will email you the moment we launch."
  [Email input] [Join Waitlist]

DATABASE TABLE: country_waitlist

CREATE TABLE country_waitlist (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  country_iso VARCHAR(5) NOT NULL,
  city        VARCHAR(100),
  role_interest VARCHAR(20) CHECK (role_interest IN ('customer','worker','business')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

This single table becomes the founder's most valuable expansion
signal — it shows exactly which country and which city to launch
next, backed by real demand, not guesswork.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THE FOUNDER DASHBOARD COUNTRY SWITCH:

Location: app.wiamlabs.com/founder → "Countries" tab
(Extends the Founder Super Powers list already defined in V3_FINAL
Section 17 — "Change subscription prices in USD" becomes one entry
in a longer Countries control panel.)

FOUNDER DASHBOARD — COUNTRIES PANEL SHOWS:

For every row in the countries table:
  - Country name, flag, ISO code
  - Toggle: is_active (master switch)
  - Toggle: is_accepting_workers
  - Toggle: is_accepting_customers
  - Toggle: is_accepting_business
  - Payment provider dropdown (paystack / flutterwave / stripe)
  - Live stats once active: total users, total bookings, total revenue (USD)
  - Waitlist count (from country_waitlist) for inactive countries
  - "Launch This Country" button — only enabled once:
      a) At least one local payment provider is connected and tested
      b) At least one ID document type is configured
      c) Categories have been seeded for that country
      d) A local admin/support contact has been assigned

LAUNCHING A NEW COUNTRY — THE EXACT SEQUENCE
[FOUNDER_DASHBOARD→BACKEND→DB]:

1. Founder opens Countries panel, selects Nigeria
2. Founder configures: phone_code, currency_code, payment_provider
3. Founder uploads/configures Nigeria's id_document_types JSON:
   ["nin_card","drivers_license","international_passport","voters_card"]
4. Founder runs the category seed for Nigeria (reuses the same 12
   global categories from V3_FINAL Section 7 — categories are
   universal, only their country_id link changes)
5. Founder flips is_active = TRUE
6. Backend automatically:
   - Sends "We're live!" email to everyone in country_waitlist
     where country_iso = 'NG'
   - Makes Nigeria selectable in RegisterScreen's country dropdown
   - Activates Nigeria pricing in subscription_config (Section 5B
     below covers local pricing rules)
7. No app store update required. No code deploy required.
   This is a pure database and admin-dashboard operation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CROSS-BORDER RULE — WHAT DOES NOT HAPPEN:

A worker in Ghana cannot appear in Nigeria search results and
vice versa. Country is a hard boundary for discovery and booking.

EXCEPTION: The Job Board (Section 17B) intentionally allows a
business in one country to post a position visible to workers
in the SAME country only — village-to-city movement is supported,
country-to-country labor migration is explicitly Phase 2+ and
requires its own legal/compliance review before being enabled.
This is a deliberate launch-scope boundary, not a technical one.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LANGUAGE — PREPARED BUT NOT BUILT AT LAUNCH:

All user-facing strings in the Expo app and wiamapp.com must be
written in plain English with no hardcoded text spread across
component files in a way that blocks future translation. Full i18n
(react-i18next or expo-localization string tables) is a Phase 3
project once a second country is live and a local language
(Pidgin English, Swahili, French) becomes commercially necessary.
For now: write clean, simple English. Do not block the future.


═══════════════════════════════════════════════════════════════  
SECTION 4 — USER TYPES AND ACCOUNT SYSTEM  
═══════════════════════════════════════════════════════════════

FIVE USER TYPES:

TYPE 1 — CUSTOMER  
\- Browses app freely without verification  
\- Must verify identity before first booking  
\- Monthly selfie re-verification (30 seconds)  
\- Full ID re-verification every 6 months  
\- Can Trust workers (see Section 8\)  
\- Can save favorite workers (Saved Workers list)  
\- No subscription required — free forever  
\- Sees customer rating from workers after each job

TYPE 2 — FREE WORKER  
\- Must complete document verification to appear in search  
\- Appears in search but NO badge shown  
\- Commission: 15% per job  
\- Cannot post on Spotlight  
\- Standard search placement (lowest)  
\- Can receive Trust from customers

TYPE 3 — BASIC WORKER (Paid)  
\- Monthly fee: $2.50 (approx GHS 30\)  
\- Commission: 10% per job  
\- Blue Checkmark badge (🔵) shown on profile and search  
\- Spotlight access — post completed work  
\- Higher search placement than Free workers  
\- Basic analytics (views, bookings)

TYPE 4 — PRO WORKER (Paid)  
\- Monthly fee: $7.00 (approx GHS 80\)  
\- Commission: 7% per job  
\- Blue Checkmark \+ Pro label (🔵⭐)  
\- TOP search placement  
\- Advanced analytics dashboard  
\- 5 free Spotlight boosts per month  
\- Featured in Top Rated section

TYPE 5 — BUSINESS ACCOUNT (Paid — Expo mobile app + wiamapp.com web)
Three tiers:
  STARTER: $22/month — up to 5 workers — Gold badge (🟡)
  GROWTH:  $44/month — up to 25 workers — Gold badge (🟡)
  ENTERPRISE: $105/month — unlimited — Gold + Elite label (🟡👑)
Business accounts use TWO platforms (see Section 3B):
  Mobile (Expo): quick bookings, field team tracking, job management on the go
  Web (wiamapp.com/business): full dashboard on laptop — analytics, team, invoices
Business accounts get:
- Gold Checkmark (highest trust badge)
- Priority placement above ALL individual workers
- Team management dashboard (mobile + web)
- Company profile page
- Customers can Subscribe/Follow the business (see Section 8)
- Advanced analytics (basic on mobile, full on web)
- Dedicated account manager (Growth and Enterprise)
- API access (Enterprise only — Phase 4)
- Multi-location management (Enterprise only)
- SLA guarantee contracts (Enterprise only)
- Recurring service contracts (Enterprise only)
- Verified vendor database (Enterprise only)
- Monthly consolidated invoicing (Enterprise only)

TYPE 6 — ADMIN (Internal only)  
\- Created manually in Supabase — never through the app  
\- Full platform control via app.wiamlabs.com  
\- Login: founder@wiamapp.com → master dashboard  
\- Login: wiamlabs@gmail.com \+ WiaMid code → specific dashboard

BADGE HIERARCHY:  
Level 1: No badge — Free verified worker  
Level 2: 🔵 Blue Checkmark — Basic subscriber  
Level 3: 🔵⭐ Blue \+ Pro — Pro subscriber  
Level 4: 🟡 Gold Checkmark — Any Business Account  
Level 5: 🟡👑 Gold \+ Elite — Enterprise \+ top performers  
Level 6: 💎 Diamond — Future: invitation-only elite partners

═══════════════════════════════════════════════════════════════  
SECTION 5 — SUBSCRIPTION AND PAYMENT SYSTEM  
═══════════════════════════════════════════════════════════════

TWO PAYMENT SYSTEMS — CRITICAL DISTINCTION:

SYSTEM A: REVENUECAT (In-app purchases only)  
What: Worker subscriptions (Basic, Pro) \+ Spotlight boosts  
Why: Apple App Store and Google Play REQUIRE their payment systems  
     for any digital subscription or feature purchase inside the app.  
     Using any other payment method inside the app gets the app rejected.  
Flow:  
  Worker taps Upgrade → RevenueCat shows Apple/Google sheet  
  → User pays with Apple ID or Google account  
  → RevenueCat confirms → Webhook to backend  
  → Backend updates Supabase → Badge and features activate

SYSTEM B: PAYSTACK (Real-world service payments \+ Website)  
What A (In-app): Customer pays worker for a real-world job  
Why A: Marketplace real-world service payments are EXEMPT from  
       Apple/Google in-app purchase rules.  
       (Uber, Airbnb, Fiverr all use this same exemption)  
Flow A:  
  Customer taps Pay → Backend creates Paystack payment  
  → Paystack WebView opens in app  
  → Customer pays (MoMo, bank card, etc.)  
  → Paystack webhook to backend  
  → Backend records escrow → Phone numbers revealed to both parties

What B (Website): All subscription payments on wiamapp.com  
Why B: Website payments have no Apple/Google 30% cut  
Flow B:  
  User visits wiamapp.com/pricing → Selects plan  
  → Paystack checkout on website  
  → Payment confirmed → Backend updates Supabase  
  → Badge activates in app automatically

IMPORTANT: Worker phone numbers are revealed to the customer ONLY after  
the booking payment is confirmed by Paystack. Not before.  
Paystack does not see or handle phone numbers.  
Phone numbers come from Supabase, released by our backend  
when Paystack sends the "charge.success" webhook.

ALL MONEY IN DATABASE: USD  
Display converts to local currency using Open Exchange Rates API.  
The subscription\_config table holds all prices.  
Prices are editable from admin/founder dashboard.  
Changes take effect immediately — no app update needed.

COMMISSION STRUCTURE:  
Free Worker:       15% per job  
Basic Worker:      10% per job  
Pro Worker:         7% per job  
Starter Business:   8% per job  
Growth Business:    8% per job  
Enterprise:         7% per job  
Emergency Mode: Normal commission \+ 20% emergency premium (WiamApp keeps premium)

ESCROW SYSTEM:  
Customer pays → Money held by WiamApp (worker cannot touch it)  
Job confirmed complete → Money released automatically  
Commission deducted before worker receives payment  
Worker gets their percentage within 24 hours via Paystack transfer

WEBSITE SUBSCRIPTION PRICES (20% cheaper than in-app):  
Basic: $2.00/month web vs $2.50/month in-app  
Pro: $6.00/month web vs $7.00/month in-app  
Starters/Growth/Enterprise: Website only — no in-app option


═══════════════════════════════════════════════════════════════
SECTION 5B — AI CHAT MODERATION AND COMMISSION ENFORCEMENT
═══════════════════════════════════════════════════════════════

WHY THIS SECTION EXISTS:

V3_FINAL Section 18, Step 6 states: "Chat monitored for phone
numbers and payment app mentions." This section defines exactly
how — because "monitored" with no system behind it is not a real
rule, it is a hope.

THE PROBLEM THIS SOLVES:

Workers and customers will try to move payment off-platform to
avoid commission. Simple regex (blocking the word "MoMo" or a
phone number pattern) is easily defeated by typing "zero two four"
instead of "024" or "send am for my number." A real solution
requires understanding intent, not just matching text patterns.

THE SOLUTION: AI MODERATION LAYER ON EVERY MESSAGE

Every message sent through Supabase Realtime chat is intercepted
by the backend BEFORE Realtime broadcasts it, and passed through
an AI moderation check.

DATA FLOW [MOBILE→BACKEND→AI→SUPABASE→REALTIME]:

1. User types a message in ChatScreen
2. App calls: POST /api/chat/send (NOT a direct Supabase insert —
   this is the one exception to V3_FINAL Section 2's "Mobile app
   calls Supabase directly for Realtime" rule: outgoing messages
   route through the backend specifically so the AI check can run
   before the message becomes visible)
3. Backend sends message text to the moderation AI with this
   exact classification prompt:

     "Classify this chat message between a customer and a worker
     on a service marketplace. Does it attempt to: (a) share a
     phone number in any disguised format, (b) suggest moving
     payment off-platform (cash, mobile money, bank transfer
     mentioned outside the app's payment flow), (c) suggest
     meeting or communicating outside the app. Respond with a
     JSON classification: { violation: true/false, type: 'phone'
     | 'off_platform_payment' | 'off_app_contact' | 'none',
     confidence: 0.0-1.0 }"

4. IF violation = true AND confidence > 0.75:
     - Message is NOT delivered as typed
     - Message is replaced with a system notice visible to both
       parties: "A message was held because it may have shared
       contact details or suggested payment outside WiamApp. All
       payments must go through WiamApp to keep both of you
       protected."
     - Original message is logged in full to a moderation table
       (never silently dropped — always auditable)
     - Strike recorded against the sender (see Strike System below)
5. IF violation = false OR confidence <= 0.75:
     - Message proceeds to Supabase insert → Realtime broadcasts
       normally exactly as V3_FINAL Section 18 Step 6 describes

DATABASE TABLE: chat_moderation_log

CREATE TABLE chat_moderation_log (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id      UUID REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  original_text   TEXT NOT NULL,
  violation_type  VARCHAR(30),
  confidence      DECIMAL(3,2),
  was_blocked     BOOLEAN DEFAULT TRUE,
  reviewed_by_human BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_moderation_log ENABLE ROW LEVEL SECURITY;
-- No client policies — backend service role only, same pattern
-- as otp_codes in V3_FINAL Section 19.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THE STRIKE SYSTEM — WHAT HAPPENS AFTER A VIOLATION:

Strike 1: Soft warning shown in-app. No record visible to other party.
Strike 2 (within 90 days): Formal warning + email. Logged on
  user's WiamTrust Score as a negative factor (V3_FINAL Section 10).
Strike 3 (within 90 days): Account flagged for FRAUD ANALYST
  DASHBOARD review (V3_FINAL Section 17 already defines this
  dashboard — this is simply a new entry point into it).
  Human reviewer reads the full chat_moderation_log entries and
  decides: dismiss, formal warning, temporary suspension, or ban.

This keeps the AI as a fast first filter, never the final judge.
A human at WiamLabs always makes the serious decision — the AI
only flags and slows down the obvious attempts.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHY THIS COMPLETES THE COMMISSION GUARANTEE FROM V3_FINAL SECTION 5:

V3_FINAL Section 5 already guarantees commission cannot be avoided
on a job booked through WiamApp, because escrow holds the money
and the platform deducts its cut before the worker is ever paid.
The remaining risk was never the payment mechanics — it was two
people agreeing in chat to skip the booking entirely and deal
directly. This section closes that gap. The booking flow makes
commission unavoidable. The chat moderation makes the agreement
to bypass the booking flow itself difficult and risky.

THE HONEST LIMIT, STATED PLAINLY:

Once two people have done one job together through WiamApp and
have each other's real names and a completed job history, nothing
technical can stop them from exchanging numbers in person, at the
job site, with no chat message involved at all. This system does
not claim to solve that. It solves the on-platform discovery and
negotiation phase, which is where the overwhelming majority of
attempts to bypass commission actually happen. The long-term
answer to the in-person case is the same one already defined in
WIAMAPP_MASTER_ECONOMY_PLAN.md Part 5: make staying on-platform
clearly more valuable than leaving it — WiamTrust Score, repeat
booking convenience, dispute protection, and SOS safety features
all stop working the moment a job moves off-platform.


═══════════════════════════════════════════════════════════════  
SECTION 6 — CUSTOMER IDENTITY VERIFICATION  
═══════════════════════════════════════════════════════════════

WHY CUSTOMERS MUST VERIFY:  
Workers go to strangers' locations.  
A verified customer means the worker knows this person  
is real, identifiable, and legally accountable.  
If harm occurs, WiamApp has full documentation for authorities.

VERIFICATION TIMELINE:  
First booking ever: Upload ID \+ live selfie → 24hr admin review  
Monthly: Fresh live selfie only (30 seconds, compared to stored ID)  
Every 6 months: Full re-upload ID \+ fresh selfie

ID CARDS AND SIDES:  
Ghana Card:      Front YES \+ Back YES (back has QR code)  
Driver License:  Front YES \+ Back YES (vehicle categories on back)  
Passport:        Front YES \+ Back NO (one page — back is blank)  
Voter ID:        Front YES \+ Back NO (back is empty)  
NIN Card (NG):   Front YES \+ Back NO (all info on front)  
NHIS Card:       Front YES \+ Back YES

SMART DETECTION: App detects card type and automatically  
skips the back upload step for single-side cards.  
This is done by checking the selected card type in the UI,  
not by AI — simple conditional logic in the screen code.

DATA FLOW \[MOBILE→BACKEND→R2→SUPABASE\]:  
1\. Customer selects ID type in app  
2\. App opens camera → customer photographs ID  
3\. Photo sent to: POST /api/uploads/customer-document  
4\. Backend validates file type and size (max 5MB, jpg/png only)  
5\. Backend uploads to R2 PRIVATE bucket  
6\. Backend returns only the R2 key (never the URL)  
7\. Backend creates record in customer\_document\_reviews table  
8\. Admin notified via notification  
9\. Admin reviews in dashboard → approves or rejects  
10\. Backend sends email via Resend  
11\. Backend updates users.customer\_verification\_status  
12\. App reads status via GET /api/auth/me → shows result

WHAT WORKERS SEE:  
On every booking request: customer verification badge  
✅ Verified Customer  
⚠️ Verification Pending (submitted but not yet reviewed)  
❌ Not Verified (no documents submitted)  
Workers can decline unverified customer bookings without penalty.

═══════════════════════════════════════════════════════════════  
SECTION 7 — WORKER SAFETY SYSTEM  
═══════════════════════════════════════════════════════════════

ALL SAFETY FEATURES — NON-NEGOTIABLE — BUILD ALL:

SAFETY 1: CUSTOMER VERIFICATION VISIBILITY  
\[DB→BACKEND→MOBILE\]  
Worker sees on booking request:  
\- Customer verification badge  
\- Customer rating from previous workers (private score)  
\- Account age (new accounts flagged clearly)  
\- Number of completed bookings  
Worker can decline any booking — no penalty, no explanation needed

SAFETY 2: GPS CHECK-IN / CHECK-OUT  
\[MOBILE→BACKEND→DB \+ MOBILE→OTHER\_PARTY\_NOTIFICATION\]  
Worker taps "On My Way" → GPS tracking begins  
Worker taps "I Have Arrived" → GPS coordinates \+ timestamp recorded  
Worker taps "Job Complete" → GPS check-out recorded  
Customer notified at each stage  
If no check-out within 4 hours of check-in → admin alerted  
All GPS data stored permanently in worker\_safety\_events table  
Cannot be deleted by anyone except superadmin

SAFETY 3: SOS EMERGENCY BUTTON  
\[MOBILE→BACKEND→DB \+ BACKEND→ADMIN\_NOTIFICATION \+ BACKEND→EMERGENCY\_CONTACT\]  
Available for BOTH workers AND customers  
Location: Profile → Settings → Safety → Emergency SOS  
Activation: Hold red button 3 seconds  
On trigger:  
  \- GPS location recorded immediately  
  \- Current booking details captured  
  \- Alert sent to user's emergency contact (SMS via phone)  
  \- Alert sent to ALL admin accounts instantly  
  \- Everything logged permanently in audit\_logs  
  \- Admin SOS dashboard shows UNRESOLVED alert until admin marks resolved  
Note: Phase 2 — integration with Ghana Police Service emergency line

SAFETY 4: LIVE LOCATION SHARING  
\[MOBILE→EXPO\_LOCATION→BACKEND→SMS\_TO\_CONTACT\]  
Worker or customer can share live GPS location before going to a job  
Select trusted contact from phone contacts  
WiamApp sends them an SMS with a secure link  
Link shows live location on map (updates every 30 seconds)  
No WiamApp account needed to view the link  
Location sharing stops automatically when job marked complete

SAFETY 5: CUSTOMER RATING BY WORKERS  
\[MOBILE→BACKEND→DB\]  
After every completed job, worker rates customer PRIVATELY  
1-5 stars \+ private note (only admins and other workers see)  
This rating affects:  
\- Workers see customer rating before accepting bookings  
\- Customer below 3.0: warning shown to workers  
\- Customer below 2.0: suspended from booking until admin review  
\- Pattern of bad ratings: permanent ban

SAFETY 6: NEW ACCOUNT FLAG  
Any customer account less than 7 days old is flagged  
Worker sees: "⚠️ New Account — Created X days ago"  
Flag removed automatically after 7 days with no reports

SAFETY 7: CUSTOMER PROTECTION GUARANTEE  
"Protected by WiamApp" seal on every verified worker profile  
Customers tap it to see what it means:  
\- Worker identity verified  
\- Payment held in escrow  
\- Dispute resolution available  
\- Fraud traced with Ghana Card documentation

DATABASE TABLE FOR ALL SAFETY EVENTS: worker\_safety\_events  
Columns: user\_id, booking\_id, event\_type, latitude, longitude,  
         location\_name, other\_party\_id, alert\_sent\_to, resolved,  
         resolved\_at, admin\_notes, created\_at

═══════════════════════════════════════════════════════════════  
SECTION 8 — TRUST AND FOLLOW SYSTEM  
═══════════════════════════════════════════════════════════════

PHILOSOPHY:  
WiamApp is NOT social media.  
We do not use "Follow" for individual workers because that  
feels like Instagram or Twitter.  
We use a PROFESSIONAL TRUST SYSTEM that reflects real service quality.

THE TRUST BUTTON (Workers only):  
Before pressing: \[+ Trust\]  (navy button, plus icon)  
After pressing:  \[❤️ Trusted\] (gold button, heart icon)  
On worker profile: "Trusted by 327 Customers"  
On worker dashboard: Shows who trusted them and when

THE FOLLOW / SUBSCRIBE BUTTON (Business accounts only):  
Businesses are companies. Customers can follow businesses  
to get notified of new Spotlight posts and promotions.  
Before pressing: \[+ Follow Business\]  
After pressing:  \[✓ Following\]  
On business profile: "X Customers follow this business"

STRICT RULES FOR TRUST:  
1\. Only VERIFIED customers can trust a worker  
   (unverified customers cannot trust anyone)  
2\. Only VERIFIED workers can be trusted  
   (free unverified workers cannot receive trust)  
3\. A customer can only trust a worker once  
4\. A customer cannot trust a worker they have never booked  
   (MVP: anyone verified can trust — Phase 2: only after booking)  
5\. Trust is permanent unless the customer manually removes it  
6\. Removing trust reduces the count immediately  
7\. Trust count affects search ranking — more trust \= higher placement

STRICT RULES FOR BUSINESS FOLLOW:  
1\. Any verified customer can follow any verified Business Account  
2\. No booking required to follow a business  
3\. Following a business: customer gets push notification when  
   the business posts new Spotlight content  
4\. Unfollow anytime with one tap  
5\. Follow count shown on business profile only

TRUST AFFECTS SEARCH RANKING:  
Search ranking formula includes trust count as a factor.  
Formula weights (approximate):  
  \- Average rating: 30%  
  \- WiamTrust Score: 25%  
  \- Trust count (number of customers who trusted): 20%  
  \- Subscription plan: 15%  
  \- Response rate: 10%

DATABASE TABLE: worker\_trusts  
CREATE TABLE worker\_trusts (  
  id          UUID DEFAULT uuid\_generate\_v4() PRIMARY KEY,  
  customer\_id UUID REFERENCES users(id) ON DELETE CASCADE,  
  worker\_id   UUID REFERENCES worker\_profiles(id) ON DELETE CASCADE,  
  created\_at  TIMESTAMPTZ DEFAULT NOW(),  
  UNIQUE(customer\_id, worker\_id)  
);

DATABASE TABLE: business\_follows  
CREATE TABLE business\_follows (  
  id          UUID DEFAULT uuid\_generate\_v4() PRIMARY KEY,  
  customer\_id UUID REFERENCES users(id) ON DELETE CASCADE,  
  business\_id UUID REFERENCES business\_profiles(id) ON DELETE CASCADE,  
  created\_at  TIMESTAMPTZ DEFAULT NOW(),  
  UNIQUE(customer\_id, business\_id)  
);

DATA FLOW — TRUST A WORKER \[MOBILE→BACKEND→DB→MOBILE\]:  
1\. Customer views worker profile  
2\. Customer taps \[+ Trust\] button  
3\. App calls: POST /api/trust/worker/:workerProfileId  
4\. Backend verifies customer is verified  
5\. Backend verifies worker is verified  
6\. Backend inserts into worker\_trusts table  
7\. Backend increments trust\_count on worker\_profiles  
8\. Backend returns success  
9\. App updates button to \[❤️ Trusted\] immediately (optimistic update)  
10\. Worker receives notification: "A customer trusted you\! ❤️"

DATA FLOW — REMOVE TRUST \[MOBILE→BACKEND→DB→MOBILE\]:  
1\. Customer taps \[❤️ Trusted\] (toggle)  
2\. App calls: DELETE /api/trust/worker/:workerProfileId  
3\. Backend deletes from worker\_trusts table  
4\. Backend decrements trust\_count on worker\_profiles  
5\. App updates button to \[+ Trust\]

DATA FLOW — FOLLOW BUSINESS \[MOBILE→BACKEND→DB→MOBILE\]:  
1\. Customer views business profile  
2\. Customer taps \[+ Follow Business\]  
3\. App calls: POST /api/trust/business/:businessId  
4\. Backend inserts into business\_follows table  
5\. Backend increments follow\_count on business\_profiles  
6\. App updates button to \[✓ Following\]

DISPLAY ON WORKER PROFILE:  
Trust count shown prominently: "❤️ Trusted by 327 Customers"  
This is one of the most powerful trust signals on the platform.  
Workers who see high trust counts from competitors will work  
harder to earn more trust — creating a healthy competition.

DISPLAY ON WORKER DASHBOARD:  
Worker sees: Total Trust Count, New Trusts This Month,  
              List of most recent customers who trusted them

DISPLAY ON CUSTOMER PROFILE:  
Saved/Favorite Workers — customers see all workers they have trusted  
This doubles as a bookmarks system — easy to rebook trusted workers


═══════════════════════════════════════════════════════════════
SECTION 8B — BADGE ARTWORK STANDARD (REPLACES EMOJI BADGES)
═══════════════════════════════════════════════════════════════

WHY THIS SECTION EXISTS:

V3_FINAL Section 4's Badge Hierarchy uses emoji as placeholder
notation in the planning document itself (🔵, 🔵⭐, 🟡, 🟡👑, 💎).
This was always shorthand for a future real icon, never a final
design instruction. This section locks in the final, non-emoji
badge artwork standard referenced from this point forward in every
screen, every document, and every API response.

THE BADGE — ONE SHAPE, TWO COLORS:

A single scalloped circular checkmark badge (the same silhouette
used by major verified-identity platforms worldwide: a rounded
sunburst/seal outline with a white checkmark centered inside) is
the only verification badge shape used anywhere in WiamApp.

COLOR RULE — THIS IS THE ENTIRE SYSTEM:

  Individual users (Customers, Workers — any subscription tier):
  Badge color = Colors.badgeBlue → #3B82F6

  Business Accounts (any tier — Starter, Growth, Enterprise):
  Badge color = Colors.badgeGold → #D4A017 (same gold as buttons,
  per V3_FINAL Rule 4 — "Gold buttons always gold in both modes")

That is the complete rule. No third color. No crown icon layered
on top for Enterprise. No diamond icon for elite tier. Tier
distinction (Free vs Basic vs Pro vs Starter vs Growth vs
Enterprise) is communicated through the existing text label next
to the badge ("Pro Worker", "Enterprise Business") and through
search ranking placement (V3_FINAL Section 8's ranking formula),
never through additional badge icons or colors. One shape. Two
colors. Always recognizable at a glance.

UPDATED BADGE HIERARCHY (replaces the emoji table in V3_FINAL
Section 4 — same tiers, same logic, new artwork only):

  Level 1: No badge — Free verified worker (verified but no
           subscription yet)
  Level 2: Blue checkmark badge — Basic subscriber
  Level 3: Blue checkmark badge — Pro subscriber (same blue,
           "Pro" text label distinguishes it, per the rule above)
  Level 4: Gold checkmark badge — Any Business Account, any tier
  Level 5: Gold checkmark badge — Enterprise + top performers
           ("Enterprise" text label distinguishes it)
  Level 6: Reserved for a future Phase 2+ elite/invitation tier —
           artwork to be decided only when that tier is actually
           built, not before

IMPLEMENTATION — SVG ASSET, NOT A FONT ICON OR EMOJI:

The badge is built as a single SVG component:
  components/VerifiedBadge.jsx
  Props: { color: 'blue' | 'gold', size: number }
  Renders the scalloped seal outline + centered checkmark using
  the exact Colors.badgeBlue or Colors.badgeGold fill, per
  V3_FINAL Rule 4 (colors imported from constants/colors.js,
  never hardcoded hex anywhere else in the codebase).

This single component replaces every emoji badge reference across
every screen built so far (WorkerProfileScreen, SearchScreen,
CategoryScreen, BusinessProfileScreen, ChatListScreen, and any
notification or admin dashboard that currently renders 🔵 or 🟡
as raw emoji text). Every existing screen using emoji badges must
be updated to import and render <VerifiedBadge color="blue" /> or
<VerifiedBadge color="gold" /> instead.

constants/colors.js gets two new entries:
  badgeBlue: '#3B82F6',
  badgeGold: '#D4A017',   // reuses the existing gold constant value


═══════════════════════════════════════════════════════════════  
SECTION 9 — WIAMAPP SPOTLIGHT SYSTEM  
═══════════════════════════════════════════════════════════════

WHAT SPOTLIGHT IS:  
A professional portfolio showcase system inside WiamApp.  
NOT social media. NOT entertainment. NOT personal posts.  
A serious, professional space for promoting verified service work.

WHO CAN POST:  
Basic subscribers and above (🔵 badge and higher)  
All verified Business Accounts (🟡 badge)  
Free workers CANNOT post on Spotlight.  
This is a key motivation to upgrade.

ALLOWED CONTENT ONLY:  
\- Completed work photos (before and after transformations)  
\- Portfolio showcases  
\- Service promotions and limited-time discounts  
\- Business announcements (new services, new locations)  
\- Availability updates  
\- Professional work videos (short clips)  
\- Customer testimonials (with permission)

FORBIDDEN CONTENT — IMMEDIATE REMOVAL:  
\- Comedy, memes, entertainment content  
\- Personal lifestyle posts  
\- Family or personal photos  
\- Political content of any kind  
\- Religious content of any kind  
\- Gossip or unrelated content  
\- Fake promotions

MODERATION FLOW \[MOBILE→BACKEND→ADMIN\_DASHBOARD→MOBILE\]:  
1\. Worker creates post in app  
2\. App calls: POST /api/spotlight  
3\. Backend checks subscription plan (must be Basic+)  
4\. Backend creates record with status: 'pending\_review'  
5\. Admin receives notification to review  
6\. Admin reviews in dashboard:  
   \- Approve → status: 'approved' → post is live  
   \- Reject → status: 'rejected' \+ reason → worker notified  
7\. Worker receives email and push notification of outcome

WHERE SPOTLIGHT APPEARS:  
\- Dedicated "Spotlight" tab on customer home screen  
\- Below category listings in search results  
\- Inside individual worker profile page  
\- Featured areas for boosted posts

BOOST PRICING \[ALL STORED IN USD in subscription\_config\]:  
Standard (3 days):   $1.50  
Featured (7 days):   $3.00  
Premium (14 days):   $6.00  
Business (30 days):  $13.00

BUSINESS FOLLOWS AND SPOTLIGHT:  
When a customer follows a business, they get push notification  
every time that business posts a new approved Spotlight post.  
This makes following a business genuinely valuable.

═══════════════════════════════════════════════════════════════  
SECTION 10 — WIAMTRUST SCORE SYSTEM  
═══════════════════════════════════════════════════════════════

WiamTrust Score is separate from star ratings.  
Star ratings \= per job satisfaction  
WiamTrust Score \= overall platform reliability and integrity

CALCULATION FOR WORKERS (0 to 100):  
Completed jobs:      25% weight (logarithmic — capped at 25 points)  
Average star rating: 20% weight  
Trust count:         15% weight (from customers who trusted them)  
Cancellation rate:   15% weight (lower rate \= higher score)  
Dispute rate:        10% weight (lower rate \= higher score)  
Response rate:       10% weight (faster response \= higher score)  
Verification level:   5% weight

SCORE LABELS:  
0-49:   Unrated (grey)  
50-79:  Building (blue)  
80-89:  Trusted (green)  
90-94:  Highly Trusted (gold)  
95-100: Elite Trust (diamond)

RECALCULATION TRIGGERS \[DB TRIGGER→AUTOMATIC\]:  
Score is recalculated automatically whenever:  
\- A new review is added (database trigger)  
\- A booking is cancelled (database trigger)  
\- A dispute is raised or resolved (database trigger)  
\- A new trust is added or removed (database trigger)

The recalculation runs as a PostgreSQL stored function:  
calculate\_trust\_score(user\_id) — defined in migration 011

DISPLAY \[DB→BACKEND→MOBILE\]:  
Shown on worker profile: "WiamTrust Score: 94/100 — Highly Trusted"  
Shown to workers on booking requests (customer trust score)  
Used in search ranking algorithm  
Badge awarded at milestones: Trusted, Highly Trusted, Elite Trust

═══════════════════════════════════════════════════════════════  
SECTION 11 — EMERGENCY MODE  
═══════════════════════════════════════════════════════════════

Emergency Mode is for urgent situations — broken pipe, power failure,  
car breakdown, accident. Customer needs help NOW, not tomorrow.

HOW IT WORKS \[MOBILE→BACKEND→DB→ALL\_NEARBY\_WORKERS\]:  
1\. Customer presses "Need Help Urgently" on home screen  
2\. Selects emergency category (all 12 available)  
3\. Describes emergency briefly \+ optional photo  
4\. App calls: POST /api/emergency  
5\. Backend validates customer is verified  
6\. Backend finds all available verified workers in that category  
7\. Backend sends push notification to ALL nearby workers simultaneously  
8\. ALL workers see the emergency request in their app  
9\. FIRST worker to accept wins the job  
10\. Other workers' notifications are cancelled  
11\. Customer notified: "A worker is coming to help you\!"  
12\. Emergency booking created automatically  
13\. Payment held in escrow as normal

EMERGENCY PRICING:  
Worker's standard hourly rate \+ 20% emergency premium  
Example: GHS 80/hr standard → GHS 96/hr emergency  
Worker receives standard rate (minus commission)  
WiamApp keeps the 20% emergency premium entirely  
Customer sees total emergency price BEFORE confirming

EXPIRY:  
Emergency request expires after 2 hours if no worker accepts  
Customer is notified and encouraged to try standard booking  
Admin notified if emergency expires without being filled

═══════════════════════════════════════════════════════════════  
SECTION 12 — INSTANT QUOTE SYSTEM  
═══════════════════════════════════════════════════════════════

The Instant Quote System reduces wasted bookings where price  
expectations don't match. Customer posts a job, workers compete  
with their best quotes before any booking is created.

DATA FLOW \[MOBILE→BACKEND→DB→WORKERS→BACKEND→CUSTOMER\]:  
1\. Customer taps "Get Quotes" instead of "Book Now"  
2\. Fills: description, photos, location, preferred date, budget range  
3\. App calls: POST /api/quotes  
4\. Backend creates quote\_requests record (expires in 2 hours)  
5\. Backend notifies all verified available workers in category  
6\. Workers see request in their dashboard  
7\. Workers submit quotes: price, timeline, message, availability  
8\. Each quote: POST /api/quotes/:requestId/submit  
9\. Customer reviews all quotes (sorted cheapest first)  
10\. Customer selects best quote: POST /api/quotes/:requestId/select/:quoteId  
11\. Backend creates booking from selected quote automatically  
12\. All rejected workers notified politely  
13\. Payment flow begins as normal

QUOTE RULES:  
\- Workers have 2 hours to submit a quote  
\- After 2 hours: request closes, customer chooses from received quotes  
\- Worker can only submit one quote per request  
\- Customer can ask one follow-up question per worker in quote chat  
\- Once customer selects a quote, booking is locked

═══════════════════════════════════════════════════════════════  
SECTION 13 — VERIFIED WORK HISTORY AND REPUTATION  
═══════════════════════════════════════════════════════════════

Every completed job is permanently recorded on the worker profile.  
This is the worker's official career record on WiamApp.

WHAT SHOWS ON WORKER PROFILE:  
⭐ 4.9 Average Rating  
✅ 312 Completed Jobs  
🛠️ 5 Years Active on WiamApp  
❤️ Trusted by 127 Customers  
⚡ Responds in avg 4 minutes  
📊 98% Reliability Score  
🏆 WiamTrust Score: 96/100

This creates what we call "trust addiction":  
Workers with long histories will NEVER want to lose their account.  
Every suspension is devastating. Every ban is devastating.  
Workers work harder, respond faster, deliver better work.  
This is the most powerful retention mechanism in WiamApp.

DATA FLOW \[DB→BACKEND→MOBILE\]:  
All metrics stored in:  
\- worker\_profiles table (total\_jobs\_done, average\_rating, response\_rate)  
\- trust\_scores table (WiamTrust score and components)  
\- worker\_trusts table (trust count calculated from this)  
\- reviews table (individual star ratings and comments)  
\- worker\_safety\_events table (response time data)

Fetched by: GET /api/workers/:workerId  
Returns all profile data in one call to minimize API requests.

═══════════════════════════════════════════════════════════════  
SECTION 14 — WORKER PERFORMANCE RANKINGS  
═══════════════════════════════════════════════════════════════

Public rankings create healthy competition.  
Workers see how they compare to others in their category.  
Customers see who the best workers are at a glance.

RANKING TYPES:  
1\. Top Rated in \[Category\] in \[City\]  
2\. Most Trusted (highest trust count)  
3\. Fastest Responders  
4\. Most Jobs Completed This Month  
5\. Highest WiamTrust Score

HOW RANKINGS ARE CALCULATED \[DB FUNCTION→DB TABLE\]:  
Rankings recalculated every 24 hours via a backend cron job  
Cron endpoint: POST /api/rankings/recalculate  
Render free tier does not support cron — use Supabase Edge Functions  
or call this endpoint from a free cron service (cron-job.org)

Rankings stored in: performance\_rankings table  
Columns: worker\_id, category\_id, city, rank\_type, rank\_position, score

WHERE RANKINGS APPEAR \[DB→BACKEND→MOBILE\]:  
\- Home screen: "🏆 Top Electricians in Accra"  
\- Category screen: ranked list of workers  
\- Worker profile: "Ranked \#3 Electrician in Accra" badge  
\- Worker dashboard: "Your current ranking: \#3 in Electricians, Accra"

═══════════════════════════════════════════════════════════════  
SECTION 15 — ONLINE STATUS SYSTEM  
═══════════════════════════════════════════════════════════════

Green dot beside profile pictures shows who is active.

STATUS TYPES:  
🟢 Green dot (solid) — Active in app right now (last seen \< 5 minutes)  
🟡 Yellow dot — Recently active (last seen 5-30 minutes ago)  
No dot — Offline (last seen \> 30 minutes)

HOW IT WORKS \[MOBILE→BACKEND→DB \+ SUPABASE\_REALTIME→MOBILE\]:  
App sends heartbeat to backend every 60 seconds:  
  POST /api/online/heartbeat  
Backend updates user\_online\_status table (last\_seen\_at)  
When app goes to background: POST /api/online/offline

Other users' screens subscribe to Supabase Realtime:  
  supabase.channel('online').on('UPDATE', user\_online\_status...)  
Green dot updates in real time without screen refresh.

WHERE ONLINE DOT APPEARS:  
\- Home screen worker cards (small dot, bottom right of avatar)  
\- Search results (small dot beside avatar)  
\- Worker profile page (dot beside avatar)  
\- Chat list (dot beside conversation avatar)  
\- Chat screen header (dot beside worker name)  
\- Booking detail screen (dot beside worker photo)  
\- Business team list (dot beside each worker)

AVATAR RULES:  
Profile pictures (avatars) are stored in R2 public bucket.  
They appear in every location listed above.  
Workers without a profile picture see: navy circle with initials in gold.  
Customers without a profile picture see: navy circle with initials in gold.  
Avatar URL is stored in users.avatar\_url (R2 public URL).

═══════════════════════════════════════════════════════════════  
SECTION 16 — NOTIFICATION SYSTEM (COMPLETE)  
═══════════════════════════════════════════════════════════════

THREE CHANNELS:  
Push: Expo Push Notifications (free) — real-time phone alerts  
In-App: Supabase Realtime → bell icon count in app (free)  
Email: Resend (3,000/month free) — important events only

PUSH TOKEN REGISTRATION \[MOBILE→BACKEND→DB\]:  
On app launch: request push permission from user  
If granted: get Expo push token  
Send to: POST /api/notifications/push-token  
Backend stores in users table (push\_token column)  
Backend uses this token to send push notifications

CUSTOMER NOTIFICATION EVENTS:  
\- Email OTP sent: Email only  
\- Account verified: Push \+ In-App \+ Email  
\- Worker accepted booking: Push \+ In-App \+ Email  
\- Worker rejected booking: Push \+ In-App \+ Email  
\- Worker on the way: Push \+ In-App  
\- Worker arrived (check-in): Push \+ In-App  
\- Job marked complete — confirm?: Push \+ In-App \+ Email  
\- Payment processed: Push \+ In-App \+ Email  
\- Review reminder: Push \+ In-App \+ Email  
\- Monthly re-verification due: Push \+ In-App \+ Email  
\- New trust registered: In-App only  
\- Business posted new Spotlight (if following): Push \+ In-App  
\- SOS triggered by customer: Push \+ In-App \+ Email to admin

WORKER NOTIFICATION EVENTS:  
\- New booking request: Push \+ In-App \+ Email  
\- Booking auto-cancelled (no response 2hr): Push \+ In-App \+ Email  
\- Customer payment confirmed: Push \+ In-App  
\- Job confirmed complete — payment releasing: Push \+ In-App \+ Email  
\- Payment received in account: Push \+ In-App \+ Email  
\- New review received: Push \+ In-App \+ Email  
\- New trust received from customer: In-App \+ Email  
\- Verification approved: Push \+ In-App \+ Email  
\- Verification rejected \+ reason: Push \+ In-App \+ Email  
\- Platform warning (chat monitoring): Push \+ In-App \+ Email  
\- Account suspended: Push \+ In-App \+ Email  
\- Subscription renewing: Push \+ In-App  
\- Subscription expired: Push \+ In-App \+ Email  
\- New ranking achievement: In-App

ADMIN NOTIFICATION EVENTS:  
\- New worker document submitted: Admin dashboard \+ Email  
\- New customer document submitted: Admin dashboard \+ Email  
\- Document over 20 hours without review: Admin dashboard \+ Email (urgent)  
\- New fraud report filed: Admin dashboard \+ Email  
\- SOS button triggered: Admin dashboard \+ Email \+ SMS (urgent)  
\- New business account application: Admin dashboard \+ Email  
\- Platform warning issued: Admin dashboard

NOTIFICATION DATA FLOW \[BACKEND→SUPABASE→REVENUECAT\_WEBHOOK\]:  
All notifications inserted into notifications table by backend  
Mobile app subscribes to Supabase Realtime:  
  supabase.channel('notifications:userId')  
    .on('INSERT', notifications, (payload) \=\> updateBellCount)  
Bell icon in navigation bar shows unread count  
All notifications read/cleared from: PATCH /api/notifications/read-all

═══════════════════════════════════════════════════════════════  
SECTION 17 — TEAM SYSTEM AND WIAMID CODES  
═══════════════════════════════════════════════════════════════

All team work happens on the website — NOT in the Expo app.  
Team members never see the mobile app in their dashboards.  
They control the platform from app.wiamlabs.com.

WIAMID CODE FORMAT:  
WiaMid \+ 6 characters (uppercase \+ lowercase \+ numbers \+ symbols)  
Total: 12 characters  
Example: WiaMidGu40a@

RULES:  
\- Code generated with cryptographically secure random function  
\- Stored in database as SHA-256 HASH (never plain text)  
\- Plain text shown ONCE after generation — then gone forever  
\- Expires after exactly 10 days  
\- New code auto-generated and sent 2 days before expiry  
\- Every code has a security warning in the email  
\- 3 failed login attempts locks for 30 minutes

TEAM LOGIN FLOW \[WEBSITE→BACKEND→DB\]:  
1\. Go to app.wiamlabs.com/team  
2\. Enter email: wiamlabs@gmail.com (all team members use this)  
3\. Enter WiaMid code: WiaMidXXXXXX  
4\. Backend: POST /api/team/login  
5\. Backend hashes entered code with WIAMID\_SALT  
6\. Backend finds team member by code hash in team\_members table  
7\. Backend verifies code is not expired  
8\. Backend returns team member info and dashboard key  
9\. Website routes to /dashboard/\[dashboard\_key\]  
10\. Team member sees ONLY their specific dashboard

FOUNDER LOGIN FLOW \[WEBSITE→BACKEND→DB\]:  
1\. Go to app.wiamlabs.com/founder  
2\. Enter: founder@wiamapp.com \+ founder's private password  
3\. Backend verifies via Supabase Auth  
4\. Backend confirms role \= 'admin'  
5\. Founder sees MASTER dashboard  
6\. Master dashboard shows paths to ALL team dashboards  
7\. Founder can enter any dashboard and control everything

FOUNDER SUPER POWERS:  
\- Access every team member's dashboard  
\- Create and deactivate team members  
\- Change subscription prices in USD (takes effect immediately)  
\- Suspend or ban any user  
\- Override any team member's decision  
\- View all financial data  
\- Emergency platform controls (pause all bookings if needed)  
\- Mass notification to all users

TEAM ROLES AND THEIR DASHBOARDS:  
(Full list of 35 roles in migration 016\_team\_members.sql)

Key roles and what their dashboard shows:

DOCUMENT REVIEWER DASHBOARD:  
\- Worker verification queue (oldest first — FIFO)  
\- Customer verification queue  
\- Business verification queue  
\- View document button (calls /api/admin/document-url/:key)  
  → Backend generates 15-min signed R2 URL  
  → Every view logged in audit\_logs  
\- Approve button → POST /api/admin/verification/approve/:reviewId  
\- Reject button \+ reason → POST /api/admin/verification/reject/:reviewId

DISPUTE RESOLUTION DASHBOARD:  
\- All open disputes  
\- Full chat log for each booking (read-only)  
\- GPS check-in/out records for the job  
\- Both party's verification documents (signed URLs)  
\- Decision: Release to worker / Refund customer / Partial  
\- Communication tool to message both parties

FRAUD ANALYST DASHBOARD:  
\- All open fraud reports  
\- Full audit log for any user (IP history, device history)  
\- Platform warnings (off-platform payment attempts)  
\- Link to police report template

EMERGENCY RESPONSE DASHBOARD:  
\- Real-time SOS alert feed (shows unresolved only)  
\- Each alert: user name, GPS location link, booking details  
\- Other party's name and phone  
\- Mark as resolved button  
\- Notes field for incident documentation  
\- Phone number of emergency contact who was alerted

CONTENT MODERATOR DASHBOARD:  
\- Pending Spotlight posts queue  
\- View media and text  
\- Approve or reject with reason  
\- Reported posts (community flagged)  
\- Post history and moderation log

FINANCIAL MANAGER DASHBOARD:  
\- Total revenue by day, week, month (in USD)  
\- Commission breakdown by category  
\- Subscription revenue by plan  
\- Spotlight boost revenue  
\- Business account revenue  
\- Payout records to workers  
\- Export to CSV and PDF  
\- EDIT PRICES: change subscription\_config table directly  
  → GET /api/admin/pricing → shows all plans  
  → PUT /api/admin/pricing/:planKey → updates price  
  → Change reflected immediately in app (next API call shows new price)  
  → Change logged in audit\_logs with who changed it and when

This is the critical connection: Admin changes price in dashboard  
→ Backend updates subscription\_config table  
→ Next time mobile app calls /api/currency/subscription-prices  
→ App shows new prices  
→ Zero app update needed for price changes


═══════════════════════════════════════════════════════════════
SECTION 17B — CONTRACTS, JOB BOARD, AND BUSINESS DUAL-ROLE
═══════════════════════════════════════════════════════════════

WHY THIS SECTION EXISTS:

V3_FINAL Section 4, Type 5 already defines Business Accounts and
their three tiers (Starter/Growth/Enterprise) entirely as a HIRING
tool — a business hires workers, manages a team, gets a dashboard.
Section 1 of V3_FINAL also explicitly states: "Not a job board
(workers do not apply — customers book them)."

This section adds a second, clearly separated capability on top
of that existing foundation — a real Job Board with applications —
without breaking the "customers book workers" booking model that
remains the default and primary flow for every individual booking
described in V3_FINAL Section 18. The Job Board is for
multi-day/ongoing CONTRACT work between a Business and a worker,
never for the single-job booking flow, which stays exactly as
V3_FINAL Section 18 already defines it, unchanged.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BUSINESS DUAL-ROLE MODEL:

Every Business Account, at signup, picks one role and can change
it later from their dashboard:

  HIRER — uses WiamApp to find and manage their own staff.
  This is the complete Business Account feature set already
  defined in V3_FINAL Section 4, Type 5 — unchanged, fully built.

  PROVIDER — the business itself is a service company that wants
  to appear in customer search results exactly like an individual
  worker profile, receive direct bookings as a company, and post
  on Spotlight as a company (V3_FINAL Section 9's Spotlight system
  already allows "All verified Business Accounts" to post — this
  role simply activates that existing permission).

  BOTH — most realistic for many real companies (a cleaning
  company that hires its own staff AND wants new customers to
  find "CleanPro Ghana" directly in search).

DATABASE — business_profiles GAINS:

ALTER TABLE business_profiles ADD COLUMN business_role VARCHAR(20)
  DEFAULT 'hirer' CHECK (business_role IN ('hirer','provider','both'));
ALTER TABLE business_profiles ADD COLUMN category_id UUID REFERENCES categories(id);
ALTER TABLE business_profiles ADD COLUMN bio TEXT;
ALTER TABLE business_profiles ADD COLUMN logo_url TEXT;
ALTER TABLE business_profiles ADD COLUMN average_rating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE business_profiles ADD COLUMN total_jobs_done INT DEFAULT 0;
ALTER TABLE business_profiles ADD COLUMN follow_count INT DEFAULT 0;
  -- follow_count is incremented/decremented by the business_follows
  -- table already defined in V3_FINAL Section 8

EXISTING businesses at the time this feature ships default to
business_role = 'hirer' automatically — no business is surprised
with new public visibility they did not choose.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRICING — HIRER-ONLY COSTS LESS THAN PROVIDER:

A Hirer-only business is buying an admin/management tool. A
Provider business is buying customer discovery and leads — a
fundamentally more valuable product. Pricing must reflect this,
and replaces the flat pricing implied by V3_FINAL Section 4's
single $22/$44/$105 table with a role-aware table:

  Role           Starter        Growth         Enterprise
  Hirer only     $5/month       $13/month      $30/month
  Provider only  $22/month      $44/month      $105/month
  Both (Hybrid)  $26/month      $51/month      $123/month
                 (small bundle discount vs buying both separately)

subscription_config table (V3_FINAL Section 5) gains a
business_role column so the founder dashboard pricing editor
(Section 17's Financial Manager Dashboard) can edit all six
price points independently, same live-update mechanism already
described in V3_FINAL Section 17.

WHAT HIRER-ONLY PAYS FOR (existing V3_FINAL Section 4 feature set,
unchanged): team management, booking history, basic dashboard.

WHAT PROVIDER ADDS ON TOP: company profile visible in Search and
Category screens (same placement logic as individual workers,
ranked by the same Section 8 trust formula), Spotlight posting
rights activated, Gold checkmark badge (Section 8B) shown publicly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMISSION ON PROVIDER BOOKINGS — THE ONE EXCEPTION TO
"BUSINESSES NEVER PAY COMMISSION":

V3_FINAL Section 5's commission table lists Starter/Growth/
Enterprise Business commission rates (8%, 8%, 7%) already — this
extension clarifies exactly when that commission applies, since
V3_FINAL did not yet have the Hirer/Provider split to make this
precise:

  Hirer-side activity (business books a worker for its own
  internal needs): NO commission. Subscription fee already covers
  this access, exactly as already true in V3_FINAL Section 5.

  Provider-side activity (a customer books the BUSINESS directly
  through public search, a lead the business would not otherwise
  have had): the existing V3_FINAL commission rate (8% Starter/
  Growth, 7% Enterprise) applies, taken through the same escrow
  mechanism already defined in V3_FINAL Section 18, Step 7.

This is not a new commission — it is the precise scope clarification
of the commission percentages V3_FINAL Section 5 already lists for
Business Accounts, which were previously undifferentiated.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONTRACTS — LONG-TERM WORKER EXCLUSIVITY:

A Contract is different from a single Booking (V3_FINAL Section
18). A Booking is one job. A Contract is a business effectively
employing a worker through WiamApp for a sustained period.

DATABASE TABLE: contracts

CREATE TABLE contracts (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_profile_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  title             VARCHAR(200) NOT NULL,
  description       TEXT,
  pay_type          VARCHAR(20) DEFAULT 'monthly'
                       CHECK (pay_type IN ('daily','weekly','monthly','fixed')),
  pay_amount_usd    DECIMAL(10,2) NOT NULL,   -- USD storage, per V3_FINAL Rule 8
  start_date        DATE NOT NULL,
  end_date          DATE,                      -- NULL = ongoing/indefinite
  status            VARCHAR(20) DEFAULT 'pending'
                       CHECK (status IN ('pending','active','completed','terminated','rejected')),
  terminated_by     UUID REFERENCES users(id),
  termination_reason TEXT,
  payment_routed_via VARCHAR(20) DEFAULT 'wiamapp'
                       CHECK (payment_routed_via IN ('wiamapp','direct')),
  -- see "Who Pays Contract Workers" below for what this controls
  country_id        UUID REFERENCES countries(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_profiles ADD COLUMN locked_by_contract_id UUID REFERENCES contracts(id);

AUTOMATIC LOCK [DB_TRIGGER→AUTOMATIC], same trigger pattern already
used for WiamTrust Score recalculation in V3_FINAL Section 10:

CREATE OR REPLACE FUNCTION lock_worker_on_contract_active()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status != 'active' THEN
    UPDATE worker_profiles
    SET is_available = FALSE, locked_by_contract_id = NEW.id
    WHERE id = NEW.worker_profile_id;
  END IF;
  IF NEW.status IN ('completed','terminated','rejected')
     AND OLD.status = 'active' THEN
    UPDATE worker_profiles
    SET is_available = TRUE, locked_by_contract_id = NULL
    WHERE id = NEW.worker_profile_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contract_lock
AFTER UPDATE ON contracts
FOR EACH ROW EXECUTE FUNCTION lock_worker_on_contract_active();

A worker locked by an active contract is excluded from every
search and category query automatically — no manual code path,
the WHERE clause added to V3_FINAL Section 18 Step 1's worker
query becomes:
  WHERE locked_by_contract_id IS NULL

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHO PAYS CONTRACT WORKERS — THE PAYMENT_ROUTED_VIA RULE:

This was an open question and is now resolved with two explicit
options, chosen by the business when creating the contract:

  OPTION 1 — payment_routed_via = 'wiamapp' (recommended, default):
  The business pays WiamApp on a schedule matching pay_type
  (weekly/monthly), money sits in escrow exactly like a normal
  booking (V3_FINAL Section 18 Step 7), WiamApp pays the worker
  their share automatically each pay period, commission is
  deducted exactly like a normal job per V3_FINAL Section 5.
  This gives the worker full WiamApp protection: payment guarantee,
  dispute resolution access, and WiamTrust Score credit for every
  contract pay period completed.

  OPTION 2 — payment_routed_via = 'direct':
  The business and worker agree the business pays the worker
  directly (bank transfer, cash, mobile money) OUTSIDE WiamApp.
  WiamApp facilitated the match (and the business paid its
  subscription fee for that access) but takes no commission and
  provides no payment guarantee on this contract. The contract
  still exists in the database for record-keeping, exclusivity
  locking, and dispute history purposes, but the
  chat_moderation_log (Section 5B) explicitly allows payment
  discussion for contracts already marked 'direct' — the AI
  moderation check in Section 5B only applies to booking-flow
  chat (V3_FINAL Section 18), not contract-flow chat once a
  contract has been mutually marked as direct-pay by both parties.

  RULE: A contract starts as 'wiamapp' by default. Switching to
  'direct' requires BOTH the business and the worker to confirm
  the change in-app — neither party can switch it unilaterally,
  preventing a business from quietly avoiding worker protections
  the worker thought they had.

  WHY OPTION 2 EXISTS AT ALL: Many real Ghana businesses already
  have payroll systems (their own bank transfer process, their
  own HR). Forcing 100% of contract pay through WiamApp escrow
  would make WiamApp a worse fit than the businesses' existing
  process and lose the contract feature entirely. Allowing direct
  payment for contracts (never for individual bookings — those
  always remain 'wiamapp' per V3_FINAL Section 18, no exception)
  keeps WiamApp as the trusted matching and record layer even when
  it is not the payment processor.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WORKER VISIBILITY CONTROL — HIDE FROM SEARCH:

Separate from exclusivity (locked = not bookable). This controls
discoverability (hidden = not findable, even if technically free).

ALTER TABLE team_members ADD COLUMN is_hidden_from_search BOOLEAN DEFAULT FALSE;
-- (team_members is the existing table from V3_FINAL Section 17;
-- this extends Business team rosters, not the WiamLabs internal
-- team_members table referenced in that same section — name
-- collision must be resolved by renaming the Business roster
-- table to business_team_members during the Section 19 schema
-- merge, since V3_FINAL Section 17's team_members is reserved
-- for WiamLabs internal staff)

Search query gains:
  AND NOT EXISTS (
    SELECT 1 FROM business_team_members btm
    WHERE btm.worker_profile_id = worker_profiles.id
      AND btm.is_hidden_from_search = TRUE
      AND btm.status = 'active'
  )

A worker hidden by their employing business from public search
still sees the Job Board (below) normally — hidden from customers,
never hidden from their own opportunities.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THE JOB BOARD — VILLAGE-TO-CITY HIRING:

This is the resolution to V3_FINAL Section 1's "Not a job board"
statement: that statement governs the BOOKING model (a single job,
customer finds and books a worker directly — unchanged, stays
true). The Job Board governs the separate CONTRACT model
(multi-day/ongoing employment) where an open-application flow is
the correct, honest pattern — exactly like how a real job vacancy
works, not how a same-day plumber booking works. Both models
coexist; neither replaces the other.

DATABASE TABLES: job_postings, job_applications

CREATE TABLE job_postings (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             VARCHAR(200) NOT NULL,
  description       TEXT NOT NULL,
  category_id       UUID REFERENCES categories(id),
  location_city     VARCHAR(100) NOT NULL,
  remote_ok         BOOLEAN DEFAULT FALSE,
  pay_type          VARCHAR(20) DEFAULT 'monthly'
                       CHECK (pay_type IN ('daily','weekly','monthly','fixed')),
  pay_amount_usd    DECIMAL(10,2),
  pay_negotiable    BOOLEAN DEFAULT FALSE,
  requirements      TEXT,
  required_documents JSONB,    -- e.g. ["ghana_card","police_clearance"]
  status            VARCHAR(20) DEFAULT 'open'
                       CHECK (status IN ('open','filled','closed')),
  positions_available INT DEFAULT 1,
  country_id        UUID REFERENCES countries(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  expires_at        TIMESTAMPTZ
);

CREATE TABLE job_applications (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_posting_id    UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  worker_profile_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  cover_message     TEXT,
  status            VARCHAR(20) DEFAULT 'pending'
                       CHECK (status IN ('pending','reviewed','interview','accepted','rejected','withdrawn')),
  submitted_documents JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_posting_id, worker_profile_id)
);

ALTER TABLE job_postings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

DATA FLOW — WORKER APPLIES [MOBILE→BACKEND→DB→BUSINESS_NOTIFICATION]:

1. Worker opens JobBoardScreen (new tab in WorkerApp, alongside
   the existing Dashboard/Jobs/Notifications/Profile tabs from
   V3_FINAL Section 21)
2. GET /api/jobs/board?country=GH lists open postings filtered to
   the worker's country_id (Section 3C rule — no cross-border
   listing without explicit Phase 2 review)
3. Worker taps a posting, reviews required_documents
4. If worker's existing WiamApp verification already satisfies a
   listed requirement (e.g. ghana_card — already on file per
   V3_FINAL Section 6), it shows as pre-satisfied with a checkmark
5. For any requirement not already on file, worker uploads it
   specifically for this application via the same R2 Private
   upload pattern already defined in V3_FINAL Section 6
6. POST /api/jobs/:id/apply with cover_message + document references
7. Business receives notification, reviews in BusinessApplicantsScreen
8. Business can message the applicant (opens a chat thread, subject
   to Section 5B's AI moderation exactly like any other WiamApp
   chat) and ultimately Accept or Reject
9. Accepting an application auto-creates a Contract (above) with
   status 'pending', business completes contract terms (pay
   amount, dates, payment_routed_via choice), worker confirms,
   contract becomes 'active', exclusivity lock engages automatically

WiamApp's role stops at the match and the trust/verification
layer. Physical relocation, travel cost, and accommodation
arrangements between a village-based worker and a city-based
business are handled by the two parties directly — exactly the
same non-involvement boundary V3_FINAL already holds for any
in-person job execution detail (V3_FINAL never schedules the
worker's transport for a normal booking either).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EMPLOYMENT VERIFICATION TIER — FOR HIGH-TRUST CONTRACT ROLES:

Extends V3_FINAL Section 6's existing customer verification table
pattern and Section 7's worker verification, adding one more tier
specifically for Contract-track Job Board applications:

ALTER TABLE verifications ADD COLUMN reference_1_name  VARCHAR(100);
ALTER TABLE verifications ADD COLUMN reference_1_phone VARCHAR(20);
ALTER TABLE verifications ADD COLUMN reference_2_name  VARCHAR(100);
ALTER TABLE verifications ADD COLUMN reference_2_phone VARCHAR(20);
ALTER TABLE verifications ADD COLUMN guarantor_user_id UUID REFERENCES users(id);
ALTER TABLE worker_profiles ADD COLUMN employment_verified BOOLEAN DEFAULT FALSE;

A worker who completes this tier (police clearance upload, two
references WiamLabs staff calls to confirm, optional guarantor who
is themselves a verified WiamApp user) is shown a distinct
"Employment Verified" label next to their existing Section 8B
checkmark badge — same blue/gold badge shape and color, the label
text is what communicates the elevated tier, consistent with how
V3_FINAL Section 4's Pro/Enterprise tiers are already communicated
through label text rather than new badge artwork (Section 8B rule).

This reuses the exact admin review queue and approve/reject
pattern already fully defined in V3_FINAL Section 17's
"DOCUMENT REVIEWER DASHBOARD" — no new admin tooling required,
only a new verification_type = 'employment' value flowing through
the same dashboard.


═══════════════════════════════════════════════════════════════  
SECTION 18 — BOOKING FLOW (COMPLETE END TO END)  
═══════════════════════════════════════════════════════════════

STANDARD BOOKING FLOW:

STEP 1 — DISCOVERY \[MOBILE→BACKEND→DB\]:  
Customer opens app → Home screen loaded  
GET /api/workers?city=Accra\&limit=20  
Backend fetches from worker\_profiles joined with users, categories  
Returns workers sorted by: subscription\_plan, trust\_count, average\_rating

STEP 2 — SEARCH \[MOBILE→FRONTEND\_FILTER\]:  
Customer searches by category or keyword  
Filtering happens on the frontend for speed (no API call per keystroke)  
When filters applied: GET /api/workers?category=X\&verified=true\&available=true  
Backend returns filtered list

STEP 3 — WORKER PROFILE \[MOBILE→BACKEND→DB\]:  
Customer taps worker → GET /api/workers/:workerId  
Returns: profile, portfolio, reviews, trust count, WiamTrust score, rankings  
Phone number NOT returned at this stage

STEP 4 — BOOKING REQUEST \[MOBILE→BACKEND→DB→WORKER\_NOTIFICATION\]:  
Customer taps "Book Now"  
POST /api/bookings with: description, location, date, time, budget  
Backend validates customer is verified (checks customer\_verification\_status)  
Backend validates worker is verified (checks is\_verified on worker\_profiles)  
Backend creates booking record with status: 'pending'  
Backend sends push notification to worker \+ email  
Worker has 2 hours to respond — auto-cancel after 2 hours

STEP 5 — WORKER ACCEPTS \[WORKER\_MOBILE→BACKEND→DB→CUSTOMER\_NOTIFICATION\]:  
Worker taps Accept in their dashboard  
PATCH /api/bookings/:id/accept  
Backend updates booking status: 'accepted'  
Backend sends push notification \+ email to customer  
IN-APP CHAT OPENS — both parties can now message each other  
Phone numbers still NOT revealed

STEP 6 — CHAT \[MOBILE→SUPABASE\_REALTIME\]:  
Chat uses Supabase Realtime directly (not backend API)  
Messages stored in messages table  
Real-time subscriptions via supabase.channel()  
Worker and customer discuss the job and agree on final price  
Phone numbers remain hidden during chat  
Chat monitored for phone numbers and payment app mentions

STEP 7 — PAYMENT \[MOBILE→BACKEND→PAYSTACK→WEBHOOK→DB\]:  
Customer taps "Pay Now — GHS 200"  
POST /api/payments/initiate with bookingId and amount  
Backend creates Paystack payment session  
Paystack checkout opens inside app (WebView component)  
Customer pays using MoMo, bank card, etc.  
Paystack sends webhook to: POST /api/webhooks/paystack  
Backend receives webhook, verifies Paystack signature  
Backend creates payment record with status: 'escrow'  
Backend updates bookings.payment\_status: 'paid'  
BACKEND REVEALS PHONE NUMBERS (updates booking so both parties can see)  
Both parties receive push notification with each other's contact

STEP 8 — JOB EXECUTION \[MOBILE→BACKEND→DB\]:  
Worker taps "On My Way" → POST /api/safety/on-the-way  
Worker taps "I Have Arrived" → POST /api/safety/check-in  
GPS coordinates recorded, customer notified

STEP 9 — COMPLETION \[WORKER\_MOBILE→BACKEND→DB→CUSTOMER\_NOTIFICATION\]:  
Worker taps "Job Complete" → PATCH /api/bookings/:id/complete  
Customer prompted to confirm: "Did the worker complete the job?"  
Customer confirms → PATCH /api/bookings/:id/confirm  
Backend initiates Paystack transfer to worker  
Backend deducts commission from total  
Backend records commission in platform\_earnings table  
Worker receives payment within 24 hours

STEP 10 — REVIEWS \[MOBILE→BACKEND→DB→TRUST\_SCORE\_RECALCULATE\]:  
Customer rates worker 1-5 stars \+ comment  
POST /api/bookings/:id/review  
Database trigger recalculates WiamTrust Score automatically  
Worker rates customer privately  
POST /api/safety/rate-customer  
Customer's private score updated


═══════════════════════════════════════════════════════════════
SECTION 18B — BUSINESS-ASSIGNED BOOKING FLOW
═══════════════════════════════════════════════════════════════

WHY THIS SECTION EXISTS:

V3_FINAL Section 18 describes the standard booking flow: customer
finds an individual worker, books them, that exact worker does the
job. This section adds the one new branch required when a customer
books a PROVIDER-role Business (Section 17B) directly — the
business, not the customer, decides which of its own team members
actually performs the job.

THE FLOW [MOBILE→BACKEND→DB→TEAM_MEMBER_NOTIFICATION]:

1. Customer finds "CleanPro Ghana" in Search (a Provider-role
   Business profile, ranked and displayed using the exact same
   placement logic V3_FINAL Section 8 already applies to any
   verified, trusted, subscribed profile)
2. Customer taps Book — identical UI to booking an individual
   worker, per V3_FINAL Section 18 Steps 1-4, with one difference:
   the resulting booking record sets booked_business_id instead
   of (or in addition to) worker_id
3. ALTER TABLE bookings ADD COLUMN booked_business_id UUID
   REFERENCES business_profiles(id);
   ALTER TABLE bookings ADD COLUMN assignment_status VARCHAR(20)
   DEFAULT 'not_required' CHECK (assignment_status IN
   ('not_required','pending_assignment','assigned'));
   ALTER TABLE bookings ADD COLUMN assigned_by UUID REFERENCES users(id);
4. A booking with booked_business_id set is created with
   assignment_status = 'pending_assignment' instead of going
   straight to the worker notification step
5. Business receives the booking in BusinessBookingsScreen,
   reviews available team members (excluding any currently
   locked by an active Contract, Section 17B), and assigns:
   PATCH /api/bookings/:id/assign with { worker_profile_id }
6. Backend sets bookings.worker_id, assignment_status = 'assigned',
   assigned_by = business owner's user id
7. From this point forward, the booking proceeds EXACTLY as
   V3_FINAL Section 18 Steps 5 through 10 already describe —
   the assigned worker accepts, chat opens, payment flows to
   escrow, GPS check-in, completion, review. Nothing about the
   back half of the flow changes.

REVIEWS ON BUSINESS-ASSIGNED BOOKINGS:

When the job completes, the review the customer submits
(V3_FINAL Section 18 Step 10) is recorded against BOTH the
business_profiles.average_rating AND the individual
worker_profiles.average_rating already used in V3_FINAL Section 8's
ranking formula. The business rating reflects overall company
reliability across every job it sends out; the worker's personal
rating reflects their individual performance and continues
contributing to their own WiamTrust Score (V3_FINAL Section 10)
exactly as it would for any directly-booked job.

NOTIFICATION TO THE ASSIGNED TEAM MEMBER:

Uses the existing push notification system fully defined in
V3_FINAL Section 16 — no new notification infrastructure, only a
new trigger event: "New job assigned by [Business Name]" fires the
same way every other booking-lifecycle notification already fires
in that section.

═══════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════  
SECTION 19 — COMPLETE DATABASE SCHEMA  
═══════════════════════════════════════════════════════════════

MIGRATION ORDER (MANDATORY — NEVER CHANGE THIS ORDER):  
001\_core\_tables.sql           — users, worker\_profiles, categories  
002\_bookings\_messages.sql     — bookings, messages, notifications  
003\_security\_payments.sql     — payments, fraud, audit logs  
004\_rls\_policies.sql          — Row Level Security for all tables  
005\_security\_functions.sql    — Database triggers and functions  
006\_mvp\_verification\_escrow.sql — Customer verification, OTP  
007\_to\_015.sql                — All new tables from V2 and V3  
016\_team\_members.sql          — Team system, career applications  
017\_trust\_system.sql          — worker\_trusts, business\_follows (NEW)  
018\_enhanced\_profiles.sql     — Customer profile, saved workers (NEW)  
categories\_seed.sql           — Seed all 12 categories (run last)

ALL TABLES — COMPLETE LIST:

CORE:  
users                    — all users (customer, worker, business, admin)  
worker\_profiles          — extended worker data  
categories               — 12 service categories  
worker\_categories        — many-to-many worker↔category  
worker\_subtypes          — 90+ specific skills under categories  
worker\_subtype\_selections — which subtypes a worker offers  
portfolio\_images         — worker portfolio photos (R2 public URLs)

TRANSACTIONS:  
bookings                 — all job requests and their status  
reviews                  — customer reviews after completed jobs  
messages                 — chat messages between parties  
notifications            — in-app notification bell  
payments                 — all payment records with escrow tracking  
quote\_requests           — instant quote requests from customers  
quotes                   — worker quotes for a request  
emergency\_requests       — emergency mode job requests

TRUST AND SOCIAL:  
worker\_trusts            — customers who trusted workers  
business\_follows         — customers who follow businesses

SECURITY:  
verifications            — ID verification records per user  
document\_reviews         — admin queue for worker document review  
customer\_document\_reviews — admin queue for customer document review  
business\_verifications   — business account document review  
audit\_logs               — permanent append-only action log  
fraud\_reports            — filed fraud reports  
platform\_warnings        — off-platform payment strikes  
otp\_codes                — email OTP codes  
device\_fingerprints      — duplicate account detection

SAFETY:  
worker\_safety\_events     — check-in, check-out, SOS events  
customer\_ratings         — workers rating customers privately

PERFORMANCE:  
trust\_scores             — WiamTrust Score for each user  
performance\_rankings     — category rankings updated daily  
user\_online\_status       — real-time online/offline tracking

MONETIZATION:  
subscriptions            — worker subscription records  
featured\_workers         — paid featured listing records  
business\_profiles        — business account data  
business\_team\_members    — workers under a business  
spotlight\_posts          — spotlight content  
spotlight\_reports        — community reports on posts  
platform\_earnings        — WiamApp commission records  
subscription\_config      — all prices in USD (editable)  
exchange\_rates           — cached currency rates

TEAM:
team_members             — WiamLabs team members and WiaMid codes
career_applications      — job applications submitted on website
career_positions         — job openings shown on website

ENTERPRISE (new in V3 — migrations 016-020):
enterprise_locations     — branch locations per enterprise account
  columns: id, enterprise_id, location_name, location_code, city,
           address, manager_user_id, spending_limit_usd, is_active, created_at

recurring_contracts      — recurring service contracts
  columns: id, enterprise_id, location_id, worker_id, category_id,
           schedule_type, schedule_days[], schedule_time, job_description,
           agreed_price_usd, auto_pay, status, starts_at, ends_at, created_at

enterprise_vendors       — preferred vendor list per enterprise account
  columns: id, enterprise_id, worker_id, added_by, worker_confirmed,
           confirmed_at, notes, created_at
  constraint: UNIQUE(enterprise_id, worker_id)

sla_contracts            — SLA settings per enterprise account
  columns: id, enterprise_id, sla_type, response_hours,
           credit_percentage, is_active, created_at

sla_breach_log           — record of every SLA breach and credit issued
  columns: id, enterprise_id, booking_id, sla_type, expected_by,
           worker_arrived_at, breach_minutes, credit_issued_usd,
           resolved, created_at

enterprise_invoices      — monthly consolidated invoices
  columns: id, enterprise_id, invoice_number, billing_period_start,
           billing_period_end, total_jobs, subtotal_usd, commission_usd,
           total_due_usd, status, due_date, paid_at, pdf_url, created_at

MIGRATION RUN ORDER (complete — V2 + V3 additions):
001_core_tables.sql
002_bookings_messages.sql
003_security_payments.sql
004_rls_policies.sql
005_security_functions.sql
006_mvp_verification_escrow.sql
007_customer_verification.sql
008_worker_safety.sql
009_spotlight_system.sql
010_business_profiles.sql
011_wiam_trust_score.sql
012_emergency_mode.sql
013_instant_quote_system.sql
014_subscription_config.sql
015_performance_rankings.sql
016_enterprise_locations.sql
017_recurring_contracts.sql
018_enterprise_vendors.sql
019_sla_contracts.sql
020_enterprise_invoices.sql
categories_seed.sql (ALWAYS LAST)

RLS RULE — ABSOLUTE:  
Every table has RLS enabled.  
Users can ONLY read and modify their own data.  
Admin operations ALWAYS go through backend with service role key.  
The service role key lives ONLY in Render environment variables.  
It NEVER goes in the app. It NEVER goes in GitHub.

═══════════════════════════════════════════════════════════════  
SECTION 20 — COMPLETE API ENDPOINTS  
═══════════════════════════════════════════════════════════════

BASE URL: https://api.wiamapp.com  
AUTH HEADER: Authorization: Bearer {JWT\_TOKEN}  
RESPONSE FORMAT: { success: true, data: {...} } or { success: false, error: "message" }

AUTH (/api/auth):  
POST /register               Register new user  
POST /login                  Login (Supabase handles token generation)  
GET  /me                     Get current user full profile  
POST /send-otp               Send 6-digit OTP to email via Resend  
POST /verify-otp             Verify OTP, mark email confirmed  
POST /forgot-password        Send password reset email  
POST /reset-password         Set new password  
POST /logout                 Clear session  
DELETE /account              Delete account (GDPR)

WORKERS (/api/workers):  
GET  /                       All workers (filters: category, city, verified, available)  
GET  /:id                    Single worker full profile  
GET  /search/:query          Search by name or skill  
PATCH /availability          Toggle availability  
GET  /meta/categories        All 12 categories with subtypes  
POST /profile                Create worker profile  
PUT  /profile                Update worker profile  
POST /portfolio              Add portfolio image  
DELETE /portfolio/:imageId   Remove portfolio image  
GET  /:id/contact            Get phone number (after booking \+ payment only)

BOOKINGS (/api/bookings):  
POST /                       Create booking request  
GET  /                       All bookings for current user  
GET  /pending                Pending bookings for worker  
GET  /:id                    Single booking full details  
PATCH /:id/accept            Worker accepts  
PATCH /:id/reject            Worker rejects  
PATCH /:id/complete          Worker marks complete  
PATCH /:id/confirm           Customer confirms complete  
PATCH /:id/cancel            Cancel booking  
PATCH /:id/dispute           Raise dispute  
POST /:id/review             Customer reviews worker  
POST /:id/rate-customer      Worker rates customer (private)

TRUST SYSTEM (/api/trust):  
POST /worker/:workerProfileId     Customer trusts a worker  
DELETE /worker/:workerProfileId   Customer removes trust  
GET  /worker/:workerProfileId     Check if customer trusts this worker  
POST /business/:businessId        Customer follows a business  
DELETE /business/:businessId      Customer unfollows business  
GET  /my-trusted-workers          Customer sees all workers they trust  
GET  /my-followed-businesses      Customer sees businesses they follow  
GET  /worker/:id/count            Get trust count for worker

SAFETY (/api/safety):  
POST /sos                    Trigger SOS emergency alert  
POST /check-in               GPS check-in at job location  
POST /check-out              GPS check-out from job  
PUT  /emergency-contact      Update emergency contact  
GET  /emergency-contact      Get emergency contact  
POST /rate-customer          Worker rates customer

UPLOADS (/api/uploads):  
POST /avatar                 Upload avatar (public R2)  
POST /portfolio              Upload portfolio image (public R2)  
POST /voice                  Upload voice message (public R2)  
POST /worker-document        Upload worker ID doc (private R2)  
POST /worker-selfie          Upload worker selfie (private R2)  
POST /customer-document      Upload customer ID doc (private R2)  
POST /customer-selfie        Upload customer selfie (private R2)  
POST /business-document      Upload business doc (private R2)  
POST /spotlight-media        Upload spotlight image/video (public R2)

VERIFICATION (/api/verify):  
POST /worker/submit          Submit worker docs for review  
GET  /worker/status          Worker verification status  
POST /customer/submit        Submit customer docs for review  
POST /customer/selfie        Monthly customer selfie re-verification  
GET  /customer/status        Customer verification status  
POST /admin/approve/:id      Admin approves (admin only)  
POST /admin/reject/:id       Admin rejects with reason (admin only)  
GET  /admin/queue            Pending queue (admin only)  
GET  /admin/document/:key    Signed URL for private doc (admin only, 15min)

PAYMENTS (/api/payments):  
POST /initiate               Start Paystack booking payment  
GET  /verify/:ref            Verify Paystack payment  
POST /escrow/release         Release escrow after job confirmed  
GET  /history                Payment history for current user

WEBHOOKS (/api/webhooks):  
POST /revenuecat             RevenueCat subscription events  
POST /paystack               Paystack payment confirmation

NOTIFICATIONS (/api/notifications):  
GET  /                       All notifications  
GET  /unread-count           Unread count for bell badge  
PATCH /:id/read              Mark one as read  
PATCH /read-all              Mark all as read  
DELETE /:id                  Delete notification  
POST /push-token             Register Expo push token

SPOTLIGHT (/api/spotlight):  
GET  /                       Approved posts feed  
POST /                       Create new post (Basic+ only)  
PATCH /:id                   Update own post  
DELETE /:id                  Delete own post  
POST /:id/boost              Pay to boost post  
POST /:id/report             Report inappropriate post  
PATCH /admin/:id/approve     Admin approves (admin only)  
PATCH /admin/:id/reject      Admin rejects (admin only)

QUOTES (/api/quotes):  
POST /                       Customer creates quote request  
POST /:requestId/submit      Worker submits quote  
POST /:requestId/select/:quoteId  Customer selects quote → creates booking  
GET  /:requestId/quotes      All quotes for a request  
GET  /my-requests            Customer's open quote requests

EMERGENCY (/api/emergency):  
POST /                       Customer triggers emergency mode  
POST /:id/accept             Worker accepts emergency job  
GET  /open                   Open emergency requests (for workers)

RANKINGS (/api/rankings):  
GET  /                       Get ranked workers by category and city  
GET  /my-ranking             Worker sees their own ranking  
POST /recalculate            Recalculate all rankings (admin/cron)

BUSINESS (/api/business):  
POST /apply                  Apply for Business Account  
GET  /profile                Get business profile  
PUT  /profile                Update business profile  
GET  /analytics              Business analytics dashboard  
POST /team/add               Add worker to team  
DELETE /team/:workerId       Remove worker from team  
GET  /team                   Get all team workers

ONLINE (/api/online):  
POST /heartbeat              Update last\_seen (every 60 seconds)  
POST /offline                Mark as offline  
POST /status                 Get online status for multiple users

CURRENCY (/api/currency):  
GET  /rates                  Current exchange rates  
GET  /subscription-prices    All plan prices in local currency  
GET  /convert                Convert USD amount to local currency

TEAM (/api/team):  
POST /login                  Team member login with WiaMid code  
POST /founder-login          Founder login  
POST /create-member          Create new team member (founder only)  
POST /renew-code/:memberId   Generate new WiaMid code  
GET  /members                All team members (founder only)  
PATCH /deactivate/:memberId  Deactivate team member

ADMIN (/api/admin):  
GET  /dashboard              Platform overview stats  
GET  /users                  Search all users  
GET  /users/:userId          Full user profile with history  
PATCH /users/:userId/suspend Suspend user  
PATCH /users/:userId/reactivate Reactivate user  
GET  /verification-queue     Pending verifications  
GET  /document-url/:s3Key    Signed URL for private doc (15min)  
POST /verification/approve/:id Approve verification  
POST /verification/reject/:id  Reject verification  
GET  /fraud-reports          All fraud reports  
PATCH /fraud-reports/:id     Update fraud report status  
GET  /commission-report      Commission earnings report  
GET  /pricing                All subscription config  
PUT  /pricing/:planKey       Update subscription price (USD)  
GET  /sos-alerts             Unresolved SOS alerts  
PATCH /sos-alerts/:id/resolve Mark SOS resolved

ENTERPRISE (/api/enterprise) — Enterprise plan accounts only:
GET  /locations                  All branch locations for enterprise account
POST /locations                  Add new branch location
PUT  /locations/:id              Update branch location
DELETE /locations/:id            Remove branch location
GET  /locations/:id/bookings     All bookings for a specific location
GET  /recurring                  All recurring contracts
POST /recurring                  Create new recurring contract
PATCH /recurring/:id             Update recurring contract
PATCH /recurring/:id/pause       Pause recurring contract
PATCH /recurring/:id/end         End recurring contract
GET  /vendors                    Enterprise's preferred vendor list
POST /vendors/:workerId          Add worker to vendor list
DELETE /vendors/:workerId        Remove worker from vendor list
GET  /sla                        SLA contract settings
PUT  /sla                        Update SLA settings
GET  /sla/breaches               SLA breach history
GET  /invoices                   All monthly invoices
GET  /invoices/:id               Single invoice with full breakdown
GET  /invoices/:id/pdf           Download invoice PDF
GET  /analytics                  Full cross-location analytics
GET  /api-keys                   Enterprise API keys (Phase 4)
POST /api-keys/regenerate        Regenerate API key (Phase 4)

═══════════════════════════════════════════════════════════════  
SECTION 21 — COMPLETE SCREEN LIST (60 SCREENS)  
═══════════════════════════════════════════════════════════════

FORMAT: ScreenName | Data Source | Backend Call

ONBOARDING (3 screens):  
SplashScreen          | local auth check    | supabase.auth.getSession()  
LandingScreen         | static content      | none (marketing only)  
OnboardingScreen      | none                | navigate based on selection

AUTH (5 screens):  
LoginScreen           | Supabase Auth       | supabase.auth.signIn()  
RegisterScreen        | Supabase Auth       | POST /api/auth/register  
EmailOTPScreen        | local              | POST /api/auth/verify-otp  
ForgotPasswordScreen  | Resend             | POST /api/auth/forgot-password  
ResetPasswordScreen   | Supabase Auth       | POST /api/auth/reset-password

CUSTOMER VERIFICATION (4 screens):  
CustomerVerifyIntroScreen   | static          | none  
CustomerIDUploadScreen      | R2 upload       | POST /api/uploads/customer-document  
CustomerSelfieScreen        | R2 upload       | POST /api/uploads/customer-selfie  
CustomerVerifyPendingScreen | Supabase        | GET /api/verify/customer/status

WORKER VERIFICATION (6 screens):  
WorkerVerifyIntroScreen     | static          | none  
IDTypeScreen                | local           | none  
IDUploadScreen              | R2 upload       | POST /api/uploads/worker-document  
WorkerSelfieScreen          | R2 upload       | POST /api/uploads/worker-selfie  
VerificationPendingScreen   | Supabase        | GET /api/verify/worker/status  
VerificationApprovedScreen  | local           | none  
VerificationRejectedScreen  | Supabase        | GET /api/verify/worker/status

CUSTOMER SCREENS (17 screens):  
CustomerHomeScreen     | Backend API         | GET /api/workers \+ GET /api/spotlight  
SearchScreen           | Backend API         | GET /api/workers (with filters)  
CategoryScreen         | Backend API         | GET /api/workers?category=X  
WorkerProfileScreen    | Backend API         | GET /api/workers/:id \+ GET /api/trust/worker/:id  
QuoteRequestScreen     | Backend API         | POST /api/quotes  
QuotesListScreen       | Backend API         | GET /api/quotes/:requestId/quotes  
BookingFormScreen      | local form          | POST /api/bookings  
BookingConfirmScreen   | local (review form) | none  
BookingSuccessScreen   | local              | none  
BookingsListScreen     | Backend API         | GET /api/bookings  
BookingDetailScreen    | Backend API         | GET /api/bookings/:id  
PaymentScreen          | Backend+Paystack    | POST /api/payments/initiate  
PaymentSuccessScreen   | local              | none  
ChatListScreen         | Backend API         | GET all conversations  
ChatScreen             | Supabase Realtime   | supabase.channel('messages:bookingId')  
ReviewScreen           | Backend API         | POST /api/bookings/:id/review  
CustomerProfileScreen  | Backend API         | GET /api/auth/me  
NotificationsScreen    | Backend API         | GET /api/notifications  
EmergencyModeScreen    | Backend API         | POST /api/emergency  
CustomerSafetyScreen   | Backend API         | PUT /api/safety/emergency-contact

WORKER SCREENS (12 screens):  
WorkerDashboardScreen     | Backend API      | GET /api/bookings/pending \+ GET /api/rankings/my-ranking  
WorkerJobsScreen          | Backend API      | GET /api/bookings  
JobDetailScreen           | Backend API      | GET /api/bookings/:id  
EarningsScreen            | Backend API      | GET /api/payments/history  
WorkerProfileEditScreen   | Backend API      | GET /api/auth/me \+ PUT /api/workers/profile  
PortfolioManagerScreen    | Backend API      | GET worker portfolio \+ POST /api/uploads/portfolio  
SkillsManagerScreen       | Backend API      | GET /api/workers/meta/categories  
SpotlightManagerScreen    | Backend API      | GET /api/spotlight (own posts)  
WorkerNotificationsScreen | Backend API      | GET /api/notifications  
WorkerSafetyScreen        | Backend API      | GET /api/safety/emergency-contact  
SubscriptionScreen        | RevenueCat       | getSubscriptionPackages()  
AvailabilityCalendarScreen| Backend API      | PATCH /api/workers/availability

BUSINESS SCREENS (5 screens):  
BusinessApplicationScreen | Backend API      | POST /api/business/apply  
BusinessDashboardScreen   | Backend API      | GET /api/business/profile  
TeamManagementScreen      | Backend API      | GET /api/business/team  
BusinessAnalyticsScreen   | Backend API      | GET /api/business/analytics  
BusinessSpotlightScreen   | Backend API      | GET /api/spotlight (own posts)

ADMIN SCREENS (web only — 8 screens):  
AdminDashboardScreen         | Backend API   | GET /api/admin/dashboard  
DocumentQueueScreen          | Backend API   | GET /api/admin/verification-queue  
DocumentReviewScreen         | Backend API   | GET /api/admin/document-url/:key  
FraudReportsScreen           | Backend API   | GET /api/admin/fraud-reports  
CommissionReportScreen       | Backend API   | GET /api/admin/commission-report  
PricingManagerScreen         | Backend API   | GET /api/admin/pricing \+ PUT /api/admin/pricing/:planKey  
SOSAlertsScreen              | Backend API   | GET /api/admin/sos-alerts  
UserManagementScreen         | Backend API   | GET /api/admin/users

PUBLIC WEB SCREENS (wiamapp.com — Phase 2):
HomePage                  | static + API  | marketing page, download links, app badges
BrowsePage                | Backend API   | GET /api/workers (public read, SEO indexed)
WorkerPublicProfilePage   | Backend API   | GET /api/workers/:id (SEO — drives installs)
PremiumPage               | Backend API   | GET /api/currency/subscription-prices
CareersPage               | Backend API   | GET career positions (from Section 17)
TermsPage                 | static        | none
PrivacyPage               | static        | none
DataDeletionPage          | Backend API   | DELETE /api/auth/account
ContactPage               | static        | none

BUSINESS WEB PORTAL SCREENS (wiamapp.com/business/* — Phase 3):
Note: All require business account login. Features gated by subscription tier.

BusinessLoginPage         | Supabase Auth | supabase.auth.signIn()
--- ALL TIERS (Starter, Growth, Enterprise) ---
StarterDashboardPage      | Backend API   | GET /api/business/profile + GET /api/business/analytics
BusinessBookingsPage      | Backend API   | GET /api/bookings
TeamManagementWebPage     | Backend API   | GET /api/business/team
BusinessAnalyticsWebPage  | Backend API   | GET /api/business/analytics
BusinessSpotlightWebPage  | Backend API   | GET /api/spotlight
CompanyProfileWebPage     | Backend API   | GET /api/auth/me + PUT /api/workers/profile
BusinessSettingsWebPage   | Backend API   | GET /api/business/profile
--- GROWTH AND ENTERPRISE ONLY ---
JobAssignmentPage         | Backend API   | PATCH /api/bookings/:id + GET /api/business/team
RecurringContractsPage    | Backend API   | GET /api/business/recurring
AdvancedAnalyticsPage     | Backend API   | GET /api/business/analytics (full export)
AccountManagerChatPage    | Backend API   | direct communication channel with WiamLabs
--- ENTERPRISE ONLY ---
MultiLocationPage         | Backend API   | GET /api/enterprise/locations
LocationDetailPage        | Backend API   | GET /api/enterprise/locations/:id
SLADashboardPage          | Backend API   | GET /api/enterprise/sla
VendorDatabasePage        | Backend API   | GET /api/enterprise/vendors
InvoicingPage             | Backend API   | GET /api/enterprise/invoices
EnterpriseAnalyticsPage   | Backend API   | GET /api/enterprise/analytics
APIManagementPage         | Backend API   | GET /api/enterprise/api-keys (Phase 4)
EnterpriseSettingsPage    | Backend API   | GET /api/enterprise/settings

═══════════════════════════════════════════════════════════════  
SECTION 22 — PLATFORM PROTECTION SYSTEM  
═══════════════════════════════════════════════════════════════

PROTECTION 1: HIDDEN PHONE NUMBERS  
Both worker and customer phone numbers hidden until:  
1\. Booking created \+ Worker accepted \+ Customer paid  
All three conditions must be true simultaneously.  
Backend controls this — not the frontend.

PROTECTION 2: ESCROW PAYMENT  
Customer pays → Backend creates escrow record  
Job confirmed → Backend initiates Paystack transfer  
Commission deducted before transfer  
Worker cannot request payment early

PROTECTION 3: CHAT MONITORING  
Every message scanned before delivery in backend  
Flags: phone number patterns, payment app names, suspicious phrases  
Flagged message → replaced with warning text → worker strike logged

PROTECTION 4: STRIKE SYSTEM  
Strike 1: Warning notification to worker  
Strike 2: Spotlight access suspended  
Strike 3: Account auto-suspended → admin review required

PROTECTION 5: REVIEW GATING  
Only customers with a confirmed completed booking can review that worker  
Database enforced via UNIQUE constraint on (booking\_id) in reviews table  
Cannot be bypassed by frontend tricks

PROTECTION 6: PLATFORM REPORT BUTTON  
"Did this worker/customer ask to pay outside the app?" button  
If yes: fraud\_reports record created \+ admin notified  
Worker suspended pending review

PROTECTION 7: TRUST SYSTEM VALUE LOCK  
Workers who build trust count, reviews, and WiamTrust Score  
have a strong incentive to stay on the platform.  
Leaving WiamApp means losing everything built.

═══════════════════════════════════════════════════════════════  
SECTION 23 — COMPLETE TECH STACK  
═══════════════════════════════════════════════════════════════

MOBILE APP:  
React Native \+ Expo SDK 51  
React Navigation v6 (Stack \+ Bottom Tabs)  
AsyncStorage (session persistence)  
expo-image-picker (camera for documents and portfolios)  
expo-av (voice recording and playback)  
expo-location (GPS for safety features)  
expo-notifications (push notifications)  
expo-device (device fingerprinting)  
expo-linking (deep links and external URLs)  
react-native-purchases (RevenueCat SDK)  
Ionicons (all icons — no other icon library)

BACKEND:  
Node.js 18+ with ES Modules  
Express.js 4.x  
Helmet (HTTP security headers)  
CORS (origin control)  
express-rate-limit (abuse prevention)  
Multer \+ memoryStorage (file upload handling)  
@aws-sdk/client-s3 (Cloudflare R2 via S3-compatible API)  
@aws-sdk/s3-request-presigner (signed URLs)  
@supabase/supabase-js (database and auth)  
resend (email service)  
crypto (WiaMid code hashing — built into Node.js)  
dotenv (environment variables)

DATABASE:  
Supabase PostgreSQL  
Supabase Auth  
Supabase Realtime  
Row Level Security (RLS) on all tables

FILE STORAGE:  
Cloudflare R2 (public bucket: avatars, portfolio, voice, spotlight)  
Cloudflare R2 (private bucket: ID docs, selfies — signed URLs 15min)

PAYMENTS:  
RevenueCat (in-app subscriptions and boosts — Apple \+ Google)  
Paystack (booking payments in-app, all payments on website)

EMAIL:  
Resend (3,000 free/month)

CURRENCY:  
Open Exchange Rates API (free, daily updates)

DEPLOYMENT:  
GitHub (WiamLabs/WiamApp private repository)  
Render (backend server — free tier, Node.js, Frankfurt)  
Cloudflare Pages (website — free, unlimited bandwidth)  
Cloudflare DNS (domain management — free)  
Expo EAS (app builds for App Store and Google Play)

WEBSITE:  
Next.js 14 (App Router)  
Tailwind CSS  
Paystack.js (subscription payments)  
Same Supabase Auth (shared user accounts with app)

TOTAL MONTHLY COST AT LAUNCH: GHS 0 / $0

═══════════════════════════════════════════════════════════════  
SECTION 24 — STRICT AI DEVELOPMENT RULES (V3)  
═══════════════════════════════════════════════════════════════

These rules apply to Cursor, Windsurf, Claude, ChatGPT, and all AI tools.  
No exception. No negotiation. No deviation.

RULE 1 — READ FIRST, CODE SECOND:  
Read the entire master plan before generating any code.  
If a feature is not in this plan, do not build it.  
If something is unclear, ask before building.

RULE 2 — FILE STRUCTURE IS LAW:  
New screens → screens/  
New API calls → lib/api/  
New backend routes → backend/routes/  
New backend utilities → backend/lib/  
New database changes → database/migrations/ (numbered sequentially)  
No file goes anywhere else. No exceptions.

RULE 3 — COPYRIGHT HEADER MANDATORY:  
Every single file starts with:  
// © 2026 WiamApp. Powered by WiamLabs

No exceptions. Every file. Including migration SQL files.

RULE 4 — COLORS ARE IMPORTED, NEVER HARDCODED:  
import { Colors } from '../constants/colors';  
Never: backgroundColor: '\#D4A017'  
Always: backgroundColor: Colors.gold  
If you write a hex code anywhere outside colors.js, you are wrong.

RULE 5 — DATA FLOWS ARE STRICT:  
Sensitive data → Backend → Supabase (service role)  
Public data → Supabase directly (anon key, RLS protected)  
File uploads → Backend → R2 (never direct from app to R2)  
Payments → Backend → Paystack (never direct from app)  
Subscriptions → RevenueCat SDK (Apple/Google IAP)  
Admin operations → Backend with admin verification middleware

RULE 6 — EVERY BACKEND ROUTE MUST:  
1\. Validate the JWT token (call verifyUserToken())  
2\. Validate all input fields before processing  
3\. Return { success: true, data: ... } or { success: false, error: ... }  
4\. Include try/catch with meaningful error messages  
5\. Log important actions to audit\_logs table

RULE 7 — PHONE NUMBERS ARE HIDDEN:  
Worker phone number: NEVER returned in any API response  
until booking exists AND accepted AND payment confirmed.  
Customer phone number: NEVER returned to worker until  
booking exists AND accepted AND payment confirmed.  
Backend enforces this — not frontend.

RULE 8 — MONEY IS ALWAYS USD IN DATABASE:  
Never store GHS, NGN, or any local currency in the database.  
Always store amount\_usd as DECIMAL(10,4).  
Display layer converts using /api/currency/rates.  
subscription\_config table is the single source of truth for prices.

RULE 9 — EVERY TABLE NEEDS RLS:  
Every new Supabase table must have:  
ALTER TABLE table\_name ENABLE ROW LEVEL SECURITY;  
And at minimum one policy.  
Copy patterns from 004\_rls\_policies.sql.

RULE 10 — MIGRATIONS ARE APPEND-ONLY:  
Never modify an existing migration file.  
Create a new numbered migration for every database change.  
Migration files never deleted.  
Production database only gets new migrations, never modified ones.

RULE 11 — AUDIT LOGS FOR EVERYTHING IMPORTANT:  
Every important action must be logged:  
await supabaseAdmin.from('audit\_logs').insert({  
  user\_id: user.id,  
  action: 'action\_name',  
  metadata: { relevant: 'context' }  
});

RULE 12 — THEME MUST WORK IN BOTH MODES:  
Every screen must work correctly in light AND dark mode.  
Test both before marking a screen complete.  
Worker screens always dark (Navy background).  
Customer screens default White, user can switch to dark.  
Gold buttons always gold in both modes — this is the law.

RULE 13 — ONLINE DOT AND AVATARS:  
Profile pictures (avatars) appear in EVERY place a user is shown.  
Green online dot appears beside every avatar.  
This is mandatory — not optional decoration.  
Status comes from user\_online\_status table via Supabase Realtime.

RULE 14 — ERROR STATES ARE MANDATORY:  
Every screen must handle three states:  
1\. Loading state (spinner or skeleton)  
2\. Error state (human-friendly message \+ retry button)  
3\. Empty state (illustration \+ helpful text)  
Never show a blank screen. Never show a raw error message.

RULE 15 — FREE TIER FIRST:  
Never add any service requiring payment before the first booking.  
If a service has no free tier, find a free alternative first.  
Document the free tier limit of every service used.

RULE 16 — WIAMID CODES ARE NEVER PLAIN TEXT IN DB:  
WiaMid codes stored as SHA-256 hash with WIAMID\_SALT.  
Plain text code shown ONCE after generation.  
Never logged. Never stored anywhere except the hash.  
This is a security requirement, not a suggestion.

RULE 17 — TRUST SYSTEM IS NOT SOCIAL MEDIA:  
Workers get "Trust" (❤️ heart system)  
Businesses get "Follow" / "Subscribe"  
No generic "Follow" for individual workers  
No "Like" on anything except Spotlight posts (optional — Phase 2\)  
No comments on Spotlight posts (keeps it professional)  
No public follower lists (workers see trust count, not who trusts them publicly)

═══════════════════════════════════════════════════════════════  
SECTION 25 — FILE PLACEMENT GUIDE  
═══════════════════════════════════════════════════════════════

YOUR MAIN PROJECT FOLDER: C:\\WiamLabs\\WiamAppExpo\\

ALL FILES I HAVE GIVEN YOU AND WHERE THEY GO:

FROM PAYMENT ARCHITECTURE SESSION:  
backend\_webhooks.js         → backend/routes/webhooks.js (RENAME)  
backend\_exchangeRates.js    → backend/lib/exchangeRates.js (RENAME)  
migrations\_007\_to\_015.sql   → database/migrations/007\_to\_015.sql (RENAME)  
lib\_revenuecat.js           → lib/api/revenuecat.js (RENAME)  
PAYMENT\_ARCHITECTURE.md     → docs/PAYMENT\_ARCHITECTURE.md (CREATE docs folder)

FROM V3 CODING SESSION:  
backend/server.js           → backend/server.js (REPLACE existing file)  
backend/routes/safety.js    → backend/routes/safety.js (NEW FILE)  
backend/routes/online.js    → backend/routes/online.js (NEW FILE)  
backend/routes/currency.js  → backend/routes/currency.js (NEW FILE)  
backend/routes/emergency.js → backend/routes/emergency.js (NEW FILE)  
backend/routes/quotes.js    → backend/routes/quotes.js (NEW FILE)  
backend/routes/team.js      → backend/routes/team.js (NEW FILE)  
backend/routes/admin.js     → backend/routes/admin.js (NEW FILE)  
backend/routes/rankings.js  → backend/routes/rankings.js (NEW FILE)  
backend/routes/business.js  → backend/routes/business.js (NEW FILE)  
backend/routes/spotlight.js → backend/routes/spotlight.js (NEW FILE)  
database/migrations/016\_team\_members.sql → database/migrations/016\_team\_members.sql (NEW)  
screens/LandingScreen.js    → screens/LandingScreen.js (NEW FILE)  
screens/SubscriptionScreen.js → screens/SubscriptionScreen.js (NEW FILE)

STILL NEED TO BE CODED (next session):  
backend/routes/trust.js           (Trust and Follow system)  
database/migrations/017\_trust\_system.sql  
database/migrations/018\_enhanced\_profiles.sql  
screens/EmergencyModeScreen.js  
screens/WorkerSafetyScreen.js  
screens/CustomerSafetyScreen.js  
screens/QuoteRequestScreen.js  
screens/QuotesListScreen.js  
screens/WorkerRankingsScreen.js  
Updated App.js (with RevenueCat init \+ LandingScreen in nav)  
Updated CustomerHomeScreen.js (with Trust button and online dots)  
Updated WorkerProfileScreen.js (with Trust count and Trust button)  
lib/api/trust.js (Trust API calls)  
lib/hooks/useOnlineStatus.js (Online status hook)  
lib/hooks/usePushNotifications.js (Push notification setup)

═══════════════════════════════════════════════════════════════  
SECTION 26 — RENDER FIX INSTRUCTIONS  
═══════════════════════════════════════════════════════════════

Your Render shows 3 suspended services:  
wiamapp-backend  — KEEP and fix  
wiamtrade-api   — DELETE (old project)  
Old WiamApp     — DELETE (old project)

TO FIX wiamapp-backend:  
1\. Click wiamtrade-api → Settings → Delete Service → confirm  
2\. Click Old WiamApp → Settings → Delete Service → confirm  
3\. Click wiamapp-backend  
4\. Go to Settings:  
   \- Build Command: npm install  
   \- Start Command: node backend/server.js  
   \- Node Version: 18 or higher  
5\. Go to Environment:  
   \- Add ALL variables from Section 3 of this document  
6\. Click Manual Deploy or Resume  
7\. Wait 2-3 minutes for deployment  
8\. Test: visit https://wiamapp-backend.onrender.com  
   Should see: {"app": "WiamApp Backend", "status": "running"}

CRITICAL: Do not add environment variables to GitHub.  
They go ONLY in Render environment settings.  
The .env file on your computer stays only on your computer.

═══════════════════════════════════════════════════════════════  
SECTION 27 — DATABASE MIGRATION RUN ORDER  
═══════════════════════════════════════════════════════════════

Go to supabase.com → Your WiamApp Project → SQL Editor → New Query  
Paste each file content and click Run — IN THIS ORDER:

001_core_tables.sql
002_bookings_messages.sql
003_security_payments.sql
004_rls_policies.sql
005_security_functions.sql
006_mvp_verification_escrow.sql
007_to_015.sql               ← the combined file
016_team_members.sql
017_trust_system.sql         ← to be created next session
018_enhanced_profiles.sql    ← to be created next session
019_enterprise_locations.sql ← new in V3
020_recurring_contracts.sql  ← new in V3
021_enterprise_vendors.sql   ← new in V3
022_sla_contracts.sql        ← new in V3
023_enterprise_invoices.sql  ← new in V3
categories_seed.sql          ← ALWAYS LAST

VERIFY ALL TABLES CREATED:  
SELECT table\_name FROM information\_schema.tables  
WHERE table\_schema \= 'public'  
ORDER BY table\_name;

You should see at least 35 tables when complete.

═══════════════════════════════════════════════════════════════  
SECTION 28 — TESTING CHECKLIST (COMPLETE)  
═══════════════════════════════════════════════════════════════

BEFORE TESTING EXPO GO — CHECKLIST:  
\[ \] All migrations run in Supabase SQL Editor  
\[ \] All environment variables added to Render  
\[ \] Render service is running (green, not suspended)  
\[ \] .env file created locally with correct Supabase keys  
\[ \] npm install run in project folder  
\[ \] npx expo start runs without errors  
\[ \] QR code visible in terminal

AUTH FLOW TESTING:  
\[ \] Register as customer → email OTP arrives → verify → home screen  
\[ \] Register as worker → email OTP → verification upload screen  
\[ \] Login with correct credentials → correct screen  
\[ \] Login with wrong password → clear error message (not technical error)  
\[ \] Logout → returns to landing screen → session cleared

CUSTOMER VERIFICATION TESTING:  
\[ \] Tap "Book Now" without verification → verification prompt appears  
\[ \] Upload Ghana Card front \+ back → selfie → submitted  
\[ \] Admin dashboard shows new submission  
\[ \] Admin approves → customer gets email \+ push notification  
\[ \] Admin rejects with reason → customer gets email with reason  
\[ \] Customer tries to book again → booking proceeds

BOOKING FLOW TESTING:  
\[ \] Customer browses workers → no phone numbers visible  
\[ \] Create booking → worker receives notification  
\[ \] Worker accepts → chat opens → still no phone  
\[ \] Customer pays via Paystack → phone numbers revealed  
\[ \] Worker checks in → customer notified  
\[ \] Worker marks complete → customer confirms → payment released  
\[ \] Commission deducted correctly (check platform\_earnings table)

TRUST SYSTEM TESTING:  
\[ \] Worker profile shows Trust button (verified workers only)  
\[ \] Tap Trust → count increases → button changes to Trusted  
\[ \] Tap Trusted → count decreases → button reverts  
\[ \] Business profile shows Follow button  
\[ \] Follow business → get notification when they post Spotlight  
\[ \] Trust count shows on worker dashboard

SAFETY TESTING:  
\[ \] SOS button appears in Safety screen  
\[ \] Hold SOS 3 seconds → admin receives notification in dashboard  
\[ \] Check-in records GPS in worker\_safety\_events table  
\[ \] Emergency contact saved and retrievable

ONLINE STATUS TESTING:  
\[ \] Green dot visible beside active workers in search  
\[ \] Dot changes to yellow after 5 minutes of inactivity  
\[ \] Dot disappears after 30 minutes  
\[ \] Real-time update (no screen refresh needed)

SUBSCRIPTION TESTING:  
\[ \] Subscription screen shows 3 plans correctly  
\[ \] RevenueCat sandbox purchase completes without error  
\[ \] Badge appears on profile after purchase  
\[ \] Commission rate changes after plan upgrade  
\[ \] Restore purchases works after reinstall

ADMIN DASHBOARD TESTING:  
\[ \] Document review queue shows pending submissions  
\[ \] Signed URL generated for ID document (opens in browser)  
\[ \] Approve button sends email and updates badge  
\[ \] Reject with reason sends email with reason  
\[ \] Pricing update changes prices in subscription\_config table  
\[ \] App shows new prices next time subscription screen opens  
\[ \] SOS alert appears in admin dashboard when triggered  
\[ \] Fraud report appears when filed by user

═══════════════════════════════════════════════════════════════  
QUICK REFERENCE CARD  
═══════════════════════════════════════════════════════════════

BRAND: Navy #08081A | Gold #D4A017 | White #FFFFFF | Online #22C55E
STACK: Expo + Next.js + Supabase + R2 + Resend + Paystack + RevenueCat + Render/Vercel
MONEY IN DB: Always USD decimal | Display converts via Open Exchange Rates
COMMISSIONS: Free=15% | Basic=10% | Pro=7% | Business=7-8%
BADGES: Free=None | Basic=🔵 | Pro=🔵⭐ | Business=🟡 | Enterprise=🟡👑
TRUST: Workers get ❤️ Trust count | Businesses get Follow/Subscribe
CHAT: Opens after worker accepts (before payment) | Phone after payment
VERIFICATION: Customer — first booking + monthly selfie + 6mo full
WORKER VERIFY: ID+selfie → admin 24hr review → badge after subscription
SPOTLIGHT: Basic+ workers and businesses only | Professional content only
EMERGENCY: +20% premium | First worker to accept wins | 2hr expiry
WIAMID: WiaMid+6chars=12total | SHA-256 hashed | Expires 10 days
FOUNDER: founder@wiamapp.com | 2FA mandatory on ALL services

WHO USES WHAT:
  Customers → Expo mobile ONLY
  Individual Workers → Expo mobile ONLY
  Business Accounts → Expo mobile + wiamapp.com/business (BOTH)
  WiamLabs Team → app.wiamlabs.com ONLY

PLATFORM SEPARATION (enforced at backend level):
  Business portal: wiamapp.com/business/* (team can NEVER access)
  Team dashboard: app.wiamlabs.com/* (businesses can NEVER access)

WEBVIEW IN EXPO: Terms, Privacy, Help only — NEVER booking/payment/chat
TEAM LOGIN: wiamlabs@gmail.com + WiaMid → app.wiamlabs.com/team
GITHUB: github.com/WiamLabs/WiamApp (Private)
BACKEND: api.wiamapp.com (Render — Frankfurt)
WEBSITE: wiamapp.com (Cloudflare Pages / Vercel)
COST AT LAUNCH: $0/month

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  
Version: 3.0 FINAL STRICT — Updated June 2026
© 2026 WiamApp. Powered by WiamLabs. All rights reserved.
CONFIDENTIAL — Do not share outside WiamLabs.
© 2026 WiamApp. Powered by WiamLabs. All rights reserved.  
CONFIDENTIAL — Do not share outside WiamLabs.  
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  
ENDOFFILE  
echo "Master Plan V3 created"
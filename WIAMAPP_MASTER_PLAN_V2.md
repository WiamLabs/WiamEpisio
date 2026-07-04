# 🌍 WIAMAPP — COMPLETE MASTER PLAN V2
## The Official End-to-End Product, Technical & Business Blueprint
### © 2026 WiamApp. Powered by WiamLabs
### Founder: Martin | wiamapp.com | github.com/WiamLabs/WiamApp

---

> **THIS DOCUMENT IS THE SINGLE SOURCE OF TRUTH FOR WIAMAPP.**
> Every developer, every AI tool (Cursor, Claude, ChatGPT, Windsurf),
> and every team member reads this document before writing a single line of code.
> No decision is made without reference to this document.
> Built for Africa. Starting in Accra, Ghana. Expanding across the continent.

---

# ════════════════════════════════════════
# PART 1 — VISION, MISSION & IDENTITY
# ════════════════════════════════════════

## 1.1 What WiamApp Is

WiamApp is Africa's most trusted digital service marketplace.
It connects customers who need skilled workers with verified professionals
who are ready to work — in real time, in their city.

WiamApp is not just an app. It is a movement to formalize Africa's informal economy,
empower workers to earn with dignity, and give customers peace of mind when hiring.

## 1.2 The Problem We Are Solving

**For Customers:**
- Spend hours finding reliable workers through unreliable word of mouth
- Cannot verify if workers are skilled, trustworthy, or legitimate
- Lose money to scammers and unfinished jobs with no recourse
- Have no way to rate or review workers after a bad experience

**For Workers:**
- Inconsistent customer flow — good days and bad weeks
- No platform to build and display their reputation
- Cannot prove their skills to customers they have never met
- No protection against customers who refuse to pay after a job

**The Market Gap:**
No trusted, purpose-built platform exists for the African skilled worker market.
WhatsApp groups, word-of-mouth, and roadside notices are the status quo.
WiamApp changes that.

## 1.3 The Solution

A mobile-first marketplace where:
- Customers search, find, and book verified workers in minutes
- Workers create a profile, get verified, and start earning immediately
- Every payment is protected through an escrow system
- Every transaction is traceable — fraud has consequences
- Trust is built through real verification, real reviews, and real protection

## 1.4 Core Values

1. **TRUST** — Every worker is verified. Every job is traceable. Every payment is protected.
2. **SPEED** — Find a verified worker in under 5 minutes.
3. **EMPOWERMENT** — Workers earn on their own terms. No boss. No middleman.
4. **AFRICAN-FIRST** — Built for African networks, payments, languages, and culture.
5. **SECURITY** — Users are protected before, during, and after every job.
6. **INTEGRITY** — No fake reviews. No fake badges. No fake businesses.

## 1.5 Brand Identity

| Element | Value |
|---|---|
| Company | WiamLabs |
| Product | WiamApp |
| Tagline | Africa's Trusted Service Marketplace |
| Website | wiamapp.com |
| GitHub | github.com/WiamLabs/WiamApp |
| Copyright | © 2026 WiamApp. Powered by WiamLabs |

## 1.6 Brand Colors — The WiamLabs Identity

| Name | Hex | Usage |
|---|---|---|
| Navy | #08081A | Dark backgrounds, worker screens, dark mode |
| Gold | #D4A017 | ALL buttons, badges, accents — never changes |
| White | #FFFFFF | Light backgrounds, cards, light mode |
| Gold Light | #F0C040 | Hover states, highlights |
| Gold Dark | #A07810 | Pressed button states |
| Success | #22C55E | Confirmed, available, approved |
| Error | #EF4444 | Rejected, unavailable, danger |
| Warning | #F59E0B | Pending, under review |
| Info | #3B82F6 | Active, in progress |

**CRITICAL COLOR RULES:**
- Gold buttons (#D4A017) NEVER change between light and dark mode
- Worker screens ALWAYS use Navy background
- Customer screens default to White background
- Copyright footer appears on every screen
- NEVER hardcode hex values — always import from constants/colors.js

---

# ════════════════════════════════════════
# PART 2 — PLATFORM PHILOSOPHY
# ════════════════════════════════════════

## 2.1 No Advertisements — Ever

WiamApp is designed to provide a clean, trusted, and professional marketplace experience.
The platform does not rely on intrusive third-party advertising systems.

**What we will NEVER have:**
- Random banner ads
- Disruptive popup advertisements
- Spam advertising networks
- Third-party ad tracking on users
- Sponsored content that is not clearly labelled

**How WiamApp grows instead:**
- Platform commissions (10% per transaction)
- Worker subscription plans (Basic and Pro)
- Featured worker listings (paid promotion by workers)
- Verified Business Account fees
- Enterprise partnerships and APIs

**Why this matters:**
This allows the platform to maintain:
- A cleaner, faster user experience
- Stronger customer trust
- Better worker visibility
- Higher-quality business participation

WiamApp believes users should focus on finding trusted services — not fighting advertisements.
This is a core part of the WiamLabs brand promise.

## 2.2 No Dark Patterns

WiamApp will NEVER use:
- Hidden subscription charges
- Fake urgency ("Only 2 workers left!")
- Fake reviews or inflated ratings
- Fake verified badges
- Misleading pricing
- Forced account creation to browse

## 2.3 Data Privacy Commitment

- User data is NEVER sold to third parties
- Documents are stored privately and encrypted
- Users can request their data deleted at any time
- Audit logs are kept for security, not for advertising

---

# ════════════════════════════════════════
# PART 3 — USER TYPES & ACCOUNT TIERS
# ════════════════════════════════════════

## 3.1 User Types

There are 5 types of users on WiamApp:

### Type 1 — Customer (Individual)
- Homeowners, renters, families, small business owners
- Needs: find and book a trusted worker fast
- Can browse freely, book workers, pay, rate
- Verification: email OTP only (for MVP)

### Type 2 — Worker (Individual)
- Skilled tradespeople, artisans, freelancers, service providers
- Needs: consistent jobs, a profile to build reputation
- Must complete document verification before accepting jobs
- Earns 90% of agreed price (10% WiamApp commission)

### Type 3 — Business Account (Verified Company)
- Registered companies, agencies, property managers, event companies
- Needs: hire multiple workers, manage jobs at scale
- Strictly verified — requires legal business documents
- Gets Gold Checkmark badge and premium features

### Type 4 — Admin (WiamLabs Team)
- Martin and appointed WiamLabs team members
- Reviews documents, moderates platform, manages commissions
- Has access to all user data for fraud investigation
- Cannot be created through the app — added manually in Supabase

### Type 5 — Premium Worker (Phase 2)
- Workers who subscribe to Basic or Pro plan
- Lower commission rate, featured placement, analytics
- Builds towards formal employment verification

## 3.2 Verification Badge System

| Badge | Color | Who Gets It | What It Means |
|---|---|---|---|
| No badge | — | Unverified users | Account exists, not verified |
| Blue Checkmark | #3B82F6 | Individual verified workers | Real person, documents reviewed |
| Gold Checkmark | #D4A017 | Verified Business Accounts | Legally registered company, premium verified |

**The Gold Checkmark** is a symbol of trust, professionalism, and verified business quality across Africa.
It is intended to become one of the most respected business trust indicators on the continent.
Businesses should feel proud to earn and display this status.

## 3.3 Individual Worker Verification (Blue Badge)

**Requirements:**
- Full name matching ID
- Valid phone number (OTP verified)
- Valid email (OTP verified)
- Ghana Card / Passport / Voter ID / Driver's License (front + back)
- Live selfie (taken in-app — no gallery uploads)

**Process:**
- Worker submits documents
- WiamLabs team reviews within 24 hours
- Approved: Blue Checkmark + can accept bookings
- Rejected: Email with clear reason + can resubmit

**Phase 2:**
- Smile Identity AI verification replaces manual review
- Instant verification (seconds instead of hours)
- Ghana Card checked against government database
- Face match AI compares selfie to ID photo

## 3.4 Business Account Verification (Gold Badge)

**Eligibility:**
Only users with a legitimately registered business qualify.
This is NOT for individuals pretending to be companies.

**Required Documents:**
- Business Registration Certificate (Ghana Registrar General)
- Tax Identification Number (TIN)
- Business owner personal Ghana Card
- Business physical address + proof (utility bill or rent agreement)
- Company logo (high resolution)
- Business description and website/social media links

**Process:**
1. User applies for Business Account from Profile settings
2. Submits all required documents
3. WiamLabs team does thorough manual review (48-72 hours)
4. If approved: Gold Checkmark + Business Account activated
5. If rejected: Email with reason + can resubmit after corrections

**Strict Policy:**
Applications with fake or incomplete information are rejected permanently.
Fraudulent business accounts are suspended immediately, permanently banned,
and reported to authorities if fraud is confirmed.

## 3.5 Business Account Features (Gold Badge)

| Feature | Individual Worker | Business Account |
|---|---|---|
| Profile page | ✅ Basic | ✅ Enhanced company profile |
| Verified badge | Blue ✅ | Gold ✅ |
| Search placement | Standard | Priority (appears first) |
| Team management | ❌ | ✅ Add workers under company |
| Analytics dashboard | Basic | ✅ Advanced |
| Portfolio | Images | Images + Videos |
| Commission rate | 10% | 8% (discounted) |
| Customer support | Standard | Dedicated account manager |
| Booking tools | Standard | Bulk booking management |
| Enterprise API | ❌ | ✅ Phase 3 |
| Monthly fee | Free | GHS 200-500/month |

---

# ════════════════════════════════════════
# PART 4 — THE 12 SERVICE CATEGORIES
# ════════════════════════════════════════

Each category has its own icon, emoji, color, and worker subtypes.
All 12 are seeded into the database on first deployment.
Run categories_seed.sql after all migrations.

## Category 1 — Building & Structural Construction
- Icon: construct-outline | Emoji: 🧱 | Color: #8B4513
- Description: Heavy-duty tradespeople who build structures from the ground up or do major renovations
- Workers: Masons, Bricklayers, Tile Installers, Carpenters, Ironmongers, Welder-Fabricators, Concrete Workers, Scaffolding Workers, Roofing Specialists, Foundation Workers, Block Layers

## Category 2 — Plumbing & Water Systems
- Icon: water-outline | Emoji: 🚰 | Color: #1E90FF
- Description: All plumbing, water supply, drainage, and water system specialists
- Workers: Domestic Plumbers, Borehole Drillers, Water Tank Installers, Drainage Cleaners, Pipe Fitters, Swimming Pool Technicians, Water Heater Installers, Septic Tank Cleaners

## Category 3 — Electrical & Power Engineering
- Icon: flash-outline | Emoji: ⚡ | Color: #FFD700
- Description: Electricians, solar installers, generator mechanics, and all power specialists
- Workers: House Wiring Electricians, Solar Panel Installers, Generator Mechanics, Inverter Technicians, CCTV Installers, Satellite Dish Installers, Smart Home Installers, Security System Installers, AC Technicians, Transformer Technicians

## Category 4 — Automotive & Mechanical Repair
- Icon: car-outline | Emoji: 🚗 | Color: #FF4500
- Description: Car mechanics, auto electricians, and all vehicle repair specialists
- Workers: Car Mechanics, Auto Electricians, Motorcycle/Tricycle Repairers, Car Body Painters, Vulcanizers, Auto AC Technicians, Car Wash Specialists, Truck Mechanics, Panel Beaters

## Category 5 — Finishing, Painting & Interior Decor
- Icon: brush-outline | Emoji: 🎨 | Color: #9B59B6
- Description: Painters, ceiling designers, interior decorators, and finishing specialists
- Workers: House Painters, POP Ceiling Designers, Wallpaper Installers, Interior Decorators, Window Blind Installers, Floor Polishers, Gypsum Board Installers, False Ceiling Workers

## Category 6 — Cleaning & Property Maintenance
- Icon: sparkles-outline | Emoji: 🧹 | Color: #00CED1
- Description: Cleaners, fumigators, pest control, and property maintenance workers
- Workers: Deep Cleaners, Janitors, Laundry & Dry Cleaners, Fumigation & Pest Control, Garbage Collectors, Post-Construction Cleaners, Carpet Cleaners, Swimming Pool Cleaners

## Category 7 — Hair, Beauty & Personal Care
- Icon: cut-outline | Emoji: 💈 | Color: #FF69B4
- Description: Barbers, hairstylists, makeup artists, nail technicians, beauty professionals
- Workers: Barbers, Hairstylists/Braiders, Makeup Artists, Nail Technicians, Skincare Therapists, Eyebrow Artists, Lash Technicians, Massage Therapists, Spa Technicians

## Category 8 — Hospitality, Catering & Culinary Arts
- Icon: restaurant-outline | Emoji: 🍽️ | Color: #FF8C00
- Description: Event caterers, private chefs, bakers, and food service professionals
- Workers: Event Caterers, Private Chefs, Bakers/Confectioners, Cocktail Mixologists, Local Food Cooks, Waiters/Waitresses, Event Food Vendors, Drinks Suppliers

## Category 9 — Photography, Media & Creative Arts
- Icon: camera-outline | Emoji: 📸 | Color: #4169E1
- Description: Photographers, videographers, drone operators, and creative professionals
- Workers: Event Photographers, Videographers, Drone Operators, Video Editors, Graphic Designers, Photo Editors, Social Media Content Creators, Brand Identity Designers

## Category 10 — Logistics, Transport & Delivery
- Icon: bicycle-outline | Emoji: 🚴 | Color: #228B22
- Description: Dispatch riders, delivery drivers, movers, and transport professionals
- Workers: Dispatch Riders, Delivery Drivers, Truck/Hauling Drivers, Private Drivers, Courier Assistants, Airport Pickup Drivers, Moving Company Workers, Cargo Handlers

## Category 11 — Education, Tuition & Home Lessons
- Icon: book-outline | Emoji: 📚 | Color: #8B0000
- Description: Home tutors, language teachers, music instructors, skill tutors
- Workers: Home Tutors (Math/Science), Language Instructors, Music Teachers, Coding/Tech Tutors, WAEC/BECE Specialists, Early Childhood Educators, Adult Literacy Teachers, Sign Language Tutors

## Category 12 — Events, Entertainment & Sound
- Icon: musical-notes-outline | Emoji: 🎉 | Color: #DC143C
- Description: Event planners, DJs, MCs, sound engineers, event professionals
- Workers: Event Planners, DJs, MCs, Sound Engineers, Stage/Lighting Designers, Ushers, Balloon Decorators, Event Security, Tent & Chair Suppliers, Photo Booth Operators

---

# ════════════════════════════════════════
# PART 5 — COMPLETE USER JOURNEYS
# ════════════════════════════════════════

## 5.1 New Customer Journey

```
STEP 1 — DISCOVERY
Open app for first time
        ↓
Onboarding: "What brings you here?" → Select "Find a worker"
        ↓
STEP 2 — REGISTRATION
Enter: Full name, Email, Phone number, Password
        ↓
Email OTP sent via Resend → Enter 6-digit code → Verified
        ↓
STEP 3 — HOME SCREEN (immediate access)
Browse 12 categories, nearby workers, featured workers
No restrictions on browsing — explore freely
        ↓
STEP 4 — FINDING A WORKER
Search by category or keyword
Filter: Verified only | Available now | Rating | Distance
View worker profile: bio, skills, portfolio, reviews, rating
        ↓
STEP 5 — BOOKING
Click "Book Now" (phone number hidden until payment made)
Fill: service description, location, date/time preference, budget
Submit booking request → Worker notified immediately
        ↓
STEP 6 — WAITING FOR RESPONSE
Status: "Pending — Worker reviewing your request"
Worker has 2 hours to respond (auto-cancel if no response)
        ↓
STEP 7 — WORKER ACCEPTS
Customer notified: "Kwame accepted your booking! ✅"
Worker's phone number now revealed
Chat opens between customer and worker
        ↓
STEP 8 — PAYMENT (via Paystack)
Customer pays agreed amount via Paystack
Payment held in ESCROW by WiamApp (not sent to worker yet)
        ↓
STEP 9 — JOB EXECUTION
Worker arrives, completes the job
Worker marks "Job Complete" in app
Customer confirms: "Yes, job is done" OR raises dispute
        ↓
STEP 10 — PAYMENT RELEASE
Customer confirms → Escrow released → Worker paid
WiamApp takes 10% commission automatically
Worker receives 90% of agreed amount
        ↓
STEP 11 — REVIEW
Customer prompted to rate worker (1-5 stars) + written review
Review is verified (only customers who booked can review)
Worker's rating updated automatically
```

## 5.2 New Worker Journey

```
STEP 1 — REGISTRATION
Open app → "Offer my skills" selected
Enter: Full name, Email, Phone, Password
Select: Primary category (from 12), specific skill, years experience, city
        ↓
Email OTP verified
        ↓
STEP 2 — DOCUMENT UPLOAD
Verification Intro screen — explain the process
Select ID type: Ghana Card (preferred) / Passport / Voter ID / Driver's License
Upload ID front + back (photographed in-app)
Take live selfie (cannot upload from gallery)
Submit for review
        ↓
STEP 3 — PENDING STATUS (can use app, cannot accept jobs)
Status banner shown on dashboard: "Under Review — 24 hours"
Worker can browse the app, complete their profile, add portfolio photos
CANNOT accept bookings until verified
        ↓
STEP 4 — ADMIN REVIEW (within 24 hours)
WiamLabs team receives notification to review
Reviews: ID photos, selfie, name match
        ↓
APPROVED → Blue Checkmark added → Email sent → Can now accept jobs
REJECTED → Email with clear reason → Worker can resubmit documents
        ↓
STEP 5 — RECEIVING FIRST JOB
Booking notification arrives (push + in-app)
Review: customer name, service description, location, date, budget
Worker can Accept or Decline (must decide within 2 hours)
        ↓
STEP 6 — JOB EXECUTION
Chat opens with customer to coordinate
Go to job location
Complete the work
Mark job as complete in app
        ↓
STEP 7 — GETTING PAID
Customer confirms completion
Escrow released to worker within 24 hours
Worker receives payment minus 10% commission
Earnings visible in Earnings screen
```

## 5.3 Business Account Journey

```
STEP 1 — START AS INDIVIDUAL WORKER
Register and verify as individual worker
Build initial rating and reputation (at least 5 completed jobs)
        ↓
STEP 2 — APPLY FOR BUSINESS ACCOUNT
Go to Profile → Settings → "Upgrade to Business Account"
Fill in: Business name, Registration number, TIN, Address
Upload: Registration certificate, TIN document, owner Ghana Card, address proof
Upload: Company logo
Submit application
        ↓
STEP 3 — STRICT REVIEW (48-72 hours)
WiamLabs team reviews all business documents thoroughly
Verifies registration number with Ghana Registrar General database
Confirms business is legitimate and active
        ↓
APPROVED → Gold Checkmark → Business features unlocked
REJECTED (permanently) if fake documents detected → Banned + reported
        ↓
STEP 4 — BUSINESS OPERATIONS
Add workers under company profile
Manage team bookings from business dashboard
View company analytics (total jobs, earnings, ratings)
Access priority placement in search results
Pay monthly Business Account fee
```

---

# ════════════════════════════════════════
# PART 6 — PLATFORM PROTECTION SYSTEM
# ════════════════════════════════════════

## 6.1 The Core Problem

Workers and customers will try to connect outside the app after meeting through WiamApp.
This is called platform leakage. It steals WiamApp's commission revenue.
A worker who gets a customer's number can call them for the next 10 jobs without using the app.
This must be prevented through smart product design.

## 6.2 Protection Layer 1 — Hidden Phone Numbers

- Worker phone number is NEVER shown on their profile page
- It is NEVER shown in search results
- It is ONLY revealed after ALL three conditions are met:
  1. Customer has created a booking
  2. Worker has accepted the booking
  3. Customer has paid (payment held in escrow)
- This forces payment through the app before contact is made
- Removes the motivation to bypass the booking process

## 6.3 Protection Layer 2 — Escrow Payment System

```
Customer pays → Money held by WiamApp (not sent to worker)
        ↓
Job is completed and confirmed
        ↓
WiamApp releases payment → Worker gets 90% → WiamApp keeps 10%
```

Why this works:
- Worker is motivated to complete the job properly (money is waiting)
- Customer is protected (money returned if job not done)
- WiamApp takes commission before worker sees the money

## 6.4 Protection Layer 3 — Intelligent Chat Monitoring

Every message sent in the app is scanned before delivery:

**Triggers that flag a message:**
- Ghana phone number patterns: 0XX XXXXXXX, +233XXXXXXXXX
- Nigeria phone number patterns: 0XXXXXXXXXX, +234XXXXXXXXXX
- Payment app names: MoMo, Mobile Money, Paystack link, Cash, Bank transfer
- Suspicious phrases: "pay me directly", "my number is", "call me outside",
  "reach me on WhatsApp", "let's meet outside", "don't use the app"

**What happens when flagged:**
- Message is replaced with: ⚠️ "This message was flagged. Keep all payments within WiamApp for your protection."
- Both parties see the warning
- Worker gets a Platform Warning (strike)
- Admin is notified
- Logged to audit_logs and platform_warnings table

**Strike System:**
- Strike 1: Warning message sent to worker
- Strike 2: Account temporarily restricted
- Strike 3: Account automatically suspended + admin review

## 6.5 Protection Layer 4 — Value Lock-in

Workers are given strong reasons to stay on the platform:

**What only exists on WiamApp:**
- Verified rating and review history (cannot be transferred)
- Job completion track record (used for credit scoring later)
- Verified badge (only issued through WiamApp)
- Dispute protection (only covered if job booked through app)
- Featured listing opportunities (paid promotion)

**The message to workers:**
"Your reputation lives here. Your income grows here. Your career is built here."

## 6.6 Protection Layer 5 — Off-Platform Report Button

On every completed booking, customer is asked:
"Did the worker ask you to pay outside WiamApp?"

If YES:
1. Fraud report filed automatically
2. Worker temporarily suspended pending review
3. Admin investigates with full audit trail
4. Worker warned or permanently banned
5. Customer refunded if applicable

## 6.7 Protection Layer 6 — Review Gating

- Reviews can ONLY be left by customers who completed a booking through the app
- Workers cannot have verified reviews from outside jobs
- This makes the in-app review system extremely valuable
- Workers cannot fake or buy reviews
- Duplicate reviews are blocked at database level (unique constraint)

## 6.8 Commission Structure

| Plan | Commission Rate | Minimum |
|---|---|---|
| Standard (Free) | 10% per job | GHS 5 minimum |
| Basic Worker Plan | 9% per job | GHS 5 minimum |
| Pro Worker Plan | 7% per job | GHS 5 minimum |
| Business Account | 8% per job | GHS 10 minimum |

Example:
- Customer pays GHS 200 for an electrical job
- WiamApp escrow holds GHS 200
- Job confirmed complete
- Worker receives: GHS 180 (90%)
- WiamApp keeps: GHS 20 (10%)

---

# ════════════════════════════════════════
# PART 7 — NOTIFICATION SYSTEM
# ════════════════════════════════════════

## 7.1 Notification Types

WiamApp uses THREE notification channels:

| Channel | When Used | Provider |
|---|---|---|
| Push Notification | Real-time alerts on phone | Expo Push Notifications (FREE) |
| In-App Notification | Bell icon badge in app | Supabase Realtime |
| Email | Important events | Resend (FREE 3000/month) |

## 7.2 Push Notification Triggers

**For Customers:**
- New booking request sent (confirmation)
- Booking accepted by worker ✅
- Booking rejected by worker ❌
- Worker marked job complete — confirm?
- New message received in chat
- Review reminder (24 hours after job complete)
- Payment processed successfully

**For Workers:**
- New booking request received 🔔
- Booking auto-cancelled (no response in 2 hours) ⏰
- Customer confirmed job complete — payment releasing
- New message received in chat
- New review received ⭐
- Verification approved ✅
- Verification rejected — action needed ❌
- Platform warning issued ⚠️

**For Admins:**
- New document submitted for review
- Document waiting over 20 hours (approaching 24hr deadline)
- Fraud report filed
- New business account application

## 7.3 Email Notification Triggers (via Resend)

| Trigger | Recipient | Template |
|---|---|---|
| Account registered | User | Welcome email |
| Email OTP | User | OTP code template |
| Verification approved | Worker | Approved email |
| Verification rejected | Worker | Rejected email with reason |
| Booking accepted | Customer | Booking confirmation |
| Booking rejected | Customer | Alternative workers suggested |
| Job complete | Customer | Rate your experience |
| Payment released | Worker | Earnings confirmation |
| Business account approved | Business | Gold badge welcome |
| Business account rejected | Business | Rejection with reason |

## 7.4 Notification Preferences

Users can control:
- Push notifications: On/Off per category
- Email notifications: On/Off per category
- Marketing emails: On/Off (separate from transactional)
- Chat notifications: On/Off

Settings stored in users table: notification_preferences JSONB column

---

# ════════════════════════════════════════
# PART 8 — COMPLETE SCREEN LIST (45 Screens)
# ════════════════════════════════════════

## 8.1 Auth & Onboarding Screens (7 screens)

| # | Screen | Purpose |
|---|---|---|
| 1 | SplashScreen | Logo animation while app loads, check auth state |
| 2 | OnboardingScreen | "What brings you here?" — 3 path selector |
| 3 | LoginScreen | Email + password with show/hide, forgot password link |
| 4 | RegisterScreen | Role-based form (customer/worker/business) |
| 5 | EmailOTPScreen | 6-digit OTP verification, resend countdown timer |
| 6 | ForgotPasswordScreen | Enter email to receive reset link |
| 7 | ResetPasswordScreen | New password + confirm password |

## 8.2 Verification Screens (6 screens)

| # | Screen | Purpose |
|---|---|---|
| 8 | VerificationIntroScreen | Explain the process, what's needed, estimated time |
| 9 | IDTypeScreen | Choose Ghana Card/Passport/Voter ID/Driver's License |
| 10 | IDUploadScreen | Upload front + back of chosen ID (in-app camera) |
| 11 | SelfieScreen | Live selfie capture with tips (no gallery allowed) |
| 12 | VerificationPendingScreen | 24-hour review message, can explore app |
| 13 | VerificationApprovedScreen | Celebration, Blue badge awarded |
| 14 | VerificationRejectedScreen | Clear reason shown, resubmit option |

## 8.3 Customer Screens (14 screens)

| # | Screen | Purpose |
|---|---|---|
| 15 | CustomerHomeScreen | 12 categories grid, nearby workers, featured, top rated |
| 16 | SearchScreen | Search + filters (category, verified, available, rating) |
| 17 | CategoryScreen | All workers in one category with subtype filter |
| 18 | WorkerProfileScreen | Full profile, portfolio, reviews, book button |
| 19 | BookingFormScreen | Fill service details, location, date, time, budget |
| 20 | BookingConfirmScreen | Review all details before submitting |
| 21 | BookingSuccessScreen | Confirmed, reference number, next steps |
| 22 | BookingsListScreen | All bookings (Active/Completed/Cancelled tabs) |
| 23 | BookingDetailScreen | Full details of one booking, chat, cancel option |
| 24 | PaymentScreen | Paystack payment integration, amount breakdown |
| 25 | PaymentSuccessScreen | Receipt, commission shown, worker payout info |
| 26 | ChatListScreen | Inbox — all conversations |
| 27 | ChatScreen | Real-time messages + voice messages |
| 28 | ReviewScreen | 1-5 stars + written review + photo option |
| 29 | CustomerProfileScreen | Edit profile, settings, verification status, dark mode |
| 30 | NotificationsScreen | All notifications, mark as read |

## 8.4 Worker Screens (10 screens)

| # | Screen | Purpose |
|---|---|---|
| 31 | WorkerDashboardScreen | Stats, availability toggle, pending jobs |
| 32 | WorkerJobsScreen | All jobs with status tabs |
| 33 | JobDetailScreen | Full job details, accept/reject, chat |
| 34 | EarningsScreen | Total earned, commission breakdown, payout history |
| 35 | WorkerProfileEditScreen | Edit bio, skills, rates, portfolio, categories |
| 36 | PortfolioManagerScreen | Add, remove, reorder portfolio images |
| 37 | WorkerNotificationsScreen | Job alerts, review alerts, platform warnings |
| 38 | WorkerSettingsScreen | Dark mode toggle, notification preferences |
| 39 | SkillsManagerScreen | Add/remove skills and subtypes from 12 categories |
| 40 | WorkerChatScreen | Inbox + chat (same component, different nav context) |

## 8.5 Business Account Screens (3 screens)

| # | Screen | Purpose |
|---|---|---|
| 41 | BusinessApplicationScreen | Apply for Gold Badge business account |
| 42 | BusinessDashboardScreen | Team management, bulk bookings, analytics |
| 43 | TeamManagementScreen | Add/remove workers under company |

## 8.6 Admin Screens (5 screens — separate admin view)

| # | Screen | Purpose |
|---|---|---|
| 44 | AdminDashboardScreen | Platform overview: users, jobs, revenue, fraud |
| 45 | DocumentQueueScreen | List of pending verifications (oldest first) |
| 46 | DocumentReviewScreen | View ID + selfie, approve or reject with reason |
| 47 | FraudReportsScreen | All open fraud reports with full trace data |
| 48 | CommissionReportScreen | Earnings by day/week/month, payout reconciliation |

---

# ════════════════════════════════════════
# PART 9 — COMPLETE TECH STACK
# ════════════════════════════════════════

Every tool listed here is FREE to start.
No tool will block development or require payment before launch.

## 9.1 Mobile App

| Technology | Version | Purpose | Cost |
|---|---|---|---|
| React Native | 0.74 | Cross-platform mobile framework | Free |
| Expo SDK | 51 | Development tools and native APIs | Free |
| React Navigation | 6 | Screen navigation | Free |
| Expo Router | — | File-based navigation (Phase 2) | Free |
| AsyncStorage | Latest | Local session storage | Free |
| Expo Image Picker | Latest | Camera + gallery access | Free |
| Expo AV | Latest | Audio recording + playback | Free |
| Expo Location | Latest | GPS location services | Free |
| Expo Notifications | Latest | Push notifications | Free |
| Expo Device | Latest | Device fingerprinting | Free |
| Ionicons | v7 | All icons in the app | Free |

## 9.2 Backend Server

| Technology | Version | Purpose | Cost |
|---|---|---|---|
| Node.js | 18+ | Server runtime | Free |
| Express.js | 4.19 | API framework | Free |
| Helmet | 7 | HTTP security headers | Free |
| CORS | 2.8 | Cross-origin control | Free |
| express-rate-limit | 7 | Rate limiting | Free |
| Multer | 1.4 | File upload handling | Free |
| dotenv | 16 | Environment variables | Free |

## 9.3 Database & Auth

| Technology | Purpose | Free Tier |
|---|---|---|
| Supabase | PostgreSQL database + Auth | 500MB database, 50MB file storage |
| Supabase Auth | User authentication + JWT | Included |
| Supabase Realtime | Live messages, notifications | Included |
| Supabase RLS | Row Level Security | Included |

## 9.4 File Storage

| Technology | Purpose | Free Tier |
|---|---|---|
| Cloudflare R2 | ALL file storage | 10GB free, no egress fees |
| R2 Public Bucket | Avatars, portfolios, voice messages | Included in 10GB |
| R2 Private Bucket | ID documents, selfies (signed URLs only) | Included in 10GB |

**Why Cloudflare R2 over others:**
- No egress fees (S3 charges for downloads — R2 does not)
- Works with standard S3 SDK (aws-sdk)
- Integrates naturally with Cloudflare CDN (wiamapp.com domain)
- 10GB free is enough for MVP launch

## 9.5 Email

| Technology | Purpose | Free Tier |
|---|---|---|
| Resend | All transactional emails | 3,000 emails/month free |

## 9.6 Payments

| Technology | Purpose | Cost |
|---|---|---|
| Paystack | Ghana (GHS) + Nigeria (NGN) payments | Free to start, 1.5% per transaction |

## 9.7 Identity Verification

| Technology | Purpose | Cost |
|---|---|---|
| Manual Review (MVP) | Admin reviews ID photos manually | Free |
| Smile Identity (Phase 2) | Automated AI verification | ~$0.70 per worker (add when revenue allows) |

## 9.8 Deployment & Infrastructure

| Technology | Purpose | Free Tier |
|---|---|---|
| GitHub | Code repository | Free (private repos) |
| Render | Backend server hosting | Free tier (750 hours/month) |
| Cloudflare | Domain DNS + CDN + R2 | Free |
| Expo EAS | App builds for App Store/Play Store | Free tier available |

## 9.9 Domain

| Item | Value |
|---|---|
| Main domain | wiamapp.com |
| Backend API | api.wiamapp.com |
| CDN/R2 files | files.wiamapp.com |
| Admin panel | admin.wiamapp.com (future) |

## 9.10 Total Monthly Cost at Launch

| Service | Cost |
|---|---|
| Supabase | FREE |
| Cloudflare R2 | FREE |
| Resend | FREE |
| GitHub | FREE |
| Render | FREE |
| Cloudflare DNS | FREE |
| Paystack | FREE (1.5% per transaction only) |
| **TOTAL** | **GHS 0 per month** |

---

# ════════════════════════════════════════
# PART 10 — COMPLETE DATABASE SCHEMA
# ════════════════════════════════════════

## 10.1 Core Tables

### users
Purpose: All users on the platform (customers, workers, businesses, admins)
```
id                        UUID (primary key, matches Supabase Auth)
full_name                 VARCHAR(100) NOT NULL
email                     VARCHAR(150) UNIQUE NOT NULL
phone                     VARCHAR(20)
role                      ENUM: customer | worker | business | admin
avatar_url                TEXT (Cloudflare R2 public URL)
city                      VARCHAR(100)
country                   VARCHAR(100) DEFAULT 'Ghana'
is_verified               BOOLEAN DEFAULT false
is_active                 BOOLEAN DEFAULT true
verification_status       ENUM: pending | under_review | approved | rejected
verification_submitted_at TIMESTAMPTZ
verification_reviewed_at  TIMESTAMPTZ
verification_reviewed_by  UUID (admin user reference)
verification_rejection_reason TEXT
notification_preferences  JSONB DEFAULT '{}'
dark_mode                 BOOLEAN DEFAULT false
created_at                TIMESTAMPTZ DEFAULT NOW()
updated_at                TIMESTAMPTZ DEFAULT NOW()
```

### worker_profiles
Purpose: Extended profile for all workers
```
id                UUID (primary key)
user_id           UUID (references users.id)
bio               TEXT
years_experience  INT DEFAULT 0
hourly_rate       DECIMAL(10,2)
currency          VARCHAR(10) DEFAULT 'GHS'
latitude          DECIMAL(10,8)
longitude         DECIMAL(11,8)
location_name     VARCHAR(200)
is_available      BOOLEAN DEFAULT true
is_verified       BOOLEAN DEFAULT false
verified_badge    BOOLEAN DEFAULT false
badge_type        ENUM: none | individual | business
total_jobs_done   INT DEFAULT 0
average_rating    DECIMAL(3,2) DEFAULT 0.00
response_rate     DECIMAL(5,2) DEFAULT 100.00
response_time_avg INT (minutes)
created_at        TIMESTAMPTZ DEFAULT NOW()
updated_at        TIMESTAMPTZ DEFAULT NOW()
```

### categories
Purpose: The 12 service categories
```
id          UUID (primary key)
name        VARCHAR(100) UNIQUE NOT NULL
icon        VARCHAR(100)
description TEXT
color       VARCHAR(20)
emoji       VARCHAR(10)
sort_order  INT DEFAULT 0
is_active   BOOLEAN DEFAULT true
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### worker_categories
Purpose: Many-to-many — worker can be in multiple categories
```
id          UUID (primary key)
worker_id   UUID (references worker_profiles.id)
category_id UUID (references categories.id)
UNIQUE (worker_id, category_id)
```

### worker_subtypes
Purpose: Specific skills within each category
```
id          UUID (primary key)
category_id UUID (references categories.id)
name        VARCHAR(100) NOT NULL
sort_order  INT DEFAULT 0
is_active   BOOLEAN DEFAULT true
```

### worker_subtype_selections
Purpose: Which specific subtypes a worker offers
```
id         UUID (primary key)
worker_id  UUID (references worker_profiles.id)
subtype_id UUID (references worker_subtypes.id)
UNIQUE (worker_id, subtype_id)
```

### portfolio_images
Purpose: Worker portfolio photos stored in Cloudflare R2
```
id        UUID (primary key)
worker_id UUID (references worker_profiles.id)
image_url TEXT NOT NULL (Cloudflare R2 public URL)
caption   TEXT
sort_order INT DEFAULT 0
created_at TIMESTAMPTZ DEFAULT NOW()
```

## 10.2 Transaction Tables

### bookings
Purpose: All job requests and their status
```
id               UUID (primary key)
customer_id      UUID (references users.id)
worker_id        UUID (references worker_profiles.id)
category_id      UUID (references categories.id)
status           ENUM: pending | accepted | rejected | in_progress | completed | cancelled | disputed
description      TEXT
scheduled_date   TIMESTAMPTZ
location_address TEXT
location_lat     DECIMAL(10,8)
location_lng     DECIMAL(11,8)
agreed_price     DECIMAL(10,2)
currency         VARCHAR(10) DEFAULT 'GHS'
auto_cancel_at   TIMESTAMPTZ (2 hours after creation if not accepted)
completed_at     TIMESTAMPTZ
cancelled_reason TEXT
created_at       TIMESTAMPTZ DEFAULT NOW()
updated_at       TIMESTAMPTZ DEFAULT NOW()
```

### reviews
Purpose: Customer reviews after completed jobs (one per booking)
```
id          UUID (primary key)
booking_id  UUID (references bookings.id) UNIQUE
customer_id UUID (references users.id)
worker_id   UUID (references worker_profiles.id)
rating      INT (1-5)
comment     TEXT
is_visible  BOOLEAN DEFAULT true
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### messages
Purpose: Chat messages between customer and worker
```
id          UUID (primary key)
booking_id  UUID (references bookings.id)
sender_id   UUID (references users.id)
receiver_id UUID (references users.id)
message     TEXT
voice_url   TEXT (Cloudflare R2 URL for voice messages)
is_read     BOOLEAN DEFAULT false
is_flagged  BOOLEAN DEFAULT false
flag_reason TEXT
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### notifications
Purpose: In-app notification bell
```
id         UUID (primary key)
user_id    UUID (references users.id)
title      VARCHAR(200)
body       TEXT
type       ENUM: booking | message | review | payment | system | warning
is_read    BOOLEAN DEFAULT false
data       JSONB (extra context data)
created_at TIMESTAMPTZ DEFAULT NOW()
```

### payments
Purpose: All payment transactions with escrow tracking
```
id               UUID (primary key)
booking_id       UUID (references bookings.id)
payer_id         UUID (references users.id)
receiver_id      UUID (references users.id)
amount           DECIMAL(10,2) NOT NULL
commission_amount DECIMAL(10,2)
worker_payout    DECIMAL(10,2)
currency         VARCHAR(10) DEFAULT 'GHS'
payment_method   ENUM: paystack | cash
payment_status   ENUM: pending | escrow | success | failed | refunded | disputed
transaction_ref  VARCHAR(200)
released_at      TIMESTAMPTZ
metadata         JSONB DEFAULT '{}'
created_at       TIMESTAMPTZ DEFAULT NOW()
```

## 10.3 Security Tables

### verifications
Purpose: Track verification steps for each user
```
id                UUID (primary key)
user_id           UUID (references users.id)
verification_type ENUM: phone_otp | email | id_document | face_match | liveness | business_doc
status            ENUM: pending | passed | failed | manual_review | rejected
provider          VARCHAR(50)
provider_ref      VARCHAR(200)
score             DECIMAL(5,2)
document_type     VARCHAR(50)
document_s3_key   TEXT (private R2 key)
selfie_s3_key     TEXT (private R2 key)
failure_reason    TEXT
reviewed_by       UUID (admin reference)
created_at        TIMESTAMPTZ DEFAULT NOW()
updated_at        TIMESTAMPTZ DEFAULT NOW()
```

### document_reviews
Purpose: Admin queue for manual document review
```
id                    UUID (primary key)
user_id               UUID (references users.id)
ghana_card_front_key  TEXT (private R2 key)
ghana_card_back_key   TEXT (private R2 key)
selfie_key            TEXT (private R2 key)
business_cert_key     TEXT (optional, for business accounts)
status                ENUM: pending | approved | rejected | more_info
submitted_at          TIMESTAMPTZ DEFAULT NOW()
reviewed_at           TIMESTAMPTZ
reviewed_by           UUID (admin reference)
rejection_reason      TEXT
admin_notes           TEXT
```

### audit_logs
Purpose: Permanent append-only log of every important action
```
id          UUID (primary key)
user_id     UUID (references users.id)
action      VARCHAR(100) NOT NULL
ip_address  INET
device_info TEXT
location_lat DECIMAL(10,8)
location_lng DECIMAL(11,8)
metadata    JSONB
created_at  TIMESTAMPTZ DEFAULT NOW()
-- NOTE: No UPDATE or DELETE policies on this table
-- Once written, audit logs cannot be modified by anyone
```

### fraud_reports
Purpose: Filed fraud reports with full investigation data
```
id                UUID (primary key)
reported_by       UUID (references users.id)
reported_user_id  UUID (references users.id)
booking_id        UUID (references bookings.id)
fraud_type        ENUM: scam | fake_identity | no_show | overcharge | harassment | off_platform_payment | other
description       TEXT NOT NULL
evidence_s3_keys  TEXT[]
status            ENUM: open | investigating | resolved | referred_to_police | closed
admin_notes       TEXT
police_report_number VARCHAR(100)
resolved_by       UUID (admin reference)
created_at        TIMESTAMPTZ DEFAULT NOW()
updated_at        TIMESTAMPTZ DEFAULT NOW()
```

### platform_warnings
Purpose: Track off-platform payment attempts
```
id            UUID (primary key)
worker_id     UUID (references worker_profiles.id)
booking_id    UUID (references bookings.id)
warning_type  ENUM: phone_shared | outside_payment | payment_app_mentioned | suspicious_chat
evidence      TEXT
total_warnings INT
created_at    TIMESTAMPTZ DEFAULT NOW()
```

### otp_codes
Purpose: Email OTP verification codes
```
id         UUID (primary key)
user_id    UUID (references users.id)
email      VARCHAR(150)
phone      VARCHAR(20)
code       VARCHAR(6) NOT NULL
type       ENUM: email | phone
is_used    BOOLEAN DEFAULT false
expires_at TIMESTAMPTZ NOT NULL
created_at TIMESTAMPTZ DEFAULT NOW()
```

### device_fingerprints
Purpose: Detect duplicate accounts from the same device
```
id           UUID (primary key)
user_id      UUID (references users.id)
device_id    VARCHAR(200)
device_model VARCHAR(100)
os_version   VARCHAR(50)
app_version  VARCHAR(20)
first_seen   TIMESTAMPTZ DEFAULT NOW()
last_seen    TIMESTAMPTZ DEFAULT NOW()
```

## 10.4 Monetization Tables

### subscriptions
Purpose: Worker subscription plans
```
id           UUID (primary key)
worker_id    UUID (references worker_profiles.id)
plan         ENUM: free | basic | pro
start_date   TIMESTAMPTZ DEFAULT NOW()
end_date     TIMESTAMPTZ
is_active    BOOLEAN DEFAULT true
amount_paid  DECIMAL(10,2)
created_at   TIMESTAMPTZ DEFAULT NOW()
```

### featured_workers
Purpose: Paid featured listing records
```
id          UUID (primary key)
worker_id   UUID (references worker_profiles.id)
category_id UUID (references categories.id)
start_date  TIMESTAMPTZ NOT NULL
end_date    TIMESTAMPTZ NOT NULL
amount_paid DECIMAL(10,2)
is_active   BOOLEAN DEFAULT true
created_at  TIMESTAMPTZ DEFAULT NOW()
```

### business_verifications
Purpose: Business account verification documents
```
id                        UUID (primary key)
user_id                   UUID (references users.id)
business_name             VARCHAR(200) NOT NULL
registration_number       VARCHAR(100)
tin_number                VARCHAR(100)
business_address          TEXT
business_city             VARCHAR(100)
owner_id_s3_key           TEXT (private R2 key)
registration_cert_s3_key  TEXT (private R2 key)
address_proof_s3_key      TEXT (private R2 key)
logo_url                  TEXT (public R2 URL)
website                   VARCHAR(200)
status                    ENUM: pending | approved | rejected
rejection_reason          TEXT
reviewed_by               UUID (admin reference)
created_at                TIMESTAMPTZ DEFAULT NOW()
updated_at                TIMESTAMPTZ DEFAULT NOW()
```

---

# ════════════════════════════════════════
# PART 11 — COMPLETE API ENDPOINTS
# ════════════════════════════════════════

All endpoints use prefix: https://api.wiamapp.com
All protected routes require: Authorization: Bearer {JWT_TOKEN}
All responses use format: { data: {...}, error: null } or { data: null, error: "message" }

## 11.1 Auth Routes (/api/auth)

```
POST   /register              Register new user (any role)
POST   /login                 Login (handled by Supabase, returns JWT)
GET    /me                    Get current user profile (protected)
POST   /send-otp              Send 6-digit OTP to email
POST   /verify-otp            Verify OTP code, mark email confirmed
POST   /forgot-password       Send password reset email
POST   /reset-password        Set new password with reset token
POST   /logout                Invalidate current session
DELETE /account               Delete account (GDPR compliance)
```

## 11.2 Worker Routes (/api/workers)

```
GET    /                      Get all workers (filters: category, city, verified, available)
GET    /:id                   Get single worker full profile
GET    /search/:query         Search by name or role
PATCH  /availability          Toggle availability on/off (protected)
GET    /meta/categories       Get all 12 categories with subtypes
POST   /profile               Create worker profile (protected)
PUT    /profile               Update worker profile (protected)
POST   /portfolio             Add portfolio image (protected)
DELETE /portfolio/:imageId    Remove portfolio image (protected)
GET    /:id/contact           Get worker contact (only after booking + payment)
```

## 11.3 Booking Routes (/api/bookings)

```
POST   /                      Create new booking (protected)
GET    /                      Get all bookings for current user (protected)
GET    /pending               Get pending bookings for worker (protected)
GET    /:id                   Get single booking details (protected)
PATCH  /:id/accept            Accept a booking — worker only (protected)
PATCH  /:id/reject            Reject a booking — worker only (protected)
PATCH  /:id/complete          Mark job complete — worker only (protected)
PATCH  /:id/confirm           Confirm job done — customer only (protected)
PATCH  /:id/cancel            Cancel a booking (protected)
PATCH  /:id/dispute           Raise a dispute (protected)
POST   /:id/review            Leave a review (protected)
```

## 11.4 Upload Routes (/api/uploads)

```
POST   /avatar                Upload profile photo → R2 public
POST   /portfolio             Upload portfolio image → R2 public
POST   /voice                 Upload voice message → R2 public
POST   /document              Upload ID document → R2 private (returns key only)
POST   /selfie                Upload selfie → R2 private (returns key only)
POST   /business-doc          Upload business document → R2 private
```

## 11.5 Verification Routes (/api/verify)

```
POST   /submit                Submit documents for review (protected)
GET    /status                Get verification status (protected)
POST   /admin/approve         Admin approves verification (admin only)
POST   /admin/reject          Admin rejects with reason (admin only)
GET    /admin/queue           Get pending verifications (admin only)
GET    /admin/document/:key   Get signed URL for private document (admin only, 15min expiry)
```

## 11.6 Payment Routes (/api/payments)

```
POST   /paystack/initiate     Start Paystack payment
GET    /paystack/verify/:ref  Verify payment status
POST   /paystack/webhook      Paystack payment webhook (server-side)
POST   /escrow/release        Release escrow to worker (admin or auto)
GET    /history               Payment history for current user (protected)
GET    /admin/commission      Commission report (admin only)
```

## 11.7 Notification Routes (/api/notifications)

```
GET    /                      Get all notifications (protected)
GET    /unread-count          Count unread (protected)
PATCH  /:id/read              Mark one as read (protected)
PATCH  /read-all              Mark all as read (protected)
DELETE /:id                   Delete a notification (protected)
POST   /push-token            Register Expo push token (protected)
```

## 11.8 Platform Protection Routes (/api/protection)

```
POST   /flag-payment          Report off-platform payment attempt (protected)
POST   /fraud-report          File a fraud report (protected)
GET    /admin/fraud-reports   Get all fraud reports (admin only)
PATCH  /admin/fraud/:id       Update fraud report status (admin only)
PATCH  /admin/suspend/:userId Suspend a user account (admin only)
PATCH  /admin/ban/:userId     Permanently ban a user (admin only)
```

## 11.9 Admin Routes (/api/admin)

```
GET    /dashboard             Platform overview stats (admin only)
GET    /users                 Search all users (admin only)
GET    /users/:id             Get full user profile (admin only)
PATCH  /users/:id/role        Change user role (admin only)
GET    /commission-report     Earnings report (admin only)
GET    /platform-warnings     All platform warnings (admin only)
```

---

# ════════════════════════════════════════
# PART 12 — MONETIZATION MODEL
# ════════════════════════════════════════

## 12.1 Revenue Stream 1 — Transaction Commission (LAUNCH)

- 10% on every completed, paid booking
- Deducted automatically from escrow before worker receives payment
- Minimum commission: GHS 5 per job
- Example: GHS 300 job → GHS 30 commission → GHS 270 to worker
- This requires ZERO upfront cost and scales directly with platform usage

## 12.2 Revenue Stream 2 — Worker Subscription Plans (PHASE 2)

| Plan | Price | Commission | Features |
|---|---|---|---|
| Free | GHS 0/month | 10% | Basic profile, standard search |
| Basic | GHS 30/month | 9% | Lower commission, profile highlight |
| Pro | GHS 80/month | 7% | Lowest commission, priority search, analytics |

Workers with subscriptions get more visible placement in search results.
Higher subscription = more jobs = plan pays for itself.

## 12.3 Revenue Stream 3 — Featured Worker Listings (PHASE 2)

- Workers pay to appear at the top of their category
- Limited spots per category to maintain exclusivity
- Pricing: GHS 50/week or GHS 150/month
- Shown with "Featured" gold banner
- Automatically expires when paid period ends

## 12.4 Revenue Stream 4 — Business Account Fees (PHASE 2)

| Tier | Workers Allowed | Monthly Fee |
|---|---|---|
| Starter Business | Up to 5 workers | GHS 200/month |
| Growth Business | Up to 20 workers | GHS 400/month |
| Enterprise | Unlimited | GHS 800/month |

## 12.5 Revenue Stream 5 — Verified Badge Fee (PHASE 2)

- Manual verification: Free (admin reviews manually)
- Premium AI verification (Smile Identity): One-time GHS 20 per worker
- Business Gold Badge: Included in Business Account fee
- Gives workers instant AI-verified status instead of 24-hour wait

## 12.6 Revenue Projections (Conservative)

**Month 6 (Accra MVP):**
- 500 active workers, 2,000 customers
- Average 2 jobs/worker/month at GHS 150 avg = GHS 150,000 GMV
- 10% commission = GHS 15,000/month

**Month 12 (All Ghana):**
- 5,000 workers, 20,000 customers
- GHS 1,500,000 GMV → GHS 150,000/month commission
- + Subscriptions: 1,000 workers × GHS 30 avg = GHS 30,000/month
- **Total: ~GHS 180,000/month**

---

# ════════════════════════════════════════
# PART 13 — LAUNCH STRATEGY
# ════════════════════════════════════════

## 13.1 Phase 1 — Accra MVP (Months 1-3)

**Target:** 500 verified workers, 2,000 customers
**Focus Areas:** East Legon, Osu, Cantonments, Airport Residential, Adenta, Labone

**Worker Acquisition:**
- Visit trade schools and apprenticeship centers in Accra
- Partner with Ghana Electrical Contractors Association
- Partner with Ghana Plumbers Association
- Barbershops and hair salons in East Legon (already have phones)
- WhatsApp outreach to known tradespeople

**Customer Acquisition:**
- Facebook/Instagram ads targeting Accra homeowners aged 25-45
- WhatsApp community groups (gated communities, church groups)
- Partner with property management companies
- Referral program: invite a friend, get GHS 10 credit

**Success Metrics:**
- 500 verified workers across all 12 categories
- 2,000 registered customers
- 1,000 completed bookings
- GHS 15,000 monthly commission revenue
- 4.5+ average platform rating

## 13.2 Phase 2 — All Ghana (Months 4-8)

**Expand to:** Kumasi, Takoradi, Tamale, Cape Coast, Tema
**Target:** 5,000 workers, 20,000 customers

**Strategy:**
- Regional managers in each city
- Partner with Ghana Employers Association
- Press coverage: Joy FM, Citi FM, Ghana Web, Pulse Ghana
- University campuses for education category (tutors)
- Add Paystack Ghana payment integration

## 13.3 Phase 3 — Nigeria Launch (Months 9-15)

**Start with:** Lagos (Lekki, Victoria Island, Ikeja)
**Then:** Abuja, Port Harcourt

**Localization:**
- NGN currency support (already in Paystack)
- Nigerian NIN verification (Smile Identity supports Nigeria)
- Nigerian worker categories (Okada, Keke Napep, Lagos-specific roles)
- Pidgin English support in app copy
- Nigerian number format: +234

## 13.4 Phase 4 — West Africa (Year 2+)

**Markets:** Ivory Coast, Senegal, Sierra Leone, Liberia
**Localization:** French language support, local payment methods

---

# ════════════════════════════════════════
# PART 14 — SECURITY ARCHITECTURE
# ════════════════════════════════════════

## 14.1 Authentication Security

- Supabase Auth handles JWT generation and validation
- Tokens automatically refresh before expiry
- Sessions stored in AsyncStorage (encrypted by Expo)
- On logout: token blacklisted, AsyncStorage cleared
- No sensitive data stored in AsyncStorage (only session token)

## 14.2 API Security

- Every protected route validates JWT token server-side
- Rate limiting: 100 requests/15min globally, 10/15min for auth, 5/hour for verification
- CORS: Only wiamapp.com and Expo Go origins allowed
- Helmet: Sets secure HTTP headers (XSS protection, no-sniff, HSTS)
- Input validation on every API endpoint before processing
- All SQL queries use parameterized statements (no SQL injection)

## 14.3 Data Security

| Data Type | Storage | Access |
|---|---|---|
| User profiles | Supabase (RLS) | Own user only |
| Messages | Supabase (RLS) | Sender + receiver only |
| Bookings | Supabase (RLS) | Customer + worker only |
| ID documents | R2 Private Bucket | Admin only via signed URLs (15min) |
| Selfies | R2 Private Bucket | Admin only via signed URLs (15min) |
| Audit logs | Supabase (append-only) | Admin only |
| Payment data | Paystack servers | Paystack + admin |

## 14.4 Row Level Security (RLS)

Every Supabase table has RLS enabled.
Users can ONLY read and write their own data.
Admins use the service role key (server-side only, never in the app).
The service role key lives ONLY in Render environment variables.

## 14.5 Anti-Fraud System

| Feature | How It Works |
|---|---|
| Phone OTP | Confirms user owns their phone number |
| Email OTP | Confirms user owns their email address |
| Document review | Admin verifies ID is real and matches person |
| Device fingerprinting | Detects duplicate accounts from same device |
| IP logging | Tracks login locations |
| Location change detection | Flags logins 220km+ apart within 1 hour |
| Failed verification tracking | 3 failures = account suspended |
| Chat monitoring | Scans for phone numbers and payment apps |
| Platform warnings | 3 strikes = worker suspended |
| Audit trail | Every action logged permanently |
| Fraud trace | Ghana Card + address + device + IP = full police report |

---

# ════════════════════════════════════════
# PART 15 — DARK MODE & THEMING
# ════════════════════════════════════════

## 15.1 Theme Architecture

WiamApp supports two themes:

**Light Mode (Default for customers):**
- Background: #FFFFFF (white)
- Surface/Cards: #F8F8F8 (light grey)
- Text: #08081A (navy)
- Secondary Text: #666680
- Border: #EBEBEB
- Input Background: #F4F4F4
- Buttons: #D4A017 (gold) — ALWAYS gold
- Button Text: #FFFFFF (white)

**Dark Mode (Default for workers — always dark):**
- Background: #08081A (navy)
- Surface/Cards: #12122A
- Text: #FFFFFF (white)
- Secondary Text: #AAAACC
- Border: #1E1E3A
- Input Background: rgba(255,255,255,0.07)
- Buttons: #D4A017 (gold) — ALWAYS gold
- Button Text: #08081A (navy)

## 15.2 Theme Rules

1. ALL worker screens are ALWAYS navy dark background — this is the worker brand
2. ALL customer screens default to white light mode
3. Customers can switch to dark mode via Profile → Settings → Dark Mode toggle
4. The gold button color NEVER changes between themes — it is the brand signature
5. When dark mode is on, gold button text becomes navy (#08081A) for contrast
6. Theme preference is saved in users.dark_mode (synced across devices)

## 15.3 Theme Implementation

```javascript
// constants/colors.js — ONLY place where colors are defined
// Import this in every component — NEVER hardcode hex values

export const WiamColors = {
  navy:       '#08081A',
  gold:       '#D4A017',
  white:      '#FFFFFF',
  goldLight:  '#F0C040',
  goldDark:   '#A07810',
  success:    '#22C55E',
  error:      '#EF4444',
  warning:    '#F59E0B',
  info:       '#3B82F6',

  light: {
    background:    '#FFFFFF',
    surface:       '#F8F8F8',
    text:          '#08081A',
    textSecondary: '#666680',
    border:        '#EBEBEB',
    inputBg:       '#F4F4F4',
    button:        '#D4A017',
    buttonText:    '#FFFFFF',
  },

  dark: {
    background:    '#08081A',
    surface:       '#12122A',
    text:          '#FFFFFF',
    textSecondary: '#AAAACC',
    border:        '#1E1E3A',
    inputBg:       'rgba(255,255,255,0.07)',
    button:        '#D4A017', // Gold NEVER changes
    buttonText:    '#08081A',
  },
};
```

---

# ════════════════════════════════════════
# PART 16 — ERROR HANDLING STRATEGY
# ════════════════════════════════════════

## 16.1 Philosophy

WiamApp never shows a blank screen.
WiamApp never crashes silently.
Every error is either recovered from or shown in a human-friendly way.

## 16.2 Error Types

| Error Type | How We Handle It |
|---|---|
| Network offline | Show "No internet connection" banner, retry button |
| Supabase timeout | Show "Loading failed" + retry, use cached data |
| Auth expired | Redirect to login screen with friendly message |
| Payment failed | Show clear reason, suggest retry or different method |
| Upload failed | Show error, retry button, no data lost |
| Validation error | Highlight specific field with red border + message |
| Server 500 | Show "Something went wrong, we are fixing it" |
| Not found 404 | Show "This content is no longer available" |
| Rate limited 429 | Show "Too many attempts, please wait" with countdown |

## 16.3 Error Display Rules

- NEVER show raw error messages to users ("Error 500" etc.)
- ALWAYS translate technical errors to human language
- ALWAYS give the user an action to take (retry, go back, contact support)
- Use toast notifications for non-critical errors (network flicker, etc.)
- Use full-screen error state for critical errors (auth, payment)
- NEVER lose user's entered data when an error occurs

## 16.4 Offline Mode

WiamApp should still work without internet:
- Cache home screen data for 30 minutes
- Show "Showing cached content" banner when offline
- Block bookings and payments (require internet — show clear message)
- Queue messages and send when back online (Phase 2)

---

# ════════════════════════════════════════
# PART 17 — PERFORMANCE REQUIREMENTS
# ════════════════════════════════════════

## 17.1 Target Performance

| Metric | Target |
|---|---|
| App launch time | Under 3 seconds |
| Home screen load | Under 2 seconds |
| Search results | Under 1 second (local filter) |
| Booking submission | Under 3 seconds |
| Chat message delivery | Under 1 second (Supabase Realtime) |
| Image upload | Under 10 seconds (R2) |
| Payment confirmation | Under 5 seconds (Paystack) |

## 17.2 Optimization Rules

1. **Images:** Always use lazy loading for portfolio images and worker avatars
2. **Lists:** Use FlatList with keyExtractor and getItemLayout for long lists
3. **API calls:** Cache worker profiles for 5 minutes, categories for 1 hour
4. **Realtime:** Only subscribe to Supabase channels when screen is active
5. **Unsubscribe:** Always cleanup Supabase subscriptions in useEffect return
6. **State:** Keep state minimal — don't store derived data
7. **Re-renders:** Use useCallback and useMemo for expensive computations
8. **Bundle size:** Lazy load screens not needed at startup

---

# ════════════════════════════════════════
# PART 18 — DEPLOYMENT GUIDE
# ════════════════════════════════════════

## 18.1 Render Deployment (Backend)

**Service Configuration:**
- Name: wiamapp-backend
- Runtime: Node.js 18
- Build Command: npm install
- Start Command: node backend/server.js
- Region: Frankfurt EU (closest to Ghana)
- Branch: main
- Auto-Deploy: On every push to main

**Required Environment Variables (add in Render → Environment):**
```
SUPABASE_URL
SUPABASE_SECRET_KEY
CLOUDFLARE_R2_ENDPOINT
CLOUDFLARE_R2_ACCESS_KEY_ID
CLOUDFLARE_R2_SECRET_ACCESS_KEY
CLOUDFLARE_R2_BUCKET_NAME
CLOUDFLARE_R2_PUBLIC_URL
RESEND_API_KEY
PAYSTACK_SECRET_KEY
SMILE_IDENTITY_PARTNER_ID (add in Phase 2)
SMILE_IDENTITY_API_KEY (add in Phase 2)
SMILE_IDENTITY_ENV
NODE_ENV
PORT
```

**Custom Domain:**
- Go to Render → Your Service → Settings → Custom Domain
- Add: api.wiamapp.com
- Point DNS in Cloudflare: CNAME api → your-app.onrender.com

## 18.2 Supabase Setup

1. Create project: WiamApp, region EU West Ireland
2. Settings: Enable Data API, Disable "Auto-expose new tables", Enable RLS
3. SQL Editor: Run migrations 001-006 in order
4. SQL Editor: Run categories_seed.sql
5. Database → Replication: Enable messages, notifications, bookings
6. Settings → API: Get URL and anon key

## 18.3 Cloudflare R2 Setup

1. Dash → R2 → Create Bucket: wiamapp-public (for avatars, portfolios, voice)
2. Create Bucket: wiamapp-private (for ID documents, selfies)
3. Public bucket: Enable public access, get public URL
4. Private bucket: Keep private, use signed URLs only
5. Create API token with R2 read/write permissions
6. Note: Account ID, Access Key ID, Secret Access Key

## 18.4 Mobile App Release

**For Expo Go testing:**
```bash
npm install
npx expo start
# Scan QR code with Expo Go app
```

**For App Store / Play Store release (Phase 2):**
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android
eas build --platform ios
eas submit --platform android
eas submit --platform ios
```

## 18.5 Database Migration Rules

ALWAYS:
- Create new migration files in database/migrations/
- Name them sequentially: 007_feature_name.sql
- Test on development Supabase project first
- Run on production only after testing passes
- Never modify migrations that have already been run in production
- Keep a backup before running any migration

---

# ════════════════════════════════════════
# PART 19 — TESTING STRATEGY
# ════════════════════════════════════════

## 19.1 Manual Testing Checklist — Before Every Release

### Auth Flow
- [ ] New customer can register with email
- [ ] OTP email arrives via Resend (check spam too)
- [ ] OTP verifies correctly (right code)
- [ ] Wrong OTP shows clear error message
- [ ] Login works with correct credentials
- [ ] Wrong password shows clear error (not technical error)
- [ ] Forgot password email arrives
- [ ] Password reset works and redirects to login
- [ ] Logout clears session completely

### Worker Verification
- [ ] Worker can upload Ghana Card front (in-app camera)
- [ ] Worker can upload Ghana Card back (in-app camera)
- [ ] Worker can take selfie (in-app camera, not gallery)
- [ ] Files appear in Cloudflare R2 private bucket
- [ ] Admin dashboard shows document in review queue
- [ ] Admin can view ID photos (signed URL opens correctly)
- [ ] Admin approve → worker gets email → verified badge appears
- [ ] Admin reject with reason → worker gets email with clear reason

### Booking Flow
- [ ] Customer can search workers by category
- [ ] Customer can view worker profile (no phone number shown)
- [ ] Customer can create booking request
- [ ] Worker receives push notification for new booking
- [ ] Worker can accept booking
- [ ] After acceptance: customer sees phone number
- [ ] Payment goes through Paystack successfully
- [ ] Payment held in escrow (not in worker's account yet)
- [ ] Worker marks job complete
- [ ] Customer confirms completion
- [ ] Escrow released: worker gets 90%, WiamApp keeps 10%

### Chat Security
- [ ] Customer and worker can exchange messages
- [ ] Messages appear in real time (no page refresh)
- [ ] Sending a phone number in chat triggers warning message
- [ ] Voice messages record correctly
- [ ] Voice messages play back correctly

### Platform Protection
- [ ] Worker with 3 platform warnings gets auto-suspended
- [ ] Unverified worker cannot accept bookings
- [ ] Customer cannot see phone number before booking + payment
- [ ] Fraud report filed correctly
- [ ] Admin receives notification for fraud report

### Security
- [ ] Cannot view another user's profile data via API
- [ ] Cannot view another user's bookings via API
- [ ] Service role key is NOT visible in any frontend code
- [ ] .env file is NOT in GitHub repository
- [ ] Rate limiting blocks after too many requests
- [ ] Audit log records login, booking created, payment

---

# ════════════════════════════════════════
# PART 20 — AI DEVELOPMENT RULES
# ════════════════════════════════════════

## Purpose

These rules ensure Cursor, Claude, ChatGPT, Windsurf, and all AI tools
generate consistent, maintainable, scalable, and secure code for WiamApp.
Every AI tool reads this section before generating any code.

## 20.1 File and Structure Rules

1. NEVER create duplicate components or utilities
2. ALWAYS search existing folders before generating new files
3. NEVER install packages without checking if equivalent already exists
4. Every generated file MUST follow the existing folder structure exactly
5. New screens go in: screens/
6. New API calls go in: lib/api/
7. New backend routes go in: backend/routes/
8. New backend utilities go in: backend/lib/
9. New database changes go in: database/migrations/ (numbered sequentially)
10. NEVER modify existing migration files — create new ones

## 20.2 Code Quality Rules

11. Prefer simple architecture over advanced abstractions
12. Reuse existing APIs and hooks whenever possible
13. Keep components modular and reusable
14. Avoid premature optimization or over-engineering
15. Every file MUST start with copyright comment:
    // © 2026 WiamApp. Powered by WiamLabs
16. Colors ALWAYS imported from constants/colors.js — NEVER hardcoded
17. NEVER use inline style hex values

## 20.3 Database Rules

18. Database changes MUST always use numbered migration files
19. Every new table MUST have RLS enabled and policies written
20. Copy RLS policy patterns from 004_rls_policies.sql
21. Every important user action MUST be logged to audit_logs
22. Use the logAction() function from lib/api/security.js

## 20.4 Backend Rules

23. All backend routes MUST:
    - Validate all input before processing
    - Return consistent JSON: { data: ..., error: null } or { data: null, error: "..." }
    - Include try/catch error handling
    - Verify JWT token with verifyUserToken() for protected routes
    - Log important actions to audit_logs
24. NEVER expose secret keys or service role keys in frontend code
25. The supabaseAdmin client is backend ONLY — never import in screen files

## 20.5 Security Rules

26. AI tools must NEVER put secret keys in frontend code or commits
27. Every route that modifies data must verify the user owns that data
28. File uploads must be validated for type and size before processing
29. Phone numbers must NEVER appear on worker profile screens
30. Documents stored in R2 private bucket — return key only, never URL

## 20.6 UI/UX Rules

31. Every feature MUST support both dark and light mode
32. Use WiamColors from constants/colors.js — never hardcode
33. Worker screens ALWAYS use dark navy background
34. Customer screens default to white, can switch to dark
35. Gold buttons NEVER change color between themes
36. Every screen must handle: loading state, error state, empty state
37. NEVER show a blank screen — always show something
38. Translate all error messages to human-friendly language

## 20.7 Testing Rules

39. Every major feature must be testable independently before integration
40. AI-generated code must pass linting before merging to main
41. Test on both iOS and Android via Expo Go before committing
42. Check dark mode AND light mode before committing any UI change

## 20.8 Dependency Rules

43. New dependencies must be checked against the free tier requirements
44. NEVER add a dependency that requires payment before launch
45. Document new dependencies before installation:
    - What it does
    - Why it is needed
    - What it replaces (if anything)
    - Free tier limitations

---

# ════════════════════════════════════════
# PART 21 — ENVIRONMENT VARIABLES REFERENCE
# ════════════════════════════════════════

## 21.1 Mobile App (.env) — Safe Variables Only

These variables are safe for the mobile app because they use the anon key
(not the secret key) and are protected by Supabase RLS.

```
EXPO_PUBLIC_SUPABASE_URL          Supabase project URL
EXPO_PUBLIC_SUPABASE_ANON_KEY     Supabase publishable/anon key (NOT secret)
EXPO_PUBLIC_BACKEND_URL           https://api.wiamapp.com
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME Cloudinary cloud name (for avatar display)
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET wiamapp_unsigned
EXPO_PUBLIC_APP_ENV               development | production
EXPO_PUBLIC_DEFAULT_COUNTRY       Ghana
EXPO_PUBLIC_DEFAULT_CURRENCY      GHS
```

## 21.2 Backend Server (Render) — All Secret Variables

These variables are ONLY on Render. NEVER in the app. NEVER in GitHub.

```
SUPABASE_URL                      Supabase project URL
SUPABASE_SECRET_KEY               Supabase service role key (bypasses RLS)
CLOUDFLARE_R2_ENDPOINT            https://ACCOUNT_ID.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY_ID       R2 API access key
CLOUDFLARE_R2_SECRET_ACCESS_KEY   R2 API secret key
CLOUDFLARE_R2_BUCKET_NAME         wiamapp
CLOUDFLARE_R2_PUBLIC_URL          https://pub-HASH.r2.dev
RESEND_API_KEY                    Resend email API key
PAYSTACK_SECRET_KEY               Paystack secret key (sk_live_... or sk_test_...)
SMILE_IDENTITY_PARTNER_ID         Add in Phase 2
SMILE_IDENTITY_API_KEY            Add in Phase 2
SMILE_IDENTITY_ENV                sandbox | production
NODE_ENV                          production
PORT                              3000
```

---

# ════════════════════════════════════════
# PART 22 — REFERRAL & GROWTH SYSTEM
# ════════════════════════════════════════

## 22.1 Customer Referral Program (Phase 2)

- Every customer gets a unique referral code
- Share code with a friend
- Friend registers using the code
- Both get GHS 10 credit after friend's first completed booking
- Credit applied automatically to next booking

## 22.2 Worker Referral Program (Phase 2)

- Workers earn GHS 20 for every new verified worker they refer
- Paid after referred worker completes 5 bookings
- This incentivizes worker-to-worker recruitment (most effective channel)

## 22.3 Loyalty Rewards (Phase 2)

**Customer Loyalty:**
- Every 10 completed bookings: GHS 20 credit
- Every 25 completed bookings: 1 free booking (capped at GHS 100)
- Loyalty badge on profile (Silver, Gold, Platinum)

**Worker Loyalty:**
- 100 completed jobs: "Century" badge
- 500 completed jobs: "Expert" badge + featured listing for 1 month free
- Consistent 5-star rating for 3 months: "Top Performer" badge

---

# ════════════════════════════════════════
# PART 23 — DISPUTE RESOLUTION SYSTEM
# ════════════════════════════════════════

## 23.1 When Disputes Occur

A dispute is raised when:
- Customer claims job was not completed properly
- Worker claims customer is refusing to confirm without reason
- Customer claims worker did not show up
- Either party suspects fraud or misconduct

## 23.2 Dispute Process

```
Dispute raised (by customer or worker)
        ↓
Escrow is FROZEN — payment not released to either party
        ↓
Admin receives notification
        ↓
Admin reviews:
  - Chat messages
  - Booking details
  - Audit logs
  - Any photos or evidence submitted
        ↓
Admin decision (within 48 hours):
  Option A: Release to worker (job was done)
  Option B: Refund to customer (job was not done)
  Option C: Partial payment (job was partially done)
        ↓
Both parties notified of decision
```

## 23.3 Evidence Collection

During a dispute, both parties can submit:
- Photos of the completed (or incomplete) work
- Screenshots of chat conversations (already logged)
- Written statement of what happened

Admin has access to:
- Complete booking history
- All chat messages
- Full audit log (every action with timestamp)
- Worker's verification documents (can confirm real identity)
- Ghana Card on file (for police referral if needed)

---

# ════════════════════════════════════════
# PART 24 — ACCESSIBILITY & INCLUSION
# ════════════════════════════════════════

## 24.1 Accessibility Requirements

- All interactive elements must have accessible labels
- Font sizes must be legible (minimum 12px for body text)
- Color contrast ratios must meet WCAG 2.1 AA standard
- All images must have alt text descriptions
- App must be usable on budget Android phones (2GB RAM)
- App must work on 3G networks (common in Ghana)
- Critical flows must work with 2G speeds (booking, messaging)

## 24.2 Language Support

**MVP:** English only
**Phase 2:** Twi (Ghana) — most spoken local language
**Phase 3:** Hausa (Nigeria), Yoruba (Nigeria), Igbo (Nigeria)
**Phase 4:** French (Ivory Coast, Senegal)

## 24.3 Low-Data Optimization

- Images compressed and served via Cloudflare CDN
- Worker profile photos: max 200KB
- Portfolio images: max 500KB
- Voice messages: compressed to reduce size
- Pagination: load 20 workers at a time, load more on scroll
- Text content loads before images (progressive loading)

---

# ════════════════════════════════════════
# PART 25 — VERSION CONTROL STRATEGY
# ════════════════════════════════════════

## 25.1 GitHub Branch Strategy

```
main (protected)
  ← Only merged via pull request
  ← Render auto-deploys from main

develop
  ← Daily development work
  ← Merged to main weekly after testing

feature/feature-name
  ← One branch per feature
  ← Merged to develop when complete

hotfix/fix-name
  ← Emergency fixes to main
  ← Also merged to develop
```

## 25.2 Commit Message Format

```
type: short description

Types:
feat:     New feature
fix:      Bug fix
style:    UI/styling changes
refactor: Code restructure
db:       Database migration
docs:     Documentation update
security: Security improvement

Examples:
feat: add booking escrow payment system
fix: worker phone number showing before payment
db: add platform_warnings table migration
security: add chat message scanning for phone numbers
```

## 25.3 What Never Goes in GitHub

```
.env                ← Local environment variables
.env.render         ← Render variables
node_modules/       ← Always in .gitignore
*.key               ← Any key files
private/            ← Any private documents
```

---

# ════════════════════════════════════════
# QUICK REFERENCE CARD
# ════════════════════════════════════════

**Brand:** Navy #08081A | Gold #D4A017 | White #FFFFFF
**Stack:** Expo + Supabase + Cloudflare R2 + Resend + Paystack + Render
**Commission:** 10% on every completed booking (auto-deducted from escrow)
**Verification:** 24-hour manual review → Blue badge (worker) | 72hr → Gold badge (business)
**Phone numbers:** Hidden until booking accepted + payment made
**Secret keys:** ONLY on Render, NEVER in the app or GitHub
**Migrations:** Always run 001 → 002 → 003 → 004 → 005 → 006 → then categories_seed.sql
**Copyright:** © 2026 WiamApp. Powered by WiamLabs (every file and screen)
**Repo:** github.com/WiamLabs/WiamApp (Private)
**API:** api.wiamapp.com (deployed on Render)
**Total monthly cost:** GHS 0 until revenue allows upgrades

---

*This document was last updated: May 2026*
*Version: 2.0*
*© 2026 WiamApp. Powered by WiamLabs. All rights reserved.*
*This document is CONFIDENTIAL. Do not share outside WiamLabs.*

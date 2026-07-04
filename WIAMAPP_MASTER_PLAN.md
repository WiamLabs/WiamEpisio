# 🌍 WIAMAPP — COMPLETE MASTER PLAN
## End-to-End Product, Technical & Business Blueprint
### © 2026 WiamApp. Powered by WiamLabs
### Founder: Martin | wiamapp.com

---

> This document is the single source of truth for WiamApp.
> Every developer, every AI tool, every team member reads this first.
> Built for Africa. Starting in Accra, Ghana. Expanding to Nigeria and beyond.

---

# PART 1 — VISION & MISSION

## What WiamApp Is
WiamApp is Africa's most trusted digital service marketplace.
It connects customers who need skilled workers with verified professionals
who are ready to work — in real time, in their city.

## The Problem We Solve
- Customers waste hours trying to find reliable workers through word of mouth
- Workers waste days waiting for jobs with no consistent income
- No trusted platform exists that verifies African workers and protects both sides

## The Solution
A mobile-first marketplace where:
- Customers search, find, and book verified workers in minutes
- Workers create a profile, get verified, and start earning immediately
- Every transaction is protected, traced, and commissionable
- Trust is built through verification, ratings, and a secure escrow payment system

## Core Values
1. TRUST — Every worker is verified. Every job is traceable.
2. SPEED — Find a worker in under 5 minutes.
3. EMPOWERMENT — Workers earn on their own terms.
4. AFRICAN-FIRST — Built for African networks, payments, and culture.
5. SECURITY — Users are protected before, during, and after every job.

---

# PART 2 — TARGET USERS

## User Types
There are 4 types of users on WiamApp:

### 1. Customer (Individual)
- Homeowners, renters, small business owners
- Needs: find and book a trusted worker fast
- Pain point: can't find reliable workers, afraid of being scammed

### 2. Worker (Individual)
- Skilled tradespeople, artisans, freelancers
- Needs: consistent jobs and a platform to grow their reputation
- Pain point: no consistent customer flow, no way to build trust

### 3. Business Account
- Companies, agencies, property managers
- Needs: hire multiple workers, manage jobs at scale
- Pain point: no centralized system for hiring tradespeople

### 4. Admin (WiamLabs Team)
- Martin and the WiamLabs team
- Needs: review documents, moderate platform, view analytics, manage commissions

---

# PART 3 — THE 12 SERVICE CATEGORIES

Each category has its own icon, color accent, and worker subtypes.
These are seeded into the database on first deployment.

## 1. Building & Structural Construction
Icon: construct-outline | Color: #8B4513
Workers: Masons, Bricklayers, Tile Installers, Carpenters, Ironmongers,
         Welder-Fabricators, Concrete Workers, Scaffolding Workers,
         Roofing Specialists, Foundation Workers

## 2. Plumbing & Water Systems
Icon: water-outline | Color: #1E90FF
Workers: Domestic Plumbers, Borehole Drillers, Water Tank Installers,
         Drainage Cleaners, Pipe Fitters, Swimming Pool Technicians,
         Water Heater Installers, Septic Tank Cleaners

## 3. Electrical & Power Engineering
Icon: flash-outline | Color: #FFD700
Workers: House Wiring Electricians, Solar Panel Installers, Generator Mechanics,
         Inverter Technicians, CCTV/Satellite Installers, Transformer Technicians,
         Smart Home Installers, Security System Installers

## 4. Automotive & Mechanical Repair
Icon: car-outline | Color: #FF4500
Workers: Car Mechanics, Auto Electricians, Motorcycle/Tricycle Repairers,
         Car Body Painters, Vulcanizers, Auto AC Technicians,
         Car Wash Specialists, Truck Mechanics, Panel Beaters

## 5. Finishing, Painting & Interior Decor
Icon: brush-outline | Color: #9B59B6
Workers: House Painters, POP Ceiling Designers, Wallpaper Installers,
         Interior Decorators, Window Blind Installers, Floor Polishers,
         Gypsum Board Installers, False Ceiling Workers

## 6. Cleaning & Property Maintenance
Icon: sparkles-outline | Color: #00CED1
Workers: Deep Cleaners, Janitors, Laundry & Dry Cleaners,
         Fumigation & Pest Control, Garbage Collectors,
         Office Cleaners, Post-Construction Cleaners, Carpet Cleaners

## 7. Hair, Beauty & Personal Care
Icon: cut-outline | Color: #FF69B4
Workers: Barbers, Hairstylists, Braiders, Makeup Artists,
         Nail Technicians, Skincare Therapists, Eyebrow Artists,
         Lash Technicians, Massage Therapists, Spa Technicians

## 8. Hospitality, Catering & Culinary Arts
Icon: restaurant-outline | Color: #FF8C00
Workers: Event Caterers, Private Chefs, Bakers, Confectioners,
         Cocktail Mixologists, Local Food Cooks, Waiters/Waitresses,
         Event Food Vendors, Drinks Suppliers

## 9. Photography, Media & Creative Arts
Icon: camera-outline | Color: #4169E1
Workers: Event Photographers, Videographers, Drone Operators,
         Video Editors, Graphic Designers, Photo Editors,
         Social Media Content Creators, Brand Identity Designers

## 10. Logistics, Transport & Delivery
Icon: bicycle-outline | Color: #228B22
Workers: Dispatch Riders, Delivery Drivers, Truck/Hauling Drivers,
         Private Drivers, Courier Assistants, Airport Pickup Drivers,
         Moving Company Workers, Cargo Handlers

## 11. Education, Tuition & Home Lessons
Icon: book-outline | Color: #8B0000
Workers: Home Tutors (Math/Science), Language Instructors,
         Music Teachers, Coding/Tech Tutors, WAEC/BECE Specialists,
         Early Childhood Educators, Adult Literacy Teachers, Sign Language Tutors

## 12. Events, Entertainment & Sound
Icon: musical-notes-outline | Color: #DC143C
Workers: Event Planners, DJs, MCs, Sound Engineers,
         Stage/Lighting Designers, Ushers, Balloon Decorators,
         Event Security, Tent/Chair Suppliers, Photo Booth Operators

---

# PART 4 — FULL USER JOURNEY

## Customer Journey
```
DISCOVERY
App opened for first time
        ↓
Onboarding — "What brings you here?" → Customer selected
        ↓
Register: Full name, Email, Phone, Password
        ↓
Email OTP sent via Resend → User verifies email
        ↓
BROWSING (immediately after email verification)
Home Screen — categories, nearby workers, featured workers
        ↓
Search — filter by category, location, rating, availability
        ↓
Worker Profile — full details, portfolio, reviews, rating
        ↓
BOOKING
Customer clicks "Book Now"
        ↓
Fills: service description, location, date, time preference
        ↓
Booking sent → Worker notified immediately (push + email)
        ↓
Customer sees: "Request Pending — Worker reviewing"
        ↓
Worker accepts → Customer notified → Phone revealed
        ↓
PAYMENT
Customer pays via Paystack (Ghana: GHS, Nigeria: NGN)
        ↓
Payment held in ESCROW by WiamApp
        ↓
JOB EXECUTION
Worker arrives, does the job
        ↓
Worker marks "Job Complete" in app
        ↓
Customer confirms completion
        ↓
Escrow released → Worker paid (minus 10% commission)
        ↓
POST-JOB
Customer prompted to leave rating (1-5 stars) + review
        ↓
Worker rating updated automatically
```

## Worker Journey
```
REGISTRATION
App opened → "Offer my skills" selected
        ↓
Register: Full name, Email, Phone, Password, Skills, Location
        ↓
Email OTP verified
        ↓
Document Upload:
  - Ghana Card / Passport / Voter ID (front + back) → R2 storage
  - Live selfie → R2 storage
        ↓
Status: "Under Review — 24 hours"
        ↓
BROWSING ALLOWED (but cannot accept jobs yet)
        ↓
Admin reviews documents in Admin Dashboard
        ↓
APPROVED → Email sent → Verified Badge added → Can accept jobs
REJECTED → Email with reason → Resubmit documents
        ↓
WORKING
Worker receives booking notification
        ↓
Reviews: customer name, service needed, location, date, price
        ↓
Accept or Decline (must respond within 2 hours or auto-declines)
        ↓
If accepted: Chat opens, coordinate with customer
        ↓
Go to job → Complete → Get paid
        ↓
GROWTH
Rating builds over time
Featured listing available (paid promotion)
Pro subscription for lower commission rate
```

---

# PART 5 — PLATFORM PROTECTION SYSTEM

## The Problem
Workers and customers will try to connect outside the app to avoid paying commission.
This kills the business. Here is how we prevent it.

## Protection Layer 1 — Hidden Phone Numbers
- Worker phone number is NEVER visible on the profile
- It is only revealed AFTER:
  a) Booking is created
  b) Worker accepts
  c) Payment is held in escrow
- This forces payment through the app before contact is made

## Protection Layer 2 — Escrow Payments
- Customer pays BEFORE job starts
- Money is held by WiamApp (not sent to worker yet)
- Money released to worker ONLY after customer confirms job complete
- WiamApp takes 10% commission automatically before releasing

## Protection Layer 3 — Chat Monitoring
Every message sent in the app is scanned for:
- Phone numbers (Ghana: 0XX XXXXXXX, Nigeria: 0XXXXXXXXXX)
- Payment app mentions (MoMo, Cash, Bank Transfer)
- Suspicious phrases ("pay me directly", "my number is", "call me outside")
If detected:
- Message is flagged
- Warning sent to both parties
- Admin notified
- Worker gets a strike (3 strikes = automatic suspension)

## Protection Layer 4 — Review Gating
- Customers can ONLY leave a review if they booked through the app
- Workers cannot have verified reviews from outside jobs
- This makes the in-app review system extremely valuable

## Protection Layer 5 — Value Lock-in
Workers MUST stay on the app because:
- Their rating and reviews only exist on WiamApp
- Their job history builds their reputation for credit/loans
- Disputes are only covered if the job was booked through WiamApp
- Featured listings and Pro subscriptions reward loyalty

## Protection Layer 6 — Report System
"Did this worker ask you to pay outside the app?" button on every completed job.
If reported:
- Worker is automatically suspended pending review
- Admin investigates with full audit trail
- Ghana Card on file allows police referral if fraud confirmed

---

# PART 6 — VERIFICATION SYSTEM (24-HOUR WINDOW)

## Philosophy
We want to grow fast but stay safe. So we let users explore immediately,
but they cannot transact until verified.

## The Flow
```
Register → Email OTP verified → Access app (browse only)
        ↓
Upload documents (Ghana Card + Selfie)
        ↓
Admin gets notification to review
        ↓
24-hour review window
        ↓
Approved: Verified badge + can accept bookings
Rejected: Email with clear reason + can resubmit
```

## What Admin Reviews
- Ghana Card / Passport / Voter ID photo (front + back)
- Live selfie photo
- Face match (manual comparison for now, Smile Identity AI later)
- Name on ID matches name on profile

## Document Storage
- All documents stored in Cloudflare R2 (private bucket)
- NEVER accessible publicly — only via temporary signed URL (15 min expiry)
- Only WiamLabs admin can request signed URLs
- Documents encrypted at rest

## Future: Smile Identity AI (Phase 2)
- Automatic Ghana Card verification against government database
- Face match AI — compares selfie to ID photo
- Liveness detection — confirms real human, not a photo
- This will be added when revenue allows

---

# PART 7 — COMPLETE FEATURE LIST

## MVP Features (Build First)
- [ ] Onboarding with 3 paths (Customer / Worker / Business)
- [ ] Email OTP verification via Resend
- [ ] Worker profile creation with all 12 categories
- [ ] Ghana Card + Selfie document upload to R2
- [ ] Admin document review queue
- [ ] 24-hour verification window
- [ ] Home screen with 12 categories + nearby workers
- [ ] Search with filters (category, location, verified only, available only)
- [ ] Worker profile page (bio, portfolio, reviews, stats, ratings)
- [ ] Booking system (request, accept, reject, complete)
- [ ] Phone number hidden until booking accepted
- [ ] Real-time chat (text + voice messages)
- [ ] Escrow payment via Paystack
- [ ] 10% commission deducted automatically
- [ ] Rating and review system (only after completed booking)
- [ ] Push notifications + email notifications
- [ ] Worker dashboard (jobs, earnings, availability toggle)
- [ ] Customer bookings list (active, completed, cancelled)
- [ ] Dark mode (Navy #08081A) + Light mode (White #FFFFFF)
- [ ] Verified badge system

## Phase 2 Features (After Launch)
- [ ] Smile Identity AI verification
- [ ] Featured worker listings (workers pay to appear at top)
- [ ] Pro subscription plan (8% commission instead of 10%)
- [ ] Business accounts (hire multiple workers, team management)
- [ ] Map view (OpenStreetMap — find workers near me on a map)
- [ ] Job scheduling (book in advance for a specific date/time)
- [ ] Worker portfolio video uploads
- [ ] In-app dispute resolution system
- [ ] Admin analytics dashboard (revenue, commissions, top categories)
- [ ] Referral system (invite friends, earn credits)

## Phase 3 Features (Scale)
- [ ] Nigeria launch (Lagos first)
- [ ] AI job matching (automatically suggest best worker for a job)
- [ ] Multi-currency (GHS, NGN)
- [ ] WiamApp Pro for customers (subscription for priority booking)
- [ ] Worker insurance (job protection coverage)
- [ ] Credit scoring for workers (based on job history)
- [ ] Enterprise API for third-party integrations
- [ ] Franchise model for other African cities

---

# PART 8 — COMPLETE SCREEN LIST

## Auth Screens
1. SplashScreen — logo animation, brand loading
2. OnboardingScreen — "What brings you here?" (Customer/Worker/Business)
3. LoginScreen — email + password
4. RegisterScreen — role-based registration form
5. EmailOTPScreen — 6-digit code verification
6. ForgotPasswordScreen — reset via email
7. ResetPasswordScreen — new password entry

## Verification Screens (Worker/Business)
8. VerificationIntroScreen — explain the process, what's needed
9. IDTypeScreen — choose Ghana Card / Passport / Voter ID / Driver's License
10. IDUploadScreen — upload front and back of ID
11. SelfieScreen — live selfie capture (no upload from gallery)
12. VerificationPendingScreen — "Under review — 24 hours"
13. VerificationApprovedScreen — celebration, badge awarded
14. VerificationRejectedScreen — reason shown, resubmit option

## Customer Screens
15. CustomerHomeScreen — categories, nearby workers, featured, search bar
16. SearchScreen — search + filters (category, distance, rating, verified)
17. CategoryScreen — all workers in a specific category
18. WorkerProfileScreen — full profile, portfolio, reviews, book button
19. BookingFormScreen — fill service details, location, date, time
20. BookingConfirmScreen — review before submitting
21. BookingSuccessScreen — confirmed, reference number shown
22. BookingsListScreen — all bookings (active, completed, cancelled)
23. BookingDetailScreen — full details of one booking
24. PaymentScreen — Paystack payment integration
25. PaymentSuccessScreen — receipt shown
26. ChatListScreen — all conversations inbox
27. ChatScreen — real-time messages + voice messages
28. ReviewScreen — leave rating and written review
29. CustomerProfileScreen — profile, settings, verification status
30. NotificationsScreen — all notifications

## Worker Screens
31. WorkerDashboardScreen — stats, availability toggle, pending jobs
32. WorkerJobsScreen — all jobs (pending, active, completed)
33. JobDetailScreen — full details of one job (accept/reject)
34. WorkerChatScreen — same chat system
35. EarningsScreen — total earned, commission breakdown, payout history
36. WorkerProfileEditScreen — edit bio, skills, rates, portfolio
37. PortfolioScreen — manage portfolio images
38. WorkerNotificationsScreen — job alerts, review alerts

## Admin Screens (separate admin app or web dashboard)
39. AdminDashboardScreen — overview stats
40. DocumentQueueScreen — review pending verifications
41. DocumentReviewScreen — view ID + selfie, approve or reject
42. FraudReportsScreen — all open fraud reports
43. WorkerManagementScreen — search, suspend, ban workers
44. CommissionReportScreen — earnings by day/week/month
45. UserSearchScreen — find any user by name, email, or phone

---

# PART 9 — COMPLETE TECH STACK

## Mobile App
- Framework: React Native + Expo (SDK 51)
- Navigation: React Navigation v6 (Stack + Bottom Tabs)
- State Management: React Context API + useState/useEffect
- Storage: AsyncStorage (session persistence)
- Icons: @expo/vector-icons (Ionicons)
- Camera: expo-image-picker (for document uploads)
- Location: expo-location (for nearby workers)
- Audio: expo-av (for voice messages)
- Notifications: expo-notifications (push notifications)
- Device: expo-device (fingerprinting)

## Backend
- Runtime: Node.js 18+
- Framework: Express.js
- Security: Helmet, CORS, express-rate-limit
- File Uploads: Multer (memory storage)
- Environment: dotenv
- Deployment: Render.com

## Database & Auth
- Platform: Supabase (PostgreSQL)
- Auth: Supabase Auth (email/password + OTP)
- Realtime: Supabase Realtime (messages, notifications, bookings)
- Security: Row Level Security (RLS) on all tables
- Storage: Supabase for session management only

## File Storage
- Images (avatars, portfolios): Cloudflare R2 (public bucket)
- Voice messages: Cloudflare R2 (public bucket)
- ID documents + selfies: Cloudflare R2 (PRIVATE bucket — signed URLs only)
- SDK: @aws-sdk/client-s3 (R2 is S3-compatible)

## Payments
- Primary: Paystack (Ghana GHS + Nigeria NGN)
- Commission: 10% per transaction (held in escrow)
- Future: MTN MoMo for Ghana

## Email
- Provider: Resend
- Templates: HTML email templates (branded WiamLabs design)
- Triggers: OTP, Welcome, Verification approved/rejected, Booking updates

## Identity Verification (Phase 2)
- Provider: Smile Identity
- Features: Ghana Card AI check, Face match, Liveness detection
- Coverage: Ghana (GH), Nigeria (NG)

## Domain & DNS
- Domain: wiamapp.com
- DNS Provider: Cloudflare (also serves R2 CDN)
- Custom domain on Render backend: api.wiamapp.com

## Code Repository
- Platform: GitHub
- Organization: WiamLabs
- Repository: WiamLabs/WiamApp (Private)
- Branch: main (protected)

---

# PART 10 — DATABASE SCHEMA OVERVIEW

## Core Tables
- users — all users (customers, workers, businesses, admins)
- worker_profiles — extended profile for workers
- categories — the 12 service categories
- worker_categories — many-to-many (worker can be in multiple categories)
- portfolio_images — worker portfolio photos

## Transaction Tables
- bookings — all job requests and their status
- reviews — customer reviews after completed bookings
- messages — chat messages between customer and worker
- notifications — in-app notifications
- payments — all payment records with escrow tracking

## Security Tables
- verifications — verification records (phone OTP, ID, face match)
- document_reviews — admin queue for manual document review
- business_verifications — business registration documents
- audit_logs — permanent append-only log of every action
- fraud_reports — customer/worker fraud reports
- platform_warnings — off-platform payment warnings
- device_fingerprints — duplicate account detection
- otp_codes — email OTP code storage

## Monetization Tables
- subscriptions — worker subscription plans (free/basic/pro)
- featured_workers — paid featured listing records

---

# PART 11 — API ENDPOINTS

## Auth
POST   /api/auth/register          — register new user
POST   /api/auth/login             — login (handled by Supabase)
GET    /api/auth/me                — get current user profile
POST   /api/auth/send-otp         — send email OTP
POST   /api/auth/verify-otp       — verify OTP code
POST   /api/auth/forgot-password  — send reset email
POST   /api/auth/reset-password   — set new password

## Workers
GET    /api/workers                — get all workers (with filters)
GET    /api/workers/:id            — get single worker profile
GET    /api/workers/search/:query  — search workers
PATCH  /api/workers/availability   — toggle availability on/off
GET    /api/workers/meta/categories — get all 12 categories

## Bookings
POST   /api/bookings               — create new booking
GET    /api/bookings               — get all bookings for current user
GET    /api/bookings/pending       — get pending bookings (worker)
PATCH  /api/bookings/:id/accept    — accept a booking (worker)
PATCH  /api/bookings/:id/reject    — reject a booking (worker)
PATCH  /api/bookings/:id/complete  — mark job as complete
PATCH  /api/bookings/:id/cancel    — cancel a booking (customer)
POST   /api/bookings/:id/review    — leave a review

## Uploads
POST   /api/uploads/avatar         — upload profile photo → R2
POST   /api/uploads/portfolio      — upload portfolio image → R2
POST   /api/uploads/voice          — upload voice message → R2
POST   /api/uploads/document       — upload ID document → R2 (private)
POST   /api/uploads/selfie         — upload selfie → R2 (private)

## Verification
POST   /api/verify/id              — submit ID for review (manual MVP)
GET    /api/verify/status          — get verification status
POST   /api/verify/admin/approve   — admin approves verification
POST   /api/verify/admin/reject    — admin rejects with reason

## Payments
POST   /api/payments/paystack/initiate  — start Paystack payment
GET    /api/payments/paystack/verify/:ref — verify payment
POST   /api/payments/escrow/release    — release escrow to worker
GET    /api/payments/commission-report — admin commission report

## Notifications
GET    /api/notifications           — get all notifications
GET    /api/notifications/unread-count — unread count
PATCH  /api/notifications/:id/read  — mark one as read
PATCH  /api/notifications/read-all  — mark all as read

## Platform Protection
GET    /api/workers/:id/contact    — get contact (only after booking + payment)
POST   /api/protection/flag-payment — report off-platform payment attempt

---

# PART 12 — BRAND GUIDELINES

## WiamLabs Identity
- Company: WiamLabs
- Product: WiamApp
- Tagline: Africa's Trusted Service Marketplace
- Copyright: © 2026 WiamApp. Powered by WiamLabs

## Colors
- Navy (primary dark): #08081A
- Gold (accent/buttons): #D4A017
- White (light backgrounds): #FFFFFF
- Gold Light: #F0C040
- Gold Dark: #A07810
- Success: #22C55E
- Error: #EF4444
- Warning: #F59E0B

## Theme Rules
- Light Mode: White background, Navy text, Gold buttons
- Dark Mode: Navy background, White text, Gold buttons (ALWAYS gold)
- Gold buttons NEVER change color between light and dark mode
- This is a brand signature

## Typography
- App name: Bold, large, letter-spaced
- Headings: Semi-bold (600)
- Body: Regular (400)
- Captions: Light (300)

---

# PART 13 — MONETIZATION MODEL

## Revenue Streams

### 1. Transaction Commission (Primary — Launch)
- 10% on every completed booking
- Automatic deduction from escrow before worker payout
- Example: GHS 200 job → GHS 20 commission → GHS 180 to worker

### 2. Featured Listings (Phase 2)
- Workers pay to appear at the top of search results
- Pricing: GHS 50/week or GHS 150/month
- Limited spots per category to maintain value

### 3. Verified Badge (Phase 2)
- Premium verification with Smile Identity AI
- One-time fee: GHS 20 per worker
- Badge never expires (unless fraud detected)

### 4. Subscription Plans (Phase 2)
| Plan | Price | Commission | Features |
|------|-------|------------|----------|
| Free | GHS 0/month | 10% | Basic profile, bookings |
| Basic | GHS 30/month | 8% | Lower commission, priority support |
| Pro | GHS 80/month | 6% | Lowest commission, featured listing, analytics |

### 5. Business Accounts (Phase 3)
- Monthly fee: GHS 200-500/month based on team size
- Bulk booking tools
- Dedicated account manager

---

# PART 14 — LAUNCH STRATEGY

## Phase 1 — Accra MVP (Months 1-3)
Target: 500 verified workers, 2,000 customers
Focus areas: East Legon, Osu, Cantonments, Airport Residential, Adenta
Strategy:
- Go to trade schools and apprenticeship centers
- Partner with landlord associations
- Social media ads targeting Accra homeowners
- WhatsApp community groups
- Referral bonus: invite a worker, get GHS 10 credit

## Phase 2 — All Ghana (Months 4-8)
Target: 5,000 workers, 20,000 customers
Expand to: Kumasi, Takoradi, Tamale, Cape Coast
Strategy:
- Partner with Ghana Employers Association
- Press coverage (Joy FM, Citi FM, Ghana Web)
- University campuses for tutor category

## Phase 3 — Nigeria Launch (Months 9-15)
Target: Lagos first, then Abuja
Localize: NGN currency, Nigerian NIN verification
Partner: Lagos State government artisan registry

## Phase 4 — West Africa (Year 2+)
Expand to: Ivory Coast, Senegal, Sierra Leone, Liberia

---

# PART 15 — SECURITY ARCHITECTURE SUMMARY

## Authentication
- Supabase Auth (JWT tokens, auto-refresh)
- Email OTP via Resend
- Phone OTP via Supabase (future)
- Session stored in AsyncStorage (mobile)

## Authorization
- Row Level Security (RLS) on every database table
- Users can ONLY read/write their own data
- Admin operations use service role key (server-side only, never in app)
- JWT token verified on every API request

## Data Protection
- ID documents stored in private R2 bucket
- Signed URLs expire in 15 minutes
- Documents never accessible publicly
- Audit log is append-only (cannot be deleted or modified)

## Anti-Fraud
- Device fingerprinting detects duplicate accounts
- IP logging on every login
- Suspicious login detection (location change > 220km in 1 hour)
- 3 failed verifications = automatic account suspension
- 3 platform warnings = automatic worker suspension
- Full fraud trace: name + Ghana Card + address + audit logs

## Rate Limiting
- Global: 100 requests per 15 minutes per IP
- Auth routes: 10 requests per 15 minutes
- Verification routes: 5 requests per hour

---

# PART 16 — ENVIRONMENT VARIABLES REFERENCE

## Mobile App (.env)
EXPO_PUBLIC_SUPABASE_URL — Supabase project URL
EXPO_PUBLIC_SUPABASE_ANON_KEY — Supabase publishable key (safe for app)
EXPO_PUBLIC_BACKEND_URL — Render backend URL (api.wiamapp.com)
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME — Cloudinary cloud name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET — wiamapp_unsigned
EXPO_PUBLIC_APP_ENV — development or production
EXPO_PUBLIC_DEFAULT_COUNTRY — Ghana
EXPO_PUBLIC_DEFAULT_CURRENCY — GHS

## Backend Server (Render Environment)
SUPABASE_URL — Supabase project URL
SUPABASE_SECRET_KEY — Supabase secret key (NEVER in app)
CLOUDFLARE_R2_ENDPOINT — R2 S3-compatible endpoint
CLOUDFLARE_R2_ACCESS_KEY_ID — R2 access key
CLOUDFLARE_R2_SECRET_ACCESS_KEY — R2 secret key
CLOUDFLARE_R2_BUCKET_NAME — wiamapp
CLOUDFLARE_R2_PUBLIC_URL — public CDN URL
RESEND_API_KEY — Resend email API key
PAYSTACK_SECRET_KEY — Paystack secret key
SMILE_IDENTITY_PARTNER_ID — add in Phase 2
SMILE_IDENTITY_API_KEY — add in Phase 2
SMILE_IDENTITY_ENV — sandbox or production
NODE_ENV — production
PORT — 3000

---

# PART 17 — CURSOR INSTRUCTIONS

## How To Use This Document
When you open this project in Cursor, read this document first.
Every decision made in this project is explained here.

## Coding Rules
1. Every file must have the copyright comment at the top:
   // © 2026 WiamApp. Powered by WiamLabs

2. Brand colors are in constants/colors.js — always import from there
   NEVER hardcode color values in components

3. All API calls from the mobile app go through lib/api/ files
   NEVER call Supabase directly from screen files

4. All file uploads go through the backend — NEVER upload directly
   from the app to R2 or Cloudinary (security risk)

5. The secret Supabase key is ONLY in backend/lib/supabaseAdmin.js
   NEVER import supabaseAdmin into screen files

6. Dark mode uses Navy (#08081A) background
   Light mode uses White (#FFFFFF) background
   Gold (#D4A017) buttons ALWAYS stay gold in both modes

7. Every new database table needs RLS policies
   Copy the pattern from 004_rls_policies.sql

8. Every important user action must be logged to audit_logs
   Use the logAction() function from lib/api/security.js

## File Structure Rules
- New screens go in: screens/
- New API calls go in: lib/api/
- New backend routes go in: backend/routes/
- New backend utilities go in: backend/lib/
- New database changes go in: database/migrations/ (numbered sequentially)

---

# PART 18 — DATABASE MIGRATION ORDER

Always run in this exact order:
001_core_tables.sql
002_bookings_messages.sql
003_security_payments.sql
004_rls_policies.sql
005_security_functions.sql
006_mvp_verification_escrow.sql

After each new feature, add a new numbered migration file.
NEVER modify existing migration files after they have been run in production.

---

# PART 19 — TESTING CHECKLIST

Before handing to any developer or AI tool, confirm:

## Auth
[ ] Customer can register with email
[ ] OTP email arrives via Resend
[ ] OTP verifies correctly
[ ] Login works
[ ] Logout clears session
[ ] Wrong password shows error

## Worker Verification
[ ] Worker can upload Ghana Card (front + back)
[ ] Worker can take selfie
[ ] Files appear in R2 bucket
[ ] Admin sees documents in review queue
[ ] Admin can approve — worker gets email + verified badge
[ ] Admin can reject with reason — worker gets email

## Booking Flow
[ ] Customer can search workers
[ ] Customer can view worker profile
[ ] Customer cannot see worker phone number before booking
[ ] Customer can create booking
[ ] Worker receives notification
[ ] Worker can accept or reject
[ ] After acceptance — customer sees phone number
[ ] Payment goes through Paystack
[ ] Payment held in escrow
[ ] Job completed — escrow released — 10% taken

## Chat
[ ] Customer and worker can message each other
[ ] Messages appear in real time
[ ] Phone numbers in chat trigger warning
[ ] Voice messages record and play back

## Security
[ ] Cannot access another user's data
[ ] Cannot create booking with unverified worker
[ ] Rate limiting blocks after too many requests
[ ] Audit log records all key actions

---

*© 2026 WiamApp. Powered by WiamLabs. All rights reserved.*
*This document is confidential. Do not share outside of WiamLabs.*

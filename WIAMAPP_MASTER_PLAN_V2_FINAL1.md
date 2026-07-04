# 🌍 WIAMAPP — MASTER PLAN V2 FINAL (COMPLETE)
## The Official End-to-End Product, Technical & Business Blueprint
### © 2026 WiamApp. Powered by WiamLabs
### Founder: Martin | wiamapp.com | github.com/WiamLabs/WiamApp
### Version: 2.0 FINAL COMPLETE

---

> THIS IS THE SINGLE SOURCE OF TRUTH FOR WIAMAPP.
> Every developer, every AI tool (Cursor, Claude, ChatGPT, Windsurf),
> every team member reads this ENTIRE document before writing one line of code.
> No decision is made without reference to this document.

---

# PART 1 — VISION AND MISSION

## 1.1 What WiamApp Is

WiamApp is Africa's most trusted digital service marketplace.
It connects customers who need skilled workers with verified professionals
who are ready to work in real time in their city.

WiamApp is not just an app. It is a movement to formalize Africa's informal economy,
empower workers to earn with dignity, and give every party on the platform peace of mind.
Both workers AND customers are verified. Both sides are protected.

## 1.2 The Two Problems We Solve

FOR CUSTOMERS:
- Hours wasted searching for reliable workers by word of mouth
- Cannot verify if a worker is skilled, trusted, or real
- Lose money to scammers and no-shows
- Zero recourse after a bad experience

FOR WORKERS:
- Inconsistent job flow with no stable income
- No platform to build and protect their reputation
- No protection against dangerous or fraudulent customers
- No way to prove skills to strangers

## 1.3 Core Values

1. TRUST — Every worker is verified. Every customer is verified.
2. SPEED — Find a verified worker in under 5 minutes.
3. MUTUAL PROTECTION — Workers protected from bad customers. Customers protected from bad workers.
4. EMPOWERMENT — Workers earn on their own terms. No boss. No middleman.
5. AFRICAN-FIRST — Built for African networks, payments, languages, and culture.
6. INTEGRITY — No fake reviews. No fake badges. No advertisements. Ever.

## 1.4 Brand Identity

Company: WiamLabs
Product: WiamApp
Tagline: Africa's Trusted Service Marketplace
Website: wiamapp.com
API: api.wiamapp.com
Careers: wiamapp.com/careers
GitHub: github.com/WiamLabs/WiamApp (Private)
Copyright: © 2026 WiamApp. Powered by WiamLabs

## 1.5 Brand Colors

Navy:        #08081A  — dark backgrounds, worker screens, dark mode
Gold:        #D4A017  — ALL buttons and badges, never changes between themes
White:       #FFFFFF  — light backgrounds, cards, light mode
Gold Light:  #F0C040  — hover states
Gold Dark:   #A07810  — pressed buttons
Success:     #22C55E  — available, approved, confirmed
Error:       #EF4444  — unavailable, rejected, danger
Warning:     #F59E0B  — pending, under review
Info:        #3B82F6  — active, in progress
Online:      #22C55E  — green dot for online status

ABSOLUTE RULES:
- Gold (#D4A017) buttons NEVER change between light and dark mode
- Worker screens ALWAYS use Navy background
- Customer screens default to White
- NEVER hardcode colors — always import from constants/colors.js
- Every file starts with: // 2026 WiamApp. Powered by WiamLabs

---

# PART 2 — PLATFORM PHILOSOPHY

## 2.1 No Advertisements Ever

WiamApp will never use banner ads, popup ads, spam networks, or ad tracking.

Revenue comes from:
- Transaction commissions
- Worker subscription plans
- Spotlight boost payments
- Business account fees
- Featured worker listings

## 2.2 No Dark Patterns

No hidden charges. No fake urgency. No fake badges. No misleading pricing.

## 2.3 Mutual Trust Commitment

Workers are protected from dangerous and fraudulent customers.
Customers are protected from scam workers and no-shows.
Both parties verified before any contact is made.
Escrow guarantees payment before work begins.

---

# PART 3 — HOW BOOKING MONEY WORKS

This section explains the complete money flow clearly.

## 3.1 Worker Pricing

Every worker sets their own hourly rate on their profile.
Example: Kwame the electrician sets GHS 80 per hour.
This rate is visible to customers before booking.
It is a starting rate — final price is agreed in chat.

## 3.2 Complete Payment Flow

STEP 1 — Customer finds worker, views profile (sees hourly rate)
STEP 2 — Customer creates a booking request (describes the job)
STEP 3 — Worker receives notification and reviews the request
STEP 4 — Worker ACCEPTS the booking
STEP 5 — IN-APP CHAT OPENS immediately (no payment needed to chat)
STEP 6 — Customer and worker discuss the job in chat
STEP 7 — They agree on a final total price for the job
STEP 8 — Customer pays the agreed amount via Paystack
STEP 9 — Payment held in ESCROW by WiamApp (worker cannot access yet)
STEP 10 — Worker travels to the job, checks in with GPS
STEP 11 — Worker completes the job, marks it done in app
STEP 12 — Customer confirms: "Yes, the job is done"
STEP 13 — Escrow released automatically
STEP 14 — WiamApp deducts commission from the total
STEP 15 — Worker receives their payment (minus commission) within 24 hours

## 3.3 Phone Number Rules

During chat (steps 5-8): Phone numbers are hidden on both sides.
All communication happens through in-app chat only.
After payment is made (step 8): Worker phone number is revealed to customer.
Customer phone number is revealed to worker.

Why this works:
- They can discuss the job properly in chat before paying
- Payment is made before they exchange personal numbers
- WiamApp commission cannot be skipped
- Both parties are on record before meeting

## 3.4 Emergency Mode Payment

When customer presses "Need Help Urgently":
- Standard rate plus 20% emergency premium is automatically applied
- Example: GHS 80/hr worker becomes GHS 96/hr during emergency
- The extra 20% is kept by WiamApp as emergency service fee
- Customer sees this before confirming

## 3.5 Currency Storage Rule

ALL monetary values are stored in USD in the database.
The platform converts to local currency at display time using daily exchange rates.
This ensures amounts remain accurate as WiamApp expands to Nigeria and beyond.

Example in database: amount_usd = 8.50
Display in Ghana: GHS 102.00
Display in Nigeria: NGN 14,450

Founder and Financial Manager can change subscription prices in USD from their dashboard.
Prices update across all countries automatically when changed.

NEVER store amounts with date fields. Prices must be editable at any time.
Store prices separately from transactions so they can be updated independently.

---

# PART 4 — SUBSCRIPTION AND BADGE SYSTEM

## 4.1 The Critical Rule About Badges

A verified worker does NOT automatically get a badge.
Verification (uploading ID and selfie) is required to appear on the platform.
The badge is earned by paying for a subscription plan.

## 4.2 Badge Hierarchy

Level 1: No badge — Free verified worker
Level 2: Blue Checkmark — Basic subscriber
Level 3: Blue Checkmark + Pro label — Pro subscriber
Level 4: Gold Checkmark — Any Business Account
Level 5: Elite Partner Diamond — Exclusive (Phase 3 — top performing businesses)

## 4.3 Individual Worker Plans (stored in USD)

FREE WORKER
- Monthly fee: $0
- Commission: 15% per job
- No badge displayed
- Standard search placement
- Cannot post on Spotlight
- Basic profile

BASIC WORKER — Blue Checkmark
- Monthly fee: $2.50 per month (approx GHS 30, NGN 4,000)
- Commission: 10% per job
- Blue Checkmark badge on profile and search results
- Higher search placement than Free workers
- Spotlight access (post completed work and promotions)
- Basic analytics: profile views, booking rate
- Profile highlighted with gold border

PRO WORKER — Blue Checkmark + Pro
- Monthly fee: $7.00 per month (approx GHS 80, NGN 12,000)
- Commission: 7% per job
- Blue Checkmark + Pro label
- TOP search placement (above Basic and Free)
- Advanced analytics dashboard
- 5 free Spotlight boosts per month
- Featured in Top Rated section on home screen
- Priority customer support
- Eligible to apply for Business Account

## 4.4 Business Account Plans (stored in USD)

STARTER BUSINESS — Gold Checkmark
- Monthly fee: $22 per month (approx GHS 250)
- Commission: 8% per job
- Team: Up to 5 workers
- Gold Checkmark badge
- Priority placement above all individual workers
- Company profile page
- Team management dashboard
- Bulk booking system
- Company portfolio gallery
- Business analytics
- 3 free Spotlight posts per month

GROWTH BUSINESS — Gold Checkmark
- Monthly fee: $44 per month (approx GHS 500)
- Commission: 8% per job
- Team: Up to 25 workers
- Everything in Starter PLUS:
- Advanced team management with role assignments
- Job assignment system
- Advanced analytics with CSV/PDF export
- Dedicated account manager
- 10 free Spotlight posts + 1 boosted post per month
- Custom company banner
- Quarterly business review call with WiamLabs

ENTERPRISE BUSINESS — Gold Checkmark + Elite
- Monthly fee: $105 per month (approx GHS 1,200)
- Commission: 7% per job
- Team: Unlimited workers
- Everything in Growth PLUS:
- Multi-location support
- Full API access
- White-label profile option
- 24/7 dedicated account manager
- SLA guarantee
- Unlimited Spotlight posts with premium credits
- Monthly business intelligence reports
- Enterprise security features (SSO, admin controls)
- First access to expansion markets
- Invited to WiamApp Enterprise Partner Program

ELITE PARTNER — Diamond Badge (Phase 3)
- By invitation only
- Reserved for WiamApp's highest-performing and most trusted businesses
- Custom pricing negotiated directly with WiamLabs
- Co-marketing opportunities with WiamApp brand

## 4.5 Plan Comparison Table

Feature          | Free  | Basic | Pro   | Starter | Growth  | Enterprise
Price/month USD  | $0    | $2.50 | $7    | $22     | $44     | $105
Commission       | 15%   | 10%   | 7%    | 8%      | 8%      | 7%
Badge            | None  | Blue  | Blue+ | Gold    | Gold    | Gold
Search rank      | Last  | Mid   | TOP   | Priority| Priority| Priority
Team workers     | 1     | 1     | 1     | 5       | 25      | Unlimited
Spotlight        | No    | Yes   | 5 free| 3 free  | 10 free | Unlimited
Analytics        | None  | Basic | Adv   | Business| Advanced| Enterprise
Account manager  | No    | No    | No    | No      | Yes     | 24/7

---

# PART 5 — ONLINE STATUS AND PROFILE PICTURES

## 5.1 Online Status Green Dot

Every user (worker and customer) shows an online status indicator.

Green dot (solid): User is currently active in the app
Yellow dot: User was active less than 30 minutes ago
No dot: User is offline

The green dot appears beside profile pictures in:
- Home screen worker cards
- Search results
- Worker profile page
- Chat list (inbox)
- Chat screen header
- Booking request screen
- Worker dashboard (their own status)
- Business team management list

## 5.2 Profile Pictures — Where They Appear

Profile pictures (avatars) appear in every place a user is represented:
- Home screen worker cards (small circular photo)
- Search results (small circular photo)
- Worker full profile page (large circular photo with gold border)
- Chat list — conversation row (small circular photo)
- Chat screen header (medium circular photo)
- Booking detail screen (small photo of worker and customer)
- Reviews section (small photo of reviewer)
- Spotlight posts (small photo of author)
- Worker dashboard header (medium photo)
- Notifications (small photo of related user)
- Business team list (small photos of each team member)
- Admin document queue (photo of person being reviewed)

Workers without a profile picture see a placeholder with their initials on navy background with gold text.

---

# PART 6 — BEAUTIFUL LANDING SCREEN

## 6.1 What the Landing Screen Is

The Landing Screen is the first thing users see after the Splash Screen.
It is a scrollable marketing page inside the Expo app.
It sells WiamApp's value before asking users to register.

It must be BEAUTIFUL. Premium design. Navy and Gold brand throughout.
It scrolls vertically like a website but lives inside the mobile app.

## 6.2 Landing Screen Content (Top to Bottom)

SECTION 1 — HERO
- WiamApp logo (large, centered)
- Powered by WiamLabs
- Headline: "Africa's Most Trusted Service Marketplace"
- Sub-headline: "Find verified workers. Book safely. Pay securely."
- Animated background (subtle gold particles or waves)
- "Let's Get Started" gold button

SECTION 2 — SOCIAL PROOF NUMBERS
- 500+ Verified Workers
- 12 Service Categories
- 100% Secure Payments
- 24hr Identity Verified

SECTION 3 — HOW IT WORKS (3 steps with icons)
Step 1: Search — Find verified workers near you
Step 2: Book — Schedule a job safely through the app
Step 3: Pay — Secure payment with WiamApp protection

SECTION 4 — FOR CUSTOMERS
- Heading: "Find trusted help, fast"
- Verified workers only
- Secure escrow payment (money protected)
- Real reviews from real customers
- Rate and review after every job
- Emergency mode for urgent needs

SECTION 5 — FOR WORKERS
- Heading: "Turn your skills into income"
- Create a free profile in minutes
- Receive job requests near you
- Build your verified reputation
- Get paid safely after every job
- Upgrade to Basic or Pro for more visibility

SECTION 6 — FOR BUSINESSES
- Heading: "Grow your service business"
- Gold Checkmark verification
- Team management tools
- Priority search placement
- Advanced business analytics
- Enterprise partnership available

SECTION 7 — SECURITY AND TRUST
- Identity verified workers and customers
- Escrow payment protection
- GPS job tracking
- SOS emergency button
- "Protected by WiamApp" guarantee
- Full fraud tracing system

SECTION 8 — THE 12 CATEGORIES
Show all 12 category icons with emojis in a grid

SECTION 9 — TESTIMONIALS (placeholder for real testimonials later)
- Customer testimonial cards with star ratings

SECTION 10 — DOWNLOAD / GET STARTED
- Large gold "Let's Get Started" button
- App Store and Google Play badges (links to download)

SECTION 11 — FOOTER
- WiamApp logo (small)
- Careers (opens wiamapp.com/careers in browser)
- Terms of Service (opens wiamapp.com/terms)
- Privacy Policy (opens wiamapp.com/privacy)
- Contact Us (opens wiamapp.com/contact)
- © 2026 WiamApp. Powered by WiamLabs

## 6.3 After The Landing Screen

When user presses "Let's Get Started":
Navigate to OnboardingScreen (choose path: Customer / Worker / Business)

---

# PART 7 — TEAM SYSTEM AND CAREER APPLICATIONS

## 7.1 Philosophy

WiamApp team members do not join through the app.
They apply through the website, go through a strict review process,
and receive a secure dashboard access code.
All team work happens on the website — not in the Expo app.

## 7.2 Career Application Process (Website Only)

STEP 1: Person visits wiamapp.com/careers
STEP 2: Sees all available team positions with descriptions
STEP 3: Clicks "Apply" on the position they want
STEP 4: Fills the detailed application form (no shortcuts, everything required)
STEP 5: Submits application
STEP 6: Receives email: "Your application has been received and is under review.
         This process takes 2 to 3 business days. Please check your email regularly."
STEP 7: Founder or senior leader reviews the application within 2-3 days
STEP 8a: REJECTED — receives email with a respectful reason
STEP 8b: APPROVED — receives congratulations email (see section 7.4)

## 7.3 Application Form Fields

Every field is required. No shortcuts. WiamLabs is not playing.

- Full legal name
- Email address (personal)
- Phone number
- Country and city
- Position applying for
- Years of experience in this field
- Relevant skills (detailed)
- Previous employers and roles
- Why they want to join WiamApp
- What they bring to WiamLabs
- Link to portfolio or LinkedIn (where applicable)
- Availability (full time / part time / remote)
- Uploaded CV/Resume
- Uploaded ID document
- Optional: cover letter
- References (name + contact of 2 previous employers or colleagues)
- Declaration: "All information provided is true and accurate"

## 7.4 Approval Email Content

Subject: Congratulations — Welcome to the WiamLabs Family

Dear [Name],

We are delighted to inform you that your application to join WiamLabs as [Position]
has been reviewed and approved by our leadership.

You are now a member of the WiamLabs team.

NEXT STEPS:
Your secure access code will arrive in a separate email within 24 hours.
This code is your key to your private team dashboard.

IMPORTANT SECURITY NOTICE — READ CAREFULLY:
- Your access code is personal and confidential
- Never share it with anyone — not even fellow team members
- Never write it down in an unsecured location
- The code expires every 10 days. A new one is automatically sent before expiry.
- If you believe your code has been seen by anyone, report it immediately
- Unauthorized access to team dashboards is a serious breach that will result in
  immediate termination and possible legal action

Welcome aboard. We are excited to build Africa's most trusted marketplace together.

Sincerely,
The WiamLabs Leadership

© 2026 WiamApp. Powered by WiamLabs

## 7.5 The WiaMid Code System

FORMAT: WiaMid + 6 characters = 12 characters total
The 6 characters always contain: uppercase letters, lowercase letters, numbers, and symbols
Example: WiaMidGu40a@

HOW IT WORKS:
- Code is sent ONLY to the approved team member's personal email
- The code NEVER goes to any other email address
- Each code is unique to one person
- Code expires after exactly 10 days
- New code is automatically generated and sent 2 days before expiry
- Email subject: "Your new WiaMid access code — old code expired"
- The new code has no relation to the old code (completely fresh)

SECURITY WARNING IN EVERY CODE EMAIL:
"WARNING — EXTREMELY IMPORTANT:
This code gives access to the WiamApp internal systems.
Do not share this code with ANYONE.
Do not write it in a message, text, or email.
If anyone asks you for this code — report it immediately.
WiamLabs will NEVER ask you for your code.
This code expires in 10 days.
Unauthorized use will result in termination and legal action."

## 7.6 Team Login Process (Website Only)

Login page: dashboard.wiamapp.com/team

Email field: wiamlabs@gmail.com (same for all team members)
Code field: Their unique WiaMid code (e.g., WiaMidGu40a@)

The system identifies WHICH team member based on the code.
Routes them to ONLY their specific dashboard.
No one can see another team member's dashboard.
Every login is logged with IP address and device fingerprint.

## 7.7 Founder Login Process

Login page: dashboard.wiamapp.com/founder

Email: founder@wiamapp.com
Password: Founder's private password (only Martin knows this)

This opens the MASTER DASHBOARD showing paths to ALL team dashboards.
Martin can navigate to any dashboard and control everything.
Martin's founder@wiamapp.com email must be protected with:
- Strong unique password (not used anywhere else)
- Two-factor authentication (2FA) mandatory
- Login alerts to a backup phone number
- All logins logged and audited

## 7.8 Founder Protection — Critical

founder@wiamapp.com is used to create:
- GitHub account (WiamLabs organization)
- Supabase project
- Render deployment
- Cloudflare account
- Paystack account
- Resend account
- All other platform services

If this email is compromised, everything is at risk.

MANDATORY PROTECTIONS:
- Enable 2FA (two-factor authentication) on every single service
- Use a unique password for each service (use a password manager)
- Never log into founder@wiamapp.com on public computers
- Never share this email's password with anyone
- Set up account recovery options on all services
- Keep a secure backup of all service credentials in an offline encrypted location
- Review login history on all services monthly

## 7.9 Complete Team Roles List

Below are all the team positions WiamApp will have as it grows.
Each position has its own dashboard with only the tools needed for that role.

LEADERSHIP:
01. Founder / CEO (Martin) — Special universal access
02. Chief Technology Officer (CTO) — Full technical oversight
03. Chief Operations Officer (COO) — Full operations oversight
04. Chief Financial Officer (CFO) — Full financial oversight
05. Head of Trust and Safety — Full safety and fraud oversight

PLATFORM ADMINISTRATION:
06. Senior Administrator — Full platform control, user management
07. Junior Administrator — Limited platform control, user management
08. Platform Moderator — Monitor and moderate platform activity
09. Content Moderator — Review and moderate Spotlight posts
10. Document Reviewer — Review ID verifications (workers and customers)
11. Business Verification Reviewer — Review business account applications
12. Dispute Resolution Officer — Handle booking disputes and escrow decisions
13. Fraud Analyst — Investigate fraud reports and suspicious activity
14. Emergency Response Officer — Handle SOS alerts and emergency cases

CUSTOMER AND WORKER SUPPORT:
15. Customer Support Lead — Oversee customer support team
16. Customer Support Representative — Handle customer tickets and issues
17. Worker Support Lead — Oversee worker support team
18. Worker Support Representative — Handle worker complaints and issues
19. Business Account Manager — Manage Starter and Growth business accounts
20. Enterprise Account Manager — Manage Enterprise clients with white-glove service

TECHNICAL TEAM:
21. Lead Backend Developer — Architecture and backend development
22. Senior Backend Developer — Backend features and APIs
23. Lead Frontend Developer — Web dashboard development
24. Mobile Developer — React Native and Expo app development
25. Database Administrator — Supabase, PostgreSQL, migrations
26. DevOps Engineer — Render, Cloudflare, deployments
27. Security Engineer — Platform security, audits, penetration testing
28. Lead QA Tester — Quality assurance and testing lead
29. QA Tester — Test features before release
30. UI/UX Designer — Design all screens and interfaces

BUSINESS AND MARKETING:
31. Marketing Manager — Overall marketing strategy
32. Digital Marketing Specialist — Social media, paid ads
33. Community Manager — User community and engagement
34. Content Creator — Blog posts, marketing materials
35. Brand Manager — WiamApp and WiamLabs brand consistency
36. Partnerships Manager — Strategic partnerships with companies
37. Business Development Manager — New business opportunities

FINANCE:
38. Financial Manager — Oversee all revenue, commissions, payouts
39. Commission Analyst — Monitor and analyze commission data
40. Subscription Manager — Manage subscription billing and issues
41. Payroll Manager — Team member compensation

LEGAL AND COMPLIANCE:
42. Legal Officer — Legal contracts, terms, disputes with legal implications
43. Compliance Officer — Ensure platform follows local laws
44. Data Protection Officer — User data privacy and GDPR compliance

## 7.10 Individual Team Dashboards

Each role has its own dashboard with specific tools:

ADMINISTRATOR DASHBOARD:
- Full user search and management (suspend, ban, reactivate, change roles)
- Worker verification queue
- Customer verification queue
- Platform-wide settings and feature toggles
- Audit log viewer
- Commission reports
- Fraud report overview
- Emergency alert panel

CONTENT MODERATOR DASHBOARD:
- Spotlight post review queue
- Approve or reject posts with reason
- View reported content from community
- Moderation history and statistics
- Send moderation warning to users

DOCUMENT REVIEWER DASHBOARD:
- Worker ID verification queue (oldest first)
- Customer ID verification queue
- Business verification queue
- View documents via signed URLs (15min expiry, every view logged)
- Approve or reject with detailed reason
- Flag for manual escalation to senior admin

DISPUTE RESOLUTION OFFICER DASHBOARD:
- All open disputes with full context
- Complete chat log for each booking
- GPS check-in and check-out records
- Payment and escrow details
- Decision tools (release/refund/partial)
- Communication panel to message both parties
- Dispute history and resolution statistics

CUSTOMER SUPPORT DASHBOARD:
- Customer account search
- View customer bookings and payment history
- Respond to support tickets
- Escalate to senior admin
- Issue credits or refunds (within limits)
- Customer complaint history

WORKER SUPPORT DASHBOARD:
- Worker account search
- View worker bookings and earnings
- Handle subscription issues
- Respond to worker tickets
- Escalate verification issues
- Worker complaint history

FRAUD ANALYST DASHBOARD:
- All fraud reports with full investigation data
- Access to audit logs for any user
- Device fingerprint history
- Login location history
- Platform warning records
- Ability to escalate to police with document package

FINANCIAL MANAGER DASHBOARD:
- Total revenue by day, week, month
- Commission breakdown by category
- Subscription revenue by plan type
- Spotlight boost revenue
- Business account revenue
- Payout records and reconciliation
- Export reports to CSV or PDF
- Ability to change subscription prices (in USD) — updates automatically

ENTERPRISE ACCOUNT MANAGER DASHBOARD:
- All Enterprise and Growth business accounts
- Business verification status
- Business analytics and performance
- Direct communication channel with enterprise clients
- Contract and renewal management

FOUNDER MASTER DASHBOARD:
Shows paths to ALL team dashboards.
Founder can enter and control any dashboard.
Founder-only features:
- Add or remove team members (generate WiaMid codes)
- Change any team member's access level
- View all dashboards simultaneously
- Emergency platform controls (pause bookings, pause payments, mass notification)
- Override any decision made by any team member
- Full financial overview (all revenue streams combined)
- Change subscription prices in USD
- Commission rate management per plan
- Legal and compliance overview
- Platform health metrics
- Delete any content anywhere on the platform
- Export full user data for legal requests

---

# PART 8 — CUSTOMER IDENTITY VERIFICATION

## 8.1 Why Customers Must Verify

Workers go to strangers' homes and locations.
A verified customer means the worker knows:
- This is a real, identifiable person
- They have a legally valid ID on file
- If they cause harm, they are fully traceable and accountable

WiamApp takes worker safety as seriously as customer safety.

## 8.2 Customer Verification Timeline

FIRST USE:
Customer can browse freely without verification.
When they attempt their first booking: full verification required.
Upload ID (front and back where applicable) + live selfie.
Admin reviews within 24 hours.
After approval: can book workers.

MONTHLY:
Every 30 days: takes a fresh live selfie (30 seconds).
Compared to stored ID photo to confirm same person.
If not completed: booking access paused until done.

EVERY 6 MONTHS:
Full re-verification: re-upload ID + fresh selfie.
Ensures ID is not expired and details are still current.

## 8.3 ID Card Types and Sides Required

Ghana Card:      Front YES + Back YES  (back has QR code and extra data)
Driver License:  Front YES + Back YES  (back has vehicle categories)
Passport:        Front YES + Back NO   (one page only — back is blank)
Voter ID:        Front YES + Back NO   (back is completely empty)
NIN Card:        Front YES + Back NO   (all info on front)
NHIS Card:       Front YES + Back YES  (both sides have data)

The app automatically skips the back upload based on card type selected.

## 8.4 What Workers See About Customer Verification

On every booking request, worker sees:
- Verified Customer — ID reviewed and approved
- Verification Pending — submitted but under 24hr review
- Not Verified — no documents submitted

Workers have the right to decline bookings from unverified customers.
The app supports and respects this decision without penalty.

## 8.5 Customer Document Storage

All customer documents: Cloudflare R2 PRIVATE bucket.
Never publicly accessible.
Only accessible via signed URLs (15 minute expiry).
Only WiamLabs admins can request a signed URL.
Every document access is logged in audit_logs.

---

# PART 9 — WORKER SAFETY SYSTEM

## 9.1 Safety Feature 1 — Customer Verification Visibility

Before accepting a booking, worker sees full customer verification status,
customer rating from previous workers, number of past bookings,
account creation date, and job location on map.
Worker can decline any booking without penalty.

## 9.2 Safety Feature 2 — GPS Check-In and Check-Out

On the Way: Worker taps button, GPS tracking begins.
Arrived: Worker taps check-in, GPS coordinates and timestamp recorded permanently.
Job Complete: Worker taps check-out, duration logged.
If no check-out within 4 hours of check-in: admin receives automatic alert.

## 9.3 Safety Feature 3 — SOS Emergency Button (Workers AND Customers)

Both workers AND customers have access to the SOS emergency button.
Workers need it for dangerous customers.
Customers need it if something happens at the job location.

Location: Profile screen → Settings → Safety → Emergency SOS
Activation: Hold the red SOS button for 3 seconds

When triggered:
- Exact GPS location recorded
- Current booking details captured (other party's name, phone, verified ID on file)
- Alert sent to the person's registered emergency contact
- Alert sent to WiamLabs admin panel immediately
- Everything logged permanently to audit trail

Emergency alert contains:
- Person's name
- Their current GPS location (map link)
- Current booking reference number
- Other party's name, phone number, ID document on file

Phase 2: Integration with Ghana Police emergency line.

## 9.4 Safety Feature 4 — Live Location Sharing

Before going to a job, worker or customer can share live location.
Selects trusted contact from phone contacts.
Secure link sent to that contact via SMS.
Link shows live location updating every 30 seconds.
No WiamApp account needed to view the link.
Location sharing stops automatically when job is marked complete.

## 9.5 Safety Feature 5 — Customer Rating by Workers

After every completed booking, workers privately rate the customer.
1-5 stars with optional private note (only admins and other workers can see).
Customer ratings affect:
- Workers see rating before deciding to accept
- Below 3.0: warning flag shown to workers
- Below 2.0: customer suspended from booking until admin review
- Pattern of bad ratings: permanent ban

## 9.6 Safety Feature 6 — New Account Flag

Any customer account less than 7 days old is flagged.
Workers see: "New Account — created X days ago"
Workers make their own informed decision.
Flag removed automatically after 7 days with no reports.

## 9.7 Safety Feature 7 — Customer Protection Guarantee

"Protected by WiamApp" badge displayed on every verified worker's profile.
This means:
- Worker's identity has been verified
- Payment is held in escrow until job is confirmed complete
- Dispute resolution support is available
- Fraud investigation backed by verified ID documentation
- Full audit trail exists for every interaction

---

# PART 10 — THE 12 SERVICE CATEGORIES

Run categories_seed.sql after all migrations.

Category 1:  Building and Construction       | Emoji: brick    | Color: #8B4513
Category 2:  Plumbing and Water Systems      | Emoji: faucet   | Color: #1E90FF
Category 3:  Electrical and Power            | Emoji: lightning| Color: #FFD700
Category 4:  Automotive and Mechanical       | Emoji: car      | Color: #FF4500
Category 5:  Finishing Painting and Decor    | Emoji: palette  | Color: #9B59B6
Category 6:  Cleaning and Maintenance        | Emoji: broom    | Color: #00CED1
Category 7:  Hair Beauty and Personal Care   | Emoji: scissors | Color: #FF69B4
Category 8:  Hospitality Catering and Food   | Emoji: plate    | Color: #FF8C00
Category 9:  Photography Media and Creative  | Emoji: camera   | Color: #4169E1
Category 10: Logistics Transport and Delivery| Emoji: bicycle  | Color: #228B22
Category 11: Education Tuition and Lessons   | Emoji: books    | Color: #8B0000
Category 12: Events Entertainment and Sound  | Emoji: confetti | Color: #DC143C

---

# PART 11 — WIAMAPP SPOTLIGHT SYSTEM

## 11.1 What Spotlight Is

A premium professional showcase system inside WiamApp.
Not a social media feed. Not entertainment.
A serious space for verified workers and businesses to promote their services
and showcase completed work to customers already browsing the platform.

## 11.2 Who Can Post

Basic workers and above (Blue badge and higher).
All verified Business Accounts (Gold badge).
Free workers CANNOT post on Spotlight.
This gives workers a strong reason to upgrade.

## 11.3 Allowed Content

Completed work photos. Before and after transformations.
Portfolio showcases. Service promotions and discounts.
Business announcements. Availability updates.
Short professional work videos. Customer testimonials with permission.

All content must relate to the worker's registered category.

## 11.4 Forbidden Content

Comedy posts. Memes. Personal lifestyle. Family photos.
Politics. Religion. Gossip. Anything not work-related.
Fake promotions. Content from other sources.

Consequences: Warning, then Spotlight suspension, then permanent removal.

## 11.5 Spotlight Placement

Dedicated Spotlight tab on home screen.
Below category listings in search.
Inside worker profile page (their personal gallery).
Featured areas for boosted posts.

## 11.6 Paid Boost Pricing (stored in USD)

Standard Boost (3 days):     $1.50  / approx GHS 15
Featured Boost (7 days):     $3.00  / approx GHS 35
Premium Boost (14 days):     $6.00  / approx GHS 70
Business Spotlight (30 days): $13.00 / approx GHS 150

## 11.7 Moderation

AI checks for inappropriate content automatically.
Admin reviews flagged posts.
Community reporting available on every post.
All posts go through pending review before appearing publicly.

---

# PART 12 — PLATFORM PROTECTION SYSTEM

## 12.1 Hidden Phone Numbers

Worker and customer phone numbers hidden until:
1. Booking created
2. Worker accepted
3. Payment made and held in escrow
All communication before payment happens through in-app chat only.

## 12.2 Escrow Payment System

Customer pays — money held by WiamApp (worker cannot touch it).
Job confirmed complete — money released automatically.
Commission deducted before worker receives payment.

## 12.3 Intelligent Chat Monitoring

Every message scanned before delivery.
Flags triggered by: phone numbers, payment app names, suspicious phrases.
Flagged messages replaced with protection warning.
Worker receives a Platform Warning (strike).
3 strikes = automatic suspension.

## 12.4 Platform Protection Guarantee

Every customer sees "Protected by WiamApp" on verified worker profiles.
This communicates: dispute support, verified identity, tracked payment, fraud review.

---

# PART 13 — WIAMTRUST SCORE SYSTEM

## 13.1 What WiamTrust Score Is

WiamTrust Score is different from star ratings.
Star ratings reflect customer satisfaction per job.
WiamTrust Score reflects overall platform reliability and trustworthiness.
It is WiamApp's internal trust algorithm — unique to the platform.

## 13.2 How WiamTrust Score Is Calculated

For Workers:
- Total completed jobs (weight: 25%)
- Average star rating (weight: 20%)
- Cancellation rate — lower is better (weight: 15%)
- Dispute rate — lower is better (weight: 15%)
- Response rate to booking requests (weight: 10%)
- Verification level (weight: 10%)
- Activity consistency — jobs per month (weight: 5%)

For Customers:
- Number of completed bookings (weight: 30%)
- Worker rating given to them (weight: 30%)
- Cancellation rate (weight: 20%)
- Dispute rate (weight: 20%)

Score range: 0 to 100
Displayed as: WiamTrust Score 94/100 or WiamTrust 94

## 13.3 Score Display

Shown on worker profiles prominently.
Shown to workers on booking requests (customer score).
Used in search ranking alongside subscription tier.
Badges awarded at milestones:
- 80+: Trusted
- 90+: Highly Trusted
- 95+: Elite Trust

---

# PART 14 — EMERGENCY MODE

## 14.1 What Emergency Mode Is

A special booking flow for urgent situations where time is critical.
Customer does not need to search and browse — they need help NOW.

## 14.2 How It Works

Customer presses "Need Help Urgently" button on home screen.
Selects the type of emergency:
- Emergency Plumber
- Emergency Electrician
- Emergency Mechanic
- Emergency Cleaner
- Any of the 12 categories

Describes the emergency briefly (text + optional photo).
All verified available workers in that category within radius are notified instantly.
First worker to accept gets the job.
Emergency premium of 20% added to their standard rate automatically.
Customer sees the emergency price before confirming.
Payment held in escrow as normal.

## 14.3 Emergency Fee Split

20% emergency premium added to the job.
Worker keeps their normal rate (emergency premium goes to WiamApp).
Example: Worker charges GHS 80/hr base.
Emergency job pays GHS 96/hr to customer.
Worker gets GHS 80/hr minus commission.
WiamApp gets GHS 16/hr emergency fee plus normal commission.

---

# PART 15 — VERIFIED WORK HISTORY SYSTEM

## 15.1 The Permanent Reputation Record

Every completed job is permanently recorded on the worker's profile.
This becomes their official work history on WiamApp.
Workers build a record they can NEVER lose from within the platform.
This creates deep loyalty — leaving WiamApp means losing everything built.

## 15.2 What Shows on Worker Profile

Total Completed Jobs: 312
Years Active on WiamApp: 5 years
Repeat Customers: 48 customers came back
Response Speed: Responds in 4 minutes on average
Reliability Score: 98% jobs completed
WiamTrust Score: 96/100
Verification Level: Blue Pro

## 15.3 Work History Psychological Impact

Workers with long histories will NEVER want to lose their account.
This makes platform warnings and strikes extremely powerful.
Suspension is devastating because it hides the entire work history.
Permanent ban destroys everything built over years.

---

# PART 16 — INSTANT QUOTE SYSTEM

## 16.1 What Instant Quote Is

An alternative to the standard booking flow.
Customer submits a job and workers send quotes before any booking is created.
Reduces wasted bookings where the price does not match expectations.

## 16.2 How It Works

Customer presses "Get Quotes" instead of "Book Now".
Fills: description of the job, location, photos of the problem, preferred date.
Job request visible to relevant nearby verified workers for 2 hours.
Workers send quotes: their price, estimated timeline, availability confirmation.
Customer reviews quotes and selects the one they want.
Booking created with the chosen worker and agreed price.
Payment made and escrow begins as normal.

## 16.3 Quote Time Limit

Workers have 2 hours to submit a quote.
After 2 hours: request closes and customer chooses from received quotes.
If zero quotes received: customer encouraged to try direct booking.

---

# PART 17 — WORKER PERFORMANCE RANKINGS

## 17.1 Category Rankings

WiamApp displays public rankings of top workers per category.
This creates healthy competition and motivates workers to perform.

Rankings visible to customers on:
- Category screen: "Top Electricians in Accra"
- Home screen featured sections
- Spotlight section

## 17.2 Ranking Categories

Top Rated in [Category] in [City]
Fastest Responders in [City]
Most Jobs Completed This Month
Highest WiamTrust Score
Most Repeat Customers
Newest Verified Workers

## 17.3 Ranking Calculation

Updated every 24 hours.
Top Rated: weighted combination of rating, jobs, and trust score.
Fastest Responders: average response time to booking requests.
Most Jobs: total completed bookings in the current calendar month.

Workers who reach top 3 in their category receive a special badge on their profile.

---

# PART 18 — ADDITIONAL FEATURES

## 18.1 Verified Project Gallery (Enhanced)

Workers upload organized portfolio with before/after transformations.
Portfolio categories match their service types.
Customers can browse portfolio before booking.
Before/after slider for visual transformations (painting, cleaning, haircutting).
High conversion feature — customers who see portfolio are more likely to book.

## 18.2 Repeat Booking

Customer can rebook the same worker with one tap.
"Book Kwame Again" button on completed booking screen.
Pre-fills all previous job details for editing.
Customer and worker relationship built over time.

## 18.3 Worker Availability Calendar

Workers set available days and hours (not just on/off toggle).
Example: Available Monday-Friday 8am-6pm, not weekends.
Customers see availability before booking.
Prevents booking requests at times worker cannot respond.

## 18.4 Smart Recommendations

"Customers who booked a plumber also needed an electrician."
Cross-category suggestions after booking completion.
Increases average bookings per customer.

## 18.5 Service Price Guide

WiamApp publishes estimated average prices per category.
Shown to customers before they fill the booking form.
Example: "Average electricians in Accra charge GHS 60-120 per hour"
Helps customers know what is fair. Reduces price disputes.

## 18.6 WiamApp Guarantee Seal

Official seal displayed on every verified worker profile.
Customers can tap it to see what it guarantees.
Shows: verified identity, escrow payment, dispute support, fraud protection.
Builds immediate trust with new customers.

---

# PART 19 — COMPLETE SCREEN LIST

AUTH AND ONBOARDING (8 screens):
01. SplashScreen
02. LandingScreen (beautiful scrollable marketing screen)
03. OnboardingScreen (3-path selector)
04. LoginScreen
05. RegisterScreen
06. EmailOTPScreen
07. ForgotPasswordScreen
08. ResetPasswordScreen

CUSTOMER VERIFICATION (4 screens):
09. CustomerVerifyIntroScreen
10. CustomerIDUploadScreen (smart card type detection)
11. CustomerSelfieScreen (live camera only)
12. CustomerVerifyPendingScreen

WORKER VERIFICATION (6 screens):
13. WorkerVerifyIntroScreen
14. IDTypeScreen
15. IDUploadScreen (auto front-only for Passport and Voter ID)
16. WorkerSelfieScreen
17. VerificationPendingScreen
18. VerificationApprovedScreen
19. VerificationRejectedScreen

CUSTOMER SCREENS (17 screens):
20. CustomerHomeScreen (12 categories, workers, emergency button, spotlight)
21. SearchScreen
22. CategoryScreen
23. WorkerProfileScreen (profile picture, green dot, portfolio, ratings, WiamTrust)
24. QuoteRequestScreen (Instant Quote System)
25. QuotesListScreen (see worker quotes)
26. BookingFormScreen
27. BookingConfirmScreen
28. BookingSuccessScreen
29. BookingsListScreen
30. BookingDetailScreen
31. PaymentScreen
32. PaymentSuccessScreen
33. ChatListScreen
34. ChatScreen
35. ReviewScreen
36. CustomerProfileScreen
37. NotificationsScreen
38. EmergencyModeScreen
39. CustomerSafetyScreen (SOS setup, emergency contact, location sharing)

WORKER SCREENS (13 screens):
40. WorkerDashboardScreen (stats, availability, pending jobs, WiamTrust score)
41. WorkerJobsScreen
42. JobDetailScreen
43. EarningsScreen
44. WorkerProfileEditScreen
45. PortfolioManagerScreen (before/after upload support)
46. SkillsManagerScreen
47. SpotlightManagerScreen
48. WorkerNotificationsScreen
49. WorkerSettingsScreen
50. WorkerSafetyScreen (SOS, check-in/out, location sharing, emergency contact)
51. SubscriptionScreen
52. AvailabilityCalendarScreen
53. WorkerRankingsScreen (see own ranking in category)

BUSINESS SCREENS (5 screens):
54. BusinessApplicationScreen
55. BusinessDashboardScreen
56. TeamManagementScreen
57. BusinessAnalyticsScreen
58. BusinessSpotlightScreen

ADMIN SCREENS (web only, 5 screens):
59. AdminDashboardScreen
60. DocumentQueueScreen
61. DocumentReviewScreen
62. FraudReportsScreen
63. CommissionReportScreen

---

# PART 20 — COMPLETE TECH STACK

All tools are free to start. Nothing blocks launch.

Mobile App:
- React Native + Expo SDK 51
- React Navigation v6 (Stack + Bottom Tabs)
- AsyncStorage (session storage)
- Expo Image Picker (camera and documents)
- Expo AV (voice recording)
- Expo Location (GPS for safety features)
- Expo Notifications (push notifications)
- Expo Device (device fingerprinting)
- Ionicons (all icons)
- React Native Maps via OpenStreetMap

Backend:
- Node.js 18+
- Express.js
- Helmet, CORS, express-rate-limit
- Multer (file uploads)
- dotenv

Database and Auth:
- Supabase (PostgreSQL + Auth + Realtime + RLS)

File Storage:
- Cloudflare R2 Public bucket (avatars, portfolios, voice, Spotlight media)
- Cloudflare R2 Private bucket (all ID documents and selfies — signed URLs only)

Email:
- Resend (3,000 free per month)

Payments:
- Paystack (Ghana GHS + Nigeria NGN, free to start)

Verification:
- Manual admin review (MVP — free)
- Smile Identity AI (Phase 2 — when revenue allows)

Exchange Rates:
- Open Exchange Rates API (free tier — daily updates for currency conversion)

Deployment:
- GitHub (WiamLabs organization, private)
- Render (backend, free tier)
- Cloudflare (DNS and CDN, free)
- Expo EAS (app builds, free tier)

Total monthly cost at launch: GHS 0

---

# PART 21 — DATABASE — CURRENCY STORAGE RULES

All monetary values stored in USD in the database.
Never store in GHS, NGN, or any local currency.
Platform converts to local currency at display time using daily exchange rates.

Tables that store money:
- payments.amount_usd
- subscriptions.amount_usd
- featured_workers.amount_paid_usd
- spotlight_posts.boost_paid_usd
- platform_earnings.amount_usd

Subscription plan prices stored in a separate config table, NOT hardcoded:

CREATE TABLE subscription_config (
  id            UUID PRIMARY KEY,
  plan_name     VARCHAR(50) NOT NULL,
  price_usd     DECIMAL(10,4) NOT NULL,
  commission    DECIMAL(5,4) NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_by    UUID REFERENCES users(id)
);

This table is editable from the Founder Dashboard and Financial Manager Dashboard.
When price is changed in USD, all country displays update automatically.
Full history of price changes stored in audit_logs.

---

# PART 22 — NOTIFICATION SYSTEM

Three channels: Push (Expo — free), In-App (Supabase Realtime — free), Email (Resend — free)

Customer triggers:
- OTP code: Email only
- Booking accepted: Push + In-App + Email
- Worker on the way: Push + In-App
- Job marked complete: Push + In-App + Email
- Payment processed: Push + In-App + Email
- Monthly re-verification due: Push + In-App + Email
- SOS alert sent: Push + Email

Worker triggers:
- New booking request: Push + In-App + Email
- Auto-cancelled request: Push + In-App + Email
- Payment released: Push + In-App + Email
- New review received: Push + In-App + Email
- Verification approved: Push + In-App + Email
- Verification rejected: Push + In-App + Email
- Platform warning: Push + In-App + Email
- New WiaMid code (team): Email only (very sensitive)

Admin triggers:
- New document submitted: In-App (admin panel) + Email
- Document over 20hrs waiting: In-App + Email
- Fraud report filed: In-App + Email
- SOS button triggered: In-App + Email + Phone call (Phase 2)

---

# PART 23 — SECURITY ARCHITECTURE

Authentication:
- Supabase Auth (JWT, auto-refresh)
- Sessions in AsyncStorage
- On logout: token invalidated, storage cleared

API Security:
- Rate limiting: 100/15min global, 10/15min auth, 5/hour verify
- CORS: wiamapp.com and Expo Go only
- Helmet security headers
- Input validation on every field
- Parameterized queries only

File Security:
- Avatars/portfolios: R2 Public (anyone can view)
- Voice messages: R2 Public (sender and receiver)
- All ID documents: R2 Private (admin only, 15min signed URL)
- Every document access logged in audit_logs

Anti-Fraud:
- Customer ID verification before any booking
- Worker ID verification before appearing in search
- Device fingerprinting (duplicate accounts detected)
- IP address logging on every login
- Suspicious location change detection (220km+ in 1 hour)
- Chat monitoring for phone numbers and payment apps
- 3 verification failures = auto suspend
- 3 platform warnings = auto suspend
- Full audit trail = complete evidence for police

Row Level Security:
- Enabled on every Supabase table
- Users see only their own data
- Admin operations use service role key (Render only — never in app)

WiaMid Code Security:
- Codes generated with cryptographically secure random function
- Codes stored as hashed values in database (never plain text)
- Plain text code sent to team member email only
- Code never stored or logged after generation
- Expiry enforced at database level

Founder Email Protection:
- 2FA mandatory on all services
- Unique password per service (password manager required)
- Never used on public computers
- Login alerts enabled on all services
- Monthly security review of all service login histories

---

# PART 24 — AI DEVELOPMENT RULES

Every AI tool (Cursor, Claude, ChatGPT, Windsurf) reads this section before generating code.

FILE RULES:
Never create duplicates. Search before creating.
Never install packages without checking existing ones.
Follow exact folder structure.
New migrations only — never modify existing ones.

CODE RULES:
Every file starts with: // 2026 WiamApp. Powered by WiamLabs
Colors ALWAYS from constants/colors.js — NEVER hardcoded.
Components must be modular and reusable.
Simple architecture — no over-engineering.

DATABASE RULES:
All money stored in USD in database.
Every new table needs RLS enabled and policies written.
Every important action logged to audit_logs.

BACKEND RULES:
All routes: validate input, return consistent JSON, handle errors.
Protected routes call verifyUserToken() first.
Never expose service role key in frontend.
File uploads: validate type AND size before processing.

SECURITY RULES:
Phone numbers never visible before booking + payment.
ID documents: return key only from upload routes (never public URL).
Signed URLs: maximum 15 minutes expiry.
WiaMid codes: never stored in plain text, never logged.

UI RULES:
Every screen handles loading state, error state, empty state.
Never show blank screen or raw error messages.
Worker screens always navy background.
Gold buttons never change color between themes.
Online status green dot beside all profile pictures.
Profile pictures shown in every relevant location.

FREE TIER RULES:
Never add any service requiring payment before first booking.
Check free tier limits before adding any new dependency.
Document the free tier limit of every service added.

---

# PART 25 — ENVIRONMENT VARIABLES

Mobile App (.env — never in GitHub):
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_BACKEND_URL
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET
EXPO_PUBLIC_APP_ENV
EXPO_PUBLIC_DEFAULT_COUNTRY
EXPO_PUBLIC_DEFAULT_CURRENCY

Backend (Render only — never in GitHub, never in app):
SUPABASE_URL
SUPABASE_SECRET_KEY
CLOUDFLARE_R2_ENDPOINT
CLOUDFLARE_R2_ACCESS_KEY_ID
CLOUDFLARE_R2_SECRET_ACCESS_KEY
CLOUDFLARE_R2_BUCKET_NAME
CLOUDFLARE_R2_PUBLIC_URL
RESEND_API_KEY
PAYSTACK_SECRET_KEY
EXCHANGE_RATE_API_KEY
SMILE_IDENTITY_PARTNER_ID (Phase 2)
SMILE_IDENTITY_API_KEY (Phase 2)
NODE_ENV
PORT

---

# PART 26 — DATABASE MIGRATION ORDER

Always run in this exact order. Never skip. Never run out of order.

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
categories_seed.sql (run last)

---

# PART 27 — LAUNCH STRATEGY

Phase 1 — Accra MVP (Months 1-3):
500 workers, 2000 customers
East Legon, Osu, Cantonments, Airport Residential, Adenta

Phase 2 — All Ghana (Months 4-8):
5,000 workers, 20,000 customers
Kumasi, Takoradi, Tamale, Cape Coast, Tema

Phase 3 — Nigeria (Months 9-15):
Lagos first (Lekki, Victoria Island, Ikeja)
Then Abuja and Port Harcourt
NGN currency, Nigerian NIN verification

Phase 4 — West Africa (Year 2+):
Ivory Coast, Senegal, Sierra Leone, Liberia
French language support, local payment methods

---

# QUICK REFERENCE CARD

Brand: Navy #08081A | Gold #D4A017 | White #FFFFFF | Online dot: #22C55E
Stack: Expo + Supabase + Cloudflare R2 + Resend + Paystack + Render
Money in DB: Always USD. Display converts to local currency.
Commissions: Free=15% | Basic=10% | Pro=7% | Business=7-8%
Badges: Free=None | Basic=Blue | Pro=Blue+Pro | Business=Gold | Phase3=Diamond
Chat opens: After worker accepts booking (before payment)
Phone revealed: After booking accepted + customer pays
Customer verify: First booking=full ID+selfie | Monthly=selfie | 6months=full
Worker verify: ID+selfie before search → manual admin 24hr
Secret keys: ONLY on Render, NEVER in app or GitHub
WiaMid: WiaMid+6chars=12total, expires 10 days, hashed in DB
Founder email: founder@wiamapp.com — 2FA mandatory on all services
Team login: wiamlabs@gmail.com + WiaMid code → own dashboard only
Repo: github.com/WiamLabs/WiamApp (Private)
Cost at launch: GHS 0 per month

---

Version: 2.0 FINAL COMPLETE
2026 WiamApp. Powered by WiamLabs. All rights reserved.
CONFIDENTIAL — Do not share outside WiamLabs.

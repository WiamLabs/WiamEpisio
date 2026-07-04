# 🌍 WIAMAPP — MASTER PLAN V2 (FINAL)
## The Official End-to-End Product, Technical & Business Blueprint
### © 2026 WiamApp. Powered by WiamLabs
### Founder: Martin | wiamapp.com | github.com/WiamLabs/WiamApp
### Version: 2.0 FINAL | Last Updated: May 2026

---

> **THIS IS THE SINGLE SOURCE OF TRUTH FOR WIAMAPP.**
> Every developer, every AI tool (Cursor, Claude, ChatGPT, Windsurf),
> and every team member reads this ENTIRE document before writing one line of code.
> No decision is made without reference to this document.
> Do not skip sections. Read everything.

---

# ═══════════════════════════════════════════
# PART 1 — VISION, MISSION & CORE IDENTITY
# ═══════════════════════════════════════════

## 1.1 What WiamApp Is

WiamApp is Africa's most trusted digital service marketplace.
It connects customers who need skilled workers with verified professionals
who are ready to work — in real time, in their city.

WiamApp is not just an app.
It is a movement to formalize Africa's informal economy,
empower workers to earn with dignity,
protect both workers and customers from harm,
and give every party on the platform peace of mind.

## 1.2 The Two Problems We Solve

**For Customers:**
- Spend hours searching for reliable workers through unreliable word of mouth
- Cannot verify if a worker is skilled, trusted, or even a real person
- Lose money to scammers, unfinished jobs, and no-shows
- Have zero recourse after a bad experience

**For Workers:**
- Inconsistent job flow — feast one week, famine the next
- No platform to build, showcase, and protect their reputation
- Cannot prove skills to customers they have never met
- No protection against customers who refuse to pay after a job is done
- No protection against dangerous or fraudulent customers

**The Market Gap:**
No trusted, purpose-built marketplace exists for the African skilled worker market.
WhatsApp groups, word-of-mouth referrals, and roadside signboards are still the standard.
WiamApp permanently changes this across Africa.

## 1.3 The Solution

A mobile-first marketplace where:
- Customers search, find, and book verified workers in minutes
- Workers build verified profiles and receive consistent job flow
- Every booking is protected through an escrow payment system
- Both customers AND workers are verified before any contact is made
- Every transaction is traceable — fraud has serious consequences
- Trust is built through real verification, real reviews, and real protection

## 1.4 Core Values

1. **TRUST** — Every worker is verified. Every customer is verified. Every payment is protected.
2. **SPEED** — Find a verified worker in under 5 minutes.
3. **EMPOWERMENT** — Workers earn on their own terms. No boss. No middleman.
4. **MUTUAL PROTECTION** — Workers are protected from bad customers. Customers are protected from bad workers.
5. **AFRICAN-FIRST** — Built for African networks, payments, languages, and culture.
6. **INTEGRITY** — No fake reviews. No fake badges. No fake businesses. No advertisements.

## 1.5 Brand Identity

| Element | Value |
|---|---|
| Company Name | WiamLabs |
| Product Name | WiamApp |
| Tagline | Africa's Trusted Service Marketplace |
| Website | wiamapp.com |
| API | api.wiamapp.com |
| GitHub | github.com/WiamLabs/WiamApp (Private) |
| Copyright | © 2026 WiamApp. Powered by WiamLabs |

## 1.6 Brand Colors — The WiamLabs Identity

| Name | Hex Code | Where It Is Used |
|---|---|---|
| Navy | #08081A | Dark backgrounds, worker screens, dark mode |
| Gold | #D4A017 | ALL buttons and badges — never changes between themes |
| White | #FFFFFF | Light backgrounds, cards, light mode |
| Gold Light | #F0C040 | Hover states, highlights |
| Gold Dark | #A07810 | Pressed button states |
| Success Green | #22C55E | Available, confirmed, approved |
| Error Red | #EF4444 | Unavailable, rejected, danger |
| Warning Amber | #F59E0B | Pending, under review |
| Info Blue | #3B82F6 | Active, in progress |

**ABSOLUTE COLOR RULES (never violate these):**
- Gold buttons (#D4A017) NEVER change between light and dark mode — this is the brand signature
- Worker app screens ALWAYS use Navy (#08081A) as background
- Customer app screens default to White (#FFFFFF)
- NEVER hardcode hex values anywhere — always import from constants/colors.js
- Copyright footer appears on every screen: © 2026 WiamApp. Powered by WiamLabs

---

# ═══════════════════════════════════════════
# PART 2 — PLATFORM PHILOSOPHY
# ═══════════════════════════════════════════

## 2.1 No Advertisements — Ever

WiamApp provides a clean, trusted, professional marketplace experience.
The platform will NEVER use intrusive third-party advertising.

**What WiamApp will NEVER have:**
- Random banner advertisements
- Disruptive popup ads
- Third-party spam ad networks
- Ad tracking on users
- Sponsored content that is not clearly marked as promotion

**How WiamApp grows revenue instead:**
- Transaction commissions (percentage per completed booking)
- Worker subscription plans (Basic and Pro monthly fees)
- Spotlight post promotions (workers and businesses pay to boost visibility)
- Business Account monthly fees (Starter, Growth, Enterprise)
- Featured worker placement (paid promotion inside search results)

**Why this matters:**
This gives WiamApp a cleaner user experience, stronger customer trust,
better worker visibility, and higher-quality business participation.
Users should focus on finding trusted services — not fighting advertisements.
This is a core part of the WiamLabs brand promise and will never change.

## 2.2 No Dark Patterns

WiamApp will NEVER use manipulative design:
- No hidden subscription charges
- No fake urgency ("Only 2 workers left near you!")
- No fake reviews or inflated ratings
- No misleading pricing
- No fake verification badges sold without real verification

## 2.3 Mutual Trust Commitment

WiamApp protects BOTH sides of every transaction:
- Workers are protected from dangerous, fraudulent, or non-paying customers
- Customers are protected from scam workers, no-shows, and poor quality work
- Both parties are verified before any contact is made
- Escrow ensures payment is guaranteed before work begins

---

# ═══════════════════════════════════════════
# PART 3 — USER TYPES ON THE PLATFORM
# ═══════════════════════════════════════════

WiamApp has exactly 5 types of users:

## Type 1 — Customer (Individual)
Homeowners, renters, families, small business owners who need services.
- Needs: find and book a trusted verified worker quickly
- Must verify identity before first booking (monthly re-verification after)
- Can browse freely without verification
- Cannot contact or book any worker without verified identity
- Free to use — no subscription required

## Type 2 — Individual Worker
Skilled tradespeople, artisans, freelancers, service providers working alone.
- Needs: consistent job flow, a profile to build and protect their reputation
- Must complete identity verification (documents + selfie) before appearing in search
- Earns money per completed job minus WiamApp commission
- Can upgrade to Basic or Pro subscription plan for badge and benefits
- Free tier available (higher commission) — paid tiers reduce commission

## Type 3 — Business Account
Legally registered companies, agencies, property managers, event companies.
- Needs: professional company presence, team management, bulk bookings
- Requires strict business document verification (more rigorous than individual)
- Three business tiers: Starter, Growth, Enterprise
- Gets the Gold Checkmark badge (highest trust badge on WiamApp)
- Must pay monthly Business Account fee based on tier

## Type 4 — Admin (WiamLabs Team Only)
Martin and appointed WiamLabs team members.
- Reviews submitted documents for all verifications
- Moderates Spotlight posts
- Handles fraud reports and disputes
- Views commission reports and platform analytics
- Can suspend or ban any user
- Admin accounts are NEVER created through the app — added manually in Supabase

## Type 5 — Premium Individual Worker (Subscribed)
An individual worker who has paid for Basic or Pro subscription.
- Gets verification badge (Blue Checkmark) based on plan
- Pays lower commission
- Gets better search placement
- Can access Spotlight system to promote their work

---

# ═══════════════════════════════════════════
# PART 4 — SUBSCRIPTION & BADGE SYSTEM
# ═══════════════════════════════════════════

## 4.1 The Most Important Rule About Badges

**A verified worker does NOT automatically get a badge.**
Verification (uploading ID and selfie) is a REQUIREMENT to use the platform.
The badge is a REWARD for paying for a subscription plan.

This is how it works:
- Verify identity → Can appear in search and accept bookings → No badge
- Verify identity + Pay Basic → Blue Checkmark badge
- Verify identity + Pay Pro → Blue Checkmark + Pro label + extra features
- Verify as registered business + Pay Business fee → Gold Checkmark badge

## 4.2 Individual Worker Plans

### FREE WORKER (No badge)
- Monthly fee: GHS 0
- Commission rate: 15% per job
- What you get:
  - Create profile and appear in search
  - Must complete identity verification (ID + selfie)
  - Receive booking requests
  - Standard search placement (appears below paid tiers)
  - Basic chat with customers
  - No verification badge displayed
  - Cannot post on WiamApp Spotlight

### BASIC WORKER (Blue Checkmark 🔵)
- Monthly fee: GHS 30/month
- Commission rate: 10% per job
- What you get (everything in Free PLUS):
  - 🔵 Blue Checkmark badge on profile and search results
  - Higher search placement than Free workers
  - Profile highlighted in search with gold border
  - Basic analytics: profile views, booking conversion rate
  - WiamApp Spotlight access (post completed work, promotions)
  - Priority customer notifications (your profile shown first to customers in your area)

### PRO WORKER (Blue Checkmark + Pro 🔵⭐)
- Monthly fee: GHS 80/month
- Commission rate: 7% per job
- What you get (everything in Basic PLUS):
  - 🔵 Blue Checkmark + "Pro" label on profile
  - TOP search placement (appears above Basic and Free workers)
  - Advanced analytics dashboard:
    - Revenue tracking by week and month
    - Profile views and conversion rates
    - Category performance
    - Customer demographics
    - Peak booking times
  - 5 free Spotlight posts per month (normally paid)
  - Featured in "Top Rated" section on home screen
  - Can apply to upgrade to Business Account
  - Priority customer support from WiamLabs team

## 4.3 Business Account Plans (Gold Checkmark 🟡)

Business accounts are for REGISTERED COMPANIES only.
Individual workers are NOT businesses.
Getting a Business Account requires separate, more rigorous verification.

### STARTER BUSINESS 🟡
- Monthly fee: GHS 250/month
- Commission rate: 8% per job
- Team size: Up to 5 workers under the company
- What you get:
  - 🟡 Gold Checkmark badge (highest trust badge on WiamApp)
  - Priority placement ABOVE all individual workers in search
  - Company profile page (different from individual worker profile)
  - Add up to 5 verified workers under the company umbrella
  - Basic team management dashboard
  - Bulk booking system (receive multiple jobs simultaneously)
  - Company portfolio gallery (photos and videos of completed work)
  - Business analytics (team performance, revenue, top categories)
  - 3 free Spotlight posts per month
  - Standard business support

### GROWTH BUSINESS 🟡🌱
- Monthly fee: GHS 500/month
- Commission rate: 8% per job
- Team size: Up to 25 workers under the company
- What you get (everything in Starter PLUS):
  - Up to 25 verified workers under the company
  - Advanced team management with role assignments
  - Job assignment system (assign bookings to specific workers)
  - Advanced business analytics with export (CSV/PDF)
  - Dedicated account manager from WiamLabs
  - 10 free Spotlight posts per month + 1 boosted post
  - Priority customer matching (company profile suggested to customers)
  - Custom company banner on profile
  - Quarterly business review call with WiamLabs team
  - Early access to new platform features

### ENTERPRISE BUSINESS 🟡👑
- Monthly fee: GHS 1,200/month
- Commission rate: 7% per job (lowest — reward for volume)
- Team size: Unlimited workers
- What you get (everything in Growth PLUS):
  - Unlimited workers under the company
  - Full enterprise dashboard with multi-location support
  - API access for integrations (connect WiamApp to your own systems)
  - White-label profile option (company branding prominently displayed)
  - Dedicated 24/7 account manager (direct phone + email)
  - SLA guarantee (response times, uptime commitments)
  - Unlimited Spotlight posts + premium boost credits every month
  - Custom integrations support from WiamLabs technical team
  - Monthly business intelligence report (detailed market insights)
  - Enterprise security features (SSO login, admin controls)
  - Invitation to exclusive WiamApp Enterprise Partner Program
  - First access to Nigeria and West Africa expansion

## 4.4 Badge Visual Summary

| Badge | Color | Who Has It | How to Get It |
|---|---|---|---|
| No badge | — | Free workers | Verify identity only |
| 🔵 Blue Checkmark | #3B82F6 | Basic and Pro workers | Verify + pay Basic or Pro |
| 🔵⭐ Blue + Pro | #3B82F6 | Pro workers only | Verify + pay Pro |
| 🟡 Gold Checkmark | #D4A017 | All Business Accounts | Business verification + pay any Business tier |

## 4.5 Plan Comparison Table

| Feature | Free | Basic | Pro | Starter | Growth | Enterprise |
|---|---|---|---|---|---|---|
| Price/month | GHS 0 | GHS 30 | GHS 80 | GHS 250 | GHS 500 | GHS 1,200 |
| Commission | 15% | 10% | 7% | 8% | 8% | 7% |
| Badge | None | 🔵 | 🔵⭐ | 🟡 | 🟡 | 🟡 |
| Search placement | Standard | Higher | TOP | Priority | Priority | Priority |
| Spotlight access | ❌ | ✅ | ✅ + 5 free | 3 free | 10 free | Unlimited |
| Analytics | ❌ | Basic | Advanced | Business | Advanced | Enterprise |
| Team workers | 1 | 1 | 1 | Up to 5 | Up to 25 | Unlimited |
| Account manager | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ 24/7 |
| API access | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

# ═══════════════════════════════════════════
# PART 5 — CUSTOMER IDENTITY VERIFICATION
# ═══════════════════════════════════════════

## 5.1 Why Customers Must Be Verified

WiamApp protects workers as much as it protects customers.
A customer could use the platform to:
- Lure a worker to a dangerous location
- Commit fraud (book a job and refuse to pay)
- Use a fake identity to avoid accountability
- Cause harm to a worker and disappear

**Our response:** Every customer must verify their real identity before booking any worker.
Workers deserve to know that the person who booked them is a real, traceable person.

## 5.2 Customer Verification Rules

**First time using the app:**
- Customer can browse all workers freely without verification
- To book any worker, customer must complete full identity verification first
- Upload ID document (front and where applicable back) + live selfie
- Documents stored securely in Cloudflare R2 private bucket (never public)
- Admin reviews within 24 hours
- After approval, customer can book workers

**Monthly re-verification:**
- Every 30 days, customer must take a fresh live selfie
- Selfie is compared against their stored ID photo
- This confirms it is still the same real person using the account
- Takes less than 1 minute — quick and not disruptive
- If monthly selfie is not completed, booking access is paused until done

**Every 6 months:**
- Full re-verification required
- Customer re-uploads ID + takes fresh selfie
- Ensures ID has not expired and details are still accurate
- Gives WiamApp updated, current documentation

## 5.3 Accepted ID Documents for Customers

| Card Type | Front Required | Back Required | Notes |
|---|---|---|---|
| Ghana Card | ✅ Yes | ✅ Yes | Back has QR code and extra data |
| Driver's License | ✅ Yes | ✅ Yes | Back has vehicle categories |
| Passport (photo page) | ✅ Yes | ❌ No | Information on one page only |
| Voter ID | ✅ Yes | ❌ No | Back is completely empty — skip automatically |
| NIN Card (Nigeria) | ✅ Yes | ❌ No | All information on front |
| NHIS Card | ✅ Yes | ✅ Yes | Both sides have relevant information |

**Smart Card Detection:**
The app automatically knows which cards need front AND back based on the card type the customer selects. If Voter ID is selected, the back upload step is skipped automatically. If Ghana Card is selected, both front and back are required. This prevents confusion.

## 5.4 What Happens With Customer Documents

- Documents go to Cloudflare R2 PRIVATE bucket (never publicly accessible)
- Only accessible via temporary signed URLs (expire after 15 minutes)
- Only WiamLabs admins can request a signed URL
- Customer name and ID number stored encrypted in database
- If a customer causes harm, WiamLabs has full legal documentation to provide to authorities
- Ghana Card links to government database (police can trace the physical person)

## 5.5 What Workers See About Customer Verification

When a worker receives a booking request, they see:
- ✅ **Verified Customer** — ID reviewed and approved
- ⚠️ **Verification Pending** — customer submitted, under 24-hour review
- ❌ **Not Verified** — customer has not submitted documents

Workers can choose to decline bookings from unverified or pending customers.
This is their right and the platform supports this decision.

---

# ═══════════════════════════════════════════
# PART 6 — WORKER SAFETY SYSTEM
# ═══════════════════════════════════════════

## 6.1 Why Worker Safety Is Critical

Workers go to strangers' homes and businesses.
This is inherently vulnerable.
WiamApp takes this responsibility seriously.
Every safety feature described here must work perfectly — lives depend on it.

## 6.2 Safety Feature 1 — Customer Verification Visibility

Before accepting any booking, worker sees:
- Customer's verification status (Verified / Pending / Not Verified)
- Customer's rating (if they have been rated by previous workers)
- Number of previous bookings (experienced customers are lower risk)
- Location of the job (mapped on OpenStreetMap)
- Account creation date (new accounts are flagged)

Workers can decline any booking without penalty.
The app never pressures workers to accept.

## 6.3 Safety Feature 2 — GPS Check-In / Check-Out System

**When worker is travelling to job:**
- Worker taps "On My Way" in the app
- App begins background location tracking (with worker's permission)
- Customer is notified: "Kwame is on the way"
- Customer can see estimated arrival time

**When worker arrives:**
- Worker taps "I Have Arrived — Check In"
- App records: GPS coordinates + timestamp + booking ID
- This is stored permanently in the database
- Customer is notified: "Kwame has arrived"

**When job is complete:**
- Worker taps "Job Complete — Check Out"
- App records: GPS coordinates + timestamp + duration
- Escrow release process begins
- If worker does NOT check out within 4 hours of check-in: admin is alerted

**Why this matters:**
If anything happens to a worker on a job, WiamApp has:
- Exact location where they were
- Exact time they were there
- Full customer identity (verified ID on file)
- Complete audit trail for authorities

## 6.4 Safety Feature 3 — SOS Emergency Button

**Where it is:**
Hidden in the worker dashboard — accessible but not obvious to customers.
Worker Profile screen → Settings → Safety → Emergency SOS

**How it works:**
1. Worker holds the red SOS button for 3 seconds
2. App immediately:
   - Records the exact GPS location
   - Captures the current booking details (customer name, phone, ID on file)
   - Sends an alert to the worker's registered emergency contact
   - Sends an alert to WiamLabs admin panel
   - Logs everything to the audit trail
3. Alert message to emergency contact contains:
   - Worker name
   - Current GPS location (Google Maps link)
   - Current booking reference
   - Customer name and phone number
4. Admin receives instant notification to investigate
5. Optional (Phase 2): Alert sent to Ghana Police Service emergency line

**Privacy:**
SOS can only be triggered by the worker themselves.
False triggers can be reported and managed by admin.
Workers are encouraged to register an emergency contact during onboarding.

## 6.5 Safety Feature 4 — Live Location Sharing

**Before going to a job:**
Worker can tap "Share My Location" on any booking.

**What happens:**
- Worker selects a trusted contact from their phone contacts
- A secure link is sent to that contact via SMS
- The link shows the worker's live location on a map (updates every 30 seconds)
- Location sharing automatically stops when job is marked complete
- The trusted contact does not need to have WiamApp installed

**Use case:**
A female barber going to a new customer's house at night can share her live location with her family. They can monitor in real time. If she stops moving unexpectedly, they know something may be wrong.

## 6.6 Safety Feature 5 — Customer Rating by Workers

After every completed booking, workers rate the customer:
- 1 to 5 stars
- Optional written note (private — only admins see the written note)
- Rating categories: Respectful, Paid promptly, Safe location, Would work with again

**What customer ratings affect:**
- Workers can see customer rating before accepting a booking
- Customers with rating below 3.0 are flagged with a warning to workers
- Customers with rating below 2.0 are suspended from booking until admin review
- Customers with repeated bad ratings are permanently banned

**This protects workers from:**
- Rude or aggressive customers
- Customers who refuse to pay after job
- Customers who give false job descriptions
- Customers who book workers to dangerous locations

## 6.7 Safety Feature 6 — New Account Flag

- Any customer account less than 7 days old is flagged for workers
- Worker sees: "⚠️ New Account — Created X days ago"
- Workers can make an informed decision about whether to accept
- After 7 days with no reports: flag removed automatically

## 6.8 Safety Feature 7 — Safe Job Confirmation

Before a worker accepts a booking and travels to the location:
- They see the full address on OpenStreetMap
- They can verify it is a real, identifiable location
- If location looks suspicious (remote, unlit at night, etc.) they can decline
- Workers are encouraged in onboarding to trust their instincts

---

# ═══════════════════════════════════════════
# PART 7 — THE 12 SERVICE CATEGORIES
# ═══════════════════════════════════════════

All 12 categories are seeded into the database on first deployment.
Run categories_seed.sql after all migrations are complete.

## Category 1 — Building & Structural Construction
Emoji: 🧱 | Icon: construct-outline | Color: #8B4513
Workers: Masons, Bricklayers, Tile Installers, Carpenters, Ironmongers,
Welder-Fabricators, Concrete Workers, Scaffolding Workers, Roofing Specialists,
Foundation Workers, Block Layers, Drainage Layers

## Category 2 — Plumbing & Water Systems
Emoji: 🚰 | Icon: water-outline | Color: #1E90FF
Workers: Domestic Plumbers, Borehole Drillers, Water Tank Installers,
Drainage Cleaners, Pipe Fitters, Swimming Pool Technicians,
Water Heater Installers, Septic Tank Cleaners

## Category 3 — Electrical & Power Engineering
Emoji: ⚡ | Icon: flash-outline | Color: #FFD700
Workers: House Wiring Electricians, Solar Panel Installers, Generator Mechanics,
Inverter Technicians, CCTV Installers, Satellite Dish Installers,
Smart Home Installers, Security System Installers, AC Technicians

## Category 4 — Automotive & Mechanical Repair
Emoji: 🚗 | Icon: car-outline | Color: #FF4500
Workers: Car Mechanics, Auto Electricians, Motorcycle/Tricycle Repairers,
Car Body Painters, Vulcanizers, Auto AC Technicians,
Car Wash Specialists, Truck Mechanics, Panel Beaters

## Category 5 — Finishing, Painting & Interior Decor
Emoji: 🎨 | Icon: brush-outline | Color: #9B59B6
Workers: House Painters, POP Ceiling Designers, Wallpaper Installers,
Interior Decorators, Window Blind Installers, Floor Polishers,
Gypsum Board Installers, False Ceiling Workers

## Category 6 — Cleaning & Property Maintenance
Emoji: 🧹 | Icon: sparkles-outline | Color: #00CED1
Workers: Deep Cleaners, Janitors, Laundry & Dry Cleaners,
Fumigation & Pest Control, Garbage Collectors,
Post-Construction Cleaners, Carpet Cleaners, Pool Cleaners

## Category 7 — Hair, Beauty & Personal Care
Emoji: 💈 | Icon: cut-outline | Color: #FF69B4
Workers: Barbers, Hairstylists/Braiders, Makeup Artists,
Nail Technicians, Skincare Therapists, Eyebrow Artists,
Lash Technicians, Massage Therapists, Spa Technicians

## Category 8 — Hospitality, Catering & Culinary Arts
Emoji: 🍽️ | Icon: restaurant-outline | Color: #FF8C00
Workers: Event Caterers, Private Chefs, Bakers/Confectioners,
Cocktail Mixologists, Local Food Cooks, Waiters/Waitresses,
Event Food Vendors, Drinks Suppliers

## Category 9 — Photography, Media & Creative Arts
Emoji: 📸 | Icon: camera-outline | Color: #4169E1
Workers: Event Photographers, Videographers, Drone Operators,
Video Editors, Graphic Designers, Photo Editors,
Social Media Content Creators, Brand Identity Designers

## Category 10 — Logistics, Transport & Delivery
Emoji: 🚴 | Icon: bicycle-outline | Color: #228B22
Workers: Dispatch Riders, Delivery Drivers, Truck/Hauling Drivers,
Private Drivers, Courier Assistants, Airport Pickup Drivers,
Moving Company Workers, Cargo Handlers

## Category 11 — Education, Tuition & Home Lessons
Emoji: 📚 | Icon: book-outline | Color: #8B0000
Workers: Home Tutors (Math/Science), Language Instructors,
Music Teachers, Coding/Tech Tutors, WAEC/BECE Specialists,
Early Childhood Educators, Adult Literacy Teachers, Sign Language Tutors

## Category 12 — Events, Entertainment & Sound
Emoji: 🎉 | Icon: musical-notes-outline | Color: #DC143C
Workers: Event Planners, DJs, MCs, Sound Engineers,
Stage/Lighting Designers, Ushers, Balloon Decorators,
Event Security, Tent & Chair Suppliers, Photo Booth Operators

---

# ═══════════════════════════════════════════
# PART 8 — WIAMAPP SPOTLIGHT SYSTEM
# ═══════════════════════════════════════════

## 8.1 What Spotlight Is

WiamApp Spotlight is a premium professional showcase system built inside the app.
It is NOT a social media feed.
It is NOT entertainment.
It is a serious, professional space for verified workers and businesses to
promote their services, showcase their completed work, and grow their reputation
within the WiamApp ecosystem.

Think of it as: a professional portfolio board + promotional platform
built directly inside the marketplace where customers are already looking.

## 8.2 Who Can Post on Spotlight

Only the following users can publish Spotlight content:
- Basic workers (🔵 Blue badge and above)
- Pro workers (🔵⭐)
- All verified Business Accounts (🟡 Gold badge)

**Free workers CANNOT post on Spotlight.**
This gives workers a strong reason to upgrade their subscription plan.

## 8.3 What Is Allowed on Spotlight

Workers and businesses may post:
- Before and after photos of completed work
- Portfolio showcase (quality work examples)
- Service promotions and limited-time discounts
- Business announcements (new services, new locations)
- Availability updates ("Available this weekend in East Legon")
- Verified work videos (short clips of work in progress or completed)
- Professional business advertisements
- New team member announcements (for businesses)
- Awards or certifications received
- Customer testimonial quotes (with permission)

Every post must relate directly to the worker's registered category or services.

## 8.4 What Is Strictly Forbidden on Spotlight

The following content will be removed immediately and may result in account penalties:
- Comedy posts, memes, entertainment content
- Personal lifestyle posts (family outings, food, personal opinions)
- Political content of any kind
- Religious content of any kind
- Gossip or unrelated personal content
- Fake promotions or misleading service claims
- Content not related to their registered service category
- Inappropriate images or videos
- Content stolen from other users or the internet

**Consequences for violations:**
- First offense: Post removed + warning
- Second offense: Spotlight access suspended for 30 days
- Third offense: Spotlight access permanently removed + account review

## 8.5 Where Spotlight Content Appears

Spotlight posts appear in the following locations within the app:
- Dedicated "Spotlight" tab on the home screen
- Below category listings when a customer views a category
- Inside a worker's profile page (their personal spotlight gallery)
- In "Discover" section for customers browsing the platform
- In priority featured areas for boosted posts

## 8.6 Paid Boost System (Additional Revenue)

Basic and Pro workers, and all Business Accounts, can pay to boost Spotlight posts:

| Boost Option | Duration | Reach | Price |
|---|---|---|---|
| Standard Boost | 3 days | Shown in category search | GHS 15 |
| Featured Boost | 7 days | Shown on home screen | GHS 35 |
| Premium Boost | 14 days | Shown to all users in city | GHS 70 |
| Business Spotlight | 30 days | Priority everywhere + search | GHS 150 |

Boosted posts are clearly labelled "Promoted" to maintain transparency.
This creates a clean revenue stream for WiamApp without being disruptive to users.

## 8.7 Spotlight Moderation

All Spotlight posts go through a moderation process:

**Automatic AI moderation (MVP — basic checks):**
- Checks image for inappropriate content
- Checks text for prohibited words
- Flags suspicious or off-topic content for manual review

**Manual admin moderation:**
- Admin reviews flagged posts
- Admin can approve, reject, or request edit
- Rejection comes with a clear reason sent to the user
- Admin can remove any post at any time without warning if it violates rules

**Community reporting:**
- Any user can report a Spotlight post
- "Report this post" button on every Spotlight card
- Reported posts are reviewed by admin within 24 hours

## 8.8 Spotlight — Platform Philosophy

WiamApp Spotlight exists to promote:
- Professionalism and craft
- Trusted, verified service work
- Serious business growth
- Quality marketplace visibility

It is designed to help workers and businesses grow professionally.
It will never become a social media entertainment platform.
The line between professional content and personal content will always be strictly enforced.

---

# ═══════════════════════════════════════════
# PART 9 — PLATFORM PROTECTION SYSTEM
# ═══════════════════════════════════════════

## 9.1 The Core Problem

Workers and customers may try to connect outside the app after meeting through WiamApp.
This is called platform leakage. It destroys WiamApp's commission revenue.
A worker who gets a customer's number directly can work with them for years without the app.
This must be prevented through smart product design and strict rules.

## 9.2 Protection Layer 1 — Hidden Phone Numbers

- Worker phone number is NEVER shown on their profile page
- Customer phone number is NEVER shown to workers before booking acceptance
- Phone numbers are ONLY revealed when ALL conditions are met:
  1. Customer has created a booking
  2. Worker has accepted the booking
  3. Customer payment has been made (held in escrow)
- This forces both parties through the payment system before contact is made

## 9.3 Protection Layer 2 — Escrow Payment System

```
Customer pays → Money held by WiamApp (worker cannot access yet)
         ↓
Job is completed and customer confirms
         ↓
WiamApp releases payment automatically
Worker gets their percentage → WiamApp keeps commission
```

Why this works:
- Worker is motivated to complete the job properly (money is waiting for them)
- Customer is protected (money returned if job is not done)
- WiamApp commission is automatically deducted — cannot be skipped

## 9.4 Protection Layer 3 — Intelligent Chat Monitoring

Every message is scanned before delivery:

**Triggers that cause a message to be flagged:**
- Ghana phone number patterns: 0XX-XXXXXXX or +233XXXXXXXXX
- Nigeria phone number patterns: 0XXXXXXXXXX or +234XXXXXXXXXX
- Payment app names: MoMo, Mobile Money, Cash, Bank Transfer, Paystack link
- Suspicious phrases: "pay me directly", "my number is", "call me outside the app",
  "reach me on WhatsApp", "let us meet outside", "do not use the app"

**What happens when a message is flagged:**
- Message is replaced with: ⚠️ "This message was flagged. Keep all payments and communication
  inside WiamApp for the protection of both parties."
- Both customer and worker see the warning
- Worker receives a Platform Warning (strike)
- Admin is notified immediately
- Logged permanently to audit_logs and platform_warnings table

**Strike System:**
- Strike 1: Warning notification sent to worker. Education message explaining the rule.
- Strike 2: Spotlight access suspended. Account restricted from applying to be featured.
- Strike 3: Account automatically suspended. Admin review required to reactivate.

## 9.5 Protection Layer 4 — Value Lock-in

Workers are given compelling reasons to stay on the platform:
- Rating and review history only exists on WiamApp (cannot be transferred)
- Verified badge only exists on WiamApp
- Job history builds formal employment track record (valuable for loans, credit)
- Dispute protection only applies to jobs booked through the app
- Featured listings, Spotlight posts, and subscriptions only work inside the app
- Workers who leave lose everything they built

## 9.6 Protection Layer 5 — Off-Platform Report Button

On every booking detail screen, a "Report an Issue" button is visible.
One option: "Worker/Customer asked me to pay outside the app."

If reported:
1. Fraud report filed automatically in database
2. Worker account temporarily suspended pending review
3. Admin receives immediate notification
4. Admin investigates using full audit trail (chat logs, booking history, ID on file)
5. First offense: Warning + re-education
6. Repeat offense: Permanent ban + reported to authorities with ID documentation

## 9.7 Commission Structure

| Plan | Commission | Minimum Per Job |
|---|---|---|
| Free Worker | 15% | GHS 5 |
| Basic Worker | 10% | GHS 5 |
| Pro Worker | 7% | GHS 5 |
| Starter Business | 8% | GHS 10 |
| Growth Business | 8% | GHS 10 |
| Enterprise Business | 7% | GHS 10 |

Example: Customer pays GHS 300 for a painting job.
Free worker receives: GHS 255 (85%)
Basic worker receives: GHS 270 (90%)
Pro worker receives: GHS 279 (93%)

---

# ═══════════════════════════════════════════
# PART 10 — COMPLETE USER JOURNEYS
# ═══════════════════════════════════════════

## 10.1 New Customer Complete Journey

```
STEP 1 — OPEN APP
Splash screen → Onboarding screen
Select: "Find a worker"

STEP 2 — REGISTER
Full name, Email, Phone, Password
Email OTP sent → 6-digit code entered → Email verified
Account created → Home screen opens immediately

STEP 3 — BROWSE (No verification needed to browse)
See 12 categories, nearby workers, featured workers
Can view any worker profile freely
Cannot book yet

STEP 4 — FIRST BOOKING ATTEMPT
Customer taps "Book Now" on any worker
App shows: "Verify your identity to book"
Explain: "We verify all customers to protect our workers"

STEP 5 — CUSTOMER VERIFICATION
Select ID type
Upload front (and back if required by card type)
Take live selfie
Submit → "Under review — you will be notified within 24 hours"
Customer can still browse while waiting

STEP 6 — VERIFICATION APPROVED
Email notification: "You are verified! You can now book workers."
Push notification: "Your identity has been confirmed ✅"
Customer gets Verified badge visible to workers

STEP 7 — BOOK A WORKER
Find worker → View full profile
Tap "Book Now"
Fill: service description, location, date/time, budget estimate
Submit booking request
Worker receives notification

STEP 8 — WAITING
Status: "Request Pending — Kwame is reviewing"
Worker has 2 hours to respond
Auto-cancel after 2 hours with no response

STEP 9 — WORKER ACCEPTS
Customer notified: "Kwame accepted your booking ✅"
Worker's phone number revealed
Chat opens

STEP 10 — PAYMENT
Customer pays via Paystack
Money held in escrow
Worker confirmed job is starting

STEP 11 — JOB DONE
Worker taps "Job Complete"
Customer confirms: "Yes, the job is done" or "Raise a dispute"
If confirmed: Escrow released, worker paid

STEP 12 — REVIEW
Customer prompted to rate worker (1-5 stars + comment)
Worker also rates customer (private rating — admin + workers can see)
Both ratings submitted

STEP 13 — MONTHLY RE-VERIFICATION
After 30 days: "Time to confirm it's still you"
Customer takes fresh live selfie (30 seconds)
Compared to stored ID photo
Booking access continues normally

STEP 14 — 6-MONTH FULL RE-VERIFICATION
"Please re-verify your identity"
Customer re-uploads ID + takes selfie
Full verification cycle starts again
```

## 10.2 New Worker Complete Journey

```
STEP 1 — REGISTER
Select: "Offer my skills"
Full name, Email, Phone, Password, Primary category, City
Email OTP verified → Account created

STEP 2 — DOCUMENT VERIFICATION
Verification intro screen (explain the process)
Select ID type
Upload ID front + back (where applicable)
Take live selfie (camera only — no gallery)
Submit for review

STEP 3 — PENDING (24 hours)
Can browse the app, complete profile, add portfolio images
CANNOT accept bookings yet
Status banner: "Your identity is under review — 24 hours"

STEP 4 — VERIFICATION RESULT
APPROVED → Email: "You're verified! Start receiving bookings"
Free worker: No badge. Basic/Pro: Blue badge.
REJECTED → Email with specific clear reason + resubmit option

STEP 5 — PROFILE SETUP
Complete bio, set hourly rate, add portfolio images
Select specific skills from 12 categories and subtypes
Set location and availability

STEP 6 — FIRST BOOKING
Push notification: "New job request from Abena Mensah 🔔"
See: customer name, verification status, service needed,
     location on map, date, budget, new account flag if applicable
ACCEPT or DECLINE within 2 hours

STEP 7 — JOB EXECUTION
Chat opens with customer
Set "On My Way" → GPS tracking begins
Tap "I Have Arrived" → GPS check-in recorded
Complete the work
Tap "Job Complete — Check Out"

STEP 8 — PAYMENT RECEIVED
Customer confirms → Escrow released
Money arrives in worker account within 24 hours (via Paystack)
Commission deducted automatically
Earnings visible in Earnings dashboard

STEP 9 — REVIEW RECEIVED
Customer rates the work
Worker rating updates automatically
Worker can view all reviews in profile

STEP 10 — UPGRADE DECISION
Worker decides: stay Free (15% commission) or upgrade to Basic (10%, Blue badge)?
Upgrade from profile → Settings → Subscription
Payment via Paystack monthly
```

---

# ═══════════════════════════════════════════
# PART 11 — COMPLETE SCREEN LIST (52 Screens)
# ═══════════════════════════════════════════

## 11.1 Auth & Onboarding (7 screens)

| # | Screen Name | Description |
|---|---|---|
| 1 | SplashScreen | Logo animation, check auth state, redirect |
| 2 | OnboardingScreen | 3-path selector: Customer / Worker / Business |
| 3 | LoginScreen | Email + password, show/hide, forgot password |
| 4 | RegisterScreen | Role-based registration form |
| 5 | EmailOTPScreen | 6-digit code, 60s resend countdown, auto-submit |
| 6 | ForgotPasswordScreen | Enter email, receive reset link |
| 7 | ResetPasswordScreen | New password + confirm |

## 11.2 Customer Verification (4 screens)

| # | Screen Name | Description |
|---|---|---|
| 8 | CustomerVerifyIntroScreen | Explain why verification is needed to protect workers |
| 9 | CustomerIDUploadScreen | Select card type, auto-determine front/back requirement |
| 10 | CustomerSelfieScreen | Live camera selfie only — no gallery |
| 11 | CustomerVerifyPendingScreen | 24hr wait, can browse but not book |

## 11.3 Worker Verification (6 screens)

| # | Screen Name | Description |
|---|---|---|
| 12 | WorkerVerifyIntroScreen | Explain process, what is needed, 24hr timeline |
| 13 | IDTypeScreen | Choose Ghana Card / Passport / Voter ID / Driver's License |
| 14 | IDUploadScreen | Front + back (auto-skip back for Voter ID and Passport) |
| 15 | WorkerSelfieScreen | Live selfie only, tips shown, no gallery |
| 16 | VerificationPendingScreen | 24hr wait, explore app, cannot accept bookings |
| 17 | VerificationApprovedScreen | Celebration, badge explained, upgrade prompt |
| 18 | VerificationRejectedScreen | Clear reason, resubmit button |

## 11.4 Customer Screens (14 screens)

| # | Screen Name | Description |
|---|---|---|
| 19 | CustomerHomeScreen | 12 categories, nearby workers, featured, spotlight posts |
| 20 | SearchScreen | Search + filters (category, verified, available, rating, price) |
| 21 | CategoryScreen | All workers in one category, subtype filter |
| 22 | WorkerProfileScreen | Full profile, portfolio, spotlight posts, reviews, book button |
| 23 | BookingFormScreen | Service details, location, date, time, budget |
| 24 | BookingConfirmScreen | Review all details before final submission |
| 25 | BookingSuccessScreen | Confirmed, reference number, chat link |
| 26 | BookingsListScreen | All bookings (Active / Completed / Cancelled tabs) |
| 27 | BookingDetailScreen | Full job details, chat button, cancel, dispute |
| 28 | PaymentScreen | Paystack payment form, amount breakdown |
| 29 | PaymentSuccessScreen | Receipt, escrow confirmation |
| 30 | ChatListScreen | All conversations inbox |
| 31 | ChatScreen | Real-time messages + voice messages + safety warning |
| 32 | ReviewScreen | 1-5 stars + written review |
| 33 | CustomerProfileScreen | Edit profile, verification status, settings, dark mode |
| 34 | NotificationsScreen | All notifications with read/unread |

## 11.5 Worker Screens (12 screens)

| # | Screen Name | Description |
|---|---|---|
| 35 | WorkerDashboardScreen | Stats, availability toggle, pending jobs, safety features |
| 36 | WorkerJobsScreen | All jobs with status tabs |
| 37 | JobDetailScreen | Full details, accept/reject, customer verification status |
| 38 | EarningsScreen | Total earnings, commission breakdown, monthly chart |
| 39 | WorkerProfileEditScreen | Edit bio, skills, rates, categories, portfolio |
| 40 | PortfolioManagerScreen | Add, remove, reorder portfolio images |
| 41 | SkillsManagerScreen | Select subtypes from 12 categories |
| 42 | SpotlightManagerScreen | Create, manage, boost Spotlight posts |
| 43 | WorkerNotificationsScreen | Job alerts, payment alerts, warnings |
| 44 | WorkerSettingsScreen | Subscription, dark mode, notification preferences |
| 45 | SafetyScreen | Emergency contacts, SOS setup, location sharing settings |
| 46 | SubscriptionScreen | View plans, upgrade, payment history |

## 11.6 Business Account Screens (5 screens)

| # | Screen Name | Description |
|---|---|---|
| 47 | BusinessApplicationScreen | Apply for Gold Badge, upload all business documents |
| 48 | BusinessDashboardScreen | Team overview, revenue, active jobs, analytics |
| 49 | TeamManagementScreen | Add/remove workers, assign roles, view team performance |
| 50 | BusinessAnalyticsScreen | Detailed charts, revenue by category, team performance |
| 51 | BusinessSpotlightScreen | Manage company Spotlight posts and paid boosts |

## 11.7 Admin Screens (5 screens — separate admin access)

| # | Screen Name | Description |
|---|---|---|
| 52 | AdminDashboardScreen | Platform stats: users, jobs, revenue, open reports |
| 53 | DocumentQueueScreen | Pending verifications, oldest first, deadline alerts |
| 54 | DocumentReviewScreen | View ID + selfie, approve or reject with reason |
| 55 | FraudReportsScreen | All open reports, full trace data |
| 56 | CommissionReportScreen | Daily/weekly/monthly earnings, payout reconciliation |

---

# ═══════════════════════════════════════════
# PART 12 — NOTIFICATION SYSTEM
# ═══════════════════════════════════════════

## 12.1 Three Notification Channels

| Channel | Purpose | Provider | Cost |
|---|---|---|---|
| Push Notification | Real-time phone alerts | Expo Push Notifications | Free |
| In-App Notification | Bell icon badge | Supabase Realtime | Free |
| Email | Important events | Resend | Free (3,000/month) |

## 12.2 Customer Notification Triggers

| Event | Push | In-App | Email |
|---|---|---|---|
| Email OTP code | ❌ | ❌ | ✅ |
| Account verified | ✅ | ✅ | ✅ |
| Booking request sent | ✅ | ✅ | ❌ |
| Worker accepted booking | ✅ | ✅ | ✅ |
| Worker rejected booking | ✅ | ✅ | ✅ |
| Worker on the way | ✅ | ✅ | ❌ |
| Worker arrived | ✅ | ✅ | ❌ |
| Job marked complete | ✅ | ✅ | ✅ |
| Payment processed | ✅ | ✅ | ✅ |
| Review reminder | ✅ | ✅ | ✅ |
| Monthly re-verification due | ✅ | ✅ | ✅ |
| New Spotlight post from saved worker | ✅ | ✅ | ❌ |

## 12.3 Worker Notification Triggers

| Event | Push | In-App | Email |
|---|---|---|---|
| New booking request | ✅ | ✅ | ✅ |
| Booking auto-cancelled (no response) | ✅ | ✅ | ✅ |
| Customer paid — escrow held | ✅ | ✅ | ✅ |
| Job confirmed — payment releasing | ✅ | ✅ | ✅ |
| Payment received | ✅ | ✅ | ✅ |
| New review received | ✅ | ✅ | ✅ |
| Verification approved | ✅ | ✅ | ✅ |
| Verification rejected | ✅ | ✅ | ✅ |
| Platform warning issued | ✅ | ✅ | ✅ |
| Account suspended | ✅ | ✅ | ✅ |
| Subscription expiring (3 days) | ✅ | ✅ | ✅ |
| New message in chat | ✅ | ✅ | ❌ |

## 12.4 Admin Notification Triggers

| Event | Admin Panel | Email |
|---|---|---|
| New document submitted | ✅ | ✅ |
| Document waiting over 20 hours | ✅ | ✅ |
| New fraud report filed | ✅ | ✅ |
| New business account application | ✅ | ✅ |
| SOS button triggered by worker | ✅ | ✅ |
| Worker suspended (3 strikes) | ✅ | ✅ |
| High-value dispute raised | ✅ | ✅ |

---

# ═══════════════════════════════════════════
# PART 13 — COMPLETE TECH STACK
# ═══════════════════════════════════════════

Every tool listed here is FREE to start.
Nothing blocks development or requires payment before the first booking is made.

## 13.1 Mobile App

| Technology | Purpose |
|---|---|
| React Native + Expo SDK 51 | Cross-platform iOS and Android app |
| React Navigation v6 | Screen navigation (Stack + Bottom Tabs) |
| AsyncStorage | Local session storage |
| Expo Image Picker | Camera and gallery for document uploads |
| Expo AV | Voice recording and playback in chat |
| Expo Location | GPS for check-in, check-out, SOS |
| Expo Notifications | Push notifications |
| Expo Device | Device fingerprinting for duplicate detection |
| Ionicons | All icons throughout the app |
| React Native Maps (OpenStreetMap) | Job location display on map |

## 13.2 Backend Server

| Technology | Purpose |
|---|---|
| Node.js 18+ | Server runtime |
| Express.js | API framework |
| Helmet | HTTP security headers |
| CORS | Cross-origin control |
| express-rate-limit | Rate limiting |
| Multer | File upload handling |
| dotenv | Environment variable management |

## 13.3 Database & Auth

| Technology | Purpose | Free Tier |
|---|---|---|
| Supabase (PostgreSQL) | Main database | 500MB free |
| Supabase Auth | JWT authentication | Included |
| Supabase Realtime | Live messages and notifications | Included |
| Supabase RLS | Row Level Security | Included |

## 13.4 File Storage

| Technology | Purpose | Free Tier |
|---|---|---|
| Cloudflare R2 (Public Bucket) | Avatars, portfolios, voice messages | 10GB free, no egress fees |
| Cloudflare R2 (Private Bucket) | ID documents, selfies (signed URLs only) | Included in 10GB |

Why R2 over others: No egress fees. Works with S3 SDK. Integrates with Cloudflare DNS.

## 13.5 Email

| Technology | Purpose | Free Tier |
|---|---|---|
| Resend | All transactional emails | 3,000 emails/month free |

## 13.6 Payments

| Technology | Purpose | Cost |
|---|---|---|
| Paystack | Ghana (GHS) + Nigeria (NGN) | Free to start, 1.5% per transaction |

## 13.7 Identity Verification

| Phase | Technology | Cost |
|---|---|---|
| MVP | Manual admin review | Free |
| Phase 2 | Smile Identity AI | ~$0.70 per worker when revenue allows |

## 13.8 Deployment

| Technology | Purpose | Free Tier |
|---|---|---|
| GitHub (WiamLabs org) | Code repository | Free private repos |
| Render | Backend server | Free (750 hours/month) |
| Cloudflare | Domain DNS + CDN | Free |
| Expo EAS | App builds | Free tier |

## 13.9 Total Monthly Cost at Launch

**GHS 0 per month** until revenue justifies upgrades.
Every service above operates within free tier for MVP launch.

---

# ═══════════════════════════════════════════
# PART 14 — DATABASE SCHEMA (KEY TABLES)
# ═══════════════════════════════════════════

## 14.1 Updated Users Table

```sql
CREATE TABLE users (
  id                           UUID PRIMARY KEY,
  full_name                    VARCHAR(100) NOT NULL,
  email                        VARCHAR(150) UNIQUE NOT NULL,
  phone                        VARCHAR(20),
  role                         ENUM: customer | worker | business | admin,
  avatar_url                   TEXT,
  city                         VARCHAR(100),
  country                      VARCHAR(100) DEFAULT 'Ghana',
  is_active                    BOOLEAN DEFAULT true,

  -- Identity verification
  customer_verification_status ENUM: unverified | pending | verified | suspended,
  customer_id_type             VARCHAR(50),
  customer_id_front_key        TEXT,    -- R2 private key
  customer_id_back_key         TEXT,    -- R2 private key (null for single-side cards)
  customer_selfie_key          TEXT,    -- R2 private key
  customer_verified_at         TIMESTAMPTZ,
  customer_last_selfie_at      TIMESTAMPTZ,  -- monthly re-verification
  customer_next_full_verify_at TIMESTAMPTZ,  -- 6-month full re-verification

  -- Preferences
  dark_mode                    BOOLEAN DEFAULT false,
  notification_preferences     JSONB DEFAULT '{}',

  -- Emergency contact (for workers)
  emergency_contact_name       VARCHAR(100),
  emergency_contact_phone      VARCHAR(20),

  created_at                   TIMESTAMPTZ DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ DEFAULT NOW()
);
```

## 14.2 Updated Worker Profiles Table

```sql
CREATE TABLE worker_profiles (
  id                   UUID PRIMARY KEY,
  user_id              UUID REFERENCES users(id),

  -- Profile
  bio                  TEXT,
  years_experience     INT DEFAULT 0,
  hourly_rate          DECIMAL(10,2),
  currency             VARCHAR(10) DEFAULT 'GHS',
  location_name        VARCHAR(200),
  latitude             DECIMAL(10,8),
  longitude            DECIMAL(11,8),

  -- Availability
  is_available         BOOLEAN DEFAULT true,
  availability_note    TEXT,

  -- Verification
  is_verified          BOOLEAN DEFAULT false,
  id_type              VARCHAR(50),
  id_front_key         TEXT,    -- R2 private key
  id_back_key          TEXT,    -- R2 private key
  selfie_key           TEXT,    -- R2 private key
  verified_at          TIMESTAMPTZ,

  -- Badge and subscription
  badge_type           ENUM: none | blue | blue_pro | gold,
  subscription_plan    ENUM: free | basic | pro,
  subscription_expires TIMESTAMPTZ,

  -- Performance
  total_jobs_done      INT DEFAULT 0,
  average_rating       DECIMAL(3,2) DEFAULT 0.00,
  response_rate        DECIMAL(5,2) DEFAULT 100.00,
  response_time_avg    INT,  -- minutes

  -- Safety
  check_in_lat         DECIMAL(10,8),  -- current job location
  check_in_lng         DECIMAL(11,8),
  check_in_at          TIMESTAMPTZ,

  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
```

## 14.3 Customer Ratings Table (New)

```sql
CREATE TABLE customer_ratings (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id  UUID REFERENCES bookings(id) UNIQUE,
  worker_id   UUID REFERENCES worker_profiles(id),
  customer_id UUID REFERENCES users(id),
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  note        TEXT,   -- private — only admins and workers can see
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

## 14.4 Worker Safety Table (New)

```sql
CREATE TABLE worker_safety_events (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worker_id      UUID REFERENCES worker_profiles(id),
  booking_id     UUID REFERENCES bookings(id),
  event_type     ENUM: check_in | check_out | sos_triggered | location_shared,
  latitude       DECIMAL(10,8),
  longitude      DECIMAL(11,8),
  location_name  TEXT,
  customer_id    UUID REFERENCES users(id),
  alert_sent_to  TEXT,   -- emergency contact phone
  resolved       BOOLEAN DEFAULT false,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

## 14.5 Spotlight Posts Table (New)

```sql
CREATE TABLE spotlight_posts (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  author_id       UUID REFERENCES users(id),
  worker_id       UUID REFERENCES worker_profiles(id),
  category_id     UUID REFERENCES categories(id),
  title           VARCHAR(200),
  description     TEXT,
  media_urls      TEXT[],   -- Cloudflare R2 public URLs (images/videos)
  post_type       ENUM: portfolio | promotion | announcement | availability | discount,
  status          ENUM: pending_review | approved | rejected | removed,
  rejection_reason TEXT,
  is_boosted      BOOLEAN DEFAULT false,
  boost_type      ENUM: standard | featured | premium | business,
  boost_expires_at TIMESTAMPTZ,
  boost_paid      DECIMAL(10,2),
  views_count     INT DEFAULT 0,
  likes_count     INT DEFAULT 0,
  report_count    INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

## 14.6 Business Profiles Table (New)

```sql
CREATE TABLE business_profiles (
  id                        UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id                  UUID REFERENCES users(id),

  -- Business info
  business_name             VARCHAR(200) NOT NULL,
  business_type             VARCHAR(100),
  registration_number       VARCHAR(100),
  tin_number                VARCHAR(100),
  business_address          TEXT,
  business_city             VARCHAR(100),
  website                   VARCHAR(200),
  logo_url                  TEXT,   -- R2 public URL
  banner_url                TEXT,   -- R2 public URL
  description               TEXT,

  -- Documents (R2 private keys)
  owner_id_key              TEXT,
  registration_cert_key     TEXT,
  address_proof_key         TEXT,

  -- Verification
  verification_status       ENUM: pending | approved | rejected,
  rejection_reason          TEXT,
  reviewed_by               UUID REFERENCES users(id),
  approved_at               TIMESTAMPTZ,

  -- Subscription
  business_tier             ENUM: starter | growth | enterprise,
  tier_expires_at           TIMESTAMPTZ,
  max_workers               INT,

  -- Performance
  total_team_jobs           INT DEFAULT 0,
  average_team_rating       DECIMAL(3,2) DEFAULT 0.00,

  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);
```

---

# ═══════════════════════════════════════════
# PART 15 — COMPLETE API ENDPOINTS
# ═══════════════════════════════════════════

Base URL: https://api.wiamapp.com
Protected routes require: Authorization: Bearer {JWT_TOKEN}
Response format: { success: true, data: {...} } or { success: false, error: "message" }

## 15.1 Auth Routes
```
POST   /api/auth/register              Register new user
POST   /api/auth/login                 Login with email + password
GET    /api/auth/me                    Get current user profile
POST   /api/auth/send-otp              Send email OTP
POST   /api/auth/verify-otp            Verify OTP code
POST   /api/auth/forgot-password       Send reset email
POST   /api/auth/reset-password        Set new password
POST   /api/auth/logout                Invalidate session
DELETE /api/auth/account               Delete account
```

## 15.2 Customer Verification Routes
```
POST   /api/customer-verify/submit     Submit ID + selfie for customer verification
GET    /api/customer-verify/status     Get customer verification status
POST   /api/customer-verify/selfie     Monthly re-verification selfie
POST   /api/customer-verify/resubmit  Resubmit after rejection
```

## 15.3 Worker Routes
```
GET    /api/workers                    Get all workers (filters: category, city, verified, available)
GET    /api/workers/:id                Get single worker full profile
GET    /api/workers/search/:query      Search by name or skill
PATCH  /api/workers/availability       Toggle availability on/off
GET    /api/workers/meta/categories    Get all 12 categories with subtypes
POST   /api/workers/profile            Create worker profile
PUT    /api/workers/profile            Update worker profile
POST   /api/workers/portfolio          Add portfolio image
DELETE /api/workers/portfolio/:id      Remove portfolio image
GET    /api/workers/:id/contact        Get contact (only after booking + payment)
```

## 15.4 Booking Routes
```
POST   /api/bookings                   Create new booking
GET    /api/bookings                   Get all bookings for current user
GET    /api/bookings/pending           Get pending bookings for worker
GET    /api/bookings/:id               Get single booking details
PATCH  /api/bookings/:id/accept        Accept booking (worker)
PATCH  /api/bookings/:id/reject        Reject booking (worker)
PATCH  /api/bookings/:id/on-the-way   Worker is travelling to job
PATCH  /api/bookings/:id/check-in     Worker arrived at job location
PATCH  /api/bookings/:id/complete     Mark job complete (worker)
PATCH  /api/bookings/:id/confirm      Customer confirms completion
PATCH  /api/bookings/:id/cancel       Cancel booking
PATCH  /api/bookings/:id/dispute      Raise a dispute
POST   /api/bookings/:id/review       Customer reviews worker
POST   /api/bookings/:id/rate-customer Worker rates customer (private)
```

## 15.5 Safety Routes
```
POST   /api/safety/sos                 Trigger SOS emergency alert
POST   /api/safety/share-location      Start live location sharing
DELETE /api/safety/share-location      Stop location sharing
GET    /api/safety/emergency-contact   Get registered emergency contact
PUT    /api/safety/emergency-contact   Update emergency contact
```

## 15.6 Upload Routes
```
POST   /api/uploads/avatar             Upload profile photo (public R2)
POST   /api/uploads/portfolio          Upload portfolio image (public R2)
POST   /api/uploads/voice              Upload voice message (public R2)
POST   /api/uploads/worker-document    Upload worker ID document (private R2)
POST   /api/uploads/worker-selfie      Upload worker selfie (private R2)
POST   /api/uploads/customer-document  Upload customer ID document (private R2)
POST   /api/uploads/customer-selfie    Upload customer selfie (private R2)
POST   /api/uploads/business-document  Upload business document (private R2)
POST   /api/uploads/spotlight-media    Upload Spotlight image/video (public R2)
```

## 15.7 Verification Routes
```
POST   /api/verify/worker/submit       Worker submits documents
GET    /api/verify/worker/status       Worker verification status
POST   /api/verify/business/submit     Business submits documents
GET    /api/verify/business/status     Business verification status
POST   /api/verify/admin/approve       Admin approves (admin only)
POST   /api/verify/admin/reject        Admin rejects with reason (admin only)
GET    /api/verify/admin/queue         Get pending queue (admin only)
GET    /api/verify/admin/doc/:key      Get signed URL for doc (admin only, 15min)
```

## 15.8 Payment Routes
```
POST   /api/payments/initiate          Start Paystack payment
GET    /api/payments/verify/:ref       Verify payment status
POST   /api/payments/webhook           Paystack webhook (server only)
POST   /api/payments/escrow/release    Release escrow to worker
GET    /api/payments/history           Payment history
GET    /api/payments/admin/report      Commission report (admin only)
```

## 15.9 Spotlight Routes
```
POST   /api/spotlight                  Create new Spotlight post
GET    /api/spotlight                  Get all approved posts (feed)
GET    /api/spotlight/:workerId        Get posts for a specific worker
PATCH  /api/spotlight/:id             Update post (author only)
DELETE /api/spotlight/:id             Delete post (author only)
POST   /api/spotlight/:id/boost       Pay to boost a post
POST   /api/spotlight/:id/report      Report a post
GET    /api/spotlight/admin/queue      Get posts pending moderation (admin)
PATCH  /api/spotlight/admin/:id       Admin approve or reject post
```

## 15.10 Notification Routes
```
GET    /api/notifications              Get all notifications
GET    /api/notifications/unread-count Count unread
PATCH  /api/notifications/:id/read    Mark one as read
PATCH  /api/notifications/read-all    Mark all as read
DELETE /api/notifications/:id         Delete notification
POST   /api/notifications/push-token  Register Expo push token
```

## 15.11 Business Routes
```
POST   /api/business/apply            Apply for Business Account
GET    /api/business/profile          Get business profile
PUT    /api/business/profile          Update business profile
POST   /api/business/team/add         Add worker to team
DELETE /api/business/team/:workerId   Remove worker from team
GET    /api/business/team             Get all team workers
GET    /api/business/analytics        Business analytics dashboard
POST   /api/business/assign-job       Assign booking to specific worker
```

---

# ═══════════════════════════════════════════
# PART 16 — MONETIZATION MODEL
# ═══════════════════════════════════════════

## 16.1 Revenue Stream 1 — Transaction Commission (Launches Immediately)

Every completed, confirmed booking generates commission.
No sales team needed. No setup required. Starts from the first booking.

| Plan | Commission | Worker Keeps |
|---|---|---|
| Free | 15% | 85% |
| Basic | 10% | 90% |
| Pro | 7% | 93% |
| Any Business | 7-8% | 92-93% |

Example: GHS 300 job × 300 bookings/month × 10% avg = GHS 9,000/month at 300 bookings.

## 16.2 Revenue Stream 2 — Worker Subscription Plans

Monthly recurring revenue — the most stable revenue type.

| Plan | Monthly Fee | Projected Users |
|---|---|---|
| Basic | GHS 30 | 40% of active workers |
| Pro | GHS 80 | 15% of active workers |

At 500 active workers in Accra:
- 200 Basic × GHS 30 = GHS 6,000/month
- 75 Pro × GHS 80 = GHS 6,000/month
- Total subscription: GHS 12,000/month

## 16.3 Revenue Stream 3 — Spotlight Boost Fees

| Boost | Price | Est. Monthly Purchases |
|---|---|---|
| Standard (3 days) | GHS 15 | 100 boosts |
| Featured (7 days) | GHS 35 | 40 boosts |
| Premium (14 days) | GHS 70 | 15 boosts |
| Business (30 days) | GHS 150 | 10 boosts |
| Monthly potential | — | GHS 6,000+ |

## 16.4 Revenue Stream 4 — Business Account Fees

| Tier | Monthly Fee | Target Companies |
|---|---|---|
| Starter | GHS 250 | Cleaning companies, small agencies |
| Growth | GHS 500 | Event companies, property managers |
| Enterprise | GHS 1,200 | Corporations, large service companies |

Even 10 business accounts across all tiers = GHS 5,000-10,000/month.

## 16.5 Combined Monthly Revenue Projection

**Month 6 (Accra only, 500 workers, 2,000 customers):**
- Commissions: GHS 15,000
- Subscriptions: GHS 12,000
- Spotlight boosts: GHS 6,000
- Business accounts: GHS 5,000
- **Total: ~GHS 38,000/month**

**Month 12 (All Ghana, 5,000 workers):**
- **Total projected: GHS 180,000-250,000/month**

---

# ═══════════════════════════════════════════
# PART 17 — DISPUTE RESOLUTION SYSTEM
# ═══════════════════════════════════════════

## 17.1 When a Dispute Is Raised

A dispute freezes the escrow immediately.
Neither party receives the money while the dispute is open.

Disputes are raised when:
- Customer claims job was not completed properly
- Worker claims customer is refusing to confirm unfairly
- Customer claims worker never showed up
- Either party suspects fraud

## 17.2 Dispute Process

```
Dispute raised by customer or worker
         ↓
Escrow FROZEN immediately — no money moves
         ↓
Admin receives urgent notification
         ↓
Admin reviews everything within 48 hours:
  - Chat messages (full log)
  - Check-in and check-out GPS records
  - Booking description vs what was delivered
  - Any photos submitted as evidence
  - Audit logs of all actions
         ↓
Admin decision:
  A) Release to worker → job was done correctly
  B) Refund to customer → job was not done
  C) Partial release → job was partially done
         ↓
Both parties notified of decision and reason
Escrow resolved accordingly
```

## 17.3 Evidence Both Parties Can Submit

- Photos of completed or incomplete work
- Written statement describing what happened
- Screenshots (all chat is already logged — admin has full access)

## 17.4 Admin Tools for Disputes

Admin sees everything:
- Complete booking history
- Every chat message (cannot be deleted by users)
- Full GPS check-in/check-out record
- Complete audit log with timestamps
- Worker's verified Ghana Card (real identity confirmed)
- Customer's verified ID (real identity confirmed)
- Device fingerprint + IP address history

If criminal activity is confirmed: full documentation provided to police.

---

# ═══════════════════════════════════════════
# PART 18 — SECURITY ARCHITECTURE
# ═══════════════════════════════════════════

## 18.1 Authentication

- Supabase Auth handles JWT generation and auto-refresh
- Sessions stored in AsyncStorage (never in plain text)
- On logout: token invalidated, AsyncStorage cleared completely
- Failed logins tracked: 10 failures = account locked for 30 minutes

## 18.2 API Security

- Every protected route validates JWT token server-side before processing
- Rate limiting: 100 req/15min global, 10/15min auth, 5/hour verification
- CORS: Only wiamapp.com and Expo Go origins accepted
- Helmet: XSS protection, HSTS, no-sniff headers
- Input validation on every field before any processing
- Parameterized queries only — no SQL injection possible

## 18.3 File Security

| File Type | Bucket | URL Access |
|---|---|---|
| Avatars | R2 Public | Public URL — anyone can view |
| Portfolio images | R2 Public | Public URL — anyone can view |
| Voice messages | R2 Public | Public URL — sender and receiver |
| Worker ID documents | R2 Private | Signed URL — admin only, 15min expiry |
| Worker selfies | R2 Private | Signed URL — admin only, 15min expiry |
| Customer ID documents | R2 Private | Signed URL — admin only, 15min expiry |
| Customer selfies | R2 Private | Signed URL — admin only, 15min expiry |
| Business documents | R2 Private | Signed URL — admin only, 15min expiry |

## 18.4 Anti-Fraud Measures

| Feature | Protection |
|---|---|
| Customer ID verification | Confirms real person, traceable identity |
| Worker ID verification | Confirms real person, traceable identity |
| Device fingerprinting | Detects duplicate accounts from same phone |
| IP address logging | Login location history |
| Failed verification tracking | 3 failures = account suspended |
| Chat monitoring | Phone numbers and payment apps detected |
| Platform warnings | 3 strikes = automatic worker suspension |
| Audit log | Every action logged permanently, cannot be deleted |
| Fraud trace | Full evidence package for police referral |

## 18.5 Row Level Security (RLS)

Every Supabase table has RLS enabled.
Users can ONLY read and modify their own data.
The service role key (bypasses RLS) lives ONLY in Render environment variables.
Never in the app. Never in GitHub.

---

# ═══════════════════════════════════════════
# PART 19 — DARK MODE & THEMING
# ═══════════════════════════════════════════

## Absolute Theme Rules

1. Worker app screens ALWAYS use navy (#08081A) background — permanent, not optional
2. Customer app screens default to white (#FFFFFF)
3. Customer can toggle dark mode in Profile → Settings
4. Gold buttons (#D4A017) NEVER change color between light and dark mode
5. In dark mode, gold button TEXT is navy (#08081A) for contrast
6. In light mode, gold button TEXT is white (#FFFFFF)
7. Copyright footer appears on every screen
8. ALWAYS import from constants/colors.js — NEVER hardcode any color value

---

# ═══════════════════════════════════════════
# PART 20 — AI DEVELOPMENT RULES
# ═══════════════════════════════════════════

## Purpose

These rules apply to Cursor, Claude, ChatGPT, Windsurf, and every AI tool used to build WiamApp.
Every AI tool reads this section before generating any code.
These rules are not suggestions. They are requirements.

## 20.1 File and Structure Rules

1. NEVER create duplicate components, utilities, or files
2. ALWAYS search existing folders before creating any new file
3. NEVER install packages without confirming no equivalent already exists
4. Every file MUST follow the existing folder structure exactly
5. New screens go in: screens/
6. New API calls go in: lib/api/
7. New backend routes go in: backend/routes/
8. New backend utilities go in: backend/lib/
9. New database changes go in: database/migrations/ (numbered sequentially)
10. NEVER modify migration files that have already been run

## 20.2 Code Quality Rules

11. Prefer simple architecture — no over-engineering
12. Reuse existing APIs, hooks, and components wherever possible
13. Keep components modular and independently testable
14. Every file MUST start with: // © 2026 WiamApp. Powered by WiamLabs
15. Colors MUST be imported from constants/colors.js — NEVER hardcoded
16. NEVER use inline style hex values

## 20.3 Database Rules

17. Database changes MUST use numbered migration files
18. Every new table MUST have RLS enabled and appropriate policies
19. Copy RLS patterns from 004_rls_policies.sql
20. Important user actions MUST be logged to audit_logs
21. Use logAction() from lib/api/security.js for all logging

## 20.4 Backend Rules

22. All routes MUST: validate input, return consistent JSON, handle errors
23. All protected routes MUST call verifyUserToken() first
24. NEVER expose secret keys or service role in any frontend code
25. supabaseAdmin is backend ONLY — never import in screen files
26. File uploads MUST be validated for type AND size before processing

## 20.5 Security Rules

27. Phone numbers NEVER appear on worker or customer profile screens
28. Customer phone numbers NEVER appear to workers before booking + payment
29. Worker phone numbers NEVER appear to customers before booking + payment
30. Documents in R2 private bucket — always return key only, never URL
31. Signed URLs must always have maximum 15-minute expiry

## 20.6 UI/UX Rules

32. Every feature MUST support both dark and light mode
33. Worker screens ALWAYS use navy background
34. Gold buttons NEVER change color between themes
35. Every screen handles: loading state, error state, empty state
36. NEVER show a blank screen — always show something meaningful
37. Error messages must be human-friendly — never show raw technical errors

## 20.7 Free Tier Rules

38. NEVER add any service that requires payment before the first booking
39. Check free tier limits before adding any new service
40. Document why a service was chosen and what its free tier allows
41. If a service has no free tier: propose a free alternative first

## 20.8 Testing Rules

42. Every feature must be tested independently before integration
43. Test on both light mode and dark mode before committing UI changes
44. Test on Android via Expo Go before committing any change
45. Run git status before every commit to confirm .env is not included

---

# ═══════════════════════════════════════════
# PART 21 — LAUNCH STRATEGY
# ═══════════════════════════════════════════

## Phase 1 — Accra MVP (Months 1-3)

Target: 500 verified workers, 2,000 customers
Focus areas: East Legon, Osu, Cantonments, Airport Residential, Adenta

Worker acquisition:
- Visit trade schools and apprenticeship centers
- Partner with Ghana Electrical Contractors Association
- WhatsApp outreach to known tradespeople in target areas
- Worker referral: bring a friend, earn GHS 20 when they complete 5 jobs

Customer acquisition:
- Facebook and Instagram ads for Accra homeowners aged 25-50
- Partner with gated community management offices
- Referral program: invite a friend, both get GHS 10 credit after first booking

## Phase 2 — All Ghana (Months 4-8)

Expand to: Kumasi, Takoradi, Tamale, Cape Coast, Tema
Target: 5,000 workers, 20,000 customers

Strategy:
- Regional ambassadors in each city
- Joy FM, Citi FM, Ghana Web press coverage
- University campus partnerships for education category

## Phase 3 — Nigeria Launch (Months 9-15)

Start: Lagos (Lekki, Victoria Island, Ikeja)
Then: Abuja, Port Harcourt

Localization:
- NGN currency (already in Paystack)
- Nigerian NIN verification (Smile Identity)
- Nigerian number format +234
- Pidgin English support in app copy

## Phase 4 — West Africa (Year 2+)

Markets: Ivory Coast, Senegal, Sierra Leone, Liberia
Requirements: French language support, local payment methods

---

# ═══════════════════════════════════════════
# PART 22 — ENVIRONMENT VARIABLES REFERENCE
# ═══════════════════════════════════════════

## Mobile App (.env) — Safe Variables Only

```
EXPO_PUBLIC_SUPABASE_URL                Supabase project URL
EXPO_PUBLIC_SUPABASE_ANON_KEY           Supabase anon/publishable key (NOT secret)
EXPO_PUBLIC_BACKEND_URL                 https://api.wiamapp.com
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME       Cloudinary cloud name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET    wiamapp_unsigned
EXPO_PUBLIC_APP_ENV                     development or production
EXPO_PUBLIC_DEFAULT_COUNTRY             Ghana
EXPO_PUBLIC_DEFAULT_CURRENCY            GHS
```

## Backend Server (Render Only) — Secret Variables

```
SUPABASE_URL                            Supabase project URL
SUPABASE_SECRET_KEY                     Service role key — bypasses RLS
CLOUDFLARE_R2_ENDPOINT                  R2 S3 endpoint URL
CLOUDFLARE_R2_ACCESS_KEY_ID             R2 access key
CLOUDFLARE_R2_SECRET_ACCESS_KEY         R2 secret key
CLOUDFLARE_R2_BUCKET_NAME               wiamapp
CLOUDFLARE_R2_PUBLIC_URL                Public CDN URL
RESEND_API_KEY                          Resend email key
PAYSTACK_SECRET_KEY                     Paystack secret key
SMILE_IDENTITY_PARTNER_ID               Add in Phase 2
SMILE_IDENTITY_API_KEY                  Add in Phase 2
SMILE_IDENTITY_ENV                      sandbox or production
NODE_ENV                                production
PORT                                    3000
```

---

# ═══════════════════════════════════════════
# PART 23 — DATABASE MIGRATION ORDER
# ═══════════════════════════════════════════

Always run migrations in this exact order.
Never skip. Never run out of order.

```
001_core_tables.sql
002_bookings_messages.sql
003_security_payments.sql
004_rls_policies.sql
005_security_functions.sql
006_mvp_verification_escrow.sql
007_customer_verification.sql         ← new (customer ID system)
008_worker_safety.sql                 ← new (SOS, check-in, customer ratings)
009_spotlight_system.sql              ← new (Spotlight posts and boosts)
010_business_profiles.sql             ← new (Starter/Growth/Enterprise)
categories_seed.sql                   ← run last, seeds all 12 categories
```

After every new feature: create a new numbered migration file.
NEVER modify an existing migration that has already been run in production.

---

# ═══════════════════════════════════════════
# QUICK REFERENCE CARD
# ═══════════════════════════════════════════

**Brand:** Navy #08081A | Gold #D4A017 | White #FFFFFF
**Stack:** Expo + Supabase + Cloudflare R2 + Resend + Paystack + Render
**Commissions:** Free=15% | Basic=10% | Pro=7% | Business=7-8%
**Badges:** Free=None | Basic=🔵Blue | Pro=🔵⭐Blue+Pro | Business=🟡Gold
**Customer verify:** First booking = full ID + selfie | Monthly = selfie only | Every 6mo = full
**Worker verify:** ID + selfie before appearing in search → manual admin review 24hr
**Phone numbers:** Hidden until booking accepted + payment made — BOTH SIDES
**Secret keys:** ONLY on Render, NEVER in app or GitHub
**Spotlight:** Basic+ workers and all businesses only, work content only
**Business tiers:** Starter (5 workers GHS250) | Growth (25 workers GHS500) | Enterprise (unlimited GHS1200)
**Safety:** Customer verify status visible to worker | Check-in GPS | SOS button | Live location sharing | Customer ratings
**Repo:** github.com/WiamLabs/WiamApp (Private)
**Total launch cost:** GHS 0/month

---

*Version: 2.0 FINAL*
*© 2026 WiamApp. Powered by WiamLabs. All rights reserved.*
*CONFIDENTIAL — Do not share outside WiamLabs.*

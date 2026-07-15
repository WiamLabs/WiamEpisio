# WiamApp Master Plan — Part 13: UI Design System (LOCKED)
**Status: FINAL — this design system is locked and must not be redesigned, restyled, or altered.**
**Prepared for:** Martin Wiafe, Founder & CEO, WiamLabs

---

## Purpose of This Document

This is an **addition** to the existing WIAMAPP_MASTER_PLAN, not a replacement. Every feature, database table, API endpoint, business rule, commission structure, and screen listed in the original master plan (Parts 1–12) remains exactly as written. Nothing is removed. Nothing is changed.

What this document adds: the **exact visual design system** — colors, spacing, components, and structure — used consistently across every approved screen mockup. This is now the single source of truth for how WiamApp looks. Cursor must build the real, live, data-connected app using this design system exactly, with zero placeholders and zero improvisation on visuals.

**Rule for Cursor:** If a screen exists in the original master plan but wasn't yet mocked up in this design system, build it using these same colors, components, and patterns — do not invent a new style for it.

---

## 1. Brand Colors (Exact Values — Do Not Substitute)

| Token | Hex | Usage |
|---|---|---|
| Navy (base background) | `#08081A` | Main app background, all screens |
| Navy Card | `#12122A` | Cards, list rows, input fields |
| Navy Soft | `#161634` | Bottom nav bar, elevated surfaces |
| Navy Line | `#1E1E42` | Borders, dividers |
| Gold | `#D4A017` | Primary brand color — buttons, active states, highlights |
| Gold Dark | `#A07810` | Gradient partner for Gold (used in avatars, hero cards) |
| Text Dim | `#7D7D97` | Secondary text (roles, subtitles) |
| Text Faint | `#5A5A75` | Tertiary text (timestamps, inactive nav labels) |
| Success | `#22C55E` | Online status, completed states, positive transactions |
| Warning | `#F59E0B` | Pending states, verification-in-progress |
| Error | `#EF4444` | Destructive actions, SOS, sign out |
| Info | `#3B82F6` | Informational banners, urgent notices |

**Gradient pattern:** Gold elements (avatars, hero cards, primary buttons) use a 135° gradient from Gold to Gold Dark — never flat gold alone on large surfaces.

---

## 2. Typography

- **Font:** Inter (weights 400, 500, 600, 700, 800) via Google Fonts
- **Screen titles:** 17–20px, weight 700
- **Card titles / names:** 13.5–15px, weight 600–700
- **Body / descriptions:** 12–13px, weight 400, color Text Dim
- **Labels / captions:** 10–11.5px, weight 500–600, often uppercase with letter-spacing for section headers

---

## 3. Structure & Layout Rules

- **Phone frame:** 390px width standard, rounded 46px corners (mockup convention — real app uses full device screen)
- **Status bar spacer:** 44px reserved at top of every screen
- **Bottom nav bar:** 84px fixed height, `position: absolute` equivalent — **must never scroll with content**, on any screen, for any role
- **Fixed vs scrollable:** Headers and filter/category rows stay fixed at the top; all list/feed content scrolls beneath them
- **Card radius:** 18–24px border radius standard for all cards, rows, and containers
- **Spacing rhythm:** 20px horizontal screen padding standard; 8–14px gaps between stacked elements

---

## 4. Shared Component Patterns (Reuse These, Don't Reinvent)

- **Circular avatars:** Gold gradient background, navy initials text, used consistently for both workers and customers
- **Status pills:** Small rounded-full badges with soft background + colored text (e.g., Pending = warning colors, Accepted = info colors, Done = success colors)
- **Verified badge:** Separate small circular badge positioned beside the avatar (not overlapping it) — gold checkmark on navy
- **Online indicator:** Small green dot overlapping the bottom-right corner of the avatar itself
- **Menu rows (Settings/Profile style):** Icon in a soft gold tile + title + optional subtitle + chevron, grouped into labeled sections (uppercase, letter-spaced section headers)
- **Primary button:** Solid gold background, navy text, 14–16px border radius
- **Secondary/ghost button:** Navy Soft or transparent background with Navy Line border
- **Empty states:** Icon + real message, never just blank space
- **Progress trackers (booking flow):** Dot-and-line horizontal tracker showing Booked → Accepted → Paid → Done

---

## 5. Role-Based Differences (Design Stays Shared, Only This Differs)

- **Home screen:** Identical Spotlight feed and header for both Customer and Worker — only the Worker version adds the Availability card + stats grid scrolling above the feed, and category filter chips are Customer-only
- **Bottom navigation:** Customer = Home, Search, Bookings, Chat, Profile. Worker = Home, Jobs, Earnings, Chat, Profile
- **Everything else** (cards, colors, spacing, components) stays identical between roles

---

## 6. Payment Routing (Locked Business Rule — Do Not Mix These Up)

- **Booking/job payments** (real-world services): Paystack, as originally planned in Part 9–11
- **Worker Subscription plans** (Free/Basic/Pro — app-native benefits): must use native in-app purchase (RevenueCat/StoreKit/Play Billing), never Paystack — this is a compliance requirement, not a design choice, and does not change any pricing or commission numbers already defined in Part 12

---

## 6.5. AMENDMENT — Business Account Routing (Supersedes Part 8.5 / 3.4 of original plan)

**Decision:** Business Account management moves to the website (**WiamApp.com/business**), not the mobile app. This changes the original plan's `BusinessApplicationScreen` and `BusinessDashboardScreen` — those two full screens are **not built in-app**.

- **Full business account application, team management, bulk bookings, and advanced analytics** happen entirely on **WiamApp.com/business** — a separate web dashboard, not part of this Expo app
- **Inside WiamApp (mobile), business users only get one small, lightweight screen** — enough to promote their business, push Spotlight posts, and hire workers directly, without needing the full dashboard
- Everything else about the Gold Checkmark badge, verification requirements, and 8% commission rate from the original plan (Part 3.4–3.5) stays unchanged — only *where* the management happens changes, not the business rules themselves

## 7. Which Screens This Applies To

**This design system applies to every screen in the app** — every screen listed in the original Master Plan, whether or not a mockup was made for it. The mockups provided are reference examples only, not a target count to match.

Screens with a mockup provided (use the file directly as the visual reference):
Auth/Onboarding — kept as Martin's existing build, not redesigned: Splash, Onboarding, Login, Register, OTP Verify
Customer flow: Customer Home, Category, Search, Worker Profile Detail, Booking Form, Booking Confirm, Booking Success, Customer Bookings, Booking Detail, Payment, Payment Success, Review, Customer Profile, Customer Profile Edit, Saved Addresses, Payment Methods
Worker flow: Worker Home, Worker Jobs, Job Detail, Worker Profile, Worker Profile Edit, Earnings, Availability, Portfolio Manager, Skills & Categories, My Rankings, Safety & SOS, Spotlight Post Create, Upgrade Plan, Business Hub
Shared: Chat List, Chat Conversation, Settings, Notifications

Screens with no mockup provided: build them using this exact same design system (colors, components, spacing, structure from Sections 1–5) — do not invent a different look for them just because no mockup exists.

**Do not build the following, even though they appear in the original Master Plan** — these were deliberately removed or changed by later decision:
- The original `BusinessApplicationScreen` and `BusinessDashboardScreen` — replaced by the Business Hub mockup + WiamApp.com/business (see Amendment 6.5)
- Any Admin-facing screens — explicitly excluded from this app
- Any Celebrity/Musician tier screens — do not build until Martin provides that specification separately; do not guess at what it should look like

Verification flow screens are part of Martin's existing build already and are not part of this redesign.

---

## 8. Handoff Package — What Cursor Receives

1. **WIAMAPP_MASTER_PLAN.md / .txt (Parts 1–12)** — original features, database schema, API endpoints, business rules, commission structure. Unchanged, fully in effect.
2. **This document (Part 13)** — locked design system + Business Account amendment + Star Pro correction
3. **WiamApp-UI-Build-Handoff-Spec.md** — screen-by-screen real data wiring: exact API endpoint, exact database fields, exact navigation trigger for every screen, plus the Paystack-vs-native-IAP payment routing rule
4. **HTML mockup files** — visual reference only, rebuild as real Expo/React Native components per the Handoff Spec. These are examples of the style, not a checklist to limit the build to.

**Build order recommendation for Cursor:** Auth (already exists) → Customer Home + Worker Home → Search/Category → Worker Profile Detail → Booking Form → Confirm → Success → Payment → Payment Success → Bookings/Jobs lists → Booking/Job Detail → Review → Chat → Profiles + Edit screens → Settings → remaining worker tools (Earnings, Availability, Portfolio, Rankings, Skills, Safety) → Business Hub → Upgrade Plan → then any remaining screen from the Master Plan with no mockup, built in this same style.

---

## Instruction for Cursor

Build the real WiamApp now. Use this design system exactly as documented — colors, components, spacing, structure. Do not restyle, do not modernize further, do not introduce a different visual direction. Combine this with every feature, database table, API route, and business rule from WIAMAPP_MASTER_PLAN Parts 1–12 — those remain fully in effect and unchanged. Where a planned feature has no matching mockup yet, extend this same design system to it rather than improvising a new look. No placeholder text, no fake data, no unfinished screens — every field connects to a real data source per the UI Build Handoff Spec.

---

*Prepared by WiaM, Executive Manager to Martin Wiafe — WiamLabs*

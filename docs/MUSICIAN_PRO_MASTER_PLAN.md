# WiamApp Musician Pro — Master Plan
### © 2026 WiamApp. Powered by WiamLabs
### Vertical: Music & Live Performance booking toolkit

> Single source of truth for the Musician Pro product.
> Core WiamApp stays a service marketplace. Musician Pro adds artist-specific tools on top.

---

## 1. Vision

Musicians keep Instagram / Facebook / TikTok for fans.
They put **professional booking** on WiamApp because the toolkit beats WhatsApp:

- Packages with clear prices
- Mandatory deposit in escrow
- Calendar + blackout dates (no double-booking)
- Digital tech rider + booking terms
- Shareable public page for bios: `wiamapp.com/m/{handle}`

Phone / gadget **sellers** are **not** part of WiamApp — that belongs to WiamTrade later.
Phone **repairers** remain a normal service category on WiamApp.

---

## 2. Personas

| Role | Goal |
|------|------|
| Artist (worker) | Get paid gigs without chase, look professional, block busy nights |
| Booker (customer) | Book a singer/band for wedding/church/corporate with deposit + clear package |
| WiamLabs | Commission on paid gigs + optional Musician Pro subscription for tools |

---

## 3. Product surfaces

### 3.1 Public artist page — `/m/{handle}`

- Stage name, photo, city, genres, short bio
- Packages list (title, duration, price, deposit %)
- Availability badge (open / limited / fully booked month)
- Primary CTA: **Book this artist**
- Shareable URL for Instagram bio

### 3.2 Artist tools (mobile — worker)

- Claim / edit handle + stage name + genres + rider fields
- Create / edit / archive packages
- Availability calendar (reuse core) + **blackout dates**
- View pending gig requests

### 3.3 Booking wizard (mobile — customer)

1. Choose package  
2. Pick date / time  
3. Venue type + guest count + address  
4. Accept tech rider summary  
5. Pay **deposit** via Paystack escrow  
6. Balance due rules (at/before show — configured per package)

### 3.4 Trust & money

- Same identity verification as other workers
- Deposit held in escrow until gig confirmed / dispute window
- Standard marketplace commission on completed gigs
- **Musician Pro subscription** (tools): public page + unlimited packages + blackouts; commission still applies on paid gigs

---

## 4. Data model

```
artist_profiles
  id, worker_profile_id UNIQUE, handle UNIQUE, stage_name,
  genres TEXT[], bio, epk_url, rider_json JSONB,
  band_size INT, city, is_public BOOLEAN, created_at, updated_at

artist_packages
  id, artist_id FK, title, description, duration_min,
  price NUMERIC, currency, deposit_pct NUMERIC,
  overtime_rate NUMERIC, travel_fee_rules JSONB,
  is_active BOOLEAN, sort_order INT

artist_blackouts
  id, artist_id FK, start_date DATE, end_date DATE, reason TEXT

booking_artist_details
  booking_id PK/FK, artist_id, package_id,
  venue_type, guest_count, load_in_time,
  rider_accepted BOOLEAN, deposit_amount, balance_amount
```

Reuses: `users`, `worker_profiles`, `bookings`, `payments`, chat, disputes.

---

## 5. API (backend)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/artists/by-handle/:handle` | Public profile + packages |
| GET/PUT | `/api/artists/me` | Artist profile for logged-in worker |
| GET/POST/PATCH/DELETE | `/api/artists/me/packages` | Package CRUD |
| GET/POST/DELETE | `/api/artists/me/blackouts` | Blackout dates |
| POST | `/api/artists/book` | Create booking + artist details + deposit amount |

Payments continue through existing `/api/payments/paystack/initiate` with deposit amount.

---

## 6. Mobile screens

| Screen | Role |
|--------|------|
| `ArtistSetupScreen` | Handle, stage name, genres, rider |
| `ArtistPackagesScreen` | Manage packages |
| `ArtistBookingScreen` | Customer wizard from worker profile / public deep link |
| `AvailabilityCalendarScreen` | Extended with blackouts section |

Entry: Worker profile menu → **Musician Pro** (visible to Music & Live Performance workers; also reachable for any worker testing).

---

## 7. Monetization (locked default)

- **Subscription:** Musician Pro unlocks public page + packages + blackouts (align with existing Worker Pro / RevenueCat later; free during soft launch).
- **Commission:** Standard escrow commission on completed gigs (same as marketplace).

---

## 8. Soft launch

1. Accra invite-only artists (gospel, highlife, wedding singers)
2. Public pages live on marketing site
3. Collect feedback on deposit % and travel fees
4. Then mass marketing

---

## 9. Out of scope

- Social feeds, follows, DMs beyond booking chat
- Product catalogs / phone sales (WiamTrade)
- Streaming / music distribution

---

## 10. Implementation checklist

- [x] Categories: Music & Live Performance, Film & Talent, Phones & Gadgets Repair
- [x] `037_creators_repair_categories.sql` + `skills.js`
- [x] This document
- [x] `038_musician_pro.sql`
- [x] Backend `/api/artists`
- [x] Marketing `/m/[handle]`
- [x] Mobile Artist Setup / Packages / Booking
- [ ] Soft-launch cohort (ops)

© 2026 WiamApp. Powered by WiamLabs.

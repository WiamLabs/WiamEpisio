# WiamApp Star / Talent Pro — Master Plan
### © 2026 WiamApp. Powered by WiamLabs
### Vertical: Bookable stars, creators & professionals — worldwide

> Formerly drafted as “Musician Pro”. That was the first wedge.
> **Product truth:** any superstar or bookable talent — musicians, actors, actresses,
> directors (appearances & hire), comedians, dancers, influencers, athletes,
> speakers, models, DJs, MCs — uses the same toolkit.

WiamApp is a **global** skilled-worker & talent marketplace (not Ghana-only).
Country-specific ID checks (e.g. Ghana Card) remain local trust rails where required;
categories, packages, escrow, and public pages are world-ready.

---

## 1. Vision

Stars keep Instagram / TikTok / Facebook for fans.
They put **professional booking** on WiamApp because it beats WhatsApp:

- Packages with clear prices (appearance, performance, day-rate, endorsement)
- Mandatory deposit in escrow
- Calendar + blackout dates (no double-booking)
- Digital rider / call sheet / hospitality terms
- Shareable public page: `wiamapp.com/m/{handle}`

Core WiamApp = book **services** (trades, care, repair, creative crew, etc.).
Star Pro = booking toolkit for **high-demand talent / celebrities**.
Product **sellers** → WiamTrade later (not WiamApp).

---

## 2. Who Star Pro is for

| Talent type | Examples of bookable work |
|-------------|---------------------------|
| Musician / band / DJ | Weddings, concerts, corporate, church |
| Actor / actress | Events, brand shoots, cameos, theatre |
| Film / TV director | Panels, workshops, hire for productions |
| Influencer / creator | Appearances, launches, brand days |
| Comedian / speaker | Shows, conferences, MC work |
| Dancer / choreographer | Tours, videos, events |
| Athlete / coach-star | Appearances, camps, endorsements |
| Model / host / presenter | Runways, launches, live hosting |
| Specialty act | Magician, circus, cultural troupe |

Same backend tables (`artist_profiles`, packages, blackouts). Field `talent_type` distinguishes them.

---

## 3. Product surfaces

### 3.1 Public page — `/m/{handle}`
Stage/public name, photo, city (anywhere), tags, bio, packages, **Book** CTA.

### 3.2 Talent tools (mobile)
Handle, stage name, **talent type**, tags, rider/hospitality, packages, blackouts.

### 3.3 Booking wizard
Package → date → venue/guest count → accept rider → Paystack deposit → balance rules.

### 3.4 Money & trust
Escrow deposits, marketplace commission, optional Star Pro subscription for tools.
Identity verification follows local law per country.

---

## 4. Data model (additions)

```
artist_profiles.talent_type  -- musician | actor | director | influencer |
                             -- comedian | dancer | athlete | speaker |
                             -- model | dj | host | specialty | other
genres TEXT[]                -- tags (genres, specialties, niches)
currency on packages         -- multi-currency ready (USD, GHS, NGN, EUR, …)
```

---

## 5. Soft launch (global)

1. Invite talent in any city who already book via WhatsApp  
2. Public pages on marketing site  
3. Tune deposit % / travel rules  
4. Scale marketing by country

---

## 6. Out of scope

- Social feeds / follows  
- Product catalogs (WiamTrade)  
- Music/streaming distribution  
- Replacing talent agencies (we complement them)

---

## 7. Checklist

- [x] Music, Film/TV talent, actors (+ directors/crew in skills)
- [x] Artist tables + `/api/artists` + `/m/{handle}`
- [x] Mobile setup / packages / booking
- [x] Reframe to Star / Talent Pro (all celebrities)
- [x] Global category expansion (world booking services)
- [ ] Multi-currency Paystack / local rails per country (ops)
- [ ] Soft-launch cohorts (ops)

© 2026 WiamApp. Powered by WiamLabs.

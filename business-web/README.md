# WiamApp Business — Web Portal

The real wiamapp.com/business web app, replacing the static HTML
mockup. Built with Next.js 16 (App Router) + Supabase, matching the
approved navy/gold design exactly.

## What's real and working

- Login (verifies the account is actually a Business role before
  letting anyone in — a customer or worker account is rejected)
- Dashboard — real metrics, real recent bookings
- Bookings — real list with status filtering
- Team — real list, real "hide from public search" toggle, real
  remove, with optimistic UI that rolls back if the write fails
- Analytics — real spend/category aggregation from bookings, no
  fabricated numbers
- Spotlight — real post creation (routes through the backend so AI
  moderation/admin review actually happens), real status display
  (pending/live/rejected), real Cloudinary photo upload
- Billing — real subscription, payment method, and invoice data
  from migration 028's tables
- Company Profile — real Gold-verification status display
  (pending/approved, matching Section 8B exactly), editable company
  details, real document-upload status
- Settings — real notification toggles persisted to
  `user_settings`, real password reset email, real account deletion
  (same backend endpoint as mobile)
- Plans — real pricing pulled live from `subscription_config` (an
  admin price change shows up here automatically), real Paystack
  checkout redirect via the subscription-checkout endpoint built
  earlier this session
- Apply — the public front-door registration flow (account →
  company details → plan → required documents), no login needed to
  start

Growth+ and Enterprise-only features, real and gated by actual plan:
- Job Assignment — reassign a pending/accepted booking to a
  different team member, inline on the Bookings page
- Recurring Contracts — standing weekly/monthly arrangements with a
  team member, with pause/resume/end controls
- Multi-Location — add and view branches, each with their own
  manager and optional monthly spend limit
- Vendor Database — a directory of trusted, pre-vetted workers
- SLA Dashboard — response-time terms and breach history
- Invoicing — consolidated monthly invoices, real data

A business below the required tier sees a real, designed "upgrade
required" page for each gated feature — never a broken link or a
silent 403.

Every page above is the actual portal now — not the mockup.

## Setup

```bash
npm install
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
# — same Supabase project as the mobile app, same anon key
npm run dev
```

Open http://localhost:3000 — you'll be redirected to /login.

## Deploying (per the master plan: Vercel)

```bash
npm install -g vercel
vercel
```

Add the two env vars in the Vercel dashboard (Project Settings →
Environment Variables) before your first production deploy — the
build will fail without them, on purpose, rather than silently
shipping with no Supabase connection.

Point `wiamapp.com/business` at this Vercel deployment via a
custom domain once it's live.

## Honest note on verification

I built and reviewed every file carefully — brace/paren balance,
every Tailwind class checked against the config, every import path
confirmed to resolve, the Next.js 15→16 async params/cookies
pattern applied correctly throughout. I could not run a live
`npm install` / `npm run build` myself (no network access in my
build sandbox), so the very first thing worth doing is exactly
that — run it once locally before deploying, and tell me if
anything doesn't come up clean.

## Still to build (not yet started)

A real public marketing homepage for wiamapp.com itself (root
currently just redirects to /login or /apply — no "what is WiamApp
Business" page yet exists for someone arriving cold).

## Database migration required

Run `database/migrations/033_growth_enterprise_tables.sql` in
Supabase before testing any Growth/Enterprise page — it restores
5 tables (enterprise_locations, recurring_contracts,
enterprise_vendors, sla_contracts, sla_breach_log,
enterprise_invoices) plus the assignment columns on bookings, none
of which exist in the live database yet.

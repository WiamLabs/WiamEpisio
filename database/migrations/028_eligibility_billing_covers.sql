-- ============================================================
-- WIAMAPP MIGRATION 028 — Eligibility Score, Manual Gold Badge,
-- Real Billing (Subscriptions/Payment Methods/Invoices), Cover
-- Photos, Dispute Tracking, Chat Moderation Log
-- © 2026 WiamApp. Powered by WiamLabs
--
-- Run after WIAMAPP_DATABASE_SETUP_V4.sql (this is purely additive
-- — ALTER TABLE / CREATE TABLE IF NOT EXISTS only, nothing here
-- drops or rewrites anything that already exists live).
--
-- Implements Master Plan V4 FINAL: Section 4B (Eligibility Score),
-- Section 5C (Real Billing), Section 8B (Manual Gold Control),
-- Section 21B (cover photo + dispute-free rate input).
--
-- HOW TO RUN: supabase.com → your project → SQL Editor → New
-- query → paste this entire file → Run.
-- ============================================================

-- ============================================================
-- PART 1 — FIX worker_profiles.subscription_tier TIER NAMES
-- ============================================================
-- The live constraint currently allows ('free','starter','gold',
-- 'platinum') — wrong vocabulary, inherited from an earlier draft.
-- The actual plan (Section 4/5) uses 'free','basic','pro' for
-- INDIVIDUAL workers. 'gold' on a worker tier is especially wrong
-- because Gold is reserved exclusively for Business Accounts
-- (Section 8B) — having it also appear as a worker tier name would
-- be confusing even though it's a different column entirely.

-- One-time safe data fix in case any test rows already used the
-- old values (no-op on a fresh/empty table):
UPDATE worker_profiles SET subscription_tier = 'basic' WHERE subscription_tier IN ('starter','gold');
UPDATE worker_profiles SET subscription_tier = 'pro'   WHERE subscription_tier = 'platinum';

ALTER TABLE worker_profiles DROP CONSTRAINT IF EXISTS worker_profiles_subscription_tier_check;
ALTER TABLE worker_profiles ADD CONSTRAINT worker_profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free','basic','pro'));

-- ============================================================
-- PART 2 — ELIGIBILITY SCORE FIELDS (Section 4B)
-- ============================================================
-- verified_badge already exists live and is already correctly
-- separated from is_verified — no change needed to that column,
-- it just needs to actually be driven by the formula below instead
-- of sitting unused.

ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS eligibility_score     DECIMAL(5,2) DEFAULT 0;
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS badge_last_calculated TIMESTAMPTZ;
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS badge_threshold_used  VARCHAR(10);
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS account_suspended_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_worker_eligibility ON worker_profiles(eligibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_worker_badge       ON worker_profiles(verified_badge);

-- ============================================================
-- PART 3 — MANUAL GOLD BADGE CONTROL FOR BUSINESSES (Section 8B)
-- ============================================================
-- Written against the LIVE business_profiles shape from
-- WIAMAPP_DATABASE_SETUP_V4.sql: (id, user_id, company_name,
-- industry, plan, is_verified, created_at, updated_at).
-- Do NOT assume owner_id, registration_number, or banner_url exist
-- — those belong to an older, unused draft schema and are NOT
-- what is actually live in Supabase right now.

ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS business_verified_gold BOOLEAN DEFAULT FALSE;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS gold_reviewed_by       UUID REFERENCES users(id);
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS gold_reviewed_at       TIMESTAMPTZ;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS gold_revoked_reason    TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS registration_doc_url   TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS tin_doc_url            TEXT;

CREATE INDEX IF NOT EXISTS idx_business_gold ON business_profiles(business_verified_gold);

-- ============================================================
-- PART 4 — COVER / BANNER PHOTOS (Section 21B)
-- ============================================================
ALTER TABLE users             ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- ============================================================
-- PART 5 — DISPUTE TRACKING ON bookings (needed for Section 4B's
-- "dispute-free rate" input, and Section 5B's strike system)
-- ============================================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_disputed       BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dispute_reason    TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dispute_filed_by  UUID REFERENCES users(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dispute_filed_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_disputed ON bookings(is_disputed);

-- ============================================================
-- PART 6 — REAL SUBSCRIPTIONS TABLE (Section 5/5C)
-- ============================================================
-- Did not exist anywhere live before this migration. Tracks the
-- billing relationship itself, separate from worker_profiles.
-- subscription_tier / business_profiles.plan, which describe WHAT
-- plan a user is on. This table describes HOW and WHEN they are
-- billed for it.

CREATE TABLE IF NOT EXISTS subscriptions (
  id                 UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_type       VARCHAR(10) NOT NULL CHECK (account_type IN ('worker','business')),
  plan_key           VARCHAR(20) NOT NULL,  -- 'basic','pro','starter','growth','enterprise'
  billing_source     VARCHAR(10) NOT NULL DEFAULT 'app'
                       CHECK (billing_source IN ('app','web')),  -- 'app' = RevenueCat/Apple/Google, 'web' = Paystack
  status             VARCHAR(20) NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','past_due','cancelled')),
  amount_usd         DECIMAL(10,2) NOT NULL,
  started_at         TIMESTAMPTZ DEFAULT NOW(),
  next_billing_date  DATE,
  cancelled_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user      ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing   ON subscriptions(billing_source, next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status    ON subscriptions(status);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_read_own"
  ON subscriptions FOR SELECT USING (auth.uid() = user_id);
-- No client INSERT/UPDATE/DELETE policy. RevenueCat webhooks and
-- the Paystack billing cron both write through the backend's
-- service_role key only, exactly like otp_codes in Section 19.

-- ============================================================
-- PART 7 — PAYMENT METHODS (Section 5C — card-on-file, website billing only)
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_methods (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paystack_auth_code  TEXT NOT NULL,   -- Paystack's reusable token. The raw card never touches WiamApp.
  card_brand          VARCHAR(20),
  card_last4          VARCHAR(4),
  card_exp_month      VARCHAR(2),
  card_exp_year       VARCHAR(4),
  is_default          BOOLEAN DEFAULT TRUE,
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id, is_active);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_methods_read_own"
  ON payment_methods FOR SELECT USING (auth.uid() = user_id);
-- No client INSERT/UPDATE/DELETE — backend service_role only,
-- since adding a card always goes through Paystack's hosted
-- authorization flow on the backend, never a direct client write.

-- ============================================================
-- PART 8 — SUBSCRIPTION INVOICES (Section 5C)
-- ============================================================
-- Named subscription_invoices, NOT "invoices", to avoid any
-- confusion with the already-existing enterprise_invoices table
-- (migration 023), which is a different concept entirely —
-- enterprise_invoices bills an Enterprise business for the JOB
-- VOLUME their team completed; subscription_invoices bills any
-- paid account (worker or business) for their own WiamApp
-- subscription fee.

CREATE TABLE IF NOT EXISTS subscription_invoices (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id       UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount_usd            DECIMAL(10,2) NOT NULL,
  currency_billed       VARCHAR(3) DEFAULT 'GHS',
  status                VARCHAR(20) NOT NULL CHECK (status IN ('paid','failed','refunded')),
  paystack_ref          TEXT,
  plan_name             VARCHAR(50),
  billing_period_start  DATE,
  billing_period_end    DATE,
  pdf_url               TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_invoices_user ON subscription_invoices(user_id, created_at DESC);

ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_invoices_read_own"
  ON subscription_invoices FOR SELECT USING (auth.uid() = user_id);
-- Backend service_role writes only — same pattern as payment_methods.

-- ============================================================
-- PART 9 — CHAT MODERATION LOG (Section 5B — specced but never built)
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_moderation_log (
  id                 UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id         UUID REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  original_text      TEXT NOT NULL,
  violation_type     VARCHAR(30),
  confidence         DECIMAL(3,2),
  was_blocked        BOOLEAN DEFAULT TRUE,
  reviewed_by_human  BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_mod_sender ON chat_moderation_log(sender_id, created_at DESC);

ALTER TABLE chat_moderation_log ENABLE ROW LEVEL SECURITY;
-- No client policies at all — backend service_role only. A user
-- should never be able to read their own moderation log entries
-- directly (that would teach them exactly what gets detected).

-- ============================================================
-- PART 10 — STRIKES TABLE (Section 5B's strike system needs a
-- home — was specced as "logged on WiamTrust Score" but needs its
-- own auditable record, not just a single number going up/down)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_strikes (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  strike_number   INT NOT NULL,             -- 1, 2, or 3 within the 90-day window
  reason          VARCHAR(50) NOT NULL,     -- e.g. 'chat_moderation_violation'
  moderation_log_id UUID REFERENCES chat_moderation_log(id),
  reviewed_by     UUID REFERENCES users(id), -- set when a human reviewer actioned strike 3
  resolution      VARCHAR(20),              -- 'dismissed','warning','suspension','ban'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strikes_user ON user_strikes(user_id, created_at DESC);

ALTER TABLE user_strikes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_strikes_read_own"
  ON user_strikes FOR SELECT USING (auth.uid() = user_id);
-- Backend service_role writes only.

-- ============================================================
-- ✅ DONE — Migration 028 applied
-- ============================================================

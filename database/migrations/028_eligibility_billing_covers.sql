-- ============================================================
-- WIAMAPP MIGRATION 028 — Eligibility Score, Manual Gold Badge,
-- Real Billing (Subscriptions/Payment Methods/Invoices), Cover
-- Photos, Dispute Tracking, Chat Moderation Log
-- © 2026 WiamApp. Powered by WiamLabs
--
-- Safe on DBs that already have the OLD subscriptions shape from
-- 003 (worker_id / plan) — evolves it to user_id / plan_key.
-- ============================================================

-- ============================================================
-- PART 1 — FIX worker_profiles.subscription_tier TIER NAMES
-- ============================================================
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'free';

UPDATE worker_profiles SET subscription_tier = 'basic' WHERE subscription_tier IN ('starter','gold');
UPDATE worker_profiles SET subscription_tier = 'pro'   WHERE subscription_tier = 'platinum';

ALTER TABLE worker_profiles DROP CONSTRAINT IF EXISTS worker_profiles_subscription_tier_check;
ALTER TABLE worker_profiles ADD CONSTRAINT worker_profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free','basic','pro'));

-- ============================================================
-- PART 2 — ELIGIBILITY SCORE FIELDS (Section 4B)
-- ============================================================
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS verified_badge        BOOLEAN DEFAULT FALSE;
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS eligibility_score     DECIMAL(5,2) DEFAULT 0;
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS badge_last_calculated TIMESTAMPTZ;
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS badge_threshold_used  VARCHAR(10);
ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS account_suspended_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_worker_eligibility ON worker_profiles(eligibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_worker_badge       ON worker_profiles(verified_badge);

-- ============================================================
-- PART 3 — MANUAL GOLD BADGE CONTROL FOR BUSINESSES (Section 8B)
-- ============================================================
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
-- PART 5 — DISPUTE TRACKING ON bookings
-- ============================================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_disputed       BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dispute_reason    TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dispute_filed_by  UUID REFERENCES users(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dispute_filed_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_disputed ON bookings(is_disputed);

-- ============================================================
-- PART 6 — REAL SUBSCRIPTIONS TABLE (Section 5/5C)
-- ============================================================
-- New installs get the modern shape. Existing DBs may already have
-- the legacy 003 table (worker_id, plan, is_active) — evolve it.

CREATE TABLE IF NOT EXISTS subscriptions (
  id                 UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id            UUID REFERENCES users(id) ON DELETE CASCADE,
  account_type       VARCHAR(10),
  plan_key           VARCHAR(20),
  billing_source     VARCHAR(10) DEFAULT 'app',
  status             VARCHAR(20) DEFAULT 'active',
  amount_usd         DECIMAL(10,2) DEFAULT 0,
  started_at         TIMESTAMPTZ DEFAULT NOW(),
  next_billing_date  DATE,
  cancelled_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Evolve legacy columns onto existing table (no-op if already modern)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_id            UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS account_type       VARCHAR(10);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_key           VARCHAR(20);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_source     VARCHAR(10) DEFAULT 'app';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status             VARCHAR(20) DEFAULT 'active';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS amount_usd         DECIMAL(10,2) DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS started_at         TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_billing_date  DATE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at       TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT NOW();

-- Keep legacy columns if present; backfill modern fields from them
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'worker_id'
  ) THEN
    UPDATE subscriptions s
    SET user_id = wp.user_id
    FROM worker_profiles wp
    WHERE s.user_id IS NULL AND s.worker_id = wp.id;

    UPDATE subscriptions
    SET account_type = COALESCE(account_type, 'worker')
    WHERE account_type IS NULL AND worker_id IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'plan'
  ) THEN
    UPDATE subscriptions
    SET plan_key = COALESCE(plan_key, plan)
    WHERE plan_key IS NULL AND plan IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'amount_paid'
  ) THEN
    UPDATE subscriptions
    SET amount_usd = COALESCE(amount_usd, amount_paid, 0)
    WHERE amount_usd IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'is_active'
  ) THEN
    UPDATE subscriptions
    SET status = CASE WHEN is_active THEN 'active' ELSE 'cancelled' END
    WHERE status IS NULL;
  END IF;
END $$;

UPDATE subscriptions SET amount_usd = COALESCE(amount_usd, 0) WHERE amount_usd IS NULL;
UPDATE subscriptions SET billing_source = COALESCE(billing_source, 'app');
UPDATE subscriptions SET status = COALESCE(status, 'active');
UPDATE subscriptions SET account_type = COALESCE(account_type, 'worker') WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user      ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing   ON subscriptions(billing_source, next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status    ON subscriptions(status);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_read_own" ON subscriptions;
CREATE POLICY "subscriptions_read_own"
  ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- PART 7 — PAYMENT METHODS (Section 5C)
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_methods (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paystack_auth_code  TEXT NOT NULL,
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

DROP POLICY IF EXISTS "payment_methods_read_own" ON payment_methods;
CREATE POLICY "payment_methods_read_own"
  ON payment_methods FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- PART 8 — SUBSCRIPTION INVOICES (Section 5C)
-- ============================================================
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

DROP POLICY IF EXISTS "subscription_invoices_read_own" ON subscription_invoices;
CREATE POLICY "subscription_invoices_read_own"
  ON subscription_invoices FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- PART 9 — CHAT MODERATION LOG (Section 5B)
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

-- ============================================================
-- PART 10 — STRIKES TABLE (Section 5B)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_strikes (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  strike_number   INT NOT NULL,
  reason          VARCHAR(50) NOT NULL,
  moderation_log_id UUID REFERENCES chat_moderation_log(id),
  reviewed_by     UUID REFERENCES users(id),
  resolution      VARCHAR(20),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strikes_user ON user_strikes(user_id, created_at DESC);

ALTER TABLE user_strikes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_strikes_read_own" ON user_strikes;
CREATE POLICY "user_strikes_read_own"
  ON user_strikes FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- ✅ DONE — Migration 028 applied
-- ============================================================

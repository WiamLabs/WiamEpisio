-- ============================================================
-- WIAMAPP MIGRATION 030 — Restore Quotes, Subscription Config,
-- Exchange Rates, Platform Earnings
-- © 2026 WiamApp. Powered by WiamLabs
--
-- WHY THIS IS NEEDED: QuoteRequestScreen, QuotesListScreen, and
-- backend/routes/quotes.js already call quote_requests and quotes
-- — neither table exists in the live database (dropped during the
-- V4 clean-slate rebuild). Same story for subscription_config
-- (admin PricingManagerScreen, Section 5's editable pricing),
-- exchange_rates (currency display conversion, Section 3/5), and
-- platform_earnings (admin CommissionReportScreen). All four are
-- grounded in the original, already-correct designs from
-- migrations/007_to_015.sql — restored here exactly, with one real
-- gap closed: the original RLS never let a customer read the
-- quotes submitted on their OWN request (only "I own the request"
-- and "I own the quote as the worker" were covered).
-- ============================================================

-- ============================================================
-- PART 1 — QUOTE REQUESTS AND QUOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS quote_requests (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  category_id      UUID REFERENCES categories(id),
  title            VARCHAR(200),
  description      TEXT NOT NULL,
  photo_urls       TEXT[],
  location_address TEXT,
  preferred_date   TIMESTAMPTZ,
  budget_min_usd   DECIMAL(10,4),
  budget_max_usd   DECIMAL(10,4),
  status           VARCHAR(20) DEFAULT 'open'
    CHECK (status IN ('open','closed','cancelled')),
  expires_at       TIMESTAMPTZ,
  selected_quote_id UUID,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotes (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  request_id       UUID REFERENCES quote_requests(id) ON DELETE CASCADE,
  worker_id        UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  price_usd        DECIMAL(10,4) NOT NULL,
  timeline         TEXT,
  message          TEXT,
  availability     TEXT,
  status           VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','selected','rejected','expired')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_quotes_request ON quotes(request_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);

ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_requests_own"
  ON quote_requests FOR ALL USING (auth.uid() = customer_id);

CREATE POLICY "quote_requests_read_open"
  ON quote_requests FOR SELECT USING (status = 'open');

CREATE POLICY "quotes_worker_own"
  ON quotes FOR ALL USING (
    auth.uid() = (SELECT user_id FROM worker_profiles WHERE id = worker_id)
  );

-- GAP CLOSED: the original design never let a customer read the
-- quotes submitted against their own request. The backend's
-- service-role client bypasses RLS so this didn't block the
-- current routes, but leaving it missing would break any future
-- direct-Supabase read and is simply incorrect access control.
CREATE POLICY "quotes_customer_read_own_request"
  ON quotes FOR SELECT USING (
    auth.uid() = (SELECT customer_id FROM quote_requests WHERE id = request_id)
  );

-- ============================================================
-- PART 2 — SUBSCRIPTION CONFIG (editable pricing, Section 5)
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_config (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  plan_key        VARCHAR(50) UNIQUE NOT NULL,
  plan_name       VARCHAR(100) NOT NULL,
  price_usd       DECIMAL(10,4) NOT NULL,
  price_usd_web   DECIMAL(10,4) NOT NULL,
  commission_rate DECIMAL(5,4) NOT NULL,
  revenuecat_id   VARCHAR(200),
  max_workers     INT DEFAULT 1,
  is_active       BOOLEAN DEFAULT true,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_by      UUID REFERENCES users(id)
);

INSERT INTO subscription_config
  (plan_key, plan_name, price_usd, price_usd_web, commission_rate, revenuecat_id, max_workers)
VALUES
  ('free',        'Free Worker',       0.0000,  0.0000,  0.1500, NULL,                                     1),
  ('basic',       'Basic Worker',      2.5000,  2.0000,  0.1000, 'com.wiamlabs.wiamapp.basic_monthly',     1),
  ('pro',         'Pro Worker',        7.0000,  6.0000,  0.0700, 'com.wiamlabs.wiamapp.pro_monthly',       1),
  ('starter_biz', 'Starter Business', 22.0000, 20.0000,  0.0800, NULL,                                     5),
  ('growth_biz',  'Growth Business',  44.0000, 40.0000,  0.0800, NULL,                                    25),
  ('enterprise',  'Enterprise',       105.0000, 95.0000,  0.0700, NULL,                                  9999)
ON CONFLICT (plan_key) DO NOTHING;

INSERT INTO subscription_config
  (plan_key, plan_name, price_usd, price_usd_web, commission_rate, revenuecat_id)
VALUES
  ('boost_standard', 'Spotlight Standard (3 days)',  1.5000, 1.5000, 0, 'com.wiamlabs.wiamapp.spotlight_standard'),
  ('boost_featured', 'Spotlight Featured (7 days)',  3.0000, 3.0000, 0, 'com.wiamlabs.wiamapp.spotlight_featured'),
  ('boost_premium',  'Spotlight Premium (14 days)',  6.0000, 6.0000, 0, 'com.wiamlabs.wiamapp.spotlight_premium'),
  ('boost_business', 'Spotlight Business (30 days)', 13.0000, 13.0000, 0, 'com.wiamlabs.wiamapp.spotlight_business')
ON CONFLICT (plan_key) DO NOTHING;

ALTER TABLE subscription_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscription_config_read_all"
  ON subscription_config FOR SELECT USING (true);
-- Everyone can read current prices (needed to render
-- SubscriptionScreen/BusinessApplicationScreen). Only the backend
-- service role updates prices, driven by the admin
-- PricingManagerScreen — no client write policy.

-- ============================================================
-- PART 3 — EXCHANGE RATES CACHE (Section 3/5 currency display)
-- ============================================================
CREATE TABLE IF NOT EXISTS exchange_rates (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  base_currency VARCHAR(10) UNIQUE DEFAULT 'USD',
  rates         JSONB NOT NULL,
  fetched_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exchange_rates_read_all"
  ON exchange_rates FOR SELECT USING (true);

-- ============================================================
-- PART 4 — PLATFORM EARNINGS (admin CommissionReportScreen)
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_earnings (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id      UUID REFERENCES bookings(id),
  payment_id      UUID,
  earning_type    VARCHAR(30) CHECK (
    earning_type IN ('commission','subscription','spotlight_boost',
                     'emergency_fee','business_account')
  ),
  amount_usd      DECIMAL(10,4) NOT NULL,
  currency        VARCHAR(10),
  amount_local    DECIMAL(10,4),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_earnings_type ON platform_earnings(earning_type, created_at DESC);

ALTER TABLE platform_earnings ENABLE ROW LEVEL SECURITY;
-- No client policy at all — admin-only, read via the backend
-- service role through app.wiamlabs.com, never directly from a
-- user's phone.

-- ============================================================
-- PART 5 — subscriptions TABLE EXTRA COLUMNS (this table itself
-- was created fresh in migration 028; these extra tracking columns
-- come from the original design and are genuinely useful)
-- ============================================================
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS source VARCHAR(30)
  DEFAULT 'revenuecat' CHECK (source IN ('revenuecat','paystack','manual'));
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS revenuecat_product_id VARCHAR(200);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paystack_subscription_code VARCHAR(200);

-- ============================================================
-- ✅ DONE — Migration 030 applied
-- ============================================================

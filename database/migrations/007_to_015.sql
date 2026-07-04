-- ============================================================
-- WIAMAPP MIGRATION 007 — Customer Verification System
-- © 2026 WiamApp. Powered by WiamLabs
-- Run after 006
-- ============================================================

-- Store the user's country dialing/ISO code (sent by the app at registration)
ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code VARCHAR(10) DEFAULT 'GH';

-- Add customer verification columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  customer_verification_status VARCHAR(30) DEFAULT 'unverified'
  CHECK (customer_verification_status IN ('unverified','pending','verified','suspended'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id_type VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id_front_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id_back_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_selfie_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_last_selfie_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_next_full_verify_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20);

-- Customer verification review queue (separate from worker queue)
CREATE TABLE IF NOT EXISTS customer_document_reviews (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  id_type           VARCHAR(50) NOT NULL,
  id_front_key      TEXT NOT NULL,
  id_back_key       TEXT,
  selfie_key        TEXT NOT NULL,
  status            VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','more_info')),
  submitted_at      TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       UUID REFERENCES users(id),
  rejection_reason  TEXT,
  admin_notes       TEXT
);

CREATE INDEX IF NOT EXISTS idx_customer_doc_reviews_status ON customer_document_reviews(status);
CREATE INDEX IF NOT EXISTS idx_customer_doc_reviews_user ON customer_document_reviews(user_id);

-- Function: Auto-pause customer booking access if monthly selfie overdue
CREATE OR REPLACE FUNCTION check_customer_reverification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_last_selfie_at IS NOT NULL THEN
    -- If selfie is more than 35 days old (5 days grace past 30-day deadline)
    IF NOW() > NEW.customer_last_selfie_at + INTERVAL '35 days' THEN
      NEW.customer_verification_status = 'suspended';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- RLS for customer document reviews
ALTER TABLE customer_document_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_doc_review_own"
  ON customer_document_reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "customer_doc_review_insert"
  ON customer_document_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- WIAMAPP MIGRATION 008 — Worker Safety System
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================

-- Worker safety events (check-in, check-out, SOS)
CREATE TABLE IF NOT EXISTS worker_safety_events (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id     UUID REFERENCES bookings(id),
  event_type     VARCHAR(30) CHECK (
    event_type IN ('on_the_way','check_in','check_out','sos_worker',
                   'sos_customer','location_shared','location_stopped')
  ),
  latitude       DECIMAL(10,8),
  longitude      DECIMAL(11,8),
  location_name  TEXT,
  other_party_id UUID REFERENCES users(id),
  alert_sent_to  TEXT,
  resolved       BOOLEAN DEFAULT false,
  resolved_at    TIMESTAMPTZ,
  admin_notes    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_safety_events_user ON worker_safety_events(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_events_booking ON worker_safety_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_safety_events_type ON worker_safety_events(event_type);

-- Customer ratings by workers (private — only admins and workers can read)
CREATE TABLE IF NOT EXISTS customer_ratings (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id  UUID REFERENCES bookings(id) UNIQUE,
  worker_id   UUID REFERENCES worker_profiles(id),
  customer_id UUID REFERENCES users(id),
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_ratings_customer ON customer_ratings(customer_id);

-- Function: update customer average rating from workers
CREATE OR REPLACE FUNCTION update_customer_rating()
RETURNS TRIGGER AS $$
DECLARE avg_rating DECIMAL(3,2);
BEGIN
  SELECT ROUND(AVG(rating)::NUMERIC, 1) INTO avg_rating
  FROM customer_ratings
  WHERE customer_id = NEW.customer_id;

  -- Store in users table
  UPDATE users SET
    metadata = COALESCE(metadata, '{}'::JSONB) ||
      jsonb_build_object('worker_given_rating', avg_rating)
  WHERE id = NEW.customer_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER customer_rating_update
  AFTER INSERT ON customer_ratings
  FOR EACH ROW EXECUTE FUNCTION update_customer_rating();

-- Add metadata column to users for flexible extra data
ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- RLS
ALTER TABLE worker_safety_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "safety_events_own"
  ON worker_safety_events FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "customer_ratings_worker_insert"
  ON customer_ratings FOR INSERT WITH CHECK (
    auth.uid() = (SELECT user_id FROM worker_profiles WHERE id = worker_id)
  );


-- ============================================================
-- WIAMAPP MIGRATION 009 — Spotlight System
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================

CREATE TABLE IF NOT EXISTS spotlight_posts (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  author_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  worker_id        UUID REFERENCES worker_profiles(id),
  category_id      UUID REFERENCES categories(id),
  title            VARCHAR(200),
  description      TEXT,
  media_urls       TEXT[],
  post_type        VARCHAR(30) CHECK (
    post_type IN ('portfolio','promotion','announcement','availability','discount','before_after')
  ),
  status           VARCHAR(30) DEFAULT 'pending_review' CHECK (
    status IN ('pending_review','approved','rejected','removed')
  ),
  rejection_reason TEXT,
  is_boosted       BOOLEAN DEFAULT false,
  boost_type       VARCHAR(20) CHECK (
    boost_type IN ('standard','featured','premium','business')
  ),
  boost_expires_at TIMESTAMPTZ,
  boost_paid_usd   DECIMAL(10,4),
  views_count      INT DEFAULT 0,
  report_count     INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Spotlight reports from community
CREATE TABLE IF NOT EXISTS spotlight_reports (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id     UUID REFERENCES spotlight_posts(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES users(id),
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spotlight_author ON spotlight_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_spotlight_status ON spotlight_posts(status);
CREATE INDEX IF NOT EXISTS idx_spotlight_boosted ON spotlight_posts(is_boosted, boost_expires_at);

ALTER TABLE spotlight_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE spotlight_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved posts
CREATE POLICY "spotlight_read_approved"
  ON spotlight_posts FOR SELECT USING (status = 'approved');

-- Authors can see their own posts regardless of status
CREATE POLICY "spotlight_read_own"
  ON spotlight_posts FOR SELECT USING (auth.uid() = author_id);

-- Authors can create and update their own posts
CREATE POLICY "spotlight_manage_own"
  ON spotlight_posts FOR ALL USING (auth.uid() = author_id);

-- Anyone authenticated can report a post
CREATE POLICY "spotlight_report_authenticated"
  ON spotlight_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);


-- ============================================================
-- WIAMAPP MIGRATION 010 — Business Profiles
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================

CREATE TABLE IF NOT EXISTS business_profiles (
  id                       UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id                 UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  business_name            VARCHAR(200) NOT NULL,
  business_type            VARCHAR(100),
  registration_number      VARCHAR(100),
  tin_number               VARCHAR(100),
  business_address         TEXT,
  business_city            VARCHAR(100),
  business_country         VARCHAR(100) DEFAULT 'Ghana',
  website                  VARCHAR(200),
  logo_url                 TEXT,
  banner_url               TEXT,
  description              TEXT,
  owner_id_key             TEXT,
  registration_cert_key    TEXT,
  address_proof_key        TEXT,
  verification_status      VARCHAR(20) DEFAULT 'pending'
    CHECK (verification_status IN ('pending','approved','rejected')),
  rejection_reason         TEXT,
  reviewed_by              UUID REFERENCES users(id),
  approved_at              TIMESTAMPTZ,
  business_tier            VARCHAR(20)
    CHECK (business_tier IN ('starter','growth','enterprise')),
  tier_expires_at          TIMESTAMPTZ,
  tier_price_usd           DECIMAL(10,4),
  max_workers              INT DEFAULT 5,
  total_team_jobs          INT DEFAULT 0,
  average_team_rating      DECIMAL(3,2) DEFAULT 0.00,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Business team members (workers added under a business)
CREATE TABLE IF NOT EXISTS business_team_members (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id   UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  worker_id     UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  role          VARCHAR(50) DEFAULT 'worker',
  added_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_business_team_business ON business_team_members(business_id);
CREATE INDEX IF NOT EXISTS idx_business_team_worker ON business_team_members(worker_id);

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_profile_own"
  ON business_profiles FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "business_profile_read_approved"
  ON business_profiles FOR SELECT USING (verification_status = 'approved');


-- ============================================================
-- WIAMAPP MIGRATION 011 — WiamTrust Score System
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================

-- Trust scores for workers and customers
CREATE TABLE IF NOT EXISTS trust_scores (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  trust_score           DECIMAL(5,2) DEFAULT 0.00 CHECK (trust_score BETWEEN 0 AND 100),
  score_label           VARCHAR(20) DEFAULT 'Unrated'
    CHECK (score_label IN ('Unrated','Building','Trusted','Highly Trusted','Elite Trust')),
  total_jobs            INT DEFAULT 0,
  avg_rating            DECIMAL(3,2) DEFAULT 0.00,
  cancellation_rate     DECIMAL(5,4) DEFAULT 0.00,
  dispute_rate          DECIMAL(5,4) DEFAULT 0.00,
  response_rate         DECIMAL(5,4) DEFAULT 1.00,
  verification_level    INT DEFAULT 0,
  activity_consistency  DECIMAL(5,4) DEFAULT 0.00,
  last_calculated       TIMESTAMPTZ DEFAULT NOW(),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_scores_user ON trust_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_trust_scores_score ON trust_scores(trust_score DESC);

-- Function: calculate WiamTrust score for a worker
CREATE OR REPLACE FUNCTION calculate_trust_score(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_score DECIMAL := 0;
  v_total_jobs INT;
  v_avg_rating DECIMAL;
  v_cancellation_rate DECIMAL;
  v_dispute_rate DECIMAL;
  v_response_rate DECIMAL;
  v_verification_level INT;
  v_jobs_score DECIMAL;
  v_label VARCHAR;
BEGIN
  -- Get worker profile data
  SELECT
    total_jobs_done,
    average_rating,
    response_rate
  INTO v_total_jobs, v_avg_rating, v_response_rate
  FROM worker_profiles WHERE user_id = p_user_id;

  -- Calculate cancellation rate
  SELECT
    CASE WHEN COUNT(*) > 0
    THEN COUNT(*) FILTER (WHERE status = 'cancelled')::DECIMAL / COUNT(*)
    ELSE 0 END
  INTO v_cancellation_rate
  FROM bookings WHERE
    worker_id = (SELECT id FROM worker_profiles WHERE user_id = p_user_id);

  -- Calculate dispute rate
  SELECT
    CASE WHEN COUNT(*) > 0
    THEN COUNT(*) FILTER (WHERE status = 'disputed')::DECIMAL / COUNT(*)
    ELSE 0 END
  INTO v_dispute_rate
  FROM bookings WHERE
    worker_id = (SELECT id FROM worker_profiles WHERE user_id = p_user_id);

  -- Verification level (0=none, 1=email, 2=ID verified)
  SELECT
    CASE WHEN is_verified THEN 2 ELSE 1 END
  INTO v_verification_level
  FROM worker_profiles WHERE user_id = p_user_id;

  -- Calculate score components (weights total 100)
  -- Jobs component (25 points): logarithmic scale so not too dominant
  v_jobs_score := LEAST(25, COALESCE(v_total_jobs, 0) * 0.5);

  -- Rating component (20 points)
  v_score := v_score + v_jobs_score;
  v_score := v_score + (COALESCE(v_avg_rating, 0) / 5) * 20;

  -- Cancellation rate (15 points — lower is better)
  v_score := v_score + (1 - COALESCE(v_cancellation_rate, 0)) * 15;

  -- Dispute rate (15 points — lower is better)
  v_score := v_score + (1 - COALESCE(v_dispute_rate, 0)) * 15;

  -- Response rate (10 points)
  v_score := v_score + COALESCE(v_response_rate, 1) * 10;

  -- Verification level (10 points)
  v_score := v_score + (v_verification_level / 2.0) * 10;

  -- Cap at 100
  v_score := LEAST(100, ROUND(v_score::NUMERIC, 2));

  -- Assign label
  v_label := CASE
    WHEN v_score >= 95 THEN 'Elite Trust'
    WHEN v_score >= 90 THEN 'Highly Trusted'
    WHEN v_score >= 80 THEN 'Trusted'
    WHEN v_score >= 50 THEN 'Building'
    ELSE 'Unrated'
  END;

  -- Update trust_scores table
  INSERT INTO trust_scores (user_id, trust_score, score_label,
    total_jobs, avg_rating, cancellation_rate, dispute_rate,
    response_rate, verification_level, last_calculated)
  VALUES (p_user_id, v_score, v_label,
    COALESCE(v_total_jobs, 0), COALESCE(v_avg_rating, 0),
    COALESCE(v_cancellation_rate, 0), COALESCE(v_dispute_rate, 0),
    COALESCE(v_response_rate, 1), v_verification_level, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    trust_score = v_score,
    score_label = v_label,
    total_jobs = COALESCE(v_total_jobs, 0),
    avg_rating = COALESCE(v_avg_rating, 0),
    cancellation_rate = COALESCE(v_cancellation_rate, 0),
    dispute_rate = COALESCE(v_dispute_rate, 0),
    response_rate = COALESCE(v_response_rate, 1),
    last_calculated = NOW();

  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-recalculate after every review
CREATE OR REPLACE FUNCTION trigger_trust_recalculation()
RETURNS TRIGGER AS $$
DECLARE worker_user_id UUID;
BEGIN
  SELECT user_id INTO worker_user_id
  FROM worker_profiles WHERE id = NEW.worker_id;
  PERFORM calculate_trust_score(worker_user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalculate_trust_on_review
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION trigger_trust_recalculation();


-- ============================================================
-- WIAMAPP MIGRATION 012 — Emergency Mode
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================

-- Emergency job requests (different from standard bookings)
CREATE TABLE IF NOT EXISTS emergency_requests (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  category_id      UUID REFERENCES categories(id),
  description      TEXT NOT NULL,
  photo_urls       TEXT[],
  location_address TEXT NOT NULL,
  location_lat     DECIMAL(10,8),
  location_lng     DECIMAL(11,8),
  status           VARCHAR(30) DEFAULT 'open'
    CHECK (status IN ('open','accepted','expired','cancelled')),
  accepted_by      UUID REFERENCES worker_profiles(id),
  booking_id       UUID REFERENCES bookings(id),
  emergency_fee_pct DECIMAL(5,4) DEFAULT 0.20,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_status ON emergency_requests(status);
CREATE INDEX IF NOT EXISTS idx_emergency_category ON emergency_requests(category_id);

ALTER TABLE emergency_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emergency_own"
  ON emergency_requests FOR ALL USING (auth.uid() = customer_id);


-- ============================================================
-- WIAMAPP MIGRATION 013 — Instant Quote System
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================

-- Customer posts a job, workers submit quotes
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


-- ============================================================
-- WIAMAPP MIGRATION 014 — Subscription Config & RevenueCat
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================

-- All subscription prices stored here (editable from founder dashboard)
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

-- Seed subscription plans
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

-- Spotlight boost config
INSERT INTO subscription_config
  (plan_key, plan_name, price_usd, price_usd_web, commission_rate, revenuecat_id)
VALUES
  ('boost_standard', 'Spotlight Standard (3 days)',  1.5000, 1.5000, 0, 'com.wiamlabs.wiamapp.spotlight_standard'),
  ('boost_featured', 'Spotlight Featured (7 days)',  3.0000, 3.0000, 0, 'com.wiamlabs.wiamapp.spotlight_featured'),
  ('boost_premium',  'Spotlight Premium (14 days)',  6.0000, 6.0000, 0, 'com.wiamlabs.wiamapp.spotlight_premium'),
  ('boost_business', 'Spotlight Business (30 days)', 13.0000, 13.0000, 0, 'com.wiamlabs.wiamapp.spotlight_business')
ON CONFLICT (plan_key) DO NOTHING;

-- Exchange rates cache table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  base_currency VARCHAR(10) UNIQUE DEFAULT 'USD',
  rates         JSONB NOT NULL,
  fetched_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Add RevenueCat tracking to subscriptions table
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS source VARCHAR(30)
  DEFAULT 'revenuecat' CHECK (source IN ('revenuecat','paystack','manual'));
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS worker_user_id UUID REFERENCES users(id);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS revenuecat_product_id VARCHAR(200);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paystack_subscription_code VARCHAR(200);

-- Track platform earnings (commission)
CREATE TABLE IF NOT EXISTS platform_earnings (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id      UUID REFERENCES bookings(id),
  payment_id      UUID REFERENCES payments(id),
  earning_type    VARCHAR(30) CHECK (
    earning_type IN ('commission','subscription','spotlight_boost',
                     'emergency_fee','business_account')
  ),
  amount_usd      DECIMAL(10,4) NOT NULL,
  currency        VARCHAR(10),
  amount_local    DECIMAL(10,4),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_earnings_type ON platform_earnings(earning_type);
CREATE INDEX IF NOT EXISTS idx_earnings_date ON platform_earnings(created_at);


-- ============================================================
-- WIAMAPP MIGRATION 015 — Performance Rankings & Online Status
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================

-- Worker performance rankings (updated daily)
CREATE TABLE IF NOT EXISTS performance_rankings (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worker_id       UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES categories(id),
  city            VARCHAR(100),
  rank_type       VARCHAR(50) CHECK (
    rank_type IN ('top_rated','fastest_responder','most_jobs_month',
                  'highest_trust','most_repeat_customers')
  ),
  rank_position   INT NOT NULL,
  score           DECIMAL(10,4),
  calculated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(worker_id, category_id, rank_type)
);

CREATE INDEX IF NOT EXISTS idx_rankings_category ON performance_rankings(category_id, rank_type);

-- Online status tracking
CREATE TABLE IF NOT EXISTS user_online_status (
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  is_online      BOOLEAN DEFAULT false,
  last_seen_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Function to get online status label
CREATE OR REPLACE FUNCTION get_online_status(p_user_id UUID)
RETURNS VARCHAR AS $$
DECLARE last_seen TIMESTAMPTZ;
BEGIN
  SELECT last_seen_at INTO last_seen
  FROM user_online_status WHERE user_id = p_user_id;

  IF last_seen IS NULL THEN RETURN 'offline'; END IF;
  IF last_seen > NOW() - INTERVAL '5 minutes' THEN RETURN 'online'; END IF;
  IF last_seen > NOW() - INTERVAL '30 minutes' THEN RETURN 'recently'; END IF;
  RETURN 'offline';
END;
$$ LANGUAGE plpgsql;

-- Add online status to RLS
ALTER TABLE user_online_status ENABLE ROW LEVEL SECURITY;

-- Users can update their own status
CREATE POLICY "online_status_own"
  ON user_online_status FOR ALL USING (auth.uid() = user_id);

-- Anyone can read online status
CREATE POLICY "online_status_read_all"
  ON user_online_status FOR SELECT USING (true);

-- Add bookings.payment_status column
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS
  payment_status VARCHAR(20) DEFAULT 'unpaid'
  CHECK (payment_status IN ('unpaid','paid','refunded'));

-- Add bookings.worker_user_id for easier queries
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS worker_user_id UUID REFERENCES users(id);

-- Enable realtime for performance rankings and online status
ALTER PUBLICATION supabase_realtime ADD TABLE user_online_status;
ALTER PUBLICATION supabase_realtime ADD TABLE performance_rankings;

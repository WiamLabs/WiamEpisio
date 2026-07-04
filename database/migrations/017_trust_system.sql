-- ============================================================
-- WIAMAPP MIGRATION 017 — Trust and Follow System
-- © 2026 WiamApp. Powered by WiamLabs
-- Run after 016_team_members.sql
-- ============================================================

-- Worker trusts table
CREATE TABLE IF NOT EXISTS worker_trusts (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  worker_id   UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_worker_trusts_worker   ON worker_trusts(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_trusts_customer ON worker_trusts(customer_id);

-- Business follows table
CREATE TABLE IF NOT EXISTS business_follows (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_business_follows_business ON business_follows(business_id);
CREATE INDEX IF NOT EXISTS idx_business_follows_customer ON business_follows(customer_id);

-- Add trust_count and follow_count columns
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS trust_count INT DEFAULT 0;

ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS follow_count INT DEFAULT 0;

-- ─── RPC FUNCTIONS ───────────────────────────────────────────

-- Increment worker trust count
CREATE OR REPLACE FUNCTION increment_worker_trust(p_worker_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE worker_profiles
  SET trust_count = trust_count + 1
  WHERE id = p_worker_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement worker trust count
CREATE OR REPLACE FUNCTION decrement_worker_trust(p_worker_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE worker_profiles
  SET trust_count = GREATEST(0, trust_count - 1)
  WHERE id = p_worker_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment business follow count
CREATE OR REPLACE FUNCTION increment_business_follow(p_business_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE business_profiles
  SET follow_count = follow_count + 1
  WHERE id = p_business_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement business follow count
CREATE OR REPLACE FUNCTION decrement_business_follow(p_business_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE business_profiles
  SET follow_count = GREATEST(0, follow_count - 1)
  WHERE id = p_business_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment spotlight views
CREATE OR REPLACE FUNCTION increment_spotlight_views(post_ids UUID[])
RETURNS void AS $$
BEGIN
  UPDATE spotlight_posts
  SET views_count = views_count + 1
  WHERE id = ANY(post_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment spotlight report count
CREATE OR REPLACE FUNCTION increment_report_count(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE spotlight_posts
  SET report_count = report_count + 1
  WHERE id = post_id;

  -- Auto-hide if too many reports
  UPDATE spotlight_posts
  SET status = 'pending_review'
  WHERE id = post_id AND report_count >= 5 AND status = 'approved';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update WiamTrust score including trust_count factor
CREATE OR REPLACE FUNCTION calculate_trust_score(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_score              DECIMAL := 0;
  v_total_jobs         INT;
  v_avg_rating         DECIMAL;
  v_cancellation_rate  DECIMAL;
  v_dispute_rate       DECIMAL;
  v_response_rate      DECIMAL;
  v_verification_level INT;
  v_trust_count        INT;
  v_label              VARCHAR;
  v_worker_id          UUID;
BEGIN
  SELECT id INTO v_worker_id
  FROM worker_profiles WHERE user_id = p_user_id;

  IF v_worker_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT total_jobs_done, average_rating, response_rate, trust_count
  INTO v_total_jobs, v_avg_rating, v_response_rate, v_trust_count
  FROM worker_profiles WHERE id = v_worker_id;

  SELECT CASE WHEN COUNT(*) > 0
    THEN COUNT(*) FILTER (WHERE status = 'cancelled')::DECIMAL / COUNT(*) ELSE 0 END
  INTO v_cancellation_rate
  FROM bookings WHERE worker_id = v_worker_id;

  SELECT CASE WHEN COUNT(*) > 0
    THEN COUNT(*) FILTER (WHERE status = 'disputed')::DECIMAL / COUNT(*) ELSE 0 END
  INTO v_dispute_rate
  FROM bookings WHERE worker_id = v_worker_id;

  SELECT CASE WHEN is_verified THEN 2 ELSE 1 END
  INTO v_verification_level
  FROM worker_profiles WHERE id = v_worker_id;

  -- Score components
  -- Jobs (25 pts): logarithmic scale
  v_score := v_score + LEAST(25, COALESCE(v_total_jobs, 0) * 0.5);
  -- Rating (20 pts)
  v_score := v_score + (COALESCE(v_avg_rating, 0) / 5.0) * 20;
  -- Trust count (15 pts): logarithmic scale
  v_score := v_score + LEAST(15, COALESCE(v_trust_count, 0) * 0.3);
  -- Cancellation rate (15 pts)
  v_score := v_score + (1 - COALESCE(v_cancellation_rate, 0)) * 15;
  -- Dispute rate (10 pts)
  v_score := v_score + (1 - COALESCE(v_dispute_rate, 0)) * 10;
  -- Response rate (10 pts)
  v_score := v_score + COALESCE(v_response_rate, 1) * 10;
  -- Verification (5 pts)
  v_score := v_score + (v_verification_level / 2.0) * 5;

  v_score := LEAST(100, ROUND(v_score::NUMERIC, 2));

  v_label := CASE
    WHEN v_score >= 95 THEN 'Elite Trust'
    WHEN v_score >= 90 THEN 'Highly Trusted'
    WHEN v_score >= 80 THEN 'Trusted'
    WHEN v_score >= 50 THEN 'Building'
    ELSE 'Unrated'
  END;

  INSERT INTO trust_scores (
    user_id, trust_score, score_label,
    total_jobs, avg_rating, cancellation_rate,
    dispute_rate, response_rate, verification_level, last_calculated
  ) VALUES (
    p_user_id, v_score, v_label,
    COALESCE(v_total_jobs, 0), COALESCE(v_avg_rating, 0),
    COALESCE(v_cancellation_rate, 0), COALESCE(v_dispute_rate, 0),
    COALESCE(v_response_rate, 1), v_verification_level, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    trust_score = v_score, score_label = v_label,
    total_jobs = COALESCE(v_total_jobs, 0),
    avg_rating = COALESCE(v_avg_rating, 0),
    cancellation_rate = COALESCE(v_cancellation_rate, 0),
    dispute_rate = COALESCE(v_dispute_rate, 0),
    response_rate = COALESCE(v_response_rate, 1),
    last_calculated = NOW();

  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS for trust tables
ALTER TABLE worker_trusts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_follows ENABLE ROW LEVEL SECURITY;

-- Anyone can read trust counts (public info)
CREATE POLICY "worker_trusts_read_all"
  ON worker_trusts FOR SELECT USING (true);

-- Only verified customers can insert trusts
CREATE POLICY "worker_trusts_insert_customer"
  ON worker_trusts FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Customer can only delete their own trusts
CREATE POLICY "worker_trusts_delete_own"
  ON worker_trusts FOR DELETE
  USING (auth.uid() = customer_id);

-- Business follows
CREATE POLICY "business_follows_read_all"
  ON business_follows FOR SELECT USING (true);

CREATE POLICY "business_follows_insert_customer"
  ON business_follows FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "business_follows_delete_own"
  ON business_follows FOR DELETE
  USING (auth.uid() = customer_id);

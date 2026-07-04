-- ============================================================
-- WIAMAPP MIGRATION 018 — Enhanced Customer and Worker Profiles
-- © 2026 WiamApp. Powered by WiamLabs
-- Run after 017_trust_system.sql
-- ============================================================

-- Add push token to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMPTZ;

-- Add response time tracking to worker profiles
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS last_response_at TIMESTAMPTZ;

-- Add subscription fields to worker profiles
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS subscription_expires TIMESTAMPTZ;
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'free';
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS badge_type VARCHAR(30) DEFAULT 'none';

-- Add check_in columns to worker_profiles
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS check_in_lat  DECIMAL(10,8);
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS check_in_lng  DECIMAL(11,8);
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS check_in_at   TIMESTAMPTZ;

-- Worker availability calendar
CREATE TABLE IF NOT EXISTS worker_availability (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worker_id    UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  day_of_week  INT CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 6=Sat
  start_hour   INT CHECK (start_hour BETWEEN 0 AND 23),
  end_hour     INT CHECK (end_hour BETWEEN 1 AND 24),
  is_available BOOLEAN DEFAULT true,
  UNIQUE(worker_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_availability_worker ON worker_availability(worker_id);

-- Saved / favourite workers for customers
-- (this is handled via worker_trusts — Trust = Save)
-- No separate table needed — Trust serves as Saved Workers

-- Customer booking history summary
CREATE OR REPLACE VIEW customer_booking_summary AS
SELECT
  b.customer_id,
  COUNT(*) AS total_bookings,
  COUNT(*) FILTER (WHERE b.status = 'completed') AS completed_bookings,
  COUNT(*) FILTER (WHERE b.status = 'cancelled') AS cancelled_bookings,
  COUNT(*) FILTER (WHERE b.status = 'disputed')  AS disputed_bookings,
  SUM(p.amount) FILTER (WHERE p.payment_status = 'success') AS total_spent_usd
FROM bookings b
LEFT JOIN payments p ON p.booking_id = b.id
GROUP BY b.customer_id;

-- Worker booking history summary
CREATE OR REPLACE VIEW worker_booking_summary AS
SELECT
  wp.user_id,
  wp.id AS worker_profile_id,
  COUNT(*) AS total_bookings,
  COUNT(*) FILTER (WHERE b.status = 'completed') AS completed_jobs,
  COUNT(*) FILTER (WHERE b.status = 'cancelled') AS cancelled_jobs,
  COUNT(*) FILTER (WHERE b.status = 'disputed')  AS disputed_jobs,
  ROUND(AVG(r.rating)::NUMERIC, 2) AS avg_rating,
  SUM(
    (p.amount * (1 - COALESCE(sc.commission_rate, 0.15)))
  ) FILTER (WHERE p.payment_status = 'success') AS total_earned_usd
FROM worker_profiles wp
LEFT JOIN bookings b ON b.worker_id = wp.id
LEFT JOIN reviews r ON r.worker_id = wp.id
LEFT JOIN payments p ON p.booking_id = b.id
LEFT JOIN subscription_config sc ON sc.plan_key = wp.subscription_plan
GROUP BY wp.user_id, wp.id;

-- Add indices for performance
CREATE INDEX IF NOT EXISTS idx_bookings_customer_status
  ON bookings(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_worker_status
  ON bookings(worker_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_booking_status
  ON payments(booking_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_trust
  ON worker_profiles(trust_count DESC);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_subscription
  ON worker_profiles(subscription_plan, badge_type);

-- Enable realtime on trust tables
ALTER PUBLICATION supabase_realtime ADD TABLE worker_trusts;
ALTER PUBLICATION supabase_realtime ADD TABLE business_follows;

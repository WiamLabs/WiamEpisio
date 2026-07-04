-- ============================================================
-- WIAMAPP MIGRATION 035 — Referrals, Before/After Photos,
-- Dispute Resolution, Customer Trust Score, Profile Completion,
-- Scheduled Booking Confirmation, Repeat Booking Reminders
-- © 2026 WiamApp. Powered by WiamLabs
-- Run after 034_careers_page.sql
-- ============================================================

-- ─── 1. REFERRAL SYSTEM ────────────────────────────────────────
-- Every user gets a personal referral code. When someone signs up
-- using that code AND completes their first booking (customer) or
-- gets verified (worker), both sides get a reward.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(12) UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id);

CREATE TABLE IF NOT EXISTS referrals (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  referrer_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  referred_id      UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  referral_code    VARCHAR(12) NOT NULL,
  status           VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','qualified','rewarded','expired')),
  reward_type      VARCHAR(30), -- 'free_month_pro', 'badge', 'cash_credit'
  qualified_at     TIMESTAMPTZ,
  rewarded_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status   ON referrals(status);

-- Auto-generate a referral code for every user on insert
CREATE OR REPLACE FUNCTION generate_referral_code() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := UPPER(SUBSTRING(REPLACE(NEW.id::TEXT, '-', '') FOR 7));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_referral_code ON users;
CREATE TRIGGER trg_generate_referral_code
  BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION generate_referral_code();

-- Backfill existing users with a code
UPDATE users SET referral_code = UPPER(SUBSTRING(REPLACE(id::TEXT, '-', '') FOR 7))
WHERE referral_code IS NULL;

-- ─── 2. BEFORE / AFTER COMPLETION PHOTOS ───────────────────────

CREATE TABLE IF NOT EXISTS booking_photos (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id  UUID REFERENCES bookings(id) ON DELETE CASCADE,
  phase       VARCHAR(10) NOT NULL CHECK (phase IN ('before','after')),
  photo_url   TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_photos_booking ON booking_photos(booking_id);

-- ─── 3. DISPUTE RESOLUTION ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS disputes (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id      UUID REFERENCES bookings(id) ON DELETE CASCADE,
  raised_by       UUID REFERENCES users(id),
  reason          VARCHAR(50) NOT NULL, -- 'work_not_done','quality','no_show','payment','other'
  description     TEXT NOT NULL,
  evidence_urls   TEXT[] DEFAULT '{}',
  status          VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','under_review','resolved_customer','resolved_worker','resolved_split','dismissed')),
  admin_notes     TEXT,
  resolution_note TEXT,
  resolved_by     UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disputes_booking ON disputes(booking_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status  ON disputes(status);

-- Mark booking as 'disputed' automatically when a dispute is opened
CREATE OR REPLACE FUNCTION mark_booking_disputed() RETURNS TRIGGER AS $$
BEGIN
  UPDATE bookings SET status = 'disputed' WHERE id = NEW.booking_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mark_booking_disputed ON disputes;
CREATE TRIGGER trg_mark_booking_disputed
  AFTER INSERT ON disputes
  FOR EACH ROW EXECUTE FUNCTION mark_booking_disputed();

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending','accepted','rejected','in_progress','completed','cancelled','disputed'));

-- ─── 4. CUSTOMER TRUST SCORE (visible to workers before accepting) ──

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS customer_completed_bookings INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_cancelled_bookings INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_disputes_against   INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_trust_score         INT DEFAULT 70; -- 0-100, new customers start neutral

CREATE OR REPLACE FUNCTION recalculate_customer_trust_score(p_customer_id UUID) RETURNS VOID AS $$
DECLARE
  completed  INT;
  cancelled  INT;
  disputed   INT;
  score      INT;
BEGIN
  SELECT COUNT(*) FILTER (WHERE status = 'completed'),
         COUNT(*) FILTER (WHERE status = 'cancelled'),
         COUNT(*) FILTER (WHERE status = 'disputed')
    INTO completed, cancelled, disputed
    FROM bookings WHERE customer_id = p_customer_id;

  score := 70 + LEAST(completed * 3, 30) - LEAST(cancelled * 5, 25) - LEAST(disputed * 15, 45);
  score := GREATEST(0, LEAST(100, score));

  UPDATE users SET
    customer_completed_bookings = completed,
    customer_cancelled_bookings = cancelled,
    customer_disputes_against   = disputed,
    customer_trust_score        = score
  WHERE id = p_customer_id;
END;
$$ LANGUAGE plpgsql;

-- ─── 5. WORKER PROFILE COMPLETION (onboarding checklist) ───────

ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS profile_completion_percent INT DEFAULT 0;

CREATE OR REPLACE FUNCTION recalculate_profile_completion(p_worker_profile_id UUID) RETURNS VOID AS $$
DECLARE
  pct INT := 0;
  w RECORD;
  has_portfolio BOOLEAN;
  has_skill BOOLEAN;
BEGIN
  SELECT * INTO w FROM worker_profiles WHERE id = p_worker_profile_id;
  IF w IS NULL THEN RETURN; END IF;

  SELECT EXISTS(SELECT 1 FROM portfolio_images WHERE worker_id = p_worker_profile_id) INTO has_portfolio;
  SELECT EXISTS(SELECT 1 FROM worker_categories WHERE worker_id = p_worker_profile_id) INTO has_skill;

  IF w.bio IS NOT NULL AND LENGTH(w.bio) > 20 THEN pct := pct + 15; END IF;
  IF w.hourly_rate IS NOT NULL AND w.hourly_rate > 0 THEN pct := pct + 15; END IF;
  IF w.is_verified THEN pct := pct + 30; END IF;
  IF has_portfolio THEN pct := pct + 20; END IF;
  IF has_skill THEN pct := pct + 10; END IF;
  IF w.is_available IS NOT NULL THEN pct := pct + 10; END IF;

  UPDATE worker_profiles SET profile_completion_percent = pct WHERE id = p_worker_profile_id;
END;
$$ LANGUAGE plpgsql;

-- ─── 6. SCHEDULED / FUTURE BOOKINGS ─────────────────────────────
-- scheduled_date already exists on bookings (migration 002). This
-- adds explicit worker calendar-confirmation so a future date isn't
-- just "requested" but actually held on the worker's calendar.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS is_future_booking     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS worker_confirmed_slot  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reminder_24h_sent      BOOLEAN DEFAULT FALSE;

-- ─── 7. REPEAT BOOKING REMINDERS ────────────────────────────────

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS repeat_reminder_sent BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_bookings_repeat_reminder
  ON bookings(status, repeat_reminder_sent, updated_at);

-- Keep profile completion current automatically, no matter which
-- route touches these tables (mobile app writes some of these
-- directly via Supabase, not through the backend)
CREATE OR REPLACE FUNCTION trg_recalc_completion_from_profile() RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalculate_profile_completion(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_worker_profile_completion ON worker_profiles;
CREATE TRIGGER trg_worker_profile_completion
  AFTER INSERT OR UPDATE OF bio, hourly_rate, is_verified, is_available ON worker_profiles
  FOR EACH ROW EXECUTE FUNCTION trg_recalc_completion_from_profile();

CREATE OR REPLACE FUNCTION trg_recalc_completion_from_portfolio() RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalculate_profile_completion(COALESCE(NEW.worker_id, OLD.worker_id));
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_portfolio_completion ON portfolio_images;
CREATE TRIGGER trg_portfolio_completion
  AFTER INSERT OR DELETE ON portfolio_images
  FOR EACH ROW EXECUTE FUNCTION trg_recalc_completion_from_portfolio();

CREATE OR REPLACE FUNCTION trg_recalc_completion_from_category() RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalculate_profile_completion(COALESCE(NEW.worker_id, OLD.worker_id));
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_category_completion ON worker_categories;
CREATE TRIGGER trg_category_completion
  AFTER INSERT OR DELETE ON worker_categories
  FOR EACH ROW EXECUTE FUNCTION trg_recalc_completion_from_category();

-- Backfill completion for every existing worker right now
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM worker_profiles LOOP
    PERFORM recalculate_profile_completion(r.id);
  END LOOP;
END $$;

-- ─── DONE ────────────────────────────────────────────────────
-- Next: run 035, then restart the backend so the new routes
-- (referrals, disputes) and updated uploads/cron routes are live.

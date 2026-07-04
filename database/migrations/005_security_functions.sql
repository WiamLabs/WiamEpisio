-- ============================================================
-- WIAMAPP DATABASE MIGRATION 005
-- Security Functions, Triggers & Missing RLS Policies
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- Run AFTER migrations 001 - 004
-- ============================================================


-- ─── FUNCTION: Auto-block user after 3 failed verifications ──
CREATE OR REPLACE FUNCTION check_verification_failures()
RETURNS TRIGGER AS $$
DECLARE
  failure_count INT;
BEGIN
  -- Count consecutive failures for this user and type
  SELECT COUNT(*) INTO failure_count
  FROM verifications
  WHERE user_id = NEW.user_id
    AND verification_type = NEW.verification_type
    AND status = 'failed'
    AND created_at > NOW() - INTERVAL '24 hours';

  -- If 3 or more failures in 24 hours, flag the user
  IF failure_count >= 3 THEN
    UPDATE users
    SET is_active = FALSE
    WHERE id = NEW.user_id;

    -- Log the auto-block
    INSERT INTO audit_logs (user_id, action, metadata)
    VALUES (
      NEW.user_id,
      'account_auto_blocked',
      jsonb_build_object(
        'reason', 'Too many verification failures',
        'verification_type', NEW.verification_type,
        'failure_count', failure_count
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER verification_failure_check
  AFTER INSERT ON verifications
  FOR EACH ROW
  WHEN (NEW.status = 'failed')
  EXECUTE FUNCTION check_verification_failures();


-- ─── FUNCTION: Auto-update worker rating on new review ───────
CREATE OR REPLACE FUNCTION update_worker_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating DECIMAL(3,2);
  job_count INT;
BEGIN
  SELECT
    ROUND(AVG(rating)::NUMERIC, 1),
    COUNT(*)
  INTO avg_rating, job_count
  FROM reviews
  WHERE worker_id = NEW.worker_id;

  UPDATE worker_profiles
  SET
    average_rating = avg_rating,
    total_jobs_done = job_count,
    updated_at = NOW()
  WHERE id = NEW.worker_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER review_rating_update
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_worker_rating();


-- ─── FUNCTION: Prevent unverified workers from accepting jobs ─
CREATE OR REPLACE FUNCTION check_worker_verification()
RETURNS TRIGGER AS $$
DECLARE
  worker_user_id UUID;
  is_id_verified BOOLEAN;
  is_face_verified BOOLEAN;
BEGIN
  -- Only check when status changes to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Get the worker's user_id
    SELECT user_id INTO worker_user_id
    FROM worker_profiles
    WHERE id = NEW.worker_id;

    -- Check if ID document is verified
    SELECT EXISTS (
      SELECT 1 FROM verifications
      WHERE user_id = worker_user_id
        AND verification_type = 'id_document'
        AND status = 'passed'
    ) INTO is_id_verified;

    -- Check if face match is verified
    SELECT EXISTS (
      SELECT 1 FROM verifications
      WHERE user_id = worker_user_id
        AND verification_type = 'face_match'
        AND status = 'passed'
    ) INTO is_face_verified;

    -- Block if not fully verified
    IF NOT (is_id_verified AND is_face_verified) THEN
      RAISE EXCEPTION
        'Worker must complete identity verification before accepting bookings.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER booking_verification_guard
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_worker_verification();


-- ─── FUNCTION: Log booking status changes automatically ──────
CREATE OR REPLACE FUNCTION log_booking_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO audit_logs (user_id, action, metadata)
    VALUES (
      NEW.customer_id,
      'booking_status_changed',
      jsonb_build_object(
        'booking_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'worker_id', NEW.worker_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER booking_status_audit
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION log_booking_changes();


-- ─── FUNCTION: Prevent duplicate reviews ─────────────────────
CREATE OR REPLACE FUNCTION check_duplicate_review()
RETURNS TRIGGER AS $$
DECLARE
  existing_review UUID;
BEGIN
  SELECT id INTO existing_review
  FROM reviews
  WHERE booking_id = NEW.booking_id
    AND customer_id = NEW.customer_id;

  IF existing_review IS NOT NULL THEN
    RAISE EXCEPTION
      'You have already left a review for this booking.'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER prevent_duplicate_review
  BEFORE INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION check_duplicate_review();


-- ─── FUNCTION: Detect suspicious login patterns ──────────────
-- Flags if same user logs in from very different locations within 1 hour
CREATE OR REPLACE FUNCTION detect_suspicious_login()
RETURNS TRIGGER AS $$
DECLARE
  last_login RECORD;
  distance FLOAT;
BEGIN
  IF NEW.action = 'login' AND NEW.location_lat IS NOT NULL THEN
    -- Get the last login for this user
    SELECT location_lat, location_lng, created_at
    INTO last_login
    FROM audit_logs
    WHERE user_id = NEW.user_id
      AND action = 'login'
      AND created_at > NOW() - INTERVAL '1 hour'
      AND location_lat IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1;

    IF last_login IS NOT NULL THEN
      -- Simple distance estimate (degrees, not exact but fast)
      distance := SQRT(
        POWER(NEW.location_lat - last_login.location_lat, 2) +
        POWER(NEW.location_lng - last_login.location_lng, 2)
      );

      -- If more than ~2 degrees apart (~220km) within 1 hour — suspicious
      IF distance > 2.0 THEN
        INSERT INTO audit_logs (user_id, action, metadata)
        VALUES (
          NEW.user_id,
          'suspicious_login_detected',
          jsonb_build_object(
            'reason', 'Rapid location change',
            'distance_degrees', ROUND(distance::NUMERIC, 4),
            'risk', 'MEDIUM'
          )
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER suspicious_login_check
  AFTER INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION detect_suspicious_login();


-- ─── MISSING RLS — device_fingerprints ───────────────────────
ALTER TABLE device_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_fingerprints_own"
  ON device_fingerprints FOR ALL
  USING (auth.uid() = user_id);


-- ─── MISSING RLS — subscriptions ─────────────────────────────
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_own"
  ON subscriptions FOR SELECT
  USING (
    auth.uid() = (
      SELECT user_id FROM worker_profiles WHERE id = worker_id
    )
  );


-- ─── MISSING RLS — featured_workers ──────────────────────────
ALTER TABLE featured_workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "featured_workers_read_all"
  ON featured_workers FOR SELECT
  USING (is_active = TRUE);


-- ─── MISSING RLS — business_verifications ────────────────────
ALTER TABLE business_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_verifications_own"
  ON business_verifications FOR ALL
  USING (auth.uid() = user_id);


-- ─── APPEND-ONLY AUDIT LOG PROTECTION ────────────────────────
-- Nobody can UPDATE or DELETE audit logs — not even admins via app
-- Only the service role (server-side) can insert
CREATE POLICY "audit_logs_no_update"
  ON audit_logs FOR UPDATE
  USING (FALSE); -- blocks all updates

CREATE POLICY "audit_logs_no_delete"
  ON audit_logs FOR DELETE
  USING (FALSE); -- blocks all deletes


-- ─── VIEW: Admin fraud investigation view ────────────────────
-- Joins fraud report with booking, user, and verification data
-- Used by admin to get everything needed to trace a suspect
CREATE OR REPLACE VIEW admin_fraud_investigation AS
SELECT
  fr.id AS report_id,
  fr.fraud_type,
  fr.description,
  fr.status AS report_status,
  fr.created_at AS report_date,
  fr.police_report_number,

  -- Who filed the report
  reporter.full_name AS reported_by_name,
  reporter.email AS reported_by_email,
  reporter.phone AS reported_by_phone,

  -- Who was reported
  suspect.full_name AS suspect_name,
  suspect.email AS suspect_email,
  suspect.phone AS suspect_phone,
  suspect.city AS suspect_city,

  -- Their verified ID info
  v.document_type AS suspect_id_type,
  v.status AS suspect_id_verification_status,
  v.provider_ref AS smile_identity_job_id,

  -- The booking details
  b.id AS booking_id,
  b.description AS job_description,
  b.location_address AS job_location,
  b.scheduled_date,
  b.agreed_price,
  b.currency

FROM fraud_reports fr
LEFT JOIN users reporter ON reporter.id = fr.reported_by
LEFT JOIN users suspect ON suspect.id = fr.reported_user_id
LEFT JOIN verifications v ON v.user_id = fr.reported_user_id
  AND v.verification_type = 'id_document'
  AND v.status = 'passed'
LEFT JOIN bookings b ON b.id = fr.booking_id
ORDER BY fr.created_at DESC;

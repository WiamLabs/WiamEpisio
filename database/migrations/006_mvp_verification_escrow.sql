-- ============================================================
-- WIAMAPP DATABASE MIGRATION 006
-- MVP Verification + Escrow — Email OTP codes
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- Run AFTER 005_security_functions.sql and BEFORE 007_to_015.sql.
--
-- NOTE: The verification queue (customer_document_reviews) lives in
-- 007_to_015.sql, and the verifications/payments/escrow tables live in
-- 003_security_payments.sql. The only table this migration owns is the
-- email OTP store used by backend/routes/auth.js (send-otp / verify-otp).
-- ============================================================

-- Email OTP codes (6-digit, 10 minute expiry).
-- Written and read ONLY by the backend via the service role key.
CREATE TABLE IF NOT EXISTS otp_codes (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email      VARCHAR(255) NOT NULL,
  code       VARCHAR(6)   NOT NULL,
  used       BOOLEAN      DEFAULT FALSE,
  expires_at TIMESTAMPTZ  NOT NULL,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

-- Lookup used by verify-otp: email + code + used + expires_at
CREATE INDEX IF NOT EXISTS idx_otp_codes_lookup  ON otp_codes(email, code);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires ON otp_codes(expires_at);

-- ─── RLS ─────────────────────────────────────────────────────
-- OTP codes are sensitive. No client (anon or authenticated) may read
-- or write them. RLS is enabled with NO policies, so all direct client
-- access is denied. The backend uses the service role key, which
-- bypasses RLS, for the send-otp / verify-otp routes.
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

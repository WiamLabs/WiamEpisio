-- ============================================================
-- WIAMAPP MIGRATION 032 — Restore payments, audit_logs, fraud_reports
-- © 2026 WiamApp. Powered by WiamLabs
--
-- THIS IS THE MOST URGENT MIGRATION IN THE SET. backend/routes/
-- payments.js already writes to a `payments` table on every single
-- booking payment — and that table does not exist live. Every real
-- payment attempt against the actual database has been failing.
-- audit_logs is referenced by webhooks.js, business.js, emergency.js,
-- and others added this session — none of those writes have ever
-- succeeded either. fraud_reports backs the admin FraudReportsScreen.
-- All three were defined in the older migrations/003_security_
-- payments.sql but never carried into the V4 clean-slate rebuild.
-- ============================================================

-- ============================================================
-- PART 1 — payments
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id      UUID REFERENCES bookings(id) ON DELETE CASCADE,
  payer_id        UUID REFERENCES users(id),
  receiver_id     UUID REFERENCES users(id),
  amount          DECIMAL(10,2) NOT NULL,
  currency        VARCHAR(10) DEFAULT 'GHS',
  payment_method  VARCHAR(50) CHECK (
    payment_method IN ('momo','paystack','cash','bank_transfer')
  ),
  payment_status  VARCHAR(30) DEFAULT 'pending' CHECK (
    payment_status IN ('pending','success','failed','refunded')
  ),
  transaction_ref VARCHAR(150),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_ref     ON payments(transaction_ref);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_read_own"
  ON payments FOR SELECT
  USING (auth.uid() = payer_id OR auth.uid() = receiver_id);
-- Backend service role writes only — same pattern as
-- payment_methods and subscription_invoices in migration 028.

-- ============================================================
-- PART 2 — audit_logs (append-only, never editable, even by admins)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES users(id),
  action        VARCHAR(100) NOT NULL,
  ip_address    INET,
  device_info   TEXT,
  location_lat  DECIMAL(10,8),
  location_lng  DECIMAL(11,8),
  metadata      JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user   ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_read_own"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Append-only — nobody, not even an admin through the app, can
-- modify or erase a log entry once written. Only the backend
-- service role can INSERT.
CREATE POLICY "audit_logs_no_update"
  ON audit_logs FOR UPDATE USING (FALSE);
CREATE POLICY "audit_logs_no_delete"
  ON audit_logs FOR DELETE USING (FALSE);

-- ============================================================
-- PART 3 — fraud_reports (backs admin FraudReportsScreen)
-- ============================================================
CREATE TABLE IF NOT EXISTS fraud_reports (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reported_by           UUID REFERENCES users(id),
  reported_user_id      UUID REFERENCES users(id),
  booking_id            UUID REFERENCES bookings(id),
  fraud_type            VARCHAR(50) CHECK (
    fraud_type IN ('scam','fake_identity','no_show','overcharge','harassment','other')
  ),
  description           TEXT NOT NULL,
  evidence_urls         TEXT[],
  status                VARCHAR(30) DEFAULT 'open' CHECK (
    status IN ('open','investigating','resolved','referred_to_police','closed')
  ),
  admin_notes           TEXT,
  police_report_number  VARCHAR(100),
  resolved_by           UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_reports_status ON fraud_reports(status);

ALTER TABLE fraud_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fraud_reports_read_own"
  ON fraud_reports FOR SELECT USING (auth.uid() = reported_by);
CREATE POLICY "fraud_reports_insert_authenticated"
  ON fraud_reports FOR INSERT WITH CHECK (auth.uid() = reported_by);

-- ============================================================
-- ✅ DONE — Migration 032 applied. Run this one FIRST if you are
-- catching up on migrations 028-032 in order, since this is the
-- one that unblocks real money actually being recorded.
-- ============================================================

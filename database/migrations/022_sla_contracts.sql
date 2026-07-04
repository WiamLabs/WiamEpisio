-- ============================================================
-- WIAMAPP MIGRATION 022 — SLA Contracts and Breach Log
-- © 2026 WiamApp. Powered by WiamLabs
-- Run after 021_enterprise_vendors.sql
-- Enterprise plan business accounts only (enforced in backend).
-- ============================================================

-- SLA settings per enterprise account
CREATE TABLE IF NOT EXISTS sla_contracts (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  enterprise_id     UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  sla_type          VARCHAR(50) NOT NULL,      -- e.g. 'response_time', 'resolution_time'
  response_hours    INT,
  credit_percentage DECIMAL(5,2) DEFAULT 0,    -- credit issued on breach
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_contracts_enterprise ON sla_contracts(enterprise_id);

-- Record of every SLA breach and the credit that was issued
CREATE TABLE IF NOT EXISTS sla_breach_log (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  enterprise_id     UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  booking_id        UUID REFERENCES bookings(id) ON DELETE SET NULL,
  sla_type          VARCHAR(50) NOT NULL,
  expected_by       TIMESTAMPTZ,
  worker_arrived_at TIMESTAMPTZ,
  breach_minutes    INT,
  credit_issued_usd DECIMAL(10,2) DEFAULT 0,
  resolved          BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_breach_enterprise ON sla_breach_log(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_sla_breach_booking    ON sla_breach_log(booking_id);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE sla_contracts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_breach_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sla_contracts_read_owner"
  ON sla_contracts FOR SELECT
  USING (
    enterprise_id IN (
      SELECT id FROM business_profiles WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "sla_breach_log_read_owner"
  ON sla_breach_log FOR SELECT
  USING (
    enterprise_id IN (
      SELECT id FROM business_profiles WHERE owner_id = auth.uid()
    )
  );

-- ============================================================
-- WIAMAPP MIGRATION 020 — Recurring Service Contracts
-- © 2026 WiamApp. Powered by WiamLabs
-- Run after 019_enterprise_locations.sql
-- Enterprise plan business accounts only (enforced in backend).
-- ============================================================

CREATE TABLE IF NOT EXISTS recurring_contracts (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  enterprise_id    UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  location_id      UUID REFERENCES enterprise_locations(id) ON DELETE SET NULL,
  worker_id        UUID REFERENCES worker_profiles(id) ON DELETE SET NULL,
  category_id      UUID REFERENCES categories(id),
  schedule_type    VARCHAR(20) DEFAULT 'weekly'
                     CHECK (schedule_type IN ('daily','weekly','monthly')),
  schedule_days    INT[],                 -- 0=Sun .. 6=Sat
  schedule_time    TIME,
  job_description  TEXT,
  agreed_price_usd DECIMAL(10,2),
  auto_pay         BOOLEAN DEFAULT FALSE,
  status           VARCHAR(20) DEFAULT 'active'
                     CHECK (status IN ('active','paused','ended')),
  starts_at        TIMESTAMPTZ,
  ends_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_contracts_enterprise ON recurring_contracts(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_recurring_contracts_location   ON recurring_contracts(location_id);
CREATE INDEX IF NOT EXISTS idx_recurring_contracts_worker     ON recurring_contracts(worker_id);
CREATE INDEX IF NOT EXISTS idx_recurring_contracts_status     ON recurring_contracts(status);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE recurring_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_contracts_read_owner"
  ON recurring_contracts FOR SELECT
  USING (
    enterprise_id IN (
      SELECT id FROM business_profiles WHERE owner_id = auth.uid()
    )
  );

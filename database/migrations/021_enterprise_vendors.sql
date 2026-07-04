-- ============================================================
-- WIAMAPP MIGRATION 021 — Enterprise Preferred Vendors
-- © 2026 WiamApp. Powered by WiamLabs
-- Run after 020_recurring_contracts.sql
-- Enterprise plan business accounts only (enforced in backend).
-- ============================================================

CREATE TABLE IF NOT EXISTS enterprise_vendors (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  enterprise_id    UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  worker_id        UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  added_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  worker_confirmed BOOLEAN DEFAULT FALSE,
  confirmed_at     TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(enterprise_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_enterprise_vendors_enterprise ON enterprise_vendors(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_vendors_worker     ON enterprise_vendors(worker_id);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE enterprise_vendors ENABLE ROW LEVEL SECURITY;

-- Enterprise owner can see their vendor list
CREATE POLICY "enterprise_vendors_read_owner"
  ON enterprise_vendors FOR SELECT
  USING (
    enterprise_id IN (
      SELECT id FROM business_profiles WHERE owner_id = auth.uid()
    )
  );

-- The worker can see (and confirm) vendor invitations addressed to them
CREATE POLICY "enterprise_vendors_read_worker"
  ON enterprise_vendors FOR SELECT
  USING (
    worker_id IN (
      SELECT id FROM worker_profiles WHERE user_id = auth.uid()
    )
  );

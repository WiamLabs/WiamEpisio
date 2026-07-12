-- ============================================================
-- WIAMAPP MIGRATION 019 — Enterprise Branch Locations
-- © 2026 WiamApp. Powered by WiamLabs
-- Run after 018_enhanced_profiles.sql
-- Enterprise plan business accounts only (enforced in backend).
-- ============================================================

CREATE TABLE IF NOT EXISTS enterprise_locations (
  id                 UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  enterprise_id      UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  location_name      VARCHAR(200) NOT NULL,
  location_code      VARCHAR(50),
  city               VARCHAR(120),
  address            TEXT,
  manager_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  spending_limit_usd DECIMAL(12,2),
  is_active          BOOLEAN DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_locations_enterprise ON enterprise_locations(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_locations_manager    ON enterprise_locations(manager_user_id);

-- ─── RLS ─────────────────────────────────────────────────────
-- Writes happen through the backend (service role, bypasses RLS).
-- Direct reads are limited to the enterprise account owner.
ALTER TABLE enterprise_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enterprise_locations_read_owner"
  ON enterprise_locations FOR SELECT
  USING (
    enterprise_id IN (
      SELECT id FROM business_profiles WHERE user_id = auth.uid()
    )
  );

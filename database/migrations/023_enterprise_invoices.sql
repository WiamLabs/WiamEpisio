-- ============================================================
-- WIAMAPP MIGRATION 023 — Enterprise Monthly Invoices
-- © 2026 WiamApp. Powered by WiamLabs
-- Run after 022_sla_contracts.sql
-- Enterprise plan business accounts only (enforced in backend).
-- All money stored in USD.
-- ============================================================

CREATE TABLE IF NOT EXISTS enterprise_invoices (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  enterprise_id        UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  invoice_number       VARCHAR(60) UNIQUE NOT NULL,
  billing_period_start DATE,
  billing_period_end   DATE,
  total_jobs           INT DEFAULT 0,
  subtotal_usd         DECIMAL(12,2) DEFAULT 0,
  commission_usd       DECIMAL(12,2) DEFAULT 0,
  total_due_usd        DECIMAL(12,2) DEFAULT 0,
  status               VARCHAR(20) DEFAULT 'unpaid'
                         CHECK (status IN ('unpaid','paid','overdue','void')),
  due_date             DATE,
  paid_at              TIMESTAMPTZ,
  pdf_url              TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_invoices_enterprise ON enterprise_invoices(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_invoices_status     ON enterprise_invoices(status);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE enterprise_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enterprise_invoices_read_owner"
  ON enterprise_invoices FOR SELECT
  USING (
    enterprise_id IN (
      SELECT id FROM business_profiles WHERE user_id = auth.uid()
    )
  );

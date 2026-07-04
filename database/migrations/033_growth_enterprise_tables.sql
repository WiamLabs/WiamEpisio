-- ============================================================
-- WIAMAPP MIGRATION 033 — Growth/Enterprise Tables Restore
-- © 2026 WiamApp. Powered by WiamLabs
--
-- Restores 5 tables that existed in the old migration files
-- (019-023) but were never carried into the V4 clean rebuild,
-- same story as every other restore this session. Every single
-- one of their original RLS policies referenced
-- business_profiles.owner_id — a column that does not exist on
-- the live table (it's user_id) — so every one is corrected here.
--
-- Also adds the audit columns Job Assignment needs on bookings —
-- this is a Growth-tier feature, not its own table, since it's
-- really just "let a business reassign which of their own team
-- members handles a booking," not a separate data model.
-- ============================================================

-- ============================================================
-- PART 1 — JOB ASSIGNMENT (Growth) — audit columns on bookings
-- ============================================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- ============================================================
-- PART 2 — ENTERPRISE LOCATIONS (Enterprise)
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

ALTER TABLE enterprise_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enterprise_locations_read_owner"
  ON enterprise_locations FOR SELECT
  USING (enterprise_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid()));
-- Writes happen through the backend (service role, bypasses RLS).

-- Which booking happened at which location — nullable, since
-- Starter/Growth businesses have no locations at all.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES enterprise_locations(id) ON DELETE SET NULL;

-- ============================================================
-- PART 3 — RECURRING CONTRACTS (Growth and Enterprise)
-- ============================================================
-- The original design scoped this Enterprise-only ("enterprise_id"
-- naming, comment said Enterprise plan only) — but Section 21's
-- own screen list places RecurringContractsPage under "GROWTH AND
-- ENTERPRISE ONLY," not Enterprise-only. Column kept as
-- business_id (renamed from enterprise_id) to reflect that any
-- Growth+ business can hold one, and the backend route enforces
-- the actual plan check, not the column name.
CREATE TABLE IF NOT EXISTS recurring_contracts (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id      UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_recurring_contracts_business ON recurring_contracts(business_id);
CREATE INDEX IF NOT EXISTS idx_recurring_contracts_location ON recurring_contracts(location_id);
CREATE INDEX IF NOT EXISTS idx_recurring_contracts_worker   ON recurring_contracts(worker_id);
CREATE INDEX IF NOT EXISTS idx_recurring_contracts_status   ON recurring_contracts(status);

ALTER TABLE recurring_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recurring_contracts_read_owner"
  ON recurring_contracts FOR SELECT
  USING (business_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid()));

-- The assigned worker can see contracts naming them, same pattern
-- as enterprise_vendors below — they need to know about a standing
-- arrangement that affects them even though they didn't create it.
CREATE POLICY "recurring_contracts_read_worker"
  ON recurring_contracts FOR SELECT
  USING (worker_id IN (SELECT id FROM worker_profiles WHERE user_id = auth.uid()));

-- ============================================================
-- PART 4 — ENTERPRISE PREFERRED VENDORS (Enterprise)
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

ALTER TABLE enterprise_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enterprise_vendors_read_owner"
  ON enterprise_vendors FOR SELECT
  USING (enterprise_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid()));
CREATE POLICY "enterprise_vendors_read_worker"
  ON enterprise_vendors FOR SELECT
  USING (worker_id IN (SELECT id FROM worker_profiles WHERE user_id = auth.uid()));

-- ============================================================
-- PART 5 — SLA CONTRACTS AND BREACH LOG (Enterprise)
-- ============================================================
CREATE TABLE IF NOT EXISTS sla_contracts (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  enterprise_id     UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  sla_type          VARCHAR(50) NOT NULL,
  response_hours    INT,
  credit_percentage DECIMAL(5,2) DEFAULT 0,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_contracts_enterprise ON sla_contracts(enterprise_id);

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

ALTER TABLE sla_contracts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_breach_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sla_contracts_read_owner"
  ON sla_contracts FOR SELECT
  USING (enterprise_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid()));
CREATE POLICY "sla_breach_log_read_owner"
  ON sla_breach_log FOR SELECT
  USING (enterprise_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid()));

-- ============================================================
-- PART 6 — ENTERPRISE MONTHLY INVOICES (Enterprise)
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

ALTER TABLE enterprise_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enterprise_invoices_read_owner"
  ON enterprise_invoices FOR SELECT
  USING (enterprise_id IN (SELECT id FROM business_profiles WHERE user_id = auth.uid()));

-- ============================================================
-- ✅ DONE — Migration 033 applied
-- ============================================================

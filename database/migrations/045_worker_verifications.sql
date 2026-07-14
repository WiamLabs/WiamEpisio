-- © 2026 WiamApp. Powered by WiamLabs
-- 045_worker_verifications.sql
-- Founder document review queue for workers (Studio /admin/verification-queue).
-- Customer queue already exists as customer_document_reviews (007).

CREATE TABLE IF NOT EXISTS worker_verifications (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id_type           VARCHAR(50),
  id_front_key      TEXT,
  id_back_key       TEXT,
  selfie_key        TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading','pending','approved','rejected')),
  submitted_at      TIMESTAMPTZ,
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       UUID REFERENCES users(id),
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_worker_verifications_status
  ON worker_verifications(status);
CREATE INDEX IF NOT EXISTS idx_worker_verifications_submitted
  ON worker_verifications(submitted_at)
  WHERE status = 'pending';

-- Columns Studio / admin approve-reject write on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_submitted BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_reviewed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_reviewed_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_rejection_reason TEXT;

ALTER TABLE worker_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS worker_verifications_own_select ON worker_verifications;
CREATE POLICY worker_verifications_own_select
  ON worker_verifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS worker_verifications_own_upsert ON worker_verifications;
CREATE POLICY worker_verifications_own_upsert
  ON worker_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS worker_verifications_own_update ON worker_verifications;
CREATE POLICY worker_verifications_own_update
  ON worker_verifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- WIAMAPP DATABASE MIGRATION 003
-- Security, Payments, Fraud, Verification Tables
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- Run AFTER migration 002
-- ============================================================

-- ─── VERIFICATIONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS verifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  verification_type VARCHAR(30) CHECK (
    verification_type IN ('phone_otp','email','id_document','face_match','liveness','business_doc')
  ),
  status VARCHAR(20) DEFAULT 'pending' CHECK (
    status IN ('pending','passed','failed','manual_review','rejected')
  ),
  provider VARCHAR(50) DEFAULT 'smile_identity',
  provider_ref VARCHAR(200),
  score DECIMAL(5,2),
  document_type VARCHAR(50),
  document_number_encrypted TEXT,
  document_s3_key TEXT,
  selfie_s3_key TEXT,
  failure_reason TEXT,
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BUSINESS VERIFICATIONS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS business_verifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(200) NOT NULL,
  registration_number VARCHAR(100),
  tin_number VARCHAR(100),
  business_address TEXT,
  business_city VARCHAR(100),
  owner_id_s3_key TEXT,
  registration_cert_s3_key TEXT,
  address_proof_s3_key TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (
    status IN ('pending','approved','rejected','more_info_needed')
  ),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PAYMENTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  payer_id UUID REFERENCES users(id),
  receiver_id UUID REFERENCES users(id),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'GHS',
  payment_method VARCHAR(50) CHECK (
    payment_method IN ('momo','paystack','cash','bank_transfer')
  ),
  payment_status VARCHAR(30) DEFAULT 'pending' CHECK (
    payment_status IN ('pending','success','failed','refunded')
  ),
  transaction_ref VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AUDIT LOG (append-only — never delete) ──────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  ip_address INET,
  device_info TEXT,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── FRAUD REPORTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fraud_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reported_by UUID REFERENCES users(id),
  reported_user_id UUID REFERENCES users(id),
  booking_id UUID REFERENCES bookings(id),
  fraud_type VARCHAR(50) CHECK (
    fraud_type IN ('scam','fake_identity','no_show','overcharge','harassment','other')
  ),
  description TEXT NOT NULL,
  evidence_s3_keys TEXT[],
  status VARCHAR(30) DEFAULT 'open' CHECK (
    status IN ('open','investigating','resolved','referred_to_police','closed')
  ),
  admin_notes TEXT,
  police_report_number VARCHAR(100),
  resolved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DEVICE FINGERPRINTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_fingerprints (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  device_id VARCHAR(200),
  device_model VARCHAR(100),
  os_version VARCHAR(50),
  app_version VARCHAR(20),
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SUBSCRIPTIONS (Worker plans) ────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worker_id UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  plan VARCHAR(30) CHECK (plan IN ('free','basic','pro')),
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  amount_paid DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── FEATURED WORKERS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS featured_workers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worker_id UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  amount_paid DECIMAL(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_verifications_user ON verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_fraud_reports_status ON fraud_reports(status);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_user ON device_fingerprints(user_id);

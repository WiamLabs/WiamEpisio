-- ============================================================
-- WIAMAPP — RUN ALL MIGRATIONS (single file)
-- Paste this WHOLE file into Supabase -> SQL Editor -> Run.
-- IMPORTANT: run ONCE on a FRESH Supabase project.
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================


-- ============================================================
-- FILE: 001_core_tables.sql
-- ============================================================

-- ============================================================
-- WIAMAPP DATABASE MIGRATION 001
-- Core Tables: users, worker_profiles, categories
-- Â© 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- HOW TO RUN:
-- 1. Go to https://supabase.com â†’ Your Project â†’ SQL Editor
-- 2. Paste this entire file and click Run
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- â”€â”€â”€ USERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'worker', 'business', 'admin')),
  avatar_url TEXT,
  city VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Ghana',
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€â”€ WORKER PROFILES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS worker_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  bio TEXT,
  years_experience INT DEFAULT 0,
  hourly_rate DECIMAL(10,2),
  currency VARCHAR(10) DEFAULT 'GHS',
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  location_name VARCHAR(200),
  is_available BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_badge BOOLEAN DEFAULT FALSE,
  total_jobs_done INT DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€â”€ CATEGORIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  icon VARCHAR(100),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€â”€ WORKER CATEGORIES (many-to-many) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS worker_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worker_id UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE(worker_id, category_id)
);

-- â”€â”€â”€ PORTFOLIO IMAGES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS portfolio_images (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worker_id UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€â”€ INDEXES for performance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_available ON worker_profiles(is_available);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_rating ON worker_profiles(average_rating DESC);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_user ON worker_profiles(user_id);

-- â”€â”€â”€ UPDATED_AT TRIGGER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER worker_profiles_updated_at
  BEFORE UPDATE ON worker_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- â”€â”€â”€ SEED CATEGORIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO categories (name, icon, description) VALUES
  ('Electrician',     'flash-outline',       'Electrical installation and repairs'),
  ('Plumber',         'water-outline',       'Water and pipe repairs'),
  ('Car Mechanic',    'car-outline',         'Vehicle repairs and servicing'),
  ('Barber',          'cut-outline',         'Haircut and grooming services'),
  ('Cleaner',         'sparkles-outline',    'Home and office cleaning'),
  ('Painter',         'brush-outline',       'Interior and exterior painting'),
  ('Tutor',           'book-outline',        'Academic and skill tutoring'),
  ('Photographer',    'camera-outline',      'Photography and videography'),
  ('Delivery Rider',  'bicycle-outline',     'Package and food delivery'),
  ('Builder',         'construct-outline',   'Construction and masonry'),
  ('AC Technician',   'thermometer-outline', 'Air conditioning installation and repair'),
  ('Tailor',          'color-palette-outline','Clothing design and alterations')
ON CONFLICT (name) DO NOTHING;



-- ============================================================
-- FILE: 002_bookings_messages.sql
-- ============================================================

-- ============================================================
-- WIAMAPP DATABASE MIGRATION 002
-- Bookings, Reviews, Messages, Notifications
-- Â© 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- Run AFTER migration 001
-- ============================================================

-- â”€â”€â”€ BOOKINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),
  status VARCHAR(30) DEFAULT 'pending' CHECK (
    status IN ('pending','accepted','rejected','in_progress','completed','cancelled')
  ),
  description TEXT,
  scheduled_date TIMESTAMPTZ,
  location_address TEXT,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  agreed_price DECIMAL(10,2),
  currency VARCHAR(10) DEFAULT 'GHS',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€â”€ REVIEWS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE UNIQUE,
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€â”€ MESSAGES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  voice_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€â”€ NOTIFICATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200),
  body TEXT,
  type VARCHAR(50) CHECK (type IN ('booking','message','review','payment','system')),
  is_read BOOLEAN DEFAULT FALSE,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€â”€ INDEXES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_worker ON bookings(worker_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_messages_booking ON messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_reviews_worker ON reviews(worker_id);

-- â”€â”€â”€ UPDATED_AT TRIGGERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- â”€â”€â”€ ENABLE REALTIME â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- This makes messages and notifications update live in the app
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE messages; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE notifications; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE bookings; EXCEPTION WHEN others THEN NULL; END $$;



-- ============================================================
-- FILE: 003_security_payments.sql
-- ============================================================

-- ============================================================
-- WIAMAPP DATABASE MIGRATION 003
-- Security, Payments, Fraud, Verification Tables
-- Â© 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- Run AFTER migration 002
-- ============================================================

-- â”€â”€â”€ VERIFICATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€ BUSINESS VERIFICATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€ PAYMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€ AUDIT LOG (append-only â€” never delete) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€ FRAUD REPORTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€ DEVICE FINGERPRINTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€ SUBSCRIPTIONS (Worker plans) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€ FEATURED WORKERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS featured_workers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worker_id UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  amount_paid DECIMAL(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€â”€ INDEXES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX IF NOT EXISTS idx_verifications_user ON verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_fraud_reports_status ON fraud_reports(status);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_user ON device_fingerprints(user_id);



-- ============================================================
-- FILE: 004_rls_policies.sql
-- ============================================================

-- ============================================================
-- WIAMAPP DATABASE MIGRATION 004
-- Row Level Security (RLS) Policies
-- Â© 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- IMPORTANT: Run AFTER migrations 001, 002, and 003
-- RLS ensures users can ONLY see their own data
-- ============================================================

-- â”€â”€â”€ ENABLE RLS ON ALL TABLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE featured_workers ENABLE ROW LEVEL SECURITY;

-- â”€â”€â”€ USERS TABLE POLICIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Users can read their own profile
DROP POLICY IF EXISTS "users_read_own" ON users;
CREATE POLICY "users_read_own"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Anyone can read basic public worker info
DROP POLICY IF EXISTS "users_read_workers_public" ON users;
CREATE POLICY "users_read_workers_public"
  ON users FOR SELECT
  USING (role IN ('worker', 'business'));

-- Users can update only their own profile
DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- New users can insert their own profile on signup
DROP POLICY IF EXISTS "users_insert_own" ON users;
CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- â”€â”€â”€ WORKER PROFILES POLICIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Anyone can read worker profiles (needed for search/browse)
DROP POLICY IF EXISTS "worker_profiles_read_all" ON worker_profiles;
CREATE POLICY "worker_profiles_read_all"
  ON worker_profiles FOR SELECT
  USING (true);

-- Workers can only update their own profile
DROP POLICY IF EXISTS "worker_profiles_update_own" ON worker_profiles;
CREATE POLICY "worker_profiles_update_own"
  ON worker_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Workers can insert their own profile
DROP POLICY IF EXISTS "worker_profiles_insert_own" ON worker_profiles;
CREATE POLICY "worker_profiles_insert_own"
  ON worker_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- â”€â”€â”€ BOOKINGS POLICIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Customers can see their own bookings
-- Workers can see bookings assigned to them
DROP POLICY IF EXISTS "bookings_read_own" ON bookings;
CREATE POLICY "bookings_read_own"
  ON bookings FOR SELECT
  USING (
    auth.uid() = customer_id
    OR auth.uid() = (
      SELECT user_id FROM worker_profiles WHERE id = worker_id
    )
  );

-- Customers can create bookings
DROP POLICY IF EXISTS "bookings_insert_customer" ON bookings;
CREATE POLICY "bookings_insert_customer"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Both customer and worker can update booking status
DROP POLICY IF EXISTS "bookings_update_own" ON bookings;
CREATE POLICY "bookings_update_own"
  ON bookings FOR UPDATE
  USING (
    auth.uid() = customer_id
    OR auth.uid() = (
      SELECT user_id FROM worker_profiles WHERE id = worker_id
    )
  );

-- â”€â”€â”€ MESSAGES POLICIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Only sender and receiver can see messages
DROP POLICY IF EXISTS "messages_read_participants" ON messages;
CREATE POLICY "messages_read_participants"
  ON messages FOR SELECT
  USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
  );

-- Only authenticated users can send messages
DROP POLICY IF EXISTS "messages_insert_authenticated" ON messages;
CREATE POLICY "messages_insert_authenticated"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Only receiver can mark as read
DROP POLICY IF EXISTS "messages_update_receiver" ON messages;
CREATE POLICY "messages_update_receiver"
  ON messages FOR UPDATE
  USING (auth.uid() = receiver_id);

-- â”€â”€â”€ NOTIFICATIONS POLICIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Users can only see their own notifications
DROP POLICY IF EXISTS "notifications_read_own" ON notifications;
CREATE POLICY "notifications_read_own"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- System inserts notifications (via service role key in backend)
-- Frontend users cannot insert notifications
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- â”€â”€â”€ REVIEWS POLICIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Anyone can read reviews (public)
DROP POLICY IF EXISTS "reviews_read_all" ON reviews;
CREATE POLICY "reviews_read_all"
  ON reviews FOR SELECT
  USING (true);

-- Only customers who completed the booking can leave a review
DROP POLICY IF EXISTS "reviews_insert_completed_customer" ON reviews;
CREATE POLICY "reviews_insert_completed_customer"
  ON reviews FOR INSERT
  WITH CHECK (
    auth.uid() = customer_id
    AND EXISTS (
      SELECT 1 FROM bookings
      WHERE id = booking_id
      AND customer_id = auth.uid()
      AND status = 'completed'
    )
  );

-- â”€â”€â”€ VERIFICATIONS POLICIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Users can only see their own verification status (not documents)
DROP POLICY IF EXISTS "verifications_read_own_status" ON verifications;
CREATE POLICY "verifications_read_own_status"
  ON verifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own verification request
DROP POLICY IF EXISTS "verifications_insert_own" ON verifications;
CREATE POLICY "verifications_insert_own"
  ON verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- â”€â”€â”€ PORTFOLIO IMAGES POLICIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Anyone can read portfolio images (public)
DROP POLICY IF EXISTS "portfolio_images_read_all" ON portfolio_images;
CREATE POLICY "portfolio_images_read_all"
  ON portfolio_images FOR SELECT
  USING (true);

-- Workers can manage their own portfolio
DROP POLICY IF EXISTS "portfolio_images_manage_own" ON portfolio_images;
CREATE POLICY "portfolio_images_manage_own"
  ON portfolio_images FOR ALL
  USING (
    auth.uid() = (
      SELECT user_id FROM worker_profiles WHERE id = worker_id
    )
  );

-- â”€â”€â”€ WORKER CATEGORIES POLICIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Anyone can read categories (for search/filter)
DROP POLICY IF EXISTS "worker_categories_read_all" ON worker_categories;
CREATE POLICY "worker_categories_read_all"
  ON worker_categories FOR SELECT
  USING (true);

-- Workers can manage their own categories
DROP POLICY IF EXISTS "worker_categories_manage_own" ON worker_categories;
CREATE POLICY "worker_categories_manage_own"
  ON worker_categories FOR ALL
  USING (
    auth.uid() = (
      SELECT user_id FROM worker_profiles WHERE id = worker_id
    )
  );

-- â”€â”€â”€ PAYMENTS POLICIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Users can see payments they are involved in
DROP POLICY IF EXISTS "payments_read_own" ON payments;
CREATE POLICY "payments_read_own"
  ON payments FOR SELECT
  USING (
    auth.uid() = payer_id
    OR auth.uid() = receiver_id
  );

-- â”€â”€â”€ FRAUD REPORTS POLICIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Users can see fraud reports they filed
DROP POLICY IF EXISTS "fraud_reports_read_own" ON fraud_reports;
CREATE POLICY "fraud_reports_read_own"
  ON fraud_reports FOR SELECT
  USING (auth.uid() = reported_by);

-- Authenticated users can file a fraud report
DROP POLICY IF EXISTS "fraud_reports_insert_authenticated" ON fraud_reports;
CREATE POLICY "fraud_reports_insert_authenticated"
  ON fraud_reports FOR INSERT
  WITH CHECK (auth.uid() = reported_by);

-- â”€â”€â”€ AUDIT LOGS â€” read only for own user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "audit_logs_read_own" ON audit_logs;
CREATE POLICY "audit_logs_read_own"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- System inserts audit logs via service role
-- No direct insert policy for regular users



-- ============================================================
-- FILE: 005_security_functions.sql
-- ============================================================

-- ============================================================
-- WIAMAPP DATABASE MIGRATION 005
-- Security Functions, Triggers & Missing RLS Policies
-- Â© 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- Run AFTER migrations 001 - 004
-- ============================================================


-- â”€â”€â”€ FUNCTION: Auto-block user after 3 failed verifications â”€â”€
CREATE OR REPLACE FUNCTION check_verification_failures()
RETURNS TRIGGER AS $$
DECLARE
  failure_count INT;
BEGIN
  -- Count consecutive failures for this user and type
  SELECT COUNT(*) INTO failure_count
  FROM verifications
  WHERE user_id = NEW.user_id
    AND verification_type = NEW.verification_type
    AND status = 'failed'
    AND created_at > NOW() - INTERVAL '24 hours';

  -- If 3 or more failures in 24 hours, flag the user
  IF failure_count >= 3 THEN
    UPDATE users
    SET is_active = FALSE
    WHERE id = NEW.user_id;

    -- Log the auto-block
    INSERT INTO audit_logs (user_id, action, metadata)
    VALUES (
      NEW.user_id,
      'account_auto_blocked',
      jsonb_build_object(
        'reason', 'Too many verification failures',
        'verification_type', NEW.verification_type,
        'failure_count', failure_count
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER verification_failure_check
  AFTER INSERT ON verifications
  FOR EACH ROW
  WHEN (NEW.status = 'failed')
  EXECUTE FUNCTION check_verification_failures();


-- â”€â”€â”€ FUNCTION: Auto-update worker rating on new review â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION update_worker_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating DECIMAL(3,2);
  job_count INT;
BEGIN
  SELECT
    ROUND(AVG(rating)::NUMERIC, 1),
    COUNT(*)
  INTO avg_rating, job_count
  FROM reviews
  WHERE worker_id = NEW.worker_id;

  UPDATE worker_profiles
  SET
    average_rating = avg_rating,
    total_jobs_done = job_count,
    updated_at = NOW()
  WHERE id = NEW.worker_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER review_rating_update
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_worker_rating();


-- â”€â”€â”€ FUNCTION: Prevent unverified workers from accepting jobs â”€
CREATE OR REPLACE FUNCTION check_worker_verification()
RETURNS TRIGGER AS $$
DECLARE
  worker_user_id UUID;
  is_id_verified BOOLEAN;
  is_face_verified BOOLEAN;
BEGIN
  -- Only check when status changes to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Get the worker's user_id
    SELECT user_id INTO worker_user_id
    FROM worker_profiles
    WHERE id = NEW.worker_id;

    -- Check if ID document is verified
    SELECT EXISTS (
      SELECT 1 FROM verifications
      WHERE user_id = worker_user_id
        AND verification_type = 'id_document'
        AND status = 'passed'
    ) INTO is_id_verified;

    -- Check if face match is verified
    SELECT EXISTS (
      SELECT 1 FROM verifications
      WHERE user_id = worker_user_id
        AND verification_type = 'face_match'
        AND status = 'passed'
    ) INTO is_face_verified;

    -- Block if not fully verified
    IF NOT (is_id_verified AND is_face_verified) THEN
      RAISE EXCEPTION
        'Worker must complete identity verification before accepting bookings.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER booking_verification_guard
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION check_worker_verification();


-- â”€â”€â”€ FUNCTION: Log booking status changes automatically â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION log_booking_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO audit_logs (user_id, action, metadata)
    VALUES (
      NEW.customer_id,
      'booking_status_changed',
      jsonb_build_object(
        'booking_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'worker_id', NEW.worker_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER booking_status_audit
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION log_booking_changes();


-- â”€â”€â”€ FUNCTION: Prevent duplicate reviews â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE OR REPLACE FUNCTION check_duplicate_review()
RETURNS TRIGGER AS $$
DECLARE
  existing_review UUID;
BEGIN
  SELECT id INTO existing_review
  FROM reviews
  WHERE booking_id = NEW.booking_id
    AND customer_id = NEW.customer_id;

  IF existing_review IS NOT NULL THEN
    RAISE EXCEPTION
      'You have already left a review for this booking.'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER prevent_duplicate_review
  BEFORE INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION check_duplicate_review();


-- â”€â”€â”€ FUNCTION: Detect suspicious login patterns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Flags if same user logs in from very different locations within 1 hour
CREATE OR REPLACE FUNCTION detect_suspicious_login()
RETURNS TRIGGER AS $$
DECLARE
  last_login RECORD;
  distance FLOAT;
BEGIN
  IF NEW.action = 'login' AND NEW.location_lat IS NOT NULL THEN
    -- Get the last login for this user
    SELECT location_lat, location_lng, created_at
    INTO last_login
    FROM audit_logs
    WHERE user_id = NEW.user_id
      AND action = 'login'
      AND created_at > NOW() - INTERVAL '1 hour'
      AND location_lat IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1;

    IF last_login IS NOT NULL THEN
      -- Simple distance estimate (degrees, not exact but fast)
      distance := SQRT(
        POWER(NEW.location_lat - last_login.location_lat, 2) +
        POWER(NEW.location_lng - last_login.location_lng, 2)
      );

      -- If more than ~2 degrees apart (~220km) within 1 hour â€” suspicious
      IF distance > 2.0 THEN
        INSERT INTO audit_logs (user_id, action, metadata)
        VALUES (
          NEW.user_id,
          'suspicious_login_detected',
          jsonb_build_object(
            'reason', 'Rapid location change',
            'distance_degrees', ROUND(distance::NUMERIC, 4),
            'risk', 'MEDIUM'
          )
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER suspicious_login_check
  AFTER INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION detect_suspicious_login();


-- â”€â”€â”€ MISSING RLS â€” device_fingerprints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE device_fingerprints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_fingerprints_own" ON device_fingerprints;
CREATE POLICY "device_fingerprints_own"
  ON device_fingerprints FOR ALL
  USING (auth.uid() = user_id);


-- â”€â”€â”€ MISSING RLS â€” subscriptions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_own" ON subscriptions;
CREATE POLICY "subscriptions_own"
  ON subscriptions FOR SELECT
  USING (
    auth.uid() = (
      SELECT user_id FROM worker_profiles WHERE id = worker_id
    )
  );


-- â”€â”€â”€ MISSING RLS â€” featured_workers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE featured_workers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "featured_workers_read_all" ON featured_workers;
CREATE POLICY "featured_workers_read_all"
  ON featured_workers FOR SELECT
  USING (is_active = TRUE);


-- â”€â”€â”€ MISSING RLS â€” business_verifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE business_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_verifications_own" ON business_verifications;
CREATE POLICY "business_verifications_own"
  ON business_verifications FOR ALL
  USING (auth.uid() = user_id);


-- â”€â”€â”€ APPEND-ONLY AUDIT LOG PROTECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Nobody can UPDATE or DELETE audit logs â€” not even admins via app
-- Only the service role (server-side) can insert
DROP POLICY IF EXISTS "audit_logs_no_update" ON audit_logs;
CREATE POLICY "audit_logs_no_update"
  ON audit_logs FOR UPDATE
  USING (FALSE); -- blocks all updates

DROP POLICY IF EXISTS "audit_logs_no_delete" ON audit_logs;
CREATE POLICY "audit_logs_no_delete"
  ON audit_logs FOR DELETE
  USING (FALSE); -- blocks all deletes


-- â”€â”€â”€ VIEW: Admin fraud investigation view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Joins fraud report with booking, user, and verification data
-- Used by admin to get everything needed to trace a suspect
CREATE OR REPLACE VIEW admin_fraud_investigation AS
SELECT
  fr.id AS report_id,
  fr.fraud_type,
  fr.description,
  fr.status AS report_status,
  fr.created_at AS report_date,
  fr.police_report_number,

  -- Who filed the report
  reporter.full_name AS reported_by_name,
  reporter.email AS reported_by_email,
  reporter.phone AS reported_by_phone,

  -- Who was reported
  suspect.full_name AS suspect_name,
  suspect.email AS suspect_email,
  suspect.phone AS suspect_phone,
  suspect.city AS suspect_city,

  -- Their verified ID info
  v.document_type AS suspect_id_type,
  v.status AS suspect_id_verification_status,
  v.provider_ref AS smile_identity_job_id,

  -- The booking details
  b.id AS booking_id,
  b.description AS job_description,
  b.location_address AS job_location,
  b.scheduled_date,
  b.agreed_price,
  b.currency

FROM fraud_reports fr
LEFT JOIN users reporter ON reporter.id = fr.reported_by
LEFT JOIN users suspect ON suspect.id = fr.reported_user_id
LEFT JOIN verifications v ON v.user_id = fr.reported_user_id
  AND v.verification_type = 'id_document'
  AND v.status = 'passed'
LEFT JOIN bookings b ON b.id = fr.booking_id
ORDER BY fr.created_at DESC;



-- ============================================================
-- FILE: 006_mvp_verification_escrow.sql
-- ============================================================

-- ============================================================
-- WIAMAPP DATABASE MIGRATION 006
-- MVP Verification + Escrow â€” Email OTP codes
-- Â© 2026 WiamApp. Powered by WiamLabs
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

-- â”€â”€â”€ RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- OTP codes are sensitive. No client (anon or authenticated) may read
-- or write them. RLS is enabled with NO policies, so all direct client
-- access is denied. The backend uses the service role key, which
-- bypasses RLS, for the send-otp / verify-otp routes.
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;



-- ============================================================
-- FILE: 007_to_015.sql
-- ============================================================

-- ============================================================
-- WIAMAPP MIGRATION 007 â€” Customer Verification System
-- Â© 2026 WiamApp. Powered by WiamLabs
-- Run after 006
-- ============================================================

-- Store the user's country dialing/ISO code (sent by the app at registration)
ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code VARCHAR(10) DEFAULT 'GH';

-- Add customer verification columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  customer_verification_status VARCHAR(30) DEFAULT 'unverified'
  CHECK (customer_verification_status IN ('unverified','pending','verified','suspended'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id_type VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id_front_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id_back_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_selfie_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_last_selfie_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_next_full_verify_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20);

-- Customer verification review queue (separate from worker queue)
CREATE TABLE IF NOT EXISTS customer_document_reviews (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  id_type           VARCHAR(50) NOT NULL,
  id_front_key      TEXT NOT NULL,
  id_back_key       TEXT,
  selfie_key        TEXT NOT NULL,
  status            VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','more_info')),
  submitted_at      TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       UUID REFERENCES users(id),
  rejection_reason  TEXT,
  admin_notes       TEXT
);

CREATE INDEX IF NOT EXISTS idx_customer_doc_reviews_status ON customer_document_reviews(status);
CREATE INDEX IF NOT EXISTS idx_customer_doc_reviews_user ON customer_document_reviews(user_id);

-- Function: Auto-pause customer booking access if monthly selfie overdue
CREATE OR REPLACE FUNCTION check_customer_reverification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_last_selfie_at IS NOT NULL THEN
    -- If selfie is more than 35 days old (5 days grace past 30-day deadline)
    IF NOW() > NEW.customer_last_selfie_at + INTERVAL '35 days' THEN
      NEW.customer_verification_status = 'suspended';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- RLS for customer document reviews
ALTER TABLE customer_document_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_doc_review_own" ON customer_document_reviews;
CREATE POLICY "customer_doc_review_own"
  ON customer_document_reviews FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "customer_doc_review_insert" ON customer_document_reviews;
CREATE POLICY "customer_doc_review_insert"
  ON customer_document_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- WIAMAPP MIGRATION 008 â€” Worker Safety System
-- Â© 2026 WiamApp. Powered by WiamLabs
-- ============================================================

-- Worker safety events (check-in, check-out, SOS)
CREATE TABLE IF NOT EXISTS worker_safety_events (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  booking_id     UUID REFERENCES bookings(id),
  event_type     VARCHAR(30) CHECK (
    event_type IN ('on_the_way','check_in','check_out','sos_worker',
                   'sos_customer','location_shared','location_stopped')
  ),
  latitude       DECIMAL(10,8),
  longitude      DECIMAL(11,8),
  location_name  TEXT,
  other_party_id UUID REFERENCES users(id),
  alert_sent_to  TEXT,
  resolved       BOOLEAN DEFAULT false,
  resolved_at    TIMESTAMPTZ,
  admin_notes    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_safety_events_user ON worker_safety_events(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_events_booking ON worker_safety_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_safety_events_type ON worker_safety_events(event_type);

-- Customer ratings by workers (private â€” only admins and workers can read)
CREATE TABLE IF NOT EXISTS customer_ratings (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id  UUID REFERENCES bookings(id) UNIQUE,
  worker_id   UUID REFERENCES worker_profiles(id),
  customer_id UUID REFERENCES users(id),
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_ratings_customer ON customer_ratings(customer_id);

-- Function: update customer average rating from workers
CREATE OR REPLACE FUNCTION update_customer_rating()
RETURNS TRIGGER AS $$
DECLARE avg_rating DECIMAL(3,2);
BEGIN
  SELECT ROUND(AVG(rating)::NUMERIC, 1) INTO avg_rating
  FROM customer_ratings
  WHERE customer_id = NEW.customer_id;

  -- Store in users table
  UPDATE users SET
    metadata = COALESCE(metadata, '{}'::JSONB) ||
      jsonb_build_object('worker_given_rating', avg_rating)
  WHERE id = NEW.customer_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER customer_rating_update
  AFTER INSERT ON customer_ratings
  FOR EACH ROW EXECUTE FUNCTION update_customer_rating();

-- Add metadata column to users for flexible extra data
ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- RLS
ALTER TABLE worker_safety_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "safety_events_own" ON worker_safety_events;
CREATE POLICY "safety_events_own"
  ON worker_safety_events FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "customer_ratings_worker_insert" ON customer_ratings;
CREATE POLICY "customer_ratings_worker_insert"
  ON customer_ratings FOR INSERT WITH CHECK (
    auth.uid() = (SELECT user_id FROM worker_profiles WHERE id = worker_id)
  );


-- ============================================================
-- WIAMAPP MIGRATION 009 â€” Spotlight System
-- Â© 2026 WiamApp. Powered by WiamLabs
-- ============================================================

CREATE TABLE IF NOT EXISTS spotlight_posts (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  author_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  worker_id        UUID REFERENCES worker_profiles(id),
  category_id      UUID REFERENCES categories(id),
  title            VARCHAR(200),
  description      TEXT,
  media_urls       TEXT[],
  post_type        VARCHAR(30) CHECK (
    post_type IN ('portfolio','promotion','announcement','availability','discount','before_after')
  ),
  status           VARCHAR(30) DEFAULT 'pending_review' CHECK (
    status IN ('pending_review','approved','rejected','removed')
  ),
  rejection_reason TEXT,
  is_boosted       BOOLEAN DEFAULT false,
  boost_type       VARCHAR(20) CHECK (
    boost_type IN ('standard','featured','premium','business')
  ),
  boost_expires_at TIMESTAMPTZ,
  boost_paid_usd   DECIMAL(10,4),
  views_count      INT DEFAULT 0,
  report_count     INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Spotlight reports from community
CREATE TABLE IF NOT EXISTS spotlight_reports (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id     UUID REFERENCES spotlight_posts(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES users(id),
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spotlight_author ON spotlight_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_spotlight_status ON spotlight_posts(status);
CREATE INDEX IF NOT EXISTS idx_spotlight_boosted ON spotlight_posts(is_boosted, boost_expires_at);

ALTER TABLE spotlight_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE spotlight_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved posts
DROP POLICY IF EXISTS "spotlight_read_approved" ON spotlight_posts;
CREATE POLICY "spotlight_read_approved"
  ON spotlight_posts FOR SELECT USING (status = 'approved');

-- Authors can see their own posts regardless of status
DROP POLICY IF EXISTS "spotlight_read_own" ON spotlight_posts;
CREATE POLICY "spotlight_read_own"
  ON spotlight_posts FOR SELECT USING (auth.uid() = author_id);

-- Authors can create and update their own posts
DROP POLICY IF EXISTS "spotlight_manage_own" ON spotlight_posts;
CREATE POLICY "spotlight_manage_own"
  ON spotlight_posts FOR ALL USING (auth.uid() = author_id);

-- Anyone authenticated can report a post
DROP POLICY IF EXISTS "spotlight_report_authenticated" ON spotlight_reports;
CREATE POLICY "spotlight_report_authenticated"
  ON spotlight_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);


-- ============================================================
-- WIAMAPP MIGRATION 010 â€” Business Profiles
-- Â© 2026 WiamApp. Powered by WiamLabs
-- ============================================================

CREATE TABLE IF NOT EXISTS business_profiles (
  id                       UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id                 UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  business_name            VARCHAR(200) NOT NULL,
  business_type            VARCHAR(100),
  registration_number      VARCHAR(100),
  tin_number               VARCHAR(100),
  business_address         TEXT,
  business_city            VARCHAR(100),
  business_country         VARCHAR(100) DEFAULT 'Ghana',
  website                  VARCHAR(200),
  logo_url                 TEXT,
  banner_url               TEXT,
  description              TEXT,
  owner_id_key             TEXT,
  registration_cert_key    TEXT,
  address_proof_key        TEXT,
  verification_status      VARCHAR(20) DEFAULT 'pending'
    CHECK (verification_status IN ('pending','approved','rejected')),
  rejection_reason         TEXT,
  reviewed_by              UUID REFERENCES users(id),
  approved_at              TIMESTAMPTZ,
  business_tier            VARCHAR(20)
    CHECK (business_tier IN ('starter','growth','enterprise')),
  tier_expires_at          TIMESTAMPTZ,
  tier_price_usd           DECIMAL(10,4),
  max_workers              INT DEFAULT 5,
  total_team_jobs          INT DEFAULT 0,
  average_team_rating      DECIMAL(3,2) DEFAULT 0.00,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Business team members (workers added under a business)
CREATE TABLE IF NOT EXISTS business_team_members (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id   UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  worker_id     UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  role          VARCHAR(50) DEFAULT 'worker',
  added_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_business_team_business ON business_team_members(business_id);
CREATE INDEX IF NOT EXISTS idx_business_team_worker ON business_team_members(worker_id);

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_profile_own" ON business_profiles;
CREATE POLICY "business_profile_own"
  ON business_profiles FOR ALL USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "business_profile_read_approved" ON business_profiles;
CREATE POLICY "business_profile_read_approved"
  ON business_profiles FOR SELECT USING (verification_status = 'approved');


-- ============================================================
-- WIAMAPP MIGRATION 011 â€” WiamTrust Score System
-- Â© 2026 WiamApp. Powered by WiamLabs
-- ============================================================

-- Trust scores for workers and customers
CREATE TABLE IF NOT EXISTS trust_scores (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  trust_score           DECIMAL(5,2) DEFAULT 0.00 CHECK (trust_score BETWEEN 0 AND 100),
  score_label           VARCHAR(20) DEFAULT 'Unrated'
    CHECK (score_label IN ('Unrated','Building','Trusted','Highly Trusted','Elite Trust')),
  total_jobs            INT DEFAULT 0,
  avg_rating            DECIMAL(3,2) DEFAULT 0.00,
  cancellation_rate     DECIMAL(5,4) DEFAULT 0.00,
  dispute_rate          DECIMAL(5,4) DEFAULT 0.00,
  response_rate         DECIMAL(5,4) DEFAULT 1.00,
  verification_level    INT DEFAULT 0,
  activity_consistency  DECIMAL(5,4) DEFAULT 0.00,
  last_calculated       TIMESTAMPTZ DEFAULT NOW(),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_scores_user ON trust_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_trust_scores_score ON trust_scores(trust_score DESC);

-- Function: calculate WiamTrust score for a worker
CREATE OR REPLACE FUNCTION calculate_trust_score(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_score DECIMAL := 0;
  v_total_jobs INT;
  v_avg_rating DECIMAL;
  v_cancellation_rate DECIMAL;
  v_dispute_rate DECIMAL;
  v_response_rate DECIMAL;
  v_verification_level INT;
  v_jobs_score DECIMAL;
  v_label VARCHAR;
BEGIN
  -- Get worker profile data
  SELECT
    total_jobs_done,
    average_rating,
    response_rate
  INTO v_total_jobs, v_avg_rating, v_response_rate
  FROM worker_profiles WHERE user_id = p_user_id;

  -- Calculate cancellation rate
  SELECT
    CASE WHEN COUNT(*) > 0
    THEN COUNT(*) FILTER (WHERE status = 'cancelled')::DECIMAL / COUNT(*)
    ELSE 0 END
  INTO v_cancellation_rate
  FROM bookings WHERE
    worker_id = (SELECT id FROM worker_profiles WHERE user_id = p_user_id);

  -- Calculate dispute rate
  SELECT
    CASE WHEN COUNT(*) > 0
    THEN COUNT(*) FILTER (WHERE status = 'disputed')::DECIMAL / COUNT(*)
    ELSE 0 END
  INTO v_dispute_rate
  FROM bookings WHERE
    worker_id = (SELECT id FROM worker_profiles WHERE user_id = p_user_id);

  -- Verification level (0=none, 1=email, 2=ID verified)
  SELECT
    CASE WHEN is_verified THEN 2 ELSE 1 END
  INTO v_verification_level
  FROM worker_profiles WHERE user_id = p_user_id;

  -- Calculate score components (weights total 100)
  -- Jobs component (25 points): logarithmic scale so not too dominant
  v_jobs_score := LEAST(25, COALESCE(v_total_jobs, 0) * 0.5);

  -- Rating component (20 points)
  v_score := v_score + v_jobs_score;
  v_score := v_score + (COALESCE(v_avg_rating, 0) / 5) * 20;

  -- Cancellation rate (15 points â€” lower is better)
  v_score := v_score + (1 - COALESCE(v_cancellation_rate, 0)) * 15;

  -- Dispute rate (15 points â€” lower is better)
  v_score := v_score + (1 - COALESCE(v_dispute_rate, 0)) * 15;

  -- Response rate (10 points)
  v_score := v_score + COALESCE(v_response_rate, 1) * 10;

  -- Verification level (10 points)
  v_score := v_score + (v_verification_level / 2.0) * 10;

  -- Cap at 100
  v_score := LEAST(100, ROUND(v_score::NUMERIC, 2));

  -- Assign label
  v_label := CASE
    WHEN v_score >= 95 THEN 'Elite Trust'
    WHEN v_score >= 90 THEN 'Highly Trusted'
    WHEN v_score >= 80 THEN 'Trusted'
    WHEN v_score >= 50 THEN 'Building'
    ELSE 'Unrated'
  END;

  -- Update trust_scores table
  INSERT INTO trust_scores (user_id, trust_score, score_label,
    total_jobs, avg_rating, cancellation_rate, dispute_rate,
    response_rate, verification_level, last_calculated)
  VALUES (p_user_id, v_score, v_label,
    COALESCE(v_total_jobs, 0), COALESCE(v_avg_rating, 0),
    COALESCE(v_cancellation_rate, 0), COALESCE(v_dispute_rate, 0),
    COALESCE(v_response_rate, 1), v_verification_level, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    trust_score = v_score,
    score_label = v_label,
    total_jobs = COALESCE(v_total_jobs, 0),
    avg_rating = COALESCE(v_avg_rating, 0),
    cancellation_rate = COALESCE(v_cancellation_rate, 0),
    dispute_rate = COALESCE(v_dispute_rate, 0),
    response_rate = COALESCE(v_response_rate, 1),
    last_calculated = NOW();

  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-recalculate after every review
CREATE OR REPLACE FUNCTION trigger_trust_recalculation()
RETURNS TRIGGER AS $$
DECLARE worker_user_id UUID;
BEGIN
  SELECT user_id INTO worker_user_id
  FROM worker_profiles WHERE id = NEW.worker_id;
  PERFORM calculate_trust_score(worker_user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER recalculate_trust_on_review
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION trigger_trust_recalculation();


-- ============================================================
-- WIAMAPP MIGRATION 012 â€” Emergency Mode
-- Â© 2026 WiamApp. Powered by WiamLabs
-- ============================================================

-- Emergency job requests (different from standard bookings)
CREATE TABLE IF NOT EXISTS emergency_requests (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  category_id      UUID REFERENCES categories(id),
  description      TEXT NOT NULL,
  photo_urls       TEXT[],
  location_address TEXT NOT NULL,
  location_lat     DECIMAL(10,8),
  location_lng     DECIMAL(11,8),
  status           VARCHAR(30) DEFAULT 'open'
    CHECK (status IN ('open','accepted','expired','cancelled')),
  accepted_by      UUID REFERENCES worker_profiles(id),
  booking_id       UUID REFERENCES bookings(id),
  emergency_fee_pct DECIMAL(5,4) DEFAULT 0.20,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_status ON emergency_requests(status);
CREATE INDEX IF NOT EXISTS idx_emergency_category ON emergency_requests(category_id);

ALTER TABLE emergency_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emergency_own" ON emergency_requests;
CREATE POLICY "emergency_own"
  ON emergency_requests FOR ALL USING (auth.uid() = customer_id);


-- ============================================================
-- WIAMAPP MIGRATION 013 â€” Instant Quote System
-- Â© 2026 WiamApp. Powered by WiamLabs
-- ============================================================

-- Customer posts a job, workers submit quotes
CREATE TABLE IF NOT EXISTS quote_requests (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  category_id      UUID REFERENCES categories(id),
  title            VARCHAR(200),
  description      TEXT NOT NULL,
  photo_urls       TEXT[],
  location_address TEXT,
  preferred_date   TIMESTAMPTZ,
  budget_min_usd   DECIMAL(10,4),
  budget_max_usd   DECIMAL(10,4),
  status           VARCHAR(20) DEFAULT 'open'
    CHECK (status IN ('open','closed','cancelled')),
  expires_at       TIMESTAMPTZ,
  selected_quote_id UUID,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotes (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  request_id       UUID REFERENCES quote_requests(id) ON DELETE CASCADE,
  worker_id        UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  price_usd        DECIMAL(10,4) NOT NULL,
  timeline         TEXT,
  message          TEXT,
  availability     TEXT,
  status           VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','selected','rejected','expired')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_quotes_request ON quotes(request_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);

ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_requests_own" ON quote_requests;
CREATE POLICY "quote_requests_own"
  ON quote_requests FOR ALL USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "quote_requests_read_open" ON quote_requests;
CREATE POLICY "quote_requests_read_open"
  ON quote_requests FOR SELECT USING (status = 'open');

DROP POLICY IF EXISTS "quotes_worker_own" ON quotes;
CREATE POLICY "quotes_worker_own"
  ON quotes FOR ALL USING (
    auth.uid() = (SELECT user_id FROM worker_profiles WHERE id = worker_id)
  );


-- ============================================================
-- WIAMAPP MIGRATION 014 â€” Subscription Config & RevenueCat
-- Â© 2026 WiamApp. Powered by WiamLabs
-- ============================================================

-- All subscription prices stored here (editable from founder dashboard)
CREATE TABLE IF NOT EXISTS subscription_config (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  plan_key        VARCHAR(50) UNIQUE NOT NULL,
  plan_name       VARCHAR(100) NOT NULL,
  price_usd       DECIMAL(10,4) NOT NULL,
  price_usd_web   DECIMAL(10,4) NOT NULL,
  commission_rate DECIMAL(5,4) NOT NULL,
  revenuecat_id   VARCHAR(200),
  max_workers     INT DEFAULT 1,
  is_active       BOOLEAN DEFAULT true,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_by      UUID REFERENCES users(id)
);

-- Seed subscription plans
INSERT INTO subscription_config
  (plan_key, plan_name, price_usd, price_usd_web, commission_rate, revenuecat_id, max_workers)
VALUES
  ('free',        'Free Worker',       0.0000,  0.0000,  0.1500, NULL,                                     1),
  ('basic',       'Basic Worker',      2.5000,  2.0000,  0.1000, 'com.wiamlabs.wiamapp.basic_monthly',     1),
  ('pro',         'Pro Worker',        7.0000,  6.0000,  0.0700, 'com.wiamlabs.wiamapp.pro_monthly',       1),
  ('starter_biz', 'Starter Business', 22.0000, 20.0000,  0.0800, NULL,                                     5),
  ('growth_biz',  'Growth Business',  44.0000, 40.0000,  0.0800, NULL,                                    25),
  ('enterprise',  'Enterprise',       105.0000, 95.0000,  0.0700, NULL,                                  9999)
ON CONFLICT (plan_key) DO NOTHING;

-- Spotlight boost config
INSERT INTO subscription_config
  (plan_key, plan_name, price_usd, price_usd_web, commission_rate, revenuecat_id)
VALUES
  ('boost_standard', 'Spotlight Standard (3 days)',  1.5000, 1.5000, 0, 'com.wiamlabs.wiamapp.spotlight_standard'),
  ('boost_featured', 'Spotlight Featured (7 days)',  3.0000, 3.0000, 0, 'com.wiamlabs.wiamapp.spotlight_featured'),
  ('boost_premium',  'Spotlight Premium (14 days)',  6.0000, 6.0000, 0, 'com.wiamlabs.wiamapp.spotlight_premium'),
  ('boost_business', 'Spotlight Business (30 days)', 13.0000, 13.0000, 0, 'com.wiamlabs.wiamapp.spotlight_business')
ON CONFLICT (plan_key) DO NOTHING;

-- Exchange rates cache table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  base_currency VARCHAR(10) UNIQUE DEFAULT 'USD',
  rates         JSONB NOT NULL,
  fetched_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Add RevenueCat tracking to subscriptions table
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS source VARCHAR(30)
  DEFAULT 'revenuecat' CHECK (source IN ('revenuecat','paystack','manual'));
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS worker_user_id UUID REFERENCES users(id);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS revenuecat_product_id VARCHAR(200);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paystack_subscription_code VARCHAR(200);

-- Track platform earnings (commission)
CREATE TABLE IF NOT EXISTS platform_earnings (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id      UUID REFERENCES bookings(id),
  payment_id      UUID REFERENCES payments(id),
  earning_type    VARCHAR(30) CHECK (
    earning_type IN ('commission','subscription','spotlight_boost',
                     'emergency_fee','business_account')
  ),
  amount_usd      DECIMAL(10,4) NOT NULL,
  currency        VARCHAR(10),
  amount_local    DECIMAL(10,4),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_earnings_type ON platform_earnings(earning_type);
CREATE INDEX IF NOT EXISTS idx_earnings_date ON platform_earnings(created_at);


-- ============================================================
-- WIAMAPP MIGRATION 015 â€” Performance Rankings & Online Status
-- Â© 2026 WiamApp. Powered by WiamLabs
-- ============================================================

-- Worker performance rankings (updated daily)
CREATE TABLE IF NOT EXISTS performance_rankings (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worker_id       UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES categories(id),
  city            VARCHAR(100),
  rank_type       VARCHAR(50) CHECK (
    rank_type IN ('top_rated','fastest_responder','most_jobs_month',
                  'highest_trust','most_repeat_customers')
  ),
  rank_position   INT NOT NULL,
  score           DECIMAL(10,4),
  calculated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(worker_id, category_id, rank_type)
);

CREATE INDEX IF NOT EXISTS idx_rankings_category ON performance_rankings(category_id, rank_type);

-- Online status tracking
CREATE TABLE IF NOT EXISTS user_online_status (
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  is_online      BOOLEAN DEFAULT false,
  last_seen_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Function to get online status label
CREATE OR REPLACE FUNCTION get_online_status(p_user_id UUID)
RETURNS VARCHAR AS $$
DECLARE last_seen TIMESTAMPTZ;
BEGIN
  SELECT last_seen_at INTO last_seen
  FROM user_online_status WHERE user_id = p_user_id;

  IF last_seen IS NULL THEN RETURN 'offline'; END IF;
  IF last_seen > NOW() - INTERVAL '5 minutes' THEN RETURN 'online'; END IF;
  IF last_seen > NOW() - INTERVAL '30 minutes' THEN RETURN 'recently'; END IF;
  RETURN 'offline';
END;
$$ LANGUAGE plpgsql;

-- Add online status to RLS
ALTER TABLE user_online_status ENABLE ROW LEVEL SECURITY;

-- Users can update their own status
DROP POLICY IF EXISTS "online_status_own" ON user_online_status;
CREATE POLICY "online_status_own"
  ON user_online_status FOR ALL USING (auth.uid() = user_id);

-- Anyone can read online status
DROP POLICY IF EXISTS "online_status_read_all" ON user_online_status;
CREATE POLICY "online_status_read_all"
  ON user_online_status FOR SELECT USING (true);

-- Add bookings.payment_status column
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS
  payment_status VARCHAR(20) DEFAULT 'unpaid'
  CHECK (payment_status IN ('unpaid','paid','refunded'));

-- Add bookings.worker_user_id for easier queries
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS worker_user_id UUID REFERENCES users(id);

-- Enable realtime for performance rankings and online status
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE user_online_status; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE performance_rankings; EXCEPTION WHEN others THEN NULL; END $$;



-- ============================================================
-- FILE: 016_team_members.sql
-- ============================================================

-- ============================================================
-- WIAMAPP MIGRATION 016 â€” Team Members System
-- Â© 2026 WiamApp. Powered by WiamLabs
-- Run after 015
-- ============================================================

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  full_name         VARCHAR(100) NOT NULL,
  personal_email    VARCHAR(150) NOT NULL UNIQUE,
  role              VARCHAR(100) NOT NULL,
  department        VARCHAR(100) NOT NULL,
  position          VARCHAR(200),
  code_hash         VARCHAR(64) NOT NULL,
  code_expires_at   TIMESTAMPTZ NOT NULL,
  permissions       TEXT[] DEFAULT '{}',
  dashboard_key     VARCHAR(100),
  is_active         BOOLEAN DEFAULT true,
  last_login_at     TIMESTAMPTZ,
  deactivated_at    TIMESTAMPTZ,
  hired_at          TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_code ON team_members(code_hash);
CREATE INDEX IF NOT EXISTS idx_team_members_active ON team_members(is_active);

-- Career applications table
CREATE TABLE IF NOT EXISTS career_applications (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  position_id       VARCHAR(100) NOT NULL,
  position_title    VARCHAR(200) NOT NULL,
  full_name         VARCHAR(100) NOT NULL,
  email             VARCHAR(150) NOT NULL,
  phone             VARCHAR(20) NOT NULL,
  country           VARCHAR(100),
  city              VARCHAR(100),
  years_experience  INT,
  relevant_skills   TEXT,
  previous_roles    TEXT,
  why_wiamapp       TEXT,
  what_they_bring   TEXT,
  availability      VARCHAR(50),
  linkedin_url      VARCHAR(200),
  portfolio_url     VARCHAR(200),
  cv_s3_key         TEXT,
  references_info   TEXT,
  status            VARCHAR(30) DEFAULT 'pending'
    CHECK (status IN ('pending','reviewing','approved','rejected')),
  rejection_reason  TEXT,
  reviewer_notes    TEXT,
  reviewed_by       UUID,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_apps_status ON career_applications(status);
CREATE INDEX IF NOT EXISTS idx_career_apps_position ON career_applications(position_id);

-- Career positions (what shows on the website careers page)
CREATE TABLE IF NOT EXISTS career_positions (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  position_key    VARCHAR(100) UNIQUE NOT NULL,
  title           VARCHAR(200) NOT NULL,
  department      VARCHAR(100) NOT NULL,
  location        VARCHAR(100) DEFAULT 'Remote',
  job_type        VARCHAR(50) DEFAULT 'Full-time',
  description     TEXT NOT NULL,
  responsibilities TEXT NOT NULL,
  requirements    TEXT NOT NULL,
  nice_to_have    TEXT,
  is_active       BOOLEAN DEFAULT true,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed all career positions
INSERT INTO career_positions (position_key, title, department, location, job_type, description, responsibilities, requirements) VALUES

-- Leadership
('cto', 'Chief Technology Officer', 'Leadership', 'Remote / Accra', 'Full-time',
 'Lead all technical decisions and engineering teams for WiamApp Africa.',
 'Oversee technical architecture, lead engineering teams, make technology decisions, manage DevOps and security.',
 'Strong software engineering background, 5+ years leadership, experience with mobile and backend systems.'),

('coo', 'Chief Operations Officer', 'Leadership', 'Accra, Ghana', 'Full-time',
 'Oversee daily operations of WiamApp platform across Ghana and Nigeria.',
 'Manage operations teams, optimize processes, coordinate between departments, oversee growth strategy.',
 '5+ years operations management, experience scaling a tech product in Africa.'),

-- Platform Administration
('senior_admin', 'Senior Platform Administrator', 'Administration', 'Remote', 'Full-time',
 'Control and manage the WiamApp platform, users, and operations from the admin dashboard.',
 'Manage user accounts, review platform activity, enforce policies, handle escalations.',
 'Strong attention to detail, experience with digital platforms, excellent judgment.'),

('junior_admin', 'Junior Platform Administrator', 'Administration', 'Remote', 'Full-time',
 'Support platform administration tasks and help manage daily operations.',
 'Assist with user management, follow up on flagged accounts, support senior admin.',
 'Organized, detail-oriented, comfortable with digital tools.'),

('content_mod', 'Content Moderator', 'Trust and Safety', 'Remote', 'Full-time',
 'Review and moderate all Spotlight posts to maintain platform quality and safety.',
 'Review post submissions, approve or reject content, enforce content policies, report trends.',
 'Good judgment on appropriate content, familiarity with social platforms, consistent standards.'),

('doc_reviewer', 'Document Reviewer', 'Trust and Safety', 'Remote', 'Full-time',
 'Review identity documents submitted by workers and customers for verification.',
 'Review ID documents and selfies, verify authenticity, approve or reject with reasons, maintain queue within 24 hours.',
 'Detail-oriented, able to spot inconsistencies, understanding of African ID documents.'),

('biz_reviewer', 'Business Verification Reviewer', 'Trust and Safety', 'Accra, Ghana', 'Full-time',
 'Review and verify business account applications for the Gold Badge certification.',
 'Review business registration documents, verify legitimacy, approve or reject applications.',
 'Knowledge of Ghana business registration processes, strong verification skills.'),

('dispute_officer', 'Dispute Resolution Officer', 'Operations', 'Remote', 'Full-time',
 'Resolve disputes between customers and workers fairly and professionally.',
 'Review disputed bookings, analyze evidence, make fair decisions, communicate outcomes.',
 'Excellent judgment, strong communication, ability to remain neutral.'),

('fraud_analyst', 'Fraud Analyst', 'Trust and Safety', 'Remote', 'Full-time',
 'Investigate fraud reports and protect the platform from bad actors.',
 'Investigate fraud cases, analyze patterns, compile evidence, coordinate with authorities when needed.',
 'Analytical mindset, attention to detail, understanding of fraud patterns.'),

('emergency_officer', 'Emergency Response Officer', 'Trust and Safety', 'Accra, Ghana', 'Full-time',
 'Monitor and respond to SOS alerts from workers and customers on the platform.',
 'Monitor SOS dashboard 24/7 in rotation, respond immediately to alerts, coordinate with emergency services.',
 'Calm under pressure, fast decision maker, knowledge of Ghana emergency services.'),

-- Customer and Worker Support
('cs_lead', 'Customer Support Lead', 'Support', 'Remote', 'Full-time',
 'Lead the customer support team and ensure all customers receive excellent service.',
 'Manage support team, handle escalations, improve support processes, track satisfaction metrics.',
 '3+ years customer support experience, leadership skills, excellent communication.'),

('cs_rep', 'Customer Support Representative', 'Support', 'Remote', 'Full-time',
 'Help customers with bookings, payments, and platform issues.',
 'Respond to customer tickets, resolve booking issues, assist with payments, escalate complex cases.',
 'Patient, clear communicator, fast typist, empathetic approach.'),

('ws_rep', 'Worker Support Representative', 'Support', 'Remote', 'Full-time',
 'Help workers succeed on the platform â€” from onboarding to earnings.',
 'Support worker onboarding, resolve subscription issues, handle worker complaints.',
 'Empathetic, understanding of the informal economy, excellent Twi or Hausa a bonus.'),

('biz_manager', 'Business Account Manager', 'Sales', 'Accra, Ghana', 'Full-time',
 'Manage relationships with Starter and Growth business accounts.',
 'Onboard new business accounts, support businesses in using the platform, upsell tier upgrades.',
 'Sales experience, relationship building, knowledge of local business culture.'),

('enterprise_manager', 'Enterprise Account Manager', 'Sales', 'Accra, Ghana', 'Full-time',
 'Manage WiamApp Enterprise clients with white-glove, dedicated service.',
 'Own relationships with Enterprise accounts, conduct quarterly reviews, handle all enterprise needs.',
 '5+ years B2B account management, experience with corporate clients in Ghana or Nigeria.'),

-- Technical Team
('backend_dev', 'Backend Developer', 'Engineering', 'Remote', 'Full-time',
 'Build and maintain the WiamApp backend APIs and server infrastructure.',
 'Build RESTful APIs, maintain database, optimize performance, write clean Node.js code.',
 'Strong Node.js and PostgreSQL skills, experience with Supabase or similar, API design experience.'),

('mobile_dev', 'Mobile Developer', 'Engineering', 'Remote', 'Full-time',
 'Build and improve the WiamApp React Native / Expo mobile application.',
 'Build new screens and features, fix bugs, optimize performance, improve UI.',
 'Strong React Native and Expo experience, JavaScript/TypeScript, mobile UX understanding.'),

('frontend_dev', 'Frontend Developer', 'Engineering', 'Remote', 'Full-time',
 'Build the WiamApp website and team dashboard interfaces.',
 'Build Next.js website, develop team dashboards, maintain web interfaces.',
 'Strong Next.js and React experience, CSS and responsive design, TypeScript.'),

('db_admin', 'Database Administrator', 'Engineering', 'Remote', 'Full-time',
 'Manage, optimize, and secure the WiamApp Supabase/PostgreSQL database.',
 'Write and review migrations, optimize queries, manage backups, ensure data integrity.',
 'Strong PostgreSQL skills, experience with Supabase or similar, RLS and security knowledge.'),

('devops', 'DevOps Engineer', 'Engineering', 'Remote', 'Full-time',
 'Manage WiamApp deployments, infrastructure, and reliability.',
 'Manage Render deployments, Cloudflare setup, monitor uptime, improve CI/CD pipeline.',
 'Experience with cloud deployments, Node.js servers, Cloudflare, monitoring tools.'),

('security_eng', 'Security Engineer', 'Engineering', 'Remote', 'Full-time',
 'Protect WiamApp users, data, and infrastructure from security threats.',
 'Conduct security audits, review code for vulnerabilities, manage security incidents.',
 'Strong security background, web and mobile security, experience with penetration testing.'),

('qa_lead', 'QA Lead', 'Engineering', 'Remote', 'Full-time',
 'Lead quality assurance for all WiamApp releases.',
 'Create test plans, manage QA team, approve releases, maintain quality standards.',
 '3+ years QA experience, mobile and web testing, strong testing methodology.'),

('qa_tester', 'QA Tester', 'Engineering', 'Remote', 'Full-time',
 'Test new features and ensure WiamApp works perfectly for all users.',
 'Test new features before release, report bugs clearly, verify fixes, test on Android and iOS.',
 'Methodical approach, good bug reporting skills, experience with mobile apps.'),

('ui_designer', 'UI/UX Designer', 'Design', 'Remote', 'Full-time',
 'Design beautiful, usable screens and interfaces for WiamApp.',
 'Design app screens, website pages, and team dashboards. Maintain brand consistency.',
 'Strong Figma skills, mobile UX experience, understanding of WiamLabs brand guidelines.'),

-- Business and Marketing
('marketing_mgr', 'Marketing Manager', 'Marketing', 'Accra, Ghana', 'Full-time',
 'Lead all marketing efforts to grow WiamApp across Ghana and Nigeria.',
 'Plan and execute marketing campaigns, manage budget, coordinate with team, track metrics.',
 '4+ years marketing experience, digital marketing skills, experience in African markets.'),

('social_media', 'Social Media Manager', 'Marketing', 'Remote', 'Full-time',
 'Manage WiamApp social media presence across Facebook, Instagram, Twitter, TikTok.',
 'Create content, manage community, run campaigns, grow followers, respond to comments.',
 'Strong content creation skills, social media experience, understanding of Ghana/Nigeria online culture.'),

('community_mgr', 'Community Manager', 'Marketing', 'Accra, Ghana', 'Full-time',
 'Build and manage the WiamApp community of workers and customers.',
 'Manage WhatsApp groups, organize events, gather feedback, be the face of WiamApp locally.',
 'Excellent communication, well-connected in Accra, passionate about helping workers.'),

('partnerships_mgr', 'Partnerships Manager', 'Business Development', 'Accra, Ghana', 'Full-time',
 'Build strategic partnerships with businesses, trade associations, and government bodies.',
 'Identify and approach partners, negotiate agreements, manage relationships.',
 'Strong networking skills, business development background, knowledge of Ghana business landscape.'),

-- Finance
('financial_mgr', 'Financial Manager', 'Finance', 'Accra, Ghana', 'Full-time',
 'Oversee all financial operations including revenue, commissions, and payouts.',
 'Manage revenue tracking, commission reconciliation, payout processing, financial reports.',
 'Finance or accounting background, experience with fintech or marketplace businesses.'),

('commission_analyst', 'Commission Analyst', 'Finance', 'Remote', 'Full-time',
 'Monitor, analyze, and reconcile all commission transactions on the platform.',
 'Review commission records, identify discrepancies, generate reports, support financial manager.',
 'Strong analytical skills, Excel or Google Sheets, attention to numerical detail.'),

-- Legal and Compliance
('legal_officer', 'Legal Officer', 'Legal', 'Accra, Ghana', 'Full-time',
 'Handle all legal matters including contracts, disputes, and regulatory compliance.',
 'Draft and review contracts, handle legal disputes, advise on regulatory requirements.',
 'Legal qualification in Ghana or Nigeria, experience with tech or marketplace companies.'),

('data_protection', 'Data Protection Officer', 'Legal', 'Remote', 'Full-time',
 'Ensure WiamApp complies with Ghana Data Protection Act and international privacy standards.',
 'Review data practices, handle data requests, maintain privacy policy, respond to breaches.',
 'Knowledge of Ghana Data Protection Act 2012, GDPR familiarity, legal or compliance background.')

ON CONFLICT (position_key) DO NOTHING;

-- RLS for team tables
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_positions ENABLE ROW LEVEL SECURITY;

-- Career positions are public (website)
DROP POLICY IF EXISTS "career_positions_public_read" ON career_positions;
CREATE POLICY "career_positions_public_read"
  ON career_positions FOR SELECT USING (is_active = true);

-- Applications: only admin can read
DROP POLICY IF EXISTS "career_apps_admin_only" ON career_applications;
CREATE POLICY "career_apps_admin_only"
  ON career_applications FOR SELECT USING (false);

-- Anyone can submit application (public route)
DROP POLICY IF EXISTS "career_apps_public_insert" ON career_applications;
CREATE POLICY "career_apps_public_insert"
  ON career_applications FOR INSERT WITH CHECK (true);



-- ============================================================
-- FILE: 017_trust_system.sql
-- ============================================================

-- ============================================================
-- WIAMAPP MIGRATION 017 â€” Trust and Follow System
-- Â© 2026 WiamApp. Powered by WiamLabs
-- Run after 016_team_members.sql
-- ============================================================

-- Worker trusts table
CREATE TABLE IF NOT EXISTS worker_trusts (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  worker_id   UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_worker_trusts_worker   ON worker_trusts(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_trusts_customer ON worker_trusts(customer_id);

-- Business follows table
CREATE TABLE IF NOT EXISTS business_follows (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_business_follows_business ON business_follows(business_id);
CREATE INDEX IF NOT EXISTS idx_business_follows_customer ON business_follows(customer_id);

-- Add trust_count and follow_count columns
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS trust_count INT DEFAULT 0;

ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS follow_count INT DEFAULT 0;

-- â”€â”€â”€ RPC FUNCTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Increment worker trust count
CREATE OR REPLACE FUNCTION increment_worker_trust(p_worker_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE worker_profiles
  SET trust_count = trust_count + 1
  WHERE id = p_worker_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement worker trust count
CREATE OR REPLACE FUNCTION decrement_worker_trust(p_worker_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE worker_profiles
  SET trust_count = GREATEST(0, trust_count - 1)
  WHERE id = p_worker_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment business follow count
CREATE OR REPLACE FUNCTION increment_business_follow(p_business_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE business_profiles
  SET follow_count = follow_count + 1
  WHERE id = p_business_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement business follow count
CREATE OR REPLACE FUNCTION decrement_business_follow(p_business_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE business_profiles
  SET follow_count = GREATEST(0, follow_count - 1)
  WHERE id = p_business_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment spotlight views
CREATE OR REPLACE FUNCTION increment_spotlight_views(post_ids UUID[])
RETURNS void AS $$
BEGIN
  UPDATE spotlight_posts
  SET views_count = views_count + 1
  WHERE id = ANY(post_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment spotlight report count
CREATE OR REPLACE FUNCTION increment_report_count(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE spotlight_posts
  SET report_count = report_count + 1
  WHERE id = post_id;

  -- Auto-hide if too many reports
  UPDATE spotlight_posts
  SET status = 'pending_review'
  WHERE id = post_id AND report_count >= 5 AND status = 'approved';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update WiamTrust score including trust_count factor
CREATE OR REPLACE FUNCTION calculate_trust_score(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_score              DECIMAL := 0;
  v_total_jobs         INT;
  v_avg_rating         DECIMAL;
  v_cancellation_rate  DECIMAL;
  v_dispute_rate       DECIMAL;
  v_response_rate      DECIMAL;
  v_verification_level INT;
  v_trust_count        INT;
  v_label              VARCHAR;
  v_worker_id          UUID;
BEGIN
  SELECT id INTO v_worker_id
  FROM worker_profiles WHERE user_id = p_user_id;

  IF v_worker_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT total_jobs_done, average_rating, response_rate, trust_count
  INTO v_total_jobs, v_avg_rating, v_response_rate, v_trust_count
  FROM worker_profiles WHERE id = v_worker_id;

  SELECT CASE WHEN COUNT(*) > 0
    THEN COUNT(*) FILTER (WHERE status = 'cancelled')::DECIMAL / COUNT(*) ELSE 0 END
  INTO v_cancellation_rate
  FROM bookings WHERE worker_id = v_worker_id;

  SELECT CASE WHEN COUNT(*) > 0
    THEN COUNT(*) FILTER (WHERE status = 'disputed')::DECIMAL / COUNT(*) ELSE 0 END
  INTO v_dispute_rate
  FROM bookings WHERE worker_id = v_worker_id;

  SELECT CASE WHEN is_verified THEN 2 ELSE 1 END
  INTO v_verification_level
  FROM worker_profiles WHERE id = v_worker_id;

  -- Score components
  -- Jobs (25 pts): logarithmic scale
  v_score := v_score + LEAST(25, COALESCE(v_total_jobs, 0) * 0.5);
  -- Rating (20 pts)
  v_score := v_score + (COALESCE(v_avg_rating, 0) / 5.0) * 20;
  -- Trust count (15 pts): logarithmic scale
  v_score := v_score + LEAST(15, COALESCE(v_trust_count, 0) * 0.3);
  -- Cancellation rate (15 pts)
  v_score := v_score + (1 - COALESCE(v_cancellation_rate, 0)) * 15;
  -- Dispute rate (10 pts)
  v_score := v_score + (1 - COALESCE(v_dispute_rate, 0)) * 10;
  -- Response rate (10 pts)
  v_score := v_score + COALESCE(v_response_rate, 1) * 10;
  -- Verification (5 pts)
  v_score := v_score + (v_verification_level / 2.0) * 5;

  v_score := LEAST(100, ROUND(v_score::NUMERIC, 2));

  v_label := CASE
    WHEN v_score >= 95 THEN 'Elite Trust'
    WHEN v_score >= 90 THEN 'Highly Trusted'
    WHEN v_score >= 80 THEN 'Trusted'
    WHEN v_score >= 50 THEN 'Building'
    ELSE 'Unrated'
  END;

  INSERT INTO trust_scores (
    user_id, trust_score, score_label,
    total_jobs, avg_rating, cancellation_rate,
    dispute_rate, response_rate, verification_level, last_calculated
  ) VALUES (
    p_user_id, v_score, v_label,
    COALESCE(v_total_jobs, 0), COALESCE(v_avg_rating, 0),
    COALESCE(v_cancellation_rate, 0), COALESCE(v_dispute_rate, 0),
    COALESCE(v_response_rate, 1), v_verification_level, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    trust_score = v_score, score_label = v_label,
    total_jobs = COALESCE(v_total_jobs, 0),
    avg_rating = COALESCE(v_avg_rating, 0),
    cancellation_rate = COALESCE(v_cancellation_rate, 0),
    dispute_rate = COALESCE(v_dispute_rate, 0),
    response_rate = COALESCE(v_response_rate, 1),
    last_calculated = NOW();

  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS for trust tables
ALTER TABLE worker_trusts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_follows ENABLE ROW LEVEL SECURITY;

-- Anyone can read trust counts (public info)
DROP POLICY IF EXISTS "worker_trusts_read_all" ON worker_trusts;
CREATE POLICY "worker_trusts_read_all"
  ON worker_trusts FOR SELECT USING (true);

-- Only verified customers can insert trusts
DROP POLICY IF EXISTS "worker_trusts_insert_customer" ON worker_trusts;
CREATE POLICY "worker_trusts_insert_customer"
  ON worker_trusts FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Customer can only delete their own trusts
DROP POLICY IF EXISTS "worker_trusts_delete_own" ON worker_trusts;
CREATE POLICY "worker_trusts_delete_own"
  ON worker_trusts FOR DELETE
  USING (auth.uid() = customer_id);

-- Business follows
DROP POLICY IF EXISTS "business_follows_read_all" ON business_follows;
CREATE POLICY "business_follows_read_all"
  ON business_follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "business_follows_insert_customer" ON business_follows;
CREATE POLICY "business_follows_insert_customer"
  ON business_follows FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "business_follows_delete_own" ON business_follows;
CREATE POLICY "business_follows_delete_own"
  ON business_follows FOR DELETE
  USING (auth.uid() = customer_id);



-- ============================================================
-- FILE: 018_enhanced_profiles.sql
-- ============================================================

-- ============================================================
-- WIAMAPP MIGRATION 018 â€” Enhanced Customer and Worker Profiles
-- Â© 2026 WiamApp. Powered by WiamLabs
-- Run after 017_trust_system.sql
-- ============================================================

-- Add push token to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMPTZ;

-- Add response time tracking to worker profiles
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS last_response_at TIMESTAMPTZ;

-- Add subscription fields to worker profiles
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS subscription_expires TIMESTAMPTZ;
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'free';
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS badge_type VARCHAR(30) DEFAULT 'none';

-- Add check_in columns to worker_profiles
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS check_in_lat  DECIMAL(10,8);
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS check_in_lng  DECIMAL(11,8);
ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS check_in_at   TIMESTAMPTZ;

-- Worker availability calendar
CREATE TABLE IF NOT EXISTS worker_availability (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worker_id    UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  day_of_week  INT CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 6=Sat
  start_hour   INT CHECK (start_hour BETWEEN 0 AND 23),
  end_hour     INT CHECK (end_hour BETWEEN 1 AND 24),
  is_available BOOLEAN DEFAULT true,
  UNIQUE(worker_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_availability_worker ON worker_availability(worker_id);

-- Saved / favourite workers for customers
-- (this is handled via worker_trusts â€” Trust = Save)
-- No separate table needed â€” Trust serves as Saved Workers

-- Customer booking history summary
CREATE OR REPLACE VIEW customer_booking_summary AS
SELECT
  b.customer_id,
  COUNT(*) AS total_bookings,
  COUNT(*) FILTER (WHERE b.status = 'completed') AS completed_bookings,
  COUNT(*) FILTER (WHERE b.status = 'cancelled') AS cancelled_bookings,
  COUNT(*) FILTER (WHERE b.status = 'disputed')  AS disputed_bookings,
  SUM(p.amount) FILTER (WHERE p.payment_status = 'success') AS total_spent_usd
FROM bookings b
LEFT JOIN payments p ON p.booking_id = b.id
GROUP BY b.customer_id;

-- Worker booking history summary
CREATE OR REPLACE VIEW worker_booking_summary AS
SELECT
  wp.user_id,
  wp.id AS worker_profile_id,
  COUNT(*) AS total_bookings,
  COUNT(*) FILTER (WHERE b.status = 'completed') AS completed_jobs,
  COUNT(*) FILTER (WHERE b.status = 'cancelled') AS cancelled_jobs,
  COUNT(*) FILTER (WHERE b.status = 'disputed')  AS disputed_jobs,
  ROUND(AVG(r.rating)::NUMERIC, 2) AS avg_rating,
  SUM(
    (p.amount * (1 - COALESCE(sc.commission_rate, 0.15)))
  ) FILTER (WHERE p.payment_status = 'success') AS total_earned_usd
FROM worker_profiles wp
LEFT JOIN bookings b ON b.worker_id = wp.id
LEFT JOIN reviews r ON r.worker_id = wp.id
LEFT JOIN payments p ON p.booking_id = b.id
LEFT JOIN subscription_config sc ON sc.plan_key = wp.subscription_plan
GROUP BY wp.user_id, wp.id;

-- Add indices for performance
CREATE INDEX IF NOT EXISTS idx_bookings_customer_status
  ON bookings(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_worker_status
  ON bookings(worker_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_booking_status
  ON payments(booking_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_trust
  ON worker_profiles(trust_count DESC);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_subscription
  ON worker_profiles(subscription_plan, badge_type);

-- Enable realtime on trust tables
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE worker_trusts; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE business_follows; EXCEPTION WHEN others THEN NULL; END $$;



-- ============================================================
-- FILE: 019_enterprise_locations.sql
-- ============================================================

-- ============================================================
-- WIAMAPP MIGRATION 019 â€” Enterprise Branch Locations
-- Â© 2026 WiamApp. Powered by WiamLabs
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

-- â”€â”€â”€ RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Writes happen through the backend (service role, bypasses RLS).
-- Direct reads are limited to the enterprise account owner.
ALTER TABLE enterprise_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enterprise_locations_read_owner" ON enterprise_locations;
CREATE POLICY "enterprise_locations_read_owner"
  ON enterprise_locations FOR SELECT
  USING (
    enterprise_id IN (
      SELECT id FROM business_profiles WHERE owner_id = auth.uid()
    )
  );



-- ============================================================
-- FILE: 020_recurring_contracts.sql
-- ============================================================

-- ============================================================
-- WIAMAPP MIGRATION 020 â€” Recurring Service Contracts
-- Â© 2026 WiamApp. Powered by WiamLabs
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

-- â”€â”€â”€ RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE recurring_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recurring_contracts_read_owner" ON recurring_contracts;
CREATE POLICY "recurring_contracts_read_owner"
  ON recurring_contracts FOR SELECT
  USING (
    enterprise_id IN (
      SELECT id FROM business_profiles WHERE owner_id = auth.uid()
    )
  );



-- ============================================================
-- FILE: 021_enterprise_vendors.sql
-- ============================================================

-- ============================================================
-- WIAMAPP MIGRATION 021 â€” Enterprise Preferred Vendors
-- Â© 2026 WiamApp. Powered by WiamLabs
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

-- â”€â”€â”€ RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE enterprise_vendors ENABLE ROW LEVEL SECURITY;

-- Enterprise owner can see their vendor list
DROP POLICY IF EXISTS "enterprise_vendors_read_owner" ON enterprise_vendors;
CREATE POLICY "enterprise_vendors_read_owner"
  ON enterprise_vendors FOR SELECT
  USING (
    enterprise_id IN (
      SELECT id FROM business_profiles WHERE owner_id = auth.uid()
    )
  );

-- The worker can see (and confirm) vendor invitations addressed to them
DROP POLICY IF EXISTS "enterprise_vendors_read_worker" ON enterprise_vendors;
CREATE POLICY "enterprise_vendors_read_worker"
  ON enterprise_vendors FOR SELECT
  USING (
    worker_id IN (
      SELECT id FROM worker_profiles WHERE user_id = auth.uid()
    )
  );



-- ============================================================
-- FILE: 022_sla_contracts.sql
-- ============================================================

-- ============================================================
-- WIAMAPP MIGRATION 022 â€” SLA Contracts and Breach Log
-- Â© 2026 WiamApp. Powered by WiamLabs
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

-- â”€â”€â”€ RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE sla_contracts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_breach_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sla_contracts_read_owner" ON sla_contracts;
CREATE POLICY "sla_contracts_read_owner"
  ON sla_contracts FOR SELECT
  USING (
    enterprise_id IN (
      SELECT id FROM business_profiles WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "sla_breach_log_read_owner" ON sla_breach_log;
CREATE POLICY "sla_breach_log_read_owner"
  ON sla_breach_log FOR SELECT
  USING (
    enterprise_id IN (
      SELECT id FROM business_profiles WHERE owner_id = auth.uid()
    )
  );



-- ============================================================
-- FILE: 023_enterprise_invoices.sql
-- ============================================================

-- ============================================================
-- WIAMAPP MIGRATION 023 â€” Enterprise Monthly Invoices
-- Â© 2026 WiamApp. Powered by WiamLabs
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

-- â”€â”€â”€ RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE enterprise_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enterprise_invoices_read_owner" ON enterprise_invoices;
CREATE POLICY "enterprise_invoices_read_owner"
  ON enterprise_invoices FOR SELECT
  USING (
    enterprise_id IN (
      SELECT id FROM business_profiles WHERE owner_id = auth.uid()
    )
  );



-- ============================================================
-- FILE: categories_seed.sql
-- ============================================================

-- ============================================================
-- WIAMAPP — CATEGORIES SEED (12 categories + worker subtypes)
-- (color/sort_order columns are added FIRST so the INSERT works)
-- ============================================================
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color VARCHAR(20);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

-- ============================================================
-- WIAMAPP â€” COMPLETE CATEGORIES SEED
-- All 12 Service Categories + Worker Types
-- Â© 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- Run this in Supabase SQL Editor after migrations 001-006
-- ============================================================

-- Clear existing categories first
TRUNCATE categories CASCADE;

-- â”€â”€â”€ INSERT ALL 12 CATEGORIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO categories (id, name, icon, description, color, sort_order, is_active) VALUES

('c1000000-0000-0000-0000-000000000001',
 'Building & Construction',
 'construct-outline',
 'Heavy-duty tradespeople who build structures, renovate, and do major construction work.',
 '#8B4513', 1, TRUE),

('c1000000-0000-0000-0000-000000000002',
 'Plumbing & Water Systems',
 'water-outline',
 'All plumbing, water supply, drainage, and water system specialists.',
 '#1E90FF', 2, TRUE),

('c1000000-0000-0000-0000-000000000003',
 'Electrical & Power Engineering',
 'flash-outline',
 'Electricians, solar installers, generator mechanics and power specialists.',
 '#FFD700', 3, TRUE),

('c1000000-0000-0000-0000-000000000004',
 'Automotive & Mechanical Repair',
 'car-outline',
 'Car mechanics, auto electricians, and all vehicle repair specialists.',
 '#FF4500', 4, TRUE),

('c1000000-0000-0000-0000-000000000005',
 'Finishing, Painting & Decor',
 'brush-outline',
 'Painters, ceiling designers, interior decorators and finishing specialists.',
 '#9B59B6', 5, TRUE),

('c1000000-0000-0000-0000-000000000006',
 'Cleaning & Property Maintenance',
 'sparkles-outline',
 'Cleaners, fumigators, pest control and property maintenance workers.',
 '#00CED1', 6, TRUE),

('c1000000-0000-0000-0000-000000000007',
 'Hair, Beauty & Personal Care',
 'cut-outline',
 'Barbers, hairstylists, makeup artists, nail technicians and beauty professionals.',
 '#FF69B4', 7, TRUE),

('c1000000-0000-0000-0000-000000000008',
 'Hospitality, Catering & Food',
 'restaurant-outline',
 'Event caterers, private chefs, bakers and food service professionals.',
 '#FF8C00', 8, TRUE),

('c1000000-0000-0000-0000-000000000009',
 'Photography, Media & Creative',
 'camera-outline',
 'Photographers, videographers, drone operators and creative professionals.',
 '#4169E1', 9, TRUE),

('c1000000-0000-0000-0000-000000000010',
 'Logistics, Transport & Delivery',
 'bicycle-outline',
 'Dispatch riders, delivery drivers, movers and transport professionals.',
 '#228B22', 10, TRUE),

('c1000000-0000-0000-0000-000000000011',
 'Education, Tuition & Lessons',
 'book-outline',
 'Home tutors, language teachers, music instructors and skill tutors.',
 '#8B0000', 11, TRUE),

('c1000000-0000-0000-0000-000000000012',
 'Events, Entertainment & Sound',
 'musical-notes-outline',
 'Event planners, DJs, MCs, sound engineers and event professionals.',
 '#DC143C', 12, TRUE)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;


-- â”€â”€â”€ INSERT WORKER SUBTYPES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- These are the specific worker types under each category
-- Used for more detailed search and filtering

CREATE TABLE IF NOT EXISTS worker_subtypes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

-- Building & Construction
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000001', 'Mason / Bricklayer', 1),
('c1000000-0000-0000-0000-000000000001', 'Tile Installer', 2),
('c1000000-0000-0000-0000-000000000001', 'Carpenter (Roofing/Framing)', 3),
('c1000000-0000-0000-0000-000000000001', 'Ironmonger / Steel Bender', 4),
('c1000000-0000-0000-0000-000000000001', 'Welder / Fabricator', 5),
('c1000000-0000-0000-0000-000000000001', 'Concrete Worker', 6),
('c1000000-0000-0000-0000-000000000001', 'Scaffolding Worker', 7),
('c1000000-0000-0000-0000-000000000001', 'Roofing Specialist', 8),
('c1000000-0000-0000-0000-000000000001', 'Foundation Worker', 9),
('c1000000-0000-0000-0000-000000000001', 'Block Layer', 10);

-- Plumbing & Water Systems
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000002', 'Domestic Plumber', 1),
('c1000000-0000-0000-0000-000000000002', 'Borehole Driller', 2),
('c1000000-0000-0000-0000-000000000002', 'Water Tank Installer', 3),
('c1000000-0000-0000-0000-000000000002', 'Drainage Cleaner', 4),
('c1000000-0000-0000-0000-000000000002', 'Pipe Fitter', 5),
('c1000000-0000-0000-0000-000000000002', 'Swimming Pool Technician', 6),
('c1000000-0000-0000-0000-000000000002', 'Water Heater Installer', 7),
('c1000000-0000-0000-0000-000000000002', 'Septic Tank Cleaner', 8);

-- Electrical & Power Engineering
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000003', 'House Wiring Electrician', 1),
('c1000000-0000-0000-0000-000000000003', 'Solar Panel Installer', 2),
('c1000000-0000-0000-0000-000000000003', 'Generator Mechanic', 3),
('c1000000-0000-0000-0000-000000000003', 'Inverter Technician', 4),
('c1000000-0000-0000-0000-000000000003', 'CCTV Installer', 5),
('c1000000-0000-0000-0000-000000000003', 'Satellite Dish Installer', 6),
('c1000000-0000-0000-0000-000000000003', 'Smart Home Installer', 7),
('c1000000-0000-0000-0000-000000000003', 'Security System Installer', 8),
('c1000000-0000-0000-0000-000000000003', 'AC Technician', 9),
('c1000000-0000-0000-0000-000000000003', 'Transformer Technician', 10);

-- Automotive & Mechanical Repair
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000004', 'Car Mechanic', 1),
('c1000000-0000-0000-0000-000000000004', 'Auto Electrician', 2),
('c1000000-0000-0000-0000-000000000004', 'Motorcycle / Tricycle Repairer', 3),
('c1000000-0000-0000-0000-000000000004', 'Car Body Painter / Sprayer', 4),
('c1000000-0000-0000-0000-000000000004', 'Vulcanizer', 5),
('c1000000-0000-0000-0000-000000000004', 'Auto AC Technician', 6),
('c1000000-0000-0000-0000-000000000004', 'Car Wash Specialist', 7),
('c1000000-0000-0000-0000-000000000004', 'Truck Mechanic', 8),
('c1000000-0000-0000-0000-000000000004', 'Panel Beater', 9);

-- Finishing, Painting & Interior Decor
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000005', 'House Painter', 1),
('c1000000-0000-0000-0000-000000000005', 'POP Ceiling Designer', 2),
('c1000000-0000-0000-0000-000000000005', 'Wallpaper Installer', 3),
('c1000000-0000-0000-0000-000000000005', 'Interior Decorator', 4),
('c1000000-0000-0000-0000-000000000005', 'Window Blind Installer', 5),
('c1000000-0000-0000-0000-000000000005', 'Floor Polisher', 6),
('c1000000-0000-0000-0000-000000000005', 'Gypsum Board Installer', 7),
('c1000000-0000-0000-0000-000000000005', 'False Ceiling Worker', 8);

-- Cleaning & Property Maintenance
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000006', 'Deep Cleaner', 1),
('c1000000-0000-0000-0000-000000000006', 'Janitor / Office Cleaner', 2),
('c1000000-0000-0000-0000-000000000006', 'Laundry & Dry Cleaner', 3),
('c1000000-0000-0000-0000-000000000006', 'Fumigation / Pest Control', 4),
('c1000000-0000-0000-0000-000000000006', 'Garbage Collector', 5),
('c1000000-0000-0000-0000-000000000006', 'Post-Construction Cleaner', 6),
('c1000000-0000-0000-0000-000000000006', 'Carpet Cleaner', 7),
('c1000000-0000-0000-0000-000000000006', 'Swimming Pool Cleaner', 8);

-- Hair, Beauty & Personal Care
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000007', 'Barber', 1),
('c1000000-0000-0000-0000-000000000007', 'Hairstylist / Braider', 2),
('c1000000-0000-0000-0000-000000000007', 'Makeup Artist', 3),
('c1000000-0000-0000-0000-000000000007', 'Nail Technician / Manicurist', 4),
('c1000000-0000-0000-0000-000000000007', 'Skincare Therapist', 5),
('c1000000-0000-0000-0000-000000000007', 'Eyebrow Artist', 6),
('c1000000-0000-0000-0000-000000000007', 'Lash Technician', 7),
('c1000000-0000-0000-0000-000000000007', 'Massage Therapist', 8),
('c1000000-0000-0000-0000-000000000007', 'Spa Technician', 9);

-- Hospitality, Catering & Food
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000008', 'Event Caterer', 1),
('c1000000-0000-0000-0000-000000000008', 'Private Chef', 2),
('c1000000-0000-0000-0000-000000000008', 'Baker / Confectioner', 3),
('c1000000-0000-0000-0000-000000000008', 'Cocktail Mixologist', 4),
('c1000000-0000-0000-0000-000000000008', 'Local Food Cook', 5),
('c1000000-0000-0000-0000-000000000008', 'Waiter / Waitress', 6),
('c1000000-0000-0000-0000-000000000008', 'Event Food Vendor', 7),
('c1000000-0000-0000-0000-000000000008', 'Drinks Supplier', 8);

-- Photography, Media & Creative Arts
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000009', 'Event Photographer', 1),
('c1000000-0000-0000-0000-000000000009', 'Videographer', 2),
('c1000000-0000-0000-0000-000000000009', 'Drone Operator', 3),
('c1000000-0000-0000-0000-000000000009', 'Video Editor', 4),
('c1000000-0000-0000-0000-000000000009', 'Graphic Designer', 5),
('c1000000-0000-0000-0000-000000000009', 'Photo Editor', 6),
('c1000000-0000-0000-0000-000000000009', 'Social Media Content Creator', 7),
('c1000000-0000-0000-0000-000000000009', 'Brand Identity Designer', 8);

-- Logistics, Transport & Delivery
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000010', 'Dispatch Rider', 1),
('c1000000-0000-0000-0000-000000000010', 'Delivery Driver', 2),
('c1000000-0000-0000-0000-000000000010', 'Truck / Hauling Driver', 3),
('c1000000-0000-0000-0000-000000000010', 'Private Driver', 4),
('c1000000-0000-0000-0000-000000000010', 'Courier Assistant', 5),
('c1000000-0000-0000-0000-000000000010', 'Airport Pickup Driver', 6),
('c1000000-0000-0000-0000-000000000010', 'Moving Company Worker', 7),
('c1000000-0000-0000-0000-000000000010', 'Cargo Handler', 8);

-- Education, Tuition & Home Lessons
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000011', 'Home Tutor (Math/Science)', 1),
('c1000000-0000-0000-0000-000000000011', 'Language Instructor', 2),
('c1000000-0000-0000-0000-000000000011', 'Music Teacher (Piano/Guitar)', 3),
('c1000000-0000-0000-0000-000000000011', 'Coding / Tech Tutor', 4),
('c1000000-0000-0000-0000-000000000011', 'WAEC / BECE Specialist', 5),
('c1000000-0000-0000-0000-000000000011', 'Early Childhood Educator', 6),
('c1000000-0000-0000-0000-000000000011', 'Adult Literacy Teacher', 7),
('c1000000-0000-0000-0000-000000000011', 'Sign Language Tutor', 8);

-- Events, Entertainment & Sound
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000012', 'Event Planner', 1),
('c1000000-0000-0000-0000-000000000012', 'DJ', 2),
('c1000000-0000-0000-0000-000000000012', 'MC / Master of Ceremonies', 3),
('c1000000-0000-0000-0000-000000000012', 'Sound Engineer', 4),
('c1000000-0000-0000-0000-000000000012', 'Stage / Lighting Designer', 5),
('c1000000-0000-0000-0000-000000000012', 'Usher', 6),
('c1000000-0000-0000-0000-000000000012', 'Balloon Decorator', 7),
('c1000000-0000-0000-0000-000000000012', 'Event Security', 8),
('c1000000-0000-0000-0000-000000000012', 'Tent & Chair Supplier', 9),
('c1000000-0000-0000-0000-000000000012', 'Photo Booth Operator', 10);

-- Add color column to categories if not exists
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color VARCHAR(20);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

-- Update colors
UPDATE categories SET color = '#8B4513', sort_order = 1  WHERE id = 'c1000000-0000-0000-0000-000000000001';
UPDATE categories SET color = '#1E90FF', sort_order = 2  WHERE id = 'c1000000-0000-0000-0000-000000000002';
UPDATE categories SET color = '#FFD700', sort_order = 3  WHERE id = 'c1000000-0000-0000-0000-000000000003';
UPDATE categories SET color = '#FF4500', sort_order = 4  WHERE id = 'c1000000-0000-0000-0000-000000000004';
UPDATE categories SET color = '#9B59B6', sort_order = 5  WHERE id = 'c1000000-0000-0000-0000-000000000005';
UPDATE categories SET color = '#00CED1', sort_order = 6  WHERE id = 'c1000000-0000-0000-0000-000000000006';
UPDATE categories SET color = '#FF69B4', sort_order = 7  WHERE id = 'c1000000-0000-0000-0000-000000000007';
UPDATE categories SET color = '#FF8C00', sort_order = 8  WHERE id = 'c1000000-0000-0000-0000-000000000008';
UPDATE categories SET color = '#4169E1', sort_order = 9  WHERE id = 'c1000000-0000-0000-0000-000000000009';
UPDATE categories SET color = '#228B22', sort_order = 10 WHERE id = 'c1000000-0000-0000-0000-000000000010';
UPDATE categories SET color = '#8B0000', sort_order = 11 WHERE id = 'c1000000-0000-0000-0000-000000000011';
UPDATE categories SET color = '#DC143C', sort_order = 12 WHERE id = 'c1000000-0000-0000-0000-000000000012';






-- ============================================================
-- FILE: 024_table_grants.sql
-- ============================================================

-- ============================================================
-- WIAMAPP MIGRATION 024 â€” Table grants (fixes "permission denied")
-- Run this in Supabase SQL Editor if registration fails with:
--   "permission denied for table users"
-- Â© 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- Tables created via SQL migrations need explicit grants so the
-- backend (service_role) and app (authenticated/anon) can access them.

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES    IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO postgres, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Future tables created by migrations should inherit these grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;



-- ============================================================
-- FILE: 025_view_security_invoker.sql
-- ============================================================

-- ============================================================
-- WIAMAPP MIGRATION 025 â€” Make views run as the querying user
-- Fixes Supabase linter ERROR: security_definer_view
-- Â© 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- By default Postgres views are SECURITY DEFINER (run as the view
-- creator), which bypasses the caller's RLS. Switching to
-- security_invoker = on makes them respect the caller's permissions.
-- The backend (service_role) still bypasses RLS, so nothing breaks.

ALTER VIEW public.admin_fraud_investigation SET (security_invoker = on);
ALTER VIEW public.customer_booking_summary  SET (security_invoker = on);
ALTER VIEW public.worker_booking_summary    SET (security_invoker = on);



-- ============================================================
-- FILE: 026_function_security.sql
-- ============================================================

-- ============================================================
-- WIAMAPP MIGRATION 026 â€” Function security hardening
-- Fixes Supabase linter WARNINGS:
--   * function_search_path_mutable
--   * anon_security_definer_function_executable
--   * authenticated_security_definer_function_executable
-- Â© 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- 1) Pin a safe search_path on every function in public so it can't be
--    hijacked by a malicious schema on the session search_path.
-- 2) Remove EXECUTE from PUBLIC/anon/authenticated. All these functions
--    are only called by the backend via the service_role key
--    (verified: every .rpc() call uses supabaseAdmin), so this is safe.

-- 1) Pin search_path on all existing public functions
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp;',
      r.proname, r.args
    );
  END LOOP;
END $$;

-- 2) Lock down EXECUTE: only the backend (service_role) and postgres may run them
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
GRANT  EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;

-- Future functions shouldn't auto-grant EXECUTE to PUBLIC either
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT  EXECUTE ON FUNCTIONS TO postgres, service_role;



-- ============================================================
-- FILE: 027_user_delete_cascade.sql
-- ============================================================

-- ============================================================
-- WIAMAPP MIGRATION 027 â€” Cascade deletes from users
-- Fixes: "Database error deleting user" in Supabase Auth, and makes
-- the DELETE /api/auth/account (GDPR) endpoint work cleanly.
-- Â© 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- Many tables reference public.users(id) without ON DELETE CASCADE,
-- so Postgres blocks deleting a user that has any related rows
-- (audit_logs, payments, fraud_reports, subscriptions, etc.).
-- This converts every single-column FK that points to public.users(id)
-- into ON DELETE CASCADE so deleting a user cleans up their data.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname,
           con.conrelid::regclass            AS child_table,
           att.attname                        AS child_col
    FROM pg_constraint con
    JOIN pg_class      rel ON rel.oid = con.confrelid
    JOIN pg_namespace  ns  ON ns.oid  = rel.relnamespace
    JOIN pg_attribute  att ON att.attrelid = con.conrelid
                          AND att.attnum   = con.conkey[1]
    WHERE con.contype = 'f'
      AND rel.relname = 'users'
      AND ns.nspname  = 'public'
      AND array_length(con.conkey, 1) = 1   -- single-column FKs only
      AND con.confdeltype <> 'c'            -- skip ones already CASCADE
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I;', r.child_table, r.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.users(id) ON DELETE CASCADE;',
      r.child_table, r.conname, r.child_col
    );
  END LOOP;
END $$;


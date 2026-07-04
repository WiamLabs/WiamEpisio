-- ============================================================
-- WIAMAPP DATABASE MIGRATION 001
-- Core Tables: users, worker_profiles, categories
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- HOW TO RUN:
-- 1. Go to https://supabase.com → Your Project → SQL Editor
-- 2. Paste this entire file and click Run
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USERS ───────────────────────────────────────────────────
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

-- ─── WORKER PROFILES ─────────────────────────────────────────
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

-- ─── CATEGORIES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  icon VARCHAR(100),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── WORKER CATEGORIES (many-to-many) ────────────────────────
CREATE TABLE IF NOT EXISTS worker_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worker_id UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE(worker_id, category_id)
);

-- ─── PORTFOLIO IMAGES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolio_images (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worker_id UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES for performance ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_available ON worker_profiles(is_available);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_rating ON worker_profiles(average_rating DESC);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_user ON worker_profiles(user_id);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER worker_profiles_updated_at
  BEFORE UPDATE ON worker_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── SEED CATEGORIES ─────────────────────────────────────────
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

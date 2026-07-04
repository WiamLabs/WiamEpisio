-- ============================================================
-- WIAMAPP — DATABASE SETUP V4
-- © 2026 WiamApp. Powered by WiamLabs
--
-- HOW TO RUN:
--   1. supabase.com → your project → SQL Editor → New query
--   2. Paste this entire file and click Run
--
-- V4 FIX: Drops ALL existing tables first (clean slate)
-- then rebuilds everything correctly in one shot.
-- ============================================================

-- ============================================================
-- STEP 1 — DROP EVERYTHING (clean slate)
-- ============================================================
DROP TABLE IF EXISTS notifications          CASCADE;
DROP TABLE IF EXISTS messages               CASCADE;
DROP TABLE IF EXISTS reviews                CASCADE;
DROP TABLE IF EXISTS bookings               CASCADE;
DROP TABLE IF EXISTS otp_codes              CASCADE;
DROP TABLE IF EXISTS verifications          CASCADE;
DROP TABLE IF EXISTS spotlight_posts        CASCADE;
DROP TABLE IF EXISTS trust_relationships    CASCADE;
DROP TABLE IF EXISTS safety_contacts        CASCADE;
DROP TABLE IF EXISTS user_settings          CASCADE;
DROP TABLE IF EXISTS worker_skills          CASCADE;
DROP TABLE IF EXISTS worker_categories      CASCADE;
DROP TABLE IF EXISTS portfolio_images       CASCADE;
DROP TABLE IF EXISTS business_team_members  CASCADE;
DROP TABLE IF EXISTS business_profiles      CASCADE;
DROP TABLE IF EXISTS worker_profiles        CASCADE;
DROP TABLE IF EXISTS categories             CASCADE;
DROP TABLE IF EXISTS users                  CASCADE;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- ============================================================
-- STEP 2 — EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- STEP 3 — CREATE ALL TABLES
-- ============================================================

CREATE TABLE users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    VARCHAR(100) NOT NULL,
  email        VARCHAR(150) UNIQUE NOT NULL,
  phone        VARCHAR(20),
  role         VARCHAR(20)  NOT NULL DEFAULT 'customer'
                 CHECK (role IN ('customer','worker','business','admin')),
  avatar_url   TEXT,
  city         VARCHAR(100),
  country      VARCHAR(100) DEFAULT 'Ghana',
  country_code VARCHAR(5)   DEFAULT 'GH',
  is_verified  BOOLEAN      DEFAULT FALSE,
  is_active    BOOLEAN      DEFAULT TRUE,
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE categories (
  id          UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  icon        VARCHAR(100),
  description TEXT,
  color       VARCHAR(20),
  sort_order  INT         DEFAULT 0,
  is_active   BOOLEAN     DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE worker_profiles (
  id                      UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id                 UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  bio                     TEXT,
  years_experience        INT           DEFAULT 0,
  hourly_rate             DECIMAL(10,2) DEFAULT 0,
  currency                VARCHAR(10)   DEFAULT 'GHS',
  latitude                DECIMAL(10,8),
  longitude               DECIMAL(11,8),
  location_name           VARCHAR(200),
  is_available            BOOLEAN       DEFAULT TRUE,
  is_verified             BOOLEAN       DEFAULT FALSE,
  verified_badge          BOOLEAN       DEFAULT FALSE,
  total_jobs_done         INT           DEFAULT 0,
  average_rating          DECIMAL(3,2)  DEFAULT 0.00,
  subscription_tier       VARCHAR(20)   DEFAULT 'free'
                            CHECK (subscription_tier IN ('free','starter','gold','platinum')),
  subscription_expires_at TIMESTAMPTZ,
  created_at              TIMESTAMPTZ   DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE worker_categories (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worker_profile_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  category_id       UUID NOT NULL REFERENCES categories(id)      ON DELETE CASCADE,
  UNIQUE(worker_profile_id, category_id)
);

CREATE TABLE worker_skills (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worker_profile_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  skill_name        VARCHAR(100) NOT NULL,
  years_experience  INT     DEFAULT 0,
  is_primary        BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE portfolio_images (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worker_id  UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  image_url  TEXT NOT NULL,
  caption    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE business_profiles (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  company_name VARCHAR(200),
  industry     VARCHAR(100),
  plan         VARCHAR(20) DEFAULT 'free'
                 CHECK (plan IN ('free','starter','growth','enterprise')),
  is_verified  BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE business_team_members (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_id       UUID NOT NULL REFERENCES users(id)           ON DELETE CASCADE,
  worker_profile_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  role              VARCHAR(100) DEFAULT 'Team Member',
  status            VARCHAR(20)  DEFAULT 'active'
                      CHECK (status IN ('active','inactive','pending')),
  joined_at         TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(business_id, worker_profile_id)
);

CREATE TABLE user_settings (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        VARCHAR(100) NOT NULL,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);

CREATE TABLE safety_contacts (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(100),
  phone      VARCHAR(20),
  relation   VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trust_relationships (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  truster_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trustee_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trust_level INT  DEFAULT 1 CHECK (trust_level BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(truster_id, trustee_id)
);

CREATE TABLE spotlight_posts (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worker_profile_id UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  content           TEXT NOT NULL,
  media_url         TEXT,
  boost_type        VARCHAR(20) DEFAULT 'standard',
  is_active         BOOLEAN     DEFAULT TRUE,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE verifications (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verification_type VARCHAR(30),
  status            VARCHAR(20) DEFAULT 'pending'
                      CHECK (status IN ('pending','passed','failed','manual_review','rejected')),
  document_type     VARCHAR(50),
  document_s3_key   TEXT,
  selfie_s3_key     TEXT,
  failure_reason    TEXT,
  reviewed_by       UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE otp_codes (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email      VARCHAR(255) NOT NULL,
  code       VARCHAR(6)   NOT NULL,
  used       BOOLEAN      DEFAULT FALSE,
  expires_at TIMESTAMPTZ  NOT NULL,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE bookings (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id      UUID NOT NULL REFERENCES users(id)           ON DELETE CASCADE,
  worker_id        UUID          REFERENCES worker_profiles(id) ON DELETE SET NULL,
  business_id      UUID          REFERENCES users(id)           ON DELETE SET NULL,
  category_id      UUID          REFERENCES categories(id)      ON DELETE SET NULL,
  status           VARCHAR(30)  DEFAULT 'pending'
                     CHECK (status IN ('pending','accepted','rejected',
                                       'in_progress','completed','cancelled')),
  description      TEXT,
  scheduled_date   TIMESTAMPTZ,
  location_address TEXT,
  location_lat     DECIMAL(10,8),
  location_lng     DECIMAL(11,8),
  agreed_price     DECIMAL(10,2),
  currency         VARCHAR(10)  DEFAULT 'GHS',
  is_emergency     BOOLEAN      DEFAULT FALSE,
  review_id        UUID,
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE reviews (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id  UUID NOT NULL REFERENCES bookings(id)         ON DELETE CASCADE UNIQUE,
  customer_id UUID NOT NULL REFERENCES users(id)             ON DELETE CASCADE,
  worker_id   UUID NOT NULL REFERENCES worker_profiles(id)   ON DELETE CASCADE,
  rating      INT  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  receiver_id UUID          REFERENCES users(id)    ON DELETE CASCADE,
  message     TEXT,
  voice_url   TEXT,
  is_read     BOOLEAN     DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(200),
  body       TEXT,
  type       VARCHAR(50) CHECK (type IN
               ('booking','message','review','payment','safety','system')),
  is_read    BOOLEAN     DEFAULT FALSE,
  data       JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STEP 4 — INDEXES
-- ============================================================
CREATE INDEX idx_users_role        ON users(role);
CREATE INDEX idx_users_city        ON users(city);
CREATE INDEX idx_worker_available  ON worker_profiles(is_available);
CREATE INDEX idx_worker_verified   ON worker_profiles(is_verified);
CREATE INDEX idx_worker_rating     ON worker_profiles(average_rating DESC);
CREATE INDEX idx_worker_cats       ON worker_categories(worker_profile_id);
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_worker   ON bookings(worker_id);
CREATE INDEX idx_bookings_status   ON bookings(status);
CREATE INDEX idx_bookings_business ON bookings(business_id);
CREATE INDEX idx_messages_booking  ON messages(booking_id);
CREATE INDEX idx_notifs_user       ON notifications(user_id, is_read);
CREATE INDEX idx_otp_lookup        ON otp_codes(email, code);
CREATE INDEX idx_spotlight_active  ON spotlight_posts(is_active);
CREATE INDEX idx_user_settings     ON user_settings(user_id, key);

-- ============================================================
-- STEP 5 — ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_skills         ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_images      ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_contacts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_relationships   ENABLE ROW LEVEL SECURITY;
ALTER TABLE spotlight_posts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews               ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 6 — RLS POLICIES
-- ============================================================

-- users
CREATE POLICY "users_insert_own"
  ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_read_own"
  ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_read_workers_public"
  ON users FOR SELECT USING (role IN ('worker','business'));
CREATE POLICY "users_update_own"
  ON users FOR UPDATE USING (auth.uid() = id);

-- categories — everyone can read
CREATE POLICY "categories_read_all"
  ON categories FOR SELECT USING (true);

-- worker_profiles — everyone can read (needed for search)
CREATE POLICY "worker_profiles_read_all"
  ON worker_profiles FOR SELECT USING (true);
CREATE POLICY "worker_profiles_insert_own"
  ON worker_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "worker_profiles_update_own"
  ON worker_profiles FOR UPDATE USING (auth.uid() = user_id);

-- worker_categories
CREATE POLICY "worker_categories_read_all"
  ON worker_categories FOR SELECT USING (true);
CREATE POLICY "worker_categories_manage_own"
  ON worker_categories FOR ALL
  USING (auth.uid() = (
    SELECT user_id FROM worker_profiles WHERE id = worker_profile_id
  ));

-- worker_skills
CREATE POLICY "worker_skills_read_all"
  ON worker_skills FOR SELECT USING (true);
CREATE POLICY "worker_skills_manage_own"
  ON worker_skills FOR ALL
  USING (auth.uid() = (
    SELECT user_id FROM worker_profiles WHERE id = worker_profile_id
  ));

-- portfolio_images
CREATE POLICY "portfolio_read_all"
  ON portfolio_images FOR SELECT USING (true);
CREATE POLICY "portfolio_manage_own"
  ON portfolio_images FOR ALL
  USING (auth.uid() = (
    SELECT user_id FROM worker_profiles WHERE id = worker_id
  ));

-- business_profiles
CREATE POLICY "business_profiles_manage_own"
  ON business_profiles FOR ALL USING (auth.uid() = user_id);

-- business_team_members
CREATE POLICY "business_team_manage_own"
  ON business_team_members FOR ALL USING (auth.uid() = business_id);
CREATE POLICY "business_team_read_worker"
  ON business_team_members FOR SELECT
  USING (auth.uid() = (
    SELECT user_id FROM worker_profiles WHERE id = worker_profile_id
  ));

-- user_settings
CREATE POLICY "user_settings_manage_own"
  ON user_settings FOR ALL USING (auth.uid() = user_id);

-- safety_contacts
CREATE POLICY "safety_contacts_manage_own"
  ON safety_contacts FOR ALL USING (auth.uid() = user_id);

-- trust_relationships
CREATE POLICY "trust_manage_own"
  ON trust_relationships FOR ALL USING (auth.uid() = truster_id);

-- spotlight_posts
CREATE POLICY "spotlight_read_active"
  ON spotlight_posts FOR SELECT USING (is_active = true);
CREATE POLICY "spotlight_manage_own"
  ON spotlight_posts FOR ALL
  USING (auth.uid() = (
    SELECT user_id FROM worker_profiles WHERE id = worker_profile_id
  ));

-- verifications
CREATE POLICY "verifications_read_own"
  ON verifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "verifications_insert_own"
  ON verifications FOR INSERT WITH CHECK (auth.uid() = user_id);

-- bookings
CREATE POLICY "bookings_read_own"
  ON bookings FOR SELECT
  USING (
    auth.uid() = customer_id
    OR auth.uid() = business_id
    OR auth.uid() = (
      SELECT user_id FROM worker_profiles WHERE id = worker_id
    )
  );
CREATE POLICY "bookings_insert_own"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = customer_id OR auth.uid() = business_id);
CREATE POLICY "bookings_update_own"
  ON bookings FOR UPDATE
  USING (
    auth.uid() = customer_id
    OR auth.uid() = business_id
    OR auth.uid() = (
      SELECT user_id FROM worker_profiles WHERE id = worker_id
    )
  );

-- reviews
CREATE POLICY "reviews_read_all"
  ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert_own"
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

-- messages
CREATE POLICY "messages_read_own"
  ON messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "messages_insert_own"
  ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "messages_update_own"
  ON messages FOR UPDATE USING (auth.uid() = receiver_id);

-- notifications
CREATE POLICY "notifications_read_own"
  ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- STEP 7 — GRANTS
-- ============================================================
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL   ON ALL TABLES    IN SCHEMA public TO postgres, service_role;
GRANT ALL   ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL   ON ALL ROUTINES  IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT
  ON ALL TABLES IN SCHEMA public TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;

-- ============================================================
-- STEP 8 — TRIGGER: auto-create users row on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, full_name, email, role, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- STEP 9 — SEED CATEGORIES
-- ============================================================
INSERT INTO categories
  (id, name, icon, description, color, sort_order, is_active)
VALUES
  ('c1000000-0000-0000-0000-000000000001','Building & Construction','construct-outline','Masons, tilers, carpenters.','#8B4513',1,TRUE),
  ('c1000000-0000-0000-0000-000000000002','Plumbing & Water Systems','water-outline','Plumbing and drainage.','#1E90FF',2,TRUE),
  ('c1000000-0000-0000-0000-000000000003','Electrical & Power','flash-outline','Electricians, solar, generators.','#FFD700',3,TRUE),
  ('c1000000-0000-0000-0000-000000000004','Automotive & Mechanical','car-outline','Car mechanics and auto electricians.','#FF4500',4,TRUE),
  ('c1000000-0000-0000-0000-000000000005','Painting & Interior Decor','brush-outline','Painters and decorators.','#9B59B6',5,TRUE),
  ('c1000000-0000-0000-0000-000000000006','Cleaning & Maintenance','sparkles-outline','Cleaners and fumigators.','#00CED1',6,TRUE),
  ('c1000000-0000-0000-0000-000000000007','Hair, Beauty & Care','cut-outline','Barbers, hairstylists, makeup.','#FF69B4',7,TRUE),
  ('c1000000-0000-0000-0000-000000000008','Catering & Food','restaurant-outline','Caterers and private chefs.','#FF8C00',8,TRUE),
  ('c1000000-0000-0000-0000-000000000009','Photography & Media','camera-outline','Photographers and videographers.','#4169E1',9,TRUE),
  ('c1000000-0000-0000-0000-000000000010','Logistics & Delivery','bicycle-outline','Riders, drivers, delivery.','#228B22',10,TRUE),
  ('c1000000-0000-0000-0000-000000000011','Education & Tutoring','book-outline','Tutors and skill instructors.','#8B0000',11,TRUE),
  ('c1000000-0000-0000-0000-000000000012','Events & Entertainment','musical-notes-outline','DJs, MCs, event planners.','#DC143C',12,TRUE)
ON CONFLICT (id) DO UPDATE SET
  name       = EXCLUDED.name,
  icon       = EXCLUDED.icon,
  color      = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  is_active  = EXCLUDED.is_active;

-- ============================================================
-- ✅ DONE — WiamApp database fully set up and ready
-- ============================================================

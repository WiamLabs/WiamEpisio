-- © 2026 WiamApp. Powered by WiamLabs
-- 038_musician_pro.sql — Artist profiles, packages, blackouts, booking details

CREATE TABLE IF NOT EXISTS artist_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_profile_id UUID NOT NULL UNIQUE REFERENCES worker_profiles(id) ON DELETE CASCADE,
  handle VARCHAR(40) NOT NULL UNIQUE,
  stage_name VARCHAR(120) NOT NULL,
  genres TEXT[] DEFAULT '{}',
  bio TEXT,
  epk_url TEXT,
  rider_json JSONB DEFAULT '{}'::jsonb,
  band_size INT DEFAULT 1,
  city VARCHAR(120),
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT artist_handle_format CHECK (handle ~ '^[a-z0-9]([a-z0-9_-]{1,38}[a-z0-9])?$')
);

CREATE INDEX IF NOT EXISTS idx_artist_profiles_handle ON artist_profiles (handle);
CREATE INDEX IF NOT EXISTS idx_artist_profiles_public ON artist_profiles (is_public) WHERE is_public = TRUE;

CREATE TABLE IF NOT EXISTS artist_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artist_profiles(id) ON DELETE CASCADE,
  title VARCHAR(120) NOT NULL,
  description TEXT,
  duration_min INT NOT NULL DEFAULT 60,
  price NUMERIC(12,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'GHS',
  deposit_pct NUMERIC(5,2) NOT NULL DEFAULT 30,
  overtime_rate NUMERIC(12,2),
  travel_fee_rules JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artist_packages_artist ON artist_packages (artist_id);

CREATE TABLE IF NOT EXISTS artist_blackouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artist_profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT artist_blackout_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_artist_blackouts_artist ON artist_blackouts (artist_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS booking_artist_details (
  booking_id UUID PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES artist_profiles(id) ON DELETE RESTRICT,
  package_id UUID REFERENCES artist_packages(id) ON DELETE SET NULL,
  venue_type VARCHAR(80),
  guest_count INT,
  load_in_time TIMESTAMPTZ,
  rider_accepted BOOLEAN DEFAULT FALSE,
  deposit_amount NUMERIC(12,2),
  balance_amount NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE artist_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_blackouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_artist_details ENABLE ROW LEVEL SECURITY;

-- Public read for published artists + active packages
DROP POLICY IF EXISTS artist_profiles_public_read ON artist_profiles;
CREATE POLICY artist_profiles_public_read ON artist_profiles
  FOR SELECT USING (is_public = TRUE);

DROP POLICY IF EXISTS artist_packages_public_read ON artist_packages;
CREATE POLICY artist_packages_public_read ON artist_packages
  FOR SELECT USING (
    is_active = TRUE AND EXISTS (
      SELECT 1 FROM artist_profiles ap
      WHERE ap.id = artist_packages.artist_id AND ap.is_public = TRUE
    )
  );

DROP POLICY IF EXISTS artist_blackouts_public_read ON artist_blackouts;
CREATE POLICY artist_blackouts_public_read ON artist_blackouts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM artist_profiles ap
      WHERE ap.id = artist_blackouts.artist_id AND ap.is_public = TRUE
    )
  );

-- Service role / backend uses supabaseAdmin (bypasses RLS)
GRANT SELECT ON artist_profiles, artist_packages, artist_blackouts, booking_artist_details TO anon, authenticated;
GRANT ALL ON artist_profiles, artist_packages, artist_blackouts, booking_artist_details TO service_role;

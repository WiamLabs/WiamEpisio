-- ============================================================
-- WIAMAPP DATABASE MIGRATION 002
-- Bookings, Reviews, Messages, Notifications
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- Run AFTER migration 001
-- ============================================================

-- ─── BOOKINGS ────────────────────────────────────────────────
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

-- ─── REVIEWS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE UNIQUE,
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MESSAGES ────────────────────────────────────────────────
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

-- ─── NOTIFICATIONS ───────────────────────────────────────────
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

-- ─── INDEXES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_worker ON bookings(worker_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_messages_booking ON messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_reviews_worker ON reviews(worker_id);

-- ─── UPDATED_AT TRIGGERS ─────────────────────────────────────
CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── ENABLE REALTIME ─────────────────────────────────────────
-- This makes messages and notifications update live in the app
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;

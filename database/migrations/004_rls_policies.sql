-- ============================================================
-- WIAMAPP DATABASE MIGRATION 004
-- Row Level Security (RLS) Policies
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- IMPORTANT: Run AFTER migrations 001, 002, and 003
-- RLS ensures users can ONLY see their own data
-- ============================================================

-- ─── ENABLE RLS ON ALL TABLES ────────────────────────────────
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

-- ─── USERS TABLE POLICIES ────────────────────────────────────

-- Users can read their own profile
CREATE POLICY "users_read_own"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Anyone can read basic public worker info
CREATE POLICY "users_read_workers_public"
  ON users FOR SELECT
  USING (role IN ('worker', 'business'));

-- Users can update only their own profile
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- New users can insert their own profile on signup
CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ─── WORKER PROFILES POLICIES ────────────────────────────────

-- Anyone can read worker profiles (needed for search/browse)
CREATE POLICY "worker_profiles_read_all"
  ON worker_profiles FOR SELECT
  USING (true);

-- Workers can only update their own profile
CREATE POLICY "worker_profiles_update_own"
  ON worker_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Workers can insert their own profile
CREATE POLICY "worker_profiles_insert_own"
  ON worker_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── BOOKINGS POLICIES ───────────────────────────────────────

-- Customers can see their own bookings
-- Workers can see bookings assigned to them
CREATE POLICY "bookings_read_own"
  ON bookings FOR SELECT
  USING (
    auth.uid() = customer_id
    OR auth.uid() = (
      SELECT user_id FROM worker_profiles WHERE id = worker_id
    )
  );

-- Customers can create bookings
CREATE POLICY "bookings_insert_customer"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Both customer and worker can update booking status
CREATE POLICY "bookings_update_own"
  ON bookings FOR UPDATE
  USING (
    auth.uid() = customer_id
    OR auth.uid() = (
      SELECT user_id FROM worker_profiles WHERE id = worker_id
    )
  );

-- ─── MESSAGES POLICIES ───────────────────────────────────────

-- Only sender and receiver can see messages
CREATE POLICY "messages_read_participants"
  ON messages FOR SELECT
  USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
  );

-- Only authenticated users can send messages
CREATE POLICY "messages_insert_authenticated"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Only receiver can mark as read
CREATE POLICY "messages_update_receiver"
  ON messages FOR UPDATE
  USING (auth.uid() = receiver_id);

-- ─── NOTIFICATIONS POLICIES ──────────────────────────────────

-- Users can only see their own notifications
CREATE POLICY "notifications_read_own"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- System inserts notifications (via service role key in backend)
-- Frontend users cannot insert notifications
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ─── REVIEWS POLICIES ────────────────────────────────────────

-- Anyone can read reviews (public)
CREATE POLICY "reviews_read_all"
  ON reviews FOR SELECT
  USING (true);

-- Only customers who completed the booking can leave a review
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

-- ─── VERIFICATIONS POLICIES ──────────────────────────────────

-- Users can only see their own verification status (not documents)
CREATE POLICY "verifications_read_own_status"
  ON verifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own verification request
CREATE POLICY "verifications_insert_own"
  ON verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── PORTFOLIO IMAGES POLICIES ───────────────────────────────

-- Anyone can read portfolio images (public)
CREATE POLICY "portfolio_images_read_all"
  ON portfolio_images FOR SELECT
  USING (true);

-- Workers can manage their own portfolio
CREATE POLICY "portfolio_images_manage_own"
  ON portfolio_images FOR ALL
  USING (
    auth.uid() = (
      SELECT user_id FROM worker_profiles WHERE id = worker_id
    )
  );

-- ─── WORKER CATEGORIES POLICIES ──────────────────────────────

-- Anyone can read categories (for search/filter)
CREATE POLICY "worker_categories_read_all"
  ON worker_categories FOR SELECT
  USING (true);

-- Workers can manage their own categories
CREATE POLICY "worker_categories_manage_own"
  ON worker_categories FOR ALL
  USING (
    auth.uid() = (
      SELECT user_id FROM worker_profiles WHERE id = worker_id
    )
  );

-- ─── PAYMENTS POLICIES ───────────────────────────────────────

-- Users can see payments they are involved in
CREATE POLICY "payments_read_own"
  ON payments FOR SELECT
  USING (
    auth.uid() = payer_id
    OR auth.uid() = receiver_id
  );

-- ─── FRAUD REPORTS POLICIES ──────────────────────────────────

-- Users can see fraud reports they filed
CREATE POLICY "fraud_reports_read_own"
  ON fraud_reports FOR SELECT
  USING (auth.uid() = reported_by);

-- Authenticated users can file a fraud report
CREATE POLICY "fraud_reports_insert_authenticated"
  ON fraud_reports FOR INSERT
  WITH CHECK (auth.uid() = reported_by);

-- ─── AUDIT LOGS — read only for own user ─────────────────────
CREATE POLICY "audit_logs_read_own"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- System inserts audit logs via service role
-- No direct insert policy for regular users

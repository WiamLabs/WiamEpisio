-- ============================================================
-- WIAMAPP DATABASE SEED — Test Data
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- WARNING: Run this ONLY in development/testing
-- DO NOT run on your live production database
-- ============================================================

-- ─── TEST USERS ──────────────────────────────────────────────
-- NOTE: These are inserted into the users table only.
-- For real auth users, register through the app or Supabase Auth dashboard.
-- Use these UUIDs to match auth.users entries you create manually.

-- Test Customer
INSERT INTO users (id, full_name, email, phone, role, city, country, is_verified)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Martin Founder',
  'martin@wiamapp.com',
  '+233200000001',
  'customer',
  'Accra',
  'Ghana',
  TRUE
) ON CONFLICT (id) DO NOTHING;

-- Test Worker
INSERT INTO users (id, full_name, email, phone, role, city, country, is_verified)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Kwame Asante',
  'kwame@test.com',
  '+233200000002',
  'worker',
  'Accra',
  'Ghana',
  TRUE
) ON CONFLICT (id) DO NOTHING;

-- Test Worker 2
INSERT INTO users (id, full_name, email, phone, role, city, country, is_verified)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'Ama Boateng',
  'ama@test.com',
  '+233200000003',
  'worker',
  'Accra',
  'Ghana',
  TRUE
) ON CONFLICT (id) DO NOTHING;

-- ─── TEST WORKER PROFILES ────────────────────────────────────
INSERT INTO worker_profiles (id, user_id, bio, years_experience, hourly_rate, currency, latitude, longitude, location_name, is_available, is_verified, average_rating, total_jobs_done)
VALUES (
  '00000000-0000-0000-0001-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'Licensed electrician with 5 years experience in Accra. Specialises in installations, repairs, and rewiring.',
  5,
  80.00,
  'GHS',
  5.6037,
  -0.1870,
  'East Legon, Accra',
  TRUE,
  TRUE,
  4.9,
  127
) ON CONFLICT (id) DO NOTHING;

INSERT INTO worker_profiles (id, user_id, bio, years_experience, hourly_rate, currency, latitude, longitude, location_name, is_available, is_verified, average_rating, total_jobs_done)
VALUES (
  '00000000-0000-0000-0001-000000000002',
  '00000000-0000-0000-0000-000000000003',
  'Certified plumber serving Accra and surrounding areas. Fast response, quality work guaranteed.',
  7,
  60.00,
  'GHS',
  5.5500,
  -0.2000,
  'Osu, Accra',
  TRUE,
  TRUE,
  4.7,
  89
) ON CONFLICT (id) DO NOTHING;

-- ─── ASSIGN CATEGORIES TO TEST WORKERS ───────────────────────
-- Kwame → Electrician
INSERT INTO worker_categories (worker_id, category_id)
SELECT
  '00000000-0000-0000-0001-000000000001',
  id
FROM categories WHERE name = 'Electrician'
ON CONFLICT DO NOTHING;

-- Ama → Plumber
INSERT INTO worker_categories (worker_id, category_id)
SELECT
  '00000000-0000-0000-0001-000000000002',
  id
FROM categories WHERE name = 'Plumber'
ON CONFLICT DO NOTHING;

-- ─── TEST BOOKING ─────────────────────────────────────────────
INSERT INTO bookings (id, customer_id, worker_id, category_id, status, description, location_address, agreed_price, currency)
SELECT
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0001-000000000001',
  c.id,
  'completed',
  'Fix the kitchen lights and check all sockets.',
  '15 Independence Avenue, Accra',
  120.00,
  'GHS'
FROM categories c WHERE c.name = 'Electrician'
ON CONFLICT DO NOTHING;

-- ─── TEST REVIEW ─────────────────────────────────────────────
INSERT INTO reviews (booking_id, customer_id, worker_id, rating, comment)
VALUES (
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0001-000000000001',
  5,
  'Excellent work! Very professional and arrived on time.'
) ON CONFLICT DO NOTHING;

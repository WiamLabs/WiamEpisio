-- ============================================================
-- WIAMAPP MIGRATION 036 — Global Address Capture
-- © 2026 WiamApp. Powered by WiamLabs
-- Run after 035_referrals_photos_disputes_trust.sql
--
-- Adds real address capture (landmark description, digital address
-- code, GPS pin) to every user, worker profile, and booking — built
-- for every country in the world, not just Ghana. No third-party
-- geocoding API anywhere: GPS comes free from the phone itself
-- (expo-location), and the "digital address code" field is just
-- plain text a person pastes in if their own country already has
-- something like GhanaPost GPS, a UK postcode, an Indian PIN, etc.
-- WiamApp never validates or looks that code up anywhere.
-- ============================================================

-- ─── 1. EVERY USER GETS A REAL BASE ADDRESS ────────────────────
-- Previously only worker_profiles had latitude/longitude — customers
-- and businesses had none at all. This is what search/matching and
-- the "copy address" feature both read from.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS latitude              DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS longitude             DECIMAL(11,8),
  ADD COLUMN IF NOT EXISTS landmark_description  TEXT,
  ADD COLUMN IF NOT EXISTS digital_address_code  VARCHAR(50);

-- Ghana was a launch-market default, not a global one. New accounts
-- must now explicitly choose their country at registration — no
-- silent assumption for anyone else in the world.
ALTER TABLE users ALTER COLUMN country DROP DEFAULT;
ALTER TABLE users ALTER COLUMN country_code DROP DEFAULT;

-- ─── 2. SAME FIELDS ON WORKER_PROFILES (their searchable location) ──

ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS landmark_description  TEXT,
  ADD COLUMN IF NOT EXISTS digital_address_code  VARCHAR(50);

-- ─── 3. SAME FIELDS PER BOOKING (the actual job site) ───────────
-- A booking's location already had lat/lng/address — this was
-- always the case, just missing the landmark/code text that makes
-- it findable on the ground, the same way giving a phone number
-- alone isn't enough without a name attached.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS landmark_description  TEXT,
  ADD COLUMN IF NOT EXISTS digital_address_code  VARCHAR(50);

-- ─── 4. INDEX FOR COUNTRY-SCOPED SEARCH ─────────────────────────
-- Every worker search from here on hard-filters by country first —
-- a customer in Ghana must never see a worker based in Kenya, and
-- vice versa, regardless of how the rest of the search is sorted.

CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);
CREATE INDEX IF NOT EXISTS idx_users_country_city ON users(country, city);

-- ─── 5. RANKINGS NEED COUNTRY TOO ────────────────────────────────
-- performance_rankings previously grouped by city alone. City names
-- are not globally unique — there is more than one "Springfield" in
-- the world — so two unrelated cities in different countries could
-- collide into the same ranking group without this.

ALTER TABLE performance_rankings
  ADD COLUMN IF NOT EXISTS country VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_rankings_country_city ON performance_rankings(country, city, rank_type);

-- ─── DONE ────────────────────────────────────────────────────
-- Next: backend/routes/workers.js now hard-filters by the
-- customer's own country and ranks same-city results first,
-- falling back to other cities in the SAME country — never
-- an empty result just because their exact city has no workers
-- yet, and never a worker shown from a different country.

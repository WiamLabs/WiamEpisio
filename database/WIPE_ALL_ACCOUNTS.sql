-- ============================================================
-- WIAMAPP — WIPE ALL ACCOUNTS (TEST / RESET ONLY)
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- WHAT THIS DOES:
--   • Deletes every row in public.users and dependent data
--     (profiles, bookings, payments, chats, notifications, …)
--   • Deletes every Supabase Auth user (auth.users)
--   • Clears otp_codes so old OTPs / reset codes are gone
--
-- AFTER THIS:
--   You can register again with the same email addresses.
--
-- WARNING:
--   • This cannot be undone.
--   • Admin accounts are deleted too — you must re-register / recreate admin.
--   • Categories and other non-user seed data are left alone.
--
-- HOW TO RUN:
--   1. Supabase → Project "New WiamApp Database" (or your live project)
--   2. SQL Editor → New query
--   3. Paste this entire file → Run
-- ============================================================

BEGIN;

-- OTP / password-reset codes (no FK to users)
TRUNCATE TABLE IF EXISTS public.otp_codes;

-- All app users + anything that references them (CASCADE)
TRUNCATE TABLE IF EXISTS public.users CASCADE;

-- Supabase Auth identities / sessions / users (frees emails for re-signup)
DELETE FROM auth.users;

COMMIT;

-- Quick check (should all be 0)
SELECT
  (SELECT count(*) FROM auth.users)       AS auth_users,
  (SELECT count(*) FROM public.users)     AS app_users,
  (SELECT count(*) FROM public.otp_codes) AS otp_codes;

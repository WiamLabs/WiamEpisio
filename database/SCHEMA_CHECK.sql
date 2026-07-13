-- ============================================================
-- WIAMAPP — SAFE SCHEMA CHECK (read-only)
-- Paste into Supabase SQL Editor → Run.
-- Use this to see what you already have before running more SQL.
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================

SELECT 'tables' AS kind, table_name AS name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'users','worker_profiles','business_profiles','categories','bookings',
    'payments','subscriptions','artist_profiles','artist_packages',
    'worker_trusts','enterprise_locations','subscription_config'
  )
ORDER BY table_name;

SELECT 'worker_profiles columns' AS kind, column_name AS name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'worker_profiles'
  AND column_name IN ('user_id','trust_count','subscription_tier','eligibility_score','verified_badge')
ORDER BY column_name;

SELECT 'business_profiles columns' AS kind, column_name AS name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'business_profiles'
  AND column_name IN ('user_id','owner_id','follow_count','business_verified_gold')
ORDER BY column_name;

SELECT 'subscriptions columns' AS kind, column_name AS name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'subscriptions'
  AND column_name IN ('user_id','worker_id','plan_key','plan','amount_usd')
ORDER BY column_name;

SELECT 'categories count' AS kind, COUNT(*)::text AS name FROM categories;

SELECT id, name, sort_order
FROM categories
ORDER BY sort_order NULLS LAST, name
LIMIT 50;

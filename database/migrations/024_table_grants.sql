-- ============================================================
-- WIAMAPP MIGRATION 024 — Table grants (fixes "permission denied")
-- Run this in Supabase SQL Editor if registration fails with:
--   "permission denied for table users"
-- © 2026 WiamApp. Powered by WiamLabs
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

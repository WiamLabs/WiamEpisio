-- ============================================================
-- WIAMAPP MIGRATION 026 — Function security hardening
-- Fixes Supabase linter WARNINGS:
--   * function_search_path_mutable
--   * anon_security_definer_function_executable
--   * authenticated_security_definer_function_executable
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- 1) Pin a safe search_path on every function in public so it can't be
--    hijacked by a malicious schema on the session search_path.
-- 2) Remove EXECUTE from PUBLIC/anon/authenticated. All these functions
--    are only called by the backend via the service_role key
--    (verified: every .rpc() call uses supabaseAdmin), so this is safe.

-- 1) Pin search_path on all existing public functions
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp;',
      r.proname, r.args
    );
  END LOOP;
END $$;

-- 2) Lock down EXECUTE: only the backend (service_role) and postgres may run them
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
GRANT  EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;

-- Future functions shouldn't auto-grant EXECUTE to PUBLIC either
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT  EXECUTE ON FUNCTIONS TO postgres, service_role;

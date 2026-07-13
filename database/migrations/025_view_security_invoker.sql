-- ============================================================
-- WIAMAPP MIGRATION 025 — Make views run as the querying user
-- Fixes Supabase linter ERROR: security_definer_view
-- © 2026 WiamApp. Powered by WiamLabs
-- Safe to run even if some views were never created yet.
-- ============================================================
-- By default Postgres views are SECURITY DEFINER (run as the view
-- creator), which bypasses the caller's RLS. Switching to
-- security_invoker = on makes them respect the caller's permissions.
-- The backend (service_role) still bypasses RLS, so nothing breaks.

DO $$
DECLARE
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'admin_fraud_investigation',
    'customer_booking_summary',
    'worker_booking_summary'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = v_name
        AND c.relkind = 'v'
    ) THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v_name);
    END IF;
  END LOOP;
END $$;

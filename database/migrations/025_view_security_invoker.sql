-- ============================================================
-- WIAMAPP MIGRATION 025 — Make views run as the querying user
-- Fixes Supabase linter ERROR: security_definer_view
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- By default Postgres views are SECURITY DEFINER (run as the view
-- creator), which bypasses the caller's RLS. Switching to
-- security_invoker = on makes them respect the caller's permissions.
-- The backend (service_role) still bypasses RLS, so nothing breaks.

ALTER VIEW public.admin_fraud_investigation SET (security_invoker = on);
ALTER VIEW public.customer_booking_summary  SET (security_invoker = on);
ALTER VIEW public.worker_booking_summary    SET (security_invoker = on);

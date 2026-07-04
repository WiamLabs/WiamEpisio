-- ============================================================
-- WIAMAPP MIGRATION 027 — Cascade deletes from users
-- Fixes: "Database error deleting user" in Supabase Auth, and makes
-- the DELETE /api/auth/account (GDPR) endpoint work cleanly.
-- © 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- Many tables reference public.users(id) without ON DELETE CASCADE,
-- so Postgres blocks deleting a user that has any related rows
-- (audit_logs, payments, fraud_reports, subscriptions, etc.).
-- This converts every single-column FK that points to public.users(id)
-- into ON DELETE CASCADE so deleting a user cleans up their data.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname,
           con.conrelid::regclass            AS child_table,
           att.attname                        AS child_col
    FROM pg_constraint con
    JOIN pg_class      rel ON rel.oid = con.confrelid
    JOIN pg_namespace  ns  ON ns.oid  = rel.relnamespace
    JOIN pg_attribute  att ON att.attrelid = con.conrelid
                          AND att.attnum   = con.conkey[1]
    WHERE con.contype = 'f'
      AND rel.relname = 'users'
      AND ns.nspname  = 'public'
      AND array_length(con.conkey, 1) = 1   -- single-column FKs only
      AND con.confdeltype <> 'c'            -- skip ones already CASCADE
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I;', r.child_table, r.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.users(id) ON DELETE CASCADE;',
      r.child_table, r.conname, r.child_col
    );
  END LOOP;
END $$;

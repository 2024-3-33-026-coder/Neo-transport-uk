-- Migration: 20261019090000_harden_public_table_privileges.sql
-- Description: Harden table-level privileges across schema 'public' for anon and authenticated roles.
--
-- 1. Revoke excessive administrative and structural privileges (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN)
--    from anon and authenticated roles across all ordinary ('r') and partitioned ('p') tables in schema public.
-- 2. Revoke UPDATE and DELETE from anon and authenticated on public.admin_audit_logs to enforce
--    append-only audit trail semantics (preserving SELECT and INSERT for authenticated, and ALL for service_role).
-- 3. Revoke default table privileges on future tables created by role postgres in schema public from
--    anon and authenticated. Future tables must define explicit, least-privilege GRANT statements in their
--    respective migrations. Default privileges for service_role, functions, and sequences remain intact.
--    Default privileges for supabase_admin are not altered.

-- 1. Revoke TRUNCATE, REFERENCES, TRIGGER, and MAINTAIN on all existing public tables from anon and authenticated
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
    ORDER BY c.relname
  LOOP
    BEGIN
      EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE %I.%I FROM anon, authenticated', 'public', tbl.relname);
    EXCEPTION
      WHEN syntax_error OR undefined_object OR invalid_parameter_value THEN
        -- Fallback for engines where MAINTAIN is not a recognized table privilege
        EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE %I.%I FROM anon, authenticated', 'public', tbl.relname);
    END;
  END LOOP;
END $$;

-- 2. Revoke UPDATE and DELETE on public.admin_audit_logs from anon and authenticated (append-only audit log)
REVOKE UPDATE, DELETE ON TABLE public.admin_audit_logs FROM anon, authenticated;

-- 3. Revoke default table privileges for future tables created by role postgres in schema public.
-- Any new public tables created in future migrations will not receive automatic broad grants for anon or
-- authenticated; migrations must explicitly grant only the necessary, least-privilege operations (e.g. SELECT, INSERT).
-- Existing default privileges for service_role, sequences, and functions are preserved unchanged.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

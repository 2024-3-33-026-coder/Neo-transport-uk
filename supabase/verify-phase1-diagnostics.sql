-- ==============================================================================
-- NEO TRANSPORT â€” PHASE 1 READ-ONLY DIAGNOSTIC VERIFICATION SUITE
-- Safe read-only queries to inspect policies, triggers, guards, and environment.
-- None of these statements modify data or schema.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- CHECK 1: ENVIRONMENT & DATASET IDENTIFIER
-- Verify project identity by checking company names and profile counts.
-- (Staging projects will show Meridian Logistics, Apex UK, or test accounts).
-- ------------------------------------------------------------------------------
SELECT
    current_database() AS database_name,
    current_user AS current_role,
    (SELECT count(*) FROM public.companies) AS total_companies,
    (SELECT count(*) FROM public.profiles) AS total_profiles,
    (SELECT string_agg(name, ', ') FROM public.companies LIMIT 5) AS sample_companies;

-- ------------------------------------------------------------------------------
-- CHECK 2: PROFILES STATUS COLUMN & CHECK CONSTRAINT
-- Confirms 'status' column exists, defaults to 'active', and restricts values.
-- ------------------------------------------------------------------------------
SELECT
    c.column_name,
    c.data_type,
    c.column_default,
    c.is_nullable,
    pg_get_constraintdef(con.oid) AS check_constraint
FROM information_schema.columns c
LEFT JOIN pg_constraint con
    ON con.conrelid = 'public.profiles'::regclass
   AND con.contype = 'c'
   AND pg_get_constraintdef(con.oid) ILIKE '%status%'
WHERE c.table_schema = 'public'
  AND c.table_name = 'profiles'
  AND c.column_name = 'status';

-- ------------------------------------------------------------------------------
-- CHECK 3: HARDENED is_admin() FUNCTION DEFINITION
-- Verifies function requires role = 'admin' AND status = 'active'.
-- ------------------------------------------------------------------------------
SELECT
    p.proname AS function_name,
    pg_get_function_result(p.oid) AS return_type,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'is_admin';

-- ------------------------------------------------------------------------------
-- CHECK 4: PROFILE UPDATE GUARD TRIGGER & FUNCTION
-- Verifies handle_profile_update_guard() prevents customer escalation
-- and administrator self-demotion / self-suspension.
-- ------------------------------------------------------------------------------
SELECT
    t.tgname AS trigger_name,
    t.tgenabled AS trigger_status, -- 'O' = enabled
    pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
WHERE t.tgrelid = 'public.profiles'::regclass
  AND t.tgname = 'trg_guard_profile_updates';

SELECT
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'handle_profile_update_guard';

-- ------------------------------------------------------------------------------
-- CHECK 5: ADMIN AUDIT LOGS TABLE & RLS STATUS
-- Confirms table exists and Row Level Security is active.
-- ------------------------------------------------------------------------------
SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'admin_audit_logs';

-- ------------------------------------------------------------------------------
-- CHECK 6: AUDIT LOG RLS POLICIES
-- Confirms SELECT & INSERT are restricted to is_admin(),
-- and NO UPDATE or DELETE policies exist.
-- ------------------------------------------------------------------------------
SELECT
    policyname,
    cmd AS command, -- SELECT, INSERT, ALL, etc.
    roles,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'admin_audit_logs';

-- ------------------------------------------------------------------------------
-- CHECK 7: AUDIT LOG ANTI-TAMPER & INSERT GUARD TRIGGERS
-- Confirms triggers preventing UPDATE/DELETE and enforcing admin identity.
-- ------------------------------------------------------------------------------
SELECT
    t.tgname AS trigger_name,
    t.tgenabled AS trigger_status,
    pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
WHERE t.tgrelid = 'public.admin_audit_logs'::regclass
  AND NOT t.tgisinternal;

-- ------------------------------------------------------------------------------
-- CHECK 8: TABLE PRIVILEGES ON admin_audit_logs
-- Confirms only SELECT and INSERT granted to authenticated users.
-- ------------------------------------------------------------------------------
SELECT
    grantee,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'admin_audit_logs'
ORDER BY grantee, privilege_type;

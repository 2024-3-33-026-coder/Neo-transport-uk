-- ==============================================================================
-- NEO TRANSPORT SPOKE SMOKE-TEST CLAIMS PERMISSIONS ENFORCEMENT
-- Migration Date: 2026-10-19
-- Description:
--   Follow-up migration to permanently enforce least-privilege table grants on
--   public.spoke_smoke_test_claims.
--   1. Ensures unauthenticated roles (anon and PUBLIC) have zero access.
--   2. Revokes all privileges from authenticated, then grants only SELECT, INSERT, UPDATE.
--   3. Preserves full administrative table privileges for service_role.
--   4. Preserves existing RLS policies and withholds DELETE from authenticated users.
-- ==============================================================================

-- 1. Ensure unauthenticated roles (anon and PUBLIC) have zero access
REVOKE ALL ON public.spoke_smoke_test_claims FROM PUBLIC;
REVOKE ALL ON public.spoke_smoke_test_claims FROM anon;

-- 2. Reset and strictly enforce table DML privileges for authenticated role
REVOKE ALL ON public.spoke_smoke_test_claims FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.spoke_smoke_test_claims TO authenticated;

-- 3. Preserve full administrative table privileges for service_role
GRANT ALL ON public.spoke_smoke_test_claims TO service_role;

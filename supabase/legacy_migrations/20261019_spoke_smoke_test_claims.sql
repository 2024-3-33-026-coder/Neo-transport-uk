-- ==============================================================================
-- NEO TRANSPORT SPOKE SMOKE-TEST ATOMIC CLAIMS & ONE-TIME RUN AUDIT
-- Migration Date: 2026-10-19
-- Description:
--   1. Creates public.spoke_smoke_test_claims table for persistent, atomic idempotency
--      enforcing single-run authorization and preventing duplicate Spoke plan creations.
--   2. Explicit lifecycle status: 'reserved' | 'succeeded' | 'failed_unknown' | 'cleaned_up'
--   3. Unique constraint on test_run_token guarantees atomic one-time execution across
--      concurrent requests, retries, serverless instances, or cold starts.
--   4. Configures RLS restricted to authenticated administrators.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.spoke_smoke_test_claims (
    id TEXT PRIMARY KEY DEFAULT ('claim-' || substr(md5(random()::text), 1, 16)),
    test_run_token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('reserved', 'succeeded', 'failed_unknown', 'cleaned_up')),
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    admin_email TEXT NOT NULL,
    admin_name TEXT NOT NULL,
    plan_id TEXT,
    plan_title TEXT,
    plan_date TEXT,
    stops_count INTEGER DEFAULT 0,
    synthetic_pickup TEXT,
    synthetic_dropoff TEXT,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_spoke_smoke_claims_token ON public.spoke_smoke_test_claims(test_run_token);
CREATE INDEX IF NOT EXISTS idx_spoke_smoke_claims_status ON public.spoke_smoke_test_claims(status);

ALTER TABLE public.spoke_smoke_test_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can select smoke test claims"
  ON public.spoke_smoke_test_claims
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin users can insert smoke test claims"
  ON public.spoke_smoke_test_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin users can update smoke test claims"
  ON public.spoke_smoke_test_claims
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Explicit Permissions & Role Grants:
-- 1. Ensure unauthenticated (anon and PUBLIC) have zero access.
REVOKE ALL ON public.spoke_smoke_test_claims FROM PUBLIC;
REVOKE ALL ON public.spoke_smoke_test_claims FROM anon;

-- 2. Grant table DML privileges to authenticated (strictly gated by RLS public.is_admin()).
-- Note: DELETE is intentionally omitted to maintain persistent one-time execution and auditability.
GRANT SELECT, INSERT, UPDATE ON public.spoke_smoke_test_claims TO authenticated;

-- 3. Grant full table access to service_role (privileged backend execution).
GRANT ALL ON public.spoke_smoke_test_claims TO service_role;

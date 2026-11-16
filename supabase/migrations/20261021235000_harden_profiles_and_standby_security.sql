-- =============================================================================
-- Migration: 20261021235000_harden_profiles_and_standby_security.sql
-- Description: 1. Profile update hardening: Revoke table-level UPDATE from
--                 authenticated users on public.profiles; drop redundant policy;
--                 strengthen handle_profile_update_guard trigger.
--              2. Standby application integrity: Backfill and enforce NOT NULL
--                 and DEFAULT 'pending' on standby_applications.status; replace
--                 permissive INSERT policy with strict status check (pending only).
-- Environment: Staging / Production Supabase Database
-- Safe & Idempotent: Can be applied multiple times without error.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SCOPE A: PROFILE UPDATE PRIVILEGE & RLS HARDENING
-- -----------------------------------------------------------------------------

-- 1.1 Revoke table-level UPDATE privileges on public.profiles from authenticated and PUBLIC
-- Customers have zero profile-editing UI; admin profile updates execute strictly via service_role.
REVOKE UPDATE ON TABLE public.profiles FROM authenticated, PUBLIC;

-- 1.2 Drop the redundant customer UPDATE policy that lacked column-level constraints
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

-- 1.3 Ensure an explicit admin UPDATE policy is defined for authenticated administrators
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Admins update profiles'
    ) THEN
        CREATE POLICY "Admins update profiles" ON public.profiles
            FOR UPDATE TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

-- 1.4 Harden the profile update guard trigger function
-- Active Defense-in-Depth: Raises an explicit exception if non-admins attempt profile updates.
CREATE OR REPLACE FUNCTION public.handle_profile_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Trusted server-side administrative calls use the service_role JWT
    IF COALESCE(auth.jwt() ->> 'role', '') = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Non-admin callers are strictly prohibited from modifying profiles
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Direct profile modifications are restricted to administrators.';
    END IF;

    -- Prevent self-demotion or self-suspension by administrators
    IF auth.uid() = OLD.id THEN
        IF OLD.role = 'admin' AND NEW.role <> 'admin' THEN
            RAISE EXCEPTION 'Administrators cannot demote their own account. Another administrator must perform this action.';
        END IF;
        IF OLD.status = 'active' AND NEW.status = 'suspended' THEN
            RAISE EXCEPTION 'Administrators cannot suspend their own account.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. SCOPE B: STANDBY APPLICATION APPROVAL INTEGRITY
-- -----------------------------------------------------------------------------

-- 2.1 Backfill any NULL status values to 'pending' before applying NOT NULL constraint
UPDATE public.standby_applications
SET status = 'pending'
WHERE status IS NULL;

-- 2.2 Ensure status column has a permanent DEFAULT 'pending' and NOT NULL constraint
ALTER TABLE public.standby_applications
    ALTER COLUMN status SET DEFAULT 'pending',
    ALTER COLUMN status SET NOT NULL;

-- 2.3 Drop the overly permissive insert policy that allowed status = 'approved'
DROP POLICY IF EXISTS "Public can submit standby applications" ON public.standby_applications;
DROP POLICY IF EXISTS "Public can submit pending standby applications" ON public.standby_applications;

-- 2.4 Create a hardened public insert policy strictly requiring status = 'pending'
-- Callers attempting to inject status = 'approved' or status = 'rejected' are rejected by RLS.
CREATE POLICY "Public can submit pending standby applications" ON public.standby_applications
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (status = 'pending');

-- 2.5 Ensure explicit admin and service_role policies for standby application management
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'standby_applications' AND policyname = 'Admins insert standby applications'
    ) THEN
        CREATE POLICY "Admins insert standby applications" ON public.standby_applications
            FOR INSERT TO authenticated
            WITH CHECK (public.is_admin());
    END IF;
END $$;

-- 2.6 Revoke any dangerous residual privileges from anon on standby_applications
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.standby_applications FROM anon;

-- 2.7 Tighten public is_admin() execute privilege
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

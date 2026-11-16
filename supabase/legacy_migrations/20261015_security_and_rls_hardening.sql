-- ==============================================================================
-- NEO TRANSPORT SECURITY & RLS HARDENING MIGRATION
-- Migration Date: 2026-10-15
-- Description:
--   1. Restricts standby_applications SELECT strictly to admins (prevents data leak).
--   2. Prevents self-promotion to admin on profiles table UPDATE.
--   3. Adds DELETE policy for quotes scoped to company_id.
--   4. Adds INSERT & UPDATE policies for quotes & support_tickets.
-- ==============================================================================

-- 1. STANDBY APPLICATIONS: Drop insecure SELECT policy and apply admin-only policy
DROP POLICY IF EXISTS "Users or admin view standby applications" ON public.standby_applications;
DROP POLICY IF EXISTS "Admins view standby applications" ON public.standby_applications;

CREATE POLICY "Admins view standby applications" ON public.standby_applications
    FOR SELECT USING (public.is_admin());

-- 2. PROFILES: Prevent privilege escalation (changing role to admin) or changing company_id
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users update own profile" ON public.profiles
    FOR UPDATE USING (
        public.is_admin() OR id = auth.uid()
    ) WITH CHECK (
        public.is_admin() OR (
            id = auth.uid() AND
            role = 'customer' AND
            company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- 3. QUOTES: Ensure customers can insert and discard/delete quotes belonging to their company
DROP POLICY IF EXISTS "Users or admin insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users or admin delete quotes" ON public.quotes;

CREATE POLICY "Users or admin insert quotes" ON public.quotes
    FOR INSERT WITH CHECK (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users or admin delete quotes" ON public.quotes
    FOR DELETE USING (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

-- 4. SUPPORT TICKETS: Ensure customers can update tickets
DROP POLICY IF EXISTS "Users or admin update tickets" ON public.support_tickets;

CREATE POLICY "Users or admin update tickets" ON public.support_tickets
    FOR UPDATE USING (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

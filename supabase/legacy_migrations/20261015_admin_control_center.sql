-- ==============================================================================
-- NEO TRANSPORT ADMIN CONTROL CENTER MIGRATION (PHASE 1)
-- Migration Date: 2026-10-15
-- Description:
--   1. Adds status column ('active', 'suspended') to public.profiles.
--   2. Updates public.handle_profile_update_guard() trigger to enforce status & role
--      restrictions server-side (preventing self-demotion, self-suspension, or customer escalation).
--   3. Updates public.is_admin() to require status = 'active' (instantly revoking admin rights on suspension).
--   4. Creates append-only public.admin_audit_logs table with anti-tamper triggers.
--   5. Configures strict Row-Level Security (RLS) on public.admin_audit_logs.
-- ==============================================================================

-- 1. PROFILES: Add status column if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- 2. HARDENED ADMIN CHECK FUNCTION: Require active status
-- If an admin is suspended, their administrative privileges across all tables are revoked immediately
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. PROFILE UPDATE GUARD TRIGGER:
-- Enforces server-side that:
--   a) Non-admins CANNOT change role, company_id, id, email, or status.
--   b) Admins CANNOT demote or suspend themselves (prevents accidental lockout).
CREATE OR REPLACE FUNCTION public.handle_profile_update_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_admin() THEN
    -- Non-admin customers cannot change their role, company_id, id, email, or status
    NEW.role := OLD.role;
    NEW.company_id := OLD.company_id;
    NEW.id := OLD.id;
    NEW.email := OLD.email;
    NEW.status := OLD.status;
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_guard_profile_updates ON public.profiles;
CREATE TRIGGER trg_guard_profile_updates
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_update_guard();

-- 4. ADMIN AUDIT LOGS TABLE:
-- Append-only system audit log tracking all administrative interventions
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id TEXT PRIMARY KEY DEFAULT ('aud-' || substr(md5(random()::text), 1, 14)),
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    admin_email TEXT NOT NULL,
    admin_name TEXT NOT NULL,
    action TEXT NOT NULL,
    target_entity TEXT NOT NULL,
    target_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON public.admin_audit_logs(target_entity, target_id);

-- 5. ANTI-TAMPER TRIGGER ON AUDIT LOGS:
-- Strictly prohibits any UPDATE or DELETE operations by ANY authenticated user, including administrators.
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log entries are immutable. Modifications and deletions are strictly prohibited.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_tamper ON public.admin_audit_logs;
CREATE TRIGGER trg_prevent_audit_log_tamper
  BEFORE UPDATE OR DELETE ON public.admin_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_modification();

-- 6. AUDIT LOG INSERT GUARD TRIGGER:
-- Enforces server-side that the real authenticated admin ID and server timestamp are applied
CREATE OR REPLACE FUNCTION public.handle_audit_log_insert_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.admin_id := auth.uid();
  END IF;
  NEW.created_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_guard_audit_log_inserts ON public.admin_audit_logs;
CREATE TRIGGER trg_guard_audit_log_inserts
  BEFORE INSERT ON public.admin_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_audit_log_insert_guard();

-- 7. ROW-LEVEL SECURITY (RLS) FOR AUDIT LOGS:
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins view audit logs" ON public.admin_audit_logs
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins insert audit logs" ON public.admin_audit_logs
    FOR INSERT WITH CHECK (public.is_admin());

-- Notice: NO UPDATE OR DELETE POLICIES are defined.
-- Even without the trigger, RLS blocks UPDATE and DELETE. The trigger provides defense-in-depth against SQL editor operations.

-- 8. PERMISSIONS GRANTS:
GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;

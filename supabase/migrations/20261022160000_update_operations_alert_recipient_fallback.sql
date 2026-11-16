-- Migration: 20261022160000_update_operations_alert_recipient_fallback.sql
-- Description: Update public.get_operations_alert_recipient() to provide a reliable authoritative fallback
-- Resolution Order:
--   1. Valid configured database setting (app.settings.ops_email), if available
--   2. First active admin profile containing a valid, non-null email address
--   3. Authoritative corporate operations recipient from project configuration (ops@neotransport.co.uk)

CREATE OR REPLACE FUNCTION public.get_operations_alert_recipient()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_recipient TEXT;
BEGIN
    -- Priority 1: Check database session / runtime parameter if configured and valid
    BEGIN
        v_recipient := NULLIF(TRIM(current_setting('app.settings.ops_email', true)), '');
        IF v_recipient IS NOT NULL AND v_recipient ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
            RETURN v_recipient;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            v_recipient := NULL;
    END;

    -- Priority 2: Check for active administrator profile in public.profiles with valid email
    SELECT TRIM(email) INTO v_recipient
    FROM public.profiles
    WHERE role = 'admin' 
      AND status = 'active'
      AND email IS NOT NULL 
      AND TRIM(email) ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_recipient IS NOT NULL THEN
        RETURN v_recipient;
    END IF;

    -- Priority 3: Fallback to authoritative corporate operations recipient from project configuration
    -- (CONTACT_CONFIG.email.ops in src/lib/config.ts & getOperationsAlertEmail in api/notifications/emailAdapter.ts)
    RETURN 'ops@neotransport.co.uk';
END;
$$;

-- Security hardening: revoke execute from PUBLIC, anon, and authenticated to prevent
-- unintended PostgREST RPC exposure and administrator email enumeration
REVOKE ALL ON FUNCTION public.get_operations_alert_recipient() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_operations_alert_recipient() TO postgres, service_role;

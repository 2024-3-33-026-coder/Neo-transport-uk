-- ==============================================================================
-- Migration: 20261022033000_create_notifications_outbox.sql
-- Description: Creates the transactional notifications outbox table, indexes,
--              strict service-role RLS privileges, and hardened database triggers
--              with least-privilege security, search_path pinning, and verified recipients.
-- Doc Ref:     NT-ARCH-2026-V4 (Section 4 Communications Layer)
-- ==============================================================================

-- 1. Create notifications_outbox table
CREATE TABLE IF NOT EXISTS public.notifications_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    recipient_email TEXT NOT NULL,
    recipient_phone TEXT,
    recipient_role TEXT NOT NULL CHECK (recipient_role IN ('customer', 'operations', 'driver', 'accounts')),
    channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'in_app', 'sms', 'whatsapp')),
    template_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'dead_letter')),
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    sent_at TIMESTAMPTZ,
    company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
    booking_id TEXT
);

-- 2. Performance indexes for efficient queue draining and duplicate checks
CREATE INDEX IF NOT EXISTS idx_notifications_outbox_queue 
    ON public.notifications_outbox (status, retry_count, created_at)
    WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_notifications_outbox_idempotency 
    ON public.notifications_outbox (idempotency_key);

CREATE INDEX IF NOT EXISTS idx_notifications_outbox_company_id 
    ON public.notifications_outbox (company_id);

-- 3. Row Level Security & Strict Service-Role Privilege Isolation
ALTER TABLE public.notifications_outbox ENABLE ROW LEVEL SECURITY;

-- Defense-in-depth: revoke all direct Data API access from anonymous and authenticated roles
REVOKE ALL ON TABLE public.notifications_outbox FROM anon, authenticated, PUBLIC;
GRANT ALL ON TABLE public.notifications_outbox TO service_role;

-- 4. Helper function: Authoritative operations alert recipient resolution
--    SECURITY DEFINER runs with creator (postgres) privileges, search_path pinned
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
    -- Priority 1: Check database session / runtime parameter if configured
    v_recipient := NULLIF(TRIM(current_setting('app.settings.ops_email', true)), '');
    IF v_recipient IS NOT NULL AND v_recipient ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RETURN v_recipient;
    END IF;

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

    -- Fail-closed: do not assume an unverified hardcoded email is valid
    RETURN NULL;
END;
$$;

-- Security hardening: revoke execute from PUBLIC, anon, and authenticated to prevent
-- unintended PostgREST RPC exposure and administrator email enumeration
REVOKE ALL ON FUNCTION public.get_operations_alert_recipient() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_operations_alert_recipient() TO postgres, service_role;

-- 5. Durable trigger: Automatically queue outbox notifications for standby application submission
CREATE OR REPLACE FUNCTION public.handle_standby_application_submitted_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_ops_email TEXT;
    v_applicant_email TEXT;
BEGIN
    v_ops_email := public.get_operations_alert_recipient();
    v_applicant_email := COALESCE(NULLIF(TRIM(NEW.ops_email), ''), NULLIF(TRIM(NEW.accounts_email), ''));

    -- 1. Queue Operations Alert (only if operations email is legitimately resolved)
    IF v_ops_email IS NOT NULL THEN
        INSERT INTO public.notifications_outbox (
            event_type,
            idempotency_key,
            recipient_email,
            recipient_role,
            channel,
            template_id,
            subject,
            payload
        ) VALUES (
            'standby_application_submitted',
            'standby_sub_ops_' || NEW.id::text,
            v_ops_email,
            'operations',
            'email',
            'standby_application_submitted',
            '[ACTION REQUIRED] New Standby Application: ' || NEW.company_name,
            jsonb_build_object(
                'applicationId', NEW.id,
                'companyName', NEW.company_name,
                'contactName', NEW.contact_name,
                'email', v_applicant_email,
                'phone', NEW.driver_mobile,
                'volume', NEW.volume,
                'postcode', NEW.postcode
            )
        ) ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

    -- 2. Queue Applicant Receipt (if valid email present)
    IF v_applicant_email IS NOT NULL AND v_applicant_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        INSERT INTO public.notifications_outbox (
            event_type,
            idempotency_key,
            recipient_email,
            recipient_role,
            channel,
            template_id,
            subject,
            payload
        ) VALUES (
            'standby_application_submitted',
            'standby_sub_applicant_' || NEW.id::text,
            v_applicant_email,
            'customer',
            'email',
            'standby_application_submitted',
            'Standby Facility Application Received - ' || NEW.company_name,
            jsonb_build_object(
                'applicationId', NEW.id,
                'companyName', NEW.company_name,
                'contactName', NEW.contact_name,
                'volume', NEW.volume
            )
        ) ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_standby_application_submitted_queue() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_standby_application_submitted_queue() TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_standby_application_submitted_queue ON public.standby_applications;
DROP TRIGGER IF EXISTS trg_standby_application_outbox_queue ON public.standby_applications;
CREATE TRIGGER trg_standby_application_submitted_queue
    AFTER INSERT ON public.standby_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_standby_application_submitted_queue();

-- 6. Durable trigger: Automatically queue outbox notification on standby application approval
CREATE OR REPLACE FUNCTION public.handle_standby_application_approved_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_applicant_email TEXT;
BEGIN
    -- Only fire when status transitions to 'approved'
    IF (OLD.status IS DISTINCT FROM 'approved' AND NEW.status = 'approved') THEN
        v_applicant_email := COALESCE(NULLIF(TRIM(NEW.ops_email), ''), NULLIF(TRIM(NEW.accounts_email), ''));

        IF v_applicant_email IS NOT NULL AND v_applicant_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
            INSERT INTO public.notifications_outbox (
                event_type,
                idempotency_key,
                recipient_email,
                recipient_role,
                channel,
                template_id,
                subject,
                payload
            ) VALUES (
                'standby_application_approved',
                'standby_appr_' || NEW.id::text || '_' || COALESCE(NEW.account_code, 'approved'),
                v_applicant_email,
                'customer',
                'email',
                'standby_application_approved',
                'Welcome to NEO Transport Standby - Account Activated (' || NEW.company_name || ')',
                jsonb_build_object(
                    'applicationId', NEW.id,
                    'companyName', NEW.company_name,
                    'contactName', NEW.contact_name,
                    'accountCode', NEW.account_code
                )
            ) ON CONFLICT (idempotency_key) DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_standby_application_approved_queue() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_standby_application_approved_queue() TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_standby_application_approved_queue ON public.standby_applications;
CREATE TRIGGER trg_standby_application_approved_queue
    AFTER UPDATE OF status ON public.standby_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_standby_application_approved_queue();

-- 7. Durable trigger: Automatically queue outbox notifications for newly committed bookings
CREATE OR REPLACE FUNCTION public.handle_booking_confirmed_queue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_company_name TEXT;
    v_ops_email TEXT;
    v_customer_email TEXT := NULL;
    v_contact_name TEXT := NULL;
    v_diagnostic_reason TEXT := NULL;
    v_caller_role TEXT;
    v_caller_company TEXT;
    v_matching_profiles_count INT;
BEGIN
    -- Resolve company name
    SELECT name INTO v_company_name FROM public.companies WHERE id = NEW.company_id;
    IF v_company_name IS NULL THEN
        v_company_name := COALESCE(NEW.company_id, 'Commercial Client');
    END IF;

    -- Resolve operations alert recipient
    v_ops_email := public.get_operations_alert_recipient();

    -- Rule 3: For customer-created bookings, use authenticated customer profile
    -- only when user and booking company association are verified
    IF auth.uid() IS NOT NULL THEN
        SELECT role, company_id, email, full_name 
        INTO v_caller_role, v_caller_company, v_customer_email, v_contact_name
        FROM public.profiles
        WHERE id = auth.uid() AND status = 'active';

        IF v_caller_role = 'customer' AND v_caller_company = NEW.company_id THEN
            -- Verified authenticated customer booking
            v_diagnostic_reason := NULL;
        ELSE
            -- Caller is admin or company mismatch: do NOT use caller email as customer recipient
            v_customer_email := NULL;
            v_contact_name := NULL;
        END IF;
    END IF;

    -- Rule 4: For admin-created or service-role bookings, use explicitly supplied contact
    IF v_customer_email IS NULL THEN
        -- Check if pickup_contact is explicitly formatted as an email address
        IF NEW.pickup_contact IS NOT NULL AND NEW.pickup_contact ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
            v_customer_email := TRIM(NEW.pickup_contact);
            v_contact_name := COALESCE(NULLIF(TRIM(NEW.recipient_name), ''), 'Valued Customer');
        ELSE
            -- Check if pickup_contact explicitly matches a unique customer profile name within this company
            IF NEW.pickup_contact IS NOT NULL AND TRIM(NEW.pickup_contact) <> '' THEN
                SELECT COUNT(*) INTO v_matching_profiles_count
                FROM public.profiles
                WHERE company_id = NEW.company_id
                  AND role = 'customer'
                  AND status = 'active'
                  AND lower(trim(full_name)) = lower(trim(NEW.pickup_contact));

                IF v_matching_profiles_count = 1 THEN
                    SELECT email, full_name INTO v_customer_email, v_contact_name
                    FROM public.profiles
                    WHERE company_id = NEW.company_id
                      AND role = 'customer'
                      AND status = 'active'
                      AND lower(trim(full_name)) = lower(trim(NEW.pickup_contact));
                ELSE
                    -- Ambiguous or unmatched: fail closed
                    v_diagnostic_reason := 'CUSTOMER_RECIPIENT_AMBIGUOUS_OR_UNMATCHED';
                END IF;
            ELSE
                v_diagnostic_reason := 'CUSTOMER_RECIPIENT_NOT_PROVIDED';
            END IF;
        END IF;
    END IF;

    -- Fallback contact name if not populated
    IF v_contact_name IS NULL THEN
        v_contact_name := COALESCE(NULLIF(TRIM(NEW.pickup_contact), ''), 'Valued Customer');
    END IF;

    -- Event A: Operations Dispatch Alert (if operations recipient resolved)
    IF v_ops_email IS NOT NULL THEN
        INSERT INTO public.notifications_outbox (
            event_type,
            idempotency_key,
            recipient_email,
            recipient_role,
            channel,
            template_id,
            subject,
            payload,
            company_id,
            booking_id
        ) VALUES (
            'booking_confirmed',
            'booking_conf_ops_' || NEW.id,
            v_ops_email,
            'operations',
            'email',
            'booking_confirmed',
            '[NEW BOOKING] ' || NEW.id || ' - ' || NEW.vehicle || ' (' || NEW.pickup || ' -> ' || NEW.dropoff || ')',
            jsonb_build_object(
                'bookingId', NEW.id,
                'companyName', v_company_name,
                'pickup', NEW.pickup,
                'dropoff', NEW.dropoff,
                'vehicle', NEW.vehicle,
                'totalGbp', NEW.total_gbp,
                'paymentMethod', NEW.payment_method,
                'customerReceiptStatus', CASE WHEN v_customer_email IS NOT NULL THEN 'QUEUED' ELSE 'SKIPPED' END,
                'customerReceiptDiagnostic', v_diagnostic_reason
            ),
            NEW.company_id,
            NEW.id
        ) ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

    -- Event B: Customer Confirmation Receipt (ONLY when unambiguously verified)
    IF v_customer_email IS NOT NULL AND v_customer_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        INSERT INTO public.notifications_outbox (
            event_type,
            idempotency_key,
            recipient_email,
            recipient_role,
            channel,
            template_id,
            subject,
            payload,
            company_id,
            booking_id
        ) VALUES (
            'booking_confirmed',
            'booking_conf_customer_' || NEW.id,
            v_customer_email,
            'customer',
            'email',
            'booking_confirmed',
            'Booking Confirmation: ' || NEW.id || ' - NEO Transport',
            jsonb_build_object(
                'bookingId', NEW.id,
                'companyName', v_company_name,
                'contactName', v_contact_name,
                'pickup', NEW.pickup,
                'dropoff', NEW.dropoff,
                'vehicle', NEW.vehicle,
                'totalGbp', NEW.total_gbp
            ),
            NEW.company_id,
            NEW.id
        ) ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_booking_confirmed_queue() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_booking_confirmed_queue() TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_booking_confirmed_queue ON public.bookings;
CREATE TRIGGER trg_booking_confirmed_queue
    AFTER INSERT ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_booking_confirmed_queue();

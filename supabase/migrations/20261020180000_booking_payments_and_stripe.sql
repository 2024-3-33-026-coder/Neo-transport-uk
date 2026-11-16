-- =============================================================================
-- Migration: 20261020180000_booking_payments_and_stripe.sql
-- Description: Server-authoritative Stripe payments, webhook idempotency inbox,
--              and booking payment tracking columns.
-- Environment: Staging / Production Supabase Database
-- Safe & Idempotent: Can be applied multiple times without error.
-- =============================================================================

-- 1. Extend public.bookings with explicit payment tracking columns
DO $$
BEGIN
    -- payment_status: separates financial status from operational logistics status ('Scheduled', 'In transit', etc.)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'payment_status'
    ) THEN
        ALTER TABLE public.bookings
        ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending';
    END IF;

    -- stripe_payment_intent_id: authoritative Stripe PaymentIntent ID (pi_...)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'stripe_payment_intent_id'
    ) THEN
        ALTER TABLE public.bookings
        ADD COLUMN stripe_payment_intent_id TEXT;
    END IF;

    -- amount_paid_gbp: verified amount captured by payment processor in GBP
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'amount_paid_gbp'
    ) THEN
        ALTER TABLE public.bookings
        ADD COLUMN amount_paid_gbp NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
    END IF;

    -- paid_at: timestamp when full payment was verified via webhook
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'paid_at'
    ) THEN
        ALTER TABLE public.bookings
        ADD COLUMN paid_at TIMESTAMPTZ;
    END IF;
END $$;

-- 2. Create public.booking_payments table (reconcilable payment records)
CREATE TABLE IF NOT EXISTS public.booking_payments (
    id TEXT PRIMARY KEY DEFAULT ('pay_' || replace(gen_random_uuid()::text, '-', '')),
    booking_id TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    company_id TEXT REFERENCES public.companies(id) ON DELETE SET NULL,
    provider TEXT NOT NULL DEFAULT 'stripe',
    stripe_session_id TEXT UNIQUE,
    stripe_payment_intent_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    amount_gbp NUMERIC(10, 2) NOT NULL,
    amount_received_gbp NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'gbp',
    status TEXT NOT NULL DEFAULT 'requires_payment' CHECK (status IN (
        'requires_payment',
        'pending',
        'succeeded',
        'failed',
        'cancelled',
        'partially_paid',
        'refunded'
    )),
    payment_method_type TEXT DEFAULT 'card',
    receipt_url TEXT,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ
);

-- Indexes for fast payment reconciliation
CREATE INDEX IF NOT EXISTS idx_booking_payments_booking_id ON public.booking_payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_payments_session_id ON public.booking_payments(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_booking_payments_intent_id ON public.booking_payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_booking_payments_status ON public.booking_payments(status);

-- 3. Create public.stripe_webhook_events table (idempotency inbox)
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    api_version TEXT,
    status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('processing', 'processed', 'failed')),
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON public.stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed_at ON public.stripe_webhook_events(processed_at DESC);

-- 4. Row Level Security & Privileges
ALTER TABLE public.booking_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role has full unrestricted CRUD
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'booking_payments' AND policyname = 'service_role_booking_payments_all'
    ) THEN
        CREATE POLICY service_role_booking_payments_all ON public.booking_payments
            FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'stripe_webhook_events' AND policyname = 'service_role_stripe_webhook_events_all'
    ) THEN
        CREATE POLICY service_role_stripe_webhook_events_all ON public.stripe_webhook_events
            FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Authenticated users can view payments belonging to their company
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'booking_payments' AND policyname = 'authenticated_read_company_payments'
    ) THEN
        CREATE POLICY authenticated_read_company_payments ON public.booking_payments
            FOR SELECT TO authenticated
            USING (
                company_id IN (
                    SELECT company_id FROM public.profiles WHERE id = auth.uid()
                )
            );
    END IF;
END $$;

-- Revoke dangerous table privileges from anon and authenticated (consistent with privilege hardening baseline)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.booking_payments FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.stripe_webhook_events FROM anon, authenticated;
GRANT SELECT ON public.booking_payments TO authenticated;
GRANT ALL ON public.booking_payments TO service_role;
GRANT ALL ON public.stripe_webhook_events TO service_role;

-- Migration: 20261020030000_spoke_pilot_dispatch_claims.sql
-- Description: Creates public.spoke_pilot_dispatch_claims table for atomic, database-backed
-- duplicate-dispatch prevention and audit recovery during Spoke pilot dispatches.

-- 1. Create public.spoke_pilot_dispatch_claims table
CREATE TABLE IF NOT EXISTS public.spoke_pilot_dispatch_claims (
    id text NOT NULL,
    booking_id text NOT NULL,
    status text NOT NULL,
    admin_id uuid,
    admin_email text NOT NULL,
    admin_name text NOT NULL,
    plan_id text,
    plan_title text NOT NULL,
    plan_date text NOT NULL,
    stops_count integer DEFAULT 2 NOT NULL,
    pickup_stop_id text,
    delivery_stop_id text,
    driver_id text,
    failure_reason text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT spoke_pilot_dispatch_claims_pkey PRIMARY KEY (id),
    CONSTRAINT spoke_pilot_dispatch_claims_booking_id_key UNIQUE (booking_id),
    CONSTRAINT spoke_pilot_dispatch_claims_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE RESTRICT,
    CONSTRAINT spoke_pilot_dispatch_claims_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT spoke_pilot_dispatch_claims_status_check CHECK (status = ANY (ARRAY['reserved'::text, 'succeeded'::text, 'failed_unknown'::text, 'cleaned_up'::text]))
);

ALTER TABLE public.spoke_pilot_dispatch_claims OWNER TO postgres;

-- 2. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_spoke_pilot_claims_booking_id ON public.spoke_pilot_dispatch_claims USING btree (booking_id);
CREATE INDEX IF NOT EXISTS idx_spoke_pilot_claims_status ON public.spoke_pilot_dispatch_claims USING btree (status);

-- 3. Comments
COMMENT ON TABLE public.spoke_pilot_dispatch_claims IS 'Durable atomic claim registry guaranteeing single-dispatch execution and recovery per booking.';
COMMENT ON COLUMN public.spoke_pilot_dispatch_claims.booking_id IS 'Authoritative NEO Transport booking ID reference with unique constraint.';
COMMENT ON COLUMN public.spoke_pilot_dispatch_claims.status IS 'Dispatch lifecycle state: reserved, succeeded, failed_unknown, cleaned_up.';

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.spoke_pilot_dispatch_claims ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (Admins only)
CREATE POLICY "Admin users can select pilot dispatch claims"
    ON public.spoke_pilot_dispatch_claims
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Admin users can insert pilot dispatch claims"
    ON public.spoke_pilot_dispatch_claims
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

CREATE POLICY "Admin users can update pilot dispatch claims"
    ON public.spoke_pilot_dispatch_claims
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 6. Permissions / Grants
GRANT ALL ON TABLE public.spoke_pilot_dispatch_claims TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.spoke_pilot_dispatch_claims TO authenticated;

REVOKE DELETE ON TABLE public.spoke_pilot_dispatch_claims FROM authenticated;
REVOKE ALL ON TABLE public.spoke_pilot_dispatch_claims FROM anon;

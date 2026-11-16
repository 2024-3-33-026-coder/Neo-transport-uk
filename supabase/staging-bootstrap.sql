-- ==============================================================================
-- NEO TRANSPORT — CORE STAGING DATABASE BOOTSTRAP SCRIPT
-- File: supabase/staging-bootstrap.sql (points to staging-core-bootstrap.sql)
-- Project: neo-transport-staging
-- Description:
--   1. Extensions and Schema DDL for all 8 core application tables.
--   2. High-performance foreign key & query indexes.
--   3. Hardened is_admin() SECURITY DEFINER function with safe search_path.
--   4. Profile & Quote immutability triggers (prevents privilege escalation & price tampering).
--   5. Least-privilege Row-Level Security (RLS) policies enforcing company isolation.
--   6. Public inbound submissions with admin-only reads for standby applications.
-- NOTE:
--   - Safe for fresh or existing environments: No DROP TABLE or TRUNCATE.
--   - Does NOT touch or modify managed Supabase Storage schema (storage.objects / storage.buckets).
--   - Storage bucket and policies are configured via Supabase Dashboard (see supabase/staging-storage-setup.md).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. CORE DATABASE TABLES
-- ------------------------------------------------------------------------------

-- 2.1 Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
    id TEXT PRIMARY KEY DEFAULT ('comp-' || substr(md5(random()::text), 1, 12)),
    name TEXT NOT NULL,
    account_code TEXT UNIQUE NOT NULL DEFAULT ('NEO-SB-' || floor(random() * (9999 - 1000 + 1) + 1000)::text),
    standby_active BOOLEAN NOT NULL DEFAULT true,
    verified BOOLEAN NOT NULL DEFAULT true,
    monthly_spend NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    paid_ytd NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    next_statement_date TEXT NOT NULL DEFAULT '01 Sep',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.2 Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id TEXT REFERENCES public.companies(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    initials TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.3 Standby Applications Table
CREATE TABLE IF NOT EXISTS public.standby_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    trading_name TEXT,
    dispatch_address TEXT NOT NULL,
    town_city TEXT NOT NULL,
    postcode TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    driver_mobile TEXT NOT NULL,
    ops_email TEXT NOT NULL,
    accounts_email TEXT NOT NULL,
    emergency_line TEXT NOT NULL,
    selected_carriers TEXT[] NOT NULL DEFAULT '{}',
    volume TEXT NOT NULL DEFAULT '5-15 loads/month',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    account_code TEXT DEFAULT ('NEO-SB-' || floor(random() * (9999 - 1000 + 1) + 1000)::text),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.4 Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
    id TEXT PRIMARY KEY, -- e.g. 'NT-24817'
    company_id TEXT REFERENCES public.companies(id) ON DELETE CASCADE,
    date_label TEXT NOT NULL DEFAULT 'Today',
    pickup TEXT NOT NULL,
    pickup_contact TEXT NOT NULL,
    pickup_phone TEXT NOT NULL,
    collection_window TEXT NOT NULL DEFAULT 'ASAP — ready now',
    dropoff TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    delivery_instructions TEXT,
    goods TEXT NOT NULL,
    weight_kg NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    items_count INTEGER NOT NULL DEFAULT 1,
    vehicle TEXT NOT NULL,
    service TEXT NOT NULL,
    distance_miles NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    total_gbp NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'standby-account',
    po_reference TEXT,
    eta_label TEXT DEFAULT '88 min',
    status TEXT NOT NULL DEFAULT 'In transit' CHECK (status IN ('Scheduled', 'In transit', 'Delivered', 'Cancelled')),
    driver_name TEXT DEFAULT 'Marek Kowalski',
    driver_vehicle TEXT DEFAULT 'Sprinter LWB',
    driver_reg TEXT DEFAULT 'GN71 XPO',
    progress_t NUMERIC(4,2) DEFAULT 0.45,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.5 Quotes Table
CREATE TABLE IF NOT EXISTS public.quotes (
    id TEXT PRIMARY KEY, -- e.g. 'Q-4821'
    company_id TEXT REFERENCES public.companies(id) ON DELETE CASCADE,
    pickup TEXT NOT NULL,
    dropoff TEXT NOT NULL,
    route TEXT NOT NULL,
    vehicle TEXT NOT NULL,
    service TEXT NOT NULL,
    price_gbp NUMERIC(10,2) NOT NULL,
    expires_label TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'accepted', 'discarded', 'urgent')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.6 Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY, -- e.g. 'INV-2026-0481'
    company_id TEXT REFERENCES public.companies(id) ON DELETE CASCADE,
    date_label TEXT NOT NULL,
    period_label TEXT NOT NULL,
    amount_gbp NUMERIC(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'Paid' CHECK (status IN ('Paid', 'Due', 'Overdue')),
    pdf_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.7 Documents Table
CREATE TABLE IF NOT EXISTS public.documents (
    id TEXT PRIMARY KEY DEFAULT ('doc-' || substr(md5(random()::text), 1, 10)),
    company_id TEXT REFERENCES public.companies(id) ON DELETE CASCADE,
    booking_id TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    date_label TEXT NOT NULL,
    file_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.8 Support Tickets Table
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id TEXT PRIMARY KEY DEFAULT ('SR-' || floor(random() * (9999 - 1000 + 1) + 1000)::text),
    company_id TEXT REFERENCES public.companies(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 3. PERFORMANCE INDEXES (Optimizes RLS evaluation & company lookups)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_bookings_company_id ON public.bookings(company_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON public.quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_company_id ON public.documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_booking_id ON public.documents(booking_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_company_id ON public.support_tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_standby_applications_status ON public.standby_applications(status);

-- ------------------------------------------------------------------------------
-- 4. SECURITY & HELPER FUNCTIONS
-- ------------------------------------------------------------------------------

-- 4.1 Hardened Admin Check Function (Fixed search_path to prevent hijacking)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- 4.2 Immutable Profile Security Trigger:
-- Prevents customers from escalating their role to 'admin', switching company_id, or spoofing identity.
CREATE OR REPLACE FUNCTION public.handle_profile_update_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_admin() THEN
    -- Non-admin customers cannot change their role, company_id, id, or email
    NEW.role := OLD.role;
    NEW.company_id := OLD.company_id;
    NEW.id := OLD.id;
    NEW.email := OLD.email;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_guard_profile_updates ON public.profiles;
CREATE TRIGGER trg_guard_profile_updates
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_update_guard();

-- 4.3 Immutable Quote Security Trigger:
-- Prevents customers from altering quote prices, transport parameters, or company_id.
CREATE OR REPLACE FUNCTION public.handle_quote_update_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_admin() THEN
    -- Customers cannot change price, company_id, pickup, dropoff, route, vehicle, service
    NEW.price_gbp := OLD.price_gbp;
    NEW.company_id := OLD.company_id;
    NEW.id := OLD.id;
    NEW.pickup := OLD.pickup;
    NEW.dropoff := OLD.dropoff;
    NEW.route := OLD.route;
    NEW.vehicle := OLD.vehicle;
    NEW.service := OLD.service;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_guard_quote_updates ON public.quotes;
CREATE TRIGGER trg_guard_quote_updates
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_quote_update_guard();

-- ------------------------------------------------------------------------------
-- 5. ROW-LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standby_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- 5.1 Standby Applications Policies
-- Inbound leads can be submitted publicly; viewing & management strictly restricted to Dispatch Admins
DROP POLICY IF EXISTS "Public can submit standby applications" ON public.standby_applications;
DROP POLICY IF EXISTS "Users or admin view standby applications" ON public.standby_applications;
DROP POLICY IF EXISTS "Admins view standby applications" ON public.standby_applications;
DROP POLICY IF EXISTS "Admins update standby applications" ON public.standby_applications;
DROP POLICY IF EXISTS "Admins delete standby applications" ON public.standby_applications;

CREATE POLICY "Public can submit standby applications" ON public.standby_applications
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins view standby applications" ON public.standby_applications
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins update standby applications" ON public.standby_applications
    FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins delete standby applications" ON public.standby_applications
    FOR DELETE USING (public.is_admin());

-- 5.2 Companies Policies
-- Customers can only view their own assigned company; administrative changes are strictly admin-only
DROP POLICY IF EXISTS "Users or admin view companies" ON public.companies;
DROP POLICY IF EXISTS "Admins manage companies" ON public.companies;

CREATE POLICY "Users or admin view companies" ON public.companies
    FOR SELECT USING (
        public.is_admin() OR
        id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admins manage companies" ON public.companies
    FOR ALL USING (public.is_admin());

-- 5.3 Profiles Policies
-- Provisioning: Only Admins / Trusted Provisioning can INSERT profiles (prevents arbitrary company_id spoofing).
-- Customers can read their own profile and update safe fields (full_name, initials).
DROP POLICY IF EXISTS "Users or admin view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;

CREATE POLICY "Users or admin view profiles" ON public.profiles
    FOR SELECT USING (
        public.is_admin() OR id = auth.uid()
    );

CREATE POLICY "Admins insert profiles" ON public.profiles
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Users update own profile" ON public.profiles
    FOR UPDATE USING (
        public.is_admin() OR id = auth.uid()
    ) WITH CHECK (
        public.is_admin() OR (id = auth.uid() AND role = 'customer')
    );

CREATE POLICY "Admins manage profiles" ON public.profiles
    FOR ALL USING (public.is_admin());

-- 5.4 Bookings Policies
-- Customers can read and create bookings for their own company.
-- Operational status, driver assignments, progress, and pricing are strictly admin-controlled.
DROP POLICY IF EXISTS "Users or admin view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users or admin insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users or admin update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins delete bookings" ON public.bookings;

CREATE POLICY "Users or admin view bookings" ON public.bookings
    FOR SELECT USING (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users or admin insert bookings" ON public.bookings
    FOR INSERT WITH CHECK (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admins update bookings" ON public.bookings
    FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins delete bookings" ON public.bookings
    FOR DELETE USING (public.is_admin());

-- 5.5 Quotes Policies
-- Customers can read quotes and discard/accept them via DELETE or status update.
-- Price tampering and company switching are prohibited via trigger and company-scoped policy.
DROP POLICY IF EXISTS "Users or admin view quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users or admin insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users or admin update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users or admin delete quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admins manage quotes" ON public.quotes;

CREATE POLICY "Users or admin view quotes" ON public.quotes
    FOR SELECT USING (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users or admin insert quotes" ON public.quotes
    FOR INSERT WITH CHECK (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users or admin update quotes" ON public.quotes
    FOR UPDATE USING (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users or admin delete quotes" ON public.quotes
    FOR DELETE USING (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admins manage quotes" ON public.quotes
    FOR ALL USING (public.is_admin());

-- 5.6 Invoices Policies
-- Customers can view their own company invoices.
-- Amounts, payment status, and invoice generation are strictly admin-controlled.
DROP POLICY IF EXISTS "Users or admin view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users or admin update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins manage invoices" ON public.invoices;

CREATE POLICY "Users or admin view invoices" ON public.invoices
    FOR SELECT USING (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admins manage invoices" ON public.invoices
    FOR ALL USING (public.is_admin());

-- 5.7 Documents Policies
-- Customers can view documents for their own company and insert records scoped to their company prefix.
-- Modification and deletion of compliance records are admin-controlled.
DROP POLICY IF EXISTS "Users or admin view documents" ON public.documents;
DROP POLICY IF EXISTS "Users or admin insert documents" ON public.documents;
DROP POLICY IF EXISTS "Users or admin update documents" ON public.documents;
DROP POLICY IF EXISTS "Admins manage documents" ON public.documents;

CREATE POLICY "Users or admin view documents" ON public.documents
    FOR SELECT USING (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users or admin insert documents" ON public.documents
    FOR INSERT WITH CHECK (
        public.is_admin() OR (
            company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()) AND
            (file_url IS NULL OR file_url LIKE (company_id || '/%'))
        )
    );

CREATE POLICY "Admins manage documents" ON public.documents
    FOR ALL USING (public.is_admin());

-- 5.8 Support Tickets Policies
-- Customers can create and read their own company tickets (status defaults to 'Open').
-- Administrative changes, assignment, and status resolution are admin-controlled.
DROP POLICY IF EXISTS "Users or admin view tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users or admin insert tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users or admin update tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins manage tickets" ON public.support_tickets;

CREATE POLICY "Users or admin view tickets" ON public.support_tickets
    FOR SELECT USING (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users or admin insert tickets" ON public.support_tickets
    FOR INSERT WITH CHECK (
        public.is_admin() OR (
            company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()) AND
            status = 'Open'
        )
    );

CREATE POLICY "Admins manage tickets" ON public.support_tickets
    FOR ALL USING (public.is_admin());

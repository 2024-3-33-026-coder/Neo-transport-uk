-- ==============================================================================
-- NEO TRANSPORT B2B FREIGHT & STANDBY ACCOUNT PORTAL
-- SUPABASE POSTGRESQL SCHEMA WITH ROW-LEVEL SECURITY (RLS)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. COMPANIES TABLE
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

-- 2. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id TEXT REFERENCES public.companies(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    initials TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. STANDBY APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.standby_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    account_code TEXT DEFAULT ('NEO-SB-' || floor(random() * (9999 - 1000 + 1) + 1000)::text),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. BOOKINGS TABLE
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

-- 5. QUOTES TABLE
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
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'accepted', 'discarded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. INVOICES TABLE
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

-- 7. DOCUMENTS TABLE
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

-- 8. SUPPORT TICKETS TABLE
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id TEXT PRIMARY KEY DEFAULT ('SR-' || floor(random() * (9999 - 1000 + 1) + 1000)::text),
    company_id TEXT REFERENCES public.companies(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standby_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if authenticated user has role = 'admin'
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. STANDBY APPLICATIONS
CREATE POLICY "Public can submit standby applications" ON public.standby_applications
    FOR INSERT WITH CHECK (true);

-- SECURED: Only Dispatch Admins can view submitted standby applications
CREATE POLICY "Admins view standby applications" ON public.standby_applications
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins update standby applications" ON public.standby_applications
    FOR UPDATE USING (public.is_admin());

-- 2. COMPANIES
CREATE POLICY "Users or admin view companies" ON public.companies
    FOR SELECT USING (
        public.is_admin() OR
        id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admins manage companies" ON public.companies
    FOR ALL USING (public.is_admin());

-- 3. PROFILES
CREATE POLICY "Users or admin view profiles" ON public.profiles
    FOR SELECT USING (
        public.is_admin() OR id = auth.uid()
    );

-- SECURED: Prevent users from promoting themselves to admin or switching company_id
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

CREATE POLICY "Admins manage profiles" ON public.profiles
    FOR ALL USING (public.is_admin());

-- 4. BOOKINGS
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

CREATE POLICY "Users or admin update bookings" ON public.bookings
    FOR UPDATE USING (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admins delete bookings" ON public.bookings
    FOR DELETE USING (public.is_admin());

-- 5. QUOTES
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

-- SECURED: Allow customers to delete/discard their own company quotes
CREATE POLICY "Users or admin delete quotes" ON public.quotes
    FOR DELETE USING (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admins manage quotes" ON public.quotes
    FOR ALL USING (public.is_admin());

-- 6. INVOICES
CREATE POLICY "Users or admin view invoices" ON public.invoices
    FOR SELECT USING (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admins manage invoices" ON public.invoices
    FOR ALL USING (public.is_admin());

-- 7. DOCUMENTS
CREATE POLICY "Users or admin view documents" ON public.documents
    FOR SELECT USING (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users or admin insert documents" ON public.documents
    FOR INSERT WITH CHECK (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admins manage documents" ON public.documents
    FOR ALL USING (public.is_admin());

-- 8. SUPPORT TICKETS
CREATE POLICY "Users or admin view tickets" ON public.support_tickets
    FOR SELECT USING (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users or admin insert tickets" ON public.support_tickets
    FOR INSERT WITH CHECK (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users or admin update tickets" ON public.support_tickets
    FOR UPDATE USING (
        public.is_admin() OR
        company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admins manage tickets" ON public.support_tickets
    FOR ALL USING (public.is_admin());

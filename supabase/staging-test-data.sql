-- ==============================================================================
-- NEO TRANSPORT — STAGING SAMPLE TEST DATASET
-- Project: neo-transport-staging
-- Description:
--   Sample multi-tenant test data for testing company isolation and admin access.
--   Includes:
--     - Company A: Meridian Logistics (comp-meridian-001)
--     - Company B: Apex Precision Logistics (comp-apex-002)
--     - Ops Control: NEO Transport Dispatch (c-neo-ops)
--     - Multi-tenant Bookings, Quotes, Invoices, Documents & Support Tickets
--     - Step-by-step user linking instructions (No fake unreachable UUIDs)
-- Safe: Uses ON CONFLICT DO NOTHING. No DROP or TRUNCATE statements.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. COMPANIES SEED
-- ------------------------------------------------------------------------------
INSERT INTO public.companies (
    id,
    name,
    account_code,
    standby_active,
    verified,
    monthly_spend,
    paid_ytd,
    next_statement_date
) VALUES
(
    'comp-meridian-001',
    'Meridian Logistics Ltd',
    'NEO-SB-2026',
    true,
    true,
    4280.00,
    31420.00,
    '01 Sep'
),
(
    'comp-apex-002',
    'Apex Precision Logistics Ltd',
    'NEO-SB-8820',
    true,
    true,
    2150.00,
    14800.00,
    '01 Sep'
),
(
    'c-neo-ops',
    'NEO Transport Ops Control',
    'NEO-DISPATCH-01',
    true,
    true,
    0.00,
    0.00,
    'Internal Desk'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. LINK AUTH USERS TO PROFILES (Run AFTER creating users in Supabase Auth)
-- ------------------------------------------------------------------------------
-- HOW TO CREATE STAGING USERS:
-- 1. In Supabase Dashboard -> Authentication -> Users -> Click "Add User" (or "Invite User"):
--    User 1: chris@meridian.co.uk      (Suggested staging password: Meridian2026!)
--    User 2: hannah@apexlogistics.co.uk (Suggested staging password: Apex2026!)
--    User 3: ops@neotransport.co.uk    (Suggested staging password: DispatchOps2026!)
-- 2. Then execute the block below. It dynamically queries auth.users by email to retrieve
--    the real Supabase-generated UUIDs and links them to the proper company and role.

INSERT INTO public.profiles (id, company_id, full_name, initials, email, role)
SELECT 
    u.id, 
    'comp-meridian-001', 
    'Chris Sullivan', 
    'CS', 
    'chris@meridian.co.uk', 
    'customer'
FROM auth.users u
WHERE u.email = 'chris@meridian.co.uk'
ON CONFLICT (id) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    full_name = EXCLUDED.full_name,
    initials = EXCLUDED.initials,
    role = EXCLUDED.role;

INSERT INTO public.profiles (id, company_id, full_name, initials, email, role)
SELECT 
    u.id, 
    'comp-apex-002', 
    'Hannah Vance', 
    'HV', 
    'hannah@apexlogistics.co.uk', 
    'customer'
FROM auth.users u
WHERE u.email = 'hannah@apexlogistics.co.uk'
ON CONFLICT (id) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    full_name = EXCLUDED.full_name,
    initials = EXCLUDED.initials,
    role = EXCLUDED.role;

INSERT INTO public.profiles (id, company_id, full_name, initials, email, role)
SELECT 
    u.id, 
    'c-neo-ops', 
    'NEO Operations Dispatch', 
    'OP', 
    'ops@neotransport.co.uk', 
    'admin'
FROM auth.users u
WHERE u.email = 'ops@neotransport.co.uk'
ON CONFLICT (id) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    full_name = EXCLUDED.full_name,
    initials = EXCLUDED.initials,
    role = EXCLUDED.role;

-- ------------------------------------------------------------------------------
-- 3. STANDBY APPLICATIONS (Only visible to admin)
-- ------------------------------------------------------------------------------
INSERT INTO public.standby_applications (
    id,
    company_name,
    trading_name,
    dispatch_address,
    town_city,
    postcode,
    contact_name,
    job_title,
    driver_mobile,
    ops_email,
    accounts_email,
    emergency_line,
    selected_carriers,
    volume,
    status,
    account_code
) VALUES
(
    'a0000000-0000-0000-0000-000000000001',
    'Apex Precision Logistics Ltd',
    'Apex UK Line Recovery',
    'Bay 3, Logistics Way, Trafford Park',
    'Manchester',
    'M17 1TN',
    'Hannah Vance',
    'Operations Director',
    '07700 900341',
    'hannah@apexlogistics.co.uk',
    'accounts@apexlogistics.co.uk',
    '0161 884 9210',
    ARRAY['DPD', 'DHL', 'Palletways'],
    '15-30 loads/month',
    'pending',
    'NEO-SB-8820'
),
(
    'a0000000-0000-0000-0000-000000000002',
    'Nordic Precision Gears Ltd',
    'NPG Dynamics',
    'Unit 9, Heartlands Industrial Park',
    'Birmingham',
    'B6 7XX',
    'David Lindqvist',
    'Plant Logistics Manager',
    '07700 900612',
    'david.l@npg-gears.co.uk',
    'finance@npg-gears.co.uk',
    '0121 555 4920',
    ARRAY['Palletways', 'Tuffnells'],
    '5-15 loads/month',
    'pending',
    NULL
),
(
    'a0000000-0000-0000-0000-000000000003',
    'Meridian Logistics Ltd',
    'Meridian Express Freight',
    'Unit 4, Trafford Park Industrial Estate',
    'Manchester',
    'M17 1AB',
    'Chris Sullivan',
    'Head of Logistics & Supply Chain',
    '07700 900821',
    'chris@meridian.co.uk',
    'accounts@meridian.co.uk',
    '0161 555 0134',
    ARRAY['DPD', 'DHL', 'Palletways'],
    '5-15 loads/month',
    'approved',
    'NEO-SB-2026'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. BOOKINGS SEED (Both Company A and Company B)
-- ------------------------------------------------------------------------------
INSERT INTO public.bookings (
    id,
    company_id,
    date_label,
    pickup,
    pickup_contact,
    pickup_phone,
    collection_window,
    dropoff,
    recipient_name,
    recipient_phone,
    delivery_instructions,
    goods,
    weight_kg,
    items_count,
    vehicle,
    service,
    distance_miles,
    total_gbp,
    payment_method,
    po_reference,
    eta_label,
    status,
    driver_name,
    driver_vehicle,
    driver_reg,
    progress_t
) VALUES
-- Company A: Meridian Logistics Bookings
(
    'NT-24817',
    'comp-meridian-001',
    '02 Aug 2026',
    'Manchester M17 1AB',
    'Warehouse desk',
    '0161 555 0134',
    'ASAP — ready now',
    'Birmingham B6 7EU',
    'Goods Inwards / Receiving',
    '0121 496 0281',
    'Bay 4 dock. Safety boots & hi-vis required.',
    'Palletised parts · 650 kg',
    650,
    2,
    'Sprinter LWB',
    'Emergency (ASAP)',
    88,
    248.00,
    'standby-account',
    'PO-2026-8910',
    '88 min',
    'In transit',
    'Marek Kowalski',
    'Sprinter LWB',
    'GN71 XPO',
    0.45
),
(
    'NT-24816',
    'comp-meridian-001',
    '02 Aug 2026',
    'Leeds LS1 5QN',
    'Sub-station gate',
    '0113 555 0192',
    '11:30 - 12:00',
    'Sheffield S9 1XU',
    'Engineering lead',
    '0114 496 0884',
    'Direct delivery to maintenance bay 2.',
    'Critical electrical relays · 45 kg',
    45,
    1,
    'Small Van',
    'Emergency (ASAP)',
    36,
    96.00,
    'standby-account',
    'PO-2026-8914',
    '15 min',
    'In transit',
    'David Ward',
    'Small Van',
    'KM23 BVK',
    0.75
),
(
    'NT-24815',
    'comp-meridian-001',
    '02 Aug 2026',
    'Liverpool L3 4FP',
    'Dock gate 2',
    '0151 555 0411',
    '08:00 - 08:30',
    'Preston PR1 2HE',
    'Assembly supervisor',
    '01772 496 019',
    'Tail-lift required for unloading pump.',
    'Factory replacement pump · 480 kg',
    480,
    1,
    'Luton Tail-lift',
    'Same-day Scheduled',
    34,
    182.00,
    'standby-account',
    'PO-2026-8890',
    'Delivered',
    'Delivered',
    'Gary Fletcher',
    'Luton Tail-lift',
    'PE22 ZXY',
    1.00
),
(
    'NT-24814',
    'comp-meridian-001',
    '02 Aug 2026',
    'London E14 9GE',
    'Canary Wharf loading bay',
    '0207 555 0188',
    '16:00 scheduled',
    'Reading RG1 1EX',
    'Data centre control',
    '0118 496 0331',
    'Security clearance and photo ID required.',
    'Server rack replacement · 320 kg',
    320,
    1,
    'Sprinter MWB',
    'Same-day Scheduled',
    44,
    210.00,
    'standby-account',
    'PO-2026-8922',
    '16:00',
    'Scheduled',
    'Driver unassigned',
    'Sprinter MWB',
    'TBD',
    0.00
),
-- Company B: Apex Precision Logistics Bookings
(
    'NT-25001',
    'comp-apex-002',
    '03 Aug 2026',
    'Manchester M17 1TN',
    'Dispatch Bay 3',
    '0161 884 9210',
    'ASAP — urgent production hold',
    'Bristol BS1 4DJ',
    'Plant Receiving Gate',
    '0117 555 0199',
    'Direct to Hangar 2 assembly dock.',
    'Aerospace hydraulic assemblies · 520 kg',
    520,
    2,
    'Sprinter LWB',
    'Emergency (ASAP)',
    168,
    395.00,
    'standby-account',
    'PO-APX-901',
    '140 min',
    'In transit',
    'Tomasz Nowak',
    'Sprinter LWB',
    'BV72 JKL',
    0.35
),
(
    'NT-25002',
    'comp-apex-002',
    '03 Aug 2026',
    'Coventry CV1 2TT',
    'Apex Midlands Hub',
    '0247 555 0418',
    '14:00 - 15:00',
    'Newcastle NE1 7RU',
    'Advanced Machining Facility',
    '0191 496 0382',
    'Overhead gantry crane required on arrival.',
    'Precision CNC spindles · 820 kg',
    820,
    2,
    'Luton Tail-lift',
    'Same-day Scheduled',
    210,
    445.00,
    'standby-account',
    'PO-APX-904',
    '17:30',
    'Scheduled',
    'Driver unassigned',
    'Luton Tail-lift',
    'TBD',
    0.00
),
(
    'NT-25003',
    'comp-apex-002',
    '01 Aug 2026',
    'Leeds LS1 4BT',
    'Quality Test Lab',
    '0113 555 0872',
    '09:00',
    'Sheffield S9 2LK',
    'Metallurgy Inward Dock',
    '0114 496 0419',
    'Delivered and signed by shift engineer.',
    'Titanium test billets · 65 kg',
    65,
    1,
    'Small Van',
    'Emergency (ASAP)',
    35,
    98.00,
    'standby-account',
    'PO-APX-880',
    'Delivered',
    'Delivered',
    'Simon Clark',
    'Small Van',
    'WN24 KPL',
    1.00
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. QUOTES SEED (Both Company A and Company B)
-- ------------------------------------------------------------------------------
INSERT INTO public.quotes (
    id,
    company_id,
    pickup,
    dropoff,
    route,
    vehicle,
    service,
    price_gbp,
    expires_label,
    status
) VALUES
-- Company A: Meridian Logistics Quotes
(
    'Q-4821',
    'comp-meridian-001',
    'Manchester',
    'Glasgow',
    'Manchester → Glasgow',
    'Sprinter LWB',
    'Same-day',
    412.00,
    'EXPIRES IN 2 DAYS',
    'active'
),
(
    'Q-4818',
    'comp-meridian-001',
    'Birmingham',
    'Cardiff',
    'Birmingham → Cardiff',
    'Small Van',
    'Next-day',
    128.00,
    'EXPIRES IN 5 DAYS',
    'active'
),
(
    'Q-4805',
    'comp-meridian-001',
    'Leeds',
    'Newcastle',
    'Leeds → Newcastle',
    'Luton Tail-lift',
    'Emergency',
    356.00,
    'EXPIRES TODAY',
    'active'
),
-- Company B: Apex Precision Logistics Quotes
(
    'Q-5101',
    'comp-apex-002',
    'Manchester',
    'Southampton',
    'Manchester → Southampton',
    'Sprinter LWB',
    'Same-day Scheduled',
    480.00,
    'EXPIRES IN 3 DAYS',
    'active'
),
(
    'Q-5102',
    'comp-apex-002',
    'Birmingham',
    'Leeds',
    'Birmingham → Leeds',
    'Small Van',
    'Emergency (ASAP)',
    195.00,
    'EXPIRES IN 24 HOURS',
    'urgent'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 6. INVOICES SEED (Both Company A and Company B)
-- ------------------------------------------------------------------------------
INSERT INTO public.invoices (
    id,
    company_id,
    date_label,
    period_label,
    amount_gbp,
    status,
    pdf_url
) VALUES
-- Company A: Meridian Logistics Invoices
(
    'INV-2026-0481',
    'comp-meridian-001',
    '01 Aug 2026',
    'July 2026',
    4280.00,
    'Paid',
    '/invoices/INV-2026-0481.pdf'
),
(
    'INV-2026-0455',
    'comp-meridian-001',
    '01 Jul 2026',
    'June 2026',
    3910.00,
    'Paid',
    '/invoices/INV-2026-0455.pdf'
),
(
    'INV-2026-0501',
    'comp-meridian-001',
    '05 Aug 2026',
    'Ad-hoc',
    640.00,
    'Due',
    '/invoices/INV-2026-0501.pdf'
),
(
    'INV-2026-0502',
    'comp-meridian-001',
    '06 Aug 2026',
    'Ad-hoc',
    320.00,
    'Overdue',
    '/invoices/INV-2026-0502.pdf'
),
-- Company B: Apex Precision Logistics Invoices
(
    'INV-2026-0610',
    'comp-apex-002',
    '01 Aug 2026',
    'July 2026',
    2150.00,
    'Paid',
    '/invoices/INV-2026-0610.pdf'
),
(
    'INV-2026-0622',
    'comp-apex-002',
    '06 Aug 2026',
    'Ad-hoc',
    540.00,
    'Due',
    '/invoices/INV-2026-0622.pdf'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 7. DOCUMENTS SEED (Scoped by company folder path in private storage)
-- ------------------------------------------------------------------------------
INSERT INTO public.documents (
    id,
    company_id,
    booking_id,
    name,
    type,
    date_label,
    file_url
) VALUES
-- Company A: Meridian Logistics Documents
(
    'doc-001',
    'comp-meridian-001',
    'NT-24810',
    'POD — NT-24810',
    'Proof of delivery · 31 Jul',
    '31 Jul 2026',
    'comp-meridian-001/doc-001-pod.pdf'
),
(
    'doc-002',
    'comp-meridian-001',
    'NT-24802',
    'CMR — NT-24802',
    'Consignment note · 29 Jul',
    '29 Jul 2026',
    'comp-meridian-001/doc-002-cmr.pdf'
),
(
    'doc-003',
    'comp-meridian-001',
    'NT-24788',
    'Shipping labels — NT-24788',
    'Labels · 24 Jul',
    '24 Jul 2026',
    'comp-meridian-001/doc-003-labels.pdf'
),
(
    'doc-004',
    'comp-meridian-001',
    'NT-24817',
    'Invoice INV-2026-0481',
    'Invoice · 01 Aug',
    '01 Aug 2026',
    'comp-meridian-001/doc-004-inv.pdf'
),
-- Company B: Apex Precision Logistics Documents
(
    'doc-apex-001',
    'comp-apex-002',
    'NT-25003',
    'POD — NT-25003',
    'Proof of delivery · 01 Aug',
    '01 Aug 2026',
    'comp-apex-002/doc-apex-001-pod.pdf'
),
(
    'doc-apex-002',
    'comp-apex-002',
    'NT-25001',
    'CMR — NT-25001',
    'Consignment note · 03 Aug',
    '03 Aug 2026',
    'comp-apex-002/doc-apex-002-cmr.pdf'
),
(
    'doc-apex-003',
    'comp-apex-002',
    NULL,
    'Fleet Goods-in-Transit Insurance 2026',
    'Compliance · 15 Jan',
    '15 Jan 2026',
    'comp-apex-002/doc-apex-003-insurance.pdf'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 8. SUPPORT TICKETS SEED (Both Company A and Company B)
-- ------------------------------------------------------------------------------
INSERT INTO public.support_tickets (
    id,
    company_id,
    topic,
    message,
    status
) VALUES
-- Company A: Meridian Logistics
(
    'SR-8921',
    'comp-meridian-001',
    'Tail-lift access confirmation for Birmingham depot',
    'Can duty dispatch ensure Luton Tail-lift vehicle is assigned for tomorrow 08:00 collection?',
    'Resolved'
),
(
    'SR-8944',
    'comp-meridian-001',
    'Pallet co-loading query',
    'Requesting clarification on hazardous material separation protocols.',
    'Open'
),
-- Company B: Apex Precision Logistics
(
    'SR-8960',
    'comp-apex-002',
    'Weekend collection availability for Bristol line',
    'Confirming if emergency dispatch is on call for Saturday morning collections at Trafford Park.',
    'Open'
)
ON CONFLICT (id) DO NOTHING;

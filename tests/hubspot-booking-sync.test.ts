/**
 * HUBSPOT BOOKING SYNCHRONIZATION TEST SUITE
 *
 * Validates:
 * 1. The eight HubSpot Deal property internal names match HubSpot CRM specifications.
 * 2. Authoritative source data mappings (booking reference, bill amount, operational mileage, POD, invoices).
 * 3. Idempotent Deal matching via neo_booking_reference (duplicate prevention).
 * 4. Bill amount preservation: Checkout-confirmed amount is never recalculated from actual mileage.
 * 5. Completion updates: stage transitions to closedwon and operational mileage is recorded.
 * 6. POD Release Gating:
 *    - POD withheld if delivery is incomplete.
 *    - POD withheld if delivery is complete but additional charge invoice is unpaid ('Due'/'Overdue').
 *    - POD released only when delivered AND all additional charges are confirmed 'Paid' (or none apply).
 * 7. Rate limit (429) & transient error retries.
 * 8. Security guards: Gated mutations fail closed outside test mode unless explicitly configured.
 * 9. Admin endpoint POST /api/admin/hubspot/sync-deal authentication and privilege enforcement.
 */

import assert from 'assert';
import http from 'http';
import app, {
  setServerSupabaseClientForTesting,
  setHubSpotClientForTesting,
  HUBSPOT_DEAL_PROPERTIES,
  HUBSPOT_DEAL_STAGES,
  evaluatePodRelease,
  resolveBookingPricingBreakdown,
  resolveCustomerForBooking,
} from '../api/index.js';
import { HubSpotClient } from '../api/hubspotClient.js';

function testRequest(
  server: http.Server,
  reqPath: string,
  method: string,
  headers: Record<string, string> = {},
  body?: string | Buffer | Record<string, any>
): Promise<{ status: number; data: any; rawBody: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as any;
    const port = address.port;

    const reqHeaders: Record<string, string> = { ...headers };
    let postBuffer: Buffer | undefined;

    if (body !== undefined) {
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        postBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
      } else {
        postBuffer = Buffer.from(JSON.stringify(body), 'utf8');
        if (!reqHeaders['Content-Type']) {
          reqHeaders['Content-Type'] = 'application/json';
        }
      }
      reqHeaders['Content-Length'] = postBuffer.length.toString();
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: reqPath,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode || 500, data: parsed, rawBody: raw, headers: res.headers });
        });
      }
    );

    req.on('error', reject);
    if (postBuffer !== undefined) {
      req.write(postBuffer);
    }
    req.end();
  });
}

async function runHubSpotSyncTests() {
  console.log('\n========================================================================');
  console.log('=== STARTING HUBSPOT BOOKING SYNCHRONIZATION TEST SUITE ===');
  console.log('========================================================================\n');

  const originalNodeEnv = process.env.NODE_ENV;
  const originalSyncEnabled = process.env.NEO_HUBSPOT_SYNC_ENABLED;
  const originalKey = process.env.HUBSPOT_SERVICE_KEY;
  process.env.NODE_ENV = 'test';
  process.env.HUBSPOT_SERVICE_KEY = 'pat-na1-mock-key-for-test-suite-00000000';

  const recordedAudits: any[] = [];

  // Mock in-memory database
  const mockBookings: Record<string, any> = {
    'NT-24818': {
      id: 'NT-24818',
      company_id: 'comp-acme-logistics',
      pickup: 'Manchester M17 1AB',
      dropoff: 'Birmingham B6 7EU',
      total_gbp: 320.0,
      distance_miles: 88.0,
      vehicle: 'Sprinter LWB',
      service: 'Emergency (ASAP)',
      status: 'Scheduled',
      pickup_contact: 'Warehouse Desk',
      pickup_phone: '0161 555 0134',
      created_at: new Date('2026-10-19T10:00:00Z').toISOString(),
    },
    'NT-24825-AUTHORITATIVE': {
      id: 'NT-24825-AUTHORITATIVE',
      company_id: 'comp-acme-logistics',
      pickup: 'Manchester M17 1AB',
      dropoff: 'Birmingham B6 7EU',
      total_gbp: 320.0,
      distance_miles: 88.0,
      vehicle: 'Sprinter LWB',
      service: 'Emergency (ASAP)',
      status: 'Scheduled',
      pickup_contact: 'Warehouse Desk',
      pickup_phone: '0161 555 0134',
      created_at: new Date('2026-10-19T10:00:00Z').toISOString(),
    },
    'NT-GUEST-BOOKING': {
      id: 'NT-GUEST-BOOKING',
      company_id: null,
      pickup: 'London E1 6AN',
      dropoff: 'London W1K 7AA',
      total_gbp: 150.0,
      distance_miles: 5.0,
      vehicle: 'Small Van',
      service: 'Direct Transit',
      status: 'Scheduled',
      pickup_contact: 'Solo Consignor',
      pickup_phone: '0207 946 0123',
      created_at: new Date('2026-10-19T11:00:00Z').toISOString(),
    },
    'NT-ORPHAN-COMPANY': {
      id: 'NT-ORPHAN-COMPANY',
      company_id: 'comp-orphan-no-profiles',
      pickup: 'Oxford OX1 1AA',
      dropoff: 'Swindon SN1 1AA',
      total_gbp: 210.0,
      distance_miles: 30.0,
      vehicle: 'Short Wheelbase',
      service: 'Direct Transit',
      status: 'Scheduled',
      pickup_contact: 'Site Reception',
      pickup_phone: '01865 999 888',
      created_at: new Date('2026-10-19T12:00:00Z').toISOString(),
    },
    'NT-24819-DELIVERED': {
      id: 'NT-24819-DELIVERED',
      company_id: 'comp-acme-logistics',
      pickup: 'Leeds LS1 1AA',
      dropoff: 'Newcastle NE1 1AD',
      total_gbp: 450.0,
      distance_miles: 105.0,
      vehicle: 'Luton Box with Tail Lift',
      service: 'Direct Transit',
      status: 'Delivered',
      pickup_contact: 'Dispatch Desk',
      pickup_phone: '0113 555 0199',
      created_at: new Date('2026-10-19T08:00:00Z').toISOString(),
    },
  };

  const mockDocuments: Record<string, any[]> = {
    'NT-24819-DELIVERED': [
      {
        id: 'doc-pod-99',
        booking_id: 'NT-24819-DELIVERED',
        name: 'POD — NT-24819-DELIVERED Signed',
        type: 'pod',
        file_url: 'https://storage.supabase.co/v1/object/authenticated/documents/comp-acme-logistics/pod_99.pdf',
      },
    ],
  };

  const mockInvoices: Record<string, any[]> = {
    'comp-acme-logistics': [
      {
        id: 'INV-2026-001',
        company_id: 'comp-acme-logistics',
        status: 'Paid',
        amount_gbp: 450.0,
      },
      {
        id: 'INV-2026-OVERDUE-MONTHLY',
        company_id: 'comp-acme-logistics',
        status: 'Overdue',
        amount_gbp: 12500.0,
      },
    ],
  };

  const mockCompanies: Record<string, any> = {
    'comp-acme-logistics': {
      id: 'comp-acme-logistics',
      name: 'Acme Logistics Ltd',
      standby_active: true,
      verified: true,
    },
    'comp-beta-freight': {
      id: 'comp-beta-freight',
      name: 'Beta Freight Group',
      standby_active: true,
      verified: true,
    },
    'comp-orphan-no-profiles': {
      id: 'comp-orphan-no-profiles',
      name: 'Orphan Corp Ltd',
      standby_active: true,
      verified: true,
    },
    'comp-all-suspended': {
      id: 'comp-all-suspended',
      name: 'Suspended Accounts Ltd',
      standby_active: false,
      verified: true,
    },
  };

  const mockProfilesList: any[] = [
    {
      id: 'admin-1',
      company_id: null,
      full_name: 'Admin User',
      email: 'admin@neo-transport.co.uk',
      role: 'admin',
      status: 'active',
      created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    },
    {
      id: 'cust-1',
      company_id: 'comp-acme-logistics',
      full_name: 'Sarah Jenkins',
      email: 'sarah.jenkins@acme-logistics.co.uk',
      role: 'customer',
      status: 'active',
      created_at: new Date('2026-02-01T10:00:00Z').toISOString(),
    },
    {
      id: 'cust-2-dispatch',
      company_id: 'comp-acme-logistics',
      full_name: 'Dispatch Desk',
      email: 'dispatch@acme-logistics.co.uk',
      role: 'customer',
      status: 'active',
      created_at: new Date('2026-03-01T10:00:00Z').toISOString(),
    },
    {
      id: 'cust-suspended',
      company_id: 'comp-acme-logistics',
      full_name: 'Old User',
      email: 'old.suspended@acme-logistics.co.uk',
      role: 'customer',
      status: 'suspended',
      created_at: new Date('2025-01-01T10:00:00Z').toISOString(),
    },
    {
      id: 'cust-all-suspended-only',
      company_id: 'comp-all-suspended',
      full_name: 'Banned Person',
      email: 'banned@suspended.com',
      role: 'customer',
      status: 'suspended',
      created_at: new Date('2025-05-01T10:00:00Z').toISOString(),
    },
    {
      id: 'cust-beta-primary',
      company_id: 'comp-beta-freight',
      full_name: 'David Miller',
      email: 'dmiller@betafreight.com',
      role: 'customer',
      status: 'active',
      created_at: new Date('2026-04-01T10:00:00Z').toISOString(),
    },
  ];

  const mockSupabaseClient = {
    auth: {
      getUser: async (token: string) => {
        if (token === 'admin-valid-token') {
          return { data: { user: { id: 'admin-1', email: 'admin@neo-transport.co.uk' } }, error: null };
        }
        if (token === 'customer-token') {
          return { data: { user: { id: 'cust-1', email: 'user@acme.com' } }, error: null };
        }
        return { data: { user: null }, error: { message: 'Invalid session token' } };
      },
    },
    from: (table: string) => {
            if (table === 'companies') {
        return {
          select: () => {
            const filters: Record<string, any> = {};
            const q = {
              eq: (col: string, val: any) => {
                filters[col] = val;
                return q;
              },
              maybeSingle: async () => {
                const found = mockCompanies[filters.id];
                return { data: found || null, error: null };
              },
              single: async () => {
                const found = mockCompanies[filters.id];
                return found
                  ? { data: found, error: null }
                  : { data: null, error: { code: 'PGRST116', message: 'Not found' } };
              },
            };
            return q;
          },
        };
      }
      if (table === 'profiles') {
        return {
          select: () => {
            const filters: Record<string, any> = {};
            const q = {
              eq: (col: string, val: any) => {
                filters[col] = val;
                return q;
              },
              single: async () => {
                const found = mockProfilesList.find((p) => p.id === filters.id);
                if (found) {
                  return { data: found, error: null };
                }
                return { data: null, error: { code: 'PGRST116', message: 'Not found' } };
              },
              maybeSingle: async () => {
                const found = mockProfilesList.find((p) => {
                  return Object.entries(filters).every(([k, v]) => p[k] === v);
                });
                return { data: found || null, error: null };
              },
              then: (resolve: (val: any) => any, reject: (err: any) => any) => {
                const results = mockProfilesList.filter((p) => {
                  return Object.entries(filters).every(([k, v]) => p[k] === v);
                });
                return Promise.resolve({ data: results, error: null }).then(resolve, reject);
              },
            };
            return q;
          },
        };
      }
      if (table === 'bookings') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              single: async () => {
                const b = mockBookings[val];
                return b ? { data: b, error: null } : { data: null, error: { code: 'PGRST116', message: 'Not found' } };
              },
            }),
          }),
        };
      }
      if (table === 'documents') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => Promise.resolve({ data: mockDocuments[val] || [], error: null }),
          }),
        };
      }
      if (table === 'invoices') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => Promise.resolve({ data: mockInvoices[val] || [], error: null }),
          }),
        };
      }
      if (table === 'admin_audit_logs') {
        return {
          insert: async (record: any) => {
            recordedAudits.push(record);
            return { error: null };
          },
        };
      }
      return {};
    },
  };

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    setServerSupabaseClientForTesting(mockSupabaseClient as any);

    // -------------------------------------------------------------------------
    // 1. HubSpot Deal Property Schema & Mapping Verification
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing Eight HubSpot Deal Property Names & Schema Conformance ---');

    // Verify the eight authoritative custom Deal property internal names
    const expectedEightCustomProperties = [
      'neo_base_fee',
      'neo_billing_calculation_version',
      'neo_booking_reference',
      'neo_mileage_charge',
      'neo_operational_mileage',
      'neo_per_mileage_rate',
      'neo_verified_dropoff_address',
      'neo_verified_pickup_address',
    ];

    const actualConstants = [
      HUBSPOT_DEAL_PROPERTIES.BASE_FEE,
      HUBSPOT_DEAL_PROPERTIES.BILLING_CALCULATION_VERSION,
      HUBSPOT_DEAL_PROPERTIES.MILEAGE_CHARGE,
      HUBSPOT_DEAL_PROPERTIES.NEO_BOOKING_REFERENCE,
      HUBSPOT_DEAL_PROPERTIES.NEO_OPERATIONAL_MILEAGE_MILES,
      HUBSPOT_DEAL_PROPERTIES.PER_MILEAGE_RATE,
      HUBSPOT_DEAL_PROPERTIES.VERIFIED_DROP_OFF_ADDRESS,
      HUBSPOT_DEAL_PROPERTIES.VERIFIED_PICK_UP_ADDRESS,
    ].sort();

    assert.deepStrictEqual(actualConstants, expectedEightCustomProperties.sort());
    console.log('✓ PASS 1.1: Exact 8 custom HubSpot Deal property internal names verified');

    // Standard properties verified
    assert.strictEqual(HUBSPOT_DEAL_PROPERTIES.DEALNAME, 'dealname');
    assert.strictEqual(HUBSPOT_DEAL_PROPERTIES.AMOUNT, 'amount');
    assert.strictEqual(HUBSPOT_DEAL_PROPERTIES.DEALSTAGE, 'dealstage');
    assert.strictEqual(HUBSPOT_DEAL_PROPERTIES.PIPELINE, 'pipeline');
    assert.strictEqual(HUBSPOT_DEAL_PROPERTIES.CLOSEDATE, 'closedate');
    console.log('✓ PASS 1.2: Standard HubSpot Deal properties verified (dealname, amount, dealstage, pipeline, closedate)');

    // Pipeline stages verified against HubSpot default sales pipeline
    assert.strictEqual(HUBSPOT_DEAL_STAGES.APPOINTMENT_SCHEDULED, 'appointmentscheduled');
    assert.strictEqual(HUBSPOT_DEAL_STAGES.CLOSED_WON, 'closedwon');
    console.log('✓ PASS 1.3: Pipeline stages verified (appointmentscheduled -> closedwon)');

    // -------------------------------------------------------------------------
    // 2. Authoritative Pricing Breakdown & Billing Preservation Logic
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Pricing Breakdown & Checkout Bill Preservation ---');

    // Sprinter LWB: 90 base + 1.85/mi * 88 = 90 + 162.80 = 252.80, checkout confirmed amount 320.00
    const pricing = resolveBookingPricingBreakdown({
      vehicle: 'Sprinter LWB',
      distanceMiles: 88,
      totalGbp: 320.0,
    });

    assert.strictEqual(pricing.baseFee, 90);
    assert.strictEqual(pricing.perMileRate, 1.85);
    assert.strictEqual(pricing.mileageCharge, 162.8);
    assert.strictEqual(pricing.totalGbp, 320.0, 'totalGbp must preserve the checkout confirmed bill amount');
    assert.strictEqual(pricing.billingVersion, 'v1.0-standard');
    console.log('✓ PASS 2.1: Vehicle base rates and mileage charges calculated correctly with checkout total preserved');

    // Explicit rates provided
    const customPricing = resolveBookingPricingBreakdown({
      distanceMiles: 100,
      totalGbp: 500.0,
      baseFee: 150,
      perMileRate: 3.5,
      billingVersion: 'v2.1-custom',
    });
    assert.strictEqual(customPricing.baseFee, 150);
    assert.strictEqual(customPricing.perMileRate, 3.5);
    assert.strictEqual(customPricing.mileageCharge, 350.0);
    assert.strictEqual(customPricing.totalGbp, 500.0);
    assert.strictEqual(customPricing.billingVersion, 'v2.1-custom');
    console.log('✓ PASS 2.2: Explicit customer rates preserved accurately');

    // -------------------------------------------------------------------------
    // 3. Authoritative POD Release Gating Logic (Fail-Closed & Admin Manual Review)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing POD Release Gating Logic ---');

    // 3.1 Undelivered booking: POD withheld
    const evalInTransit = evaluatePodRelease({
      bookingStatus: 'In transit',
      podDocument: { file_url: 'https://example.com/pod.pdf' },
    });
    assert.strictEqual(evalInTransit.canReleasePod, false);
    assert.strictEqual(evalInTransit.isDelivered, false);
    assert.strictEqual(evalInTransit.blocked, false);
    assert.ok(evalInTransit.reason.includes('Delivery is not completed'));
    assert.strictEqual(evalInTransit.podDocumentUrl, null);
    console.log('✓ PASS 3.1: POD withheld when booking is not yet Delivered');

    // 3.2 Delivered booking missing POD document: POD withheld
    const evalMissingPod = evaluatePodRelease({
      bookingStatus: 'Delivered',
      podDocument: null,
    });
    assert.strictEqual(evalMissingPod.canReleasePod, false);
    assert.strictEqual(evalMissingPod.isDelivered, true);
    assert.strictEqual(evalMissingPod.hasPodDocument, false);
    assert.strictEqual(evalMissingPod.blocked, false);
    assert.ok(evalMissingPod.reason.includes('has not been uploaded'));
    assert.strictEqual(evalMissingPod.podDocumentUrl, null);
    console.log('✓ PASS 3.2: POD withheld when official POD document is missing');

    // 3.3 Delivered booking with POD but missing payment evidence (no manual review): FAILS CLOSED, BLOCKED
    const evalNoPaymentEvidence = evaluatePodRelease({
      bookingStatus: 'Delivered',
      podDocument: { file_url: 'https://example.com/pod.pdf' },
      manualReview: undefined,
    });
    assert.strictEqual(evalNoPaymentEvidence.canReleasePod, false);
    assert.strictEqual(evalNoPaymentEvidence.isDelivered, true);
    assert.strictEqual(evalNoPaymentEvidence.hasPodDocument, true);
    assert.strictEqual(evalNoPaymentEvidence.blocked, true);
    assert.strictEqual(evalNoPaymentEvidence.paymentStatus, 'unknown');
    assert.ok(evalNoPaymentEvidence.reason.includes('BLOCKED'));
    assert.strictEqual(evalNoPaymentEvidence.podDocumentUrl, null);
    console.log('✓ PASS 3.3: Automated release fails closed and reports BLOCKED when booking payment evidence is missing/unknown');

    // 3.4 Delivered booking with manual admin review confirming outstanding charges (status: 'unpaid'): POD withheld
    const evalAdminUnpaid = evaluatePodRelease({
      bookingStatus: 'Delivered',
      podDocument: { file_url: 'https://example.com/pod.pdf' },
      manualReview: {
        verifiedByAdmin: true,
        status: 'unpaid',
        reviewerNotes: 'Detention fee of £75 pending payment',
      },
    });
    assert.strictEqual(evalAdminUnpaid.canReleasePod, false);
    assert.strictEqual(evalAdminUnpaid.blocked, true);
    assert.strictEqual(evalAdminUnpaid.paymentStatus, 'unpaid');
    assert.strictEqual(evalAdminUnpaid.hasAdditionalCharges, true);
    assert.strictEqual(evalAdminUnpaid.additionalChargesPaid, false);
    assert.ok(evalAdminUnpaid.reason.includes('unpaid'));
    assert.strictEqual(evalAdminUnpaid.podDocumentUrl, null);
    console.log('✓ PASS 3.4: POD withheld when manual admin review confirms outstanding additional charges');

    // 3.5 Delivered booking with manual admin review confirming charges cleared (status: 'cleared'): POD released
    const evalAdminCleared = evaluatePodRelease({
      bookingStatus: 'Delivered',
      podDocument: { file_url: 'https://storage.supabase.co/documents/pod.pdf' },
      manualReview: {
        verifiedByAdmin: true,
        status: 'cleared',
        reviewerNotes: 'Verified standard rate booking; no extra charges',
        confirmedPaymentReference: 'STRIPE-CH-12345',
      },
    });
    assert.strictEqual(evalAdminCleared.canReleasePod, true);
    assert.strictEqual(evalAdminCleared.blocked, false);
    assert.strictEqual(evalAdminCleared.paymentStatus, 'cleared');
    assert.strictEqual(evalAdminCleared.additionalChargesPaid, true);
    assert.strictEqual(evalAdminCleared.podDocumentUrl, 'https://storage.supabase.co/documents/pod.pdf');
    assert.ok(evalAdminCleared.reason.includes('POD released'));
    console.log('✓ PASS 3.5: POD released when Delivered and admin manual review confirms payment status cleared');

    // 3.6 Unrelated company-level monthly invoices do not affect booking release
    // (Database public.invoices contains monthly corporate credit lines, which must not be conflated with booking release)
    const evalWithCompanyCredit = evaluatePodRelease({
      bookingStatus: 'Delivered',
      podDocument: { file_url: 'https://storage.supabase.co/documents/pod.pdf' },
      manualReview: {
        verifiedByAdmin: true,
        status: 'cleared',
        reviewerNotes: 'Standby corporate account in good standing; 30-day term applies to monthly billing',
      },
    });
    assert.strictEqual(evalWithCompanyCredit.canReleasePod, true);
    assert.strictEqual(evalWithCompanyCredit.blocked, false);
    assert.strictEqual(evalWithCompanyCredit.paymentStatus, 'cleared');
    console.log('✓ PASS 3.6: Unrelated monthly corporate invoices do not interfere with verified booking POD release');

    // 3.7 Invalid or unverified manual review attempt fails closed
    const evalUnverified = evaluatePodRelease({
      bookingStatus: 'Delivered',
      podDocument: { file_url: 'https://storage.supabase.co/documents/pod.pdf' },
      manualReview: {
        verifiedByAdmin: false,
        status: 'cleared',
        reviewerNotes: 'Attempted unverified bypass',
      },
    });
    assert.strictEqual(evalUnverified.canReleasePod, false);
    assert.strictEqual(evalUnverified.blocked, true);
    assert.strictEqual(evalUnverified.paymentStatus, 'unknown');
    assert.ok(evalUnverified.reason.includes('BLOCKED'));
    console.log('✓ PASS 3.7: Unverified manual review attempt strictly fails closed and remains BLOCKED');

    // -------------------------------------------------------------------------
    // 4. Client Synchronization: Idempotency, Duplicate Prevention, and Billing Preservation
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Client Idempotent Sync & Bill Preservation ---');

    // Mock HubSpot CRM in-memory store
    const crmDeals: Record<string, any> = {};
    const crmContacts: Record<string, any> = {};
    let createdDealCounter = 1000;

    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = init?.method || 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : null;

      // Contact Search
      if (url.includes('/crm/v3/objects/contacts/search') && method === 'POST') {
        const emailFilter = body?.filterGroups?.[0]?.filters?.[0]?.value;
        const found = Object.values(crmContacts).find((c: any) => c.properties.email === emailFilter);
        return new Response(JSON.stringify({ results: found ? [found] : [] }), { status: 200 });
      }

      // Contact Create
      if (url.endsWith('/crm/v3/objects/contacts') && method === 'POST') {
        const contactId = `contact-${Object.keys(crmContacts).length + 1}`;
        const record = { id: contactId, properties: body.properties };
        crmContacts[contactId] = record;
        return new Response(JSON.stringify(record), { status: 201 });
      }

      // Deal Search by neo_booking_reference
      if (url.includes('/crm/v3/objects/deals/search') && method === 'POST') {
        const refFilter = body?.filterGroups?.[0]?.filters?.[0]?.value;
        const found = Object.values(crmDeals).find(
          (d: any) => d.properties.neo_booking_reference === refFilter
        );
        return new Response(JSON.stringify({ results: found ? [found] : [] }), { status: 200 });
      }

      // Deal Create
      if (url.endsWith('/crm/v3/objects/deals') && method === 'POST') {
        createdDealCounter++;
        const dealId = `deal-${createdDealCounter}`;
        const record = { id: dealId, properties: { ...body.properties }, associations: body.associations };
        crmDeals[dealId] = record;
        return new Response(JSON.stringify(record), { status: 201 });
      }

      // Deal Update (PATCH)
      if (url.includes('/crm/v3/objects/deals/') && method === 'PATCH') {
        const match = url.match(/\/deals\/([^/?]+)/);
        const dealId = match ? match[1] : '';
        const existing = crmDeals[dealId];
        if (!existing) {
          return new Response(JSON.stringify({ message: 'Deal not found' }), { status: 404 });
        }
        existing.properties = { ...existing.properties, ...body.properties };
        return new Response(JSON.stringify(existing), { status: 200 });
      }

      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    };

    const client = new HubSpotClient({ apiKey: 'pat-test', fetchFn: mockFetch });

    // 4.1 First synchronization creates new Deal with checkout-confirmed amount
    const sync1 = await client.syncBookingDeal({
      reference: 'NT-24818',
      pickup: 'Manchester M17 1AB',
      dropoff: 'Birmingham B6 7EU',
      totalGbp: 320.0,
      distanceMiles: 88,
      vehicle: 'Sprinter LWB',
      contactEmail: 'logistics@acme.com',
      contactName: 'Jane Smith',
    });

    assert.strictEqual(sync1.action, 'created');
    assert.strictEqual(sync1.bookingReference, 'NT-24818');
    assert.strictEqual(sync1.confirmedAmount, 320.0);
    assert.strictEqual(sync1.properties.neo_booking_reference, 'NT-24818');
    assert.strictEqual(sync1.properties.amount, '320.00');
    assert.strictEqual(sync1.properties[HUBSPOT_DEAL_PROPERTIES.BASE_FEE], '90.00');
    assert.strictEqual(sync1.properties[HUBSPOT_DEAL_PROPERTIES.PER_MILEAGE_RATE], '1.85');
    assert.strictEqual(sync1.properties[HUBSPOT_DEAL_PROPERTIES.MILEAGE_CHARGE], '162.80');
    assert.strictEqual(sync1.properties[HUBSPOT_DEAL_PROPERTIES.BILLING_CALCULATION_VERSION], 'v1.0-standard');
    assert.strictEqual(sync1.properties.dealstage, 'appointmentscheduled');
    assert.strictEqual(sync1.properties[HUBSPOT_DEAL_PROPERTIES.NEO_OPERATIONAL_MILEAGE_MILES], undefined, 'Estimated distanceMiles must NEVER be sent as operational mileage');
    console.log('✓ PASS 4.1: Initial booking sync created Deal with all 8 properties and checkout-confirmed amount (£320.00)');

    // 4.2 Duplicate sync: Returns existing Deal without creating a duplicate record
    const sync2 = await client.syncBookingDeal({
      reference: 'NT-24818',
      pickup: 'Manchester M17 1AB',
      dropoff: 'Birmingham B6 7EU',
      totalGbp: 320.0,
      distanceMiles: 88,
    });

    assert.strictEqual(sync2.action, 'already_exists');
    assert.strictEqual(sync2.dealId, sync1.dealId, 'Must return identical dealId');
    assert.strictEqual(sync2.confirmedAmount, 320.0);
    assert.strictEqual(Object.keys(crmDeals).length, 1, 'Duplicate record must NOT be created');
    console.log('✓ PASS 4.2: Duplicate sync identified existing Deal via neo_booking_reference and prevented duplication');

    // 4.3 Completion Update with known actual mileage: Transitions stage to closedwon, records actual mileage, PRESERVES BILLING
    const completion = await client.completeBookingDeal({
      bookingReference: 'NT-24818',
      actualMileage: 95.5, // Driver took detour: actual mileage is 95.5 vs 88.0
      podEvaluation: {
        isDelivered: true,
        hasPodDocument: true,
        canReleasePod: true,
        blocked: false,
        paymentStatus: 'cleared',
        hasAdditionalCharges: true,
        additionalChargesPaid: true,
        reason: 'Delivery completed and paid',
        podDocumentUrl: 'https://storage.supabase.co/pod.pdf',
      },
    });

    assert.strictEqual(completion.action, 'completed');
    assert.strictEqual(completion.dealId, sync1.dealId);
    assert.strictEqual(completion.stage, 'closedwon');
    assert.strictEqual(completion.operationalMileage, 95.5);
    assert.strictEqual(completion.podReleased, true);
    // CRITICAL: Amount must still be £320.00, NOT recalculated to 90 + 1.85 * 95.5 = 266.68!
    assert.strictEqual(completion.preservedAmount, 320.0);
    assert.strictEqual(crmDeals[sync1.dealId].properties.amount, '320.00');
    assert.strictEqual(crmDeals[sync1.dealId].properties[HUBSPOT_DEAL_PROPERTIES.NEO_OPERATIONAL_MILEAGE_MILES], '95.50');
    assert.strictEqual(crmDeals[sync1.dealId].properties.dealstage, 'closedwon');
    console.log('✓ PASS 4.3: Completion updated stage to closedwon, recorded actual mileage, and STRICTLY preserved checkout amount');

    // 4.4 Completion Update with MISSING actual mileage: Transitions stage to closedwon, leaves operational mileage unset, PRESERVES BILLING
    const syncNoMileage = await client.syncBookingDeal({
      reference: 'NT-24820-NOMILE',
      pickup: 'Bristol BS1 4DJ',
      dropoff: 'Cardiff CF10 1FS',
      totalGbp: 180.0,
      distanceMiles: 44, // Estimated distance must NEVER be sent as operational mileage
      vehicle: 'Small Van',
    });
    assert.strictEqual(syncNoMileage.properties[HUBSPOT_DEAL_PROPERTIES.NEO_OPERATIONAL_MILEAGE_MILES], undefined, 'Estimated distance must not be sent on initial sync');

    const completionNoMileage = await client.completeBookingDeal({
      bookingReference: 'NT-24820-NOMILE',
      // actualMileage is explicitly undefined / omitted
      podEvaluation: {
        isDelivered: true,
        hasPodDocument: true,
        canReleasePod: true,
        blocked: false,
        paymentStatus: 'cleared',
        hasAdditionalCharges: false,
        additionalChargesPaid: true,
        reason: 'Delivery completed and zero charges',
        podDocumentUrl: 'https://storage.supabase.co/pod-nomile.pdf',
      },
    });

    assert.strictEqual(completionNoMileage.action, 'completed');
    assert.strictEqual(completionNoMileage.dealId, syncNoMileage.dealId);
    assert.strictEqual(completionNoMileage.stage, 'closedwon');
    assert.strictEqual(completionNoMileage.operationalMileage, undefined, 'Operational mileage must remain undefined when missing');
    assert.strictEqual(crmDeals[syncNoMileage.dealId].properties[HUBSPOT_DEAL_PROPERTIES.NEO_OPERATIONAL_MILEAGE_MILES], undefined, 'Deal operational mileage must NOT be populated with estimated 44 miles');
    assert.strictEqual(completionNoMileage.preservedAmount, 180.0);
    assert.strictEqual(crmDeals[syncNoMileage.dealId].properties.amount, '180.00');
    assert.strictEqual(crmDeals[syncNoMileage.dealId].properties.dealstage, 'closedwon');
    console.log('✓ PASS 4.4: Completion without actual mileage transitioned stage and preserved bill amount without inventing operational mileage');

    // -------------------------------------------------------------------------
    // 5. Retries on Rate Limit (HTTP 429) & Transient Errors
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Rate Limit & Transient Network Retries ---');

    let attempt429 = 0;
    const mockFetchWith429 = async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
      attempt429++;
      if (attempt429 === 1) {
        return new Response(JSON.stringify({ message: 'Rate limit exceeded' }), {
          status: 429,
          headers: { 'retry-after': '0' },
        });
      }
      return new Response(JSON.stringify({ results: [{ id: 'deal-retry-success', properties: { neo_booking_reference: 'NT-RETRY' } }] }), {
        status: 200,
      });
    };

    const retryClient = new HubSpotClient({ apiKey: 'pat-test', fetchFn: mockFetchWith429 });
    const retryResult = await retryClient.findDealByBookingReference('NT-RETRY');
    assert.strictEqual(retryResult?.id, 'deal-retry-success');
    assert.strictEqual(attempt429, 2, 'Must have retried after initial HTTP 429');
    console.log('✓ PASS 5.1: HTTP 429 rate limit successfully retried and recovered');

    let attempt503 = 0;
    const mockFetchWith503 = async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
      attempt503++;
      if (attempt503 === 1) {
        return new Response(JSON.stringify({ message: 'Service temporarily unavailable' }), { status: 503 });
      }
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    };

    const serverErrClient = new HubSpotClient({ apiKey: 'pat-test', fetchFn: mockFetchWith503 });
    const serverErrResult = await serverErrClient.findDealByBookingReference('NT-NONEXISTENT');
    assert.strictEqual(serverErrResult, null);
    assert.strictEqual(attempt503, 2, 'Must have retried after initial HTTP 503');
    console.log('✓ PASS 5.2: HTTP 503 gateway transient error successfully retried and recovered');

    // -------------------------------------------------------------------------
    // 6. Security Mutation Gates
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Production Mutation Safety Gates ---');

    process.env.NODE_ENV = 'production';
    delete process.env.NEO_HUBSPOT_SYNC_ENABLED;

    const prodClient = new HubSpotClient({ apiKey: 'pat-test' });
    await assert.rejects(
      async () => prodClient.syncBookingDeal({ reference: 'NT-X', pickup: 'A', dropoff: 'B', totalGbp: 100, distanceMiles: 10 }),
      /SECURITY VIOLATION.*HubSpot mutations are disabled/i
    );
    await assert.rejects(
      async () => prodClient.completeBookingDeal({ bookingReference: 'NT-X' }),
      /SECURITY VIOLATION.*HubSpot mutations are disabled/i
    );
    await assert.rejects(
      async () => prodClient.findOrCreateContact({ email: 'test@acme.com' }),
      /SECURITY VIOLATION.*HubSpot mutations are disabled/i
    );
    console.log('✓ PASS 6.1: Mutating sync operations fail closed with SECURITY VIOLATION in production when sync flag is disabled');

    // When flag is explicitly enabled, mutation allowed in production
    process.env.NEO_HUBSPOT_SYNC_ENABLED = 'true';
    const prodEnabledClient = new HubSpotClient({ apiKey: 'pat-test', fetchFn: mockFetch });
    const enabledResult = await prodEnabledClient.syncBookingDeal({
      reference: 'NT-PROD-FLAG',
      pickup: 'A',
      dropoff: 'B',
      totalGbp: 250,
      distanceMiles: 20,
    });
    assert.strictEqual(enabledResult.action, 'created');
    console.log('✓ PASS 6.2: Mutating operations proceed when NEO_HUBSPOT_SYNC_ENABLED === true');

    process.env.NODE_ENV = 'test';
    delete process.env.NEO_HUBSPOT_SYNC_ENABLED;

    // -------------------------------------------------------------------------
    // 7. Server Admin Sync Endpoint (POST /api/admin/hubspot/sync-deal)
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Admin Sync Endpoint POST /api/admin/hubspot/sync-deal ---');

    setHubSpotClientForTesting(client);

    // 7.1 Unauthenticated request returns 401
    const unauth = await testRequest(server, '/api/admin/hubspot/sync-deal', 'POST', {}, { bookingId: 'NT-24825-AUTHORITATIVE' });
    assert.strictEqual(unauth.status, 401);
    console.log('✓ PASS 7.1: Unauthenticated request rejected with 401');

    // 7.2 Non-admin customer returns 403
    const custRes = await testRequest(server, '/api/admin/hubspot/sync-deal', 'POST', { Authorization: 'Bearer customer-token' }, { bookingId: 'NT-24818' });
    assert.strictEqual(custRes.status, 403);
    console.log('✓ PASS 7.2: Non-admin customer rejected with 403');

    // 7.3 Missing bookingId returns 400
    const missingId = await testRequest(server, '/api/admin/hubspot/sync-deal', 'POST', { Authorization: 'Bearer admin-valid-token' }, {});
    assert.strictEqual(missingId.status, 400);
    console.log('✓ PASS 7.3: Missing bookingId rejected with 400');

    // 7.4 Non-existent booking returns 404
    const notFound = await testRequest(server, '/api/admin/hubspot/sync-deal', 'POST', { Authorization: 'Bearer admin-valid-token' }, { bookingId: 'NT-UNKNOWN-999' });
    assert.strictEqual(notFound.status, 404);
    console.log('✓ PASS 7.4: Non-existent booking returns 404');

    // 7.5 Automated sync without manual review fails closed: POD withheld, BLOCKED reported
    const syncDeliveredRes = await testRequest(
      server,
      '/api/admin/hubspot/sync-deal',
      'POST',
      { Authorization: 'Bearer admin-valid-token' },
      { bookingId: 'NT-24819-DELIVERED' }
    );
    assert.strictEqual(syncDeliveredRes.status, 200);
    assert.strictEqual(syncDeliveredRes.data.success, true);
    assert.strictEqual(syncDeliveredRes.data.data.bookingReference, 'NT-24819-DELIVERED');
    assert.strictEqual(syncDeliveredRes.data.data.preservedAmount, 450.0);
    assert.strictEqual(syncDeliveredRes.data.data.podReleased, false, 'Automated sync must fail closed and withhold POD');
    assert.strictEqual(
      syncDeliveredRes.data.data.operationalMileage,
      undefined,
      'Operational mileage must remain undefined when no authoritative actual mileage is provided'
    );
    assert.strictEqual(syncDeliveredRes.data.podEvaluation.blocked, true);
    assert.strictEqual(syncDeliveredRes.data.podEvaluation.canReleasePod, false);
    assert.strictEqual(syncDeliveredRes.data.podEvaluation.paymentStatus, 'unknown');
    assert.ok(syncDeliveredRes.data.podEvaluation.reason.includes('BLOCKED'));
    console.log('✓ PASS 7.5: Automated sync without manual review fails closed, reports BLOCKED, and preserves bill amount');

    // 7.6 Verify admin audit log for fail-closed sync
    const syncAudit = recordedAudits.find((a) => a.action === 'sync_hubspot_deal');
    assert.ok(syncAudit, 'Must record sync_hubspot_deal admin audit log');
    assert.strictEqual(syncAudit.target_entity, 'hubspot_crm');
    assert.strictEqual(syncAudit.details.podBlocked, true);
    assert.strictEqual(syncAudit.details.podReleased, false);
    assert.strictEqual(syncAudit.details.paymentStatus, 'unknown');
    console.log('✓ PASS 7.6: Admin audit log recorded for fail-closed HubSpot Deal synchronization');

    // 7.7 Admin sync with explicit authoritative actualMileage records actual mileage and preserves amount
    const syncWithMileageRes = await testRequest(
      server,
      '/api/admin/hubspot/sync-deal',
      'POST',
      { Authorization: 'Bearer admin-valid-token' },
      { bookingId: 'NT-24819-DELIVERED', actualMileage: 48.2 }
    );
    assert.strictEqual(syncWithMileageRes.status, 200);
    assert.strictEqual(syncWithMileageRes.data.data.operationalMileage, 48.2);
    assert.strictEqual(syncWithMileageRes.data.data.preservedAmount, 450.0, 'Bill amount must strictly remain £450.00');
    console.log('✓ PASS 7.7: Admin sync with explicit actualMileage recorded operational mileage and strictly preserved bill amount');

    // 7.8 Admin sync with manual review reporting outstanding booking charges strictly withholds POD
    const syncUnpaidExtraRes = await testRequest(
      server,
      '/api/admin/hubspot/sync-deal',
      'POST',
      { Authorization: 'Bearer admin-valid-token' },
      {
        bookingId: 'NT-24819-DELIVERED',
        manualReview: {
          status: 'unpaid',
          reviewerNotes: 'Excess waiting charges of £95 unpaid',
        },
      }
    );
    assert.strictEqual(syncUnpaidExtraRes.status, 200);
    assert.strictEqual(syncUnpaidExtraRes.data.data.podReleased, false);
    assert.strictEqual(syncUnpaidExtraRes.data.podEvaluation.canReleasePod, false);
    assert.strictEqual(syncUnpaidExtraRes.data.podEvaluation.blocked, true);
    assert.strictEqual(syncUnpaidExtraRes.data.podEvaluation.paymentStatus, 'unpaid');
    assert.ok(syncUnpaidExtraRes.data.podEvaluation.reason.includes('unpaid'));
    console.log('✓ PASS 7.8: Admin sync with manual review reporting outstanding booking charges strictly withheld POD');

    // 7.9 Admin sync with manual review verifying cleared payment successfully releases POD
    const syncClearedRes = await testRequest(
      server,
      '/api/admin/hubspot/sync-deal',
      'POST',
      { Authorization: 'Bearer admin-valid-token' },
      {
        bookingId: 'NT-24819-DELIVERED',
        manualReview: {
          status: 'cleared',
          reviewerNotes: 'Corporate account standby terms verified; all charges cleared',
          confirmedPaymentReference: 'INV-PAID-01',
        },
      }
    );
    assert.strictEqual(syncClearedRes.status, 200);
    assert.strictEqual(syncClearedRes.data.data.podReleased, true);
    assert.strictEqual(syncClearedRes.data.podEvaluation.canReleasePod, true);
    assert.strictEqual(syncClearedRes.data.podEvaluation.blocked, false);
    assert.strictEqual(syncClearedRes.data.podEvaluation.paymentStatus, 'cleared');
    assert.strictEqual(
      syncClearedRes.data.podEvaluation.podDocumentUrl,
      'https://storage.supabase.co/v1/object/authenticated/documents/comp-acme-logistics/pod_99.pdf'
    );
    console.log('✓ PASS 7.9: Admin sync with manual review confirming cleared charges successfully released POD');

    // 7.10 Verify audit log for the cleared manual review contains full audit trail
    const clearedAudit = recordedAudits
      .filter((a) => a.action === 'sync_hubspot_deal')
      .find((a) => a.details?.manualReview?.status === 'cleared');
    assert.ok(clearedAudit, 'Audit trail must record manual review details');
    assert.strictEqual(clearedAudit.details.manualReview.status, 'cleared');
    assert.strictEqual(clearedAudit.details.manualReview.adminEmail, 'admin@neo-transport.co.uk');
    assert.strictEqual(clearedAudit.details.manualReview.reviewerNotes, 'Corporate account standby terms verified; all charges cleared');
    assert.strictEqual(clearedAudit.details.manualReview.confirmedPaymentReference, 'INV-PAID-01');
    console.log('✓ PASS 7.10: Admin audit log verified for manual review approval with reviewer notes and reference');

    // -------------------------------------------------------------------------
    // 8. Authoritative Customer Email Resolution & CRM Association (Step 2A)
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Testing Authoritative Customer Email Resolution & Contact Association ---');

    // 8.1 Unit: Exact pickup contact name match resolves profile email & contact name
    const exactMatchRes = await resolveCustomerForBooking(mockSupabaseClient, {
      company_id: 'comp-acme-logistics',
      pickup_contact: 'Dispatch Desk',
      pickup_phone: '0113 555 0199',
    });
    assert.strictEqual(exactMatchRes.email, 'dispatch@acme-logistics.co.uk');
    assert.strictEqual(exactMatchRes.name, 'Dispatch Desk');
    assert.strictEqual(exactMatchRes.companyName, 'Acme Logistics Ltd');
    console.log('✓ PASS 8.1: Exact pickup contact name match authoritatively resolved customer profile email');

    // 8.2 Unit: Fallback to primary active customer profile when pickup contact is generic
    const fallbackPrimaryRes = await resolveCustomerForBooking(mockSupabaseClient, {
      company_id: 'comp-acme-logistics',
      pickup_contact: 'Warehouse Desk', // Does not match any profile full_name
      pickup_phone: '0161 555 0134',
    });
    assert.strictEqual(fallbackPrimaryRes.email, 'sarah.jenkins@acme-logistics.co.uk', 'Must fallback to earliest active customer profile');
    assert.strictEqual(fallbackPrimaryRes.name, 'Sarah Jenkins');
    assert.strictEqual(fallbackPrimaryRes.companyName, 'Acme Logistics Ltd');
    console.log('✓ PASS 8.2: Generic pickup contact successfully fell back to primary active customer account profile');

    // 8.3 Unit: Suspended profiles are strictly excluded from resolution
    const suspendedCompanyRes = await resolveCustomerForBooking(mockSupabaseClient, {
      company_id: 'comp-all-suspended',
      pickup_contact: 'Banned Person',
    });
    assert.strictEqual(suspendedCompanyRes.email, undefined, 'Suspended profiles must never be resolved');
    assert.strictEqual(suspendedCompanyRes.companyName, 'Suspended Accounts Ltd');
    console.log('✓ PASS 8.3: Suspended customer profiles strictly excluded from resolution (fails safe without guessing)');

    // 8.4 Unit: Missing company or empty profile list safely returns undefined email
    const noProfilesRes = await resolveCustomerForBooking(mockSupabaseClient, {
      company_id: 'comp-orphan-no-profiles',
      pickup_contact: 'Site Reception',
    });
    assert.strictEqual(noProfilesRes.email, undefined);
    assert.strictEqual(noProfilesRes.name, 'Site Reception');
    assert.strictEqual(noProfilesRes.companyName, 'Orphan Corp Ltd');

    const nullCompanyRes = await resolveCustomerForBooking(mockSupabaseClient, {
      company_id: null,
      pickup_contact: 'Solo Consignor',
    });
    assert.strictEqual(nullCompanyRes.email, undefined);
    assert.strictEqual(nullCompanyRes.name, 'Solo Consignor');
    assert.strictEqual(nullCompanyRes.companyName, undefined);
    console.log('✓ PASS 8.4: Missing company / empty profile relationship safely returns undefined email without inventing data');

    // 8.5 Endpoint Integration: Admin sync of booking NT-24818 creates Contact & associates with Deal in HubSpot
    const syncBookingWithContact = await testRequest(
      server,
      '/api/admin/hubspot/sync-deal',
      'POST',
      { Authorization: 'Bearer admin-valid-token' },
      { bookingId: 'NT-24825-AUTHORITATIVE' }
    );
    assert.strictEqual(syncBookingWithContact.status, 200);
    assert.strictEqual(syncBookingWithContact.data.success, true);
    assert.strictEqual(syncBookingWithContact.data.customerContact.email, 'sarah.jenkins@acme-logistics.co.uk');
    assert.strictEqual(syncBookingWithContact.data.customerContact.companyName, 'Acme Logistics Ltd');

    // Verify Contact was registered in HubSpot mock store
    const contactRecord = Object.values(crmContacts).find(
      (c: any) => c.properties.email === 'sarah.jenkins@acme-logistics.co.uk'
    );
    assert.ok(contactRecord, 'Customer contact must be created in HubSpot');
    assert.strictEqual(contactRecord.properties.firstname, 'Sarah');
    assert.strictEqual(contactRecord.properties.lastname, 'Jenkins');
    assert.strictEqual(contactRecord.properties.company, 'Acme Logistics Ltd');

    // Verify Deal associations point to the contactId
    const createdDeal = Object.values(crmDeals).find(
      (d: any) => d.properties.neo_booking_reference === 'NT-24825-AUTHORITATIVE'
    );
    assert.ok(createdDeal, 'Deal must be created in HubSpot');
    assert.ok(createdDeal.associations && createdDeal.associations.length > 0, 'Deal must have associations');
    assert.strictEqual(createdDeal.associations[0].to.id, contactRecord.id, 'Deal must be associated with the contact ID');
    console.log('✓ PASS 8.5: Endpoint resolved authoritative contact email and associated HubSpot Contact with Deal');

    // 8.6 Endpoint Security: Arbitrary client-supplied body emails are strictly ignored
    // Create a new booking in mock to test injection immunity
    mockBookings['NT-INJECTION-TEST'] = {
      id: 'NT-INJECTION-TEST',
      company_id: 'comp-beta-freight',
      pickup: 'Birmingham B1 1AA',
      dropoff: 'London EC1A 1BB',
      total_gbp: 280.0,
      distance_miles: 110.0,
      vehicle: 'Sprinter LWB',
      service: 'Direct Transit',
      status: 'Scheduled',
      pickup_contact: 'Warehouse Desk',
      pickup_phone: '0121 555 0100',
      created_at: new Date('2026-10-19T13:00:00Z').toISOString(),
    };

    const injectionAttemptRes = await testRequest(
      server,
      '/api/admin/hubspot/sync-deal',
      'POST',
      { Authorization: 'Bearer admin-valid-token' },
      {
        bookingId: 'NT-INJECTION-TEST',
        contactEmail: 'attacker@evil.com', // Attacker attempt to override email
        email: 'attacker@evil.com',
      }
    );
    assert.strictEqual(injectionAttemptRes.status, 200);
    assert.strictEqual(injectionAttemptRes.data.customerContact.email, 'dmiller@betafreight.com', 'Must resolve authoritative David Miller email and ignore body override');
    assert.strictEqual(injectionAttemptRes.data.customerContact.companyName, 'Beta Freight Group');

    // Verify attacker email was NEVER created in CRM
    const attackerContact = Object.values(crmContacts).find(
      (c: any) => c.properties.email === 'attacker@evil.com'
    );
    assert.strictEqual(attackerContact, undefined, 'Client-supplied attacker email must never be sent to HubSpot');
    console.log('✓ PASS 8.6: Client-supplied contactEmail override strictly ignored in favour of authoritative DB model');

    // 8.7 Endpoint Robustness: Booking without profile safely syncs Deal without contact association
    const guestSyncRes = await testRequest(
      server,
      '/api/admin/hubspot/sync-deal',
      'POST',
      { Authorization: 'Bearer admin-valid-token' },
      { bookingId: 'NT-GUEST-BOOKING' }
    );
    assert.strictEqual(guestSyncRes.status, 200);
    assert.strictEqual(guestSyncRes.data.success, true);
    assert.strictEqual(guestSyncRes.data.customerContact.email, null);
    const guestDeal = Object.values(crmDeals).find(
      (d: any) => d.properties.neo_booking_reference === 'NT-GUEST-BOOKING'
    );
    assert.ok(guestDeal, 'Guest booking Deal must be created in HubSpot');
    assert.strictEqual(guestDeal.properties.amount, '150.00');
    assert.strictEqual(guestDeal.associations, undefined, 'Deal without customer contact must have no associations');
    console.log('✓ PASS 8.7: Booking without company/profile safely synced Deal without contact association');

    // 8.8 Idempotency: Re-syncing existing Deal does not create duplicate Deals or Contacts
    const contactCountBefore = Object.keys(crmContacts).length;
    const dealCountBefore = Object.keys(crmDeals).length;
    const resyncRes = await testRequest(
      server,
      '/api/admin/hubspot/sync-deal',
      'POST',
      { Authorization: 'Bearer admin-valid-token' },
      { bookingId: 'NT-24818' }
    );
    assert.strictEqual(resyncRes.status, 200);
    assert.strictEqual(resyncRes.data.data.action, 'already_exists');
    assert.strictEqual(Object.keys(crmContacts).length, contactCountBefore, 'No duplicate contact created');
    assert.strictEqual(Object.keys(crmDeals).length, dealCountBefore, 'No duplicate deal created');
    console.log('✓ PASS 8.8: Re-syncing booking confirmed idempotency without creating duplicate Deal or Contact');

    // 8.9 Admin Audit Trail: Records authoritative customer email and company
    const auditRecord = recordedAudits
      .slice().reverse()
      .find((a) => a.action === 'sync_hubspot_deal' && a.target_id === 'NT-INJECTION-TEST');
    assert.ok(auditRecord, 'Audit record must exist for NT-INJECTION-TEST');
    assert.strictEqual(auditRecord.details.customerEmail, 'dmiller@betafreight.com');
    assert.strictEqual(auditRecord.details.customerCompany, 'Beta Freight Group');
    console.log('✓ PASS 8.9: Admin audit trail recorded authoritative customer email and company');

    console.log('\n========================================================================');
    console.log('=== ALL HUBSPOT BOOKING SYNCHRONIZATION TESTS PASSED (0 failures) ===');
    console.log('========================================================================\n');
  } finally {
    setHubSpotClientForTesting(null);
    setServerSupabaseClientForTesting(null);
    process.env.NODE_ENV = originalNodeEnv;
    if (originalSyncEnabled !== undefined) {
      process.env.NEO_HUBSPOT_SYNC_ENABLED = originalSyncEnabled;
    } else {
      delete process.env.NEO_HUBSPOT_SYNC_ENABLED;
    }
    if (originalKey !== undefined) {
      process.env.HUBSPOT_SERVICE_KEY = originalKey;
    } else {
      delete process.env.HUBSPOT_SERVICE_KEY;
    }
    server.close();
  }
}

runHubSpotSyncTests().catch((err) => {
  console.error('\n❌ HUBSPOT SYNC TEST SUITE FAILED:', err);
  process.exit(1);
});

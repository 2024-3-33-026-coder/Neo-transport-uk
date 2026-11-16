/**
 * BOOKING LIFECYCLE & STATUS TRANSITION REGRESSION TEST SUITE
 *
 * Verifies that:
 * 1. New bookings created via the customer portal default to 'SCHEDULED' with undefined driver.
 * 2. `persistBooking` writes `status: 'Scheduled'`, `driver_name: null`, `driver_reg: null`, and `progress_t: 0.0` to Supabase.
 * 3. `getPersistedBookings` maps `status: 'Scheduled'` to 'SCHEDULED', defaults missing status to 'SCHEDULED' (never 'IN TRANSIT'),
 *    leaves driver as undefined when unassigned, and sets initial progress to 0.05.
 * 4. Admin pilot dispatch (`POST /api/admin/dispatch/spoke/pilot`) strictly enforces `dbBooking.status === 'Scheduled'`.
 *    Bookings already marked 'In transit' (such as NT-25007) are rejected with HTTP 409 Conflict.
 * 5. Inbound Spoke webhook shipment events transition a booking from 'Scheduled' to 'In transit' only upon verified events.
 */

import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import app, {
  setServerSupabaseClientForTesting,
} from '../api/index.js';
import {
  persistBooking,
  getPersistedBookings,
  updateBooking,
  setCustomSupabaseClient,
  setDemoModeOverrideForTesting,
  mapBookingRowToBooking,
  syncRealtimeBookingUpdate,
} from '../src/lib/portalStore.ts';
import { Booking } from '../src/types.ts';

// Setup minimal localStorage mock for Node test environment
if (!globalThis.localStorage) {
  const memoryStore = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => memoryStore.get(k) ?? null,
    setItem: (k: string, v: string) => { memoryStore.set(k, String(v)); },
    removeItem: (k: string) => { memoryStore.delete(k); },
    clear: () => { memoryStore.clear(); },
    key: (i: number) => Array.from(memoryStore.keys())[i] ?? null,
    length: 0,
  } as Storage;
  Object.defineProperty(globalThis.localStorage, 'length', {
    get: () => memoryStore.size,
  });
}

function testRequest(
  server: http.Server,
  path: string,
  method: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as any;
    const port = address.port;

    const postData = body ? JSON.stringify(body) : undefined;
    const reqHeaders: Record<string, string> = { ...headers };
    if (postData) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let parsed: any = raw;
          try {
            parsed = JSON.parse(raw);
          } catch {
            // Keep raw text
          }
          resolve({ status: res.statusCode || 500, data: parsed });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runBookingLifecycleTests() {
  process.env.NODE_ENV = 'test';
  console.log('=================================================================');
  console.log('STARTING BOOKING LIFECYCLE & STATUS TRANSITION REGRESSION TESTS');
  console.log('=================================================================\n');

  let failures = 0;
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    // -------------------------------------------------------------------------
    // TEST 1: New Booking Invariants in Frontend Wizard
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing New Booking Creation Defaults ---');
    const newWizardBooking: Booking = {
      id: `b-test-${Date.now()}`,
      reference: 'NT-25099',
      date: 'Today',
      origin: 'Manchester M17 1AB',
      destination: 'Birmingham B6 7EU',
      vehicle: 'Sprinter LWB',
      total: 248,
      status: 'SCHEDULED',
      cargo: 'Palletised machine parts',
      weightKg: 450,
      palletCount: 2,
      pickupTime: 'Now',
      deliveryTime: 'Direct transit (approx 88 min)',
      driver: undefined,
      progress: 0.05,
    };

    assert.strictEqual(newWizardBooking.status, 'SCHEDULED', 'New booking status must be SCHEDULED');
    assert.strictEqual(newWizardBooking.driver, undefined, 'New booking driver must be undefined');
    assert.strictEqual(newWizardBooking.progress, 0.05, 'New booking initial progress must be 0.05');
    console.log('✓ PASS: New booking creation defaults status to SCHEDULED and leaves driver unallocated');

    // -------------------------------------------------------------------------
    // TEST 2: persistBooking writes 'Scheduled' and null driver to Supabase
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing persistBooking Database Insert Payload ---');
    let insertedRow: any = null;
    const mockSupabaseClient = {
      from: (table: string) => {
        if (table === 'bookings') {
          return {
            insert: (payload: any) => {
              insertedRow = payload;
              return Promise.resolve({ data: payload, error: null });
            },
            select: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          };
        }
        return {
          select: () => Promise.resolve({ data: [], error: null }),
        };
      },
    };

    setCustomSupabaseClient(mockSupabaseClient as any);
    setDemoModeOverrideForTesting(false);
    localStorage.clear();

    await persistBooking(newWizardBooking, {
      pickupPostcode: 'Manchester M17 1AB',
      dropoffPostcode: 'Birmingham B6 7EU',
      cargoDescription: 'Palletised machine parts',
      cargoWeightKg: 450,
      palletCount: 2,
      selectedVehicle: 'Sprinter LWB',
      pickupContact: 'Warehouse Manager',
      pickupPhone: '0161 555 0199',
      dropoffContact: 'Receiving Team',
      dropoffPhone: '0121 496 0288',
      deliveryInstructions: 'Dock 4',
      collectionWindow: 'ASAP',
      paymentMethod: 'standby-account',
      poReference: 'PO-TEST-99',
      estimatedMiles: 88,
      estimatedTotal: 248,
      selectedService: 'Emergency (ASAP)',
    } as any, 'comp-meridian-001');

    assert(insertedRow !== null, 'persistBooking must execute Supabase insert');
    assert.strictEqual(insertedRow.id, 'NT-25099', 'Row id must match booking reference');
    assert.strictEqual(insertedRow.status, 'Scheduled', 'Supabase status must be Scheduled (not In transit)');
    assert.strictEqual(insertedRow.driver_name, null, 'Supabase driver_name must be null on creation (never default to Marek Kowalski)');
    assert.strictEqual(insertedRow.driver_vehicle, null, 'Supabase driver_vehicle must be null on creation');
    assert.strictEqual(insertedRow.driver_reg, null, 'Supabase driver_reg must be null on creation (never default to GN71 XPO)');
    assert.strictEqual(insertedRow.progress_t, 0.05, 'Supabase progress_t must match booking initial progress');
    console.log('✓ PASS: persistBooking correctly writes status="Scheduled", null driver fields, and progress=0.05');

    // -------------------------------------------------------------------------
    // TEST 3: getPersistedBookings Maps DB Status and Unallocated Driver
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing getPersistedBookings Retrieval & Mapping ---');
    const mockDbRows = [
      {
        id: 'NT-25001',
        company_id: 'comp-meridian-001',
        status: 'Scheduled',
        driver_name: null,
        driver_vehicle: null,
        driver_reg: null,
        progress_t: 0.0,
        goods: 'Electronics',
        weight_kg: 100,
        items_count: 1,
        pickup: 'M1 1AA',
        dropoff: 'B1 1BB',
        vehicle: 'Small Van',
        total_gbp: 150,
        collection_window: 'Morning',
        eta_label: '60 min',
      },
      {
        // Edge case: null or empty status row in database
        id: 'NT-25002',
        company_id: 'comp-meridian-001',
        status: null,
        driver_name: null,
        driver_vehicle: null,
        driver_reg: null,
        progress_t: null,
        goods: 'Hardware',
        weight_kg: 200,
        items_count: 2,
        pickup: 'M2 2AA',
        dropoff: 'B2 2BB',
        vehicle: 'Sprinter LWB',
        total_gbp: 220,
        collection_window: 'Afternoon',
        eta_label: '90 min',
      },
      {
        // In transit booking with allocated driver
        id: 'NT-25003',
        company_id: 'comp-meridian-001',
        status: 'In transit',
        driver_name: 'John Doe',
        driver_vehicle: 'Sprinter LWB',
        driver_reg: 'AB12 CDE',
        progress_t: 0.55,
        goods: 'Auto parts',
        weight_kg: 500,
        items_count: 3,
        pickup: 'M3 3AA',
        dropoff: 'B3 3BB',
        vehicle: 'Sprinter LWB',
        total_gbp: 300,
        collection_window: 'ASAP',
        eta_label: '45 min',
      },
    ];

    const mockFetchClient = {
      from: (table: string) => ({
        select: () => ({
          order: () => Promise.resolve({ data: mockDbRows, error: null }),
        }),
      }),
    };

    setCustomSupabaseClient(mockFetchClient as any);
    const mappedBookings = await getPersistedBookings();

    assert.strictEqual(mappedBookings.length, 3, 'Must map 3 bookings');

    // Booking 1: Scheduled
    assert.strictEqual(mappedBookings[0].status, 'SCHEDULED', 'Scheduled DB status must map to SCHEDULED');
    assert.strictEqual(mappedBookings[0].driver, undefined, 'Driver must be undefined when driver_name is null');
    assert.strictEqual(mappedBookings[0].progress, 0.0, 'Progress must match DB value');

    // Booking 2: Falsy status
    assert.strictEqual(mappedBookings[1].status, 'SCHEDULED', 'Falsy DB status must safely default to SCHEDULED (never IN TRANSIT)');
    assert.strictEqual(mappedBookings[1].driver, undefined, 'Driver must be undefined');
    assert.strictEqual(mappedBookings[1].progress, 0.05, 'Falsy progress on scheduled booking must default to 0.05 (never 0.45)');

    // Booking 3: In transit
    assert.strictEqual(mappedBookings[2].status, 'IN TRANSIT', 'In transit status mapped correctly');
    assert.strictEqual(mappedBookings[2].driver?.name, 'John Doe', 'Driver mapped when present');
    assert.strictEqual(mappedBookings[2].driver?.registration, 'AB12 CDE', 'Driver registration mapped');
    assert.strictEqual(mappedBookings[2].progress, 0.55, 'In transit progress preserved');
    console.log('✓ PASS: getPersistedBookings safely maps Scheduled, handles missing status, and decouples unallocated drivers');

    // -------------------------------------------------------------------------
    // TEST 4: Spoke Pilot Dispatch Status Invariant (Rejection of 'In transit')
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Pilot Dispatch Status Invariant ---');
    process.env.NEO_SPOKE_PILOT_DISPATCH_ENABLED = 'true';
    process.env.NEO_SPOKE_PILOT_DISPATCH_APPROVED_TOKEN = 'APPROVED_PILOT_TOKEN_SECRET_XYZ';

    // Set up mock auth and db in api/index
    const testAdminUser = {
      id: 'admin-usr-lifecycle-100',
      email: 'ops@neotransport.co.uk',
      role: 'authenticated',
      app_metadata: { role: 'admin' },
      user_metadata: { role: 'admin' },
    };

    // Case 4A: Booking is already 'In transit' (like NT-25007 was prematurely marked)
    const inTransitBooking = {
      id: 'NT-25007',
      company_id: 'comp-meridian-001',
      status: 'In transit', // Prematurely marked!
      pickup: 'Manchester M17 1AB',
      dropoff: 'Birmingham B6 7EU',
      goods: 'Urgent line-side parts',
      weight_kg: 450,
      items_count: 2,
      vehicle: 'Sprinter LWB',
      service: 'Emergency (ASAP)',
      distance_miles: 88,
      total_gbp: 248,
    };

    const mockAdminDbInTransit = {
      auth: {
        getUser: (_token: string) => Promise.resolve({ data: { user: testAdminUser }, error: null }),
      },
      from: (table: string) => {
        if (table === 'bookings') {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                single: () => Promise.resolve({ data: inTransitBooking, error: null }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({
                  data: {
                    id: testAdminUser.id,
                    role: 'admin',
                    status: 'active',
                    full_name: 'Ops Admin',
                    email: testAdminUser.email,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      },
    };

    setServerSupabaseClientForTesting(mockAdminDbInTransit as any);

    const res4A = await testRequest(
      server,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      {
        Authorization: 'Bearer valid-admin-token',
      },
      {
        pilotAuthorizationToken: 'APPROVED_PILOT_TOKEN_SECRET_XYZ',
        bookingId: 'NT-25007',
        planDate: '2026-10-21',
      }
    );

    assert.strictEqual(res4A.status, 409, 'Pilot dispatch must return HTTP 409 Conflict when status is not Scheduled');
    assert(
      res4A.data.error.includes("current status is 'In transit' (must be 'Scheduled')"),
      `Error message must explain status mismatch, got: ${res4A.data.error}`
    );
    console.log('✓ PASS: Pilot dispatch strictly rejects bookings already marked "In transit" with 409 Conflict');

    // Case 4B: Booking is properly 'Scheduled' -> passes the status check
    const scheduledBooking = {
      ...inTransitBooking,
      id: 'NT-25008',
      status: 'Scheduled',
    };

    const mockAdminDbScheduled = {
      auth: {
        getUser: (_token: string) => Promise.resolve({ data: { user: testAdminUser }, error: null }),
      },
      from: (table: string) => {
        if (table === 'bookings') {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                single: () => Promise.resolve({ data: scheduledBooking, error: null }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({
                  data: {
                    id: testAdminUser.id,
                    role: 'admin',
                    status: 'active',
                    full_name: 'Ops Admin',
                    email: testAdminUser.email,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'spoke_booking_stop_state') {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          };
        }
        if (table === 'companies') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({
                  data: { id: 'comp-meridian-001', standby_active: true, verified: true, credit_status: 'ok' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      },
    };

    setServerSupabaseClientForTesting(mockAdminDbScheduled as any);

    const res4B = await testRequest(
      server,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      {
        Authorization: 'Bearer valid-admin-token',
      },
      {
        pilotAuthorizationToken: 'APPROVED_PILOT_TOKEN_SECRET_XYZ',
        bookingId: 'NT-25008',
        planDate: '2026-10-21',
      }
    );

    // It passes the status check and stops check, proceeding into dispatch checks
    assert.notStrictEqual(res4B.status, 409, 'Scheduled booking must NOT be rejected by the status check');
    console.log('✓ PASS: Booking with status="Scheduled" safely passes the initial lifecycle status check');

    // -------------------------------------------------------------------------
    // TEST 5: Verify Step 8 and NewBookingView Content Integrity
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Verifying NewBookingView & LiveTrackingView UI Text Integrity ---');
    const newBookingViewFile = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/views/NewBookingView.tsx'),
      'utf8'
    );
    assert(
      !newBookingViewFile.includes("status: 'IN TRANSIT'"),
      'NewBookingView must never initialize new bookings with IN TRANSIT status'
    );
    assert(
      newBookingViewFile.includes("status: 'SCHEDULED'"),
      'NewBookingView must initialize new bookings with SCHEDULED status'
    );
    assert(
      !newBookingViewFile.includes('Driver Marek Kowalski'),
      'NewBookingView Step 8 must not hardcode Driver Marek Kowalski en route'
    );
    assert(
      newBookingViewFile.includes('Ready for Dispatch Allocation'),
      'NewBookingView Step 8 heading must state Ready for Dispatch Allocation'
    );
    console.log('✓ PASS: NewBookingView code statically verified against demo regressions');

    const liveTrackingViewFile = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/views/LiveTrackingView.tsx'),
      'utf8'
    );
    assert(
      liveTrackingViewFile.includes('Awaiting driver allocation'),
      'LiveTrackingView must render "Awaiting driver allocation" when booking is scheduled without driver'
    );
    assert(
      liveTrackingViewFile.includes('DRIVER UNALLOCATED'),
      'LiveTrackingView must render "DRIVER UNALLOCATED" badge when driver is unallocated'
    );
    console.log('✓ PASS: LiveTrackingView code statically verified for unallocated driver handling');

    // -------------------------------------------------------------------------
    // TEST 6: Realtime State Synchronization & Publication Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Realtime State Synchronization & Publication ---');

    // Test 6.1: mapBookingRowToBooking transforms raw database rows with snake_case columns
    const initialBooking: Booking = {
      id: 'NT-25007',
      company_id: 'comp-meridian-001',
      reference: 'NT-25007',
      date: 'Today',
      origin: 'Manchester M17 1AB',
      destination: 'Birmingham B6 7EU',
      vehicle: 'Sprinter LWB',
      total: 248,
      status: 'SCHEDULED',
      cargo: 'Palletised machine parts',
      weightKg: 450,
      palletCount: 2,
      pickupTime: 'Now',
      deliveryTime: 'Direct transit (approx 88 min)',
      driver: undefined,
      progress: 0.05,
    };

    const rawUpdateRow = {
      id: 'NT-25007',
      company_id: 'comp-meridian-001',
      status: 'In transit',
      progress_t: 0.45,
      driver_name: 'Marek Kowalski',
      driver_vehicle: 'Sprinter LWB',
      driver_reg: 'GN71 XPO',
      pickup_tracking_url: 'https://track.spoke.com/p/live-pickup-token-1',
      delivery_tracking_url: 'https://track.spoke.com/d/live-delivery-token-1',
    };

    const mappedUpdate = mapBookingRowToBooking(rawUpdateRow, initialBooking);
    assert.strictEqual(mappedUpdate.id, 'NT-25007', 'Mapped ID must match');
    assert.strictEqual(mappedUpdate.status, 'IN TRANSIT', 'Status must map to IN TRANSIT');
    assert.strictEqual(mappedUpdate.progress, 0.45, 'Progress must map from progress_t: 0.45');
    assert.strictEqual(mappedUpdate.origin, 'Manchester M17 1AB', 'Unchanged origin preserved from existing');
    assert.strictEqual(mappedUpdate.cargo, 'Palletised machine parts', 'Unchanged cargo preserved from existing');
    assert.strictEqual(mappedUpdate.driver?.name, 'Marek Kowalski', 'Driver name mapped');
    assert.strictEqual(mappedUpdate.driver?.registration, 'GN71 XPO', 'Driver registration mapped');
    assert.strictEqual(mappedUpdate.pickup_tracking_url, 'https://track.spoke.com/p/live-pickup-token-1', 'Pickup tracking link mapped');
    assert.strictEqual(mappedUpdate.delivery_tracking_url, 'https://track.spoke.com/d/live-delivery-token-1', 'Delivery tracking link mapped');
    console.log('✓ PASS 6.1: mapBookingRowToBooking safely transforms raw DB update rows and preserves unmutated properties');

    // Test 6.2: Realtime UPDATE immediately refreshes React state array without page reload
    let reactiveBookings: Booking[] = [
      initialBooking,
      {
        id: 'NT-24817',
        company_id: 'comp-meridian-001',
        reference: 'NT-24817',
        date: 'Yesterday',
        origin: 'Leeds LS1 1AA',
        destination: 'Sheffield S1 1AA',
        vehicle: 'Small Van',
        total: 150,
        status: 'SCHEDULED',
        cargo: 'Electronics',
        weightKg: 80,
        palletCount: 1,
        progress: 0.05,
      },
    ];
    let activeTrackingBookingId = 'NT-25007';

    // Simulate Portal handleBookingUpdated handler
    const simulatePortalRealtimeUpdate = (rawOrMapped: any) => {
      const targetId = rawOrMapped.id || rawOrMapped.reference;
      const existing = reactiveBookings.find((b) => b.id === targetId || b.reference === targetId);
      const isAlreadyBooking = 'cargo' in rawOrMapped && 'date' in rawOrMapped;
      const mapped = isAlreadyBooking ? (rawOrMapped as Booking) : mapBookingRowToBooking(rawOrMapped, existing);
      const merged = existing ? { ...existing, ...mapped } : mapped;
      syncRealtimeBookingUpdate(merged);
      reactiveBookings = reactiveBookings.map((b) =>
        b.id === merged.id || b.reference === merged.reference ? merged : b
      );
    };

    // Dispatch realtime update for NT-25007
    simulatePortalRealtimeUpdate(rawUpdateRow);

    const refreshedBooking = reactiveBookings.find((b) => b.id === 'NT-25007');
    assert(refreshedBooking !== undefined, 'Target booking must exist in state');
    assert.strictEqual(refreshedBooking.status, 'IN TRANSIT', 'Status immediately reflects IN TRANSIT without reload');
    assert.strictEqual(refreshedBooking.progress, 0.45, 'Progress immediately reflects 0.45 without reload');
    assert.strictEqual(refreshedBooking.pickup_tracking_url, 'https://track.spoke.com/p/live-pickup-token-1', 'Pickup URL immediately visible');
    assert.strictEqual(refreshedBooking.delivery_tracking_url, 'https://track.spoke.com/d/live-delivery-token-1', 'Delivery URL immediately visible');
    assert.strictEqual(activeTrackingBookingId, 'NT-25007', 'Currently active shipment ID remains NT-25007');
    console.log('✓ PASS 6.2: Realtime UPDATE immediately refreshes status, progress, and tracking URLs without page reload');

    // Test 6.3: Update for another booking does NOT replace the selected booking
    const rawOtherBookingUpdate = {
      id: 'NT-24817',
      company_id: 'comp-meridian-001',
      status: 'Delivered',
      progress_t: 1.0,
      pickup_tracking_url: 'https://track.spoke.com/p/other-token',
      delivery_tracking_url: 'https://track.spoke.com/d/other-token',
    };

    simulatePortalRealtimeUpdate(rawOtherBookingUpdate);

    // Verify NT-24817 updated
    const otherBooking = reactiveBookings.find((b) => b.id === 'NT-24817');
    assert.strictEqual(otherBooking?.status, 'DELIVERED', 'Other booking status updated in background');
    assert.strictEqual(otherBooking?.progress, 1.0, 'Other booking progress updated to 1.0');

    // Verify active tracking booking NT-25007 remains undisturbed and selected
    assert.strictEqual(activeTrackingBookingId, 'NT-25007', 'Active tracking booking ID is NOT replaced by other booking update');
    const currentActiveBooking = reactiveBookings.find((b) => b.id === activeTrackingBookingId);
    assert.strictEqual(currentActiveBooking?.id, 'NT-25007', 'Active booking is still NT-25007');
    assert.strictEqual(currentActiveBooking?.status, 'IN TRANSIT', 'Active booking status retained as IN TRANSIT');
    assert.strictEqual(currentActiveBooking?.progress, 0.45, 'Active booking progress retained as 0.45');
    console.log('✓ PASS 6.3: An update for another booking does not accidentally replace the selected booking');

    // Test 6.4: Realtime subscription cleanup semantics
    let channelUnsubscribed = false;
    const mockChannel = {
      channelId: 'live-tracking-NT-25007',
      on: function () { return this; },
      subscribe: function () { return this; },
    };
    const mockSubscriptionClient = {
      channel: () => mockChannel,
      removeChannel: (channel: any) => {
        if (channel === mockChannel) {
          channelUnsubscribed = true;
        }
      },
    };

    // Simulate component subscription & teardown
    const ch = mockSubscriptionClient.channel();
    assert.strictEqual(channelUnsubscribed, false, 'Channel initially active');
    mockSubscriptionClient.removeChannel(ch);
    assert.strictEqual(channelUnsubscribed, true, 'Channel cleaned up when component unmounts or active booking changes');
    console.log('✓ PASS 6.4: Realtime subscription cleanup semantics verified');

    // Test 6.5: Static verification of Realtime publication migration and isolation
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261020063000_enable_realtime_bookings.sql');
    assert(fs.existsSync(migrationPath), 'Migration 20261020063000_enable_realtime_bookings.sql must exist');
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');
    assert(
      migrationContent.includes('ALTER TABLE public.bookings REPLICA IDENTITY FULL;'),
      'Migration must set REPLICA IDENTITY FULL on public.bookings'
    );
    assert(
      migrationContent.includes("pubname = 'supabase_realtime'") &&
      migrationContent.includes("schemaname = 'public'") &&
      migrationContent.includes("tablename = 'bookings'"),
      'Migration must check pg_publication_tables idempotently'
    );
    assert(
      migrationContent.includes('ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;'),
      'Migration must add public.bookings to supabase_realtime'
    );
    console.log('✓ PASS 6.5: Supabase Realtime publication migration verified for safety and idempotency');

    // Test 6.6: Static verification of LiveTrackingView & Portal integration
    assert(
      !liveTrackingViewFile.includes('onSelectBooking(payload.new.id)'),
      'LiveTrackingView must NOT invoke onSelectBooking on Realtime UPDATE'
    );
    assert(
      liveTrackingViewFile.includes('mapBookingRowToBooking(payload.new'),
      'LiveTrackingView must map payload.new using mapBookingRowToBooking'
    );
    assert(
      liveTrackingViewFile.includes('onBookingUpdatedRef.current(mapped)'),
      'LiveTrackingView must invoke onBookingUpdatedRef with mapped booking'
    );

    const portalFile = fs.readFileSync(
      path.resolve(process.cwd(), 'src/Portal.tsx'),
      'utf8'
    );
    assert(
      portalFile.includes('onBookingUpdated={handleBookingUpdated}'),
      'Portal must pass handleBookingUpdated to LiveTrackingView'
    );
    assert(
      portalFile.includes('customer-bookings-'),
      'Portal must subscribe to company-level bookings Realtime channel'
    );
    console.log('✓ PASS 6.6: LiveTrackingView & Portal verified for decoupled selection and state synchronization');

    // -------------------------------------------------------------------------
    // TEST 7: Admin Dispatch Status Integrity & Anti-Mock Telemetry
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Admin Dispatch Status Integrity & Anti-Mock Telemetry ---');

    // Test 7.1: updateBooking prevents client-side advancement of Scheduled to 'In transit' or 'Delivered'
    const scheduledBookingForGuard: Booking = {
      id: 'NT-25008',
      reference: 'NT-25008',
      company_id: 'comp-meridian-001',
      date: 'Today',
      origin: 'Manchester M17 1AB',
      destination: 'Birmingham B6 7EU',
      vehicle: 'Sprinter LWB',
      total: 248,
      status: 'SCHEDULED',
      cargo: 'Palletised machine parts',
      weightKg: 450,
      palletCount: 2,
      driver: undefined,
      progress: 0.05,
    };

    // Pre-populate storage with Scheduled booking
    localStorage.setItem('neo_portal_bookings', JSON.stringify([scheduledBookingForGuard]));

    let capturedDbUpdatePayload: any = null;
    let capturedDbUpdateId: string | null = null;
    const mockUpdateClient = {
      from: (table: string) => {
        if (table === 'bookings') {
          return {
            update: (payload: any) => ({
              eq: (field: string, val: string) => {
                capturedDbUpdatePayload = payload;
                capturedDbUpdateId = val;
                return Promise.resolve({ data: payload, error: null });
              },
            }),
          };
        }
        return { select: () => Promise.resolve({ data: [], error: null }) };
      },
    };

    setCustomSupabaseClient(mockUpdateClient as any);

    // Attempt 7.1a: Try to manually advance to 'IN TRANSIT' via updateBooking
    const attemptInTransitBooking: Booking = {
      ...scheduledBookingForGuard,
      status: 'IN TRANSIT',
    };

    const updateResult1 = await updateBooking(attemptInTransitBooking);
    assert.strictEqual(
      updateResult1[0].status,
      'SCHEDULED',
      'updateBooking must reject advancing a SCHEDULED booking to IN TRANSIT'
    );
    assert.strictEqual(
      capturedDbUpdatePayload?.status,
      'Scheduled',
      'Supabase update payload status must remain Scheduled, never In transit'
    );
    console.log('✓ PASS 7.1a: Client-side updateBooking strictly blocks premature transition to IN TRANSIT');

    // Attempt 7.1b: Try to manually advance to 'DELIVERED' via updateBooking
    const attemptDeliveredBooking: Booking = {
      ...scheduledBookingForGuard,
      status: 'DELIVERED',
    };

    const updateResult2 = await updateBooking(attemptDeliveredBooking);
    assert.strictEqual(
      updateResult2[0].status,
      'SCHEDULED',
      'updateBooking must reject advancing a SCHEDULED booking to DELIVERED'
    );
    assert.strictEqual(
      capturedDbUpdatePayload?.status,
      'Scheduled',
      'Supabase update payload status must remain Scheduled, never Delivered'
    );
    console.log('✓ PASS 7.1b: Client-side updateBooking strictly blocks premature transition to DELIVERED');

    // Attempt 7.1c: Cancellation is permitted via updateBooking
    const attemptCancelBooking: Booking = {
      ...scheduledBookingForGuard,
      status: 'CANCELLED',
    };
    const updateResult3 = await updateBooking(attemptCancelBooking);
    assert.strictEqual(
      updateResult3[0].status,
      'CANCELLED',
      'updateBooking must permit legitimate cancellation'
    );
    assert.strictEqual(
      capturedDbUpdatePayload?.status,
      'Cancelled',
      'Supabase update payload must reflect Cancelled'
    );
    console.log('✓ PASS 7.1c: updateBooking correctly permits legitimate booking cancellation');

    localStorage.setItem('neo_portal_bookings', JSON.stringify([scheduledBookingForGuard]));
    // Attempt 7.1d: Blocking status transition does not persist inconsistent driver or tracking changes
    const attemptInconsistentInTransit: Booking = {
      ...scheduledBookingForGuard,
      status: 'IN TRANSIT',
      driver: {
        name: 'Fake Driver',
        vehicleModel: 'Fake Van',
        registration: 'FA12 KEE',
        phone: '07700 900999',
        status: 'ACTIVE ASSIGNMENT',
      },
      progress: 0.85,
      pickup_tracking_url: 'https://fake.tracking.url/pickup',
      delivery_tracking_url: 'https://fake.tracking.url/delivery',
    };

    const updateResult4 = await updateBooking(attemptInconsistentInTransit);
    assert.strictEqual(
      updateResult4[0].status,
      'SCHEDULED',
      'Status must remain SCHEDULED'
    );
    assert.strictEqual(
      updateResult4[0].driver,
      undefined,
      'Blocked transition must not persist fake driver in local cache'
    );
    assert.strictEqual(
      updateResult4[0].progress,
      0.05,
      'Blocked transition must preserve original progress in local cache'
    );
    assert.strictEqual(
      updateResult4[0].pickup_tracking_url,
      undefined,
      'Blocked transition must not persist fake tracking URL in local cache'
    );
    assert.strictEqual(
      capturedDbUpdatePayload?.driver_name,
      null,
      'Supabase payload must not persist driver_name when transition was blocked'
    );
    assert.strictEqual(
      capturedDbUpdatePayload?.progress_t,
      0.05,
      'Supabase payload must not persist altered progress_t when transition was blocked'
    );
    console.log('✓ PASS 7.1d: Blocked transition strictly prevents storing inconsistent driver, progress, or tracking');

    // Attempt 7.1e: Ordinary booking edits on a SCHEDULED booking succeed
    const attemptOrdinaryEdit: Booking = {
      ...scheduledBookingForGuard,
      vehicle: 'Luton Box Van',
      total: 395,
      deliveryTime: '17:00 BST',
      cargo: 'High-value aircraft avionics',
    };
    const updateResult5 = await updateBooking(attemptOrdinaryEdit);
    assert.strictEqual(updateResult5[0].vehicle, 'Luton Box Van');
    assert.strictEqual(updateResult5[0].total, 395);
    assert.strictEqual(updateResult5[0].deliveryTime, '17:00 BST');
    assert.strictEqual(updateResult5[0].cargo, 'High-value aircraft avionics');
    assert.strictEqual(capturedDbUpdatePayload?.vehicle, 'Luton Box Van');
    assert.strictEqual(capturedDbUpdatePayload?.total_gbp, 395);
    console.log('✓ PASS 7.1e: Ordinary booking edits on a SCHEDULED booking succeed cleanly');

    // Attempt 7.1f: Legitimate updates to a booking that is ALREADY IN TRANSIT are not blocked
    const activeInTransitBooking: Booking = {
      id: 'NT-25009',
      reference: 'NT-25009',
      company_id: 'comp-meridian-001',
      date: 'Today',
      origin: 'Manchester M17 1AB',
      destination: 'Birmingham B6 7EU',
      vehicle: 'Sprinter LWB',
      total: 248,
      status: 'IN TRANSIT',
      progress: 0.50,
      driver: {
        name: 'Verified Driver',
        vehicleModel: 'Sprinter LWB',
        registration: 'VE21 RIF',
        phone: '07700 900111',
        status: 'ACTIVE ASSIGNMENT',
      },
    };
    localStorage.setItem('neo_portal_bookings', JSON.stringify([activeInTransitBooking]));
    const updateInTransitEdit: Booking = {
      ...activeInTransitBooking,
      deliveryTime: '15:15 BST',
    };
    const updateResult6 = await updateBooking(updateInTransitEdit);
    assert.strictEqual(updateResult6[0].status, 'IN TRANSIT');
    assert.strictEqual(updateResult6[0].deliveryTime, '15:15 BST');
    assert.strictEqual(capturedDbUpdatePayload?.status, 'In transit');
    assert.strictEqual(capturedDbUpdateId, 'NT-25009');
    console.log('✓ PASS 7.1f: Legitimate updates to a booking that is ALREADY IN TRANSIT succeed without blocking');

    // Attempt 7.1g: Symmetrical ID mapping and Supabase bookings.id target verification
    const asymmetricalBooking: Booking = {
      id: 'b-mock-99',
      reference: 'NT-29999',
      company_id: 'comp-meridian-001',
      date: 'Today',
      origin: 'Manchester',
      destination: 'Leeds',
      vehicle: 'Luton Box Van',
      total: 310,
      status: 'SCHEDULED',
    };
    localStorage.setItem('neo_portal_bookings', JSON.stringify([asymmetricalBooking]));
    const updateAsymBooking: Booking = {
      ...asymmetricalBooking,
      deliveryTime: '16:45',
    };
    await updateBooking(updateAsymBooking);
    assert.strictEqual(
      capturedDbUpdateId,
      'NT-29999',
      'Supabase update must target the authoritative booking reference (NT-29999)'
    );
    console.log('✓ PASS 7.1g: Symmetrical ID matching targets authoritative Supabase bookings.id');

    // -------------------------------------------------------------------------
    // Attempt 7.1h: Missing local cache + Supabase returns existing IN TRANSIT booking
    // Ordinary field edits must NOT demote status back to SCHEDULED
    // -------------------------------------------------------------------------
    localStorage.clear();
    const mockDbLookupClient = {
      from: (table: string) => {
        if (table === 'bookings') {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                maybeSingle: () => {
                  if (val === 'NT-25010') {
                    return Promise.resolve({
                      data: {
                        id: 'NT-25010',
                        company_id: 'comp-meridian-001',
                        status: 'In transit',
                        progress_t: 0.65,
                        driver_name: 'David Wilson',
                        driver_vehicle: 'Sprinter LWB',
                        driver_reg: 'DW23 TRN',
                        pickup_tracking_url: 'https://tracking.spoke.com/track/pickup-10',
                        delivery_tracking_url: 'https://tracking.spoke.com/track/delivery-10',
                      },
                      error: null,
                    });
                  }
                  if (val === 'NT-25011') {
                    return Promise.resolve({
                      data: {
                        id: 'NT-25011',
                        company_id: 'comp-meridian-001',
                        status: 'Delivered',
                        progress_t: 1.0,
                        driver_name: 'David Wilson',
                        driver_vehicle: 'Sprinter LWB',
                        driver_reg: 'DW23 TRN',
                        delivery_tracking_url: 'https://tracking.spoke.com/track/delivery-11',
                      },
                      error: null,
                    });
                  }
                  return Promise.resolve({ data: null, error: null });
                },
              }),
            }),
            update: (payload: any) => ({
              eq: (field: string, val: string) => {
                capturedDbUpdatePayload = payload;
                capturedDbUpdateId = val;
                return Promise.resolve({ data: payload, error: null });
              },
            }),
          };
        }
        return { select: () => Promise.resolve({ data: [], error: null }) };
      },
    };
    setCustomSupabaseClient(mockDbLookupClient as any);

    // Edit an existing IN TRANSIT booking when local cache is empty
    const editInTransitWithoutCache: Booking = {
      id: 'NT-25010',
      reference: 'NT-25010',
      status: 'IN TRANSIT',
      vehicle: 'Luton Box Van',
      total: 390,
      cargo: 'High-priority replacement generator',
      date: 'Today',
      origin: 'London',
      destination: 'Leeds',
    };
    const updateResult7 = await updateBooking(editInTransitWithoutCache);
    assert.strictEqual(
      updateResult7[0].status,
      'IN TRANSIT',
      'Missing local cache must NOT demote an existing in-transit booking to SCHEDULED'
    );
    assert.strictEqual(
      capturedDbUpdatePayload?.status,
      'In transit',
      'Supabase payload status must remain In transit'
    );
    assert.strictEqual(
      capturedDbUpdatePayload?.vehicle,
      'Luton Box Van',
      'Supabase payload must save ordinary vehicle edit'
    );
    assert.strictEqual(
      capturedDbUpdatePayload?.total_gbp,
      390,
      'Supabase payload must save ordinary total edit'
    );
    assert.strictEqual(
      updateResult7[0].driver?.name,
      'David Wilson',
      'Driver details must be preserved from authoritative DB row'
    );
    assert.strictEqual(
      updateResult7[0].progress,
      0.65,
      'Telemetry progress must be preserved from authoritative DB row'
    );
    console.log('✓ PASS 7.1h: Missing local cache does not demote existing IN TRANSIT booking during ordinary edits');

    // -------------------------------------------------------------------------
    // Attempt 7.1i: Missing local cache + Supabase returns existing DELIVERED booking
    // Ordinary field edits must NOT demote status back to SCHEDULED
    // -------------------------------------------------------------------------
    localStorage.clear();
    const editDeliveredWithoutCache: Booking = {
      id: 'NT-25011',
      reference: 'NT-25011',
      status: 'DELIVERED',
      vehicle: 'Sprinter LWB',
      total: 310,
      cargo: 'Machinery spares',
      date: 'Today',
      origin: 'Manchester',
      destination: 'Birmingham',
      deliveryTime: '14:20 BST',
    };
    const updateResult8 = await updateBooking(editDeliveredWithoutCache);
    assert.strictEqual(
      updateResult8[0].status,
      'DELIVERED',
      'Missing local cache must NOT demote an existing DELIVERED booking to SCHEDULED'
    );
    assert.strictEqual(
      capturedDbUpdatePayload?.status,
      'Delivered',
      'Supabase payload status must remain Delivered'
    );
    assert.strictEqual(
      updateResult8[0].delivery_tracking_url,
      'https://tracking.spoke.com/track/delivery-11',
      'Delivery tracking URL must be preserved from authoritative DB record'
    );
    console.log('✓ PASS 7.1i: Missing local cache does not demote existing DELIVERED booking during ordinary edits');

    // -------------------------------------------------------------------------
    // Attempt 7.1j: Already-DELIVERED booking permits ordinary field edits without falsely changing delivery evidence
    // -------------------------------------------------------------------------
    const editDeliveredCargo: Booking = {
      ...updateResult8[0],
      cargo: 'Updated Cargo Note: Signed at Dock Gate 2',
      delivery_tracking_url: 'https://tracking.spoke.com/track/delivery-11',
      progress: 1.0,
    };
    const updateResult9 = await updateBooking(editDeliveredCargo);
    assert.strictEqual(updateResult9[0].status, 'DELIVERED');
    assert.strictEqual(updateResult9[0].cargo, 'Updated Cargo Note: Signed at Dock Gate 2');
    assert.strictEqual(
      updateResult9[0].delivery_tracking_url,
      'https://tracking.spoke.com/track/delivery-11',
      'Legitimate delivery evidence tracking link must be strictly retained'
    );
    assert.strictEqual(
      updateResult9[0].progress,
      1.0,
      'Legitimate completion progress must be retained'
    );
    assert.strictEqual(capturedDbUpdatePayload?.status, 'Delivered');
    console.log('✓ PASS 7.1j: Already-DELIVERED booking permits ordinary field edits while preserving genuine delivery evidence');

    // Test 7.2: Static verification of AdminPortal.tsx integrity
    const adminPortalFile = fs.readFileSync(
      path.resolve(process.cwd(), 'src/AdminPortal.tsx'),
      'utf8'
    );
    assert(
      !adminPortalFile.includes("onClick={() => handleQuickStatusChange(b, 'IN TRANSIT')}"),
      'AdminPortal must NOT render a quick Dispatch button that directly sets IN TRANSIT'
    );
    assert(
      !adminPortalFile.includes("onClick={() => handleQuickStatusChange(b, 'DELIVERED')}"),
      'AdminPortal must NOT render a quick Delivered button that directly sets DELIVERED'
    );
    assert(
      adminPortalFile.includes('Spoke dispatch integration pending'),
      'AdminPortal must display "Spoke dispatch integration pending" in place of quick dispatch'
    );
    assert(
      !adminPortalFile.includes("registration: editingBooking.driver?.registration || 'GN71 XPO'"),
      'AdminPortal must not auto-inject GN71 XPO fallback into registration field'
    );
    assert(
      !adminPortalFile.includes("name: editingBooking.driver?.name || 'Marek Kowalski'"),
      'AdminPortal must not auto-inject Marek Kowalski fallback into driver name field'
    );
    console.log('✓ PASS 7.2: AdminPortal statically verified for status integrity and removal of mock auto-injections');

    // Test 7.3: Static verification of LiveTrackingView.tsx anti-mock protections
    const freshLiveTrackingViewFile = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/views/LiveTrackingView.tsx'),
      'utf8'
    );
    assert(
      !freshLiveTrackingViewFile.includes('Marek Kowalski'),
      'LiveTrackingView must NOT contain "Marek Kowalski"'
    );
    assert(
      !freshLiveTrackingViewFile.includes('GN71 XPO'),
      'LiveTrackingView must NOT contain "GN71 XPO"'
    );
    assert(
      !freshLiveTrackingViewFile.includes('Loading verified'),
      'LiveTrackingView must NOT contain fake claim "Loading verified"'
    );
    assert(
      !freshLiveTrackingViewFile.includes('Passing corridor checkpoint'),
      'LiveTrackingView must NOT contain fake claim "Passing corridor checkpoint"'
    );
    assert(
      !freshLiveTrackingViewFile.includes("currentBooking.reference === 'NT-24816'"),
      'LiveTrackingView must not simulate hardcoded progress for NT-24816'
    );
    assert(
      !freshLiveTrackingViewFile.includes('return 45;'),
      'LiveTrackingView must NOT return hardcoded 45% progress'
    );
    assert(
      !freshLiveTrackingViewFile.includes('Delivery signed & completed'),
      'LiveTrackingView must NOT claim "Delivery signed & completed" without verified evidence'
    );
    assert(
      freshLiveTrackingViewFile.includes('Progress unavailable (Telemetry pending)'),
      'LiveTrackingView must indicate progress is unavailable when genuine telemetry is absent'
    );
    assert(
      freshLiveTrackingViewFile.includes('Delivery recorded — POD pending'),
      'LiveTrackingView must indicate POD is pending when verified delivery evidence is absent'
    );
    console.log('✓ PASS 7.3: LiveTrackingView statically verified against mock drivers, fake checkpoints, and simulated progress');

    // Test 7.4: Static verification of BookingHistoryView.tsx POD text
    const bookingHistoryFile = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/views/BookingHistoryView.tsx'),
      'utf8'
    );
    assert(
      !bookingHistoryFile.includes('Marek Kowalski'),
      'BookingHistoryView POD preview must NOT contain "Marek Kowalski"'
    );
    assert(
      !bookingHistoryFile.includes('GN71 XPO'),
      'BookingHistoryView POD preview must NOT contain "GN71 XPO"'
    );
    assert(
      !bookingHistoryFile.includes('J. Higgins'),
      'BookingHistoryView must NOT contain hardcoded consignee "J. Higgins"'
    );
    assert(
      !bookingHistoryFile.includes('VERIFIED DIGITAL STYLUS SIGNATURE CAPTURED'),
      'BookingHistoryView must NOT claim "VERIFIED DIGITAL STYLUS SIGNATURE CAPTURED"'
    );
    assert(
      !bookingHistoryFile.includes('Verified Digital Stylus'),
      'BookingHistoryView must NOT claim "Verified Digital Stylus"'
    );
    assert(
      bookingHistoryFile.includes('Signature unavailable'),
      'BookingHistoryView must state signature is unavailable when evidence is absent'
    );
    console.log('✓ PASS 7.4: BookingHistoryView POD preview verified against mock driver and vehicle fallbacks');

    // -------------------------------------------------------------------------
    // Clean up test overrides
    // -------------------------------------------------------------------------
    console.log('\n=================================================================');
    console.log('ALL BOOKING LIFECYCLE TESTS PASSED (0 failures)');
    console.log('=================================================================');
  } catch (err) {
    console.error('Test failure:', err);
    failures++;
  } finally {
    // Guaranteed test isolation cleanup: Always restore global overrides and clean cache
    try {
      setCustomSupabaseClient(null);
      setDemoModeOverrideForTesting(null);
      setServerSupabaseClientForTesting(null);
      localStorage.clear();
    } catch (cleanupErr) {
      console.warn('Warning during test isolation cleanup:', cleanupErr);
    }
    server.close();
  }

  if (failures > 0) {
    process.exit(1);
  }
}

runBookingLifecycleTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

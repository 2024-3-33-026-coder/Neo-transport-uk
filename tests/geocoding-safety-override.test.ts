/**
 * TRAVELTIME GEOCODING SAFETY & EXPLICIT OVERRIDE REGRESSION TESTS
 *
 * Verifies:
 * 1. Default Fail-Closed 422 Block: When pickup or delivery geocoding flags manual review
 *    (e.g., Unit D1 at Taylor Business Park), dispatch is blocked with HTTP 422 and code GEOCODING_MANUAL_REVIEW_REQUIRED.
 * 2. Unauthorized & Malformed Overrides: Non-boolean override values (string, number) rejected with HTTP 400;
 *    override = false blocked with HTTP 422.
 * 3. Authorized Override: When allowImpreciseGeocodeOverride: true is explicitly provided, dispatch proceeds.
 * 4. Comprehensive Audit Trail: Both the override decision and the dispatch record the actor, booking ID,
 *    timestamp, review reasons, and override decision.
 * 5. Independent Pickup vs Delivery Evaluation: Tests pickup-only, delivery-only, and clean address resolutions.
 * 6. UI Fail-Closed State Machine: isPilotDispatchExecutable requires explicit override when manual review is flagged.
 */

import assert from 'assert';
import http from 'http';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Ensure test execution environment is detected
process.env.NODE_ENV = 'test';
process.env.NEO_SPOKE_PILOT_DISPATCH_ENABLED = 'true';
process.env.NEO_SPOKE_MOCK_DISPATCH_ENABLED = 'true';
process.env.TRAVELTIME_APP_ID = process.env.TRAVELTIME_APP_ID || 'test_app_id_mock';
process.env.TRAVELTIME_API_KEY = process.env.TRAVELTIME_API_KEY || 'test_api_key_mock';
process.env.NEO_SPOKE_PILOT_DISPATCH_APPROVED_TOKEN = 'APPROVED_PILOT_SECRET_TOKEN_2026';

import app, {
  setServerSupabaseClientForTesting,
  resetPilotDispatchRegistryForTesting,
} from '../api/index.js';
import {
  setCustomTravelTimeFetcherForTesting,
  geocodeBookingWithTravelTime,
} from '../api/traveltimeService.js';
import {
  isPilotDispatchExecutable,
  executeSpokePilotDispatch,
} from '../src/lib/portalStore.js';

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

// Mock GeoJSON Features
const MOCK_TAYLOR_BUSINESS_PARK_FEATURE = {
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [-2.5176, 53.44541], // [lng, lat]
  },
  properties: {
    name: 'Taylor Business Park, Risley, Warrington, WA3 6BL, United Kingdom',
    score: 0.85,
    country: 'United Kingdom',
    postcode: 'WA3 6BL',
    confidence: 'high',
  },
};

const MOCK_EXACT_BUILDING_FEATURE = {
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [-0.1276, 51.5034], // [lng, lat]
  },
  properties: {
    name: '10 Downing Street, Westminster, London, SW1A 2AA, United Kingdom',
    label: '10 Downing Street, Westminster, London, SW1A 2AA, United Kingdom',
    category: 'address',
    type: 'building',
    housenumber: '10',
    street: 'Downing Street',
    city: 'London',
    postcode: 'SW1A 2AA',
    score: 0.95,
    confidence: 'exact',
  },
};

const MOCK_POSTCODE_CENTROID_FEATURE = {
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [-2.5200, 53.4900], // [lng, lat]
  },
  properties: {
    name: 'Leigh, WN7 3PT, United Kingdom',
    score: 0.70,
    country: 'United Kingdom',
    postcode: 'WN7 3PT',
    confidence: 'low',
  },
};

async function runGeocodingSafetyTests() {
  console.log('=================================================================');
  console.log('STARTING GEOCODING SAFETY & EXPLICIT OVERRIDE REGRESSION TESTS');
  console.log('=================================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  const testAdminUser = {
    id: 'admin-usr-geosafety-100',
    email: 'ops@neotransport.co.uk',
    role: 'authenticated',
    app_metadata: { role: 'admin' },
    user_metadata: { role: 'admin' },
  };

  const recordedAuditEntries: any[] = [];

  const mockBooking = {
    id: 'NT-25008',
    company_id: 'comp-meridian-001',
    status: 'Scheduled',
    pickup: 'Unit D1, Taylor Business Park, Risley, Warrington, WA3 6BL, UK',
    dropoff: '10 Downing Street, London, SW1A 2AA',
    pickup_contact: 'Taylor Park Desk',
    pickup_phone: '01925 555010',
    collection_window: 'ASAP',
    recipient_name: 'Receiving Office',
    recipient_phone: '020 7925 0918',
    goods: 'Precision machine components',
    weight_kg: 500,
    items_count: 2,
    vehicle: 'Sprinter LWB',
    service: 'Emergency (ASAP)',
    total_gbp: 280,
    distance_miles: 185,
    payment_method: 'standby-account',
    po_reference: 'PO-GEO-SAFE-001',
  };

  const mockCompany = {
    id: 'comp-meridian-001',
    name: 'Meridian Logistics Ltd',
    account_code: 'NEO-SB-2026',
    standby_active: true,
    verified: true,
    spoke_depot_id: null,
  };

  const mockSupabase = {
    auth: {
      getUser: (_token: string) => Promise.resolve({ data: { user: testAdminUser }, error: null }),
    },
    from: (table: string) => {
      if (table === 'bookings') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              single: () => Promise.resolve({
                data: val === mockBooking.id ? mockBooking : null,
                error: val === mockBooking.id ? null : { code: 'PGRST116', message: 'Not found' },
              }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
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
                  full_name: 'Ops Safety Admin',
                  email: testAdminUser.email,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'companies') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: mockCompany, error: null }),
            }),
          }),
        };
      }
      if (table === 'spoke_booking_stop_state') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
          upsert: () => Promise.resolve({ error: null }),
        };
      }
      if (table === 'spoke_pilot_dispatch_claims') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
          insert: () => Promise.resolve({ error: null }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      if (table === 'admin_audit_logs') {
        return {
          insert: (entry: any) => {
            recordedAuditEntries.push(entry);
            return Promise.resolve({ error: null });
          },
        };
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      };
    },
  };

  setServerSupabaseClientForTesting(mockSupabase as any);

  // Set TravelTime mock fetcher to return business park for pickup (requires review) and building for dropoff
  setCustomTravelTimeFetcherForTesting(async (url) => {
    const urlStr = url.toString();
    if (urlStr.includes('Taylor%20Business%20Park') || urlStr.includes('Taylor')) {
      return new Response(JSON.stringify({
        type: 'FeatureCollection',
        features: [MOCK_TAYLOR_BUSINESS_PARK_FEATURE],
      }));
    }
    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features: [MOCK_EXACT_BUILDING_FEATURE],
    }));
  });

  const adminHeaders = {
    Authorization: 'Bearer test-valid-admin-jwt',
  };

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Default Fail-Closed 422 Block
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing Default Fail-Closed 422 Block ---');
    resetPilotDispatchRegistryForTesting();

    const res1 = await testRequest(
      server,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-25008',
        planDate: '2026-10-30',
        pilotAuthorizationToken: 'APPROVED_PILOT_SECRET_TOKEN_2026',
      }
    );

    assert.strictEqual(res1.status, 422, 'Must block dispatch with HTTP 422 when manual review is required');
    assert.strictEqual(res1.data.code, 'GEOCODING_MANUAL_REVIEW_REQUIRED', 'Error code must match specification');
    assert.ok(
      res1.data.error.includes('Address geocoding requires manual review'),
      'Error message must state manual review requirement'
    );
    assert.ok(Array.isArray(res1.data.manualReviewReasons), 'manualReviewReasons must be an array');
    assert.ok(
      res1.data.manualReviewReasons.some((r: string) => r.includes('business park')),
      'Review reason must explain the business park / estate match'
    );
    assert.strictEqual(res1.data.geocoding?.anyRequiresManualReview, true);
    assert.strictEqual(res1.data.geocoding?.pickup?.precision, 'business_park_or_estate');
    console.log('✓ PASS 1.1: Default dispatch request without override strictly rejected with HTTP 422 and code GEOCODING_MANUAL_REVIEW_REQUIRED');

    // -------------------------------------------------------------------------
    // TEST 2: Unauthorized & Malformed Overrides
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Unauthorized & Malformed Overrides ---');
    resetPilotDispatchRegistryForTesting();

    // 2.1 String value for boolean flag
    const res2A = await testRequest(
      server,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-25008',
        planDate: '2026-10-30',
        pilotAuthorizationToken: 'APPROVED_PILOT_SECRET_TOKEN_2026',
        allowImpreciseGeocodeOverride: 'true', // Malformed string!
      }
    );
    assert.strictEqual(res2A.status, 400, 'Must reject string allowImpreciseGeocodeOverride with HTTP 400');
    assert.ok(res2A.data.error.includes('must be a boolean'));
    console.log('✓ PASS 2.1: Malformed string override rejected with HTTP 400 Bad Request');

    // 2.2 Numeric value for boolean flag
    resetPilotDispatchRegistryForTesting();
    const res2B = await testRequest(
      server,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-25008',
        planDate: '2026-10-30',
        pilotAuthorizationToken: 'APPROVED_PILOT_SECRET_TOKEN_2026',
        allowImpreciseGeocodeOverride: 1, // Malformed number!
      }
    );
    assert.strictEqual(res2B.status, 400, 'Must reject numeric allowImpreciseGeocodeOverride with HTTP 400');
    console.log('✓ PASS 2.2: Malformed numeric override rejected with HTTP 400 Bad Request');

    // 2.3 Explicit false value
    resetPilotDispatchRegistryForTesting();
    const res2C = await testRequest(
      server,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-25008',
        planDate: '2026-10-30',
        pilotAuthorizationToken: 'APPROVED_PILOT_SECRET_TOKEN_2026',
        allowImpreciseGeocodeOverride: false, // Explicit false
      }
    );
    assert.strictEqual(res2C.status, 422, 'Must reject false override with HTTP 422');
    assert.strictEqual(res2C.data.code, 'GEOCODING_MANUAL_REVIEW_REQUIRED');
    console.log('✓ PASS 2.3: Explicit allowImpreciseGeocodeOverride: false rejected with HTTP 422');

    // -------------------------------------------------------------------------
    // TEST 3: Authorized Override Path
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Authorized Override Path ---');
    resetPilotDispatchRegistryForTesting();
    recordedAuditEntries.length = 0;

    const res3 = await testRequest(
      server,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-25008',
        planDate: '2026-10-30',
        pilotAuthorizationToken: 'APPROVED_PILOT_SECRET_TOKEN_2026',
        allowImpreciseGeocodeOverride: true, // Explicitly authorized
      }
    );

    assert.strictEqual(res3.status, 200, `Authorized override must succeed: ${JSON.stringify(res3.data)}`);
    assert.strictEqual(res3.data.success, true);
    assert.ok(res3.data.planId, 'Must return confirmed Spoke plan ID');
    assert.strictEqual(res3.data.stopsImported, 2);
    console.log('✓ PASS 3.1: Explicit authorized override allowImpreciseGeocodeOverride: true permits dispatch execution');

    // -------------------------------------------------------------------------
    // TEST 4: Audit Logging of Authorized Override
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Audit Logging of Override ---');
    const overrideAuditEntry = recordedAuditEntries.find(
      (e) => e.action === 'GEOCODING_MANUAL_REVIEW_OVERRIDE'
    );
    assert.ok(overrideAuditEntry, 'Audit log must record GEOCODING_MANUAL_REVIEW_OVERRIDE');
    assert.strictEqual(overrideAuditEntry.target_id, 'NT-25008', 'Audit entry must record booking reference');
    assert.strictEqual(overrideAuditEntry.admin_email, 'ops@neotransport.co.uk', 'Audit entry must record actor email');
    assert.strictEqual(overrideAuditEntry.details.overrideDecision, 'AUTHORIZED_MANUAL_OVERRIDE');
    assert.ok(Array.isArray(overrideAuditEntry.details.reviewReasons), 'Audit entry must record review reasons');
    assert.strictEqual(overrideAuditEntry.details.pickupPrecision, 'business_park_or_estate');
    assert.ok(overrideAuditEntry.details.timestamp, 'Audit entry must contain timestamp');

    const dispatchAuditEntry = recordedAuditEntries.find(
      (e) => e.action === 'SPOKE_PILOT_DISPATCH'
    );
    assert.ok(dispatchAuditEntry, 'Audit log must record SPOKE_PILOT_DISPATCH');
    assert.strictEqual(dispatchAuditEntry.details.impreciseGeocodeOverridden, true);
    console.log('✓ PASS 4.1: Dedicated GEOCODING_MANUAL_REVIEW_OVERRIDE and dispatch audit entries recorded with full attribution');

    // -------------------------------------------------------------------------
    // TEST 5: Independent Pickup vs Delivery Evaluation
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Independent Pickup vs Delivery Evaluation ---');

    // Case 5.1: Delivery only requires review (postcode centroid)
    setCustomTravelTimeFetcherForTesting(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes('10%20Downing') || urlStr.includes('Downing')) {
        return new Response(JSON.stringify({
          type: 'FeatureCollection',
          features: [MOCK_EXACT_BUILDING_FEATURE],
        }));
      }
      return new Response(JSON.stringify({
        type: 'FeatureCollection',
        features: [MOCK_POSTCODE_CENTROID_FEATURE],
      }));
    });

    const dropoffOnlyBooking = {
      pickup: '10 Downing Street, London, SW1A 2AA',
      dropoff: 'Industrial Estate, Leigh, WN7 3PT',
    };
    const dropoffOnlyGeo = await geocodeBookingWithTravelTime(dropoffOnlyBooking);
    assert.strictEqual(dropoffOnlyGeo.pickup.assessment?.requiresManualReview, false);
    assert.strictEqual(dropoffOnlyGeo.dropoff.assessment?.requiresManualReview, true);
    assert.strictEqual(dropoffOnlyGeo.anyRequiresManualReview, true);
    assert.ok(dropoffOnlyGeo.manualReviewReasons.some((r) => r.includes('[Delivery]:')));
    console.log('✓ PASS 5.1: Delivery-only review requirement independently flagged');

    // Case 5.2: Both addresses clean (exact building)
    setCustomTravelTimeFetcherForTesting(async () => {
      return new Response(JSON.stringify({
        type: 'FeatureCollection',
        features: [MOCK_EXACT_BUILDING_FEATURE],
      }));
    });

    const cleanBooking = {
      pickup: '10 Downing Street, London, SW1A 2AA',
      dropoff: '10 Downing Street, London, SW1A 2AA',
    };
    const cleanGeo = await geocodeBookingWithTravelTime(cleanBooking);
    assert.strictEqual(cleanGeo.pickup.assessment?.requiresManualReview, false);
    assert.strictEqual(cleanGeo.dropoff.assessment?.requiresManualReview, false);
    assert.strictEqual(cleanGeo.anyRequiresManualReview, false);
    assert.strictEqual(cleanGeo.manualReviewReasons.length, 0);
    console.log('✓ PASS 5.2: Clean addresses proceed without manual review requirement');

    // -------------------------------------------------------------------------
    // TEST 6: UI Fail-Closed State Machine (isPilotDispatchExecutable)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing UI Fail-Closed State Machine (isPilotDispatchExecutable) ---');

    const flaggedDryRunResult = {
      success: true,
      geocoding: {
        allResolved: true,
        anyRequiresManualReview: true,
        manualReviewReasons: ['[Pickup]: Matched at business park level'],
      },
    };

    // Blocked when allowGeocodeOverride is omitted or false
    assert.strictEqual(
      isPilotDispatchExecutable({
        isDispatching: false,
        isDryRunLoading: false,
        dryRunResult: flaggedDryRunResult,
        dryRunError: null,
        pilotAuthToken: 'APPROVED_TOKEN',
        pilotConfirmed: true,
        pilotDispatchBooking: { id: 'NT-25008' },
        allowGeocodeOverride: false,
      }),
      false,
      'isPilotDispatchExecutable must block execution when geocoding requires review and allowGeocodeOverride is false'
    );

    assert.strictEqual(
      isPilotDispatchExecutable({
        isDispatching: false,
        isDryRunLoading: false,
        dryRunResult: flaggedDryRunResult,
        dryRunError: null,
        pilotAuthToken: 'APPROVED_TOKEN',
        pilotConfirmed: true,
        pilotDispatchBooking: { id: 'NT-25008' },
        allowGeocodeOverride: undefined,
      }),
      false,
      'isPilotDispatchExecutable must block execution when allowGeocodeOverride is omitted'
    );

    // Permitted only when allowGeocodeOverride: true
    assert.strictEqual(
      isPilotDispatchExecutable({
        isDispatching: false,
        isDryRunLoading: false,
        dryRunResult: flaggedDryRunResult,
        dryRunError: null,
        pilotAuthToken: 'APPROVED_TOKEN',
        pilotConfirmed: true,
        pilotDispatchBooking: { id: 'NT-25008' },
        allowGeocodeOverride: true,
      }),
      true,
      'isPilotDispatchExecutable must permit execution when allowGeocodeOverride is true'
    );
    console.log('✓ PASS 6.1: isPilotDispatchExecutable strictly enforces fail-closed override gating');

  } finally {
    setCustomTravelTimeFetcherForTesting(null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('\n=================================================================');
  console.log('ALL GEOCODING SAFETY & EXPLICIT OVERRIDE TESTS PASSED (0 failures)');
  console.log('=================================================================\n');
}

runGeocodingSafetyTests().catch((err) => {
  console.error('\n❌ GEOCODING SAFETY TEST SUITE FAILED:', err);
  process.exit(1);
});

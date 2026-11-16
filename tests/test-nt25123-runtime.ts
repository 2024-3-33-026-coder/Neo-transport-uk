import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

process.env.NODE_ENV = 'test';

import assert from 'assert';
import http from 'http';
import app, { setServerSupabaseClientForTesting, resetPilotDispatchRegistryForTesting } from '../api/index.js';
import { geocodeBookingWithTravelTime } from '../api/traveltimeService.js';
import { generateSpokeDryRunPayload, BookingSourceData } from '../src/lib/spokeMapper.js';

async function testRequest(
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

async function main() {
  const booking: BookingSourceData = {
    id: 'NT-25123',
    pickup: 'Neo Transport Ltd, Unit D1, Taylor Business Park, Risley, Warrington, WA3 6BL',
    pickup_contact: 'Operations',
    pickup_phone: '+44 1925 123456',
    collection_window: 'ASAP — ready now',
    dropoff: 'A Clarke & Co, Unit A5, Walter Leigh Way, Moss Industrial Estate, Leigh, WN7 3PT',
    recipient_name: 'Receiving',
    recipient_phone: '+44 1942 654321',
    goods: 'Palletised parts',
    weight_kg: 650,
    items_count: 2,
    vehicle: 'Sprinter LWB',
    service: 'Direct (Dedicated)',
  };

  console.log('--- 1. Testing Direct Geocoding & Pure Payload Generation ---');
  const bookingGeocode = await geocodeBookingWithTravelTime(booking);

  console.log('=== GEOCODING RUNTIME RESULT FOR NT-25123 ===');
  console.log('Configured:', true);
  console.log('Pickup Success:', bookingGeocode.pickup.success);
  console.log('Dropoff Success:', bookingGeocode.dropoff.success);
  console.log('Pickup Precision:', bookingGeocode.pickup.assessment?.precision);
  console.log('Dropoff Precision:', bookingGeocode.dropoff.assessment?.precision);
  console.log('Pickup Matched Name:', bookingGeocode.pickup.assessment?.matchedName);
  console.log('Dropoff Matched Name:', bookingGeocode.dropoff.assessment?.matchedName);
  console.log('Pickup Requires Review:', bookingGeocode.pickup.assessment?.requiresManualReview);
  console.log('Dropoff Requires Review:', bookingGeocode.dropoff.assessment?.requiresManualReview);
  console.log('Manual Review Reasons:', bookingGeocode.manualReviewReasons);
  console.log('Pickup Coords:', bookingGeocode.pickupCoords);
  console.log('Dropoff Coords:', bookingGeocode.dropoffCoords);

  // Inject into booking before payload generation as api/index.ts now does:
  if (bookingGeocode.pickupCoords) {
    booking.pickupCoords = bookingGeocode.pickupCoords;
    booking.pickupLatitude = bookingGeocode.pickupCoords.lat;
    booking.pickupLongitude = bookingGeocode.pickupCoords.lng;
  }
  if (bookingGeocode.dropoffCoords) {
    booking.dropoffCoords = bookingGeocode.dropoffCoords;
    booking.dropoffLatitude = bookingGeocode.dropoffCoords.lat;
    booking.dropoffLongitude = bookingGeocode.dropoffCoords.lng;
  }

  const dryRun = generateSpokeDryRunPayload(booking, {
    planDate: '2026-10-27',
    pickupCoords: bookingGeocode.pickupCoords,
    dropoffCoords: bookingGeocode.dropoffCoords,
  });

  console.log('\n=== DRY RUN PAYLOAD GENERATION ===');
  console.log('DryRun Success:', dryRun.success);
  console.log('Coordinates Status:', dryRun.summary.coordinatesStatus);
  console.log('Warnings:', dryRun.summary.warnings);
  console.log('Errors:', dryRun.summary.errors);
  assert.ok(dryRun.stops, 'Stops array must be defined');
  console.log('Pickup Stop Lat/Lng:', dryRun.stops[0]?.address?.latitude, dryRun.stops[0]?.address?.longitude);
  console.log('Dropoff Stop Lat/Lng:', dryRun.stops[1]?.address?.latitude, dryRun.stops[1]?.address?.longitude);

  assert.strictEqual(dryRun.summary.coordinatesStatus.pickup, 'provided_and_valid');
  assert.strictEqual(dryRun.summary.coordinatesStatus.dropoff, 'provided_and_valid');
  assert.strictEqual(dryRun.summary.warnings.length, 0);
  assert.strictEqual(typeof dryRun.stops[0].address.latitude, 'number');
  assert.strictEqual(typeof dryRun.stops[0].address.longitude, 'number');
  assert.strictEqual(typeof dryRun.stops[1].address.latitude, 'number');
  assert.strictEqual(typeof dryRun.stops[1].address.longitude, 'number');

  console.log('\n--- 2. Testing End-to-End POST /api/admin/dispatch/spoke/dry-run Endpoint ---');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  const testAdminUser = {
    id: 'admin-usr-nt25123',
    email: 'ops@neotransport.co.uk',
    role: 'authenticated',
    app_metadata: { role: 'admin' },
    user_metadata: { role: 'admin' },
  };

  const dbBooking = {
    id: 'NT-25123',
    company_id: 'comp-clarkes-01',
    status: 'Scheduled',
    pickup: 'Neo Transport Ltd, Unit D1, Taylor Business Park, Risley, Warrington, WA3 6BL',
    pickup_contact: 'Operations',
    pickup_phone: '+44 1925 123456',
    collection_window: 'ASAP — ready now',
    dropoff: 'A Clarke & Co, Unit A5, Walter Leigh Way, Moss Industrial Estate, Leigh, WN7 3PT',
    recipient_name: 'Receiving',
    recipient_phone: '+44 1942 654321',
    goods: 'Palletised parts',
    weight_kg: 650,
    items_count: 2,
    vehicle: 'Sprinter LWB',
    service: 'Direct (Dedicated)',
    total_gbp: 150.0,
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
                data: val === dbBooking.id ? dbBooking : null,
                error: val === dbBooking.id ? null : { code: 'PGRST116', message: 'Not found' },
              }),
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
      if (table === 'companies') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: {
                  id: 'comp-clarkes-01',
                  name: 'A Clarke & Co',
                  standby_active: true,
                  verified: true,
                  spoke_depot_id: null,
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
          insert: () => Promise.resolve({ error: null }),
        };
      }
      if (table === 'spoke_pilot_dispatch_claims') {
        return {
          insert: () => Promise.resolve({ error: null }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (table === 'admin_audit_logs') {
        return {
          insert: () => Promise.resolve({ error: null }),
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        insert: () => Promise.resolve({ error: null }),
      };
    },
  };

  setServerSupabaseClientForTesting(mockSupabase as any);

  try {
    const res = await testRequest(
      server,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      { Authorization: 'Bearer test-admin-token' },
      { bookingId: 'NT-25123', planDate: '2026-10-27' }
    );

    console.log('HTTP Status:', res.status);
    console.log('Response Success:', res.data.success);
    console.log('Response Geocoding Configured:', res.data.geocoding?.configured);
    console.log('Response Pickup Assessment Precision:', res.data.geocoding?.pickup?.precision);
    console.log('Response Dropoff Assessment Precision:', res.data.geocoding?.dropoff?.precision);
    console.log('Response Any Requires Manual Review:', res.data.geocoding?.anyRequiresManualReview);
    console.log('Response Summary Coordinates Status:', res.data.summary?.coordinatesStatus);
    console.log('Response Summary Warnings:', res.data.summary?.warnings);
    console.log('Response Stop 0 Coords:', res.data.stops?.[0]?.address?.latitude, res.data.stops?.[0]?.address?.longitude);
    console.log('Response Stop 1 Coords:', res.data.stops?.[1]?.address?.latitude, res.data.stops?.[1]?.address?.longitude);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.geocoding.configured, true);
    assert.strictEqual(res.data.summary.coordinatesStatus.pickup, 'provided_and_valid');
    assert.strictEqual(res.data.summary.coordinatesStatus.dropoff, 'provided_and_valid');
    assert.ok(
      !res.data.summary.warnings.some((w: string) => w.includes('coordinates not provided')),
      'Missing coordinate warnings must be absent'
    );
    assert.strictEqual(typeof res.data.stops[0].address.latitude, 'number');
    assert.strictEqual(typeof res.data.stops[0].address.longitude, 'number');
    assert.strictEqual(typeof res.data.stops[1].address.latitude, 'number');
    assert.strictEqual(typeof res.data.stops[1].address.longitude, 'number');
    assert.strictEqual(res.data.geocoding.anyRequiresManualReview, true);

    console.log('\n--- 3. Testing POST /api/admin/dispatch/spoke/pilot Fail-Closed & Override on NT-25123 ---');
    process.env.NEO_SPOKE_PILOT_DISPATCH_ENABLED = 'true';
    process.env.NEO_SPOKE_MOCK_DISPATCH_ENABLED = 'true';
    process.env.NEO_SPOKE_PILOT_DISPATCH_APPROVED_TOKEN = 'PILOT-NT25123-APPROVED-2026';

    // 3.1 Without override -> must block with 422 GEOCODING_MANUAL_REVIEW_REQUIRED
    resetPilotDispatchRegistryForTesting();
    const pilotBlockedRes = await testRequest(
      server,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      { Authorization: 'Bearer test-admin-token' },
      {
        bookingId: 'NT-25123',
        planDate: '2026-10-27',
        pilotAuthorizationToken: 'PILOT-NT25123-APPROVED-2026',
      }
    );
    console.log('Pilot Blocked Status:', pilotBlockedRes.status);
    console.log('Pilot Blocked Code:', pilotBlockedRes.data.code);
    assert.strictEqual(pilotBlockedRes.status, 422);
    assert.strictEqual(pilotBlockedRes.data.code, 'GEOCODING_MANUAL_REVIEW_REQUIRED');
    assert.ok(Array.isArray(pilotBlockedRes.data.manualReviewReasons));

    // 3.2 With authorized override -> must succeed with 200
    resetPilotDispatchRegistryForTesting();
    const pilotAllowedRes = await testRequest(
      server,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      { Authorization: 'Bearer test-admin-token' },
      {
        bookingId: 'NT-25123',
        planDate: '2026-10-27',
        pilotAuthorizationToken: 'PILOT-NT25123-APPROVED-2026',
        allowImpreciseGeocodeOverride: true,
      }
    );
    console.log('Pilot Authorized Status:', pilotAllowedRes.status);
    console.log('Pilot Authorized Success:', pilotAllowedRes.data.success);
    assert.strictEqual(pilotAllowedRes.status, 200);
    assert.strictEqual(pilotAllowedRes.data.success, true);
    assert.ok(pilotAllowedRes.data.planId);
    assert.strictEqual(pilotAllowedRes.data.stopsImported, 2);

    console.log('\n✓ ALL CHECKS PASSED FOR NT-25123 DRY-RUN INTEGRATION!');
  } finally {
    setServerSupabaseClientForTesting(null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

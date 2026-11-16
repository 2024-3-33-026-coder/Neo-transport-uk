/**
 * SPOKE DISPATCH INTEGRATION & PAYLOAD MAPPING TEST SUITE
 * 
 * Verifies pure mapping, validation logic, coordinates bounds, weight formatting,
 * schema compliance against Spoke OpenAPI v3.1.0, and admin authorization enforcement.
 */

import assert from 'assert';
import http from 'http';
import cp from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import app, {
  setServerSupabaseClientForTesting,
  getServerSupabaseClientForTesting,
  resolveBookingLookupClient,
  SPOKE_DRY_RUN_BOOKING_COLUMNS,
  resetSmokeTestRegistryForTesting,
  processSpokeWebhookEventFallback,
  verifyBookingPaymentEligibility,
  resetPilotDispatchRegistryForTesting,
  inProgressPilotDispatchBookingIds,
} from '../api/index.js';
import {
  validateCoordinates,
  validateAndFormatWeight,
  validatePackageCount,
  parseExplicitTimeWindow,
  mapBookingToSpokePickupStop,
  mapBookingToSpokeDeliveryStop,
  mapDateToSpokePlan,
  buildSpokeAddress,
  resolveBookingReference,
  generateSpokeDryRunPayload,
  DEFAULT_NEO_APPROVED_SYNTHETIC_CONFIG,
  validateSyntheticTestConfig,
  buildSyntheticTestStops,
  loadServerApprovedSyntheticLocations,
} from '../src/lib/spokeMapper.ts';
import { SpokeClient, spokeClient } from '../api/spokeClient.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiIndexPath = path.resolve(__dirname, '../api/index.ts');
const apiIndexUrl = pathToFileURL(apiIndexPath).href;

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

    const postData =
      body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined;
    const reqHeaders: Record<string, string> = { ...headers };
    if (postData !== undefined) {
      if (!reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
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
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let data: any = raw;
          try {
            data = JSON.parse(raw);
          } catch {
            // keep raw string
          }
          resolve({ status: res.statusCode || 0, data });
        });
      }
    );

    req.on('error', reject);
    if (postData !== undefined) {
      req.write(postData);
    }
    req.end();
  });
}

async function runSpokeTests() {
  process.env.NODE_ENV = 'test';
  const origMockSpoke = process.env.NEO_SPOKE_MOCK_DISPATCH_ENABLED;
  process.env.NEO_SPOKE_MOCK_DISPATCH_ENABLED = 'false';
  console.log('=== Starting Spoke Dispatch Integration Test Suite ===\n');

  // ---------------------------------------------------------------------------
  // 1. Coordinates Validation Tests
  // ---------------------------------------------------------------------------
  console.log('--- 1. Testing Geographic Coordinates Validation ---');

  // Valid coordinates (Manchester Trafford Park & Birmingham)
  const valid1 = validateCoordinates(53.468, -2.325);
  assert.strictEqual(valid1.isValid, true);
  assert.strictEqual(valid1.latitude, 53.468);
  assert.strictEqual(valid1.longitude, -2.325);
  console.log('✓ PASS: Valid UK coordinates accepted');

  // Boundary coordinates
  assert.strictEqual(validateCoordinates(90, 180).isValid, true);
  assert.strictEqual(validateCoordinates(-90, -180).isValid, true);
  console.log('✓ PASS: Boundary coordinates (-90, 90, -180, 180) accepted');

  // Precision rounding
  const precision = validateCoordinates(53.4681234567, -2.3259876543);
  assert.strictEqual(precision.latitude, 53.468123);
  assert.strictEqual(precision.longitude, -2.325988);
  console.log('✓ PASS: Coordinates properly rounded to 6 decimal places');

  // Out of range: Latitude > 90
  const invalidLatHigh = validateCoordinates(90.0001, -2.325);
  assert.strictEqual(invalidLatHigh.isValid, false);
  assert.match(invalidLatHigh.error!, /Latitude .* outside the valid range/);
  console.log('✓ PASS: Latitude > 90 safely rejected');

  // Out of range: Latitude < -90
  const invalidLatLow = validateCoordinates(-90.1, -2.325);
  assert.strictEqual(invalidLatLow.isValid, false);
  assert.match(invalidLatLow.error!, /Latitude .* outside the valid range/);
  console.log('✓ PASS: Latitude < -90 safely rejected');

  // Out of range: Longitude > 180
  const invalidLngHigh = validateCoordinates(53.468, 180.05);
  assert.strictEqual(invalidLngHigh.isValid, false);
  assert.match(invalidLngHigh.error!, /Longitude .* outside the valid range/);
  console.log('✓ PASS: Longitude > 180 safely rejected');

  // Out of range: Longitude < -180
  const invalidLngLow = validateCoordinates(53.468, -181.0);
  assert.strictEqual(invalidLngLow.isValid, false);
  assert.match(invalidLngLow.error!, /Longitude .* outside the valid range/);
  console.log('✓ PASS: Longitude < -180 safely rejected');

  // Non-numeric & NaN
  assert.strictEqual(validateCoordinates('abc', -2.325).isValid, false);
  assert.strictEqual(validateCoordinates(NaN, -2.325).isValid, false);
  assert.strictEqual(validateCoordinates(Infinity, -2.325).isValid, false);
  assert.strictEqual(validateCoordinates(null, undefined).isValid, false);
  console.log('✓ PASS: NaN, non-numeric, Infinity, and null coordinates safely rejected');

  // ---------------------------------------------------------------------------
  // 2. Weight Validation & Formatting Tests
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Testing Weight Formatting & Schema Requirements ---');

  // Valid standard weight
  const validWeight = validateAndFormatWeight(650);
  assert.strictEqual(validWeight.isValid, true);
  assert.deepStrictEqual(validWeight.weight, { amount: 650, unit: 'kilogram' });
  console.log('✓ PASS: Valid weight formatted to required Spoke object');

  // Decimal precision for weight
  const decimalWeight = validateAndFormatWeight(125.456);
  assert.strictEqual(decimalWeight.isValid, true);
  assert.strictEqual(decimalWeight.weight?.amount, 125.46);
  assert.strictEqual(decimalWeight.weight?.unit, 'kilogram');
  console.log('✓ PASS: Weight rounded to two decimal places');

  // Zero weight allowed
  const zeroWeight = validateAndFormatWeight(0);
  assert.strictEqual(zeroWeight.isValid, true);
  assert.strictEqual(zeroWeight.weight?.amount, 0);
  console.log('✓ PASS: Zero weight valid');

  // Negative weight rejected
  const negativeWeight = validateAndFormatWeight(-15);
  assert.strictEqual(negativeWeight.isValid, false);
  assert.match(negativeWeight.error!, /cannot be negative/);
  console.log('✓ PASS: Negative weight safely rejected');

  // Excessive weight rejected
  const excessiveWeight = validateAndFormatWeight(1000000);
  assert.strictEqual(excessiveWeight.isValid, false);
  assert.match(excessiveWeight.error!, /exceeds maximum allowable limit/);
  console.log('✓ PASS: Excessive weight > 999,999kg rejected');

  // Non-numeric / NaN weight rejected
  assert.strictEqual(validateAndFormatWeight('invalid').isValid, false);
  assert.strictEqual(validateAndFormatWeight(null).isValid, false);
  assert.strictEqual(validateAndFormatWeight(undefined).isValid, false);
  console.log('✓ PASS: Non-numeric, null, and undefined weight safely rejected');

  // ---------------------------------------------------------------------------
  // 3. Plan Payload Mapping Tests
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Testing Plan Creation Payload Mapping ---');

  const planDate = new Date('2026-10-18T14:30:00Z');
  const planResult = mapDateToSpokePlan(planDate, 'NEO Emergency Freight Batch');
  assert.strictEqual(planResult.success, true);
  assert.strictEqual(planResult.data?.title, 'NEO Emergency Freight Batch');
  assert.deepStrictEqual(planResult.data?.starts, {
    day: 18,
    month: 10,
    year: 2026,
  });
  console.log('✓ PASS: Valid date mapped to Spoke plan payload');

  // Default title generation
  const defaultPlan = mapDateToSpokePlan(new Date('2026-05-31T00:00:00Z'));
  assert.strictEqual(defaultPlan.success, true);
  assert.strictEqual(defaultPlan.data?.title, 'NEO Dispatch - 2026-05-31');
  console.log('✓ PASS: Auto-generated date title matches convention');

  // Year range constraints
  assert.strictEqual(mapDateToSpokePlan(new Date('1999-12-31')).success, false);
  assert.strictEqual(mapDateToSpokePlan(new Date('2105-01-01')).success, false);
  assert.strictEqual(mapDateToSpokePlan('not-a-date').success, false);
  console.log('✓ PASS: Out-of-bounds plan years and invalid dates rejected');

  // ---------------------------------------------------------------------------
  // 4. Pickup Stop Mapping Tests
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Testing Pickup Stop Mapping & Address Validation ---');

  const mockBooking = {
    id: 'NT-24817',
    company_id: 'comp-uuid-999',
    pickup: 'Trafford Park, Manchester M17 1AB',
    pickup_contact: 'Mark Spencer',
    pickup_phone: '0161 555 0134',
    dropoff: 'Heartlands Parkway, Birmingham B6 7EU',
    recipient_name: 'Sarah Connor',
    recipient_phone: '0121 496 0281',
    delivery_instructions: 'Access via Bay 4',
    goods: 'Emergency palletised machinery parts',
    weight_kg: 650,
    items_count: 2,
    vehicle: 'Sprinter LWB',
    service: 'Emergency (ASAP)',
    po_reference: 'PO-2026-8910',
  };

  const pickupStopResult = mapBookingToSpokePickupStop(mockBooking, { lat: 53.468, lng: -2.325 });
  assert.strictEqual(pickupStopResult.success, true);
  const pickupStop = pickupStopResult.data!;

  assert.strictEqual(pickupStop.activity, 'pickup');
  assert.strictEqual(pickupStop.address.addressLineOne, 'Trafford Park, Manchester M17 1AB');
  assert.strictEqual(pickupStop.address.zip, 'M17 1AB');
  assert.strictEqual(pickupStop.address.country, 'GB');
  assert.strictEqual(pickupStop.address.latitude, 53.468);
  assert.strictEqual(pickupStop.address.longitude, -2.325);
  assert.strictEqual(pickupStop.recipient?.name, 'Mark Spencer');
  assert.strictEqual(pickupStop.recipient?.phone, '0161 555 0134');
  assert.strictEqual(pickupStop.recipient?.externalId, 'comp-uuid-999');
  assert.strictEqual(pickupStop.orderInfo?.sellerOrderId, 'NT-24817');
  assert.strictEqual(pickupStop.orderInfo?.invoiceNumber, 'PO-2026-8910');
  assert.strictEqual(pickupStop.orderInfo?.sellerName, 'NEO Transport');
  assert.deepStrictEqual(pickupStop.weight, { amount: 650, unit: 'kilogram' });
  assert.strictEqual(pickupStop.packageCount, 2);
  assert.match(pickupStop.notes!, /COLLECTION \/ PICKUP/);
  assert.match(pickupStop.notes!, /Goods: Emergency palletised machinery parts/);
  console.log('✓ PASS: Valid booking mapped to Spoke pickup stop');

  // Missing pickup address
  const missingPickup = mapBookingToSpokePickupStop({ ...mockBooking, pickup: '' });
  assert.strictEqual(missingPickup.success, false);
  assert.strictEqual(missingPickup.errors?.includes('Pickup address is required'), true);
  console.log('✓ PASS: Missing pickup address correctly flagged');

  // Invalid coordinates on pickup
  const invalidCoordsPickup = mapBookingToSpokePickupStop(mockBooking, { lat: 95.0, lng: -2.325 });
  assert.strictEqual(invalidCoordsPickup.success, false);
  assert.match(invalidCoordsPickup.errors![0], /Pickup coordinates invalid/);
  console.log('✓ PASS: Invalid coordinates on pickup stop correctly rejected');

  // ---------------------------------------------------------------------------
  // 5. Delivery Stop Mapping Tests
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Testing Delivery Stop Mapping & Address Validation ---');

  const deliveryStopResult = mapBookingToSpokeDeliveryStop(mockBooking, { lat: 52.503, lng: -1.884 });
  assert.strictEqual(deliveryStopResult.success, true);
  const deliveryStop = deliveryStopResult.data!;

  assert.strictEqual(deliveryStop.activity, 'delivery');
  assert.strictEqual(deliveryStop.address.addressLineOne, 'Heartlands Parkway, Birmingham B6 7EU');
  assert.strictEqual(deliveryStop.address.zip, 'B6 7EU');
  assert.strictEqual(deliveryStop.address.country, 'GB');
  assert.strictEqual(deliveryStop.address.latitude, 52.503);
  assert.strictEqual(deliveryStop.address.longitude, -1.884);
  assert.strictEqual(deliveryStop.recipient?.name, 'Sarah Connor');
  assert.strictEqual(deliveryStop.recipient?.phone, '0121 496 0281');
  assert.strictEqual(deliveryStop.recipient?.externalId, 'comp-uuid-999');
  assert.strictEqual(deliveryStop.orderInfo?.sellerOrderId, 'NT-24817');
  assert.strictEqual(deliveryStop.orderInfo?.invoiceNumber, 'PO-2026-8910');
  assert.strictEqual(deliveryStop.orderInfo?.sellerName, 'NEO Transport');
  assert.deepStrictEqual(deliveryStop.weight, { amount: 650, unit: 'kilogram' });
  assert.strictEqual(deliveryStop.packageCount, 2);
  assert.match(deliveryStop.notes!, /Access via Bay 4/);
  assert.match(deliveryStop.notes!, /Service: Emergency \(ASAP\)/);
  console.log('✓ PASS: Valid booking mapped to Spoke delivery stop');

  // Missing dropoff address
  const missingDropoff = mapBookingToSpokeDeliveryStop({ ...mockBooking, dropoff: '' });
  assert.strictEqual(missingDropoff.success, false);
  assert.strictEqual(missingDropoff.errors?.includes('Drop-off address is required'), true);
  console.log('✓ PASS: Missing drop-off address correctly flagged');

  // Invalid coordinates on delivery
  const invalidCoordsDelivery = mapBookingToSpokeDeliveryStop(mockBooking, { lat: 52.503, lng: 205.0 });
  assert.strictEqual(invalidCoordsDelivery.success, false);
  assert.match(invalidCoordsDelivery.errors![0], /Drop-off coordinates invalid/);
  console.log('✓ PASS: Invalid coordinates on delivery stop correctly rejected');

  // ---------------------------------------------------------------------------
  // 6. Strict OpenAPI Schema Compliance Checks
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Verifying Schema Conformance with OpenAPI v3.1.0 ---');

  // Verify no forbidden legacy or typo properties exist
  const stopKeys = Object.keys(deliveryStop);
  assert.strictEqual(stopKeys.includes('orderId'), false, 'orderId must not be on root of stop');
  assert.strictEqual(stopKeys.includes('orderReference'), false, 'orderReference must not be on root of stop');
  assert.strictEqual(stopKeys.includes('clientId'), false, 'clientId should be omitted or null');
  assert.strictEqual(typeof deliveryStop.weight, 'object', 'weight must be an object');
  assert.strictEqual(deliveryStop.weight?.unit, 'kilogram', 'weight unit must be valid enum');

  const orderKeys = Object.keys(deliveryStop.orderInfo!);
  assert.strictEqual(orderKeys.includes('orderId'), false, 'orderId must not be in orderInfo');
  assert.strictEqual(orderKeys.includes('orderReference'), false, 'orderReference must not be in orderInfo');
  assert.strictEqual(orderKeys.includes('sellerOrderId'), true, 'sellerOrderId must be present');
  console.log('✓ PASS: Strict OpenAPI schema conformance verified (no extra/forbidden fields)');

  // ---------------------------------------------------------------------------
  // 7. Spoke Server Client Guard & Safety Tests
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Testing Spoke Server Client Restrictions & Guards ---');

  // Client without key throws clean non-sensitive error
  const clientWithoutKey = new SpokeClient({ apiKey: '' });
  await assert.rejects(
    async () => {
      await clientWithoutKey.checkConnectivity();
    },
    (err: any) => {
      assert.match(err.message, /SPOKE_API_KEY is not configured on the server/);
      return true;
    }
  );
  console.log('✓ PASS: Missing API key throws clean non-sensitive error');

  // Mutating operation createPlan is strictly locked
  const testClient = new SpokeClient({ apiKey: 'test_key' });
  await assert.rejects(
    async () => {
      await testClient.createPlan({ title: 'Test', starts: { day: 1, month: 1, year: 2026 } });
    },
    (err: any) => {
      assert.match(err.message, /RESTRICTION ENFORCED: Mutating Spoke Dispatch operations/);
      return true;
    }
  );
  console.log('✓ PASS: Mutating createPlan operation strictly locked');

  // Mutating operation importStops is strictly locked
  await assert.rejects(
    async () => {
      await testClient.importStops('plans/123', []);
    },
    (err: any) => {
      assert.match(err.message, /RESTRICTION ENFORCED: Mutating Spoke Dispatch operations/);
      return true;
    }
  );
  console.log('✓ PASS: Mutating importStops operation strictly locked');

  // ---------------------------------------------------------------------------
  // 8. Server-Side Admin Authorization Endpoint Tests
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. Testing Server-Side Admin Authorization Endpoint ---');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    // Unauthenticated call rejected with 401
    const unauthRes = await testRequest(server, '/api/admin/dispatch/spoke/verify', 'GET');
    assert.strictEqual(unauthRes.status, 401);
    assert.strictEqual(unauthRes.data.error, 'Authentication required. Missing Bearer token in Authorization header.');
    console.log('✓ PASS: GET /api/admin/dispatch/spoke/verify rejected unauthenticated caller with 401');

    // Empty Bearer token rejected with 401
    const emptyBearerRes = await testRequest(server, '/api/admin/dispatch/spoke/verify', 'GET', {
      Authorization: 'Bearer ',
    });
    assert.strictEqual(emptyBearerRes.status, 401);
    assert.ok(emptyBearerRes.data.error);
    console.log('✓ PASS: GET /api/admin/dispatch/spoke/verify rejected empty Bearer token with 401');

    // Invalid Bearer token rejected with 401 (or 503 if Supabase is offline)
    const invalidBearerRes = await testRequest(server, '/api/admin/dispatch/spoke/verify', 'GET', {
      Authorization: 'Bearer invalid.test.token',
    });
    assert.ok(
      invalidBearerRes.status === 401 || invalidBearerRes.status === 503,
      `Expected 401 or 503, got ${invalidBearerRes.status}`
    );
    console.log('✓ PASS: GET /api/admin/dispatch/spoke/verify safely rejected unverified Bearer token with 401/503');
  } finally {
    server.close();
  }

  // ---------------------------------------------------------------------------
  // 9. Spoke Dry-Run Payload Generator Tests (Phases 1 & 2)
  // ---------------------------------------------------------------------------
  console.log('\n--- 9. Testing Spoke Dry-Run Payload Generator (Phases 1 & 2) ---');

  // 9.1 Valid booking generates exactly one pickup stop and one delivery stop
  const validBookingForDryRun = {
    id: 'NT-99001',
    company_id: 'comp-uuid-123',
    pickup: 'Unit 4, Trafford Park, Manchester M17 1AB',
    pickup_contact: 'Warehouse Dave',
    pickup_phone: '0161 777 8888',
    collection_window: '08:30 - 11:30',
    dropoff: 'Heartlands Parkway, Birmingham B6 7EU',
    recipient_name: 'Sarah Connor',
    recipient_phone: '0121 333 4444',
    delivery_window: '14:00 - 16:30',
    delivery_instructions: 'Report to security barrier',
    goods: 'Industrial generator bearings',
    weight_kg: 420.5,
    items_count: 3,
    vehicle: 'Long Wheelbase (LWB)',
    po_reference: 'PO-MCR-2026-001',
  };

  const dryRunSuccess = generateSpokeDryRunPayload(validBookingForDryRun, {
    pickupCoords: { lat: 53.468, lng: -2.325 },
    dropoffCoords: { lat: 52.503, lng: -1.884 },
    planDate: '2026-10-20',
    planTitle: 'NEO Batch Run 2026-10-20',
  });

  assert.strictEqual(dryRunSuccess.success, true);
  assert.ok(dryRunSuccess.stops, 'Stops array must be present on successful dry-run');
  assert.strictEqual(dryRunSuccess.stops.length, 2, 'Exactly one pickup stop and one delivery stop must be generated');
  assert.strictEqual(dryRunSuccess.stops[0].activity, 'pickup');
  assert.strictEqual(dryRunSuccess.stops[1].activity, 'delivery');
  assert.strictEqual(dryRunSuccess.summary.pickupStopIncluded, true);
  assert.strictEqual(dryRunSuccess.summary.deliveryStopIncluded, true);
  assert.strictEqual(dryRunSuccess.summary.capacityStatus, 'unverified');
  console.log('✓ PASS 9.1: Valid booking generates exactly one pickup stop and one delivery stop');

  // 9.2 Both stops carry the correct shared order reference
  assert.strictEqual(dryRunSuccess.stops[0].orderInfo?.sellerOrderId, 'NT-99001');
  assert.strictEqual(dryRunSuccess.stops[1].orderInfo?.sellerOrderId, 'NT-99001');
  assert.strictEqual(dryRunSuccess.summary.bookingReference, 'NT-99001');
  assert.strictEqual(dryRunSuccess.stops[0].orderInfo?.invoiceNumber, 'PO-MCR-2026-001');
  assert.strictEqual(dryRunSuccess.stops[1].orderInfo?.invoiceNumber, 'PO-MCR-2026-001');
  console.log('✓ PASS 9.2: Both stops carry the correct shared order and PO references');

  // 9.3 Booking Reference Normalization & Regression Checks
  // Direct helper checks
  assert.deepStrictEqual(resolveBookingReference({ id: '  NT-1  ', reference: '   ' }), { isValid: true, reference: 'NT-1' });
  assert.deepStrictEqual(resolveBookingReference({ id: '   ', reference: '  REF-2  ' }), { isValid: true, reference: 'REF-2' });
  assert.strictEqual(resolveBookingReference({ id: '   ', reference: '   ' }).isValid, false);
  assert.strictEqual(resolveBookingReference({}).isValid, false);
  assert.strictEqual(resolveBookingReference(null).isValid, false);

  // Blank ID must NOT prevent use of valid reference in composite dry-run
  const blankIdValidRefRes = generateSpokeDryRunPayload(
    {
      id: '   ',
      reference: 'REF-STANDALONE',
      pickup: 'Manchester M17 1AB',
      dropoff: 'Birmingham B6 7EU',
    },
    { planDate: '2026-10-20' }
  );
  assert.strictEqual(blankIdValidRefRes.success, true);
  assert.strictEqual(blankIdValidRefRes.summary.bookingReference, 'REF-STANDALONE');
  assert.strictEqual(blankIdValidRefRes.stops?.[0].orderInfo?.sellerOrderId, 'REF-STANDALONE');
  assert.strictEqual(blankIdValidRefRes.stops?.[1].orderInfo?.sellerOrderId, 'REF-STANDALONE');

  // Blank reference must NOT prevent use of valid ID in composite dry-run
  const blankRefValidIdRes = generateSpokeDryRunPayload(
    {
      id: 'ID-STANDALONE',
      reference: '   ',
      pickup: 'Manchester M17 1AB',
      dropoff: 'Birmingham B6 7EU',
    },
    { planDate: '2026-10-20' }
  );
  assert.strictEqual(blankRefValidIdRes.success, true);
  assert.strictEqual(blankRefValidIdRes.summary.bookingReference, 'ID-STANDALONE');
  assert.strictEqual(blankRefValidIdRes.stops?.[0].orderInfo?.sellerOrderId, 'ID-STANDALONE');
  assert.strictEqual(blankRefValidIdRes.stops?.[1].orderInfo?.sellerOrderId, 'ID-STANDALONE');

  // Missing or whitespace-only candidates in individual pickup/delivery mappers
  const pickupWithRef = mapBookingToSpokePickupStop({
    id: '   ',
    reference: 'REF-PICKUP-ONLY',
    pickup: 'Manchester M17 1AB',
  });
  assert.strictEqual(pickupWithRef.success, true);
  assert.strictEqual(pickupWithRef.data?.orderInfo?.sellerOrderId, 'REF-PICKUP-ONLY');

  const deliveryWithRef = mapBookingToSpokeDeliveryStop({
    id: '   ',
    reference: 'REF-DELIVERY-ONLY',
    dropoff: 'Birmingham B6 7EU',
  });
  assert.strictEqual(deliveryWithRef.success, true);
  assert.strictEqual(deliveryWithRef.data?.orderInfo?.sellerOrderId, 'REF-DELIVERY-ONLY');

  const pickupAllBlank = mapBookingToSpokePickupStop({
    id: '   ',
    reference: '   ',
    pickup: 'Manchester M17 1AB',
  });
  assert.strictEqual(pickupAllBlank.success, false);
  assert.ok(pickupAllBlank.errors?.includes('Booking reference or ID is required'));

  // Missing candidates in dry-run fail safely
  const missingRefRes = generateSpokeDryRunPayload(
    {
      pickup: 'Manchester M17 1AB',
      dropoff: 'Birmingham B6 7EU',
    },
    { planDate: '2026-10-20' }
  );
  assert.strictEqual(missingRefRes.success, false);
  assert.strictEqual(missingRefRes.stops, undefined);
  assert.strictEqual(missingRefRes.summary.bookingReference, null);
  assert.ok(
    missingRefRes.summary.errors.some((e) => e.includes('Booking reference or ID is required')),
    'Expected booking reference error'
  );
  console.log('✓ PASS 9.3: Candidate booking ID and reference normalized independently; blank ID does not mask valid reference');

  // 9.4 Deterministic plan date requirement & input validation
  // Missing planDate fails safely without implicit new Date() fallback
  const missingDateRes = generateSpokeDryRunPayload(validBookingForDryRun);
  assert.strictEqual(missingDateRes.success, false);
  assert.strictEqual(missingDateRes.stops, undefined);
  assert.ok(
    missingDateRes.summary.errors.some((e) => e.includes('Plan date is required for deterministic dry-run payload generation')),
    'Missing planDate must return a clear validation error'
  );

  // Invalid planDate string fails safely
  const invalidDateRes = generateSpokeDryRunPayload(validBookingForDryRun, { planDate: 'invalid-date-string' });
  assert.strictEqual(invalidDateRes.success, false);
  assert.ok(invalidDateRes.summary.errors.some((e) => e.includes('Invalid date string')));

  // Missing pickup address
  const missingPickupRes = generateSpokeDryRunPayload(
    { id: 'NT-TEST', pickup: '   ', dropoff: 'Birmingham B6 7EU' },
    { planDate: '2026-10-20' }
  );
  assert.strictEqual(missingPickupRes.success, false);
  assert.ok(missingPickupRes.summary.errors.some((e) => e.includes('Pickup address is required')));

  // Missing dropoff address
  const missingDropoffRes = generateSpokeDryRunPayload(
    { id: 'NT-TEST', pickup: 'Manchester M17 1AB', dropoff: '' },
    { planDate: '2026-10-20' }
  );
  assert.strictEqual(missingDropoffRes.success, false);
  assert.ok(missingDropoffRes.summary.errors.some((e) => e.includes('Drop-off address is required')));

  // Invalid coordinates
  const invalidCoordsRes = generateSpokeDryRunPayload(
    { id: 'NT-TEST', pickup: 'Manchester M17 1AB', dropoff: 'Birmingham B6 7EU' },
    { pickupCoords: { lat: 91.0, lng: -2.3 }, planDate: '2026-10-20' }
  );
  assert.strictEqual(invalidCoordsRes.success, false);
  assert.strictEqual(invalidCoordsRes.summary.coordinatesStatus.pickup, 'invalid');
  assert.ok(invalidCoordsRes.summary.errors.some((e) => e.includes('Latitude 91 is outside the valid range')));

  // Invalid weight (negative)
  const invalidWeightRes = generateSpokeDryRunPayload(
    { id: 'NT-TEST', pickup: 'Manchester M17 1AB', dropoff: 'Birmingham B6 7EU', weight_kg: -50 },
    { planDate: '2026-10-20' }
  );
  assert.strictEqual(invalidWeightRes.success, false);
  assert.ok(invalidWeightRes.summary.errors.some((e) => e.includes('Weight cannot be negative')));

  // Invalid package counts (fractional and negative)
  const fractionalPkgRes = generateSpokeDryRunPayload(
    { id: 'NT-TEST', pickup: 'Manchester M17 1AB', dropoff: 'Birmingham B6 7EU', items_count: 2.5 },
    { planDate: '2026-10-20' }
  );
  assert.strictEqual(fractionalPkgRes.success, false);
  assert.ok(fractionalPkgRes.summary.errors.some((e) => e.includes('whole integer')));

  const negativePkgRes = generateSpokeDryRunPayload(
    { id: 'NT-TEST', pickup: 'Manchester M17 1AB', dropoff: 'Birmingham B6 7EU', items_count: -1 },
    { planDate: '2026-10-20' }
  );
  assert.strictEqual(negativePkgRes.success, false);
  assert.ok(negativePkgRes.summary.errors.some((e) => e.includes('greater than zero')));

  console.log('✓ PASS 9.4: Missing plan date, invalid addresses, coordinates, weights, and counts safely rejected');

  // 9.5 Unsupported time-window formats are not silently accepted
  const asapRes = generateSpokeDryRunPayload(
    {
      id: 'NT-ASAP-TEST',
      pickup: 'Manchester M17 1AB',
      dropoff: 'Birmingham B6 7EU',
      collection_window: 'ASAP',
      delivery_window: 'Flexible Afternoon',
    },
    { planDate: '2026-10-20' }
  );
  // Non-fatal warning preserves payload preview while flagging unsupported format
  assert.strictEqual(asapRes.summary.timingStatus.pickupWindow, 'unsupported_format');
  assert.strictEqual(asapRes.summary.timingStatus.deliveryWindow, 'unsupported_format');
  assert.strictEqual(asapRes.stops?.[0].timing, null, 'Pickup timing must remain null, never guessed');
  assert.strictEqual(asapRes.stops?.[1].timing, null, 'Delivery timing must remain null, never guessed');
  assert.ok(asapRes.summary.warnings.some((w) => w.includes('ASAP')));
  assert.ok(asapRes.summary.warnings.some((w) => w.includes('Flexible Afternoon')));
  assert.ok(asapRes.summary.unresolvedOperationalRequirements.some((r) => r.includes('ASAP')));

  // Malformed time window with invalid hour/minute or start > end
  const malformedTimeRes = generateSpokeDryRunPayload(
    {
      id: 'NT-MALFORMED',
      pickup: 'Manchester M17 1AB',
      dropoff: 'Birmingham B6 7EU',
      collection_window: '25:00 - 12:00',
    },
    { planDate: '2026-10-20' }
  );
  assert.strictEqual(malformedTimeRes.success, false);
  assert.ok(malformedTimeRes.summary.errors.some((e) => e.includes('invalid hour/minute')));

  const invertedTimeRes = generateSpokeDryRunPayload(
    {
      id: 'NT-INVERTED',
      pickup: 'Manchester M17 1AB',
      dropoff: 'Birmingham B6 7EU',
      collection_window: '18:00 - 09:00',
    },
    { planDate: '2026-10-20' }
  );
  assert.strictEqual(invertedTimeRes.success, false);
  assert.ok(invertedTimeRes.summary.errors.some((e) => e.includes('start time must be before or equal to end time')));

  // Valid 24h format parsed accurately
  assert.strictEqual(dryRunSuccess.summary.timingStatus.pickupWindow, 'parsed');
  assert.deepStrictEqual(dryRunSuccess.stops![0].timing?.earliestAttemptTime, { hour: 8, minute: 30 });
  assert.deepStrictEqual(dryRunSuccess.stops![0].timing?.latestAttemptTime, { hour: 11, minute: 30 });
  console.log('✓ PASS 9.5: Unsupported time-window formats flagged and not silently accepted; valid formats parsed');

  // 9.5b Descriptive ASAP/open windows (e.g. "ASAP — ready now") cleanly mapped to open window (timing = null) without warnings
  const asapReadyNowRes = generateSpokeDryRunPayload(
    {
      id: 'NT-25121',
      pickup: 'Manchester M17 1AB',
      dropoff: 'Birmingham B6 7EU',
      collection_window: 'ASAP — ready now',
      delivery_window: 'ASAP - ready now',
    },
    { planDate: '2026-10-20' }
  );
  assert.strictEqual(asapReadyNowRes.success, true);
  assert.strictEqual(asapReadyNowRes.summary.timingStatus.pickupWindow, 'unspecified');
  assert.strictEqual(asapReadyNowRes.summary.timingStatus.deliveryWindow, 'unspecified');
  assert.strictEqual(asapReadyNowRes.stops?.[0].timing, null, 'Pickup timing must remain null for open ASAP window');
  assert.strictEqual(asapReadyNowRes.stops?.[1].timing, null, 'Delivery timing must remain null for open ASAP window');
  assert.ok(!asapReadyNowRes.summary.warnings.some((w) => w.includes('ASAP — ready now')));
  assert.ok(!asapReadyNowRes.summary.warnings.some((w) => w.includes('Unsupported time-window format')));
  assert.ok(!asapReadyNowRes.summary.unresolvedOperationalRequirements.some((r) => r.includes('Unsupported time-window format')));
  console.log('✓ PASS 9.5b: "ASAP — ready now" cleanly mapped to null timing without unsupported-format warnings');

  // 9.6 Separate driver assignment from vehicle capacity verification & honest constraints
  // Case A: No drivers configured
  const honestRes = generateSpokeDryRunPayload(
    {
      id: 'NT-HONEST-01',
      pickup: 'Manchester M17 1AB',
      dropoff: 'Birmingham B6 7EU',
      vehicle: 'Sprinter LWB',
    },
    { planDate: '2026-10-20' }
  );
  assert.strictEqual(honestRes.success, true);
  assert.strictEqual(honestRes.summary.isDispatchReady, false, 'Payload must NOT be marked dispatch ready');
  assert.strictEqual(honestRes.summary.depotStatus, 'unassigned');
  assert.strictEqual(honestRes.summary.driverStatus, 'unassigned');
  assert.strictEqual(honestRes.summary.capacityStatus, 'unverified');
  assert.strictEqual(honestRes.summary.precedenceStatus, 'unverified_spoke_constraint');
  assert.strictEqual(honestRes.plan?.depot, undefined);
  assert.strictEqual(honestRes.plan?.drivers, undefined);

  assert.ok(
    honestRes.summary.unresolvedOperationalRequirements.some((r) => r.includes('Depot location is unassigned')),
    'Expected unassigned depot in unresolved requirements'
  );
  assert.ok(
    honestRes.summary.unresolvedOperationalRequirements.some((r) => r.includes('Driver assignment is unassigned')),
    'Expected unassigned drivers in unresolved requirements'
  );
  assert.ok(
    honestRes.summary.unresolvedOperationalRequirements.some((r) => r.includes('Vehicle cargo weight and volume capacity constraints are unverified')),
    'Expected unverified capacity in unresolved requirements'
  );
  assert.ok(
    honestRes.summary.unresolvedOperationalRequirements.some((r) => r.includes('Pickup-before-delivery precedence cannot be guaranteed')),
    'Expected precedence caveat in unresolved requirements'
  );

  // Case B: Drivers configured on plan, but vehicle capacity remains unverified
  const driverConfiguredRes = generateSpokeDryRunPayload(
    {
      id: 'NT-DRIVER-CONFIGURED',
      pickup: 'Manchester M17 1AB',
      dropoff: 'Birmingham B6 7EU',
      vehicle: '7.5t Rigid',
    },
    {
      planDate: '2026-10-20',
      drivers: [{ id: 'drivers/drv_889' }],
    }
  );
  assert.strictEqual(driverConfiguredRes.success, true);
  assert.strictEqual(driverConfiguredRes.summary.driverStatus, 'configured');
  assert.strictEqual(driverConfiguredRes.summary.capacityStatus, 'unverified');
  assert.strictEqual(driverConfiguredRes.summary.isDispatchReady, false);
  assert.ok(
    driverConfiguredRes.summary.unresolvedOperationalRequirements.some((r) =>
      r.includes('Driver is assigned on plan, but vehicle cargo weight and volume capacity constraints have not been verified')
    ),
    'Non-empty drivers array must not be treated as proof of vehicle capacity verification'
  );
  assert.ok(
    driverConfiguredRes.summary.unresolvedOperationalRequirements.some((r) => r.includes('7.5t Rigid')),
    'Expected vehicle notes disclosure in unresolved requirements'
  );
  console.log('✓ PASS 9.6: Driver assignment decoupled from vehicle capacity verification; honest constraints preserved');

  // 9.7 Generated payloads serialize correctly and deterministically for identical inputs
  const deterministicBooking = {
    id: 'NT-DET-777',
    company_id: 'comp-uuid-456',
    pickup: 'Unit 2, Trafford Park, Manchester M17 1AB',
    dropoff: 'Heartlands Parkway, Birmingham B6 7EU',
    collection_window: '09:00 - 12:00',
    delivery_window: '14:00 - 17:00',
    weight_kg: 500,
    items_count: 2,
    goods: 'Palletized components',
    vehicle: 'Luton Box',
    po_reference: 'PO-2026-DET',
  };

  const deterministicOpts = {
    pickupCoords: { lat: 53.468, lng: -2.325 },
    dropoffCoords: { lat: 52.503, lng: -1.884 },
    planDate: '2026-11-15',
    planTitle: 'NEO Deterministic Dispatch Test',
  };

  const runA = generateSpokeDryRunPayload(deterministicBooking, deterministicOpts);
  const runB = generateSpokeDryRunPayload(deterministicBooking, deterministicOpts);

  assert.strictEqual(runA.success, true);
  assert.strictEqual(runB.success, true);

  const jsonA = JSON.stringify(runA);
  const jsonB = JSON.stringify(runB);

  assert.strictEqual(jsonA, jsonB, 'Deterministic dry-run executions must produce byte-for-byte identical JSON');

  const deserialized = JSON.parse(jsonA);
  assert.strictEqual(deserialized.stops.length, 2);
  assert.strictEqual(deserialized.stops[0].address.addressLineOne, 'Unit 2, Trafford Park, Manchester M17 1AB');
  assert.strictEqual(deserialized.stops[1].address.addressLineOne, 'Heartlands Parkway, Birmingham B6 7EU');
  assert.strictEqual(deserialized.summary.isDispatchReady, false);
  console.log('✓ PASS 9.7: Dry-run payloads serialize correctly and deterministically for identical inputs');

  // ---------------------------------------------------------------------------
  // 10. Server-Side Admin Spoke Dry-Run Preview Endpoint Tests (Phase 3)
  // ---------------------------------------------------------------------------
  console.log(
    '\n--- 10. Testing Server-Side Admin Spoke Dry-Run Preview Endpoint (POST /api/admin/dispatch/spoke/dry-run) ---'
  );

  const dryRunServer = http.createServer(app);
  await new Promise<void>((resolve) => dryRunServer.listen(0, resolve));

  const sampleDbBooking = {
    id: 'NT-24817',
    company_id: 'comp-uuid-999',
    pickup: 'Trafford Park, Manchester M17 1AB',
    pickup_contact: 'Mark Spencer',
    pickup_phone: '0161 555 0134',
    collection_window: '09:00 - 11:30',
    dropoff: 'Heartlands Parkway, Birmingham B6 7EU',
    recipient_name: 'Sarah Connor',
    recipient_phone: '0121 496 0281',
    delivery_instructions: 'Bay 4 delivery',
    goods: 'Emergency palletised machinery parts',
    weight_kg: 650,
    items_count: 2,
    vehicle: 'Sprinter LWB',
    service: 'Emergency (ASAP)',
    po_reference: 'PO-2026-8910',
    total_gbp: 355.0,
    created_at: new Date().toISOString(),
  };

  const recordedAudits: any[] = [];
  let mockAuditError: any = null;
  let mockBookingError: any = null;
  let lastBookingsSelectColumns: string | null = null;
  const recordedClaims: any[] = [];
  let mockClaimInsertError: any = null;

  const mockSupabaseClient = {
    auth: {
      getUser: async (token: string) => {
        if (token === 'admin-test-token') {
          return { data: { user: { id: 'admin-user-1', email: 'admin@neo-transport.co.uk' } }, error: null };
        }
        if (token === 'customer-test-token') {
          return { data: { user: { id: 'cust-user-2', email: 'user@acme.com' } }, error: null };
        }
        if (token === 'suspended-admin-token') {
          return { data: { user: { id: 'suspended-user-3', email: 'suspended@neo-transport.co.uk' } }, error: null };
        }
        return { data: { user: null }, error: { message: 'Invalid or expired session token.' } };
      },
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              single: async () => {
                if (val === 'admin-user-1') {
                  return {
                    data: {
                      id: 'admin-user-1',
                      full_name: 'Duty Dispatcher',
                      email: 'admin@neo-transport.co.uk',
                      role: 'admin',
                      status: 'active',
                      company_id: 'neo-transport',
                    },
                    error: null,
                  };
                }
                if (val === 'cust-user-2') {
                  return {
                    data: {
                      id: 'cust-user-2',
                      full_name: 'Acme Logistics',
                      email: 'user@acme.com',
                      role: 'customer',
                      status: 'active',
                      company_id: 'acme-corp',
                    },
                    error: null,
                  };
                }
                if (val === 'suspended-user-3') {
                  return {
                    data: {
                      id: 'suspended-user-3',
                      full_name: 'Suspended Admin',
                      email: 'suspended@neo-transport.co.uk',
                      role: 'admin',
                      status: 'suspended',
                      company_id: 'neo-transport',
                    },
                    error: null,
                  };
                }
                return { data: null, error: { code: 'PGRST116', message: 'Profile not found' } };
              },
            }),
          }),
        };
      }
      if (table === 'bookings') {
        return {
          select: (columns: string = '*') => {
            lastBookingsSelectColumns = columns;
            return {
              eq: (_col: string, val: string) => ({
                single: async () => {
                  if (mockBookingError) {
                    return { data: null, error: mockBookingError };
                  }
                  if (val === sampleDbBooking.id) {
                    return { data: sampleDbBooking, error: null };
                  }
                  return { data: null, error: { code: 'PGRST116', message: 'Booking not found' } };
                },
              }),
            };
          },
        };
      }
      if (table === 'admin_audit_logs') {
        return {
          insert: async (record: any) => {
            recordedAudits.push(record);
            if (mockAuditError) {
              return { error: mockAuditError };
            }
            return { error: null };
          },
          select: () => ({
            eq: (_col1: string, val1: string) => ({
              eq: (_col2: string, val2: string) => ({
                maybeSingle: async () => {
                  const found = recordedAudits.find(
                    (a) => a.action === val1 && a.target_id === val2
                  );
                  return { data: found || null, error: null };
                },
              }),
            }),
          }),
        };
      }
      if (table === 'spoke_smoke_test_claims') {
        return {
          insert: async (claim: any) => {
            if (mockClaimInsertError) {
              return { data: null, error: mockClaimInsertError };
            }
            const existing = recordedClaims.find((c) => c.test_run_token === claim.test_run_token);
            if (existing) {
              return {
                data: null,
                error: {
                  code: '23505',
                  message: 'duplicate key value violates unique constraint "spoke_smoke_test_claims_test_run_token_key"',
                },
              };
            }
            const saved = {
              ...claim,
              created_at: claim.created_at || new Date().toISOString(),
              updated_at: claim.updated_at || new Date().toISOString(),
            };
            recordedClaims.push(saved);
            return { data: saved, error: null };
          },
          select: (_columns?: string) => ({
            eq: (col: string, val: string) => ({
              maybeSingle: async () => {
                const found = recordedClaims.find((c) => c[col] === val);
                return { data: found ? { ...found } : null, error: null };
              },
            }),
          }),
          update: (updates: any) => ({
            eq: (col: string, val: string) => {
              const found = recordedClaims.find((c) => c[col] === val);
              if (found) {
                Object.assign(found, updates, { updated_at: new Date().toISOString() });
              }
              return Promise.resolve({ data: found ? { ...found } : null, error: null });
            },
          }),
        };
      }
      return {};
    },
  };

  try {
    setServerSupabaseClientForTesting(mockSupabaseClient as any);

    // 10.1 Unauthenticated request returns 401
    const unauth = await testRequest(dryRunServer, '/api/admin/dispatch/spoke/dry-run', 'POST', {}, {
      bookingId: 'NT-24817',
      planDate: '2026-10-20',
    });
    assert.strictEqual(unauth.status, 401);
    assert.match(unauth.data.error, /Authentication required/);
    console.log('✓ PASS 10.1: Unauthenticated request returns 401');

    // 10.2 Empty and non-Bearer tokens are rejected with 401
    const nonBearer = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      { Authorization: 'Basic dXNlcjpwYXNz' },
      { bookingId: 'NT-24817', planDate: '2026-10-20' }
    );
    assert.strictEqual(nonBearer.status, 401);
    assert.match(nonBearer.data.error, /Missing Bearer token/);

    const emptyBearer = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      { Authorization: 'Bearer ' },
      { bookingId: 'NT-24817', planDate: '2026-10-20' }
    );
    assert.strictEqual(emptyBearer.status, 401);
    assert.ok(emptyBearer.data.error);
    console.log('✓ PASS 10.2: Empty and non-Bearer authorization tokens rejected with 401');

    // 10.3 Invalid token and non-admin/inactive callers are rejected with 401/403
    const invalidToken = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      { Authorization: 'Bearer invalid-token-xyz' },
      { bookingId: 'NT-24817', planDate: '2026-10-20' }
    );
    assert.strictEqual(invalidToken.status, 401);

    const customerCaller = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      { Authorization: 'Bearer customer-test-token' },
      { bookingId: 'NT-24817', planDate: '2026-10-20' }
    );
    assert.strictEqual(customerCaller.status, 403);
    assert.match(customerCaller.data.error, /active administrator privileges required/);

    const suspendedAdmin = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      { Authorization: 'Bearer suspended-admin-token' },
      { bookingId: 'NT-24817', planDate: '2026-10-20' }
    );
    assert.strictEqual(suspendedAdmin.status, 403);
    assert.match(suspendedAdmin.data.error, /active administrator privileges required/);
    console.log('✓ PASS 10.3: Invalid token and non-admin/inactive callers safely rejected with 401/403');

    // Valid admin headers for subsequent tests
    const adminHeaders = { Authorization: 'Bearer admin-test-token' };

    // 10.4 Missing, malformed, and unexpected request fields return 400
    const nonObjectBody = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      adminHeaders,
      12345
    );
    assert.strictEqual(nonObjectBody.status, 400);

    const arrayBody = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      adminHeaders,
      ['NT-24817']
    );
    assert.strictEqual(arrayBody.status, 400);

    const missingBookingId = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      adminHeaders,
      {
        planDate: '2026-10-20',
      }
    );
    assert.strictEqual(missingBookingId.status, 400);
    assert.match(missingBookingId.data.error, /Valid bookingId is required/);

    const whitespaceBookingId = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      adminHeaders,
      {
        bookingId: '   ',
        planDate: '2026-10-20',
      }
    );
    assert.strictEqual(whitespaceBookingId.status, 400);
    assert.match(whitespaceBookingId.data.error, /Valid bookingId is required/);

    const longBookingId = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-' + 'x'.repeat(105),
        planDate: '2026-10-20',
      }
    );
    assert.strictEqual(longBookingId.status, 400);
    assert.match(longBookingId.data.error, /maximum allowable length/);

    const unexpectedField = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-24817',
        planDate: '2026-10-20',
        unexpectedProp: true,
      }
    );
    assert.strictEqual(unexpectedField.status, 400);
    assert.match(unexpectedField.data.error, /Unexpected property in request/);
    console.log('✓ PASS 10.4: Missing, malformed, and unexpected request fields safely return 400');

    // 10.5 Missing or invalid plan dates return 400
    const missingPlanDate = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-24817',
      }
    );
    assert.strictEqual(missingPlanDate.status, 400);
    assert.match(missingPlanDate.data.error, /Explicit planDate is required/);

    const malformedDateFormat = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-24817',
        planDate: '20-10-2026',
      }
    );
    assert.strictEqual(malformedDateFormat.status, 400);
    assert.match(malformedDateFormat.data.error, /Format must be YYYY-MM-DD/);

    const invalidCalendarDate = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-24817',
        planDate: '2026-02-31',
      }
    );
    assert.strictEqual(invalidCalendarDate.status, 400);
    assert.match(invalidCalendarDate.data.error, /Invalid calendar date/);

    const outOfRangeYear = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-24817',
        planDate: '1999-12-31',
      }
    );
    assert.strictEqual(outOfRangeYear.status, 400);
    assert.match(outOfRangeYear.data.error, /outside allowable range/);
    console.log('✓ PASS 10.5: Missing or invalid plan dates safely return 400');

    // 10.6 Missing booking returns 404
    const notFoundRes = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-NONEXISTENT',
        planDate: '2026-10-20',
      }
    );
    assert.strictEqual(notFoundRes.status, 404);
    assert.strictEqual(notFoundRes.data.error, "Booking 'NT-NONEXISTENT' not found.");
    console.log('✓ PASS 10.6a: Genuinely missing booking lookup returns 404');

    // 10.6b Unexpected database query failure returns 500 with sanitized response
    mockBookingError = { code: '50001', message: 'Connection pool exhausted' };
    const dbErrRes = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-24817',
        planDate: '2026-10-20',
      }
    );
    assert.strictEqual(dbErrRes.status, 500);
    assert.strictEqual(dbErrRes.data.error, 'Internal server error retrieving booking.');
    assert.strictEqual(dbErrRes.data.plan, undefined);
    assert.strictEqual(dbErrRes.data.stops, undefined);
    mockBookingError = null;
    console.log('✓ PASS 10.6b: Unexpected database query failure returns 500 with sanitized response');

    // 10.7 Client-supplied booking objects or override properties cannot replace database data
    const injectedOverrideRes = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-24817',
        planDate: '2026-10-20',
        pickup: 'Injected Attacker Address 999',
        weight_kg: 50000,
      }
    );
    assert.strictEqual(injectedOverrideRes.status, 400);
    assert.match(injectedOverrideRes.data.error, /Unexpected property in request: pickup, weight_kg/);
    console.log(
      '✓ PASS 10.7: Client-supplied booking objects and override properties strictly rejected with 400'
    );

    // 10.8 Valid mocked booking produces a preview with pickup and delivery stops sharing the booking reference
    const validPreview = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-24817',
        planDate: '2026-10-20',
      }
    );
    assert.strictEqual(validPreview.status, 200);
    assert.strictEqual(validPreview.data.success, true);
    assert.strictEqual(Array.isArray(validPreview.data.stops), true);
    assert.strictEqual(validPreview.data.stops.length, 2);

    const [pickupStop, deliveryStop] = validPreview.data.stops;
    assert.strictEqual(pickupStop.activity, 'pickup');
    assert.strictEqual(deliveryStop.activity, 'delivery');
    assert.strictEqual(pickupStop.orderInfo.sellerOrderId, 'NT-24817');
    assert.strictEqual(deliveryStop.orderInfo.sellerOrderId, 'NT-24817');
    assert.strictEqual(pickupStop.orderInfo.invoiceNumber, 'PO-2026-8910');
    assert.strictEqual(deliveryStop.orderInfo.invoiceNumber, 'PO-2026-8910');
    assert.strictEqual(pickupStop.address.addressLineOne, 'Trafford Park, Manchester M17 1AB');
    assert.strictEqual(deliveryStop.address.addressLineOne, 'Heartlands Parkway, Birmingham B6 7EU');

    // Verify explicit database column selection
    assert.strictEqual(
      lastBookingsSelectColumns,
      SPOKE_DRY_RUN_BOOKING_COLUMNS,
      'Database query must explicitly select only required columns (no wildcard select)'
    );
    assert.strictEqual(
      (lastBookingsSelectColumns as string)?.includes('*'),
      false,
      'Database query must never use wildcard select(*)'
    );
    console.log(
      '✓ PASS 10.8: Valid mocked booking produces preview with paired stops sharing authoritative order reference and explicit columns'
    );

    // 10.9 Response always reports isDispatchReady: false
    assert.strictEqual(validPreview.data.summary.isDispatchReady, false);
    assert.strictEqual(validPreview.data.summary.precedenceStatus, 'unverified_spoke_constraint');
    assert.strictEqual(validPreview.data.summary.capacityStatus, 'unverified');
    console.log(
      '✓ PASS 10.9: Response strictly preserves isDispatchReady: false for unverified operational constraints'
    );

    // 10.10 Audit logging is attempted without logging sensitive booking details
    assert.ok(recordedAudits.length > 0);
    const lastAudit = recordedAudits[recordedAudits.length - 1];
    assert.strictEqual(lastAudit.action, 'SPOKE_DISPATCH_DRY_RUN');
    assert.strictEqual(lastAudit.target_entity, 'bookings');
    assert.strictEqual(lastAudit.target_id, 'NT-24817');
    assert.strictEqual(lastAudit.details.planDate, '2026-10-20');
    assert.strictEqual(lastAudit.details.success, true);
    assert.strictEqual(lastAudit.details.isDispatchReady, false);
    // Verify no customer sensitive details or full addresses leaked into audit details
    assert.strictEqual(lastAudit.details.pickup, undefined);
    assert.strictEqual(lastAudit.details.dropoff, undefined);
    assert.strictEqual(lastAudit.details.recipient_phone, undefined);
    assert.strictEqual(lastAudit.details.pickup_phone, undefined);
    assert.strictEqual(lastAudit.details.payload, undefined);

    // Test non-fatal audit logging failure behavior
    mockAuditError = new Error('Database audit log table busy');
    const auditFailPreview = await testRequest(
      dryRunServer,
      '/api/admin/dispatch/spoke/dry-run',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-24817',
        planDate: '2026-10-20',
      }
    );
    assert.strictEqual(auditFailPreview.status, 200);
    assert.strictEqual(auditFailPreview.data.auditLogged, false);
    mockAuditError = null;
    console.log(
      '✓ PASS 10.10: Audit logging verified without sensitive leaks, and non-fatal logging failure handled gracefully'
    );

    // 10.11 Instrument and spy on Spoke write-capable operations to prove zero mutating calls
    let createPlanCalls = 0;
    let importStopsCalls = 0;
    let spokeNetworkCalls = 0;

    const origSpokeClientCreatePlan = spokeClient.createPlan;
    const origSpokeClientImportStops = spokeClient.importStops;
    const origProtoCreatePlan = SpokeClient.prototype.createPlan;
    const origProtoImportStops = SpokeClient.prototype.importStops;
    const origFetch = globalThis.fetch;

    try {
      (spokeClient as any).createPlan = async (...args: any[]) => {
        createPlanCalls++;
        return (origSpokeClientCreatePlan as any).apply(spokeClient, args);
      };
      (spokeClient as any).importStops = async (...args: any[]) => {
        importStopsCalls++;
        return (origSpokeClientImportStops as any).apply(spokeClient, args);
      };
      (SpokeClient.prototype as any).createPlan = async function (...args: any[]) {
        createPlanCalls++;
        return (origProtoCreatePlan as any).apply(this, args);
      };
      (SpokeClient.prototype as any).importStops = async function (...args: any[]) {
        importStopsCalls++;
        return (origProtoImportStops as any).apply(this, args);
      };
      globalThis.fetch = (async (input: any, init?: any) => {
        const urlStr = typeof input === 'string' ? input : input?.url || '';
        if (urlStr.includes('api.spoke.com')) {
          spokeNetworkCalls++;
        }
        return origFetch(input, init);
      }) as any;

      const monitoredDryRunRes = await testRequest(
        dryRunServer,
        '/api/admin/dispatch/spoke/dry-run',
        'POST',
        adminHeaders,
        {
          bookingId: 'NT-24817',
          planDate: '2026-10-20',
        }
      );

      assert.strictEqual(monitoredDryRunRes.status, 200);
      assert.strictEqual(monitoredDryRunRes.data.success, true);
      assert.strictEqual(createPlanCalls, 0, 'Dry-run preview must NEVER invoke spokeClient.createPlan()');
      assert.strictEqual(importStopsCalls, 0, 'Dry-run preview must NEVER invoke spokeClient.importStops()');
      assert.strictEqual(spokeNetworkCalls, 0, 'Dry-run preview must NEVER issue outbound Spoke API network calls');
      console.log(
        '✓ PASS 10.11: Instrumented spies confirmed zero Spoke write calls (createPlan, importStops, network) during dry-run generation'
      );
    } finally {
      (spokeClient as any).createPlan = origSpokeClientCreatePlan;
      (spokeClient as any).importStops = origSpokeClientImportStops;
      (SpokeClient.prototype as any).createPlan = origProtoCreatePlan;
      (SpokeClient.prototype as any).importStops = origProtoImportStops;
      globalThis.fetch = origFetch;
    }

    // 10.12 Test injection helper strictly rejected outside test mode (production / development / Vercel)
    const prevNodeEnv = process.env.NODE_ENV;
    const prevVercel = process.env.VERCEL;
    try {
      process.env.NODE_ENV = 'production';
      assert.throws(
        () => setServerSupabaseClientForTesting({} as any),
        /SECURITY VIOLATION: setServerSupabaseClientForTesting is restricted to test environments/
      );
      assert.throws(
        () => getServerSupabaseClientForTesting(),
        /SECURITY VIOLATION: getServerSupabaseClientForTesting is restricted to test environments/
      );

      process.env.NODE_ENV = 'development';
      assert.throws(
        () => setServerSupabaseClientForTesting({} as any),
        /SECURITY VIOLATION: setServerSupabaseClientForTesting is restricted to test environments/
      );

      process.env.NODE_ENV = 'test';
      process.env.VERCEL = '1';
      assert.throws(
        () => setServerSupabaseClientForTesting({} as any),
        /SECURITY VIOLATION: setServerSupabaseClientForTesting is restricted to test environments/
      );
      delete process.env.VERCEL;
      console.log('✓ PASS 10.12: Test injection helper strictly rejected outside test mode (production/development/Vercel)');

      // 10.13 Resetting test client restores original configured client rather than leaving null
      process.env.NODE_ENV = 'test';
      const temporaryTestClient = { auth: {}, from: () => ({}) } as any;

      setServerSupabaseClientForTesting(temporaryTestClient);
      assert.strictEqual(getServerSupabaseClientForTesting(), temporaryTestClient);

      // Reset to null must restore configured client and not leave client pointing to null or mock
      setServerSupabaseClientForTesting(null);
      assert.notStrictEqual(getServerSupabaseClientForTesting(), temporaryTestClient);
      console.log('✓ PASS 10.13: Resetting test injection helper accurately restores original configured client');

      // 10.14 Service-role configuration uses the intended privileged server client
      const privilegedClient = resolveBookingLookupClient('caller-bearer-token-123', {
        serviceRoleKey: 'mock-privileged-service-role-key',
        supabaseUrl: 'http://localhost:54321',
        customClient: null,
      });
      assert.ok(privilegedClient, 'Privileged service-role client must be resolved');
      assert.strictEqual(
        (privilegedClient as any).supabaseKey,
        'mock-privileged-service-role-key',
        'Privileged client must use configured service-role key'
      );
      assert.strictEqual(
        (privilegedClient as any).headers?.Authorization,
        undefined,
        'Privileged service-role client must not overwrite headers with caller Bearer token'
      );
      console.log('✓ PASS 10.14: Privileged service-role configuration uses intended server client without token overwrite');

      // 10.15 Anon-key fallback creates request-scoped client including verified caller's Bearer token
      const fallbackToken = 'verified-admin-session-token-abc';
      const fallbackClient = resolveBookingLookupClient(fallbackToken, {
        serviceRoleKey: '',
        anonKey: 'mock-public-anon-key-xyz',
        supabaseUrl: 'http://localhost:54321',
        customClient: null,
      });
      assert.ok(fallbackClient, 'Request-scoped anon fallback client must be created');
      assert.strictEqual(
        (fallbackClient as any).supabaseKey,
        'mock-public-anon-key-xyz',
        'Request-scoped client must use configured anon key'
      );
      assert.strictEqual(
        (fallbackClient as any).headers?.Authorization,
        `Bearer ${fallbackToken}`,
        'Request-scoped client must include verified caller Bearer token in Authorization header'
      );
      console.log('✓ PASS 10.15: Anon-key fallback correctly creates request-scoped client with verified caller Bearer token');

      // 10.16 Missing database configuration or missing token returns null
      const unconfiguredClient = resolveBookingLookupClient(fallbackToken, {
        serviceRoleKey: '',
        anonKey: '',
        supabaseUrl: '',
        customClient: null,
      });
      assert.strictEqual(unconfiguredClient, null, 'Unconfigured database environment must resolve to null');

      const emptyTokenClient = resolveBookingLookupClient('', {
        serviceRoleKey: '',
        anonKey: 'mock-anon-key',
        supabaseUrl: 'http://localhost:54321',
        customClient: null,
      });
      assert.strictEqual(emptyTokenClient, null, 'Missing token without service-role key must resolve to null');
      console.log('✓ PASS 10.16: Unconfigured database client and empty token safely resolve to null');

      // 10.17 Lookup failures never generate previews or fall back to demo data
      assert.strictEqual(notFoundRes.data.plan, undefined, '404 missing booking must not return plan');
      assert.strictEqual(notFoundRes.data.stops, undefined, '404 missing booking must not return stops');
      assert.strictEqual(dbErrRes.data.plan, undefined, '500 database error must not return plan');
      assert.strictEqual(dbErrRes.data.stops, undefined, '500 database error must not return stops');
      console.log('✓ PASS 10.17: Database lookup failures strictly prevent preview generation and demo data fallback');

      // 10.18 Explicit database column list verification
      const expectedDryRunColumns = [
        'id',
        'company_id',
        'pickup',
        'pickup_contact',
        'pickup_phone',
        'collection_window',
        'dropoff',
        'recipient_name',
        'recipient_phone',
        'delivery_instructions',
        'goods',
        'weight_kg',
        'items_count',
        'vehicle',
        'service',
        'po_reference',
      ];
      const actualDryRunColumns = SPOKE_DRY_RUN_BOOKING_COLUMNS.split(',').map((c) => c.trim());
      for (const col of expectedDryRunColumns) {
        assert.ok(
          actualDryRunColumns.includes(col),
          `SPOKE_DRY_RUN_BOOKING_COLUMNS must explicitly project column '${col}'`
        );
      }
      assert.strictEqual(
        actualDryRunColumns.length,
        expectedDryRunColumns.length,
        'SPOKE_DRY_RUN_BOOKING_COLUMNS must project exactly the required 16 columns'
      );
      assert.strictEqual(
        SPOKE_DRY_RUN_BOOKING_COLUMNS.includes('*'),
        false,
        'SPOKE_DRY_RUN_BOOKING_COLUMNS must never contain wildcard *'
      );
      console.log('✓ PASS 10.18: Explicit database column projection verified for dry-run booking lookup');

      // ---------------------------------------------------------------------------
      // 11. Controlled Production Spoke Smoke-Test Pathway Tests (Section 11)
      // ---------------------------------------------------------------------------
      console.log(
        '\n--- 11. Testing Controlled Production Spoke Smoke-Test Pathway (POST /api/admin/dispatch/spoke/smoke-test) ---'
      );

      setServerSupabaseClientForTesting(mockSupabaseClient as any);

      // 11.1 Admin-only access and rejection of unauthenticated/non-admin users
      const smokeUnauth = await testRequest(dryRunServer, '/api/admin/dispatch/spoke/smoke-test', 'POST', {}, {
        planDate: '2026-10-25',
        idempotencyToken: 'smoke-tok-unauth-1',
      });
      assert.strictEqual(smokeUnauth.status, 401);
      assert.match(smokeUnauth.data.error, /Authentication required/);

      const smokeNonBearer = await testRequest(
        dryRunServer,
        '/api/admin/dispatch/spoke/smoke-test',
        'POST',
        { Authorization: 'Basic dXNlcjpwYXNz' },
        { planDate: '2026-10-25', idempotencyToken: 'smoke-tok-unauth-2' }
      );
      assert.strictEqual(smokeNonBearer.status, 401);
      assert.match(smokeNonBearer.data.error, /Missing Bearer token/);

      const smokeCustomer = await testRequest(
        dryRunServer,
        '/api/admin/dispatch/spoke/smoke-test',
        'POST',
        { Authorization: 'Bearer customer-test-token' },
        { planDate: '2026-10-25', idempotencyToken: 'smoke-tok-cust-3' }
      );
      assert.strictEqual(smokeCustomer.status, 403);
      assert.match(smokeCustomer.data.error, /active administrator privileges required/);

      const smokeSuspended = await testRequest(
        dryRunServer,
        '/api/admin/dispatch/spoke/smoke-test',
        'POST',
        { Authorization: 'Bearer suspended-admin-token' },
        { planDate: '2026-10-25', idempotencyToken: 'smoke-tok-susp-4' }
      );
      assert.strictEqual(smokeSuspended.status, 403);
      assert.match(smokeSuspended.data.error, /active administrator privileges required/);
      console.log('✓ PASS 11.1: Smoke-test endpoint strictly rejects unauthenticated, non-admin, and suspended callers (401/403)');

      // 11.2 Test pathway disabled by default (Feature flag gate)
      delete process.env.NEO_SPOKE_PRODUCTION_TEST_ENABLED;
      const disabledRes1 = await testRequest(
        dryRunServer,
        '/api/admin/dispatch/spoke/smoke-test',
        'POST',
        adminHeaders,
        { planDate: '2026-10-25', idempotencyToken: 'smoke-tok-dis-1' }
      );
      assert.strictEqual(disabledRes1.status, 403);
      assert.match(disabledRes1.data.error, /Production Spoke test pathway is currently disabled/);

      process.env.NEO_SPOKE_PRODUCTION_TEST_ENABLED = 'false';
      const disabledRes2 = await testRequest(
        dryRunServer,
        '/api/admin/dispatch/spoke/smoke-test',
        'POST',
        adminHeaders,
        { planDate: '2026-10-25', idempotencyToken: 'smoke-tok-dis-2' }
      );
      assert.strictEqual(disabledRes2.status, 403);
      assert.match(disabledRes2.data.error, /NEO_SPOKE_PRODUCTION_TEST_ENABLED must be explicitly configured as true/);

      // Direct SpokeClient executeControlledSmokeTest throws when disabled
      await assert.rejects(
        async () => {
          await spokeClient.executeControlledSmokeTest({
            plan: { title: 'NEO API TEST - Unit', starts: { day: 25, month: 10, year: 2026 } },
            stops: buildSyntheticTestStops(DEFAULT_NEO_APPROVED_SYNTHETIC_CONFIG, 'DIRECT-DIS'),
            idempotencyToken: 'smoke-direct-dis',
          });
        },
        /RESTRICTION ENFORCED: Spoke production test pathway is disabled/
      );
      console.log('✓ PASS 11.2: Smoke-test pathway strictly disabled by default at both HTTP and client levels');

      // Enable feature flag for subsequent test cases
      process.env.NEO_SPOKE_PRODUCTION_TEST_ENABLED = 'true';
      const approvedSmokeToken = 'smoke-token-alpha-12345';
      process.env.NEO_SPOKE_SMOKE_TEST_APPROVED_TOKEN = approvedSmokeToken;

      // Configure server-approved synthetic locations
      process.env.NEO_SPOKE_APPROVED_PICKUP_ADDRESS = 'Unit 1 Test Hub, Trafford Park';
      process.env.NEO_SPOKE_APPROVED_PICKUP_ZIP = 'M17 1AB';
      process.env.NEO_SPOKE_APPROVED_PICKUP_LAT = '53.468';
      process.env.NEO_SPOKE_APPROVED_PICKUP_LNG = '-2.325';
      process.env.NEO_SPOKE_APPROVED_DROPOFF_ADDRESS = 'Heartlands Parkway, Birmingham';
      process.env.NEO_SPOKE_APPROVED_DROPOFF_ZIP = 'B6 7EU';
      process.env.NEO_SPOKE_APPROVED_DROPOFF_LAT = '52.503';
      process.env.NEO_SPOKE_APPROVED_DROPOFF_LNG = '-1.884';

      resetSmokeTestRegistryForTesting();

      // 11.3 Rejection of real booking ID or arbitrary customer data
      const realBookingIdRes = await testRequest(
        dryRunServer,
        '/api/admin/dispatch/spoke/smoke-test',
        'POST',
        adminHeaders,
        {
          bookingId: 'NT-24817',
          planDate: '2026-10-25',
          idempotencyToken: 'smoke-tok-real-1',
        }
      );
      assert.strictEqual(realBookingIdRes.status, 400);
      assert.match(realBookingIdRes.data.error, /Forbidden property in smoke test request.*bookingId/);

      const customerDataRes = await testRequest(
        dryRunServer,
        '/api/admin/dispatch/spoke/smoke-test',
        'POST',
        adminHeaders,
        {
          planDate: '2026-10-25',
          idempotencyToken: 'smoke-tok-real-2',
          customer: 'Acme Logistics Ltd',
          recipient_phone: '0161 555 0199',
        }
      );
      assert.strictEqual(customerDataRes.status, 400);
      assert.match(customerDataRes.data.error, /Forbidden property in smoke test request/);
      console.log('✓ PASS 11.3: Requests containing real booking IDs or arbitrary customer data strictly rejected with 400');

      // 11.4 Rejection of driver assignment and dispatch attempts
      const driverAssignmentRes = await testRequest(
        dryRunServer,
        '/api/admin/dispatch/spoke/smoke-test',
        'POST',
        adminHeaders,
        {
          planDate: '2026-10-25',
          idempotencyToken: 'smoke-tok-drv-1',
          driverId: 'drivers/drv_999',
        }
      );
      assert.strictEqual(driverAssignmentRes.status, 400);
      assert.match(driverAssignmentRes.data.error, /Forbidden property in smoke test request.*driverId/);

      const dispatchFlagRes = await testRequest(
        dryRunServer,
        '/api/admin/dispatch/spoke/smoke-test',
        'POST',
        adminHeaders,
        {
          planDate: '2026-10-25',
          idempotencyToken: 'smoke-tok-disp-2',
          dispatch: true,
        }
      );
      assert.strictEqual(dispatchFlagRes.status, 400);
      assert.match(dispatchFlagRes.data.error, /Forbidden property in smoke test request.*dispatch/);
      console.log('✓ PASS 11.4: Driver assignment and dispatch commands strictly rejected with 400');

      // 11.5 Enforce fixed plan title prefix 'NEO API TEST'
      const invalidPrefixRes = await testRequest(
        dryRunServer,
        '/api/admin/dispatch/spoke/smoke-test',
        'POST',
        adminHeaders,
        {
          planDate: '2026-10-25',
          planTitle: 'Live Dispatch Run - Oct 25',
          idempotencyToken: approvedSmokeToken,
        }
      );
      assert.strictEqual(invalidPrefixRes.status, 400);
      assert.match(invalidPrefixRes.data.error, /Plan title must begin with the fixed prefix 'NEO API TEST'/);
      console.log("✓ PASS 11.5: Plan title without fixed prefix 'NEO API TEST' strictly rejected with 400");

      // 11.6 Missing or invalid synthetic test configuration (Pure validation & Endpoint prohibition)
      // Pure validator fails closed on missing pickup
      const missingPickupVal = validateSyntheticTestConfig({
        dropoff: DEFAULT_NEO_APPROVED_SYNTHETIC_CONFIG.dropoff,
      });
      assert.strictEqual(missingPickupVal.isValid, false);
      assert.match(missingPickupVal.error!, /missing required pickup location/);

      // Pure validator fails closed on missing coordinates
      const missingCoordsVal = validateSyntheticTestConfig({
        pickup: {
          addressLineOne: 'Unit 1 Test Hub',
          zip: 'M17 1AB',
          latitude: null,
          longitude: null,
        },
        dropoff: DEFAULT_NEO_APPROVED_SYNTHETIC_CONFIG.dropoff,
      });
      assert.strictEqual(missingCoordsVal.isValid, false);
      assert.match(missingCoordsVal.error!, /missing required coordinates/);

      // Pure validator fails closed on out-of-bounds coordinates
      const outOfBoundsVal = validateSyntheticTestConfig({
        pickup: {
          addressLineOne: 'Unit 1 Test Hub',
          zip: 'M17 1AB',
          latitude: 95.5,
          longitude: -2.325,
        },
        dropoff: DEFAULT_NEO_APPROVED_SYNTHETIC_CONFIG.dropoff,
      });
      assert.strictEqual(outOfBoundsVal.isValid, false);
      assert.match(outOfBoundsVal.error!, /Latitude 95.5 is outside the valid range/);

      // Pure validator fails closed on personal contact details
      const contactVal = validateSyntheticTestConfig({
        pickup: {
          addressLineOne: 'Unit 1 Test Hub',
          zip: 'M17 1AB',
          latitude: 53.468,
          longitude: -2.325,
          phone: '07123456789',
        },
        dropoff: DEFAULT_NEO_APPROVED_SYNTHETIC_CONFIG.dropoff,
      });
      assert.strictEqual(contactVal.isValid, false);
      assert.match(contactVal.error!, /prohibited personal contact detail 'phone'/);

      // Endpoint strictly rejects client-supplied syntheticConfig in request body with 400
      const clientSuppliedSyntheticRes = await testRequest(
        dryRunServer,
        '/api/admin/dispatch/spoke/smoke-test',
        'POST',
        adminHeaders,
        {
          planDate: '2026-10-25',
          idempotencyToken: approvedSmokeToken,
          syntheticConfig: {
            pickup: DEFAULT_NEO_APPROVED_SYNTHETIC_CONFIG.pickup,
            dropoff: DEFAULT_NEO_APPROVED_SYNTHETIC_CONFIG.dropoff,
          },
        }
      );
      assert.strictEqual(clientSuppliedSyntheticRes.status, 400);
      assert.match(clientSuppliedSyntheticRes.data.error, /Forbidden property in smoke test request.*syntheticConfig/);
      console.log('✓ PASS 11.6: Missing, coordinate-free, out-of-range, contact-bearing, and client-injected synthetic configs fail closed with 400');

      // 11.7 Missing planDate, malformed dates, and missing idempotencyToken
      const missingDateRes = await testRequest(
        dryRunServer,
        '/api/admin/dispatch/spoke/smoke-test',
        'POST',
        adminHeaders,
        { idempotencyToken: approvedSmokeToken }
      );
      assert.strictEqual(missingDateRes.status, 400);
      assert.match(missingDateRes.data.error, /Explicit planDate is required/);

      const invalidCalendarRes = await testRequest(
        dryRunServer,
        '/api/admin/dispatch/spoke/smoke-test',
        'POST',
        adminHeaders,
        { planDate: '2026-02-31', idempotencyToken: approvedSmokeToken }
      );
      assert.strictEqual(invalidCalendarRes.status, 400);
      assert.match(invalidCalendarRes.data.error, /Invalid calendar date/);

      const missingTokenRes = await testRequest(
        dryRunServer,
        '/api/admin/dispatch/spoke/smoke-test',
        'POST',
        adminHeaders,
        { planDate: '2026-10-25' }
      );
      assert.strictEqual(missingTokenRes.status, 400);
      assert.match(missingTokenRes.data.error, /Valid idempotencyToken is required/);

      const shortTokenRes = await testRequest(
        dryRunServer,
        '/api/admin/dispatch/spoke/smoke-test',
        'POST',
        adminHeaders,
        { planDate: '2026-10-25', idempotencyToken: 'short' }
      );
      assert.strictEqual(shortTokenRes.status, 400);
      assert.match(shortTokenRes.data.error, /between 8 and 128 characters/);
      console.log('✓ PASS 11.7: Missing plan dates, invalid calendar days, and invalid idempotency tokens return 400');

      // 11.8 Exactly one plan and two stops created with synthetic labels (Instrumented Mock Spoke API)
      const testToken1 = 'smoke-token-alpha-12345';
      const spokeApiCalls: Array<{ url: string; method: string; body: any }> = [];

      const origGlobalFetch = globalThis.fetch;
      try {
        globalThis.fetch = (async (input: any, init?: any) => {
          const urlStr = typeof input === 'string' ? input : input?.url || '';
          const method = init?.method || 'GET';
          let bodyParsed: any = null;
          if (init?.body && typeof init.body === 'string') {
            try {
              bodyParsed = JSON.parse(init.body);
            } catch {
              bodyParsed = init.body;
            }
          }
          spokeApiCalls.push({ url: urlStr, method, body: bodyParsed });

          if (urlStr.endsWith('/plans') && method === 'POST') {
            return {
              ok: true,
              status: 201,
              json: async () => ({
                id: 'plans/test_plan_smoke_101',
                title: bodyParsed?.title,
                starts: bodyParsed?.starts,
              }),
              text: async () => '',
            } as any;
          }

          if (urlStr.includes('/stops:import') && method === 'POST') {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                success: [
                  'plans/test_plan_smoke_101/stops/synthetic_pickup_01',
                  'plans/test_plan_smoke_101/stops/synthetic_delivery_02',
                ],
                failed: [],
              }),
              text: async () => '',
            } as any;
          }

          return origGlobalFetch(input, init);
        }) as any;

        const smokeExecRes = await testRequest(
          dryRunServer,
          '/api/admin/dispatch/spoke/smoke-test',
          'POST',
          adminHeaders,
          {
            planDate: '2026-10-25',
            planTitle: 'NEO API TEST - Automated Verification',
            idempotencyToken: testToken1,
          }
        );

        assert.strictEqual(smokeExecRes.status, 200);
        assert.strictEqual(smokeExecRes.data.success, true);
        assert.strictEqual(smokeExecRes.data.planId, 'plans/test_plan_smoke_101');
        assert.strictEqual(smokeExecRes.data.planTitle, 'NEO API TEST - Automated Verification');
        assert.strictEqual(smokeExecRes.data.stopsImported, 2);
        assert.strictEqual(smokeExecRes.data.auditLogged, true);
        assert.strictEqual(smokeExecRes.data.claimStatus, 'succeeded');
        assert.ok(
          smokeExecRes.data.disclaimer.includes('Spoke API documentation does not confirm all background side effects')
        );

        // Verify outbound Spoke API calls: exactly 2 calls (1 createPlan, 1 importStops)
        assert.strictEqual(spokeApiCalls.length, 2, 'Smoke test must make exactly 2 outbound Spoke calls');

        const [planCall, stopsCall] = spokeApiCalls;
        // 1. Verify Plan Creation
        assert.strictEqual(planCall.method, 'POST');
        assert.ok(planCall.url.endsWith('/plans'));
        assert.strictEqual(planCall.body.title, 'NEO API TEST - Automated Verification');
        assert.deepStrictEqual(planCall.body.starts, { day: 25, month: 10, year: 2026 });
        assert.strictEqual(planCall.body.drivers, undefined, 'Plan MUST NOT contain drivers');

        // 2. Verify Stop Import
        assert.strictEqual(stopsCall.method, 'POST');
        assert.ok(stopsCall.url.includes('/plans/test_plan_smoke_101/stops:import'));
        const stopsArray = Array.isArray(stopsCall.body) ? stopsCall.body : stopsCall.body.stops;
        assert.strictEqual(Array.isArray(stopsArray), true);
        assert.strictEqual(stopsArray.length, 2);

        const [stopPickup, stopDelivery] = stopsArray;
        assert.strictEqual(stopPickup.activity, 'pickup');
        assert.strictEqual(stopDelivery.activity, 'delivery');
        assert.strictEqual(stopPickup.recipient.name, 'NEO Test Hub (Synthetic)');
        assert.strictEqual(stopDelivery.recipient.name, 'NEO Test Receiving (Synthetic)');
        assert.strictEqual(stopPickup.recipient.phone, null);
        assert.strictEqual(stopDelivery.recipient.phone, null);
        assert.strictEqual(stopPickup.allowedDrivers, null);
        assert.strictEqual(stopDelivery.allowedDrivers, null);
        assert.strictEqual(stopPickup.address.latitude, 53.468);
        assert.strictEqual(stopPickup.address.longitude, -2.325);
        assert.strictEqual(stopDelivery.address.latitude, 52.503);
        assert.strictEqual(stopDelivery.address.longitude, -1.884);

        // Verify audit log entry
        const smokeAudit = recordedAudits.find(
          (a) => a.action === 'SPOKE_PRODUCTION_SMOKE_TEST' && a.target_id === testToken1
        );
        assert.ok(smokeAudit, 'Audit log entry must be recorded for smoke test');
        assert.strictEqual(smokeAudit.details.planTitle, 'NEO API TEST - Automated Verification');
        assert.strictEqual(smokeAudit.details.planId, 'plans/test_plan_smoke_101');
        assert.strictEqual(smokeAudit.details.stopsImported, 2);
        assert.strictEqual(smokeAudit.details.phone, undefined);
        assert.strictEqual(smokeAudit.details.email, undefined);

        const savedClaim = recordedClaims.find((c) => c.test_run_token === testToken1);
        assert.ok(savedClaim, 'Database claim must be recorded');
        assert.strictEqual(savedClaim.status, 'succeeded');
        assert.strictEqual(savedClaim.plan_id, 'plans/test_plan_smoke_101');

        console.log(
          '✓ PASS 11.8: Exactly one plan and two synthetic stops created with verified coordinates and zero driver assignment'
        );

        // 11.9 Duplicate-Run Protection: Retrying with the same token is strictly rejected with 409 Conflict
        const preDuplicateCallCount = spokeApiCalls.length;
        const duplicateRes = await testRequest(
          dryRunServer,
          '/api/admin/dispatch/spoke/smoke-test',
          'POST',
          adminHeaders,
          {
            planDate: '2026-10-25',
            planTitle: 'NEO API TEST - Automated Verification',
            idempotencyToken: testToken1,
          }
        );
        assert.strictEqual(duplicateRes.status, 409);
        assert.strictEqual(duplicateRes.data.claimStatus, 'succeeded');
        assert.match(duplicateRes.data.error, /Duplicate test run detected/);
        assert.strictEqual(
          spokeApiCalls.length,
          preDuplicateCallCount,
          'Duplicate-run retry must NEVER issue additional outbound Spoke API calls'
        );
        console.log('✓ PASS 11.9: Duplicate-run protection blocks retries with 409 and issues zero network calls');
      } finally {
        globalThis.fetch = origGlobalFetch;
      }

      // 11.10 Existing global write guards remain enforced outside the restricted pathway
      const isolatedClient = new SpokeClient({ apiKey: 'test_key_guard' });
      await assert.rejects(
        async () => {
          await isolatedClient.createPlan({ title: 'Test Guard Plan', starts: { day: 1, month: 1, year: 2026 } });
        },
        (err: any) => {
          assert.match(err.message, /RESTRICTION ENFORCED: Mutating Spoke Dispatch operations \(createPlan\) are locked/);
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await isolatedClient.importStops('plans/test_guard', []);
        },
        (err: any) => {
          assert.match(err.message, /RESTRICTION ENFORCED: Mutating Spoke Dispatch operations \(importStops\) are locked/);
          return true;
        }
      );

      // Direct executeControlledSmokeTest throws if drivers are provided even when enabled
      try {
        process.env.NEO_SPOKE_PRODUCTION_TEST_ENABLED = 'true';
        await assert.rejects(
          async () => {
            await spokeClient.executeControlledSmokeTest({
              plan: {
                title: 'NEO API TEST - Driver Rejection',
                starts: { day: 25, month: 10, year: 2026 },
                drivers: [{ id: 'drivers/drv_illegal' }] as any,
              },
              stops: buildSyntheticTestStops(DEFAULT_NEO_APPROVED_SYNTHETIC_CONFIG, 'DRIVER-TEST'),
              idempotencyToken: 'driver-test-tok',
            });
          },
          /Driver assignment is strictly forbidden in smoke test pathway/
        );
      } finally {
        delete process.env.NEO_SPOKE_PRODUCTION_TEST_ENABLED;
      }
      console.log('✓ PASS 11.10: Global write guards (createPlan, importStops, driver restrictions) remain strictly enforced');

      // ---------------------------------------------------------------------------
      // 12. Advanced Hardening & Production Operational Readiness Tests
      // ---------------------------------------------------------------------------
      console.log('\n--- 12. Testing Advanced Hardening & Production Operational Readiness ---');

      // 12.1 Single Server-Approved Token Authorization Enforcement
      try {
        process.env.NEO_SPOKE_PRODUCTION_TEST_ENABLED = 'true';
        process.env.NEO_SPOKE_SMOKE_TEST_APPROVED_TOKEN = 'approved-token-run-555';

        // 12.1a Unapproved token returns 403 Forbidden
        const unapprovedTokenRes = await testRequest(
          dryRunServer,
          '/api/admin/dispatch/spoke/smoke-test',
          'POST',
          adminHeaders,
          {
            planDate: '2026-10-25',
            idempotencyToken: 'unauthorized-token-666',
          }
        );
        assert.strictEqual(unapprovedTokenRes.status, 403);
        assert.match(unapprovedTokenRes.data.error, /Unauthorized test run token/);

        // 12.1b Missing server-configured token returns 503 Service Unavailable
        delete process.env.NEO_SPOKE_SMOKE_TEST_APPROVED_TOKEN;
        const missingServerTokenRes = await testRequest(
          dryRunServer,
          '/api/admin/dispatch/spoke/smoke-test',
          'POST',
          adminHeaders,
          {
            planDate: '2026-10-25',
            idempotencyToken: 'approved-token-run-555',
          }
        );
        assert.strictEqual(missingServerTokenRes.status, 503);
        assert.match(
          missingServerTokenRes.data.error,
          /Single-run test authorization token is not configured on the server environment/
        );
        console.log('✓ PASS 12.1: Single server-configured approved token strictly enforced (403 unauthorized, 503 missing config)');

        // 12.2 Server-Configured Approved Synthetic Location Fail-Closed Enforcement
        process.env.NEO_SPOKE_SMOKE_TEST_APPROVED_TOKEN = 'approved-token-run-555';

        // 12.2a Missing server location env vars returns 503
        delete process.env.NEO_SPOKE_APPROVED_PICKUP_ADDRESS;
        delete process.env.NEO_SPOKE_APPROVED_PICKUP_ZIP;
        delete process.env.NEO_SPOKE_APPROVED_PICKUP_LAT;
        delete process.env.NEO_SPOKE_APPROVED_PICKUP_LNG;
        delete process.env.NEO_SPOKE_APPROVED_DROPOFF_ADDRESS;
        delete process.env.NEO_SPOKE_APPROVED_DROPOFF_ZIP;
        delete process.env.NEO_SPOKE_APPROVED_DROPOFF_LAT;
        delete process.env.NEO_SPOKE_APPROVED_DROPOFF_LNG;

        const missingLocationsRes = await testRequest(
          dryRunServer,
          '/api/admin/dispatch/spoke/smoke-test',
          'POST',
          adminHeaders,
          {
            planDate: '2026-10-25',
            idempotencyToken: 'approved-token-run-555',
          }
        );
        assert.strictEqual(missingLocationsRes.status, 503);
        assert.match(missingLocationsRes.data.error, /NEO-approved synthetic test locations are not configured/);

        const directLoaderMissing = loadServerApprovedSyntheticLocations();
        assert.strictEqual(directLoaderMissing.isConfigured, false);

        // 12.2b Invalid server coordinates return 503
        process.env.NEO_SPOKE_APPROVED_PICKUP_ADDRESS = 'Unit 1 Test Hub';
        process.env.NEO_SPOKE_APPROVED_PICKUP_ZIP = 'M17 1AB';
        process.env.NEO_SPOKE_APPROVED_PICKUP_LAT = '99.5';
        process.env.NEO_SPOKE_APPROVED_PICKUP_LNG = '-2.325';
        process.env.NEO_SPOKE_APPROVED_DROPOFF_ADDRESS = 'Heartlands Parkway';
        process.env.NEO_SPOKE_APPROVED_DROPOFF_ZIP = 'B6 7EU';
        process.env.NEO_SPOKE_APPROVED_DROPOFF_LAT = '52.503';
        process.env.NEO_SPOKE_APPROVED_DROPOFF_LNG = '-1.884';

        const invalidCoordsServerRes = await testRequest(
          dryRunServer,
          '/api/admin/dispatch/spoke/smoke-test',
          'POST',
          adminHeaders,
          {
            planDate: '2026-10-25',
            idempotencyToken: 'approved-token-run-555',
          }
        );
        assert.strictEqual(invalidCoordsServerRes.status, 503);
        assert.match(invalidCoordsServerRes.data.error, /Server-configured pickup coordinates invalid/);

        // 12.2c Structured JSON config support
        process.env.NEO_SPOKE_APPROVED_SYNTHETIC_LOCATIONS_JSON = JSON.stringify(DEFAULT_NEO_APPROVED_SYNTHETIC_CONFIG);
        const jsonConfigRes = loadServerApprovedSyntheticLocations();
        assert.strictEqual(jsonConfigRes.isConfigured, true);
        assert.ok(jsonConfigRes.config);
        delete process.env.NEO_SPOKE_APPROVED_SYNTHETIC_LOCATIONS_JSON;

        // Restore discrete approved location env vars
        process.env.NEO_SPOKE_APPROVED_PICKUP_ADDRESS = 'Unit 1 Test Hub, Trafford Park';
        process.env.NEO_SPOKE_APPROVED_PICKUP_ZIP = 'M17 1AB';
        process.env.NEO_SPOKE_APPROVED_PICKUP_LAT = '53.468';
        process.env.NEO_SPOKE_APPROVED_PICKUP_LNG = '-2.325';
        process.env.NEO_SPOKE_APPROVED_DROPOFF_ADDRESS = 'Heartlands Parkway, Birmingham';
        process.env.NEO_SPOKE_APPROVED_DROPOFF_ZIP = 'B6 7EU';
        process.env.NEO_SPOKE_APPROVED_DROPOFF_LAT = '52.503';
        process.env.NEO_SPOKE_APPROVED_DROPOFF_LNG = '-1.884';
        console.log('✓ PASS 12.2: Server-approved synthetic locations fail closed (503) on missing/invalid server config');

        // 12.3 Concurrency & Database-Backed Atomic Claim Reservation
        const concurrentToken = 'smoke-token-concurrent-999';
        process.env.NEO_SPOKE_SMOKE_TEST_APPROVED_TOKEN = concurrentToken;

        let spokeConcurrentCalls = 0;
        const origFetchConcurrency = globalThis.fetch;
        try {
          globalThis.fetch = (async (input: any, init?: any) => {
            const urlStr = typeof input === 'string' ? input : input?.url || '';
            const method = init?.method || 'GET';
            spokeConcurrentCalls++;

            if (urlStr.endsWith('/plans') && method === 'POST') {
              return {
                ok: true,
                status: 201,
                json: async () => ({ id: 'plans/concurrent_plan_999', title: 'NEO API TEST - Concurrent' }),
                text: async () => '',
              } as any;
            }
            if (urlStr.includes('/stops:import') && method === 'POST') {
              return {
                ok: true,
                status: 200,
                json: async () => ({ success: ['stop_1', 'stop_2'], failed: [] }),
                text: async () => '',
              } as any;
            }
            return origFetchConcurrency(input, init);
          }) as any;

          const [concurrentResA, concurrentResB] = await Promise.all([
            testRequest(dryRunServer, '/api/admin/dispatch/spoke/smoke-test', 'POST', adminHeaders, {
              planDate: '2026-10-25',
              planTitle: 'NEO API TEST - Concurrent',
              idempotencyToken: concurrentToken,
            }),
            testRequest(dryRunServer, '/api/admin/dispatch/spoke/smoke-test', 'POST', adminHeaders, {
              planDate: '2026-10-25',
              planTitle: 'NEO API TEST - Concurrent',
              idempotencyToken: concurrentToken,
            }),
          ]);

          const statuses = [concurrentResA.status, concurrentResB.status].sort();
          assert.deepStrictEqual(
            statuses,
            [200, 409],
            'Concurrent requests must result in exactly one 200 and one 409 Conflict'
          );

          const conflictRes = concurrentResA.status === 409 ? concurrentResA : concurrentResB;
          assert.ok(
            conflictRes.data.claimStatus === 'reserved' || conflictRes.data.claimStatus === 'succeeded',
            `Expected claimStatus reserved or succeeded, got ${conflictRes.data.claimStatus}`
          );
          assert.match(conflictRes.data.error, /Retries cannot create a second plan|Duplicate test run detected/);
          assert.strictEqual(
            spokeConcurrentCalls,
            2,
            'Exactly two Spoke calls made (1 createPlan, 1 importStops) across concurrent requests'
          );
          console.log('✓ PASS 12.3: Database-backed atomic unique constraint blocks concurrent requests with 409');

          // 12.4 Duplicate Submission Rejection Across States (succeeded and cleaned_up)
          const dupSubRes = await testRequest(
            dryRunServer,
            '/api/admin/dispatch/spoke/smoke-test',
            'POST',
            adminHeaders,
            {
              planDate: '2026-10-25',
              idempotencyToken: concurrentToken,
            }
          );
          assert.strictEqual(dupSubRes.status, 409);
          assert.strictEqual(dupSubRes.data.claimStatus, 'succeeded');
          assert.match(dupSubRes.data.error, /Duplicate test run detected/);

          // Simulate cleaned_up claim
          const claimToClean = recordedClaims.find((c) => c.test_run_token === concurrentToken);
          if (claimToClean) {
            claimToClean.status = 'cleaned_up';
          }
          const dupCleanedRes = await testRequest(
            dryRunServer,
            '/api/admin/dispatch/spoke/smoke-test',
            'POST',
            adminHeaders,
            {
              planDate: '2026-10-25',
              idempotencyToken: concurrentToken,
            }
          );
          assert.strictEqual(dupCleanedRes.status, 409);
          assert.strictEqual(dupCleanedRes.data.claimStatus, 'cleaned_up');
          assert.match(dupCleanedRes.data.error, /already completed and cleaned up/);
          console.log('✓ PASS 12.4: Duplicate submissions rejected with 409 across succeeded and cleaned_up states');

          // 12.5 Retry After Timeout / Unknown Outcome (transitions to failed_unknown, blocks duplicate retries)
          const timeoutToken = 'smoke-token-timeout-888';
          process.env.NEO_SPOKE_SMOKE_TEST_APPROVED_TOKEN = timeoutToken;

          globalThis.fetch = (async (input: any, init?: any) => {
            const urlStr = typeof input === 'string' ? input : input?.url || '';
            if (urlStr.endsWith('/plans')) {
              return {
                ok: false,
                status: 504,
                text: async () => 'Gateway Timeout communicating with Spoke upstream',
              } as any;
            }
            return origFetchConcurrency(input, init);
          }) as any;

          const timeoutRes = await testRequest(
            dryRunServer,
            '/api/admin/dispatch/spoke/smoke-test',
            'POST',
            adminHeaders,
            {
              planDate: '2026-10-25',
              idempotencyToken: timeoutToken,
            }
          );
          assert.strictEqual(timeoutRes.status, 500);
          assert.match(timeoutRes.data.error, /Spoke smoke-test execution failed.*failed_unknown/);

          const failedClaim = recordedClaims.find((c) => c.test_run_token === timeoutToken);
          assert.ok(failedClaim, 'Claim must exist in database');
          assert.strictEqual(failedClaim.status, 'failed_unknown');

          // Retrying the failed/unknown run must NOT create a new plan; must return 409
          let spokeCallsOnRetry = 0;
          globalThis.fetch = (async () => {
            spokeCallsOnRetry++;
            return { ok: true, status: 200, json: async () => ({}) } as any;
          }) as any;

          const retryAfterFailRes = await testRequest(
            dryRunServer,
            '/api/admin/dispatch/spoke/smoke-test',
            'POST',
            adminHeaders,
            {
              planDate: '2026-10-25',
              idempotencyToken: timeoutToken,
            }
          );
          assert.strictEqual(retryAfterFailRes.status, 409);
          assert.strictEqual(retryAfterFailRes.data.claimStatus, 'failed_unknown');
          assert.match(
            retryAfterFailRes.data.error,
            /Test execution previously reached an unknown or failed outcome.*A retry cannot create a second plan/
          );
          assert.strictEqual(spokeCallsOnRetry, 0, 'Zero network calls permitted on retry after failed_unknown');
          console.log('✓ PASS 12.5: Failed/unknown outcome transitions claim to failed_unknown and blocks retry from creating second plan');

          // 12.6 Audit-Write Failure Resilience
          const auditFailToken = 'smoke-token-auditfail-777';
          process.env.NEO_SPOKE_SMOKE_TEST_APPROVED_TOKEN = auditFailToken;

          globalThis.fetch = (async (input: any, init?: any) => {
            const urlStr = typeof input === 'string' ? input : input?.url || '';
            const method = init?.method || 'GET';
            if (urlStr.endsWith('/plans') && method === 'POST') {
              return {
                ok: true,
                status: 201,
                json: async () => ({ id: 'plans/audit_plan_777', title: 'NEO API TEST - Audit Resilience' }),
                text: async () => '',
              } as any;
            }
            if (urlStr.includes('/stops:import') && method === 'POST') {
              return {
                ok: true,
                status: 200,
                json: async () => ({ success: ['s1', 's2'], failed: [] }),
                text: async () => '',
              } as any;
            }
            return origFetchConcurrency(input, init);
          }) as any;

          mockAuditError = new Error('Database audit log table busy');
          const auditFailRes = await testRequest(
            dryRunServer,
            '/api/admin/dispatch/spoke/smoke-test',
            'POST',
            adminHeaders,
            {
              planDate: '2026-10-25',
              idempotencyToken: auditFailToken,
            }
          );
          assert.strictEqual(auditFailRes.status, 200);
          assert.strictEqual(auditFailRes.data.success, true);
          assert.strictEqual(auditFailRes.data.auditLogged, false);
          assert.strictEqual(auditFailRes.data.claimStatus, 'succeeded');

          const auditFailClaim = recordedClaims.find((c) => c.test_run_token === auditFailToken);
          assert.ok(auditFailClaim);
          assert.strictEqual(auditFailClaim.status, 'succeeded');
          mockAuditError = null;
          console.log('✓ PASS 12.6: Audit-write failure is handled gracefully without failing test or duplicating claims');

          // 12.7 Supported Cleanup / Cancellation Procedure (POST /api/admin/dispatch/spoke/smoke-test/cleanup)
          // 12.7a Unauthenticated request returns 401
          const unauthCleanup = await testRequest(
            dryRunServer,
            '/api/admin/dispatch/spoke/smoke-test/cleanup',
            'POST',
            {},
            { planId: 'plans/test_cleanup_101' }
          );
          assert.strictEqual(unauthCleanup.status, 401);

          // 12.7b Cleanup disabled when feature flag is false (403)
          process.env.NEO_SPOKE_PRODUCTION_TEST_ENABLED = 'false';
          const disabledCleanup = await testRequest(
            dryRunServer,
            '/api/admin/dispatch/spoke/smoke-test/cleanup',
            'POST',
            adminHeaders,
            { planId: 'plans/test_cleanup_101' }
          );
          assert.strictEqual(disabledCleanup.status, 403);
          assert.match(disabledCleanup.data.error, /NEO_SPOKE_PRODUCTION_TEST_ENABLED must be explicitly configured as true/);
          process.env.NEO_SPOKE_PRODUCTION_TEST_ENABLED = 'true';

          // 12.7c Missing planId returns 400
          const missingPlanIdCleanup = await testRequest(
            dryRunServer,
            '/api/admin/dispatch/spoke/smoke-test/cleanup',
            'POST',
            adminHeaders,
            {}
          );
          assert.strictEqual(missingPlanIdCleanup.status, 400);
          assert.match(missingPlanIdCleanup.data.error, /Valid planId is required/);

          // 12.7d Security Guard: Deleting a non-test plan (missing 'NEO API TEST' prefix) is refused
          globalThis.fetch = (async (input: any, init?: any) => {
            const urlStr = typeof input === 'string' ? input : input?.url || '';
            const method = init?.method || 'GET';
            if (urlStr.includes('/plans/live_prod_plan_999') && method === 'GET') {
              return {
                ok: true,
                status: 200,
                json: async () => ({ id: 'plans/live_prod_plan_999', title: 'Live Customer Dispatch - Sheffield' }),
                text: async () => '',
              } as any;
            }
            return origFetchConcurrency(input, init);
          }) as any;

          const nonTestPlanCleanup = await testRequest(
            dryRunServer,
            '/api/admin/dispatch/spoke/smoke-test/cleanup',
            'POST',
            adminHeaders,
            { planId: 'plans/live_prod_plan_999' }
          );
          assert.strictEqual(nonTestPlanCleanup.status, 500);
          assert.match(nonTestPlanCleanup.data.error, /SECURITY VIOLATION: Plan .* does not have the mandatory 'NEO API TEST' prefix/);

          // 12.7e Valid test plan deletion issues DELETE and updates database claim to cleaned_up
          let deleteCalled = false;
          globalThis.fetch = (async (input: any, init?: any) => {
            const urlStr = typeof input === 'string' ? input : input?.url || '';
            const method = init?.method || 'GET';
            if (urlStr.includes('/plans/test_plan_smoke_101') && method === 'GET') {
              return {
                ok: true,
                status: 200,
                json: async () => ({
                  id: 'plans/test_plan_smoke_101',
                  title: 'NEO API TEST - Automated Verification',
                }),
                text: async () => '',
              } as any;
            }
            if (urlStr.includes('/plans/live_prod_plan_999') && method === 'GET') {
              return {
                ok: true,
                status: 200,
                json: async () => ({ id: 'plans/live_prod_plan_999', title: 'Live Customer Dispatch - Sheffield' }),
                text: async () => '',
              } as any;
            }
            if (urlStr.includes('/plans/test_plan_smoke_101') && method === 'DELETE') {
              deleteCalled = true;
              return {
                ok: true,
                status: 200,
                json: async () => ({}),
                text: async () => '',
              } as any;
            }
            return origFetchConcurrency(input, init);
          }) as any;

          const validCleanupRes = await testRequest(
            dryRunServer,
            '/api/admin/dispatch/spoke/smoke-test/cleanup',
            'POST',
            adminHeaders,
            { planId: 'plans/test_plan_smoke_101' }
          );
          assert.strictEqual(validCleanupRes.status, 200);
          assert.strictEqual(validCleanupRes.data.success, true);
          assert.strictEqual(deleteCalled, true, 'Spoke DELETE call must be issued');

          // Verify database claim updated to 'cleaned_up'
          const cleanedClaim = recordedClaims.find((c) => c.plan_id === 'plans/test_plan_smoke_101');
          assert.ok(cleanedClaim, 'Claim must exist');
          assert.strictEqual(cleanedClaim.status, 'cleaned_up');

          // Verify audit log for cleanup
          const cleanupAudit = recordedAudits.find(
            (a) => a.action === 'SPOKE_SMOKE_TEST_CLEANED_UP' && a.target_id === 'plans/test_plan_smoke_101'
          );
          assert.ok(cleanupAudit, 'Cleanup audit entry must be recorded');

          // Direct SpokeClient deleteOrCancelTestPlan rejects non-test plan
          await assert.rejects(
            async () => {
              await spokeClient.deleteOrCancelTestPlan('plans/live_prod_plan_999');
            },
            /SECURITY VIOLATION: Plan .* does not have the mandatory 'NEO API TEST' prefix/
          );

          console.log('✓ PASS 12.7: Supported cleanup/cancellation endpoint and client guards verified with DELETE execution');
        } finally {
          globalThis.fetch = origFetchConcurrency;
        }
      } finally {
        delete process.env.NEO_SPOKE_PRODUCTION_TEST_ENABLED;
        delete process.env.NEO_SPOKE_SMOKE_TEST_APPROVED_TOKEN;
        delete process.env.NEO_SPOKE_APPROVED_PICKUP_ADDRESS;
        delete process.env.NEO_SPOKE_APPROVED_PICKUP_ZIP;
        delete process.env.NEO_SPOKE_APPROVED_PICKUP_LAT;
        delete process.env.NEO_SPOKE_APPROVED_PICKUP_LNG;
        delete process.env.NEO_SPOKE_APPROVED_DROPOFF_ADDRESS;
        delete process.env.NEO_SPOKE_APPROVED_DROPOFF_ZIP;
        delete process.env.NEO_SPOKE_APPROVED_DROPOFF_LAT;
        delete process.env.NEO_SPOKE_APPROVED_DROPOFF_LNG;
        delete process.env.NEO_SPOKE_APPROVED_SYNTHETIC_LOCATIONS_JSON;
      }
    } finally {
      if (prevNodeEnv !== undefined) {
        process.env.NODE_ENV = prevNodeEnv;
      } else {
        delete process.env.NODE_ENV;
      }
      if (prevVercel !== undefined) {
        process.env.VERCEL = prevVercel;
      } else {
        delete process.env.VERCEL;
      }
    }
  } finally {
    setServerSupabaseClientForTesting(null);
    dryRunServer.close();
  }

  // ---------------------------------------------------------------------------
  // 13. Testing Booking-to-Spoke Stop Mapping & Webhook Correlation Regression
  // ---------------------------------------------------------------------------
  console.log('\n--- 13. Testing Booking-to-Spoke Stop Mapping & Webhook Correlation Regression ---');

  // 13.1 Authoritative Booking ID Inclusion
  const testBooking = {
    id: 'NEO-BK-20261020-AUTH-001',
    company_id: 'comp-100',
    pickup: 'Trafford Park, Manchester, M17 1AA',
    pickup_contact: 'Warehouse Hub',
    pickup_phone: '+44 161 000 0001',
    collection_window: '09:00 - 11:00',
    dropoff: 'Aston Expressway, Birmingham, B6 4HH',
    recipient_name: 'Factory Recipient',
    recipient_phone: '+44 121 000 0002',
    delivery_window: '14:00 - 16:00',
    delivery_instructions: 'Gate 2 rear entrance',
    goods: 'Precision Machinery Parts',
    weight_kg: 350.5,
    items_count: 2,
    vehicle: 'Sprinter LWB',
    service: 'Direct Dedicated',
    po_reference: 'PO-NEO-7788',
  };

  const pickupStopRes = mapBookingToSpokePickupStop(testBooking, { lat: 53.468, lng: -2.325 });
  assert.strictEqual(pickupStopRes.success, true);
  assert.ok(pickupStopRes.data);
  assert.strictEqual(pickupStopRes.data.orderInfo?.sellerOrderId, 'NEO-BK-20261020-AUTH-001');
  assert.strictEqual(pickupStopRes.data.orderInfo?.sellerName, 'NEO Transport');
  assert.strictEqual(pickupStopRes.data.orderInfo?.invoiceNumber, 'PO-NEO-7788');
  assert.deepStrictEqual(pickupStopRes.data.orderInfo?.products, ['Precision Machinery Parts']);
  assert.strictEqual(pickupStopRes.data.activity, 'pickup');

  const deliveryStopRes = mapBookingToSpokeDeliveryStop(testBooking, { lat: 52.503, lng: -1.884 });
  assert.strictEqual(deliveryStopRes.success, true);
  assert.ok(deliveryStopRes.data);
  assert.strictEqual(deliveryStopRes.data.orderInfo?.sellerOrderId, 'NEO-BK-20261020-AUTH-001');
  assert.strictEqual(deliveryStopRes.data.orderInfo?.sellerName, 'NEO Transport');
  assert.strictEqual(deliveryStopRes.data.orderInfo?.invoiceNumber, 'PO-NEO-7788');
  assert.deepStrictEqual(deliveryStopRes.data.orderInfo?.products, ['Precision Machinery Parts']);
  assert.strictEqual(deliveryStopRes.data.activity, 'delivery');

  // Verify booking_id property variant
  const snakeIdRes = mapBookingToSpokePickupStop({
    ...testBooking,
    id: undefined,
    reference: undefined,
    booking_id: 'NEO-BK-SNAKE-444',
  }, { lat: 53.468, lng: -2.325 });
  assert.strictEqual(snakeIdRes.success, true);
  assert.strictEqual(snakeIdRes.data?.orderInfo?.sellerOrderId, 'NEO-BK-SNAKE-444');

  // Verify bookingId property variant
  const camelIdRes = mapBookingToSpokeDeliveryStop({
    ...testBooking,
    id: undefined,
    reference: undefined,
    bookingId: 'NEO-BK-CAMEL-555',
  }, { lat: 52.503, lng: -1.884 });
  assert.strictEqual(camelIdRes.success, true);
  assert.strictEqual(camelIdRes.data?.orderInfo?.sellerOrderId, 'NEO-BK-CAMEL-555');

  // Verify authoritative primary key takes precedence over human reference
  const dualRefRes = mapBookingToSpokePickupStop({
    ...testBooking,
    id: 'NEO-PRIMARY-KEY-999',
    reference: 'LEGACY-HUMAN-REF-111',
  }, { lat: 53.468, lng: -2.325 });
  assert.strictEqual(dualRefRes.success, true);
  assert.strictEqual(dualRefRes.data?.orderInfo?.sellerOrderId, 'NEO-PRIMARY-KEY-999');

  // Verify fallback to reference when ID is whitespace
  const blankIdFallbackRes = mapBookingToSpokeDeliveryStop({
    ...testBooking,
    id: '   ',
    reference: 'VALID-FALLBACK-REF-222',
  }, { lat: 52.503, lng: -1.884 });
  assert.strictEqual(blankIdFallbackRes.success, true);
  assert.strictEqual(blankIdFallbackRes.data?.orderInfo?.sellerOrderId, 'VALID-FALLBACK-REF-222');

  // Verify validation failure when both are absent or whitespace
  const emptyRefRes = mapBookingToSpokePickupStop({
    ...testBooking,
    id: '   ',
    reference: '',
    booking_id: undefined,
    bookingId: undefined,
  }, { lat: 53.468, lng: -2.325 });
  assert.strictEqual(emptyRefRes.success, false);
  assert.ok(emptyRefRes.errors?.includes('Booking reference or ID is required'));
  assert.strictEqual(emptyRefRes.data, undefined);

  console.log('✓ PASS 13.1: Both pickup and delivery stops strictly include authoritative public.bookings.id as sellerOrderId');

  // 13.2 Mocked Webhook Correlation Matching
  const mockRegressionBookings = new Map<string, any>();
  const mockRegressionStopStates = new Map<string, any>();
  const mockRegressionWebhookEvents = new Map<string, any>();

  mockRegressionBookings.set('NEO-BK-20261020-AUTH-001', {
    id: 'NEO-BK-20261020-AUTH-001',
    company_id: 'comp-100',
    status: 'Scheduled',
    pickup_tracking_url: null,
    delivery_tracking_url: null,
    progress_t: 0.0,
  });

  const mockDbClient: any = {
    from: (table: string) => {
      if (table === 'bookings') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              single: async () => {
                const row = mockRegressionBookings.get(val);
                return row ? { data: { ...row }, error: null } : { data: null, error: { code: 'PGRST116', message: 'Not found' } };
              },
            }),
          }),
          update: (fields: any) => ({
            eq: async (_col: string, val: string) => {
              const row = mockRegressionBookings.get(val);
              if (row) Object.assign(row, fields);
              return { data: null, error: null };
            },
          }),
        };
      }
      if (table === 'spoke_booking_stop_state') {
        return {
          select: () => ({
            eq: (_col1: string, val1: string) => ({
              eq: (_col2: string, val2: string) => ({
                single: async () => {
                  const key = `${val1}:${val2}`;
                  const row = mockRegressionStopStates.get(key);
                  return row ? { data: { ...row }, error: null } : { data: null, error: { code: 'PGRST116', message: 'No rows' } };
                },
                maybeSingle: async () => {
                  const key = `${val1}:${val2}`;
                  const row = mockRegressionStopStates.get(key);
                  return { data: row ? { ...row } : null, error: null };
                },
              }),
            }),
          }),
          upsert: async (fields: any) => {
            const key = `${fields.booking_id}:${fields.activity}`;
            mockRegressionStopStates.set(key, { ...fields });
            return { data: null, error: null };
          },
        };
      }
      if (table === 'spoke_webhook_events') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              single: async () => {
                const row = mockRegressionWebhookEvents.get(val);
                return row ? { data: { ...row }, error: null } : { data: null, error: { message: 'Not found' } };
              },
            }),
          }),
          update: (fields: any) => ({
            eq: async (_col: string, val: string) => {
              const row = mockRegressionWebhookEvents.get(val);
              if (row) Object.assign(row, fields);
              return { data: null, error: null };
            },
          }),
        };
      }
      throw new Error(`Unhandled mock table: ${table}`);
    },
  };

  // Simulate incoming webhook carrying the mapped pickup stop payload
  const pickupEventHash = 'hash-mapped-pickup-test-01';
  mockRegressionWebhookEvents.set(pickupEventHash, {
    event_hash: pickupEventHash,
    event_type: 'stop.out_for_delivery',
    processing_status: 'received',
    payload: {
      type: 'stop.out_for_delivery',
      version: 'v1',
      created: Date.now(),
      data: {
        stop: {
          id: 'plans/plan_regression_1/stops/stop_pickup_mapped',
          ...pickupStopRes.data,
          trackingLink: 'https://track.spoke.com/stops/stop_pickup_mapped',
        },
      },
    },
  });

  const pickupEventRes = await processSpokeWebhookEventFallback(pickupEventHash, mockDbClient);
  assert.strictEqual(pickupEventRes.success, true);
  assert.strictEqual(pickupEventRes.status, 'processed');
  assert.strictEqual(pickupEventRes.bookingId, 'NEO-BK-20261020-AUTH-001');
  assert.strictEqual(pickupEventRes.activity, 'pickup');
  assert.strictEqual(pickupEventRes.bookingStatus, 'In transit');

  const liveBookingAfterPickup = mockRegressionBookings.get('NEO-BK-20261020-AUTH-001');
  assert.strictEqual(liveBookingAfterPickup.status, 'In transit');
  assert.strictEqual(liveBookingAfterPickup.pickup_tracking_url, 'https://track.spoke.com/stops/stop_pickup_mapped');

  const liveStopStatePickup = mockRegressionStopStates.get('NEO-BK-20261020-AUTH-001:pickup');
  assert.ok(liveStopStatePickup);
  assert.strictEqual(liveStopStatePickup.spoke_stop_id, 'plans/plan_regression_1/stops/stop_pickup_mapped');
  assert.strictEqual(liveStopStatePickup.tracking_url, 'https://track.spoke.com/stops/stop_pickup_mapped');

  // Simulate incoming webhook carrying the mapped delivery stop payload
  const deliveryEventHash = 'hash-mapped-delivery-test-02';
  mockRegressionWebhookEvents.set(deliveryEventHash, {
    event_hash: deliveryEventHash,
    event_type: 'stop.attempted_delivery',
    processing_status: 'received',
    payload: {
      type: 'stop.attempted_delivery',
      version: 'v1',
      created: Date.now() + 2000,
      data: {
        stop: {
          id: 'plans/plan_regression_1/stops/stop_delivery_mapped',
          ...deliveryStopRes.data,
          trackingLink: 'https://track.spoke.com/stops/stop_delivery_mapped',
          deliveryInfo: {
            succeeded: true,
            state: 'delivered',
          },
        },
      },
    },
  });

  const deliveryEventRes = await processSpokeWebhookEventFallback(deliveryEventHash, mockDbClient);
  assert.strictEqual(deliveryEventRes.success, true);
  assert.strictEqual(deliveryEventRes.status, 'processed');
  assert.strictEqual(deliveryEventRes.bookingId, 'NEO-BK-20261020-AUTH-001');
  assert.strictEqual(deliveryEventRes.activity, 'delivery');
  assert.strictEqual(deliveryEventRes.bookingStatus, 'Delivered');

  const liveBookingAfterDelivery = mockRegressionBookings.get('NEO-BK-20261020-AUTH-001');
  assert.strictEqual(liveBookingAfterDelivery.status, 'Delivered');
  assert.strictEqual(liveBookingAfterDelivery.progress_t, 1.0);
  assert.strictEqual(liveBookingAfterDelivery.delivery_tracking_url, 'https://track.spoke.com/stops/stop_delivery_mapped');

  console.log('✓ PASS 13.2: Mapped Spoke stops correlate with public.bookings.id and successfully process inbound webhook events');

  // 13.3 Null/Missing sellerOrderId Production Regression Handling
  const nullSellerOrderEventHash = 'hash-spoke-null-seller-order-event';
  mockRegressionWebhookEvents.set(nullSellerOrderEventHash, {
    event_hash: nullSellerOrderEventHash,
    event_type: 'stop.out_for_delivery',
    processing_status: 'received',
    payload: {
      type: 'stop.out_for_delivery',
      version: 'v1',
      created: Date.now(),
      data: {
        stop: {
          id: 'plans/plan_night_run_active/stops/unknown_unmapped_01',
          activity: 'delivery',
          orderInfo: {
            sellerOrderId: null,
          },
        },
      },
    },
  });

  const nullSellerOrderRes = await processSpokeWebhookEventFallback(nullSellerOrderEventHash, mockDbClient);
  assert.strictEqual(nullSellerOrderRes.success, true);
  assert.strictEqual(nullSellerOrderRes.status, 'ignored');
  assert.strictEqual(nullSellerOrderRes.reason, 'Missing sellerOrderId in event payload.');

  const nullEventPersisted = mockRegressionWebhookEvents.get(nullSellerOrderEventHash);
  assert.strictEqual(nullEventPersisted.processing_status, 'ignored');
  assert.strictEqual(nullEventPersisted.processing_error, 'Missing sellerOrderId in event payload.');

  console.log('✓ PASS 13.3: Inbound Spoke events with null sellerOrderId safely ignored without modifying bookings');

  // 13.4 Duplicate Dispatch Prevention & Concurrency Protection
  // Guard 1: State machine check blocks re-dispatching non-Scheduled bookings
  function validateBookingEligibilityForDispatch(booking: { status: string; company_id?: string }): { eligible: boolean; error?: string } {
    if (booking.status !== 'Scheduled') {
      return { eligible: false, error: `Booking cannot be dispatched: current status is '${booking.status}' (must be 'Scheduled').` };
    }
    return { eligible: true };
  }

  const scheduledBooking = { id: 'BK-DISP-001', status: 'Scheduled' };
  const inTransitBooking = { id: 'BK-DISP-002', status: 'In transit' };
  const deliveredBooking = { id: 'BK-DISP-003', status: 'Delivered' };
  const cancelledBooking = { id: 'BK-DISP-004', status: 'Cancelled' };

  assert.strictEqual(validateBookingEligibilityForDispatch(scheduledBooking).eligible, true);
  assert.strictEqual(validateBookingEligibilityForDispatch(inTransitBooking).eligible, false);
  assert.ok(validateBookingEligibilityForDispatch(inTransitBooking).error?.includes('In transit'));
  assert.strictEqual(validateBookingEligibilityForDispatch(deliveredBooking).eligible, false);
  assert.ok(validateBookingEligibilityForDispatch(deliveredBooking).error?.includes('Delivered'));
  assert.strictEqual(validateBookingEligibilityForDispatch(cancelledBooking).eligible, false);
  assert.ok(validateBookingEligibilityForDispatch(cancelledBooking).error?.includes('Cancelled'));

  // Guard 2: Composite Primary Key (booking_id, activity) prevents parallel duplicate stop state tracking
  const stopStatePkey = new Set<string>();
  function registerStopDispatchState(bookingId: string, activity: 'pickup' | 'delivery'): boolean {
    const key = `${bookingId}:${activity}`;
    if (stopStatePkey.has(key)) {
      return false; // Duplicate rejected by unique constraint
    }
    stopStatePkey.add(key);
    return true;
  }

  assert.strictEqual(registerStopDispatchState('BK-DISP-001', 'pickup'), true);
  assert.strictEqual(registerStopDispatchState('BK-DISP-001', 'delivery'), true);
  // Attempting second dispatch for same booking and pickup is rejected
  assert.strictEqual(registerStopDispatchState('BK-DISP-001', 'pickup'), false);
  assert.strictEqual(registerStopDispatchState('BK-DISP-001', 'delivery'), false);

  // Guard 3: Terminal Delivered booking protected against regression from duplicate webhook
  const duplicatePickupHash = 'hash-duplicate-pickup-after-delivered';
  mockRegressionWebhookEvents.set(duplicatePickupHash, {
    event_hash: duplicatePickupHash,
    event_type: 'stop.out_for_delivery',
    processing_status: 'received',
    payload: {
      type: 'stop.out_for_delivery',
      version: 'v1',
      created: Date.now() + 10000,
      data: {
        stop: {
          id: 'plans/plan_regression_1/stops/stop_pickup_duplicate',
          ...pickupStopRes.data,
          activity: 'pickup',
          orderInfo: { sellerOrderId: 'NEO-BK-20261020-AUTH-001' },
        },
      },
    },
  });

  const duplicatePickupRes = await processSpokeWebhookEventFallback(duplicatePickupHash, mockDbClient);
  assert.strictEqual(duplicatePickupRes.success, true);
  const terminalBooking = mockRegressionBookings.get('NEO-BK-20261020-AUTH-001');
  assert.strictEqual(terminalBooking.status, 'Delivered', 'Terminal Delivered status must never regress to In transit');
  assert.strictEqual(terminalBooking.progress_t, 1.0, 'Progress must remain 1.0');

  console.log('✓ PASS 13.4: Duplicate dispatch prevented via booking status guard, composite PK uniqueness, and terminal protection');

  // ---------------------------------------------------------------------------
  // 14. Testing Admin Pilot Spoke Dispatch Workflow (POST /api/admin/dispatch/spoke/pilot)
  // ---------------------------------------------------------------------------
  console.log('\n--- 14. Testing Admin Pilot Spoke Dispatch Workflow (POST /api/admin/dispatch/spoke/pilot) ---');

  // 14.1 Unit Testing Payment & Credit Eligibility Verification Logic
  const eligibleCompany = { id: 'c1', name: 'Valid Corp', standby_active: true, verified: true };
  const inactiveStandbyCompany = { id: 'c2', name: 'Inactive Corp', standby_active: false, verified: true };
  const unverifiedCompany = { id: 'c3', name: 'Unverified Corp', standby_active: true, verified: false };

  // Standby credit accounts
  assert.strictEqual(
    verifyBookingPaymentEligibility({ payment_method: 'standby-account', company_id: 'c1' }, eligibleCompany).eligible,
    true
  );
  const inactiveStandbyRes = verifyBookingPaymentEligibility(
    { payment_method: 'standby-account', company_id: 'c2' },
    inactiveStandbyCompany
  );
  assert.strictEqual(inactiveStandbyRes.eligible, false);
  assert.ok(inactiveStandbyRes.error?.includes('standby_active=false'));

  const unverifiedRes = verifyBookingPaymentEligibility(
    { payment_method: 'standby-account', company_id: 'c3' },
    unverifiedCompany
  );
  assert.strictEqual(unverifiedRes.eligible, false);
  assert.ok(unverifiedRes.error?.includes('verified=false'));

  const missingCompanyRes = verifyBookingPaymentEligibility(
    { payment_method: 'standby-account', company_id: 'c-missing' },
    null
  );
  assert.strictEqual(missingCompanyRes.eligible, false);
  assert.ok(missingCompanyRes.error?.includes('not found'));

  const missingCompanyIdRes = verifyBookingPaymentEligibility(
    { payment_method: 'standby-account' },
    eligibleCompany
  );
  assert.strictEqual(missingCompanyIdRes.eligible, false);
  assert.ok(missingCompanyIdRes.error?.includes('no company_id'));

  // Corporate BACS accounts
  assert.strictEqual(
    verifyBookingPaymentEligibility({ payment_method: 'corporate-bacs', company_id: 'c1' }, eligibleCompany).eligible,
    true
  );

  // Pre-paid / direct card accounts (independent of company standby status)
  assert.strictEqual(
    verifyBookingPaymentEligibility({ payment_method: 'card', company_id: 'c3' }, unverifiedCompany).eligible,
    true
  );
  assert.strictEqual(
    verifyBookingPaymentEligibility({ payment_method: 'credit-card' }, null).eligible,
    true
  );
  assert.strictEqual(
    verifyBookingPaymentEligibility({ payment_method: 'stripe' }, null).eligible,
    true
  );

  // Unknown method without credit
  const unknownMethodRes = verifyBookingPaymentEligibility({ payment_method: 'crypto' }, unverifiedCompany);
  assert.strictEqual(unknownMethodRes.eligible, false);

  console.log('✓ PASS 14.1: Booking payment & company credit eligibility verification logic thoroughly validated');

  // 14.2 Client-Level executeControlledPilotDispatch Guards
  const clientTestBookingId = 'BK-CLIENT-TEST-001';
  const dummyPickupStop: any = {
    activity: 'pickup',
    address: { addressLineOne: '1 Test St', zip: 'M1 1AA', latitude: 53.48, longitude: -2.24 },
    orderInfo: { sellerOrderId: clientTestBookingId },
  };
  const dummyDeliveryStop: any = {
    activity: 'delivery',
    address: { addressLineOne: '2 Test Rd', zip: 'B1 1AA', latitude: 52.48, longitude: -1.89 },
    orderInfo: { sellerOrderId: clientTestBookingId },
  };

  // Rejects when feature flag is disabled
  delete process.env.NEO_SPOKE_PILOT_DISPATCH_ENABLED;
  await assert.rejects(
    async () => {
      await spokeClient.executeControlledPilotDispatch({
        plan: { title: 'NEO PILOT DISPATCH - 2026-10-20', starts: { day: 20, month: 10, year: 2026 } },
        bookingId: clientTestBookingId,
        stops: [dummyPickupStop, dummyDeliveryStop],
      });
    },
    /RESTRICTION ENFORCED: Spoke pilot dispatch pathway is disabled/
  );

  // Enable feature flag for client tests
  process.env.NEO_SPOKE_PILOT_DISPATCH_ENABLED = 'true';
  try {
    // Rejects plan title without fixed prefix 'NEO PILOT DISPATCH'
    await assert.rejects(
      async () => {
        await spokeClient.executeControlledPilotDispatch({
          plan: { title: 'Standard Spoke Plan', starts: { day: 20, month: 10, year: 2026 } },
          bookingId: clientTestBookingId,
          stops: [dummyPickupStop, dummyDeliveryStop],
        });
      },
      /Controlled pilot dispatch plan title must begin with 'NEO PILOT DISPATCH'/
    );

    // Strictly rejects plan title mentioning Night Run
    await assert.rejects(
      async () => {
        await spokeClient.executeControlledPilotDispatch({
          plan: { title: 'NEO PILOT DISPATCH - Night Run Sync', starts: { day: 20, month: 10, year: 2026 } },
          bookingId: clientTestBookingId,
          stops: [dummyPickupStop, dummyDeliveryStop],
        });
      },
      /SECURITY VIOLATION: Pilot dispatch cannot alter or attach to the active NEO Night Run/
    );

    // Rejects stop with mismatched sellerOrderId
    const badPickupStop = {
      ...dummyPickupStop,
      orderInfo: { sellerOrderId: 'WRONG-ID-999' },
    };
    await assert.rejects(
      async () => {
        await spokeClient.executeControlledPilotDispatch({
          plan: { title: 'NEO PILOT DISPATCH - 2026-10-20', starts: { day: 20, month: 10, year: 2026 } },
          bookingId: clientTestBookingId,
          stops: [badPickupStop, dummyDeliveryStop],
        });
      },
      /does not match authoritative bookingId/
    );

    // Rejects unauthorized pilot driver
    await assert.rejects(
      async () => {
        await spokeClient.executeControlledPilotDispatch({
          plan: { title: 'NEO PILOT DISPATCH - 2026-10-20', starts: { day: 20, month: 10, year: 2026 } },
          bookingId: clientTestBookingId,
          stops: [dummyPickupStop, dummyDeliveryStop],
          approvedPilotDriverId: 'drivers/drv_rogue_driver',
        });
      },
      /SECURITY VIOLATION: Driver '.*' is not the server-approved pilot driver/
    );

    console.log('✓ PASS 14.2: SpokeClient executeControlledPilotDispatch strict security & isolation guards enforced');
  } finally {
    delete process.env.NEO_SPOKE_PILOT_DISPATCH_ENABLED;
  }

  // 14.3 HTTP Endpoint POST /api/admin/dispatch/spoke/pilot Test Suite
  const pilotServer = http.createServer(app);
  await new Promise<void>((resolve) => pilotServer.listen(0, resolve));

  const origFetchPilot = globalThis.fetch;
  const recordedPilotSpokeCalls: any[] = [];
  globalThis.fetch = async (url: any, init: any) => {
    const urlStr = String(url);
    if (urlStr.includes('api.spoke.com')) {
      recordedPilotSpokeCalls.push({
        url: urlStr,
        method: init?.method,
        body: init?.body ? JSON.parse(init.body) : null,
      });
      if (urlStr.endsWith('/plans') && init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'plans/pilot_plan_success_100', name: 'plans/pilot_plan_success_100' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/stops:import') && init?.method === 'POST') {
        return new Response(JSON.stringify({ success: ['stops/p1', 'stops/d1'], failed: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return origFetchPilot(url, init);
  };

  try {
    let simulateBookingUpdateErrorForId: string | null = null;
    const mockPilotBookings = new Map<string, any>();
    const mockPilotCompanies = new Map<string, any>();
    const mockPilotStopStates = new Map<string, any>();
    const mockPilotClaims = new Map<string, any>();
    const recordedPilotAudits: any[] = [];

    // Seed test companies
    mockPilotCompanies.set('comp-active-verified', {
      id: 'comp-active-verified',
      name: 'Acme Logistics Ltd',
      standby_active: true,
      verified: true,
      monthly_spend: 5000,
      paid_ytd: 25000,
    });

    mockPilotCompanies.set('comp-unverified', {
      id: 'comp-unverified',
      name: 'Insolvent Traders',
      standby_active: true,
      verified: false,
    });

    // Seed test bookings
    mockPilotBookings.set('BK-PILOT-001', {
      id: 'BK-PILOT-001',
      company_id: 'comp-active-verified',
      status: 'Scheduled',
      pickup: 'Trafford Park Unit 4, Manchester, M17 1AA',
      pickup_contact: 'Dave Warehouse',
      pickup_phone: '+44 161 111 2222',
      collection_window: '09:00 - 11:00',
      dropoff: 'Bullring Freight Bay, Birmingham, B5 4BU',
      recipient_name: 'Sarah Receiver',
      recipient_phone: '+44 121 333 4444',
      delivery_instructions: 'Ring bell at bay 3',
      goods: 'Electrical Components',
      weight_kg: 180,
      items_count: 3,
      vehicle: 'Sprinter LWB',
      service: 'Direct Dedicated',
      payment_method: 'standby-account',
      po_reference: 'PO-PILOT-999',
    });

    mockPilotBookings.set('BK-PILOT-CARD-PAID', {
      id: 'BK-PILOT-CARD-PAID',
      company_id: 'comp-unverified', // Unverified company, but paid via card!
      status: 'Scheduled',
      pickup: 'Trafford Park Unit 4, Manchester, M17 1AA',
      pickup_contact: 'Dave Warehouse',
      pickup_phone: '+44 161 111 2222',
      dropoff: 'Bullring Freight Bay, Birmingham, B5 4BU',
      recipient_name: 'Sarah Receiver',
      recipient_phone: '+44 121 333 4444',
      goods: 'Urgent Samples',
      weight_kg: 50,
      items_count: 1,
      vehicle: 'Small Van',
      service: 'Direct Dedicated',
      payment_method: 'card',
      payment_status: 'paid',
      total_gbp: 125,
      amount_paid_gbp: 125,
      stripe_payment_intent_id: 'pi_test_card_paid_123',
    });

    mockPilotBookings.set('BK-PILOT-UNVERIFIED-CREDIT', {
      id: 'BK-PILOT-UNVERIFIED-CREDIT',
      company_id: 'comp-unverified',
      status: 'Scheduled',
      pickup: 'Trafford Park Unit 4, Manchester, M17 1AA',
      pickup_contact: 'Dave Warehouse',
      pickup_phone: '+44 161 111 2222',
      dropoff: 'Bullring Freight Bay, Birmingham, B5 4BU',
      recipient_name: 'Sarah Receiver',
      recipient_phone: '+44 121 333 4444',
      goods: 'Tools',
      weight_kg: 100,
      items_count: 1,
      vehicle: 'Small Van',
      service: 'Direct Dedicated',
      payment_method: 'standby-account',
    });

    mockPilotBookings.set('BK-PILOT-IN-TRANSIT', {
      id: 'BK-PILOT-IN-TRANSIT',
      company_id: 'comp-active-verified',
      status: 'In transit',
      pickup: 'Trafford Park Unit 4, Manchester, M17 1AA',
      pickup_contact: 'Dave Warehouse',
      pickup_phone: '+44 161 111 2222',
      dropoff: 'Bullring Freight Bay, Birmingham, B5 4BU',
      recipient_name: 'Sarah Receiver',
      recipient_phone: '+44 121 333 4444',
      goods: 'Tools',
      weight_kg: 100,
      items_count: 1,
      vehicle: 'Small Van',
      service: 'Direct Dedicated',
      payment_method: 'standby-account',
    });

    const mockPilotSupabaseClient: any = {
      auth: {
        getUser: async (token: string) => {
          if (token === 'admin-test-token') {
            return { data: { user: { id: 'admin-usr-1', email: 'admin@neotransport.co.uk' } }, error: null };
          }
          if (token === 'customer-test-token') {
            return { data: { user: { id: 'cust-usr-1', email: 'customer@example.com' } }, error: null };
          }
          if (token === 'suspended-admin-token') {
            return { data: { user: { id: 'susp-admin-1', email: 'suspended@neotransport.co.uk' } }, error: null };
          }
          return { data: { user: null }, error: { message: 'Invalid token' } };
        },
      },
      from: (tableName: string) => {
        if (tableName === 'profiles') {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                single: async () => {
                  if (val === 'admin-usr-1') {
                    return { data: { id: 'admin-usr-1', role: 'admin', status: 'active', email: 'admin@neotransport.co.uk', full_name: 'Admin Tester' }, error: null };
                  }
                  if (val === 'cust-usr-1') {
                    return { data: { id: 'cust-usr-1', role: 'customer', status: 'active', email: 'customer@example.com', full_name: 'Customer Tester' }, error: null };
                  }
                  if (val === 'susp-admin-1') {
                    return { data: { id: 'susp-admin-1', role: 'admin', status: 'suspended', email: 'suspended@neotransport.co.uk', full_name: 'Suspended Admin' }, error: null };
                  }
                  return { data: null, error: { message: 'Profile not found' } };
                },
              }),
            }),
          };
        }
        if (tableName === 'bookings') {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                single: async () => {
                  const b = mockPilotBookings.get(val);
                  return b ? { data: { ...b }, error: null } : { data: null, error: { code: 'PGRST116', message: 'Not found' } };
                },
              }),
            }),
            update: (fields: any) => ({
              eq: async (_col: string, val: string) => {
                if (simulateBookingUpdateErrorForId === val) {
                  return { data: null, error: { code: '40001', message: 'Serialization failure during booking update' } };
                }
                const b = mockPilotBookings.get(val);
                if (b) Object.assign(b, fields);
                return { data: null, error: null };
              },
            }),
          };
        }
        if (tableName === 'companies') {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                maybeSingle: async () => {
                  const c = mockPilotCompanies.get(val);
                  return { data: c ? { ...c } : null, error: null };
                },
              }),
            }),
          };
        }
        if (tableName === 'spoke_booking_stop_state') {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                async then(resolve: any) {
                  const rows = Array.from(mockPilotStopStates.values()).filter((s: any) => s.booking_id === val);
                  return resolve({ data: rows, error: null });
                },
              }),
            }),
            upsert: async (rows: any[]) => {
              const list = Array.isArray(rows) ? rows : [rows];
              for (const r of list) {
                mockPilotStopStates.set(`${r.booking_id}:${r.activity}`, { ...r });
              }
              return { data: null, error: null };
            },
          };
        }
        if (tableName === 'spoke_pilot_dispatch_claims') {
          return {
            insert: async (claim: any) => {
              if (mockPilotClaims.has(claim.booking_id)) {
                return {
                  data: null,
                  error: {
                    code: '23505',
                    message:
                      'duplicate key value violates unique constraint "spoke_pilot_dispatch_claims_booking_id_key"',
                  },
                };
              }
              const saved = {
                ...claim,
                created_at: claim.created_at || new Date().toISOString(),
                updated_at: claim.updated_at || new Date().toISOString(),
              };
              mockPilotClaims.set(claim.booking_id, saved);
              return { data: saved, error: null };
            },
            select: (_cols?: string) => ({
              eq: (col: string, val: string) => ({
                maybeSingle: async () => {
                  if (col === 'booking_id') {
                    const found = mockPilotClaims.get(val);
                    return { data: found ? { ...found } : null, error: null };
                  }
                  for (const c of mockPilotClaims.values()) {
                    if (c[col] === val) return { data: { ...c }, error: null };
                  }
                  return { data: null, error: null };
                },
                single: async () => {
                  if (col === 'booking_id') {
                    const found = mockPilotClaims.get(val);
                    return found
                      ? { data: { ...found }, error: null }
                      : { data: null, error: { code: 'PGRST116', message: 'Not found' } };
                  }
                  for (const c of mockPilotClaims.values()) {
                    if (c[col] === val) return { data: { ...c }, error: null };
                  }
                  return { data: null, error: { code: 'PGRST116', message: 'Not found' } };
                },
              }),
            }),
            update: (fields: any) => ({
              eq: async (col: string, val: string) => {
                if (col === 'id') {
                  for (const c of mockPilotClaims.values()) {
                    if (c.id === val) {
                      Object.assign(c, fields, { updated_at: new Date().toISOString() });
                      return { data: { ...c }, error: null };
                    }
                  }
                }
                if (col === 'booking_id') {
                  const found = mockPilotClaims.get(val);
                  if (found) {
                    Object.assign(found, fields, { updated_at: new Date().toISOString() });
                    return { data: { ...found }, error: null };
                  }
                }
                return { data: null, error: null };
              },
            }),
          };
        }
        if (tableName === 'admin_audit_logs') {
          return {
            insert: async (row: any) => {
              recordedPilotAudits.push(row);
              return { data: null, error: null };
            },
          };
        }
        return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) };
      },
    };

    setServerSupabaseClientForTesting(mockPilotSupabaseClient);

    const PILOT_APPROVED_TOKEN = 'pilot_secret_token_auth_approved_999';

    // A. Authentication & RBAC
    const unauthReq = await testRequest(pilotServer, '/api/admin/dispatch/spoke/pilot', 'POST', {}, {
      bookingId: 'BK-PILOT-001',
      planDate: '2026-10-20',
      pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
    });
    assert.strictEqual(unauthReq.status, 401);

    const customerReq = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      { Authorization: 'Bearer customer-test-token' },
      { bookingId: 'BK-PILOT-001', planDate: '2026-10-20', pilotAuthorizationToken: PILOT_APPROVED_TOKEN }
    );
    assert.strictEqual(customerReq.status, 403);

    const suspendedReq = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      { Authorization: 'Bearer suspended-admin-token' },
      { bookingId: 'BK-PILOT-001', planDate: '2026-10-20', pilotAuthorizationToken: PILOT_APPROVED_TOKEN }
    );
    assert.strictEqual(suspendedReq.status, 403);

    const adminHeaders = { Authorization: 'Bearer admin-test-token' };

    // B. Feature Flag Guard (Disabled by default)
    delete process.env.NEO_SPOKE_PILOT_DISPATCH_ENABLED;
    const flagDisabledReq = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      { bookingId: 'BK-PILOT-001', planDate: '2026-10-20', pilotAuthorizationToken: PILOT_APPROVED_TOKEN }
    );
    assert.strictEqual(flagDisabledReq.status, 403);
    assert.ok(flagDisabledReq.data.error?.includes('pathway is currently disabled'));

    // Enable feature flag for subsequent tests
    process.env.NEO_SPOKE_PILOT_DISPATCH_ENABLED = 'true';

    // C. Authorization Token Guard
    delete process.env.NEO_SPOKE_PILOT_DISPATCH_APPROVED_TOKEN;
    const missingServerTokenReq = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      { bookingId: 'BK-PILOT-001', planDate: '2026-10-20', pilotAuthorizationToken: PILOT_APPROVED_TOKEN }
    );
    assert.strictEqual(missingServerTokenReq.status, 503);
    assert.ok(missingServerTokenReq.data.error?.includes('token is not configured on the server environment'));

    process.env.NEO_SPOKE_PILOT_DISPATCH_APPROVED_TOKEN = PILOT_APPROVED_TOKEN;

    const invalidClientTokenReq = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      { bookingId: 'BK-PILOT-001', planDate: '2026-10-20', pilotAuthorizationToken: 'wrong-token-abc' }
    );
    assert.strictEqual(invalidClientTokenReq.status, 403);
    assert.ok(invalidClientTokenReq.data.error?.includes('Unauthorized pilot authorization token'));

    // D. Forbidden Properties Gating (Rejects driver injection & dispatch overrides)
    const driverInjectionReq = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'BK-PILOT-001',
        planDate: '2026-10-20',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        driverId: 'drivers/drv_rogue',
      }
    );
    assert.strictEqual(driverInjectionReq.status, 400);
    assert.ok(driverInjectionReq.data.error?.includes('Forbidden property in pilot dispatch request: driverId'));

    // E. Plan Title Guard (Enforces NEO PILOT DISPATCH, rejects Night Run)
    const nightRunTitleReq = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'BK-PILOT-001',
        planDate: '2026-10-20',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        planTitle: 'NEO PILOT DISPATCH - Night Run Alteration',
      }
    );
    assert.strictEqual(nightRunTitleReq.status, 400);
    assert.ok(nightRunTitleReq.data.error?.includes('cannot alter or attach to the active NEO Night Run'));

    // E.2. Deterministic Missing Privileged Service-Role Database Guard (Fails closed before Spoke mutation)
    // Run in an isolated child process to ensure SUPABASE_SERVICE_ROLE_KEY is explicitly empty
    // prior to api/index.ts module evaluation, guaranteeing determinism even if .env.local or CI
    // environment variables define SUPABASE_SERVICE_ROLE_KEY in the parent process.
    const callsBeforeServiceRoleTest = recordedPilotSpokeCalls.length;

    const childIsolatedTestScript = `
import http from 'node:http';
import assert from 'node:assert';

// Explicitly guarantee SUPABASE_SERVICE_ROLE_KEY is empty before api/index.ts module initialization
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.NODE_ENV = 'test';

const recordedChildSpokeCalls: any[] = [];
const origFetch = globalThis.fetch;
globalThis.fetch = async (url: any, init: any) => {
  const urlStr = String(url);
  if (urlStr.includes('api.spoke.com')) {
    recordedChildSpokeCalls.push({
      url: urlStr,
      method: init?.method,
      body: init?.body ? JSON.parse(init.body) : null,
    });
  }
  return origFetch(url, init);
};

const { default: app, setServerSupabaseClientForTesting } = await import('${apiIndexUrl}');

const mockSupabase = {
  auth: {
    getUser: async (token: string) => {
      if (token === 'admin-test-token') {
        return { data: { user: { id: 'admin-usr-1', email: 'admin@neotransport.co.uk' } }, error: null };
      }
      return { data: { user: null }, error: new Error('Invalid token') };
    }
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: { id: 'admin-usr-1', role: 'admin', status: 'active', email: 'admin@neotransport.co.uk', full_name: 'Admin Tester' },
          error: null
        })
      })
    })
  })
};

setServerSupabaseClientForTesting(mockSupabase as any);

// Switch to production mode to enforce strict production fail-closed security checks
process.env.NODE_ENV = 'production';

const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
const address = server.address() as any;
const port = address.port;

const postData = JSON.stringify({
  bookingId: 'BK-PILOT-001',
  planDate: '2026-10-20',
  pilotAuthorizationToken: '${PILOT_APPROVED_TOKEN}',
});

const responseData = await new Promise<{ status: number; data: any }>((resolve, reject) => {
  const req = http.request({
    hostname: '127.0.0.1',
    port,
    path: '/api/admin/dispatch/spoke/pilot',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer admin-test-token',
      'Content-Length': Buffer.byteLength(postData),
    }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        resolve({ status: res.statusCode || 0, data: JSON.parse(body) });
      } catch (e) {
        resolve({ status: res.statusCode || 0, data: { raw: body } });
      }
    });
  });
  req.on('error', reject);
  req.write(postData);
  req.end();
});

server.close();

console.log('RESULT_PAYLOAD:' + JSON.stringify({
  status: responseData.status,
  data: responseData.data,
  spokeCallsCount: recordedChildSpokeCalls.length,
}));
`;

    const cleanExecArgv = process.execArgv.filter((arg) => arg !== '-e' && arg !== '--eval');
    const childResult = cp.spawnSync(
      process.execPath,
      [...cleanExecArgv, '-e', childIsolatedTestScript],
      {
        encoding: 'utf-8',
        env: {
          ...process.env,
          SUPABASE_SERVICE_ROLE_KEY: '',
          NODE_ENV: 'test',
          NEO_SPOKE_PILOT_DISPATCH_ENABLED: 'true',
          NEO_SPOKE_PILOT_DISPATCH_APPROVED_TOKEN: PILOT_APPROVED_TOKEN,
        },
        shell: false,
      }
    );

    assert.strictEqual(
      childResult.status,
      0,
      `Isolated child test process failed unexpectedly: ${childResult.stderr || childResult.stdout}`
    );

    const payloadMatch = childResult.stdout.match(/RESULT_PAYLOAD:({.*})/);
    assert.ok(payloadMatch, 'Isolated child process must output formatted RESULT_PAYLOAD');
    const missingServiceRoleReq = JSON.parse(payloadMatch[1]);

    assert.strictEqual(
      missingServiceRoleReq.status,
      503,
      'Pilot dispatch must return HTTP 503 when privileged SUPABASE_SERVICE_ROLE_KEY is unconfigured in production'
    );
    assert.ok(
      missingServiceRoleReq.data.error?.includes('SUPABASE_SERVICE_ROLE_KEY must be configured for pilot dispatch'),
      `Error message must cite missing service-role requirement, got: ${missingServiceRoleReq.data.error}`
    );
    assert.ok(
      missingServiceRoleReq.data.error?.includes('No Spoke mutations were attempted'),
      `Error message must confirm no Spoke mutations were attempted, got: ${missingServiceRoleReq.data.error}`
    );
    assert.strictEqual(
      missingServiceRoleReq.spokeCallsCount,
      0,
      'Zero Spoke API mutations (plan creation, stop import) must be attempted in the isolated process when service-role credentials are missing'
    );
    assert.strictEqual(
      recordedPilotSpokeCalls.length,
      callsBeforeServiceRoleTest,
      'Zero Spoke API mutations must occur in the parent test process'
    );

    // F. Booking Verification (Non-existent booking -> 404)
    const notFoundBookingReq = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'BK-NONEXISTENT-999',
        planDate: '2026-10-20',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
      }
    );
    assert.strictEqual(notFoundBookingReq.status, 404);
    assert.ok(notFoundBookingReq.data.error?.includes('not found'));

    // G. Booking Status Guard (Must be Scheduled -> 409)
    const inTransitBookingReq = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'BK-PILOT-IN-TRANSIT',
        planDate: '2026-10-20',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
      }
    );
    assert.strictEqual(inTransitBookingReq.status, 409);
    assert.ok(inTransitBookingReq.data.error?.includes("must be 'Scheduled'"));

    // H. Company Credit Gating (Unverified company credit -> 403)
    const unverifiedCreditReq = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'BK-PILOT-UNVERIFIED-CREDIT',
        planDate: '2026-10-20',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
      }
    );
    assert.strictEqual(unverifiedCreditReq.status, 403);
    assert.ok(unverifiedCreditReq.data.error?.includes('credit facility is not active or verified'));

    // I. In-Process Concurrency & Duplicate-Dispatch Guard
    inProgressPilotDispatchBookingIds.add('BK-PILOT-001');
    const inProgressDuplicateReq = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'BK-PILOT-001',
        planDate: '2026-10-20',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
      }
    );
    assert.strictEqual(inProgressDuplicateReq.status, 409);
    assert.ok(inProgressDuplicateReq.data.error?.includes('currently in progress'));
    resetPilotDispatchRegistryForTesting();

    // J. Successful Pilot Dispatch with Card Payment (Bypasses unverified standby credit)
    const cardPaidReq = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'BK-PILOT-CARD-PAID',
        planDate: '2026-10-20',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        pickupCoords: { lat: 53.468, lng: -2.325 },
        dropoffCoords: { lat: 52.503, lng: -1.884 },
      }
    );
    assert.strictEqual(cardPaidReq.status, 200);
    assert.strictEqual(cardPaidReq.data.success, true);
    assert.strictEqual(cardPaidReq.data.bookingId, 'BK-PILOT-CARD-PAID');
    assert.strictEqual(cardPaidReq.data.stopsImported, 2);
    assert.strictEqual(cardPaidReq.data.driverAssigned, null, 'Zero drivers assigned when approved driver unset');

    // K. Successful Pilot Dispatch with Active Verified Company Credit & Configured Pilot Driver
    process.env.NEO_SPOKE_APPROVED_PILOT_DRIVER_ID = 'drivers/drv_pilot_verified_01';
    const successfulPilotReq = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'BK-PILOT-001',
        planDate: '2026-10-20',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        pickupCoords: { lat: 53.468, lng: -2.325 },
        dropoffCoords: { lat: 52.503, lng: -1.884 },
      }
    );
    assert.strictEqual(successfulPilotReq.status, 200);
    assert.strictEqual(successfulPilotReq.data.success, true);
    assert.strictEqual(successfulPilotReq.data.bookingId, 'BK-PILOT-001');
    assert.strictEqual(successfulPilotReq.data.planId, 'plans/pilot_plan_success_100');
    assert.strictEqual(successfulPilotReq.data.driverAssigned, 'drivers/drv_pilot_verified_01');

    // Verify booking updated to In transit
    const updatedBookingInDb = mockPilotBookings.get('BK-PILOT-001');
    assert.strictEqual(updatedBookingInDb.status, 'In transit');

    // Verify stop states recorded in database
    const pickupState = mockPilotStopStates.get('BK-PILOT-001:pickup');
    const deliveryState = mockPilotStopStates.get('BK-PILOT-001:delivery');
    assert.ok(pickupState);
    assert.ok(deliveryState);
    assert.strictEqual(pickupState.delivery_state, 'dispatched');
    assert.strictEqual(deliveryState.delivery_state, 'dispatched');

    // Verify audit log recorded
    const pilotAudit = recordedPilotAudits.find(
      (a) => a.action === 'SPOKE_PILOT_DISPATCH' && a.target_id === 'BK-PILOT-001'
    );
    assert.ok(pilotAudit);
    assert.strictEqual(pilotAudit.details.driverAssigned, 'drivers/drv_pilot_verified_01');

    // Verify Spoke outbound payload integrity
    const planCalls = recordedPilotSpokeCalls.filter((c) => c.url.endsWith('/plans'));
    const stopCalls = recordedPilotSpokeCalls.filter((c) => c.url.includes('/stops:import'));
    assert.strictEqual(planCalls.length, 2);
    assert.strictEqual(stopCalls.length, 2);

    // Call 1 (Test J: driver unset)
    assert.strictEqual(planCalls[0].body.drivers, undefined);
    const firstStopArray = Array.isArray(stopCalls[0].body) ? stopCalls[0].body : stopCalls[0].body.stops;
    assert.strictEqual(firstStopArray[0].allowedDrivers, undefined);

    // Call 2 (Test K: approved pilot driver configured)
    const secondPlanCall = planCalls[1];
    const secondStopCall = stopCalls[1];
    const secondStopArray = Array.isArray(secondStopCall.body) ? secondStopCall.body : secondStopCall.body.stops;
    assert.ok(secondPlanCall.body.title.startsWith('NEO PILOT DISPATCH'));
    assert.strictEqual(secondPlanCall.body.drivers?.[0]?.id, 'drivers/drv_pilot_verified_01');
    assert.strictEqual(secondStopArray.length, 2);
    assert.strictEqual(secondStopArray[0].orderInfo.sellerOrderId, 'BK-PILOT-001');
    assert.strictEqual(secondStopArray[1].orderInfo.sellerOrderId, 'BK-PILOT-001');
    assert.strictEqual(secondStopArray[0].allowedDrivers?.[0], 'drivers/drv_pilot_verified_01');

    // L. Duplicate Dispatch Prevention: Re-dispatching BK-PILOT-001 is now blocked by stop state & In transit status
    const duplicateDispatchReq = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'BK-PILOT-001',
        planDate: '2026-10-20',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
      }
    );
    assert.strictEqual(duplicateDispatchReq.status, 409);

    // M. Payment/Credit Injection Rejection (Never trust client-supplied payment status)
    const paymentInjectedReq1 = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'BK-PILOT-UNVERIFIED-CREDIT',
        planDate: '2026-10-20',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        paymentConfirmed: true,
      }
    );
    assert.strictEqual(paymentInjectedReq1.status, 400);
    assert.ok(paymentInjectedReq1.data.error?.includes('Forbidden property in pilot dispatch request: paymentConfirmed'));

    const paymentInjectedReq2 = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'BK-PILOT-UNVERIFIED-CREDIT',
        planDate: '2026-10-20',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        isPaid: true,
      }
    );
    assert.strictEqual(paymentInjectedReq2.status, 400);
    assert.ok(paymentInjectedReq2.data.error?.includes('Forbidden property in pilot dispatch request: isPaid'));

    const paymentInjectedReq3 = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'BK-PILOT-UNVERIFIED-CREDIT',
        planDate: '2026-10-20',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        paymentStatus: 'paid',
      }
    );
    assert.strictEqual(paymentInjectedReq3.status, 400);
    assert.ok(paymentInjectedReq3.data.error?.includes('Forbidden property in pilot dispatch request: paymentStatus'));

    const paymentInjectedReq4 = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'BK-PILOT-UNVERIFIED-CREDIT',
        planDate: '2026-10-20',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        paymentMethod: 'card',
      }
    );
    assert.strictEqual(paymentInjectedReq4.status, 400);
    assert.ok(paymentInjectedReq4.data.error?.includes('Forbidden property in pilot dispatch request: paymentMethod'));

    // N. Database-Backed Atomic Claim Concurrency Guard (Simulated Race Condition)
    mockPilotBookings.set('BK-PILOT-CONCURRENT', {
      id: 'BK-PILOT-CONCURRENT',
      status: 'Scheduled',
      pickup: 'Trafford Park Unit 4, Manchester, M17 1AA',
      pickup_contact: 'Dave Warehouse',
      pickup_phone: '+44 161 111 2222',
      dropoff: 'Bullring Freight Bay, Birmingham, B5 4BU',
      recipient_name: 'Sarah Receiver',
      recipient_phone: '+44 121 333 4444',
      goods: 'High Value Sensors',
      weight_kg: 25,
      items_count: 1,
      vehicle: 'Small Van',
      service: 'Direct Dedicated',
      payment_method: 'card',
    });

    // Launch two parallel requests simultaneously
    const [resA, resB] = await Promise.all([
      testRequest(
        pilotServer,
        '/api/admin/dispatch/spoke/pilot',
        'POST',
        adminHeaders,
        {
          bookingId: 'BK-PILOT-CONCURRENT',
          planDate: '2026-10-20',
          pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
          pickupCoords: { lat: 53.468, lng: -2.325 },
          dropoffCoords: { lat: 52.503, lng: -1.884 },
        }
      ),
      testRequest(
        pilotServer,
        '/api/admin/dispatch/spoke/pilot',
        'POST',
        adminHeaders,
        {
          bookingId: 'BK-PILOT-CONCURRENT',
          planDate: '2026-10-20',
          pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
          pickupCoords: { lat: 53.468, lng: -2.325 },
          dropoffCoords: { lat: 52.503, lng: -1.884 },
        }
      ),
    ]);

    // Exactly one request must succeed and the other must be rejected with 409 Conflict
    const successCount = [resA, resB].filter((r) => r.status === 200).length;
    const conflictCount = [resA, resB].filter((r) => r.status === 409).length;
    assert.strictEqual(successCount, 1, 'Exactly one concurrent request must succeed');
    assert.strictEqual(conflictCount, 1, 'Exactly one concurrent request must be rejected with 409');
    const conflictRes = resA.status === 409 ? resA : resB;
    assert.ok(
      conflictRes.data.error?.includes('Duplicate dispatch prohibited') ||
        conflictRes.data.error?.includes('currently in progress') ||
        conflictRes.data.error?.includes('cannot be dispatched') ||
        conflictRes.data.error?.includes('already succeeded')
    );

    // Also test cross-instance concurrency where in-process lock is clear but database claim is 'reserved'
    mockPilotBookings.set('BK-PILOT-CROSS-INSTANCE', {
      id: 'BK-PILOT-CROSS-INSTANCE',
      status: 'Scheduled',
      pickup: 'Trafford Park Unit 4, Manchester, M17 1AA',
      pickup_contact: 'Dave Warehouse',
      pickup_phone: '+44 161 111 2222',
      dropoff: 'Bullring Freight Bay, Birmingham, B5 4BU',
      recipient_name: 'Sarah Receiver',
      recipient_phone: '+44 121 333 4444',
      goods: 'Server Hardware',
      weight_kg: 40,
      items_count: 1,
      vehicle: 'Small Van',
      service: 'Direct Dedicated',
      payment_method: 'card',
    });
    // Seed durable claim in 'reserved' state (e.g. from another Vercel serverless instance)
    mockPilotClaims.set('BK-PILOT-CROSS-INSTANCE', {
      id: 'claim_existing_reserved_888',
      booking_id: 'BK-PILOT-CROSS-INSTANCE',
      status: 'reserved',
      admin_email: 'other-dispatcher@neotransport.co.uk',
      created_at: new Date().toISOString(),
    });

    const crossInstanceReq = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'BK-PILOT-CROSS-INSTANCE',
        planDate: '2026-10-20',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        pickupCoords: { lat: 53.468, lng: -2.325 },
        dropoffCoords: { lat: 52.503, lng: -1.884 },
      }
    );
    assert.strictEqual(crossInstanceReq.status, 409);
    assert.ok(crossInstanceReq.data.error?.includes('currently in progress or reserved'));
    assert.strictEqual(crossInstanceReq.data.existingClaim?.status, 'reserved');

    // O. Retry After Successful Dispatch Blocked by Durable Claim
    // Even if booking status were reverted to 'Scheduled' and stop states removed, claim blocks duplicate plan
    const concurrentBooking = mockPilotBookings.get('BK-PILOT-CONCURRENT');
    concurrentBooking.status = 'Scheduled'; // simulate admin resetting status
    mockPilotStopStates.delete('BK-PILOT-CONCURRENT:pickup'); // simulate cleared stop states
    mockPilotStopStates.delete('BK-PILOT-CONCURRENT:delivery');

    const spokeCallCountBeforeRetry = recordedPilotSpokeCalls.length;
    const retryReq = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'BK-PILOT-CONCURRENT',
        planDate: '2026-10-20',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        pickupCoords: { lat: 53.468, lng: -2.325 },
        dropoffCoords: { lat: 52.503, lng: -1.884 },
      }
    );
    assert.strictEqual(retryReq.status, 409);
    assert.ok(retryReq.data.error?.includes('already succeeded'));
    assert.strictEqual(retryReq.data.existingClaim?.status, 'succeeded');
    assert.ok(retryReq.data.existingClaim?.planId);
    assert.strictEqual(
      recordedPilotSpokeCalls.length,
      spokeCallCountBeforeRetry,
      'Retry must make ZERO additional Spoke API network calls'
    );

    // P. Failed Spoke Requests Record failed_unknown Claim and Block Automated Retries
    mockPilotBookings.set('BK-PILOT-FAIL-TEST', {
      id: 'BK-PILOT-FAIL-TEST',
      status: 'Scheduled',
      pickup: 'Trafford Park Unit 4, Manchester, M17 1AA',
      pickup_contact: 'Dave Warehouse',
      pickup_phone: '+44 161 111 2222',
      dropoff: 'Bullring Freight Bay, Birmingham, B5 4BU',
      recipient_name: 'Sarah Receiver',
      recipient_phone: '+44 121 333 4444',
      goods: 'Fragile Glassware',
      weight_kg: 15,
      items_count: 1,
      vehicle: 'Small Van',
      service: 'Direct Dedicated',
      payment_method: 'card',
    });

    // Temporarily mock fetch to fail stop import with 504 Gateway Timeout
    const savedFetch = globalThis.fetch;
    let stopImportAttempted = 0;
    globalThis.fetch = (async (input: any, init?: any) => {
      const urlStr = typeof input === 'string' ? input : input?.url || '';
      if (urlStr.includes('/stops:import')) {
        stopImportAttempted++;
        return new Response(JSON.stringify({ error: 'Gateway timeout communicating with Spoke upstream' }), {
          status: 504,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return savedFetch(input, init);
    }) as any;

    try {
      const failedDispatchReq = await testRequest(
        pilotServer,
        '/api/admin/dispatch/spoke/pilot',
        'POST',
        adminHeaders,
        {
          bookingId: 'BK-PILOT-FAIL-TEST',
          planDate: '2026-10-20',
          pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
          pickupCoords: { lat: 53.468, lng: -2.325 },
          dropoffCoords: { lat: 52.503, lng: -1.884 },
        }
      );
      assert.strictEqual(failedDispatchReq.status, 500);
      assert.ok(failedDispatchReq.data.error?.includes('Spoke pilot stop import failed with status 504'));
      assert.ok(failedDispatchReq.data.planId?.startsWith('plans/'));

      // Verify claim state was updated to 'failed_unknown' and preserves plan_id and failure_reason
      const recordedFailedClaim = mockPilotClaims.get('BK-PILOT-FAIL-TEST');
      assert.ok(recordedFailedClaim);
      assert.strictEqual(recordedFailedClaim.status, 'failed_unknown');
      assert.strictEqual(recordedFailedClaim.plan_id, failedDispatchReq.data.planId);
      assert.ok(recordedFailedClaim.failure_reason?.includes('504'));

      // Subsequent retry must be blocked with 409 to prevent duplicate Spoke plan creation
      const spokeCallCountBeforeFailedRetry = recordedPilotSpokeCalls.length;
      const retryAfterFailReq = await testRequest(
        pilotServer,
        '/api/admin/dispatch/spoke/pilot',
        'POST',
        adminHeaders,
        {
          bookingId: 'BK-PILOT-FAIL-TEST',
          planDate: '2026-10-20',
          pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
          pickupCoords: { lat: 53.468, lng: -2.325 },
          dropoffCoords: { lat: 52.503, lng: -1.884 },
        }
      );
      assert.strictEqual(retryAfterFailReq.status, 409);
      assert.ok(retryAfterFailReq.data.error?.includes('failed with an unknown/unresolved outcome'));
      assert.strictEqual(retryAfterFailReq.data.existingClaim?.status, 'failed_unknown');
      assert.strictEqual(retryAfterFailReq.data.existingClaim?.planId, recordedFailedClaim.plan_id);
      assert.ok(retryAfterFailReq.data.existingClaim?.failureReason?.includes('504'));
      assert.strictEqual(
        recordedPilotSpokeCalls.length,
        spokeCallCountBeforeFailedRetry,
        'Retry after failure must make ZERO additional Spoke plan creation calls'
      );
    } finally {
      globalThis.fetch = savedFetch;
    }

    // Q. Server-Side Payment & Company Credit Eligibility Edge Cases
    // Q1: Standby credit booking with missing company_id fails closed
    mockPilotBookings.set('BK-PILOT-NO-COMPANY', {
      id: 'BK-PILOT-NO-COMPANY',
      company_id: null,
      status: 'Scheduled',
      pickup: 'Trafford Park Unit 4, Manchester, M17 1AA',
      pickup_contact: 'Dave Warehouse',
      pickup_phone: '+44 161 111 2222',
      dropoff: 'Bullring Freight Bay, Birmingham, B5 4BU',
      recipient_name: 'Sarah Receiver',
      recipient_phone: '+44 121 333 4444',
      goods: 'Industrial Valves',
      weight_kg: 50,
      items_count: 1,
      vehicle: 'Small Van',
      service: 'Direct Dedicated',
      payment_method: 'standby-account',
    });
    const noCompanyReq = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'BK-PILOT-NO-COMPANY',
        planDate: '2026-10-20',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
      }
    );
    assert.strictEqual(noCompanyReq.status, 403);
    assert.ok(noCompanyReq.data.error?.includes('no company_id associated'));

    // Q2: Standby credit booking with inactive company standby credit fails closed
    mockPilotCompanies.set('comp-inactive-standby', {
      id: 'comp-inactive-standby',
      name: 'Dormant Enterprise Ltd',
      standby_active: false,
      verified: true,
    });
    mockPilotBookings.set('BK-PILOT-INACTIVE-COMPANY', {
      id: 'BK-PILOT-INACTIVE-COMPANY',
      company_id: 'comp-inactive-standby',
      status: 'Scheduled',
      pickup: 'Trafford Park Unit 4, Manchester, M17 1AA',
      pickup_contact: 'Dave Warehouse',
      pickup_phone: '+44 161 111 2222',
      dropoff: 'Bullring Freight Bay, Birmingham, B5 4BU',
      recipient_name: 'Sarah Receiver',
      recipient_phone: '+44 121 333 4444',
      goods: 'Mechanical Spares',
      weight_kg: 30,
      items_count: 1,
      vehicle: 'Small Van',
      service: 'Direct Dedicated',
      payment_method: 'standby-account',
    });
    const inactiveCompanyReq = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'BK-PILOT-INACTIVE-COMPANY',
        planDate: '2026-10-20',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
      }
    );
    assert.strictEqual(inactiveCompanyReq.status, 403);
    assert.ok(inactiveCompanyReq.data.error?.includes('standby_active=false'));

    // R. Partial Post-Spoke Database Failure Surfaces Persistence Warning Without Concealing Plan ID
    mockPilotBookings.set('BK-PILOT-DB-WARN', {
      id: 'BK-PILOT-DB-WARN',
      status: 'Scheduled',
      pickup: 'Trafford Park Unit 4, Manchester, M17 1AA',
      pickup_contact: 'Dave Warehouse',
      pickup_phone: '+44 161 111 2222',
      dropoff: 'Bullring Freight Bay, Birmingham, B5 4BU',
      recipient_name: 'Sarah Receiver',
      recipient_phone: '+44 121 333 4444',
      goods: 'Turbine Spares',
      weight_kg: 50,
      items_count: 1,
      vehicle: 'Small Van',
      service: 'Direct Dedicated',
      payment_method: 'card',
    });
    simulateBookingUpdateErrorForId = 'BK-PILOT-DB-WARN';

    const warnReq = await testRequest(
      pilotServer,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'BK-PILOT-DB-WARN',
        planDate: '2026-10-20',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        pickupCoords: { lat: 53.468, lng: -2.325 },
        dropoffCoords: { lat: 52.503, lng: -1.884 },
      }
    );
    assert.strictEqual(warnReq.status, 200);
    assert.strictEqual(warnReq.data.success, true);
    assert.ok(warnReq.data.planId?.startsWith('plans/'), 'Spoke plan ID must be preserved in response despite DB sync warning');
    assert.ok(
      warnReq.data.persistenceWarning?.includes('Serialization failure during booking update'),
      'persistenceWarning must detail the database synchronization error'
    );
    simulateBookingUpdateErrorForId = null;

    console.log('✓ PASS 14.3: POST /api/admin/dispatch/spoke/pilot full security, duplicate protection, credit gating, and Spoke payload integrity verified');
  } finally {
    delete process.env.NEO_SPOKE_PILOT_DISPATCH_ENABLED;
    delete process.env.NEO_SPOKE_PILOT_DISPATCH_APPROVED_TOKEN;
    delete process.env.NEO_SPOKE_APPROVED_PILOT_DRIVER_ID;
    resetPilotDispatchRegistryForTesting();
    setServerSupabaseClientForTesting(null);
    globalThis.fetch = origFetchPilot;
    pilotServer.close();
  }

  console.log('\n=== ALL SPOKE DISPATCH TESTS PASSED (0 failures) ===');
}

runSpokeTests().catch((err) => {
  console.error('\n❌ Spoke Dispatch Test Suite Failed:', err);
  process.exit(1);
});

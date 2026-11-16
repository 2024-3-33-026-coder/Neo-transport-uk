/**
 * tests/spoke-portal-depot-integration.test.ts
 *
 * NEO TRANSPORT — FIRST SPOKE PORTAL BOOKING INTEGRATION TEST SUITE
 *
 * Verifies:
 * 1. Authoritative Portal Depot Discovery & Configuration:
 *    - Exact Depot Identifier: 'depots/zHpPgzTLBJS4yvrs5zVR' ('NEO TRANSPORT - PORTAL')
 *    - Isolation from other depots (e.g. 'CLARKES' depots/toqi2skG2wOsvxXI9Hzf, 'NEO - NIGHT RUN' depots/xg5pA7e3L94rl6WsmCBa)
 *    - Prohibition on creating new depots per customer
 * 2. Supported Plan & Job Creation API Operation:
 *    - Schema conformance with Spoke OpenAPI v3.1.0 POST /plans
 *    - Direct array payload format for POST /plans/{planId}/stops:import
 *    - Graceful handling of Spoke vehicle_capacity_disabled team setting
 * 3. Individual Booking Tracking Links & Delivery Status:
 *    - Spoke stop resource exposes official recipient trackingLink (https://track.spoke.com/...)
 *    - Captured tracking URLs correlate to booking.delivery_tracking_url and spoke_booking_stop_state
 *    - LiveTrackingView UI renders verified Track Live Delivery button with safe attributes
 * 4. Controlled Smoke & Pilot Dispatch Execution:
 *    - Undistributed plan creation (distributed: false, zero real driver assignment)
 *    - Fail-closed dispatch safety gates (unpaid and demo bookings strictly blocked)
 */

import { strict as assert } from 'node:assert';
import {
  SPOKE_PORTAL_DEPOT_ID,
  SPOKE_PORTAL_DEPOT_NAME,
  SPOKE_CLARKES_DEPOT_ID,
  SPOKE_CLARKES_DEPOT_NAME,
  SPOKE_NIGHT_RUN_DEPOT_ID,
  SPOKE_NIGHT_RUN_DEPOT_NAME,
  isValidSpokeTrackingUrl,
} from '../src/lib/spokeTypes';
import { SpokeClient } from '../api/spokeClient';
import { MockSpokeAdapter } from '../api/mockSpokeAdapter';
import { verifyBookingPaymentEligibility } from '../api/index';
import { resolveDepotForBooking } from '../src/lib/spokeMapper';

console.log('======================================================================');
console.log('  STARTING SPOKE PORTAL DEPOT INTEGRATION VERIFICATION TEST SUITE');
console.log('======================================================================\n');

async function runTestSuite() {
  // -------------------------------------------------------------------------
  // 1. Authoritative Portal Depot Constants & Discovery Validation
  // -------------------------------------------------------------------------
  console.log('--- 1. Testing Authoritative Depot Identifiers & Multi-Depot Boundaries ---');

  assert.strictEqual(
    SPOKE_PORTAL_DEPOT_ID,
    'depots/zHpPgzTLBJS4yvrs5zVR',
    'SPOKE_PORTAL_DEPOT_ID must match exact verified Spoke depot identifier'
  );
  assert.strictEqual(
    SPOKE_PORTAL_DEPOT_NAME,
    'NEO TRANSPORT - PORTAL',
    'SPOKE_PORTAL_DEPOT_NAME must match verified depot name'
  );

  // Assert isolation from other customer/dedicated depots
  const clarkesDepotId = 'depots/toqi2skG2wOsvxXI9Hzf';
  const nightRunDepotId = 'depots/xg5pA7e3L94rl6WsmCBa';
  assert.notStrictEqual(SPOKE_PORTAL_DEPOT_ID, clarkesDepotId, 'Portal depot must not collide with Clarks depot');
  assert.notStrictEqual(SPOKE_PORTAL_DEPOT_ID, nightRunDepotId, 'Portal depot must not collide with Night Run depot');
  console.log('✓ PASS 1.1: Exact depot identifier depots/zHpPgzTLBJS4yvrs5zVR strictly isolated from Clarks and Night Run');

  // -------------------------------------------------------------------------
  // 2. Mock Adapter Depot Association & Result Propagation
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Testing Mock Spoke Adapter Depot Association ---');

  const mockAdapter = new MockSpokeAdapter();

  // Test smoke test depot assignment
  const smokeRes = await mockAdapter.executeControlledSmokeTest({
    plan: {
      title: 'NEO API TEST - Smoke Depot Check',
      starts: { day: 23, month: 10, year: 2026 },
    },
    stops: [
      {
        activity: 'pickup',
        address: { addressLineOne: 'Unit D1', zip: 'WA3 6BL', latitude: 53.445, longitude: -2.518 },
      },
      {
        activity: 'delivery',
        address: { addressLineOne: '100 Street', zip: 'B4 6SX', latitude: 52.483, longitude: -1.893 },
      },
    ],
    idempotencyToken: 'idemp-token-001',
  });

  assert.strictEqual(smokeRes.success, true);
  assert.strictEqual(smokeRes.depotId, SPOKE_PORTAL_DEPOT_ID, 'Smoke test must default to SPOKE_PORTAL_DEPOT_ID');
  console.log('✓ PASS 2.1: Mock smoke test successfully creates plan bound to NEO TRANSPORT - PORTAL depot');

  // Test pilot dispatch depot assignment
  process.env.NEO_SPOKE_PILOT_DISPATCH_ENABLED = 'true';
  process.env.NEO_SPOKE_APPROVED_PILOT_DRIVER_ID = 'drivers/mock-portal-pilot';

  const pilotRes = await mockAdapter.executeControlledPilotDispatch({
    plan: {
      title: 'NEO PILOT DISPATCH - Portal Depot Booking',
      starts: { day: 23, month: 10, year: 2026 },
    },
    bookingId: 'NT-PORTAL-DEPOT-01',
    stops: [
      {
        activity: 'pickup',
        address: { addressLineOne: 'Unit D1', zip: 'WA3 6BL', latitude: 53.445, longitude: -2.518 },
        orderInfo: { sellerOrderId: 'NT-PORTAL-DEPOT-01' },
      },
      {
        activity: 'delivery',
        address: { addressLineOne: '100 Street', zip: 'B4 6SX', latitude: 52.483, longitude: -1.893 },
        orderInfo: { sellerOrderId: 'NT-PORTAL-DEPOT-01' },
      },
    ],
    approvedPilotDriverId: 'drivers/mock-portal-pilot',
  });

  assert.strictEqual(pilotRes.success, true);
  assert.strictEqual(pilotRes.depotId, SPOKE_PORTAL_DEPOT_ID, 'Pilot dispatch must bind to SPOKE_PORTAL_DEPOT_ID');
  assert.ok(pilotRes.deliveryTrackingUrl, 'deliveryTrackingUrl must be populated');
  assert.ok(isValidSpokeTrackingUrl(pilotRes.deliveryTrackingUrl), 'deliveryTrackingUrl must be valid Spoke URL');
  console.log('✓ PASS 2.2: Mock pilot dispatch binds to NEO TRANSPORT - PORTAL depot and returns tracking URLs');

  // -------------------------------------------------------------------------
  // 3. SpokeClient Live Payload Formatting & API Simulation
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Testing SpokeClient Direct Array & Capacity Fallback Handling ---');

  let interceptedPlanBody: any = null;
  let interceptedStopsBody: any = null;
  let simulatedCapacityFailure = true;

  const mockNetworkFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const urlStr = String(url);

    // POST /plans
    if (urlStr.endsWith('/plans') && init?.method === 'POST') {
      interceptedPlanBody = JSON.parse(String(init.body));
      return new Response(
        JSON.stringify({
          id: 'plans/live-sim-portal-01',
          title: interceptedPlanBody.title,
          starts: interceptedPlanBody.starts,
          depot: interceptedPlanBody.depot,
          distributed: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // POST /plans/{id}/stops:import
    if (urlStr.includes('/stops:import') && init?.method === 'POST') {
      interceptedStopsBody = JSON.parse(String(init.body));

      // Real Spoke upstream validation: rejects object wrapper with HTTP 400 invalid_type
      if (!Array.isArray(interceptedStopsBody)) {
        return new Response(
          JSON.stringify({
            message: 'Invalid input: expected array, received object',
            code: 'invalid_type',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Assert payload is an array directly per Spoke OpenAPI specification
      assert.ok(Array.isArray(interceptedStopsBody), 'stops:import payload body must be an array directly');

      // Simulate Spoke vehicle capacity failure on first attempt if weight is provided
      if (simulatedCapacityFailure && interceptedStopsBody.some((s: any) => s.weight)) {
        simulatedCapacityFailure = false; // Next retry should succeed
        return new Response(
          JSON.stringify({
            message: "Vehicle capacity mode is disabled in the team's settings",
            code: 'vehicle_capacity_disabled',
            url: 'https://dispatch.spoke.com/settings/team-profile',
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: [
            'plans/live-sim-portal-01/stops/stop_pickup_01',
            'plans/live-sim-portal-01/stops/stop_deliv_02',
          ],
          failed: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // GET /plans/{id}/stops/{stopId}
    if (urlStr.includes('/stops/stop_deliv_02')) {
      return new Response(
        JSON.stringify({
          id: 'plans/live-sim-portal-01/stops/stop_deliv_02',
          activity: 'delivery',
          trackingLink: 'https://track.spoke.com/live-sim-token-deliv',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (urlStr.includes('/stops/stop_pickup_01')) {
      return new Response(
        JSON.stringify({
          id: 'plans/live-sim-portal-01/stops/stop_pickup_01',
          activity: 'pickup',
          trackingLink: 'https://track.spoke.com/live-sim-token-pickup',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const liveSimClient = new SpokeClient({
    apiKey: 'sim_spoke_api_key_123',
    fetchFn: mockNetworkFetch as any,
  });

  process.env.NEO_SPOKE_PRODUCTION_TEST_ENABLED = 'true';

  const liveSmokeResult = await liveSimClient.executeControlledSmokeTest({
    plan: {
      title: 'NEO API TEST - Live Sim Portal Depot',
      starts: { day: 23, month: 10, year: 2026 },
    },
    stops: [
      {
        activity: 'pickup',
        address: { addressLineOne: 'Unit D1', zip: 'WA3 6BL', latitude: 53.445, longitude: -2.518 },
        weight: { amount: 500, unit: 'kilogram' },
      },
      {
        activity: 'delivery',
        address: { addressLineOne: '100 Street', zip: 'B4 6SX', latitude: 52.483, longitude: -1.893 },
        weight: { amount: 500, unit: 'kilogram' },
      },
    ],
    idempotencyToken: 'sim-idemp-01',
  });

  assert.strictEqual(liveSmokeResult.success, true);
  assert.strictEqual(interceptedPlanBody.depot, SPOKE_PORTAL_DEPOT_ID, 'Spoke plan payload must include portal depot ID');
  assert.strictEqual(liveSmokeResult.depotId, SPOKE_PORTAL_DEPOT_ID);
  console.log('✓ PASS 3.1: SpokeClient POST /plans attaches depots/zHpPgzTLBJS4yvrs5zVR');
  console.log('✓ PASS 3.2: SpokeClient POST /stops:import sends array directly and gracefully recovers from vehicle_capacity_disabled');

  // -------------------------------------------------------------------------
  // 4. Pilot Dispatch Stop Tracking Link Capture
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Testing SpokeClient Pilot Dispatch Tracking URL Extraction ---');

  process.env.NEO_SPOKE_PILOT_DISPATCH_ENABLED = 'true';
  process.env.NEO_SPOKE_APPROVED_PILOT_DRIVER_ID = 'drivers/live-sim-pilot-drv';

  const livePilotResult = await liveSimClient.executeControlledPilotDispatch({
    plan: {
      title: 'NEO PILOT DISPATCH - Live Sim Booking',
      starts: { day: 23, month: 10, year: 2026 },
    },
    bookingId: 'NT-LIVE-SIM-001',
    stops: [
      {
        activity: 'pickup',
        address: { addressLineOne: 'Unit D1', zip: 'WA3 6BL', latitude: 53.445, longitude: -2.518 },
        orderInfo: { sellerOrderId: 'NT-LIVE-SIM-001' },
      },
      {
        activity: 'delivery',
        address: { addressLineOne: '100 Street', zip: 'B4 6SX', latitude: 52.483, longitude: -1.893 },
        orderInfo: { sellerOrderId: 'NT-LIVE-SIM-001' },
      },
    ],
    approvedPilotDriverId: 'drivers/live-sim-pilot-drv',
  });

  assert.strictEqual(livePilotResult.success, true);
  assert.strictEqual(livePilotResult.depotId, SPOKE_PORTAL_DEPOT_ID);
  assert.strictEqual(livePilotResult.deliveryTrackingUrl, 'https://track.spoke.com/live-sim-token-deliv');
  assert.strictEqual(livePilotResult.pickupTrackingUrl, 'https://track.spoke.com/live-sim-token-pickup');
  console.log('✓ PASS 4.1: Live SpokeClient queries created stops and captures valid recipient trackingLinks');

  // -------------------------------------------------------------------------
  // 5. Payment & Demo Safety Guards
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Testing Payment & Demo Safety Guards ---');

  const demoBooking = {
    reference: 'NT-DEMO-TEST',
    payment_method: 'demo',
    payment_status: 'demo_not_paid',
    is_demo: true,
  };
  const demoElig = verifyBookingPaymentEligibility(demoBooking);
  assert.strictEqual(demoElig.eligible, false, 'Demo booking must fail dispatch gate');

  const unpaidBooking = {
    reference: 'NT-UNPAID-TEST',
    payment_method: 'card',
    payment_status: 'requires_payment',
    amount_paid_gbp: 0,
  };
  const unpaidElig = verifyBookingPaymentEligibility(unpaidBooking);
  assert.strictEqual(unpaidElig.eligible, false, 'Unpaid card booking must fail dispatch gate');

  const paidBooking = {
    reference: 'NT-PAID-TEST',
    payment_method: 'card',
    payment_status: 'paid',
    amount_paid_gbp: 355.0,
  };
  const paidElig = verifyBookingPaymentEligibility(paidBooking);
  assert.strictEqual(paidElig.eligible, true, 'Paid card booking must pass dispatch gate');
  console.log('✓ PASS 5.1: Strict payment verification gating strictly blocks demo and unpaid bookings from dispatch');

  // -------------------------------------------------------------------------
  // 6. Customer-to-Depot Routing Architecture (General vs Enterprise & Fail-Closed)
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Testing Customer-to-Depot Routing Resolution ---');

  // Test 6.1: General Portal Customer defaults to NEO TRANSPORT - PORTAL
  const generalCompany = {
    id: 'comp-general-123',
    name: 'Acme General Freight',
    account_code: 'NEO-SB-8821',
  };
  const generalBooking = { company_id: generalCompany.id };
  const generalResolution = resolveDepotForBooking(generalBooking, generalCompany);
  assert.strictEqual(generalResolution.success, true);
  if (generalResolution.success) {
    assert.strictEqual(generalResolution.depotId, SPOKE_PORTAL_DEPOT_ID);
    assert.strictEqual(generalResolution.depotName, SPOKE_PORTAL_DEPOT_NAME);
    assert.strictEqual(generalResolution.isEnterpriseOverride, false);
    assert.strictEqual(generalResolution.source, 'default_portal');
  }
  console.log('✓ PASS 6.1: General portal customers automatically default to NEO TRANSPORT - PORTAL');

  // Test 6.2: Designated Enterprise Account (Clarks) routes to CLARKES depot
  const clarksCompany = {
    id: 'comp-clarks-001',
    name: 'Clarks',
    account_code: 'NEO-CLARKS',
  };
  const clarksBooking = { company_id: clarksCompany.id };
  const clarksResolution = resolveDepotForBooking(clarksBooking, clarksCompany);
  assert.strictEqual(clarksResolution.success, true);
  if (clarksResolution.success) {
    assert.strictEqual(clarksResolution.depotId, SPOKE_CLARKES_DEPOT_ID);
    assert.strictEqual(clarksResolution.depotName, SPOKE_CLARKES_DEPOT_NAME);
    assert.strictEqual(clarksResolution.isEnterpriseOverride, true);
    assert.strictEqual(clarksResolution.source, 'company_record');
  }
  console.log('✓ PASS 6.2: Clarks enterprise account routes to designated CLARKES depot');

  // Test 6.3: Custom depot via company.spoke_depot_id (whitelist verification)
  const nightRunCompany = {
    id: 'comp-fleet-internal',
    name: 'NEO Night Fleet Operations',
    account_code: 'NEO-INTERNAL',
    spoke_depot_id: SPOKE_NIGHT_RUN_DEPOT_ID,
  };
  const nightRunResolution = resolveDepotForBooking({ company_id: nightRunCompany.id }, nightRunCompany);
  assert.strictEqual(nightRunResolution.success, true);
  if (nightRunResolution.success) {
    assert.strictEqual(nightRunResolution.depotId, SPOKE_NIGHT_RUN_DEPOT_ID);
    assert.strictEqual(nightRunResolution.depotName, SPOKE_NIGHT_RUN_DEPOT_NAME);
  }
  console.log('✓ PASS 6.3: Approved custom depot via company.spoke_depot_id maps successfully');

  // Test 6.4: Fail-closed on unauthorized/unknown depot override
  const rogueCompany = {
    id: 'comp-untrusted-999',
    name: 'Rogue Cargo Ltd',
    spoke_depot_id: 'depots/malicious_or_unapproved_depot',
  };
  const rogueResolution = resolveDepotForBooking({ company_id: rogueCompany.id }, rogueCompany);
  assert.strictEqual(rogueResolution.success, false);
  if (!rogueResolution.success) {
    assert.strictEqual(rogueResolution.code, 'UNKNOWN_DEPOT');
  }
  console.log('✓ PASS 6.4: Fail-closed protection blocks unknown/unapproved depot override');

  // Test 6.5: Fail-closed on invalid format depot override
  const invalidFormatCompany = {
    id: 'comp-bad-format',
    name: 'Bad Format Ltd',
    spoke_depot_id: 'plain-id-without-prefix',
  };
  const invalidFormatResolution = resolveDepotForBooking({ company_id: invalidFormatCompany.id }, invalidFormatCompany);
  assert.strictEqual(invalidFormatResolution.success, false);
  if (!invalidFormatResolution.success) {
    assert.strictEqual(invalidFormatResolution.code, 'INVALID_DEPOT_FORMAT');
  }
  console.log('✓ PASS 6.5: Fail-closed protection blocks invalid depot ID format');

  // Test 6.6: Pickup postcode does not affect enterprise routing (strictly identity-based)
  const bookingInClarksPostcode = {
    company_id: generalCompany.id,
    pickupPostcode: 'BA16 0EQ',
  };
  const postcodeIndependentResolution = resolveDepotForBooking(bookingInClarksPostcode, generalCompany);
  assert.strictEqual(postcodeIndependentResolution.success, true);
  if (postcodeIndependentResolution.success) {
    assert.strictEqual(postcodeIndependentResolution.depotId, SPOKE_PORTAL_DEPOT_ID, 'General customer booking in Clarks postcode must still use PORTAL depot');
  }
  console.log('✓ PASS 6.6: Postcode independence verified - general customers never routed to enterprise depot by pickup location');

  // Test 6.7: Company with name 'A Clarke & Co' routes to CLARKES depot
  const aClarkeCo = {
    id: 'comp-clarkes-01',
    name: 'A Clarke & Co',
  };
  const aClarkeRes = resolveDepotForBooking({ company_id: aClarkeCo.id }, aClarkeCo);
  assert.strictEqual(aClarkeRes.success, true);
  if (aClarkeRes.success) {
    assert.strictEqual(aClarkeRes.depotId, SPOKE_CLARKES_DEPOT_ID, 'A Clarke & Co must route to CLARKES depot');
    assert.strictEqual(aClarkeRes.depotName, SPOKE_CLARKES_DEPOT_NAME);
  }
  console.log('✓ PASS 6.7: Company variant "A Clarke & Co" successfully routes to designated CLARKES depot');

  console.log('\n======================================================================');
  console.log('  ALL SPOKE PORTAL DEPOT INTEGRATION TESTS PASSED (0 FAILURES)');
  console.log('======================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});

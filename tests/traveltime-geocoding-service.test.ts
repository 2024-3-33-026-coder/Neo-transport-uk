/**
 * TRAVELTIME GEOCODING SERVICE TEST SUITE
 * 
 * Verifies:
 * 1. Valid GeoJSON parsing: [longitude, latitude] -> { lat: coordinates[1], lng: coordinates[0] }.
 * 2. Taylor Business Park match: correctly flags business-park precision and requires manual review for specific unit.
 * 3. Exact building/premise match: correctly classified as exact_building without requiring manual review.
 * 4. Missing results (empty features array []): returns clean failure without throwing.
 * 5. Upstream API errors (401, 403, 500, network exceptions): handled gracefully.
 * 6. Missing credentials: fails closed without exposing secrets.
 * 7. Malformed coordinates: non-finite, missing, null, or out of range.
 * 8. Incorrect coordinate order: detects inverted [lat, lng] passed where [lng, lat] was expected.
 * 9. Ambiguous address matches: multiple candidates with close scores flagged for manual review.
 * 10. Independent pickup and delivery validation on bookings.
 * 11. Integration into Spoke stop-mapping flow and dry-run payload generation.
 */

import assert from 'node:assert';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

// Ensure test credentials exist if not in environment
if (!process.env.TRAVELTIME_APP_ID) process.env.TRAVELTIME_APP_ID = 'test-traveltime-app-id';
if (!process.env.TRAVELTIME_API_KEY) process.env.TRAVELTIME_API_KEY = 'test-traveltime-api-key';

import {
  parseGeoJsonCoordinates,
  evaluateAddressPrecision,
  geocodeAddressWithTravelTime,
  geocodeBookingWithTravelTime,
  setCustomTravelTimeFetcherForTesting,
  detectInvertedUkCoordinates,
  extractPremiseOrUnitIdentifier,
  TravelTimeGeoJsonFeature,
  TravelTimeFeatureCollection,
} from '../api/traveltimeService.js';
import {
  mapBookingToSpokePickupStop,
  mapBookingToSpokeDeliveryStop,
  generateSpokeDryRunPayload,
  buildSpokeAddress,
} from '../src/lib/spokeMapper.js';

// Reference Taylor Business Park response from actual API test
const MOCK_TAYLOR_BUSINESS_PARK_FEATURE: TravelTimeGeoJsonFeature = {
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [-2.5176, 53.44541], // [longitude, latitude]
  },
  properties: {
    name: 'Taylor Business Park, New Hall Lane, Warrington, WA3 6BL, United Kingdom',
    label: 'Taylor Business Park, New Hall Lane, Warrington, WA3 6BL, United Kingdom',
    category: 'leisure',
    type: 'park',
    score: 0.88,
    street: 'New Hall Lane',
    county: 'Cheshire',
    macroregion: 'England',
    city: 'Warrington',
    district: 'Culcheth',
    country: 'United Kingdom',
    country_code: 'GBR',
    postcode: 'WA3 6BL',
  },
};

const MOCK_EXACT_BUILDING_FEATURE: TravelTimeGeoJsonFeature = {
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [-0.1276, 51.5034], // [longitude, latitude]
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
  },
};

async function runTravelTimeServiceTests() {
  console.log('=================================================================');
  console.log('STARTING TRAVELTIME GEOCODING SERVICE & SPOKE INTEGRATION TESTS');
  console.log('=================================================================\n');

  // --- 1. Coordinate Parsing & Order ---
  console.log('--- 1. Testing GeoJSON Coordinate Parsing & Order ---');
  {
    // GeoJSON [longitude, latitude]
    const rawCoords = [-2.5176, 53.44541];
    const parsed = parseGeoJsonCoordinates(rawCoords);

    assert.strictEqual(parsed.isValid, true, 'Valid GeoJSON coordinates must parse successfully');
    assert.ok(parsed.coordinates, 'Coordinates object must be returned');
    assert.strictEqual(parsed.coordinates!.lat, 53.44541, 'Latitude must be mapped from coordinates[1]');
    assert.strictEqual(parsed.coordinates!.lng, -2.5176, 'Longitude must be mapped from coordinates[0]');
    console.log('✓ PASS 1.1: [longitude, latitude] correctly mapped to { lat: coordinates[1], lng: coordinates[0] }');

    // Inverted coordinate detection ([latitude, longitude] mistakenly passed)
    const invertedCoords = [53.44541, -2.5176];
    const invertedCheck = parseGeoJsonCoordinates(invertedCoords);
    assert.strictEqual(invertedCheck.isValid, false, 'Inverted coordinates must be rejected');
    assert.strictEqual(invertedCheck.isInverted, true, 'isInverted flag must be true');
    console.log('✓ PASS 1.2: Inverted coordinate order [lat, lng] detected and rejected');
  }

  // --- 2. Taylor Business Park Validation (Unit D1) ---
  console.log('\n--- 2. Testing Taylor Business Park (Business Park vs Unit Precision) ---');
  {
    const query = 'Unit D1, Taylor Business Park, Risley, Warrington, WA3 6BL, UK';
    const assessment = evaluateAddressPrecision(query, MOCK_TAYLOR_BUSINESS_PARK_FEATURE, [MOCK_TAYLOR_BUSINESS_PARK_FEATURE]);

    assert.strictEqual(assessment.isValid, true, 'Coordinates must be valid');
    assert.strictEqual(assessment.precision, 'business_park_or_estate', 'Must be classified as business_park_or_estate');
    assert.strictEqual(assessment.requiresManualReview, true, 'Must demand manual review because Unit D1 was not matched to a building');
    assert.strictEqual(assessment.requestedUnit, 'Unit D1', 'Must extract Unit D1 identifier');
    assert.ok(
      assessment.reviewReasons.some((r) => r.includes('business park / estate level')),
      'Review reason must explain business-park-level match'
    );
    console.log('✓ PASS 2.1: Unit D1 at Taylor Business Park correctly flagged for manual review with business_park_or_estate precision');
  }

  // --- 3. Exact Building / Address Match ---
  console.log('\n--- 3. Testing Exact Building Address Validation ---');
  {
    const query = '10 Downing Street, London, SW1A 2AA';
    const assessment = evaluateAddressPrecision(query, MOCK_EXACT_BUILDING_FEATURE, [MOCK_EXACT_BUILDING_FEATURE]);

    assert.strictEqual(assessment.isValid, true);
    assert.strictEqual(assessment.precision, 'exact_building');
    assert.strictEqual(assessment.requiresManualReview, false, 'Exact building match should not require manual review');
    assert.strictEqual(assessment.isAmbiguous, false);
    console.log('✓ PASS 3.1: Exact building match verified without requiring manual review');
  }

  // --- 4. Missing Results Handling ---
  console.log('\n--- 4. Testing Empty / Missing Results ---');
  {
    setCustomTravelTimeFetcherForTesting(async () => {
      const emptyCollection: TravelTimeFeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };
      return new Response(JSON.stringify(emptyCollection), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const res = await geocodeAddressWithTravelTime('NonExistentPlace 99999');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'NO_RESULTS');
    assert.ok(res.error?.includes('No geocoding matches found'));
    console.log('✓ PASS 4.1: Empty features array returns clean NO_RESULTS error without crashing');
  }

  // --- 5. Upstream API Errors ---
  console.log('\n--- 5. Testing Upstream API Errors & Status Codes ---');
  {
    // HTTP 401 Unauthorized
    setCustomTravelTimeFetcherForTesting(async () => {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const res401 = await geocodeAddressWithTravelTime('Manchester M17 1AB');
    assert.strictEqual(res401.success, false);
    assert.strictEqual(res401.code, 'AUTH_FAILED');
    assert.ok(res401.error?.includes('authentication failed'));
    console.log('✓ PASS 5.1: HTTP 401 Unauthorized handled gracefully with AUTH_FAILED');

    // HTTP 500 Server Error
    setCustomTravelTimeFetcherForTesting(async () => {
      return new Response('Internal Server Error', { status: 500 });
    });

    const res500 = await geocodeAddressWithTravelTime('Manchester M17 1AB');
    assert.strictEqual(res500.success, false);
    assert.strictEqual(res500.code, 'HTTP_500');
    console.log('✓ PASS 5.2: HTTP 500 Internal Server Error propagated safely');

    // Network Exception
    setCustomTravelTimeFetcherForTesting(async () => {
      throw new Error('Connection refused (ETIMEDOUT)');
    });

    const resNet = await geocodeAddressWithTravelTime('Manchester M17 1AB');
    assert.strictEqual(resNet.success, false);
    assert.strictEqual(resNet.code, 'NETWORK_ERROR');
    assert.ok(resNet.error?.includes('ETIMEDOUT'));
    console.log('✓ PASS 5.3: Network exception caught and wrapped as NETWORK_ERROR');
  }

  // --- 6. Missing Credentials Guard ---
  console.log('\n--- 6. Testing Missing Credentials Guard ---');
  {
    const originalAppId = process.env.TRAVELTIME_APP_ID;
    const originalApiKey = process.env.TRAVELTIME_API_KEY;

    try {
      delete process.env.TRAVELTIME_APP_ID;
      delete process.env.TRAVELTIME_API_KEY;

      const res = await geocodeAddressWithTravelTime('Manchester M17 1AB');
      assert.strictEqual(res.configured, false);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.code, 'CREDENTIALS_MISSING');
      console.log('✓ PASS 6.1: Missing credentials fails closed with configured: false');
    } finally {
      process.env.TRAVELTIME_APP_ID = originalAppId;
      process.env.TRAVELTIME_API_KEY = originalApiKey;
    }
  }

  // --- 7. Malformed Coordinates ---
  console.log('\n--- 7. Testing Malformed Coordinates Validation ---');
  {
    assert.strictEqual(parseGeoJsonCoordinates(null).isValid, false);
    assert.strictEqual(parseGeoJsonCoordinates([]).isValid, false);
    assert.strictEqual(parseGeoJsonCoordinates([1]).isValid, false);
    assert.strictEqual(parseGeoJsonCoordinates(['invalid', 53.4]).isValid, false);
    assert.strictEqual(parseGeoJsonCoordinates([NaN, 53.4]).isValid, false);
    assert.strictEqual(parseGeoJsonCoordinates([Infinity, 53.4]).isValid, false);
    assert.strictEqual(parseGeoJsonCoordinates([-200, 53.4]).isValid, false, 'Longitude -200 is out of bounds');
    assert.strictEqual(parseGeoJsonCoordinates([-2.5, 95]).isValid, false, 'Latitude 95 is out of bounds');
    console.log('✓ PASS 7.1: Malformed, non-finite, and out-of-range coordinates strictly rejected');
  }

  // --- 8. Ambiguous Matches (Multiple Candidates with Close Scores) ---
  console.log('\n--- 8. Testing Ambiguous Address Matches ---');
  {
    const candidateA: TravelTimeGeoJsonFeature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-2.24, 53.48] },
      properties: { name: 'High Street, Manchester', score: 0.85, type: 'street' },
    };
    const candidateB: TravelTimeGeoJsonFeature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-2.18, 53.52] },
      properties: { name: 'High Street, Oldham', score: 0.83, type: 'street' },
    };

    const assessment = evaluateAddressPrecision('High Street', candidateA, [candidateA, candidateB]);
    assert.strictEqual(assessment.isAmbiguous, true, 'Close confidence scores must be flagged as ambiguous');
    assert.strictEqual(assessment.requiresManualReview, true);
    assert.ok(assessment.reviewReasons.some((r) => r.includes('Multiple candidate matches')));
    console.log('✓ PASS 8.1: Multiple candidate matches with close scores flagged with isAmbiguous: true');
  }

  // --- 9. Independent Pickup and Delivery Geocoding ---
  console.log('\n--- 9. Testing Independent Pickup and Delivery Geocoding on Booking ---');
  {
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

    const booking = {
      pickup: 'Unit D1, Taylor Business Park, Risley, Warrington, WA3 6BL, UK',
      dropoff: '10 Downing Street, London, SW1A 2AA',
    };

    const bookingResult = await geocodeBookingWithTravelTime(booking);

    assert.strictEqual(bookingResult.allResolved, true, 'Both locations resolved coordinates');
    assert.strictEqual(bookingResult.anyRequiresManualReview, true, 'Pickup requires review so anyRequiresManualReview must be true');
    assert.strictEqual(bookingResult.pickup.assessment?.precision, 'business_park_or_estate');
    assert.strictEqual(bookingResult.dropoff.assessment?.precision, 'exact_building');
    assert.strictEqual(bookingResult.pickupCoords?.lat, 53.44541);
    assert.strictEqual(bookingResult.pickupCoords?.lng, -2.5176);
    assert.strictEqual(bookingResult.dropoffCoords?.lat, 51.5034);
    assert.strictEqual(bookingResult.dropoffCoords?.lng, -0.1276);
    assert.ok(bookingResult.manualReviewReasons.some((r) => r.includes('[Pickup]:')));
    console.log('✓ PASS 9.1: Pickup and Delivery validated independently with accurate coordinates and review breakdown');
  }

  // --- 10. Integration into Spoke Stop Mapping & Dry-Run ---
  console.log('\n--- 10. Testing Spoke Stop Mapping & Dry-Run Integration ---');
  {
    const resolvedPickupCoords = { lat: 53.44541, lng: -2.5176 };
    const resolvedDropoffCoords = { lat: 51.5034, lng: -0.1276 };

    const bookingSource = {
      id: 'NT-25008',
      pickup: 'Unit D1, Taylor Business Park, Risley, Warrington, WA3 6BL, UK',
      dropoff: '10 Downing Street, London, SW1A 2AA',
      weight_kg: 500,
      items_count: 2,
    };

    // 10.1 buildSpokeAddress receives coords
    const pickupAddr = buildSpokeAddress(bookingSource.pickup, resolvedPickupCoords);
    assert.strictEqual(pickupAddr.address.latitude, 53.44541);
    assert.strictEqual(pickupAddr.address.longitude, -2.5176);
    console.log('✓ PASS 10.1: buildSpokeAddress embeds resolved latitude and longitude');

    // 10.2 mapBookingToSpokePickupStop receives coords
    const pickupStopRes = mapBookingToSpokePickupStop(bookingSource, resolvedPickupCoords);
    assert.strictEqual(pickupStopRes.success, true);
    assert.strictEqual(pickupStopRes.data!.address.latitude, 53.44541);
    assert.strictEqual(pickupStopRes.data!.address.longitude, -2.5176);
    console.log('✓ PASS 10.2: mapBookingToSpokePickupStop correctly integrates validated coordinates');

    // 10.3 mapBookingToSpokeDeliveryStop receives coords
    const deliveryStopRes = mapBookingToSpokeDeliveryStop(bookingSource, resolvedDropoffCoords);
    assert.strictEqual(deliveryStopRes.success, true);
    assert.strictEqual(deliveryStopRes.data!.address.latitude, 51.5034);
    assert.strictEqual(deliveryStopRes.data!.address.longitude, -0.1276);
    console.log('✓ PASS 10.3: mapBookingToSpokeDeliveryStop correctly integrates validated coordinates');

    // 10.4 generateSpokeDryRunPayload with resolved coords
    const dryRun = generateSpokeDryRunPayload(bookingSource, {
      planDate: '2026-10-30',
      pickupCoords: resolvedPickupCoords,
      dropoffCoords: resolvedDropoffCoords,
    });

    assert.strictEqual(dryRun.success, true);
    assert.strictEqual(dryRun.summary.coordinatesStatus.pickup, 'provided_and_valid');
    assert.strictEqual(dryRun.summary.coordinatesStatus.dropoff, 'provided_and_valid');
    assert.strictEqual(dryRun.stops?.[0].address.latitude, 53.44541);
    assert.strictEqual(dryRun.stops?.[1].address.latitude, 51.5034);
    console.log('✓ PASS 10.4: generateSpokeDryRunPayload reflects provided_and_valid coordinates for both stops');
  }

  // Reset custom fetcher
  setCustomTravelTimeFetcherForTesting(null);

  console.log('\n=================================================================');
  console.log('ALL TRAVELTIME GEOCODING SERVICE TESTS PASSED (0 failures)');
  console.log('=================================================================\n');
}

runTravelTimeServiceTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

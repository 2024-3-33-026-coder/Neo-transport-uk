/**
 * TRAVELTIME GEOCODING SERVICE (SERVER-SIDE ONLY)
 * 
 * Strict server-side client for TravelTime Geocoding Search API (v4).
 * 
 * Capabilities:
 * - Deterministic, server-side address geocoding via TravelTime API v4.
 * - Robust GeoJSON [longitude, latitude] parsing to { lat, lng } coordinates.
 * - Inverted coordinate order detection (catches swapped longitude/latitude).
 * - Multi-tier address precision classification:
 *     'exact_building' | 'business_park_or_estate' | 'street_level' | 'postcode_level' | 'approximate'
 * - Independent validation for pickup and delivery addresses.
 * - Strict flagging of business-park / industrial estate matches where exact unit
 *   is requested but not resolved to building level (demands manual review).
 * - Ambiguity detection when multiple candidates return similar scores.
 * - Test injection hooks allowing 100% offline unit and regression testing.
 * 
 * SECURITY:
 * - TRAVELTIME_APP_ID and TRAVELTIME_API_KEY are strictly read from process.env.
 * - Credentials are NEVER sent to the client, logged, or exposed in errors.
 */

import dotenv from 'dotenv';
import { validateCoordinates, LatLngCoords, extractPostcodeFromAddress } from '../src/lib/spokeMapper.js';

// Initialize environment variables from .env.local and .env once at module load
dotenv.config({ path: ['.env.local', '.env'] });

export type AddressPrecision =
  | 'exact_building'
  | 'business_park_or_estate'
  | 'street_level'
  | 'postcode_level'
  | 'approximate';

export interface TravelTimeGeoJsonProperties {
  name?: string;
  label?: string;
  category?: string;
  type?: string;
  score?: number;
  street?: string;
  county?: string;
  macroregion?: string;
  city?: string;
  district?: string;
  country?: string;
  country_code?: string;
  postcode?: string;
  housenumber?: string;
  unit?: string;
  features?: Record<string, any>;
  [key: string]: any;
}

export interface TravelTimeGeoJsonGeometry {
  type: string;
  coordinates: [number, number]; // GeoJSON standard: [longitude, latitude]
}

export interface TravelTimeGeoJsonFeature {
  type: 'Feature';
  geometry: TravelTimeGeoJsonGeometry;
  properties: TravelTimeGeoJsonProperties;
}

export interface TravelTimeFeatureCollection {
  type: 'FeatureCollection';
  attribution?: string;
  features: TravelTimeGeoJsonFeature[];
}

export interface GeocodeValidationAssessment {
  isValid: boolean;
  coordinates: LatLngCoords | null;
  precision: AddressPrecision;
  requiresManualReview: boolean;
  reviewReasons: string[];
  isAmbiguous: boolean;
  score: number;
  matchedName: string;
  matchedPostcode: string | null;
  matchedType: string | null;
  matchedCategory: string | null;
  queryPostcode: string | null;
  requestedUnit: string | null;
}

export interface TravelTimeGeocodeResult {
  success: boolean;
  configured: boolean;
  query: string;
  assessment?: GeocodeValidationAssessment;
  rawFeature?: TravelTimeGeoJsonFeature;
  error?: string;
  code?: string;
}

export interface BookingGeocodeResult {
  pickup: TravelTimeGeocodeResult;
  dropoff: TravelTimeGeocodeResult;
  allResolved: boolean;
  anyRequiresManualReview: boolean;
  manualReviewReasons: string[];
  pickupCoords: LatLngCoords | null;
  dropoffCoords: LatLngCoords | null;
}

// In-memory test fetcher injection
let customTravelTimeFetcher: typeof fetch | null = null;

export function setCustomTravelTimeFetcherForTesting(fn: typeof fetch | null): void {
  customTravelTimeFetcher = fn;
}

/**
 * Reads server-side TravelTime API credentials.
 * Never logs keys or returns empty strings.
 */
export function getTravelTimeCredentials(): { appId: string | null; apiKey: string | null } {
  const appId = process.env.TRAVELTIME_APP_ID || null;
  const apiKey = process.env.TRAVELTIME_API_KEY || null;

  return {
    appId: appId && typeof appId === 'string' && appId.trim() ? appId.trim() : null,
    apiKey: apiKey && typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : null,
  };
}

export function isTravelTimeConfigured(): boolean {
  const { appId, apiKey } = getTravelTimeCredentials();
  return Boolean(appId && apiKey);
}

/**
 * Extracts unit/bay/suite premise identifier from an address string if present.
 * E.g. "Unit D1", "Bay 3", "Suite 400", "Building 5", "Plot 12A"
 */
export function extractPremiseOrUnitIdentifier(query: string): string | null {
  if (!query) return null;
  const regex = /\b(unit|bay|suite|building|plot|shed|warehouse|gate|whse|dock)\s+([a-z0-9\-\/]+)\b/i;
  const match = query.match(regex);
  return match ? `${match[1]} ${match[2]}`.trim() : null;
}

/**
 * Detects whether coordinates appear to be inverted (mistakenly passed as [lat, lng] instead of GeoJSON [lng, lat]).
 * In the UK:
 * - Latitude is approx +49.8° to +60.9° N
 * - Longitude is approx -8.7° to +1.8° E/W
 * If latitude is negative or near zero and longitude is near +50..+60, coordinate order is inverted.
 */
export function detectInvertedUkCoordinates(lat: number, lng: number): boolean {
  // If latitude looks like a UK longitude (-8.7 to +1.8) and longitude looks like a UK latitude (49.8 to 60.9)
  if (lat >= -9 && lat <= 2 && lng >= 48 && lng <= 61) {
    return true;
  }
  return false;
}

/**
 * Parses raw GeoJSON coordinates array [longitude, latitude] into LatLngCoords { lat, lng }.
 * Validates coordinate order, finite numbers, and ranges.
 */
export function parseGeoJsonCoordinates(rawCoordinates: unknown): {
  isValid: boolean;
  coordinates: LatLngCoords | null;
  error?: string;
  isInverted?: boolean;
} {
  if (!Array.isArray(rawCoordinates) || rawCoordinates.length < 2) {
    return {
      isValid: false,
      coordinates: null,
      error: 'GeoJSON coordinates must be an array of at least 2 numbers: [longitude, latitude].',
    };
  }

  const rawLng = rawCoordinates[0];
  const rawLat = rawCoordinates[1];

  if (
    typeof rawLng !== 'number' ||
    typeof rawLat !== 'number' ||
    !Number.isFinite(rawLng) ||
    !Number.isFinite(rawLat)
  ) {
    return {
      isValid: false,
      coordinates: null,
      error: 'GeoJSON coordinates [longitude, latitude] must contain valid finite numbers.',
    };
  }

  // Detect swapped coordinate order before validation
  if (detectInvertedUkCoordinates(rawLat, rawLng)) {
    return {
      isValid: false,
      coordinates: null,
      isInverted: true,
      error: `Inverted coordinate order detected: latitude (${rawLat}) is in longitude range while longitude (${rawLng}) is in UK latitude range. GeoJSON requires [longitude, latitude].`,
    };
  }

  // Validate range via core validator
  const coordVal = validateCoordinates(rawLat, rawLng);
  if (!coordVal.isValid) {
    return {
      isValid: false,
      coordinates: null,
      error: coordVal.error,
    };
  }

  return {
    isValid: true,
    coordinates: {
      lat: coordVal.latitude!,
      lng: coordVal.longitude!,
    },
  };
}

/**
 * Evaluates the precision, potential ambiguity, and manual-review requirements
 * of a TravelTime geocoding feature match against the caller's search query.
 */
export function evaluateAddressPrecision(
  query: string,
  feature: TravelTimeGeoJsonFeature,
  allFeatures: TravelTimeGeoJsonFeature[] = []
): GeocodeValidationAssessment {
  const properties = feature.properties || {};
  const matchedName = properties.name || properties.label || '';
  const score = typeof properties.score === 'number' ? properties.score : 0;
  const matchedType = (properties.type || '').toLowerCase();
  const matchedCategory = (properties.category || '').toLowerCase();
  const matchedPostcode = properties.postcode ? properties.postcode.trim().toUpperCase() : null;

  const queryPostcode = extractPostcodeFromAddress(query);
  const requestedUnit = extractPremiseOrUnitIdentifier(query);

  const reviewReasons: string[] = [];
  let precision: AddressPrecision = 'approximate';
  let isAmbiguous = false;

  // 1. Parse coordinates
  const parseRes = parseGeoJsonCoordinates(feature.geometry?.coordinates);
  const coordinates = parseRes.isValid ? parseRes.coordinates : null;
  if (!parseRes.isValid) {
    reviewReasons.push(parseRes.error || 'Coordinates failed validation.');
  }

  // 2. Classify base match precision from TravelTime metadata
  const isParkOrEstate =
    matchedType === 'park' ||
    matchedType === 'industrial_estate' ||
    matchedCategory === 'leisure' ||
    matchedCategory === 'commercial' ||
    /\b(business park|industrial estate|trading estate|science park|retail park|commercial park|estate)\b/i.test(matchedName);

  const isBuildingLevel =
    Boolean(properties.housenumber) ||
    Boolean(properties.unit) ||
    matchedType === 'building' ||
    matchedType === 'address' ||
    matchedType === 'house' ||
    matchedType === 'premise';

  const isStreetLevel =
    matchedType === 'street' ||
    matchedType === 'road' ||
    Boolean(properties.street && !isBuildingLevel && !isParkOrEstate);

  const isPostcodeLevel =
    matchedType === 'postalcode' ||
    matchedType === 'postcode' ||
    matchedCategory === 'postalcode';

  if (isBuildingLevel) {
    precision = 'exact_building';
  } else if (isParkOrEstate) {
    precision = 'business_park_or_estate';
  } else if (isStreetLevel) {
    precision = 'street_level';
  } else if (isPostcodeLevel) {
    precision = 'postcode_level';
  } else {
    precision = score >= 0.85 ? 'street_level' : 'approximate';
  }

  // 3. Evaluate specific unit requirement vs business-park-level match
  // CRITICAL REQUIREMENT: Do not treat a business-park-level match as an exact unit address.
  if (requestedUnit) {
    const unitClean = requestedUnit.toLowerCase();
    const matchedLower = matchedName.toLowerCase();
    const matchedUnitFound = matchedLower.includes(unitClean);

    if (isParkOrEstate && !matchedUnitFound) {
      precision = 'business_park_or_estate';
      reviewReasons.push(
        `Address query specifies "${requestedUnit}", but geocoding resolved only to business park / estate level ("${matchedName}"). Specific unit footprint is unverified; driver must confirm gate location.`
      );
    } else if (!isBuildingLevel && !matchedUnitFound) {
      reviewReasons.push(
        `Address query specifies "${requestedUnit}", but match was resolved at ${precision} precision ("${matchedName}") without unit-level confirmation.`
      );
    }
  }

  // 4. Ambiguity analysis (multiple close scores)
  if (allFeatures.length > 1) {
    const secondScore = typeof allFeatures[1]?.properties?.score === 'number' ? allFeatures[1].properties.score : 0;
    const scoreDelta = Math.abs(score - secondScore);
    const secondName = allFeatures[1]?.properties?.name || '';

    // If top 2 candidates have very close scores and represent distinct locations
    if (scoreDelta < 0.08 && secondName.toLowerCase() !== matchedName.toLowerCase()) {
      isAmbiguous = true;
      reviewReasons.push(
        `Multiple candidate matches found with similar confidence scores (${score.toFixed(2)} vs ${secondScore.toFixed(2)}). Second candidate: "${secondName}".`
      );
    }
  }

  // 5. Low confidence score check
  if (score < 0.75) {
    reviewReasons.push(`Geocoding confidence score (${score.toFixed(2)}) is below recommended operational threshold (0.75).`);
  }

  // 6. Postcode mismatch check
  if (queryPostcode && matchedPostcode) {
    const cleanQ = queryPostcode.replace(/\s+/g, '').toUpperCase();
    const cleanM = matchedPostcode.replace(/\s+/g, '').toUpperCase();
    if (cleanQ !== cleanM) {
      reviewReasons.push(
        `Postcode mismatch: query specified "${queryPostcode}", but geocoding returned "${matchedPostcode}".`
      );
    }
  }

  const requiresManualReview = reviewReasons.length > 0 || isAmbiguous || precision !== 'exact_building';

  return {
    isValid: Boolean(parseRes.isValid && coordinates),
    coordinates,
    precision,
    requiresManualReview,
    reviewReasons,
    isAmbiguous,
    score,
    matchedName,
    matchedPostcode,
    matchedType: properties.type || null,
    matchedCategory: properties.category || null,
    queryPostcode,
    requestedUnit,
  };
}

/**
 * Geocodes an address query string using the server-side TravelTime API.
 * Fails closed on missing credentials, network errors, or empty results.
 */
export async function geocodeAddressWithTravelTime(
  query: string,
  options?: {
    country?: string;
    limit?: number;
    fetcher?: typeof fetch;
  }
): Promise<TravelTimeGeocodeResult> {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) {
    return {
      success: false,
      configured: true,
      query: '',
      error: 'Address query cannot be empty.',
      code: 'EMPTY_QUERY',
    };
  }

  const { appId, apiKey } = getTravelTimeCredentials();
  if (!appId || !apiKey) {
    return {
      success: false,
      configured: false,
      query: cleanQuery,
      error: 'TravelTime geocoding service is not configured (missing TRAVELTIME_APP_ID or TRAVELTIME_API_KEY).',
      code: 'CREDENTIALS_MISSING',
    };
  }

  const country = options?.country || 'GB';
  const limit = Math.max(1, Math.min(options?.limit || 5, 10));
  const fetchFn = options?.fetcher || customTravelTimeFetcher || globalThis.fetch;

  const url = new URL('https://api.traveltimeapp.com/v4/geocoding/search');
  url.searchParams.set('query', cleanQuery);
  url.searchParams.set('within.country', country);
  url.searchParams.set('limit', String(limit));

  try {
    const res = await fetchFn(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en-GB',
        'X-Application-Id': appId,
        'X-Api-Key': apiKey,
      },
    });

    if (!res.ok) {
      let errBody = '';
      try {
        errBody = await res.text();
      } catch {
        errBody = '';
      }

      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          configured: true,
          query: cleanQuery,
          error: 'TravelTime API authentication failed: invalid application ID or API key.',
          code: 'AUTH_FAILED',
        };
      }

      return {
        success: false,
        configured: true,
        query: cleanQuery,
        error: `TravelTime geocoding upstream error (HTTP ${res.status}): ${errBody.slice(0, 200)}`,
        code: `HTTP_${res.status}`,
      };
    }

    const data: TravelTimeFeatureCollection = await res.json();

    if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      return {
        success: false,
        configured: true,
        query: cleanQuery,
        error: 'Invalid response format received from TravelTime API: expected FeatureCollection.',
        code: 'MALFORMED_RESPONSE',
      };
    }

    if (data.features.length === 0) {
      return {
        success: false,
        configured: true,
        query: cleanQuery,
        error: `No geocoding matches found for address "${cleanQuery}".`,
        code: 'NO_RESULTS',
      };
    }

    const topFeature = data.features[0];
    const assessment = evaluateAddressPrecision(cleanQuery, topFeature, data.features);

    return {
      success: assessment.isValid,
      configured: true,
      query: cleanQuery,
      assessment,
      rawFeature: topFeature,
      error: assessment.isValid ? undefined : assessment.reviewReasons[0] || 'Invalid coordinates',
    };
  } catch (err: any) {
    return {
      success: false,
      configured: true,
      query: cleanQuery,
      error: `Network error connecting to TravelTime geocoding API: ${err?.message || err}`,
      code: 'NETWORK_ERROR',
    };
  }
}

/**
 * Geocodes and validates both pickup and dropoff addresses for a booking independently.
 * Returns structured coordinates, independent review assessments, and unified review reasons.
 */
export async function geocodeBookingWithTravelTime(
  booking: {
    pickup?: string;
    pickupPostcode?: string;
    dropoff?: string;
    dropoffPostcode?: string;
  },
  options?: { fetcher?: typeof fetch }
): Promise<BookingGeocodeResult> {
  const pickupAddress = (booking.pickup || booking.pickupPostcode || '').trim();
  const dropoffAddress = (booking.dropoff || booking.dropoffPostcode || '').trim();

  const [pickupRes, dropoffRes] = await Promise.all([
    geocodeAddressWithTravelTime(pickupAddress, { fetcher: options?.fetcher }),
    geocodeAddressWithTravelTime(dropoffAddress, { fetcher: options?.fetcher }),
  ]);

  const manualReviewReasons: string[] = [];

  if (pickupRes.assessment?.requiresManualReview) {
    for (const reason of pickupRes.assessment.reviewReasons) {
      manualReviewReasons.push(`[Pickup]: ${reason}`);
    }
  } else if (!pickupRes.success) {
    manualReviewReasons.push(`[Pickup]: Geocoding failed - ${pickupRes.error || 'Unknown error'}`);
  }

  if (dropoffRes.assessment?.requiresManualReview) {
    for (const reason of dropoffRes.assessment.reviewReasons) {
      manualReviewReasons.push(`[Delivery]: ${reason}`);
    }
  } else if (!dropoffRes.success) {
    manualReviewReasons.push(`[Delivery]: Geocoding failed - ${dropoffRes.error || 'Unknown error'}`);
  }

  const allResolved = Boolean(pickupRes.success && dropoffRes.success);
  const anyRequiresManualReview = Boolean(
    pickupRes.assessment?.requiresManualReview ||
    dropoffRes.assessment?.requiresManualReview ||
    !allResolved
  );

  return {
    pickup: pickupRes,
    dropoff: dropoffRes,
    allResolved,
    anyRequiresManualReview,
    manualReviewReasons,
    pickupCoords: pickupRes.assessment?.coordinates || null,
    dropoffCoords: dropoffRes.assessment?.coordinates || null,
  };
}

/**
 * SPOKE DISPATCH PAYLOAD MAPPER
 * 
 * Pure mapping and validation functions that convert NEO Transport bookings
 * into strict Spoke Dispatch OpenAPI v3.1.0 Plan and Stop payloads.
 */

import {
  SPOKE_PORTAL_DEPOT_ID,
  SPOKE_PORTAL_DEPOT_NAME,
  SPOKE_CLARKES_DEPOT_ID,
  KNOWN_SPOKE_DEPOTS,
} from './spokeTypes.js';
import type {
  DepotResolutionResult,
  SpokeCreatePlanRequest,
  SpokeStopItem,
  SpokeStopAddress,
  SpokeStopWeight,
  SpokePlanStarts,
  SpokeStopTiming,
  SpokeTimeOfDay,
  SyntheticStopLocation,
  SyntheticTestConfig,
} from './spokeTypes.js';

export interface LatLngCoords {
  lat: number;
  lng: number;
}

export interface BookingSourceData {
  id?: string;
  reference?: string;
  booking_id?: string;
  bookingId?: string;
  company_id?: string;
  pickup?: string;
  pickupPostcode?: string;
  pickup_contact?: string;
  pickupContact?: string;
  contactName?: string;
  pickup_phone?: string;
  pickupPhone?: string;
  contactPhone?: string;
  collection_window?: string;
  collectionWindow?: string;
  dropoff?: string;
  dropoffPostcode?: string;
  recipient_name?: string;
  recipientName?: string;
  dropoffContact?: string;
  recipient_phone?: string;
  recipientPhone?: string;
  dropoffPhone?: string;
  delivery_window?: string;
  deliveryWindow?: string;
  delivery_instructions?: string;
  deliveryInstructions?: string;
  goods?: string;
  cargoDescription?: string;
  weight_kg?: number;
  cargoWeightKg?: number;
  items_count?: number;
  palletCount?: number;
  itemsCount?: number;
  vehicle?: string;
  selectedVehicle?: string;
  service?: string;
  selectedService?: string;
  po_reference?: string;
  poReference?: string;
  poNumber?: string;
  notes?: string;
  pickupCoords?: LatLngCoords | null;
  dropoffCoords?: LatLngCoords | null;
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  dropoffLatitude?: number | null;
  dropoffLongitude?: number | null;
}

export interface CoordinateValidationResult {
  isValid: boolean;
  latitude?: number;
  longitude?: number;
  error?: string;
}

export interface WeightValidationResult {
  isValid: boolean;
  weight?: SpokeStopWeight;
  error?: string;
}

export interface PackageCountValidationResult {
  isValid: boolean;
  count?: number;
  error?: string;
}

export interface TimeWindowValidationResult {
  isValid: boolean;
  isSpecified: boolean;
  isOpenWindow?: boolean;
  isMalformed?: boolean;
  timing?: SpokeStopTiming | null;
  error?: string;
}

export interface SpokeDryRunOptions {
  pickupCoords?: LatLngCoords | null;
  dropoffCoords?: LatLngCoords | null;
  planDate?: Date | string | null;
  planTitle?: string | null;
  depot?: SpokeCreatePlanRequest['depot'];
  drivers?: SpokeCreatePlanRequest['drivers'];
}

export interface SpokeDryRunSummary {
  isDispatchReady: boolean;
  errors: string[];
  warnings: string[];
  unresolvedOperationalRequirements: string[];
  bookingReference: string | null;
  pickupStopIncluded: boolean;
  deliveryStopIncluded: boolean;
  coordinatesStatus: {
    pickup: 'provided_and_valid' | 'missing' | 'invalid';
    dropoff: 'provided_and_valid' | 'missing' | 'invalid';
  };
  timingStatus: {
    pickupWindow: 'parsed' | 'unsupported_format' | 'unspecified';
    deliveryWindow: 'parsed' | 'unsupported_format' | 'unspecified';
  };
  depotStatus: 'configured' | 'unassigned';
  driverStatus: 'configured' | 'unassigned';
  capacityStatus: 'unverified';
  precedenceStatus: 'unverified_spoke_constraint';
}

export interface BookingReferenceResolutionResult {
  isValid: boolean;
  reference?: string;
  error?: string;
}

export interface SpokeDryRunResult {
  success: boolean;
  plan?: SpokeCreatePlanRequest;
  stops?: [SpokeStopItem, SpokeStopItem];
  summary: SpokeDryRunSummary;
}

export interface MappingResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Validates and sanitizes geographic coordinates for Spoke.
 * Spoke requires: latitude between -90 and 90, longitude between -180 and 180.
 */
export function validateCoordinates(lat: unknown, lng: unknown): CoordinateValidationResult {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return { isValid: false, error: 'Coordinates missing or null' };
  }

  const numLat = Number(lat);
  const numLng = Number(lng);

  if (Number.isNaN(numLat) || Number.isNaN(numLng) || !Number.isFinite(numLat) || !Number.isFinite(numLng)) {
    return { isValid: false, error: 'Coordinates must be valid finite numbers' };
  }

  if (numLat < -90 || numLat > 90) {
    return { isValid: false, error: `Latitude ${numLat} is outside the valid range (-90 to 90)` };
  }

  if (numLng < -180 || numLng > 180) {
    return { isValid: false, error: `Longitude ${numLng} is outside the valid range (-180 to 180)` };
  }

  return {
    isValid: true,
    latitude: Math.round(numLat * 1000000) / 1000000,
    longitude: Math.round(numLng * 1000000) / 1000000,
  };
}

/**
 * Validates weight and formats it as the required Spoke weight object.
 * Spoke OpenAPI requires: { amount: number, unit: "kilogram" | "pound" | "metric-ton" }.
 */
export function validateAndFormatWeight(weightKg: unknown): WeightValidationResult {
  if (weightKg === null || weightKg === undefined) {
    return { isValid: false, error: 'Weight is missing' };
  }

  const num = Number(weightKg);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return { isValid: false, error: 'Weight must be a valid finite number' };
  }

  if (num < 0) {
    return { isValid: false, error: 'Weight cannot be negative' };
  }

  if (num > 999999) {
    return { isValid: false, error: 'Weight exceeds maximum allowable limit (999,999 kg)' };
  }

  return {
    isValid: true,
    weight: {
      amount: Math.round(num * 100) / 100,
      unit: 'kilogram',
    },
  };
}

/**
 * Validates package/item count.
 * Must be a positive integer > 0 and <= 10,000 if provided.
 */
export function validatePackageCount(count: unknown): PackageCountValidationResult {
  if (count === null || count === undefined) {
    return { isValid: true };
  }

  const num = Number(count);
  if (typeof count !== 'number' || Number.isNaN(num) || !Number.isFinite(num)) {
    return { isValid: false, error: 'Package count must be a valid number' };
  }

  if (!Number.isInteger(num)) {
    return { isValid: false, error: 'Package count must be a whole integer' };
  }

  if (num <= 0) {
    return { isValid: false, error: 'Package count must be greater than zero' };
  }

  if (num > 10000) {
    return { isValid: false, error: 'Package count exceeds maximum allowable limit (10,000)' };
  }

  return { isValid: true, count: num };
}

/**
 * Parses an explicit 24-hour time window string into SpokeStopTiming.
 * Supports explicit "HH:MM - HH:MM" (or "H:MM - H:MM").
 * Immediate/open-window requests (e.g. "ASAP — ready now", "ASAP - ready now", "ready now")
 * are represented as open windows with timing = null without guessing arbitrary times.
 * Other vague descriptors remain flagged as unsupported formats.
 */
export function parseExplicitTimeWindow(windowStr: unknown): TimeWindowValidationResult {
  if (windowStr === null || windowStr === undefined) {
    return { isValid: true, isSpecified: false };
  }

  if (typeof windowStr !== 'string') {
    return { isValid: false, isSpecified: true, error: 'Time window must be a string' };
  }

  const trimmed = windowStr.trim();
  if (trimmed === '') {
    return { isValid: true, isSpecified: false };
  }

  // Open/immediate time window descriptors (e.g. "ASAP — ready now", "ASAP - ready now", "ready now")
  // These represent unconstrained operational windows where stops are executed without restrictive earliest/latest attempt times.
  // Represented safely as timing = null without inventing arbitrary times.
  const isOpenDescriptor = /^(asap\s*[\u2014\-–]\s*ready\s*now|ready\s*now\s*[\u2014\-–]\s*asap|ready\s*now)$/i.test(trimmed);
  if (isOpenDescriptor) {
    return {
      isValid: true,
      isSpecified: false,
      isOpenWindow: true,
      timing: null,
    };
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!match) {
    return {
      isValid: false,
      isSpecified: true,
      isMalformed: false,
      error: `Unsupported time-window format "${trimmed}". Supported format is explicit 24-hour "HH:MM - HH:MM" (e.g. "09:00 - 12:00").`,
    };
  }

  const startHour = parseInt(match[1], 10);
  const startMinute = parseInt(match[2], 10);
  const endHour = parseInt(match[3], 10);
  const endMinute = parseInt(match[4], 10);

  if (startHour < 0 || startHour > 23 || startMinute < 0 || startMinute > 59) {
    return {
      isValid: false,
      isSpecified: true,
      isMalformed: true,
      error: `Invalid time window "${trimmed}": start time (${match[1]}:${match[2]}) has invalid hour/minute values.`,
    };
  }

  if (endHour < 0 || endHour > 23 || endMinute < 0 || endMinute > 59) {
    return {
      isValid: false,
      isSpecified: true,
      isMalformed: true,
      error: `Invalid time window "${trimmed}": end time (${match[3]}:${match[4]}) has invalid hour/minute values.`,
    };
  }

  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  if (startTotal > endTotal) {
    return {
      isValid: false,
      isSpecified: true,
      isMalformed: true,
      error: `Invalid time window "${trimmed}": start time must be before or equal to end time.`,
    };
  }

  const earliestAttemptTime: SpokeTimeOfDay = { hour: startHour, minute: startMinute };
  const latestAttemptTime: SpokeTimeOfDay = { hour: endHour, minute: endMinute };

  const timing: SpokeStopTiming = {
    earliestAttemptTime,
    latestAttemptTime,
    timeWindows: [
      {
        earliestAttemptTime,
        latestAttemptTime,
      },
    ],
  };

  return {
    isValid: true,
    isSpecified: true,
    timing,
  };
}

/**
 * Resolves and normalizes candidate booking ID and reference independently.
 * Normalizes candidate IDs and references independently before selection.
 * A blank or whitespace-only ID will not prevent using a valid reference,
 * and a blank or whitespace-only reference will not prevent using a valid ID.
 * Returns isValid: false when neither candidate is valid.
 */
export function resolveBookingReference(booking?: BookingSourceData | null): BookingReferenceResolutionResult {
  const candidateId = booking?.id ?? booking?.booking_id ?? booking?.bookingId;
  const cleanId =
    typeof candidateId === 'string'
      ? candidateId.trim()
      : candidateId !== undefined && candidateId !== null
      ? String(candidateId).trim()
      : '';

  const cleanRef =
    typeof booking?.reference === 'string'
      ? booking.reference.trim()
      : booking?.reference !== undefined && booking?.reference !== null
      ? String(booking.reference).trim()
      : '';

  const selected = cleanId || cleanRef;
  if (!selected) {
    return {
      isValid: false,
      error: 'Booking reference or ID is required',
    };
  }

  return {
    isValid: true,
    reference: selected,
  };
}

/**
 * Normalizes UK postcode strings from address fields.
 */
export function extractPostcodeFromAddress(address: string): string | null {
  if (!address) return null;
  const match = address.toUpperCase().match(/\b([A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2})\b/);
  return match ? match[1] : null;
}

/**
 * Builds a Spoke Stop Address object from raw text and optional resolved coordinates.
 */
export function buildSpokeAddress(
  addressRaw: string,
  coords?: LatLngCoords | null
): { address: SpokeStopAddress; error?: string } {
  const trimmed = (addressRaw || '').trim();
  if (!trimmed) {
    return {
      address: {},
      error: 'Address cannot be empty',
    };
  }

  const postcode = extractPostcodeFromAddress(trimmed);
  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  const cityGuess = parts.length > 1 ? parts[parts.length - 1].replace(/\b[A-Z]{1,2}[0-9].*$/, '').trim() : null;

  const address: SpokeStopAddress = {
    addressName: parts[0] || trimmed,
    addressLineOne: trimmed,
    city: cityGuess || null,
    zip: postcode || null,
    country: 'GB',
    latitude: null,
    longitude: null,
  };

  if (coords) {
    const coordVal = validateCoordinates(coords.lat, coords.lng);
    if (coordVal.isValid) {
      address.latitude = coordVal.latitude!;
      address.longitude = coordVal.longitude!;
    } else {
      return { address, error: coordVal.error };
    }
  }

  return { address };
}

/**
 * Pure mapping function: Converts a NEO Transport booking into a Spoke Collection/Pickup stop.
 */
export function mapBookingToSpokePickupStop(
  booking: BookingSourceData,
  coords?: LatLngCoords | null,
  timingOverride?: SpokeStopTiming | null
): MappingResult<SpokeStopItem> {
  const errors: string[] = [];

  const rawAddress = booking.pickup || booking.pickupPostcode;
  if (!rawAddress || !rawAddress.trim()) {
    errors.push('Pickup address is required');
  }

  const refResult = resolveBookingReference(booking);
  if (!refResult.isValid) {
    errors.push(refResult.error!);
  }
  const bookingId = refResult.reference || '';

  const contactName = booking.pickup_contact || booking.pickupContact || booking.contactName || null;
  const contactPhone = booking.pickup_phone || booking.pickupPhone || booking.contactPhone || null;
  const poRef = booking.po_reference || booking.poReference || booking.poNumber || null;

  const effectiveCoords = coords || booking.pickupCoords || (
    booking.pickupLatitude !== undefined && booking.pickupLatitude !== null &&
    booking.pickupLongitude !== undefined && booking.pickupLongitude !== null
      ? { lat: Number(booking.pickupLatitude), lng: Number(booking.pickupLongitude) }
      : null
  );

  const addressResult = buildSpokeAddress(rawAddress || '', effectiveCoords);
  if (addressResult.error && effectiveCoords) {
    errors.push(`Pickup coordinates invalid: ${addressResult.error}`);
  }

  const rawWeight = booking.weight_kg !== undefined ? booking.weight_kg : booking.cargoWeightKg;
  let weightObj: SpokeStopWeight | null = null;
  if (rawWeight !== undefined && rawWeight !== null) {
    const weightResult = validateAndFormatWeight(rawWeight);
    if (!weightResult.isValid) {
      errors.push(weightResult.error!);
    } else {
      weightObj = weightResult.weight!;
    }
  }

  const rawPackages = booking.items_count !== undefined
    ? booking.items_count
    : (booking.palletCount !== undefined ? booking.palletCount : booking.itemsCount);
  let packageCount: number | null = null;
  if (rawPackages !== undefined && rawPackages !== null) {
    const pkgResult = validatePackageCount(rawPackages);
    if (!pkgResult.isValid) {
      errors.push(pkgResult.error!);
    } else {
      packageCount = pkgResult.count ?? null;
    }
  }

  let stopTiming: SpokeStopTiming | null = null;
  if (timingOverride !== undefined) {
    stopTiming = timingOverride;
  } else {
    const windowStr = booking.collection_window || booking.collectionWindow;
    const parsed = parseExplicitTimeWindow(windowStr);
    if (parsed.isSpecified) {
      if (parsed.isValid) {
        stopTiming = parsed.timing || null;
      } else if (parsed.isMalformed) {
        errors.push(parsed.error!);
      } else {
        // Descriptive or non-explicit format (e.g. "ASAP - ready now"); leave timing open (null)
        stopTiming = null;
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const goods = booking.goods || booking.cargoDescription || '';
  const vehicle = booking.vehicle || booking.selectedVehicle || '';

  const notesParts = [
    'COLLECTION / PICKUP',
    goods ? `Goods: ${goods}` : null,
    vehicle ? `Required Vehicle: ${vehicle}` : null,
  ].filter(Boolean);

  const stop: SpokeStopItem = {
    activity: 'pickup',
    address: addressResult.address,
    recipient: {
      name: contactName,
      phone: contactPhone,
      email: null,
      externalId: booking.company_id || null,
    },
    orderInfo: {
      sellerOrderId: bookingId,
      invoiceNumber: poRef,
      sellerName: 'NEO Transport',
      sellerWebsite: 'https://neotransport.co.uk',
      products: goods ? [goods] : null,
    },
    weight: weightObj,
    packageCount,
    notes: notesParts.join(' | ') || null,
    timing: stopTiming,
  };

  return { success: true, data: stop };
}

/**
 * Pure mapping function: Converts a NEO Transport booking into a Spoke Delivery stop.
 */
export function mapBookingToSpokeDeliveryStop(
  booking: BookingSourceData,
  coords?: LatLngCoords | null,
  timingOverride?: SpokeStopTiming | null
): MappingResult<SpokeStopItem> {
  const errors: string[] = [];

  const rawAddress = booking.dropoff || booking.dropoffPostcode;
  if (!rawAddress || !rawAddress.trim()) {
    errors.push('Drop-off address is required');
  }

  const refResult = resolveBookingReference(booking);
  if (!refResult.isValid) {
    errors.push(refResult.error!);
  }
  const bookingId = refResult.reference || '';

  const recipientName = booking.recipient_name || booking.recipientName || booking.dropoffContact || null;
  const recipientPhone = booking.recipient_phone || booking.recipientPhone || booking.dropoffPhone || null;
  const deliveryInstructions = booking.delivery_instructions || booking.deliveryInstructions || booking.notes || null;
  const poRef = booking.po_reference || booking.poReference || booking.poNumber || null;

  const effectiveCoords = coords || booking.dropoffCoords || (
    booking.dropoffLatitude !== undefined && booking.dropoffLatitude !== null &&
    booking.dropoffLongitude !== undefined && booking.dropoffLongitude !== null
      ? { lat: Number(booking.dropoffLatitude), lng: Number(booking.dropoffLongitude) }
      : null
  );

  const addressResult = buildSpokeAddress(rawAddress || '', effectiveCoords);
  if (addressResult.error && effectiveCoords) {
    errors.push(`Drop-off coordinates invalid: ${addressResult.error}`);
  }

  const rawWeight = booking.weight_kg !== undefined ? booking.weight_kg : booking.cargoWeightKg;
  let weightObj: SpokeStopWeight | null = null;
  if (rawWeight !== undefined && rawWeight !== null) {
    const weightResult = validateAndFormatWeight(rawWeight);
    if (!weightResult.isValid) {
      errors.push(weightResult.error!);
    } else {
      weightObj = weightResult.weight!;
    }
  }

  const rawPackages = booking.items_count !== undefined
    ? booking.items_count
    : (booking.palletCount !== undefined ? booking.palletCount : booking.itemsCount);
  let packageCount: number | null = null;
  if (rawPackages !== undefined && rawPackages !== null) {
    const pkgResult = validatePackageCount(rawPackages);
    if (!pkgResult.isValid) {
      errors.push(pkgResult.error!);
    } else {
      packageCount = pkgResult.count ?? null;
    }
  }

  let stopTiming: SpokeStopTiming | null = null;
  if (timingOverride !== undefined) {
    stopTiming = timingOverride;
  } else {
    const windowStr = booking.delivery_window || booking.deliveryWindow;
    const parsed = parseExplicitTimeWindow(windowStr);
    if (parsed.isSpecified) {
      if (parsed.isValid) {
        stopTiming = parsed.timing || null;
      } else if (parsed.isMalformed) {
        errors.push(parsed.error!);
      } else {
        // Descriptive or non-explicit format (e.g. "ASAP - ready now"); leave timing open (null)
        stopTiming = null;
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const goods = booking.goods || booking.cargoDescription || '';
  const vehicle = booking.vehicle || booking.selectedVehicle || '';
  const service = booking.service || booking.selectedService || '';

  const notesParts = [
    deliveryInstructions,
    goods ? `Goods: ${goods}` : null,
    vehicle ? `Vehicle: ${vehicle}` : null,
    service ? `Service: ${service}` : null,
  ].filter(Boolean);

  const stop: SpokeStopItem = {
    activity: 'delivery',
    address: addressResult.address,
    recipient: {
      name: recipientName,
      phone: recipientPhone,
      email: null,
      externalId: booking.company_id || null,
    },
    orderInfo: {
      sellerOrderId: bookingId,
      invoiceNumber: poRef,
      sellerName: 'NEO Transport',
      sellerWebsite: 'https://neotransport.co.uk',
      products: goods ? [goods] : null,
    },
    weight: weightObj,
    packageCount,
    notes: notesParts.join(' | ') || null,
    timing: stopTiming,
  };

  return { success: true, data: stop };
}

/**
 * Pure mapping function: Creates a Spoke Plan creation payload from a scheduled Date.
 */
export function mapDateToSpokePlan(
  targetDate: Date | string,
  customTitle?: string
): MappingResult<SpokeCreatePlanRequest> {
  let dateObj: Date;

  if (typeof targetDate === 'string') {
    dateObj = new Date(targetDate);
  } else if (targetDate instanceof Date) {
    dateObj = targetDate;
  } else {
    return { success: false, errors: ['Invalid date parameter provided'] };
  }

  if (Number.isNaN(dateObj.getTime())) {
    return { success: false, errors: ['Invalid date string provided'] };
  }

  const day = dateObj.getUTCDate();
  const month = dateObj.getUTCMonth() + 1; // 1-12
  const year = dateObj.getUTCFullYear();

  if (year < 2000 || year > 2100) {
    return { success: false, errors: [`Plan year ${year} is outside allowable range (2000-2100)`] };
  }

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const title = (customTitle || `NEO Dispatch - ${dateStr}`).trim();

  if (title.length === 0 || title.length > 255) {
    return { success: false, errors: ['Plan title must be between 1 and 255 characters'] };
  }

  const starts: SpokePlanStarts = { day, month, year };

  const plan: SpokeCreatePlanRequest = {
    title,
    starts,
  };

  return { success: true, data: plan };
}

/**
 * PURE DRY-RUN PAYLOAD GENERATOR
 *
 * Validates booking data and generates a paired Spoke Dispatch payload
 * (exactly one pickup stop and one delivery stop) without making any network requests.
 * Evaluates operational readiness, tracking missing depot, driver, or unverified precedence constraints.
 */
export function generateSpokeDryRunPayload(
  booking: BookingSourceData,
  options?: SpokeDryRunOptions
): SpokeDryRunResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const unresolvedRequirements: string[] = [];

  // 1. Booking Reference / ID validation (normalized candidate resolution)
  const refResult = resolveBookingReference(booking);
  if (!refResult.isValid) {
    errors.push('Booking reference or ID is required for Spoke dispatch payload generation');
  }
  const bookingRef = refResult.reference || '';

  // 2. Plan Date validation (strictly deterministic: explicit planDate is required)
  if (!options?.planDate) {
    errors.push('Plan date is required for deterministic dry-run payload generation');
  }

  // 3. Required Address Validation
  const rawPickup = (booking?.pickup || booking?.pickupPostcode || '').trim();
  if (!rawPickup) {
    errors.push('Pickup address is required');
  }

  const rawDropoff = (booking?.dropoff || booking?.dropoffPostcode || '').trim();
  if (!rawDropoff) {
    errors.push('Drop-off address is required');
  }

  // 4. Coordinate validation & status tracking
  let pickupCoordStatus: 'provided_and_valid' | 'missing' | 'invalid' = 'missing';
  let dropoffCoordStatus: 'provided_and_valid' | 'missing' | 'invalid' = 'missing';

  const effectivePickupCoords = options?.pickupCoords || booking?.pickupCoords || (
    booking?.pickupLatitude !== undefined && booking?.pickupLatitude !== null &&
    booking?.pickupLongitude !== undefined && booking?.pickupLongitude !== null
      ? { lat: Number(booking.pickupLatitude), lng: Number(booking.pickupLongitude) }
      : null
  );

  const effectiveDropoffCoords = options?.dropoffCoords || booking?.dropoffCoords || (
    booking?.dropoffLatitude !== undefined && booking?.dropoffLatitude !== null &&
    booking?.dropoffLongitude !== undefined && booking?.dropoffLongitude !== null
      ? { lat: Number(booking.dropoffLatitude), lng: Number(booking.dropoffLongitude) }
      : null
  );

  if (effectivePickupCoords !== undefined && effectivePickupCoords !== null) {
    const coordVal = validateCoordinates(effectivePickupCoords.lat, effectivePickupCoords.lng);
    if (coordVal.isValid) {
      pickupCoordStatus = 'provided_and_valid';
    } else {
      pickupCoordStatus = 'invalid';
      errors.push(`Pickup coordinates invalid: ${coordVal.error}`);
    }
  } else {
    warnings.push('Pickup coordinates not provided; Spoke will require server-side geocoding which may fail.');
  }

  if (effectiveDropoffCoords !== undefined && effectiveDropoffCoords !== null) {
    const coordVal = validateCoordinates(effectiveDropoffCoords.lat, effectiveDropoffCoords.lng);
    if (coordVal.isValid) {
      dropoffCoordStatus = 'provided_and_valid';
    } else {
      dropoffCoordStatus = 'invalid';
      errors.push(`Drop-off coordinates invalid: ${coordVal.error}`);
    }
  } else {
    warnings.push('Drop-off coordinates not provided; Spoke will require server-side geocoding which may fail.');
  }

  // 5. Weight Validation
  const rawWeight = booking?.weight_kg !== undefined ? booking.weight_kg : booking?.cargoWeightKg;
  if (rawWeight !== undefined && rawWeight !== null) {
    const weightVal = validateAndFormatWeight(rawWeight);
    if (!weightVal.isValid) {
      errors.push(weightVal.error!);
    }
  } else {
    warnings.push('Cargo weight is not specified in booking.');
  }

  // 6. Package Count Validation
  const rawPackages = booking?.items_count !== undefined
    ? booking.items_count
    : (booking?.palletCount !== undefined ? booking.palletCount : booking?.itemsCount);
  if (rawPackages !== undefined && rawPackages !== null) {
    const pkgVal = validatePackageCount(rawPackages);
    if (!pkgVal.isValid) {
      errors.push(pkgVal.error!);
    }
  }

  // 7. Time Window Parsing & Tracking
  const rawPickupWindow = booking?.collection_window || booking?.collectionWindow;
  const parsedPickupWindow = parseExplicitTimeWindow(rawPickupWindow);
  let pickupWindowStatus: 'parsed' | 'unsupported_format' | 'unspecified' = 'unspecified';

  if (parsedPickupWindow.isSpecified) {
    if (parsedPickupWindow.isValid) {
      pickupWindowStatus = 'parsed';
    } else {
      pickupWindowStatus = 'unsupported_format';
      if (parsedPickupWindow.isMalformed) {
        errors.push(parsedPickupWindow.error!);
      } else {
        warnings.push(parsedPickupWindow.error!);
        unresolvedRequirements.push(`Collection time window "${rawPickupWindow}": ${parsedPickupWindow.error}`);
      }
    }
  }

  const rawDropoffWindow = booking?.delivery_window || booking?.deliveryWindow;
  const parsedDropoffWindow = parseExplicitTimeWindow(rawDropoffWindow);
  let dropoffWindowStatus: 'parsed' | 'unsupported_format' | 'unspecified' = 'unspecified';

  if (parsedDropoffWindow.isSpecified) {
    if (parsedDropoffWindow.isValid) {
      dropoffWindowStatus = 'parsed';
    } else {
      dropoffWindowStatus = 'unsupported_format';
      if (parsedDropoffWindow.isMalformed) {
        errors.push(parsedDropoffWindow.error!);
      } else {
        warnings.push(parsedDropoffWindow.error!);
        unresolvedRequirements.push(`Delivery time window "${rawDropoffWindow}": ${parsedDropoffWindow.error}`);
      }
    }
  }

  // 8. Depot, Driver & Vehicle Capacity Evaluation (no invented values)
  let depotStatus: 'configured' | 'unassigned' = 'unassigned';
  if (options?.depot) {
    depotStatus = 'configured';
  } else {
    unresolvedRequirements.push('Depot location is unassigned. Spoke requires an operational depot address for route optimization.');
  }

  let driverStatus: 'configured' | 'unassigned' = 'unassigned';
  if (options?.drivers && options.drivers.length > 0) {
    driverStatus = 'configured';
    unresolvedRequirements.push(
      'Driver is assigned on plan, but vehicle cargo weight and volume capacity constraints have not been verified.'
    );
  } else {
    unresolvedRequirements.push('Driver assignment is unassigned on plan.');
    unresolvedRequirements.push('Vehicle cargo weight and volume capacity constraints are unverified.');
  }

  const vehicleRequired = (booking?.vehicle || booking?.selectedVehicle || '').trim();
  if (vehicleRequired) {
    unresolvedRequirements.push(
      `Vehicle requirement "${vehicleRequired}" is recorded in stop notes only; Spoke driver vehicleType and payload capacity constraints are unverified.`
    );
  }

  // 9. Honest precedence reporting: Spoke does not natively enforce pairing
  unresolvedRequirements.push(
    'Pickup-before-delivery precedence cannot be guaranteed by Spoke stop schema alone. Order sequencing requires explicit route constraints or manual dispatcher confirmation.'
  );

  // If there are blocking validation errors, return failed result
  if (errors.length > 0) {
    return {
      success: false,
      summary: {
        isDispatchReady: false,
        errors,
        warnings,
        unresolvedOperationalRequirements: unresolvedRequirements,
        bookingReference: bookingRef || null,
        pickupStopIncluded: false,
        deliveryStopIncluded: false,
        coordinatesStatus: {
          pickup: pickupCoordStatus,
          dropoff: dropoffCoordStatus,
        },
        timingStatus: {
          pickupWindow: pickupWindowStatus,
          deliveryWindow: dropoffWindowStatus,
        },
        depotStatus,
        driverStatus,
        capacityStatus: 'unverified',
        precedenceStatus: 'unverified_spoke_constraint',
      },
    };
  }

  // 10. Generate Plan Payload (using validated explicit planDate)
  const planResult = mapDateToSpokePlan(options!.planDate!, options?.planTitle || undefined);
  if (!planResult.success || !planResult.data) {
    return {
      success: false,
      summary: {
        isDispatchReady: false,
        errors: planResult.errors || ['Failed to generate plan payload'],
        warnings,
        unresolvedOperationalRequirements: unresolvedRequirements,
        bookingReference: bookingRef,
        pickupStopIncluded: false,
        deliveryStopIncluded: false,
        coordinatesStatus: {
          pickup: pickupCoordStatus,
          dropoff: dropoffCoordStatus,
        },
        timingStatus: {
          pickupWindow: pickupWindowStatus,
          deliveryWindow: dropoffWindowStatus,
        },
        depotStatus,
        driverStatus,
        capacityStatus: 'unverified',
        precedenceStatus: 'unverified_spoke_constraint',
      },
    };
  }

  const plan = planResult.data;
  if (options?.depot) {
    plan.depot = options.depot;
  }
  if (options?.drivers) {
    plan.drivers = options.drivers;
  }

  // 11. Generate Stops with timing (timing is passed only if parsed and valid)
  const pickupTiming = parsedPickupWindow.isValid ? parsedPickupWindow.timing : null;
  const dropoffTiming = parsedDropoffWindow.isValid ? parsedDropoffWindow.timing : null;

  const pickupResult = mapBookingToSpokePickupStop(booking, effectivePickupCoords, pickupTiming);
  const dropoffResult = mapBookingToSpokeDeliveryStop(booking, effectiveDropoffCoords, dropoffTiming);

  const stopErrors: string[] = [];
  if (!pickupResult.success || !pickupResult.data) {
    stopErrors.push(...(pickupResult.errors || ['Pickup stop mapping failed']));
  }
  if (!dropoffResult.success || !dropoffResult.data) {
    stopErrors.push(...(dropoffResult.errors || ['Delivery stop mapping failed']));
  }

  // Safety invariant: verify coordinates are genuinely present in final generated stops
  if (pickupCoordStatus === 'provided_and_valid' && (pickupResult.data?.address?.latitude === null || pickupResult.data?.address?.latitude === undefined)) {
    pickupCoordStatus = 'invalid';
    stopErrors.push('Pickup stop payload failed to embed valid latitude/longitude.');
  }
  if (dropoffCoordStatus === 'provided_and_valid' && (dropoffResult.data?.address?.latitude === null || dropoffResult.data?.address?.latitude === undefined)) {
    dropoffCoordStatus = 'invalid';
    stopErrors.push('Delivery stop payload failed to embed valid latitude/longitude.');
  }

  if (stopErrors.length > 0 || !pickupResult.data || !dropoffResult.data) {
    return {
      success: false,
      summary: {
        isDispatchReady: false,
        errors: stopErrors,
        warnings,
        unresolvedOperationalRequirements: unresolvedRequirements,
        bookingReference: bookingRef,
        pickupStopIncluded: Boolean(pickupResult.data),
        deliveryStopIncluded: Boolean(dropoffResult.data),
        coordinatesStatus: {
          pickup: pickupCoordStatus,
          dropoff: dropoffCoordStatus,
        },
        timingStatus: {
          pickupWindow: pickupWindowStatus,
          deliveryWindow: dropoffWindowStatus,
        },
        depotStatus,
        driverStatus,
        capacityStatus: 'unverified',
        precedenceStatus: 'unverified_spoke_constraint',
      },
    };
  }

  // Ensure shared booking reference is strictly identical on both stops
  pickupResult.data.orderInfo!.sellerOrderId = bookingRef;
  dropoffResult.data.orderInfo!.sellerOrderId = bookingRef;

  return {
    success: true,
    plan,
    stops: [pickupResult.data, dropoffResult.data],
    summary: {
      isDispatchReady: false, // Precedence and operational constraints remain unresolved
      errors: [],
      warnings,
      unresolvedOperationalRequirements: unresolvedRequirements,
      bookingReference: bookingRef,
      pickupStopIncluded: true,
      deliveryStopIncluded: true,
      coordinatesStatus: {
        pickup: pickupCoordStatus,
        dropoff: dropoffCoordStatus,
      },
      timingStatus: {
        pickupWindow: pickupWindowStatus,
        deliveryWindow: dropoffWindowStatus,
      },
      depotStatus,
      driverStatus,
      capacityStatus: 'unverified',
      precedenceStatus: 'unverified_spoke_constraint',
    },
  };
}

/**
 * Reference template for client-approved synthetic test facilities.
 * IMPORTANT: This reference object is NOT assumed to be approved in production.
 * Production execution strictly requires explicit server configuration via environment variables.
 */
export const REFERENCE_NEO_SYNTHETIC_LOCATIONS_TEMPLATE: SyntheticTestConfig = {
  pickup: {
    addressName: 'NEO Logistics Test Hub',
    addressLineOne: 'Unit 1, Trafford Park Logistics Centre, Tenax Road',
    city: 'Manchester',
    zip: 'M17 1AB',
    country: 'GB',
    latitude: 53.468000,
    longitude: -2.325000,
  },
  dropoff: {
    addressName: 'NEO Logistics Test Receiving',
    addressLineOne: 'Unit 4, Heartlands Parkway Industrial Estate',
    city: 'Birmingham',
    zip: 'B6 7EU',
    country: 'GB',
    latitude: 52.503000,
    longitude: -1.884000,
  },
};

export const DEFAULT_NEO_APPROVED_SYNTHETIC_CONFIG = REFERENCE_NEO_SYNTHETIC_LOCATIONS_TEMPLATE;

export interface ServerApprovedSyntheticLocationsResult {
  isConfigured: boolean;
  error?: string;
  config?: SyntheticTestConfig;
}

/**
 * Loads and validates client-approved synthetic test locations from explicit server configuration.
 *
 * SAFETY RULES:
 * 1. Fails closed if server environment has not explicitly configured approved locations.
 * 2. Never assumes hardcoded addresses are client-approved.
 * 3. Never invents or substitutes coordinates; parses and sanitizes coordinates using validateCoordinates.
 * 4. Supports JSON string (NEO_SPOKE_APPROVED_SYNTHETIC_LOCATIONS_JSON) or discrete environment variables.
 */
export function loadServerApprovedSyntheticLocations(): ServerApprovedSyntheticLocationsResult {
  // Option 1: Structured JSON environment variable
  const jsonConfigStr = process.env.NEO_SPOKE_APPROVED_SYNTHETIC_LOCATIONS_JSON;
  if (jsonConfigStr && typeof jsonConfigStr === 'string' && jsonConfigStr.trim()) {
    try {
      const parsed = JSON.parse(jsonConfigStr.trim());
      const val = validateSyntheticTestConfig(parsed);
      if (!val.isValid || !val.config) {
        return {
          isConfigured: false,
          error: `Server-configured synthetic locations JSON is invalid: ${val.error}`,
        };
      }
      return { isConfigured: true, config: val.config };
    } catch (parseErr: any) {
      return {
        isConfigured: false,
        error: `Failed to parse NEO_SPOKE_APPROVED_SYNTHETIC_LOCATIONS_JSON: ${parseErr.message}`,
      };
    }
  }

  // Option 2: Discrete environment variables
  const pickupAddr = process.env.NEO_SPOKE_APPROVED_PICKUP_ADDRESS?.trim();
  const pickupZip = process.env.NEO_SPOKE_APPROVED_PICKUP_ZIP?.trim();
  const pickupLatStr = process.env.NEO_SPOKE_APPROVED_PICKUP_LAT?.trim();
  const pickupLngStr = process.env.NEO_SPOKE_APPROVED_PICKUP_LNG?.trim();

  const dropoffAddr = process.env.NEO_SPOKE_APPROVED_DROPOFF_ADDRESS?.trim();
  const dropoffZip = process.env.NEO_SPOKE_APPROVED_DROPOFF_ZIP?.trim();
  const dropoffLatStr = process.env.NEO_SPOKE_APPROVED_DROPOFF_LAT?.trim();
  const dropoffLngStr = process.env.NEO_SPOKE_APPROVED_DROPOFF_LNG?.trim();

  // If none of the approved location variables are provided, fail closed
  if (!pickupAddr && !pickupZip && !dropoffAddr && !dropoffZip) {
    return {
      isConfigured: false,
      error:
        'NEO-approved synthetic test locations are not configured on the server environment. Server must explicitly configure approved test locations (NEO_SPOKE_APPROVED_PICKUP_ADDRESS, etc.).',
    };
  }

  // If partially configured or missing required fields, fail closed
  if (!pickupAddr || !pickupZip || !dropoffAddr || !dropoffZip) {
    return {
      isConfigured: false,
      error:
        'Incomplete server synthetic location configuration: both pickup and dropoff addressLineOne and zip are required.',
    };
  }

  if (!pickupLatStr || !pickupLngStr || !dropoffLatStr || !dropoffLngStr) {
    return {
      isConfigured: false,
      error:
        'Missing server synthetic coordinates. Both pickup and dropoff must have explicit approved latitude and longitude.',
    };
  }

  const pickupCoord = validateCoordinates(Number(pickupLatStr), Number(pickupLngStr));
  if (!pickupCoord.isValid) {
    return {
      isConfigured: false,
      error: `Server-configured pickup coordinates invalid: ${pickupCoord.error}`,
    };
  }

  const dropoffCoord = validateCoordinates(Number(dropoffLatStr), Number(dropoffLngStr));
  if (!dropoffCoord.isValid) {
    return {
      isConfigured: false,
      error: `Server-configured dropoff coordinates invalid: ${dropoffCoord.error}`,
    };
  }

  const config: SyntheticTestConfig = {
    pickup: {
      addressName: process.env.NEO_SPOKE_APPROVED_PICKUP_NAME?.trim() || 'NEO Logistics Test Hub',
      addressLineOne: pickupAddr,
      city: process.env.NEO_SPOKE_APPROVED_PICKUP_CITY?.trim() || null,
      zip: pickupZip,
      country: 'GB',
      latitude: pickupCoord.latitude!,
      longitude: pickupCoord.longitude!,
    },
    dropoff: {
      addressName: process.env.NEO_SPOKE_APPROVED_DROPOFF_NAME?.trim() || 'NEO Logistics Test Receiving',
      addressLineOne: dropoffAddr,
      city: process.env.NEO_SPOKE_APPROVED_DROPOFF_CITY?.trim() || null,
      zip: dropoffZip,
      country: 'GB',
      latitude: dropoffCoord.latitude!,
      longitude: dropoffCoord.longitude!,
    },
  };

  return { isConfigured: true, config };
}

export interface SyntheticConfigValidationResult {
  isValid: boolean;
  error?: string;
  config?: SyntheticTestConfig;
}

/**
 * Validates synthetic test configuration against strict safety rules:
 * - Must contain valid pickup and dropoff objects
 * - Non-empty address lines and postcodes
 * - Verified numeric coordinates in valid range
 * - Strictly no real customer contact details (phone, email, recipient names)
 * - Fails closed: never invents or substitutes placeholder coordinates
 */
export function validateSyntheticTestConfig(config: unknown): SyntheticConfigValidationResult {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { isValid: false, error: 'Synthetic test configuration must be a valid JSON object.' };
  }

  const raw = config as Record<string, any>;
  if (!raw.pickup || typeof raw.pickup !== 'object') {
    return { isValid: false, error: 'Synthetic test configuration missing required pickup location.' };
  }
  if (!raw.dropoff || typeof raw.dropoff !== 'object') {
    return { isValid: false, error: 'Synthetic test configuration missing required dropoff location.' };
  }

  const prohibitedContactKeys = [
    'phone',
    'email',
    'recipientPhone',
    'recipient_phone',
    'pickupPhone',
    'pickup_phone',
    'dropoffPhone',
    'dropoff_phone',
    'contactPhone',
    'contact_phone',
    'recipientEmail',
    'recipient_email',
    'contactEmail',
    'contact_email',
    'recipientName',
    'recipient_name',
    'contactName',
    'contact_name',
  ];

  for (const locType of ['pickup', 'dropoff'] as const) {
    const loc = raw[locType];
    const locAddress = typeof loc.addressLineOne === 'string' ? loc.addressLineOne.trim() : '';
    if (!locAddress) {
      return { isValid: false, error: `Synthetic ${locType} location requires a non-empty addressLineOne.` };
    }

    const locZip = typeof loc.zip === 'string' ? loc.zip.trim() : '';
    if (!locZip) {
      return { isValid: false, error: `Synthetic ${locType} location requires a non-empty zip / postal code.` };
    }

    // Coordinates check
    const lat = loc.latitude !== undefined ? loc.latitude : loc.lat;
    const lng = loc.longitude !== undefined ? loc.longitude : loc.lng;
    if (lat === null || lat === undefined || lng === null || lng === undefined) {
      return {
        isValid: false,
        error: `Synthetic ${locType} location is missing required coordinates. Never invent or omit coordinates.`,
      };
    }

    const coordVal = validateCoordinates(lat, lng);
    if (!coordVal.isValid) {
      return {
        isValid: false,
        error: `Synthetic ${locType} coordinates invalid: ${coordVal.error}`,
      };
    }

    // Verify no personal contact info
    for (const key of prohibitedContactKeys) {
      if (loc[key] !== undefined && loc[key] !== null && String(loc[key]).trim() !== '') {
        return {
          isValid: false,
          error: `Synthetic ${locType} location contains prohibited personal contact detail '${key}'. Synthetic stops must be contact-free.`,
        };
      }
    }
  }

  const pickupCoord = validateCoordinates(
    raw.pickup.latitude !== undefined ? raw.pickup.latitude : raw.pickup.lat,
    raw.pickup.longitude !== undefined ? raw.pickup.longitude : raw.pickup.lng
  );
  const dropoffCoord = validateCoordinates(
    raw.dropoff.latitude !== undefined ? raw.dropoff.latitude : raw.dropoff.lat,
    raw.dropoff.longitude !== undefined ? raw.dropoff.longitude : raw.dropoff.lng
  );

  const validated: SyntheticTestConfig = {
    pickup: {
      addressName: raw.pickup.addressName ? String(raw.pickup.addressName).trim() : 'NEO Logistics Test Hub',
      addressLineOne: String(raw.pickup.addressLineOne).trim(),
      city: raw.pickup.city ? String(raw.pickup.city).trim() : null,
      zip: String(raw.pickup.zip).trim(),
      country: 'GB',
      latitude: pickupCoord.latitude!,
      longitude: pickupCoord.longitude!,
    },
    dropoff: {
      addressName: raw.dropoff.addressName ? String(raw.dropoff.addressName).trim() : 'NEO Logistics Test Receiving',
      addressLineOne: String(raw.dropoff.addressLineOne).trim(),
      city: raw.dropoff.city ? String(raw.dropoff.city).trim() : null,
      zip: String(raw.dropoff.zip).trim(),
      country: 'GB',
      latitude: dropoffCoord.latitude!,
      longitude: dropoffCoord.longitude!,
    },
  };

  return { isValid: true, config: validated };
}

/**
 * Builds exactly two synthetic Spoke stops (1 pickup, 1 delivery) for the controlled production smoke test.
 * Enforces:
 * - Synthetic test labels and notes
 * - Null recipient phone and email
 * - Null allowedDrivers (no driver assignment)
 * - Verified numeric coordinates
 * - Distinct synthetic order reference
 */
export function buildSyntheticTestStops(
  config: SyntheticTestConfig,
  runToken: string
): [SpokeStopItem, SpokeStopItem] {
  const cleanToken = (runToken || 'SMOKE').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16);
  const syntheticOrderId = `TEST-ORDER-${cleanToken}`;

  const pickupStop: SpokeStopItem = {
    activity: 'pickup',
    address: {
      addressName: config.pickup.addressName || 'NEO Logistics Test Hub',
      addressLineOne: config.pickup.addressLineOne,
      city: config.pickup.city || null,
      zip: config.pickup.zip,
      country: 'GB',
      latitude: config.pickup.latitude,
      longitude: config.pickup.longitude,
    },
    recipient: {
      name: 'NEO Test Hub (Synthetic)',
      phone: null,
      email: null,
      externalId: 'NEO-TEST-OPERATIONS',
    },
    orderInfo: {
      sellerOrderId: syntheticOrderId,
      invoiceNumber: 'TEST-SMOKE-INVOICE',
      sellerName: 'NEO Transport (Production Smoke Test)',
      sellerWebsite: 'https://neotransport.co.uk',
      products: ['SYNTHETIC_TEST_PALLET'],
    },
    weight: {
      amount: 100,
      unit: 'kilogram',
    },
    packageCount: 1,
    notes: 'CONTROLLED PRODUCTION SMOKE TEST - SYNTHETIC STOP - DO NOT DISPATCH - NO REAL CARGO',
    optimizationOrder: 'default',
    allowedDrivers: null,
  };

  const deliveryStop: SpokeStopItem = {
    activity: 'delivery',
    address: {
      addressName: config.dropoff.addressName || 'NEO Logistics Test Receiving',
      addressLineOne: config.dropoff.addressLineOne,
      city: config.dropoff.city || null,
      zip: config.dropoff.zip,
      country: 'GB',
      latitude: config.dropoff.latitude,
      longitude: config.dropoff.longitude,
    },
    recipient: {
      name: 'NEO Test Receiving (Synthetic)',
      phone: null,
      email: null,
      externalId: 'NEO-TEST-OPERATIONS',
    },
    orderInfo: {
      sellerOrderId: syntheticOrderId,
      invoiceNumber: 'TEST-SMOKE-INVOICE',
      sellerName: 'NEO Transport (Production Smoke Test)',
      sellerWebsite: 'https://neotransport.co.uk',
      products: ['SYNTHETIC_TEST_PALLET'],
    },
    weight: {
      amount: 100,
      unit: 'kilogram',
    },
    packageCount: 1,
    notes: 'CONTROLLED PRODUCTION SMOKE TEST - SYNTHETIC STOP - DO NOT DISPATCH - NO REAL CARGO',
    optimizationOrder: 'default',
    allowedDrivers: null,
  };

  return [pickupStop, deliveryStop];
}

/**
 * Server-side trusted customer/company to Spoke depot resolver.
 * 
 * Rules:
 * 1. Default mapping for all general portal customers is 'NEO TRANSPORT - PORTAL' (depots/zHpPgzTLBJS4yvrs5zVR).
 * 2. Enterprise accounts (e.g. Clarks) can use an assigned depot only through trusted server-side data:
 *    - company.spoke_depot_id (from authoritative companies table), or
 *    - Server-side trusted enterprise map (SPOKE_ENTERPRISE_DEPOT_MAPPINGS).
 * 3. Never trust client-supplied depot IDs (they are strictly ignored).
 * 4. Never use pickup postcode alone to infer depot or enterprise status.
 * 5. Fail-closed: If a configured depot cannot be verified against the approved depot whitelist,
 *    it fails closed with an authoritative error.
 */
export function resolveDepotForBooking(
  booking?: { company_id?: string | null } | null,
  company?: { id?: string; name?: string; account_code?: string; spoke_depot_id?: string | null } | null
): DepotResolutionResult {
  let configuredDepotId: string | null = null;
  let resolutionSource: 'company_record' | 'environment_override' | 'default_portal' = 'default_portal';

  if (company?.spoke_depot_id && typeof company.spoke_depot_id === 'string' && company.spoke_depot_id.trim()) {
    configuredDepotId = company.spoke_depot_id.trim();
    resolutionSource = 'company_record';
  } else if (company) {
    const envMappingsRaw = process.env.SPOKE_ENTERPRISE_DEPOT_MAPPINGS?.trim();
    if (envMappingsRaw) {
      try {
        const envMappings: Record<string, string> = JSON.parse(envMappingsRaw);
        const mappedDepot =
          (company.id && envMappings[company.id]) ||
          (company.account_code && envMappings[company.account_code]) ||
          (company.name && envMappings[company.name]);
        if (mappedDepot && typeof mappedDepot === 'string' && mappedDepot.trim()) {
          configuredDepotId = mappedDepot.trim();
          resolutionSource = 'environment_override';
        }
      } catch (parseErr) {
        console.error('[Spoke Depot Resolver] Failed to parse SPOKE_ENTERPRISE_DEPOT_MAPPINGS:', parseErr);
      }
    }

    if (!configuredDepotId) {
      const normalizedName = company.name?.trim().toLowerCase() || '';
      const normalizedCode = company.account_code?.trim().toUpperCase() || '';
      if (
        normalizedName === 'clarks' ||
        normalizedName === 'clarkes' ||
        normalizedName === 'a clarke & co' ||
        normalizedName === 'a clarke and co' ||
        normalizedName === 'clarke & co' ||
        normalizedName === 'clarke and co' ||
        normalizedName.startsWith('clarke') ||
        normalizedCode === 'NEO-CLARKS'
      ) {
        configuredDepotId = SPOKE_CLARKES_DEPOT_ID;
        resolutionSource = 'company_record';
      }
    }
  }

  // 2. Default to NEO TRANSPORT - PORTAL if no enterprise override configured
  if (!configuredDepotId) {
    return {
      success: true,
      depotId: SPOKE_PORTAL_DEPOT_ID,
      depotName: SPOKE_PORTAL_DEPOT_NAME,
      isEnterpriseOverride: false,
      source: 'default_portal',
    };
  }

  // 3. Format validation
  if (!configuredDepotId.startsWith('depots/')) {
    return {
      success: false,
      error: `Invalid Spoke depot identifier format '${configuredDepotId}'. Depot ID must begin with 'depots/'.`,
      code: 'INVALID_DEPOT_FORMAT',
    };
  }

  // 4. Fail-closed whitelist check
  const knownDepot = KNOWN_SPOKE_DEPOTS[configuredDepotId];
  if (!knownDepot) {
    return {
      success: false,
      error: `Configured Spoke depot '${configuredDepotId}' is not an approved or verified Spoke depot under the active account.`,
      code: 'UNKNOWN_DEPOT',
    };
  }

  return {
    success: true,
    depotId: knownDepot.id,
    depotName: knownDepot.name,
    isEnterpriseOverride: knownDepot.id !== SPOKE_PORTAL_DEPOT_ID,
    source: resolutionSource,
  };
}

/**
 * SPOKE DISPATCH API TYPES
 * 
 * Strict TypeScript types reflecting the official Spoke Dispatch OpenAPI v3.1.0 specification.
 * Specification source: https://developer.dispatch.spoke.com/openapi-v1.json
 * Base URL: https://api.spoke.com/public/v1
 */

export interface SpokePlanStarts {
  day: number;   // 1 - 31
  month: number; // 1 - 12
  year: number;  // 2000 - 2100
}

export interface SpokeDepotAddress {
  addressName?: string | null;
  addressLineOne?: string | null;
  addressLineTwo?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface SpokeTimeOfDay {
  hour: number;   // 0 - 23 (24-hour clock)
  minute: number; // 0 - 59
}

export interface SpokeTimeWindow {
  earliestAttemptTime: SpokeTimeOfDay | null;
  latestAttemptTime: SpokeTimeOfDay | null;
}

export const SPOKE_PORTAL_DEPOT_ID = 'depots/zHpPgzTLBJS4yvrs5zVR';
export const SPOKE_PORTAL_DEPOT_NAME = 'NEO TRANSPORT - PORTAL';

export const SPOKE_CLARKES_DEPOT_ID = 'depots/toqi2skG2wOsvxXI9Hzf';
export const SPOKE_CLARKES_DEPOT_NAME = 'CLARKES';

export const SPOKE_NIGHT_RUN_DEPOT_ID = 'depots/xg5pA7e3L94rl6WsmCBa';
export const SPOKE_NIGHT_RUN_DEPOT_NAME = 'NEO - NIGHT RUN';

export const SPOKE_I_KISS_VAPOR_DEPOT_ID = 'depots/k0dqt8YhU9zs0IbxK6dl';
export const SPOKE_I_KISS_VAPOR_DEPOT_NAME = 'I KISS VAPOR';

/**
 * Authoritative whitelist of known, verified Spoke depots under the active team account.
 */
export const KNOWN_SPOKE_DEPOTS: Record<string, { id: string; name: string }> = {
  [SPOKE_PORTAL_DEPOT_ID]: { id: SPOKE_PORTAL_DEPOT_ID, name: SPOKE_PORTAL_DEPOT_NAME },
  [SPOKE_CLARKES_DEPOT_ID]: { id: SPOKE_CLARKES_DEPOT_ID, name: SPOKE_CLARKES_DEPOT_NAME },
  [SPOKE_NIGHT_RUN_DEPOT_ID]: { id: SPOKE_NIGHT_RUN_DEPOT_ID, name: SPOKE_NIGHT_RUN_DEPOT_NAME },
  [SPOKE_I_KISS_VAPOR_DEPOT_ID]: { id: SPOKE_I_KISS_VAPOR_DEPOT_ID, name: SPOKE_I_KISS_VAPOR_DEPOT_NAME },
};

export interface DepotResolutionSuccess {
  success: true;
  depotId: string;
  depotName: string;
  isEnterpriseOverride: boolean;
  source: 'company_record' | 'environment_override' | 'default_portal';
}

export interface DepotResolutionFailure {
  success: false;
  error: string;
  code: 'UNAUTHORIZED_DEPOT_OVERRIDE' | 'UNKNOWN_DEPOT' | 'INVALID_DEPOT_FORMAT';
}

export type DepotResolutionResult = DepotResolutionSuccess | DepotResolutionFailure;

export interface SpokeCreatePlanRequest {
  title: string;
  starts: SpokePlanStarts;
  depot?: string | {
    id?: string;
    name?: string;
    address?: SpokeDepotAddress;
    startTime?: SpokeTimeOfDay;
    endTime?: SpokeTimeOfDay;
  } | null;
  drivers?: Array<{
    id: string; // e.g. "drivers/drv_123"
    vehicleType?: 'bike' | 'scooter' | 'car' | 'small_truck' | 'truck' | 'electric_cargo_bike' | null;
    startTime?: SpokeTimeOfDay | null;
    endTime?: SpokeTimeOfDay | null;
    maxStops?: number | null;
    drivingSpeed?: 'slower' | 'average' | 'faster' | null;
    deliverySpeed?: 'slower' | 'average' | 'faster' | null;
  }> | null;
  routeOverrides?: Record<string, unknown> | null;
}

export interface SpokeStopAddress {
  addressName?: string | null;
  addressLineOne?: string | null;
  addressLineTwo?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface SpokeStopRecipient {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  externalId?: string | null;
}

export interface SpokeStopOrderInfo {
  sellerOrderId?: string | null;
  invoiceNumber?: string | null;
  sellerName?: string | null;
  sellerWebsite?: string | null;
  products?: string[] | null;
}

export interface SpokeStopWeight {
  amount: number;
  unit: 'kilogram' | 'pound' | 'metric-ton';
}

export interface SpokeStopTiming {
  earliestAttemptTime?: SpokeTimeOfDay | null;
  latestAttemptTime?: SpokeTimeOfDay | null;
  estimatedAttemptDuration?: number | null; // In seconds (1 - 28800)
  timeWindows?: SpokeTimeWindow[] | null;
}

export interface SpokeStopItem {
  address: SpokeStopAddress;
  activity?: 'delivery' | 'pickup' | null;
  recipient?: SpokeStopRecipient | null;
  orderInfo?: SpokeStopOrderInfo | null;
  packageCount?: number | null;
  weight?: SpokeStopWeight | null;
  notes?: string | null;
  timing?: SpokeStopTiming | null;
  optimizationOrder?: 'first' | 'last' | 'default' | null;
  allowedDrivers?: string[] | null;
  barcodes?: string[] | null;
  customProperties?: Record<string, string | null> | null;
  paymentOnDelivery?: {
    amount?: number | null;
    currency?: string | null;
  } | null;
  proofOfAttemptRequirements?: {
    enabled?: boolean | null;
  } | null;
  clientId?: string | null;
  serviceInfo?: {
    identifier?: string | null;
    slaStartsAt?: number | null;
  } | null;
  trackingLink?: string | null;
  webAppLink?: string | null;
}

export interface SpokePlanSummary {
  id: string; // e.g. "plans/FQ95Ex714KYeojkeIm77"
  title: string;
  starts: SpokePlanStarts;
  depot?: string | null;
  state?: string;
  created?: string;
  updated?: string;
  writable?: boolean;
  distributed?: boolean;
}

export interface SpokeListPlansResponse {
  plans: SpokePlanSummary[];
  nextPageToken?: string | null;
}

export interface SpokeStopsImportResponse {
  success: string[]; // e.g. ["plans/FQ95Ex714KYeojkeIm77/stops/vgsTiQi85ueWRs1JnXx7"]
  failed: Array<{
    index: number;
    reason: string;
    stop?: SpokeStopItem;
  }>;
}

export interface SpokeErrorResponse {
  message: string;
  code?: string;
  param?: string;
  url?: string;
}

export interface SyntheticStopLocation {
  addressName?: string | null;
  addressLineOne: string;
  city?: string | null;
  zip: string;
  country?: 'GB';
  latitude: number;
  longitude: number;
}

export interface SyntheticTestConfig {
  pickup: SyntheticStopLocation;
  dropoff: SyntheticStopLocation;
}

export interface SpokeSmokeTestExecutionResult {
  success: boolean;
  planId: string;
  planTitle: string;
  depotId?: string | null;
  stopsImported: number;
  stopIds?: string[];
  message: string;
  disclaimer: string;
}

export interface SpokePilotDispatchExecutionResult {
  success: boolean;
  planId: string;
  planTitle: string;
  depotId?: string | null;
  bookingId: string;
  stopsImported: number;
  stopIds?: string[];
  driverAssigned?: string | null;
  deliveryTrackingUrl?: string | null;
  pickupTrackingUrl?: string | null;
  message: string;
}

/**
 * SPOKE WEBHOOK INBOX & EVENT CONTRACT TYPES (v1.0)
 *
 * Supported official Spoke Dispatch webhook event types and schemas.
 */

export const SPOKE_SUPPORTED_WEBHOOK_EVENT_TYPES = [
  'stop.allocated',
  'stop.out_for_delivery',
  'stop.attempted_delivery',
  'stop.departed',
  'stop.next_in_route',
  'stop.tracking_link_added',
  'unassigned_stop.tracking_link_added',
  'test.send_event',
] as const;

export type SpokeWebhookEventType = (typeof SPOKE_SUPPORTED_WEBHOOK_EVENT_TYPES)[number];

export interface SpokeWebhookPayload<T = Record<string, unknown>> {
  type: SpokeWebhookEventType;
  version: 'v1';
  created: number; // Positive millisecond timestamp since epoch
  data: T;
}

export type SpokeWebhookProcessingStatus = 'received' | 'processed' | 'failed' | 'ignored';

export interface SpokeWebhookEventRow {
  event_hash: string;
  event_type: string;
  event_version: string;
  event_created_at: string;
  received_at: string;
  payload: SpokeWebhookPayload;
  processing_status: SpokeWebhookProcessingStatus;
  processed_at?: string | null;
  processing_error?: string | null;
}

export interface SpokeWebhookResponse {
  received: boolean;
  status: 'stored' | 'already_stored' | 'processed' | 'ignored';
  eventHash: string;
  duplicate?: boolean;
  processing_status?: SpokeWebhookProcessingStatus;
  reason?: string;
  message?: string;
}

/**
 * PHASE 2: PER-STOP STATE & EVENT PROCESSING TYPES
 */

export interface SpokeDeliveryInfo {
  succeeded?: boolean | null;
  state?: string | null;
  attemptedAt?: number | null;
  reason?: string | null;
}

export interface SpokeBookingStopState {
  booking_id: string;
  company_id?: string | null;
  activity: 'pickup' | 'delivery';
  spoke_stop_id?: string | null;
  tracking_url?: string | null;
  delivery_state?: string | null;
  delivery_succeeded?: boolean | null;
  latest_event_type: SpokeWebhookEventType;
  latest_event_created_at: string;
  created_at: string;
  updated_at: string;
}

export interface SpokeEventProcessingResult {
  success: boolean;
  status: 'processed' | 'ignored' | 'failed' | 'already_processed' | 'already_ignored';
  eventHash: string;
  bookingId?: string;
  activity?: 'pickup' | 'delivery';
  bookingStatus?: string;
  progress_t?: number;
  reason?: string;
  error?: string;
}

/**
 * Strict validator for Spoke Dispatch customer tracking links.
 * Enforces HTTPS protocol and approved Spoke hostnames (track.spoke.com or *.spoke.com).
 * Fails closed on arbitrary, malicious, or non-Spoke domains.
 */
export function isValidSpokeTrackingUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'spoke.com' || hostname.endsWith('.spoke.com');
  } catch {
    return false;
  }
}

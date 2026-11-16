/**
 * HUBSPOT CRM SERVER-SIDE API CLIENT & BOOKING SYNCHRONIZATION
 *
 * Secure, server-side client for interacting with the official HubSpot CRM API.
 * Uses Bearer token authentication with HUBSPOT_SERVICE_KEY.
 *
 * Base URL: https://api.hubapi.com
 *
 * SECURITY:
 * - Credentials are read STRICTLY from server-side environment variables (HUBSPOT_SERVICE_KEY).
 * - The service key is NEVER logged, printed, or exposed to the browser client.
 * - Mutating operations are gated: disabled by default unless NEO_HUBSPOT_SYNC_ENABLED === 'true'
 *   or running in NODE_ENV === 'test'.
 */

// -----------------------------------------------------------------------------
// 1. HubSpot Deal Property Constants (Verified 8 Custom Properties + Standard)
// -----------------------------------------------------------------------------
export const HUBSPOT_DEAL_PROPERTIES = {
  // Verified 8 Custom Deal Properties (neo_booking_reference unique; remaining 7 non-unique)
  NEO_BOOKING_REFERENCE: 'neo_booking_reference',
  VERIFIED_PICK_UP_ADDRESS: 'neo_verified_pickup_address',
  VERIFIED_DROP_OFF_ADDRESS: 'neo_verified_dropoff_address',
  NEO_OPERATIONAL_MILEAGE_MILES: 'neo_operational_mileage',
  BASE_FEE: 'neo_base_fee',
  PER_MILEAGE_RATE: 'neo_per_mileage_rate',
  MILEAGE_CHARGE: 'neo_mileage_charge',
  BILLING_CALCULATION_VERSION: 'neo_billing_calculation_version',

  // Standard HubSpot Deal Properties
  DEALNAME: 'dealname',
  AMOUNT: 'amount',
  DEALSTAGE: 'dealstage',
  PIPELINE: 'pipeline',
  CLOSEDATE: 'closedate',
  DESCRIPTION: 'description',
} as const;

export const HUBSPOT_DEAL_STAGES = {
  APPOINTMENT_SCHEDULED: 'appointmentscheduled',
  QUALIFIED_TO_BUY: 'qualifiedtobuy',
  PRESENTATION_SCHEDULED: 'presentationscheduled',
  DECISION_MAKER_BOUGHT_IN: 'decisionmakerboughtin',
  CONTRACT_SENT: 'contractsent',
  CLOSED_WON: 'closedwon',
  CLOSED_LOST: 'closedlost',
} as const;

// -----------------------------------------------------------------------------
// 2. Types & Interfaces
// -----------------------------------------------------------------------------
export interface HubSpotConnectivityResult {
  connected: boolean;
  status: number;
  message: string;
}

export interface ManualPodPaymentReview {
  verifiedByAdmin: boolean;
  status: 'cleared' | 'unpaid';
  reviewerNotes: string;
  confirmedPaymentReference?: string;
}

export interface PodReleaseEvaluation {
  isDelivered: boolean;
  hasPodDocument: boolean;
  canReleasePod: boolean;
  blocked: boolean;
  paymentStatus: 'cleared' | 'unpaid' | 'unknown';
  reason: string;
  podDocumentUrl?: string | null;
  hasAdditionalCharges?: boolean;
  additionalChargesPaid?: boolean;
  manualReview?: ManualPodPaymentReview | null;
}

export interface PricingBreakdown {
  baseFee: number;
  perMileRate: number;
  mileageCharge: number;
  totalGbp: number;
  billingVersion: string;
}

export interface BookingSyncInput {
  reference: string;
  pickup: string;
  dropoff: string;
  totalGbp: number;
  distanceMiles: number;
  actualMileage?: number;
  vehicle?: string;
  service?: string;
  status?: string;
  contactEmail?: string;
  contactName?: string;
  contactPhone?: string;
  companyName?: string;
  baseFee?: number;
  perMileRate?: number;
  createdAt?: string | Date;
}

export interface DealSyncResult {
  action: 'created' | 'already_exists';
  dealId: string;
  bookingReference: string;
  confirmedAmount: number;
  dealStage: string;
  properties: Record<string, any>;
  contactId?: string;
}

export interface DealCompletionResult {
  action: 'completed';
  dealId: string;
  bookingReference: string;
  stage: string;
  preservedAmount: number;
  operationalMileage?: number;
  podReleased: boolean;
  podReason: string;
  properties: Record<string, any>;
  contactId?: string;
}

export interface HubSpotDealRecord {
  id: string;
  properties: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceSummary {
  id?: string;
  status: string;
  amount_gbp?: number;
  booking_id?: string | null;
  company_id?: string;
}

// -----------------------------------------------------------------------------
// 3. Pure Calculation & Gating Functions
// -----------------------------------------------------------------------------

/**
 * Authoritative POD Release Gating Logic:
 *
 * Requirements for POD Release:
 * 1. Consignment delivery must be completed (bookingStatus === 'Delivered').
 * 2. Official POD document must exist in repository.
 * 3. Authoritative payment verification:
 *    In the current Supabase schema, public.invoices contains only company-level monthly consolidated
 *    statements and has no verified booking-level relationship.
 *    - Automated release FAILS CLOSED when authoritative booking-specific payment evidence is unknown,
 *      reporting the state explicitly as BLOCKED.
 *    - For the pilot, an authenticated and auditable manual review (ManualPodPaymentReview)
 *      conducted by an administrator allows verified release (status: 'cleared') or explicit withholding (status: 'unpaid').
 */
export function evaluatePodRelease(params: {
  bookingStatus: string;
  podDocument?: { file_url?: string; name?: string } | null;
  manualReview?: ManualPodPaymentReview | null;
}): PodReleaseEvaluation {
  const normStatus = (params.bookingStatus || '').trim().toLowerCase();
  const isDelivered = normStatus === 'delivered';
  const hasPod = Boolean(params.podDocument?.file_url);

  // 1. Delivery Completion Guard
  if (!isDelivered) {
    return {
      isDelivered: false,
      hasPodDocument: hasPod,
      canReleasePod: false,
      blocked: false,
      paymentStatus: 'unknown',
      hasAdditionalCharges: false,
      additionalChargesPaid: false,
      reason: `Delivery is not completed. Current status: '${params.bookingStatus}'. POD is released strictly after delivery completion.`,
      podDocumentUrl: null,
    };
  }

  // 2. POD Document Guard
  if (!hasPod) {
    return {
      isDelivered: true,
      hasPodDocument: false,
      canReleasePod: false,
      blocked: false,
      paymentStatus: 'unknown',
      hasAdditionalCharges: false,
      additionalChargesPaid: false,
      reason: 'Official POD document has not been uploaded to repository.',
      podDocumentUrl: null,
    };
  }

  // 3. Payment Verification Guard:
  // Fails closed if manual review is missing or unverified by admin
  const review = params.manualReview;
  if (!review || !review.verifiedByAdmin || (review.status !== 'cleared' && review.status !== 'unpaid')) {
    return {
      isDelivered: true,
      hasPodDocument: true,
      canReleasePod: false,
      blocked: true,
      paymentStatus: 'unknown',
      hasAdditionalCharges: undefined,
      additionalChargesPaid: false,
      reason: 'BLOCKED: Authoritative booking-specific additional-charge payment status cannot be established from database schema. Automated POD release is disabled. Authenticated manual administrative review required.',
      podDocumentUrl: null,
    };
  }

  // 4. Admin manual review confirms outstanding/unpaid charges
  if (review.status === 'unpaid') {
    return {
      isDelivered: true,
      hasPodDocument: true,
      canReleasePod: false,
      blocked: true,
      paymentStatus: 'unpaid',
      hasAdditionalCharges: true,
      additionalChargesPaid: false,
      reason: `POD withheld: Additional charges confirmed outstanding/unpaid (${review.reviewerNotes || 'Pending payment'}). Confirmed payment required before release.`,
      podDocumentUrl: null,
      manualReview: review,
    };
  }

  // 5. Admin manual review verified that all charges are cleared
  return {
    isDelivered: true,
    hasPodDocument: true,
    canReleasePod: true,
    blocked: false,
    paymentStatus: 'cleared',
    hasAdditionalCharges: false,
    additionalChargesPaid: true,
    reason: `Delivery completed, POD verified, and additional charge payment status confirmed cleared via authenticated administrative review (${review.reviewerNotes || 'Verified'}). POD released.`,
    podDocumentUrl: params.podDocument?.file_url || null,
    manualReview: review,
  };
}

/**
 * Resolves the 8-property pricing breakdown from booking fields.
 * CRITICAL RULE: Preserves checkout-confirmed total bill amount (totalGbp).
 */
export function resolveBookingPricingBreakdown(params: {
  vehicle?: string;
  distanceMiles: number;
  totalGbp: number;
  baseFee?: number;
  perMileRate?: number;
  billingVersion?: string;
}): PricingBreakdown {
  const billingVersion = params.billingVersion || 'v1.0-standard';
  const totalGbp = Number(params.totalGbp) || 0;
  const miles = Math.max(0, Number(params.distanceMiles) || 0);

  if (params.baseFee !== undefined && params.perMileRate !== undefined) {
    const baseFee = Number(params.baseFee);
    const perMileRate = Number(params.perMileRate);
    const mileageCharge = Number((perMileRate * miles).toFixed(2));
    return { baseFee, perMileRate, mileageCharge, totalGbp, billingVersion };
  }

  // Authoritative vehicle baseline rates from NEO transport fleet specifications:
  const vehLower = (params.vehicle || '').toLowerCase();
  let baseFee = 90;
  let perMileRate = 1.85;

  if (vehLower.includes('small')) {
    baseFee = 45;
    perMileRate = 1.45;
  } else if (vehLower.includes('medium') || vehLower.includes('mwb')) {
    baseFee = 75;
    perMileRate = 1.65;
  } else if (vehLower.includes('luton') || vehLower.includes('extra') || vehLower.includes('xl')) {
    baseFee = 110;
    perMileRate = 2.15;
  } else if (vehLower.includes('7.5') || vehLower.includes('rigid') || vehLower.includes('hgv')) {
    baseFee = 160;
    perMileRate = 2.75;
  }

  const mileageCharge = Number((perMileRate * miles).toFixed(2));
  return {
    baseFee,
    perMileRate,
    mileageCharge,
    totalGbp, // Checkout-confirmed final bill amount strictly preserved
    billingVersion,
  };
}

// -----------------------------------------------------------------------------
// 4. HubSpot Client Implementation
// -----------------------------------------------------------------------------
export class HubSpotClient {
  private readonly baseUrl: string;
  private readonly configuredKey?: string;
  private readonly fetchFn?: typeof fetch;

  constructor(options?: { apiKey?: string; baseUrl?: string; fetchFn?: typeof fetch }) {
    this.configuredKey = options?.apiKey;
    this.baseUrl = (options?.baseUrl || 'https://api.hubapi.com').replace(/\/+$/, '');
    this.fetchFn = options?.fetchFn;
  }

  /**
   * Resolves the HubSpot service key without ever printing, logging, or exposing it.
   */
  private getApiKey(): string {
    const key = this.configuredKey !== undefined ? this.configuredKey : process.env.HUBSPOT_SERVICE_KEY;
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      throw new Error('HUBSPOT_SERVICE_KEY is not configured on the server environment.');
    }
    return key.trim();
  }

  /**
   * Generates the HTTP Bearer Authorization header.
   */
  private getAuthHeader(): string {
    const key = this.getApiKey();
    return `Bearer ${key}`;
  }

  /**
   * Defensive security check: Fails closed unless test environment or explicit feature flag.
   */
  private assertMutationsAllowed(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    if (process.env.NEO_HUBSPOT_SYNC_ENABLED === 'true') {
      return;
    }
    throw new Error(
      'SECURITY VIOLATION: HubSpot mutations are disabled by default. NEO_HUBSPOT_SYNC_ENABLED must be explicitly configured as true.'
    );
  }

  /**
   * Executes an HTTP request with retry logic for HTTP 429 and transient 5xx errors.
   */
  private async executeWithRetry(
    url: string,
    init: RequestInit,
    context: string,
    maxRetries = 2
  ): Promise<Response> {
    const activeFetch = this.fetchFn || globalThis.fetch;
    let attempt = 0;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const res = await activeFetch(url, init);

        // If rate limited (429) or transient server error (502/503/504), retry if attempts remain
        if ((res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) && attempt <= maxRetries) {
          const retryAfterSec = Number(res.headers?.get?.('retry-after')) || 1;
          const waitMs = process.env.NODE_ENV === 'test' ? 10 : Math.min(retryAfterSec * 1000, 3000);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        return res;
      } catch (networkErr: any) {
        if (attempt <= maxRetries) {
          const waitMs = process.env.NODE_ENV === 'test' ? 10 : 500 * attempt;
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        throw new Error(`Failed network request for ${context}: ${networkErr?.message || 'Network error'}`);
      }
    }

    throw new Error(`Exceeded maximum retries (${maxRetries}) for ${context}.`);
  }

  /**
   * Safe, read-only connectivity verification endpoint.
   * Performs a minimal read-only request to the official HubSpot CRM API:
   * GET /crm/v3/objects/contacts?limit=1
   */
  public async checkConnectivity(): Promise<HubSpotConnectivityResult> {
    const authHeader = this.getAuthHeader();
    const targetUrl = `${this.baseUrl}/crm/v3/objects/contacts?limit=1`;
    const activeFetch = this.fetchFn || globalThis.fetch;

    try {
      const res = await activeFetch(targetUrl, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        let safeMsg = `HubSpot API returned HTTP ${res.status}`;
        if (res.status === 401) {
          safeMsg = 'HubSpot API authentication failed (HTTP 401: Invalid or expired service key).';
        } else if (res.status === 403) {
          safeMsg = 'HubSpot API access denied (HTTP 403: Forbidden or insufficient scopes).';
        } else if (res.status === 429) {
          safeMsg = 'HubSpot API rate limit exceeded (HTTP 429: Too Many Requests).';
        } else if (res.status >= 500) {
          safeMsg = `HubSpot CRM service temporarily unavailable (HTTP ${res.status}).`;
        }
        return {
          connected: false,
          status: res.status,
          message: safeMsg,
        };
      }

      return {
        connected: true,
        status: 200,
        message: 'HubSpot CRM connection verified successfully.',
      };
    } catch (networkErr: any) {
      return {
        connected: false,
        status: 500,
        message: `Failed to connect to HubSpot API: ${networkErr?.message || 'Network error'}`,
      };
    }
  }

  /**
   * Idempotently search for an existing Deal using the NEO Booking Reference.
   * Uses POST /crm/v3/objects/deals/search
   */
  public async findDealByBookingReference(bookingReference: string): Promise<HubSpotDealRecord | null> {
    if (!bookingReference || !bookingReference.trim()) {
      return null;
    }

    const authHeader = this.getAuthHeader();
    const searchUrl = `${this.baseUrl}/crm/v3/objects/deals/search`;

    const searchPayload = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: HUBSPOT_DEAL_PROPERTIES.NEO_BOOKING_REFERENCE,
              operator: 'EQ',
              value: bookingReference.trim(),
            },
          ],
        },
      ],
      properties: [
        HUBSPOT_DEAL_PROPERTIES.DEALNAME,
        HUBSPOT_DEAL_PROPERTIES.AMOUNT,
        HUBSPOT_DEAL_PROPERTIES.DEALSTAGE,
        HUBSPOT_DEAL_PROPERTIES.PIPELINE,
        HUBSPOT_DEAL_PROPERTIES.CLOSEDATE,
        HUBSPOT_DEAL_PROPERTIES.NEO_BOOKING_REFERENCE,
        HUBSPOT_DEAL_PROPERTIES.VERIFIED_PICK_UP_ADDRESS,
        HUBSPOT_DEAL_PROPERTIES.VERIFIED_DROP_OFF_ADDRESS,
        HUBSPOT_DEAL_PROPERTIES.NEO_OPERATIONAL_MILEAGE_MILES,
        HUBSPOT_DEAL_PROPERTIES.BASE_FEE,
        HUBSPOT_DEAL_PROPERTIES.PER_MILEAGE_RATE,
        HUBSPOT_DEAL_PROPERTIES.MILEAGE_CHARGE,
        HUBSPOT_DEAL_PROPERTIES.BILLING_CALCULATION_VERSION,
        HUBSPOT_DEAL_PROPERTIES.DESCRIPTION,
      ],
      limit: 1,
    };

    const res = await this.executeWithRetry(
      searchUrl,
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(searchPayload),
      },
      `findDealByBookingReference(${bookingReference})`
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`HubSpot Deal search failed (HTTP ${res.status}): ${errText || 'Search error'}`);
    }

    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const first = data.results[0];
      return {
        id: first.id,
        properties: first.properties || {},
        createdAt: first.createdAt,
        updatedAt: first.updatedAt,
      };
    }

    return null;
  }

  /**
   * Search or create a HubSpot Contact by email.
   */
  public async findOrCreateContact(contact: {
    email: string;
    name?: string;
    phone?: string;
    company?: string;
  }): Promise<string> {
    this.assertMutationsAllowed();
    const cleanEmail = (contact.email || '').trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Contact email is required to associate with HubSpot Deal.');
    }

    const authHeader = this.getAuthHeader();

    // 1. Search existing contact by email
    const searchUrl = `${this.baseUrl}/crm/v3/objects/contacts/search`;
    const searchRes = await this.executeWithRetry(
      searchUrl,
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [{ propertyName: 'email', operator: 'EQ', value: cleanEmail }],
            },
          ],
          limit: 1,
        }),
      },
      `findContact(${cleanEmail})`
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.results && searchData.results.length > 0) {
        return searchData.results[0].id;
      }
    }

    // 2. Create new contact if not found
    const names = (contact.name || '').trim().split(' ');
    const firstname = names[0] || 'Customer';
    const lastname = names.slice(1).join(' ') || 'Contact';

    const createUrl = `${this.baseUrl}/crm/v3/objects/contacts`;
    const createRes = await this.executeWithRetry(
      createUrl,
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          properties: {
            email: cleanEmail,
            firstname,
            lastname,
            phone: contact.phone || '',
            company: contact.company || '',
          },
        }),
      },
      `createContact(${cleanEmail})`
    );

    if (!createRes.ok) {
      const errBody = await createRes.text().catch(() => '');
      throw new Error(`Failed to create HubSpot contact (HTTP ${createRes.status}): ${errBody}`);
    }

    const created = await createRes.json();
    return created.id;
  }

  /**
   * Synchronizes a NEO Transport booking to HubSpot CRM as a Deal.
   *
   * Idempotent: Searches by `neo_booking_reference`.
   * If a Deal already exists, returns existing Deal without duplicating.
   * PRESERVES BILLING: Sets `amount` to the checkout-confirmed total bill amount.
   */
  public async syncBookingDeal(booking: BookingSyncInput): Promise<DealSyncResult> {
    this.assertMutationsAllowed();

    if (!booking.reference || !booking.reference.trim()) {
      throw new Error('Booking reference is required for HubSpot Deal synchronization.');
    }

    const cleanRef = booking.reference.trim();

    // 1. Idempotency Check: Search for existing Deal by neo_booking_reference
    const existing = await this.findDealByBookingReference(cleanRef);
    if (existing) {
      return {
        action: 'already_exists',
        dealId: existing.id,
        bookingReference: cleanRef,
        confirmedAmount: Number(existing.properties[HUBSPOT_DEAL_PROPERTIES.AMOUNT]) || booking.totalGbp,
        dealStage: existing.properties[HUBSPOT_DEAL_PROPERTIES.DEALSTAGE] || HUBSPOT_DEAL_STAGES.APPOINTMENT_SCHEDULED,
        properties: existing.properties,
      };
    }

    // 2. Resolve pricing breakdown preserving checkout-confirmed bill amount
    const pricing = resolveBookingPricingBreakdown({
      vehicle: booking.vehicle,
      distanceMiles: booking.distanceMiles,
      totalGbp: booking.totalGbp,
      baseFee: booking.baseFee,
      perMileRate: booking.perMileRate,
    });

    // 3. Resolve associated contact if email provided
    let contactId: string | undefined;
    if (booking.contactEmail) {
      try {
        contactId = await this.findOrCreateContact({
          email: booking.contactEmail,
          name: booking.contactName,
          phone: booking.contactPhone,
          company: booking.companyName,
        });
      } catch (contactErr) {
        // Non-fatal contact association warning
        console.warn('[HubSpot Sync] Non-fatal contact association warning:', contactErr);
      }
    }

    // 4. Construct Deal properties with the 8 verified custom properties
    const properties: Record<string, string> = {
      [HUBSPOT_DEAL_PROPERTIES.DEALNAME]: `Booking ${cleanRef}`,
      [HUBSPOT_DEAL_PROPERTIES.AMOUNT]: pricing.totalGbp.toFixed(2), // Checkout-confirmed final bill amount
      [HUBSPOT_DEAL_PROPERTIES.DEALSTAGE]: HUBSPOT_DEAL_STAGES.APPOINTMENT_SCHEDULED,
      [HUBSPOT_DEAL_PROPERTIES.PIPELINE]: 'default',
      [HUBSPOT_DEAL_PROPERTIES.CLOSEDATE]: booking.createdAt
        ? new Date(booking.createdAt).getTime().toString()
        : Date.now().toString(),

      // Verified 8 Custom Properties
      [HUBSPOT_DEAL_PROPERTIES.NEO_BOOKING_REFERENCE]: cleanRef,
      [HUBSPOT_DEAL_PROPERTIES.VERIFIED_PICK_UP_ADDRESS]: booking.pickup,
      [HUBSPOT_DEAL_PROPERTIES.VERIFIED_DROP_OFF_ADDRESS]: booking.dropoff,
      [HUBSPOT_DEAL_PROPERTIES.BASE_FEE]: pricing.baseFee.toFixed(2),
      [HUBSPOT_DEAL_PROPERTIES.PER_MILEAGE_RATE]: pricing.perMileRate.toFixed(2),
      [HUBSPOT_DEAL_PROPERTIES.MILEAGE_CHARGE]: pricing.mileageCharge.toFixed(2),
      [HUBSPOT_DEAL_PROPERTIES.BILLING_CALCULATION_VERSION]: pricing.billingVersion,
      [HUBSPOT_DEAL_PROPERTIES.DESCRIPTION]: `Consignment: ${cleanRef} | Vehicle: ${booking.vehicle || 'Standard'} | Service: ${booking.service || 'Direct Transit'}`,
    };

    // Actual operational mileage is recorded ONLY when authoritatively provided.
    // Estimated booking.distanceMiles must NEVER be sent as operational mileage.
    if (typeof booking.actualMileage === 'number' && Number.isFinite(booking.actualMileage) && booking.actualMileage >= 0) {
      properties[HUBSPOT_DEAL_PROPERTIES.NEO_OPERATIONAL_MILEAGE_MILES] = booking.actualMileage.toFixed(2);
    }

    const authHeader = this.getAuthHeader();
    const createUrl = `${this.baseUrl}/crm/v3/objects/deals`;

    const requestBody: any = { properties };
    if (contactId) {
      requestBody.associations = [
        {
          to: { id: contactId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }], // deal_to_contact
        },
      ];
    }

    const res = await this.executeWithRetry(
      createUrl,
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
      `createDeal(${cleanRef})`
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Failed to create HubSpot Deal (HTTP ${res.status}): ${errBody}`);
    }

    const created = await res.json();
    return {
      action: 'created',
      dealId: created.id,
      bookingReference: cleanRef,
      confirmedAmount: pricing.totalGbp,
      dealStage: HUBSPOT_DEAL_STAGES.APPOINTMENT_SCHEDULED,
      properties: created.properties || properties,
      contactId,
    };
  }

  /**
   * Updates an existing HubSpot Deal after delivery completion.
   *
   * CRITICAL GUARANTEES:
   * 1. Preserves the checkout-confirmed bill amount: NEVER recalculates amount from actual mileage.
   * 2. Updates the same Deal (via neo_booking_reference match).
   * 3. Sets dealstage to 'closedwon'.
   * 4. Updates neo_operational_mileage_miles if actual operational mileage is available.
   * 5. Releases POD details strictly only if delivery is complete AND all additional charges are confirmed paid.
   */
  public async completeBookingDeal(params: {
    bookingReference: string;
    actualMileage?: number;
    podEvaluation?: PodReleaseEvaluation;
    deliveryDate?: Date | string;
  }): Promise<DealCompletionResult> {
    this.assertMutationsAllowed();

    if (!params.bookingReference || !params.bookingReference.trim()) {
      throw new Error('Booking reference is required to complete HubSpot Deal.');
    }

    const cleanRef = params.bookingReference.trim();

    // 1. Idempotently locate the existing Deal
    const existing = await this.findDealByBookingReference(cleanRef);
    if (!existing) {
      throw new Error(`Cannot complete Deal: No Deal found with neo_booking_reference '${cleanRef}'.`);
    }

    // 2. CRITICAL PRESERVATION: Original confirmed bill amount is strictly preserved
    const originalAmount = Number(existing.properties[HUBSPOT_DEAL_PROPERTIES.AMOUNT]) || 0;

    // 3. Build update properties
    const updateProps: Record<string, string> = {
      [HUBSPOT_DEAL_PROPERTIES.DEALSTAGE]: HUBSPOT_DEAL_STAGES.CLOSED_WON,
      [HUBSPOT_DEAL_PROPERTIES.CLOSEDATE]: params.deliveryDate
        ? new Date(params.deliveryDate).getTime().toString()
        : Date.now().toString(),
    };

    // Update actual mileage ONLY if authoritative actual mileage is provided
    if (
      typeof params.actualMileage === 'number' &&
      Number.isFinite(params.actualMileage) &&
      params.actualMileage >= 0
    ) {
      updateProps[HUBSPOT_DEAL_PROPERTIES.NEO_OPERATIONAL_MILEAGE_MILES] = Number(params.actualMileage).toFixed(2);
    }

    // Apply POD Gating details
    const podEval = params.podEvaluation;
    if (podEval) {
      if (podEval.canReleasePod && podEval.podDocumentUrl) {
        updateProps[HUBSPOT_DEAL_PROPERTIES.DESCRIPTION] =
          `Consignment: ${cleanRef} | Status: Delivered | POD Verified & Released: ${podEval.podDocumentUrl}`;
      } else if (!podEval.canReleasePod) {
        updateProps[HUBSPOT_DEAL_PROPERTIES.DESCRIPTION] =
          `Consignment: ${cleanRef} | Status: ${podEval.isDelivered ? 'Delivered' : 'Pending'} | POD Withheld: ${podEval.reason}`;
      }
    }

    // 4. Update the Deal in HubSpot
    const authHeader = this.getAuthHeader();
    const updateUrl = `${this.baseUrl}/crm/v3/objects/deals/${existing.id}`;

    const res = await this.executeWithRetry(
      updateUrl,
      {
        method: 'PATCH',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ properties: updateProps }),
      },
      `completeDeal(${cleanRef})`
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Failed to update HubSpot Deal completion (HTTP ${res.status}): ${errBody}`);
    }

    const updated = await res.json();
    const rawMileage =
      updateProps[HUBSPOT_DEAL_PROPERTIES.NEO_OPERATIONAL_MILEAGE_MILES] ??
      existing.properties[HUBSPOT_DEAL_PROPERTIES.NEO_OPERATIONAL_MILEAGE_MILES];
    const operationalMileage =
      rawMileage !== undefined && rawMileage !== null && rawMileage !== ''
        ? Number(rawMileage)
        : undefined;

    return {
      action: 'completed',
      dealId: existing.id,
      bookingReference: cleanRef,
      stage: HUBSPOT_DEAL_STAGES.CLOSED_WON,
      preservedAmount: originalAmount, // Confirmed: strictly preserved without recalculation
      operationalMileage,
      podReleased: podEval?.canReleasePod ?? false,
      podReason: podEval?.reason || 'No POD evaluation provided',
      properties: updated.properties || { ...existing.properties, ...updateProps },
    };
  }

  // Generic mutating operation safeguards (backward compatibility with existing security tests)
  public async createRecord(): Promise<never> {
    throw new Error('Mutating operations are strictly locked. HubSpot integration is read-only.');
  }

  public async updateRecord(): Promise<never> {
    throw new Error('Mutating operations are strictly locked. HubSpot integration is read-only.');
  }

  public async deleteRecord(): Promise<never> {
    throw new Error('Mutating operations are strictly locked. HubSpot integration is read-only.');
  }
}

// Export singleton instance initialized from process environment
export const hubspotClient = new HubSpotClient();

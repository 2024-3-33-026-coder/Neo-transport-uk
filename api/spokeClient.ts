/**
 * SPOKE DISPATCH SERVER-SIDE API CLIENT
 * 
 * Secure, server-side client for interacting with the official Spoke Dispatch API.
 * Uses HTTP Basic Authentication with SPOKE_API_KEY as the username and empty password.
 * 
 * Base URL: https://api.spoke.com/public/v1
 * 
 * SECURITY:
 * - Credentials are loaded strictly from server environment variables.
 * - The API key is NEVER logged, printed, or exposed to the browser client.
 * - Mutating endpoints (POST/PATCH/DELETE) are locked during the foundational phase.
 */

import {
  SpokeListPlansResponse,
  SpokePlanSummary,
  SpokeCreatePlanRequest,
  SpokeStopItem,
  SpokeStopsImportResponse,
  SpokePlanStarts,
  SpokeSmokeTestExecutionResult,
  SpokePilotDispatchExecutionResult,
  isValidSpokeTrackingUrl,
  SPOKE_PORTAL_DEPOT_ID,
  SPOKE_PORTAL_DEPOT_NAME,
} from '../src/lib/spokeTypes.js';
export { isValidSpokeTrackingUrl, SPOKE_PORTAL_DEPOT_ID, SPOKE_PORTAL_DEPOT_NAME } from '../src/lib/spokeTypes.js';

export interface ISpokeClient {
  readonly isMock?: boolean;
  checkConnectivity(): Promise<{
    connected: boolean;
    status: number;
    planCount: number;
    message: string;
    isMock?: boolean;
  }>;
  listPlans(params?: {
    maxPageSize?: number;
    pageToken?: string;
  }): Promise<SpokeListPlansResponse>;
  getPlan(planId: string): Promise<SpokePlanSummary>;
  getStop(stopId: string): Promise<any>;
  createPlan(request: SpokeCreatePlanRequest): Promise<never>;
  importStops(planId: string, stops: SpokeStopItem[]): Promise<never>;
  executeControlledSmokeTest(params: {
    plan: {
      title: string;
      starts: SpokePlanStarts;
      depot?: string;
      drivers?: never;
    };
    stops: [SpokeStopItem, SpokeStopItem];
    idempotencyToken: string;
  }): Promise<SpokeSmokeTestExecutionResult>;
  executeControlledPilotDispatch(params: {
    plan: {
      title: string;
      starts: SpokePlanStarts;
      depot?: string;
    };
    bookingId: string;
    stops: [SpokeStopItem, SpokeStopItem];
    approvedPilotDriverId?: string | null;
    existingPlanId?: string | null;
  }): Promise<SpokePilotDispatchExecutionResult>;
  deleteOrCancelTestPlan(planId: string): Promise<{ success: boolean; message: string }>;
}

export class SpokeClient implements ISpokeClient {
  private readonly baseUrl: string;
  private readonly configuredKey?: string;
  private readonly fetchFn?: typeof fetch;

  constructor(options?: { apiKey?: string; baseUrl?: string; fetchFn?: typeof fetch }) {
    this.configuredKey = options?.apiKey;
    this.baseUrl = (options?.baseUrl || 'https://api.spoke.com/public/v1').replace(/\/+$/, '');
    this.fetchFn = options?.fetchFn;
  }

  /**
   * Resolves the API key without ever printing, logging, or exposing it.
   */
  private getApiKey(): string {
    const key = this.configuredKey !== undefined ? this.configuredKey : process.env.SPOKE_API_KEY;
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      throw new Error('SPOKE_API_KEY is not configured on the server environment.');
    }
    return key.trim();
  }

  /**
   * Generates the HTTP Basic Authentication header value.
   * Spoke format: Basic base64(apiKey + ":")
   */
  private getAuthHeader(): string {
    const key = this.getApiKey();
    return 'Basic ' + Buffer.from(`${key}:`).toString('base64');
  }

  /**
   * Safe, read-only connectivity verification endpoint.
   * Queries: GET /plans?maxPageSize=1
   */
  public async checkConnectivity(): Promise<{
    connected: boolean;
    status: number;
    planCount: number;
    message: string;
  }> {
    const authHeader = this.getAuthHeader();
    const targetUrl = `${this.baseUrl}/plans?maxPageSize=1`;

    try {
      const res = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        let safeMsg = `Spoke API returned HTTP ${res.status}`;
        if (res.status === 401) {
          safeMsg = 'Spoke API authentication failed (HTTP 401: Invalid or expired API key).';
        } else if (res.status === 403) {
          safeMsg = 'Spoke API access denied (HTTP 403: Forbidden).';
        } else if (res.status >= 500) {
          safeMsg = `Spoke Dispatch service temporarily unavailable (HTTP ${res.status}).`;
        }
        return {
          connected: false,
          status: res.status,
          planCount: 0,
          message: safeMsg,
        };
      }

      const data = (await res.json()) as SpokeListPlansResponse;
      const planCount = Array.isArray(data.plans) ? data.plans.length : 0;

      return {
        connected: true,
        status: 200,
        planCount,
        message: 'Successfully authenticated and connected to Spoke Dispatch API.',
      };
    } catch (_netErr: any) {
      return {
        connected: false,
        status: 0,
        planCount: 0,
        message: 'Network connection failed: Unable to reach Spoke Dispatch API service.',
      };
    }
  }

  /**
   * Read-only: Retrieves a list of Spoke plans.
   */
  public async listPlans(params?: {
    maxPageSize?: number;
    pageToken?: string;
  }): Promise<SpokeListPlansResponse> {
    const authHeader = this.getAuthHeader();
    const query = new URLSearchParams();
    if (params?.maxPageSize) query.set('maxPageSize', String(params.maxPageSize));
    if (params?.pageToken) query.set('pageToken', params.pageToken);

    const queryString = query.toString();
    const targetUrl = `${this.baseUrl}/plans${queryString ? `?${queryString}` : ''}`;

    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Spoke listPlans failed with status ${res.status}: ${errText.slice(0, 200)}`);
    }

    return (await res.json()) as SpokeListPlansResponse;
  }

  /**
   * Read-only: Retrieves a single Spoke plan by ID.
   */
  public async getPlan(planId: string): Promise<SpokePlanSummary> {
    if (!planId || !planId.trim()) {
      throw new Error('planId parameter is required');
    }

    const authHeader = this.getAuthHeader();
    const cleanId = planId.trim().startsWith('plans/') ? planId.trim() : `plans/${planId.trim()}`;
    const targetUrl = `${this.baseUrl}/${cleanId}`;

    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Spoke getPlan failed with status ${res.status}: ${errText.slice(0, 200)}`);
    }

    return (await res.json()) as SpokePlanSummary;
  }

  /**
   * GUARDED: Plan creation is locked during foundational phase.
   */

  /**
   * Read-only: Retrieves a single Spoke stop by ID.
   * Path: GET /plans/{planId}/stops/{stopId} or GET /{stopId}
   * Returns stop resource including official customer trackingLink.
   */
  public async getStop(stopId: string): Promise<any> {
    if (!stopId || !stopId.trim()) {
      throw new Error('stopId parameter is required');
    }

    const authHeader = this.getAuthHeader();
    const cleanId = stopId.trim().replace(/^\/+/, '');
    const targetUrl = `${this.baseUrl}/${cleanId}`;

    const activeFetch = this.fetchFn || globalThis.fetch;
    const res = await activeFetch(targetUrl, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Spoke getStop failed with status ${res.status}: ${errText.slice(0, 200)}`);
    }

    return await res.json();
  }

  public async createPlan(_request: SpokeCreatePlanRequest): Promise<never> {
    throw new Error(
      'RESTRICTION ENFORCED: Mutating Spoke Dispatch operations (createPlan) are locked during foundational phase.'
    );
  }

  /**
   * GUARDED: Stop import is locked during foundational phase.
   */
  public async importStops(_planId: string, _stops: SpokeStopItem[]): Promise<never> {
    throw new Error(
      'RESTRICTION ENFORCED: Mutating Spoke Dispatch operations (importStops) are locked during foundational phase.'
    );
  }

  /**
   * NARROWLY SCOPED PRODUCTION SMOKE-TEST PATHWAY
   *
   * STRICT SECURITY & COMPLIANCE RULES:
   * 1. Requires NEO_SPOKE_PRODUCTION_TEST_ENABLED=true in process.env.
   * 2. Plan title MUST begin with the fixed prefix "NEO API TEST".
   * 3. Driver assignment is strictly forbidden (drivers must be null/empty).
   * 4. Exactly two synthetic stops permitted (1 pickup, 1 delivery).
   * 5. No customer contact details (phone/email) allowed on stops.
   * 6. Both stops must have valid geographic coordinates.
   * 7. General createPlan and importStops methods remain globally locked.
   *
   * PROMINENT DISCLAIMER:
   * Spoke API documentation does not confirm all background side effects.
   * NEO Transport guarantees that no drivers are assigned, no customer contact details
   * are provided, and no route is released or dispatched.
   */
  public async executeControlledSmokeTest(params: {
    plan: {
      title: string;
      starts: SpokePlanStarts;
      depot?: string;
      drivers?: never;
    };
    stops: [SpokeStopItem, SpokeStopItem];
    idempotencyToken: string;
  }): Promise<SpokeSmokeTestExecutionResult> {
    if (process.env.NEO_SPOKE_PRODUCTION_TEST_ENABLED !== 'true') {
      throw new Error(
        'RESTRICTION ENFORCED: Spoke production test pathway is disabled. Set NEO_SPOKE_PRODUCTION_TEST_ENABLED=true to enable.'
      );
    }

    const { plan, stops } = params;

    // Strict validation of plan
    if (!plan.title || !plan.title.startsWith('NEO API TEST')) {
      throw new Error("Controlled smoke test plan title must begin with 'NEO API TEST'.");
    }
    if ((plan as any).drivers && (plan as any).drivers.length > 0) {
      throw new Error('Driver assignment is strictly forbidden in smoke test pathway.');
    }

    // Strict validation of stops
    if (!Array.isArray(stops) || stops.length !== 2) {
      throw new Error('Controlled smoke test requires exactly 2 synthetic stops (1 pickup, 1 delivery).');
    }

    const [pickup, delivery] = stops;
    if (pickup.activity !== 'pickup') {
      throw new Error("First synthetic stop must have activity 'pickup'.");
    }
    if (delivery.activity !== 'delivery') {
      throw new Error("Second synthetic stop must have activity 'delivery'.");
    }

    for (const stop of stops) {
      if (stop.recipient?.phone || stop.recipient?.email) {
        throw new Error('Synthetic stops must not contain recipient phone or email contact details.');
      }
      if (stop.allowedDrivers && stop.allowedDrivers.length > 0) {
        throw new Error('Driver assignment (allowedDrivers) is strictly forbidden on synthetic stops.');
      }
      if (
        stop.address.latitude === null ||
        stop.address.latitude === undefined ||
        stop.address.longitude === null ||
        stop.address.longitude === undefined
      ) {
        throw new Error('Synthetic stops must include verified non-null coordinates.');
      }
    }

    const authHeader = this.getAuthHeader();
    const activeFetch = this.fetchFn || globalThis.fetch;

    // Step 1: Create Plan directed to official portal depot
    const effectiveDepotId = (plan as any).depot || process.env.SPOKE_PORTAL_DEPOT_ID || SPOKE_PORTAL_DEPOT_ID;
    const createPlanUrl = `${this.baseUrl}/plans`;
    const planRes = await activeFetch(createPlanUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        title: plan.title,
        starts: plan.starts,
        depot: effectiveDepotId,
      }),
    });

    if (!planRes.ok) {
      const errText = await planRes.text();
      throw new Error(
        `Spoke smoke test plan creation failed with status ${planRes.status}: ${errText.slice(0, 200)}`
      );
    }

    const planData = (await planRes.json()) as any;
    const rawPlanId = planData.id || planData.name;
    if (!rawPlanId) {
      throw new Error('Spoke API did not return a valid plan ID for created test plan.');
    }

    const cleanPlanId = String(rawPlanId).trim().startsWith('plans/')
      ? String(rawPlanId).trim()
      : `plans/${String(rawPlanId).trim()}`;

    // Step 2: Import Exactly 2 Synthetic Stops
    // Spoke OpenAPI v3.1 expects a direct array: SpokeStopItem[]
    const importStopsUrl = `${this.baseUrl}/${cleanPlanId}/stops:import`;
    let importRes = await activeFetch(importStopsUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(stops),
    });

    // Backward-compatibility: if mock adapter or legacy upstream expects { stops: [...] }
    if (!importRes.ok && importRes.status === 400) {
      const errText = await importRes.text();
      if (errText.includes('expected object') || errText.includes('received array')) {
        importRes = await activeFetch(importStopsUrl, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ stops }),
        });
      }
    }

    // Capacity Mode Fallback: If Spoke rejects stops with vehicle_capacity_disabled, sanitize weight to notes and retry
    if (!importRes.ok && importRes.status === 422) {
      const errText = await importRes.text();
      if (errText.includes('vehicle_capacity_disabled')) {
        const capacitySanitizedStops = stops.map((s) => {
          const clone = { ...s };
          if (clone.weight) {
            const wNote = `Cargo Weight: ${clone.weight.amount} ${clone.weight.unit}`;
            clone.notes = clone.notes ? `${clone.notes} | ${wNote}` : wNote;
            delete (clone as any).weight;
          }
          return clone;
        });
        importRes = await activeFetch(importStopsUrl, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(capacitySanitizedStops),
        });
      }
    }

    if (!importRes.ok) {
      const errText = await importRes.text();
      throw new Error(
        `Spoke smoke test stop import failed with status ${importRes.status}: ${errText.slice(0, 200)}`
      );
    }

    const importData = (await importRes.json()) as SpokeStopsImportResponse;
    const importedStopIds = Array.isArray(importData.success) ? importData.success : [];
    const failedStops = Array.isArray(importData.failed) ? importData.failed : [];

    if (importedStopIds.length < 2 || failedStops.length > 0) {
      const partialErr = new Error(
        `Spoke pilot stop import partial failure: imported ${importedStopIds.length}/2 stops. Failed stops: ${JSON.stringify(failedStops)}`
      );
      (partialErr as any).planId = cleanPlanId;
      (partialErr as any).importedStopIds = importedStopIds;
      (partialErr as any).failedStops = failedStops;
      throw partialErr;
    }
return {
      success: true,
      planId: cleanPlanId,
      planTitle: plan.title,
      depotId: effectiveDepotId,
      stopsImported: importedStopIds.length || stops.length,
      stopIds: importedStopIds,
      message: `Successfully executed controlled Spoke smoke test: created plan '${plan.title}' (${cleanPlanId}) assigned to depot '${effectiveDepotId}' with ${stops.length} synthetic stops.`,
      disclaimer:
        'DISCLAIMER: Spoke API documentation does not confirm all background side effects. Plan creation and stop import are production mutations that persist in Spoke cloud systems. Disabling the feature flag will NOT delete these records. To delete the test plan, invoke the cleanup endpoint POST /api/admin/dispatch/spoke/smoke-test/cleanup with the planId, or delete it manually in the Spoke Dispatch Console.',
    };
  }

  /**
   * NARROWLY SCOPED PRODUCTION PILOT DISPATCH PATHWAY
   *
   * STRICT SECURITY & COMPLIANCE RULES:
   * 1. Requires NEO_SPOKE_PILOT_DISPATCH_ENABLED=true in process.env.
   * 2. Plan title MUST begin with the fixed prefix "NEO PILOT DISPATCH".
   * 3. Plan title MUST NOT reference "Night Run" or active non-pilot runs.
   * 4. Driver assignment is strictly limited to process.env.NEO_SPOKE_APPROVED_PILOT_DRIVER_ID.
   *    If not configured, drivers MUST be null/empty (zero notifications sent to real drivers).
   * 5. Exactly two stops permitted (1 pickup, 1 delivery).
   * 6. Both stops must have orderInfo.sellerOrderId matching the authoritative booking ID.
   * 7. General createPlan and importStops methods remain globally locked.
   */
  public async executeControlledPilotDispatch(params: {
    plan: {
      title: string;
      starts: SpokePlanStarts;
      depot?: string;
    };
    bookingId: string;
    stops: [SpokeStopItem, SpokeStopItem];
    approvedPilotDriverId?: string | null;
    existingPlanId?: string | null;
  }): Promise<SpokePilotDispatchExecutionResult> {
    if (process.env.NEO_SPOKE_PILOT_DISPATCH_ENABLED !== 'true') {
      throw new Error(
        'RESTRICTION ENFORCED: Spoke pilot dispatch pathway is disabled. Set NEO_SPOKE_PILOT_DISPATCH_ENABLED=true to enable.'
      );
    }

    const { plan, bookingId, stops, approvedPilotDriverId, existingPlanId } = params;

    // 1. Strict validation of bookingId
    if (!bookingId || typeof bookingId !== 'string' || !bookingId.trim()) {
      throw new Error('Authoritative bookingId is required for pilot dispatch.');
    }
    const cleanBookingId = bookingId.trim();

    // 2. Strict validation of plan title
    if (!plan.title || !plan.title.startsWith('NEO PILOT DISPATCH')) {
      throw new Error("Controlled pilot dispatch plan title must begin with 'NEO PILOT DISPATCH'.");
    }
    if (/night\s*run/i.test(plan.title)) {
      throw new Error('SECURITY VIOLATION: Pilot dispatch cannot alter or attach to the active NEO Night Run.');
    }

    // 3. Strict validation of stops
    if (!Array.isArray(stops) || stops.length !== 2) {
      throw new Error('Controlled pilot dispatch requires exactly 2 stops (1 pickup, 1 delivery).');
    }

    const [pickup, delivery] = stops;
    if (pickup.activity !== 'pickup') {
      throw new Error("First stop must have activity 'pickup'.");
    }
    if (delivery.activity !== 'delivery') {
      throw new Error("Second stop must have activity 'delivery'.");
    }

    // 4. Validate orderInfo.sellerOrderId on both stops
    if (pickup.orderInfo?.sellerOrderId !== cleanBookingId) {
      throw new Error(
        `Pickup stop orderInfo.sellerOrderId ('${pickup.orderInfo?.sellerOrderId}') does not match authoritative bookingId '${cleanBookingId}'.`
      );
    }
    if (delivery.orderInfo?.sellerOrderId !== cleanBookingId) {
      throw new Error(
        `Delivery stop orderInfo.sellerOrderId ('${delivery.orderInfo?.sellerOrderId}') does not match authoritative bookingId '${cleanBookingId}'.`
      );
    }

    // 5. Driver assignment guard
    const serverApprovedDriver = process.env.NEO_SPOKE_APPROVED_PILOT_DRIVER_ID?.trim() || null;
    let effectiveDriverId: string | null = null;
    if (approvedPilotDriverId) {
      if (!serverApprovedDriver || approvedPilotDriverId !== serverApprovedDriver) {
        throw new Error(
          `SECURITY VIOLATION: Driver '${approvedPilotDriverId}' is not the server-approved pilot driver. Dispatch refused.`
        );
      }
      effectiveDriverId = serverApprovedDriver;
    }

    const planDrivers = effectiveDriverId ? [{ id: effectiveDriverId }] : undefined;
    const finalStops: [SpokeStopItem, SpokeStopItem] = [
      {
        ...pickup,
        allowedDrivers: effectiveDriverId ? [effectiveDriverId] : undefined,
      },
      {
        ...delivery,
        allowedDrivers: effectiveDriverId ? [effectiveDriverId] : undefined,
      },
    ];

    const authHeader = this.getAuthHeader();
    const activeFetch = this.fetchFn || globalThis.fetch;

    // Step 1: Create Plan directed to official portal depot or reuse verified existing plan
    const effectiveDepotId = (plan as any).depot || process.env.SPOKE_PORTAL_DEPOT_ID || SPOKE_PORTAL_DEPOT_ID;
    let cleanPlanId: string;

    if (existingPlanId && typeof existingPlanId === 'string' && existingPlanId.trim()) {
      cleanPlanId = existingPlanId.trim().startsWith('plans/')
        ? existingPlanId.trim()
        : `plans/${existingPlanId.trim()}`;

      // Controlled Recovery Guard: Thoroughly verify existing plan attributes
      const existingPlan = await this.getPlan(cleanPlanId);
      if (!existingPlan) {
        throw new Error(`Existing Spoke plan '${cleanPlanId}' not found for recovery.`);
      }
      if (!existingPlan.title || !existingPlan.title.startsWith('NEO PILOT DISPATCH')) {
        throw new Error(
          `Existing Spoke plan '${cleanPlanId}' title '${existingPlan.title}' does not match required prefix 'NEO PILOT DISPATCH'.`
        );
      }
      if (/night\s*run/i.test(existingPlan.title)) {
        throw new Error('SECURITY VIOLATION: Existing plan cannot alter or attach to the active NEO Night Run.');
      }
      if (
        existingPlan.starts?.year !== plan.starts.year ||
        existingPlan.starts?.month !== plan.starts.month ||
        existingPlan.starts?.day !== plan.starts.day
      ) {
        throw new Error(
          `Existing Spoke plan '${cleanPlanId}' date (${existingPlan.starts?.year}-${String(existingPlan.starts?.month).padStart(2, '0')}-${String(existingPlan.starts?.day).padStart(2, '0')}) does not match required dispatch date (${plan.starts.year}-${String(plan.starts.month).padStart(2, '0')}-${String(plan.starts.day).padStart(2, '0')}). Attaching stops to a plan from a different operational day is prohibited.`
        );
      }
      if (effectiveDepotId && existingPlan.depot && existingPlan.depot !== effectiveDepotId) {
        throw new Error(
          `Existing Spoke plan '${cleanPlanId}' depot '${existingPlan.depot}' does not match target depot '${effectiveDepotId}'.`
        );
      }
      if (existingPlan.writable === false) {
        throw new Error(`Existing Spoke plan '${cleanPlanId}' is marked read-only / not writable.`);
      }
      if (existingPlan.distributed === true) {
        throw new Error(`Existing Spoke plan '${cleanPlanId}' is already distributed.`);
      }

      // Verify zero existing stops
      const stopsCheckRes = await activeFetch(`${this.baseUrl}/${cleanPlanId}/stops`, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      });
      if (stopsCheckRes.ok) {
        const stopsJson = (await stopsCheckRes.json()) as any;
        const currentStops = stopsJson?.stops || [];
        if (currentStops.length > 0) {
          throw new Error(
            `Existing Spoke plan '${cleanPlanId}' already contains ${currentStops.length} stops. Controlled recovery requires zero existing stops.`
          );
        }
      }
    } else {
      const createPlanUrl = `${this.baseUrl}/plans`;
      const planPayload: any = {
        title: plan.title,
        starts: plan.starts,
        depot: effectiveDepotId,
      };
      if (planDrivers) {
        planPayload.drivers = planDrivers;
      }

      const planRes = await activeFetch(createPlanUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(planPayload),
      });

      if (!planRes.ok) {
        const errText = await planRes.text();
        throw new Error(
          `Spoke pilot plan creation failed with status ${planRes.status}: ${errText.slice(0, 200)}`
        );
      }

      const planData = (await planRes.json()) as any;
      const rawPlanId = planData.id || planData.name;
      if (!rawPlanId) {
        throw new Error('Spoke API did not return a valid plan ID for created pilot plan.');
      }

      cleanPlanId = String(rawPlanId).trim().startsWith('plans/')
        ? String(rawPlanId).trim()
        : `plans/${String(rawPlanId).trim()}`;
    }

    // Step 2: Import Stops
    // Spoke OpenAPI v3.1 expects a direct array: SpokeStopItem[]
    const importStopsUrl = `${this.baseUrl}/${cleanPlanId}/stops:import`;
    let importRes: Response;
    try {
      importRes = await activeFetch(importStopsUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(finalStops),
      });

      // Backward-compatibility: if mock adapter or legacy upstream expects { stops: [...] }
      if (!importRes.ok && importRes.status === 400) {
        const errText = await importRes.text();
        if (errText.includes('expected object') || errText.includes('received array')) {
          importRes = await activeFetch(importStopsUrl, {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({ stops: finalStops }),
          });
        }
      }

      // Capacity Mode Fallback: If Spoke rejects stops with vehicle_capacity_disabled, sanitize weight to notes and retry
      if (!importRes.ok && importRes.status === 422) {
        const errText = await importRes.text();
        if (errText.includes('vehicle_capacity_disabled')) {
          const capacitySanitizedStops = finalStops.map((s) => {
            const clone = { ...s };
            if (clone.weight) {
              const wNote = `Cargo Weight: ${clone.weight.amount} ${clone.weight.unit}`;
              clone.notes = clone.notes ? `${clone.notes} | ${wNote}` : wNote;
              delete (clone as any).weight;
            }
            return clone;
          });
          importRes = await activeFetch(importStopsUrl, {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(capacitySanitizedStops),
          });
        }
      }
    } catch (netErr: any) {
      const importErr = new Error(
        `Spoke pilot stop import network error: ${netErr?.message || 'connection failed'}`
      );
      (importErr as any).planId = cleanPlanId;
      throw importErr;
    }

    if (!importRes.ok) {
      const errText = await importRes.text();
      const importErr = new Error(
        `Spoke pilot stop import failed with status ${importRes.status}: ${errText.slice(0, 200)}`
      );
      (importErr as any).planId = cleanPlanId;
      throw importErr;
    }

    const importData = (await importRes.json()) as SpokeStopsImportResponse;
    const importedStopIds = Array.isArray(importData.success) ? importData.success : [];
    const failedStops = Array.isArray(importData.failed) ? importData.failed : [];

    if (importedStopIds.length < 2 || failedStops.length > 0) {
      const partialErr = new Error(
        'Spoke pilot stop import partial failure: imported ' + importedStopIds.length + '/2 stops. Failed stops: ' + JSON.stringify(failedStops)
      );
      (partialErr as any).planId = cleanPlanId;
      (partialErr as any).importedStopIds = importedStopIds;
      (partialErr as any).failedStops = failedStops;
      throw partialErr;
    }

    // Capture individual stop tracking links for immediate booking and stop state association
    let deliveryTrackingUrl: string | null = null;
    let pickupTrackingUrl: string | null = null;
    if (importedStopIds.length >= 2) {
      try {
        const pickupStop = await this.getStop(importedStopIds[0]);
        if (pickupStop && isValidSpokeTrackingUrl(pickupStop.trackingLink)) {
          pickupTrackingUrl = pickupStop.trackingLink;
        }
      } catch (err: any) {
        console.warn('[SpokeClient] Could not fetch pickup tracking URL:', err?.message || err);
      }
      try {
        const deliveryStop = await this.getStop(importedStopIds[1]);
        if (deliveryStop && isValidSpokeTrackingUrl(deliveryStop.trackingLink)) {
          deliveryTrackingUrl = deliveryStop.trackingLink;
        }
      } catch (err: any) {
        console.warn('[SpokeClient] Could not fetch delivery tracking URL:', err?.message || err);
      }
    }

    return {
      success: true,
      planId: cleanPlanId,
      planTitle: plan.title,
      depotId: effectiveDepotId,
      bookingId: cleanBookingId,
      stopsImported: importedStopIds.length || finalStops.length,
      stopIds: importedStopIds,
      driverAssigned: effectiveDriverId,
      deliveryTrackingUrl,
      pickupTrackingUrl,
      message: `Successfully executed controlled Spoke pilot dispatch for booking '${cleanBookingId}' in plan '${plan.title}' (${cleanPlanId}) assigned to depot '${effectiveDepotId}'.`,
    };
  }

  /**
   * CONTROLLED SMOKE-TEST CLEANUP / CANCELLATION PROCEDURE
   *
   * Allows deleting or canceling a verified test plan created during controlled smoke testing.
   * STRICT SAFETY CONSTRAINTS:
   * 1. Requires NEO_SPOKE_PRODUCTION_TEST_ENABLED=true in process.env.
   * 2. Retrieves plan via GET and strictly validates that plan title begins with 'NEO API TEST'.
   *    Non-test plans can NEVER be deleted or canceled via this method.
   * 3. Sends HTTP DELETE to Spoke Dispatch API for /plans/{id}.
   */
  public async deleteOrCancelTestPlan(planId: string): Promise<{ success: boolean; message: string }> {
    if (process.env.NEO_SPOKE_PRODUCTION_TEST_ENABLED !== 'true') {
      throw new Error(
        'RESTRICTION ENFORCED: Spoke production test pathway is disabled. Set NEO_SPOKE_PRODUCTION_TEST_ENABLED=true to enable cleanup.'
      );
    }

    if (!planId || typeof planId !== 'string' || !planId.trim()) {
      throw new Error('Valid planId is required for cleanup.');
    }

    const cleanId = planId.trim().startsWith('plans/') ? planId.trim() : `plans/${planId.trim()}`;

    // Step 1: Verify the plan exists and is a test plan
    const plan = await this.getPlan(cleanId);
    if (!plan || !plan.title || !plan.title.startsWith('NEO API TEST')) {
      throw new Error(
        `SECURITY VIOLATION: Plan '${cleanId}' does not have the mandatory 'NEO API TEST' prefix. Deletion refused.`
      );
    }

    // Step 2: Issue DELETE request
    const authHeader = this.getAuthHeader();
    const activeFetch = this.fetchFn || globalThis.fetch;
    const targetUrl = `${this.baseUrl}/${cleanId}`;

    const res = await activeFetch(targetUrl, {
      method: 'DELETE',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (!res.ok && res.status !== 404) {
      const errText = await res.text();
      throw new Error(`Spoke delete plan failed with status ${res.status}: ${errText.slice(0, 200)}`);
    }

    return {
      success: true,
      message: `Successfully deleted/canceled Spoke test plan '${cleanId}'.`,
    };
  }
}

// Export singleton instance initialized from process environment
export const spokeClient = new SpokeClient();


import {
  mockSpokeAdapter,
  isMockSpokeEnabled,
  isMockSpokeRequested,
  isMockSpokePermittedEnvironment,
  assertMockSpokeConfigurationSafe,
} from './mockSpokeAdapter.js';
export {
  isMockSpokeEnabled,
  isMockSpokeRequested,
  isMockSpokePermittedEnvironment,
  assertMockSpokeConfigurationSafe,
} from './mockSpokeAdapter.js';

let customSpokeClient: ISpokeClient | null = null;

/**
 * Resolves the active Spoke client.
 * In production, strictly returns the production SpokeClient IF mock mode was not requested.
 * If mock mode was explicitly requested but is prohibited in this environment, FAILS CLOSED
 * with a hard configuration error (never silently falls back to live SpokeClient).
 * In authorized local/testing mode, returns the MockSpokeAdapter when NEO_SPOKE_MOCK_DISPATCH_ENABLED=true.
 */
export function getActiveSpokeClient(): ISpokeClient {
  if (customSpokeClient) {
    return customSpokeClient;
  }

  // 1. Fail-closed guard: if mock mode was explicitly requested but is prohibited, throw immediately
  assertMockSpokeConfigurationSafe();

  // 2. In authorized non-production environment with mock flag active, return mock adapter
  if (isMockSpokeEnabled()) {
    return mockSpokeAdapter;
  }

  // 3. Normal live client when mock was not requested
  return spokeClient;
}

/**
 * Test injection helper for unit/integration tests.
 */
export function setCustomSpokeClientForTesting(client: ISpokeClient | null): void {
  const nodeEnv = (process.env.NODE_ENV || '').trim().toLowerCase();
  const vercelEnv = (process.env.VERCEL_ENV || '').trim().toLowerCase();
  if (nodeEnv === 'production' || vercelEnv === 'production' || process.env.VERCEL === '1') {
    throw new Error('SECURITY VIOLATION: setCustomSpokeClientForTesting is restricted to test environments.');
  }
  customSpokeClient = client;
}

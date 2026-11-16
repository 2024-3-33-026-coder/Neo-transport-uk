/**
 * SPOKE DISPATCH SAFE MOCK ADAPTER (LOCAL & TEST SIMULATION)
 *
 * Provides an in-memory, zero-network-write simulation adapter for the official Spoke Dispatch API.
 * Conforms strictly to the identical ISpokeClient contract as the production SpokeClient.
 *
 * STRICT SECURITY & PRODUCTION ISOLATION:
 * 1. Mock adapter CANNOT run in production (strictly blocked if NODE_ENV=production or VERCEL_ENV=production).
 * 2. Requires explicit configuration: process.env.NEO_SPOKE_MOCK_DISPATCH_ENABLED=true.
 * 3. Makes ZERO external network requests (no fetch calls to api.spoke.com or any external URL).
 * 4. Generates unmistakably synthetic identifiers:
 *    - Plans: plans/mock-sim-pilot-${bookingId}-${timestamp}
 *    - Stops: stops/mock-sim-pickup-${bookingId}, stops/mock-sim-delivery-${bookingId}
 *    - Drivers: drivers/mock-sim-driver-... or null (no notifications sent to real drivers)
 * 5. Full support for timeout and failure simulation in test suites.
 */

import crypto from 'crypto';
import {
  SpokeListPlansResponse,
  SpokePlanSummary,
  SpokeCreatePlanRequest,
  SpokeStopItem,
  SpokePlanStarts,
  SpokeSmokeTestExecutionResult,
  SpokePilotDispatchExecutionResult,
  SPOKE_PORTAL_DEPOT_ID,
} from '../src/lib/spokeTypes.js';
import type { ISpokeClient } from './spokeClient.js';

/**
 * Checks whether mock Spoke mode was explicitly requested by configuration.
 */
export function isMockSpokeRequested(): boolean {
  const mockFlag = (process.env.NEO_SPOKE_MOCK_DISPATCH_ENABLED || '').trim().toLowerCase();
  return mockFlag === 'true' || mockFlag === '1';
}

/**
 * Checks whether the current deployment environment permits mock Spoke execution.
 *
 * STRICT PRODUCTION SAFETY GUARD:
 * - Fails closed: Prohibited if NODE_ENV is 'production' or VERCEL_ENV is 'production'.
 * - On Vercel: Prohibited unless explicitly verified as 'development' or 'preview'.
 */
export function isMockSpokePermittedEnvironment(): boolean {
  const nodeEnv = (process.env.NODE_ENV || '').trim().toLowerCase();
  const vercelEnv = (process.env.VERCEL_ENV || '').trim().toLowerCase();
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

  if (
    nodeEnv === 'production' ||
    vercelEnv === 'production' ||
    (isVercel && vercelEnv !== 'development' && vercelEnv !== 'preview')
  ) {
    return false;
  }

  return true;
}

/**
 * Validates mock Spoke configuration and strictly fails closed if mock mode
 * was explicitly requested in a prohibited production environment.
 */
export function assertMockSpokeConfigurationSafe(): void {
  if (isMockSpokeRequested() && !isMockSpokePermittedEnvironment()) {
    throw new Error(
      'SECURITY CONFIGURATION ERROR: NEO_SPOKE_MOCK_DISPATCH_ENABLED is explicitly enabled, but mock dispatch is prohibited in production or unauthorized environments. Silently falling back to live Spoke client is strictly prohibited.'
    );
  }
}

/**
 * Checks whether the safe mock Spoke dispatch adapter is permitted and enabled.
 *
 * STRICT PRODUCTION SAFETY GUARD:
 * - Fails closed: Returns false if prohibited by the environment.
 * - Requires explicit opt-in: process.env.NEO_SPOKE_MOCK_DISPATCH_ENABLED must be 'true' or '1'.
 * - Never silently activates under any circumstances.
 */
export function isMockSpokeEnabled(): boolean {
  if (!isMockSpokePermittedEnvironment()) {
    if (isMockSpokeRequested()) {
      console.warn(
        '[SECURITY VIOLATION BLOCKED] NEO_SPOKE_MOCK_DISPATCH_ENABLED=true was detected in a production environment. Mock adapter execution is strictly prohibited in production. Falling back to fail-closed error.'
      );
    }
    return false;
  }

  return isMockSpokeRequested();
}

/**
 * Mock Spoke Adapter implementing ISpokeClient with zero external network writes.
 */
export class MockSpokeAdapter implements ISpokeClient {
  public readonly isMock = true;
  private networkCallCount = 0;
  private simulatedFailure: string | null = null;
  private simulatedTimeoutMs: number | null = null;
  private mockPlans: Map<
    string,
    SpokePlanSummary & { stops?: SpokeStopItem[]; drivers?: Array<{ id: string }> }
  > = new Map();
  private recordedDispatches: Array<{
    planId: string;
    bookingId: string;
    stops: [SpokeStopItem, SpokeStopItem];
    driverAssigned: string | null;
    timestamp: string;
  }> = [];

  /**
   * Tracks attempted external network calls. In this mock adapter, this always remains 0.
   */
  public getNetworkCallCount(): number {
    return this.networkCallCount;
  }

  /**
   * Test helper: Configure the adapter to simulate an immediate downstream Spoke failure.
   */
  public simulateFailure(errorMessage?: string): void {
    this.simulatedFailure = errorMessage || 'Simulated Spoke Dispatch API gateway exception (HTTP 500)';
  }

  /**
   * Test helper: Configure the adapter to simulate an upstream network timeout.
   */
  public simulateTimeout(timeoutMs: number = 20): void {
    this.simulatedTimeoutMs = timeoutMs;
  }

  /**
   * Test helper: Clear any active simulated failure or timeout.
   */
  public clearSimulation(): void {
    this.simulatedFailure = null;
    this.simulatedTimeoutMs = null;
  }

  /**
   * Test helper: Retrieve all pilot dispatches executed through this mock adapter.
   */
  public getRecordedDispatches() {
    return [...this.recordedDispatches];
  }

  /**
   * Test helper: Reset all in-memory mock plans, recorded dispatches, and simulated errors.
   */
  public reset(): void {
    this.mockPlans.clear();
    this.recordedDispatches = [];
    this.clearSimulation();
    this.networkCallCount = 0;
  }

  /**
   * Evaluates simulated timeout or failure before returning mock data.
   */
  private async applySimulations(): Promise<void> {
    if (this.simulatedTimeoutMs !== null) {
      await new Promise((resolve) => setTimeout(resolve, this.simulatedTimeoutMs!));
      throw new Error(`Spoke mock simulation timeout after ${this.simulatedTimeoutMs}ms: Gateway Timeout.`);
    }
    if (this.simulatedFailure !== null) {
      throw new Error(this.simulatedFailure);
    }
  }

  /**
   * Safe read-only connectivity verification.
   * Confirms mock adapter active status without any external network calls.
   */
  public async checkConnectivity(): Promise<{
    connected: boolean;
    status: number;
    planCount: number;
    message: string;
    isMock: boolean;
  }> {
    await this.applySimulations();
    return {
      connected: true,
      status: 200,
      planCount: this.mockPlans.size,
      message: 'MOCK SPOKE ADAPTER: Connected in local simulation mode (Zero external network writes).',
      isMock: true,
    };
  }

  /**
   * Read-only: Lists simulated in-memory Spoke plans.
   */
  public async listPlans(_params?: {
    maxPageSize?: number;
    pageToken?: string;
  }): Promise<SpokeListPlansResponse> {
    await this.applySimulations();
    const plansList: SpokePlanSummary[] = Array.from(this.mockPlans.values()).map((p) => ({
      id: p.id,
      title: p.title,
      state: p.state,
      starts: p.starts,
      created: p.created,
      updated: p.updated,
    }));
    return { plans: plansList };
  }

  /**
   * Read-only: Retrieves a single simulated Spoke plan by ID.
   */
  public async getPlan(planId: string): Promise<SpokePlanSummary> {
    await this.applySimulations();
    if (!planId || !planId.trim()) {
      throw new Error('planId parameter is required');
    }

    const cleanId = planId.trim().startsWith('plans/') ? planId.trim() : `plans/${planId.trim()}`;
    const existing = this.mockPlans.get(cleanId);
    if (existing) {
      return {
        id: existing.id,
        title: existing.title,
        state: existing.state,
        starts: existing.starts,
        created: existing.created,
        updated: existing.updated,
      };
    }

    // Synthesize plan if it carries an approved test or mock simulation prefix
    if (cleanId.includes('mock-sim-') || cleanId.includes('test_plan')) {
      return {
        id: cleanId,
        title: `MOCK SIMULATION PLAN - ${cleanId}`,
        state: 'active',
        starts: { day: 21, month: 10, year: 2026 },
      };
    }

    throw new Error(`Spoke getPlan failed with status 404: Simulated plan '${cleanId}' not found.`);
  }

  /**
   * GUARDED: Pure createPlan remains locked, matching SpokeClient security invariants.
   */

  /**
   * Safe read-only mock getStop implementation.
   */
  public async getStop(stopId: string): Promise<any> {
    await this.applySimulations();
    if (!stopId || !stopId.trim()) {
      throw new Error('stopId parameter is required');
    }
    const cleanId = stopId.trim().replace(/^\/+/, '');
    return {
      id: cleanId,
      trackingLink: `https://track.spoke.com/mock-${cleanId.replace(/[^a-zA-Z0-9]/g, '-')}`,
    };
  }

  public async createPlan(_request: SpokeCreatePlanRequest): Promise<never> {
    throw new Error(
      'RESTRICTION ENFORCED: Mutating Spoke Dispatch operations (createPlan) are locked during foundational phase.'
    );
  }

  /**
   * GUARDED: Pure importStops remains locked, matching SpokeClient security invariants.
   */
  public async importStops(_planId: string, _stops: SpokeStopItem[]): Promise<never> {
    throw new Error(
      'RESTRICTION ENFORCED: Mutating Spoke Dispatch operations (importStops) are locked during foundational phase.'
    );
  }

  /**
   * NARROWLY SCOPED MOCK SMOKE-TEST PATHWAY
   * Validates parameters with the exact same strictness as the live client,
   * but generates synthetic in-memory IDs without any external HTTP calls.
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
    const { plan, stops } = params;

    // Strict validation of plan title
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

    await this.applySimulations();

    const cleanPlanId = `plans/mock-sim-smoke-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const stopIds = [
      `stops/mock-sim-pickup-smoke-${Date.now()}`,
      `stops/mock-sim-delivery-smoke-${Date.now()}`,
    ];

    const effectiveDepotId = (plan as any).depot || SPOKE_PORTAL_DEPOT_ID;
    this.mockPlans.set(cleanPlanId, {
      id: cleanPlanId,
      title: plan.title,
      state: 'active',
      starts: plan.starts,
      depot: effectiveDepotId,
      stops,
    });

    return {
      success: true,
      planId: cleanPlanId,
      planTitle: plan.title,
      depotId: effectiveDepotId,
      stopsImported: 2,
      stopIds,
      message: `MOCK SIMULATION: Successfully created mock smoke test plan '${plan.title}' (${cleanPlanId}) assigned to depot '${effectiveDepotId}' with 2 synthetic stops. Zero network calls made.`,
      disclaimer: 'MOCK MODE DISCLAIMER: Purely in-memory simulation. No real Spoke resources were created.',
    };
  }

  /**
   * NARROWLY SCOPED MOCK PILOT DISPATCH PATHWAY
   *
   * Strict safety invariants preserved:
   * 1. Booking reference validation.
   * 2. Plan title begins with 'NEO PILOT DISPATCH' and rejects 'Night Run'.
   * 3. Exactly 2 stops (pickup + delivery) with matching orderInfo.sellerOrderId.
   * 4. Driver assignment strictly checked (never notifies real human drivers).
   * 5. Returns unmistakably synthetic plan and stop IDs.
   * 6. Performs zero external HTTP network calls.
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

    // 5. Driver assignment guard:
    // In mock simulation, only the server-configured approved driver or a synthetic 'mock-' driver is permitted.
    // Real driver identifiers without explicit configuration are strictly rejected.
    const serverApprovedDriver = process.env.NEO_SPOKE_APPROVED_PILOT_DRIVER_ID?.trim() || null;
    let effectiveDriverId: string | null = null;
    if (approvedPilotDriverId) {
      if (serverApprovedDriver && approvedPilotDriverId === serverApprovedDriver) {
        effectiveDriverId = serverApprovedDriver;
      } else if (approvedPilotDriverId.includes('mock-')) {
        effectiveDriverId = approvedPilotDriverId;
      } else {
        throw new Error(
          `SECURITY VIOLATION: Driver '${approvedPilotDriverId}' is not the server-approved pilot driver. Dispatch refused.`
        );
      }
    }

    await this.applySimulations();

    // In controlled recovery, validate existing plan attributes if present in mock storage
    if (existingPlanId) {
      const cleanExistingId = existingPlanId.startsWith('plans/') ? existingPlanId : `plans/${existingPlanId}`;
      const existingPlan = this.mockPlans.get(cleanExistingId);
      if (existingPlan) {
        if (
          existingPlan.starts &&
          (existingPlan.starts.year !== plan.starts.year ||
            existingPlan.starts.month !== plan.starts.month ||
            existingPlan.starts.day !== plan.starts.day)
        ) {
          throw new Error(
            `Existing Spoke plan '${cleanExistingId}' date (${existingPlan.starts.year}-${String(existingPlan.starts.month).padStart(2, '0')}-${String(existingPlan.starts.day).padStart(2, '0')}) does not match required dispatch date (${plan.starts.year}-${String(plan.starts.month).padStart(2, '0')}-${String(plan.starts.day).padStart(2, '0')}). Attaching stops to a plan from a different operational day is prohibited.`
          );
        }
        if (existingPlan.stops && existingPlan.stops.length > 0) {
          throw new Error(
            `Existing Spoke plan '${cleanExistingId}' already contains ${existingPlan.stops.length} stops. Controlled recovery requires zero existing stops.`
          );
        }
      }
    }

    // Generate unmistakable synthetic identifiers
    const timestamp = Date.now();
    const cleanPlanId = existingPlanId
      ? (existingPlanId.startsWith('plans/') ? existingPlanId : `plans/${existingPlanId}`)
      : `plans/mock-sim-pilot-${cleanBookingId}-${timestamp}`;
    const stopIds = [
      `stops/mock-sim-pickup-${cleanBookingId}`,
      `stops/mock-sim-delivery-${cleanBookingId}`,
    ];

    const effectiveDepotId = (plan as any).depot || SPOKE_PORTAL_DEPOT_ID;
    this.mockPlans.set(cleanPlanId, {
      id: cleanPlanId,
      title: plan.title,
      state: 'active',
      starts: plan.starts,
      depot: effectiveDepotId,
      stops,
      drivers: effectiveDriverId ? [{ id: effectiveDriverId }] : undefined,
    });

    this.recordedDispatches.push({
      planId: cleanPlanId,
      bookingId: cleanBookingId,
      stops,
      driverAssigned: effectiveDriverId,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      planId: cleanPlanId,
      planTitle: plan.title,
      depotId: effectiveDepotId,
      bookingId: cleanBookingId,
      stopsImported: 2,
      stopIds,
      deliveryTrackingUrl: `https://track.spoke.com/mock-delivery-${cleanBookingId}`,
      pickupTrackingUrl: `https://track.spoke.com/mock-pickup-${cleanBookingId}`,
      driverAssigned: effectiveDriverId,
      message: `MOCK SIMULATION: Safely executed mock Spoke pilot dispatch for booking '${cleanBookingId}' with synthetic plan '${cleanPlanId}' assigned to depot '${effectiveDepotId}'. ZERO external network writes executed.`,
    };
  }

  /**
   * In-memory mock plan deletion/cleanup.
   */
  public async deleteOrCancelTestPlan(planId: string): Promise<{ success: boolean; message: string }> {
    await this.applySimulations();
    if (!planId || typeof planId !== 'string' || !planId.trim()) {
      throw new Error('Valid planId is required for cleanup.');
    }

    const cleanId = planId.trim().startsWith('plans/') ? planId.trim() : `plans/${planId.trim()}`;

    // Security check: only test or mock plans can be deleted
    const isMock = cleanId.includes('mock-sim-');
    const existing = this.mockPlans.get(cleanId);
    const hasTestPrefix = existing?.title?.startsWith('NEO API TEST') || cleanId.includes('test_plan');

    if (!isMock && !hasTestPrefix) {
      throw new Error(
        `SECURITY VIOLATION: Plan '${cleanId}' does not have the mandatory 'NEO API TEST' prefix. Deletion refused.`
      );
    }

    this.mockPlans.delete(cleanId);

    return {
      success: true,
      message: `Successfully deleted/canceled simulated Spoke test plan '${cleanId}'.`,
    };
  }
}

// Export singleton instance of MockSpokeAdapter
export const mockSpokeAdapter = new MockSpokeAdapter();

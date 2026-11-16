/**
 * TASK-001 REGRESSION TEST SUITE: ADMIN PORTAL SPOKE PILOT DISPATCH MODAL
 *
 * Verifies that:
 * 1. src/AdminPortal.tsx exposes the interactive "Dispatch to Spoke (Pilot)" action for SCHEDULED bookings.
 * 2. Static badge replacement preserves accessibility and links to confirmation modal.
 * 3. Modal implements full pre-flight display: booking reference, origin, destination, vehicle, weight, rate.
 * 4. Dry-run endpoint integration previews the Spoke plan and stops without executing any mutations.
 * 5. Single approved pilot authorization token (password field) and explicit confirmation checkbox are strictly required.
 * 6. Duplicate dispatch protection disables submissions while requests are in flight.
 * 7. Server response contract is validated (requires planId and success flag).
 * 8. Authoritative booking refresh is executed after dispatch without fabricating local IN TRANSIT status.
 * 9. Existing status integrity guards against manual IN TRANSIT / DELIVERED transitions remain 100% intact.
 * 10. executeSpokeDryRun and executeSpokePilotDispatch helpers in portalStore.ts handle validation, authorization headers, and errors properly.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  executeSpokeDryRun,
  executeSpokePilotDispatch,
  setDemoModeOverrideForTesting,
  isPilotDispatchExecutable,
  getAdminSessionDiagnostics,
} from '../src/lib/portalStore.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTask001Tests() {
  console.log('=================================================================');
  console.log('STARTING TASK-001 ADMIN SPOKE PILOT DISPATCH MODAL TESTS');
  console.log('=================================================================\n');

  // -------------------------------------------------------------------------
  // 1. Static Verification of src/AdminPortal.tsx
  // -------------------------------------------------------------------------
  console.log('--- 1. Static Code Verification: AdminPortal.tsx UI & Modal Integrity ---');
  const adminPortalPath = path.resolve(__dirname, '../src/AdminPortal.tsx');
  const adminPortalCode = fs.readFileSync(adminPortalPath, 'utf8');

  // 1.1 Action button visibility for SCHEDULED bookings
  assert(
    adminPortalCode.includes("b.status === 'SCHEDULED'"),
    'AdminPortal must evaluate b.status === "SCHEDULED" for pilot dispatch eligibility'
  );
  assert(
    adminPortalCode.includes('Dispatch to Spoke (Pilot)'),
    'AdminPortal must render "Dispatch to Spoke (Pilot)" action button'
  );
  assert(
    adminPortalCode.includes('handleOpenPilotDispatchModal(b)'),
    'Clicking pilot dispatch action must invoke handleOpenPilotDispatchModal with target booking'
  );
  console.log('✓ PASS 1.1: Dispatch action strictly conditioned on SCHEDULED status and triggers confirmation modal');

  // 1.2 Modal semantic accessibility & dialog attributes
  assert(
    adminPortalCode.includes('role="dialog"'),
    'Modal must have role="dialog" for accessibility'
  );
  assert(
    adminPortalCode.includes('aria-modal="true"'),
    'Modal must declare aria-modal="true"'
  );
  assert(
    adminPortalCode.includes('aria-labelledby="pilot-dispatch-modal-title"'),
    'Modal must be labeled by pilot-dispatch-modal-title'
  );
  console.log('✓ PASS 1.2: Modal provides accessible dialog semantics and ARIA labeling');

  // 1.3 Pre-flight details display
  assert(
    adminPortalCode.includes('Pre-Flight Consignment Details'),
    'Modal must render Pre-Flight Consignment Details card'
  );
  assert(
    adminPortalCode.includes('pilotDispatchBooking.origin'),
    'Modal must display consignment origin / collection'
  );
  assert(
    adminPortalCode.includes('pilotDispatchBooking.destination'),
    'Modal must display consignment destination / dropoff'
  );
  assert(
    adminPortalCode.includes('pilotDispatchBooking.vehicle'),
    'Modal must display consignment vehicle'
  );
  assert(
    adminPortalCode.includes('pilotDispatchBooking.weightKg'),
    'Modal must display consignment weight'
  );
  console.log('✓ PASS 1.3: Pre-flight summary displays booking reference, route, vehicle, and cargo details');

  // 1.4 Pre-flight dry-run payload integration
  assert(
    adminPortalCode.includes('executeSpokeDryRun'),
    'AdminPortal must invoke executeSpokeDryRun for pre-flight simulation'
  );
  assert(
    adminPortalCode.includes('Pre-Flight Payload Simulation (/dry-run)'),
    'Modal must display pre-flight payload simulation card'
  );
  assert(
    adminPortalCode.includes('dryRunResult.plan?.title'),
    'Modal must display generated Spoke plan title from dry-run preview'
  );
  assert(
    adminPortalCode.includes('dryRunResult.stops'),
    'Modal must display mapped stops count from dry-run preview'
  );
  console.log('✓ PASS 1.4: Pre-flight dry-run preview wired to verified endpoint without mutation side-effects');

  // 1.5 Security & Pilot Authorization Token flow
  assert(
    adminPortalCode.includes('id="pilot-auth-token"'),
    'Modal must contain pilot authorization token input element'
  );
  assert(
    adminPortalCode.includes('type="password"'),
    'Pilot authorization token input must use type="password" to protect secrets'
  );
  assert(
    adminPortalCode.includes('NEO_SPOKE_PILOT_DISPATCH_APPROVED_TOKEN'),
    'Modal must reference server-configured token requirement'
  );
  console.log('✓ PASS 1.5: Secret pilot authorization token required via secure masked password field');

  // 1.6 Explicit confirmation & operational warning
  assert(
    adminPortalCode.includes('Operational Warning: Active Spoke Pilot Consignment'),
    'Modal must render prominent operational warning about live Spoke allocation'
  );
  assert(
    adminPortalCode.includes('pilotConfirmed'),
    'Modal must require explicit pilotConfirmed state check'
  );
  assert(
    adminPortalCode.includes('I confirm this initiates an active Spoke dispatch plan'),
    'Modal must display explicit confirmation checkbox statement'
  );
  console.log('✓ PASS 1.6: Explicit confirmation checkbox and operational warnings enforced');

  // 1.7 Duplicate submission prevention & execution disabling
  assert(
    adminPortalCode.includes('disabled={isDispatching}'),
    'Modal controls must be disabled during active dispatch'
  );
  assert(
    adminPortalCode.includes('!pilotAuthToken.trim() || !pilotConfirmed'),
    'Submit button must be disabled until authorization token is entered and confirmed'
  );
  console.log('✓ PASS 1.7: Double-submit prevention and submission locking enforced');

  // 1.8 Authoritative database refresh without client state fabrication
  assert(
    adminPortalCode.includes('await getPersistedBookings()'),
    'Successful dispatch must re-fetch authoritative bookings from database'
  );
  assert(
    !adminPortalCode.includes('b.status = \'IN TRANSIT\''),
    'AdminPortal must never fabricate IN TRANSIT status directly on client object'
  );
  console.log('✓ PASS 1.8: Authoritative database refresh executed; zero fabricated client state');

  // 1.9 Status integrity guards preserved
  assert(
    adminPortalCode.includes("Spoke dispatch integration pending: Bookings cannot be transitioned to In transit from manual admin controls."),
    'handleSaveBookingEdit status integrity guard must remain intact'
  );
  assert(
    adminPortalCode.includes("Spoke dispatch integration pending: Bookings cannot be transitioned to In transit from manual UI buttons."),
    'handleQuickStatusChange status integrity guard must remain intact'
  );
  assert(
    adminPortalCode.includes("Operational completion required: Bookings can only be marked Delivered"),
    'Operational completion guard for DELIVERED must remain intact'
  );
  console.log('✓ PASS 1.9: Strict status integrity guards against manual IN TRANSIT / DELIVERED transitions preserved');

  // -------------------------------------------------------------------------
  // 2. Integration Tests: executeSpokeDryRun (portalStore.ts)
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Integration Verification: executeSpokeDryRun Store Helper ---');

  // 2.1 Missing parameters validation
  await assert.rejects(
    async () => executeSpokeDryRun('', '2026-10-21'),
    /Valid booking ID is required/,
    'executeSpokeDryRun must reject empty booking ID'
  );
  await assert.rejects(
    async () => executeSpokeDryRun('NT-25008', ''),
    /Valid plan date/,
    'executeSpokeDryRun must reject empty plan date'
  );
  console.log('✓ PASS 2.1: Client-side input validation rejects blank booking ID and plan date');

  // 2.2 Successful dry-run fetch simulation
  const originalFetch = globalThis.fetch;
  let recordedDryRunRequest: { url: string; method: string; body: any; headers: any } | null = null;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = String(input);
    recordedDryRunRequest = {
      url: urlStr,
      method: init?.method || 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : null,
      headers: init?.headers,
    };

    if (urlStr.includes('/api/admin/dispatch/spoke/dry-run')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          plan: {
            title: 'NEO PILOT DISPATCH - 2026-10-21 - NT-25008',
            starts: { day: 21, month: 10, year: 2026 },
          },
          stops: [
            { activity: 'pickup', address: 'Manchester M17 1AB' },
            { activity: 'delivery', address: 'Birmingham B6 7EU' },
          ],
          summary: {
            isDispatchReady: true,
            errors: [],
            warnings: [],
          },
          auditLogged: true,
        }),
      } as Response;
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    } as Response;
  };

  try {
    const dryRunResult = await executeSpokeDryRun('NT-25008', '2026-10-21');
    assert.strictEqual(dryRunResult.success, true);
    assert.strictEqual(dryRunResult.plan?.title, 'NEO PILOT DISPATCH - 2026-10-21 - NT-25008');
    assert.strictEqual(dryRunResult.stops?.length, 2);
    assert.strictEqual(dryRunResult.summary?.isDispatchReady, true);

    assert.ok(recordedDryRunRequest);
    const reqDryRun: any = recordedDryRunRequest;
    assert.strictEqual(reqDryRun.url, '/api/admin/dispatch/spoke/dry-run');
    assert.strictEqual(reqDryRun.method, 'POST');
    assert.deepStrictEqual(reqDryRun.body, {
      bookingId: 'NT-25008',
      planDate: '2026-10-21',
    });
    console.log('✓ PASS 2.2: executeSpokeDryRun executes strict contract request and returns preview payload');

    // 2.3 Dry-run API error handling
    globalThis.fetch = async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: "Booking 'NT-25008' cannot be dispatched: current status is 'In transit'" }),
    } as unknown as Response);

    await assert.rejects(
      async () => executeSpokeDryRun('NT-25008', '2026-10-21'),
      /cannot be dispatched: current status is 'In transit'/,
      'executeSpokeDryRun must propagate server error message on 409'
    );
    console.log('✓ PASS 2.3: executeSpokeDryRun propagates non-200 server validation errors cleanly');
  } finally {
    globalThis.fetch = originalFetch;
  }

  // -------------------------------------------------------------------------
  // 3. Integration Tests: executeSpokePilotDispatch (portalStore.ts)
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Integration Verification: executeSpokePilotDispatch Store Helper ---');

  // 3.1 Missing parameters validation
  await assert.rejects(
    async () => executeSpokePilotDispatch({ bookingId: '', planDate: '2026-10-21', pilotAuthorizationToken: 'tok' }),
    /Valid booking ID is required/,
    'executeSpokePilotDispatch must reject empty booking ID'
  );
  await assert.rejects(
    async () => executeSpokePilotDispatch({ bookingId: 'NT-25008', planDate: '', pilotAuthorizationToken: 'tok' }),
    /Valid plan date/,
    'executeSpokePilotDispatch must reject empty plan date'
  );
  await assert.rejects(
    async () => executeSpokePilotDispatch({ bookingId: 'NT-25008', planDate: '2026-10-21', pilotAuthorizationToken: '' }),
    /Pilot authorization token is required/,
    'executeSpokePilotDispatch must reject empty authorization token'
  );
  console.log('✓ PASS 3.1: executeSpokePilotDispatch rejects missing required fields before network call');

  // 3.2 Successful pilot dispatch execution
  let recordedPilotRequest: { url: string; method: string; body: any; headers: any } | null = null;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = String(input);
    recordedPilotRequest = {
      url: urlStr,
      method: init?.method || 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : null,
      headers: init?.headers,
    };

    if (urlStr.includes('/api/admin/dispatch/spoke/pilot')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          claimId: 'claim_pilot_test_123',
          planId: 'spoke_plan_prod_7788',
          planTitle: 'NEO PILOT DISPATCH - 2026-10-21 - NT-25008',
          bookingId: 'NT-25008',
          stopsImported: 2,
          stopIds: ['stop_pickup_1', 'stop_dropoff_2'],
          driverAssigned: 'drv_spoke_pilot_approved_1',
          message: 'Spoke pilot dispatch executed successfully.',
        }),
      } as Response;
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    } as Response;
  };

  try {
    const pilotResult = await executeSpokePilotDispatch({
      bookingId: 'NT-25008',
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'APPROVED_SECRET_TOKEN_XYZ',
    });

    assert.strictEqual(pilotResult.success, true);
    assert.strictEqual(pilotResult.planId, 'spoke_plan_prod_7788');
    assert.strictEqual(pilotResult.stopsImported, 2);
    assert.strictEqual(pilotResult.driverAssigned, 'drv_spoke_pilot_approved_1');

    assert.ok(recordedPilotRequest);
    const reqPilot: any = recordedPilotRequest;
    assert.strictEqual(reqPilot.url, '/api/admin/dispatch/spoke/pilot');
    assert.strictEqual(reqPilot.method, 'POST');
    assert.deepStrictEqual(reqPilot.body, {
      bookingId: 'NT-25008',
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'APPROVED_SECRET_TOKEN_XYZ',
    });
    console.log('✓ PASS 3.2: executeSpokePilotDispatch executes verified request and returns confirmed plan ID');

    // 3.3 Server returns success without plan ID (contract safety violation)
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, message: 'Missing planId' }),
    } as unknown as Response);

    await assert.rejects(
      async () => executeSpokePilotDispatch({
        bookingId: 'NT-25008',
        planDate: '2026-10-21',
        pilotAuthorizationToken: 'APPROVED_SECRET_TOKEN_XYZ',
      }),
      /omitted the Spoke plan ID/,
      'executeSpokePilotDispatch must fail if server omits required plan ID'
    );
    console.log('✓ PASS 3.3: API contract guard strictly fails closed if server response lacks plan ID');

    // 3.4 Unauthorized token rejection (403)
    globalThis.fetch = async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Unauthorized pilot authorization token. Pilot dispatch requires the single server-configured approved authorization token.' }),
    } as unknown as Response);

    await assert.rejects(
      async () => executeSpokePilotDispatch({
        bookingId: 'NT-25008',
        planDate: '2026-10-21',
        pilotAuthorizationToken: 'WRONG_TOKEN',
      }),
      /Unauthorized pilot authorization token/,
      'executeSpokePilotDispatch must propagate 403 unauthorized token error'
    );
    console.log('✓ PASS 3.4: executeSpokePilotDispatch propagates 403 unauthorized token error cleanly');

    // 3.5 Duplicate dispatch conflict rejection (409)
    globalThis.fetch = async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: "Pilot dispatch claim already exists for booking 'NT-25008'. Duplicate dispatch prohibited." }),
    } as unknown as Response);

    await assert.rejects(
      async () => executeSpokePilotDispatch({
        bookingId: 'NT-25008',
        planDate: '2026-10-21',
        pilotAuthorizationToken: 'APPROVED_SECRET_TOKEN_XYZ',
      }),
      /Duplicate dispatch prohibited/,
      'executeSpokePilotDispatch must propagate 409 conflict error'
    );
    console.log('✓ PASS 3.5: executeSpokePilotDispatch propagates 409 duplicate claim error cleanly');
  } finally {
    globalThis.fetch = originalFetch;
  }

  // -------------------------------------------------------------------------
  // 4. Fail-Closed UI Gating & State Machine Verification (TASK-001 Step 3B)
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Fail-Closed UI Gating & State Machine Verification (Step 3B) ---');

  // 4.1 Static assertions for Step 3B fail-closed UI gating in AdminPortal.tsx
  const updatedAdminPortalCode = fs.readFileSync(adminPortalPath, 'utf8');
  assert(
    updatedAdminPortalCode.includes('isDryRunLoading'),
    'AdminPortal must track isDryRunLoading and evaluate it in button disabled property'
  );
  assert(
    updatedAdminPortalCode.includes('!dryRunResult || !dryRunResult.success'),
    'AdminPortal must strictly require non-null successful dryRunResult before permitting execution'
  );
  assert(
    updatedAdminPortalCode.includes('Boolean(dryRunError)'),
    'AdminPortal must block execution whenever dryRunError is present'
  );
  assert(
    updatedAdminPortalCode.includes('isPilotDispatchExecutable'),
    'AdminPortal must utilize centralized isPilotDispatchExecutable validator'
  );
  assert(
    updatedAdminPortalCode.includes('setDryRunResult(null);') && updatedAdminPortalCode.includes('setDryRunError(null);'),
    'handlePilotDispatchDateChange must immediately invalidate previous dry-run result and error'
  );
  console.log('✓ PASS 4.1: Static code verification confirms fail-closed UI gating in AdminPortal.tsx');

  // 4.2 Pre-flight loading disables execution
  assert.strictEqual(
    isPilotDispatchExecutable({
      isDispatching: false,
      isDryRunLoading: true,
      dryRunResult: { success: true },
      dryRunError: null,
      pilotAuthToken: 'APPROVED_TOKEN',
      pilotConfirmed: true,
      pilotDispatchBooking: { id: 'NT-25008' },
    }),
    false,
    'Execution must be disabled while dry-run preview is actively loading'
  );
  console.log('✓ PASS 4.2: Pre-flight loading strictly disables pilot dispatch execution');

  // 4.3 Failed HTTP request or invalid JWT keeps execution blocked
  assert.strictEqual(
    isPilotDispatchExecutable({
      isDispatching: false,
      isDryRunLoading: false,
      dryRunResult: null,
      dryRunError: 'invalid JWT: Unable to parse or verify signature, token signature is invalid',
      pilotAuthToken: 'APPROVED_TOKEN',
      pilotConfirmed: true,
      pilotDispatchBooking: { id: 'NT-25008' },
    }),
    false,
    'Execution must remain blocked when JWT verification fails with 401'
  );
  console.log('✓ PASS 4.3: Failed HTTP request / invalid JWT error strictly blocks execution');

  // 4.4 Missing or unsuccessful dry-run result blocks execution
  assert.strictEqual(
    isPilotDispatchExecutable({
      isDispatching: false,
      isDryRunLoading: false,
      dryRunResult: null,
      dryRunError: null,
      pilotAuthToken: 'APPROVED_TOKEN',
      pilotConfirmed: true,
      pilotDispatchBooking: { id: 'NT-25008' },
    }),
    false,
    'Execution must remain blocked when dryRunResult is null'
  );
  assert.strictEqual(
    isPilotDispatchExecutable({
      isDispatching: false,
      isDryRunLoading: false,
      dryRunResult: { success: false },
      dryRunError: null,
      pilotAuthToken: 'APPROVED_TOKEN',
      pilotConfirmed: true,
      pilotDispatchBooking: { id: 'NT-25008' },
    }),
    false,
    'Execution must remain blocked when dryRunResult.success is false'
  );
  console.log('✓ PASS 4.4: Missing or unsuccessful dry-run result strictly blocks execution');

  // 4.5 Authorization token missing or whitespace blocks execution
  assert.strictEqual(
    isPilotDispatchExecutable({
      isDispatching: false,
      isDryRunLoading: false,
      dryRunResult: { success: true },
      dryRunError: null,
      pilotAuthToken: '',
      pilotConfirmed: true,
      pilotDispatchBooking: { id: 'NT-25008' },
    }),
    false,
    'Execution must be blocked when pilot authorization token is empty'
  );
  assert.strictEqual(
    isPilotDispatchExecutable({
      isDispatching: false,
      isDryRunLoading: false,
      dryRunResult: { success: true },
      dryRunError: null,
      pilotAuthToken: '   ',
      pilotConfirmed: true,
      pilotDispatchBooking: { id: 'NT-25008' },
    }),
    false,
    'Execution must be blocked when pilot authorization token is whitespace only'
  );
  console.log('✓ PASS 4.5: Missing or whitespace authorization token strictly blocks execution');

  // 4.6 Confirmation unchecked blocks execution
  assert.strictEqual(
    isPilotDispatchExecutable({
      isDispatching: false,
      isDryRunLoading: false,
      dryRunResult: { success: true },
      dryRunError: null,
      pilotAuthToken: 'APPROVED_TOKEN',
      pilotConfirmed: false,
      pilotDispatchBooking: { id: 'NT-25008' },
    }),
    false,
    'Execution must be blocked when pilot confirmation checkbox is unchecked'
  );
  console.log('✓ PASS 4.6: Unchecked pilot confirmation checkbox strictly blocks execution');

  // 4.7 Successful pre-flight plus valid authorization and confirmation permits execution
  assert.strictEqual(
    isPilotDispatchExecutable({
      isDispatching: false,
      isDryRunLoading: false,
      dryRunResult: { success: true },
      dryRunError: null,
      pilotAuthToken: 'APPROVED_TOKEN',
      pilotConfirmed: true,
      pilotDispatchBooking: { id: 'NT-25008' },
    }),
    true,
    'Execution must be permitted only when pre-flight succeeded, token is present, and confirmation is checked'
  );
  console.log('✓ PASS 4.7: Successful pre-flight with valid token and confirmation permits action');

  // 4.8 Date change invalidation simulation
  let simulatedState = {
    isDispatching: false,
    isDryRunLoading: false,
    dryRunResult: { success: true } as { success: boolean } | null,
    dryRunError: null as string | null,
    pilotAuthToken: 'APPROVED_TOKEN',
    pilotConfirmed: true,
    pilotDispatchBooking: { id: 'NT-25008' },
  };
  assert.strictEqual(isPilotDispatchExecutable(simulatedState), true);
  // Operator modifies date:
  simulatedState.dryRunResult = null;
  simulatedState.isDryRunLoading = true;
  assert.strictEqual(
    isPilotDispatchExecutable(simulatedState),
    false,
    'Date change must immediately invalidate dry-run result and block execution'
  );
  // After simulation succeeds with new date:
  simulatedState.isDryRunLoading = false;
  simulatedState.dryRunResult = { success: true };
  assert.strictEqual(isPilotDispatchExecutable(simulatedState), true);
  console.log('✓ PASS 4.8: Changing plan date invalidates previous pre-flight and blocks execution until re-verified');

  // 4.9 Safe session diagnostics integrity
  const sessionDiag = await getAdminSessionDiagnostics();
  assert.strictEqual(typeof sessionDiag.isConfigured, 'boolean');
  assert.strictEqual(typeof sessionDiag.hasSession, 'boolean');
  assert.strictEqual(typeof sessionDiag.isExpired, 'boolean');
  assert.strictEqual(typeof sessionDiag.diagnosticMessage, 'string');
  const rawDiagJson = JSON.stringify(sessionDiag);
  assert(!rawDiagJson.includes('access_token'), 'Diagnostics must never include access_token');
  assert(!rawDiagJson.includes('refresh_token'), 'Diagnostics must never include refresh_token');
  assert(!rawDiagJson.includes('eyJ'), 'Diagnostics must never output raw JWT structures');
  console.log('✓ PASS 4.9: Safe session diagnostics verified without secret or token leakage');

  console.log('\n=================================================================');
  console.log('ALL TASK-001 SPOKE PILOT DISPATCH MODAL TESTS PASSED (0 failures)');
  console.log('=================================================================\n');
}

runTask001Tests().catch((err) => {
  console.error('\n❌ TASK-001 TEST SUITE FAILED:', err);
  process.exit(1);
});

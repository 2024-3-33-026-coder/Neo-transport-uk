/**
 * BOOKING PERSISTENCE CONTAINMENT & SCHEMA INTEGRITY REGRESSION TESTS
 *
 * Verifies that:
 * 1. Successful remote save commits to the confirmed local cache and cleans up drafts.
 * 2. Supabase schema error (PGRST204 / missing columns) is detected and throws rather than masking.
 * 3. On schema failure, the booking is strictly OMITTED from the confirmed bookings list.
 * 4. The customer's entered details are preserved in recoverable draft storage with failure details.
 * 5. Network / transport errors fail closed and preserve user draft without confirming.
 * 6. Safe retry mechanism recovers the preserved draft and commits to confirmed cache upon resolution.
 * 7. Demo mode bypass is strictly gated and does not mask live production errors when disabled.
 */

import assert from 'assert';
import {
  persistBooking,
  getPersistedBookings,
  setCustomSupabaseClient,
  setDemoModeOverrideForTesting,
  getStoredFailedBookingDraft,
  clearFailedBookingDraft,
  getPersistedWizardDraft,
  persistWizardDraft,
  STORAGE_FAILED_BOOKING_DRAFT_KEY,
} from '../src/lib/portalStore.ts';
import { Booking, BookingWizardState } from '../src/types.ts';

// Setup minimal localStorage mock for Node test environment
if (!globalThis.localStorage) {
  const memoryStore = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => memoryStore.get(k) ?? null,
    setItem: (k: string, v: string) => { memoryStore.set(k, String(v)); },
    removeItem: (k: string) => { memoryStore.delete(k); },
    clear: () => { memoryStore.clear(); },
    key: (i: number) => Array.from(memoryStore.keys())[i] ?? null,
    length: 0,
  } as Storage;
  Object.defineProperty(globalThis.localStorage, 'length', {
    get: () => memoryStore.size,
  });
}

const sampleBooking: Booking = {
  id: 'NT-90001',
  reference: 'NT-90001',
  date: 'Today',
  origin: 'Manchester M17 1AB',
  destination: 'Birmingham B6 7EU',
  vehicle: 'Sprinter LWB',
  total: 285,
  status: 'SCHEDULED',
  payment_method: 'standby-account',
  payment_status: 'standby_terms',
  amount_paid_gbp: 0,
  cargo: 'Critical aviation fasteners',
  weightKg: 350,
  palletCount: 1,
  pickupTime: 'ASAP',
  deliveryTime: '88 min',
  progress: 0.05,
};

const sampleWizardState: BookingWizardState = {
  pickupPostcode: 'Manchester M17 1AB',
  pickupContact: 'Warehouse Gate 3',
  pickupPhone: '0161 555 0199',
  contactName: 'Warehouse Gate 3',
  contactPhone: '0161 555 0199',
  collectionWindow: 'ASAP — ready now',
  dropoffPostcode: 'Birmingham B6 7EU',
  dropoffContact: 'Receiving Team Dock 4',
  dropoffPhone: '0121 496 0288',
  recipientName: 'Receiving Team Dock 4',
  recipientPhone: '0121 496 0288',
  deliveryWindow: 'Direct transit (approx 88 min)',
  deliveryInstructions: 'Call 15 min prior to arrival',
  cargoDescription: 'Critical aviation fasteners',
  cargoWeightKg: 350,
  palletCount: 1,
  itemsCount: 1,
  cargoHazmat: false,
  selectedVehicle: 'Sprinter LWB',
  selectedService: 'Emergency (ASAP)',
  estimatedMiles: 88,
  estimatedTotal: 285,
  paymentMethod: 'standby-account',
  poReference: 'PO-AERO-2026-09',
  poNumber: 'PO-AERO-2026-09',
  notes: 'High priority shipment',
};

async function runTests() {
  console.log('=================================================================');
  console.log('STARTING BOOKING PERSISTENCE CONTAINMENT REGRESSION TESTS');
  console.log('=================================================================');

  // ---------------------------------------------------------------------------
  // TEST 1: Successful Remote Persistence Commits to Cache and Clears Drafts
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. Testing Successful Remote Persistence ---');
  let insertedPayload: any = null;
  const healthySupabaseClient = {
    from: (table: string) => {
      if (table === 'bookings') {
        return {
          insert: (payload: any) => {
            insertedPayload = payload;
            return Promise.resolve({ data: [payload], error: null });
          },
          select: () => ({
            order: () => Promise.resolve({ data: [insertedPayload], error: null }),
          }),
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    },
  };

  setCustomSupabaseClient(healthySupabaseClient as any);
  setDemoModeOverrideForTesting(false);
  localStorage.clear();

  const savedBooking = await persistBooking(sampleBooking, sampleWizardState, 'comp-meridian-001');

  assert.strictEqual(savedBooking.id, 'NT-90001', 'Must return the saved booking on success');
  assert(insertedPayload !== null, 'Remote insert must be executed');
  assert.strictEqual(insertedPayload.id, 'NT-90001', 'Inserted payload ID must match');

  // Verify confirmed storage
  const persistedList = await getPersistedBookings();
  assert(
    persistedList.some((b) => b.id === 'NT-90001'),
    'Confirmed booking must exist in persisted bookings'
  );

  // Verify failed draft is null/cleared
  const failedDraftAfterSuccess = getStoredFailedBookingDraft();
  assert.strictEqual(failedDraftAfterSuccess, null, 'Failed booking draft must be null after success');
  console.log('✓ PASS: Successful remote save properly commits to confirmed cache and clears drafts');

  // ---------------------------------------------------------------------------
  // TEST 2: Schema Error (PGRST204) Fails Closed and Preserves Recoverable Draft
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Testing Supabase Schema Error (PGRST204 / Column Missing) ---');
  const schemaErrorSupabaseClient = {
    from: (table: string) => {
      if (table === 'bookings') {
        return {
          insert: (_payload: any) => {
            return Promise.resolve({
              data: null,
              error: {
                code: 'PGRST204',
                message: "Could not find the 'payment_status' column of 'bookings' in the schema cache",
                details: null,
                hint: null,
              },
            });
          },
          select: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    },
  };

  setCustomSupabaseClient(schemaErrorSupabaseClient as any);
  setDemoModeOverrideForTesting(false);
  localStorage.clear();

  const brokenBooking: Booking = {
    ...sampleBooking,
    id: 'NT-90002',
    reference: 'NT-90002',
  };

  let threwError = false;
  let capturedErrorMsg = '';
  try {
    await persistBooking(brokenBooking, sampleWizardState, 'comp-meridian-001');
  } catch (err: any) {
    threwError = true;
    capturedErrorMsg = err?.message || String(err);
  }

  assert(threwError, 'persistBooking MUST throw when Supabase rejects with schema error');
  assert(
    capturedErrorMsg.includes('PGRST204') || capturedErrorMsg.includes('payment_status'),
    `Error message must report schema rejection. Got: ${capturedErrorMsg}`
  );

  // CRITICAL INTEGRITY CHECK: The booking must NOT be added to confirmed storage!
  const confirmedListAfterSchemaError = await getPersistedBookings();
  assert(
    !confirmedListAfterSchemaError.some((b) => b.id === 'NT-90002'),
    'CRITICAL: Rejected booking NT-90002 must NEVER appear in confirmed storage'
  );

  // Verify recoverable draft is preserved
  const failedDraft = getStoredFailedBookingDraft();
  assert(failedDraft !== null, 'Failed draft must be saved to storage');
  assert.strictEqual(failedDraft?.booking.id, 'NT-90002', 'Failed draft must preserve booking reference');
  assert.strictEqual(failedDraft?.wizardState?.cargoDescription, 'Critical aviation fasteners', 'Draft must preserve cargo details');
  assert.strictEqual(failedDraft?.wizardState?.poReference, 'PO-AERO-2026-09', 'Draft must preserve PO reference');
  assert.strictEqual(failedDraft?.code, 'PGRST204', 'Failed draft must record error code PGRST204');

  // Verify wizard state draft is preserved
  const preservedWizardState = getPersistedWizardDraft();
  assert.strictEqual(preservedWizardState.pickupPostcode, 'Manchester M17 1AB', 'Wizard draft must preserve pickup postcode');
  assert.strictEqual(preservedWizardState.dropoffPostcode, 'Birmingham B6 7EU', 'Wizard draft must preserve dropoff postcode');
  console.log('✓ PASS: Schema error (PGRST204) strictly fails closed, preserves recoverable draft, and omits booking from confirmed cache');

  // ---------------------------------------------------------------------------
  // TEST 3: Network Transport Failure Fails Closed
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Testing Network Disruption / Fetch Failure ---');
  const networkErrorSupabaseClient = {
    from: (table: string) => {
      if (table === 'bookings') {
        return {
          insert: () => Promise.reject(new Error('TypeError: Failed to fetch (ECONNREFUSED)')),
          select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    },
  };

  setCustomSupabaseClient(networkErrorSupabaseClient as any);
  setDemoModeOverrideForTesting(false);
  localStorage.clear();

  const networkBooking: Booking = {
    ...sampleBooking,
    id: 'NT-90003',
    reference: 'NT-90003',
  };

  let networkThrew = false;
  try {
    await persistBooking(networkBooking, sampleWizardState, 'comp-meridian-001');
  } catch (err: any) {
    networkThrew = true;
    assert(err.message.includes('ECONNREFUSED') || err.message.includes('fetch'), 'Must propagate network error');
  }

  assert(networkThrew, 'persistBooking MUST throw on network failure');
  const confirmedAfterNetwork = await getPersistedBookings();
  assert(
    !confirmedAfterNetwork.some((b) => b.id === 'NT-90003'),
    'Network-failed booking must NOT be added to confirmed storage'
  );

  const networkFailedDraft = getStoredFailedBookingDraft();
  assert(networkFailedDraft !== null, 'Network failure must record failed draft');
  assert.strictEqual(networkFailedDraft?.booking.id, 'NT-90003');
  console.log('✓ PASS: Network transport error fails closed and preserves draft without false confirmation');

  // ---------------------------------------------------------------------------
  // TEST 4: Safe Retry Mechanism Resolves Preserved Draft
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Testing Draft Recovery and Safe Retry Path ---');
  // First, verify we have a failed draft from Test 3
  const draftToRetry = getStoredFailedBookingDraft();
  assert(draftToRetry !== null, 'Must have a preserved draft to retry');

  // Now, simulate database recovery (or schema migration applied)
  let retryInsertedPayload: any = null;
  const recoveredSupabaseClient = {
    from: (table: string) => {
      if (table === 'bookings') {
        return {
          insert: (payload: any) => {
            retryInsertedPayload = payload;
            return Promise.resolve({ data: [payload], error: null });
          },
          select: () => ({
            order: () => Promise.resolve({ data: [retryInsertedPayload], error: null }),
          }),
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    },
  };

  setCustomSupabaseClient(recoveredSupabaseClient as any);

  // Execute retry using the preserved draft
  const retryResult = await persistBooking(
    draftToRetry.booking,
    draftToRetry.wizardState || undefined,
    draftToRetry.companyId || undefined
  );

  assert.strictEqual(retryResult.id, 'NT-90003', 'Retry must return the confirmed booking');
  assert(retryInsertedPayload !== null, 'Retry must execute insert against Supabase');

  // Verify now present in confirmed storage
  const confirmedAfterRetry = await getPersistedBookings();
  assert(
    confirmedAfterRetry.some((b) => b.id === 'NT-90003'),
    'Retried booking must now be in confirmed storage'
  );

  // Verify failed draft is cleanly removed
  assert.strictEqual(getStoredFailedBookingDraft(), null, 'Failed draft must be cleared after successful retry');
  console.log('✓ PASS: Preserved draft successfully retried and committed to central store upon database recovery');

  // ---------------------------------------------------------------------------
  // TEST 5: Portal UI Handler Containment Invariants
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Testing Portal UI State Handler Containment ---');
  // Simulate handleBookingCreated behavior
  let uiBookings: Booking[] = [];
  let activeTrackingId: string | null = null;
  let uiPersistenceError: string | null = null;

  const simulateHandleBookingCreated = async (newBooking: Booking, finalWizardState?: BookingWizardState) => {
    uiPersistenceError = null;
    try {
      await persistBooking(newBooking, finalWizardState, 'comp-meridian-001');
      uiBookings = [newBooking, ...uiBookings.filter((b) => b.id !== newBooking.id)];
      activeTrackingId = newBooking.id;
    } catch (err: any) {
      uiPersistenceError = err?.message || String(err);
      throw err;
    }
  };

  // 5A: When Supabase fails, UI state must NOT transition to tracking
  setCustomSupabaseClient(schemaErrorSupabaseClient as any);
  let uiThrew = false;
  try {
    await simulateHandleBookingCreated({
      ...sampleBooking,
      id: 'NT-90005',
      reference: 'NT-90005',
    }, sampleWizardState);
  } catch {
    uiThrew = true;
  }

  assert(uiThrew, 'UI handler must catch and surface persistence failure');
  assert(uiPersistenceError !== null, 'UI persistence error state must be populated');
  assert.strictEqual(activeTrackingId, null, 'Active tracking ID must NOT be set on persistence failure');
  assert.strictEqual(uiBookings.length, 0, 'UI bookings list must NOT contain unconfirmed booking');
  console.log('✓ PASS: UI handler strictly gates tracking navigation and confirmed list on successful remote persistence');

  // 5B: When Supabase succeeds, UI state transitions correctly
  setCustomSupabaseClient(recoveredSupabaseClient as any);
  await simulateHandleBookingCreated({
    ...sampleBooking,
    id: 'NT-90006',
    reference: 'NT-90006',
  }, sampleWizardState);

  assert.strictEqual(uiPersistenceError, null, 'UI error must be cleared on success');
  assert.strictEqual(activeTrackingId, 'NT-90006', 'Active tracking ID must be set on success');
  assert.strictEqual(uiBookings.length, 1, 'Confirmed booking must be added to UI bookings list');
  console.log('✓ PASS: UI handler transitions to tracking view once persistence is verified');

  console.log('\n=================================================================');
  console.log('ALL BOOKING PERSISTENCE CONTAINMENT TESTS PASSED (0 failures)');
  console.log('=================================================================');
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});

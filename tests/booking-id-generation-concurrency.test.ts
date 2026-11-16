/**
 * BOOKING IDENTITY GENERATION & CONCURRENCY REGRESSION TEST SUITE
 *
 * Verifies:
 * 1. New booking with an ID that does not already exist persists cleanly.
 * 2. Collision with an existing booking ID is handled gracefully (automatically regenerates reference and persists).
 * 3. Concurrent booking submissions do not collide and persist distinct records.
 * 4. Retry after an ambiguous response or network timeout is idempotent:
 *    matches existing identical record, does NOT throw duplicate key (SQLSTATE 23505),
 *    and returns the confirmed booking.
 * 5. Failed persistence (e.g. fatal transport or schema failure) strictly keeps the booking unconfirmed
 *    and preserves user draft details without false confirmation.
 */

import assert from 'assert';
import {
  persistBooking,
  getNextBookingReference,
  getNextBookingReferenceAsync,
  getPersistedBookings,
  getStoredBookings,
  setCustomSupabaseClient,
  setDemoModeOverrideForTesting,
  getStoredFailedBookingDraft,
  clearFailedBookingDraft,
  getPersistedWizardDraft,
  STORAGE_BOOKINGS_KEY,
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
  cargoDescription: 'Critical manufacturing parts',
  cargoWeightKg: 400,
  palletCount: 1,
  itemsCount: 1,
  cargoHazmat: false,
  selectedVehicle: 'Sprinter LWB',
  selectedService: 'Emergency (ASAP)',
  estimatedMiles: 88,
  estimatedTotal: 295,
  paymentMethod: 'standby-account',
  poReference: 'PO-2026-CONCURRENCY-1',
  poNumber: 'PO-2026-CONCURRENCY-1',
  notes: 'High priority shipment',
};

async function runTests() {
  console.log('=================================================================');
  console.log('STARTING BOOKING IDENTITY & CONCURRENCY REGRESSION TESTS');
  console.log('=================================================================');

  // Simulated Database State
  const dbBookings = new Map<string, any>();
  let sequenceCounter = 25100;

  function createMockSupabaseClient() {
    return {
      rpc: (funcName: string) => {
        if (funcName === 'generate_booking_reference') {
          sequenceCounter++;
          return Promise.resolve({ data: `NT-${sequenceCounter}`, error: null });
        }
        return Promise.resolve({ data: null, error: { message: `Unknown function: ${funcName}` } });
      },
      from: (table: string) => {
        if (table === 'bookings') {
          return {
            insert: (payload: any) => {
              if (dbBookings.has(payload.id)) {
                return Promise.resolve({
                  data: null,
                  error: {
                    code: '23505',
                    message: `duplicate key value violates unique constraint "bookings_pkey" (SQLSTATE 23505)`,
                    details: `Key (id)=(${payload.id}) already exists.`,
                  },
                });
              }
              dbBookings.set(payload.id, { ...payload });
              return Promise.resolve({ data: [payload], error: null });
            },
            select: () => ({
              eq: (col: string, val: any) => ({
                maybeSingle: () => {
                  if (col === 'id' && dbBookings.has(val)) {
                    return Promise.resolve({ data: dbBookings.get(val), error: null });
                  }
                  return Promise.resolve({ data: null, error: null });
                },
              }),
              order: () => Promise.resolve({ data: Array.from(dbBookings.values()), error: null }),
            }),
          };
        }
        return { select: () => Promise.resolve({ data: [], error: null }) };
      },
    };
  }

  setDemoModeOverrideForTesting(false);

  // ---------------------------------------------------------------------------
  // TEST 1: New Booking with an ID that Does Not Already Exist
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. Testing New Booking with Unique ID ---');
  dbBookings.clear();
  localStorage.clear();
  setCustomSupabaseClient(createMockSupabaseClient() as any);

  const initialRef = await getNextBookingReferenceAsync();
  assert(initialRef.startsWith('NT-'), `Reference must start with NT-, got: ${initialRef}`);

  const booking1: Booking = {
    id: initialRef,
    reference: initialRef,
    date: 'Today',
    origin: 'Manchester M17 1AB',
    destination: 'Birmingham B6 7EU',
    vehicle: 'Sprinter LWB',
    total: 295,
    status: 'SCHEDULED',
    payment_method: 'standby-account',
    payment_status: 'standby_terms',
    amount_paid_gbp: 0,
    cargo: 'Critical manufacturing parts',
    weightKg: 400,
    palletCount: 1,
    pickupTime: 'Now',
    deliveryTime: '88 min',
    progress: 0.05,
  };

  const saved1 = await persistBooking(booking1, sampleWizardState, 'comp-meridian-001');
  assert.strictEqual(saved1.id, initialRef, 'Must save and return booking with expected ID');
  assert(dbBookings.has(initialRef), 'Database must contain persisted booking');
  const storedList1 = await getPersistedBookings();
  assert(storedList1.some((b) => b.id === initialRef), 'Confirmed storage must include saved booking');
  assert.strictEqual(getStoredFailedBookingDraft(), null, 'Failed draft must be clear');
  console.log('✓ PASS: New booking with fresh ID persists cleanly to database and confirmed storage');

  // ---------------------------------------------------------------------------
  // TEST 2: Collision with Existing Booking ID Handled Gracefully
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Testing Collision with Existing Booking ID Handled Gracefully ---');
  // Seed an existing conflicting booking in the database under an existing ID (e.g. NT-24818 from another tenant)
  const conflictingId = 'NT-24818';
  dbBookings.set(conflictingId, {
    id: conflictingId,
    company_id: 'c-neo-ops',
    pickup: 'London E1 6AN',
    dropoff: 'Leeds LS1 5AA',
    total_gbp: 450,
  });

  // Attempt to submit a new booking proposing the conflicting ID NT-24818
  const collidingBooking: Booking = {
    ...booking1,
    id: conflictingId,
    reference: conflictingId,
    total: 295, // Different total & route from seed above
  };

  const resolvedBooking = await persistBooking(collidingBooking, sampleWizardState, 'comp-meridian-001');

  // The collision handler must have detected the 23505 conflict, recognized it is NOT an idempotent retry,
  // regenerated a fresh non-colliding reference, and persisted successfully!
  assert.notStrictEqual(resolvedBooking.id, conflictingId, 'Must not clobber existing booking ID');
  assert(resolvedBooking.id.startsWith('NT-'), `Must generate valid NT- reference: ${resolvedBooking.id}`);
  assert(dbBookings.has(resolvedBooking.id), 'Database must contain the regenerated booking');
  assert.strictEqual(dbBookings.get(conflictingId).company_id, 'c-neo-ops', 'Existing conflicting booking must be preserved intact');

  const storedList2 = await getPersistedBookings();
  assert(storedList2.some((b) => b.id === resolvedBooking.id), 'Confirmed storage must contain resolved booking');
  assert(!storedList2.some((b) => b.id === conflictingId && b.total === 295), 'Must not attribute conflicting ID to new booking');
  console.log(`✓ PASS: Collision on ${conflictingId} resolved: regenerated to ${resolvedBooking.id} without clobbering existing record`);

  // ---------------------------------------------------------------------------
  // TEST 3: Concurrent Booking Submissions
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Testing Concurrent Booking Submissions ---');
  // Two concurrent submissions initiated at the same time proposing overlapping/default IDs
  const concurrentSubmission1 = async () => {
    const ref = 'NT-CONFLICT-CONCURRENT';
    const b: Booking = {
      ...booking1,
      id: ref,
      reference: ref,
      origin: 'Leeds LS1 1AA',
      destination: 'Bristol BS1 1BB',
      total: 310,
    };
    return persistBooking(b, { ...sampleWizardState, poReference: 'CONCURRENT-1' }, 'comp-meridian-001');
  };

  const concurrentSubmission2 = async () => {
    const ref = 'NT-CONFLICT-CONCURRENT';
    const b: Booking = {
      ...booking1,
      id: ref,
      reference: ref,
      origin: 'Sheffield S1 1AA',
      destination: 'Newcastle NE1 1BB',
      total: 340,
    };
    return persistBooking(b, { ...sampleWizardState, poReference: 'CONCURRENT-2' }, 'comp-meridian-001');
  };

  const [res1, res2] = await Promise.all([concurrentSubmission1(), concurrentSubmission2()]);

  assert(res1 && res2, 'Both concurrent submissions must resolve successfully');
  assert.notStrictEqual(res1.id, res2.id, `Concurrent submissions must receive distinct IDs! res1=${res1.id}, res2=${res2.id}`);
  assert(dbBookings.has(res1.id), `Database must contain res1 (${res1.id})`);
  assert(dbBookings.has(res2.id), `Database must contain res2 (${res2.id})`);
  console.log(`✓ PASS: Concurrent submissions resolved collision-free: res1=${res1.id}, res2=${res2.id}`);

  // ---------------------------------------------------------------------------
  // TEST 4: Retry after Ambiguous Network Response (Idempotent Retry)
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Testing Idempotent Retry after Ambiguous Network Response ---');
  // Scenario: Client submits NT-25120. Database writes it successfully.
  // But client connection drops before receiving 200 OK.
  // Client retries the submission with the exact same booking reference and payload.
  const retryRef = 'NT-25120';
  const retryBooking: Booking = {
    ...booking1,
    id: retryRef,
    reference: retryRef,
    origin: 'Liverpool L1 1AA',
    destination: 'Nottingham NG1 1AA',
    total: 240,
  };

  // First submission succeeds into DB
  const firstPass = await persistBooking(retryBooking, sampleWizardState, 'comp-meridian-001');
  assert.strictEqual(firstPass.id, retryRef);

  // Now simulate client retrying the exact same booking
  const secondPass = await persistBooking(retryBooking, sampleWizardState, 'comp-meridian-001');

  // Must recognize identical existing record, NOT throw 23505, and return confirmed booking
  assert.strictEqual(secondPass.id, retryRef, 'Idempotent retry must preserve same booking reference');
  assert.strictEqual(secondPass.origin, 'Liverpool L1 1AA', 'Must return identical booking details');
  assert.strictEqual(getStoredFailedBookingDraft(), null, 'Failed draft must remain cleared on idempotent retry');
  console.log('✓ PASS: Idempotent retry recognized matching booking without unique violation or duplicate records');

  // ---------------------------------------------------------------------------
  // TEST 5: Failed Persistence Remains Unconfirmed while Preserving Draft
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Testing Failed Persistence Remains Unconfirmed and Preserves Draft ---');
  // Simulate complete database transport failure / server down
  const brokenClient = {
    rpc: () => Promise.reject(new Error('Connection terminated unexpectedly')),
    from: () => ({
      insert: () => Promise.reject(new Error('ECONNREFUSED 5432: database unreachable')),
      select: () => ({
        maybeSingle: () => Promise.reject(new Error('ECONNREFUSED')),
        order: () => Promise.reject(new Error('ECONNREFUSED')),
      }),
    }),
  };

  setCustomSupabaseClient(brokenClient as any);
  localStorage.clear();

  const doomedRef = 'NT-DOOMED-99';
  const doomedBooking: Booking = {
    ...booking1,
    id: doomedRef,
    reference: doomedRef,
  };

  let failureCaught = false;
  try {
    await persistBooking(doomedBooking, sampleWizardState, 'comp-meridian-001');
  } catch (err: any) {
    failureCaught = true;
    assert(err.message.includes('ECONNREFUSED') || err.message.includes('transport'), 'Must report connection failure');
  }

  assert(failureCaught, 'persistBooking MUST throw when persistence cannot be achieved');

  // Must strictly NOT be in confirmed storage
  const confirmedAfterFailure = getStoredBookings();
  assert(!confirmedAfterFailure.some((b) => b.id === doomedRef), 'CRITICAL: Failed booking must NOT be confirmed in storage');

  // Preserved draft MUST exist with exact entered details
  const failedDraft = getStoredFailedBookingDraft();
  assert(failedDraft !== null, 'Failed draft must be saved');
  assert.strictEqual(failedDraft?.booking.id, doomedRef);
  assert.strictEqual(failedDraft?.wizardState?.cargoDescription, 'Critical manufacturing parts');
  assert.strictEqual(failedDraft?.wizardState?.poReference, 'PO-2026-CONCURRENCY-1');

  // Preserved wizard draft must allow retry
  const preservedWizard = getPersistedWizardDraft();
  assert.strictEqual(preservedWizard.pickupPostcode, 'Manchester M17 1AB');
  assert.strictEqual(preservedWizard.dropoffPostcode, 'Birmingham B6 7EU');
  console.log('✓ PASS: Persistence failure strictly fails closed, omits booking from confirmed cache, and preserves recoverable draft');

  console.log('\n=================================================================');
  console.log('ALL BOOKING IDENTITY & CONCURRENCY TESTS PASSED (0 failures)');
  console.log('=================================================================');
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});

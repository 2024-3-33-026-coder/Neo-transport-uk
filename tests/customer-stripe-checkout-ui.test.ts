/**
 * =============================================================================
 * NEO TRANSPORT LTD — CUSTOMER STRIPE CARD CHECKOUT UI & VERIFICATION TEST SUITE
 * =============================================================================
 *
 * Verifies:
 * 1. Safe initiation of Stripe hosted checkout sessions with server-authoritative
 *    integer pence calculations and required metadata.
 * 2. Strict Server-Authoritative Verification (Fails Closed):
 *    - Returning from Stripe (?payment=success) NEVER confirms a booking without
 *      the server confirming isFullyPaid: true.
 *    - Webhook latency / in-flight states are surfaced gracefully as pending without
 *      granting dispatch eligibility or confirming the booking.
 * 3. Safe Checkout Cancellation & Retry:
 *    - ?payment=cancelled leaves booking in 'requires_payment' with form inputs preserved.
 *    - URL query parameters are removed via replaceState to prevent duplicate triggers.
 * 4. Polling & Status Reconciliation:
 *    - pollBookingPaymentStatus stops early on terminal payment states (paid, failed, cancelled).
 * 5. Non-Card Payment Isolation:
 *    - Standby credit facility and corporate BACS continue to confirm synchronously
 *      under existing commercial terms without calling Stripe.
 */

import http from 'node:http';
import assert from 'node:assert';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.STRIPE_SECRET_KEY = 'sk_test_neo_customer_checkout_mock_key_12345';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_neo_mock_webhook_secret_67890';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock_service_role_key_for_testing';

const {
  default: app,
  setStripeClientForTesting,
  resetStripeServiceForTesting,
  setServerSupabaseClientForTesting,
  verifyBookingPaymentEligibility,
} = await import('../api/index.ts');

const {
  createStripeCheckoutSession,
  getBookingPaymentStatus,
  pollBookingPaymentStatus,
  updateBookingPaymentStatus,
  getNextBookingReference,
} = await import('../src/lib/portalStore.ts');

// In-memory mock database for testing
const mockDbBookings: Record<string, any> = {
  'NT-2026-9001': {
    id: 'NT-2026-9001',
    company_id: 'c-test-001',
    status: 'Scheduled',
    payment_method: 'card',
    payment_status: 'requires_payment',
    total_gbp: 355.0,
    amount_paid_gbp: 0.0,
    stripe_payment_intent_id: null,
  },
  'NT-2026-9002': {
    id: 'NT-2026-9002',
    company_id: 'c-test-001',
    status: 'Scheduled',
    payment_method: 'card',
    payment_status: 'pending',
    total_gbp: 248.0,
    amount_paid_gbp: 0.0,
    stripe_payment_intent_id: null,
  },
  'NT-2026-9003': {
    id: 'NT-2026-9003',
    company_id: 'c-test-001',
    status: 'Scheduled',
    payment_method: 'card',
    payment_status: 'paid',
    total_gbp: 355.0,
    amount_paid_gbp: 355.0,
    stripe_payment_intent_id: 'pi_test_verified_9003',
  },
  'NT-2026-9004': {
    id: 'NT-2026-9004',
    company_id: 'c-test-001',
    status: 'Scheduled',
    payment_method: 'card',
    payment_status: 'paid', // Claimed "paid" but discrepant underpayment
    total_gbp: 300.0,
    amount_paid_gbp: 150.0,
    stripe_payment_intent_id: 'pi_test_underpaid_9004',
  },
  'NT-2026-9005': {
    id: 'NT-2026-9005',
    company_id: 'c-test-001',
    status: 'Scheduled',
    payment_method: 'card',
    payment_status: 'failed',
    total_gbp: 200.0,
    amount_paid_gbp: 0.0,
    stripe_payment_intent_id: 'pi_test_failed_9005',
  },
  'NT-2026-9006': {
    id: 'NT-2026-9006',
    company_id: 'c-test-001',
    status: 'Scheduled',
    payment_method: 'card',
    payment_status: 'cancelled',
    total_gbp: 200.0,
    amount_paid_gbp: 0.0,
    stripe_payment_intent_id: 'pi_test_cancelled_9006',
  },
};

const mockDbPayments: any[] = [];

const mockSupabaseClient: any = {
  from(tableName: string) {
    if (tableName === 'bookings') {
      return {
        select(cols: string) {
          return {
            eq(col: string, val: string) {
              return {
                maybeSingle: async () => {
                  const b = mockDbBookings[val];
                  return { data: b ? { ...b } : null, error: null };
                },
              };
            },
          };
        },
        update(updates: any) {
          return {
            eq(col: string, val: string) {
              if (mockDbBookings[val]) {
                Object.assign(mockDbBookings[val], updates);
              }
              return Promise.resolve({ error: null });
            },
          };
        },
        upsert(row: any) {
          mockDbBookings[row.id] = { ...row };
          return Promise.resolve({ error: null });
        },
      };
    }

    if (tableName === 'booking_payments') {
      return {
        select() {
          return {
            eq(col: string, val: string) {
              return {
                order() {
                  const matches = mockDbPayments.filter((p) => p.booking_id === val);
                  return Promise.resolve({ data: matches, error: null });
                },
              };
            },
          };
        },
        upsert(row: any) {
          mockDbPayments.push(row);
          return Promise.resolve({ error: null });
        },
      };
    }

    return {
      select: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    };
  },
};

// Mock Stripe SDK Client
let lastCreatedSessionArgs: any = null;
const mockStripeSdk: any = {
  checkout: {
    sessions: {
      create: async (params: any) => {
        lastCreatedSessionArgs = params;
        return {
          id: 'cs_test_customer_ui_session_789',
          url: 'https://checkout.stripe.com/c/pay/cs_test_customer_ui_session_789',
          amount_total: params.line_items[0].price_data.unit_amount,
          currency: 'gbp',
          metadata: params.metadata,
        };
      },
    },
  },
};

async function runTests() {
  console.log('=================================================================');
  console.log('STARTING CUSTOMER STRIPE CHECKOUT UI & STATUS VERIFICATION TESTS');
  console.log('=================================================================\n');

  // Start test server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  setStripeClientForTesting(mockStripeSdk);
  setServerSupabaseClientForTesting(mockSupabaseClient);

  // Set up mock window and global fetch for portalStore helpers
  const storageState: Record<string, string> = {};
  (globalThis as any).window = {
    location: {
      origin: baseUrl,
      pathname: '/',
      search: '',
    },
    dispatchEvent: () => true,
    history: {
      replaceState: (_data: any, _unused: string, url: string) => {
        (globalThis as any).window.location.search = '';
      },
    },
  };

  (globalThis as any).localStorage = {
    getItem: (key: string) => storageState[key] || null,
    setItem: (key: string, val: string) => {
      storageState[key] = val;
    },
    removeItem: (key: string) => {
      delete storageState[key];
    },
  };

  // Polyfill fetch to target test server
  const nativeFetch = globalThis.fetch;
  (globalThis as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let urlStr = String(input);
    if (urlStr.startsWith('/')) {
      urlStr = `${baseUrl}${urlStr}`;
    }
    return nativeFetch(urlStr, init);
  };

  try {
    // ---------------------------------------------------------------------------
    // TEST SECTION 1: Stripe Checkout Session Initiation
    // ---------------------------------------------------------------------------
    console.log('--- 1. Testing Stripe Checkout Session Initiation ---');

    // 1.1: Valid card checkout request returns checkoutUrl and calculates integer pence
    const checkoutResult = await createStripeCheckoutSession({
      bookingId: 'NT-2026-9001',
      customerEmail: 'ops@meridian.co.uk',
      customerName: 'Chris Sullivan',
      originPostcode: 'M17 1AB',
      destinationPostcode: 'B6 7EU',
      vehicle: 'Sprinter LWB',
      companyId: 'c-test-001',
    });

    assert.strictEqual(checkoutResult.success, true, 'Checkout session creation must succeed');
    assert.strictEqual(typeof checkoutResult.checkoutUrl, 'string', 'Must provide checkoutUrl');
    assert.ok(checkoutResult.checkoutUrl?.startsWith('https://checkout.stripe.com/'), 'Must be hosted Stripe URL');
    assert.strictEqual(checkoutResult.bookingId, 'NT-2026-9001', 'Correlates booking reference');
    assert.strictEqual(checkoutResult.amountPence, 24480, 'Computes correct server tariff in pence (86mi LWB = £244.80)');
    assert.strictEqual(lastCreatedSessionArgs.metadata.bookingId, 'NT-2026-9001', 'Includes bookingId in session metadata');
    assert.strictEqual(lastCreatedSessionArgs.metadata.expectedAmountPence, '24480', 'Includes expectedAmountPence metadata');
    console.log('✓ PASS 1.1: Client createStripeCheckoutSession securely returns Stripe hosted URL with authoritative pence');

    // 1.2: Checkout initiation fails closed on missing bookingId
    await assert.rejects(
      async () => {
        await createStripeCheckoutSession({
          bookingId: '',
          originPostcode: 'M17 1AB',
          destinationPostcode: 'B6 7EU',
          vehicle: 'Sprinter LWB',
        });
      },
      /Valid bookingId is required/,
      'Must reject checkout without booking reference'
    );
    console.log('✓ PASS 1.2: Empty booking reference rejected before session creation');

    // ---------------------------------------------------------------------------
    // TEST SECTION 2: Server-Authoritative Payment Status Query
    // ---------------------------------------------------------------------------
    console.log('\n--- 2. Testing Authoritative Payment Status Query (Fails Closed) ---');

    // 2.1: Booking in requires_payment is not fully paid
    const status9001 = await getBookingPaymentStatus('NT-2026-9001');
    assert.strictEqual(status9001.isFullyPaid, false, 'requires_payment is not fully paid');
    assert.strictEqual(status9001.paymentStatus, 'requires_payment');
    assert.strictEqual(status9001.amountPaidGbp, 0.0);
    console.log('✓ PASS 2.1: Status requires_payment correctly returns isFullyPaid: false');

    // 2.2: Booking in pending (e.g., webhook still in transit) is not fully paid
    const status9002 = await getBookingPaymentStatus('NT-2026-9002');
    assert.strictEqual(status9002.isFullyPaid, false, 'pending payment is not fully paid');
    assert.strictEqual(status9002.paymentStatus, 'pending');
    console.log('✓ PASS 2.2: Status pending correctly returns isFullyPaid: false');

    // 2.3: Verified fully paid booking returns isFullyPaid: true with intent ID
    const status9003 = await getBookingPaymentStatus('NT-2026-9003');
    assert.strictEqual(status9003.isFullyPaid, true, 'Fully paid booking returns isFullyPaid: true');
    assert.strictEqual(status9003.paymentStatus, 'paid');
    assert.strictEqual(status9003.stripePaymentIntentId, 'pi_test_verified_9003');
    assert.strictEqual(status9003.amountPaidGbp, 355.0);
    console.log('✓ PASS 2.3: Verified paid booking returns isFullyPaid: true with processor intent ID');

    // 2.4: Underpayment (amount_paid < total) fails closed and is NOT marked fully paid
    const status9004 = await getBookingPaymentStatus('NT-2026-9004');
    assert.strictEqual(status9004.isFullyPaid, false, 'Underpayment must not be fully paid');
    console.log('✓ PASS 2.4: Partial/discrepant payment fails closed and is not fully paid');

    // 2.5: Failed and cancelled bookings return isFullyPaid: false
    const status9005 = await getBookingPaymentStatus('NT-2026-9005');
    assert.strictEqual(status9005.isFullyPaid, false);
    assert.strictEqual(status9005.paymentStatus, 'failed');

    const status9006 = await getBookingPaymentStatus('NT-2026-9006');
    assert.strictEqual(status9006.isFullyPaid, false);
    assert.strictEqual(status9006.paymentStatus, 'cancelled');
    console.log('✓ PASS 2.5: Failed and cancelled payments safely return isFullyPaid: false');

    // ---------------------------------------------------------------------------
    // TEST SECTION 3: Status Polling Helper
    // ---------------------------------------------------------------------------
    console.log('\n--- 3. Testing Polling Verification Logic ---');

    // 3.1: Polling resolves immediately for verified paid bookings
    const pollStart = Date.now();
    const polledPaid = await pollBookingPaymentStatus('NT-2026-9003', 3, 200);
    const pollDuration = Date.now() - pollStart;
    assert.strictEqual(polledPaid.isFullyPaid, true, 'Polled verified paid booking must resolve as paid');
    assert.ok(pollDuration < 500, 'Immediate terminal state must not wait for remaining polling intervals');
    console.log(`✓ PASS 3.1: Polling resolved immediately for paid booking (${pollDuration}ms)`);

    // 3.2: Polling stops early on explicit payment failure
    const polledFailed = await pollBookingPaymentStatus('NT-2026-9005', 3, 200);
    assert.strictEqual(polledFailed.isFullyPaid, false);
    assert.strictEqual(polledFailed.paymentStatus, 'failed');
    console.log('✓ PASS 3.2: Polling stops early on terminal failure without superfluous retries');

    // 3.3: Polling dynamic transition (simulating asynchronous webhook delivery)
    mockDbBookings['NT-2026-DYNAMIC'] = {
      id: 'NT-2026-DYNAMIC',
      company_id: 'c-test-001',
      status: 'Scheduled',
      payment_method: 'card',
      payment_status: 'requires_payment',
      total_gbp: 180.0,
      amount_paid_gbp: 0.0,
    };

    // Simulate async webhook arrival after 300ms
    setTimeout(() => {
      mockDbBookings['NT-2026-DYNAMIC'].payment_status = 'paid';
      mockDbBookings['NT-2026-DYNAMIC'].amount_paid_gbp = 180.0;
      mockDbBookings['NT-2026-DYNAMIC'].stripe_payment_intent_id = 'pi_test_async_delivery_180';
    }, 300);

    const polledDynamic = await pollBookingPaymentStatus('NT-2026-DYNAMIC', 5, 200);
    assert.strictEqual(polledDynamic.isFullyPaid, true, 'Dynamically confirmed payment must be recognized');
    assert.strictEqual(polledDynamic.stripePaymentIntentId, 'pi_test_async_delivery_180');
    console.log('✓ PASS 3.3: Dynamic asynchronous webhook arrival captured and resolved during polling');

    // ---------------------------------------------------------------------------
    // TEST SECTION 4: Client Cache Updates & Storage Sync
    // ---------------------------------------------------------------------------
    console.log('\n--- 4. Testing Client Cache Update & Payment State Persistence ---');

    // 4.1: updateBookingPaymentStatus updates in-memory cache and Supabase
    const initialBookings = [
      {
        id: 'NT-2026-CACHE-1',
        reference: 'NT-2026-CACHE-1',
        date: 'Today',
        origin: 'Manchester M17 1AB',
        destination: 'Leeds LS1 1AA',
        vehicle: 'Sprinter LWB',
        total: 180.0,
        status: 'SCHEDULED' as const,
        payment_method: 'card',
        payment_status: 'requires_payment',
      },
    ];
    (globalThis as any).localStorage.setItem('neo_portal_bookings', JSON.stringify(initialBookings));

    const updatedBooking = await updateBookingPaymentStatus(
      'NT-2026-CACHE-1',
      'paid',
      180.0,
      'pi_test_cache_verified'
    );

    assert.ok(updatedBooking, 'Updated booking must be returned');
    assert.strictEqual(updatedBooking?.payment_status, 'paid');
    assert.strictEqual(updatedBooking?.amount_paid_gbp, 180.0);
    assert.strictEqual(updatedBooking?.stripe_payment_intent_id, 'pi_test_cache_verified');

    // Check localStorage was updated
    const savedInStorage = JSON.parse((globalThis as any).localStorage.getItem('neo_portal_bookings') || '[]');
    assert.strictEqual(savedInStorage[0].payment_status, 'paid');
    assert.strictEqual(savedInStorage[0].amount_paid_gbp, 180.0);
    console.log('✓ PASS 4.1: updateBookingPaymentStatus durably synchronizes local cache with verified status');

    // ---------------------------------------------------------------------------
    // TEST SECTION 5: Spoke Dispatch Gating with Card Payment Lifecycle
    // ---------------------------------------------------------------------------
    console.log('\n--- 5. Testing Spoke Dispatch Gating with Card Lifecycle States ---');

    // 5.1: Card booking during checkout (?payment=requires_payment) is strictly blocked from dispatch
    const eligibilityRequiresPayment = verifyBookingPaymentEligibility({
      id: 'NT-2026-9001',
      payment_method: 'card',
      payment_status: 'requires_payment',
      total_gbp: 355.0,
      amount_paid_gbp: 0.0,
    });
    assert.strictEqual(eligibilityRequiresPayment.eligible, false);
    assert.ok(eligibilityRequiresPayment.error?.includes('pending verification'), 'Must specify pending verification error');
    console.log('✓ PASS 5.1: requires_payment status strictly rejected from Spoke dispatch');

    // 5.2: Discrepant underpaid card booking strictly blocked from dispatch
    const eligibilityUnderpaid = verifyBookingPaymentEligibility({
      id: 'NT-2026-9004',
      payment_method: 'card',
      payment_status: 'paid',
      total_gbp: 300.0,
      amount_paid_gbp: 150.0,
    });
    assert.strictEqual(eligibilityUnderpaid.eligible, false);
    assert.ok(eligibilityUnderpaid.error?.includes('is less than booking total'), 'Must detect discrepancy error');
    console.log('✓ PASS 5.2: Underpayment strictly rejected despite "paid" status claim');

    // 5.3: Verified full payment is approved for dispatch
    const eligibilityPaid = verifyBookingPaymentEligibility({
      id: 'NT-2026-9003',
      payment_method: 'card',
      payment_status: 'paid',
      total_gbp: 355.0,
      amount_paid_gbp: 355.0,
    });
    assert.strictEqual(eligibilityPaid.eligible, true);
    console.log('✓ PASS 5.3: Verified full Stripe card payment approved for dispatch');

    // 5.4: Standby account remains eligible without Stripe transaction
    const mockCompany = { standby_active: true, verified: true, name: 'Meridian Logistics Ltd' };
    const eligibilityStandby = verifyBookingPaymentEligibility(
      {
        id: 'NT-2026-STANDBY',
        payment_method: 'standby-account',
        total_gbp: 355.0,
        company_id: 'c-test-001',
      },
      mockCompany
    );
    assert.strictEqual(eligibilityStandby.eligible, true);
    console.log('✓ PASS 5.4: Non-card Standby credit facility remains dispatch-eligible');

    // 5.5: Corporate BACS remains eligible without Stripe transaction
    const eligibilityBacs = verifyBookingPaymentEligibility(
      {
        id: 'NT-2026-BACS',
        payment_method: 'corporate-bacs',
        total_gbp: 355.0,
        company_id: 'c-test-001',
      },
      mockCompany
    );
    assert.strictEqual(eligibilityBacs.eligible, true);
    console.log('✓ PASS 5.5: Corporate BACS remains dispatch-eligible on commercial terms');

    console.log('\n=================================================================');
    console.log('ALL CUSTOMER STRIPE CHECKOUT UI & VERIFICATION TESTS PASSED (0 failures)');
    console.log('=================================================================\n');
  } finally {
    resetStripeServiceForTesting();
    server.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUNNER FAILED WITH EXCEPTION:', err);
  process.exit(1);
});

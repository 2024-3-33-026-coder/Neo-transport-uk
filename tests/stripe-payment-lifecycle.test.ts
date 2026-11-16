/**
 * =============================================================================
 * NEO TRANSPORT LTD — STRIPE PAYMENT LIFECYCLE & DISPATCH GATING TEST SUITE
 * =============================================================================
 *
 * Verifies:
 * 1. Server-authoritative quote calculation (never trusts client price).
 * 2. Stripe Checkout session creation with integer pence and required metadata.
 * 3. Timing-safe cryptographic webhook signature verification (fails closed).
 * 4. Webhook event inbox, idempotency, and underpayment / partial payment guards.
 * 5. Strict Spoke dispatch gating: unpaid, pending, failed, cancelled, and partially
 *    paid card transactions NEVER become dispatch-eligible.
 * 6. Reconciliation and separation of logistics, payment, and invoice statuses.
 */

import http from 'node:http';
import assert from 'node:assert';
import crypto from 'node:crypto';
import Stripe from 'stripe';

// Test environment variables
process.env.NODE_ENV = 'test';
process.env.STRIPE_SECRET_KEY = 'sk_test_neo_transport_mock_key_0123456789';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_neo_mock_webhook_secret_987654321';
process.env.NEO_SPOKE_PILOT_DISPATCH_ENABLED = 'true';
process.env.NEO_SPOKE_PILOT_DISPATCH_APPROVED_TOKEN = 'pilot_test_approved_secret_token_123';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock_service_role_key_for_testing';

const {
  default: app,
  calculateServerAuthoritativeQuote,
  createServerCheckoutSession,
  verifyStripeWebhookSignature,
  processStripeWebhookEvent,
  verifyBookingPaymentEligibility,
  setStripeClientForTesting,
  resetStripeServiceForTesting,
  setServerSupabaseClientForTesting,
  FLEET_TARIFFS,
  resolveVehicleTariff,
} = await import('../api/index.ts');

// Helper to make HTTP requests
function testRequest(
  server: http.Server,
  path: string,
  method: string,
  headers: Record<string, string>,
  body?: any,
  rawBodyBuffer?: Buffer
): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as any;
    const port = addr.port;

    const payloadBuffer =
      rawBodyBuffer ||
      (body !== undefined ? Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8') : Buffer.alloc(0));

    const reqHeaders: Record<string, string | number> = {
      'Content-Type': 'application/json',
      'Content-Length': payloadBuffer.length,
      ...headers,
    };

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          try {
            resolve({ status: res.statusCode || 0, data: JSON.parse(raw), headers: res.headers });
          } catch {
            resolve({ status: res.statusCode || 0, data: { raw }, headers: res.headers });
          }
        });
      }
    );

    req.on('error', reject);
    req.write(payloadBuffer);
    req.end();
  });
}

// Helper to generate valid Stripe webhook signatures
function generateStripeSignature(payload: string | Buffer, secret: string, timestamp?: number): string {
  const t = timestamp || Math.floor(Date.now() / 1000);
  const payloadStr = Buffer.isBuffer(payload) ? payload.toString('utf8') : payload;
  const signaturePayload = `${t}.${payloadStr}`;
  const hmac = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');
  return `t=${t},v1=${hmac}`;
}

async function runStripeTests() {
  console.log('=================================================================');
  console.log('STARTING STRIPE PAYMENT LIFECYCLE & DISPATCH GATING REGRESSION TESTS');
  console.log('=================================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    // -------------------------------------------------------------------------
    // 1. Server-Authoritative Quote Calculation Tests
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing Server-Authoritative Quote Calculation ---');

    // 1.1 Small Van Manchester to Birmingham (approx 88 road miles)
    const quoteSmallVan = calculateServerAuthoritativeQuote({
      originPostcode: 'M17 1AA',
      destinationPostcode: 'B5 4BU',
      vehicle: 'Small Van',
    });
    assert.strictEqual(quoteSmallVan.success, true);
    assert.strictEqual(quoteSmallVan.vehicleName, 'Small Van');
    assert.strictEqual(quoteSmallVan.baseRateGbp, 45);
    assert.strictEqual(quoteSmallVan.perMileRateGbp, 1.25);
    assert.ok((quoteSmallVan.distanceMiles || 0) >= 5);
    const expectedMileage = Number((1.25 * (quoteSmallVan.distanceMiles || 0)).toFixed(2));
    const expectedSubtotal = Number((45 + expectedMileage).toFixed(2));
    assert.strictEqual(quoteSmallVan.mileageChargeGbp, expectedMileage);
    assert.strictEqual(quoteSmallVan.subtotalGbp, expectedSubtotal);
    assert.strictEqual(quoteSmallVan.totalGbp, expectedSubtotal);
    assert.strictEqual(quoteSmallVan.amountPence, Math.round(expectedSubtotal * 100));
    assert.strictEqual(quoteSmallVan.currency, 'gbp');
    assert.ok(quoteSmallVan.quoteSignature, 'Quote must be cryptographically signed');
    console.log('✓ PASS 1.1: Small Van quote calculated with exact formula (£45 base + £1.25/mi)');

    // 1.2 Sprinter LWB quote verification
    const quoteSprinter = calculateServerAuthoritativeQuote({
      originPostcode: 'M17 1AA',
      destinationPostcode: 'B5 4BU',
      vehicle: 'Sprinter LWB',
    });
    assert.strictEqual(quoteSprinter.success, true);
    assert.strictEqual(quoteSprinter.baseRateGbp, 90);
    assert.strictEqual(quoteSprinter.perMileRateGbp, 1.80);
    console.log('✓ PASS 1.2: Sprinter LWB quote calculated with exact fleet tariff (£90 base + £1.80/mi)');

    // 1.3 Payload capacity violation rejection
    const overloadQuote = calculateServerAuthoritativeQuote({
      originPostcode: 'M17 1AA',
      destinationPostcode: 'B5 4BU',
      vehicle: 'Small Van',
      cargoWeightKg: 850, // Small van limit is 400kg
    });
    assert.strictEqual(overloadQuote.success, false);
    assert.ok(overloadQuote.error?.includes('exceeds vehicle maximum payload'));
    console.log('✓ PASS 1.3: Overweight cargo strictly rejected from smaller vehicle classes');

    // 1.4 Pallet count capacity violation rejection
    const overPalletQuote = calculateServerAuthoritativeQuote({
      originPostcode: 'M17 1AA',
      destinationPostcode: 'B5 4BU',
      vehicle: 'Small Van',
      palletCount: 3, // Small van limit is 1 pallet
    });
    assert.strictEqual(overPalletQuote.success, false);
    assert.ok(overPalletQuote.error?.includes('exceeds vehicle maximum capacity'));
    console.log('✓ PASS 1.4: Over-capacity pallet count strictly rejected');

    // 1.5 Missing postcodes rejected
    const blankPostcodeQuote = calculateServerAuthoritativeQuote({
      originPostcode: '',
      destinationPostcode: 'B5 4BU',
      vehicle: 'Sprinter LWB',
    });
    assert.strictEqual(blankPostcodeQuote.success, false);
    assert.ok(blankPostcodeQuote.error?.includes('required'));
    console.log('✓ PASS 1.5: Missing postcodes safely rejected');

    // 1.6 HTTP POST /api/pricing/quote endpoint
    const httpQuoteRes = await testRequest(server, '/api/pricing/quote', 'POST', {}, {
      originPostcode: 'M17 1AA',
      destinationPostcode: 'B5 4BU',
      vehicle: '7.5t Rigid',
    });
    assert.strictEqual(httpQuoteRes.status, 200);
    assert.strictEqual(httpQuoteRes.data.success, true);
    assert.strictEqual(httpQuoteRes.data.vehicleName, '7.5t Rigid');
    assert.strictEqual(httpQuoteRes.data.baseRateGbp, 160);
    assert.strictEqual(httpQuoteRes.data.perMileRateGbp, 2.40);
    console.log('✓ PASS 1.6: HTTP POST /api/pricing/quote endpoint returns authoritative quote');

    // -------------------------------------------------------------------------
    // 2. Stripe Checkout Session Creation Tests
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Stripe Checkout Session Creation ---');

    // Mock Stripe SDK
    let capturedSessionParams: any = null;
    const mockStripe = {
      checkout: {
        sessions: {
          create: async (params: any) => {
            capturedSessionParams = params;
            return {
              id: 'cs_test_neo_session_1001',
              url: 'https://checkout.stripe.com/c/pay/cs_test_neo_session_1001',
              currency: params.currency,
              amount_total: params.line_items?.[0]?.price_data?.unit_amount,
              metadata: params.metadata,
            };
          },
        },
      },
      webhooks: new Stripe('sk_test_dummy').webhooks,
    };
    setStripeClientForTesting(mockStripe);

    const checkoutRes = await testRequest(server, '/api/payments/checkout-session', 'POST', {}, {
      bookingId: 'NT-25010',
      originPostcode: 'M17 1AA',
      destinationPostcode: 'B5 4BU',
      vehicle: 'Sprinter LWB',
      customerEmail: 'ops@acmelogistics.co.uk',
      customerName: 'Alice Dispatcher',
    });

    assert.strictEqual(checkoutRes.status, 200);
    assert.strictEqual(checkoutRes.data.success, true);
    assert.strictEqual(checkoutRes.data.sessionId, 'cs_test_neo_session_1001');
    assert.ok(checkoutRes.data.checkoutUrl?.startsWith('https://checkout.stripe.com'));
    assert.strictEqual(checkoutRes.data.bookingId, 'NT-25010');

    // Verify Stripe SDK was invoked with server-computed integer pence
    assert.ok(capturedSessionParams);
    assert.strictEqual(capturedSessionParams.mode, 'payment');
    assert.strictEqual(capturedSessionParams.currency, 'gbp');
    assert.strictEqual(capturedSessionParams.client_reference_id, 'NT-25010');
    assert.strictEqual(capturedSessionParams.metadata.bookingId, 'NT-25010');
    assert.ok(capturedSessionParams.metadata.expectedAmountPence);
    assert.strictEqual(
      capturedSessionParams.line_items[0].price_data.unit_amount,
      parseInt(capturedSessionParams.metadata.expectedAmountPence, 10),
      'Line item unit_amount must strictly match server-calculated expectedAmountPence'
    );
    console.log('✓ PASS 2.1: Stripe Checkout session created with server-computed integer pence and metadata');

    // 2.2 Missing bookingId rejected
    const missingBookingRes = await testRequest(server, '/api/payments/checkout-session', 'POST', {}, {
      originPostcode: 'M17 1AA',
      destinationPostcode: 'B5 4BU',
      vehicle: 'Sprinter LWB',
    });
    assert.strictEqual(missingBookingRes.status, 400);
    assert.ok(missingBookingRes.data.error?.includes('bookingId is required'));
    console.log('✓ PASS 2.2: Checkout session request without bookingId rejected with 400');

    // -------------------------------------------------------------------------
    // 3. Webhook Signature Verification Tests
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Timing-Safe Webhook Signature Verification ---');

    const sampleEventPayload = JSON.stringify({
      id: 'evt_test_001',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_neo_session_1001',
          amount_total: 24840,
          metadata: {
            bookingId: 'NT-25010',
            expectedAmountPence: '24840',
          },
        },
      },
    });

    // 3.1 Missing stripe-signature header returns 400
    const missingSigRes = await testRequest(
      server,
      '/api/webhooks/stripe',
      'POST',
      {},
      undefined,
      Buffer.from(sampleEventPayload, 'utf8')
    );
    assert.strictEqual(missingSigRes.status, 400);
    assert.ok(missingSigRes.data.error?.includes('Missing or empty stripe-signature header'));
    console.log('✓ PASS 3.1: Missing stripe-signature header rejected with HTTP 400');

    // 3.2 Invalid signature returns 400
    const badSigRes = await testRequest(
      server,
      '/api/webhooks/stripe',
      'POST',
      { 'stripe-signature': 't=123456,v1=0000000000000000000000000000000000000000000000000000000000000000' },
      undefined,
      Buffer.from(sampleEventPayload, 'utf8')
    );
    assert.strictEqual(badSigRes.status, 400);
    assert.ok(badSigRes.data.error?.includes('signature verification failed'));
    console.log('✓ PASS 3.2: Forged/invalid signature rejected with HTTP 400');

    // 3.3 Missing webhook secret fails closed with 503
    const savedSecret = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const noSecretRes = await testRequest(
      server,
      '/api/webhooks/stripe',
      'POST',
      { 'stripe-signature': 't=123456,v1=abcdef' },
      undefined,
      Buffer.from(sampleEventPayload, 'utf8')
    );
    assert.strictEqual(noSecretRes.status, 503);
    assert.ok(noSecretRes.data.error?.includes('STRIPE_WEBHOOK_SECRET missing'));
    process.env.STRIPE_WEBHOOK_SECRET = savedSecret;
    console.log('✓ PASS 3.3: Missing server webhook secret fails closed with HTTP 503');

    // 3.4 Valid signature passes verification
    const validSignature = generateStripeSignature(sampleEventPayload, process.env.STRIPE_WEBHOOK_SECRET!);
    const validSigResult = verifyStripeWebhookSignature(
      Buffer.from(sampleEventPayload, 'utf8'),
      validSignature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    assert.strictEqual(validSigResult.valid, true);
    assert.strictEqual(validSigResult.event?.id, 'evt_test_001');
    console.log('✓ PASS 3.4: Valid cryptographic signature accepted with HTTP 200');

    // -------------------------------------------------------------------------
    // 4. Webhook Event Processing & Idempotency Tests
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Webhook Event Processing & Idempotency ---');

    // Mock Database Stores
    const mockDbBookings = new Map<string, any>();
    const mockDbPayments = new Map<string, any>();
    const mockDbInvoices = new Map<string, any>();
    const mockDbEvents = new Map<string, any>();

    // Seed test booking in unpaid status
    mockDbBookings.set('NT-25010', {
      id: 'NT-25010',
      payment_method: 'card',
      payment_status: 'requires_payment',
      total_gbp: 248.40,
      amount_paid_gbp: 0.00,
      status: 'Scheduled',
    });

    const mockSupabase: any = {
      from: (tableName: string) => {
        if (tableName === 'stripe_webhook_events') {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                maybeSingle: async () => ({
                  data: mockDbEvents.get(val) || null,
                  error: null,
                }),
              }),
            }),
            upsert: async (record: any) => {
              mockDbEvents.set(record.event_id, { ...record });
              return { data: null, error: null };
            },
            update: (record: any) => ({
              eq: async (_col: string, val: string) => {
                const existing = mockDbEvents.get(val);
                if (existing) mockDbEvents.set(val, { ...existing, ...record });
                return { data: null, error: null };
              },
            }),
          };
        }
        if (tableName === 'bookings') {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                maybeSingle: async () => ({
                  data: mockDbBookings.get(val) || null,
                  error: null,
                }),
                single: async () => ({
                  data: mockDbBookings.get(val) || null,
                  error: mockDbBookings.has(val) ? null : { code: 'PGRST116', message: 'Not found' },
                }),
              }),
            }),
            update: (record: any) => ({
              eq: async (_col: string, val: string) => {
                const existing = mockDbBookings.get(val);
                if (existing) mockDbBookings.set(val, { ...existing, ...record });
                return { data: null, error: null };
              },
            }),
          };
        }
        if (tableName === 'booking_payments') {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                order: () => ({
                  async then(resolve: any) {
                    const rows = Array.from(mockDbPayments.values()).filter((p: any) => p.booking_id === val);
                    return resolve({ data: rows, error: null });
                  },
                }),
              }),
            }),
            upsert: async (record: any) => {
              const key = record.stripe_session_id || record.stripe_payment_intent_id || record.booking_id;
              mockDbPayments.set(key, { ...record });
              return { data: null, error: null };
            },
            update: (record: any) => ({
              eq: async (_col: string, val: string) => {
                const existing = mockDbPayments.get(val);
                if (existing) mockDbPayments.set(val, { ...existing, ...record });
                return { data: null, error: null };
              },
            }),
          };
        }
        if (tableName === 'invoices') {
          return {
            upsert: async (record: any) => {
              mockDbInvoices.set(record.id, { ...record });
              return { data: null, error: null };
            },
          };
        }
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
      },
    };

    setServerSupabaseClientForTesting(mockSupabase);

    // 4.1 Process full payment checkout.session.completed event
    const fullPaymentEvent: Stripe.Event = {
      id: 'evt_stripe_success_001',
      object: 'event',
      api_version: '2026-09-30.endive' as any,
      created: Math.floor(Date.now() / 1000),
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_neo_session_1001',
          payment_intent: 'pi_test_full_payment_123',
          amount_total: 24840,
          currency: 'gbp',
          metadata: {
            bookingId: 'NT-25010',
            expectedAmountPence: '24840',
            companyId: 'comp-acme-01',
          },
        } as any,
      },
      livemode: false,
      pending_webhooks: 0,
      request: null,
    };

    const processResult1 = await processStripeWebhookEvent(fullPaymentEvent, mockSupabase);
    assert.strictEqual(processResult1.success, true);
    assert.strictEqual(processResult1.duplicate, false);
    assert.strictEqual(processResult1.paymentStatus, 'paid');
    assert.strictEqual(processResult1.amountReceivedGbp, 248.40);

    // Verify booking updated to paid
    const updatedBooking = mockDbBookings.get('NT-25010');
    assert.strictEqual(updatedBooking.payment_status, 'paid');
    assert.strictEqual(updatedBooking.amount_paid_gbp, 248.40);
    assert.strictEqual(updatedBooking.stripe_payment_intent_id, 'pi_test_full_payment_123');
    assert.ok(updatedBooking.paid_at);

    // Verify invoice created
    const invoice = mockDbInvoices.get('INV-NT25010');
    assert.ok(invoice);
    assert.strictEqual(invoice.status, 'Paid');
    assert.strictEqual(invoice.amount_gbp, 248.40);
    console.log('✓ PASS 4.1: Full payment webhook updates booking to paid and generates paid invoice');

    // 4.2 Duplicate delivery idempotency
    const processResultDuplicate = await processStripeWebhookEvent(fullPaymentEvent, mockSupabase);
    assert.strictEqual(processResultDuplicate.success, true);
    assert.strictEqual(processResultDuplicate.duplicate, true, 'Duplicate webhook event must return duplicate: true');
    console.log('✓ PASS 4.2: Duplicate webhook delivery handled idempotently without re-execution');

    // 4.3 Underpayment / Partial Payment protection
    mockDbBookings.set('NT-25011-UNDERPAY', {
      id: 'NT-25011-UNDERPAY',
      payment_method: 'card',
      payment_status: 'requires_payment',
      total_gbp: 300.00,
      amount_paid_gbp: 0.00,
      status: 'Scheduled',
    });

    const underpayEvent: Stripe.Event = {
      id: 'evt_stripe_underpay_002',
      object: 'event',
      api_version: '2026-09-30.endive' as any,
      created: Math.floor(Date.now() / 1000),
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_underpay_session',
          payment_intent: 'pi_test_underpay',
          amount_total: 15000, // 15000p = £150.00 (expected £300.00)
          currency: 'gbp',
          metadata: {
            bookingId: 'NT-25011-UNDERPAY',
            expectedAmountPence: '30000', // expected 30000p
          },
        } as any,
      },
      livemode: false,
      pending_webhooks: 0,
      request: null,
    };

    const processUnderpayResult = await processStripeWebhookEvent(underpayEvent, mockSupabase);
    assert.strictEqual(processUnderpayResult.success, false);
    assert.strictEqual(processUnderpayResult.paymentStatus, 'partially_paid');
    assert.ok(processUnderpayResult.error?.includes('Partial payment received'));

    const underpaidBooking = mockDbBookings.get('NT-25011-UNDERPAY');
    assert.strictEqual(underpaidBooking.payment_status, 'partially_paid');
    assert.strictEqual(underpaidBooking.amount_paid_gbp, 150.00);
    assert.notStrictEqual(underpaidBooking.payment_status, 'paid');
    console.log('✓ PASS 4.3: Underpayment fails closed; booking marked partially_paid and never marked paid');

    // 4.4 PaymentIntent payment_failed event
    mockDbBookings.set('NT-25012-FAILED', {
      id: 'NT-25012-FAILED',
      payment_method: 'card',
      payment_status: 'requires_payment',
      total_gbp: 180.00,
      amount_paid_gbp: 0.00,
      status: 'Scheduled',
    });

    const failedPiEvent: Stripe.Event = {
      id: 'evt_stripe_fail_003',
      object: 'event',
      api_version: '2026-09-30.endive' as any,
      created: Math.floor(Date.now() / 1000),
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_test_failed_001',
          amount: 18000,
          metadata: { bookingId: 'NT-25012-FAILED' },
          last_payment_error: { message: 'Your card has insufficient funds.' },
        } as any,
      },
      livemode: false,
      pending_webhooks: 0,
      request: null,
    };

    const processFailResult = await processStripeWebhookEvent(failedPiEvent, mockSupabase);
    assert.strictEqual(processFailResult.success, false);
    assert.strictEqual(processFailResult.paymentStatus, 'failed');

    const failedBooking = mockDbBookings.get('NT-25012-FAILED');
    assert.strictEqual(failedBooking.payment_status, 'failed');
    console.log('✓ PASS 4.4: PaymentIntent failure transitions booking to payment_status="failed"');

    // 4.5 PaymentIntent canceled event
    mockDbBookings.set('NT-25013-CANCELED', {
      id: 'NT-25013-CANCELED',
      payment_method: 'card',
      payment_status: 'requires_payment',
      total_gbp: 180.00,
      amount_paid_gbp: 0.00,
      status: 'Scheduled',
    });

    const canceledPiEvent: Stripe.Event = {
      id: 'evt_stripe_cancel_004',
      object: 'event',
      api_version: '2026-09-30.endive' as any,
      created: Math.floor(Date.now() / 1000),
      type: 'payment_intent.canceled',
      data: {
        object: {
          id: 'pi_test_canceled_001',
          amount: 18000,
          metadata: { bookingId: 'NT-25013-CANCELED' },
        } as any,
      },
      livemode: false,
      pending_webhooks: 0,
      request: null,
    };

    const processCancelResult = await processStripeWebhookEvent(canceledPiEvent, mockSupabase);
    assert.strictEqual(processCancelResult.paymentStatus, 'cancelled');

    const canceledBooking = mockDbBookings.get('NT-25013-CANCELED');
    assert.strictEqual(canceledBooking.payment_status, 'cancelled');
    console.log('✓ PASS 4.5: PaymentIntent cancellation transitions booking to payment_status="cancelled"');

    // -------------------------------------------------------------------------
    // 5. Spoke Dispatch Gating Tests (Unpaid Bookings Cannot Be Dispatched)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Spoke Dispatch Gating & Payment Eligibility ---');

    // 5.1 Unpaid card booking (payment_status: 'pending') is strictly rejected
    const pendingEligibility = verifyBookingPaymentEligibility(
      { payment_method: 'card', payment_status: 'pending', total_gbp: 200, amount_paid_gbp: 0 },
      null
    );
    assert.strictEqual(pendingEligibility.eligible, false);
    assert.ok(pendingEligibility.error?.includes('pending verification'));
    console.log('✓ PASS 5.1: Unpaid card booking (payment_status="pending") strictly rejected from dispatch');

    // 5.2 Requires_payment card booking is strictly rejected
    const requiresPayEligibility = verifyBookingPaymentEligibility(
      { payment_method: 'card', payment_status: 'requires_payment', total_gbp: 200, amount_paid_gbp: 0 },
      null
    );
    assert.strictEqual(requiresPayEligibility.eligible, false);
    assert.ok(requiresPayEligibility.error?.includes('pending verification'));
    console.log('✓ PASS 5.2: Unpaid card booking (payment_status="requires_payment") strictly rejected');

    // 5.3 Partially paid card booking is strictly rejected
    const partialEligibility = verifyBookingPaymentEligibility(
      { payment_method: 'card', payment_status: 'partially_paid', total_gbp: 200, amount_paid_gbp: 100 },
      null
    );
    assert.strictEqual(partialEligibility.eligible, false);
    assert.ok(partialEligibility.error?.includes('incomplete'));
    console.log('✓ PASS 5.3: Partially paid card booking strictly rejected from dispatch');

    // 5.4 Underpaid booking marked "paid" but with amount_paid_gbp < total_gbp is rejected
    const underpaidPaidStatusEligibility = verifyBookingPaymentEligibility(
      { payment_method: 'card', payment_status: 'paid', total_gbp: 250, amount_paid_gbp: 200 },
      null
    );
    assert.strictEqual(underpaidPaidStatusEligibility.eligible, false);
    assert.ok(underpaidPaidStatusEligibility.error?.includes('less than booking total'));
    console.log('✓ PASS 5.4: Discrepant amount (amount_paid < total) strictly rejected despite "paid" label');

    // 5.5 Failed card payment booking is strictly rejected
    const failedEligibility = verifyBookingPaymentEligibility(
      { payment_method: 'card', payment_status: 'failed', total_gbp: 200, amount_paid_gbp: 0 },
      null
    );
    assert.strictEqual(failedEligibility.eligible, false);
    assert.ok(failedEligibility.error?.includes('failed'));
    console.log('✓ PASS 5.5: Failed card booking strictly rejected from dispatch');

    // 5.6 Cancelled card payment booking is strictly rejected
    const cancelledEligibility = verifyBookingPaymentEligibility(
      { payment_method: 'card', payment_status: 'cancelled', total_gbp: 200, amount_paid_gbp: 0 },
      null
    );
    assert.strictEqual(cancelledEligibility.eligible, false);
    assert.ok(cancelledEligibility.error?.includes('cancelled'));
    console.log('✓ PASS 5.6: Cancelled card booking strictly rejected from dispatch');

    // 5.7 Verified full payment card booking is eligible
    const paidEligibility = verifyBookingPaymentEligibility(
      { payment_method: 'card', payment_status: 'paid', total_gbp: 248.40, amount_paid_gbp: 248.40 },
      null
    );
    assert.strictEqual(paidEligibility.eligible, true);
    console.log('✓ PASS 5.7: Fully paid card booking with verified amount is eligible for dispatch');

    // 5.8 Strict payment verification mode rejects omitted payment_status
    const strictOmittedEligibility = verifyBookingPaymentEligibility(
      { payment_method: 'card', total_gbp: 150 },
      null,
      { strictPaymentVerification: true }
    );
    assert.strictEqual(strictOmittedEligibility.eligible, false);
    assert.ok(strictOmittedEligibility.error?.includes('requires verified payment status'));
    console.log('✓ PASS 5.8: Strict payment verification mode rejects card bookings with omitted payment status');

    // 5.9 Active verified standby credit account remains eligible independently of card payment
    const standbyEligibility = verifyBookingPaymentEligibility(
      { payment_method: 'standby-account', company_id: 'comp-1' },
      { standby_active: true, verified: true }
    );
    assert.strictEqual(standbyEligibility.eligible, true);
    console.log('✓ PASS 5.9: Active verified company standby credit facility remains eligible');

    // -------------------------------------------------------------------------
    // 6. Payment Status Endpoint & State Separation
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Payment Status Query & Separation of Concerns ---');

    const statusQueryRes = await testRequest(server, '/api/payments/status/NT-25010', 'GET', {});
    assert.strictEqual(statusQueryRes.status, 200);
    assert.strictEqual(statusQueryRes.data.bookingId, 'NT-25010');
    assert.strictEqual(statusQueryRes.data.paymentStatus, 'paid');
    assert.strictEqual(statusQueryRes.data.logisticsStatus, 'Scheduled');
    assert.strictEqual(statusQueryRes.data.totalGbp, 248.40);
    assert.strictEqual(statusQueryRes.data.amountPaidGbp, 248.40);
    assert.strictEqual(statusQueryRes.data.isFullyPaid, true);
    console.log('✓ PASS 6.1: GET /api/payments/status/:bookingId returns reconciled payment state');

    console.log('\n=================================================================');
    console.log('ALL STRIPE PAYMENT LIFECYCLE TESTS PASSED (0 failures)');
    console.log('=================================================================');
  } finally {
    resetStripeServiceForTesting();
    setServerSupabaseClientForTesting(null);
    server.close();
  }
}

runStripeTests().catch((err) => {
  console.error('\n❌ Stripe Payment Test Suite Failed:', err);
  process.exit(1);
});

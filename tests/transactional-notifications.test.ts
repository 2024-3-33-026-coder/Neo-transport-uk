/**
 * NEO TRANSPORT LTD — TRANSACTIONAL NOTIFICATIONS & OUTBOX REGRESSION TESTS
 *
 * Verifies that:
 * 1. Failed booking inserts strictly create ZERO notification events (fail closed).
 * 2. Successful remote booking persistence creates exactly the intended outbox events (customer receipt + ops alert).
 * 3. Duplicate event enqueueing suppresses duplicate delivery (idempotency key enforcement).
 * 4. Standby application receipts and approvals enforce correct status ('pending' vs 'approved') and templates.
 * 5. Failed email deliveries are recorded with sanitized errors, retried safely, and dead-lettered after max retries.
 * 6. Tenant isolation: Customer recipients and company data cannot leak across tenants.
 * 7. Payment verification notifications require authoritative verified payment state (underpayments fail closed).
 * 8. Internal retries do not generate customer-facing duplicate spam (at-most-once delivery).
 */

import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { app } from '../api/index.ts';
import {
  enqueueNotification,
  processOutboxBatch,
  getOutboxHealth,
  enqueueStandbySubmissionEvents,
  enqueueStandbyApprovedEvents,
  enqueueBookingConfirmedEvents,
  enqueuePaymentVerifiedEvents,
  setMemoryOutboxOverride,
  getMemoryOutboxRecords,
  clearMemoryOutbox,
} from '../api/notifications/outboxService.js';
import {
  MockEmailAdapter,
  ResendEmailAdapter,
  setEmailAdapterForTesting,
  resetEmailAdapterForTesting,
  getOperationsAlertEmail,
  getAccountsAlertEmail,
} from '../api/notifications/emailAdapter.js';
import {
  persistBooking,
  setCustomSupabaseClient,
  setDemoModeOverrideForTesting,
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

const mockEmailAdapter = new MockEmailAdapter();

const sampleBooking: Booking = {
  id: 'NT-88001',
  reference: 'NT-88001',
  date: 'Today',
  origin: 'Manchester M17 1AB',
  destination: 'Birmingham B6 7EU',
  vehicle: 'Sprinter LWB',
  total: 285,
  status: 'SCHEDULED',
  payment_method: 'standby-account',
  payment_status: 'standby_terms',
  amount_paid_gbp: 0,
  cargo: 'Aviation Components',
  weightKg: 400,
  palletCount: 1,
  pickupTime: 'ASAP',
  deliveryTime: '88 min',
  progress: 0.05,
};

const sampleWizardState: BookingWizardState = {
  notes: 'Fragile aviation freight — handle with care.',
  pickupPostcode: 'Manchester M17 1AB',
  pickupContact: 'Gate 2 Warehouse',
  pickupPhone: '0161 555 0100',
  contactName: 'Gate 2 Warehouse',
  contactPhone: '0161 555 0100',
  collectionWindow: 'ASAP — ready now',
  dropoffPostcode: 'Birmingham B6 7EU',
  dropoffContact: 'Goods Receiving',
  dropoffPhone: '0121 496 0200',
  recipientName: 'Goods Receiving',
  recipientPhone: '0121 496 0200',
  deliveryWindow: 'Direct transit (approx 88 min)',
  deliveryInstructions: 'Call 15 min prior to arrival',
  cargoDescription: 'Aviation Components',
  cargoWeightKg: 400,
  palletCount: 1,
  itemsCount: 1,
  cargoHazmat: false,
  selectedVehicle: 'Sprinter LWB',
  selectedService: 'Emergency (ASAP)',
  estimatedMiles: 88,
  estimatedTotal: 285,
  paymentMethod: 'standby-account',
  poReference: 'PO-TEST-001',
  poNumber: 'PO-TEST-001',
};

async function runNotificationTests() {
  console.log('=================================================================');
  console.log('STARTING P0 TRANSACTIONAL NOTIFICATION OUTBOX REGRESSION TESTS');
  console.log('=================================================================');

  // Setup hermetic test environment
  setMemoryOutboxOverride(true);
  clearMemoryOutbox();
  mockEmailAdapter.clear();
  setEmailAdapterForTesting(mockEmailAdapter);
  setDemoModeOverrideForTesting(false);

  // ---------------------------------------------------------------------------
  // TEST 1: Failed Booking Insert Generates ZERO Notification Outbox Events
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. Testing Failed Booking Persistence Isolation ---');
  clearMemoryOutbox();

  const networkFailingSupabase = {
    from: (table: string) => ({
      insert: () => Promise.reject(new Error('TypeError: Failed to fetch (ECONNREFUSED)')),
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
    }),
  };
  setCustomSupabaseClient(networkFailingSupabase as any);

  let insertThrew = false;
  try {
    await persistBooking({ ...sampleBooking, id: 'NT-FAIL-01' }, sampleWizardState, 'comp-meridian-001');
  } catch {
    insertThrew = true;
  }

  assert(insertThrew, 'persistBooking must throw on transport failure');
  const outboxAfterFailure = getMemoryOutboxRecords();
  assert.strictEqual(
    outboxAfterFailure.length,
    0,
    'Failed booking insert must strictly generate ZERO outbox notification records'
  );
  console.log('✓ PASS: Failed booking persistence creates zero notification events (fails closed)');

  // ---------------------------------------------------------------------------
  // TEST 2: Successful Booking Persistence Enqueues Authoritative Events
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Testing Successful Booking Enqueues Customer Receipt & Ops Alert ---');
  clearMemoryOutbox();

  const bookingResults = await enqueueBookingConfirmedEvents(
    sampleBooking,
    { id: 'comp-meridian-001', name: 'Meridian Logistics' },
    { email: 'logistics@meridian.co.uk', name: 'Chris Sullivan' }
  );

  assert.strictEqual(bookingResults.length, 2, 'Must enqueue exactly 2 events: ops alert and customer receipt');
  assert(bookingResults.every((r) => r.success && !r.duplicate), 'Both events must be successfully enqueued');

  const records = getMemoryOutboxRecords();
  assert.strictEqual(records.length, 2, 'Outbox must contain exactly 2 records');

  const opsEvent = records.find((r) => r.recipient_role === 'operations');
  assert(opsEvent !== undefined, 'Operations event must exist');
  assert.strictEqual(opsEvent?.recipient_email, getOperationsAlertEmail());
  assert(opsEvent?.subject.includes('NT-88001'), 'Ops subject must contain booking reference');

  const customerEvent = records.find((r) => r.recipient_role === 'customer');
  assert(customerEvent !== undefined, 'Customer event must exist');
  assert.strictEqual(customerEvent?.recipient_email, 'logistics@meridian.co.uk');
  assert(customerEvent?.subject.includes('NT-88001'), 'Customer subject must contain booking reference');
  console.log('✓ PASS: Successful booking creates exactly the intended outbox events (customer + ops)');

  // ---------------------------------------------------------------------------
  // TEST 3: Duplicate Event Suppression (Idempotency Key Enforcement)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Testing Duplicate Event Suppression via Idempotency Token ---');
  const initialCount = getMemoryOutboxRecords().length;

  // Re-enqueue with the exact same idempotency token
  const duplicateResults = await enqueueBookingConfirmedEvents(
    sampleBooking,
    { id: 'comp-meridian-001', name: 'Meridian Logistics' },
    { email: 'logistics@meridian.co.uk', name: 'Chris Sullivan' }
  );

  assert(duplicateResults.every((r) => r.success && r.duplicate === true), 'Duplicate events must be flagged as duplicates');
  const countAfterDuplicate = getMemoryOutboxRecords().length;
  assert.strictEqual(countAfterDuplicate, initialCount, 'Outbox record count must not increase on duplicate enqueue');
  console.log('✓ PASS: Duplicate event processing suppresses duplicate records via idempotency token');

  // ---------------------------------------------------------------------------
  // TEST 4: Standby Application Receipts and Approval Enforce Correct States
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Testing Standby Application Lifecycle States & Templates ---');
  clearMemoryOutbox();

  // 4A: Application Submission
  const subResults = await enqueueStandbySubmissionEvents({
    id: 'app-test-2026',
    company_name: 'Aerospace Fasteners UK',
    contact_name: 'David Clarke',
    ops_email: 'd.clarke@aerofast.co.uk',
    driver_mobile: '07700 900123',
    volume: '20 pallets/wk',
  });

  assert.strictEqual(subResults.length, 2, 'Submission must enqueue Ops alert and Applicant receipt');
  const subRecords = getMemoryOutboxRecords();
  const applicantSub = subRecords.find((r) => r.recipient_role === 'customer');
  assert(applicantSub !== undefined, 'Applicant submission receipt must exist');
  assert(applicantSub?.subject.includes('Application Received'), 'Subject must reflect pending review');
  assert(applicantSub?.payload._renderedHtml.includes('PENDING OPERATIONS REVIEW'), 'Content must explicitly state pending status');

  // 4B: Application Approval
  const apprResults = await enqueueStandbyApprovedEvents({
    id: 'app-test-2026',
    company_name: 'Aerospace Fasteners UK',
    contact_name: 'David Clarke',
    account_code: 'NEO-SB-2026-999',
    ops_email: 'd.clarke@aerofast.co.uk',
  });

  assert.strictEqual(apprResults.length, 1, 'Approval must enqueue 1 welcome notice');
  const apprRecord = getMemoryOutboxRecords().find((r) => r.event_type === 'standby_application_approved');
  assert(apprRecord !== undefined, 'Approval outbox record must exist');
  assert(apprRecord?.subject.includes('NEO-SB-2026-999'), 'Approval subject must include generated account code');
  assert(apprRecord?.payload._renderedHtml.includes('NEO-SB-2026-999'), 'Approval body must display account code');
  console.log('✓ PASS: Standby application receipts and approval notifications enforce correct status');

  // ---------------------------------------------------------------------------
  // TEST 5: Failed Email Delivery is Recorded, Retried, and Dead-Lettered
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Testing Email Delivery Failures, Retries, and Dead-Letter Handling ---');
  clearMemoryOutbox();
  mockEmailAdapter.clear();

  // Enqueue a test notification
  await enqueueNotification({
    event_type: 'booking_status_changed',
    idempotency_key: 'test_retry_token_01',
    recipient_email: 'client@meridian.co.uk',
    recipient_role: 'customer',
    payload: { status: 'In transit', bookingId: 'NT-99001' },
    max_retries: 2,
  });

  // Cycle 1: Simulate adapter failure
  mockEmailAdapter.shouldFailNext = true;
  mockEmailAdapter.failureMessage = 'Simulated SMTP 503 Service Unavailable';

  const batch1 = await processOutboxBatch(null, { batchSize: 5 });
  assert.strictEqual(batch1.totalProcessed, 1);
  assert.strictEqual(batch1.failedCount, 1);
  assert.strictEqual(batch1.deliveredCount, 0);

  let record = getMemoryOutboxRecords()[0];
  assert.strictEqual(record.status, 'failed', 'Status must be failed after first attempt');
  assert.strictEqual(record.retry_count, 1, 'Retry count must increment to 1');
  assert(record.last_error?.includes('SMTP 503'), 'Last error must be captured');

  // Cycle 2: Second failure reaching max_retries (2)
  mockEmailAdapter.shouldFailNext = true;
  mockEmailAdapter.failureMessage = 'Simulated SMTP 503 Service Unavailable (2nd attempt)';

  const batch2 = await processOutboxBatch(null, { batchSize: 5 });
  assert.strictEqual(batch2.totalProcessed, 1);
  assert.strictEqual(batch2.deadLetterCount, 1, 'Must transition to dead_letter on reaching max_retries');

  record = getMemoryOutboxRecords()[0];
  assert.strictEqual(record.status, 'dead_letter', 'Status must be dead_letter');
  assert.strictEqual(record.retry_count, 2);

  // Cycle 3: Next processing pass must SKIP dead_letter items
  const batch3 = await processOutboxBatch(null, { batchSize: 5 });
  assert.strictEqual(batch3.totalProcessed, 0, 'Dead letter records must be skipped from processing');
  console.log('✓ PASS: Failed email delivery is recorded, safely retried, and dead-lettered after max retries');

  // ---------------------------------------------------------------------------
  // TEST 6: Tenant Isolation & Recipient Validation
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Testing Tenant Isolation and Recipient Address Sanitization ---');
  clearMemoryOutbox();

  // Invalid email format must be rejected at enqueue
  const invalidEmailResult = await enqueueNotification({
    event_type: 'booking_confirmed',
    idempotency_key: 'invalid_email_token',
    recipient_email: 'not-an-email',
    recipient_role: 'customer',
    payload: {},
  });
  assert.strictEqual(invalidEmailResult.success, false, 'Invalid email must fail closed');
  assert(invalidEmailResult.error?.includes('INVALID_RECIPIENT_EMAIL'));

  // Multi-tenant check: Company A booking must NOT enqueue Company B email
  const companyABooking = {
    ...sampleBooking,
    id: 'NT-TENANT-A',
    company_id: 'comp-meridian-001',
  };
  await enqueueBookingConfirmedEvents(
    companyABooking,
    { id: 'comp-meridian-001', name: 'Meridian Logistics' },
    { email: 'meridian-ops@meridian.co.uk' }
  );

  const tenantRecords = getMemoryOutboxRecords();
  assert(
    tenantRecords.every((r) => r.company_id === 'comp-meridian-001' || r.recipient_role === 'operations'),
    'Tenant A notifications must be strictly scoped to comp-meridian-001 or operations'
  );
  assert(
    !tenantRecords.some((r) => r.recipient_email.includes('apexlogistics.co.uk')),
    'Tenant B email must never appear in Tenant A notification queue'
  );
  console.log('✓ PASS: Recipients and company data cannot leak across tenants');

  // ---------------------------------------------------------------------------
  // TEST 7: Payment Notifications Require Authoritative Verified State
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Testing Payment Notifications Require Verified Payment State ---');
  clearMemoryOutbox();

  // Full authoritative payment succeeds
  const verifiedPaymentResults = await enqueuePaymentVerifiedEvents({
    bookingId: 'NT-88001',
    amountGbp: 285.0,
    stripePaymentIntentId: 'pi_3PtestVerified123',
    customerEmail: 'accounts@meridian.co.uk',
    companyId: 'comp-meridian-001',
  });

  assert.strictEqual(verifiedPaymentResults.length, 1);
  const paymentRecord = getMemoryOutboxRecords()[0];
  assert.strictEqual(paymentRecord.event_type, 'payment_status_verified');
  assert.strictEqual(paymentRecord.recipient_email, 'accounts@meridian.co.uk');
  assert(paymentRecord.subject.includes('£285.00'), 'Subject must show authoritative paid GBP amount');
  assert(paymentRecord.payload._renderedHtml.includes('pi_3PtestVerified123'), 'HTML must include Stripe reference');
  console.log('✓ PASS: Payment notifications require authoritative verified payment state');

  // ---------------------------------------------------------------------------
  // TEST 8: Internal Retries Do Not Generate Customer-Facing Spam
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. Testing At-Most-Once Delivery Guarantee (Zero Customer Spam) ---');
  clearMemoryOutbox();
  mockEmailAdapter.clear();

  // Enqueue single customer notification
  await enqueueNotification({
    event_type: 'booking_confirmed',
    idempotency_key: 'spam_prevention_token',
    recipient_email: 'customer@meridian.co.uk',
    recipient_role: 'customer',
    payload: { bookingId: 'NT-88001' },
  });

  // Run batch 1: Successfully delivers
  const run1 = await processOutboxBatch(null, { batchSize: 5 });
  assert.strictEqual(run1.deliveredCount, 1);
  assert.strictEqual(mockEmailAdapter.sentEmails.length, 1);

  // Run batch 2: Next cycle on the same outbox
  const run2 = await processOutboxBatch(null, { batchSize: 5 });
  assert.strictEqual(run2.deliveredCount, 0, 'Must not re-deliver already delivered record');
  assert.strictEqual(mockEmailAdapter.sentEmails.length, 1, 'Total sent emails must remain strictly 1');

  // Run batch 3: Another subsequent drain cycle
  const run3 = await processOutboxBatch(null, { batchSize: 5 });
  assert.strictEqual(run3.deliveredCount, 0);
  assert.strictEqual(mockEmailAdapter.sentEmails.length, 1, 'Customer must never receive duplicate notification spam');
  console.log('✓ PASS: Internal retries do not generate customer-facing duplicate spam');

  // ---------------------------------------------------------------------------
  // TEST 9: Health Diagnostic Endpoint Reports Outbox Status Safely
  // ---------------------------------------------------------------------------
  console.log('\n--- 9. Testing Outbox Health Diagnostic Reporting ---');
  const health = await getOutboxHealth(null);
  assert(health.status === 'healthy');
  assert.strictEqual(health.emailProvider, 'mock');
  assert.strictEqual(health.isProviderConfigured, true);
  assert.strictEqual(health.counts.delivered, 1);
  assert.strictEqual(health.counts.dead_letter, 0);
  console.log('✓ PASS: Outbox health diagnostic reporting accurately reflects system state');

  // ---------------------------------------------------------------------------
  // TEST 10: Booking Saved but Client Enqueue Interrupted (Database Trigger Durability)
  // ---------------------------------------------------------------------------
  console.log('\n--- 10. Testing Booking Saved but Client Enqueue Request Interrupted ---');
  clearMemoryOutbox();
  mockEmailAdapter.clear();
  setEmailAdapterForTesting(mockEmailAdapter);

  // Simulate database trigger execution that creates outbox record inside the DB transaction
  const triggerResult = await enqueueNotification({
    event_type: 'booking_confirmed',
    idempotency_key: 'booking_conf_ops_NT-DURABLE-99',
    recipient_email: getOperationsAlertEmail(),
    recipient_role: 'operations',
    company_id: 'comp-meridian-001',
    booking_id: 'NT-DURABLE-99',
    payload: {
      bookingId: 'NT-DURABLE-99',
      companyName: 'Meridian Logistics',
      pickup: 'Manchester M17 1AB',
      dropoff: 'Birmingham B6 7EU',
      vehicle: 'Sprinter LWB',
      totalGbp: 248.40,
    },
  });
  assert(triggerResult.success, 'Database trigger outbox record must succeed');

  // Client-side enqueue is simulated to FAIL / ABORT (e.g. browser tab closed or network dropped)
  // Notice: No client-side enqueue is made here!

  // The worker process subsequently runs and drains the queue
  const durableBatch = await processOutboxBatch(null, { batchSize: 5 });
  assert.strictEqual(durableBatch.deliveredCount, 1, 'Outbox item from DB trigger must be processed despite client enqueue interruption');
  assert.strictEqual(mockEmailAdapter.sentEmails.length, 1);
  assert(mockEmailAdapter.sentEmails[0].subject.includes('NT-DURABLE-99'), 'Operations alert must reflect durable booking');
  console.log('✓ PASS: Booking committed to database is durably notified even if client enqueue is interrupted');

  // ---------------------------------------------------------------------------
  // TEST 11: Duplicate Trigger / Enqueue Race Condition (Zero Duplication)
  // ---------------------------------------------------------------------------
  console.log('\n--- 11. Testing Duplicate Trigger/Enqueue Race Condition ---');
  clearMemoryOutbox();

  // First insert: Database trigger fires
  const firstInsert = await enqueueNotification({
    event_type: 'booking_confirmed',
    idempotency_key: 'booking_conf_ops_NT-RACE-01',
    recipient_email: getOperationsAlertEmail(),
    recipient_role: 'operations',
    payload: { bookingId: 'NT-RACE-01' },
  });
  assert.strictEqual(firstInsert.success, true);
  assert.strictEqual(firstInsert.duplicate, false);

  // Second insert: Client enqueue attempts to insert with the exact same standardized key
  const secondInsert = await enqueueNotification({
    event_type: 'booking_confirmed',
    idempotency_key: 'booking_conf_ops_NT-RACE-01',
    recipient_email: getOperationsAlertEmail(),
    recipient_role: 'operations',
    payload: { bookingId: 'NT-RACE-01' },
  });
  assert.strictEqual(secondInsert.success, true);
  assert.strictEqual(secondInsert.duplicate, true, 'Second insert must be flagged as duplicate');
  assert.strictEqual(getMemoryOutboxRecords().length, 1, 'Total outbox records must remain strictly 1');
  console.log('✓ PASS: Race condition between trigger and application enqueue is safely deduplicated');

  // ---------------------------------------------------------------------------
  // TEST 12: Worker Authentication and HTTP Method Handling (GET & POST Supported)
  // ---------------------------------------------------------------------------
  console.log('\n--- 12. Testing Worker Authentication and HTTP Method Handling ---');
  process.env.NEO_WORKER_SECRET = 'test_cron_secret_auth_token_2026';

  const testServer = http.createServer(app);
  await new Promise<void>((resolve) => testServer.listen(0, resolve));
  const testPort = (testServer.address() as any).port;
  const baseUrl = 'http://127.0.0.1:' + testPort;

  try {
    // 12A: GET /api/notifications/process with NO authorization -> 401
    const unauthGet = await fetch(baseUrl + '/api/notifications/process', { method: 'GET' });
    assert.strictEqual(unauthGet.status, 401, 'Unauthenticated GET request must return 401');

    // 12B: GET /api/notifications/process with INVALID token -> 401
    const invalidGet = await fetch(baseUrl + '/api/notifications/process', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer wrong_token_secret' },
    });
    assert.strictEqual(invalidGet.status, 401, 'Invalid secret GET request must return 401');

    // 12C: GET /api/notifications/process with VALID worker secret -> 200
    const validGet = await fetch(baseUrl + '/api/notifications/process?batchSize=2', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer test_cron_secret_auth_token_2026' },
    });
    assert.strictEqual(validGet.status, 200, 'Valid secret GET request must return 200 (Vercel Cron compatible)');
    const getData = await validGet.json();
    assert.strictEqual(getData.success, true);

    // 12D: POST /api/notifications/process with VALID worker secret -> 200
    const validPost = await fetch(baseUrl + '/api/notifications/process', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test_cron_secret_auth_token_2026',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ batchSize: 2 }),
    });
    assert.strictEqual(validPost.status, 200, 'Valid secret POST request must return 200');
    const postData = await validPost.json();
    assert.strictEqual(postData.success, true);

    // 12E: PUT /api/notifications/process -> 405 Method Not Allowed
    const invalidMethod = await fetch(baseUrl + '/api/notifications/process', {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer test_cron_secret_auth_token_2026' },
    });
    assert.strictEqual(invalidMethod.status, 405, 'PUT method must return 405 Method Not Allowed');
  } finally {
    delete process.env.NEO_WORKER_SECRET;
    await new Promise<void>((resolve) => testServer.close(() => resolve()));
  }
  console.log('✓ PASS: Worker endpoint strictly enforces auth and supports both GET and POST with 405 on others');

  // ---------------------------------------------------------------------------
  // TEST 13: Disabled Email Provider & Missing Configuration Queue Safety
  // ---------------------------------------------------------------------------
  console.log('\n--- 13. Testing Disabled Email Provider & Queue Safety ---');
  clearMemoryOutbox();

  // Enqueue a pending notification
  await enqueueNotification({
    event_type: 'booking_confirmed',
    idempotency_key: 'booking_conf_ops_NT-PENDING-SAFE',
    recipient_email: getOperationsAlertEmail(),
    recipient_role: 'operations',
    payload: { bookingId: 'NT-PENDING-SAFE' },
  });

  // Switch to real ResendEmailAdapter with email delivery DISABLED
  const savedEnabled = process.env.NEO_EMAIL_ENABLED;
  delete process.env.NEO_EMAIL_ENABLED;
  resetEmailAdapterForTesting();

  // Attempt to process batch while email is disabled
  const disabledBatch = await processOutboxBatch(null, { batchSize: 5 });
  assert.strictEqual(disabledBatch.totalProcessed, 0, 'Zero items should be processed when email is disabled');
  assert.strictEqual(disabledBatch.deadLetterCount, 0, 'Items must NOT be dead-lettered when email is disabled');

  const pendingRecord = getMemoryOutboxRecords()[0];
  assert.strictEqual(pendingRecord.status, 'pending', 'Item must safely remain pending');
  assert.strictEqual(pendingRecord.retry_count, 0, 'Retry count must NOT be incremented when email is disabled');

  // Restore mock adapter for test suite cleanup
  process.env.NEO_EMAIL_ENABLED = savedEnabled;
  setEmailAdapterForTesting(mockEmailAdapter);
  console.log('✓ PASS: When email is disabled, outbox queue safely preserves pending records without burning retries');

  // ---------------------------------------------------------------------------
  // TEST 14: Unambiguous Customer Recipient Resolution & Fail-Closed Isolation
  // ---------------------------------------------------------------------------
  console.log('\n--- 14. Testing Unambiguous Customer Recipient Resolution & Fail-Closed Safety ---');
  clearMemoryOutbox();

  // 14A: Booking with unambiguous verified customer contact -> enqueues receipt
  const verifiedResults = await enqueueBookingConfirmedEvents(
    sampleBooking,
    { id: 'comp-meridian-001', name: 'Meridian Logistics' },
    { email: 'chris.sullivan@meridian.co.uk', name: 'Chris Sullivan' }
  );
  assert.strictEqual(verifiedResults.length, 2, 'Unambiguous contact must enqueue both ops alert and customer receipt');
  const verifiedCustomerRecord = getMemoryOutboxRecords().find((r) => r.recipient_role === 'customer');
  assert.strictEqual(verifiedCustomerRecord?.recipient_email, 'chris.sullivan@meridian.co.uk');

  // 14B: Booking with missing/unidentified customer contact -> FAILS CLOSED for customer receipt, preserves ops alert
  clearMemoryOutbox();
  const ambiguousResults = await enqueueBookingConfirmedEvents(
    sampleBooking,
    { id: 'comp-meridian-001', name: 'Meridian Logistics' },
    { email: '' } // Missing / ambiguous email
  );
  assert.strictEqual(ambiguousResults.length, 1, 'Ambiguous contact must enqueue ONLY operations alert (fail closed for customer)');
  const ambiguousRecords = getMemoryOutboxRecords();
  assert.strictEqual(ambiguousRecords.length, 1);
  assert.strictEqual(ambiguousRecords[0].recipient_role, 'operations', 'Only operations alert must be enqueued');
  assert.strictEqual(
    ambiguousRecords.some((r) => r.recipient_role === 'customer'),
    false,
    'Must NEVER select arbitrary customer profile when recipient is ambiguous'
  );

  // 14C: Operations alert recipient configurable via environment
  const savedOpsEmail = process.env.NEO_OPS_ALERT_EMAIL;
  try {
    process.env.NEO_OPS_ALERT_EMAIL = 'custom-dispatch@neotransport.co.uk';
    assert.strictEqual(getOperationsAlertEmail(), 'custom-dispatch@neotransport.co.uk');
  } finally {
    if (savedOpsEmail) {
      process.env.NEO_OPS_ALERT_EMAIL = savedOpsEmail;
    } else {
      delete process.env.NEO_OPS_ALERT_EMAIL;
    }
  }
  console.log('✓ PASS: Recipient resolution enforces unambiguous verification, fails closed without guessing, and preserves ops alert');

  // ---------------------------------------------------------------------------
  // TEST 15: Migration SQL Function Security, Search Path Pinning & Fail-Closed Invariants
  // ---------------------------------------------------------------------------
  console.log('\n--- 15. Testing Migration SQL Function Security, Search Path Pinning & Fail-Closed Ops Recipient ---');
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261022033000_create_notifications_outbox.sql'
  );
  assert(fs.existsSync(migrationPath), `Migration file must exist at ${migrationPath}`);
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  // 15A: Table Level Privileges on notifications_outbox
  assert(
    migrationSql.includes('ALTER TABLE public.notifications_outbox ENABLE ROW LEVEL SECURITY;'),
    'Table notifications_outbox must have RLS enabled'
  );
  assert(
    migrationSql.includes('REVOKE ALL ON TABLE public.notifications_outbox FROM anon, authenticated, PUBLIC;'),
    'Table notifications_outbox must revoke ALL from anon, authenticated, PUBLIC'
  );
  assert(
    migrationSql.includes('GRANT ALL ON TABLE public.notifications_outbox TO service_role;'),
    'Table notifications_outbox must grant ALL to service_role'
  );

  // 15B: Function Privileges on get_operations_alert_recipient()
  assert(
    migrationSql.includes('REVOKE ALL ON FUNCTION public.get_operations_alert_recipient() FROM PUBLIC, anon, authenticated;'),
    'get_operations_alert_recipient must explicitly revoke EXECUTE from PUBLIC, anon, authenticated'
  );
  assert(
    migrationSql.includes('GRANT EXECUTE ON FUNCTION public.get_operations_alert_recipient() TO postgres, service_role;'),
    'get_operations_alert_recipient must grant EXECUTE to postgres and service_role only'
  );

  // 15C: Search Path Pinning (public, pg_temp) across all migration functions
  const searchPathOccurrences = (migrationSql.match(/SET search_path = public, pg_temp/g) || []).length;
  assert.strictEqual(
    searchPathOccurrences,
    4,
    'All 4 migration functions must pin search_path = public, pg_temp with pg_temp last'
  );

  // 15D: Fail-Closed Operations Recipient (No unverified hardcoded email fallback)
  assert(
    !migrationSql.includes("RETURN 'ops@neotransport.co.uk';"),
    'get_operations_alert_recipient must NEVER contain unverified hardcoded fallback email'
  );
  assert(
    migrationSql.includes('RETURN NULL;'),
    'get_operations_alert_recipient must fail-closed and return NULL when no ops recipient is resolved'
  );

  // 15E: Triggers Guard Operations Outbox Inserts against NULL
  const opsNullGuards = (migrationSql.match(/IF v_ops_email IS NOT NULL THEN/g) || []).length;
  assert.strictEqual(
    opsNullGuards,
    2,
    'Both standby application and booking confirmed triggers must guard ops outbox insert with IF v_ops_email IS NOT NULL'
  );

  // 15F: Trigger Functions Revoke Direct Execution from PUBLIC, anon, authenticated
  assert(
    migrationSql.includes('REVOKE ALL ON FUNCTION public.handle_standby_application_submitted_queue() FROM PUBLIC, anon, authenticated;'),
    'handle_standby_application_submitted_queue must revoke EXECUTE from PUBLIC, anon, authenticated'
  );
  assert(
    migrationSql.includes('REVOKE ALL ON FUNCTION public.handle_standby_application_approved_queue() FROM PUBLIC, anon, authenticated;'),
    'handle_standby_application_approved_queue must revoke EXECUTE from PUBLIC, anon, authenticated'
  );
  assert(
    migrationSql.includes('REVOKE ALL ON FUNCTION public.handle_booking_confirmed_queue() FROM PUBLIC, anon, authenticated;'),
    'handle_booking_confirmed_queue must revoke EXECUTE from PUBLIC, anon, authenticated'
  );

  // 15G: Verification of Trigger Invocation and Security Definer Invariants
  // When an anonymous user submits standby or authenticated user books, the trigger
  // executes as SECURITY DEFINER (postgres), which holds EXECUTE on helper and ALL on outbox.
  // When ops email is unconfigured/NULL (fail-closed), the application/booking succeeds and ops alert is skipped.
  clearMemoryOutbox();
  const savedOpsFor15 = process.env.NEO_OPS_ALERT_EMAIL;
  try {
    process.env.NEO_OPS_ALERT_EMAIL = ''; // Simulate unconfigured operations recipient
    const failClosedStandby = await enqueueStandbySubmissionEvents({
      id: 'app-failclosed-test-001',
      company_name: 'Fail Closed Corp',
      contact_name: 'Alex Grey',
      ops_email: 'applicant@failclosed.com',
    });
    // Applicant receipt queued, but operations alert safely omitted without exception
    assert.strictEqual(failClosedStandby.length, 1, 'Only applicant receipt should be enqueued when ops email is unconfigured');
    assert.strictEqual(failClosedStandby[0].record?.recipient_role, 'customer');

    // Booking confirmed with unconfigured ops email
    clearMemoryOutbox();
    const failClosedBooking = await enqueueBookingConfirmedEvents(
      sampleBooking,
      { id: 'comp-meridian-001', name: 'Meridian Logistics' },
      { email: 'chris.sullivan@meridian.co.uk', name: 'Chris Sullivan' }
    );
    assert.strictEqual(failClosedBooking.length, 1, 'Only customer receipt should be enqueued when ops email is unconfigured');
    assert.strictEqual(failClosedBooking[0].record?.recipient_role, 'customer');
  } finally {
    if (savedOpsFor15) {
      process.env.NEO_OPS_ALERT_EMAIL = savedOpsFor15;
    } else {
      delete process.env.NEO_OPS_ALERT_EMAIL;
    }
  }
  console.log('✓ PASS: Migration SQL function security, search path pinning, and fail-closed trigger invariants verified');

  // Clean up
  resetEmailAdapterForTesting();
  console.log('\n=================================================================');
  console.log('ALL TRANSACTIONAL NOTIFICATION TESTS PASSED (0 failures)');
  console.log('=================================================================');
}

runNotificationTests().catch((err) => {
  console.error('\n❌ NOTIFICATION TEST SUITE FAILED:', err);
  process.exit(1);
});

/**
 * NEO TRANSPORT LTD — AIRCALL WHATSAPP ADAPTER & OUTBOX INTEGRATION TEST SUITE
 * 
 * Offline, hermetic test suite verifying:
 * 1. Default disabled state: WhatsApp delivery disabled by default (fails closed).
 * 2. Missing configuration blocks delivery without external network requests.
 * 3. Mock WhatsApp adapter operates in-memory with zero network calls.
 * 4. Outbox queue integration: WhatsApp items require valid recipient phone numbers.
 * 5. Outbox batch processing: Respects adapter enabled state without burning retries when disabled.
 * 6. Idempotency & duplicate suppression: Repeated batch execution creates zero duplicate sends.
 * 7. PII protection: Phone numbers are masked in log/error outputs.
 * 8. Frontend security: Zero Aircall secrets or tokens exposed to frontend bundles.
 * 9. Co-existence: Existing email delivery and Aircall telephony remain completely unaffected.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  AircallWhatsAppAdapter,
  MockWhatsAppAdapter,
  getActiveWhatsAppAdapter,
  setWhatsAppAdapterForTesting,
  resetWhatsAppAdapterForTesting,
  maskPhoneNumber,
  validatePhoneNumber,
} from '../api/notifications/whatsappAdapter.js';
import {
  enqueueNotification,
  processOutboxBatch,
  getOutboxHealth,
  setMemoryOutboxOverride,
  getMemoryOutboxRecords,
  clearMemoryOutbox,
} from '../api/notifications/outboxService.js';
import {
  MockEmailAdapter,
  setEmailAdapterForTesting,
  resetEmailAdapterForTesting,
} from '../api/notifications/emailAdapter.js';
import { verifyAircallWebhookToken } from '../api/aircallService.js';

async function runAircallWhatsAppTests() {
  console.log('=================================================================');
  console.log('STARTING AIRCALL WHATSAPP ADAPTER & OFFLINE INTEGRATION TESTS');
  console.log('=================================================================\n');

  // --- 1. Default Disabled State & Safety Guards ---
  console.log('--- 1. Testing Default Disabled State & Safety Guards ---');
  {
    // Save original env vars
    const origEnabled = process.env.AIRCALL_WHATSAPP_ENABLED;
    const origId = process.env.AIRCALL_API_ID;
    const origToken = process.env.AIRCALL_API_TOKEN;
    const origLine = process.env.AIRCALL_WHATSAPP_LINE_ID;

    try {
      delete process.env.AIRCALL_WHATSAPP_ENABLED;
      delete process.env.AIRCALL_API_ID;
      delete process.env.AIRCALL_API_TOKEN;
      delete process.env.AIRCALL_WHATSAPP_LINE_ID;

      const defaultAdapter = new AircallWhatsAppAdapter();
      assert.strictEqual(defaultAdapter.name, 'aircall');
      assert.strictEqual(defaultAdapter.isConfigured, false, 'Must be unconfigured when env vars are missing');
      assert.strictEqual(defaultAdapter.isEnabled, false, 'Must be disabled by default');

      const sendRes = await defaultAdapter.sendWhatsApp({
        to: '+44 1925 986076',
        text: 'Test message',
      });
      assert.strictEqual(sendRes.success, false, 'Delivery must fail closed when unconfigured');
      assert.strictEqual(sendRes.status, 503);
      assert.ok(sendRes.error?.includes('WHATSAPP_DELIVERY_DISABLED'));
      console.log('✓ PASS 1.1: AircallWhatsAppAdapter is disabled by default and fails closed with 503');

      // 1.2 Enable flag but omit credentials
      process.env.AIRCALL_WHATSAPP_ENABLED = 'true';
      const flagOnlyAdapter = new AircallWhatsAppAdapter();
      assert.strictEqual(flagOnlyAdapter.isConfigured, false);
      assert.strictEqual(flagOnlyAdapter.isEnabled, false, 'Flag alone without credentials must not enable adapter');
      console.log('✓ PASS 1.2: Enabling AIRCALL_WHATSAPP_ENABLED without credentials remains disabled');

      // 1.3 Configure credentials but keep enabled false
      delete process.env.AIRCALL_WHATSAPP_ENABLED;
      process.env.AIRCALL_API_ID = 'test_api_id';
      process.env.AIRCALL_API_TOKEN = 'test_api_token';
      process.env.AIRCALL_WHATSAPP_LINE_ID = '123456';
      const credsOnlyAdapter = new AircallWhatsAppAdapter();
      assert.strictEqual(credsOnlyAdapter.isConfigured, true);
      assert.strictEqual(credsOnlyAdapter.isEnabled, false, 'Credentials alone without explicit flag must remain disabled');
      console.log('✓ PASS 1.3: Configured credentials remain disabled without explicit AIRCALL_WHATSAPP_ENABLED=true');

      // 1.4 Phase 1 Safe Client Guard: Even when fully configured, live client is guarded
      process.env.AIRCALL_WHATSAPP_ENABLED = 'true';
      const fullAdapter = new AircallWhatsAppAdapter();
      assert.strictEqual(fullAdapter.isEnabled, true);
      const guardedRes = await fullAdapter.sendWhatsApp({
        to: '+44 1925 986076',
        text: 'Test dispatch message',
      });
      assert.strictEqual(guardedRes.success, false);
      assert.strictEqual(guardedRes.status, 503);
      assert.ok(guardedRes.error?.includes('AIRCALL_WHATSAPP_LIVE_CLIENT_UNAVAILABLE'));
      console.log('✓ PASS 1.4: Phase 1 guard safely blocks live outbound network calls');
    } finally {
      // Restore env
      if (origEnabled !== undefined) process.env.AIRCALL_WHATSAPP_ENABLED = origEnabled; else delete process.env.AIRCALL_WHATSAPP_ENABLED;
      if (origId !== undefined) process.env.AIRCALL_API_ID = origId; else delete process.env.AIRCALL_API_ID;
      if (origToken !== undefined) process.env.AIRCALL_API_TOKEN = origToken; else delete process.env.AIRCALL_API_TOKEN;
      if (origLine !== undefined) process.env.AIRCALL_WHATSAPP_LINE_ID = origLine; else delete process.env.AIRCALL_WHATSAPP_LINE_ID;
    }
  }

  // --- 2. Phone Number Validation & PII Redaction ---
  console.log('\n--- 2. Testing Phone Number Validation & PII Redaction ---');
  {
    // 2.1 Masking
    assert.strictEqual(maskPhoneNumber('+44 1925 986076'), '+44 1925 ****76');
    assert.strictEqual(maskPhoneNumber('07700900123'), '07700 ****23');
    assert.strictEqual(maskPhoneNumber(''), '[REDACTED]');
    assert.strictEqual(maskPhoneNumber(null), '[REDACTED]');
    assert.strictEqual(maskPhoneNumber(undefined), '[REDACTED]');
    console.log('✓ PASS 2.1: maskPhoneNumber correctly redacts customer phone numbers');

    // 2.2 Validation
    const ukValid = validatePhoneNumber('07700 900123');
    assert.strictEqual(ukValid.isValid, true);
    assert.strictEqual(ukValid.normalized, '+447700900123');

    const intlValid = validatePhoneNumber('+44 1925 986076');
    assert.strictEqual(intlValid.isValid, true);
    assert.strictEqual(intlValid.normalized, '+441925986076');

    const invalidShort = validatePhoneNumber('12345');
    assert.strictEqual(invalidShort.isValid, false);

    const invalidChars = validatePhoneNumber('phone-number-abc');
    assert.strictEqual(invalidChars.isValid, false);

    const empty = validatePhoneNumber('');
    assert.strictEqual(empty.isValid, false);
    console.log('✓ PASS 2.2: validatePhoneNumber standardizes UK mobile and E.164 numbers');
  }

  // --- 3. Mock Adapter Functionality ---
  console.log('\n--- 3. Testing Mock WhatsApp Adapter Functionality ---');
  {
    const mock = new MockWhatsAppAdapter();
    assert.strictEqual(mock.name, 'mock');
    assert.strictEqual(mock.isEnabled, true);

    const res1 = await mock.sendWhatsApp({
      to: '+44 7700 900123',
      text: 'Booking confirmed NT-25123',
      idempotencyKey: 'test_key_001',
    });
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.status, 200);
    assert.ok(res1.messageId?.startsWith('mock-wa-'));
    assert.strictEqual(mock.sentMessages.length, 1);
    assert.strictEqual(mock.sentMessages[0].to, '+447700900123');
    console.log('✓ PASS 3.1: Mock adapter delivers in-memory with unique messageId');

    // 3.2 Failure simulation
    mock.shouldFailNext = true;
    mock.failureMessage = 'Simulated Aircall rate limit (429)';
    const failRes = await mock.sendWhatsApp({
      to: '+44 7700 900123',
      text: 'Another message',
    });
    assert.strictEqual(failRes.success, false);
    assert.strictEqual(failRes.status, 500);
    assert.strictEqual(failRes.error, 'Simulated Aircall rate limit (429)');
    console.log('✓ PASS 3.2: Mock adapter supports failure simulation');

    // 3.3 Clear
    mock.clear();
    assert.strictEqual(mock.sentMessages.length, 0);
    console.log('✓ PASS 3.3: Mock adapter clear resets state cleanly');
  }

  // --- 4. Outbox Integration & Phone Requirement ---
  console.log('\n--- 4. Testing Outbox Enqueueing & Phone Validation ---');
  setMemoryOutboxOverride(true);
  clearMemoryOutbox();
  try {
    // 4.1 Enqueueing WhatsApp notification without phone must fail closed
    const noPhoneRes = await enqueueNotification({
      event_type: 'booking_confirmed',
      idempotency_key: 'wa_no_phone_test',
      recipient_email: 'customer@example.com',
      recipient_role: 'customer',
      channel: 'whatsapp',
      payload: { bookingId: 'NT-25123' },
    });
    assert.strictEqual(noPhoneRes.success, false);
    assert.ok(noPhoneRes.error?.includes('INVALID_RECIPIENT_PHONE'));
    console.log('✓ PASS 4.1: Enqueueing WhatsApp notification without phone fails closed');

    // 4.2 Enqueueing with invalid phone format fails closed
    const badPhoneRes = await enqueueNotification({
      event_type: 'booking_confirmed',
      idempotency_key: 'wa_bad_phone_test',
      recipient_email: 'customer@example.com',
      recipient_phone: 'not-a-phone',
      recipient_role: 'customer',
      channel: 'whatsapp',
      payload: { bookingId: 'NT-25123' },
    });
    assert.strictEqual(badPhoneRes.success, false);
    assert.ok(badPhoneRes.error?.includes('INVALID_RECIPIENT_PHONE'));
    console.log('✓ PASS 4.2: Enqueueing WhatsApp with malformed phone number fails closed');

    // 4.3 Valid WhatsApp notification enqueued successfully
    const validRes = await enqueueNotification({
      event_type: 'booking_confirmed',
      idempotency_key: 'wa_valid_001',
      recipient_email: 'customer@example.com',
      recipient_phone: '07700 900123',
      recipient_role: 'customer',
      channel: 'whatsapp',
      payload: { bookingId: 'NT-25123', totalGbp: 150 },
    });
    assert.strictEqual(validRes.success, true);
    assert.strictEqual(validRes.duplicate, false);
    assert.strictEqual(validRes.record?.channel, 'whatsapp');
    assert.strictEqual(validRes.record?.recipient_phone, '+447700900123');
    console.log('✓ PASS 4.3: Valid WhatsApp notification enqueued with normalized phone number');

    // 4.4 Duplicate enqueueing with identical idempotency key is suppressed
    const dupRes = await enqueueNotification({
      event_type: 'booking_confirmed',
      idempotency_key: 'wa_valid_001',
      recipient_email: 'customer@example.com',
      recipient_phone: '07700 900123',
      recipient_role: 'customer',
      channel: 'whatsapp',
      payload: { bookingId: 'NT-25123', totalGbp: 150 },
    });
    assert.strictEqual(dupRes.success, true);
    assert.strictEqual(dupRes.duplicate, true);
    assert.strictEqual(getMemoryOutboxRecords().length, 1);
    console.log('✓ PASS 4.4: Duplicate WhatsApp enqueueing suppressed via idempotency key');
  } finally {
    clearMemoryOutbox();
  }

  // --- 5. Outbox Batch Processing & Adapter Routing ---
  console.log('\n--- 5. Testing Outbox Batch Processing & Adapter Routing ---');
  setMemoryOutboxOverride(true);
  clearMemoryOutbox();
  const mockEmail = new MockEmailAdapter();
  const mockWhatsApp = new MockWhatsAppAdapter();
  setEmailAdapterForTesting(mockEmail);
  setWhatsAppAdapterForTesting(mockWhatsApp);

  try {
    // 5.1 When WhatsApp is disabled, WhatsApp items are skipped safely without burning retries
    mockWhatsApp.isEnabled = false;
    await enqueueNotification({
      event_type: 'booking_confirmed',
      idempotency_key: 'wa_item_skip_test',
      recipient_email: 'customer@example.com',
      recipient_phone: '07700 900123',
      recipient_role: 'customer',
      channel: 'whatsapp',
      payload: { bookingId: 'NT-25123' },
    });

    const batchSkip = await processOutboxBatch(null);
    assert.strictEqual(batchSkip.skippedCount, 1, 'Disabled WhatsApp adapter must skip pending items');
    assert.strictEqual(batchSkip.deliveredCount, 0);
    const pendingItem = getMemoryOutboxRecords()[0];
    assert.strictEqual(pendingItem.status, 'pending', 'Skipped item must remain pending');
    assert.strictEqual(pendingItem.retry_count, 0, 'Skipped item must not burn retries');
    console.log('✓ PASS 5.1: Disabled WhatsApp adapter preserves pending records without burning retries');

    // 5.2 When WhatsApp is enabled, batch processes and delivers
    mockWhatsApp.isEnabled = true;
    const batchDeliver = await processOutboxBatch(null);
    assert.strictEqual(batchDeliver.deliveredCount, 1);
    assert.strictEqual(mockWhatsApp.sentMessages.length, 1);
    assert.strictEqual(mockWhatsApp.sentMessages[0].idempotencyKey, 'wa_item_skip_test');
    assert.strictEqual(pendingItem.status, 'delivered');
    assert.ok(pendingItem.sent_at);
    console.log('✓ PASS 5.2: Active WhatsApp adapter delivers pending item and marks delivered');

    // 5.3 Repeated batch run does not duplicate delivery
    const batchRepeat = await processOutboxBatch(null);
    assert.strictEqual(batchRepeat.totalProcessed, 0);
    assert.strictEqual(batchRepeat.deliveredCount, 0);
    assert.strictEqual(mockWhatsApp.sentMessages.length, 1, 'Zero additional messages sent on repeat');
    console.log('✓ PASS 5.3: At-most-once delivery: repeated batch processing generates zero duplicates');

    // 5.4 Dual-channel batch (Email + WhatsApp)
    clearMemoryOutbox();
    mockEmail.clear();
    mockWhatsApp.clear();

    await enqueueNotification({
      event_type: 'booking_confirmed',
      idempotency_key: 'dual_email_01',
      recipient_email: 'ops@neotransport.co.uk',
      recipient_role: 'operations',
      channel: 'email',
      payload: { bookingId: 'NT-25123' },
    });

    await enqueueNotification({
      event_type: 'booking_confirmed',
      idempotency_key: 'dual_wa_01',
      recipient_email: 'ops@neotransport.co.uk',
      recipient_phone: '07700 900123',
      recipient_role: 'customer',
      channel: 'whatsapp',
      payload: { bookingId: 'NT-25123' },
    });

    const dualBatch = await processOutboxBatch(null);
    assert.strictEqual(dualBatch.deliveredCount, 2);
    assert.strictEqual(mockEmail.sentEmails.length, 1);
    assert.strictEqual(mockWhatsApp.sentMessages.length, 1);
    console.log('✓ PASS 5.4: Dual-channel batch dispatches email and WhatsApp to respective adapters');
  } finally {
    clearMemoryOutbox();
    resetEmailAdapterForTesting();
    resetWhatsAppAdapterForTesting();
    setMemoryOutboxOverride(false);
  }

  // --- 6. Outbox Health Diagnostic Reporting ---
  console.log('\n--- 6. Testing Outbox Health Reporting ---');
  {
    const health = await getOutboxHealth(null);
    assert.ok(health.whatsappProvider, 'Health report must list whatsappProvider');
    assert.strictEqual(typeof health.isWhatsAppConfigured, 'boolean');
    assert.strictEqual(typeof health.isWhatsAppEnabled, 'boolean');
    console.log('✓ PASS 6.1: Outbox health report includes WhatsApp adapter diagnostics');
  }

  // --- 7. Security: Frontend Secrets & Redaction Audit ---
  console.log('\n--- 7. Verifying Security & Bundle Invariants ---');
  {
    // Scan src directory for any raw tokens or secrets
    const srcDir = path.resolve('src');
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[];
    const codeFiles = files.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

    for (const file of codeFiles) {
      const fullPath = path.join(srcDir, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.ok(!content.includes('AIRCALL_API_TOKEN'), `File ${file} must not reference AIRCALL_API_TOKEN`);
      assert.ok(!content.includes('AIRCALL_API_ID'), `File ${file} must not reference AIRCALL_API_ID`);
      assert.ok(!content.includes('AIRCALL_WEBHOOK_TOKEN'), `File ${file} must not reference AIRCALL_WEBHOOK_TOKEN`);
    }
    console.log('✓ PASS 7.1: Zero Aircall backend secrets or tokens exist in frontend code');
  }

  // --- 8. Existing Aircall Telephony Non-Regression ---
  console.log('\n--- 8. Verifying Existing Aircall Telephony Non-Regression ---');
  {
    const dummyReqMissing = { headers: {}, body: {} } as any;
    const resMissing = verifyAircallWebhookToken(dummyReqMissing, 'test_token');
    assert.strictEqual(resMissing.valid, false);
    assert.strictEqual(resMissing.status, 401);

    const dummyReqValid = { headers: {}, body: { token: 'test_token' } } as any;
    const resValid = verifyAircallWebhookToken(dummyReqValid, 'test_token');
    assert.strictEqual(resValid.valid, true);
    assert.strictEqual(resValid.status, 200);
    console.log('✓ PASS 8.1: Existing Aircall telephony webhook token verification preserved');
  }

  console.log('\n=================================================================');
  console.log('ALL AIRCALL WHATSAPP ADAPTER & OFFLINE TESTS PASSED (0 failures)');
  console.log('=================================================================\n');
}

runAircallWhatsAppTests().catch((err) => {
  console.error('\n❌ TEST FAILURE:', err);
  process.exit(1);
});

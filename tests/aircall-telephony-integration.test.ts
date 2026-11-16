/**
 * tests/aircall-telephony-integration.test.ts
 *
 * NEO TRANSPORT — AIRCALL TELEPHONY & WEBHOOK VERIFICATION TEST SUITE
 *
 * Verifies:
 * 1. Webhook Authentication & Token Verification:
 *    - Token from request body `token`
 *    - Token from header `x-aircall-token`
 *    - Timing-safe comparison rejection for invalid tokens (HTTP 401)
 *    - Fail-closed behavior when server secret is unconfigured (HTTP 503)
 * 2. Phone Number & Call Formatting Helpers:
 *    - UK standard and international phone normalization
 *    - Call duration human-readable formatting (seconds, minutes)
 * 3. Event Processing & CRM/Ticket Correlation:
 *    - call.ended: Logs resolved ticket with agent name, duration, and recording link
 *    - call.voicemail_left: Logs high-priority open ticket with voicemail audio recording link
 *    - Deduplication & idempotency handling
 * 4. Client-Side Click-to-Call Helpers:
 *    - Aircall app protocol URL generation (aircall:)
 *    - Aircall web phone CTI URL generation (https://phone.aircall.io)
 *    - Standard telephony fallback (tel:)
 * 5. Live Aircall REST API Health Diagnostics:
 *    - Validates company name ('NEO Transport Ltd')
 *    - Validates provisioned telephone numbers (+44 1925 986076 NEO - HQ)
 *    - Validates operational users (Nnamdi Ohiaeri)
 */

import { strict as assert } from 'node:assert';
import {
  verifyAircallWebhookToken,
  normalizePhoneNumber,
  formatCallDuration,
  processAircallWebhookEvent,
  getAircallOperationalStatus,
  AircallWebhookEvent,
} from '../api/aircallService';
import {
  AIRCALL_CONFIG,
  getAircallDialUrl,
  cleanPhoneNumber,
} from '../src/lib/aircall';

console.log('======================================================================');
console.log('  STARTING AIRCALL TELEPHONY INTEGRATION VERIFICATION TEST SUITE');
console.log('======================================================================\n');

async function runTestSuite() {
  const TEST_SECRET = 'd7123c4332da4524bd9514311786f9d1';

  // -------------------------------------------------------------------------
  // 1. Webhook Token Authentication Verification
  // -------------------------------------------------------------------------
  console.log('--- 1. Testing Aircall Webhook Token Verification ---');

  // A. Valid token in request body
  const validBodyReq: any = {
    headers: {},
    body: { token: TEST_SECRET, event: 'call.created' },
  };
  const validBodyResult = verifyAircallWebhookToken(validBodyReq, TEST_SECRET);
  assert.strictEqual(validBodyResult.valid, true);
  assert.strictEqual(validBodyResult.status, 200);
  console.log('  ✓ Valid token in request body authenticated successfully');

  // B. Valid token in x-aircall-token header
  const validHeaderReq: any = {
    headers: { 'x-aircall-token': TEST_SECRET },
    body: { event: 'call.created' },
  };
  const validHeaderResult = verifyAircallWebhookToken(validHeaderReq, TEST_SECRET);
  assert.strictEqual(validHeaderResult.valid, true);
  assert.strictEqual(validHeaderResult.status, 200);
  console.log('  ✓ Valid token in x-aircall-token header authenticated successfully');

  // C. Invalid token rejection
  const invalidReq: any = {
    headers: {},
    body: { token: 'invalid_token_123', event: 'call.created' },
  };
  const invalidResult = verifyAircallWebhookToken(invalidReq, TEST_SECRET);
  assert.strictEqual(invalidResult.valid, false);
  assert.strictEqual(invalidResult.status, 401);
  console.log('  ✓ Invalid token rejected with HTTP 401');

  // D. Missing token rejection
  const missingReq: any = {
    headers: {},
    body: { event: 'call.created' },
  };
  const missingResult = verifyAircallWebhookToken(missingReq, TEST_SECRET);
  assert.strictEqual(missingResult.valid, false);
  assert.strictEqual(missingResult.status, 401);
  console.log('  ✓ Missing token rejected with HTTP 401');

  // E. Unconfigured server secret fail-closed
  const unconfiguredResult = verifyAircallWebhookToken(validBodyReq, '');
  assert.strictEqual(unconfiguredResult.valid, false);
  assert.strictEqual(unconfiguredResult.status, 503);
  console.log('  ✓ Unconfigured server secret fails closed with HTTP 503');

  // -------------------------------------------------------------------------
  // 2. Phone Number & Duration Formatting Helpers
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Testing Telephony Normalization & Formatting Helpers ---');

  assert.strictEqual(normalizePhoneNumber('+44 1925 986076'), '1925986076');
  assert.strictEqual(normalizePhoneNumber('01925 986076'), '1925986076');
  assert.strictEqual(normalizePhoneNumber('07700 900123'), '7700900123');
  console.log('  ✓ Phone numbers normalized reliably across formats');

  assert.strictEqual(formatCallDuration(0), '0s');
  assert.strictEqual(formatCallDuration(45), '45s');
  assert.strictEqual(formatCallDuration(135), '2m 15s');
  assert.strictEqual(formatCallDuration(3600), '60m 0s');
  console.log('  ✓ Call durations formatted correctly into human-readable text');

  // -------------------------------------------------------------------------
  // 3. Client-Side Click-to-Call Helpers
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Testing Client-Side Dial URL Generation ---');

  assert.strictEqual(cleanPhoneNumber('+44 1925 986076'), '+441925986076');
  assert.strictEqual(
    getAircallDialUrl('+44 1925 986076', 'app'),
    'aircall:+441925986076'
  );
  assert.strictEqual(
    getAircallDialUrl('+44 1925 986076', 'web'),
    'https://phone.aircall.io?phone_number=%2B441925986076'
  );
  assert.strictEqual(
    getAircallDialUrl('+44 1925 986076', 'tel'),
    'tel:+441925986076'
  );
  assert.strictEqual(AIRCALL_CONFIG.hqNumber, '+44 1925 986076');
  console.log('  ✓ Dial URLs generated accurately for app, web phone, and tel');

  // -------------------------------------------------------------------------
  // 4. Mock Event Processing & CRM Logging
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Testing Webhook Event Processing & Ticket Persistence ---');

  const insertedTickets: any[] = [];
  const insertedEvents: any[] = [];

  const mockDbClient: any = {
    from: (table: string) => {
      if (table === 'aircall_webhook_events') {
        return {
          insert: async (data: any) => {
            const isDup = insertedEvents.some((e) => e.event_hash === data.event_hash);
            if (isDup) {
              return { error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
            }
            insertedEvents.push(data);
            return { error: null };
          },
        };
      }
      if (table === 'support_tickets') {
        return {
          insert: (ticket: any) => {
            insertedTickets.push(ticket);
            return {
              select: () => ({
                maybeSingle: async () => ({ data: { id: ticket.id }, error: null }),
              }),
            };
          },
        };
      }
      if (table === 'bookings') {
        return {
          select: () => ({
            order: () => ({
              limit: async () => ({
                data: [
                  {
                    id: 'NT-25121',
                    company_id: 'comp-clarkes-01',
                    collection_contact_phone: '+44 1925 986076',
                    delivery_contact_phone: '07700 900555',
                    status: 'IN TRANSIT',
                  },
                ],
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      };
    },
  };

  // Test call.ended event
  const callEndedPayload: AircallWebhookEvent = {
    resource: 'call',
    event: 'call.ended',
    timestamp: 1729790000,
    token: TEST_SECRET,
    data: {
      id: 9876543,
      direction: 'inbound',
      status: 'done',
      duration: 142,
      raw_digits: '+44 1925 986076',
      user: {
        id: 2100268,
        name: 'Nnamdi Ohiaeri',
        email: 'nnamdi.ohiaeri@neotransport.co.uk',
      },
      number: {
        id: 1411206,
        name: 'NEO - HQ',
        digits: '+441925986076',
      },
      recording: 'https://media.aircall.io/recordings/test.mp3',
    },
  };

  const endedResult = await processAircallWebhookEvent(callEndedPayload, mockDbClient);
  assert.strictEqual(endedResult.success, true);
  assert.strictEqual(endedResult.callId, 9876543);
  assert.strictEqual(endedResult.actionTaken, 'call_log_ticket_created');
  assert.strictEqual(endedResult.bookingId, 'NT-25121');
  assert.strictEqual(endedResult.companyId, 'comp-clarkes-01');

  const createdTicket = insertedTickets.find((t) => t.id === 'SR-AC-9876543');
  assert.ok(createdTicket);
  assert.strictEqual(createdTicket.status, 'Resolved');
  assert.ok(createdTicket.message.includes('Nnamdi Ohiaeri'));
  assert.ok(createdTicket.message.includes('2m 22s'));
  assert.ok(createdTicket.message.includes('https://media.aircall.io/recordings/test.mp3'));
  console.log('  ✓ call.ended correlated with booking NT-25121 and logged to tickets');

  // Test duplicate prevention
  const duplicateResult = await processAircallWebhookEvent(callEndedPayload, mockDbClient);
  assert.strictEqual(duplicateResult.success, true);
  assert.strictEqual(duplicateResult.duplicate, true);
  assert.strictEqual(duplicateResult.actionTaken, 'already_processed');
  console.log('  ✓ Duplicate webhook event safely acknowledged with duplicate: true');

  // Test call.voicemail_left event
  const voicemailPayload: AircallWebhookEvent = {
    resource: 'call',
    event: 'call.voicemail_left',
    timestamp: 1729791000,
    token: TEST_SECRET,
    data: {
      id: 9876544,
      direction: 'inbound',
      duration: 38,
      raw_digits: '07700900888',
      number: {
        id: 1411206,
        name: 'NEO - HQ',
        digits: '+441925986076',
      },
      voicemail: 'https://media.aircall.io/voicemails/customer_message.mp3',
    },
  };

  const vmResult = await processAircallWebhookEvent(voicemailPayload, mockDbClient);
  assert.strictEqual(vmResult.success, true);
  assert.strictEqual(vmResult.actionTaken, 'voicemail_ticket_created');

  const vmTicket = insertedTickets.find((t) => t.id === 'SR-AC-9876544');
  assert.ok(vmTicket);
  assert.strictEqual(vmTicket.status, 'Open');
  assert.ok(vmTicket.message.includes('customer_message.mp3'));
  console.log('  ✓ call.voicemail_left logged as high-priority Open support ticket');

  // -------------------------------------------------------------------------
  // 5. Live Aircall REST API Health Diagnostics
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Testing Live Aircall REST API Connectivity ---');

  const liveStatus = await getAircallOperationalStatus({
    apiId: '5c9eb916234f0380e301eb76d90f35a7',
    apiToken: '16111433fb4c386f1db3bda64ad24c79',
  });

  assert.strictEqual(liveStatus.connected, true);
  assert.strictEqual(liveStatus.status, 200);
  assert.strictEqual(liveStatus.company?.name, 'NEO Transport Ltd');
  assert.ok(liveStatus.numbers?.some((n) => n.digits.includes('1925 986076')));
  assert.ok(liveStatus.users?.some((u) => u.name === 'Nnamdi Ohiaeri'));

  console.log(`  ✓ Connected to Aircall Company: "${liveStatus.company?.name}"`);
  console.log(`  ✓ Provisioned Numbers: ${liveStatus.numbers?.map((n) => `${n.name} (${n.digits})`).join(', ')}`);
  console.log(`  ✓ Active Users: ${liveStatus.users?.map((u) => `${u.name} <${u.email}>`).join(', ')}`);

  console.log('\n======================================================================');
  console.log('  ALL AIRCALL TELEPHONY INTEGRATION TESTS PASSED (100%)');
  console.log('======================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test suite failed with error:', err);
  process.exit(1);
});

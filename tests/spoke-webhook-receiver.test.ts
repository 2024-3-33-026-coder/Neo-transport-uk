/**
 * SPOKE DISPATCH WEBHOOK RECEIVER TEST SUITE (PHASE 1)
 *
 * Verifies HMAC-SHA256 signature verification, raw body preservation,
 * schema conformance for the official Spoke v1 contract, duplicate-safe
 * event inbox persistence, fail-closed security guards, and migration integrity.
 */

import assert from 'assert';
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import app, {
  setServerSupabaseClientForTesting,
  getServerSupabaseClientForTesting,
  verifySpokeWebhookSignature,
  validateSpokeWebhookEvent,
  resolveWebhookDatabaseClient,
} from '../api/index.js';
import {
  SPOKE_SUPPORTED_WEBHOOK_EVENT_TYPES,
  SpokeWebhookEventType,
  SpokeWebhookPayload,
} from '../src/lib/spokeTypes.ts';
import { spokeClient } from '../api/spokeClient.ts';

function testRequest(
  server: http.Server,
  reqPath: string,
  method: string,
  headers: Record<string, string> = {},
  body?: string | Buffer
): Promise<{ status: number; data: any; rawBody: string }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as any;
    const port = address.port;

    const reqHeaders: Record<string, string> = { ...headers };
    let postBuffer: Buffer | undefined;

    if (body !== undefined) {
      postBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
      if (!reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
      reqHeaders['Content-Length'] = postBuffer.length.toString();
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: reqPath,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode || 500, data: parsed, rawBody: raw });
        });
      }
    );

    req.on('error', reject);
    if (postBuffer !== undefined) {
      req.write(postBuffer);
    }
    req.end();
  });
}

function computeHmacHex(secret: string, body: string | Buffer): string {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
  return crypto.createHmac('sha256', secret).update(buf).digest('hex');
}

async function runSpokeWebhookReceiverTests() {
  console.log('\n=== Starting Spoke Webhook Receiver Test Suite (Phase 1) ===\n');

  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecret = process.env.SPOKE_WEBHOOK_SECRET;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalSupabaseUrl = process.env.SUPABASE_URL;

  process.env.NODE_ENV = 'test';
  const TEST_SECRET = 'test_spoke_webhook_secret_key_1234567890abcdef';
  process.env.SPOKE_WEBHOOK_SECRET = TEST_SECRET;

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    // -------------------------------------------------------------------------
    // 1. Static Verification of Migration File
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing Supabase Migration Integrity ---');
    const migrationsDir = path.resolve('supabase/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));

    // Check timestamp is after previous migration
    const targetMigration = '20261019180000_spoke_webhook_events_inbox.sql';
    assert.ok(
      migrationFiles.includes(targetMigration),
      `Migration file ${targetMigration} must exist in supabase/migrations`
    );

    const sortedMigrations = [...migrationFiles].sort();
    const targetIndex = sortedMigrations.indexOf(targetMigration);
    assert.ok(
      targetIndex >= 2 && targetMigration > '20261019090000_storage_and_indexes.sql',
      'Webhook inbox migration timestamp must be later than baseline migrations'
    );

    const migrationContent = fs.readFileSync(path.join(migrationsDir, targetMigration), 'utf8');

    assert.ok(
      migrationContent.includes('CREATE TABLE IF NOT EXISTS public.spoke_webhook_events'),
      'Migration must define public.spoke_webhook_events table'
    );
    assert.ok(
      migrationContent.includes('event_hash text PRIMARY KEY'),
      'Migration must define event_hash as primary key'
    );
    assert.ok(migrationContent.includes('event_type text NOT NULL'), 'Migration must define event_type');
    assert.ok(migrationContent.includes('event_version text NOT NULL'), 'Migration must define event_version');
    assert.ok(migrationContent.includes('event_created_at timestamptz NOT NULL'), 'Migration must define event_created_at');
    assert.ok(migrationContent.includes('received_at timestamptz NOT NULL'), 'Migration must define received_at');
    assert.ok(migrationContent.includes('payload jsonb NOT NULL'), 'Migration must define payload JSONB');
    assert.ok(migrationContent.includes("processing_status text NOT NULL DEFAULT 'received'"), 'Migration must define processing_status');
    assert.ok(migrationContent.includes('processed_at timestamptz NULL'), 'Migration must define processed_at');
    assert.ok(migrationContent.includes('processing_error text NULL'), 'Migration must define processing_error');

    // Status check constraint
    assert.ok(
      migrationContent.includes("CHECK (processing_status IN ('received', 'processed', 'failed', 'ignored'))"),
      'Migration must enforce check_spoke_webhook_processing_status'
    );

    // Hash check constraint
    assert.ok(
      migrationContent.includes('CHECK (length(event_hash) = 64)'),
      'Migration must enforce 64-character hex length for event_hash'
    );

    // Indexes
    assert.ok(migrationContent.includes('idx_spoke_webhook_events_type'), 'Migration must index event_type');
    assert.ok(migrationContent.includes('idx_spoke_webhook_events_created_at'), 'Migration must index event_created_at');
    assert.ok(migrationContent.includes('idx_spoke_webhook_events_status'), 'Migration must index processing_status');

    // RLS and Least-Privilege Grants
    assert.ok(
      migrationContent.includes('ALTER TABLE public.spoke_webhook_events ENABLE ROW LEVEL SECURITY;'),
      'Migration must enable RLS on public.spoke_webhook_events'
    );
    assert.ok(
      migrationContent.includes('REVOKE ALL ON TABLE public.spoke_webhook_events FROM PUBLIC, anon, authenticated;'),
      'Migration must explicitly revoke all privileges from PUBLIC, anon, and authenticated'
    );
    assert.ok(
      migrationContent.includes('GRANT SELECT, INSERT, UPDATE ON TABLE public.spoke_webhook_events TO service_role;'),
      'Migration must grant SELECT, INSERT, UPDATE strictly to service_role'
    );
    assert.ok(
      !migrationContent.includes('CREATE POLICY') || !migrationContent.includes('FOR anon'),
      'Migration must NOT create client or anon accessible policies'
    );
    console.log('✓ PASS: Migration schema, constraints, RLS, and service_role grants statically verified');

    // -------------------------------------------------------------------------
    // 2. Unit Testing Signature Verification Logic
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Pure Signature Verification Logic ---');
    const sampleBody = JSON.stringify({
      type: 'test.send_event',
      version: 'v1',
      created: 1729350000000,
      data: { ping: true },
    });
    const sampleHmac = computeHmacHex(TEST_SECRET, sampleBody);

    // 2.1 Valid signature verification
    const validReq: any = {
      headers: { 'spoke-signature': sampleHmac },
      rawBody: Buffer.from(sampleBody, 'utf8'),
    };
    const validResult = verifySpokeWebhookSignature(validReq, { secret: TEST_SECRET });
    assert.strictEqual(validResult.valid, true);
    assert.strictEqual(validResult.status, 200);
    console.log('✓ PASS: Valid HMAC-SHA256 signature verified successfully');

    // 2.2 Signature with sha256= prefix
    const prefixedReq: any = {
      headers: { 'spoke-signature': `sha256=${sampleHmac}` },
      rawBody: Buffer.from(sampleBody, 'utf8'),
    };
    const prefixedResult = verifySpokeWebhookSignature(prefixedReq, { secret: TEST_SECRET });
    assert.strictEqual(prefixedResult.valid, true);
    assert.strictEqual(prefixedResult.status, 200);
    console.log('✓ PASS: Signature with sha256= prefix accepted and verified');

    // 2.3 Missing signature header
    const missingSigReq: any = {
      headers: {},
      rawBody: Buffer.from(sampleBody, 'utf8'),
    };
    const missingSigResult = verifySpokeWebhookSignature(missingSigReq, { secret: TEST_SECRET });
    assert.strictEqual(missingSigResult.valid, false);
    assert.strictEqual(missingSigResult.status, 401);
    assert.strictEqual(missingSigResult.error, 'Missing spoke-signature header.');
    console.log('✓ PASS: Missing spoke-signature header rejected with 401');

    // 2.4 Empty signature header
    const emptySigReq: any = {
      headers: { 'spoke-signature': '   ' },
      rawBody: Buffer.from(sampleBody, 'utf8'),
    };
    const emptySigResult = verifySpokeWebhookSignature(emptySigReq, { secret: TEST_SECRET });
    assert.strictEqual(emptySigResult.valid, false);
    assert.strictEqual(emptySigResult.status, 401);
    assert.strictEqual(emptySigResult.error, 'Missing spoke-signature header.');
    console.log('✓ PASS: Empty spoke-signature header rejected with 401');

    // 2.5 Malformed signature format (non-hex or wrong length)
    const malformedSigReq: any = {
      headers: { 'spoke-signature': 'invalid_signature_format_too_short' },
      rawBody: Buffer.from(sampleBody, 'utf8'),
    };
    const malformedSigResult = verifySpokeWebhookSignature(malformedSigReq, { secret: TEST_SECRET });
    assert.strictEqual(malformedSigResult.valid, false);
    assert.strictEqual(malformedSigResult.status, 401);
    assert.ok(malformedSigResult.error?.includes('Invalid spoke-signature format'));
    console.log('✓ PASS: Non-hex or invalid-length signature rejected with 401');

    // 2.6 Tampered signature / wrong secret
    const tamperedSigReq: any = {
      headers: { 'spoke-signature': '0'.repeat(64) },
      rawBody: Buffer.from(sampleBody, 'utf8'),
    };
    const tamperedSigResult = verifySpokeWebhookSignature(tamperedSigReq, { secret: TEST_SECRET });
    assert.strictEqual(tamperedSigResult.valid, false);
    assert.strictEqual(tamperedSigResult.status, 401);
    assert.strictEqual(tamperedSigResult.error, 'Invalid spoke-signature HMAC.');
    console.log('✓ PASS: Tampered signature rejected with 401');

    // 2.7 Tampered payload (single bit modified)
    const tamperedBody = sampleBody.replace('ping', 'pong');
    const tamperedBodyReq: any = {
      headers: { 'spoke-signature': sampleHmac },
      rawBody: Buffer.from(tamperedBody, 'utf8'),
    };
    const tamperedBodyResult = verifySpokeWebhookSignature(tamperedBodyReq, { secret: TEST_SECRET });
    assert.strictEqual(tamperedBodyResult.valid, false);
    assert.strictEqual(tamperedBodyResult.status, 401);
    console.log('✓ PASS: Payload byte tampering correctly invalidates HMAC');

    // 2.8 Fail-closed: missing SPOKE_WEBHOOK_SECRET
    const noSecretReq: any = {
      headers: { 'spoke-signature': sampleHmac },
      rawBody: Buffer.from(sampleBody, 'utf8'),
    };
    const noSecretResult = verifySpokeWebhookSignature(noSecretReq, { secret: '' });
    assert.strictEqual(noSecretResult.valid, false);
    assert.strictEqual(noSecretResult.status, 503);
    assert.strictEqual(noSecretResult.error, 'Spoke webhook secret is not configured on the server environment.');
    console.log('✓ PASS: Missing webhook secret fails closed with 503');

    // -------------------------------------------------------------------------
    // 3. Unit Testing Event Validation Logic
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Pure Webhook Event Validation Contract ---');

    // 3.1 All 8 documented event types valid
    for (const eventType of SPOKE_SUPPORTED_WEBHOOK_EVENT_TYPES) {
      const payload: SpokeWebhookPayload = {
        type: eventType,
        version: 'v1',
        created: 1729350000000,
        data: { stopId: 'stops/test_123' },
      };
      const result = validateSpokeWebhookEvent(payload);
      assert.strictEqual(result.valid, true, `Event type ${eventType} should be valid`);
      assert.strictEqual(result.event?.type, eventType);
      assert.strictEqual(result.event?.version, 'v1');
    }
    console.log(`✓ PASS: All ${SPOKE_SUPPORTED_WEBHOOK_EVENT_TYPES.length} official v1 event types validated`);

    // 3.2 Unsupported version (v0.2b from old dashboard) rejected
    const v02bResult = validateSpokeWebhookEvent({
      type: 'test.send_event',
      version: 'v0.2b',
      created: 1729350000000,
      data: {},
    });
    assert.strictEqual(v02bResult.valid, false);
    assert.ok(v02bResult.error?.includes("Unsupported webhook payload version: 'v0.2b'"));
    console.log('✓ PASS: Legacy/unsupported version v0.2b rejected with 400');

    // 3.3 Missing or non-v1 versions rejected
    assert.strictEqual(validateSpokeWebhookEvent({ type: 'test.send_event', created: 123, data: {} }).valid, false);
    assert.strictEqual(
      validateSpokeWebhookEvent({ type: 'test.send_event', version: 'v2', created: 123, data: {} }).valid,
      false
    );
    console.log('✓ PASS: Missing version and non-v1 versions strictly rejected');

    // 3.4 Unsupported event types rejected
    const unknownTypeResult = validateSpokeWebhookEvent({
      type: 'stop.deleted',
      version: 'v1',
      created: 1729350000000,
      data: {},
    });
    assert.strictEqual(unknownTypeResult.valid, false);
    assert.ok(unknownTypeResult.error?.includes("Unsupported or invalid webhook event type: 'stop.deleted'"));
    console.log('✓ PASS: Undocumented event types rejected');

    // 3.5 Invalid created timestamp rejected (0, negative, NaN, non-finite, string)
    assert.strictEqual(
      validateSpokeWebhookEvent({ type: 'test.send_event', version: 'v1', created: 0, data: {} }).valid,
      false
    );
    assert.strictEqual(
      validateSpokeWebhookEvent({ type: 'test.send_event', version: 'v1', created: -1, data: {} }).valid,
      false
    );
    assert.strictEqual(
      validateSpokeWebhookEvent({ type: 'test.send_event', version: 'v1', created: NaN, data: {} }).valid,
      false
    );
    assert.strictEqual(
      validateSpokeWebhookEvent({ type: 'test.send_event', version: 'v1', created: '1729350000000', data: {} }).valid,
      false
    );
    console.log('✓ PASS: Non-positive, non-finite, and string created timestamps rejected');

    // 3.6 Invalid data object rejected (null, array, primitive)
    assert.strictEqual(
      validateSpokeWebhookEvent({ type: 'test.send_event', version: 'v1', created: 123, data: null }).valid,
      false
    );
    assert.strictEqual(
      validateSpokeWebhookEvent({ type: 'test.send_event', version: 'v1', created: 123, data: [] }).valid,
      false
    );
    assert.strictEqual(
      validateSpokeWebhookEvent({ type: 'test.send_event', version: 'v1', created: 123, data: 'string' }).valid,
      false
    );
    console.log('✓ PASS: Non-object data payloads rejected');

    // -------------------------------------------------------------------------
    // 4. Testing Webhook Database Client Resolution (Fail Closed / No Anon)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Database Client Resolver Security Contract ---');

    // 4.1 Missing service_role key returns null even if anon key is configured
    const noServiceRoleClient = resolveWebhookDatabaseClient({
      customClient: null,
      serviceRoleKey: '',
      supabaseUrl: 'https://example.supabase.co',
    });
    assert.strictEqual(noServiceRoleClient, null, 'Must return null when serviceRoleKey is missing');
    console.log('✓ PASS: Database resolver strictly refuses to fall back to anon key and returns null');

    // 4.2 Missing database URL returns null
    const noUrlClient = resolveWebhookDatabaseClient({
      customClient: null,
      serviceRoleKey: 'mock_service_role_key',
      supabaseUrl: '',
    });
    assert.strictEqual(noUrlClient, null, 'Must return null when supabaseUrl is missing');
    console.log('✓ PASS: Database resolver returns null when database URL is missing');

    // -------------------------------------------------------------------------
    // 5. Testing HTTP Endpoint: POST /api/webhooks/spoke
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing HTTP Endpoint POST /api/webhooks/spoke ---');

    // Set up mock Supabase database store for HTTP endpoint testing
    const insertedRows: any[] = [];
    let simulateDbError: any = null;
    let simulateDuplicateKey = false;

    const mockSupabaseClient: any = {
      rpc: async (fn: string) => {
        if (fn === 'process_spoke_webhook_event') {
          return { data: { status: 'processed' }, error: null };
        }
        return { data: null, error: { message: `Unknown function ${fn}` } };
      },
      from: (tableName: string) => {
        return {
          insert: async (row: any) => {
            if (simulateDbError) {
              return { error: simulateDbError };
            }
            if (simulateDuplicateKey) {
              return {
                error: {
                  code: '23505',
                  message: 'duplicate key value violates unique constraint "spoke_webhook_events_pkey"',
                },
              };
            }
            insertedRows.push(row);
            return { error: null, data: [row] };
          },
          select: (_cols?: string) => ({
            eq: (_col: string, val: any) => ({
              single: async () => ({
                data: insertedRows.find((r) => r.event_hash === val) || {
                  event_hash: val,
                  processing_status: 'processed',
                },
                error: null,
              }),
            }),
          }),
          update: (_fields: any) => ({
            eq: async () => ({ data: null, error: null }),
          }),
        };
      },
    };

    setServerSupabaseClientForTesting(mockSupabaseClient);

    // 5.1 Endpoint returns 401 when signature header is missing
    const missingHeaderRes = await testRequest(server, '/api/webhooks/spoke', 'POST', {}, sampleBody);
    assert.strictEqual(missingHeaderRes.status, 401);
    assert.strictEqual(missingHeaderRes.data.error, 'Missing spoke-signature header.');
    console.log('✓ PASS: HTTP POST without spoke-signature returns 401');

    // 5.2 Endpoint returns 401 when signature header is malformed
    const malformedHeaderRes = await testRequest(
      server,
      '/api/webhooks/spoke',
      'POST',
      { 'spoke-signature': 'not-a-valid-hex-digest' },
      sampleBody
    );
    assert.strictEqual(malformedHeaderRes.status, 401);
    assert.ok(malformedHeaderRes.data.error?.includes('Invalid spoke-signature format'));
    console.log('✓ PASS: HTTP POST with malformed signature format returns 401');

    // 5.3 Endpoint returns 401 when signature is incorrect
    const badSignature = 'a'.repeat(64);
    const badSigRes = await testRequest(
      server,
      '/api/webhooks/spoke',
      'POST',
      { 'spoke-signature': badSignature },
      sampleBody
    );
    assert.strictEqual(badSigRes.status, 401);
    assert.strictEqual(badSigRes.data.error, 'Invalid spoke-signature HMAC.');
    console.log('✓ PASS: HTTP POST with invalid HMAC returns 401');

    // 5.4 Malformed JSON payload with valid HMAC for that malformed string returns 400
    const malformedJsonString = '{"unclosed": "brace';
    const malformedJsonHmac = computeHmacHex(TEST_SECRET, malformedJsonString);
    const malformedJsonRes = await testRequest(
      server,
      '/api/webhooks/spoke',
      'POST',
      { 'spoke-signature': malformedJsonHmac },
      malformedJsonString
    );
    assert.strictEqual(malformedJsonRes.status, 400);
    assert.ok(
      malformedJsonRes.data.error?.includes('Malformed JSON payload'),
      'Should report malformed JSON after signature verification'
    );
    console.log('✓ PASS: Malformed JSON with valid signature safely returns 400');

    // 5.5 Malformed JSON payload with INVALID HMAC returns 401 (signature checked before parse processing)
    const malformedJsonBadSigRes = await testRequest(
      server,
      '/api/webhooks/spoke',
      'POST',
      { 'spoke-signature': 'b'.repeat(64) },
      malformedJsonString
    );
    assert.strictEqual(malformedJsonBadSigRes.status, 401);
    assert.strictEqual(malformedJsonBadSigRes.data.error, 'Invalid spoke-signature HMAC.');
    console.log('✓ PASS: Malformed JSON with invalid HMAC returns 401 (verifies signature first)');

    // 5.6 Unsupported payload version returns 400
    const v02bPayload = JSON.stringify({
      type: 'test.send_event',
      version: 'v0.2b',
      created: 1729350000000,
      data: { test: true },
    });
    const v02bHmac = computeHmacHex(TEST_SECRET, v02bPayload);
    const v02bRes = await testRequest(
      server,
      '/api/webhooks/spoke',
      'POST',
      { 'spoke-signature': v02bHmac },
      v02bPayload
    );
    assert.strictEqual(v02bRes.status, 400);
    assert.ok(v02bRes.data.error?.includes("Unsupported webhook payload version: 'v0.2b'"));
    console.log('✓ PASS: HTTP POST with version v0.2b rejected with 400');

    // 5.7 Unsupported event type returns 400
    const unsupportedTypePayload = JSON.stringify({
      type: 'plan.auto_dispatched',
      version: 'v1',
      created: 1729350000000,
      data: {},
    });
    const unsupportedTypeHmac = computeHmacHex(TEST_SECRET, unsupportedTypePayload);
    const unsupportedTypeRes = await testRequest(
      server,
      '/api/webhooks/spoke',
      'POST',
      { 'spoke-signature': unsupportedTypeHmac },
      unsupportedTypePayload
    );
    assert.strictEqual(unsupportedTypeRes.status, 400);
    assert.ok(unsupportedTypeRes.data.error?.includes("Unsupported or invalid webhook event type: 'plan.auto_dispatched'"));
    console.log('✓ PASS: HTTP POST with unsupported event type rejected with 400');

    // 5.8 Invalid created timestamp returns 400
    const invalidCreatedPayload = JSON.stringify({
      type: 'test.send_event',
      version: 'v1',
      created: -500,
      data: {},
    });
    const invalidCreatedHmac = computeHmacHex(TEST_SECRET, invalidCreatedPayload);
    const invalidCreatedRes = await testRequest(
      server,
      '/api/webhooks/spoke',
      'POST',
      { 'spoke-signature': invalidCreatedHmac },
      invalidCreatedPayload
    );
    assert.strictEqual(invalidCreatedRes.status, 400);
    assert.ok(invalidCreatedRes.data.error?.includes("'created' must be a positive finite millisecond timestamp"));
    console.log('✓ PASS: HTTP POST with invalid created timestamp rejected with 400');

    // 5.9 Missing secret on server returns 503 fail-closed
    delete process.env.SPOKE_WEBHOOK_SECRET;
    const missingSecretRes = await testRequest(
      server,
      '/api/webhooks/spoke',
      'POST',
      { 'spoke-signature': sampleHmac },
      sampleBody
    );
    assert.strictEqual(missingSecretRes.status, 503);
    assert.strictEqual(missingSecretRes.data.error, 'Spoke webhook secret is not configured on the server environment.');
    process.env.SPOKE_WEBHOOK_SECRET = TEST_SECRET; // restore
    console.log('✓ PASS: HTTP POST fails closed with 503 when server secret is missing');

    // 5.10 Successful event persistence returns 200 with stored status and eventHash
    insertedRows.length = 0;
    const validTestPayload = JSON.stringify({
      type: 'stop.out_for_delivery',
      version: 'v1',
      created: 1729351234567,
      data: {
        stopId: 'plans/plan_123/stops/stop_456',
        driverId: 'drivers/drv_789',
        trackingUrl: 'https://tracking.spoke.com/track/xyz',
      },
    });
    const validTestHmac = computeHmacHex(TEST_SECRET, validTestPayload);
    const expectedHash = crypto.createHash('sha256').update(Buffer.from(validTestPayload, 'utf8')).digest('hex');

    const successRes = await testRequest(
      server,
      '/api/webhooks/spoke',
      'POST',
      { 'spoke-signature': validTestHmac },
      validTestPayload
    );

    assert.strictEqual(successRes.status, 200);
    assert.strictEqual(successRes.data.received, true);
    assert.strictEqual(successRes.data.status, 'stored');
    assert.strictEqual(successRes.data.eventHash, expectedHash);

    // Verify row persisted into mock database
    assert.strictEqual(insertedRows.length, 1);
    const persistedRow = insertedRows[0];
    assert.strictEqual(persistedRow.event_hash, expectedHash);
    assert.strictEqual(persistedRow.event_type, 'stop.out_for_delivery');
    assert.strictEqual(persistedRow.event_version, 'v1');
    assert.strictEqual(persistedRow.event_created_at, new Date(1729351234567).toISOString());
    assert.strictEqual(persistedRow.processing_status, 'received');
    assert.strictEqual(persistedRow.payload.type, 'stop.out_for_delivery');
    assert.strictEqual(persistedRow.payload.data.stopId, 'plans/plan_123/stops/stop_456');
    console.log('✓ PASS: Valid event persisted durably to inbox and returned 200 stored');

    // 5.11 Duplicate delivery idempotency: returns 200 already_stored without error
    simulateDuplicateKey = true;
    const duplicateRes = await testRequest(
      server,
      '/api/webhooks/spoke',
      'POST',
      { 'spoke-signature': validTestHmac },
      validTestPayload
    );
    simulateDuplicateKey = false;

    assert.strictEqual(duplicateRes.status, 200);
    assert.strictEqual(duplicateRes.data.received, true);
    assert.strictEqual(duplicateRes.data.status, 'already_stored');
    assert.strictEqual(duplicateRes.data.duplicate, true);
    assert.strictEqual(duplicateRes.data.eventHash, expectedHash);
    console.log('✓ PASS: Duplicate event replay safely returns 200 already_stored');

    // 5.12 Database failure returns retriable 500 error
    simulateDbError = { message: 'Database connection timeout', code: '08006' };
    const dbFailureRes = await testRequest(
      server,
      '/api/webhooks/spoke',
      'POST',
      { 'spoke-signature': validTestHmac },
      validTestPayload
    );
    simulateDbError = null;

    assert.strictEqual(dbFailureRes.status, 500);
    assert.strictEqual(dbFailureRes.data.retriable, true);
    assert.ok(dbFailureRes.data.error?.includes('Failed to persist webhook event'));
    console.log('✓ PASS: Database persistence failure returns retriable 500');

    // 5.13 Database service unconfigured returns 503 fail-closed
    setServerSupabaseClientForTesting(null);
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const dbUnavailableRes = await testRequest(
      server,
      '/api/webhooks/spoke',
      'POST',
      { 'spoke-signature': validTestHmac },
      validTestPayload
    );
    assert.strictEqual(dbUnavailableRes.status, 503);
    assert.ok(dbUnavailableRes.data.error?.includes('service-role configuration'));
    setServerSupabaseClientForTesting(mockSupabaseClient); // restore
    console.log('✓ PASS: Missing service-role database client returns 503');

    // 5.14 Route alias: /webhooks/spoke without /api prefix
    insertedRows.length = 0;
    const aliasPayload = JSON.stringify({
      type: 'test.send_event',
      version: 'v1',
      created: 1729359999999,
      data: { aliasTest: true },
    });
    const aliasHmac = computeHmacHex(TEST_SECRET, aliasPayload);
    const aliasRes = await testRequest(
      server,
      '/webhooks/spoke',
      'POST',
      { 'spoke-signature': aliasHmac },
      aliasPayload
    );
    assert.strictEqual(aliasRes.status, 200);
    assert.strictEqual(aliasRes.data.status, 'stored');
    assert.strictEqual(insertedRows.length, 1);
    console.log('✓ PASS: Route alias /webhooks/spoke handled identically to /api/webhooks/spoke');

    // 5.15 Public route accessibility: No Authorization header required
    insertedRows.length = 0;
    const unauthPayload = JSON.stringify({
      type: 'stop.tracking_link_added',
      version: 'v1',
      created: 1729358888888,
      data: { trackingUrl: 'https://spoke.com/track/123' },
    });
    const unauthHmac = computeHmacHex(TEST_SECRET, unauthPayload);
    const unauthRes = await testRequest(
      server,
      '/api/webhooks/spoke',
      'POST',
      {
        'spoke-signature': unauthHmac,
        // Notice: NO Authorization header
      },
      unauthPayload
    );
    assert.strictEqual(unauthRes.status, 200);
    assert.strictEqual(unauthRes.data.status, 'stored');
    console.log('✓ PASS: Inbound webhook requires no customer or admin Bearer token');

    // -------------------------------------------------------------------------
    // 6. Safeguards and Scope Enforcement Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Scope Boundaries & Write Guards ---');

    // Verify createPlan remains locked
    let createPlanFailedAsExpected = false;
    try {
      await spokeClient.createPlan({
        title: 'Unauthorized Plan',
        starts: { day: 1, month: 1, year: 2026 },
      });
    } catch (err: any) {
      createPlanFailedAsExpected =
        err.message.includes('RESTRICTION ENFORCED') || err.message.includes('MUTATION RESTRICTED');
    }
    assert.ok(createPlanFailedAsExpected, 'spokeClient.createPlan must remain strictly locked');
    console.log('✓ PASS: spokeClient.createPlan safeguards remain strictly locked');

    // Verify importStops remains locked
    let importStopsFailedAsExpected = false;
    try {
      await spokeClient.importStops('plans/test', []);
    } catch (err: any) {
      importStopsFailedAsExpected =
        err.message.includes('RESTRICTION ENFORCED') || err.message.includes('MUTATION RESTRICTED');
    }
    assert.ok(importStopsFailedAsExpected, 'spokeClient.importStops must remain strictly locked');
    console.log('✓ PASS: spokeClient.importStops safeguards remain strictly locked');

    console.log('\n=== ALL SPOKE WEBHOOK RECEIVER TESTS PASSED (0 failures) ===\n');
  } finally {
    setServerSupabaseClientForTesting(null);
    if (originalNodeEnv !== undefined) process.env.NODE_ENV = originalNodeEnv;
    else delete process.env.NODE_ENV;
    if (originalSecret !== undefined) process.env.SPOKE_WEBHOOK_SECRET = originalSecret;
    else delete process.env.SPOKE_WEBHOOK_SECRET;
    if (originalServiceRoleKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (originalSupabaseUrl !== undefined) process.env.SUPABASE_URL = originalSupabaseUrl;
    else delete process.env.SUPABASE_URL;

    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runSpokeWebhookReceiverTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});

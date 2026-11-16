process.env.NODE_ENV = 'test';
process.env.NEO_SPOKE_MOCK_DISPATCH_ENABLED = 'false';
/**
 * Regression Test Suite: Spoke Stop Import Payload & Safe Existing Plan Recovery
 *
 * Covers:
 * 1. Task 1: Invalid payload shape vs valid direct-array payload (reproducing & fixing HTTP 400).
 * 2. Task 1: Partial stop-import failure (handling partial imports without false success).
 * 3. Task 2: Existing-plan recovery (reusing plans/y8bgFOB9sxHNiIpOZ0Tp safely without creating duplicate plans).
 * 4. Task 3: Duplicate dispatch protection and retry blocking after uncertain outcomes.
 * 5. Task 3: Preserved payment eligibility and admin authorization gating on recovery.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import express from 'express';
import { SpokeClient } from '../api/spokeClient.ts';
import type { SpokeStopItem } from '../src/lib/spokeTypes.ts';
import app, {
  setServerSupabaseClientForTesting,
  resetPilotDispatchRegistryForTesting,
  inProgressPilotDispatchBookingIds,
} from '../api/index.ts';

function testRequest(
  server: http.Server,
  path: string,
  method: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as any;
    const port = address.port;

    const postData =
      body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined;
    const reqHeaders: Record<string, string> = { ...headers };
    if (postData !== undefined) {
      if (!reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
      reqHeaders['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let parsed: any = null;
          try {
            parsed = JSON.parse(rawData);
          } catch {
            parsed = rawData;
          }
          resolve({ status: res.statusCode || 500, data: parsed });
        });
      }
    );

    req.on('error', reject);
    if (postData !== undefined) {
      req.write(postData);
    }
    req.end();
  });
}

test('Spoke Stop Import & Safe Plan Recovery Regression Suite', async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const origFetch = globalThis.fetch;
  const recordedSpokeCalls: Array<{ url: string; method: string; body: any; rawBody: string }> = [];

  // Mock Spoke upstream server
  globalThis.fetch = async (url: any, init: any) => {
    const urlStr = String(url);
    if (urlStr.includes('api.spoke.com')) {
      const rawBody = typeof init?.body === 'string' ? init.body : '';
      let parsedBody: any = null;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = null;
      }

      recordedSpokeCalls.push({
        url: urlStr,
        method: init?.method || 'GET',
        body: parsedBody,
        rawBody,
      });

      // 1. Plan creation
      if (urlStr.endsWith('/plans') && init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'plans/new_plan_1001', name: 'plans/new_plan_1001' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 2. Existing plan query (for recovery)
      if ((urlStr.includes('/plans/y8bgFOB9sxHNiIpOZ0Tp') || urlStr.includes('/plans/simulate_partial')) && init?.method === 'GET') {
        if (urlStr.endsWith('/stops')) {
          // Zero existing stops in the target plan
          return new Response(JSON.stringify({ stops: [], nextPageToken: null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({
            id: 'plans/y8bgFOB9sxHNiIpOZ0Tp',
            title: 'NEO PILOT DISPATCH - 2026-10-23 - NT-25121',
            starts: { day: 23, month: 10, year: 2026 },
            depot: 'depots/toqi2skG2wOsvxXI9Hzf',
            writable: true,
            distributed: false,
            optimization: 'creating',
            drivers: [],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // 3. Stop Import endpoint
      if (urlStr.includes('/stops:import') && init?.method === 'POST') {
        // Reproduce production bug: If caller passes an object wrapper { stops: [...] }, reject with 400
        if (parsedBody && !Array.isArray(parsedBody) && typeof parsedBody === 'object') {
          return new Response(
            JSON.stringify({
              message: 'Invalid input: expected array, received object',
              code: 'invalid_type',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // Simulate partial failure scenario
        if (urlStr.includes('simulate_partial')) {
          return new Response(
            JSON.stringify({
              success: ['stops/stop_pickup_partial_01'],
              failed: [{ stop: 'stops/stop_delivery_fail', error: 'Geocoding failed for address' }],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // Valid direct array payload accepted
        if (Array.isArray(parsedBody)) {
          return new Response(
            JSON.stringify({
              success: ['stops/stop_pickup_rec_01', 'stops/stop_delivery_rec_02'],
              failed: [],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      }

      // 4. Stop lookup for tracking URL
      if (urlStr.includes('/stops/stop_')) {
        return new Response(
          JSON.stringify({
            id: 'stops/stop_delivery_rec_02',
            trackingLink: 'https://track.spoke.com/t/sample-track-rec-02',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return origFetch(url, init);
  };

  try {
    // Database mock collections
    const mockBookings = new Map<string, any>();
    const mockCompanies = new Map<string, any>();
    const mockStopStates = new Map<string, any>();
    const mockClaims = new Map<string, any>();
    const recordedAudits: any[] = [];

    // Seed test data for NT-25121
    mockCompanies.set('comp-clarkes-01', {
      id: 'comp-clarkes-01',
      name: 'A Clarke & Co',
      account_code: 'NEO-CLARKS',
      standby_active: true,
      verified: true,
      spoke_depot_id: 'depots/toqi2skG2wOsvxXI9Hzf',
    });

    mockBookings.set('NT-25121', {
      id: 'NT-25121',
      company_id: 'comp-clarkes-01',
      date_label: 'Today',
      pickup: 'Neo Transport Ltd, Unit D1, Taylor Business Park, Risley, Warrington, WA3 6BL',
      pickup_contact: 'Operations',
      pickup_phone: '+44 1925 123456',
      collection_window: 'ASAP — ready now',
      dropoff: 'A Clarke & Co, Unit A5, Walter Leigh Way, Moss Industrial Estate, Leigh, WN7 3PT',
      recipient_name: 'Receiving',
      recipient_phone: '+44 1942 654321',
      goods: 'Palletised parts',
      weight_kg: 650,
      items_count: 2,
      vehicle: 'Sprinter LWB',
      service: 'Direct (Dedicated)',
      distance_miles: 8.5,
      total_gbp: 150.0,
      payment_method: 'standby-account',
      status: 'Scheduled',
    });

    // Mock initial failed_unknown claim matching production state
    mockClaims.set('NT-25121', {
      id: 'claim_pilot_prod_orig_01',
      booking_id: 'NT-25121',
      status: 'failed_unknown',
      plan_id: 'plans/y8bgFOB9sxHNiIpOZ0Tp',
      failure_reason: 'Spoke pilot stop import failed with status 400: {"message":"Invalid input: expected array, received object","code":"invalid_type"}',
      plan_title: 'NEO PILOT DISPATCH - 2026-10-23 - NT-25121',
      plan_date: '2026-10-23',
      stops_count: 2,
      created_at: '2026-10-23T20:48:04.400Z',
      updated_at: '2026-10-23T20:48:04.400Z',
    });

    // Injected mock Supabase client
    const mockSupabase: any = {
      auth: {
        getUser: async (token: string) => {
          if (token === 'valid-admin-token') {
            return {
              data: {
                user: { id: 'admin-usr-99', email: 'admin@neotransport.co.uk' },
              },
              error: null,
            };
          }
          return { data: { user: null }, error: { message: 'Invalid session' } };
        },
      },
      from: (tableName: string) => {
        if (tableName === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'admin-usr-99',
                    role: 'admin',
                    status: 'active',
                    email: 'admin@neotransport.co.uk',
                    full_name: 'Lead Admin',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (tableName === 'bookings') {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                single: async () => {
                  const b = mockBookings.get(val);
                  return b
                    ? { data: { ...b }, error: null }
                    : { data: null, error: { code: 'PGRST116', message: 'Not found' } };
                },
              }),
            }),
            update: (fields: any) => ({
              eq: async (_col: string, val: string) => {
                const b = mockBookings.get(val);
                if (b) Object.assign(b, fields);
                return { data: null, error: null };
              },
            }),
          };
        }
        if (tableName === 'companies') {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                maybeSingle: async () => {
                  const c = mockCompanies.get(val);
                  return { data: c ? { ...c } : null, error: null };
                },
              }),
            }),
          };
        }
        if (tableName === 'spoke_booking_stop_state') {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                async then(resolve: any) {
                  const rows = Array.from(mockStopStates.values()).filter((s: any) => s.booking_id === val);
                  return resolve({ data: rows, error: null });
                },
              }),
            }),
            upsert: async (rows: any[]) => {
              const list = Array.isArray(rows) ? rows : [rows];
              for (const r of list) {
                mockStopStates.set(`${r.booking_id}:${r.activity}`, { ...r });
              }
              return { data: null, error: null };
            },
            update: (fields: any) => ({
              eq: (col1: string, val1: string) => ({
                eq: async (col2: string, val2: string) => {
                  for (const s of mockStopStates.values()) {
                    if (s[col1] === val1 && s[col2] === val2) {
                      Object.assign(s, fields);
                    }
                  }
                  return { data: null, error: null };
                },
              }),
            }),
          };
        }
        if (tableName === 'spoke_pilot_dispatch_claims') {
          return {
            insert: async (claim: any) => {
              if (mockClaims.has(claim.booking_id)) {
                return {
                  data: null,
                  error: {
                    code: '23505',
                    message: 'duplicate key value violates unique constraint "spoke_pilot_dispatch_claims_booking_id_key"',
                  },
                };
              }
              mockClaims.set(claim.booking_id, { ...claim });
              return { data: claim, error: null };
            },
            select: () => ({
              eq: (_col: string, val: string) => ({
                maybeSingle: async () => {
                  const found = mockClaims.get(val);
                  return { data: found ? { ...found } : null, error: null };
                },
              }),
            }),
            update: (fields: any) => ({
              eq: async (col: string, val: string) => {
                if (col === 'id') {
                  for (const c of mockClaims.values()) {
                    if (c.id === val) {
                      Object.assign(c, fields, { updated_at: new Date().toISOString() });
                      return { data: { ...c }, error: null };
                    }
                  }
                }
                if (col === 'booking_id') {
                  const found = mockClaims.get(val);
                  if (found) {
                    Object.assign(found, fields, { updated_at: new Date().toISOString() });
                    return { data: { ...found }, error: null };
                  }
                }
                return { data: null, error: null };
              },
            }),
          };
        }
        if (tableName === 'admin_audit_logs') {
          return {
            insert: async (row: any) => {
              recordedAudits.push(row);
              return { data: null, error: null };
            },
          };
        }
        return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) };
      },
    };

    setServerSupabaseClientForTesting(mockSupabase);

    // Set server environment variables
    process.env.NEO_SPOKE_PILOT_DISPATCH_ENABLED = 'true';
    const PILOT_APPROVED_TOKEN = 'pilot_secret_token_approved_test_123';
    process.env.NEO_SPOKE_PILOT_DISPATCH_APPROVED_TOKEN = PILOT_APPROVED_TOKEN;
    process.env.SPOKE_API_KEY = 'test_spoke_api_key';
    const adminHeaders = {
      Authorization: 'Bearer valid-admin-token',
    };

    // --------------------------------------------------------------------------
    // Test 1: SpokeClient Direct Array Payload Serialization & Rejection Reproduction
    // --------------------------------------------------------------------------
    console.log('\n--- 1. Testing SpokeClient Direct Array Payload Shape ---');
    const client = new SpokeClient({ apiKey: 'test_spoke_api_key' });
    const pickupStop: SpokeStopItem = {
      activity: 'pickup',
      address: { addressLineOne: 'Neo Transport Ltd', zip: 'WA3 6BL', country: 'GB' },
      orderInfo: { sellerOrderId: 'NT-25121' },
    };
    const deliveryStop: SpokeStopItem = {
      activity: 'delivery',
      address: { addressLineOne: 'A Clarke & Co', zip: 'WN7 3PT', country: 'GB' },
      orderInfo: { sellerOrderId: 'NT-25121' },
    };

    // A: Call SpokeClient and verify serialized HTTP body is a direct array
    const callsBefore = recordedSpokeCalls.length;
    const clientResult = await client.executeControlledPilotDispatch({
      plan: {
        title: 'NEO PILOT DISPATCH - 2026-10-23 - NT-25121',
        starts: { day: 23, month: 10, year: 2026 },
        depot: 'depots/toqi2skG2wOsvxXI9Hzf',
      },
      bookingId: 'NT-25121',
      stops: [pickupStop, deliveryStop],
    });

    assert.strictEqual(clientResult.success, true);
    assert.strictEqual(clientResult.stopsImported, 2);

    const importCall = recordedSpokeCalls
      .slice(callsBefore)
      .find((c) => c.url.includes('/stops:import') && c.method === 'POST');
    assert.ok(importCall, 'Stops import HTTP request must have been made');
    assert.strictEqual(
      Array.isArray(importCall.body),
      true,
      'Outbound Spoke HTTP request body MUST be a direct array [ stop1, stop2 ]'
    );
    assert.strictEqual(importCall.body.length, 2);
    assert.strictEqual(importCall.body[0].activity, 'pickup');
    assert.strictEqual(importCall.body[1].activity, 'delivery');
    console.log('✓ PASS: SpokeClient sends direct array payload [ stop1, stop2 ] for stops:import');

    // --------------------------------------------------------------------------
    // Test 2: Partial Stop-Import Failure Handling
    // --------------------------------------------------------------------------
    console.log('\n--- 2. Testing Partial Stop-Import Failure Handling ---');
    await assert.rejects(
      async () => {
        await client.executeControlledPilotDispatch({
          plan: {
            title: 'NEO PILOT DISPATCH - 2026-10-23 - NT-25121',
            starts: { day: 23, month: 10, year: 2026 },
            depot: 'depots/toqi2skG2wOsvxXI9Hzf',
          },
          bookingId: 'NT-25121',
          stops: [pickupStop, deliveryStop],
          existingPlanId: 'plans/simulate_partial',
        });
      },
      (err: any) => {
        assert.ok(err.message.includes('partial failure'));
        assert.ok(err.importedStopIds.length === 1);
        assert.ok(err.failedStops.length === 1);
        return true;
      },
      'SpokeClient must fail closed and throw when fewer than 2 stops succeed'
    );
    console.log('✓ PASS: Partial stop import correctly throws and captures failure metadata without false success');

    // --------------------------------------------------------------------------
    // Test 3: Retry Blocking on Uncertain / failed_unknown Claims
    // --------------------------------------------------------------------------
    console.log('\n--- 3. Testing Retry Blocking on Uncertain (failed_unknown) Claim ---');
    const blindRetryReq = await testRequest(
      server,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-25121',
        planDate: '2026-10-23',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        pickupCoords: { lat: 53.468, lng: -2.325 },
        dropoffCoords: { lat: 53.498, lng: -2.525 },
      }
    );

    console.log('blindRetryReq data:', blindRetryReq.status, blindRetryReq.data);
    assert.strictEqual(blindRetryReq.status, 409);
    assert.strictEqual(blindRetryReq.data.existingClaim.status, 'failed_unknown');
    assert.ok(blindRetryReq.data.error.includes('previous pilot dispatch attempt failed with an unknown/unresolved outcome'));
    assert.ok(blindRetryReq.data.error.includes('Manual admin investigation required'));
    console.log('✓ PASS: Blind automated retry blocked with 409 for failed_unknown claim');

    // --------------------------------------------------------------------------
    // Test 4: Preserved Payment & Security Authorization Guards
    // --------------------------------------------------------------------------
    console.log('\n--- 4. Testing Preserved Security & Authorization Guards on Recovery ---');
    // A: Unauthenticated request rejected
    const unauthRecoveryReq = await testRequest(
      server,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      {},
      {
        bookingId: 'NT-25121',
        planDate: '2026-10-23',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        recoverExistingPlan: true,
      }
    );
    assert.strictEqual(unauthRecoveryReq.status, 401);

    // B: Invalid pilot authorization token rejected
    const badTokenReq = await testRequest(
      server,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-25121',
        planDate: '2026-10-23',
        pilotAuthorizationToken: 'invalid_token_999',
        recoverExistingPlan: true,
      }
    );
    assert.strictEqual(badTokenReq.status, 403);

    // C: Ineligible company credit rejected
    const comp = mockCompanies.get('comp-clarkes-01');
    comp.standby_active = false;
    const ineligibleCreditReq = await testRequest(
      server,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-25121',
        planDate: '2026-10-23',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        recoverExistingPlan: true,
      }
    );
    assert.strictEqual(ineligibleCreditReq.status, 403);
    assert.ok(ineligibleCreditReq.data.error.includes('credit facility is not active or verified'));
    comp.standby_active = true; // restore

    console.log('✓ PASS: Security, pilot token, and credit gating strictly enforced on recovery');

    // --------------------------------------------------------------------------
    // Test 5: Safe Controlled Existing Plan Recovery (plans/y8bgFOB9sxHNiIpOZ0Tp)
    // --------------------------------------------------------------------------
    console.log('\n--- 5. Testing Controlled Existing Plan Recovery ---');
    const spokeCallsBeforeRecovery = recordedSpokeCalls.length;
    const recoveryReq = await testRequest(
      server,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-25121',
        planDate: '2026-10-23',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        pickupCoords: { lat: 53.468, lng: -2.325 },
        dropoffCoords: { lat: 53.498, lng: -2.525 },
        recoverExistingPlan: true,
      }
    );

    console.log('recoveryReq data:', recoveryReq.status, recoveryReq.data);
    assert.strictEqual(recoveryReq.status, 200);
    assert.strictEqual(recoveryReq.data.success, true);
    assert.strictEqual(recoveryReq.data.isRecovery, true);
    assert.strictEqual(recoveryReq.data.planId, 'plans/y8bgFOB9sxHNiIpOZ0Tp');
    assert.strictEqual(recoveryReq.data.status, 'In transit');
    assert.ok(recoveryReq.data.deliveryTrackingUrl.includes('track.spoke.com'));

    // Verify Spoke calls: Zero plan creation calls made during recovery!
    const recoverySpokeCalls = recordedSpokeCalls.slice(spokeCallsBeforeRecovery);
    const newPlanCalls = recoverySpokeCalls.filter((c) => c.url.endsWith('/plans') && c.method === 'POST');
    assert.strictEqual(newPlanCalls.length, 0, 'Controlled recovery MUST NOT create a new Spoke plan');

    const stopsImportCall = recoverySpokeCalls.find(
      (c) => c.url.includes('/plans/y8bgFOB9sxHNiIpOZ0Tp/stops:import') && c.method === 'POST'
    );
    assert.ok(stopsImportCall, 'Stops must be imported into the existing plan');
    assert.strictEqual(Array.isArray(stopsImportCall.body), true, 'Payload must be direct array');

    // Verify Database state after recovery
    const updatedClaim = mockClaims.get('NT-25121');
    assert.strictEqual(updatedClaim.status, 'succeeded');
    assert.strictEqual(updatedClaim.plan_id, 'plans/y8bgFOB9sxHNiIpOZ0Tp');

    const updatedBooking = mockBookings.get('NT-25121');
    assert.strictEqual(updatedBooking.status, 'In transit');
    assert.strictEqual(updatedBooking.delivery_tracking_url, 'https://track.spoke.com/t/sample-track-rec-02');

    const pickupState = mockStopStates.get('NT-25121:pickup');
    const deliveryState = mockStopStates.get('NT-25121:delivery');
    assert.strictEqual(pickupState.delivery_state, 'dispatched');
    assert.strictEqual(deliveryState.delivery_state, 'dispatched');

    // Verify audit log
    const recoveryAudit = recordedAudits.find(
      (a) => a.action === 'SPOKE_PILOT_DISPATCH_RECOVERY' && a.target_id === 'NT-25121'
    );
    assert.ok(recoveryAudit, 'Audit log MUST record SPOKE_PILOT_DISPATCH_RECOVERY');
    assert.strictEqual(recoveryAudit.details.planId, 'plans/y8bgFOB9sxHNiIpOZ0Tp');
    assert.strictEqual(recoveryAudit.details.isRecovery, true);

    console.log('✓ PASS: Controlled recovery safely reuses plans/y8bgFOB9sxHNiIpOZ0Tp, updates claim, booking, stops, and audit');

    // --------------------------------------------------------------------------
    // Test 6: Duplicate Dispatch Protection Post-Recovery
    // --------------------------------------------------------------------------
    console.log('\n--- 6. Testing Duplicate Dispatch Protection Post-Recovery ---');
    const postRecoveryDuplicateReq = await testRequest(
      server,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-25121',
        planDate: '2026-10-23',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        recoverExistingPlan: true,
      }
    );
    assert.strictEqual(postRecoveryDuplicateReq.status, 409);
    assert.ok(
      postRecoveryDuplicateReq.data.error.includes('must be \'Scheduled\'') ||
      postRecoveryDuplicateReq.data.error.includes('already succeeded')
    );
    console.log('✓ PASS: Post-recovery duplicate dispatch is strictly blocked');

    // --------------------------------------------------------------------------
    // Test 7: Date Mismatch Protection on Existing Plan Recovery
    // --------------------------------------------------------------------------
    console.log('\n--- 7. Testing Date Mismatch Protection on Existing Plan Recovery ---');
    mockBookings.set('NT-25122', {
      id: 'NT-25122',
      company_id: 'comp-clarkes-01',
      date_label: 'Today',
      pickup: 'Neo Transport Ltd, Unit D1, Taylor Business Park, Risley, Warrington, WA3 6BL',
      pickup_contact: 'Operations',
      pickup_phone: '+44 1925 123456',
      collection_window: 'ASAP — ready now',
      dropoff: 'A Clarke & Co, Unit A5, Walter Leigh Way, Moss Industrial Estate, Leigh, WN7 3PT',
      recipient_name: 'Receiving',
      recipient_phone: '+44 1942 654321',
      goods: 'Palletised parts',
      weight_kg: 500,
      items_count: 1,
      vehicle: 'Sprinter LWB',
      service: 'Direct (Dedicated)',
      total_gbp: 150.0,
      payment_method: 'standby-account',
      status: 'Scheduled',
    });

    mockClaims.set('NT-25122', {
      id: 'claim_pilot_mismatch_01',
      booking_id: 'NT-25122',
      status: 'failed_unknown',
      plan_id: 'plans/y8bgFOB9sxHNiIpOZ0Tp', // Dated 2026-10-23
      plan_title: 'NEO PILOT DISPATCH - 2026-10-23 - NT-25121',
      plan_date: '2026-10-23',
      stops_count: 2,
      created_at: '2026-10-23T20:48:04.400Z',
      updated_at: '2026-10-23T20:48:04.400Z',
    });

    // Attempting recovery of the 2026-10-23 plan for 2026-10-24 MUST fail closed
    const dateMismatchRecoveryReq = await testRequest(
      server,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-25122',
        planDate: '2026-10-24', // Attempting next-day recovery
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        recoverExistingPlan: true,
      }
    );

    console.log('dateMismatchRecoveryReq status:', dateMismatchRecoveryReq.status, dateMismatchRecoveryReq.data?.error);
    assert.strictEqual(dateMismatchRecoveryReq.status, 409);
    assert.ok(
      dateMismatchRecoveryReq.data.error.includes('Date mismatch') ||
      dateMismatchRecoveryReq.data.error.includes('does not match required dispatch date')
    );
    assert.ok(
      dateMismatchRecoveryReq.data.error.includes('Attaching stops to a plan from a different day is prohibited') ||
      dateMismatchRecoveryReq.data.error.includes('different operational day is prohibited')
    );
    console.log('✓ PASS: Date mismatch strictly rejects attaching stops to yesterday\'s plan');

    // --------------------------------------------------------------------------
    // Test 8: Stale-Claim Resolution via Dedicated Endpoint
    // --------------------------------------------------------------------------
    console.log('\n--- 8. Testing Stale-Claim Resolution Workflow ---');
    // A: Unauthenticated request rejected
    const unauthResolveReq = await testRequest(
      server,
      '/api/admin/dispatch/spoke/resolve-stale-claim',
      'POST',
      {},
      {
        bookingId: 'NT-25122',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
      }
    );
    assert.strictEqual(unauthResolveReq.status, 401);

    // B: Invalid token rejected
    const badTokenResolveReq = await testRequest(
      server,
      '/api/admin/dispatch/spoke/resolve-stale-claim',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-25122',
        pilotAuthorizationToken: 'invalid_token_xyz',
      }
    );
    assert.strictEqual(badTokenResolveReq.status, 403);

    // C: Authenticated admin safely resolves the stale claim
    const resolveReq = await testRequest(
      server,
      '/api/admin/dispatch/spoke/resolve-stale-claim',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-25122',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        reason: 'Confirmed old plan plans/y8bgFOB9sxHNiIpOZ0Tp has 0 stops; superseding for 2026-10-24 same-day dispatch.',
      }
    );

    console.log('resolveReq status:', resolveReq.status, resolveReq.data);
    assert.strictEqual(resolveReq.status, 200);
    assert.strictEqual(resolveReq.data.success, true);
    assert.strictEqual(resolveReq.data.status, 'cleaned_up');

    // Verify claim in database is now 'cleaned_up' without being deleted
    const resolvedClaim = mockClaims.get('NT-25122');
    assert.strictEqual(resolvedClaim.status, 'cleaned_up');
    assert.ok(resolvedClaim.failure_reason.includes('Cleaned up by'));

    // Verify audit log
    const cleanupAudit = recordedAudits.find(
      (a) => a.action === 'SPOKE_PILOT_CLAIM_CLEANED_UP' && a.target_id === 'NT-25122'
    );
    assert.ok(cleanupAudit, 'Audit log MUST record SPOKE_PILOT_CLAIM_CLEANED_UP');
    assert.strictEqual(cleanupAudit.details.orphaned_plan_id, 'plans/y8bgFOB9sxHNiIpOZ0Tp');
    console.log('✓ PASS: Stale claim safely resolved and archived to cleaned_up with audit trail');

    // --------------------------------------------------------------------------
    // Test 9: Fresh Same-Day Dispatch for 2026-10-24 Post-Resolution
    // --------------------------------------------------------------------------
    console.log('\n--- 9. Testing Fresh Same-Day Dispatch Post-Resolution ---');
    const freshSameDayReq = await testRequest(
      server,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-25122',
        planDate: '2026-10-24',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        pickupCoords: { lat: 53.468, lng: -2.325 },
        dropoffCoords: { lat: 53.498, lng: -2.525 },
      }
    );

    console.log('freshSameDayReq status:', freshSameDayReq.status, freshSameDayReq.data?.planId);
    assert.strictEqual(freshSameDayReq.status, 200);
    assert.strictEqual(freshSameDayReq.data.success, true);
    assert.strictEqual(freshSameDayReq.data.isRecovery, false);
    assert.notStrictEqual(freshSameDayReq.data.planId, 'plans/y8bgFOB9sxHNiIpOZ0Tp', 'Must create a fresh plan, not reuse yesterday\'s');
    assert.strictEqual(freshSameDayReq.data.status, 'In transit');

    // Verify Database state post fresh dispatch
    const updatedFreshClaim = mockClaims.get('NT-25122');
    assert.strictEqual(updatedFreshClaim.status, 'succeeded');
    assert.strictEqual(updatedFreshClaim.plan_date, '2026-10-24');

    const updatedFreshBooking = mockBookings.get('NT-25122');
    assert.strictEqual(updatedFreshBooking.status, 'In transit');
    console.log('✓ PASS: Clean same-day dispatch creates fresh 2026-10-24 plan after claim cleanup');

    // --------------------------------------------------------------------------
    // Test 10: Atomic Inline Supersede & Dispatch for 2026-10-24
    // --------------------------------------------------------------------------
    console.log('\n--- 10. Testing Atomic Inline Supersede & Dispatch ---');
    mockBookings.set('NT-25123', {
      id: 'NT-25123',
      company_id: 'comp-clarkes-01',
      date_label: 'Today',
      pickup: 'Neo Transport Ltd, Unit D1, Taylor Business Park, Risley, Warrington, WA3 6BL',
      pickup_contact: 'Operations',
      pickup_phone: '+44 1925 123456',
      collection_window: 'ASAP — ready now',
      dropoff: 'A Clarke & Co, Unit A5, Walter Leigh Way, Moss Industrial Estate, Leigh, WN7 3PT',
      recipient_name: 'Receiving',
      recipient_phone: '+44 1942 654321',
      goods: 'Palletised parts',
      weight_kg: 650,
      items_count: 2,
      vehicle: 'Sprinter LWB',
      service: 'Direct (Dedicated)',
      total_gbp: 150.0,
      payment_method: 'standby-account',
      status: 'Scheduled',
    });

    mockClaims.set('NT-25123', {
      id: 'claim_pilot_inline_01',
      booking_id: 'NT-25123',
      status: 'failed_unknown',
      plan_id: 'plans/y8bgFOB9sxHNiIpOZ0Tp',
      plan_date: '2026-10-23',
      stops_count: 2,
      created_at: '2026-10-23T20:48:04.400Z',
      updated_at: '2026-10-23T20:48:04.400Z',
    });

    const inlineSupersedeReq = await testRequest(
      server,
      '/api/admin/dispatch/spoke/pilot',
      'POST',
      adminHeaders,
      {
        bookingId: 'NT-25123',
        planDate: '2026-10-24',
        pilotAuthorizationToken: PILOT_APPROVED_TOKEN,
        supersedeStaleClaim: true,
        staleResolutionReason: 'Admin verified old plan empty; atomically superseding for same-day dispatch.',
      }
    );

    console.log('inlineSupersedeReq data:', inlineSupersedeReq.status, inlineSupersedeReq.data);
    assert.strictEqual(inlineSupersedeReq.status, 200);
    assert.strictEqual(inlineSupersedeReq.data.success, true);
    assert.strictEqual(inlineSupersedeReq.data.isRecovery, false);
    assert.notStrictEqual(inlineSupersedeReq.data.planId, 'plans/y8bgFOB9sxHNiIpOZ0Tp');

    const inlineClaim = mockClaims.get('NT-25123');
    assert.strictEqual(inlineClaim.status, 'succeeded');
    assert.strictEqual(inlineClaim.plan_date, '2026-10-24');

    const supersededAudit = recordedAudits.find(
      (a) => a.action === 'SPOKE_PILOT_CLAIM_SUPERSEDED' && a.target_id === 'NT-25123'
    );
    assert.ok(supersededAudit, 'Must record SPOKE_PILOT_CLAIM_SUPERSEDED audit log');
    console.log('✓ PASS: Atomic inline supersede & dispatch successfully executes for 2026-10-24');
  } finally {
    globalThis.fetch = origFetch;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    resetPilotDispatchRegistryForTesting();
  }
});

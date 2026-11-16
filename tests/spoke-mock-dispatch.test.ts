/**
 * TEST SUITE: SPOKE SAFE MOCK DISPATCH ENVIRONMENT
 *
 * Verifies the mock Spoke dispatch adapter (MockSpokeAdapter), its production isolation guards,
 * synthetic identifier formatting, zero external network requests, end-to-end HTTP dispatch workflow,
 * payment & booking status validation, concurrency protection, and failure simulation resilience.
 */

import assert from 'assert';
import http from 'http';
import { app, setServerSupabaseClientForTesting } from '../api/index';
import { SpokeClient, spokeClient, getActiveSpokeClient } from '../api/spokeClient';
import {
  MockSpokeAdapter,
  mockSpokeAdapter,
  isMockSpokeEnabled,
  isMockSpokeRequested,
  isMockSpokePermittedEnvironment,
  assertMockSpokeConfigurationSafe,
} from '../api/mockSpokeAdapter';
import type { ISpokeClient } from '../api/spokeClient';

// Helper to make test HTTP requests to express app
async function testRequest(
  server: http.Server,
  path: string,
  method: string = 'GET',
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> {
  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('Server address not available');
  }
  const port = addr.port;

  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : undefined;
    const reqHeaders: Record<string, string> = { ...headers };
    if (postData) {
      reqHeaders['Content-Type'] = 'application/json';
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
          let parsedData: any = rawData;
          try {
            parsedData = JSON.parse(rawData);
          } catch {
            // keep as text
          }
          resolve({ status: res.statusCode || 0, data: parsedData, headers: res.headers });
        });
      }
    );

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// In-memory mock Supabase DB client for hermetic test execution
function createHermeticDatabaseClient(initialData?: {
  bookings?: Map<string, any>;
  companies?: Map<string, any>;
  profiles?: Map<string, any>;
}) {
  const bookings = initialData?.bookings || new Map<string, any>();
  const companies = initialData?.companies || new Map<string, any>();
  const profiles = initialData?.profiles || new Map<string, any>();
  const claims = new Map<string, any>();
  const stopStates = new Map<string, any>();
  const auditLogs: any[] = [];

  const mockClient: any = {
    auth: {
      getUser: async (token: string) => {
        if (!token || token.includes('invalid') || token.includes('expired')) {
          return { data: { user: null }, error: { message: 'Invalid or expired session token.' } };
        }
        if (token.includes('customer')) {
          return { data: { user: { id: 'usr-customer-01', email: 'customer@example.com' } }, error: null };
        }
        return { data: { user: { id: 'usr-admin-01', email: 'admin@neotransport.co.uk' } }, error: null };
      },
    },
    from: (table: string) => {
      let selectedCols = '*';
      let filters: Array<{ col: string; op: string; val: any }> = [];
      let updatePayload: any = null;
      let insertPayload: any = null;

      const queryBuilder: any = {
        select: (cols: string = '*') => {
          selectedCols = cols;
          return queryBuilder;
        },
        eq: (col: string, val: any) => {
          filters.push({ col, op: 'eq', val });
          return queryBuilder;
        },
        in: (col: string, vals: any[]) => {
          filters.push({ col, op: 'in', val: vals });
          return queryBuilder;
        },
        single: async () => {
          if (table === 'profiles') {
            const uid = filters.find((f) => f.col === 'id')?.val;
            const prof = profiles.get(uid);
            if (!prof) return { data: null, error: { code: 'PGRST116', message: 'Row not found' } };
            return { data: prof, error: null };
          }
          if (table === 'bookings') {
            const bid = filters.find((f) => f.col === 'id')?.val;
            const b = bookings.get(bid);
            if (!b) return { data: null, error: { code: 'PGRST116', message: 'Booking not found' } };
            return { data: b, error: null };
          }
          if (table === 'companies') {
            const cid = filters.find((f) => f.col === 'id')?.val;
            const c = companies.get(cid);
            if (!c) return { data: null, error: { code: 'PGRST116', message: 'Company not found' } };
            return { data: c, error: null };
          }
          if (table === 'spoke_pilot_dispatch_claims') {
            const bid = filters.find((f) => f.col === 'booking_id')?.val;
            const claim = Array.from(claims.values()).find((c: any) => c.booking_id === bid);
            if (!claim) return { data: null, error: { code: 'PGRST116', message: 'Claim not found' } };
            return { data: claim, error: null };
          }
          return { data: null, error: { code: 'PGRST116', message: 'Not found' } };
        },
        maybeSingle: async () => {
          if (table === 'spoke_pilot_dispatch_claims') {
            const bid = filters.find((f) => f.col === 'booking_id')?.val;
            const claim = Array.from(claims.values()).find((c: any) => c.booking_id === bid);
            return { data: claim || null, error: null };
          }
          if (table === 'companies') {
            const cid = filters.find((f) => f.col === 'id')?.val;
            const c = companies.get(cid);
            return { data: c || null, error: null };
          }
          if (table === 'bookings') {
            const bid = filters.find((f) => f.col === 'id')?.val;
            const b = bookings.get(bid);
            return { data: b || null, error: null };
          }
          return { data: null, error: null };
        },
        insert: (payload: any) => {
          insertPayload = payload;
          return {
            select: () => ({
              single: async () => {
                if (table === 'spoke_pilot_dispatch_claims') {
                  const existing = Array.from(claims.values()).find(
                    (c: any) => c.booking_id === payload.booking_id
                  );
                  if (existing) {
                    return {
                      data: null,
                      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
                    };
                  }
                  const id = `claim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                  const record = { id, ...payload };
                  claims.set(id, record);
                  return { data: record, error: null };
                }
                if (table === 'admin_audit_logs') {
                  const id = `audit-${Date.now()}`;
                  const record = { id, ...payload };
                  auditLogs.push(record);
                  return { data: record, error: null };
                }
                return { data: payload, error: null };
              },
            }),
            then: async (resolve: any) => {
              if (table === 'spoke_pilot_dispatch_claims') {
                const existing = Array.from(claims.values()).find(
                  (c: any) => c.booking_id === payload.booking_id
                );
                if (existing) {
                  return resolve({
                    data: null,
                    error: { code: '23505', message: 'duplicate key value violates unique constraint' },
                  });
                }
                const id = payload.id || `claim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                const record = { ...payload, id };
                claims.set(id, record);
                return resolve({ data: record, error: null });
              }
              if (table === 'admin_audit_logs') {
                auditLogs.push(payload);
                return resolve({ data: payload, error: null });
              }
              if (table === 'spoke_booking_stop_state') {
                const records = Array.isArray(payload) ? payload : [payload];
                records.forEach((r: any) => stopStates.set(`${r.booking_id}-${r.activity}`, r));
                return resolve({ data: payload, error: null });
              }
              return resolve({ data: payload, error: null });
            },
          };
        },
        upsert: (payload: any) => {
          const records = Array.isArray(payload) ? payload : [payload];
          records.forEach((r: any) => stopStates.set(`${r.booking_id}-${r.activity}`, r));
          return Promise.resolve({ data: payload, error: null });
        },
        update: (payload: any) => {
          updatePayload = payload;
          return {
            eq: (col: string, val: any) => {
              filters.push({ col, op: 'eq', val });
              return {
                then: async (resolve: any) => {
                  if (table === 'bookings') {
                    const bid = filters.find((f) => f.col === 'id')?.val;
                    const b = bookings.get(bid);
                    if (b) {
                      Object.assign(b, updatePayload);
                    }
                    return resolve({ data: b, error: null });
                  }
                  if (table === 'spoke_pilot_dispatch_claims') {
                    const cid = filters.find((f) => f.col === 'id')?.val;
                    const c = claims.get(cid);
                    if (c) {
                      Object.assign(c, updatePayload);
                    }
                    return resolve({ data: c, error: null });
                  }
                  return resolve({ data: null, error: null });
                },
              };
            },
          };
        },
      };

      return queryBuilder;
    },
    // Test inspection accessors
    _bookings: bookings,
    _companies: companies,
    _profiles: profiles,
    _claims: claims,
    _stopStates: stopStates,
    _auditLogs: auditLogs,
  };

  return mockClient;
}

async function runMockDispatchTests() {
  console.log('=================================================================');
  console.log('STARTING SPOKE SAFE MOCK DISPATCH TEST SUITE');
  console.log('=================================================================\n');

  // Preserve initial environment
  const initialEnv = { ...process.env };
  process.env.NODE_ENV = 'test';

  try {
    // ---------------------------------------------------------------------------
    // SECTION 1: Mock Adapter Interface & Production Guard Safety
    // ---------------------------------------------------------------------------
    console.log('--- 1. Mock Adapter Interface & Production Guard Safety ---');

    // 1.1 Conforms to ISpokeClient interface
    const mock = new MockSpokeAdapter();
    assert.strictEqual(typeof mock.checkConnectivity, 'function', 'checkConnectivity must be a function');
    assert.strictEqual(typeof mock.listPlans, 'function', 'listPlans must be a function');
    assert.strictEqual(typeof mock.getPlan, 'function', 'getPlan must be a function');
    assert.strictEqual(typeof mock.createPlan, 'function', 'createPlan must be a function');
    assert.strictEqual(typeof mock.importStops, 'function', 'importStops must be a function');
    assert.strictEqual(typeof mock.executeControlledSmokeTest, 'function', 'executeControlledSmokeTest must be a function');
    assert.strictEqual(typeof mock.executeControlledPilotDispatch, 'function', 'executeControlledPilotDispatch must be a function');
    assert.strictEqual(typeof mock.deleteOrCancelTestPlan, 'function', 'deleteOrCancelTestPlan must be a function');
    assert.strictEqual(mock.isMock, true, 'isMock must be true');
    console.log('✓ PASS 1.1: MockSpokeAdapter implements identical ISpokeClient contract');

    // 1.2 isMockSpokeEnabled returns false in production
    process.env.NODE_ENV = 'production';
    process.env.NEO_SPOKE_MOCK_DISPATCH_ENABLED = 'true';
    assert.strictEqual(isMockSpokeEnabled(), false, 'Must fail closed when NODE_ENV=production');
    console.log('✓ PASS 1.2: isMockSpokeEnabled() returns false when NODE_ENV=production');

    // 1.3 isMockSpokeEnabled returns false when VERCEL_ENV=production or VERCEL=1
    process.env.NODE_ENV = 'test';
    process.env.VERCEL_ENV = 'production';
    assert.strictEqual(isMockSpokeEnabled(), false, 'Must fail closed when VERCEL_ENV=production');
    delete process.env.VERCEL_ENV;
    process.env.VERCEL = '1';
    assert.strictEqual(isMockSpokeEnabled(), false, 'Must fail closed when VERCEL=1 in production');
    delete process.env.VERCEL;
    console.log('✓ PASS 1.3: isMockSpokeEnabled() returns false when VERCEL_ENV=production or VERCEL=1');

    // 1.4 isMockSpokeEnabled returns false when flag is missing or false
    process.env.NODE_ENV = 'test';
    delete process.env.NEO_SPOKE_MOCK_DISPATCH_ENABLED;
    assert.strictEqual(isMockSpokeEnabled(), false, 'Must fail closed when flag is unset');
    process.env.NEO_SPOKE_MOCK_DISPATCH_ENABLED = 'false';
    assert.strictEqual(isMockSpokeEnabled(), false, 'Must fail closed when flag is false');
    console.log('✓ PASS 1.4: isMockSpokeEnabled() returns false when NEO_SPOKE_MOCK_DISPATCH_ENABLED is missing or false');

    // 1.5 isMockSpokeEnabled returns true only when explicitly configured in non-production
    process.env.NODE_ENV = 'test';
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL;
    process.env.NEO_SPOKE_MOCK_DISPATCH_ENABLED = 'true';
    assert.strictEqual(isMockSpokeEnabled(), true, 'Must return true when enabled in test/local mode');
    assert.strictEqual(isMockSpokeRequested(), true, 'isMockSpokeRequested must be true');
    assert.strictEqual(isMockSpokePermittedEnvironment(), true, 'isMockSpokePermittedEnvironment must be true');
    console.log('✓ PASS 1.5: isMockSpokeEnabled() returns true when explicitly enabled in non-production');

    // 1.6 Mock enabled in an authorized local test environment: resolves MockSpokeAdapter
    process.env.NODE_ENV = 'test';
    process.env.NEO_SPOKE_MOCK_DISPATCH_ENABLED = 'true';
    const activeWhenEnabled = getActiveSpokeClient();
    assert.strictEqual(activeWhenEnabled.isMock, true, 'Must return MockSpokeAdapter when enabled');
    console.log('✓ PASS 1.6: Mock enabled in an authorized local test environment resolves to MockSpokeAdapter');

    // 1.7 Mock not requested when normal live client is selected: resolves spokeClient
    delete process.env.NEO_SPOKE_MOCK_DISPATCH_ENABLED;
    const activeWhenDisabled = getActiveSpokeClient();
    assert.strictEqual(activeWhenDisabled.isMock, undefined, 'Must return real SpokeClient when mock is not requested');
    console.log('✓ PASS 1.7: Mock not requested accurately preserves normal live client selection');

    // 1.8 Mock explicitly enabled in prohibited production environment: fails closed with configuration error
    process.env.NODE_ENV = 'production';
    process.env.NEO_SPOKE_MOCK_DISPATCH_ENABLED = 'true';
    assert.strictEqual(isMockSpokeRequested(), true, 'isMockSpokeRequested must be true');
    assert.strictEqual(isMockSpokePermittedEnvironment(), false, 'isMockSpokePermittedEnvironment must be false');
    assert.throws(
      () => assertMockSpokeConfigurationSafe(),
      /SECURITY CONFIGURATION ERROR/,
      'assertMockSpokeConfigurationSafe must throw when mock is requested in production'
    );
    assert.throws(
      () => getActiveSpokeClient(),
      /SECURITY CONFIGURATION ERROR/,
      'getActiveSpokeClient must fail closed and throw when mock is requested in production'
    );
    console.log('✓ PASS 1.8: Mock explicitly enabled in prohibited production environment strictly fails closed');

    // 1.9 No live-client fallback during rejected mock configuration
    try {
      const client = getActiveSpokeClient();
      assert.fail('Must never return a client, but received a value');
    } catch (err: any) {
      assert.ok(
        err.message.includes('SECURITY CONFIGURATION ERROR'),
        'Must reject with SECURITY CONFIGURATION ERROR, never falling back to live SpokeClient'
      );
    }
    // Restore safe test environment
    process.env.NODE_ENV = 'test';
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL;
    process.env.NEO_SPOKE_MOCK_DISPATCH_ENABLED = 'true';
    console.log('✓ PASS 1.9: Strictly verified zero live-client fallback during a rejected mock configuration');

    // ---------------------------------------------------------------------------
    // SECTION 2: Zero External Network Writes Verification
    // ---------------------------------------------------------------------------
    console.log('\n--- 2. Zero External Network Writes Verification ---');

    // Spy on global fetch to guarantee zero calls to Spoke API
    let externalSpokeHttpCalls = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (input: any, init?: any) => {
      const url = String(input?.url || input || '');
      if (url.includes('spoke.com') || url.includes('spokeroute')) {
        externalSpokeHttpCalls++;
        throw new Error(`SECURITY VIOLATION: External network call to ${url} was attempted in mock mode!`);
      }
      return origFetch(input, init);
    };

    const isolatedMock = new MockSpokeAdapter();

    // 2.1 checkConnectivity
    const connRes = await isolatedMock.checkConnectivity();
    assert.strictEqual(connRes.connected, true);
    assert.strictEqual(connRes.isMock, true);
    assert.strictEqual(connRes.status, 200);
    assert.strictEqual(externalSpokeHttpCalls, 0, 'Zero network calls for checkConnectivity');
    console.log('✓ PASS 2.1: checkConnectivity() succeeds with zero network calls');

    // 2.2 executeControlledSmokeTest
    const smokeRes = await isolatedMock.executeControlledSmokeTest({
      plan: { title: 'NEO API TEST - Hermetic Simulation', starts: { day: 21, month: 10, year: 2026 } },
      stops: [
        { activity: 'pickup', address: { addressLineOne: '1 Test St', zip: 'M1 1AA', latitude: 53.48, longitude: -2.24 } },
        { activity: 'delivery', address: { addressLineOne: '2 Test Rd', zip: 'B1 1AA', latitude: 52.48, longitude: -1.89 } },
      ],
      idempotencyToken: 'token-test-101',
    });
    assert.strictEqual(smokeRes.success, true);
    assert.strictEqual(externalSpokeHttpCalls, 0, 'Zero network calls for executeControlledSmokeTest');
    console.log('✓ PASS 2.2: executeControlledSmokeTest() executes with zero network calls');

    // 2.3 executeControlledPilotDispatch
    const pilotRes = await isolatedMock.executeControlledPilotDispatch({
      plan: { title: 'NEO PILOT DISPATCH - 2026-10-21 - NT-TEST-001', starts: { day: 21, month: 10, year: 2026 } },
      bookingId: 'NT-TEST-001',
      stops: [
        { activity: 'pickup', address: { addressLineOne: '1 Test St', zip: 'M1 1AA', latitude: 53.48, longitude: -2.24 }, orderInfo: { sellerOrderId: 'NT-TEST-001' } },
        { activity: 'delivery', address: { addressLineOne: '2 Test Rd', zip: 'B1 1AA', latitude: 52.48, longitude: -1.89 }, orderInfo: { sellerOrderId: 'NT-TEST-001' } },
      ],
    });
    assert.strictEqual(pilotRes.success, true);
    assert.strictEqual(externalSpokeHttpCalls, 0, 'Zero network calls for executeControlledPilotDispatch');
    console.log('✓ PASS 2.3: executeControlledPilotDispatch() executes with zero network calls');

    // 2.4 Internal networkCallCount tracking
    assert.strictEqual(isolatedMock.getNetworkCallCount(), 0, 'Internal network call counter must be 0');
    console.log('✓ PASS 2.4: getNetworkCallCount() confirms strictly 0 external network requests');

    // ---------------------------------------------------------------------------
    // SECTION 3: Synthetic Identifier Discrimination & Anti-Confusion Guards
    // ---------------------------------------------------------------------------
    console.log('\n--- 3. Synthetic Identifier Discrimination & Anti-Confusion Guards ---');

    // 3.1 Plan ID format
    assert.ok(pilotRes.planId.startsWith('plans/mock-sim-pilot-NT-TEST-001-'), 'Plan ID must have unmistakable mock-sim prefix');
    console.log(`✓ PASS 3.1: Plan ID carries unmistakable synthetic prefix: '${pilotRes.planId}'`);

    // 3.2 Stop IDs format
    assert.strictEqual(pilotRes.stopIds?.[0], 'stops/mock-sim-pickup-NT-TEST-001');
    assert.strictEqual(pilotRes.stopIds?.[1], 'stops/mock-sim-delivery-NT-TEST-001');
    console.log('✓ PASS 3.2: Stop IDs carry unmistakable synthetic prefixes');

    // 3.3 Message clearly denotes mock simulation
    assert.ok(pilotRes.message.includes('MOCK SIMULATION'), 'Message must denote mock simulation');
    assert.ok(pilotRes.message.includes('ZERO external network writes executed'), 'Message must denote zero writes');
    console.log('✓ PASS 3.3: Result message prominently communicates mock simulation and zero writes');

    // 3.4 Driver assignment protection: real driver without approval rejected
    await assert.rejects(
      async () => {
        await isolatedMock.executeControlledPilotDispatch({
          plan: { title: 'NEO PILOT DISPATCH - 2026-10-21', starts: { day: 21, month: 10, year: 2026 } },
          bookingId: 'NT-TEST-001',
          stops: [
            { activity: 'pickup', address: { addressLineOne: '1 Test St', zip: 'M1 1AA' }, orderInfo: { sellerOrderId: 'NT-TEST-001' } },
            { activity: 'delivery', address: { addressLineOne: '2 Test Rd', zip: 'B1 1AA' }, orderInfo: { sellerOrderId: 'NT-TEST-001' } },
          ],
          approvedPilotDriverId: 'drivers/real_human_driver_99',
        });
      },
      /SECURITY VIOLATION: Driver '.*' is not the server-approved pilot driver/
    );
    console.log('✓ PASS 3.4: Real human driver without explicit approval strictly rejected');

    // Restore fetch
    globalThis.fetch = origFetch;

    // ---------------------------------------------------------------------------
    // SECTION 4: HTTP Endpoint End-to-End Mock Pilot Dispatch
    // ---------------------------------------------------------------------------
    console.log('\n--- 4. HTTP Endpoint End-to-End Mock Pilot Dispatch ---');

    process.env.NEO_SPOKE_MOCK_DISPATCH_ENABLED = 'true';
    mockSpokeAdapter.reset();

    const mockDb = createHermeticDatabaseClient();
    setServerSupabaseClientForTesting(mockDb);

    // Seed test admin profile
    mockDb._profiles.set('usr-admin-01', {
      id: 'usr-admin-01',
      full_name: 'Operations Dispatch Admin',
      email: 'ops@neotransport.co.uk',
      role: 'admin',
      status: 'active',
      company_id: 'comp-neo-ops',
    });

    // Seed test customer profile
    mockDb._profiles.set('usr-customer-01', {
      id: 'usr-customer-01',
      full_name: 'Customer User',
      email: 'customer@example.com',
      role: 'customer',
      status: 'active',
      company_id: 'comp-meridian-001',
    });

    // Seed test company with active standby credit
    mockDb._companies.set('comp-meridian-001', {
      id: 'comp-meridian-001',
      name: 'Meridian Logistics Ltd',
      standby_active: true,
      verified: true,
      monthly_spend: 4280,
      paid_ytd: 31420,
    });

    // Seed scheduled test booking
    mockDb._bookings.set('NT-24814', {
      id: 'NT-24814',
      company_id: 'comp-meridian-001',
      status: 'Scheduled',
      pickup: 'Canary Wharf loading bay, London, E14 9GE',
      pickup_contact: 'Bay Manager',
      pickup_phone: '0207 555 0188',
      dropoff: 'Data Centre Reception, Reading, RG1 1EX',
      recipient_name: 'IT Shift Lead',
      recipient_phone: '0118 496 0331',
      goods: 'Server rack replacement · 320 kg',
      weight_kg: 320,
      items_count: 1,
      vehicle: 'Sprinter MWB',
      payment_method: 'standby-account',
      total_gbp: 210,
    });

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));

    const adminHeaders = { Authorization: 'Bearer test-admin-token' };
    const customerHeaders = { Authorization: 'Bearer test-customer-token' };

    // 4.1 Unauthenticated rejected
    const unauthRes = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', {}, { bookingId: 'NT-24814', planDate: '2026-10-21' });
    assert.strictEqual(unauthRes.status, 401);
    console.log('✓ PASS 4.1: Unauthenticated request strictly rejected with 401');

    // 4.2 Non-admin rejected
    const nonAdminRes = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', customerHeaders, { bookingId: 'NT-24814', planDate: '2026-10-21' });
    assert.strictEqual(nonAdminRes.status, 403);
    console.log('✓ PASS 4.2: Non-admin caller strictly rejected with 403');

    // 4.3 Missing or invalid authorization token rejected
    const badTokenRes = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', adminHeaders, {
      bookingId: 'NT-24814',
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'wrong-token',
    });
    assert.strictEqual(badTokenRes.status, 403);
    console.log('✓ PASS 4.3: Invalid pilot authorization token rejected with 403');

    // 4.4 Default mock token accepted when NEO_SPOKE_PILOT_DISPATCH_APPROVED_TOKEN is unset
    delete process.env.NEO_SPOKE_PILOT_DISPATCH_APPROVED_TOKEN;
    const validDispatchRes = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', adminHeaders, {
      bookingId: 'NT-24814',
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'NEO-MOCK-PILOT-TOKEN-2026',
    });
    assert.strictEqual(validDispatchRes.status, 200, `Dispatch should succeed. Got: ${JSON.stringify(validDispatchRes.data)}`);
    assert.strictEqual(validDispatchRes.data.success, true);
    assert.strictEqual(validDispatchRes.data.isMock, true);
    assert.ok(validDispatchRes.data.planId.startsWith('plans/mock-sim-pilot-NT-24814-'));
    assert.strictEqual(validDispatchRes.data.stopsImported, 2);
    console.log('✓ PASS 4.4: Default mock pilot authorization token accepted and returns isMock: true');

    // 4.5 Verify database state updates
    const updatedBooking = mockDb._bookings.get('NT-24814');
    assert.strictEqual(updatedBooking.status, 'In transit', 'Booking status must be updated to In transit');

    const createdClaim: any = Array.from(mockDb._claims.values()).find((c: any) => c.booking_id === 'NT-24814');
    assert.ok(createdClaim, 'Claim must exist in database');
    assert.strictEqual(createdClaim.status, 'succeeded', 'Claim status must be succeeded');
    assert.strictEqual(createdClaim.plan_id, validDispatchRes.data.planId);

    // Verify audit log
    const audit = mockDb._auditLogs.find((a: any) => a.target_id === 'NT-24814' && a.action === 'SPOKE_PILOT_DISPATCH');
    assert.ok(audit, 'Audit log must be recorded');
    assert.strictEqual(audit.details?.isMock, true, 'Audit log details must record isMock: true');
    console.log('✓ PASS 4.5: Database booking transitioned to In transit, claim succeeded, and audit log recorded');

    // 4.6 Verify GET /api/admin/dispatch/spoke/verify in mock mode
    const verifyRes = await testRequest(server, '/api/admin/dispatch/spoke/verify', 'GET', adminHeaders);
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyRes.data.connected, true);
    assert.strictEqual(verifyRes.data.isMock, true);
    assert.ok(verifyRes.data.message.includes('MOCK SPOKE ADAPTER'));
    console.log('✓ PASS 4.6: GET /api/admin/dispatch/spoke/verify accurately reports mock mode');

    // 4.7 Fail-closed rejection when mock is requested in prohibited environment
    process.env.NODE_ENV = 'production';
    process.env.NEO_SPOKE_MOCK_DISPATCH_ENABLED = 'true';
    const prohibitedDispatchRes = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', adminHeaders, {
      bookingId: 'NT-24814',
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'NEO-MOCK-PILOT-TOKEN-2026',
    });
    assert.strictEqual(prohibitedDispatchRes.status, 500);
    assert.ok(
      prohibitedDispatchRes.data.error.includes('SECURITY CONFIGURATION ERROR'),
      'Must reject with 500 SECURITY CONFIGURATION ERROR'
    );
    // Restore test environment
    process.env.NODE_ENV = 'test';
    console.log('✓ PASS 4.7: HTTP pilot dispatch endpoint strictly rejects mock request in prohibited environment');

    // ---------------------------------------------------------------------------
    // SECTION 5: Booking Eligibility & Status Gating
    // ---------------------------------------------------------------------------
    console.log('\n--- 5. Booking Eligibility & Status Gating ---');

    // 5.1 Booking already in transit cannot be dispatched
    const inTransitRes = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', adminHeaders, {
      bookingId: 'NT-24814', // already in transit from test 4.4
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'NEO-MOCK-PILOT-TOKEN-2026',
    });
    assert.strictEqual(inTransitRes.status, 409);
    assert.ok(inTransitRes.data.error.includes("status is 'In transit'"));
    console.log('✓ PASS 5.1: Booking already in transit rejected with 409');

    // 5.2 Booking delivered cannot be dispatched
    mockDb._bookings.set('BK-DELIVERED', {
      id: 'BK-DELIVERED',
      company_id: 'comp-meridian-001',
      status: 'Delivered',
      pickup: '1 High St, London, E1 1AA',
      dropoff: '2 High St, Reading, RG1 1AA',
      payment_method: 'standby-account',
      items_count: 1,
      weight_kg: 100,
    });
    const deliveredRes = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', adminHeaders, {
      bookingId: 'BK-DELIVERED',
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'NEO-MOCK-PILOT-TOKEN-2026',
    });
    assert.strictEqual(deliveredRes.status, 409);
    assert.ok(deliveredRes.data.error.includes("status is 'Delivered'"));
    console.log('✓ PASS 5.2: Booking already delivered rejected with 409');

    // 5.3 Booking cancelled cannot be dispatched
    mockDb._bookings.set('BK-CANCELLED', {
      id: 'BK-CANCELLED',
      company_id: 'comp-meridian-001',
      status: 'Cancelled',
      pickup: '1 High St, London, E1 1AA',
      dropoff: '2 High St, Reading, RG1 1AA',
      payment_method: 'standby-account',
      items_count: 1,
      weight_kg: 100,
    });
    const cancelledRes = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', adminHeaders, {
      bookingId: 'BK-CANCELLED',
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'NEO-MOCK-PILOT-TOKEN-2026',
    });
    assert.strictEqual(cancelledRes.status, 409);
    assert.ok(cancelledRes.data.error.includes("status is 'Cancelled'"));
    console.log('✓ PASS 5.3: Cancelled booking rejected with 409');

    // 5.4 Unverified company standby credit rejected
    mockDb._companies.set('comp-unverified', {
      id: 'comp-unverified',
      name: 'Unverified Corp',
      standby_active: false,
      verified: true,
    });
    mockDb._bookings.set('BK-UNVERIFIED-CREDIT', {
      id: 'BK-UNVERIFIED-CREDIT',
      company_id: 'comp-unverified',
      status: 'Scheduled',
      pickup: '1 High St, London, E1 1AA',
      dropoff: '2 High St, Reading, RG1 1AA',
      payment_method: 'standby-account',
      items_count: 1,
      weight_kg: 100,
    });
    const creditRes = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', adminHeaders, {
      bookingId: 'BK-UNVERIFIED-CREDIT',
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'NEO-MOCK-PILOT-TOKEN-2026',
    });
    assert.strictEqual(creditRes.status, 403);
    assert.ok(creditRes.data.error.includes('credit facility is not active or verified'));
    console.log('✓ PASS 5.4: Unverified company credit facility strictly rejected with 403');

    // 5.5 Unpaid card payment booking rejected
    mockDb._bookings.set('BK-UNPAID-CARD', {
      id: 'BK-UNPAID-CARD',
      company_id: 'comp-meridian-001',
      status: 'Scheduled',
      pickup: '1 High St, London, E1 1AA',
      dropoff: '2 High St, Reading, RG1 1AA',
      payment_method: 'card',
      payment_status: 'pending',
      total_gbp: 150,
      amount_paid_gbp: 0,
      items_count: 1,
      weight_kg: 100,
    });
    const unpaidCardRes = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', adminHeaders, {
      bookingId: 'BK-UNPAID-CARD',
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'NEO-MOCK-PILOT-TOKEN-2026',
    });
    assert.strictEqual(unpaidCardRes.status, 403);
    assert.ok(unpaidCardRes.data.error.includes('Card payment is pending verification'));
    console.log('✓ PASS 5.5: Unpaid / pending card payment booking strictly rejected with 403');

    // ---------------------------------------------------------------------------
    // SECTION 6: Incomplete Address & Coordinate Validation
    // ---------------------------------------------------------------------------
    console.log('\n--- 6. Incomplete Address & Coordinate Validation ---');

    // 6.1 Missing pickup address rejected
    mockDb._bookings.set('BK-NO-PICKUP', {
      id: 'BK-NO-PICKUP',
      company_id: 'comp-meridian-001',
      status: 'Scheduled',
      pickup: '',
      dropoff: '2 High St, Reading, RG1 1AA',
      payment_method: 'standby-account',
      items_count: 1,
      weight_kg: 100,
    });
    const noPickupRes = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', adminHeaders, {
      bookingId: 'BK-NO-PICKUP',
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'NEO-MOCK-PILOT-TOKEN-2026',
    });
    assert.strictEqual(noPickupRes.status, 400);
    assert.ok(noPickupRes.data.error.includes('Pickup address is required'));
    console.log('✓ PASS 6.1: Missing pickup address strictly rejected with 400');

    // 6.2 Missing dropoff address rejected
    mockDb._bookings.set('BK-NO-DROPOFF', {
      id: 'BK-NO-DROPOFF',
      company_id: 'comp-meridian-001',
      status: 'Scheduled',
      pickup: '1 High St, London, E1 1AA',
      dropoff: '   ',
      payment_method: 'standby-account',
      items_count: 1,
      weight_kg: 100,
    });
    const noDropoffRes = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', adminHeaders, {
      bookingId: 'BK-NO-DROPOFF',
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'NEO-MOCK-PILOT-TOKEN-2026',
    });
    assert.strictEqual(noDropoffRes.status, 400);
    assert.ok(noDropoffRes.data.error.includes('Drop-off address is required'));
    console.log('✓ PASS 6.2: Missing drop-off address strictly rejected with 400');

    // 6.3 Invalid coordinate range rejected
    mockDb._bookings.set('BK-BAD-COORDS', {
      id: 'BK-BAD-COORDS',
      company_id: 'comp-meridian-001',
      status: 'Scheduled',
      pickup: '1 High St, London, E1 1AA',
      dropoff: '2 High St, Reading, RG1 1AA',
      payment_method: 'standby-account',
      items_count: 1,
      weight_kg: 100,
    });
    const badCoordsRes = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', adminHeaders, {
      bookingId: 'BK-BAD-COORDS',
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'NEO-MOCK-PILOT-TOKEN-2026',
      pickupCoords: { lat: 999.0, lng: -2.24 },
    });
    assert.strictEqual(badCoordsRes.status, 400);
    assert.ok(badCoordsRes.data.error.includes('Latitude'));
    console.log('✓ PASS 6.3: Invalid coordinate range rejected with 400');

    // ---------------------------------------------------------------------------
    // SECTION 7: Concurrency & Duplicate-Dispatch Protection
    // ---------------------------------------------------------------------------
    console.log('\n--- 7. Concurrency & Duplicate-Dispatch Protection ---');

    // Seed candidate for duplicate testing
    mockDb._bookings.set('BK-DUP-TEST', {
      id: 'BK-DUP-TEST',
      company_id: 'comp-meridian-001',
      status: 'Scheduled',
      pickup: '1 Warehouse Lane, Manchester, M17 1AB',
      dropoff: '2 Factory Road, Birmingham, B6 7EU',
      payment_method: 'standby-account',
      items_count: 1,
      weight_kg: 100,
    });

    // 7.1 Dispatch once successfully
    const firstDispatch = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', adminHeaders, {
      bookingId: 'BK-DUP-TEST',
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'NEO-MOCK-PILOT-TOKEN-2026',
    });
    assert.strictEqual(firstDispatch.status, 200);

    // 7.2 Attempting second dispatch on same booking rejected with 409
    const secondDispatch = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', adminHeaders, {
      bookingId: 'BK-DUP-TEST',
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'NEO-MOCK-PILOT-TOKEN-2026',
    });
    // Status is no longer Scheduled (it's In transit), returning 409.
    assert.strictEqual(secondDispatch.status, 409);
    assert.ok(secondDispatch.data.error.includes("status is 'In transit'"));

    // Reset status to Scheduled to test DB claim collision
    mockDb._bookings.get('BK-DUP-TEST').status = 'Scheduled';
    const claimCollisionRes = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', adminHeaders, {
      bookingId: 'BK-DUP-TEST',
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'NEO-MOCK-PILOT-TOKEN-2026',
    });
    assert.strictEqual(claimCollisionRes.status, 409);
    assert.ok(claimCollisionRes.data.error.includes('Duplicate dispatch prohibited'));
    console.log('✓ PASS 7.1: Duplicate dispatch blocked via both booking status and atomic claim uniqueness (409)');

    // ---------------------------------------------------------------------------
    // SECTION 8: Timeout & Failure Simulation Resilience
    // ---------------------------------------------------------------------------
    console.log('\n--- 8. Timeout & Failure Simulation Resilience ---');

    mockDb._bookings.set('BK-FAIL-TEST', {
      id: 'BK-FAIL-TEST',
      company_id: 'comp-meridian-001',
      status: 'Scheduled',
      pickup: '1 Warehouse Lane, Manchester, M17 1AB',
      dropoff: '2 Factory Road, Birmingham, B6 7EU',
      payment_method: 'standby-account',
      items_count: 1,
      weight_kg: 100,
    });

    // 8.1 Simulate Spoke execution failure
    mockSpokeAdapter.simulateFailure('Simulated 500 Gateway Crash in Mock Adapter');
    const failRes = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', adminHeaders, {
      bookingId: 'BK-FAIL-TEST',
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'NEO-MOCK-PILOT-TOKEN-2026',
    });
    assert.strictEqual(failRes.status, 500);
    assert.ok(failRes.data.error.includes('Simulated 500 Gateway Crash'));

    // Verify claim was transitioned to 'failed_unknown'
    const failedClaim: any = Array.from(mockDb._claims.values()).find((c: any) => c.booking_id === 'BK-FAIL-TEST');
    assert.ok(failedClaim, 'Claim must exist');
    assert.strictEqual(failedClaim.status, 'failed_unknown');
    assert.ok(failedClaim.failure_reason.includes('Simulated 500 Gateway Crash'));
    console.log('✓ PASS 8.1: Simulated Spoke failure transitions claim to failed_unknown and returns 500');

    // 8.2 Subsequent retry on failed_unknown claim is blocked with 409
    mockSpokeAdapter.clearSimulation();
    const retryBlockedRes = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', adminHeaders, {
      bookingId: 'BK-FAIL-TEST',
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'NEO-MOCK-PILOT-TOKEN-2026',
    });
    assert.strictEqual(retryBlockedRes.status, 409);
    assert.ok(retryBlockedRes.data.error.includes('failed with an unknown/unresolved outcome'));
    console.log('✓ PASS 8.2: Automated retry on failed_unknown claim strictly blocked with 409');

    // 8.3 Simulate timeout
    mockDb._bookings.set('BK-TIMEOUT-TEST', {
      id: 'BK-TIMEOUT-TEST',
      company_id: 'comp-meridian-001',
      status: 'Scheduled',
      pickup: '1 Warehouse Lane, Manchester, M17 1AB',
      dropoff: '2 Factory Road, Birmingham, B6 7EU',
      payment_method: 'standby-account',
      items_count: 1,
      weight_kg: 100,
    });
    mockSpokeAdapter.simulateTimeout(15);
    const timeoutRes = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', adminHeaders, {
      bookingId: 'BK-TIMEOUT-TEST',
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'NEO-MOCK-PILOT-TOKEN-2026',
    });
    assert.strictEqual(timeoutRes.status, 500);
    assert.ok(timeoutRes.data.error.includes('Gateway Timeout'));
    mockSpokeAdapter.clearSimulation();
    console.log('✓ PASS 8.3: Simulated Spoke timeout handled safely with 500 and claim recording');

    // ---------------------------------------------------------------------------
    // SECTION 9: Database Persistence Failure Graceful Handling
    // ---------------------------------------------------------------------------
    console.log('\n--- 9. Database Persistence Failure Graceful Handling ---');

    mockDb._bookings.set('BK-PERSIST-ERR', {
      id: 'BK-PERSIST-ERR',
      company_id: 'comp-meridian-001',
      status: 'Scheduled',
      pickup: '1 Warehouse Lane, Manchester, M17 1AB',
      dropoff: '2 Factory Road, Birmingham, B6 7EU',
      payment_method: 'standby-account',
      items_count: 1,
      weight_kg: 100,
      _simulateUpdateError: 'Simulated PostgreSQL disk failure during booking status update',
    });

    // In mockDb, simulate error if _simulateUpdateError is set
    const origFrom = mockDb.from;
    mockDb.from = (table: string) => {
      const qb = origFrom(table);
      if (table === 'bookings') {
        const origUpdate = qb.update;
        qb.update = (payload: any) => {
          const uObj = origUpdate(payload);
          const origEq = uObj.eq;
          uObj.eq = (col: string, val: any) => {
            if (val === 'BK-PERSIST-ERR') {
              return {
                then: async (resolve: any) => {
                  return resolve({
                    data: null,
                    error: { message: 'Simulated PostgreSQL disk failure during booking status update' },
                  });
                },
              };
            }
            return origEq(col, val);
          };
          return uObj;
        };
      }
      return qb;
    };

    const persistErrRes = await testRequest(server, '/api/admin/dispatch/spoke/pilot', 'POST', adminHeaders, {
      bookingId: 'BK-PERSIST-ERR',
      planDate: '2026-10-21',
      pilotAuthorizationToken: 'NEO-MOCK-PILOT-TOKEN-2026',
    });

    assert.strictEqual(persistErrRes.status, 200, 'Endpoint should succeed with persistence warning');
    assert.strictEqual(persistErrRes.data.success, true);
    assert.ok(persistErrRes.data.persistenceWarning, 'Must include persistenceWarning');
    assert.ok(persistErrRes.data.persistenceWarning.includes('Simulated PostgreSQL disk failure'));
    console.log('✓ PASS 9.1: Database update failure during pilot dispatch delivers result with persistence warning');

    // Restore origFrom
    mockDb.from = origFrom;

    // Clean up server
    await new Promise<void>((resolve) => server.close(() => resolve()));
    setServerSupabaseClientForTesting(null);

    console.log('\n=================================================================');
    console.log('ALL SPOKE SAFE MOCK DISPATCH TESTS PASSED (0 failures)');
    console.log('=================================================================\n');
  } finally {
    // Restore environment
    process.env = initialEnv;
  }
}

runMockDispatchTests().catch((err) => {
  console.error('\n❌ TEST FAILURE:', err);
  process.exit(1);
});

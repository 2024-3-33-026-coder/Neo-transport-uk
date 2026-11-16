import app, { resolveSafeRedirectOrigin, ALLOWED_REDIRECT_ORIGINS, UUID_REGEX, isPreviewOrDevEnvironment, executeAuthSyncWithRollback } from '../api/index.js';
import http from 'http';
import fs from 'fs';
import path from 'path';
import {
  getStoredBookings,
  getPersistedBookings,
  getStoredQuotes,
  getPersistedQuotes,
  fetchPersistedQuotes,
  getStoredInvoices,
  getPersistedInvoices,
  fetchPersistedInvoices,
  getStoredDocuments,
  getPersistedDocuments,
  fetchPersistedDocuments,
  addDocument,
  removeDocumentFile,
  getStoredTickets,
  getPersistedTickets,
  getPersistedApplications,
  setCustomSupabaseClient,
  setDemoModeOverrideForTesting,
  INITIAL_STANDBY_APPLICATIONS,
  INITIAL_SUPPORT_TICKETS,
} from '../src/lib/portalStore.ts';
import {
  INITIAL_BOOKINGS,
  INITIAL_QUOTES,
  INITIAL_INVOICES,
  INITIAL_DOCUMENTS,
} from '../src/data/mockData.ts';

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
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let data: any = raw;
          try {
            data = JSON.parse(raw);
          } catch {}
          resolve({ status: res.statusCode || 0, data });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Comprehensive Admin API Security Hardening Test Suite ---');
  let failures = 0;

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  try {
    // SECTION 1: Public endpoint check
    const health = await testRequest(server, '/api/health', 'GET');
    if (health.status === 200 && health.data?.status === 'ok') {
      console.log('✓ PASS: GET /api/health returns 200 OK');
    } else {
      console.error('✗ FAIL: GET /api/health failed', health);
      failures++;
    }

    // SECTION 2: Unauthenticated calls to all admin routes MUST reject with 401
    const adminRoutes = [
      { path: '/api/admin/verify', method: 'GET' },
      { path: '/api/admin/dispatch/spoke/verify', method: 'GET' },
      {
        path: '/api/admin/dispatch/spoke/dry-run',
        method: 'POST',
        body: { bookingId: 'NT-24817', planDate: '2026-10-20' },
      },
      {
        path: '/api/admin/dispatch/spoke/smoke-test',
        method: 'POST',
        body: { planDate: '2026-10-20', idempotencyToken: 'token-sec-check-123' },
      },
      {
        path: '/api/admin/dispatch/spoke/smoke-test/cleanup',
        method: 'POST',
        body: { planId: 'plans/test_plan_123' },
      },
      { path: '/api/admin/create-user', method: 'POST', body: { email: 'test@example.com' } },
      { path: '/api/admin/update-user-status', method: 'POST', body: { targetUserId: 'u-1', status: 'active' } },
      { path: '/api/admin/update-user-role', method: 'POST', body: { targetUserId: 'u-1', role: 'customer' } },
      { path: '/api/admin/update-user-company', method: 'POST', body: { targetUserId: 'u-1', companyId: 'comp-1' } },
      { path: '/api/admin/trigger-password-reset', method: 'POST', body: { email: 'test@example.com' } },
    ];

    for (const route of adminRoutes) {
      const res = await testRequest(server, route.path, route.method, {}, route.body);
      if (res.status === 401 && res.data?.error?.includes('Authentication required')) {
        console.log(`✓ PASS: ${route.method} ${route.path} rejected unauthenticated caller with 401`);
      } else {
        console.error(`✗ FAIL: ${route.method} ${route.path} did not reject with 401`, res);
        failures++;
      }
    }

    // SECTION 3: Detailed Authentication Header & Token Threat Vectors on /api/admin/create-user
    const nonBearer = await testRequest(
      server,
      '/api/admin/create-user',
      'POST',
      { Authorization: 'Basic dXNlcjpwYXNz' },
      { email: 'test@example.com' }
    );
    if (nonBearer.status === 401 && nonBearer.data?.error?.includes('Missing Bearer token')) {
      console.log('✓ PASS: POST /api/admin/create-user rejected non-Bearer authorization header with 401');
    } else {
      console.error('✗ FAIL: Non-Bearer auth header not rejected with 401', nonBearer);
      failures++;
    }

    const emptyBearer = await testRequest(
      server,
      '/api/admin/create-user',
      'POST',
      { Authorization: 'Bearer ' },
      { email: 'test@example.com' }
    );
    if (emptyBearer.status === 401) {
      console.log('✓ PASS: POST /api/admin/create-user rejected empty Bearer token with 401');
    } else {
      console.error('✗ FAIL: Empty Bearer token not rejected with 401', emptyBearer);
      failures++;
    }

    // Note on Token Verification Behavior:
    // - In an offline test environment without SUPABASE_URL configured, verifyAdminCaller fails fast with HTTP 503 ("Database service unavailable on server") before contacting remote Auth.
    // - In a deployed Preview/Production environment with SUPABASE_URL configured, Supabase Auth evaluates the token and returns HTTP 401 ("Invalid or expired session token").
    const invalidBearer = await testRequest(
      server,
      '/api/admin/create-user',
      'POST',
      { Authorization: 'Bearer invalid.fake.token' },
      { email: 'test@example.com' }
    );
    if (invalidBearer.status === 401) {
      console.log('✓ PASS: POST /api/admin/create-user rejected invalid Bearer token with HTTP 401 (Auth service verified)');
    } else if (
      invalidBearer.status === 503 &&
      invalidBearer.data?.error?.includes('Database service unavailable')
    ) {
      console.log('✓ PASS: POST /api/admin/create-user returned HTTP 503 (intentional fail-fast when SUPABASE_URL is unconfigured in offline test)');
    } else {
      console.error('✗ FAIL: Invalid Bearer token not rejected with 401/503', invalidBearer);
      failures++;
    }

    // SECTION 4: Path normalizer works for routes without /api prefix
    const normalized = await testRequest(server, '/admin/verify', 'GET');
    if (normalized.status === 401 && normalized.data?.error?.includes('Authentication required')) {
      console.log('✓ PASS: GET /admin/verify path normalizer maps correctly to /api/admin/verify');
    } else {
      console.error('✗ FAIL: Path normalizer failed', normalized);
      failures++;
    }

    // SECTION 4: Rigorous Redirect Origin Allowlist & Threat Vector Testing
    console.log('\n--- Testing Strict Redirect Origin Allowlist & Threat Vectors ---');

    // 4a. Arbitrary unlisted domain rejected
    const unlisted = resolveSafeRedirectOrigin({ headers: { origin: 'https://evil-phishing.com' } } as any);
    if (unlisted !== 'https://evil-phishing.com') {
      console.log('✓ PASS: Arbitrary unlisted domain rejected -> resolved to safe default');
    } else {
      console.error('✗ FAIL: Arbitrary domain accepted!');
      failures++;
    }

    // 4b. Arbitrary *.vercel.app domain NOT matching VERCEL_URL must be rejected
    const arbitraryVercel = resolveSafeRedirectOrigin({ headers: { origin: 'https://attacker-project.vercel.app' } } as any);
    if (arbitraryVercel !== 'https://attacker-project.vercel.app') {
      console.log('✓ PASS: Arbitrary *.vercel.app domain rejected when not matching deployment VERCEL_URL');
    } else {
      console.error('✗ FAIL: Arbitrary *.vercel.app domain was accepted!');
      failures++;
    }

    // 4c. Legitimate deployment VERCEL_URL accepted when environment variable is present
    process.env.VERCEL_URL = 'neo-transport-staging-branch.vercel.app';
    const legitimateVercel = resolveSafeRedirectOrigin({ headers: { origin: 'https://neo-transport-staging-branch.vercel.app' } } as any);
    if (legitimateVercel === 'https://neo-transport-staging-branch.vercel.app') {
      console.log('✓ PASS: Legitimate deployment VERCEL_URL accepted when configured in env');
    } else {
      console.error(`✗ FAIL: Legitimate deployment VERCEL_URL rejected: ${legitimateVercel}`);
      failures++;
    }
    delete process.env.VERCEL_URL;

    // 4d. Reject embedded credentials in URL (e.g. user:pass@host)
    const credsOrigin = resolveSafeRedirectOrigin({ headers: { origin: 'https://admin:secret@neo-transport.co.uk' } } as any);
    if (credsOrigin !== 'https://admin:secret@neo-transport.co.uk') {
      console.log('✓ PASS: Embedded credentials in origin rejected');
    } else {
      console.error('✗ FAIL: Embedded credentials origin was accepted!');
      failures++;
    }

    // 4e. Reject unexpected ports on production domain
    const portOrigin = resolveSafeRedirectOrigin({ headers: { origin: 'https://neo-transport.co.uk:8443' } } as any);
    if (portOrigin !== 'https://neo-transport.co.uk:8443') {
      console.log('✓ PASS: Unexpected port on production domain rejected');
    } else {
      console.error('✗ FAIL: Unexpected port on production domain was accepted!');
      failures++;
    }

    // 4f. Reject path/query components in origin
    const pathOrigin = resolveSafeRedirectOrigin({ headers: { origin: 'https://neo-transport.co.uk/evil/path?param=1' } } as any);
    if (pathOrigin !== 'https://neo-transport.co.uk/evil/path?param=1') {
      console.log('✓ PASS: Path/query in origin header rejected');
    } else {
      console.error('✗ FAIL: Path/query origin was accepted!');
      failures++;
    }

    // 4g. Reject non-http/https schemes (javascript:, data:)
    const jsOrigin = resolveSafeRedirectOrigin({ headers: { origin: 'javascript:alert(1)' } } as any);
    if (!jsOrigin.startsWith('javascript:')) {
      console.log('✓ PASS: Dangerous scheme (javascript:) rejected');
    } else {
      console.error('✗ FAIL: Dangerous scheme accepted!');
      failures++;
    }

    // 4h. Reject malformed origin string
    const malformedOrigin = resolveSafeRedirectOrigin({ headers: { origin: 'not-a-valid-url::' } } as any);
    if (malformedOrigin.startsWith('http://') || malformedOrigin.startsWith('https://')) {
      console.log('✓ PASS: Malformed origin string safely rejected');
    } else {
      console.error('✗ FAIL: Malformed origin handling failed', malformedOrigin);
      failures++;
    }

    // 4i. Canonical production origins accepted
    const prodOrigin = resolveSafeRedirectOrigin({ headers: { origin: 'https://neo-transport.co.uk' } } as any);
    if (prodOrigin === 'https://neo-transport.co.uk') {
      console.log('✓ PASS: Canonical production origin accepted');
    } else {
      console.error('✗ FAIL: Canonical production origin rejected');
      failures++;
    }

    // 4j. Local development origins accepted
    const local3000 = resolveSafeRedirectOrigin({ headers: { origin: 'http://localhost:3000' } } as any);
    const local5173 = resolveSafeRedirectOrigin({ headers: { origin: 'http://localhost:5173' } } as any);
    if (local3000 === 'http://localhost:3000' && local5173 === 'http://localhost:5173') {
      console.log('✓ PASS: Local development origins (3000 & 5173) accepted');
    } else {
      console.error('✗ FAIL: Local development origins rejected');
      failures++;
    }

    // SECTION 5: Strict UUID Validation & Input Sanitization Threat Vectors
    console.log('\n--- Testing Strict UUID Validation & Payload Threat Vectors ---');

    // 5a. Valid UUIDs pass regex
    const validUuid1 = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
    const validUuid2 = '00000000-0000-0000-0000-000000000000';
    if (UUID_REGEX.test(validUuid1) && UUID_REGEX.test(validUuid2)) {
      console.log('✓ PASS: Standard UUID formats correctly validated');
    } else {
      console.error('✗ FAIL: Valid UUID failed regex validation');
      failures++;
    }

    // 5b. Malformed UUID strings rejected
    const malformedUuids = [
      'u-1',
      'not-a-uuid',
      'a1b2c3d4-e5f6-4a1b-8c2d',
      'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d9e',
      "' OR 1=1--",
      '../../../etc/passwd',
      'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8g', // non-hex 'g'
      '',
      '   ',
    ];

    let allMalformedRejected = true;
    for (const badUuid of malformedUuids) {
      if (UUID_REGEX.test(badUuid.trim())) {
        console.error(`✗ FAIL: Malformed UUID '${badUuid}' was accepted by UUID_REGEX`);
        allMalformedRejected = false;
        failures++;
      }
    }
    if (allMalformedRejected) {
      console.log('✓ PASS: All malformed UUID threat vectors (SQLi, path traversal, truncated, non-hex) safely rejected');
    }

    // SECTION 6: Fail-Closed Environment Gate Edge Cases for Recovery Links
    console.log('\n--- Testing Fail-Closed Environment Gate Edge Cases ---');

    // Helper to run isPreviewOrDevEnvironment with clean env snapshot
    const testEnvGate = (env: Record<string, string | undefined>): boolean => {
      const origVercelEnv = process.env.VERCEL_ENV;
      const origNodeEnv = process.env.NODE_ENV;
      const origVercel = process.env.VERCEL;

      if ('VERCEL_ENV' in env) {
        if (env.VERCEL_ENV === undefined) delete process.env.VERCEL_ENV;
        else process.env.VERCEL_ENV = env.VERCEL_ENV;
      }
      if ('NODE_ENV' in env) {
        if (env.NODE_ENV === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = env.NODE_ENV;
      }
      if ('VERCEL' in env) {
        if (env.VERCEL === undefined) delete process.env.VERCEL;
        else process.env.VERCEL = env.VERCEL;
      }

      try {
        return isPreviewOrDevEnvironment();
      } finally {
        if (origVercelEnv === undefined) delete process.env.VERCEL_ENV;
        else process.env.VERCEL_ENV = origVercelEnv;
        if (origNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = origNodeEnv;
        if (origVercel === undefined) delete process.env.VERCEL;
        else process.env.VERCEL = origVercel;
      }
    };

    // 6a. Explicit test: VERCEL=1, VERCEL_ENV=preview, NODE_ENV=production allows recovery link generation for preview testing
    if (testEnvGate({ VERCEL: '1', VERCEL_ENV: 'preview', NODE_ENV: 'production' })) {
      console.log('✓ PASS: Verified Vercel Preview (VERCEL=1, VERCEL_ENV=preview, NODE_ENV=production) allows recovery link generation for testing');
    } else {
      console.error('✗ FAIL: Verified Vercel Preview (VERCEL=1, VERCEL_ENV=preview, NODE_ENV=production) was denied!');
      failures++;
    }

    // 6b. Case and whitespace normalized preview on Vercel
    if (testEnvGate({ VERCEL: '1', VERCEL_ENV: '  PREVIEW  ', NODE_ENV: 'production' })) {
      console.log('✓ PASS: Case and whitespace normalized preview (VERCEL_ENV="  PREVIEW  ") allows preview link');
    } else {
      console.error('✗ FAIL: Normalized preview returned false!');
      failures++;
    }

    // 6c. VERCEL_ENV=production strictly denies recovery links (even if NODE_ENV is set to development)
    if (
      !testEnvGate({ VERCEL: '1', VERCEL_ENV: 'production', NODE_ENV: 'production' }) &&
      !testEnvGate({ VERCEL: '1', VERCEL_ENV: 'production', NODE_ENV: 'development' }) &&
      !testEnvGate({ VERCEL_ENV: 'production' })
    ) {
      console.log('✓ PASS: Fail-closed: VERCEL_ENV=production strictly denies recovery links in all configurations');
    } else {
      console.error('✗ FAIL: VERCEL_ENV=production allowed recovery links!');
      failures++;
    }

    // 6d. Missing/undefined environment variables strictly deny recovery links
    if (!testEnvGate({ VERCEL_ENV: undefined, NODE_ENV: undefined, VERCEL: undefined })) {
      console.log('✓ PASS: Fail-closed: Completely missing/undefined environment variables deny recovery links');
    } else {
      console.error('✗ FAIL: Missing env vars allowed recovery links!');
      failures++;
    }

    // 6e. Empty string environment variables strictly deny recovery links
    if (!testEnvGate({ VERCEL_ENV: '', NODE_ENV: '', VERCEL: '' })) {
      console.log('✓ PASS: Fail-closed: Empty string environment variables deny recovery links');
    } else {
      console.error('✗ FAIL: Empty env vars allowed recovery links!');
      failures++;
    }

    // 6f. Unknown deployment environments never allow recovery links
    const unknownEnvs = ['staging', 'qa', 'preview-test', 'custom-branch', 'testnet'];
    let allUnknownDenied = true;
    for (const badEnv of unknownEnvs) {
      if (
        testEnvGate({ VERCEL: '1', VERCEL_ENV: badEnv, NODE_ENV: 'production' }) ||
        testEnvGate({ VERCEL_ENV: badEnv })
      ) {
        console.error(`✗ FAIL: Unknown environment VERCEL_ENV='${badEnv}' allowed recovery links!`);
        allUnknownDenied = false;
        failures++;
      }
    }
    if (allUnknownDenied) {
      console.log('✓ PASS: Fail-closed: Unknown deployment environments (staging, qa, custom) never allow recovery links');
    }

    // 6g. On Vercel (VERCEL=1) with missing VERCEL_ENV strictly denies recovery links
    if (!testEnvGate({ VERCEL: '1', VERCEL_ENV: undefined, NODE_ENV: 'production' })) {
      console.log('✓ PASS: Fail-closed: VERCEL=1 with missing VERCEL_ENV denies recovery links');
    } else {
      console.error('✗ FAIL: VERCEL=1 with missing VERCEL_ENV allowed recovery links!');
      failures++;
    }

    // 6h. Explicit local development outside Vercel allows recovery links
    if (
      testEnvGate({ VERCEL_ENV: undefined, VERCEL: undefined, NODE_ENV: 'development' }) &&
      testEnvGate({ VERCEL_ENV: undefined, VERCEL: undefined, NODE_ENV: 'test' })
    ) {
      console.log('✓ PASS: Explicit local development outside Vercel (NODE_ENV=development/test) allows recovery links');
    } else {
      console.error('✗ FAIL: Local development outside Vercel was denied!');
      failures++;
    }

    // 6i. Outside Vercel with NODE_ENV=production or missing NODE_ENV strictly denies recovery links
    if (
      !testEnvGate({ VERCEL_ENV: undefined, VERCEL: undefined, NODE_ENV: 'production' }) &&
      !testEnvGate({ VERCEL_ENV: undefined, VERCEL: undefined, NODE_ENV: undefined })
    ) {
      console.log('✓ PASS: Fail-closed: Outside Vercel with NODE_ENV=production or missing NODE_ENV denies recovery links');
    } else {
      console.error('✗ FAIL: Outside Vercel NODE_ENV=production allowed recovery links!');
      failures++;
    }

    // SECTION 7: Partial Failure & Compensating Rollback Handling
    console.log('\n--- Testing Partial Failure & Compensating Rollback ---');

    // 7a. Normal successful execution (no rollback needed)
    let rollbackCalled7a = false;
    const successResult = await executeAuthSyncWithRollback(
      '00000000-0000-0000-0000-000000000001',
      async () => ({ error: null }),
      async () => {
        rollbackCalled7a = true;
        return { error: null };
      }
    );
    if (successResult.success && !successResult.rolledBack && !rollbackCalled7a) {
      console.log('✓ PASS: Normal sync succeeds without invoking rollback');
    } else {
      console.error('✗ FAIL: Normal sync failed or unexpectedly called rollback', successResult);
      failures++;
    }

    // 7b. Auth sync returns error object -> triggers compensating rollback
    let rollbackCalled7b = false;
    const authErrResult = await executeAuthSyncWithRollback(
      '00000000-0000-0000-0000-000000000002',
      async () => ({ error: { message: 'Supabase Auth service rate limit exceeded' } }),
      async () => {
        rollbackCalled7b = true;
        return { error: null };
      }
    );
    if (!authErrResult.success && authErrResult.rolledBack && rollbackCalled7b) {
      console.log('✓ PASS: Auth error object safely triggers compensating rollback');
    } else {
      console.error('✗ FAIL: Auth error object handling failed', authErrResult);
      failures++;
    }

    // 7c. Auth sync throws unexpected exception -> triggers compensating rollback
    let rollbackCalled7c = false;
    const authThrowResult = await executeAuthSyncWithRollback(
      '00000000-0000-0000-0000-000000000003',
      async () => {
        throw new Error('Network timeout contacting Supabase Auth');
      },
      async () => {
        rollbackCalled7c = true;
        return { error: null };
      }
    );
    if (!authThrowResult.success && authThrowResult.rolledBack && rollbackCalled7c) {
      console.log('✓ PASS: Auth thrown exception safely triggers compensating rollback');
    } else {
      console.error('✗ FAIL: Auth thrown exception handling failed', authThrowResult);
      failures++;
    }

    // 7d. Double fault: Auth sync fails AND rollback fails -> captures both failure states
    const doubleFaultResult = await executeAuthSyncWithRollback(
      '00000000-0000-0000-0000-000000000004',
      async () => ({ error: { message: 'Auth service unreachable' } }),
      async () => {
        throw new Error('Database connection reset during rollback');
      }
    );
    if (
      !doubleFaultResult.success &&
      !doubleFaultResult.rolledBack &&
      doubleFaultResult.rollbackError?.includes('Database connection reset')
    ) {
      console.log('✓ PASS: Double fault handled gracefully without unhandled crashes');
    } else {
      console.error('✗ FAIL: Double fault handling failed', doubleFaultResult);
      failures++;
    }

    // =========================================================================
    // SECTION 8: Portal Store Empty-Database & Demo Sanitization Regression Suite
    // =========================================================================
    console.log('\n--- Testing Portal Store Empty-Database & Demo Sanitization Regression ---');

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

    function createMockSupabase(queryResults: Record<string, { data: any; error: any }>) {
      return {
        from: (table: string) => {
          const res = queryResults[table] || { data: [], error: null };
          return {
            select: (_cols?: string) => ({
              order: (_col?: string, _opts?: any) => Promise.resolve(res),
              limit: (_n?: number) => Promise.resolve(res),
              eq: (_col: string, _val: any) => ({
                single: () => Promise.resolve(res),
              }),
            }),
            insert: (_row: any) => Promise.resolve({ data: null, error: null }),
            update: (_row: any) => ({
              eq: (_col: string, _val: any) => Promise.resolve({ data: null, error: null }),
            }),
            delete: () => ({
              eq: (_col: string, _val: any) => Promise.resolve({ data: null, error: null }),
            }),
          };
        },
        storage: {
          from: (_bucket: string) => ({
            upload: () => Promise.resolve({ data: null, error: null }),
            createSignedUrl: (path: string) =>
              Promise.resolve({ data: { signedUrl: `https://signed.example.com/${path}` }, error: null }),
          }),
        },
        auth: {
          getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        },
      };
    }

    // 8a. Pre-populate localStorage with old demo fixtures in production mode (!isDemoModeAllowed)
    setDemoModeOverrideForTesting(false);
    localStorage.clear();
    localStorage.setItem('neo_portal_bookings', JSON.stringify(INITIAL_BOOKINGS));
    localStorage.setItem('neo_portal_quotes', JSON.stringify(INITIAL_QUOTES));
    localStorage.setItem('neo_portal_invoices', JSON.stringify(INITIAL_INVOICES));
    localStorage.setItem('neo_portal_documents', JSON.stringify(INITIAL_DOCUMENTS));
    localStorage.setItem('neo_standby_applications', JSON.stringify(INITIAL_STANDBY_APPLICATIONS));
    localStorage.setItem('neo_portal_tickets', JSON.stringify(INITIAL_SUPPORT_TICKETS));

    const storedBookings = getStoredBookings();
    const storedQuotes = getStoredQuotes();
    const storedInvoices = getStoredInvoices();
    const storedDocs = getStoredDocuments();
    const storedTickets = getStoredTickets();

    if (
      storedBookings.length === 0 &&
      storedQuotes.length === 0 &&
      storedInvoices.length === 0 &&
      storedDocs.length === 0 &&
      storedTickets.length === 0
    ) {
      console.log('✓ PASS: In production mode, pre-populated demo data in localStorage is sanitized and returns empty arrays');
    } else {
      console.error('✗ FAIL: Synchronous readers returned demo data instead of empty arrays', {
        storedBookings: storedBookings.length,
        storedQuotes: storedQuotes.length,
        storedInvoices: storedInvoices.length,
        storedDocs: storedDocs.length,
        storedTickets: storedTickets.length,
      });
      failures++;
    }

    // 8b. Verify localStorage was purged of demo fixtures
    const rawBookings = localStorage.getItem('neo_portal_bookings');
    const rawQuotes = localStorage.getItem('neo_portal_quotes');
    const rawInvoices = localStorage.getItem('neo_portal_invoices');
    const rawDocs = localStorage.getItem('neo_portal_documents');
    if (
      rawBookings === '[]' &&
      rawQuotes === '[]' &&
      rawInvoices === '[]' &&
      rawDocs === '[]'
    ) {
      console.log('✓ PASS: Stale demo records in localStorage were pruned to clean empty arrays');
    } else {
      console.error('✗ FAIL: localStorage was not purged', { rawBookings, rawQuotes, rawInvoices, rawDocs });
      failures++;
    }

    // 8c. Mock successful Supabase queries returning empty arrays
    const emptyMockClient = createMockSupabase({
      bookings: { data: [], error: null },
      quotes: { data: [], error: null },
      invoices: { data: [], error: null },
      documents: { data: [], error: null },
      standby_applications: { data: [], error: null },
      support_tickets: { data: [], error: null },
    });
    setCustomSupabaseClient(emptyMockClient);

    const asyncBookings = await getPersistedBookings();
    const asyncQuotes = await fetchPersistedQuotes();
    const asyncPersistedQuotes = await getPersistedQuotes();
    const asyncInvoices = await fetchPersistedInvoices();
    const asyncPersistedInvoices = await getPersistedInvoices();
    const asyncDocs = await fetchPersistedDocuments();
    const asyncPersistedDocs = await getPersistedDocuments();
    const asyncApps = await getPersistedApplications();
    const asyncTickets = await getPersistedTickets();

    if (
      asyncBookings.length === 0 &&
      asyncQuotes.length === 0 &&
      asyncPersistedQuotes.length === 0 &&
      asyncInvoices.length === 0 &&
      asyncPersistedInvoices.length === 0 &&
      asyncDocs.length === 0 &&
      asyncPersistedDocs.length === 0 &&
      asyncApps.length === 0 &&
      asyncTickets.length === 0
    ) {
      console.log('✓ PASS: Empty Supabase query results propagate empty state across all store readers');
    } else {
      console.error('✗ FAIL: Async store readers returned non-empty arrays for empty database tables', {
        asyncBookings: asyncBookings.length,
        asyncQuotes: asyncQuotes.length,
        asyncInvoices: asyncInvoices.length,
        asyncDocs: asyncDocs.length,
        asyncApps: asyncApps.length,
        asyncTickets: asyncTickets.length,
      });
      failures++;
    }

    // 8d. Verify genuine Supabase errors throw descriptive errors and never return mock data
    const errorMockClient = createMockSupabase({
      bookings: { data: null, error: { message: 'Database connection failed' } },
      quotes: { data: null, error: { message: 'Database connection failed' } },
      invoices: { data: null, error: { message: 'Database connection failed' } },
      documents: { data: null, error: { message: 'Database connection failed' } },
      standby_applications: { data: null, error: { message: 'Database connection failed' } },
      support_tickets: { data: null, error: { message: 'Database connection failed' } },
    });
    setCustomSupabaseClient(errorMockClient);

    let errorBookingCaught = false;
    try {
      await getPersistedBookings();
    } catch (e: any) {
      if (e?.message?.includes('Database connection failed')) {
        errorBookingCaught = true;
      }
    }

    let errorQuotesCaught = false;
    try {
      await fetchPersistedQuotes();
    } catch (e: any) {
      if (e?.message?.includes('Database connection failed')) {
        errorQuotesCaught = true;
      }
    }

    let errorInvoicesCaught = false;
    try {
      await fetchPersistedInvoices();
    } catch (e: any) {
      if (e?.message?.includes('Database connection failed')) {
        errorInvoicesCaught = true;
      }
    }

    let errorDocsCaught = false;
    try {
      await fetchPersistedDocuments();
    } catch (e: any) {
      if (e?.message?.includes('Database connection failed')) {
        errorDocsCaught = true;
      }
    }

    let errorAppsCaught = false;
    try {
      await getPersistedApplications();
    } catch (e: any) {
      if (e?.message?.includes('Database connection failed')) {
        errorAppsCaught = true;
      }
    }

    let errorTicketsCaught = false;
    try {
      await getPersistedTickets();
    } catch (e: any) {
      if (e?.message?.includes('Database connection failed')) {
        errorTicketsCaught = true;
      }
    }

    if (
      errorBookingCaught &&
      errorQuotesCaught &&
      errorInvoicesCaught &&
      errorDocsCaught &&
      errorAppsCaught &&
      errorTicketsCaught
    ) {
      console.log('✓ PASS: Genuine Supabase errors safely throw descriptive errors and never silently display demo data');
    } else {
      console.error('✗ FAIL: Genuine database errors were swallowed or returned mock data', {
        errorBookingCaught,
        errorQuotesCaught,
        errorInvoicesCaught,
        errorDocsCaught,
        errorAppsCaught,
        errorTicketsCaught,
      });
      failures++;
    }

    // 8e. Legitimate user-created records in localStorage are preserved by sanitizer
    const realBooking = {
      id: 'NT-99999',
      reference: 'NT-99999',
      date: 'Today',
      origin: 'Sheffield S1 1AA',
      destination: 'Leeds LS1 1AA',
      vehicle: 'Small Van',
      total: 120,
      status: 'SCHEDULED' as const,
      progress: 0,
    };
    localStorage.setItem('neo_portal_bookings', JSON.stringify([realBooking]));
    const userBookings = getStoredBookings();
    if (userBookings.length === 1 && userBookings[0].reference === 'NT-99999') {
      console.log('✓ PASS: Legitimate customer records in localStorage are preserved by sanitizer');
    } else {
      console.error('✗ FAIL: Customer booking was inappropriately stripped', userBookings);
      failures++;
    }

    // 8f. Verify demo fallback is preserved ONLY when explicitly permitted and Supabase disconnected
    setDemoModeOverrideForTesting(true);
    setCustomSupabaseClient(null);
    localStorage.clear();

    const demoBookings = getStoredBookings();
    const demoQuotes = getStoredQuotes();
    const demoInvoices = getStoredInvoices();
    const demoDocs = getStoredDocuments();

    if (
      demoBookings.length === INITIAL_BOOKINGS.length &&
      demoQuotes.length === INITIAL_QUOTES.length &&
      demoInvoices.length === INITIAL_INVOICES.length &&
      demoDocs.length === INITIAL_DOCUMENTS.length
    ) {
      console.log('✓ PASS: Demo fallback is preserved when demo mode is explicitly enabled without Supabase');
    } else {
      console.error('✗ FAIL: Demo mode fallback failed when explicitly permitted');
      failures++;
    }

    // 8g. Verify getPersistedBookings preserves company_id from Supabase row
    setDemoModeOverrideForTesting(false);
    const mockClientWithCompany = {
      from: (table: string) => ({
        select: () => ({
          order: () => Promise.resolve({
            data: [
              {
                id: 'NT-24817',
                company_id: 'comp-meridian-001',
                pickup: 'Manchester M17 1AB',
                dropoff: 'Birmingham B6 7EU',
                vehicle: 'Sprinter LWB',
                total_gbp: 248,
                status: 'In transit',
                date_label: '02 Aug 2026',
              },
            ],
            error: null,
          }),
        }),
      }),
    };
    setCustomSupabaseClient(mockClientWithCompany as any);
    const bookingsWithCompany = await getPersistedBookings();
    if (
      bookingsWithCompany.length === 1 &&
      bookingsWithCompany[0].company_id === 'comp-meridian-001' &&
      bookingsWithCompany[0].reference === 'NT-24817'
    ) {
      console.log('✓ PASS: getPersistedBookings preserves company_id and reference from database row');
    } else {
      console.error('✗ FAIL: getPersistedBookings did not preserve company_id', bookingsWithCompany);
      failures++;
    }

    // 8h. Verify addDocument preserves company_id and booking_id on insert
    let lastInsertedDoc: any = null;
    const mockClientDocSuccess = {
      from: (table: string) => ({
        insert: (payload: any) => {
          lastInsertedDoc = payload;
          return Promise.resolve({ error: null });
        },
      }),
    };
    setCustomSupabaseClient(mockClientDocSuccess as any);
    localStorage.clear();
    const testDoc = {
      id: 'doc-test-101',
      title: 'Signed POD (NT-24817)',
      type: 'POD',
      date: 'Today',
      category: 'pod' as const,
      pdf_url: 'comp-meridian-001/123456789_signed_pod.pdf',
    };
    await addDocument(testDoc, 'comp-meridian-001', 'NT-24817');
    if (
      lastInsertedDoc &&
      lastInsertedDoc.company_id === 'comp-meridian-001' &&
      lastInsertedDoc.booking_id === 'NT-24817' &&
      lastInsertedDoc.file_url === 'comp-meridian-001/123456789_signed_pod.pdf'
    ) {
      console.log('✓ PASS: addDocument forwards company_id, booking_id, and persistent storagePath to Supabase');
    } else {
      console.error('✗ FAIL: addDocument payload mapping failed', lastInsertedDoc);
      failures++;
    }

    // 8i. Verify addDocument never leaves a false local document record when database insert fails
    const mockClientDocFail = {
      from: (table: string) => ({
        insert: () => Promise.resolve({ error: { message: 'Database insert rejected by RLS' } }),
      }),
    };
    setCustomSupabaseClient(mockClientDocFail as any);
    localStorage.clear();
    let insertFailedAsExpected = false;
    try {
      await addDocument(
        {
          id: 'doc-should-fail',
          title: 'Failed Document',
          type: 'POD',
          date: 'Today',
          category: 'pod' as const,
          pdf_url: 'comp-meridian-001/failed.pdf',
        },
        'comp-meridian-001',
        'NT-24817'
      );
    } catch {
      insertFailedAsExpected = true;
    }
    const docsAfterFailure = getStoredDocuments();
    if (insertFailedAsExpected && docsAfterFailure.length === 0) {
      console.log('✓ PASS: addDocument throws on DB error and avoids leaving false local document records');
    } else {
      console.error('✗ FAIL: addDocument left false local record or failed to throw', {
        insertFailedAsExpected,
        docsAfterFailure,
      });
      failures++;
    }

    // 8j. Verify removeDocumentFile handles demo/invalid paths without throwing
    let cleanupSafe = false;
    try {
      await removeDocumentFile('demo/sample.pdf');
      await removeDocumentFile('');
      await removeDocumentFile('blob:http://localhost:3000/123');
      cleanupSafe = true;
    } catch (e) {
      console.error('✗ FAIL: removeDocumentFile threw on safe/demo paths', e);
    }
    if (cleanupSafe) {
      console.log('✓ PASS: removeDocumentFile safely ignores non-remote demo and blob paths');
    } else {
      failures++;
    }

    // Clean up test overrides
    setDemoModeOverrideForTesting(null);
    setCustomSupabaseClient(null);
    localStorage.clear();

    // SECTION 9: Spoke Smoke-Test Claims Migration Security & Privilege Integrity
    console.log('\n--- Testing Spoke Smoke-Test Claims Migration Security & Privilege Integrity ---');
    const migrationPath = path.resolve(process.cwd(), 'supabase/legacy_migrations/20261019_spoke_smoke_test_claims.sql');
    if (!fs.existsSync(migrationPath)) {
      console.error('✗ FAIL: Migration file 20261019_spoke_smoke_test_claims.sql not found at', migrationPath);
      failures++;
    } else {
      const sqlContent = fs.readFileSync(migrationPath, 'utf8');

      // 9a. Verify explicit table DML privileges granted to authenticated
      const hasAuthGrant = /GRANT\s+SELECT,\s*INSERT,\s*UPDATE\s+ON\s+public\.spoke_smoke_test_claims\s+TO\s+authenticated;/i.test(sqlContent);
      if (hasAuthGrant) {
        console.log('✓ PASS: Migration grants explicit SELECT, INSERT, UPDATE privileges on spoke_smoke_test_claims to authenticated');
      } else {
        console.error('✗ FAIL: Migration missing explicit SELECT, INSERT, UPDATE grant to authenticated');
        failures++;
      }

      // 9b. Verify service_role full administrative grant
      const hasServiceRoleGrant = /GRANT\s+ALL\s+ON\s+public\.spoke_smoke_test_claims\s+TO\s+service_role;/i.test(sqlContent);
      if (hasServiceRoleGrant) {
        console.log('✓ PASS: Migration grants full administrative table privileges to service_role');
      } else {
        console.error('✗ FAIL: Migration missing explicit GRANT ALL to service_role');
        failures++;
      }

      // 9c. Verify explicit revokes from PUBLIC and anon
      const hasPublicRevoke = /REVOKE\s+ALL\s+ON\s+public\.spoke_smoke_test_claims\s+FROM\s+PUBLIC;/i.test(sqlContent);
      const hasAnonRevoke = /REVOKE\s+ALL\s+ON\s+public\.spoke_smoke_test_claims\s+FROM\s+anon;/i.test(sqlContent);
      if (hasPublicRevoke && hasAnonRevoke) {
        console.log('✓ PASS: Migration explicitly revokes all privileges from PUBLIC and anon roles');
      } else {
        console.error('✗ FAIL: Migration missing explicit REVOKE from PUBLIC or anon', { hasPublicRevoke, hasAnonRevoke });
        failures++;
      }

      // 9d. Verify RLS is enabled and policies enforce active admin requirement
      const hasRlsEnabled = /ALTER\s+TABLE\s+public\.spoke_smoke_test_claims\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/i.test(sqlContent);
      const usesIsAdminInAllPolicies = (sqlContent.match(/public\.is_admin\(\)/g) || []).length >= 3;
      if (hasRlsEnabled && usesIsAdminInAllPolicies) {
        console.log('✓ PASS: Row Level Security enabled and all policies strictly enforce public.is_admin()');
      } else {
        console.error('✗ FAIL: RLS not enabled or policies do not enforce public.is_admin()', { hasRlsEnabled, usesIsAdminInAllPolicies });
        failures++;
      }

      // 9e. Verify DELETE privilege is NOT granted to authenticated
      const uncommentedSql = sqlContent.replace(/--.*$/gm, '');
      const hasAuthDelete = /GRANT\s+[^;]*\bDELETE\b[^;]*TO\s+authenticated/i.test(uncommentedSql);
      if (!hasAuthDelete) {
        console.log('✓ PASS: DELETE privilege is strictly withheld from authenticated users to preserve idempotency audit');
      } else {
        console.error('✗ FAIL: Insecure DELETE privilege granted to authenticated users in migration');
        failures++;
      }
    }

    // SECTION 10: Spoke Smoke-Test Claims Permissions Hardening Migration Verification
    console.log('\n--- Testing Spoke Smoke-Test Claims Follow-Up Permissions Migration ---');
    const permMigrationPath = path.resolve(process.cwd(), 'supabase/legacy_migrations/20261019013400_spoke_smoke_test_claims_permissions.sql');
    if (!fs.existsSync(permMigrationPath)) {
      console.error('✗ FAIL: Follow-up migration file 20261019013400_spoke_smoke_test_claims_permissions.sql not found at', permMigrationPath);
      failures++;
    } else {
      const permSql = fs.readFileSync(permMigrationPath, 'utf8');
      const uncommentedPermSql = permSql.replace(/--.*$/gm, '');

      // 10a. Verify revocation of all table privileges from authenticated prior to re-granting
      const hasAuthRevoke = /REVOKE\s+ALL\s+ON\s+public\.spoke_smoke_test_claims\s+FROM\s+authenticated;/i.test(permSql);
      if (hasAuthRevoke) {
        console.log('✓ PASS: Follow-up migration explicitly revokes all existing privileges from authenticated');
      } else {
        console.error('✗ FAIL: Follow-up migration missing explicit REVOKE ALL from authenticated');
        failures++;
      }

      // 10b. Verify explicit least-privilege table grant (SELECT, INSERT, UPDATE) to authenticated
      const hasAuthGrant = /GRANT\s+SELECT,\s*INSERT,\s*UPDATE\s+ON\s+public\.spoke_smoke_test_claims\s+TO\s+authenticated;/i.test(permSql);
      if (hasAuthGrant) {
        console.log('✓ PASS: Follow-up migration grants only SELECT, INSERT, UPDATE to authenticated');
      } else {
        console.error('✗ FAIL: Follow-up migration missing explicit GRANT SELECT, INSERT, UPDATE to authenticated');
        failures++;
      }

      // 10c. Verify revokes from PUBLIC and anon
      const hasPublicRevoke = /REVOKE\s+ALL\s+ON\s+public\.spoke_smoke_test_claims\s+FROM\s+PUBLIC;/i.test(permSql);
      const hasAnonRevoke = /REVOKE\s+ALL\s+ON\s+public\.spoke_smoke_test_claims\s+FROM\s+anon;/i.test(permSql);
      if (hasPublicRevoke && hasAnonRevoke) {
        console.log('✓ PASS: Follow-up migration explicitly revokes all privileges from PUBLIC and anon');
      } else {
        console.error('✗ FAIL: Follow-up migration missing explicit REVOKE ALL from PUBLIC or anon');
        failures++;
      }

      // 10d. Verify service_role full administrative table grant is preserved
      const hasServiceRoleGrant = /GRANT\s+ALL\s+ON\s+public\.spoke_smoke_test_claims\s+TO\s+service_role;/i.test(permSql);
      if (hasServiceRoleGrant) {
        console.log('✓ PASS: Follow-up migration preserves GRANT ALL for service_role');
      } else {
        console.error('✗ FAIL: Follow-up migration missing GRANT ALL for service_role');
        failures++;
      }

      // Helper function to audit table grants for a specified role across single and multi-role statements
      function auditTableGrantsForRole(
        sql: string,
        tablePattern: RegExp,
        targetRole: string,
        allowedPrivileges: Set<string>
      ): {
        statementsFound: number;
        violations: Array<{ statement: string; disallowedPrivileges: string[] }>;
      } {
        const uncommented = sql.replace(/--.*$/gm, '');
        const grantRegex = /\bGRANT\s+([\s\S]*?)\s+ON\s+([\s\S]*?)\s+TO\s+([\s\S]*?)(?:;|$)/gi;
        const matches = Array.from(uncommented.matchAll(grantRegex));

        let statementsFound = 0;
        const violations: Array<{ statement: string; disallowedPrivileges: string[] }> = [];

        for (const match of matches) {
          const rawStatement = match[0].trim();
          const privClause = match[1].trim();
          const targetClause = match[2].trim();
          const granteesClause = match[3].trim();

          if (!tablePattern.test(targetClause)) {
            continue;
          }

          // Detect whether WITH GRANT OPTION is present on this statement
          const hasGrantOption = /\bWITH\s+GRANT\s+OPTION\b/i.test(granteesClause);

          // Clean grantee names by stripping trailing PostgreSQL GRANT clauses (WITH GRANT OPTION, GRANTED BY ...)
          const cleanedGranteesClause = granteesClause
            .replace(/\bWITH\s+GRANT\s+OPTION\b/gi, '')
            .replace(/\bGRANTED\s+BY\s+\S+\b/gi, '')
            .trim();

          const grantees = cleanedGranteesClause
            .split(',')
            .map((g) => g.trim().toLowerCase())
            .filter(Boolean);

          if (!grantees.includes(targetRole.toLowerCase())) {
            continue;
          }

          statementsFound++;
          const disallowedInStatement: string[] = [];

          // Disallow WITH GRANT OPTION for the target role
          if (hasGrantOption) {
            disallowedInStatement.push('WITH GRANT OPTION');
          }

          if (/\bALL(?:\s+PRIVILEGES)?\b/i.test(privClause)) {
            disallowedInStatement.push('ALL');
          }

          const rawPrivs = privClause.split(',').map((p) => p.trim().toUpperCase());
          for (const p of rawPrivs) {
            if (p === 'ALL' || p === 'ALL PRIVILEGES') {
              if (!disallowedInStatement.includes('ALL')) {
                disallowedInStatement.push('ALL');
              }
            } else if (!allowedPrivileges.has(p)) {
              if (!disallowedInStatement.includes(p)) {
                disallowedInStatement.push(p);
              }
            }
          }

          if (disallowedInStatement.length > 0) {
            violations.push({
              statement: rawStatement,
              disallowedPrivileges: disallowedInStatement,
            });
          }
        }

        return { statementsFound, violations };
      }

      // 10e. Verify complete least-privilege grant allowlist for authenticated (only SELECT, INSERT, UPDATE permitted)
      // Inspects every GRANT statement targeting public.spoke_smoke_test_claims, determining whether authenticated
      // is among its grantees (including comma-separated multi-role lists and WITH GRANT OPTION statements).
      const ALLOWED_AUTH_PRIVILEGES = new Set(['SELECT', 'INSERT', 'UPDATE']);
      const authAudit = auditTableGrantsForRole(
        permSql,
        /\b(?:TABLE\s+)?public\.spoke_smoke_test_claims\b/i,
        'authenticated',
        ALLOWED_AUTH_PRIVILEGES
      );

      if (authAudit.statementsFound > 0 && authAudit.violations.length === 0) {
        console.log('✓ PASS: Authenticated role grant strictly adheres to least-privilege allowlist (SELECT, INSERT, UPDATE); all other privileges (DELETE, TRUNCATE, REFERENCES, TRIGGER, ALL) and WITH GRANT OPTION strictly denied across all single and multi-role statements');
      } else {
        console.error('✗ FAIL: Disallowed privilege(s) or zero grants detected for authenticated in follow-up migration:', authAudit);
        failures++;
      }

      // 10e-regression-1: Demonstrates that a disallowed privilege in a multi-role GRANT is caught and rejected
      const syntheticMultiRoleSql = 'GRANT SELECT, DELETE ON public.spoke_smoke_test_claims TO service_role, authenticated;';
      const regressionAudit1 = auditTableGrantsForRole(
        syntheticMultiRoleSql,
        /\b(?:TABLE\s+)?public\.spoke_smoke_test_claims\b/i,
        'authenticated',
        ALLOWED_AUTH_PRIVILEGES
      );
      if (regressionAudit1.violations.length === 1 && regressionAudit1.violations[0].disallowedPrivileges.includes('DELETE')) {
        console.log('✓ PASS: Regression test 1 verified: auditor strictly catches disallowed privileges in multi-role GRANT statements');
      } else {
        console.error('✗ FAIL: Auditor failed to catch disallowed privilege in multi-role GRANT statement regression case');
        failures++;
      }

      // 10e-regression-2: Demonstrates that WITH GRANT OPTION is recognized and rejected for authenticated
      const syntheticGrantOptionSql = 'GRANT SELECT ON public.spoke_smoke_test_claims TO authenticated WITH GRANT OPTION;';
      const regressionAudit2 = auditTableGrantsForRole(
        syntheticGrantOptionSql,
        /\b(?:TABLE\s+)?public\.spoke_smoke_test_claims\b/i,
        'authenticated',
        ALLOWED_AUTH_PRIVILEGES
      );
      if (
        regressionAudit2.statementsFound === 1 &&
        regressionAudit2.violations.length === 1 &&
        regressionAudit2.violations[0].disallowedPrivileges.includes('WITH GRANT OPTION')
      ) {
        console.log('✓ PASS: Regression test 2 verified: auditor strictly recognizes and rejects WITH GRANT OPTION for authenticated');
      } else {
        console.error('✗ FAIL: Auditor failed to recognize or reject WITH GRANT OPTION in regression case', regressionAudit2);
        failures++;
      }

      // 10f. Verify RLS policies are preserved and NOT altered or dropped
      const dropsPolicies = /DROP\s+POLICY/i.test(uncommentedPermSql);
      const altersPolicies = /ALTER\s+POLICY/i.test(uncommentedPermSql);
      if (!dropsPolicies && !altersPolicies) {
        console.log('✓ PASS: Follow-up migration preserves existing RLS policies without modification');
      } else {
        console.error('✗ FAIL: Follow-up migration unexpectedly drops or alters RLS policies');
        failures++;
      }
    }

    // SECTION 11: Public Table Privilege Hardening Migration Static Verification
    console.log('\n--- Testing Public Table Privilege Hardening Migration ---');
    const tableHardenMigrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261019090000_harden_public_table_privileges.sql');
    if (!fs.existsSync(tableHardenMigrationPath)) {
      console.error('✗ FAIL: Table privilege hardening migration file 20261019090000_harden_public_table_privileges.sql not found at', tableHardenMigrationPath);
      failures++;
    } else {
      const hardenSql = fs.readFileSync(tableHardenMigrationPath, 'utf8');
      const uncommentedHardenSql = hardenSql.replace(/--.*$/gm, '');

      // 11a. Verify safe DO block revokes TRUNCATE, REFERENCES, TRIGGER, MAINTAIN from anon and authenticated across public tables
      const hasDoBlock = /DO\s+\$\$/i.test(uncommentedHardenSql);
      const iteratesPublicTables = /pg_class/i.test(uncommentedHardenSql) &&
        /pg_namespace/i.test(uncommentedHardenSql) &&
        /nspname\s*=\s*'public'/i.test(uncommentedHardenSql) &&
        /relkind\s+IN\s*\(\s*'r'\s*,\s*'p'\s*\)/i.test(uncommentedHardenSql);
      const usesQuotedFormat = /format\s*\(\s*'REVOKE[^']*%I\.%I[^']*'\s*,\s*'public'/i.test(uncommentedHardenSql);
      const revokesFourPrivileges = /REVOKE\s+TRUNCATE,\s*REFERENCES,\s*TRIGGER,\s*MAINTAIN\s+ON\s+TABLE/i.test(uncommentedHardenSql) &&
        /FROM\s+(anon,\s*authenticated|authenticated,\s*anon)/i.test(uncommentedHardenSql);

      if (hasDoBlock && iteratesPublicTables && usesQuotedFormat && revokesFourPrivileges) {
        console.log('✓ PASS: Migration uses safe DO block to revoke TRUNCATE, REFERENCES, TRIGGER, and MAINTAIN on all public tables from anon and authenticated');
      } else {
        console.error('✗ FAIL: Migration missing safe DO block or complete privilege revocation for public tables', {
          hasDoBlock,
          iteratesPublicTables,
          usesQuotedFormat,
          revokesFourPrivileges,
        });
        failures++;
      }

      // 11b. Verify admin_audit_logs UPDATE and DELETE are revoked from anon and authenticated
      const revokesAuditLogMutations = /REVOKE\s+UPDATE,\s*DELETE\s+ON\s+(TABLE\s+)?public\.admin_audit_logs\s+FROM\s+(anon,\s*authenticated|authenticated,\s*anon);/i.test(uncommentedHardenSql);
      const preservesAuditLogSelectInsert = !/REVOKE\s+[^;]*\b(SELECT|INSERT)\b[^;]*ON\s+(TABLE\s+)?public\.admin_audit_logs/i.test(uncommentedHardenSql);

      if (revokesAuditLogMutations && preservesAuditLogSelectInsert) {
        console.log('✓ PASS: Migration revokes UPDATE and DELETE on public.admin_audit_logs from anon and authenticated while preserving append-only grants');
      } else {
        console.error('✗ FAIL: Migration does not properly revoke UPDATE/DELETE on public.admin_audit_logs or improperly revokes SELECT/INSERT', {
          revokesAuditLogMutations,
          preservesAuditLogSelectInsert,
        });
        failures++;
      }

      // 11c. Verify future-table default privileges are revoked for anon and authenticated under role postgres
      const revokesFutureTableDefaults = /ALTER\s+DEFAULT\s+PRIVILEGES\s+FOR\s+ROLE\s+postgres\s+IN\s+SCHEMA\s+public\s+REVOKE\s+ALL\s+ON\s+TABLES\s+FROM\s+(anon,\s*authenticated|authenticated,\s*anon);/i.test(uncommentedHardenSql);
      if (revokesFutureTableDefaults) {
        console.log('✓ PASS: Migration revokes default table privileges for anon and authenticated on future tables created by role postgres in schema public');
      } else {
        console.error('✗ FAIL: Migration missing ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES for role postgres in schema public');
        failures++;
      }

      // 11d. Verify service_role defaults and grants are not revoked
      const revokesServiceRole = /REVOKE\s+[^;]*FROM\s+[^;]*\bservice_role\b/i.test(uncommentedHardenSql);
      if (!revokesServiceRole) {
        console.log('✓ PASS: Migration preserves all service_role privileges and default grants without any revokes');
      } else {
        console.error('✗ FAIL: Migration unexpectedly revokes privileges from service_role');
        failures++;
      }

      // 11e. Verify no SQL targets supabase_admin default privileges
      const targetsSupabaseAdmin = /supabase_admin/i.test(uncommentedHardenSql);
      if (!targetsSupabaseAdmin) {
        console.log('✓ PASS: Migration strictly avoids targeting supabase_admin default privileges');
      } else {
        console.error('✗ FAIL: Migration improperly targets or references supabase_admin in executable SQL');
        failures++;
      }

      // 11f. Verify RLS policies are preserved and NOT altered or dropped
      const dropsPolicies = /DROP\s+POLICY/i.test(uncommentedHardenSql);
      const altersPolicies = /ALTER\s+POLICY/i.test(uncommentedHardenSql);
      if (!dropsPolicies && !altersPolicies) {
        console.log('✓ PASS: Migration preserves existing RLS policies without modification');
      } else {
        console.error('✗ FAIL: Migration unexpectedly drops or alters RLS policies');
        failures++;
      }

      // 11g. Verify legacy migrations in supabase/legacy_migrations/ remain referenced by Sections 9 and 10
      const legacyClaimsExists = fs.existsSync(path.resolve(process.cwd(), 'supabase/legacy_migrations/20261019_spoke_smoke_test_claims.sql'));
      const legacyPermsExists = fs.existsSync(path.resolve(process.cwd(), 'supabase/legacy_migrations/20261019013400_spoke_smoke_test_claims_permissions.sql'));
      if (legacyClaimsExists && legacyPermsExists) {
        console.log('✓ PASS: Preserved legacy migrations in supabase/legacy_migrations/ remain intact and verifiable');
      } else {
        console.error('✗ FAIL: Preserved legacy migration files missing from supabase/legacy_migrations/', { legacyClaimsExists, legacyPermsExists });
        failures++;
      }
    }

    console.log('\n--- Final Test Suite Result ---');
    if (failures === 0) {
      console.log('ALL SECURITY HARDENING TESTS PASSED (0 failures)');
    } else {
      console.error(`TEST SUITE FAILED with ${failures} failure(s)`);
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal exception:', err);
  process.exit(1);
});

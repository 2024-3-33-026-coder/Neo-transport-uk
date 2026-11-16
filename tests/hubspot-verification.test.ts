/**
 * HUBSPOT CRM CONNECTION VERIFICATION TEST SUITE
 *
 * Validates:
 * 1. Server-side environment variable resolution (HUBSPOT_SERVICE_KEY).
 * 2. Official HubSpot CRM API with Bearer authentication (GET /crm/v3/objects/contacts?limit=1).
 * 3. Read-only constraint: No records are created, updated, or deleted; mutating operations are strictly locked.
 * 4. Admin-protected endpoints: GET /api/admin/hubspot/verify and GET /api/admin/crm/hubspot/verify.
 * 5. Rejection of unauthorized, unauthenticated, non-admin, and suspended callers (401/403).
 * 6. Missing configuration handling (503).
 * 7. Invalid credentials handling (clean error, connected: false).
 * 8. Successful verification handling (status: ok, connected: true).
 * 9. Absolute secret confidentiality: key is NEVER logged, exposed to frontend, or returned in payloads.
 */

import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import app, {
  setServerSupabaseClientForTesting,
  setHubSpotClientForTesting,
} from '../api/index.js';
import { HubSpotClient, hubspotClient } from '../api/hubspotClient.js';

function testRequest(
  server: http.Server,
  reqPath: string,
  method: string,
  headers: Record<string, string> = {},
  body?: string | Buffer | Record<string, any>
): Promise<{ status: number; data: any; rawBody: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as any;
    const port = address.port;

    const reqHeaders: Record<string, string> = { ...headers };
    let postBuffer: Buffer | undefined;

    if (body !== undefined) {
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        postBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
      } else {
        postBuffer = Buffer.from(JSON.stringify(body), 'utf8');
        if (!reqHeaders['Content-Type']) {
          reqHeaders['Content-Type'] = 'application/json';
        }
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
          resolve({ status: res.statusCode || 500, data: parsed, rawBody: raw, headers: res.headers });
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

async function runHubSpotVerificationTests() {
  console.log('\n========================================================================');
  console.log('=== STARTING HUBSPOT CRM CONNECTION VERIFICATION TEST SUITE ===');
  console.log('========================================================================\n');

  const originalNodeEnv = process.env.NODE_ENV;
  const originalHubSpotKey = process.env.HUBSPOT_SERVICE_KEY;
  process.env.NODE_ENV = 'test';

  const MOCK_SECRET_KEY = 'pat-na1-mock-hubspot-secret-key-1234567890abcdef';
  const recordedAudits: any[] = [];

  // Mock Supabase client for admin authentication
  const mockSupabaseClient = {
    auth: {
      getUser: async (token: string) => {
        if (token === 'admin-valid-token') {
          return { data: { user: { id: 'admin-user-1', email: 'admin@neo-transport.co.uk' } }, error: null };
        }
        if (token === 'customer-token') {
          return { data: { user: { id: 'cust-user-2', email: 'customer@client.com' } }, error: null };
        }
        if (token === 'suspended-admin-token') {
          return { data: { user: { id: 'suspended-user-3', email: 'suspended@neo-transport.co.uk' } }, error: null };
        }
        return { data: { user: null }, error: { message: 'Invalid or expired session token.' } };
      },
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              single: async () => {
                if (val === 'admin-user-1') {
                  return {
                    data: {
                      id: 'admin-user-1',
                      full_name: 'Fleet Duty Dispatcher',
                      email: 'admin@neo-transport.co.uk',
                      role: 'admin',
                      status: 'active',
                      company_id: 'neo-transport',
                    },
                    error: null,
                  };
                }
                if (val === 'cust-user-2') {
                  return {
                    data: {
                      id: 'cust-user-2',
                      full_name: 'Standard Customer',
                      email: 'customer@client.com',
                      role: 'customer',
                      status: 'active',
                      company_id: 'client-corp',
                    },
                    error: null,
                  };
                }
                if (val === 'suspended-user-3') {
                  return {
                    data: {
                      id: 'suspended-user-3',
                      full_name: 'Suspended Controller',
                      email: 'suspended@neo-transport.co.uk',
                      role: 'admin',
                      status: 'suspended',
                      company_id: 'neo-transport',
                    },
                    error: null,
                  };
                }
                return { data: null, error: { code: 'PGRST116', message: 'Profile not found' } };
              },
            }),
          }),
        };
      }
      if (table === 'admin_audit_logs') {
        return {
          insert: async (record: any) => {
            recordedAudits.push(record);
            return { error: null };
          },
        };
      }
      return {};
    },
  };

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    setServerSupabaseClientForTesting(mockSupabaseClient as any);

    // -------------------------------------------------------------------------
    // 1. HubSpot Client Unit Tests (api/hubspotClient.ts)
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing HubSpotClient Unit Functionality & Pure Logic ---');

    // 1.1 Missing configuration throws descriptive error
    delete process.env.HUBSPOT_SERVICE_KEY;
    const clientWithoutKey = new HubSpotClient({ apiKey: '' });
    await assert.rejects(
      async () => clientWithoutKey.checkConnectivity(),
      /HUBSPOT_SERVICE_KEY is not configured on the server environment/
    );
    console.log('✓ PASS 1.1: Missing service key throws non-sensitive configuration error');

    // 1.2 Uses Bearer authentication against official HubSpot CRM endpoint
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    const mockFetchSuccess: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedHeaders = (init?.headers || {}) as Record<string, string>;
      return new Response(JSON.stringify({ results: [], total: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const clientWithKey = new HubSpotClient({ apiKey: MOCK_SECRET_KEY, fetchFn: mockFetchSuccess });
    const successResult = await clientWithKey.checkConnectivity();

    assert.strictEqual(capturedUrl, 'https://api.hubapi.com/crm/v3/objects/contacts?limit=1');
    assert.strictEqual(capturedHeaders['Authorization'], `Bearer ${MOCK_SECRET_KEY}`);
    assert.strictEqual(capturedHeaders['Accept'], 'application/json');
    assert.strictEqual(successResult.connected, true);
    assert.strictEqual(successResult.status, 200);
    assert.strictEqual(successResult.message, 'HubSpot CRM connection verified successfully.');
    console.log('✓ PASS 1.2: Official HubSpot CRM API called with Bearer authentication and limit=1');

    // 1.3 Invalid credentials (HTTP 401 from HubSpot)
    const mockFetch401: typeof fetch = async () => {
      return new Response(
        JSON.stringify({ status: 'error', message: 'The token provided is invalid or expired', category: 'INVALID_AUTHENTICATION' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    };
    const clientInvalid = new HubSpotClient({ apiKey: 'invalid_token', fetchFn: mockFetch401 });
    const invalidResult = await clientInvalid.checkConnectivity();
    assert.strictEqual(invalidResult.connected, false);
    assert.strictEqual(invalidResult.status, 401);
    assert.ok(invalidResult.message.includes('HTTP 401: Invalid or expired service key'));
    console.log('✓ PASS 1.3: Invalid credentials safely identified without leaking secret');

    // 1.4 Forbidden / Insufficient scopes (HTTP 403 from HubSpot)
    const mockFetch403: typeof fetch = async () => {
      return new Response(JSON.stringify({ status: 'error', message: 'Forbidden' }), { status: 403 });
    };
    const clientForbidden = new HubSpotClient({ apiKey: MOCK_SECRET_KEY, fetchFn: mockFetch403 });
    const forbiddenResult = await clientForbidden.checkConnectivity();
    assert.strictEqual(forbiddenResult.connected, false);
    assert.strictEqual(forbiddenResult.status, 403);
    assert.ok(forbiddenResult.message.includes('HTTP 403: Forbidden or insufficient scopes'));
    console.log('✓ PASS 1.4: Insufficient scopes / forbidden response safely identified');

    // 1.5 Rate limit handling (HTTP 429 from HubSpot)
    const mockFetch429: typeof fetch = async () => {
      return new Response(JSON.stringify({ status: 'error', message: 'Rate limit' }), { status: 429 });
    };
    const clientRateLimited = new HubSpotClient({ apiKey: MOCK_SECRET_KEY, fetchFn: mockFetch429 });
    const rateLimitResult = await clientRateLimited.checkConnectivity();
    assert.strictEqual(rateLimitResult.connected, false);
    assert.strictEqual(rateLimitResult.status, 429);
    assert.ok(rateLimitResult.message.includes('HTTP 429: Too Many Requests'));
    console.log('✓ PASS 1.5: Upstream rate limit safely handled');

    // 1.6 Network failure handling (fetch exception)
    const mockFetchNetworkError: typeof fetch = async () => {
      throw new Error('EAI_AGAIN api.hubapi.com');
    };
    const clientNetworkError = new HubSpotClient({ apiKey: MOCK_SECRET_KEY, fetchFn: mockFetchNetworkError });
    const networkResult = await clientNetworkError.checkConnectivity();
    assert.strictEqual(networkResult.connected, false);
    assert.strictEqual(networkResult.status, 500);
    assert.ok(networkResult.message.includes('Failed to connect to HubSpot API'));
    console.log('✓ PASS 1.6: Network / DNS failures handled gracefully without crash');

    // 1.7 Mutating operations strictly locked (read-only constraint)
    await assert.rejects(
      async () => clientWithKey.createRecord(),
      /Mutating operations are strictly locked/
    );
    await assert.rejects(
      async () => clientWithKey.updateRecord(),
      /Mutating operations are strictly locked/
    );
    await assert.rejects(
      async () => clientWithKey.deleteRecord(),
      /Mutating operations are strictly locked/
    );
    console.log('✓ PASS 1.7: Mutating operations strictly locked and reject creation/modification/deletion');

    // -------------------------------------------------------------------------
    // 2. Server-Side Admin Authentication & Privilege Protection
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Admin Authentication & Privilege Enforcement ---');

    // 2.1 Unauthenticated request rejected with 401
    const unauthRes = await testRequest(server, '/api/admin/hubspot/verify', 'GET');
    assert.strictEqual(unauthRes.status, 401);
    assert.ok(unauthRes.data.error.includes('Authentication required'));
    console.log('✓ PASS 2.1: Unauthenticated request rejected with 401');

    // 2.2 Empty Bearer token rejected with 401
    const emptyBearerRes = await testRequest(server, '/api/admin/hubspot/verify', 'GET', {
      Authorization: 'Bearer ',
    });
    assert.strictEqual(emptyBearerRes.status, 401);
    assert.ok(emptyBearerRes.data.error);
    console.log('✓ PASS 2.2: Empty Bearer token rejected with 401');

    // 2.3 Invalid session token rejected with 401
    const invalidTokenRes = await testRequest(server, '/api/admin/hubspot/verify', 'GET', {
      Authorization: 'Bearer invalid-session-token-xyz',
    });
    assert.strictEqual(invalidTokenRes.status, 401);
    assert.ok(invalidTokenRes.data.error.includes('Invalid or expired session token'));
    console.log('✓ PASS 2.3: Invalid session token rejected with 401');

    // 2.4 Non-admin customer user rejected with 403
    const customerRes = await testRequest(server, '/api/admin/hubspot/verify', 'GET', {
      Authorization: 'Bearer customer-token',
    });
    assert.strictEqual(customerRes.status, 403);
    assert.ok(customerRes.data.error.includes('administrator privileges required'));
    console.log('✓ PASS 2.4: Non-admin customer user rejected with 403');

    // 2.5 Suspended admin caller rejected with 403
    const suspendedRes = await testRequest(server, '/api/admin/hubspot/verify', 'GET', {
      Authorization: 'Bearer suspended-admin-token',
    });
    assert.strictEqual(suspendedRes.status, 403);
    assert.ok(suspendedRes.data.error.includes('active administrator privileges required'));
    console.log('✓ PASS 2.5: Suspended admin caller rejected with 403');

    // -------------------------------------------------------------------------
    // 3. HTTP Endpoint Integration & Diagnostic Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing HTTP Verification Endpoint Scenarios ---');

    // 3.1 Missing configuration: When HUBSPOT_SERVICE_KEY is unset, returns 503
    delete process.env.HUBSPOT_SERVICE_KEY;
    setHubSpotClientForTesting(null); // Restore singleton reading process.env
    const missingConfigRes = await testRequest(server, '/api/admin/hubspot/verify', 'GET', {
      Authorization: 'Bearer admin-valid-token',
    });
    assert.strictEqual(missingConfigRes.status, 503);
    assert.strictEqual(missingConfigRes.data.status, 'error');
    assert.strictEqual(missingConfigRes.data.connected, false);
    assert.ok(missingConfigRes.data.error.includes('HUBSPOT_SERVICE_KEY is not configured on the server environment'));
    console.log('✓ PASS 3.1: Missing HUBSPOT_SERVICE_KEY returns 503 with clean descriptive error');

    // 3.2 Successful connection verification: Returns 200 with status: ok, connected: true
    setHubSpotClientForTesting(clientWithKey);
    const successEndpointRes = await testRequest(server, '/api/admin/hubspot/verify', 'GET', {
      Authorization: 'Bearer admin-valid-token',
    });
    assert.strictEqual(successEndpointRes.status, 200);
    assert.strictEqual(successEndpointRes.data.status, 'ok');
    assert.strictEqual(successEndpointRes.data.connected, true);
    assert.strictEqual(successEndpointRes.data.message, 'HubSpot CRM connection verified successfully.');
    console.log('✓ PASS 3.2: Valid connection verification returns 200 with status: ok, connected: true');

    // 3.3 Invalid credentials on external API: Returns 200 diagnostic with status: error, connected: false
    setHubSpotClientForTesting(clientInvalid);
    const invalidCredsEndpointRes = await testRequest(server, '/api/admin/hubspot/verify', 'GET', {
      Authorization: 'Bearer admin-valid-token',
    });
    assert.strictEqual(invalidCredsEndpointRes.status, 200);
    assert.strictEqual(invalidCredsEndpointRes.data.status, 'error');
    assert.strictEqual(invalidCredsEndpointRes.data.connected, false);
    assert.ok(invalidCredsEndpointRes.data.message.includes('HTTP 401: Invalid or expired service key'));
    console.log('✓ PASS 3.3: Invalid credentials returns diagnostic report with status: error, connected: false');

    // 3.4 Route alias: GET /api/admin/crm/hubspot/verify behaves identically
    const aliasRes = await testRequest(server, '/api/admin/crm/hubspot/verify', 'GET', {
      Authorization: 'Bearer admin-valid-token',
    });
    assert.strictEqual(aliasRes.status, 200);
    assert.strictEqual(aliasRes.data.status, 'error');
    assert.strictEqual(aliasRes.data.connected, false);
    console.log('✓ PASS 3.4: Route alias /api/admin/crm/hubspot/verify handled identically');

    // 3.5 Admin audit logging: Recorded in admin_audit_logs table
    const auditRecord = recordedAudits.find((a) => a.action === 'verify_hubspot_connectivity');
    assert.ok(auditRecord, 'Admin audit trail must record verify_hubspot_connectivity action');
    assert.strictEqual(auditRecord.target_entity, 'hubspot_crm');
    assert.strictEqual(auditRecord.admin_email, 'admin@neo-transport.co.uk');
    console.log('✓ PASS 3.5: Admin audit trail recorded without sensitive data');

    // -------------------------------------------------------------------------
    // 4. Secret Confidentiality & Frontend Code Isolation
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Secret Key Confidentiality & Frontend Isolation ---');

    // 4.1 Response payloads must NEVER contain the secret key
    const allResponses = [
      unauthRes.rawBody,
      emptyBearerRes.rawBody,
      invalidTokenRes.rawBody,
      customerRes.rawBody,
      suspendedRes.rawBody,
      missingConfigRes.rawBody,
      successEndpointRes.rawBody,
      invalidCredsEndpointRes.rawBody,
      aliasRes.rawBody,
    ];
    for (const bodyStr of allResponses) {
      assert.strictEqual(bodyStr.includes(MOCK_SECRET_KEY), false, 'Response payload must NEVER contain secret key');
    }
    console.log('✓ PASS 4.1: Secret key is never returned or leaked in HTTP response bodies');

    // 4.2 Audit log details must NEVER contain the secret key
    for (const log of recordedAudits) {
      const serializedLog = JSON.stringify(log);
      assert.strictEqual(serializedLog.includes(MOCK_SECRET_KEY), false, 'Audit log must NEVER contain secret key');
    }
    console.log('✓ PASS 4.2: Secret key is never written to database audit trail');

    // 4.3 Static check: Verify frontend code (src/) contains ZERO references to HUBSPOT_SERVICE_KEY
    const srcDir = path.resolve('src');
    function searchDir(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(searchDir(fullPath));
        } else if (/\.(ts|tsx|js|jsx|json|css|html)$/.test(file)) {
          results.push(fullPath);
        }
      }
      return results;
    }
    const srcFiles = searchDir(srcDir);
    for (const f of srcFiles) {
      const content = fs.readFileSync(f, 'utf8');
      assert.strictEqual(
        content.includes('HUBSPOT_SERVICE_KEY'),
        false,
        `Frontend file ${f} must NEVER reference HUBSPOT_SERVICE_KEY`
      );
      assert.strictEqual(
        content.includes('VITE_HUBSPOT'),
        false,
        `Frontend file ${f} must NEVER reference VITE_HUBSPOT`
      );
    }
    console.log(`✓ PASS 4.3: Frontend code (${srcFiles.length} files in src/) is completely isolated from HubSpot secrets`);

    // 4.4 Test injection helpers strictly reject calls outside test mode
    process.env.NODE_ENV = 'production';
    assert.throws(
      () => setHubSpotClientForTesting({} as any),
      /SECURITY VIOLATION/i,
      'setHubSpotClientForTesting must fail closed in production mode'
    );
    process.env.NODE_ENV = 'test';
    console.log('✓ PASS 4.4: Test injection helper strictly fails closed in production mode');

    console.log('\n========================================================================');
    console.log('=== ALL HUBSPOT VERIFICATION TESTS PASSED (0 failures) ===');
    console.log('========================================================================\n');
  } finally {
    setHubSpotClientForTesting(null);
    setServerSupabaseClientForTesting(null);
    process.env.NODE_ENV = originalNodeEnv;
    if (originalHubSpotKey !== undefined) {
      process.env.HUBSPOT_SERVICE_KEY = originalHubSpotKey;
    } else {
      delete process.env.HUBSPOT_SERVICE_KEY;
    }
    server.close();
  }
}

runHubSpotVerificationTests().catch((err) => {
  console.error('\n❌ HUBSPOT VERIFICATION TEST SUITE FAILED:', err);
  process.exit(1);
});

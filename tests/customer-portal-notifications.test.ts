/**
 * CUSTOMER PORTAL NOTIFICATIONS & DELIVERY DIAGNOSTICS REGRESSION TEST SUITE
 *
 * Verifies:
 * 1. Customer in-app notifications are contextually derived from real bookings and outbox events.
 * 2. Unread count and read state persistence (localStorage) work accurately.
 * 3. Individual notification click-to-read and "Mark all read" operations.
 * 4. GET /api/notifications/in-app returns filtered customer notifications.
 * 5. POST /api/notifications/test-delivery enforces security and executes controlled test delivery.
 * 6. Vercel cron configuration in vercel.json is present and targets /api/notifications/process.
 */

import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import app, {
  setEmailAdapterForTesting,
  resetEmailAdapterForTesting,
  setServerSupabaseClientForTesting,
  MockEmailAdapter,
} from '../api/index.js';
import {
  fetchCustomerNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getStoredReadNotificationIds,
  STORAGE_READ_NOTIFICATIONS_KEY,
} from '../src/lib/portalStore.ts';
import { Booking } from '../src/types.ts';

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
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let parsed: any = raw;
          try {
            parsed = JSON.parse(raw);
          } catch {
            // Keep raw text
          }
          resolve({ status: res.statusCode || 500, data: parsed });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

const sampleBookings: Booking[] = [
  {
    id: 'NT-25101',
    reference: 'NT-25101',
    date: 'Today',
    origin: 'Manchester M17 1AB',
    destination: 'Birmingham B6 7EU',
    vehicle: 'Sprinter LWB',
    total: 285,
    status: 'IN TRANSIT',
    payment_method: 'standby-account',
    payment_status: 'standby_terms',
    amount_paid_gbp: 0,
    cargo: 'Precision aerospace fasteners',
    weightKg: 400,
    palletCount: 1,
    pickupTime: 'Now',
    deliveryTime: '88 min',
    progress: 0.45,
    driver: {
      name: 'Marek Kowalski',
      phone: '07700 900123',
      vehicleModel: 'Mercedes Sprinter LWB',
      registration: 'GN71 XPO',
      status: 'En Route',
    },
  },
  {
    id: 'NT-25102',
    reference: 'NT-25102',
    date: 'Yesterday',
    origin: 'Leeds LS1 1AA',
    destination: 'Sheffield S1 1AA',
    vehicle: 'Small Van',
    total: 115,
    status: 'DELIVERED',
    payment_method: 'card',
    payment_status: 'paid',
    amount_paid_gbp: 115,
    cargo: 'Lab samples',
    weightKg: 50,
    palletCount: 1,
    pickupTime: '10:00',
    deliveryTime: '11:15',
    progress: 1.0,
  },
  {
    id: 'NT-25103',
    reference: 'NT-25103',
    date: 'Today',
    origin: 'Bristol BS1 1AA',
    destination: 'London E1 6AN',
    vehicle: 'Luton Box with Tail Lift',
    total: 395,
    status: 'SCHEDULED',
    payment_method: 'standby-account',
    payment_status: 'standby_terms',
    amount_paid_gbp: 0,
    cargo: 'Commercial catering equipment',
    weightKg: 800,
    palletCount: 2,
    pickupTime: '14:00',
    deliveryTime: '17:00',
    progress: 0.05,
  },
];

async function runTests() {
  process.env.NODE_ENV = "test";
  console.log('=================================================================');
  console.log('STARTING CUSTOMER PORTAL NOTIFICATIONS & DELIVERY TESTS');
  console.log('=================================================================');

  const mockEmail = new MockEmailAdapter();
  setEmailAdapterForTesting(mockEmail);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    // ---------------------------------------------------------------------------
    // TEST 1: Contextual Notification Derivation from Real Bookings
    // ---------------------------------------------------------------------------
    console.log('\n--- 1. Testing Contextual In-App Notification Derivation ---');
    localStorage.clear();

    const notifs = await fetchCustomerNotifications('comp-meridian-001', 'ops@meridian.co.uk', sampleBookings);

    assert(notifs.length >= 3, `Must derive notifications for bookings. Got ${notifs.length}`);
    const inTransitNotif = notifs.find((n) => n.bookingId === 'NT-25101');
    assert(inTransitNotif, 'Must contain in-transit notification for NT-25101');
    assert.strictEqual(inTransitNotif.category, 'booking');
    assert(inTransitNotif.message.includes('Marek Kowalski'), 'Must include driver name in message');
    assert.strictEqual(inTransitNotif.read, false, 'Initial state must be unread');

    const deliveredNotif = notifs.find((n) => n.bookingId === 'NT-25102' && n.category === 'booking');
    assert(deliveredNotif, 'Must contain delivered notification for NT-25102');
    assert(deliveredNotif.title.includes('Delivered'), 'Title must report delivered');

    const paymentNotif = notifs.find((n) => n.bookingId === 'NT-25102' && n.category === 'invoice');
    assert(paymentNotif, 'Must contain payment confirmation notification for NT-25102');
    assert(paymentNotif.title.includes('Payment Confirmed'), 'Title must report payment confirmed');
    console.log('✓ PASS: In-app notifications accurately derived from real booking statuses and payment states');

    // ---------------------------------------------------------------------------
    // TEST 2: Read State Persistence and Unread Count Management
    // ---------------------------------------------------------------------------
    console.log('\n--- 2. Testing Read State Persistence (localStorage) ---');
    let unreadCount = notifs.filter((n) => !n.read).length;
    assert.strictEqual(unreadCount, notifs.length, 'All notifications must initially be unread');

    // Mark single notification as read
    markNotificationAsRead(inTransitNotif.id);
    const readIdsAfterOne = getStoredReadNotificationIds();
    assert(readIdsAfterOne.includes(inTransitNotif.id), 'Stored read IDs must include marked ID');

    // Reload notifications to verify persistence
    const reloadedNotifs = await fetchCustomerNotifications('comp-meridian-001', 'ops@meridian.co.uk', sampleBookings);
    const inTransitReloaded = reloadedNotifs.find((n) => n.id === inTransitNotif.id);
    assert.strictEqual(inTransitReloaded?.read, true, 'Marked notification must be read on reload');

    const newUnreadCount = reloadedNotifs.filter((n) => !n.read).length;
    assert.strictEqual(newUnreadCount, unreadCount - 1, 'Unread count must decrement by 1');

    // Mark all as read
    markAllNotificationsAsRead(reloadedNotifs.map((n) => n.id));
    const allReadReloaded = await fetchCustomerNotifications('comp-meridian-001', 'ops@meridian.co.uk', sampleBookings);
    const finalUnreadCount = allReadReloaded.filter((n) => !n.read).length;
    assert.strictEqual(finalUnreadCount, 0, 'Unread count must be 0 after Mark All Read');
    console.log('✓ PASS: Read state cleanly persists in localStorage and correctly updates unread counts');

    // ---------------------------------------------------------------------------
    // TEST 3: GET /api/notifications/in-app Server Feed Endpoint
    // ---------------------------------------------------------------------------
    console.log('\n--- 3. Testing GET /api/notifications/in-app Server Endpoint ---');
    const mockDbForInApp = {
      from: (table: string) => {
        if (table === 'notifications_outbox') {
          return {
            select: () => ({
              order: () => ({
                limit: () => ({
                  or: () => Promise.resolve({
                    data: [
                      {
                        id: 'notif-row-1',
                        event_type: 'booking_confirmed',
                        recipient_role: 'customer',
                        subject: 'Booking NT-25101 Confirmed',
                        payload: { bookingId: 'NT-25101' },
                        created_at: new Date().toISOString(),
                        status: 'pending',
                        booking_id: 'NT-25101',
                      },
                    ],
                    error: null,
                  }),
                  eq: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        return { select: () => Promise.resolve({ data: [], error: null }) };
      },
    };

    setServerSupabaseClientForTesting(mockDbForInApp as any);

    const feedRes = await testRequest(
      server,
      '/api/notifications/in-app?company_id=comp-meridian-001&email=ops@meridian.co.uk',
      'GET'
    );

    assert.strictEqual(feedRes.status, 200, `Feed endpoint must return 200. Got: ${feedRes.status}`);
    assert(Array.isArray(feedRes.data.notifications), 'Response must contain notifications array');
    assert.strictEqual(feedRes.data.notifications.length, 1, 'Must return seeded notification');
    console.log(`✓ PASS: GET /api/notifications/in-app returns structured notification array (count: ${feedRes.data.notifications.length})`);

    // ---------------------------------------------------------------------------
    // TEST 4: POST /api/notifications/test-delivery Controlled Delivery Verification
    // ---------------------------------------------------------------------------
    console.log('\n--- 4. Testing Controlled Test Delivery Endpoint ---');
    process.env.NEO_WORKER_SECRET = 'test-worker-secret-notifs';

    // 4A: Unauthorized caller rejected
    const unauthRes = await testRequest(server, '/api/notifications/test-delivery', 'POST', {}, {
      recipient: 'test@example.com',
    });
    assert.strictEqual(unauthRes.status, 401, 'Must reject unauthorized request with 401');

    // 4B: Authorized worker execution delivers controlled diagnostic email
    const authRes = await testRequest(
      server,
      '/api/notifications/test-delivery',
      'POST',
      { Authorization: 'Bearer test-worker-secret-notifs' },
      { recipient: 'ops@neotransport.co.uk' }
    );

    assert.strictEqual(authRes.status, 200, `Test delivery must return 200. Got: ${authRes.status}`);
    assert.strictEqual(authRes.data.success, true, 'Delivery must succeed with active mock adapter');
    assert.strictEqual(authRes.data.recipient, 'ops@neotransport.co.uk', 'Must deliver to designated ops recipient');
    assert(mockEmail.sentEmails.length >= 1, 'Mock email adapter must have received the test message');
    const sent = mockEmail.sentEmails[mockEmail.sentEmails.length - 1];
    assert.strictEqual(sent.to, 'ops@neotransport.co.uk');
    assert(sent.subject.includes('Production Notification Diagnostics Check'));
    console.log('✓ PASS: Controlled test delivery strictly enforces authorization and verifies email adapter pipeline');

    // ---------------------------------------------------------------------------
    // TEST 5: Vercel Cron Configuration in vercel.json
    // ---------------------------------------------------------------------------
    console.log('\n--- 5. Verifying Vercel Cron in vercel.json ---');
    const vercelConfigPath = path.resolve(process.cwd(), 'vercel.json');
    assert(fs.existsSync(vercelConfigPath), 'vercel.json must exist');

    const vercelJson = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
    assert(Array.isArray(vercelJson.crons), 'vercel.json must contain "crons" array');
    const outboxCron = vercelJson.crons.find((c: any) => c.path === '/api/notifications/process');
    assert(outboxCron, 'vercel.json crons must schedule /api/notifications/process');
    assert(outboxCron.schedule, 'Cron must define a schedule expression');
    console.log(`✓ PASS: vercel.json verified with scheduled worker cron: path=${outboxCron.path}, schedule="${outboxCron.schedule}"`);

    console.log('\n=================================================================');
    console.log('ALL CUSTOMER PORTAL NOTIFICATIONS TESTS PASSED (0 failures)');
    console.log('=================================================================');
  } finally {
    resetEmailAdapterForTesting();
    setServerSupabaseClientForTesting(null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});

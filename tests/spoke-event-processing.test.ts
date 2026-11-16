/**
 * SPOKE DISPATCH EVENT PROCESSING TEST SUITE (PHASE 2)
 *
 * Comprehensive end-to-end and unit validation for:
 * 1. Supabase migration 20261019190000_spoke_event_processing.sql integrity & RLS guards.
 * 2. Supported Spoke v1 operational event types.
 * 3. Booking correlation via sellerOrderId and company identity verification.
 * 4. Tracking URL validation (HTTPS only) for pickup, delivery, and unassigned stops.
 * 5. Delivery attempt handling (failed attempts do NOT mark Delivered or Cancel).
 * 6. Delivery success gating (activity === 'delivery' AND succeeded === true).
 * 7. stop.departed NOT marking Delivered.
 * 8. Terminal booking status protection (Delivered bookings cannot regress).
 * 9. Out-of-order event protection using latest_event_created_at.
 * 10. Stop ID transition from unassigned to assigned.
 * 11. Diagnostic test.send_event safety (never alters real booking).
 * 12. Transient failure retriability and duplicate event idempotency.
 * 13. Portal store and LiveTrackingView external tracking links rendering.
 */

import assert from 'assert';
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import app, {
  setServerSupabaseClientForTesting,
  setAllowSpokeEventFallbackForTesting,
  isSpokeEventFallbackAllowedForTesting,
  processSpokeWebhookEventFallback,
  processSpokeWebhookEvent,
} from '../api/index.js';
import {
  SPOKE_SUPPORTED_WEBHOOK_EVENT_TYPES,
  SpokeWebhookEventType,
  SpokeWebhookPayload,
  SpokeBookingStopState,
} from '../src/lib/spokeTypes.ts';
import { Booking } from '../src/types.ts';

function computeHmacHex(secret: string, body: string | Buffer): string {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
  return crypto.createHmac('sha256', secret).update(buf).digest('hex');
}

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

/**
 * In-memory test store simulating Supabase tables:
 * - spoke_webhook_events
 * - bookings
 * - spoke_booking_stop_state
 */
class InMemoryDatabaseFixture {
  public webhookEvents: Map<string, any> = new Map();
  public bookings: Map<string, any> = new Map();
  public stopStates: Map<string, any> = new Map(); // key: `${booking_id}:${activity}`
  public simulateFailure: string | null = null;

  public reset() {
    this.webhookEvents.clear();
    this.bookings.clear();
    this.stopStates.clear();
    this.simulateFailure = null;
  }

  public seedBooking(booking: {
    id: string;
    company_id?: string | null;
    status: string;
    progress_t?: number;
    pickup_tracking_url?: string | null;
    delivery_tracking_url?: string | null;
  }) {
    this.bookings.set(booking.id, {
      progress_t: 0.1,
      pickup_tracking_url: null,
      delivery_tracking_url: null,
      ...booking,
    });
  }

  public createClient(): any {
    const fixture = this;

    return {
      rpc: async (fn: string, params: any) => {
        if (fn === 'process_spoke_webhook_event') {
          if (fixture.simulateFailure === 'rpc') {
            return { data: null, error: { message: 'Database RPC deadlock/timeout', code: '40P01' } };
          }
          // Delegate to fallback implementation using in-memory client
          const result = await processSpokeWebhookEventFallback(params.p_event_hash, fixture.createClient());
          if (!result.success) {
            return {
              data: {
                status: result.status,
                reason: result.error || result.reason,
              },
              error: null,
            };
          }
          return {
            data: {
              status: result.status,
              booking_id: result.bookingId,
              activity: result.activity,
              booking_status: result.bookingStatus,
              progress_t: result.progress_t,
              reason: result.reason,
            },
            error: null,
          };
        }
        return { data: null, error: { message: `Function ${fn} not found` } };
      },

      from: (tableName: string) => {
        if (tableName === 'spoke_webhook_events') {
          return {
            insert: async (row: any) => {
              if (fixture.simulateFailure === 'persist') {
                return { error: { message: 'Persistence connection error', code: '08006' } };
              }
              if (fixture.webhookEvents.has(row.event_hash)) {
                return {
                  error: {
                    code: '23505',
                    message: 'duplicate key value violates unique constraint "spoke_webhook_events_pkey"',
                  },
                };
              }
              const persisted = {
                received_at: new Date().toISOString(),
                processing_status: 'received',
                processed_at: null,
                processing_error: null,
                ...row,
              };
              fixture.webhookEvents.set(row.event_hash, persisted);
              return { error: null, data: [persisted] };
            },
            select: (_cols?: string) => ({
              eq: (_col: string, val: any) => ({
                single: async () => {
                  const item = fixture.webhookEvents.get(val);
                  if (!item) {
                    return { data: null, error: { message: `Event ${val} not found` } };
                  }
                  return { data: { ...item }, error: null };
                },
              }),
            }),
            update: (fields: any) => ({
              eq: async (_col: string, val: any) => {
                const item = fixture.webhookEvents.get(val);
                if (item) {
                  Object.assign(item, fields);
                }
                return { data: null, error: null };
              },
            }),
          };
        }

        if (tableName === 'bookings') {
          return {
            select: (_cols?: string) => ({
              eq: (_col: string, val: any) => ({
                single: async () => {
                  if (fixture.simulateFailure === 'booking_select') {
                    return { data: null, error: { message: 'Bookings table locked', code: '55P03' } };
                  }
                  const booking = fixture.bookings.get(val);
                  if (!booking) {
                    return { data: null, error: { message: `Booking ${val} not found`, code: 'PGRST116' } };
                  }
                  return { data: { ...booking }, error: null };
                },
              }),
            }),
            update: (fields: any) => ({
              eq: async (_col: string, val: any) => {
                if (fixture.simulateFailure === 'booking_update') {
                  return { data: null, error: { message: 'Failed to update booking' } };
                }
                const booking = fixture.bookings.get(val);
                if (booking) {
                  Object.assign(booking, fields);
                }
                return { data: null, error: null };
              },
            }),
          };
        }

        if (tableName === 'spoke_booking_stop_state') {
          return {
            select: (_cols?: string) => ({
              eq: (_col1: string, val1: any) => ({
                eq: (_col2: string, val2: any) => ({
                  single: async () => {
                    const key = `${val1}:${val2}`;
                    const state = fixture.stopStates.get(key);
                    return { data: state ? { ...state } : null, error: state ? null : { code: 'PGRST116', message: 'No rows' } };
                  },
                  maybeSingle: async () => {
                    const key = `${val1}:${val2}`;
                    const state = fixture.stopStates.get(key);
                    return { data: state ? { ...state } : null, error: null };
                  },
                }),
              }),
            }),
            upsert: async (row: any) => {
              if (fixture.simulateFailure === 'stop_state_upsert') {
                return { data: null, error: { message: 'Stop state upsert failed' } };
              }
              const key = `${row.booking_id}:${row.activity}`;
              fixture.stopStates.set(key, { ...row, updated_at: new Date().toISOString() });
              return { data: null, error: null };
            },
          };
        }

        throw new Error(`Unhandled table in test fixture: ${tableName}`);
      },
    };
  }
}

async function runSpokeEventProcessingTests() {
  console.log('\n=============================================================');
  console.log('=== STARTING SPOKE EVENT PROCESSING TEST SUITE (PHASE 2) ===');
  console.log('=============================================================\n');

  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecret = process.env.SPOKE_WEBHOOK_SECRET;
  process.env.NODE_ENV = 'test';
  const TEST_SECRET = 'test_spoke_webhook_secret_phase2_key_abcdef123456';
  process.env.SPOKE_WEBHOOK_SECRET = TEST_SECRET;

  const dbFixture = new InMemoryDatabaseFixture();
  const testDbClient = dbFixture.createClient();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    // -------------------------------------------------------------------------
    // 1. Static Verification of Migration 20261019190000_spoke_event_processing.sql
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing Migration Schema, Constraints, & Security Integrity ---');
    const migrationsDir = path.resolve('supabase/migrations');
    const targetMigration = '20261019190000_spoke_event_processing.sql';
    const migrationPath = path.join(migrationsDir, targetMigration);

    assert.ok(fs.existsSync(migrationPath), `Migration ${targetMigration} must exist in supabase/migrations`);

    const migrationContent = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

    // 1.1 Check unique timestamp ordering
    const allMigrations = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    assert.ok(
      allMigrations.includes(targetMigration),
      'Phase 2 migration must exist in supabase/migrations'
    );
    assert.ok(
      targetMigration > '20261019180000_spoke_webhook_events_inbox.sql',
      'Phase 2 migration must have a later timestamp than the inbox migration'
    );
    console.log('✓ PASS 1.1: Migration timestamp is unique and strictly ordered after previous migration');

    // 1.2 Table public.spoke_booking_stop_state schema
    assert.ok(
      migrationContent.includes('CREATE TABLE IF NOT EXISTS public.spoke_booking_stop_state'),
      'Migration must create table public.spoke_booking_stop_state'
    );
    assert.ok(
      migrationContent.includes('PRIMARY KEY (booking_id, activity)'),
      'Table must be keyed by composite primary key (booking_id, activity)'
    );
    assert.ok(
      migrationContent.includes('REFERENCES public.bookings(id) ON DELETE CASCADE'),
      'booking_id must foreign key reference public.bookings(id) with CASCADE'
    );
    assert.ok(
      migrationContent.includes("CHECK (activity IN ('pickup', 'delivery'))"),
      'activity must be constrained to pickup or delivery'
    );
    assert.ok(migrationContent.includes('spoke_stop_id text NULL'), 'Table must define spoke_stop_id');
    assert.ok(migrationContent.includes('tracking_url text NULL'), 'Table must define tracking_url');
    assert.ok(migrationContent.includes('delivery_state text NULL'), 'Table must define delivery_state');
    assert.ok(migrationContent.includes('delivery_succeeded boolean NULL'), 'Table must define delivery_succeeded');
    assert.ok(migrationContent.includes('latest_event_type text NOT NULL'), 'Table must define latest_event_type');
    assert.ok(migrationContent.includes('latest_event_created_at timestamptz NOT NULL'), 'Table must define latest_event_created_at');
    console.log('✓ PASS 1.2: spoke_booking_stop_state table schema, keys, and constraints verified');

    // 1.3 public.bookings columns
    assert.ok(
      migrationContent.includes('ADD COLUMN IF NOT EXISTS pickup_tracking_url text NULL'),
      'Migration must add pickup_tracking_url to public.bookings'
    );
    assert.ok(
      migrationContent.includes('ADD COLUMN IF NOT EXISTS delivery_tracking_url text NULL'),
      'Migration must add delivery_tracking_url to public.bookings'
    );
    console.log('✓ PASS 1.3: Customer-safe tracking URL columns added to public.bookings');

    // 1.4 RLS & Privilege hardening
    assert.ok(
      migrationContent.includes('ALTER TABLE public.spoke_booking_stop_state ENABLE ROW LEVEL SECURITY'),
      'RLS must be enabled on spoke_booking_stop_state'
    );
    assert.ok(
      migrationContent.includes('REVOKE ALL ON TABLE public.spoke_booking_stop_state FROM PUBLIC, anon, authenticated'),
      'Access must be revoked from PUBLIC, anon, and authenticated'
    );
    assert.ok(
      migrationContent.includes('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.spoke_booking_stop_state TO service_role') ||
      migrationContent.includes('GRANT ALL ON TABLE public.spoke_booking_stop_state TO service_role'),
      'Administrative access granted exclusively to service_role'
    );
    assert.ok(
      migrationContent.includes('CREATE OR REPLACE FUNCTION public.process_spoke_webhook_event'),
      'Migration must define atomic RPC function process_spoke_webhook_event'
    );
    assert.ok(
      migrationContent.includes('SECURITY DEFINER'),
      'RPC function must be declared SECURITY DEFINER for atomic privileged execution'
    );
    assert.ok(
      migrationContent.includes('REVOKE EXECUTE ON FUNCTION public.process_spoke_webhook_event(text) FROM PUBLIC, anon, authenticated') ||
      migrationContent.includes('REVOKE ALL ON FUNCTION public.process_spoke_webhook_event(text) FROM PUBLIC, anon, authenticated'),
      'RPC execution must be revoked from browser-accessible roles'
    );
    assert.ok(
      migrationContent.includes('GRANT EXECUTE ON FUNCTION public.process_spoke_webhook_event(text) TO service_role'),
      'RPC execution granted exclusively to service_role'
    );
    console.log('✓ PASS 1.4: Strict RLS and least-privilege service-role grants verified');

    // 1.5 RPC text-based booking ID type safety and deliveryInfo hardening static validation
    assert.ok(
      migrationContent.includes('v_booking_id text;'),
      'Migration RPC must declare v_booking_id text'
    );
    assert.ok(
      !migrationContent.includes('v_booking_uuid uuid;') && !migrationContent.includes('v_raw_seller_order_id text;'),
      'Migration RPC must not declare v_booking_uuid or v_raw_seller_order_id'
    );
    assert.ok(
      !migrationContent.includes("v_raw_seller_order_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'"),
      'Migration RPC must not enforce UUID-only regex validation'
    );
    assert.ok(
      migrationContent.includes("jsonb_typeof(v_delivery_info->'succeeded') = 'boolean'"),
      'Migration RPC must guard deliveryInfo.succeeded parsing with jsonb_typeof'
    );
    assert.ok(
      !migrationContent.includes("LOWER(v_delivery_info->>'succeeded') = 'true'"),
      'Migration RPC must strictly reject string coercion of "true" into boolean'
    );
    assert.ok(
      !migrationContent.includes("LOWER(v_delivery_info->>'succeeded') = 'false'"),
      'Migration RPC must strictly reject string coercion of "false" into boolean'
    );
    assert.ok(
      migrationContent.includes('trim(v_external_id)::text != trim(v_booking.company_id)::text'),
      'Migration RPC must explicitly compare company IDs using compatible types and trim'
    );
    // Direct text column usage assertions
    assert.ok(
      migrationContent.includes('booking_id text NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE'),
      'spoke_booking_stop_state.booking_id must be declared as a text column referencing public.bookings(id)'
    );
    assert.ok(
      migrationContent.includes('WHERE id = v_booking_id') &&
      !migrationContent.includes('WHERE id = v_booking_uuid'),
      'Migration RPC must query public.bookings using direct text comparison WHERE id = v_booking_id'
    );
    assert.ok(
      migrationContent.includes('WHERE booking_id = v_booking_id AND activity = v_activity') &&
      !migrationContent.includes('WHERE booking_id = v_booking_uuid'),
      'Migration RPC must query spoke_booking_stop_state using direct text comparison WHERE booking_id = v_booking_id'
    );
    assert.ok(
      migrationContent.includes('v_booking_id,\n    v_booking.company_id') ||
      migrationContent.includes('v_booking_id, v_booking.company_id'),
      'Migration RPC must use v_booking_id in spoke_booking_stop_state INSERT values'
    );
    assert.ok(
      migrationContent.includes('WHERE id = v_booking_id;') &&
      !migrationContent.includes('WHERE id = v_booking_uuid;'),
      'Migration RPC must update public.bookings using direct text comparison WHERE id = v_booking_id;'
    );
    assert.ok(
      migrationContent.includes("'booking_id', v_booking_id"),
      'Migration RPC must return v_booking_id in JSON response object'
    );
    console.log('✓ PASS 1.5: RPC direct text column operations statically verified');

    // -------------------------------------------------------------------------
    // 2. Unit Testing Event Processing Transitions & State Machine
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Operational Event Transitions & State Machine ---');

    const BOOKING_ID = 'b73919e1-1234-4567-89ab-cdef01234567';
    const COMPANY_ID = 'comp_alpha_999';

    // 2.1 stop.allocated: records allocation and stop ID without altering booking status
    dbFixture.reset();
    dbFixture.seedBooking({ id: BOOKING_ID, company_id: COMPANY_ID, status: 'Scheduled', progress_t: 0.1 });

    const allocatedEvent: SpokeWebhookPayload = {
      type: 'stop.allocated',
      version: 'v1',
      created: 1729350100000,
      data: {
        stop: {
          id: 'plans/plan_001/stops/stop_alloc_01',
          activity: 'pickup',
          orderInfo: { sellerOrderId: BOOKING_ID },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const allocHash = 'hash_allocated_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: allocHash,
      event_type: allocatedEvent.type,
      event_version: allocatedEvent.version,
      event_created_at: new Date(allocatedEvent.created).toISOString(),
      payload: allocatedEvent,
      processing_status: 'received',
    });

    const allocRes = await processSpokeWebhookEventFallback(allocHash, testDbClient);
    assert.strictEqual(allocRes.success, true);
    assert.strictEqual(allocRes.status, 'processed');
    assert.strictEqual(allocRes.bookingId, BOOKING_ID);
    assert.strictEqual(allocRes.activity, 'pickup');

    // Stop state recorded
    const allocStopState = dbFixture.stopStates.get(`${BOOKING_ID}:pickup`);
    assert.ok(allocStopState, 'Stop state for pickup must exist');
    assert.strictEqual(allocStopState.spoke_stop_id, 'plans/plan_001/stops/stop_alloc_01');
    assert.strictEqual(allocStopState.latest_event_type, 'stop.allocated');

    // Booking remains Scheduled (allocated does not move progress)
    const allocBooking = dbFixture.bookings.get(BOOKING_ID);
    assert.strictEqual(allocBooking.status, 'Scheduled');
    assert.strictEqual(allocBooking.progress_t, 0.1);
    console.log('✓ PASS 2.1: stop.allocated updates stop state without prematurely advancing booking status');

    // 2.2 stop.out_for_delivery: advances Scheduled booking to In transit (progress 0.45)
    const ofdEvent: SpokeWebhookPayload = {
      type: 'stop.out_for_delivery',
      version: 'v1',
      created: 1729350200000,
      data: {
        stop: {
          id: 'plans/plan_001/stops/stop_ofd_01',
          activity: 'pickup',
          orderInfo: { sellerOrderId: BOOKING_ID },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const ofdHash = 'hash_ofd_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: ofdHash,
      event_type: ofdEvent.type,
      event_version: ofdEvent.version,
      event_created_at: new Date(ofdEvent.created).toISOString(),
      payload: ofdEvent,
      processing_status: 'received',
    });

    const ofdRes = await processSpokeWebhookEventFallback(ofdHash, testDbClient);
    assert.strictEqual(ofdRes.success, true);
    assert.strictEqual(ofdRes.status, 'processed');

    const ofdBooking = dbFixture.bookings.get(BOOKING_ID);
    assert.strictEqual(ofdBooking.status, 'In transit');
    assert.strictEqual(ofdBooking.progress_t, 0.45);
    console.log('✓ PASS 2.2: stop.out_for_delivery advances Scheduled booking to In transit (0.45)');

    // 2.3 stop.next_in_route: advances in-transit progress to 0.75
    const nirEvent: SpokeWebhookPayload = {
      type: 'stop.next_in_route',
      version: 'v1',
      created: 1729350300000,
      data: {
        stop: {
          id: 'plans/plan_001/stops/stop_nir_01',
          activity: 'delivery',
          orderInfo: { sellerOrderId: BOOKING_ID },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const nirHash = 'hash_nir_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: nirHash,
      event_type: nirEvent.type,
      event_version: nirEvent.version,
      event_created_at: new Date(nirEvent.created).toISOString(),
      payload: nirEvent,
      processing_status: 'received',
    });

    const nirRes = await processSpokeWebhookEventFallback(nirHash, testDbClient);
    assert.strictEqual(nirRes.success, true);
    assert.strictEqual(nirRes.status, 'processed');

    const nirBooking = dbFixture.bookings.get(BOOKING_ID);
    assert.strictEqual(nirBooking.status, 'In transit');
    assert.strictEqual(nirBooking.progress_t, 0.75);
    console.log('✓ PASS 2.3: stop.next_in_route advances In transit booking progress to 0.75');

    // 2.4 Tracking URLs for pickup and delivery stops (stop.tracking_link_added)
    const pickupTrackingUrl = 'https://tracking.spoke.com/track/pickup-alpha';
    const pickupLinkEvent: SpokeWebhookPayload = {
      type: 'stop.tracking_link_added',
      version: 'v1',
      created: 1729350400000,
      data: {
        stop: {
          id: 'plans/plan_001/stops/stop_pickup_link',
          activity: 'pickup',
          trackingLink: pickupTrackingUrl,
          orderInfo: { sellerOrderId: BOOKING_ID },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const pLinkHash = 'hash_pickup_link_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: pLinkHash,
      event_type: pickupLinkEvent.type,
      event_version: pickupLinkEvent.version,
      event_created_at: new Date(pickupLinkEvent.created).toISOString(),
      payload: pickupLinkEvent,
      processing_status: 'received',
    });

    const pLinkRes = await processSpokeWebhookEventFallback(pLinkHash, testDbClient);
    assert.strictEqual(pLinkRes.success, true);

    const pLinkBooking = dbFixture.bookings.get(BOOKING_ID);
    assert.strictEqual(pLinkBooking.pickup_tracking_url, pickupTrackingUrl);

    // Delivery tracking URL
    const deliveryTrackingUrl = 'https://tracking.spoke.com/track/delivery-omega';
    const deliveryLinkEvent: SpokeWebhookPayload = {
      type: 'stop.tracking_link_added',
      version: 'v1',
      created: 1729350500000,
      data: {
        stop: {
          id: 'plans/plan_001/stops/stop_delivery_link',
          activity: 'delivery',
          trackingLink: deliveryTrackingUrl,
          orderInfo: { sellerOrderId: BOOKING_ID },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const dLinkHash = 'hash_delivery_link_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: dLinkHash,
      event_type: deliveryLinkEvent.type,
      event_version: deliveryLinkEvent.version,
      event_created_at: new Date(deliveryLinkEvent.created).toISOString(),
      payload: deliveryLinkEvent,
      processing_status: 'received',
    });

    const dLinkRes = await processSpokeWebhookEventFallback(dLinkHash, testDbClient);
    assert.strictEqual(dLinkRes.success, true);

    const dLinkBooking = dbFixture.bookings.get(BOOKING_ID);
    assert.strictEqual(dLinkBooking.delivery_tracking_url, deliveryTrackingUrl);
    console.log('✓ PASS 2.4: Tracking URLs correctly assigned to pickup_tracking_url and delivery_tracking_url');

    // 2.5 unassigned_stop.tracking_link_added assigns tracking link to unassigned stop
    const unassignedTrackingUrl = 'https://tracking.spoke.com/track/unassigned-early';
    const unassignedEvent: SpokeWebhookPayload = {
      type: 'unassigned_stop.tracking_link_added',
      version: 'v1',
      created: 1729350550000,
      data: {
        unassignedStop: {
          id: 'unassigned_stops/unassigned_001',
          activity: 'delivery',
          trackingLink: unassignedTrackingUrl,
          orderInfo: { sellerOrderId: BOOKING_ID },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const unassignedHash = 'hash_unassigned_link_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: unassignedHash,
      event_type: unassignedEvent.type,
      event_version: unassignedEvent.version,
      event_created_at: new Date(unassignedEvent.created).toISOString(),
      payload: unassignedEvent,
      processing_status: 'received',
    });

    const unassignedRes = await processSpokeWebhookEventFallback(unassignedHash, testDbClient);
    assert.strictEqual(unassignedRes.success, true);

    const unassignedState = dbFixture.stopStates.get(`${BOOKING_ID}:delivery`);
    assert.strictEqual(unassignedState.tracking_url, unassignedTrackingUrl);
    assert.strictEqual(unassignedState.spoke_stop_id, 'unassigned_stops/unassigned_001');
    console.log('✓ PASS 2.5: unassigned_stop.tracking_link_added correctly handles unassigned stops');

    // 2.6 Transition from unassigned stop to assigned stop on same booking/activity
    const transitionEvent: SpokeWebhookPayload = {
      type: 'stop.allocated',
      version: 'v1',
      created: 1729350600000,
      data: {
        stop: {
          id: 'plans/plan_002/stops/stop_assigned_final',
          activity: 'delivery',
          orderInfo: { sellerOrderId: BOOKING_ID },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const transitionHash = 'hash_transition_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: transitionHash,
      event_type: transitionEvent.type,
      event_version: transitionEvent.version,
      event_created_at: new Date(transitionEvent.created).toISOString(),
      payload: transitionEvent,
      processing_status: 'received',
    });

    const transitionRes = await processSpokeWebhookEventFallback(transitionHash, testDbClient);
    assert.strictEqual(transitionRes.success, true);

    const transitionedState = dbFixture.stopStates.get(`${BOOKING_ID}:delivery`);
    assert.strictEqual(transitionedState.spoke_stop_id, 'plans/plan_002/stops/stop_assigned_final');
    console.log('✓ PASS 2.6: Stop ID successfully transitions from unassigned to assigned stop');

    // 2.7 Insecure HTTP tracking URLs rejected and never written
    const insecureHttpEvent: SpokeWebhookPayload = {
      type: 'stop.tracking_link_added',
      version: 'v1',
      created: 1729350650000,
      data: {
        stop: {
          id: 'plans/plan_002/stops/stop_assigned_final',
          activity: 'delivery',
          trackingLink: 'http://insecure.tracking.spoke.com/track/123',
          orderInfo: { sellerOrderId: BOOKING_ID },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const insecureHash = 'hash_insecure_url_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: insecureHash,
      event_type: insecureHttpEvent.type,
      event_version: insecureHttpEvent.version,
      event_created_at: new Date(insecureHttpEvent.created).toISOString(),
      payload: insecureHttpEvent,
      processing_status: 'received',
    });

    const insecureRes = await processSpokeWebhookEventFallback(insecureHash, testDbClient);
    assert.strictEqual(insecureRes.success, true);
    // Booking delivery_tracking_url remains the previous valid HTTPS URL, never replaced with insecure HTTP
    const insecureBooking = dbFixture.bookings.get(BOOKING_ID);
    assert.strictEqual(insecureBooking.delivery_tracking_url, unassignedTrackingUrl);
    console.log('✓ PASS 2.7: Insecure HTTP tracking links rejected (only strict HTTPS accepted)');

    // 2.8 stop.attempted_delivery (Failed attempt does NOT mark Delivered and does NOT Cancel)
    const failedAttemptEvent: SpokeWebhookPayload = {
      type: 'stop.attempted_delivery',
      version: 'v1',
      created: 1729350700000,
      data: {
        stop: {
          id: 'plans/plan_002/stops/stop_assigned_final',
          activity: 'delivery',
          deliveryInfo: {
            succeeded: false,
            state: 'customer_unavailable',
            attemptedAt: 1729350695000,
            reason: 'Premises closed, contact card left',
          },
          orderInfo: { sellerOrderId: BOOKING_ID },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const failedAttemptHash = 'hash_failed_attempt_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: failedAttemptHash,
      event_type: failedAttemptEvent.type,
      event_version: failedAttemptEvent.version,
      event_created_at: new Date(failedAttemptEvent.created).toISOString(),
      payload: failedAttemptEvent,
      processing_status: 'received',
    });

    const failedAttemptRes = await processSpokeWebhookEventFallback(failedAttemptHash, testDbClient);
    assert.strictEqual(failedAttemptRes.success, true);

    const failedAttemptState = dbFixture.stopStates.get(`${BOOKING_ID}:delivery`);
    assert.strictEqual(failedAttemptState.delivery_succeeded, false);
    assert.strictEqual(failedAttemptState.delivery_state, 'customer_unavailable');

    const failedAttemptBooking = dbFixture.bookings.get(BOOKING_ID);
    assert.strictEqual(failedAttemptBooking.status, 'In transit'); // Booking NOT marked Delivered, NOT cancelled
    assert.notStrictEqual(failedAttemptBooking.status, 'Delivered');
    assert.notStrictEqual(failedAttemptBooking.status, 'Cancelled');
    console.log('✓ PASS 2.8: Failed delivery attempt records outcome without marking Delivered or Cancelled');

    // 2.9 stop.departed does NOT mark booking Delivered
    const departedEvent: SpokeWebhookPayload = {
      type: 'stop.departed',
      version: 'v1',
      created: 1729350800000,
      data: {
        stop: {
          id: 'plans/plan_002/stops/stop_assigned_final',
          activity: 'delivery',
          deliveryInfo: {
            succeeded: false,
            state: 'departed_site',
          },
          orderInfo: { sellerOrderId: BOOKING_ID },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const departedHash = 'hash_departed_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: departedHash,
      event_type: departedEvent.type,
      event_version: departedEvent.version,
      event_created_at: new Date(departedEvent.created).toISOString(),
      payload: departedEvent,
      processing_status: 'received',
    });

    const departedRes = await processSpokeWebhookEventFallback(departedHash, testDbClient);
    assert.strictEqual(departedRes.success, true);

    const departedBooking = dbFixture.bookings.get(BOOKING_ID);
    assert.strictEqual(departedBooking.status, 'In transit');
    assert.notStrictEqual(departedBooking.status, 'Delivered', 'stop.departed must NOT mark booking Delivered');
    console.log('✓ PASS 2.9: stop.departed updates stop state but strictly preserves In transit status');

    // 2.10 Successful delivery (activity === 'delivery' AND deliveryInfo.succeeded === true) marks Delivered
    const successfulDeliveryEvent: SpokeWebhookPayload = {
      type: 'stop.attempted_delivery',
      version: 'v1',
      created: 1729350900000,
      data: {
        stop: {
          id: 'plans/plan_002/stops/stop_assigned_final',
          activity: 'delivery',
          deliveryInfo: {
            succeeded: true,
            state: 'completed',
          },
          orderInfo: { sellerOrderId: BOOKING_ID },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const successDeliveryHash = 'hash_delivery_success_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: successDeliveryHash,
      event_type: successfulDeliveryEvent.type,
      event_version: successfulDeliveryEvent.version,
      event_created_at: new Date(successfulDeliveryEvent.created).toISOString(),
      payload: successfulDeliveryEvent,
      processing_status: 'received',
    });

    const successRes = await processSpokeWebhookEventFallback(successDeliveryHash, testDbClient);
    assert.strictEqual(successRes.success, true);
    assert.strictEqual(successRes.bookingStatus, 'Delivered');
    assert.strictEqual(successRes.progress_t, 1.0);

    const finalBooking = dbFixture.bookings.get(BOOKING_ID);
    assert.strictEqual(finalBooking.status, 'Delivered');
    assert.strictEqual(finalBooking.progress_t, 1.0);
    console.log('✓ PASS 2.10: Successful delivery (succeeded === true) marks booking Delivered with progress 1.00');

    // 2.11 Pickup completion (activity === 'pickup' AND succeeded === true) does NOT mark booking Delivered
    const PICKUP_BOOKING_ID = 'b73919e1-1234-4567-89ab-000000000002';
    dbFixture.seedBooking({ id: PICKUP_BOOKING_ID, company_id: COMPANY_ID, status: 'In transit', progress_t: 0.5 });

    const pickupSuccessEvent: SpokeWebhookPayload = {
      type: 'stop.attempted_delivery',
      version: 'v1',
      created: 1729350950000,
      data: {
        stop: {
          id: 'plans/plan_002/stops/stop_pickup_done',
          activity: 'pickup',
          deliveryInfo: {
            succeeded: true,
            state: 'collected',
          },
          orderInfo: { sellerOrderId: PICKUP_BOOKING_ID },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const pickupSuccessHash = 'hash_pickup_success_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: pickupSuccessHash,
      event_type: pickupSuccessEvent.type,
      event_version: pickupSuccessEvent.version,
      event_created_at: new Date(pickupSuccessEvent.created).toISOString(),
      payload: pickupSuccessEvent,
      processing_status: 'received',
    });

    const pickupSuccessRes = await processSpokeWebhookEventFallback(pickupSuccessHash, testDbClient);
    assert.strictEqual(pickupSuccessRes.success, true);

    const pickupBooking = dbFixture.bookings.get(PICKUP_BOOKING_ID);
    assert.strictEqual(pickupBooking.status, 'In transit');
    assert.notStrictEqual(pickupBooking.status, 'Delivered', 'Pickup success must NOT mark booking Delivered');
    console.log('✓ PASS 2.11: Pickup completion records state but does NOT mark booking Delivered');

    // 2.12 Malformed deliveryInfo.succeeded parsing hardening
    // When deliveryInfo.succeeded is a string ('not-a-boolean'), number, or object, it must NOT crash and must NOT mark Delivered
    const MALFORMED_DELIVERY_BOOKING = 'b73919e1-1234-4567-89ab-0123456789de';
    dbFixture.seedBooking({ id: MALFORMED_DELIVERY_BOOKING, company_id: COMPANY_ID, status: 'In transit', progress_t: 0.45 });

    const malformedDeliverySuccessEvent: SpokeWebhookPayload = {
      type: 'stop.attempted_delivery',
      version: 'v1',
      created: 1729350960000,
      data: {
        stop: {
          id: 'plans/plan_002/stops/stop_malformed_delivery',
          activity: 'delivery',
          deliveryInfo: {
            succeeded: 'not-a-boolean-value' as any,
            state: 'inconclusive',
          },
          orderInfo: { sellerOrderId: MALFORMED_DELIVERY_BOOKING },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const malformedDeliveryHash = 'hash_malformed_delivery_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: malformedDeliveryHash,
      event_type: malformedDeliverySuccessEvent.type,
      event_version: malformedDeliverySuccessEvent.version,
      event_created_at: new Date(malformedDeliverySuccessEvent.created).toISOString(),
      payload: malformedDeliverySuccessEvent,
      processing_status: 'received',
    });

    const malformedDeliveryRes = await processSpokeWebhookEventFallback(malformedDeliveryHash, testDbClient);
    assert.strictEqual(malformedDeliveryRes.success, true);

    const malformedDeliveryState = dbFixture.stopStates.get(`${MALFORMED_DELIVERY_BOOKING}:delivery`);
    assert.strictEqual(malformedDeliveryState.delivery_succeeded, null);

    const malformedDeliveryBooking = dbFixture.bookings.get(MALFORMED_DELIVERY_BOOKING);
    assert.strictEqual(malformedDeliveryBooking.status, 'In transit');
    assert.notStrictEqual(malformedDeliveryBooking.status, 'Delivered', 'Malformed deliveryInfo.succeeded must NOT mark booking Delivered');
    console.log('✓ PASS 2.12: Malformed deliveryInfo.succeeded safely parsed without exception and does NOT mark booking Delivered');

    // 2.13 String "true" for deliveryInfo.succeeded does NOT mark booking Delivered
    const STRING_TRUE_BOOKING = 'b73919e1-1234-4567-89ab-0123456789df';
    dbFixture.seedBooking({ id: STRING_TRUE_BOOKING, company_id: COMPANY_ID, status: 'In transit', progress_t: 0.45 });

    const stringTrueDeliveryEvent: SpokeWebhookPayload = {
      type: 'stop.attempted_delivery',
      version: 'v1',
      created: 1729350970000,
      data: {
        stop: {
          id: 'plans/plan_002/stops/stop_string_true_delivery',
          activity: 'delivery',
          deliveryInfo: {
            succeeded: 'true' as any, // JSON string "true" (not boolean true)
            state: 'completed',
          },
          orderInfo: { sellerOrderId: STRING_TRUE_BOOKING },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const stringTrueHash = 'hash_string_true_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: stringTrueHash,
      event_type: stringTrueDeliveryEvent.type,
      event_version: stringTrueDeliveryEvent.version,
      event_created_at: new Date(stringTrueDeliveryEvent.created).toISOString(),
      payload: stringTrueDeliveryEvent,
      processing_status: 'received',
    });

    const stringTrueRes = await processSpokeWebhookEventFallback(stringTrueHash, testDbClient);
    assert.strictEqual(stringTrueRes.success, true);

    const stringTrueState = dbFixture.stopStates.get(`${STRING_TRUE_BOOKING}:delivery`);
    assert.strictEqual(stringTrueState.delivery_succeeded, null, 'String "true" must set delivery_succeeded to NULL');

    const stringTrueBooking = dbFixture.bookings.get(STRING_TRUE_BOOKING);
    assert.strictEqual(stringTrueBooking.status, 'In transit');
    assert.notStrictEqual(stringTrueBooking.status, 'Delivered', 'String "true" must NOT mark booking Delivered');
    console.log('✓ PASS 2.13: JSON string "true" does NOT coerce to boolean and does NOT mark booking Delivered');

    // 2.14 Genuine JSON boolean false for deliveryInfo.succeeded does NOT mark booking Delivered
    const BOOLEAN_FALSE_BOOKING = 'b73919e1-1234-4567-89ab-0123456789e0';
    dbFixture.seedBooking({ id: BOOLEAN_FALSE_BOOKING, company_id: COMPANY_ID, status: 'In transit', progress_t: 0.45 });

    const booleanFalseDeliveryEvent: SpokeWebhookPayload = {
      type: 'stop.attempted_delivery',
      version: 'v1',
      created: 1729350980000,
      data: {
        stop: {
          id: 'plans/plan_002/stops/stop_boolean_false_delivery',
          activity: 'delivery',
          deliveryInfo: {
            succeeded: false, // Genuine JSON boolean false
            state: 'failed_attempt',
          },
          orderInfo: { sellerOrderId: BOOLEAN_FALSE_BOOKING },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const booleanFalseHash = 'hash_boolean_false_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: booleanFalseHash,
      event_type: booleanFalseDeliveryEvent.type,
      event_version: booleanFalseDeliveryEvent.version,
      event_created_at: new Date(booleanFalseDeliveryEvent.created).toISOString(),
      payload: booleanFalseDeliveryEvent,
      processing_status: 'received',
    });

    const booleanFalseRes = await processSpokeWebhookEventFallback(booleanFalseHash, testDbClient);
    assert.strictEqual(booleanFalseRes.success, true);

    const booleanFalseState = dbFixture.stopStates.get(`${BOOLEAN_FALSE_BOOKING}:delivery`);
    assert.strictEqual(booleanFalseState.delivery_succeeded, false, 'Boolean false must record delivery_succeeded = false');

    const booleanFalseBooking = dbFixture.bookings.get(BOOLEAN_FALSE_BOOKING);
    assert.strictEqual(booleanFalseBooking.status, 'In transit');
    assert.notStrictEqual(booleanFalseBooking.status, 'Delivered', 'Boolean false must NOT mark booking Delivered');
    console.log('✓ PASS 2.14: Genuine JSON boolean false records outcome and does NOT mark booking Delivered');

    // -------------------------------------------------------------------------
    // 3. Correlation & Multi-Tenancy Identity Safeguards
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Booking Correlation & Identity Safeguards ---');

    // 3.1 Company identity mismatch safely ignored without modifying booking
    const COMPANY_MISMATCH_BOOKING = 'b73919e1-1234-4567-89ab-000000000003';
    dbFixture.seedBooking({ id: COMPANY_MISMATCH_BOOKING, company_id: 'comp_legit_client', status: 'Scheduled' });

    const mismatchEvent: SpokeWebhookPayload = {
      type: 'stop.out_for_delivery',
      version: 'v1',
      created: 1729351000000,
      data: {
        stop: {
          id: 'plans/plan_003/stops/stop_mismatch',
          activity: 'pickup',
          orderInfo: { sellerOrderId: COMPANY_MISMATCH_BOOKING },
          recipient: { externalId: 'comp_attacker_impostor' }, // Mismatched company ID
        },
      },
    };
    const mismatchHash = 'hash_mismatch_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: mismatchHash,
      event_type: mismatchEvent.type,
      event_version: mismatchEvent.version,
      event_created_at: new Date(mismatchEvent.created).toISOString(),
      payload: mismatchEvent,
      processing_status: 'received',
    });

    const mismatchRes = await processSpokeWebhookEventFallback(mismatchHash, testDbClient);
    assert.strictEqual(mismatchRes.success, true);
    assert.strictEqual(mismatchRes.status, 'ignored');
    assert.ok(mismatchRes.reason?.includes('Company identity mismatch'));

    const untouchedMismatchBooking = dbFixture.bookings.get(COMPANY_MISMATCH_BOOKING);
    assert.strictEqual(untouchedMismatchBooking.status, 'Scheduled', 'Booking must NOT be modified on company mismatch');
    console.log('✓ PASS 3.1: Company identity mismatch safely ignored without modifying booking');

    // 3.2 Missing sellerOrderId safely ignored
    const missingOrderEvent: SpokeWebhookPayload = {
      type: 'stop.out_for_delivery',
      version: 'v1',
      created: 1729351100000,
      data: {
        stop: {
          id: 'plans/plan_003/stops/stop_no_order',
          activity: 'pickup',
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const missingOrderHash = 'hash_missing_order_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: missingOrderHash,
      event_type: missingOrderEvent.type,
      event_version: missingOrderEvent.version,
      event_created_at: new Date(missingOrderEvent.created).toISOString(),
      payload: missingOrderEvent,
      processing_status: 'received',
    });

    const missingOrderRes = await processSpokeWebhookEventFallback(missingOrderHash, testDbClient);
    assert.strictEqual(missingOrderRes.success, true);
    assert.strictEqual(missingOrderRes.status, 'ignored');
    assert.ok(missingOrderRes.reason?.includes('sellerOrderId'));
    console.log('✓ PASS 3.2: Missing sellerOrderId safely ignored with concise non-sensitive reason');

    // 3.2b Non-UUID-shaped text booking ID: unknown ID is safely ignored, seeded ID correlates successfully
    const NON_UUID_BOOKING = 'BOOKING-TEXT-ALPHA-999';

    // 1) Unknown non-UUID text booking ID is safely ignored
    const unknownTextOrderEvent: SpokeWebhookPayload = {
      type: 'stop.out_for_delivery',
      version: 'v1',
      created: 1729351150000,
      data: {
        stop: {
          id: 'plans/plan_003/stops/stop_unknown_text',
          activity: 'pickup',
          orderInfo: { sellerOrderId: 'UNKNOWN-TEXT-BOOKING-404' },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const unknownTextHash = 'hash_unknown_text_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: unknownTextHash,
      event_type: unknownTextOrderEvent.type,
      event_version: unknownTextOrderEvent.version,
      event_created_at: new Date(unknownTextOrderEvent.created).toISOString(),
      payload: unknownTextOrderEvent,
      processing_status: 'received',
    });

    const unknownTextRes = await processSpokeWebhookEventFallback(unknownTextHash, testDbClient);
    assert.strictEqual(unknownTextRes.success, true);
    assert.strictEqual(unknownTextRes.status, 'ignored');
    assert.ok(
      unknownTextRes.reason?.includes('No matching booking found for sellerOrderId') ||
      unknownTextRes.reason?.toLowerCase().includes('not found')
    );

    // 2) Valid seeded non-UUID-shaped text booking ID correlates and updates booking
    dbFixture.seedBooking({ id: NON_UUID_BOOKING, company_id: COMPANY_ID, status: 'Scheduled', progress_t: 0.1 });
    const nonUuidOrderEvent: SpokeWebhookPayload = {
      type: 'stop.out_for_delivery',
      version: 'v1',
      created: 1729351155000,
      data: {
        stop: {
          id: 'plans/plan_003/stops/stop_non_uuid_text',
          activity: 'pickup',
          orderInfo: { sellerOrderId: NON_UUID_BOOKING },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const nonUuidHash = 'hash_non_uuid_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: nonUuidHash,
      event_type: nonUuidOrderEvent.type,
      event_version: nonUuidOrderEvent.version,
      event_created_at: new Date(nonUuidOrderEvent.created).toISOString(),
      payload: nonUuidOrderEvent,
      processing_status: 'received',
    });

    const nonUuidRes = await processSpokeWebhookEventFallback(nonUuidHash, testDbClient);
    assert.strictEqual(nonUuidRes.success, true);
    assert.strictEqual(nonUuidRes.status, 'processed');
    assert.strictEqual(nonUuidRes.bookingId, NON_UUID_BOOKING);
    const nonUuidBooking = dbFixture.bookings.get(NON_UUID_BOOKING);
    assert.strictEqual(nonUuidBooking.status, 'In transit');
    console.log('✓ PASS 3.2b: Non-UUID text booking ID correlates correctly when seeded, and unknown ID is safely ignored');

    // 3.2c Valid UUID format successfully passes UUID validation and correlates
    const validUuidOrderEvent: SpokeWebhookPayload = {
      type: 'stop.out_for_delivery',
      version: 'v1',
      created: 1729351160000,
      data: {
        stop: {
          id: 'plans/plan_003/stops/stop_valid_uuid',
          activity: 'pickup',
          orderInfo: { sellerOrderId: BOOKING_ID }, // Valid canonical UUID
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const validUuidHash = 'hash_valid_uuid_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: validUuidHash,
      event_type: validUuidOrderEvent.type,
      event_version: validUuidOrderEvent.version,
      event_created_at: new Date(validUuidOrderEvent.created).toISOString(),
      payload: validUuidOrderEvent,
      processing_status: 'received',
    });

    const validUuidRes = await processSpokeWebhookEventFallback(validUuidHash, testDbClient);
    assert.strictEqual(validUuidRes.success, true);
    assert.strictEqual(validUuidRes.status, 'processed');
    assert.strictEqual(validUuidRes.bookingId, BOOKING_ID);
    console.log('✓ PASS 3.2c: Valid UUID sellerOrderId successfully verified and correlated with booking');

    // 3.3 Non-existent booking safely ignored
    const nonExistentBookingEvent: SpokeWebhookPayload = {
      type: 'stop.out_for_delivery',
      version: 'v1',
      created: 1729351200000,
      data: {
        stop: {
          id: 'plans/plan_003/stops/stop_ghost',
          activity: 'pickup',
          orderInfo: { sellerOrderId: 'b73919e1-1234-4567-89ab-999999999999' },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const nonExistentHash = 'hash_ghost_booking_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: nonExistentHash,
      event_type: nonExistentBookingEvent.type,
      event_version: nonExistentBookingEvent.version,
      event_created_at: new Date(nonExistentBookingEvent.created).toISOString(),
      payload: nonExistentBookingEvent,
      processing_status: 'received',
    });

    const nonExistentRes = await processSpokeWebhookEventFallback(nonExistentHash, testDbClient);
    assert.strictEqual(nonExistentRes.success, true);
    assert.strictEqual(nonExistentRes.status, 'ignored');
    assert.ok(
      nonExistentRes.reason?.includes('No matching booking found') ||
      nonExistentRes.reason?.toLowerCase().includes('not found')
    );
    console.log('✓ PASS 3.3: Non-existent booking safely ignored without crashing');

    // 3.4 test.send_event diagnostic ping never modifies real bookings
    const testPingEvent: SpokeWebhookPayload = {
      type: 'test.send_event',
      version: 'v1',
      created: 1729351300000,
      data: {
        test: true,
        sellerOrderId: BOOKING_ID, // Even if it attempts to target a real booking
      },
    };
    const testPingHash = 'hash_test_ping_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: testPingHash,
      event_type: testPingEvent.type,
      event_version: testPingEvent.version,
      event_created_at: new Date(testPingEvent.created).toISOString(),
      payload: testPingEvent,
      processing_status: 'received',
    });

    const testPingRes = await processSpokeWebhookEventFallback(testPingHash, testDbClient);
    assert.strictEqual(testPingRes.success, true);
    assert.strictEqual(testPingRes.status, 'ignored');
    assert.ok(testPingRes.reason?.includes('Diagnostic test event acknowledged'));
    console.log('✓ PASS 3.4: test.send_event strictly ignored as diagnostic (never modifies booking)');

    // -------------------------------------------------------------------------
    // 4. Protection Against Regressions & Out-of-Order Delivery
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Terminal Protection & Out-of-Order Guards ---');

    // 4.1 Terminal status protection: Delivered booking cannot regress
    const DELIVERED_BOOKING_ID = 'b73919e1-1234-4567-89ab-000000000004';
    dbFixture.seedBooking({
      id: DELIVERED_BOOKING_ID,
      company_id: COMPANY_ID,
      status: 'Delivered',
      progress_t: 1.0,
    });

    const regressEvent: SpokeWebhookPayload = {
      type: 'stop.out_for_delivery',
      version: 'v1',
      created: 1729351400000,
      data: {
        stop: {
          id: 'plans/plan_004/stops/stop_regress',
          activity: 'delivery',
          orderInfo: { sellerOrderId: DELIVERED_BOOKING_ID },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const regressHash = 'hash_regress_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: regressHash,
      event_type: regressEvent.type,
      event_version: regressEvent.version,
      event_created_at: new Date(regressEvent.created).toISOString(),
      payload: regressEvent,
      processing_status: 'received',
    });

    const regressRes = await processSpokeWebhookEventFallback(regressHash, testDbClient);
    assert.strictEqual(regressRes.success, true);

    const preservedDeliveredBooking = dbFixture.bookings.get(DELIVERED_BOOKING_ID);
    assert.strictEqual(preservedDeliveredBooking.status, 'Delivered', 'Delivered booking status cannot regress');
    assert.strictEqual(preservedDeliveredBooking.progress_t, 1.0, 'Delivered progress cannot be lowered below 1.00');
    console.log('✓ PASS 4.1: Terminal Delivered booking protected against regression');

    // 4.2 Out-of-order delivery protection (older event superseded by newer event)
    const OOO_BOOKING_ID = 'b73919e1-1234-4567-89ab-000000000005';
    dbFixture.seedBooking({ id: OOO_BOOKING_ID, company_id: COMPANY_ID, status: 'In transit', progress_t: 0.75 });

    // Seed newer stop state (created at t=2000)
    dbFixture.stopStates.set(`${OOO_BOOKING_ID}:delivery`, {
      booking_id: OOO_BOOKING_ID,
      company_id: COMPANY_ID,
      activity: 'delivery',
      spoke_stop_id: 'plans/p1/stops/s1',
      latest_event_type: 'stop.next_in_route',
      latest_event_created_at: new Date(1729352000000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Inbound older event (created at t=1000)
    const olderEvent: SpokeWebhookPayload = {
      type: 'stop.allocated',
      version: 'v1',
      created: 1729351000000, // Older timestamp
      data: {
        stop: {
          id: 'plans/p1/stops/s0_old',
          activity: 'delivery',
          orderInfo: { sellerOrderId: OOO_BOOKING_ID },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const olderHash = 'hash_older_event_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: olderHash,
      event_type: olderEvent.type,
      event_version: olderEvent.version,
      event_created_at: new Date(olderEvent.created).toISOString(),
      payload: olderEvent,
      processing_status: 'received',
    });

    const olderRes = await processSpokeWebhookEventFallback(olderHash, testDbClient);
    assert.strictEqual(olderRes.success, true);
    assert.strictEqual(olderRes.status, 'ignored');
    assert.ok(olderRes.reason?.includes('Out-of-order event superseded by newer event'));

    // Stop state must NOT be overwritten by the older event
    const preservedOooStopState = dbFixture.stopStates.get(`${OOO_BOOKING_ID}:delivery`);
    assert.strictEqual(preservedOooStopState.latest_event_type, 'stop.next_in_route');
    assert.strictEqual(preservedOooStopState.spoke_stop_id, 'plans/p1/stops/s1');
    console.log('✓ PASS 4.2: Out-of-order older event safely ignored without overwriting newer stop state');

    // -------------------------------------------------------------------------
    // 5. End-to-End HTTP Webhook Endpoint Integration Tests
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing End-to-End HTTP Webhook Endpoint & Retry Handling ---');
    setServerSupabaseClientForTesting(testDbClient);

    const E2E_BOOKING_ID = 'b73919e1-1234-4567-89ab-e2e000000001';
    dbFixture.reset();
    dbFixture.seedBooking({ id: E2E_BOOKING_ID, company_id: COMPANY_ID, status: 'Scheduled', progress_t: 0.1 });

    // 5.1 End-to-end POST /api/webhooks/spoke processes event and updates booking
    const e2ePayloadString = JSON.stringify({
      type: 'stop.out_for_delivery',
      version: 'v1',
      created: 1729353000000,
      data: {
        stop: {
          id: 'plans/plan_e2e/stops/stop_e2e_01',
          activity: 'pickup',
          trackingLink: 'https://tracking.spoke.com/track/e2e-pickup',
          orderInfo: { sellerOrderId: E2E_BOOKING_ID },
          recipient: { externalId: COMPANY_ID },
        },
      },
    });
    const e2eHmac = computeHmacHex(TEST_SECRET, e2ePayloadString);
    const expectedE2eHash = crypto.createHash('sha256').update(Buffer.from(e2ePayloadString, 'utf8')).digest('hex');

    const e2eRes = await testRequest(
      server,
      '/api/webhooks/spoke',
      'POST',
      { 'spoke-signature': e2eHmac },
      e2ePayloadString
    );

    assert.strictEqual(e2eRes.status, 200);
    assert.strictEqual(e2eRes.data.received, true);
    assert.strictEqual(e2eRes.data.eventHash, expectedE2eHash);
    assert.strictEqual(e2eRes.data.processing_status, 'processed');

    const e2eUpdatedBooking = dbFixture.bookings.get(E2E_BOOKING_ID);
    assert.strictEqual(e2eUpdatedBooking.status, 'In transit');
    assert.strictEqual(e2eUpdatedBooking.pickup_tracking_url, 'https://tracking.spoke.com/track/e2e-pickup');
    console.log('✓ PASS 5.1: HTTP POST /api/webhooks/spoke durably persists and processes event atomically');

    // 5.2 Exact duplicate request of already processed event returns 200 already_stored without re-processing
    const duplicateRes = await testRequest(
      server,
      '/api/webhooks/spoke',
      'POST',
      { 'spoke-signature': e2eHmac },
      e2ePayloadString
    );
    assert.strictEqual(duplicateRes.status, 200);
    assert.strictEqual(duplicateRes.data.status, 'already_stored');
    assert.strictEqual(duplicateRes.data.duplicate, true);
    assert.strictEqual(duplicateRes.data.eventHash, expectedE2eHash);
    console.log('✓ PASS 5.2: Exact duplicate request returns 200 already_stored idempotently');

    // 5.3 Retry handling: if previous processing failed, subsequent delivery retries and succeeds
    const RETRY_BOOKING_ID = 'b73919e1-1234-4567-89ab-000000000006';
    dbFixture.seedBooking({ id: RETRY_BOOKING_ID, company_id: COMPANY_ID, status: 'Scheduled' });

    const retryPayloadString = JSON.stringify({
      type: 'stop.out_for_delivery',
      version: 'v1',
      created: 1729354000000,
      data: {
        stop: {
          id: 'plans/plan_retry/stops/stop_retry_01',
          activity: 'pickup',
          orderInfo: { sellerOrderId: RETRY_BOOKING_ID },
          recipient: { externalId: COMPANY_ID },
        },
      },
    });
    const retryHmac = computeHmacHex(TEST_SECRET, retryPayloadString);

    // Simulate database failure during booking select
    dbFixture.simulateFailure = 'booking_select';
    const failedFirstAttemptRes = await testRequest(
      server,
      '/api/webhooks/spoke',
      'POST',
      { 'spoke-signature': retryHmac },
      retryPayloadString
    );
    assert.strictEqual(failedFirstAttemptRes.status, 500);
    assert.strictEqual(failedFirstAttemptRes.data.retriable, true);

    // Verify inbox event marked as 'failed' (not ignored, not processed)
    const retryHash = crypto.createHash('sha256').update(Buffer.from(retryPayloadString, 'utf8')).digest('hex');
    const inboxRow = dbFixture.webhookEvents.get(retryHash);
    assert.strictEqual(inboxRow.processing_status, 'failed');

    // Clear failure condition: retry request with same payload
    dbFixture.simulateFailure = null;
    const retrySecondAttemptRes = await testRequest(
      server,
      '/api/webhooks/spoke',
      'POST',
      { 'spoke-signature': retryHmac },
      retryPayloadString
    );

    assert.strictEqual(retrySecondAttemptRes.status, 200);
    assert.strictEqual(retrySecondAttemptRes.data.processing_status, 'processed');

    const retriedBooking = dbFixture.bookings.get(RETRY_BOOKING_ID);
    assert.strictEqual(retriedBooking.status, 'In transit');
    console.log('✓ PASS 5.3: Transient failure is retriable and subsequent attempt successfully processes');

    // -------------------------------------------------------------------------
    // 6. Customer Portal UI & Data Mapping Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Customer Portal Tracking UI & Link Security ---');

    // 6.1 Booking model type compatibility
    const testBooking: Booking = {
      id: 'test-booking-id',
      reference: 'NEO-12345',
      date: '2026-10-20',
      origin: '10 Downing St, London',
      destination: '221B Baker St, London',
      vehicle: 'Luton Van',
      total: 150,
      status: 'IN TRANSIT',
      pickup_tracking_url: 'https://tracking.spoke.com/track/pickup-123',
      delivery_tracking_url: 'https://tracking.spoke.com/track/delivery-456',
    };

    assert.strictEqual(testBooking.pickup_tracking_url, 'https://tracking.spoke.com/track/pickup-123');
    assert.strictEqual(testBooking.delivery_tracking_url, 'https://tracking.spoke.com/track/delivery-456');

    // Also verify database row BookingRow from src/lib/types.ts
    const testBookingRow: import('../src/lib/types.ts').BookingRow = {
      id: 'row-1',
      company_id: 'comp-1',
      date_label: '20 Oct',
      pickup: 'London',
      pickup_contact: 'John',
      pickup_phone: '123',
      collection_window: '09:00',
      dropoff: 'Manchester',
      recipient_name: 'Jane',
      recipient_phone: '456',
      delivery_instructions: 'Handle with care',
      goods: 'Electronics',
      weight_kg: 50,
      items_count: 2,
      vehicle: 'Van',
      service: 'Express',
      distance_miles: 200,
      total_gbp: 300,
      payment_method: 'Invoice',
      po_reference: 'PO-1',
      eta_label: '14:00',
      status: 'In transit',
      progress_t: 0.5,
      pickup_tracking_url: 'https://tracking.spoke.com/track/pickup-123',
      delivery_tracking_url: 'https://tracking.spoke.com/track/delivery-456',
    };
    assert.strictEqual(testBookingRow.pickup_tracking_url, 'https://tracking.spoke.com/track/pickup-123');
    assert.strictEqual(testBookingRow.delivery_tracking_url, 'https://tracking.spoke.com/track/delivery-456');
    console.log('✓ PASS 6.1: Booking and BookingRow types include optional pickup_tracking_url and delivery_tracking_url');

    // 6.2 Static check of LiveTrackingView component for secure link opening
    const liveTrackingPath = path.resolve('src/components/views/LiveTrackingView.tsx');
    assert.ok(fs.existsSync(liveTrackingPath), 'LiveTrackingView.tsx must exist');

    const liveTrackingContent = fs.readFileSync(liveTrackingPath, 'utf8');
    assert.ok(
      liveTrackingContent.includes('target="_blank"'),
      'LiveTrackingView must open external links in a new window/tab'
    );
    assert.ok(
      liveTrackingContent.includes('rel="noopener noreferrer"'),
      'LiveTrackingView must use rel="noopener noreferrer" for security'
    );
    assert.ok(
      liveTrackingContent.includes('pickup_tracking_url') || liveTrackingContent.includes('delivery_tracking_url'),
      'LiveTrackingView must display verified dispatch tracking URLs'
    );
    assert.ok(
      liveTrackingContent.includes('isValidHttpsUrl'),
      'LiveTrackingView must validate external links with isValidHttpsUrl guard'
    );
    console.log('✓ PASS 6.2: LiveTrackingView safely renders verified HTTPS tracking links with target="_blank" and rel="noopener noreferrer"');

    // -------------------------------------------------------------------------
    // 7. Security Boundaries & Locked Write Guards
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Scope Boundaries & Write Guards ---');
    const { spokeClient } = await import('../api/spokeClient.ts');
    await assert.rejects(
      async () => spokeClient.createPlan({} as any),
      /locked/i,
      'createPlan must remain strictly locked'
    );
    await assert.rejects(
      async () => spokeClient.importStops('plans/test' as any, {} as any),
      /locked/i,
      'importStops must remain strictly locked'
    );
    console.log('✓ PASS 7.1: spokeClient mutating endpoints remain strictly locked');

    // -------------------------------------------------------------------------
    // 8. Testing Production RPC Enforcement & Fallback Lockdown
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Testing Production RPC Enforcement & Fallback Lockdown ---');

    // 8.1 In production mode (NODE_ENV=production), activating fallback is strictly rejected
    process.env.NODE_ENV = 'production';
    assert.throws(
      () => setAllowSpokeEventFallbackForTesting(true),
      /SECURITY VIOLATION/i,
      'setAllowSpokeEventFallbackForTesting must throw a security violation in production mode'
    );
    assert.strictEqual(
      isSpokeEventFallbackAllowedForTesting(),
      false,
      'Fallback must strictly evaluate to false in production mode'
    );
    console.log('✓ PASS 8.1: Test fallback configuration helper strictly fails closed in production mode');

    // 8.2 In production mode, missing RPC fails closed without invoking fallback
    const PROD_BOOKING_ID = 'b73919e1-1234-4567-89ab-000000000007';
    dbFixture.seedBooking({ id: PROD_BOOKING_ID, company_id: COMPANY_ID, status: 'Scheduled' });

    const prodPayload: SpokeWebhookPayload = {
      type: 'stop.out_for_delivery',
      version: 'v1',
      created: 1729355000000,
      data: {
        stop: {
          id: 'plans/prod/stops/stop_1',
          activity: 'pickup',
          orderInfo: { sellerOrderId: PROD_BOOKING_ID },
          recipient: { externalId: COMPANY_ID },
        },
      },
    };
    const prodHash = 'hash_prod_test_01';
    await testDbClient.from('spoke_webhook_events').insert({
      event_hash: prodHash,
      event_type: prodPayload.type,
      event_version: prodPayload.version,
      event_created_at: new Date(prodPayload.created).toISOString(),
      payload: prodPayload,
      processing_status: 'received',
    });

    let fallbackWasInvoked = false;
    const clientWithMissingRpc: any = {
      rpc: async () => ({
        data: null,
        error: { code: '42883', message: 'function public.process_spoke_webhook_event(text) does not exist' },
      }),
      from: (tbl: string) => {
        if (tbl === 'bookings' || tbl === 'spoke_booking_stop_state') {
          fallbackWasInvoked = true;
        }
        return testDbClient.from(tbl);
      },
    };

    const missingRpcProdResult = await processSpokeWebhookEvent(prodHash, clientWithMissingRpc, { allowFallback: true });
    assert.strictEqual(missingRpcProdResult.success, false, 'Missing RPC in production must return failed result');
    assert.strictEqual(missingRpcProdResult.status, 'failed');
    assert.strictEqual(fallbackWasInvoked, false, 'Fallback processor must NEVER be invoked in production');
    console.log('✓ PASS 8.2: Missing RPC fails closed in production without invoking fallback even if allowFallback=true');

    // 8.3 In production mode, thrown RPC exception fails closed without invoking fallback
    fallbackWasInvoked = false;
    const clientWithThrowingRpc: any = {
      rpc: async () => {
        throw new Error('Connection terminated unexpectedly by upstream database pool');
      },
      from: (tbl: string) => {
        if (tbl === 'bookings' || tbl === 'spoke_booking_stop_state') {
          fallbackWasInvoked = true;
        }
        return testDbClient.from(tbl);
      },
    };

    const thrownRpcProdResult = await processSpokeWebhookEvent(prodHash, clientWithThrowingRpc, { allowFallback: true });
    assert.strictEqual(thrownRpcProdResult.success, false, 'Thrown RPC exception in production must return failed result');
    assert.strictEqual(thrownRpcProdResult.status, 'failed');
    assert.strictEqual(fallbackWasInvoked, false, 'Fallback processor must NEVER be invoked on thrown RPC exception in production');
    console.log('✓ PASS 8.3: Thrown RPC exception fails closed in production without invoking fallback');

    // 8.4 In production mode, HTTP endpoint returns 500 retriable when RPC is missing
    process.env.NODE_ENV = 'test';
    setServerSupabaseClientForTesting(clientWithMissingRpc);
    process.env.NODE_ENV = 'production';

    const prodHttpPayloadString = JSON.stringify(prodPayload);
    const prodHttpHmac = computeHmacHex(TEST_SECRET, prodHttpPayloadString);

    const prodHttpRes = await testRequest(
      server,
      '/api/webhooks/spoke',
      'POST',
      { 'spoke-signature': prodHttpHmac },
      prodHttpPayloadString
    );
    assert.strictEqual(prodHttpRes.status, 500, 'HTTP endpoint must return 500 when RPC is missing in production');
    assert.strictEqual(prodHttpRes.data.retriable, true, 'Error must be marked retriable for Spoke redelivery');
    console.log('✓ PASS 8.4: HTTP endpoint returns 500 retriable in production on missing RPC');

    // Restore test environment for test-override tests
    process.env.NODE_ENV = 'test';
    setServerSupabaseClientForTesting(testDbClient);

    // 8.5 In test mode without fallback override, missing RPC fails closed
    fallbackWasInvoked = false;
    setAllowSpokeEventFallbackForTesting(false);
    const testWithoutOverrideResult = await processSpokeWebhookEvent(prodHash, clientWithMissingRpc);
    assert.strictEqual(testWithoutOverrideResult.success, false);
    assert.strictEqual(testWithoutOverrideResult.status, 'failed');
    assert.strictEqual(fallbackWasInvoked, false, 'Fallback must NOT be invoked in test mode when override is disabled');
    console.log('✓ PASS 8.5: Missing RPC in test mode fails closed when explicit fallback override is disabled');

    // 8.6 In test mode with explicit fallback override, missing RPC invokes fallback and succeeds
    fallbackWasInvoked = false;
    setAllowSpokeEventFallbackForTesting(true);
    assert.strictEqual(isSpokeEventFallbackAllowedForTesting(), true);

    const testWithOverrideResult = await processSpokeWebhookEvent(prodHash, clientWithMissingRpc);
    assert.strictEqual(testWithOverrideResult.success, true);
    assert.strictEqual(testWithOverrideResult.status, 'processed');
    assert.strictEqual(fallbackWasInvoked, true, 'Fallback processor must be invoked in test mode when override is enabled');
    console.log('✓ PASS 8.6: Missing RPC in test mode invokes fallback and succeeds when override is explicitly enabled');

    // Reset override
    setAllowSpokeEventFallbackForTesting(false);

    console.log('\n=============================================================');
    console.log('=== ALL SPOKE EVENT PROCESSING TESTS PASSED (0 failures) ===');
    console.log('=============================================================\n');
  } finally {
    try {
      process.env.NODE_ENV = 'test';
      setAllowSpokeEventFallbackForTesting(false);
      setServerSupabaseClientForTesting(null);
    } catch (_err) {
      // ignore
    }
    process.env.NODE_ENV = originalNodeEnv;
    if (originalSecret) {
      process.env.SPOKE_WEBHOOK_SECRET = originalSecret;
    } else {
      delete process.env.SPOKE_WEBHOOK_SECRET;
    }
    server.close();
  }
}

runSpokeEventProcessingTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});

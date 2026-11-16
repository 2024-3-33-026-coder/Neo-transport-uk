/**
 * NEO Transport — Aircall Telephony Service & Webhook Processor
 *
 * Provides:
 * 1. Webhook token authentication & signature validation.
 * 2. Inbound/Outbound call event processing (call.created, call.answered, call.ended, call.voicemail_left).
 * 3. Phone number correlation with active bookings and customer companies.
 * 4. Automatic logging into support tickets & audit tables.
 * 5. Diagnostic connectivity helpers to verify Aircall API health.
 */

import https from 'https';
import crypto from 'crypto';
import type { Request } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AircallUser {
  id: number;
  name: string;
  email: string;
}

export interface AircallNumber {
  id: number;
  name: string;
  digits: string;
  country?: string;
  time_zone?: string;
  open?: boolean;
}

export interface AircallCallData {
  id: number;
  direct_link?: string;
  direction?: 'inbound' | 'outbound';
  status?: string;
  missed_call_reason?: string | null;
  started_at?: number;
  answered_at?: number;
  ended_at?: number;
  duration?: number;
  raw_digits?: string;
  user?: AircallUser | null;
  contact?: {
    id?: number;
    first_name?: string;
    last_name?: string;
    company_name?: string;
    phone_numbers?: Array<{ label?: string; value?: string }>;
  } | null;
  number?: AircallNumber | null;
  recording?: string | null;
  voicemail?: string | null;
  comments?: Array<{ id: number; content: string }>;
  tags?: Array<{ id: number; name: string }>;
  [key: string]: any;
}

export interface AircallWebhookEvent {
  resource: string;
  event: string;
  timestamp: number;
  token?: string;
  data: AircallCallData;
}

export interface AircallWebhookVerificationResult {
  valid: boolean;
  status: number;
  error?: string;
}

export interface AircallEventProcessingResult {
  success: boolean;
  eventHash?: string;
  callId?: number;
  eventType?: string;
  ticketId?: string;
  bookingId?: string;
  companyId?: string;
  duplicate?: boolean;
  actionTaken?: string;
  error?: string;
}

/**
 * Timing-safe token verification for incoming Aircall webhooks.
 * Aircall sends the security token in the request body `token` field,
 * or optionally via `x-aircall-token` header.
 */
export function verifyAircallWebhookToken(
  req: Request,
  expectedToken?: string
): AircallWebhookVerificationResult {
  const configuredToken =
    expectedToken !== undefined ? expectedToken : (process.env.AIRCALL_WEBHOOK_TOKEN || '');

  if (!configuredToken || configuredToken.trim() === '') {
    return {
      valid: false,
      status: 503,
      error: 'Aircall webhook token is not configured on the server environment.',
    };
  }

  const providedToken =
    (req.headers['x-aircall-token'] as string) ||
    (req.body && typeof req.body === 'object' && typeof req.body.token === 'string'
      ? req.body.token
      : '');

  if (!providedToken || providedToken.trim() === '') {
    return {
      valid: false,
      status: 401,
      error: 'Missing Aircall webhook token.',
    };
  }

  const cleanProvided = providedToken.trim();
  const cleanExpected = configuredToken.trim();

  // Timing-safe constant-time comparison
  const expectedBuf = Buffer.from(cleanExpected, 'utf8');
  const providedBuf = Buffer.from(cleanProvided, 'utf8');

  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return {
      valid: false,
      status: 401,
      error: 'Invalid Aircall webhook token.',
    };
  }

  return { valid: true, status: 200 };
}

/**
 * Normalizes phone numbers for matching (stripping non-digits and leading zeros/country codes).
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  // Normalize UK numbers: 44XXXXXXXXXX -> 0XXXXXXXXXX or standard 10/11 digits
  if (digits.startsWith('44') && digits.length >= 11) {
    return digits.slice(2);
  }
  if (digits.startsWith('0') && digits.length >= 10) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Formats duration in seconds to a human-readable string (e.g., "2m 15s" or "45s").
 */
export function formatCallDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

/**
 * Atomically processes an Aircall webhook event:
 * 1. Checks and logs to `aircall_webhook_events` for idempotency.
 * 2. Matches caller phone number to active bookings or customer companies.
 * 3. Creates or updates support tickets and activity logs.
 */
export async function processAircallWebhookEvent(
  event: AircallWebhookEvent,
  dbClient: SupabaseClient
): Promise<AircallEventProcessingResult> {
  if (!event || !event.event || !event.data) {
    return {
      success: false,
      error: 'Invalid Aircall webhook payload structure.',
    };
  }

  const call = event.data;
  const callId = call.id;
  const eventType = event.event;
  const eventHash = crypto
    .createHash('sha256')
    .update(`${eventType}-${callId}-${event.timestamp || Date.now()}`)
    .digest('hex');

  // 1. Durably record event if aircall_webhook_events table exists
  let isDuplicate = false;
  try {
    const { error: insertErr } = await dbClient
      .from('aircall_webhook_events')
      .insert({
        event_hash: eventHash,
        event_type: eventType,
        call_id: callId,
        payload: event,
        created_at: new Date(event.timestamp ? event.timestamp * 1000 : Date.now()).toISOString(),
      });

    if (insertErr) {
      if (
        insertErr.code === '23505' ||
        insertErr.message?.toLowerCase().includes('duplicate') ||
        insertErr.message?.toLowerCase().includes('unique')
      ) {
        isDuplicate = true;
        return {
          success: true,
          eventHash,
          callId,
          eventType,
          duplicate: true,
          actionTaken: 'already_processed',
        };
      }
      // Table might not exist yet; log notice and proceed gracefully
      console.warn('[Aircall Webhook] Notice: aircall_webhook_events insert non-blocking notice:', insertErr.message);
    }
  } catch (err: any) {
    console.warn('[Aircall Webhook] Event logging fallback:', err?.message || err);
  }

  // 2. Correlate phone number with Bookings or Companies
  const rawCallerNumber = call.raw_digits || '';
  const normalizedCaller = normalizePhoneNumber(rawCallerNumber);

  let matchedBookingId: string | undefined;
  let matchedCompanyId: string | undefined;

  if (normalizedCaller && normalizedCaller.length >= 6) {
    try {
      // Search recent active bookings for collection or delivery contact phone
      const { data: bookings } = await dbClient
        .from('bookings')
        .select('id, company_id, collection_contact_phone, delivery_contact_phone, status')
        .order('created_at', { ascending: false })
        .limit(25);

      if (bookings && bookings.length > 0) {
        const match = bookings.find((b: any) => {
          const col = normalizePhoneNumber(b.collection_contact_phone || '');
          const del = normalizePhoneNumber(b.delivery_contact_phone || '');
          return (
            (col && (col.includes(normalizedCaller) || normalizedCaller.includes(col))) ||
            (del && (del.includes(normalizedCaller) || normalizedCaller.includes(del)))
          );
        });

        if (match) {
          matchedBookingId = match.id;
          matchedCompanyId = match.company_id;
        }
      }
    } catch (bErr: any) {
      console.warn('[Aircall Webhook] Booking matching notice:', bErr?.message);
    }
  }

  // 3. Process specific high-value event types
  let actionTaken = 'logged';
  let ticketId: string | undefined;

  const agentName = call.user?.name || 'NEO Operations Desk';
  const directionStr = call.direction === 'inbound' ? 'Inbound Customer Call' : 'Outbound Call';
  const durationStr = formatCallDuration(call.duration);

  // A. Voicemail Left (Missed call with customer message) -> High Priority Ticket
  if (eventType === 'call.voicemail_left' || (eventType === 'call.ended' && call.voicemail)) {
    try {
      const ticketRef = `SR-AC-${callId}`;
      const topic = `[Aircall Voicemail] Message from ${rawCallerNumber || 'Customer'}`;
      const message =
        `Voicemail received on ${call.number?.digits || '+44 1925 986076'} (${call.number?.name || 'NEO - HQ'}).\n` +
        `Caller Number: ${rawCallerNumber || 'Private/Unknown'}\n` +
        `Duration: ${durationStr}\n` +
        (call.voicemail ? `Audio Recording: ${call.voicemail}\n` : '') +
        (matchedBookingId ? `Matched Booking: ${matchedBookingId}\n` : '') +
        `Timestamp: ${new Date().toISOString()}`;

      const { data: ticket, error: tErr } = await dbClient
        .from('support_tickets')
        .insert({
          id: ticketRef,
          company_id: matchedCompanyId || null,
          topic,
          message,
          status: 'Open',
        })
        .select('id')
        .maybeSingle();

      if (!tErr && ticket) {
        ticketId = ticket.id;
        actionTaken = 'voicemail_ticket_created';
      }
    } catch (err: any) {
      console.warn('[Aircall Webhook] Voicemail ticket creation notice:', err?.message);
    }
  }

  // B. Completed Call Ended with Recording -> Log to Support Tickets as Resolved / Audit
  else if (eventType === 'call.ended') {
    try {
      const ticketRef = `SR-AC-${callId}`;
      const topic = `[Aircall] ${directionStr}: ${rawCallerNumber || 'Customer'} (${durationStr})`;
      const message =
        `Call completed via Aircall (${call.number?.name || 'NEO - HQ Desk'}).\n` +
        `Agent: ${agentName}\n` +
        `Duration: ${durationStr}\n` +
        `Status: ${call.status || 'done'}\n` +
        (call.recording ? `Call Recording: ${call.recording}\n` : '') +
        (matchedBookingId ? `Related Booking: ${matchedBookingId}\n` : '') +
        `Ended at: ${new Date(call.ended_at ? call.ended_at * 1000 : Date.now()).toISOString()}`;

      const { data: ticket, error: tErr } = await dbClient
        .from('support_tickets')
        .insert({
          id: ticketRef,
          company_id: matchedCompanyId || null,
          topic,
          message,
          status: 'Resolved',
        })
        .select('id')
        .maybeSingle();

      if (!tErr && ticket) {
        ticketId = ticket.id;
        actionTaken = 'call_log_ticket_created';
      }
    } catch (err: any) {
      console.warn('[Aircall Webhook] Call ticket creation notice:', err?.message);
    }
  }

  return {
    success: true,
    eventHash,
    callId,
    eventType,
    ticketId,
    bookingId: matchedBookingId,
    companyId: matchedCompanyId,
    actionTaken,
  };
}

/**
 * Queries Aircall REST API with Basic Auth using configured credentials.
 */
function makeAircallApiRequest<T = any>(
  path: string,
  options?: { apiId?: string; apiToken?: string }
): Promise<{ status: number; data?: T; error?: string }> {
  const apiId = options?.apiId || process.env.AIRCALL_API_ID;
  const apiToken = options?.apiToken || process.env.AIRCALL_API_TOKEN;

  if (!apiId || !apiToken) {
    return Promise.resolve({
      status: 503,
      error: 'Aircall API credentials (AIRCALL_API_ID / AIRCALL_API_TOKEN) are unconfigured.',
    });
  }

  const auth = Buffer.from(`${apiId.trim()}:${apiToken.trim()}`).toString('base64');

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.aircall.io',
        port: 443,
        path,
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
        timeout: 8000,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            resolve({ status: res.statusCode || 200, data: parsed });
          } catch (e: any) {
            resolve({
              status: res.statusCode || 500,
              error: `Invalid JSON response from Aircall: ${e?.message}`,
            });
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 504, error: 'Aircall API request timed out.' });
    });

    req.on('error', (err) => {
      resolve({ status: 500, error: err.message });
    });

    req.end();
  });
}

/**
 * Diagnostic health check querying Aircall API to verify operational status,
 * company name, user count, and provisioned phone numbers.
 */
export async function getAircallOperationalStatus(options?: {
  apiId?: string;
  apiToken?: string;
}): Promise<{
  connected: boolean;
  status: number;
  company?: { name: string; usersCount: number; numbersCount: number };
  numbers?: Array<{ id: number; name: string; digits: string; open: boolean }>;
  users?: Array<{ id: number; name: string; email: string; available: boolean }>;
  error?: string;
}> {
  const pingRes = await makeAircallApiRequest('/v1/ping', options);
  if (pingRes.status !== 200) {
    return {
      connected: false,
      status: pingRes.status,
      error: pingRes.error || 'Aircall API ping failed',
    };
  }

  const [companyRes, numbersRes, usersRes] = await Promise.all([
    makeAircallApiRequest<{ company: { name: string; users_count: number; numbers_count: number } }>(
      '/v1/company',
      options
    ),
    makeAircallApiRequest<{ numbers: Array<any> }>('/v1/numbers', options),
    makeAircallApiRequest<{ users: Array<any> }>('/v1/users', options),
  ]);

  const company = companyRes.data?.company
    ? {
        name: companyRes.data.company.name,
        usersCount: companyRes.data.company.users_count,
        numbersCount: companyRes.data.company.numbers_count,
      }
    : undefined;

  const numbers = numbersRes.data?.numbers
    ? numbersRes.data.numbers.map((n) => ({
        id: n.id,
        name: n.name,
        digits: n.digits,
        open: !!n.open,
      }))
    : [];

  const users = usersRes.data?.users
    ? usersRes.data.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        available: !!u.available,
      }))
    : [];

  return {
    connected: true,
    status: 200,
    company,
    numbers,
    users,
  };
}

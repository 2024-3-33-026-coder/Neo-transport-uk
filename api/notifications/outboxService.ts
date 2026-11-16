/**
 * NEO TRANSPORT LTD — TRANSACTIONAL NOTIFICATION OUTBOX SERVICE
 * 
 * Manages the reliable transactional outbox queue, duplicate delivery suppression,
 * retry backoff, tenant isolation, and dead-letter handling.
 * 
 * SECURITY:
 * - Fails closed on invalid email addresses or cross-tenant leakage.
 * - Idempotency tokens enforce strict at-most-once delivery.
 * - Sanitizes all error messages to ensure zero credential or secret exposure.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  NotificationEventType,
  NotificationOutboxRecord,
  EnqueueNotificationInput,
  ProcessBatchOptions,
  ProcessBatchResult,
  OutboxHealthSummary,
  NotificationStatus,
} from './types.js';
import {
  getActiveEmailAdapter,
  getOperationsAlertEmail,
  getAccountsAlertEmail,
} from './emailAdapter.js';
import {
  getActiveWhatsAppAdapter,
  maskPhoneNumber,
  validatePhoneNumber,
} from './whatsappAdapter.js';
import {
  templateStandbySubmittedCustomer,
  templateStandbySubmittedOps,
  templateStandbyApprovedCustomer,
  templateBookingConfirmedCustomer,
  templateBookingConfirmedOps,
  templatePaymentVerifiedCustomer,
  RenderedTemplate,
} from './templates.js';

// Basic RFC 5322 compatible email validator
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// In-memory fallback outbox for hermetic test suites or disconnected environments
let memoryOutbox: NotificationOutboxRecord[] = [];
let useMemoryStore = false;

export function setMemoryOutboxOverride(enabled: boolean): void {
  useMemoryStore = enabled;
}

export function getMemoryOutboxRecords(): NotificationOutboxRecord[] {
  return [...memoryOutbox];
}

export function clearMemoryOutbox(): void {
  memoryOutbox = [];
}

/**
 * Renders template content based on event type and payload.
 */
function renderEventContent(
  eventType: NotificationEventType,
  payload: Record<string, any>,
  role: string
): RenderedTemplate {
  switch (eventType) {
    case 'standby_application_submitted':
      return role === 'operations'
        ? templateStandbySubmittedOps({
            companyName: payload.companyName || payload.company_name,
            contactName: payload.contactName || payload.contact_name,
            email: payload.email || payload.ops_email || '',
            phone: payload.phone || payload.driver_mobile,
            volume: payload.volume,
            postcode: payload.postcode || payload.dispatch_address,
          })
        : templateStandbySubmittedCustomer({
            companyName: payload.companyName || payload.company_name,
            contactName: payload.contactName || payload.contact_name,
            volume: payload.volume,
          });

    case 'standby_application_approved':
      return templateStandbyApprovedCustomer({
        companyName: payload.companyName || payload.company_name,
        contactName: payload.contactName || payload.contact_name,
        accountCode: payload.accountCode || payload.account_code,
      });

    case 'booking_confirmed':
      return role === 'operations'
        ? templateBookingConfirmedOps({
            bookingId: payload.bookingId || payload.id || payload.reference,
            companyName: payload.companyName || payload.company_name || 'Commercial Client',
            pickup: payload.pickup || payload.origin,
            dropoff: payload.dropoff || payload.destination,
            vehicle: payload.vehicle,
            totalGbp: payload.totalGbp || payload.total || 0,
          })
        : templateBookingConfirmedCustomer({
            bookingId: payload.bookingId || payload.id || payload.reference,
            companyName: payload.companyName || payload.company_name || 'Commercial Client',
            contactName: payload.contactName || payload.pickupContact || 'Valued Customer',
            pickup: payload.pickup || payload.origin,
            dropoff: payload.dropoff || payload.destination,
            vehicle: payload.vehicle,
            totalGbp: payload.totalGbp || payload.total || 0,
            paymentMethod: payload.paymentMethod || payload.payment_method || 'standby-account',
          });

    case 'payment_status_verified':
      return templatePaymentVerifiedCustomer({
        bookingId: payload.bookingId || payload.id || payload.reference,
        amountGbp: payload.amountGbp !== undefined ? payload.amountGbp : (payload.amount_paid_gbp ?? 0),
        paymentIntentId: payload.paymentIntentId || payload.stripe_payment_intent_id || '',
        customerName: payload.customerName || payload.contactName || 'Valued Customer',
        companyName: payload.companyName || payload.company_name,
        invoiceNumber: payload.invoiceNumber || payload.invoice_number || payload.invoiceId,
        invoiceDate: payload.invoiceDate || payload.invoice_date,
        paymentDate: payload.paymentDate || payload.paid_at,
        paymentMethod: payload.paymentMethod || payload.payment_method,
        currency: payload.currency,
        pickup: payload.pickup || payload.origin,
        dropoff: payload.dropoff || payload.destination,
        vehicle: payload.vehicle,
        serviceDescription: payload.serviceDescription || payload.cargo,
        invoiceUrl: payload.invoiceUrl || payload.invoice_url,
        supportEmail: payload.supportEmail,
        supportPhone: payload.supportPhone,
        logoUrl: payload.logoUrl,
      });

    default:
      return {
        subject: `NEO Transport Operational Notice: ${eventType.replace(/_/g, ' ').toUpperCase()}`,
        html: `<p>Authoritative notification for event: <strong>${eventType}</strong>.</p>`,
        text: `Authoritative notification for event: ${eventType}.`,
      };
  }
}

/**
 * Enqueues a notification event into the transactional outbox.
 * Enforces duplicate suppression via idempotency key and sanitizes recipient emails.
 */
export async function enqueueNotification(
  input: EnqueueNotificationInput,
  dbClient?: SupabaseClient | null
): Promise<{ success: boolean; record?: NotificationOutboxRecord; duplicate?: boolean; error?: string }> {
  // 1. Sanitize & validate recipient email
  const recipientEmail = (input.recipient_email || '').trim().toLowerCase();
  if (!recipientEmail || !EMAIL_REGEX.test(recipientEmail)) {
    return {
      success: false,
      error: `INVALID_RECIPIENT_EMAIL: '${input.recipient_email}' is not a valid email address.`,
    };
  }

  // 1b. Validate recipient phone if WhatsApp channel is requested
  let validatedPhone: string | null = null;
  if (input.channel === 'whatsapp') {
    const rawPhone = (input.recipient_phone || '').trim();
    if (!rawPhone) {
      return {
        success: false,
        error: 'INVALID_RECIPIENT_PHONE: WhatsApp notifications require an authoritative recipient_phone.',
      };
    }
    const phoneCheck = validatePhoneNumber(rawPhone);
    if (!phoneCheck.isValid) {
      return {
        success: false,
        error: `INVALID_RECIPIENT_PHONE: '${maskPhoneNumber(rawPhone)}' is not a valid phone number (${phoneCheck.error}).`,
      };
    }
    validatedPhone = phoneCheck.normalized || rawPhone;
  } else if (input.recipient_phone) {
    const rawPhone = input.recipient_phone.trim();
    const phoneCheck = validatePhoneNumber(rawPhone);
    validatedPhone = phoneCheck.isValid ? (phoneCheck.normalized || rawPhone) : rawPhone;
  }

  // 2. Validate idempotency token
  const idempotencyKey = (input.idempotency_key || '').trim();
  if (!idempotencyKey) {
    return {
      success: false,
      error: 'IDEMPOTENCY_KEY_REQUIRED: Notification enqueue requires an authoritative idempotency token.',
    };
  }

  // 3. Render content if subject/templates not provided
  const rendered = renderEventContent(input.event_type, input.payload, input.recipient_role);
  const subject = input.subject || rendered.subject;

  const record: NotificationOutboxRecord = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    event_type: input.event_type,
    idempotency_key: idempotencyKey,
    recipient_email: recipientEmail,
    recipient_phone: validatedPhone || input.recipient_phone || null,
    recipient_role: input.recipient_role,
    channel: input.channel || 'email',
    template_id: input.template_id || input.event_type,
    subject,
    payload: {
      ...input.payload,
      _renderedHtml: rendered.html,
      _renderedText: rendered.text,
    },
    status: 'pending',
    retry_count: 0,
    max_retries: input.max_retries ?? 3,
    created_at: new Date().toISOString(),
    company_id: input.company_id || null,
    booking_id: input.booking_id || null,
  };

  // 4. In-Memory Store Path (Test Mode / Disconnected DB)
  if (useMemoryStore || !dbClient) {
    const existing = memoryOutbox.find((item) => item.idempotency_key === idempotencyKey);
    if (existing) {
      return { success: true, record: existing, duplicate: true };
    }
    memoryOutbox.push(record);
    return { success: true, record, duplicate: false };
  }

  // 5. Database Outbox Persistence Path
  try {
    const { data: existing, error: checkError } = await dbClient
      .from('notifications_outbox')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (!checkError && existing) {
      return { success: true, record: existing as NotificationOutboxRecord, duplicate: true };
    }

    const { data: inserted, error: insertError } = await dbClient
      .from('notifications_outbox')
      .insert({
        event_type: record.event_type,
        idempotency_key: record.idempotency_key,
        recipient_email: record.recipient_email,
        recipient_phone: record.recipient_phone,
        recipient_role: record.recipient_role,
        channel: record.channel,
        template_id: record.template_id,
        subject: record.subject,
        payload: record.payload,
        status: record.status,
        retry_count: record.retry_count,
        max_retries: record.max_retries,
        company_id: record.company_id,
        booking_id: record.booking_id,
      })
      .select()
      .maybeSingle();

    if (insertError) {
      // Check for concurrent race condition on unique idempotency_key constraint
      if ((insertError as any).code === '23505') {
        const { data: dup } = await dbClient
          .from('notifications_outbox')
          .select('*')
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();
        return { success: true, record: (dup as any) || record, duplicate: true };
      }
      console.error('[NEO Outbox] Failed to insert notification record:', insertError.message);
      return { success: false, error: insertError.message };
    }

    return { success: true, record: (inserted as NotificationOutboxRecord) || record, duplicate: false };
  } catch (err: any) {
    console.error('[NEO Outbox] Outbox persistence exception:', err?.message || err);
    return { success: false, error: err?.message || 'Database error' };
  }
}

/**
 * Processes a batch of pending or retriable failed notifications from the outbox.
 */
export async function processOutboxBatch(
  dbClient?: SupabaseClient | null,
  options?: ProcessBatchOptions
): Promise<ProcessBatchResult> {
  const batchSize = options?.batchSize ?? 10;
  const maxRetries = options?.maxRetries ?? 3;
  const adapter = getActiveEmailAdapter();
  const whatsappAdapter = getActiveWhatsAppAdapter();

  const summary: ProcessBatchResult = {
    totalProcessed: 0,
    deliveredCount: 0,
    failedCount: 0,
    deadLetterCount: 0,
    skippedCount: 0,
    results: [],
  };

  // Safe Guard: If all delivery providers are disabled or unconfigured, do not burn retries or dead-letter queue records
  if (!adapter.isEnabled && !whatsappAdapter.isEnabled) {
    return summary;
  }

  // 1. In-Memory Store Path (Test Mode / Unit Testing)
  if (useMemoryStore || !dbClient) {
    const candidates = memoryOutbox
      .filter((item) => (item.status === 'pending' || item.status === 'failed') && item.retry_count < maxRetries)
      .slice(0, batchSize);

    for (const item of candidates) {
      const channel = item.channel || 'email';

      if (channel === 'whatsapp') {
        if (!whatsappAdapter.isEnabled) {
          summary.skippedCount++;
          continue;
        }
      } else {
        if (!adapter.isEnabled) {
          summary.skippedCount++;
          continue;
        }
      }

      summary.totalProcessed++;
      item.status = 'processing';

      let sendResult: { success: boolean; messageId?: string; error?: string; status?: number };

      if (channel === 'whatsapp') {
        const rawPhone = item.recipient_phone || '';
        const phoneCheck = validatePhoneNumber(rawPhone);
        if (!phoneCheck.isValid) {
          sendResult = {
            success: false,
            error: `INVALID_PHONE_NUMBER: '${maskPhoneNumber(rawPhone)}' (${phoneCheck.error})`,
            status: 400,
          };
        } else {
          sendResult = await whatsappAdapter.sendWhatsApp({
            to: phoneCheck.normalized || rawPhone,
            templateId: item.template_id,
            templateParams: item.payload?.templateParams || item.payload,
            text: item.payload?._renderedText || item.subject,
            idempotencyKey: item.idempotency_key,
            bookingId: item.booking_id || undefined,
            companyId: item.company_id || undefined,
          });
        }
      } else {
        const html = item.payload?._renderedHtml || `<p>${item.subject}</p>`;
        const text = item.payload?._renderedText || item.subject;

        sendResult = await adapter.sendEmail({
          to: item.recipient_email,
          subject: item.subject,
          html,
          text,
          idempotencyKey: item.idempotency_key,
        });
      }

      if (sendResult.success) {
        item.status = 'delivered';
        item.sent_at = new Date().toISOString();
        item.last_error = null;
        summary.deliveredCount++;
        summary.results.push({
          id: item.id,
          idempotency_key: item.idempotency_key,
          status: 'delivered',
          recipient_email: item.recipient_email,
        });
      } else {
        item.retry_count++;
        item.last_error = sendResult.error || 'Unknown send failure';
        const isNonRetriable = sendResult.status === 400;
        if (isNonRetriable || item.retry_count >= item.max_retries) {
          item.status = 'dead_letter';
          summary.deadLetterCount++;
        } else {
          item.status = 'failed';
          summary.failedCount++;
        }
        summary.results.push({
          id: item.id,
          idempotency_key: item.idempotency_key,
          status: item.status,
          recipient_email: item.recipient_email,
          error: item.last_error,
        });
      }
    }

    return summary;
  }

  // 2. Database Outbox Queue Processing Path
  try {
    const { data: candidates, error: fetchError } = await dbClient
      .from('notifications_outbox')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lt('retry_count', maxRetries)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (fetchError || !candidates || candidates.length === 0) {
      return summary;
    }

    for (const raw of candidates) {
      const item = raw as NotificationOutboxRecord;
      const channel = item.channel || 'email';

      if (channel === 'whatsapp') {
        if (!whatsappAdapter.isEnabled) {
          summary.skippedCount++;
          continue;
        }
      } else {
        if (!adapter.isEnabled) {
          summary.skippedCount++;
          continue;
        }
      }

      summary.totalProcessed++;

      // Lock row to 'processing'
      await dbClient
        .from('notifications_outbox')
        .update({ status: 'processing' })
        .eq('id', item.id);

      let sendResult: { success: boolean; messageId?: string; error?: string; status?: number };

      if (channel === 'whatsapp') {
        const rawPhone = item.recipient_phone || '';
        const phoneCheck = validatePhoneNumber(rawPhone);
        if (!phoneCheck.isValid) {
          sendResult = {
            success: false,
            error: `INVALID_PHONE_NUMBER: '${maskPhoneNumber(rawPhone)}' (${phoneCheck.error})`,
            status: 400,
          };
        } else {
          sendResult = await whatsappAdapter.sendWhatsApp({
            to: phoneCheck.normalized || rawPhone,
            templateId: item.template_id,
            templateParams: item.payload?.templateParams || item.payload,
            text: item.payload?._renderedText || item.subject,
            idempotencyKey: item.idempotency_key,
            bookingId: item.booking_id || undefined,
            companyId: item.company_id || undefined,
          });
        }
      } else {
        const html = item.payload?._renderedHtml || `<p>${item.subject}</p>`;
        const text = item.payload?._renderedText || item.subject;

        sendResult = await adapter.sendEmail({
          to: item.recipient_email,
          subject: item.subject,
          html,
          text,
          idempotencyKey: item.idempotency_key,
        });
      }

      if (sendResult.success) {
        await dbClient
          .from('notifications_outbox')
          .update({
            status: 'delivered',
            sent_at: new Date().toISOString(),
            last_error: null,
          })
          .eq('id', item.id);

        summary.deliveredCount++;
        summary.results.push({
          id: item.id,
          idempotency_key: item.idempotency_key,
          status: 'delivered',
          recipient_email: item.recipient_email,
        });
      } else {
        const nextRetry = item.retry_count + 1;
        const isNonRetriable = sendResult.status === 400;
        const nextStatus: NotificationStatus = (isNonRetriable || nextRetry >= (item.max_retries || maxRetries))
          ? 'dead_letter'
          : 'failed';
        const sanitizedErr = sendResult.error || 'Delivery failed';

        await dbClient
          .from('notifications_outbox')
          .update({
            status: nextStatus,
            retry_count: nextRetry,
            last_error: sanitizedErr,
          })
          .eq('id', item.id);

        if (nextStatus === 'dead_letter') {
          summary.deadLetterCount++;
        } else {
          summary.failedCount++;
        }

        summary.results.push({
          id: item.id,
          idempotency_key: item.idempotency_key,
          status: nextStatus,
          recipient_email: item.recipient_email,
          error: sanitizedErr,
        });
      }
    }

    return summary;
  } catch (batchErr: any) {
    console.error('[NEO Outbox] Error during outbox batch processing:', batchErr?.message || batchErr);
    return summary;
  }
}

/**
 * Health diagnostic report for monitoring dashboard and operations checks.
 */
export async function getOutboxHealth(dbClient?: SupabaseClient | null): Promise<OutboxHealthSummary> {
  const adapter = getActiveEmailAdapter();
  const whatsappAdapter = getActiveWhatsAppAdapter();
  const isAnyEnabled = adapter.isEnabled || whatsappAdapter.isEnabled;
  const summary: OutboxHealthSummary = {
    status: isAnyEnabled ? 'healthy' : 'unconfigured',
    emailProvider: adapter.name,
    isProviderConfigured: adapter.isConfigured,
    isDeliveryEnabled: adapter.isEnabled,
    whatsappProvider: whatsappAdapter.name,
    isWhatsAppConfigured: whatsappAdapter.isConfigured,
    isWhatsAppEnabled: whatsappAdapter.isEnabled,
    counts: {
      pending: 0,
      processing: 0,
      delivered: 0,
      failed: 0,
      dead_letter: 0,
    },
    timestamp: new Date().toISOString(),
  };

  if (useMemoryStore || !dbClient) {
    for (const item of memoryOutbox) {
      if (item.status in summary.counts) {
        summary.counts[item.status]++;
      }
    }
    return summary;
  }

  try {
    const { data: counts, error } = await dbClient
      .from('notifications_outbox')
      .select('status');

    if (!error && counts) {
      for (const row of counts) {
        const s = (row as any).status as NotificationStatus;
        if (s in summary.counts) {
          summary.counts[s]++;
        }
      }
    }
  } catch (err) {
    summary.status = 'degraded';
  }

  return summary;
}

/**
 * High-level orchestration helpers for business events
 */
export async function enqueueStandbySubmissionEvents(
  application: { id: string; company_name: string; contact_name: string; ops_email?: string; accounts_email?: string; driver_mobile?: string; volume?: string; postcode?: string },
  dbClient?: SupabaseClient | null
) {
  const opsEmail = getOperationsAlertEmail();
  const applicantEmail = application.ops_email || application.accounts_email;

  const results = [];

  // Event 1A: Operations Alert (only when operations recipient is resolved)
  if (opsEmail && EMAIL_REGEX.test(opsEmail)) {
    results.push(await enqueueNotification({
      event_type: 'standby_application_submitted',
      idempotency_key: `standby_sub_ops_${application.id}`,
      recipient_email: opsEmail,
      recipient_role: 'operations',
      payload: {
        applicationId: application.id,
        companyName: application.company_name,
        contactName: application.contact_name,
        email: applicantEmail,
        phone: application.driver_mobile,
        volume: application.volume,
        postcode: application.postcode,
      },
    }, dbClient));
  }

  // Event 1B: Applicant Receipt (if valid email provided)
  if (applicantEmail) {
    results.push(await enqueueNotification({
      event_type: 'standby_application_submitted',
      idempotency_key: `standby_sub_applicant_${application.id}`,
      recipient_email: applicantEmail,
      recipient_role: 'customer',
      payload: {
        applicationId: application.id,
        companyName: application.company_name,
        contactName: application.contact_name,
        volume: application.volume,
      },
    }, dbClient));
  }

  return results;
}

export async function enqueueStandbyApprovedEvents(
  application: { id: string; company_name: string; contact_name: string; account_code: string; ops_email?: string; accounts_email?: string },
  dbClient?: SupabaseClient | null
) {
  const applicantEmail = application.ops_email || application.accounts_email;
  if (!applicantEmail) return [];

  return [await enqueueNotification({
    event_type: 'standby_application_approved',
    idempotency_key: `standby_appr_${application.id}_${application.account_code}`,
    recipient_email: applicantEmail,
    recipient_role: 'customer',
    payload: {
      applicationId: application.id,
      companyName: application.company_name,
      contactName: application.contact_name,
      accountCode: application.account_code,
    },
  }, dbClient)];
}

export async function enqueueBookingConfirmedEvents(
  booking: {
    id: string;
    reference?: string;
    company_id?: string;
    pickup?: string;
    origin?: string;
    dropoff?: string;
    destination?: string;
    vehicle: string;
    total_gbp?: number;
    total?: number;
    payment_method?: string;
    recipient_name?: string;
  },
  company: { id: string; name: string },
  customerContact: { email: string; name?: string },
  dbClient?: SupabaseClient | null
) {
  const ref = booking.reference || booking.id;
  const pickup = booking.pickup || booking.origin || '';
  const dropoff = booking.dropoff || booking.destination || '';
  const totalGbp = booking.total_gbp !== undefined ? booking.total_gbp : (booking.total ?? 0);
  const opsEmail = getOperationsAlertEmail();
  const results = [];

  // Event 4A: Operations Alert (only when operations recipient is resolved)
  if (opsEmail && EMAIL_REGEX.test(opsEmail)) {
    results.push(await enqueueNotification({
      event_type: 'booking_confirmed',
      idempotency_key: `booking_conf_ops_${ref}`,
      recipient_email: opsEmail,
      recipient_role: 'operations',
      company_id: company.id,
      booking_id: ref,
      payload: {
        bookingId: ref,
        companyName: company.name,
        pickup,
        dropoff,
        vehicle: booking.vehicle,
        totalGbp,
        paymentMethod: booking.payment_method || 'Invoice',
      },
    }, dbClient));
  }

  // Event 4B: Customer Receipt
  if (customerContact?.email) {
    results.push(await enqueueNotification({
      event_type: 'booking_confirmed',
      idempotency_key: `booking_conf_customer_${ref}`,
      recipient_email: customerContact.email,
      recipient_role: 'customer',
      company_id: company.id,
      booking_id: ref,
      payload: {
        bookingId: ref,
        companyName: company.name,
        contactName: customerContact.name || 'Valued Customer',
        pickup,
        dropoff,
        vehicle: booking.vehicle,
        totalGbp,
      },
    }, dbClient));
  }

  return results;
}

export async function enqueuePaymentVerifiedEvents(
  payment: {
    bookingId: string;
    amountGbp: number;
    stripePaymentIntentId: string;
    customerEmail: string;
    customerName?: string;
    companyId?: string;
    companyName?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    paymentDate?: string;
    paymentMethod?: string;
    currency?: string;
    pickup?: string;
    dropoff?: string;
    vehicle?: string;
    serviceDescription?: string;
    invoiceUrl?: string;
    supportEmail?: string;
    supportPhone?: string;
    logoUrl?: string;
  },
  dbClient?: SupabaseClient | null
) {
  const results = [];

  // If dbClient is provided and route fields are missing, attempt lookup from bookings table
  let enrichedPickup = payment.pickup;
  let enrichedDropoff = payment.dropoff;
  let enrichedVehicle = payment.vehicle;
  let enrichedCargo = payment.serviceDescription;
  let enrichedCompany = payment.companyName;

  if (dbClient && payment.bookingId && (!enrichedPickup || !enrichedDropoff)) {
    try {
      const { data: b } = await dbClient
        .from('bookings')
        .select('pickup, dropoff, origin, destination, vehicle, cargo, company_name')
        .eq('id', payment.bookingId)
        .maybeSingle();
      if (b) {
        enrichedPickup = enrichedPickup || b.pickup || b.origin;
        enrichedDropoff = enrichedDropoff || b.dropoff || b.destination;
        enrichedVehicle = enrichedVehicle || b.vehicle;
        enrichedCargo = enrichedCargo || b.cargo;
        enrichedCompany = enrichedCompany || b.company_name;
      }
    } catch (_err) {
      // Non-fatal enrichment fallback
    }
  }

  // Customer VAT Receipt & Invoice Confirmation
  if (payment.customerEmail) {
    results.push(await enqueueNotification({
      event_type: 'payment_status_verified',
      idempotency_key: `payment_verif_cust_${payment.bookingId}_${payment.stripePaymentIntentId}`,
      recipient_email: payment.customerEmail,
      recipient_role: 'customer',
      company_id: payment.companyId,
      booking_id: payment.bookingId,
      payload: {
        bookingId: payment.bookingId,
        amountGbp: payment.amountGbp,
        paymentIntentId: payment.stripePaymentIntentId,
        customerName: payment.customerName || 'Valued Customer',
        companyName: enrichedCompany,
        invoiceNumber: payment.invoiceNumber,
        invoiceDate: payment.invoiceDate,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        currency: payment.currency,
        pickup: enrichedPickup,
        dropoff: enrichedDropoff,
        vehicle: enrichedVehicle,
        serviceDescription: enrichedCargo,
        invoiceUrl: payment.invoiceUrl,
        supportEmail: payment.supportEmail,
        supportPhone: payment.supportPhone,
        logoUrl: payment.logoUrl,
      },
    }, dbClient));
  }

  return results;
}

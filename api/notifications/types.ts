/**
 * NEO TRANSPORT LTD — TRANSACTIONAL NOTIFICATION OUTBOX TYPES
 * 
 * Defines the core contracts for transactional email, outbox event queueing,
 * idempotent delivery, retry tracking, and dead-letter handling.
 * 
 * SECURITY:
 * - Recipient data and company IDs are strictly partitioned to prevent cross-tenant leakage.
 * - Outbox records are accessible strictly via service_role server contexts.
 * - Secrets (API keys, webhook tokens) are never stored in payload JSON or returned in health checks.
 */

export type NotificationEventType =
  | 'standby_application_submitted'
  | 'standby_application_approved'
  | 'standby_application_rejected'
  | 'booking_confirmed'
  | 'booking_status_changed'
  | 'payment_status_verified'
  | 'delivery_completed'
  | 'delivery_exception';

export type NotificationChannel = 'email' | 'in_app' | 'sms' | 'whatsapp';

export type NotificationRole = 'customer' | 'operations' | 'driver';

export type NotificationStatus = 'pending' | 'processing' | 'delivered' | 'failed' | 'dead_letter';

export interface NotificationOutboxRecord {
  id: string;
  event_type: NotificationEventType;
  idempotency_key: string;
  recipient_email: string;
  recipient_phone?: string | null;
  recipient_role: NotificationRole;
  channel: NotificationChannel;
  template_id: string;
  subject: string;
  payload: Record<string, any>;
  status: NotificationStatus;
  retry_count: number;
  max_retries: number;
  last_error?: string | null;
  created_at: string;
  sent_at?: string | null;
  company_id?: string | null;
  booking_id?: string | null;
}

export interface EnqueueNotificationInput {
  event_type: NotificationEventType;
  idempotency_key: string;
  recipient_email: string;
  recipient_phone?: string | null;
  recipient_role: NotificationRole;
  channel?: NotificationChannel; // Defaults to 'email'
  template_id?: string;
  subject?: string;
  payload: Record<string, any>;
  company_id?: string | null;
  booking_id?: string | null;
  max_retries?: number; // Defaults to 3
}

export interface ProcessBatchOptions {
  batchSize?: number; // Defaults to 10
  maxRetries?: number; // Defaults to 3
}

export interface ProcessBatchResult {
  totalProcessed: number;
  deliveredCount: number;
  failedCount: number;
  deadLetterCount: number;
  skippedCount: number;
  results: Array<{
    id: string;
    idempotency_key: string;
    status: NotificationStatus;
    recipient_email: string;
    error?: string;
  }>;
}

export interface OutboxHealthSummary {
  status: 'healthy' | 'degraded' | 'unconfigured';
  emailProvider: string;
  isProviderConfigured: boolean;
  isDeliveryEnabled: boolean;
  whatsappProvider?: string;
  isWhatsAppConfigured?: boolean;
  isWhatsAppEnabled?: boolean;
  counts: {
    pending: number;
    processing: number;
    delivered: number;
    failed: number;
    dead_letter: number;
  };
  timestamp: string;
}

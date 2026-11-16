import { Booking, Quote, Invoice, DocumentItem, BookingWizardState, SupportTicket, SupportTicketMessage } from '../types';
import { StandbyApplication, ProfileWithCompany, CompanyDetails, AdminAuditLog, Company } from './types';
import { CONTACT_CONFIG } from './config';
import {
  INITIAL_BOOKINGS,
  INITIAL_QUOTES,
  INITIAL_INVOICES,
  INITIAL_DOCUMENTS,
} from '../data/mockData';
import { supabase, isSupabaseConfigured, DEFAULT_COMPANY, isDemoModeAllowed } from './supabase';

// LocalStorage Keys
export const STORAGE_BOOKINGS_KEY = 'neo_portal_bookings';
const STORAGE_QUOTES_KEY = 'neo_portal_quotes';
const STORAGE_INVOICES_KEY = 'neo_portal_invoices';
const STORAGE_DOCUMENTS_KEY = 'neo_portal_documents';
const STORAGE_TICKETS_KEY = 'neo_portal_tickets';
const STORAGE_TICKET_MESSAGES_KEY_PREFIX = 'neo_ticket_messages_';
const STORAGE_ACTIVE_TRACKING_KEY = 'neo_portal_active_tracking_id';
const STORAGE_WIZARD_DRAFT_KEY = 'neo_portal_wizard_draft';
const STORAGE_APPLICATIONS_KEY = 'neo_standby_applications';
const STORAGE_PROFILES_KEY = 'neo_portal_profiles';
const STORAGE_COMPANIES_KEY = 'neo_portal_companies';
const STORAGE_AUDIT_LOGS_KEY = 'neo_portal_audit_logs';
export const STORAGE_FAILED_BOOKING_DRAFT_KEY = 'neo_portal_failed_booking_draft';

export interface FailedBookingDraft {
  booking: Booking;
  wizardState?: BookingWizardState | null;
  companyId?: string | null;
  error: string;
  code?: string | null;
  failedAt: string;
}

export function getStoredFailedBookingDraft(): FailedBookingDraft | null {
  return readStorage<FailedBookingDraft | null>(STORAGE_FAILED_BOOKING_DRAFT_KEY, null);
}

export function clearFailedBookingDraft(): void {
  try {
    localStorage.removeItem(STORAGE_FAILED_BOOKING_DRAFT_KEY);
  } catch {}
}

// Dynamic test injection hooks
let customClient: any = null;
export function setCustomSupabaseClient(client: any) {
  customClient = client;
}

export function getActiveSupabase() {
  return customClient !== null ? customClient : supabase;
}

export function checkIsSupabaseConfigured(): boolean {
  return customClient !== null ? true : isSupabaseConfigured;
}

let demoModeOverride: boolean | null = null;
export function setDemoModeOverrideForTesting(override: boolean | null) {
  demoModeOverride = override;
}

export function getIsDemoModeAllowed(): boolean {
  return demoModeOverride !== null ? demoModeOverride : isDemoModeAllowed;
}

export function notifyPortalSync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('neo_portal_sync'));
  }
}

export interface SessionDiagnosticInfo {
  isConfigured: boolean;
  hasSession: boolean;
  isExpired: boolean;
  expiresInSeconds?: number;
  userId?: string;
  userEmail?: string;
  diagnosticMessage: string;
}

/**
 * Returns safe diagnostic information about the browser Supabase session.
 * Strictly never logs or leaks access tokens, refresh tokens, or secret keys.
 */
export async function getAdminSessionDiagnostics(): Promise<SessionDiagnosticInfo> {
  const isConfigured = checkIsSupabaseConfigured();
  const client = getActiveSupabase();
  if (!isConfigured || !client) {
    return {
      isConfigured: false,
      hasSession: false,
      isExpired: false,
      diagnosticMessage: 'Supabase client is not configured on the browser.',
    };
  }

  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error) {
      return {
        isConfigured: true,
        hasSession: false,
        isExpired: false,
        diagnosticMessage: `Supabase getSession failed: ${error.message}`,
      };
    }
    if (!session || !session.access_token) {
      return {
        isConfigured: true,
        hasSession: false,
        isExpired: false,
        diagnosticMessage: 'No active Supabase authentication session found in browser storage.',
      };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAt = session.expires_at || 0;
    const isExpired = expiresAt > 0 && expiresAt <= nowSec;
    const expiresInSeconds = expiresAt > 0 ? expiresAt - nowSec : undefined;

    return {
      isConfigured: true,
      hasSession: true,
      isExpired,
      expiresInSeconds,
      userId: session.user?.id,
      userEmail: session.user?.email,
      diagnosticMessage: isExpired
        ? `Session expired ${Math.abs(expiresInSeconds || 0)}s ago. Re-authentication required.`
        : `Active session for ${session.user?.email || 'user'} (expires in ${expiresInSeconds}s).`,
    };
  } catch (err: any) {
    return {
      isConfigured: true,
      hasSession: false,
      isExpired: false,
      diagnosticMessage: `Error checking session: ${err?.message || 'unknown error'}`,
    };
  }
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const client = getActiveSupabase();
  if (checkIsSupabaseConfigured() && client) {
    try {
      const { data: { session }, error } = await client.auth.getSession();
      if (error) {
        console.warn('[NEO Store Auth Diagnostic] getSession returned error:', error.message);
      } else if (!session?.access_token) {
        console.warn('[NEO Store Auth Diagnostic] No active session token found for authenticated request.');
      } else {
        const nowSec = Math.floor(Date.now() / 1000);
        if (session.expires_at && session.expires_at <= nowSec) {
          console.warn('[NEO Store Auth Diagnostic] Session access token is expired (expired at ' + new Date(session.expires_at * 1000).toISOString() + ').');
        }
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch (e) {
      console.warn('[NEO Store] Failed to obtain session token:', e);
    }
  }
  return headers;
}


export const INITIAL_STANDBY_APPLICATIONS: StandbyApplication[] = [
  {
    id: 'app-01',
    created_at: '2026-08-14T09:30:00Z',
    company_name: 'Apex Precision Logistics Ltd',
    trading_name: 'Apex UK Line Recovery',
    dispatch_address: 'Bay 3, Logistics Way, Trafford Park',
    town_city: 'Manchester',
    postcode: 'M17 1TN',
    contact_name: 'Hannah Vance',
    job_title: 'Operations Director',
    driver_mobile: '07700 900341',
    ops_email: 'hannah.vance@apexlogistics.co.uk',
    accounts_email: 'accounts@apexlogistics.co.uk',
    emergency_line: '0161 884 9210',
    selected_carriers: ['DPD', 'DHL', 'Palletways'],
    volume: '15-30 loads/month',
    status: 'pending',
  },
  {
    id: 'app-02',
    created_at: '2026-08-14T11:15:00Z',
    company_name: 'Nordic Precision Gears Ltd',
    trading_name: 'NPG Dynamics',
    dispatch_address: 'Unit 9, Heartlands Industrial Park',
    town_city: 'Birmingham',
    postcode: 'B6 7XX',
    contact_name: 'David Lindqvist',
    job_title: 'Plant Logistics Manager',
    driver_mobile: '07700 900612',
    ops_email: 'david.l@npg-gears.co.uk',
    accounts_email: 'finance@npg-gears.co.uk',
    emergency_line: '0121 555 4920',
    selected_carriers: ['Palletways', 'Tuffnells'],
    volume: '5-15 loads/month',
    status: 'pending',
  },
  {
    id: 'app-03',
    created_at: '2026-08-13T14:00:00Z',
    company_name: 'Meridian Logistics Ltd',
    trading_name: 'Meridian Express Freight',
    dispatch_address: 'Unit 4, Trafford Park Industrial Estate',
    town_city: 'Manchester',
    postcode: 'M17 1AB',
    contact_name: 'Chris Sullivan',
    job_title: 'Head of Logistics & Supply Chain',
    driver_mobile: '07700 900821',
    ops_email: 'chris@meridian.co.uk',
    accounts_email: 'accounts@meridian.co.uk',
    emergency_line: '0161 555 0134',
    selected_carriers: ['DPD', 'DHL', 'Palletways'],
    volume: '5-15 loads/month',
    status: 'approved',
    account_code: 'NEO-SB-2026',
  },
];

export const INITIAL_SUPPORT_TICKETS: SupportTicket[] = [
  {
    id: 'SR-8921',
    topic: 'Tail-lift access confirmation for Birmingham depot',
    message: 'Can duty dispatch ensure Luton Tail-lift vehicle is assigned for tomorrow 08:00 collection?',
    status: 'Resolved',
    date: '01 Aug 2026',
  },
  {
    id: 'SR-8944',
    topic: 'Pallet co-loading query',
    message: 'Requesting clarification on hazardous material separation protocols.',
    status: 'Open',
    date: '02 Aug 2026',
  },
];

export const INITIAL_WIZARD_DRAFT: BookingWizardState = {
  pickupPostcode: 'Manchester M17 1AB',
  pickupContact: 'Warehouse desk',
  pickupPhone: '0161 555 0134',
  contactName: 'Warehouse desk',
  contactPhone: '0161 555 0134',
  collectionWindow: 'ASAP — ready now',
  dropoffPostcode: 'Birmingham B6 7EU',
  dropoffContact: 'Goods Inwards / Receiving',
  dropoffPhone: '0121 496 0281',
  recipientName: 'Goods Inwards / Receiving',
  recipientPhone: '0121 496 0281',
  deliveryWindow: 'Direct transit (approx 88 min)',
  deliveryInstructions: 'Access via Bay 4. Contact goods inwards before docking.',
  cargoDescription: 'Palletised parts · 650 kg',
  cargoWeightKg: 650,
  palletCount: 2,
  itemsCount: 2,
  cargoHazmat: false,
  selectedVehicle: 'Sprinter LWB',
  selectedService: 'Emergency (ASAP)',
  estimatedMiles: 88,
  estimatedTotal: 355,
  paymentMethod: 'standby-account',
  poReference: 'PO-2026-8910',
  poNumber: 'PO-2026-8910',
  notes: 'Access via Gate 4 dock. Driver needs safety boots & hi-vis.',
};

const DEMO_BOOKING_IDS = new Set(
  INITIAL_BOOKINGS.flatMap((b) => [b.id, b.reference]).filter(Boolean)
);
const DEMO_QUOTE_IDS = new Set(
  INITIAL_QUOTES.flatMap((q) => [q.id, q.reference]).filter(Boolean)
);
const DEMO_INVOICE_IDS = new Set(
  INITIAL_INVOICES.flatMap((i) => [i.id, i.reference]).filter(Boolean)
);
const DEMO_DOCUMENT_IDS = new Set(
  INITIAL_DOCUMENTS.map((d) => d.id).filter(Boolean)
);
const DEMO_APPLICATION_IDS = new Set(
  INITIAL_STANDBY_APPLICATIONS.map((a) => a.id).filter(Boolean)
);
const DEMO_TICKET_IDS = new Set(
  INITIAL_SUPPORT_TICKETS.map((t) => t.id).filter(Boolean)
);
const DEMO_PROFILE_IDS = new Set(['user-chris-sullivan', 'user-02', 'user-03']);
const DEMO_COMPANY_IDS = new Set(['comp-meridian-001', 'comp-apex-002', 'comp-nordic-003']);
const DEMO_AUDIT_LOG_IDS = new Set(['audit-01', 'audit-02', 'audit-03', 'audit-04']);

function sanitizeStored<T>(key: string, data: T): T {
  if (getIsDemoModeAllowed() || !Array.isArray(data)) return data;

  let filtered: any[] = data as any[];
  if (key === STORAGE_BOOKINGS_KEY) {
    filtered = (data as any[]).filter(
      (b) => !DEMO_BOOKING_IDS.has(b?.id) && !DEMO_BOOKING_IDS.has(b?.reference)
    );
  } else if (key === STORAGE_QUOTES_KEY) {
    filtered = (data as any[]).filter(
      (q) => !DEMO_QUOTE_IDS.has(q?.id) && !DEMO_QUOTE_IDS.has(q?.reference)
    );
  } else if (key === STORAGE_INVOICES_KEY) {
    filtered = (data as any[]).filter(
      (i) => !DEMO_INVOICE_IDS.has(i?.id) && !DEMO_INVOICE_IDS.has(i?.reference)
    );
  } else if (key === STORAGE_DOCUMENTS_KEY) {
    filtered = (data as any[]).filter((d) => !DEMO_DOCUMENT_IDS.has(d?.id));
  } else if (key === STORAGE_APPLICATIONS_KEY) {
    filtered = (data as any[]).filter((a) => !DEMO_APPLICATION_IDS.has(a?.id));
  } else if (key === STORAGE_TICKETS_KEY) {
    filtered = (data as any[]).filter((t) => !DEMO_TICKET_IDS.has(t?.id));
  } else if (key === STORAGE_PROFILES_KEY) {
    filtered = (data as any[]).filter((p) => !DEMO_PROFILE_IDS.has(p?.id));
  } else if (key === STORAGE_COMPANIES_KEY) {
    filtered = (data as any[]).filter((c) => !DEMO_COMPANY_IDS.has(c?.id));
  } else if (key === STORAGE_AUDIT_LOGS_KEY) {
    filtered = (data as any[]).filter((l) => !DEMO_AUDIT_LOG_IDS.has(l?.id));
  }

  if (filtered.length !== (data as any[]).length) {
    try {
      localStorage.setItem(key, JSON.stringify(filtered));
    } catch {}
  }
  return filtered as unknown as T;
}

function readStorage<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultVal;
    const parsed = JSON.parse(raw);
    return sanitizeStored<T>(key, parsed);
  } catch {
    return defaultVal;
  }
}

function writeStorage<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.warn('Storage write failed for key:', key, e);
  }
}

let localFallbackCounter = 0;

// 1. Generate Next Sequential Booking Reference (e.g. NT-25100)
// Evaluates passed bookings and local storage; base is raised comfortably above all existing production records (max existing was NT-25011)
export function getNextBookingReference(existingBookings?: Booking[]): string {
  let highestNum = 25100;
  const candidateList = [
    ...(existingBookings || []),
    ...readStorage<Booking[]>(STORAGE_BOOKINGS_KEY, []),
  ];
  for (const b of candidateList) {
    if (!b?.reference) continue;
    const match = b.reference.match(/^NT-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > highestNum) {
        highestNum = num;
      }
    }
  }
  localFallbackCounter++;
  return `NT-${highestNum + localFallbackCounter}`;
}

/**
 * Server-authoritative async booking reference generator.
 * 1. First attempts to call Supabase RPC public.generate_booking_reference().
 * 2. If RPC is unavailable or offline, falls back to collision-resistant local generation.
 */
export async function getNextBookingReferenceAsync(existingBookings?: Booking[]): Promise<string> {
  const client = getActiveSupabase();
  if (client && checkIsSupabaseConfigured()) {
    try {
      const { data, error } = await client.rpc('generate_booking_reference');
      if (!error && data && typeof data === 'string' && data.startsWith('NT-')) {
        return data;
      }
    } catch (e) {
      console.warn('[NEO Store] RPC generate_booking_reference unavailable, using fallback generator:', e);
    }
  }
  return getNextBookingReference(existingBookings);
}

// 2. Bookings Persistence
export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  category: 'booking' | 'standby' | 'invoice' | 'system';
  bookingId?: string;
  createdAtIso: string;
}

export const STORAGE_READ_NOTIFICATIONS_KEY = 'neo_portal_read_notifications_v1';

export function getStoredReadNotificationIds(): string[] {
  return readStorage<string[]>(STORAGE_READ_NOTIFICATIONS_KEY, []);
}

export function markNotificationAsRead(id: string): void {
  const current = getStoredReadNotificationIds();
  if (!current.includes(id)) {
    writeStorage(STORAGE_READ_NOTIFICATIONS_KEY, [...current, id]);
    notifyPortalSync();
  }
}

export function markAllNotificationsAsRead(ids: string[]): void {
  const current = new Set(getStoredReadNotificationIds());
  for (const id of ids) {
    current.add(id);
  }
  writeStorage(STORAGE_READ_NOTIFICATIONS_KEY, Array.from(current));
  notifyPortalSync();
}

/**
 * Loads real in-app notifications for the authenticated user and company.
 * Contextually evaluates actual bookings, invoices, and server outbox records.
 */
export async function fetchCustomerNotifications(
  companyId?: string,
  email?: string,
  providedBookings?: Booking[]
): Promise<InAppNotification[]> {
  const readIds = new Set(getStoredReadNotificationIds());
  const notifMap = new Map<string, InAppNotification>();

  // 1. Contextual Notifications from active and recent bookings
  const bookings = providedBookings || getStoredBookings();
  for (const b of bookings) {
    const ref = b.reference || b.id;
    if (!ref) continue;

    if (b.status === 'IN TRANSIT') {
      const id = `notif_in_transit_${ref}`;
      notifMap.set(id, {
        id,
        title: `Booking ${ref} In transit`,
        message: `${b.driver?.name || 'Assigned driver'} is in transit to ${b.destination} · ETA ${b.deliveryTime || '88 min'}`,
        timestamp: 'Active now',
        read: readIds.has(id),
        category: 'booking',
        bookingId: ref,
        createdAtIso: new Date().toISOString(),
      });
    } else if (b.status === 'DELIVERED') {
      const id = `notif_delivered_${ref}`;
      notifMap.set(id, {
        id,
        title: `Booking ${ref} Delivered`,
        message: `Consignment delivered to ${b.destination}. Proof of Delivery verified.`,
        timestamp: 'Completed',
        read: readIds.has(id),
        category: 'booking',
        bookingId: ref,
        createdAtIso: new Date().toISOString(),
      });
    } else if (b.status === 'SCHEDULED') {
      const id = `notif_scheduled_${ref}`;
      notifMap.set(id, {
        id,
        title: `Booking ${ref} Confirmed & Scheduled`,
        message: `Vehicle (${b.vehicle}) scheduled for collection at ${b.origin}.`,
        timestamp: b.date || 'Today',
        read: readIds.has(id),
        category: 'booking',
        bookingId: ref,
        createdAtIso: new Date().toISOString(),
      });
    }

    if (b.payment_status === 'paid') {
      const id = `notif_paid_${ref}`;
      notifMap.set(id, {
        id,
        title: `Payment Confirmed: ${ref}`,
        message: `Stripe card payment verified (£${(b.amount_paid_gbp || b.total).toFixed(2)}).`,
        timestamp: 'Verified',
        read: readIds.has(id),
        category: 'invoice',
        bookingId: ref,
        createdAtIso: new Date().toISOString(),
      });
    }
  }

  // 2. Query server outbox records via /api/notifications/in-app (if available)
  if (typeof fetch !== 'undefined') {
    try {
      const params = new URLSearchParams();
      if (companyId) params.set('company_id', companyId);
      if (email) params.set('email', email);

      const res = await fetch(`/api/notifications/in-app?${params.toString()}`).catch(() => null);
      if (res && res.ok) {
        const body = await res.json().catch(() => null);
        const serverNotifs = body?.notifications;
        if (Array.isArray(serverNotifs)) {
          for (const item of serverNotifs) {
            const id = `notif_outbox_${item.id}`;
            const eventType = item.event_type;
            let title = item.subject || 'Notification';
            let message = 'Operational update.';
            let category: 'booking' | 'standby' | 'invoice' | 'system' = 'system';

            if (eventType === 'standby_application_submitted') {
              title = 'Standby Application Submitted';
              message = 'Your standby facility application has been registered for rapid review.';
              category = 'standby';
            } else if (eventType === 'standby_account_active') {
              title = 'Standby Account Active';
              message = 'Your standby account and emergency freight credit line are active.';
              category = 'standby';
            } else if (eventType === 'booking_confirmed') {
              title = `Booking Confirmed: ${item.booking_id || ''}`;
              message = `Booking reference ${item.booking_id || ''} confirmed in the standby dispatch corridor.`;
              category = 'booking';
            } else if (eventType === 'payment_verified') {
              title = 'Payment Received';
              message = `Payment verified for booking ${item.booking_id || ''}.`;
              category = 'invoice';
            }

            const createdTime = item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent';

            notifMap.set(id, {
              id,
              title,
              message,
              timestamp: createdTime,
              read: readIds.has(id),
              category,
              bookingId: item.booking_id || undefined,
              createdAtIso: item.created_at || new Date().toISOString(),
            });
          }
        }
      }
    } catch {
      // Non-fatal network fallback
    }
  }

  // Sort: unread first, then by createdAtIso descending
  return Array.from(notifMap.values()).sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    return b.createdAtIso.localeCompare(a.createdAtIso);
  });
}

export function getStoredBookings(companyId?: string): Booking[] {
  const stored = readStorage<Booking[]>(STORAGE_BOOKINGS_KEY, getIsDemoModeAllowed() ? INITIAL_BOOKINGS : []);
  if (!companyId) {
    if (getIsDemoModeAllowed() && stored && stored.length > 0 && !stored.some((b) => b.reference === 'NT-25121')) {
      const merged = [...INITIAL_BOOKINGS.slice(0, 3), ...stored];
      writeStorage(STORAGE_BOOKINGS_KEY, merged);
      return merged;
    }
    return stored;
  }
  if (companyId === DEFAULT_COMPANY.id) {
    return stored.filter((b) => !b.company_id || b.company_id === DEFAULT_COMPANY.id);
  }
  return stored.filter((b) => b.company_id === companyId);
}

export function mapBookingRowToBooking(row: any, existing?: Booking): Booking {
  if (!row) {
    return existing || ({} as Booking);
  }

  const rawStatus = row.status ?? (existing ? (existing.status === 'IN TRANSIT' ? 'In transit' : existing.status === 'DELIVERED' ? 'Delivered' : existing.status === 'CANCELLED' ? 'Cancelled' : 'Scheduled') : undefined);
  const normalizedStatus: 'IN TRANSIT' | 'DELIVERED' | 'CANCELLED' | 'SCHEDULED' = rawStatus
    ? (String(rawStatus).toUpperCase() === 'IN TRANSIT'
        ? 'IN TRANSIT'
        : String(rawStatus).toUpperCase() === 'DELIVERED'
        ? 'DELIVERED'
        : String(rawStatus).toUpperCase() === 'CANCELLED'
        ? 'CANCELLED'
        : 'SCHEDULED')
    : (existing?.status || 'SCHEDULED');

  const rawProgress = typeof row.progress_t === 'number'
    ? row.progress_t
    : (typeof row.progress === 'number'
        ? row.progress
        : (normalizedStatus === 'IN TRANSIT'
            ? (typeof existing?.progress === 'number' ? existing.progress : 0.45)
            : normalizedStatus === 'DELIVERED'
            ? 1.0
            : (typeof existing?.progress === 'number' ? existing.progress : 0.05)));

  const hasDriverName = row.driver_name !== undefined ? Boolean(row.driver_name) : Boolean(existing?.driver?.name);
  const driverName = row.driver_name !== undefined ? row.driver_name : existing?.driver?.name;
  const driverVehicle = row.driver_vehicle !== undefined ? row.driver_vehicle : (existing?.driver?.vehicleModel || row.vehicle || existing?.vehicle);
  const driverReg = row.driver_reg !== undefined ? row.driver_reg : existing?.driver?.registration;

  const driver = hasDriverName
    ? {
        name: driverName || '',
        vehicleModel: driverVehicle || '',
        registration: driverReg || '',
        phone: existing?.driver?.phone || '07700 900821',
        status: 'ON THE MOVE',
      }
    : (row.driver_name === null ? undefined : existing?.driver);

  return {
    id: row.id || existing?.id || '',
    company_id: row.company_id || existing?.company_id,
    reference: row.id || existing?.reference || '',
    date: row.date_label || existing?.date || 'Today',
    origin: row.pickup !== undefined ? row.pickup : (existing?.origin || ''),
    destination: row.dropoff !== undefined ? row.dropoff : (existing?.destination || ''),
    vehicle: row.vehicle !== undefined ? row.vehicle : (existing?.vehicle || ''),
    total: typeof row.total_gbp === 'number'
      ? row.total_gbp
      : (Number(row.total_gbp) || existing?.total || 248),
    status: normalizedStatus,
    cargo: row.goods !== undefined ? row.goods : (existing?.cargo || ''),
    weightKg: typeof row.weight_kg === 'number'
      ? row.weight_kg
      : (Number(row.weight_kg) || existing?.weightKg || 0),
    palletCount: typeof row.items_count === 'number'
      ? row.items_count
      : (Number(row.items_count) || existing?.palletCount || 1),
    pickupTime: row.collection_window !== undefined ? row.collection_window : existing?.pickupTime,
    deliveryTime: row.eta_label !== undefined ? row.eta_label : existing?.deliveryTime,
    progress: rawProgress,
    driver,
    pickup_tracking_url: row.pickup_tracking_url !== undefined
      ? (row.pickup_tracking_url || undefined)
      : existing?.pickup_tracking_url,
    delivery_tracking_url: row.delivery_tracking_url !== undefined
      ? (row.delivery_tracking_url || undefined)
      : existing?.delivery_tracking_url,
    payment_method: row.payment_method !== undefined ? row.payment_method : existing?.payment_method,
    payment_status: row.payment_status !== undefined ? row.payment_status : existing?.payment_status,
    amount_paid_gbp: typeof row.amount_paid_gbp === "number" ? row.amount_paid_gbp : existing?.amount_paid_gbp,
    stripe_payment_intent_id: row.stripe_payment_intent_id !== undefined ? row.stripe_payment_intent_id : existing?.stripe_payment_intent_id,
  };
}

export function syncRealtimeBookingUpdate(updated: Booking): Booking[] {
  const current = getStoredBookings();
  const exists = current.some((b) => b.id === updated.id || b.reference === updated.reference);
  const nextList = exists
    ? current.map((b) => (b.id === updated.id || b.reference === updated.reference ? { ...b, ...updated } : b))
    : [updated, ...current];
  writeStorage(STORAGE_BOOKINGS_KEY, nextList);
  return nextList;
}

export async function getPersistedBookings(companyId?: string): Promise<Booking[]> {
  const local = readStorage<Booking[]>(STORAGE_BOOKINGS_KEY, getIsDemoModeAllowed() ? INITIAL_BOOKINGS : []);
  const client = getActiveSupabase();

  if (checkIsSupabaseConfigured() && client) {
    try {
      let query = client
        .from('bookings')
        .select('*');

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.warn('[NEO Store] Supabase bookings fetch error:', error);
        if (!getIsDemoModeAllowed()) {
          throw new Error(`Failed to load bookings from database: ${error.message}`);
        }
        return companyId
          ? (companyId === DEFAULT_COMPANY.id
              ? local.filter((b) => !b.company_id || b.company_id === DEFAULT_COMPANY.id)
              : local.filter((b) => b.company_id === companyId))
          : local;
      }

      if (data) {
        const mapped: Booking[] = data.map((row: any) => mapBookingRowToBooking(row));
        if (!companyId) {
          writeStorage(STORAGE_BOOKINGS_KEY, mapped);
        }
        return mapped;
      }
    } catch (e) {
      console.warn('[NEO Store] Supabase bookings fetch failed:', e);
      if (!getIsDemoModeAllowed()) {
        throw e;
      }
      return companyId
        ? (companyId === DEFAULT_COMPANY.id
            ? local.filter((b) => !b.company_id || b.company_id === DEFAULT_COMPANY.id)
            : local.filter((b) => b.company_id === companyId))
        : local;
    }
  }

  if (companyId) {
    return companyId === DEFAULT_COMPANY.id
      ? (getIsDemoModeAllowed() ? local.filter((b) => !b.company_id || b.company_id === DEFAULT_COMPANY.id) : [])
      : local.filter((b) => b.company_id === companyId);
  }

  return getIsDemoModeAllowed() ? local : [];
}

export async function persistBooking(
  newBooking: Booking,
  wizardState?: BookingWizardState,
  companyId?: string
): Promise<Booking> {
  const isDemoAllowed = getIsDemoModeAllowed();
  const isConfigured = checkIsSupabaseConfigured();
  const client = getActiveSupabase();

  if (isConfigured && client) {
    const bookingPayload = {
      id: newBooking.reference,
      company_id: companyId || DEFAULT_COMPANY.id,
      date_label: newBooking.date,
      pickup: newBooking.origin,
      pickup_contact: wizardState?.contactName || wizardState?.pickupContact || 'Warehouse desk',
      pickup_phone: wizardState?.pickupPhone || wizardState?.contactPhone || '0161 555 0134',
      collection_window: wizardState?.collectionWindow || 'ASAP — ready now',
      dropoff: newBooking.destination,
      recipient_name: wizardState?.recipientName || wizardState?.dropoffContact || 'Goods Inwards',
      recipient_phone: wizardState?.recipientPhone || wizardState?.dropoffPhone || '0121 496 0281',
      delivery_instructions: wizardState?.deliveryInstructions || '',
      goods: newBooking.cargo || 'Palletised goods',
      weight_kg: newBooking.weightKg || wizardState?.cargoWeightKg || 650,
      items_count: newBooking.palletCount || wizardState?.itemsCount || 2,
      vehicle: newBooking.vehicle,
      service: wizardState?.selectedService || 'Emergency (ASAP)',
      distance_miles: wizardState?.estimatedMiles || 88,
      total_gbp: newBooking.total,
      payment_method: newBooking.payment_method || wizardState?.paymentMethod || 'standby-account',
      payment_status:
        newBooking.payment_status ||
        ((newBooking.payment_method || wizardState?.paymentMethod) === 'card'
          ? 'requires_payment'
          : 'standby_terms'),
      amount_paid_gbp: typeof newBooking.amount_paid_gbp === 'number' ? newBooking.amount_paid_gbp : 0.0,
      stripe_payment_intent_id: newBooking.stripe_payment_intent_id || null,
      po_reference: wizardState?.poReference || '',
      eta_label: newBooking.deliveryTime || '88 min',
      status:
        newBooking.status === 'SCHEDULED'
          ? 'Scheduled'
          : newBooking.status === 'IN TRANSIT'
          ? 'In transit'
          : newBooking.status === 'DELIVERED'
          ? 'Delivered'
          : newBooking.status === 'CANCELLED'
          ? 'Cancelled'
          : 'Scheduled',
      driver_name: newBooking.driver?.name || null,
      driver_vehicle: newBooking.driver?.vehicleModel || null,
      driver_reg: newBooking.driver?.registration || null,
      progress_t: typeof newBooking.progress === 'number' ? newBooking.progress : 0.0,
      pickup_tracking_url: newBooking.pickup_tracking_url || null,
      delivery_tracking_url: newBooking.delivery_tracking_url || null,
    };

    let insertResult: any = null;
    try {
      insertResult = await client.from('bookings').insert(bookingPayload);
    } catch (e: any) {
      console.error('[NEO Store] Failed to persist booking to Supabase (transport error):', e);
      if (wizardState) {
        persistWizardDraft(wizardState);
      }
      writeStorage<FailedBookingDraft>(STORAGE_FAILED_BOOKING_DRAFT_KEY, {
        booking: newBooking,
        wizardState: wizardState || null,
        companyId: companyId || null,
        error: e?.message || String(e),
        code: e?.code || 'TRANSPORT_ERROR',
        failedAt: new Date().toISOString(),
      });
      throw e;
    }

    // Check for primary key / unique constraint collision (SQLSTATE 23505)
    const isUniqueViolation =
      insertResult?.error &&
      (insertResult.error.code === '23505' ||
        /duplicate key|unique constraint|bookings_pkey/i.test(insertResult.error.message || ''));

    if (isUniqueViolation) {
      console.warn('[NEO Store] Detected booking primary key collision for:', newBooking.reference, '- evaluating idempotency / collision recovery');

      // 1. Check if an identical booking already exists (Idempotent Retry)
      let existingRow: any = null;
      try {
        const { data, error: selectErr } = await client
          .from('bookings')
          .select('*')
          .eq('id', newBooking.reference)
          .maybeSingle();
        if (!selectErr && data) {
          existingRow = data;
        }
      } catch (checkErr) {
        console.warn('[NEO Store] Failed checking existing booking for idempotency:', checkErr);
      }

      const targetCompany = companyId || DEFAULT_COMPANY.id;
      const isIdenticalBooking =
        existingRow &&
        (existingRow.company_id === targetCompany || !existingRow.company_id) &&
        existingRow.pickup === newBooking.origin &&
        existingRow.dropoff === newBooking.destination &&
        Math.abs(Number(existingRow.total_gbp || 0) - Number(newBooking.total || 0)) < 0.01;

      if (isIdenticalBooking) {
        console.log('[NEO Store] Idempotent retry verified for existing booking:', newBooking.reference);
        const mapped = mapBookingRowToBooking(existingRow, newBooking);
        const current = readStorage<Booking[]>(STORAGE_BOOKINGS_KEY, isDemoAllowed ? INITIAL_BOOKINGS : []);
        const updated = [mapped, ...current.filter((b) => b.id !== mapped.id && b.reference !== mapped.reference)];
        writeStorage(STORAGE_BOOKINGS_KEY, updated);
        clearFailedBookingDraft();
        return mapped;
      }

      // 2. Not an identical booking: Genuine Collision with existing booking (e.g. NT-24818 taken by another company/seed)
      console.warn('[NEO Store] Genuine collision detected for reference:', newBooking.reference, '- regenerating unique reference and retrying');

      let candidateRef: string | null = null;
      try {
        const { data: rpcRef, error: rpcErr } = await client.rpc('generate_booking_reference');
        if (!rpcErr && rpcRef && typeof rpcRef === 'string' && rpcRef.startsWith('NT-')) {
          candidateRef = rpcRef;
        }
      } catch (rpcErr) {
        console.warn('[NEO Store] RPC generate_booking_reference unavailable, using fallback generator:', rpcErr);
      }

      if (!candidateRef) {
        candidateRef = getNextBookingReference();
      }

      // Update newBooking references with candidateRef
      newBooking.id = candidateRef;
      newBooking.reference = candidateRef;
      bookingPayload.id = candidateRef;

      // Re-attempt insert with candidateRef
      try {
        insertResult = await client.from('bookings').insert(bookingPayload);
      } catch (retryErr: any) {
        console.error('[NEO Store] Retry insert transport failure:', retryErr);
        if (wizardState) {
          persistWizardDraft(wizardState);
        }
        writeStorage<FailedBookingDraft>(STORAGE_FAILED_BOOKING_DRAFT_KEY, {
          booking: newBooking,
          wizardState: wizardState || null,
          companyId: companyId || null,
          error: retryErr?.message || String(retryErr),
          code: retryErr?.code || 'TRANSPORT_ERROR',
          failedAt: new Date().toISOString(),
        });
        throw retryErr;
      }
    }

    if (insertResult?.error) {
      const error = insertResult.error;
      console.error('[NEO Store] Supabase booking insert rejected:', error);
      if (wizardState) {
        persistWizardDraft(wizardState);
      }
      writeStorage<FailedBookingDraft>(STORAGE_FAILED_BOOKING_DRAFT_KEY, {
        booking: newBooking,
        wizardState: wizardState || null,
        companyId: companyId || null,
        error: error.message || 'Remote database insert rejected',
        code: (error as any).code || null,
        failedAt: new Date().toISOString(),
      });
      throw new Error(`Central booking persistence failed: ${error.message || 'Database error'} (code: ${(error as any).code || 'UNKNOWN'})`);
    }
  } else if (!isDemoAllowed) {
    const err = new Error('Database service unavailable: Supabase client is not configured.');
    if (wizardState) {
      persistWizardDraft(wizardState);
    }
    writeStorage<FailedBookingDraft>(STORAGE_FAILED_BOOKING_DRAFT_KEY, {
      booking: newBooking,
      wizardState: wizardState || null,
      companyId: companyId || null,
      error: err.message,
      code: 'UNCONFIGURED_CLIENT',
      failedAt: new Date().toISOString(),
    });
    throw err;
  }

  // Remote persistence verified (or demo simulation explicitly permitted): commit to confirmed bookings storage
  const current = readStorage<Booking[]>(STORAGE_BOOKINGS_KEY, isDemoAllowed ? INITIAL_BOOKINGS : []);
  const updated = [newBooking, ...current.filter((b) => b.id !== newBooking.id && b.reference !== newBooking.reference)];
  writeStorage(STORAGE_BOOKINGS_KEY, updated);
  clearFailedBookingDraft();

  // Enqueue booking confirmed notification (operations alert & customer confirmation)
  if (typeof fetch !== 'undefined') {
    try {
      const ref = newBooking.reference || newBooking.id;
      // 1. Ops Alert
      fetch('/api/notifications/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'booking_confirmed',
          idempotency_key: `booking_conf_ops_${ref}`,
          recipient_email: CONTACT_CONFIG.email.ops,
          recipient_role: 'operations',
          company_id: companyId,
          booking_id: ref,
          payload: {
            bookingId: ref,
            companyName: companyId || 'Commercial Client',
            pickup: newBooking.origin,
            dropoff: newBooking.destination,
            vehicle: newBooking.vehicle,
            totalGbp: newBooking.total,
            paymentMethod: newBooking.payment_method,
          },
        }),
      }).catch(() => {});

      // 2. Customer Confirmation
      fetch('/api/notifications/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'booking_confirmed',
          idempotency_key: `booking_conf_cust_${ref}`,
          recipient_email: wizardState?.contactName || wizardState?.pickupPhone || 'customer',
          recipient_role: 'customer',
          company_id: companyId,
          booking_id: ref,
          payload: {
            bookingId: ref,
            pickup: newBooking.origin,
            dropoff: newBooking.destination,
            vehicle: newBooking.vehicle,
            totalGbp: newBooking.total,
            deliveryWindow: newBooking.deliveryTime || '88 min',
          },
        }),
      }).catch(() => {});
    } catch {
      // Non-blocking notification dispatch
    }
  }

  notifyPortalSync();
  return newBooking;
}

export async function updateBooking(updatedBooking: Booking): Promise<Booking[]> {
  const current = readStorage<Booking[]>(STORAGE_BOOKINGS_KEY, getIsDemoModeAllowed() ? INITIAL_BOOKINGS : []);

  // Symmetrical identifier matching across id and reference
  const targetId = updatedBooking.id || updatedBooking.reference;
  const targetRef = updatedBooking.reference || updatedBooking.id;
  const matchesBooking = (b: Booking) =>
    Boolean((targetId && (b.id === targetId || b.reference === targetId)) ||
    (targetRef && (b.reference === targetRef || b.id === targetRef)));

  let existing = current.find(matchesBooking);

  // If missing from local cache, check Supabase to prevent stale/missing cache from blocking legitimate updates
  const client = getActiveSupabase();
  if (!existing && checkIsSupabaseConfigured() && client) {
    try {
      const dbLookupId = targetRef || targetId;
      if (dbLookupId && typeof client.from === 'function') {
        const query = client.from('bookings').select('*').eq('id', dbLookupId);
        const res = typeof query?.maybeSingle === 'function'
          ? await query.maybeSingle()
          : (typeof query?.single === 'function' ? await query.single() : await query);
        if (res?.data) {
          existing = mapBookingRowToBooking(res.data);
        }
      }
    } catch {
      // Non-fatal: fallback to local cache state
    }
  }

  // Client-side status integrity protection:
  // Client-side store cannot prematurely advance a Scheduled booking to 'In transit' or 'Delivered'
  // without verified server-side dispatch/webhook processing.
  // Note: These client-side checks provide UI-level defense-in-depth and prevent invalid store mutation;
  // authoritative state transitions and authorization remain strictly enforced on the server.
  const isBlockedTransitTransition =
    updatedBooking.status === 'IN TRANSIT' && (!existing || existing.status !== 'IN TRANSIT');
  const isBlockedDeliveredTransition =
    updatedBooking.status === 'DELIVERED' && (!existing || existing.status !== 'DELIVERED');

  let safeBooking: Booking = {
    ...existing,
    ...updatedBooking,
    driver: updatedBooking.driver !== undefined ? updatedBooking.driver : existing?.driver,
    progress: updatedBooking.progress !== undefined ? updatedBooking.progress : existing?.progress,
    pickup_tracking_url:
      updatedBooking.pickup_tracking_url !== undefined
        ? updatedBooking.pickup_tracking_url
        : existing?.pickup_tracking_url,
    delivery_tracking_url:
      updatedBooking.delivery_tracking_url !== undefined
        ? updatedBooking.delivery_tracking_url
        : existing?.delivery_tracking_url,
    company_id: updatedBooking.company_id || existing?.company_id,
  };

  if (isBlockedTransitTransition || isBlockedDeliveredTransition) {
    const attemptedStatus = updatedBooking.status;
    const fallbackStatus = existing?.status || 'SCHEDULED';
    console.warn(
      `[NEO Store] Blocked client-side transition of booking ${targetRef} to ${attemptedStatus}. Verified server event required.`
    );
    // Maintain state integrity: preserve existing status, driver, progress, and tracking URLs
    // so an unauthorized transition cannot persist inconsistent or mock telemetry.
    safeBooking = {
      ...safeBooking,
      status: fallbackStatus,
      driver: existing?.driver,
      progress: existing?.progress ?? (fallbackStatus === 'SCHEDULED' ? 0.05 : undefined),
      pickup_tracking_url: existing?.pickup_tracking_url,
      delivery_tracking_url: existing?.delivery_tracking_url,
    };
  }

  const existsInCurrent = current.some(matchesBooking);
  const updated = existsInCurrent
    ? current.map((b) => (matchesBooking(b) ? safeBooking : b))
    : [safeBooking, ...current];
  writeStorage(STORAGE_BOOKINGS_KEY, updated);

  if (checkIsSupabaseConfigured() && client) {
    try {
      const updatePayload: Record<string, any> = {
        status:
          safeBooking.status === 'SCHEDULED'
            ? 'Scheduled'
            : safeBooking.status === 'IN TRANSIT'
            ? 'In transit'
            : safeBooking.status === 'DELIVERED'
            ? 'Delivered'
            : safeBooking.status === 'CANCELLED'
            ? 'Cancelled'
            : 'Scheduled',
        driver_name: safeBooking.driver?.name ?? null,
        driver_vehicle: safeBooking.driver?.vehicleModel || safeBooking.vehicle,
        driver_reg: safeBooking.driver?.registration ?? null,
        eta_label: safeBooking.deliveryTime,
        vehicle: safeBooking.vehicle,
        total_gbp: safeBooking.total,
      };

      if (typeof safeBooking.progress === 'number') {
        updatePayload.progress_t = safeBooking.progress;
      }

      if (safeBooking.pickup_tracking_url !== undefined) {
        updatePayload.pickup_tracking_url = safeBooking.pickup_tracking_url;
      }
      if (safeBooking.delivery_tracking_url !== undefined) {
        updatePayload.delivery_tracking_url = safeBooking.delivery_tracking_url;
      }

      const supabaseRowId = safeBooking.reference || safeBooking.id || existing?.reference || existing?.id;
      await client
        .from('bookings')
        .update(updatePayload)
        .eq('id', supabaseRowId);
    } catch (e) {
      console.warn('Supabase booking update failed, saved to local cache:', e);
    }
  }

  notifyPortalSync();
  return updated;
}

// 3. Quotes Persistence (Synchronous cache reader + Asynchronous Supabase fetch)
export function getStoredQuotes(companyId?: string): Quote[] {
  const stored = readStorage<Quote[]>(STORAGE_QUOTES_KEY, getIsDemoModeAllowed() ? INITIAL_QUOTES : []);
  if (!companyId) return stored;
  if (companyId === DEFAULT_COMPANY.id) {
    return stored.filter((q) => !q.company_id || q.company_id === DEFAULT_COMPANY.id);
  }
  return stored.filter((q) => q.company_id === companyId);
}

export async function getPersistedQuotes(companyId?: string): Promise<Quote[]> {
  return fetchPersistedQuotes(companyId);
}

export async function fetchPersistedQuotes(companyId?: string): Promise<Quote[]> {
  const local = readStorage<Quote[]>(STORAGE_QUOTES_KEY, getIsDemoModeAllowed() ? INITIAL_QUOTES : []);
  const client = getActiveSupabase();

  if (checkIsSupabaseConfigured() && client) {
    try {
      let query = client
        .from('quotes')
        .select('*');

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.warn('[NEO Store] Supabase quotes fetch error:', error);
        if (!getIsDemoModeAllowed()) {
          throw new Error(`Failed to load quotes from database: ${error.message}`);
        }
        return companyId
          ? (companyId === DEFAULT_COMPANY.id
              ? local.filter((q) => !q.company_id || q.company_id === DEFAULT_COMPANY.id)
              : local.filter((q) => q.company_id === companyId))
          : local;
      }

      if (data) {
        const mapped: Quote[] = data.map((row: any) => ({
          id: row.id,
          company_id: row.company_id,
          reference: row.id,
          origin: row.pickup,
          destination: row.dropoff,
          vehicle: row.vehicle,
          serviceType: row.service,
          total: Number(row.price_gbp) || 240,
          expiresText: row.expires_label || 'EXPIRES IN 3 DAYS',
          isUrgent: row.status === 'urgent' || (row.expires_label || '').toLowerCase().includes('urgent'),
        }));
        if (!companyId) {
          writeStorage(STORAGE_QUOTES_KEY, mapped);
        }
        return mapped;
      }
    } catch (e) {
      console.warn('[NEO Store] Supabase quotes fetch failed:', e);
      if (!getIsDemoModeAllowed()) {
        throw e;
      }
      return companyId
        ? (companyId === DEFAULT_COMPANY.id
            ? local.filter((q) => !q.company_id || q.company_id === DEFAULT_COMPANY.id)
            : local.filter((q) => q.company_id === companyId))
        : local;
    }
  }

  if (companyId) {
    return companyId === DEFAULT_COMPANY.id
      ? (getIsDemoModeAllowed() ? local.filter((q) => !q.company_id || q.company_id === DEFAULT_COMPANY.id) : [])
      : local.filter((q) => q.company_id === companyId);
  }

  return getIsDemoModeAllowed() ? local : [];
}

export function persistQuotes(quotes: Quote[]): void {
  writeStorage(STORAGE_QUOTES_KEY, quotes);
  notifyPortalSync();
}

export async function addQuote(newQuote: Quote, companyId?: string): Promise<Quote[]> {
  const current = getStoredQuotes();
  const updated = [newQuote, ...current.filter((q) => q.id !== newQuote.id && q.reference !== newQuote.reference)];
  writeStorage(STORAGE_QUOTES_KEY, updated);

  const client = getActiveSupabase();
  if (checkIsSupabaseConfigured() && client) {
    try {
      await client.from('quotes').insert({
        id: newQuote.reference,
        company_id: companyId || DEFAULT_COMPANY.id,
        pickup: newQuote.origin,
        dropoff: newQuote.destination,
        route: `${newQuote.origin} → ${newQuote.destination}`,
        vehicle: newQuote.vehicle,
        service: newQuote.serviceType,
        price_gbp: newQuote.total,
        expires_label: newQuote.expiresText,
        status: newQuote.isUrgent ? 'urgent' : 'active',
      });
    } catch (e) {
      console.warn('Supabase quote insert failed:', e);
    }
  }

  notifyPortalSync();
  return updated;
}

export async function deleteQuote(quoteId: string): Promise<Quote[]> {
  const current = getStoredQuotes();
  const updated = current.filter((q) => q.id !== quoteId && q.reference !== quoteId);
  writeStorage(STORAGE_QUOTES_KEY, updated);

  const client = getActiveSupabase();
  if (checkIsSupabaseConfigured() && client) {
    try {
      await client.from('quotes').delete().eq('id', quoteId);
    } catch (e) {
      console.warn('Supabase quote delete failed:', e);
    }
  }

  notifyPortalSync();
  return updated;
}

// 4. Invoices Persistence
export function getStoredInvoices(companyId?: string): Invoice[] {
  const stored = readStorage<Invoice[]>(STORAGE_INVOICES_KEY, getIsDemoModeAllowed() ? INITIAL_INVOICES : []);
  if (!companyId) return stored;
  if (companyId === DEFAULT_COMPANY.id) {
    return stored.filter((i) => !i.company_id || i.company_id === DEFAULT_COMPANY.id);
  }
  return stored.filter((i) => i.company_id === companyId);
}

export async function getPersistedInvoices(companyId?: string): Promise<Invoice[]> {
  return fetchPersistedInvoices(companyId);
}

export async function fetchPersistedInvoices(companyId?: string): Promise<Invoice[]> {
  const local = readStorage<Invoice[]>(STORAGE_INVOICES_KEY, getIsDemoModeAllowed() ? INITIAL_INVOICES : []);
  const client = getActiveSupabase();

  if (checkIsSupabaseConfigured() && client) {
    try {
      let query = client
        .from('invoices')
        .select('*');

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.warn('[NEO Store] Supabase invoices fetch error:', error);
        if (!getIsDemoModeAllowed()) {
          throw new Error(`Failed to load invoices from database: ${error.message}`);
        }
        return companyId
          ? (companyId === DEFAULT_COMPANY.id
              ? local.filter((i) => !i.company_id || i.company_id === DEFAULT_COMPANY.id)
              : local.filter((i) => i.company_id === companyId))
          : local;
      }

      if (data) {
        const mapped: Invoice[] = data.map((row: any) => ({
          id: row.id,
          company_id: row.company_id,
          reference: row.id,
          date: row.date_label,
          period: row.period_label,
          amount: Number(row.amount_gbp) || 0,
          status: (row.status?.toUpperCase() as any) || 'PAID',
          pdf_url: row.pdf_url,
        }));
        if (!companyId) {
          writeStorage(STORAGE_INVOICES_KEY, mapped);
        }
        return mapped;
      }
    } catch (e) {
      console.warn('[NEO Store] Supabase invoices fetch failed:', e);
      if (!getIsDemoModeAllowed()) {
        throw e;
      }
      return companyId
        ? (companyId === DEFAULT_COMPANY.id
            ? local.filter((i) => !i.company_id || i.company_id === DEFAULT_COMPANY.id)
            : local.filter((i) => i.company_id === companyId))
        : local;
    }
  }

  if (companyId) {
    return companyId === DEFAULT_COMPANY.id
      ? (getIsDemoModeAllowed() ? local.filter((i) => !i.company_id || i.company_id === DEFAULT_COMPANY.id) : [])
      : local.filter((i) => i.company_id === companyId);
  }

  return getIsDemoModeAllowed() ? local : [];
}

export async function updateInvoiceStatus(invoiceId: string, status: 'PAID' | 'DUE' | 'OVERDUE'): Promise<Invoice[]> {
  const current = getStoredInvoices();
  const updated = current.map((inv) => (inv.id === invoiceId || inv.reference === invoiceId ? { ...inv, status } : inv));
  writeStorage(STORAGE_INVOICES_KEY, updated);

  const client = getActiveSupabase();
  if (checkIsSupabaseConfigured() && client) {
    try {
      await client
        .from('invoices')
        .update({
          status: status === 'PAID' ? 'Paid' : status === 'DUE' ? 'Due' : 'Overdue',
        })
        .eq('id', invoiceId);
    } catch (e) {
      console.warn('Supabase invoice update failed:', e);
    }
  }

  notifyPortalSync();
  return updated;
}

// 5. Genuine Document Storage & Metadata Persistence
export function getStoredDocuments(companyId?: string): DocumentItem[] {
  const stored = readStorage<DocumentItem[]>(STORAGE_DOCUMENTS_KEY, getIsDemoModeAllowed() ? INITIAL_DOCUMENTS : []);
  if (!companyId) return stored;
  if (companyId === DEFAULT_COMPANY.id) {
    return stored.filter((d) => !d.company_id || d.company_id === DEFAULT_COMPANY.id);
  }
  return stored.filter((d) => d.company_id === companyId);
}

export async function getPersistedDocuments(companyId?: string): Promise<DocumentItem[]> {
  return fetchPersistedDocuments(companyId);
}

export async function fetchPersistedDocuments(companyId?: string): Promise<DocumentItem[]> {
  const local = readStorage<DocumentItem[]>(STORAGE_DOCUMENTS_KEY, getIsDemoModeAllowed() ? INITIAL_DOCUMENTS : []);
  const client = getActiveSupabase();

  if (checkIsSupabaseConfigured() && client) {
    try {
      let query = client
        .from('documents')
        .select('*');

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.warn('[NEO Store] Supabase documents fetch error:', error);
        if (!getIsDemoModeAllowed()) {
          throw new Error(`Failed to load documents from database: ${error.message}`);
        }
        return companyId
          ? (companyId === DEFAULT_COMPANY.id
              ? local.filter((d) => !d.company_id || d.company_id === DEFAULT_COMPANY.id)
              : local.filter((d) => d.company_id === companyId))
          : local;
      }

      if (data) {
        const mapped: DocumentItem[] = data.map((row: any) => ({
          id: row.id,
          company_id: row.company_id,
          title: row.name,
          type: row.type,
          date: row.date_label,
          category: (row.type?.toLowerCase().includes('cmr')
            ? 'cmr'
            : row.type?.toLowerCase().includes('label')
            ? 'label'
            : row.type?.toLowerCase().includes('invoice')
            ? 'invoice'
            : row.type?.toLowerCase().includes('compliance')
            ? 'compliance'
            : 'pod') as any,
          fileSize: '412 KB',
          verified: true,
          pdf_url: row.file_url,
        }));
        if (!companyId) {
          writeStorage(STORAGE_DOCUMENTS_KEY, mapped);
        }
        return mapped;
      }
    } catch (e) {
      console.warn('[NEO Store] Supabase documents fetch failed:', e);
      if (!getIsDemoModeAllowed()) {
        throw e;
      }
      return companyId
        ? (companyId === DEFAULT_COMPANY.id
            ? local.filter((d) => !d.company_id || d.company_id === DEFAULT_COMPANY.id)
            : local.filter((d) => d.company_id === companyId))
        : local;
    }
  }

  if (companyId) {
    return companyId === DEFAULT_COMPANY.id
      ? (getIsDemoModeAllowed() ? local.filter((d) => !d.company_id || d.company_id === DEFAULT_COMPANY.id) : [])
      : local.filter((d) => d.company_id === companyId);
  }

  return getIsDemoModeAllowed() ? local : [];
}

export function persistDocuments(docs: DocumentItem[]): void {
  writeStorage(STORAGE_DOCUMENTS_KEY, docs);
  notifyPortalSync();
}

/**
 * Upload a document file to the private Supabase Storage bucket ('documents').
 * Scoped by company ID. Returns the persistent storage path and a signed URL.
 */
export async function uploadDocumentFile(
  file: File,
  companyId?: string
): Promise<{ storagePath: string; signedUrl?: string; isTemporaryDemo?: boolean }> {
  const cid = companyId || DEFAULT_COMPANY.id;
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectPath = `${cid}/${Date.now()}_${sanitizedFileName}`;
  const client = getActiveSupabase();

  if (checkIsSupabaseConfigured() && client) {
    const { error: uploadError } = await client.storage
      .from('documents')
      .upload(objectPath, file, {
        upsert: true,
        contentType: file.type || 'application/pdf',
      });

    if (uploadError) {
      throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);
    }

    // Generate a 1-hour signed URL for authorized access
    const { data: signData, error: signError } = await client.storage
      .from('documents')
      .createSignedUrl(objectPath, 3600);

    if (signError) {
      throw new Error(`Failed to generate signed document URL: ${signError.message}`);
    }

    return {
      storagePath: objectPath,
      signedUrl: signData?.signedUrl,
      isTemporaryDemo: false,
    };
  }

  // When Supabase is not configured:
  if (!getIsDemoModeAllowed()) {
    throw new Error(
      'Document storage is unavailable. Private Supabase Storage bucket is not configured for this environment.'
    );
  }

  // Local demo fallback: temporary preview only
  return {
    storagePath: `demo/${sanitizedFileName}`,
    signedUrl: URL.createObjectURL(file),
    isTemporaryDemo: true,
  };
}

/**
 * Generate an authorized signed download URL for a document.
 */
export async function getDocumentDownloadUrl(pathOrUrl?: string): Promise<string | null> {
  if (!pathOrUrl) return null;

  // If already an active local blob preview URL, return it
  if (pathOrUrl.startsWith('blob:')) {
    return pathOrUrl;
  }

  // If already a signed remote URL, return it
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }

  const client = getActiveSupabase();
  if (checkIsSupabaseConfigured() && client) {
    const { data, error } = await client.storage
      .from('documents')
      .createSignedUrl(pathOrUrl, 300); // 5-minute signed link
    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
    throw new Error(error?.message || 'Storage download link generation failed.');
  }

  if (!getIsDemoModeAllowed()) {
    throw new Error('Document download unavailable: Storage service is not configured.');
  }

  return null;
}

/**
 * Safely remove an uploaded document file from the private Supabase Storage bucket ('documents').
 */
export async function removeDocumentFile(storagePath: string): Promise<void> {
  if (
    !storagePath ||
    storagePath.startsWith('blob:') ||
    storagePath.startsWith('http:') ||
    storagePath.startsWith('https:') ||
    storagePath.startsWith('demo/')
  ) {
    return;
  }

  const client = getActiveSupabase();
  if (checkIsSupabaseConfigured() && client) {
    const { error } = await client.storage.from('documents').remove([storagePath]);
    if (error) {
      throw new Error(`Storage cleanup failed: ${error.message}`);
    }
  }
}

export async function addDocument(
  newDoc: DocumentItem,
  companyId?: string,
  bookingId?: string
): Promise<DocumentItem[]> {
  const client = getActiveSupabase();
  if (checkIsSupabaseConfigured() && client) {
    const resolvedBookingId =
      bookingId || (newDoc.title.includes('NT-') ? newDoc.title.match(/NT-\d+/)?.[0] : null);
    const { error: insertError } = await client.from('documents').insert({
      id: newDoc.id,
      company_id: companyId || DEFAULT_COMPANY.id,
      booking_id: resolvedBookingId,
      name: newDoc.title,
      type: newDoc.type,
      date_label: newDoc.date,
      file_url: newDoc.pdf_url || null,
    });
    if (insertError) {
      throw new Error(`Database record creation failed: ${insertError.message}`);
    }
  }

  const current = getStoredDocuments();
  const updated = [newDoc, ...current.filter((d) => d.id !== newDoc.id)];
  writeStorage(STORAGE_DOCUMENTS_KEY, updated);

  notifyPortalSync();
  return updated;
}

// 6. Support Tickets Persistence & Workflow
export function getStoredTickets(): SupportTicket[] {
  return readStorage<SupportTicket[]>(STORAGE_TICKETS_KEY, getIsDemoModeAllowed() ? INITIAL_SUPPORT_TICKETS : []);
}

export async function getPersistedTickets(): Promise<SupportTicket[]> {
  const local = readStorage<SupportTicket[]>(STORAGE_TICKETS_KEY, getIsDemoModeAllowed() ? INITIAL_SUPPORT_TICKETS : []);
  const client = getActiveSupabase();

  if (checkIsSupabaseConfigured() && client) {
    try {
      const { data, error } = await client
        .from('support_tickets')
        .select('*, companies(name, account_code)')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[NEO Support] Failed to fetch tickets from Supabase:', error);
        if (!getIsDemoModeAllowed()) {
          throw new Error(`Failed to load support tickets from database: ${error.message}`);
        }
        return local;
      }

      if (data) {
        const mapped: SupportTicket[] = data.map((row: any) => ({
          id: row.id,
          company_id: row.company_id,
          company_name:
            row.companies?.name ||
            (row.company_id === 'comp-meridian-001'
              ? 'Meridian Logistics Ltd'
              : row.company_id === 'comp-apex-002'
              ? 'Apex Precision Logistics Ltd'
              : row.company_id),
          topic: row.topic,
          message: row.message,
          status: row.status as any,
          date: row.created_at
            ? new Date(row.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : 'Today',
          created_at: row.created_at,
        }));
        writeStorage(STORAGE_TICKETS_KEY, mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('Supabase support tickets fetch failed, using local cache:', e);
      if (!getIsDemoModeAllowed()) {
        throw e;
      }
      return local;
    }
  }

  return getIsDemoModeAllowed() ? local : [];
}

export async function addSupportTicket(
  ticket: { topic: string; message: string },
  companyId?: string
): Promise<SupportTicket[]> {
  const current = getStoredTickets();

  // Resolve accurate company_id from session if missing or default
  let targetCompanyId = companyId;
  if (!targetCompanyId || targetCompanyId === DEFAULT_COMPANY.id) {
    const client = getActiveSupabase();
    if (checkIsSupabaseConfigured() && client) {
      try {
        const { data: { session } } = await client.auth.getSession();
        if (session?.user?.id) {
          const { data: profile } = await client
            .from('profiles')
            .select('company_id')
            .eq('id', session.user.id)
            .single();
          if (profile?.company_id) {
            targetCompanyId = profile.company_id;
          }
        }
      } catch (err) {
        console.warn('[NEO Support] Could not resolve session company_id:', err);
      }
    }
  }
  if (!targetCompanyId) {
    targetCompanyId = DEFAULT_COMPANY.id;
  }

  const generatedId = `SR-${Math.floor(10000 + Math.random() * 90000)}`;
  const newTicket: SupportTicket = {
    id: generatedId,
    company_id: targetCompanyId,
    company_name:
      targetCompanyId === 'comp-meridian-001'
        ? 'Meridian Logistics Ltd'
        : targetCompanyId === 'comp-apex-002'
        ? 'Apex Precision Logistics Ltd'
        : targetCompanyId,
    topic: ticket.topic,
    message: ticket.message,
    status: 'Open',
    date: 'Today',
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        id: newTicket.id,
        company_id: targetCompanyId,
        topic: newTicket.topic,
        message: newTicket.message,
        status: 'Open',
      })
      .select('*, companies(name, account_code)')
      .single();

    if (error) {
      console.error('[NEO Support] Supabase ticket insert failed:', error);
      throw new Error(`Failed to submit support ticket: ${error.message}`);
    }

    if (data) {
      newTicket.id = data.id;
      newTicket.company_id = data.company_id;
      newTicket.company_name = data.companies?.name || newTicket.company_name;
      newTicket.date = new Date(data.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      newTicket.created_at = data.created_at;
    }
  }

  const updated = [newTicket, ...current.filter((t) => t.id !== newTicket.id)];
  writeStorage(STORAGE_TICKETS_KEY, updated);
  notifyPortalSync();
  return updated;
}

export async function updateSupportTicketStatus(
  ticketId: string,
  newStatus: 'Open' | 'In Progress' | 'Resolved'
): Promise<SupportTicket[]> {
  const current = getStoredTickets();
  const updated = current.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t));
  writeStorage(STORAGE_TICKETS_KEY, updated);

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('support_tickets')
      .update({ status: newStatus })
      .eq('id', ticketId);

    if (error) {
      console.error('[NEO Support] Failed to update ticket status in Supabase:', error);
      throw new Error(`Failed to update ticket status: ${error.message}`);
    }
  }

  notifyPortalSync();
  return updated;
}

// 6.1 Ticket Messages / Conversation Workflow
export const INITIAL_TICKET_MESSAGES: Record<string, SupportTicketMessage[]> = {
  'SR-8941': [
    {
      id: 'msg-demo-01',
      ticket_id: 'SR-8941',
      sender_name: 'NEO Duty Dispatcher (Mark S.)',
      sender_role: 'admin',
      message: 'Trafford Park Bay 3 is fully cleared for tail-lift offloading. Driver assigned with tail-lift Sprinter and notified of access instructions.',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
  ],
  'SR-8922': [
    {
      id: 'msg-demo-02',
      ticket_id: 'SR-8922',
      sender_name: 'NEO Compliance Desk',
      sender_role: 'admin',
      message: 'Paperwork verified. Driver Tremcard Class 3 has been stamped and uploaded to consignment audit logs.',
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
  ],
};

export function getStoredTicketMessages(ticketId: string): SupportTicketMessage[] {
  return readStorage<SupportTicketMessage[]>(
    STORAGE_TICKET_MESSAGES_KEY_PREFIX + ticketId,
    INITIAL_TICKET_MESSAGES[ticketId] || []
  );
}

export async function getPersistedTicketMessages(ticketId: string): Promise<SupportTicketMessage[]> {
  const local = getStoredTicketMessages(ticketId);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const mapped: SupportTicketMessage[] = data.map((row: any) => ({
          id: row.id,
          ticket_id: row.ticket_id,
          sender_id: row.sender_id,
          sender_name: row.sender_name,
          sender_role: row.sender_role,
          message: row.message,
          created_at: row.created_at,
        }));
        writeStorage(STORAGE_TICKET_MESSAGES_KEY_PREFIX + ticketId, mapped);
        return mapped;
      }
      if (error) {
        console.warn(`[NEO Support] Failed to fetch messages for ticket ${ticketId}:`, error);
      }
    } catch (err) {
      console.warn(`[NEO Support] Message fetch exception for ticket ${ticketId}:`, err);
    }
  }

  return local;
}

export async function addTicketMessage(
  ticketId: string,
  messageText: string,
  authorRole?: 'admin' | 'customer',
  authorName?: string
): Promise<SupportTicketMessage> {
  const trimmed = messageText.trim();
  if (!trimmed) {
    throw new Error('Message content cannot be empty.');
  }

  let resolvedUserId: string | undefined = undefined;
  let resolvedRole: 'admin' | 'customer' = authorRole || 'customer';
  let resolvedName: string = authorName || (resolvedRole === 'admin' ? 'NEO Duty Dispatch' : 'Client Representative');

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        resolvedUserId = session.user.id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', session.user.id)
          .single();
        if (profile) {
          if (profile.full_name) resolvedName = profile.full_name;
          if (profile.role) resolvedRole = profile.role as 'admin' | 'customer';
        }
      }
    } catch (e) {
      console.warn('[NEO Support] Session profile lookup for message failed:', e);
    }
  }

  const newMsgId = `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const newMsg: SupportTicketMessage = {
    id: newMsgId,
    ticket_id: ticketId,
    sender_id: resolvedUserId,
    sender_name: resolvedName,
    sender_role: resolvedRole,
    message: trimmed,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('support_ticket_messages')
      .insert({
        id: newMsg.id,
        ticket_id: ticketId,
        sender_id: resolvedUserId,
        sender_name: resolvedName,
        sender_role: resolvedRole,
        message: trimmed,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[NEO Support] Failed to persist message to Supabase:', error);
      throw new Error(`Failed to send reply: ${error.message}`);
    }

    if (data) {
      newMsg.id = data.id;
      newMsg.created_at = data.created_at;
      newMsg.sender_role = data.sender_role;
      newMsg.sender_name = data.sender_name;
    }
  }

  const currentMessages = getStoredTicketMessages(ticketId);
  const updatedMessages = [...currentMessages.filter((m) => m.id !== newMsg.id), newMsg];
  writeStorage(STORAGE_TICKET_MESSAGES_KEY_PREFIX + ticketId, updatedMessages);
  notifyPortalSync();
  return newMsg;
}

// 7. Active Tracking ID & Wizard Draft Persistence
export function getPersistedActiveTrackingId(): string {
  return readStorage<string>(STORAGE_ACTIVE_TRACKING_KEY, 'b-1');
}

export function persistActiveTrackingId(id: string): void {
  writeStorage(STORAGE_ACTIVE_TRACKING_KEY, id);
  notifyPortalSync();
}

export function getPersistedWizardDraft(): BookingWizardState {
  return readStorage<BookingWizardState>(STORAGE_WIZARD_DRAFT_KEY, INITIAL_WIZARD_DRAFT);
}

export function persistWizardDraft(draft: BookingWizardState): void {
  writeStorage(STORAGE_WIZARD_DRAFT_KEY, draft);
}

// 8. Standby Applications Persistence
export async function getPersistedApplications(): Promise<StandbyApplication[]> {
  const local = readStorage<StandbyApplication[]>(
    STORAGE_APPLICATIONS_KEY,
    getIsDemoModeAllowed() ? INITIAL_STANDBY_APPLICATIONS : []
  );
  if (getIsDemoModeAllowed() && !localStorage.getItem(STORAGE_APPLICATIONS_KEY)) {
    writeStorage(STORAGE_APPLICATIONS_KEY, INITIAL_STANDBY_APPLICATIONS);
  }

  const client = getActiveSupabase();
  if (checkIsSupabaseConfigured() && client) {
    try {
      const { data, error } = await client
        .from('standby_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[NEO Store] Supabase applications fetch error:', error);
        if (!getIsDemoModeAllowed()) {
          throw new Error(`Failed to load standby applications from database: ${error.message}`);
        }
        return local;
      }

      if (data) {
        writeStorage(STORAGE_APPLICATIONS_KEY, data);
        return data;
      }
    } catch (e) {
      console.warn('[NEO Store] Supabase applications fetch failed:', e);
      if (!getIsDemoModeAllowed()) {
        throw e;
      }
      return local;
    }
  }

  return getIsDemoModeAllowed() ? local : [];
}

export async function approveApplication(appId: string): Promise<StandbyApplication[]> {
  const current = await getPersistedApplications();
  const code = `NEO-SB-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
  const updated = current.map((app) =>
    app.id === appId
      ? {
          ...app,
          status: 'approved' as const,
          account_code: app.account_code || code,
        }
      : app
  );
  writeStorage(STORAGE_APPLICATIONS_KEY, updated);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('standby_applications')
        .update({ status: 'approved' })
        .eq('id', appId);
    } catch (e) {
      console.warn('Supabase application approval failed:', e);
    }
  }

  // Enqueue notification for approved standby application
  const approvedApp = updated.find((a) => a.id === appId);
  const applicantEmail = approvedApp?.ops_email || approvedApp?.accounts_email;
  if (approvedApp && applicantEmail && typeof fetch !== 'undefined') {
    try {
      fetch('/api/notifications/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'standby_application_approved',
          idempotency_key: 'standby_appr_' + appId + '_' + (approvedApp.account_code || 'approved'),
          recipient_email: applicantEmail,
          recipient_role: 'customer',
          payload: {
            applicationId: appId,
            companyName: approvedApp.company_name,
            contactName: approvedApp.contact_name,
            accountCode: approvedApp.account_code,
          },
        }),
      }).catch(() => {});
    } catch {
      // Non-blocking notification dispatch
    }
  }

  notifyPortalSync();
  return updated;
}

// ==============================================================================
// 9. ADMIN CONTROL CENTER: USER & ACCOUNT MANAGEMENT
// ==============================================================================

export const INITIAL_PROFILES: ProfileWithCompany[] = [
  {
    id: 'user-chris-sullivan',
    company_id: 'comp-meridian-001',
    full_name: 'Chris Sullivan',
    initials: 'CS',
    email: 'chris@meridian.co.uk',
    role: 'customer',
    status: 'active',
    created_at: '2026-08-01T08:00:00Z',
    companies: DEFAULT_COMPANY,
  },
  {
    id: 'admin-ops-01',
    company_id: 'c-neo-ops',
    full_name: 'NEO Operations Dispatch',
    initials: 'OP',
    email: 'ops@neotransport.co.uk',
    role: 'admin',
    status: 'active',
    created_at: '2026-07-15T08:00:00Z',
    companies: {
      id: 'c-neo-ops',
      name: 'NEO Transport Ops Control',
      account_code: 'NEO-DISPATCH-01',
      standby_active: true,
      verified: true,
      monthly_spend: 0,
      paid_ytd: 0,
      next_statement_date: 'Internal Desk',
    },
  },
];

export async function getPersistedProfiles(): Promise<ProfileWithCompany[]> {
  const local = readStorage<ProfileWithCompany[]>(
    STORAGE_PROFILES_KEY,
    getIsDemoModeAllowed() ? INITIAL_PROFILES : []
  );
  if (getIsDemoModeAllowed() && !localStorage.getItem(STORAGE_PROFILES_KEY)) {
    writeStorage(STORAGE_PROFILES_KEY, INITIAL_PROFILES);
  }

  const client = getActiveSupabase();
  if (checkIsSupabaseConfigured() && client) {
    try {
      const { data, error } = await client
        .from('profiles')
        .select('*, companies(*)')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[NEO Store] Supabase profiles fetch error:', error);
        throw new Error(`Failed to load user directory: ${error.message}`);
      }

      if (data) {
        const mapped: ProfileWithCompany[] = data.map((p: any) => ({
          id: p.id,
          company_id: p.company_id,
          full_name: p.full_name,
          initials: p.initials,
          email: p.email,
          role: p.role,
          status: p.status || 'active',
          created_at: p.created_at,
          companies: Array.isArray(p.companies) ? p.companies[0] : p.companies,
        }));
        writeStorage(STORAGE_PROFILES_KEY, mapped);
        return mapped;
      }
    } catch (e: any) {
      console.error('[NEO Store] Error fetching profiles:', e);
      if (!getIsDemoModeAllowed()) {
        throw e;
      }
    }
  }

  return getIsDemoModeAllowed() ? local : [];
}

export async function getProfileById(userId: string): Promise<ProfileWithCompany | null> {
  const profiles = await getPersistedProfiles();
  return profiles.find((p) => p.id === userId) || null;
}

export interface CreateUserResult {
  profile: ProfileWithCompany;
  temporaryPassword?: string;
}

export async function createCustomerAccount(payload: {
  email: string;
  password?: string;
  fullName: string;
  companyId: string;
  role?: 'customer' | 'admin';
}): Promise<CreateUserResult> {
  const headers = await getAuthHeaders();

  try {
    const response = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok || !result.success || !result.profile) {
      throw new Error(result.error || `Server rejected account creation (HTTP ${response.status}).`);
    }

    const newProfile: ProfileWithCompany = {
      id: result.profile.id,
      company_id: result.profile.company_id,
      full_name: result.profile.full_name,
      initials: result.profile.initials,
      email: result.profile.email,
      role: result.profile.role,
      status: result.profile.status || 'active',
      created_at: result.profile.created_at,
      companies: Array.isArray(result.profile.companies) ? result.profile.companies[0] : result.profile.companies,
    };

    const current = readStorage<ProfileWithCompany[]>(STORAGE_PROFILES_KEY, INITIAL_PROFILES);
    writeStorage(STORAGE_PROFILES_KEY, [newProfile, ...current.filter((p) => p.id !== newProfile.id)]);
    notifyPortalSync();
    return {
      profile: newProfile,
      temporaryPassword: result.temporaryPassword,
    };
  } catch (err: any) {
    console.error('[NEO Store] Account creation failed:', err);
    throw new Error(err?.message || 'Admin account creation server endpoint is unavailable. Account creation cannot proceed without trusted server provisioning.');
  }
}

// Alias for semantic clarity in Admin Control Center
export const createProfile = createCustomerAccount;

export async function updateProfileStatus(
  userId: string,
  status: 'active' | 'suspended',
  reason?: string
): Promise<ProfileWithCompany> {
  // Client-side pre-check for self-suspension
  if (isSupabaseConfigured && supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id === userId && status === 'suspended') {
      throw new Error('Administrators cannot suspend their own account.');
    }
  }

  const headers = await getAuthHeaders();

  try {
    const response = await fetch('/api/admin/update-user-status', {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetUserId: userId, status, reason }),
    });

    let result: any = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok || !result?.success || !result?.profile) {
      throw new Error(result?.error || `Server rejected account status update (HTTP ${response.status}).`);
    }

    const updated: ProfileWithCompany = {
      id: result.profile.id,
      company_id: result.profile.company_id,
      full_name: result.profile.full_name,
      initials: result.profile.initials,
      email: result.profile.email,
      role: result.profile.role,
      status: result.profile.status,
      created_at: result.profile.created_at,
      companies: Array.isArray(result.profile.companies) ? result.profile.companies[0] : result.profile.companies,
    };

    const current = readStorage<ProfileWithCompany[]>(STORAGE_PROFILES_KEY, INITIAL_PROFILES);
    writeStorage(STORAGE_PROFILES_KEY, current.map((p) => (p.id === userId ? updated : p)));
    notifyPortalSync();
    return updated;
  } catch (err: any) {
    console.error('[NEO Store] Account status update failed:', err);
    throw new Error(
      err?.message || 'Admin status server endpoint is unavailable. Account suspension/reactivation cannot proceed without server-side verification, session revocation, and audit logging.'
    );
  }
}

export async function updateProfileRole(
  userId: string,
  role: 'customer' | 'admin',
  reason?: string
): Promise<ProfileWithCompany> {
  // Client-side pre-check for self-demotion
  if (isSupabaseConfigured && supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id === userId && role !== 'admin') {
      throw new Error('Administrators cannot demote their own account. Another administrator must perform this action.');
    }
  }

  const headers = await getAuthHeaders();

  try {
    const response = await fetch('/api/admin/update-user-role', {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetUserId: userId, role, reason }),
    });

    let result: any = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok || !result?.success || !result?.profile) {
      throw new Error(result?.error || `Server rejected role update (HTTP ${response.status}).`);
    }

    const updated: ProfileWithCompany = {
      id: result.profile.id,
      company_id: result.profile.company_id,
      full_name: result.profile.full_name,
      initials: result.profile.initials,
      email: result.profile.email,
      role: result.profile.role,
      status: result.profile.status,
      created_at: result.profile.created_at,
      companies: Array.isArray(result.profile.companies) ? result.profile.companies[0] : result.profile.companies,
    };

    const current = readStorage<ProfileWithCompany[]>(STORAGE_PROFILES_KEY, INITIAL_PROFILES);
    writeStorage(STORAGE_PROFILES_KEY, current.map((p) => (p.id === userId ? updated : p)));
    notifyPortalSync();
    return updated;
  } catch (err: any) {
    console.error('[NEO Store] Role update failed:', err);
    throw new Error(
      err?.message || 'Admin role server endpoint is unavailable. Role assignments cannot proceed without server-side authorization and audit logging.'
    );
  }
}

export async function updateProfileCompany(
  userId: string,
  companyId: string,
  reason?: string
): Promise<ProfileWithCompany> {
  const headers = await getAuthHeaders();

  try {
    const response = await fetch('/api/admin/update-user-company', {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetUserId: userId, companyId, reason }),
    });

    let result: any = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok || !result?.success || !result?.profile) {
      throw new Error(result?.error || `Server rejected company reassignment (HTTP ${response.status}).`);
    }

    const updated: ProfileWithCompany = {
      id: result.profile.id,
      company_id: result.profile.company_id,
      full_name: result.profile.full_name,
      initials: result.profile.initials,
      email: result.profile.email,
      role: result.profile.role,
      status: result.profile.status,
      created_at: result.profile.created_at,
      companies: Array.isArray(result.profile.companies) ? result.profile.companies[0] : result.profile.companies,
    };

    const current = readStorage<ProfileWithCompany[]>(STORAGE_PROFILES_KEY, INITIAL_PROFILES);
    writeStorage(STORAGE_PROFILES_KEY, current.map((p) => (p.id === userId ? updated : p)));
    notifyPortalSync();
    return updated;
  } catch (err: any) {
    console.error('[NEO Store] Company reassignment failed:', err);
    throw new Error(
      err?.message || 'Admin company server endpoint is unavailable. Company reassignment cannot proceed without server-side verification and audit logging.'
    );
  }
}

export interface AdminPasswordResetResult {
  success: boolean;
  emailDispatched?: boolean;
  partialSuccess?: boolean;
  message: string;
  recoveryLink?: string;
}

export async function sendAdminPasswordReset(
  emailOrPayload: string | { email?: string; targetUserId?: string },
  targetUserId?: string
): Promise<AdminPasswordResetResult> {
  let cleanEmail = '';
  let cleanTargetUserId = '';

  if (typeof emailOrPayload === 'string') {
    cleanEmail = (emailOrPayload || '').trim().toLowerCase();
    if (targetUserId) cleanTargetUserId = targetUserId.trim();
  } else if (typeof emailOrPayload === 'object' && emailOrPayload !== null) {
    cleanEmail = (emailOrPayload.email || '').trim().toLowerCase();
    cleanTargetUserId = (emailOrPayload.targetUserId || '').trim();
  }

  if (!cleanEmail && !cleanTargetUserId) {
    throw new Error('Target user email address or ID is required for password reset.');
  }

  const headers = await getAuthHeaders();

  try {
    const payload: { email?: string; targetUserId?: string } = {};
    if (cleanEmail) payload.email = cleanEmail;
    if (cleanTargetUserId) payload.targetUserId = cleanTargetUserId;

    const response = await fetch('/api/admin/trigger-password-reset', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    let result: any = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok || (!result?.success && !result?.partialSuccess)) {
      throw new Error(result?.error || `Server rejected password reset (HTTP ${response.status}).`);
    }

    return {
      success: Boolean(result?.success),
      emailDispatched: Boolean(result?.emailDispatched),
      partialSuccess: Boolean(result?.partialSuccess),
      message: result?.message || `Password reset link dispatched to ${cleanEmail || 'user'}.`,
      recoveryLink: result?.recoveryLink,
    };
  } catch (err: any) {
    console.error('[NEO Store] Password reset failed:', err);
    throw new Error(
      err?.message || 'Admin password reset server endpoint is unavailable. Password reset cannot proceed without trusted server dispatch and audit logging.'
    );
  }
}

export const triggerAdminPasswordReset = sendAdminPasswordReset;

// ==============================================================================
// 10. ADMIN CONTROL CENTER: COMPANY MANAGEMENT
// ==============================================================================

export const INITIAL_COMPANIES: CompanyDetails[] = [
  {
    id: 'comp-meridian-001',
    name: 'Meridian Logistics Ltd',
    account_code: 'NEO-SB-2026',
    standby_active: true,
    verified: true,
    monthly_spend: 4280,
    paid_ytd: 31420,
    next_statement_date: '01 Sep',
    user_count: 2,
    active_bookings_count: 3,
  },
  {
    id: 'comp-apex-002',
    name: 'Apex Precision Logistics Ltd',
    account_code: 'NEO-SB-2026-APEX',
    standby_active: true,
    verified: true,
    monthly_spend: 1850,
    paid_ytd: 12400,
    next_statement_date: '01 Sep',
    user_count: 1,
    active_bookings_count: 1,
  },
  {
    id: 'c-neo-ops',
    name: 'NEO Transport Ops Control',
    account_code: 'NEO-DISPATCH-01',
    standby_active: true,
    verified: true,
    monthly_spend: 0,
    paid_ytd: 0,
    next_statement_date: 'Internal Desk',
    user_count: 3,
    active_bookings_count: 0,
  },
];

export async function getPersistedCompanies(): Promise<CompanyDetails[]> {
  const local = readStorage<CompanyDetails[]>(
    STORAGE_COMPANIES_KEY,
    getIsDemoModeAllowed() ? INITIAL_COMPANIES : []
  );
  if (getIsDemoModeAllowed() && !localStorage.getItem(STORAGE_COMPANIES_KEY)) {
    writeStorage(STORAGE_COMPANIES_KEY, INITIAL_COMPANIES);
  }

  const client = getActiveSupabase();
  if (checkIsSupabaseConfigured() && client) {
    try {
      const { data: companies, error: compErr } = await client
        .from('companies')
        .select('*')
        .order('name', { ascending: true });

      if (compErr) {
        throw new Error(`Failed to load companies: ${compErr.message}`);
      }

      if (companies) {
        // Retrieve profile counts per company
        const { data: profiles } = await client.from('profiles').select('company_id');
        const { data: bookings } = await client
          .from('bookings')
          .select('company_id, status')
          .in('status', ['Scheduled', 'In transit']);

        const userCounts: Record<string, number> = {};
        (profiles || []).forEach((p: any) => {
          if (p.company_id) userCounts[p.company_id] = (userCounts[p.company_id] || 0) + 1;
        });

        const bookingCounts: Record<string, number> = {};
        (bookings || []).forEach((b: any) => {
          if (b.company_id) bookingCounts[b.company_id] = (bookingCounts[b.company_id] || 0) + 1;
        });

        const mapped: CompanyDetails[] = companies.map((c: any) => ({
          id: c.id,
          name: c.name,
          account_code: c.account_code,
          standby_active: Boolean(c.standby_active),
          verified: Boolean(c.verified),
          monthly_spend: Number(c.monthly_spend || 0),
          paid_ytd: Number(c.paid_ytd || 0),
          next_statement_date: c.next_statement_date || '01 Sep',
          user_count: userCounts[c.id] || 0,
          active_bookings_count: bookingCounts[c.id] || 0,
        }));

        writeStorage(STORAGE_COMPANIES_KEY, mapped);
        return mapped;
      }
    } catch (e: any) {
      console.error('[NEO Store] Error fetching companies:', e);
      if (!getIsDemoModeAllowed()) {
        throw e;
      }
    }
  }

  return getIsDemoModeAllowed() ? local : [];
}

export async function getCompanyDetails(companyId: string): Promise<CompanyDetails | null> {
  const companies = await getPersistedCompanies();
  return companies.find((c) => c.id === companyId) || null;
}

export async function createCompany(payload: {
  name: string;
  account_code?: string;
  standby_active?: boolean;
  verified?: boolean;
}): Promise<Company> {
  const cleanName = (payload.name || '').trim();
  if (!cleanName) {
    throw new Error('Company name is required.');
  }

  const id = `comp-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 16)}-${Math.floor(100 + Math.random() * 900)}`;
  const accountCode = payload.account_code || `NEO-SB-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

  const newCompany: Company = {
    id,
    name: cleanName,
    account_code: accountCode,
    standby_active: payload.standby_active ?? true,
    verified: payload.verified ?? false,
    monthly_spend: 0,
    paid_ytd: 0,
    next_statement_date: '01 Sep',
  };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('companies')
      .insert({
        id: newCompany.id,
        name: newCompany.name,
        account_code: newCompany.account_code,
        standby_active: newCompany.standby_active,
        verified: newCompany.verified,
        monthly_spend: newCompany.monthly_spend,
        paid_ytd: newCompany.paid_ytd,
        next_statement_date: newCompany.next_statement_date,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create company: ${error.message}`);
    }

    await logAdminAction('COMPANY_CREATE', 'companies', newCompany.id, {
      name: newCompany.name,
      account_code: newCompany.account_code,
    });

    if (data) {
      newCompany.id = data.id;
    }
  }

  const current = readStorage<CompanyDetails[]>(STORAGE_COMPANIES_KEY, INITIAL_COMPANIES);
  const updated = [{ ...newCompany, user_count: 0, active_bookings_count: 0 }, ...current.filter((c) => c.id !== newCompany.id)];
  writeStorage(STORAGE_COMPANIES_KEY, updated);
  notifyPortalSync();
  return newCompany;
}

export const addCompany = createCompany;

export async function updateCompany(companyId: string, updates: Partial<Company>): Promise<Company> {
  const current = readStorage<CompanyDetails[]>(STORAGE_COMPANIES_KEY, INITIAL_COMPANIES);
  const existing = current.find((c) => c.id === companyId);
  if (!existing) {
    throw new Error(`Company with ID '${companyId}' not found.`);
  }

  const merged: Company = {
    ...existing,
    ...updates,
    id: companyId,
  };

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', companyId);

    if (error) {
      throw new Error(`Failed to update company: ${error.message}`);
    }

    await logAdminAction('COMPANY_UPDATE', 'companies', companyId, updates);
  }

  const updated = current.map((c) => (c.id === companyId ? { ...c, ...updates } : c));
  writeStorage(STORAGE_COMPANIES_KEY, updated);
  notifyPortalSync();
  return merged;
}

// ==============================================================================
// 11. ADMIN CONTROL CENTER: AUDIT LOGS
// ==============================================================================

export const INITIAL_AUDIT_LOGS: AdminAuditLog[] = [
  {
    id: 'aud-sys-init-01',
    admin_id: 'admin-ops-01',
    admin_email: 'ops@neotransport.co.uk',
    admin_name: 'NEO Operations Dispatch',
    action: 'SYSTEM_BOOTSTRAP',
    target_entity: 'system',
    target_id: 'staging-environment',
    details: { message: 'Admin Control Center security baseline applied.' },
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
];

export async function getPersistedAuditLogs(): Promise<AdminAuditLog[]> {
  const local = readStorage<AdminAuditLog[]>(
    STORAGE_AUDIT_LOGS_KEY,
    getIsDemoModeAllowed() ? INITIAL_AUDIT_LOGS : []
  );
  if (getIsDemoModeAllowed() && !localStorage.getItem(STORAGE_AUDIT_LOGS_KEY)) {
    writeStorage(STORAGE_AUDIT_LOGS_KEY, INITIAL_AUDIT_LOGS);
  }

  const client = getActiveSupabase();
  if (checkIsSupabaseConfigured() && client) {
    try {
      const { data, error } = await client
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        throw new Error(`Failed to retrieve audit trail: ${error.message}`);
      }

      if (data) {
        const mapped: AdminAuditLog[] = data.map((row: any) => ({
          id: row.id,
          admin_id: row.admin_id,
          admin_email: row.admin_email,
          admin_name: row.admin_name,
          action: row.action,
          target_entity: row.target_entity,
          target_id: row.target_id,
          details: typeof row.details === 'object' && row.details !== null ? row.details : {},
          created_at: row.created_at,
        }));
        writeStorage(STORAGE_AUDIT_LOGS_KEY, mapped);
        return mapped;
      }
    } catch (e: any) {
      console.error('[NEO Store] Error loading audit logs:', e);
      if (!getIsDemoModeAllowed()) {
        throw e;
      }
    }
  }

  return getIsDemoModeAllowed() ? local : [];
}

export async function logAdminAction(
  action: string,
  targetEntity: string,
  targetId: string | null,
  details: Record<string, unknown>
): Promise<AdminAuditLog> {
  const now = new Date().toISOString();
  let adminId = 'admin-ops-01';
  let adminEmail = 'ops@neotransport.co.uk';
  let adminName = 'NEO Operations Dispatch';

  if (isSupabaseConfigured && supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      adminId = session.user.id;
      adminEmail = session.user.email || adminEmail;
      adminName = session.user.user_metadata?.full_name || adminEmail.split('@')[0];
    }

    const { data, error } = await supabase
      .from('admin_audit_logs')
      .insert({
        admin_id: adminId,
        admin_email: adminEmail,
        admin_name: adminName,
        action,
        target_entity: targetEntity,
        target_id: targetId,
        details,
        created_at: now,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[NEO Store] Audit log insertion failed:', error);
      throw new Error(`Audit logging failed: ${error.message}. Action aborted for data integrity.`);
    }

    const entry: AdminAuditLog = {
      id: data?.id || `aud-${Date.now()}`,
      admin_id: data?.admin_id || adminId,
      admin_email: data?.admin_email || adminEmail,
      admin_name: data?.admin_name || adminName,
      action: data?.action || action,
      target_entity: data?.target_entity || targetEntity,
      target_id: data?.target_id || targetId,
      details: data?.details || details,
      created_at: data?.created_at || now,
    };

    const current = readStorage<AdminAuditLog[]>(STORAGE_AUDIT_LOGS_KEY, INITIAL_AUDIT_LOGS);
    writeStorage(STORAGE_AUDIT_LOGS_KEY, [entry, ...current]);
    notifyPortalSync();
    return entry;
  }

  const localEntry: AdminAuditLog = {
    id: `aud-${Date.now()}`,
    admin_id: adminId,
    admin_email: adminEmail,
    admin_name: adminName,
    action,
    target_entity: targetEntity,
    target_id: targetId,
    details,
    created_at: now,
  };

  const current = readStorage<AdminAuditLog[]>(STORAGE_AUDIT_LOGS_KEY, INITIAL_AUDIT_LOGS);
  writeStorage(STORAGE_AUDIT_LOGS_KEY, [localEntry, ...current]);
  notifyPortalSync();
  return localEntry;
}


// ==============================================================================
// 12. ADMIN CONTROL CENTER: SPOKE DISPATCH (DRY-RUN & PILOT)
// ==============================================================================

export interface SpokeDryRunResult {
  success: boolean;
  plan?: {
    title: string;
    starts: { day: number; month: number; year: number };
  };
  stops?: any[];
  summary?: {
    isDispatchReady: boolean;
    errors: string[];
    warnings: string[];
    coordinatesStatus?: any;
    unresolvedOperationalRequirements?: string[];
  };
  geocoding?: {
    configured: boolean;
    allResolved?: boolean;
    anyRequiresManualReview?: boolean;
    manualReviewReasons?: string[];
    pickup?: any;
    dropoff?: any;
  };
  auditLogged?: boolean;
  error?: string;
}

export interface SpokePilotDispatchResult {
  success: boolean;
  claimId?: string;
  planId?: string;
  planTitle?: string;
  bookingId?: string;
  stopsImported?: number;
  stopIds?: string[];
  driverAssigned?: string | null;
  message?: string;
  error?: string;
  existingClaim?: any;
  persistenceWarning?: string;
}

/**
 * Execute Spoke dry-run preview via POST /api/admin/dispatch/spoke/dry-run.
 * Generates an in-memory Spoke payload preview without performing any mutations.
 */
export interface PilotDispatchExecutableState {
  isDispatching: boolean;
  isDryRunLoading: boolean;
  dryRunResult: SpokeDryRunResult | { success: boolean; geocoding?: any } | null;
  dryRunError: string | null;
  pilotAuthToken: string;
  pilotConfirmed: boolean;
  pilotDispatchBooking?: { id: string } | null;
  allowGeocodeOverride?: boolean;
}

/**
 * Evaluates whether Spoke Pilot Dispatch execution is permitted.
 * Strictly fails closed unless:
 * - Pre-flight is not loading
 * - Pre-flight dry-run succeeded without errors
 * - No dryRunError is present
 * - Pilot authorization token is entered
 * - Pilot confirmation checkbox is checked
 * - An active scheduled booking is designated
 * - No dispatch request is currently in progress
 * - If geocoding manual review is flagged, explicit override must be authorized
 */
export function isPilotDispatchExecutable(state: PilotDispatchExecutableState): boolean {
  if (state.isDispatching) return false;
  if (state.isDryRunLoading) return false;
  if (!state.dryRunResult || !state.dryRunResult.success) return false;
  if (Boolean(state.dryRunError)) return false;
  if (!state.pilotAuthToken || !state.pilotAuthToken.trim()) return false;
  if (!state.pilotConfirmed) return false;
  if (state.pilotDispatchBooking !== undefined && !state.pilotDispatchBooking) return false;
  if ((state.dryRunResult as any)?.summary?.coordinatesStatus) {
    const coordsStatus = (state.dryRunResult as any).summary.coordinatesStatus;
    if (coordsStatus.pickup !== 'provided_and_valid' || coordsStatus.dropoff !== 'provided_and_valid') {
      return false;
    }
  }
  if ((state.dryRunResult as any)?.geocoding?.anyRequiresManualReview && !state.allowGeocodeOverride) {
    return false;
  }
  return true;
}

export async function executeSpokeDryRun(
  bookingId: string,
  planDate: string
): Promise<SpokeDryRunResult> {
  const cleanBookingId = (bookingId || '').trim();
  const cleanPlanDate = (planDate || '').trim();

  if (!cleanBookingId) {
    throw new Error('Valid booking ID is required for Spoke dry-run.');
  }
  if (!cleanPlanDate) {
    throw new Error('Valid plan date (YYYY-MM-DD) is required for Spoke dry-run.');
  }

  const headers = await getAuthHeaders();

  try {
    const response = await fetch('/api/admin/dispatch/spoke/dry-run', {
      method: 'POST',
      headers,
      body: JSON.stringify({ bookingId: cleanBookingId, planDate: cleanPlanDate }),
    });

    let result: any = null;
    let safeFallbackMessage = '';
    let rawBodyText = '';
    if (typeof response.text === 'function') {
      rawBodyText = await response.text();
      try {
        result = JSON.parse(rawBodyText);
      } catch {
        result = null;
        if (rawBodyText.includes('FUNCTION_INVOCATION_FAILED')) {
          safeFallbackMessage = 'Server function initialization failed (Vercel runtime module error).';
        } else if (rawBodyText.includes('FUNCTION_INVOCATION_TIMEOUT')) {
          safeFallbackMessage = 'Server function execution timed out before response could be generated.';
        } else if (response.status === 502 || response.status === 504) {
          safeFallbackMessage = 'Gateway / server proxy communication error.';
        }
      }
    } else if (typeof (response as any).json === 'function') {
      try {
        result = await (response as any).json();
      } catch {
        result = null;
      }
    }

    if (!response.ok || !result?.success) {
      if (response.status === 401) {
        const diag = await getAdminSessionDiagnostics();
        console.warn('[NEO Store Spoke Dry-Run] 401 Unauthorized diagnostic:', {
          hasSession: diag.hasSession,
          isExpired: diag.isExpired,
          serverError: result?.error,
        });
      }
      throw new Error(result?.error || safeFallbackMessage || `Spoke dry-run failed with HTTP status ${response.status}.`);
    }

    return result as SpokeDryRunResult;
  } catch (err: any) {
    console.error('[NEO Store] Spoke dry-run error:', err);
    throw new Error(err?.message || 'Server endpoint for Spoke dry-run preview is unavailable.');
  }
}

/**
 * Execute Spoke pilot dispatch via POST /api/admin/dispatch/spoke/pilot.
 * Requires active admin session Bearer token and approved pilot authorization token.
 */
export async function executeSpokePilotDispatch(payload: {
  bookingId: string;
  planDate: string;
  pilotAuthorizationToken: string;
  planTitle?: string;
  recoverExistingPlan?: boolean;
  supersedeStaleClaim?: boolean;
  staleResolutionReason?: string;
  allowImpreciseGeocodeOverride?: boolean;
}): Promise<SpokePilotDispatchResult> {
  const cleanBookingId = (payload.bookingId || '').trim();
  const cleanPlanDate = (payload.planDate || '').trim();
  const cleanToken = (payload.pilotAuthorizationToken || '').trim();

  if (!cleanBookingId) {
    throw new Error('Valid booking ID is required for Spoke pilot dispatch.');
  }
  if (!cleanPlanDate) {
    throw new Error('Valid plan date (YYYY-MM-DD) is required for Spoke pilot dispatch.');
  }
  if (!cleanToken) {
    throw new Error('Pilot authorization token is required.');
  }

  const headers = await getAuthHeaders();

  const reqBody: Record<string, any> = {
    bookingId: cleanBookingId,
    planDate: cleanPlanDate,
    pilotAuthorizationToken: cleanToken,
  };

  if (payload.planTitle && payload.planTitle.trim()) {
    reqBody.planTitle = payload.planTitle.trim();
  }
  if (payload.recoverExistingPlan === true) {
    reqBody.recoverExistingPlan = true;
  }
  if (payload.supersedeStaleClaim === true) {
    reqBody.supersedeStaleClaim = true;
  }
  if (payload.staleResolutionReason && payload.staleResolutionReason.trim()) {
    reqBody.staleResolutionReason = payload.staleResolutionReason.trim();
  }
  if (payload.allowImpreciseGeocodeOverride === true) {
    reqBody.allowImpreciseGeocodeOverride = true;
  }

  try {
    const response = await fetch('/api/admin/dispatch/spoke/pilot', {
      method: 'POST',
      headers,
      body: JSON.stringify(reqBody),
    });

    let result: any = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok || !result?.success) {
      const err = new Error(result?.error || `Pilot dispatch failed with HTTP status ${response.status}.`);
      if (result?.existingClaim) {
        (err as any).existingClaim = result.existingClaim;
      }
      if (result?.code) {
        (err as any).code = result.code;
      }
      if (result?.manualReviewReasons) {
        (err as any).manualReviewReasons = result.manualReviewReasons;
      }
      if (result?.geocoding) {
        (err as any).geocoding = result.geocoding;
      }
      throw err;
    }

    if (!result.planId) {
      throw new Error('Server returned success but omitted the Spoke plan ID. Verification failed.');
    }

    return result as SpokePilotDispatchResult;
  } catch (err: any) {
    console.error('[NEO Store] Spoke pilot dispatch error:', err);
    throw err;
  }
}

/**
 * Resolve and archive a stale pilot dispatch claim.
 */
export async function resolveStalePilotDispatchClaim(payload: {
  bookingId: string;
  pilotAuthorizationToken: string;
  reason?: string;
}): Promise<{ success: boolean; message: string; claimId: string; bookingId: string }> {
  const cleanBookingId = (payload.bookingId || '').trim();
  const cleanToken = (payload.pilotAuthorizationToken || '').trim();

  if (!cleanBookingId) throw new Error('Valid booking ID is required.');
  if (!cleanToken) throw new Error('Pilot authorization token is required.');

  const headers = await getAuthHeaders();
  const response = await fetch('/api/admin/dispatch/spoke/resolve-stale-claim', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      bookingId: cleanBookingId,
      pilotAuthorizationToken: cleanToken,
      reason: payload.reason,
    }),
  });

  let result: any = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok || !result?.success) {
    throw new Error(result?.error || `Claim resolution failed with HTTP status ${response.status}.`);
  }

  return result;
}


// ==============================================================================
// 13. STRIPE PAYMENTS INTEGRATION (CHECKOUT & VERIFICATION)
// ==============================================================================

export interface StripeCheckoutParams {
  bookingId: string;
  originPostcode: string;
  destinationPostcode: string;
  vehicle: string;
  customerEmail?: string;
  customerName?: string;
  companyId?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface StripeCheckoutResponse {
  success: boolean;
  sessionId?: string;
  checkoutUrl?: string;
  amountGbp?: number;
  amountPence?: number;
  bookingId?: string;
  quote?: any;
  error?: string;
}

export interface BookingPaymentStatusResponse {
  bookingId: string;
  paymentMethod: string;
  paymentStatus: string;
  logisticsStatus: string;
  totalGbp: number;
  amountPaidGbp: number;
  stripePaymentIntentId: string | null;
  isFullyPaid: boolean;
  payments?: any[];
  error?: string;
}

/**
 * Creates a server-authoritative Stripe Checkout Session via POST /api/payments/checkout-session.
 * Recalculates quote on the server using approved fleet tariffs and road miles.
 */
export async function createStripeCheckoutSession(
  params: StripeCheckoutParams
): Promise<StripeCheckoutResponse> {
  const cleanBookingId = (params.bookingId || '').trim();
  if (!cleanBookingId) {
    throw new Error('Valid bookingId is required to start Stripe Checkout.');
  }
  if (!params.originPostcode || !params.destinationPostcode) {
    throw new Error('Pickup and dropoff postcodes are required for quote calculation.');
  }
  if (!params.vehicle) {
    throw new Error('Vehicle class is required.');
  }

  const headers = await getAuthHeaders();

  try {
    const response = await fetch('/api/payments/checkout-session', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        bookingId: cleanBookingId,
        customerEmail: params.customerEmail,
        customerName: params.customerName,
        originPostcode: params.originPostcode,
        destinationPostcode: params.destinationPostcode,
        vehicle: params.vehicle,
        companyId: params.companyId,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
      }),
    });

    let result: any = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok || !result?.success) {
      throw new Error(result?.error || 'Checkout session creation failed with HTTP status ' + response.status + '.');
    }

    if (!result.checkoutUrl) {
      throw new Error('Server returned success but did not provide a Stripe Checkout URL.');
    }

    return result as StripeCheckoutResponse;
  } catch (err: any) {
    console.error('[NEO Store] Stripe checkout session creation error:', err);
    throw new Error(err?.message || 'Server endpoint for Stripe checkout session is unavailable.');
  }
}

/**
 * Queries the authoritative payment status for a booking via GET /api/payments/status/:bookingId.
 * Fails closed: only server-verified full payments return isFullyPaid: true.
 */
export async function getBookingPaymentStatus(
  bookingId: string
): Promise<BookingPaymentStatusResponse> {
  const cleanId = (bookingId || '').trim();
  if (!cleanId) {
    throw new Error('Valid bookingId is required to query payment status.');
  }

  const headers = await getAuthHeaders();

  try {
    const response = await fetch('/api/payments/status/' + encodeURIComponent(cleanId), {
      method: 'GET',
      headers,
    });

    let result: any = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok) {
      throw new Error(result?.error || 'Payment status query failed with HTTP status ' + response.status + '.');
    }

    return result as BookingPaymentStatusResponse;
  } catch (err: any) {
    console.error('[NEO Store] Get booking payment status error:', err);
    throw new Error(err?.message || 'Server endpoint for payment status verification is unavailable.');
  }
}

/**
 * Polls the payment status for a booking with exponential/interval backoff to allow Stripe webhook processing.
 * Returns immediately upon full payment or definitive failure.
 */
export async function pollBookingPaymentStatus(
  bookingId: string,
  maxAttempts: number = 6,
  intervalMs: number = 1500
): Promise<BookingPaymentStatusResponse> {
  let lastResult: BookingPaymentStatusResponse | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await getBookingPaymentStatus(bookingId);
      lastResult = res;

      // Stop polling early if terminal state reached
      if (res.isFullyPaid || res.paymentStatus === 'paid' || res.paymentStatus === 'failed' || res.paymentStatus === 'cancelled') {
        return res;
      }
    } catch (err: any) {
      console.warn('[Payment Status Polling] Attempt ' + attempt + '/' + maxAttempts + ' warning:', err?.message || err);
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  if (lastResult) {
    return lastResult;
  }

  throw new Error('Payment verification timed out after ' + maxAttempts + ' attempts for booking ' + bookingId + '.');
}

/**
 * Updates the booking payment status in local cache and Supabase (if configured).
 */
export async function updateBookingPaymentStatus(
  bookingId: string,
  paymentStatus: string,
  amountPaidGbp?: number,
  stripePaymentIntentId?: string | null
): Promise<Booking | null> {
  const current = readStorage<Booking[]>(STORAGE_BOOKINGS_KEY, getIsDemoModeAllowed() ? INITIAL_BOOKINGS : []);
  const cleanId = (bookingId || '').trim();
  const existingIdx = current.findIndex((b) => b.id === cleanId || b.reference === cleanId);

  let updatedBooking: Booking | null = null;
  if (existingIdx !== -1) {
    current[existingIdx] = {
      ...current[existingIdx],
      payment_status: paymentStatus,
      ...(typeof amountPaidGbp === 'number' ? { amount_paid_gbp: amountPaidGbp } : {}),
      ...(stripePaymentIntentId ? { stripe_payment_intent_id: stripePaymentIntentId } : {}),
    };
    updatedBooking = current[existingIdx];
    writeStorage(STORAGE_BOOKINGS_KEY, current);
  } else {
    const newEntry: Booking = {
      id: cleanId,
      reference: cleanId,
      date: 'Today',
      origin: '',
      destination: '',
      vehicle: '',
      total: typeof amountPaidGbp === 'number' ? amountPaidGbp : 0,
      status: 'SCHEDULED',
      payment_method: 'card',
      payment_status: paymentStatus,
      ...(typeof amountPaidGbp === 'number' ? { amount_paid_gbp: amountPaidGbp } : {}),
      ...(stripePaymentIntentId ? { stripe_payment_intent_id: stripePaymentIntentId } : {}),
    };
    current.unshift(newEntry);
    updatedBooking = newEntry;
    writeStorage(STORAGE_BOOKINGS_KEY, current);
  }

  const client = getActiveSupabase();
  if (checkIsSupabaseConfigured() && client) {
    try {
      const updates: Record<string, any> = {
        payment_status: paymentStatus,
      };
      if (typeof amountPaidGbp === 'number') {
        updates.amount_paid_gbp = amountPaidGbp;
      }
      if (stripePaymentIntentId) {
        updates.stripe_payment_intent_id = stripePaymentIntentId;
      }
      if (paymentStatus === 'paid' || paymentStatus === 'succeeded') {
        updates.paid_at = new Date().toISOString();
      }
      await client.from('bookings').update(updates).eq('id', cleanId);
    } catch (e) {
      console.warn('Failed to update booking payment status in Supabase:', e);
    }
  }

  notifyPortalSync();
  return updatedBooking;
}

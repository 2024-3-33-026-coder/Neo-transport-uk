import { Booking, Quote, Invoice, DocumentItem, BookingWizardState, SupportTicket } from '../types';
import { StandbyApplication } from './types';
import {
  INITIAL_BOOKINGS,
  INITIAL_QUOTES,
  INITIAL_INVOICES,
  INITIAL_DOCUMENTS,
} from '../data/mockData';
import { supabase, isSupabaseConfigured, DEFAULT_COMPANY } from './supabase';

// LocalStorage Keys
const STORAGE_BOOKINGS_KEY = 'neo_portal_bookings';
const STORAGE_QUOTES_KEY = 'neo_portal_quotes';
const STORAGE_INVOICES_KEY = 'neo_portal_invoices';
const STORAGE_DOCUMENTS_KEY = 'neo_portal_documents';
const STORAGE_TICKETS_KEY = 'neo_portal_tickets';
const STORAGE_ACTIVE_TRACKING_KEY = 'neo_portal_active_tracking_id';
const STORAGE_WIZARD_DRAFT_KEY = 'neo_portal_wizard_draft';
const STORAGE_APPLICATIONS_KEY = 'neo_standby_applications';

export function notifyPortalSync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('neo_portal_sync'));
  }
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

function readStorage<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultVal;
    return JSON.parse(raw);
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

// 1. Generate Next Sequential Booking Reference (e.g. NT-24818)
export function getNextBookingReference(existingBookings: Booking[]): string {
  let highestNum = 24817;
  for (const b of existingBookings) {
    const match = b.reference.match(/^NT-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > highestNum) {
        highestNum = num;
      }
    }
  }
  return `NT-${highestNum + 1}`;
}

// 2. Bookings Persistence
export function getStoredBookings(): Booking[] {
  return readStorage<Booking[]>(STORAGE_BOOKINGS_KEY, INITIAL_BOOKINGS);
}

export async function getPersistedBookings(): Promise<Booking[]> {
  const local = readStorage<Booking[]>(STORAGE_BOOKINGS_KEY, INITIAL_BOOKINGS);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: Booking[] = data.map((row) => ({
          id: row.id,
          reference: row.id,
          date: row.date_label || 'Today',
          origin: row.pickup,
          destination: row.dropoff,
          vehicle: row.vehicle,
          total: Number(row.total_gbp) || 248,
          status: row.status
            ? (row.status.toUpperCase() === 'IN TRANSIT'
                ? 'IN TRANSIT'
                : row.status.toUpperCase() === 'DELIVERED'
                ? 'DELIVERED'
                : row.status.toUpperCase() === 'CANCELLED'
                ? 'CANCELLED'
                : 'SCHEDULED')
            : 'IN TRANSIT',
          cargo: row.goods,
          weightKg: Number(row.weight_kg) || 0,
          palletCount: Number(row.items_count) || 1,
          pickupTime: row.collection_window,
          deliveryTime: row.eta_label,
          progress: typeof row.progress_t === 'number' ? row.progress_t : 0.45,
          driver: row.driver_name
            ? {
                name: row.driver_name,
                vehicleModel: row.driver_vehicle || row.vehicle,
                registration: row.driver_reg || 'GN71 XPO',
                phone: '07700 900821',
                status: 'ON THE MOVE',
              }
            : undefined,
        }));
        writeStorage(STORAGE_BOOKINGS_KEY, mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('Supabase bookings fetch failed, using local cache:', e);
    }
  }

  return local;
}

export async function persistBooking(
  newBooking: Booking,
  wizardState?: BookingWizardState,
  companyId?: string
): Promise<Booking> {
  const current = readStorage<Booking[]>(STORAGE_BOOKINGS_KEY, INITIAL_BOOKINGS);
  const updated = [newBooking, ...current.filter((b) => b.id !== newBooking.id && b.reference !== newBooking.reference)];
  writeStorage(STORAGE_BOOKINGS_KEY, updated);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('bookings').insert({
        id: newBooking.reference,
        company_id: companyId || DEFAULT_COMPANY.id,
        date_label: newBooking.date,
        pickup: newBooking.origin,
        pickup_contact: wizardState?.contactName || wizardState?.pickupContact || 'Warehouse desk',
        pickup_phone: wizardState?.contactPhone || wizardState?.pickupPhone || '0161 555 0134',
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
        payment_method: wizardState?.paymentMethod || 'standby-account',
        po_reference: wizardState?.poReference || '',
        eta_label: newBooking.deliveryTime || '88 min',
        status:
          newBooking.status === 'IN TRANSIT'
            ? 'In transit'
            : newBooking.status === 'DELIVERED'
            ? 'Delivered'
            : newBooking.status === 'CANCELLED'
            ? 'Cancelled'
            : 'Scheduled',
        driver_name: newBooking.driver?.name || 'Marek Kowalski',
        driver_vehicle: newBooking.driver?.vehicleModel || newBooking.vehicle,
        driver_reg: newBooking.driver?.registration || 'GN71 XPO',
        progress_t: typeof newBooking.progress === 'number' ? newBooking.progress : 0.1,
      });
    } catch (e) {
      console.warn('Supabase booking insert failed, saved to local cache:', e);
    }
  }

  notifyPortalSync();
  return newBooking;
}

export async function updateBooking(updatedBooking: Booking): Promise<Booking[]> {
  const current = readStorage<Booking[]>(STORAGE_BOOKINGS_KEY, INITIAL_BOOKINGS);
  const updated = current.map((b) => (b.id === updatedBooking.id || b.reference === updatedBooking.reference ? updatedBooking : b));
  writeStorage(STORAGE_BOOKINGS_KEY, updated);

  if (isSupabaseConfigured && supabase) {
    try {
      const updatePayload: Record<string, any> = {
        status:
          updatedBooking.status === 'IN TRANSIT'
            ? 'In transit'
            : updatedBooking.status === 'DELIVERED'
            ? 'Delivered'
            : updatedBooking.status === 'CANCELLED'
            ? 'Cancelled'
            : 'Scheduled',
        driver_name: updatedBooking.driver?.name,
        driver_vehicle: updatedBooking.driver?.vehicleModel || updatedBooking.vehicle,
        driver_reg: updatedBooking.driver?.registration,
        eta_label: updatedBooking.deliveryTime,
        vehicle: updatedBooking.vehicle,
        total_gbp: updatedBooking.total,
      };

      if (typeof updatedBooking.progress === 'number') {
        updatePayload.progress_t = updatedBooking.progress;
      }

      await supabase
        .from('bookings')
        .update(updatePayload)
        .eq('id', updatedBooking.reference);
    } catch (e) {
      console.warn('Supabase booking update failed, saved to local cache:', e);
    }
  }

  notifyPortalSync();
  return updated;
}

// 3. Quotes Persistence (Synchronous cache reader + Asynchronous Supabase fetch)
export function getStoredQuotes(): Quote[] {
  return readStorage<Quote[]>(STORAGE_QUOTES_KEY, INITIAL_QUOTES);
}

export function getPersistedQuotes(): Quote[] {
  return getStoredQuotes();
}

export async function fetchPersistedQuotes(): Promise<Quote[]> {
  const local = readStorage<Quote[]>(STORAGE_QUOTES_KEY, INITIAL_QUOTES);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: Quote[] = data.map((row) => ({
          id: row.id,
          reference: row.id,
          origin: row.pickup,
          destination: row.dropoff,
          vehicle: row.vehicle,
          serviceType: row.service,
          total: Number(row.price_gbp) || 240,
          expiresText: row.expires_label || 'EXPIRES IN 3 DAYS',
          isUrgent: row.status === 'urgent' || (row.expires_label || '').toLowerCase().includes('urgent'),
        }));
        writeStorage(STORAGE_QUOTES_KEY, mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('Supabase quotes fetch failed, using local cache:', e);
    }
  }

  return local;
}

export function persistQuotes(quotes: Quote[]): void {
  writeStorage(STORAGE_QUOTES_KEY, quotes);
  notifyPortalSync();
}

export async function addQuote(newQuote: Quote, companyId?: string): Promise<Quote[]> {
  const current = getStoredQuotes();
  const updated = [newQuote, ...current.filter((q) => q.id !== newQuote.id && q.reference !== newQuote.reference)];
  writeStorage(STORAGE_QUOTES_KEY, updated);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('quotes').insert({
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

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('quotes').delete().eq('id', quoteId);
    } catch (e) {
      console.warn('Supabase quote delete failed:', e);
    }
  }

  notifyPortalSync();
  return updated;
}

// 4. Invoices Persistence
export function getStoredInvoices(): Invoice[] {
  return readStorage<Invoice[]>(STORAGE_INVOICES_KEY, INITIAL_INVOICES);
}

export function getPersistedInvoices(): Invoice[] {
  return getStoredInvoices();
}

export async function fetchPersistedInvoices(): Promise<Invoice[]> {
  const local = readStorage<Invoice[]>(STORAGE_INVOICES_KEY, INITIAL_INVOICES);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: Invoice[] = data.map((row) => ({
          id: row.id,
          reference: row.id,
          date: row.date_label,
          period: row.period_label,
          amount: Number(row.amount_gbp) || 0,
          status: (row.status?.toUpperCase() as any) || 'PAID',
          pdf_url: row.pdf_url,
        }));
        writeStorage(STORAGE_INVOICES_KEY, mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('Supabase invoices fetch failed, using local cache:', e);
    }
  }

  return local;
}

export async function updateInvoiceStatus(invoiceId: string, status: 'PAID' | 'DUE' | 'OVERDUE'): Promise<Invoice[]> {
  const current = getStoredInvoices();
  const updated = current.map((inv) => (inv.id === invoiceId || inv.reference === invoiceId ? { ...inv, status } : inv));
  writeStorage(STORAGE_INVOICES_KEY, updated);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
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
export function getStoredDocuments(): DocumentItem[] {
  return readStorage<DocumentItem[]>(STORAGE_DOCUMENTS_KEY, INITIAL_DOCUMENTS);
}

export function getPersistedDocuments(): DocumentItem[] {
  return getStoredDocuments();
}

export async function fetchPersistedDocuments(): Promise<DocumentItem[]> {
  const local = readStorage<DocumentItem[]>(STORAGE_DOCUMENTS_KEY, INITIAL_DOCUMENTS);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: DocumentItem[] = data.map((row) => ({
          id: row.id,
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
        writeStorage(STORAGE_DOCUMENTS_KEY, mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('Supabase documents fetch failed, using local cache:', e);
    }
  }

  return local;
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
): Promise<{ storagePath: string; signedUrl?: string }> {
  const cid = companyId || DEFAULT_COMPANY.id;
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectPath = `${cid}/${Date.now()}_${sanitizedFileName}`;

  if (isSupabaseConfigured && supabase) {
    try {
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(objectPath, file, {
          upsert: true,
          contentType: file.type || 'application/pdf',
        });

      if (uploadError) {
        console.warn('Supabase storage upload error:', uploadError);
      } else {
        // Generate a 1-hour signed URL for private access
        const { data: signData } = await supabase.storage
          .from('documents')
          .createSignedUrl(objectPath, 3600);

        return {
          storagePath: objectPath,
          signedUrl: signData?.signedUrl,
        };
      }
    } catch (e) {
      console.warn('Storage upload exception:', e);
    }
  }

  // Local demo fallback: temporary preview
  return {
    storagePath: `demo/${sanitizedFileName}`,
    signedUrl: URL.createObjectURL(file),
  };
}

/**
 * Generate an authorized signed download URL for a document.
 */
export async function getDocumentDownloadUrl(pathOrUrl?: string): Promise<string | null> {
  if (!pathOrUrl) return null;

  // If already an absolute http URL or blob URL, return it
  if (pathOrUrl.startsWith('http') || pathOrUrl.startsWith('blob:')) {
    return pathOrUrl;
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(pathOrUrl, 300); // 5-minute signed link
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    } catch (e) {
      console.warn('Failed generating signed download URL:', e);
    }
  }

  return pathOrUrl;
}

export async function addDocument(newDoc: DocumentItem, companyId?: string): Promise<DocumentItem[]> {
  const current = getStoredDocuments();
  const updated = [newDoc, ...current.filter((d) => d.id !== newDoc.id)];
  writeStorage(STORAGE_DOCUMENTS_KEY, updated);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('documents').insert({
        id: newDoc.id,
        company_id: companyId || DEFAULT_COMPANY.id,
        booking_id: newDoc.title.includes('NT-') ? newDoc.title.match(/NT-\d+/)?.[0] : null,
        name: newDoc.title,
        type: newDoc.type,
        date_label: newDoc.date,
        file_url: newDoc.pdf_url || null,
      });
    } catch (e) {
      console.warn('Supabase document insert failed:', e);
    }
  }

  notifyPortalSync();
  return updated;
}

// 6. Support Tickets Persistence & Workflow
export function getStoredTickets(): SupportTicket[] {
  return readStorage<SupportTicket[]>(STORAGE_TICKETS_KEY, INITIAL_SUPPORT_TICKETS);
}

export async function getPersistedTickets(): Promise<SupportTicket[]> {
  const local = readStorage<SupportTicket[]>(STORAGE_TICKETS_KEY, INITIAL_SUPPORT_TICKETS);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped: SupportTicket[] = data.map((row) => ({
          id: row.id,
          company_id: row.company_id,
          topic: row.topic,
          message: row.message,
          status: row.status as any,
          date: new Date(row.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        }));
        writeStorage(STORAGE_TICKETS_KEY, mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('Supabase support tickets fetch failed, using local cache:', e);
    }
  }

  return local;
}

export async function addSupportTicket(
  ticket: { topic: string; message: string },
  companyId?: string
): Promise<SupportTicket[]> {
  const current = getStoredTickets();
  const newTicket: SupportTicket = {
    id: `SR-${Math.floor(8950 + Math.random() * 50)}`,
    company_id: companyId || DEFAULT_COMPANY.id,
    topic: ticket.topic,
    message: ticket.message,
    status: 'Open',
    date: 'Today',
  };

  const updated = [newTicket, ...current];
  writeStorage(STORAGE_TICKETS_KEY, updated);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('support_tickets').insert({
        id: newTicket.id,
        company_id: companyId || DEFAULT_COMPANY.id,
        topic: newTicket.topic,
        message: newTicket.message,
        status: 'Open',
      });
    } catch (e) {
      console.warn('Supabase support ticket insert failed:', e);
    }
  }

  notifyPortalSync();
  return updated;
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
  const local = readStorage<StandbyApplication[]>(STORAGE_APPLICATIONS_KEY, INITIAL_STANDBY_APPLICATIONS);
  if (!localStorage.getItem(STORAGE_APPLICATIONS_KEY)) {
    writeStorage(STORAGE_APPLICATIONS_KEY, INITIAL_STANDBY_APPLICATIONS);
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('standby_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        writeStorage(STORAGE_APPLICATIONS_KEY, data);
        return data;
      }
    } catch (e) {
      console.warn('Supabase applications fetch failed, using local cache:', e);
    }
  }

  return local;
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

  notifyPortalSync();
  return updated;
}

import { Booking, Quote, Invoice, DocumentItem, BookingWizardState } from '../types';
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
          status: row.status ? (row.status.toUpperCase() as any) : 'IN TRANSIT',
          cargo: row.goods,
          weightKg: Number(row.weight_kg) || 0,
          palletCount: Number(row.items_count) || 1,
          pickupTime: row.collection_window,
          deliveryTime: row.eta_label,
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

export async function persistBooking(newBooking: Booking, wizardState?: BookingWizardState): Promise<Booking> {
  const current = readStorage<Booking[]>(STORAGE_BOOKINGS_KEY, INITIAL_BOOKINGS);
  const updated = [newBooking, ...current.filter((b) => b.id !== newBooking.id && b.reference !== newBooking.reference)];
  writeStorage(STORAGE_BOOKINGS_KEY, updated);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('bookings').insert({
        id: newBooking.reference,
        company_id: DEFAULT_COMPANY.id,
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
        status: newBooking.status === 'IN TRANSIT' ? 'In transit' : 'Delivered',
        driver_name: newBooking.driver?.name || 'Marek Kowalski',
        driver_vehicle: newBooking.driver?.vehicleModel || newBooking.vehicle,
        driver_reg: newBooking.driver?.registration || 'GN71 XPO',
        progress_t: 0.1,
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
      await supabase
        .from('bookings')
        .update({
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
        })
        .eq('id', updatedBooking.reference);
    } catch (e) {
      console.warn('Supabase booking update failed, saved to local cache:', e);
    }
  }

  notifyPortalSync();
  return updated;
}

// 3. Quotes Persistence
export function getPersistedQuotes(): Quote[] {
  return readStorage<Quote[]>(STORAGE_QUOTES_KEY, INITIAL_QUOTES);
}

export function persistQuotes(quotes: Quote[]): void {
  writeStorage(STORAGE_QUOTES_KEY, quotes);
  notifyPortalSync();
}

export async function addQuote(newQuote: Quote): Promise<Quote[]> {
  const current = getPersistedQuotes();
  const updated = [newQuote, ...current.filter((q) => q.id !== newQuote.id && q.reference !== newQuote.reference)];
  writeStorage(STORAGE_QUOTES_KEY, updated);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('quotes').insert({
        id: newQuote.reference,
        company_id: DEFAULT_COMPANY.id,
        pickup: newQuote.origin,
        dropoff: newQuote.destination,
        route: `${newQuote.origin} → ${newQuote.destination}`,
        vehicle: newQuote.vehicle,
        service: newQuote.serviceType,
        price_gbp: newQuote.total,
        expires_label: newQuote.expiresText,
        status: 'active',
      });
    } catch (e) {
      console.warn('Supabase quote insert failed:', e);
    }
  }

  notifyPortalSync();
  return updated;
}

export async function deleteQuote(quoteId: string): Promise<Quote[]> {
  const current = getPersistedQuotes();
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
export function getPersistedInvoices(): Invoice[] {
  return readStorage<Invoice[]>(STORAGE_INVOICES_KEY, INITIAL_INVOICES);
}

export async function updateInvoiceStatus(invoiceId: string, status: 'PAID' | 'DUE' | 'OVERDUE'): Promise<Invoice[]> {
  const current = getPersistedInvoices();
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

// 5. Documents Persistence
export function getPersistedDocuments(): DocumentItem[] {
  return readStorage<DocumentItem[]>(STORAGE_DOCUMENTS_KEY, INITIAL_DOCUMENTS);
}

export function persistDocuments(docs: DocumentItem[]): void {
  writeStorage(STORAGE_DOCUMENTS_KEY, docs);
  notifyPortalSync();
}

export async function addDocument(newDoc: DocumentItem): Promise<DocumentItem[]> {
  const current = getPersistedDocuments();
  const updated = [newDoc, ...current.filter((d) => d.id !== newDoc.id)];
  writeStorage(STORAGE_DOCUMENTS_KEY, updated);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('documents').insert({
        id: newDoc.id,
        company_id: DEFAULT_COMPANY.id,
        booking_id: newDoc.title.includes('NT-') ? newDoc.title.match(/NT-\d+/)?.[0] : null,
        name: newDoc.title,
        type: newDoc.type,
        date_label: newDoc.date,
        file_url: 'https://storage.neotransport.co.uk/docs/' + newDoc.id,
      });
    } catch (e) {
      console.warn('Supabase document insert failed:', e);
    }
  }

  notifyPortalSync();
  return updated;
}

// 6. Active Tracking ID & Wizard Draft Persistence
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

// 7. Standby Applications Persistence
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

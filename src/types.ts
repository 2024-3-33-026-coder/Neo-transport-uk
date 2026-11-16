export type ViewMode = 
  | 'dashboard'
  | 'new-booking'
  | 'live-tracking'
  | 'booking-history'
  | 'quotes'
  | 'invoices'
  | 'documents'
  | 'support';

export interface Booking {
  id: string;
  company_id?: string;
  reference: string;
  date: string;
  origin: string;
  destination: string;
  vehicle: string;
  total: number;
  status: 'IN TRANSIT' | 'DELIVERED' | 'CANCELLED' | 'SCHEDULED';
  cargo?: string;
  weightKg?: number;
  palletCount?: number;
  pickupTime?: string;
  deliveryTime?: string;
  progress?: number;
  driver?: {
    name: string;
    vehicleModel: string;
    registration: string;
    phone: string;
    status: string;
  };
  pickup_tracking_url?: string;
  delivery_tracking_url?: string;
  payment_method?: string;
  payment_status?: string;
  amount_paid_gbp?: number;
  stripe_payment_intent_id?: string | null;
}

export interface Quote {
  id: string;
  company_id?: string;
  reference: string;
  origin: string;
  destination: string;
  vehicle: string;
  serviceType: string;
  total: number;
  expiresText: string;
  isUrgent?: boolean;
}

export interface Invoice {
  id: string;
  company_id?: string;
  reference: string;
  date: string;
  period: string;
  amount: number;
  status: 'PAID' | 'DUE' | 'OVERDUE';
  pdf_url?: string;
}

export interface DocumentItem {
  id: string;
  company_id?: string;
  title: string;
  type: string;
  date: string;
  category: 'pod' | 'cmr' | 'label' | 'invoice' | 'compliance';
  fileSize?: string;
  verified?: boolean;
  pdf_url?: string;
}

export interface ResolvedAddress {
  id: string;
  suggestion: string;
  formattedAddress: string;
  postcode: string;
  line_1: string;
  line_2?: string;
  line_3?: string;
  post_town: string;
  county?: string;
  country?: string;
  udprn?: number | string;
  uprn?: number | string;
  latitude: number | null;
  longitude: number | null;
}

export interface BookingWizardState {
  pickupPostcode: string;
  pickupAddressDetails?: ResolvedAddress | null;
  pickupContact: string;
  pickupPhone: string;
  contactName: string;
  contactPhone: string;
  collectionWindow: string;
  dropoffPostcode: string;
  dropoffAddressDetails?: ResolvedAddress | null;
  dropoffContact: string;
  dropoffPhone: string;
  recipientName: string;
  recipientPhone: string;
  deliveryWindow: string;
  deliveryInstructions: string;
  cargoDescription: string;
  cargoWeightKg: number;
  palletCount: number;
  itemsCount: number;
  cargoHazmat: boolean;
  selectedVehicle: string;
  selectedService: string;
  estimatedMiles: number;
  estimatedTotal: number;
  paymentMethod: string;
  poReference: string;
  poNumber: string;
  notes: string;
}

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  sender_id?: string;
  sender_name: string;
  sender_role: 'admin' | 'customer';
  message: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  company_id?: string;
  company_name?: string;
  topic: string;
  message: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  date: string;
  created_at?: string;
  messages?: SupportTicketMessage[];
}

export type { AdminAuditLog, ProfileWithCompany, CompanyDetails, Profile } from './lib/types';

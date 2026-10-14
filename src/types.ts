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
}

export interface Quote {
  id: string;
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
  reference: string;
  date: string;
  period: string;
  amount: number;
  status: 'PAID' | 'DUE' | 'OVERDUE';
  pdf_url?: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  type: string;
  date: string;
  category: 'pod' | 'cmr' | 'label' | 'invoice' | 'compliance';
  fileSize?: string;
  verified?: boolean;
  pdf_url?: string;
}

export interface BookingWizardState {
  pickupPostcode: string;
  pickupContact: string;
  pickupPhone: string;
  contactName: string;
  contactPhone: string;
  collectionWindow: string;
  dropoffPostcode: string;
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

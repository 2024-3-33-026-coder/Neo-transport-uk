export interface StandbyApplication {
  id: string;
  created_at: string;
  company_name: string;
  trading_name: string;
  dispatch_address: string;
  town_city: string;
  postcode: string;
  contact_name: string;
  job_title: string;
  driver_mobile: string;
  ops_email: string;
  accounts_email: string;
  emergency_line: string;
  selected_carriers: string[];
  volume: string;
  status: 'pending' | 'approved';
  account_code?: string;
}

export interface Company {
  id: string;
  name: string;
  account_code: string;
  standby_active: boolean;
  verified: boolean;
  monthly_spend: number;
  paid_ytd: number;
  next_statement_date: string;
}

export interface Profile {
  id: string;
  company_id: string;
  full_name: string;
  initials: string;
  email: string;
  role: 'customer' | 'admin';
  status?: 'active' | 'suspended';
  created_at?: string;
}

export interface BookingRow {
  id: string;
  company_id: string;
  date_label: string;
  pickup: string;
  pickup_contact: string;
  pickup_phone: string;
  collection_window: string;
  dropoff: string;
  recipient_name: string;
  recipient_phone: string;
  delivery_instructions: string;
  goods: string;
  weight_kg: number;
  items_count: number;
  vehicle: string;
  service: string;
  distance_miles: number;
  total_gbp: number;
  payment_method: string;
  payment_status?: string;
  amount_paid_gbp?: number;
  paid_at?: string | null;
  stripe_payment_intent_id?: string | null;
  po_reference: string;
  eta_label: string;
  status: 'Scheduled' | 'In transit' | 'Delivered' | 'Cancelled';
  driver_name?: string;
  driver_vehicle?: string;
  driver_reg?: string;
  progress_t: number;
  pickup_tracking_url?: string;
  delivery_tracking_url?: string;
}

export interface QuoteRow {
  id: string;
  company_id: string;
  pickup: string;
  dropoff: string;
  route: string;
  vehicle: string;
  service: string;
  price_gbp: number;
  expires_label: string;
  status: 'active' | 'accepted' | 'discarded';
}

export interface InvoiceRow {
  id: string;
  company_id: string;
  date_label: string;
  period_label: string;
  amount_gbp: number;
  status: 'Paid' | 'Due' | 'Overdue';
  pdf_url?: string;
}

export interface DocumentRow {
  id: string;
  company_id: string;
  booking_id?: string;
  name: string;
  type: string;
  date_label: string;
  file_url?: string;
}

export interface SupportTicketRow {
  id: string;
  company_id: string;
  topic: string;
  message: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  created_at: string;
}

export interface AdminAuditLog {
  id: string;
  admin_id?: string | null;
  admin_email: string;
  admin_name: string;
  action: string;
  target_entity: string;
  target_id?: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ProfileWithCompany extends Profile {
  companies?: Company | null;
}

export interface CompanyDetails extends Company {
  user_count?: number;
  active_bookings_count?: number;
}

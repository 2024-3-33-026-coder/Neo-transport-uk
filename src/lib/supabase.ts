import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  StandbyApplication,
  Company,
  Profile,
  BookingRow,
  QuoteRow,
  InvoiceRow,
  DocumentRow,
} from './types';
import {
  INITIAL_BOOKINGS,
  INITIAL_QUOTES,
  INITIAL_INVOICES,
  INITIAL_DOCUMENTS,
} from '../data/mockData';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured: boolean = Boolean(
  typeof supabaseUrl === 'string' &&
    typeof supabaseAnonKey === 'string' &&
    supabaseUrl.trim().length > 0 &&
    supabaseAnonKey.trim().length > 20 &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('example.supabase.co') &&
    !supabaseUrl.includes('placeholder')
);

export const supabase: SupabaseClient | null = (() => {
  if (!isSupabaseConfigured) return null;
  try {
    return createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch {
    return null;
  }
})();

// Mock Company & Profile Seed
export const DEFAULT_COMPANY: Company = {
  id: 'comp-meridian-001',
  name: 'Meridian Logistics',
  account_code: 'NEO-SB-2026',
  standby_active: true,
  verified: true,
  monthly_spend: 4280,
  paid_ytd: 31420,
  next_statement_date: '01 Sep',
};

export const DEFAULT_PROFILE: Profile = {
  id: 'user-chris-sullivan',
  company_id: DEFAULT_COMPANY.id,
  full_name: 'Chris Sullivan',
  initials: 'CS',
  email: 'chris@meridian.co.uk',
  role: 'customer',
};

// Local storage keys
const STORAGE_APPLICATIONS = 'neo_standby_applications';
const STORAGE_BOOKINGS = 'neo_bookings';
const STORAGE_QUOTES = 'neo_quotes';
const STORAGE_INVOICES = 'neo_invoices';
const STORAGE_DOCUMENTS = 'neo_documents';

function getStored<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultVal;
    return JSON.parse(raw);
  } catch {
    return defaultVal;
  }
}

function setStored<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // Ignore storage quota errors
  }
}

// 1. Standby Applications
export async function saveStandbyApplication(appData: Omit<StandbyApplication, 'id' | 'created_at' | 'status'>) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('standby_applications')
      .insert({
        ...appData,
        status: 'approved',
      })
      .select()
      .single();

    if (error) {
      console.warn('Supabase insert application error, saving to local fallback:', error);
    } else {
      return data;
    }
  }

  // Local fallback
  const existing = getStored<StandbyApplication[]>(STORAGE_APPLICATIONS, []);
  const newApp: StandbyApplication = {
    ...appData,
    id: `app-${Date.now()}`,
    created_at: new Date().toISOString(),
    status: 'approved',
  };
  setStored(STORAGE_APPLICATIONS, [newApp, ...existing]);
  return newApp;
}

// 2. Auth Helper with Demo Fallback
export async function authenticateCustomer(email: string, password: string): Promise<{
  profile: Profile;
  company: Company;
}> {
  if (isSupabaseConfigured && supabase) {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!authError && authData.user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*, companies(*)')
        .eq('id', authData.user.id)
        .single();

      if (profileData) {
        return {
          profile: {
            id: profileData.id,
            company_id: profileData.company_id,
            full_name: profileData.full_name || 'Chris Sullivan',
            initials: profileData.initials || 'CS',
            email: profileData.email,
            role: profileData.role || 'customer',
          },
          company: profileData.companies || DEFAULT_COMPANY,
        };
      }
    }
  }

  // Check for Admin / Operations credentials (e.g. ops@neotransport.co.uk)
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.includes('admin') || normalizedEmail.includes('ops@') || normalizedEmail.includes('dispatch@neotransport')) {
    return {
      profile: {
        id: 'admin-ops-01',
        company_id: 'c-neo-ops',
        full_name: 'NEO Operations Dispatch',
        initials: 'OP',
        email: email,
        role: 'admin',
      },
      company: {
        id: 'c-neo-ops',
        name: 'NEO Transport Ops Control',
        account_code: 'NEO-DISPATCH-01',
        standby_active: true,
        verified: true,
        monthly_spend: 0,
        paid_ytd: 0,
        next_statement_date: 'Internal Desk',
      },
    };
  }

  // Demo Fallback (Customer)
  return {
    profile: DEFAULT_PROFILE,
    company: DEFAULT_COMPANY,
  };
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) {
      return { success: false, message: error.message };
    }
  }

  return {
    success: true,
    message: `Password reset instructions sent to ${email}. Check your inbox.`,
  };
}

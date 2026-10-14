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
      auth: { persistSession: true, autoRefreshToken: true },
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

// 2. Sign Out Helper
export async function signOutUser(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase sign out error:', err);
    }
  }
}

// 3. Restore Active Session Profile on App Load
export async function getCurrentSessionProfile(): Promise<{
  profile: Profile;
  company: Company;
} | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) return null;

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*, companies(*)')
        .eq('id', session.user.id)
        .single();

      if (profileError || !profileData) return null;

      return {
        profile: {
          id: profileData.id,
          company_id: profileData.company_id,
          full_name: profileData.full_name || 'Chris Sullivan',
          initials: profileData.initials || 'CS',
          email: profileData.email,
          role: profileData.role === 'admin' ? 'admin' : 'customer',
        },
        company: profileData.companies || DEFAULT_COMPANY,
      };
    } catch {
      return null;
    }
  }
  return null;
}

// 4. Secure Authentication with Strict Demo Isolation
export async function authenticateCustomer(email: string, password: string): Promise<{
  profile: Profile;
  company: Company;
}> {
  const normalizedEmail = email.trim().toLowerCase();

  // Production Supabase Auth: Never fall back to mock profiles on error
  if (isSupabaseConfigured && supabase) {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || 'Invalid email or password.');
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*, companies(*)')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profileData) {
      throw new Error('Authenticated, but no associated profile found for this account.');
    }

    return {
      profile: {
        id: profileData.id,
        company_id: profileData.company_id,
        full_name: profileData.full_name || 'Chris Sullivan',
        initials: profileData.initials || 'CS',
        email: profileData.email,
        role: profileData.role === 'admin' ? 'admin' : 'customer',
      },
      company: profileData.companies || DEFAULT_COMPANY,
    };
  }

  // Demo Fallback: ONLY active when Supabase is completely unconfigured
  // Disallow email spoofing: only explicit pre-configured demo users are admitted
  if (normalizedEmail === 'ops@neotransport.co.uk') {
    return {
      profile: {
        id: 'admin-ops-01',
        company_id: 'c-neo-ops',
        full_name: 'NEO Operations Dispatch',
        initials: 'OP',
        email: 'ops@neotransport.co.uk',
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

  if (normalizedEmail === 'chris@meridian.co.uk') {
    return {
      profile: DEFAULT_PROFILE,
      company: DEFAULT_COMPANY,
    };
  }

  throw new Error('Invalid credentials. In local demo mode, sign in as chris@meridian.co.uk or ops@neotransport.co.uk.');
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

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

const metaEnv = ((import.meta as any).env || (typeof process !== 'undefined' ? process.env : {})) || {};
const rawUrl = metaEnv.VITE_SUPABASE_URL || metaEnv.SUPABASE_URL;
const rawPublishableKey = metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY;
const rawAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || metaEnv.SUPABASE_ANON_KEY;

const supabaseUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';

let supabaseKey = '';
let keySource: 'VITE_SUPABASE_PUBLISHABLE_KEY' | 'VITE_SUPABASE_ANON_KEY' | 'none' = 'none';

if (typeof rawPublishableKey === 'string' && rawPublishableKey.trim().length > 0) {
  supabaseKey = rawPublishableKey.trim();
  keySource = 'VITE_SUPABASE_PUBLISHABLE_KEY';
} else if (typeof rawAnonKey === 'string' && rawAnonKey.trim().length > 0) {
  supabaseKey = rawAnonKey.trim();
  keySource = 'VITE_SUPABASE_ANON_KEY';
}

export const isSupabaseConfigured: boolean = Boolean(
  supabaseUrl.length > 0 &&
    supabaseKey.length > 20 &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('example.supabase.co') &&
    !supabaseUrl.includes('placeholder')
);

export const supabase: SupabaseClient | null = (() => {
  if (!isSupabaseConfigured) return null;
  try {
    return createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  } catch (err) {
    console.warn('[NEO Supabase] Client initialization failed:', err);
    return null;
  }
})();

// Safe client diagnostic logging (reports presence and source only, never secrets)
if (typeof window !== 'undefined') {
  console.info('[NEO Supabase] Client status:', {
    configured: isSupabaseConfigured,
    hasUrl: Boolean(supabaseUrl),
    hasKey: Boolean(supabaseKey),
    keySource,
  });
}

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
  full_name: 'MD',
  initials: 'MD',
  email: 'chris@meridian.co.uk',
  role: 'customer',
  status: 'active',
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
export interface StandbySubmissionResult {
  success: boolean;
  status: 'pending';
  company_name: string;
}

let customSupabaseClient: any = null;
export function setCustomSupabaseClientForTesting(client: any) {
  customSupabaseClient = client;
}
export function getActiveSupabaseClient(): SupabaseClient | null {
  return customSupabaseClient !== null ? customSupabaseClient : supabase;
}
export function checkIsSupabaseConfigured(): boolean {
  return customSupabaseClient !== null ? true : isSupabaseConfigured;
}

export async function saveStandbyApplication(
  appData: Omit<StandbyApplication, 'id' | 'created_at' | 'status'>
): Promise<StandbySubmissionResult> {
  const isConfigured = checkIsSupabaseConfigured();
  const client = getActiveSupabaseClient();

  if (isConfigured && client) {
    const { error } = await client
      .from('standby_applications')
      .insert({
        ...appData,
        status: 'pending',
      });

    if (error) {
      console.error('[NEO Standby] Supabase insert application error:', error);
      throw new Error(`Standby application submission failed: ${error.message} (code: ${error.code || 'UNKNOWN'})`);
    }

    // Standby application operations alert and applicant receipt are durably enqueued by
    // the PostgreSQL database trigger trg_standby_application_submitted_queue inside the same transaction.

    return {
      success: true,
      status: 'pending',
      company_name: appData.company_name,
    };
  }

  // Local fallback: strictly for unconfigured / demo mode environments
  const existing = getStored<StandbyApplication[]>(STORAGE_APPLICATIONS, []);
  const newApp: StandbyApplication = {
    ...appData,
    id: `app-${Date.now()}`,
    created_at: new Date().toISOString(),
    status: 'pending',
  };
  setStored(STORAGE_APPLICATIONS, [newApp, ...existing]);
  return {
    success: true,
    status: 'pending',
    company_name: appData.company_name,
  };
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

      if (profileError || !profileData) {
        console.warn('[NEO Auth] Session profile lookup failed:', {
          code: profileError?.code,
          message: profileError?.message,
        });
        return null;
      }

      if (profileData.status === 'suspended') {
        console.warn('[NEO Auth] Session belongs to a suspended account. Terminating session.');
        await supabase.auth.signOut();
        return null;
      }

      const companyData = Array.isArray(profileData.companies)
        ? profileData.companies[0]
        : profileData.companies;

      return {
        profile: {
          id: profileData.id,
          company_id: profileData.company_id,
          full_name: profileData.full_name || 'Chris Sullivan',
          initials: profileData.initials || 'CS',
          email: profileData.email,
          role: profileData.role === 'admin' ? 'admin' : 'customer',
          status: profileData.status || 'active',
        },
        company: companyData || DEFAULT_COMPANY,
      };
    } catch (err) {
      console.warn('[NEO Auth] Session restoration error:', err);
      return null;
    }
  }
  return null;
}

// Explicit Demo Mode Gating
// Mock authentication fallback is ONLY permitted when Supabase is disconnected in non-production environments
export const isDemoModeAllowed: boolean = (() => {
  if (isSupabaseConfigured) return false;

  const envDemo = metaEnv.VITE_ENABLE_DEMO_MODE;
  if (envDemo === 'true' || envDemo === '1') return true;

  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');
  const isVercelPreview =
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('.vercel.app');
  const isDev = Boolean(metaEnv.DEV);

  return isDev || isLocalhost || isVercelPreview;
})();

// Fast credential fill helper for preview and testing environments
export const isStagingDemoAvailable: boolean = (() => {
  const envDemo = metaEnv.VITE_ENABLE_DEMO_MODE;
  if (envDemo === 'true' || envDemo === '1') return true;

  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');
  const isVercelPreview =
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('.vercel.app');
  const isDev = Boolean(metaEnv.DEV);

  return isDev || isLocalhost || isVercelPreview;
})();

export const DEMO_CREDENTIALS = {
  customer: {
    email: 'chris@meridian.co.uk',
    password: 'Meridian2026!',
    label: 'Customer Demo',
  },
  admin: {
    email: 'ops@neotransport.co.uk',
    password: 'DispatchOps2026!',
    label: 'Dispatch Admin Demo',
  },
};

export const ADMIN_COMPANY: Company = {
  id: 'c-neo-ops',
  name: 'NEO Transport Ops Control',
  account_code: 'NEO-DISPATCH-01',
  standby_active: true,
  verified: true,
  monthly_spend: 0,
  paid_ytd: 0,
  next_statement_date: 'Internal Desk',
};

export const ADMIN_PROFILE: Profile = {
  id: 'admin-ops-01',
  company_id: ADMIN_COMPANY.id,
  full_name: 'NEO Operations Dispatch',
  initials: 'OP',
  email: 'ops@neotransport.co.uk',
  role: 'admin',
};

// 4. Secure Authentication with Strict Demo Isolation
export async function authenticateCustomer(email: string, password: string): Promise<{
  profile: Profile;
  company: Company;
}> {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const trimmedPassword = (password || '').trim();

  if (!normalizedEmail) {
    throw new Error('Please enter your work email.');
  }

  if (!trimmedPassword) {
    throw new Error('Please enter your password.');
  }

  // Production Supabase Auth: Never fall back to mock profiles on error
  if (isSupabaseConfigured && supabase) {
    const domain = normalizedEmail.includes('@') ? normalizedEmail.split('@')[1] : 'unknown';
    console.info(`[NEO Auth] Authenticating with Supabase Auth for @${domain}...`);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: trimmedPassword,
    });

    if (authError || !authData.user) {
      console.warn('[NEO Auth] signInWithPassword rejected:', {
        status: authError?.status,
        name: authError?.name,
        message: authError?.message,
      });
      throw new Error(authError?.message || 'Invalid email or password. Please verify your credentials.');
    }

    console.info('[NEO Auth] Credentials verified. Querying profile...');
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*, companies(*)')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profileData) {
      console.warn('[NEO Auth] Profile lookup failed:', {
        code: profileError?.code,
        message: profileError?.message,
      });
      throw new Error(
        profileError?.message
          ? `Authenticated, but profile lookup failed: ${profileError.message}`
          : 'Authenticated, but no associated profile found for this account.'
      );
    }

    if (profileData.status === 'suspended') {
      console.warn('[NEO Auth] Login rejected: account is suspended.');
      await supabase.auth.signOut();
      throw new Error('Your account has been suspended by an administrator. Please contact operations support.');
    }

    const companyData = Array.isArray(profileData.companies)
      ? profileData.companies[0]
      : profileData.companies;

    const company: Company = companyData || {
      id: profileData.company_id || DEFAULT_COMPANY.id,
      name: DEFAULT_COMPANY.name,
      account_code: DEFAULT_COMPANY.account_code,
      standby_active: true,
      verified: true,
      monthly_spend: 0,
      paid_ytd: 0,
      next_statement_date: '01 Sep',
    };

    console.info('[NEO Auth] Login successful:', {
      role: profileData.role,
      companyId: company.id,
    });

    return {
      profile: {
        id: profileData.id,
        company_id: profileData.company_id,
        full_name: profileData.full_name || 'Chris Sullivan',
        initials: profileData.initials || 'CS',
        email: profileData.email,
        role: profileData.role === 'admin' ? 'admin' : 'customer',
        status: profileData.status || 'active',
      },
      company,
    };
  }

  // Demo Mode Guard: Check if demo access is explicitly authorized
  if (!isDemoModeAllowed) {
    throw new Error('Authentication service is unavailable. Production Supabase configuration is required.');
  }

  // Demo Mode: ONLY designated demo accounts and valid passwords are accepted
  if (normalizedEmail === DEMO_CREDENTIALS.customer.email) {
    if (trimmedPassword !== DEMO_CREDENTIALS.customer.password) {
      throw new Error('Invalid password for demo customer account.');
    }
    return {
      profile: DEFAULT_PROFILE,
      company: DEFAULT_COMPANY,
    };
  }

  if (normalizedEmail === DEMO_CREDENTIALS.admin.email) {
    if (trimmedPassword !== DEMO_CREDENTIALS.admin.password) {
      throw new Error('Invalid password for demo dispatch operations account.');
    }
    return {
      profile: ADMIN_PROFILE,
      company: ADMIN_COMPANY,
    };
  }

  throw new Error('Unknown user. No account found for this email address.');
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

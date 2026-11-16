import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/views/DashboardView';
import { NewBookingView, BookingWizard } from './components/views/NewBookingView';
import { LiveTrackingView } from './components/views/LiveTrackingView';
import { BookingHistoryView } from './components/views/BookingHistoryView';
import { QuotesView } from './components/views/QuotesView';
import { InvoicesView } from './components/views/InvoicesView';
import { DocumentsView } from './components/views/DocumentsView';
import { SupportView } from './components/views/SupportView';
import { MobileBottomNav } from './components/ui/MobileBottomNav';
import {
  INITIAL_BOOKINGS,
  INITIAL_QUOTES,
  INITIAL_INVOICES,
  INITIAL_DOCUMENTS,
} from './data/mockData';
import { ViewMode, Booking, Quote, DocumentItem, BookingWizardState, Invoice } from './types';
import {
  InAppNotification,
  getStoredBookings,
  getPersistedBookings,
  persistBooking,
  getStoredFailedBookingDraft,
  clearFailedBookingDraft,
  getStoredQuotes,
  getPersistedQuotes,
  fetchPersistedQuotes,
  persistQuotes,
  addQuote,
  getStoredInvoices,
  getPersistedInvoices,
  fetchPersistedInvoices,
  getStoredDocuments,
  getPersistedDocuments,
  fetchPersistedDocuments,
  addDocument,
  persistDocuments,
  getPersistedActiveTrackingId,
  persistActiveTrackingId,
  getPersistedWizardDraft,
  persistWizardDraft,
  deleteQuote,
  INITIAL_WIZARD_DRAFT,
  mapBookingRowToBooking,
  syncRealtimeBookingUpdate,
} from './lib/portalStore';
import { AdminPortal } from './AdminPortal';
import {
  ArrowRight,
  Sun,
  Moon,
  LayoutGrid,
  Plus,
  MapPin,
  Clock,
  List,
  Receipt,
  FileText,
  Headphones,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  supabase,
  authenticateCustomer,
  requestPasswordReset,
  signOutUser,
  getCurrentSessionProfile,
  isSupabaseConfigured,
  isDemoModeAllowed,
  isStagingDemoAvailable,
  DEMO_CREDENTIALS,
  DEFAULT_PROFILE,
  DEFAULT_COMPANY,
} from './lib/supabase';

export type PageKey = 
  | 'dashboard'
  | 'new-booking'
  | 'live-tracking'
  | 'booking-history'
  | 'quotes'
  | 'invoices'
  | 'documents'
  | 'support';

export const NAV: Array<{ id: PageKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'new-booking', label: 'New Booking', icon: Plus },
  { id: 'live-tracking', label: 'Live Tracking', icon: MapPin },
  { id: 'booking-history', label: 'Booking History', icon: Clock },
  { id: 'quotes', label: 'Quotes', icon: List },
  { id: 'invoices', label: 'Invoices', icon: Receipt },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'support', label: 'Support', icon: Headphones },
];

interface PortalProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onBackToLanding: () => void;
  initialLoggedIn?: boolean;
}

export const Portal: React.FC<PortalProps> = ({
  isDarkMode,
  onToggleTheme,
  onBackToLanding,
  initialLoggedIn = false,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(initialLoggedIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Authenticated user's profile state
  const [userProfile, setUserProfile] = useState<{
    id?: string;
    company_id?: string;
    full_name: string;
    initials: string;
    companyName: string;
    role: 'customer' | 'admin';
  }>({
    id: DEFAULT_PROFILE.id,
    company_id: DEFAULT_COMPANY.id,
    full_name: DEFAULT_PROFILE.full_name,
    initials: DEFAULT_PROFILE.initials,
    companyName: DEFAULT_COMPANY.name,
    role: DEFAULT_PROFILE.role,
  });

  const [portalMode, setPortalMode] = useState<'customer' | 'admin'>('customer');
  const [currentView, setCurrentView] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('payment') || params.get('bookingId')) {
        return 'new-booking';
      }
    }
    return 'dashboard';
  });
  const [bookings, setBookings] = useState<Booking[]>(() => getStoredBookings());
  const [quotes, setQuotes] = useState<Quote[]>(() => getStoredQuotes());
  const [invoices, setInvoices] = useState<Invoice[]>(() => getStoredInvoices());
  const [documents, setDocuments] = useState<DocumentItem[]>(() => getStoredDocuments());
  const [activeTrackingBookingId, setActiveTrackingBookingId] = useState<string>(() => getPersistedActiveTrackingId());
  const [wizardState, setWizardState] = useState<BookingWizardState>(() => getPersistedWizardDraft());
  const [bookingPersistenceError, setBookingPersistenceError] = useState<string | null>(null);
  const [podHighlightRef, setPodHighlightRef] = useState<string | undefined>(undefined);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Check for active Supabase session on initial load
  useEffect(() => {
    if (isSupabaseConfigured) {
      getCurrentSessionProfile().then((sessionData) => {
        if (sessionData) {
          setUserProfile({
            id: sessionData.profile.id,
            company_id: sessionData.profile.company_id,
            full_name: sessionData.profile.full_name,
            initials: sessionData.profile.initials,
            companyName: sessionData.company.name,
            role: sessionData.profile.role,
          });
          setIsAuthenticated(true);
          if (sessionData.profile.role === 'admin') {
            setPortalMode('admin');
          }
        }
      });
    }
  }, []);

  // Guard against unauthorized client-side state manipulation to admin mode
  useEffect(() => {
    if (portalMode === 'admin' && userProfile.role !== 'admin') {
      setPortalMode('customer');
    }
  }, [portalMode, userProfile.role]);

  // Sync bookings, quotes, invoices, and documents from Supabase & listen for cross-portal sync
  useEffect(() => {
    const targetCompId = portalMode === 'admin' ? undefined : userProfile.company_id;
    getPersistedBookings(targetCompId).then((fetched) => {
      if (fetched) {
        setBookings(fetched);
      }
    });
    fetchPersistedQuotes(targetCompId).then((q) => {
      if (q) setQuotes(q);
    });
    fetchPersistedInvoices(targetCompId).then((inv) => {
      if (inv) setInvoices(inv);
    });
    fetchPersistedDocuments(targetCompId).then((docs) => {
      if (docs) setDocuments(docs);
    });

    const handleSync = () => {
      const compId = portalMode === 'admin' ? undefined : userProfile.company_id;
      getPersistedBookings(compId).then((fetched) => {
        if (fetched) setBookings(fetched);
      });
      fetchPersistedQuotes(compId).then((q) => {
        if (q) setQuotes(q);
      });
      fetchPersistedInvoices(compId).then((inv) => {
        if (inv) setInvoices(inv);
      });
      fetchPersistedDocuments(compId).then((docs) => {
        if (docs) setDocuments(docs);
      });
    };

    window.addEventListener('neo_portal_sync', handleSync);
    return () => {
      window.removeEventListener('neo_portal_sync', handleSync);
    };
  }, [isAuthenticated, userProfile.company_id, portalMode]);

  // Scope data strictly to current user's company (unless Admin)
  const scopedBookings = useMemo(() => {
    if (portalMode === 'admin') return bookings;
    const compId = userProfile.company_id;
    if (!compId) return [];
    if (compId === DEFAULT_COMPANY.id) {
      return bookings.filter((b) => !b.company_id || b.company_id === DEFAULT_COMPANY.id);
    }
    return bookings.filter((b) => b.company_id === compId);
  }, [bookings, portalMode, userProfile.company_id]);

  const scopedQuotes = useMemo(() => {
    if (portalMode === 'admin') return quotes;
    const compId = userProfile.company_id;
    if (!compId) return [];
    if (compId === DEFAULT_COMPANY.id) {
      return quotes.filter((q) => !q.company_id || q.company_id === DEFAULT_COMPANY.id);
    }
    return quotes.filter((q) => q.company_id === compId);
  }, [quotes, portalMode, userProfile.company_id]);

  const scopedInvoices = useMemo(() => {
    if (portalMode === 'admin') return invoices;
    const compId = userProfile.company_id;
    if (!compId) return [];
    if (compId === DEFAULT_COMPANY.id) {
      return invoices.filter((i) => !i.company_id || i.company_id === DEFAULT_COMPANY.id);
    }
    return invoices.filter((i) => i.company_id === compId);
  }, [invoices, portalMode, userProfile.company_id]);

  const scopedDocuments = useMemo(() => {
    if (portalMode === 'admin') return documents;
    const compId = userProfile.company_id;
    if (!compId) return [];
    if (compId === DEFAULT_COMPANY.id) {
      return documents.filter((d) => !d.company_id || d.company_id === DEFAULT_COMPANY.id);
    }
    return documents.filter((d) => d.company_id === compId);
  }, [documents, portalMode, userProfile.company_id]);

  // Handle Login with Supabase / Fallback
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setResetStatus(null);
    setLoginLoading(true);

    try {
      const authResult = await authenticateCustomer(email, password);
      setUserProfile({
        id: authResult.profile.id,
        company_id: authResult.profile.company_id,
        full_name: authResult.profile.full_name,
        initials: authResult.profile.initials,
        companyName: authResult.company.name,
        role: authResult.profile.role,
      });
      setIsAuthenticated(true);
      if (authResult.profile.role === 'admin') {
        setPortalMode('admin');
      } else {
        setPortalMode('customer');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please verify your work email.';
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  // Wire Forgot Password
  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!email) {
      setLoginError('Please enter your work email to receive password reset instructions.');
      return;
    }

    setIsResetting(true);
    try {
      const res = await requestPasswordReset(email);
      setResetStatus(res.message);
    } catch {
      setResetStatus(`Password reset instructions sent to ${email}. Check your inbox.`);
    } finally {
      setIsResetting(false);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    await signOutUser();
    setIsAuthenticated(false);
    setPortalMode('customer');
    setBookings([]);
    setQuotes([]);
    setInvoices([]);
    setDocuments([]);
  };

  // Update wizard state with persistence
  const handleUpdateWizardState = (updated: BookingWizardState) => {
    setWizardState(updated);
    persistWizardDraft(updated);
  };

  // Rebooking flow: populates wizardDraft with that booking's pickup, dropoff, vehicle, and goods/cargo
  const handleRebook = (booking: Booking) => {
    const updatedDraft: BookingWizardState = {
      ...wizardState,
      pickupPostcode: booking.origin,
      dropoffPostcode: booking.destination,
      selectedVehicle: booking.vehicle,
      cargoDescription: booking.cargo || 'Palletised parts · 650 kg',
      cargoWeightKg: booking.weightKg || 650,
      palletCount: booking.palletCount || 2,
      itemsCount: booking.palletCount || 2,
      estimatedTotal: booking.total,
    };
    handleUpdateWizardState(updatedDraft);
    setCurrentView('new-booking');
  };

  // New Booking Created: real persistence to Supabase and local cache
  const handleBookingCreated = async (newBooking: Booking, finalWizardState?: BookingWizardState): Promise<Booking> => {
    const draft = finalWizardState || wizardState;
    setBookingPersistenceError(null);
    try {
      const saved = await persistBooking(newBooking, draft, userProfile.company_id);
      setBookings((prev) => [saved, ...prev.filter((b) => b.id !== saved.id && b.reference !== saved.reference)]);
      setActiveTrackingBookingId(saved.id);
      persistActiveTrackingId(saved.id);
      setBookingPersistenceError(null);
      return saved;
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err || 'Failed to save booking to dispatch database');
      console.error('[NEO Portal] Booking persistence failed:', errorMsg);
      setBookingPersistenceError(errorMsg);
      if (draft) {
        setWizardState(draft);
        persistWizardDraft(draft);
      }
      throw err;
    }
  };

  // Track live shipment action
  const handleViewTracking = (bookingId?: string) => {
    if (bookingId) {
      setActiveTrackingBookingId(bookingId);
      persistActiveTrackingId(bookingId);
    }
    setCurrentView('live-tracking');
  };

  // Reset wizard to Step 0 / initial draft
  const handleResetWizard = () => {
    setWizardState(INITIAL_WIZARD_DRAFT);
    persistWizardDraft(INITIAL_WIZARD_DRAFT);
  };

  // Realtime booking update handler (immutable React state update)
  const handleBookingUpdated = React.useCallback((rawOrMapped: any) => {
    if (!rawOrMapped) return;
    setBookings((prev) => {
      const targetId = rawOrMapped.id || rawOrMapped.reference;
      const existing = prev.find(
        (b) => b.id === targetId || b.reference === targetId
      );
      const isAlreadyBooking = 'cargo' in rawOrMapped && 'date' in rawOrMapped;
      const mapped = isAlreadyBooking
        ? (rawOrMapped as Booking)
        : mapBookingRowToBooking(rawOrMapped, existing);

      const merged = existing ? { ...existing, ...mapped } : mapped;
      syncRealtimeBookingUpdate(merged);

      const exists = prev.some(
        (b) => b.id === merged.id || b.reference === merged.reference
      );
      if (exists) {
        return prev.map((b) =>
          b.id === merged.id || b.reference === merged.reference ? merged : b
        );
      }
      return [merged, ...prev];
    });
  }, []);

  // Supabase Realtime Subscription for company bookings
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !userProfile.company_id) return;

    const channel = supabase
      .channel(`customer-bookings-${userProfile.company_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `company_id=eq.${userProfile.company_id}`,
        },
        (payload) => {
          if (payload.new) {
            handleBookingUpdated(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [userProfile.company_id, handleBookingUpdated]);

  // Quotes actions
  const handleAcceptQuote = async (quote: Quote) => {
    const updatedDraft: BookingWizardState = {
      ...wizardState,
      pickupPostcode: quote.origin,
      dropoffPostcode: quote.destination,
      selectedVehicle: quote.vehicle,
      selectedService: quote.serviceType || 'Emergency (ASAP)',
      estimatedTotal: quote.total,
      notes: `Pre-booked from accepted quote ${quote.reference}. Locked price £${quote.total}.`,
    };
    handleUpdateWizardState(updatedDraft);
    persistWizardDraft(updatedDraft);
    await deleteQuote(quote.id);
    const updatedQuotes = quotes.filter((q) => q.id !== quote.id && q.reference !== quote.reference);
    setQuotes(updatedQuotes);
    persistQuotes(updatedQuotes);
    setCurrentView('new-booking');
  };

  const handleDiscardQuote = async (quoteId: string) => {
    await deleteQuote(quoteId);
    const updatedQuotes = quotes.filter((q) => q.id !== quoteId && q.reference !== quoteId);
    setQuotes(updatedQuotes);
    persistQuotes(updatedQuotes);
  };

  const handleAddNewQuote = async (newQuote: Quote) => {
    const updatedQuotes = await addQuote(newQuote, userProfile.company_id);
    setQuotes(updatedQuotes);
  };

  const handleAddDocument = async (newDoc: DocumentItem) => {
    const updatedDocs = await addDocument(newDoc, userProfile.company_id);
    setDocuments(updatedDocs);
  };

  // Active tracking booking object
  const activeTrackingBooking =
    scopedBookings.find((b: Booking) => b.id === activeTrackingBookingId || b.reference === activeTrackingBookingId) ||
    scopedBookings.find((b: Booking) => b.status === 'IN TRANSIT') ||
    scopedBookings[0] ||
    undefined;

  // 1. IF NOT LOGGED IN: Render Login Screen (Matching Screenshot 1)
  if (!isAuthenticated) {
    return (
      <div
        className={`min-h-screen flex flex-col justify-between transition-colors duration-200 ${
          isDarkMode ? 'bg-[#060b11] text-white' : 'bg-slate-50 text-slate-900'
        }`}
      >
        {/* Top bar on Login Screen */}
        <header className="w-full px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
          <div className="flex items-center shrink-0">
            {/* Mobile: icon only */}
            <img
              src="/brand/logos/neo-transport-icon-blue.svg"
              alt="NEO Transport"
              className="sm:hidden h-6.5 w-auto object-contain shrink-0"
              style={{ aspectRatio: '267.04 / 191.82' }}
            />
            {/* Desktop: full official logo */}
            <img
              src={
                isDarkMode
                  ? '/brand/logos/neo-transport-full-blue-white.svg'
                  : '/brand/logos/neo-transport-full-blue-navy.svg'
              }
              alt="NEO TRANSPORT"
              className="hidden sm:block w-[170px] md:w-[195px] h-auto object-contain shrink-0"
              style={{ aspectRatio: '1310.75 / 191.82' }}
            />
          </div>

          <div className="flex items-center gap-2.5">
            {/* Theme switcher */}
            <div
              className={`flex items-center p-1 rounded-full border transition-colors ${
                isDarkMode
                  ? 'bg-[#111827] border-[#1e293b]'
                  : 'bg-slate-100/80 border-slate-200'
              }`}
            >
              <button
                onClick={isDarkMode ? onToggleTheme : undefined}
                className={`p-1.5 rounded-full transition-all cursor-pointer ${
                  !isDarkMode ? 'bg-white text-slate-900 shadow-advertz' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Light mode"
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={!isDarkMode ? onToggleTheme : undefined}
                className={`p-1.5 rounded-full transition-all cursor-pointer ${
                  isDarkMode ? 'bg-[#1e293b] text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Dark mode"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={onBackToLanding}
              className={`text-xs font-medium px-4 py-1.5 rounded-full border transition-all cursor-pointer ${
                isDarkMode
                  ? 'border-[#1e293b] text-slate-300 hover:text-white hover:bg-[#1e293b]'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-advertz'
              }`}
            >
              Back to site
            </button>
          </div>
        </header>

        {/* Center Card */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-md">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-blue-600 bg-blue-50/80 border border-blue-200/60 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                <span>Customer portal</span>
              </div>
              <h1
                className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                Welcome back
              </h1>
              <p
                className={`text-xs sm:text-sm mt-1.5 leading-relaxed ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Sign in to your NEO standby account.
              </p>
            </div>

            <div
              className={`p-7 sm:p-9 rounded-3xl border transition-all ${
                isDarkMode
                  ? 'bg-[#111827] border-[#1e293b] shadow-xl'
                  : 'bg-white border-slate-200/80 shadow-advertz-lg'
              }`}
            >
              {/* Environment Status Banners */}
              {!isSupabaseConfigured && isDemoModeAllowed && (
                <div className="mb-4 p-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-sky-400" />
                  <div>
                    <span className="font-semibold text-xs text-sky-400 block">Demo mode active</span>
                    <span className="text-[11px] text-slate-300 leading-relaxed block mt-0.5">
                      Database disconnected. Click quick demo credentials below to test customer or dispatch admin access.
                    </span>
                  </div>
                </div>
              )}

              {!isSupabaseConfigured && !isDemoModeAllowed && (
                <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <div>
                    <span className="font-semibold text-xs text-rose-400 block">Authentication unavailable</span>
                    <span className="text-[11px] text-slate-300 leading-relaxed block mt-0.5">
                      Production database connection required. Demo mode is disabled in production environments.
                    </span>
                  </div>
                </div>
              )}

              {loginError && (
                <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              {resetStatus && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{resetStatus}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label
                    className={`block text-xs font-medium mb-1.5 ${
                      isDarkMode ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    Work email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@company.co.uk"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all outline-none ${
                      isDarkMode
                        ? 'bg-[#0b0f19] border-[#1e293b] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                        : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 shadow-advertz'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      className={`text-xs font-medium ${
                        isDarkMode ? 'text-slate-300' : 'text-slate-700'
                      }`}
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={isResetting}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      {isResetting ? 'Sending reset link...' : 'Forgot password?'}
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="Enter account password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all outline-none ${
                      isDarkMode
                        ? 'bg-[#0b0f19] border-[#1e293b] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                        : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 shadow-advertz'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 accent-blue-600"
                  />
                  <label
                    htmlFor="remember"
                    className={`text-xs select-none cursor-pointer ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    Remember me on this device
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full bg-slate-900 hover:bg-black text-white py-2.5 px-5 rounded-full text-sm font-medium transition-all shadow-xs flex items-center justify-center gap-2 mt-2 disabled:opacity-60 cursor-pointer active:scale-[0.99]"
                >
                  {loginLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign in</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                {/* Fast credentials filler for preview & testing environments */}
                {isStagingDemoAvailable && (
                  <div
                    className={`pt-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] ${
                      isDarkMode ? 'border-[#1e2229] text-slate-400' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <span
                      className={`font-mono text-[10px] ${
                        isDarkMode ? 'text-slate-400' : 'text-slate-600'
                      }`}
                    >
                      {isSupabaseConfigured ? 'Staging test credentials:' : 'Click to fill demo:'}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEmail(DEMO_CREDENTIALS.customer.email);
                          setPassword(DEMO_CREDENTIALS.customer.password);
                        }}
                        className={`px-2 py-1 rounded-md font-mono text-[10px] border cursor-pointer transition-colors ${
                          isDarkMode
                            ? 'bg-[#0b0d11] hover:bg-[#1e2229] text-slate-300 border-[#1e2229]'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                        }`}
                      >
                        Customer ({DEMO_CREDENTIALS.customer.email.split('@')[0]})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail(DEMO_CREDENTIALS.admin.email);
                          setPassword(DEMO_CREDENTIALS.admin.password);
                        }}
                        className={`px-2 py-1 rounded-md font-mono text-[10px] border cursor-pointer transition-colors ${
                          isDarkMode
                            ? 'bg-rose-950/30 border-rose-800/40 text-rose-300 hover:bg-rose-950/50'
                            : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        Dispatch Admin
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>

            <p
              className={`text-center text-xs mt-6 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              No account yet?{' '}
              <button
                onClick={onBackToLanding}
                className="text-[#206bc4] font-medium hover:underline cursor-pointer"
              >
                Open a £0 standby account
              </button>
            </p>
          </div>
        </main>

        <footer
          className={`w-full py-4 text-center text-[11px] font-mono ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          NEO Transport Ltd · Emergency Freight & Rapid Response Network · 24/7 Dispatch 0800 246 8135
        </footer>
      </div>
    );
  }

  // 2. AUTHENTICATED ADMIN DISPATCH PORTAL (enforce role === 'admin')
  if (portalMode === 'admin' && userProfile.role === 'admin') {
    return (
      <AdminPortal
        isDarkMode={isDarkMode}
        onToggleTheme={onToggleTheme}
        onSignOut={handleSignOut}
        onSwitchToCustomerPortal={() => setPortalMode('customer')}
        userRole={userProfile.role}
        currentUserId={userProfile.id}
      />
    );
  }

  // 3. AUTHENTICATED CUSTOMER PORTAL
  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        isDarkMode ? 'bg-[#0b0f19] text-white' : 'bg-[#f8fafc] text-slate-900'
      }`}
    >
      {/* Top Header */}
      <Header
        isDarkMode={isDarkMode}
        onToggleTheme={onToggleTheme}
        onSignOut={handleSignOut}
        subtitle="CUSTOMER PORTAL"
        onNavigatePortal={() => setCurrentView('dashboard')}
        userProfile={userProfile}
        onSwitchToAdmin={userProfile.role === 'admin' ? () => setPortalMode('admin') : undefined}
        onSelectNotification={(notif: InAppNotification) => {
          if (notif.bookingId) {
            setActiveTrackingBookingId(notif.bookingId);
            persistActiveTrackingId(notif.bookingId);
            setCurrentView('live-tracking');
          } else if (notif.category === 'invoice') {
            setCurrentView('invoices');
          } else if (notif.category === 'standby') {
            setCurrentView('documents');
          }
        }}
      />

      <div className="flex">
        {/* Left Sidebar (Desktop: lg:block) */}
        <Sidebar
          currentView={currentView}
          onSelectView={setCurrentView}
          onSignOut={handleSignOut}
          isDarkMode={isDarkMode}
          isOpenMobile={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-5 sm:p-7 lg:p-9 pb-28 sm:pb-28 lg:pb-9 min-w-0 overflow-y-auto">
          {bookingPersistenceError && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-2xl border bg-rose-500/10 border-rose-500/30 text-rose-300 text-xs flex items-start justify-between gap-3 shadow-lg"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-rose-200">Booking Confirmation Blocked</p>
                  <p className="leading-relaxed opacity-90">{bookingPersistenceError}</p>
                  <p className="text-[11px] text-slate-300 opacity-80">
                    Your shipment details are safely preserved in draft. Central dispatch has not yet confirmed the job.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBookingPersistenceError(null)}
                className="text-rose-400 hover:text-rose-200 text-xs px-2.5 py-1 rounded-lg border border-rose-500/30 hover:bg-rose-500/20 transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}
          <div key={currentView} className="animate-view-entrance">
            {currentView === 'dashboard' && (
              <DashboardView
                isDarkMode={isDarkMode}
                onNavigate={setCurrentView}
                bookings={scopedBookings}
                invoices={scopedInvoices}
                userName={userProfile.full_name}
                onSelectJob={(job) => {
                  if (job.status === 'IN TRANSIT') {
                    setActiveTrackingBookingId(job.id);
                    persistActiveTrackingId(job.id);
                    setCurrentView('live-tracking');
                  } else {
                    setCurrentView('booking-history');
                  }
                }}
              />
            )}

            {currentView === 'new-booking' && (
              <NewBookingView
                isDarkMode={isDarkMode}
                onBookingCreated={handleBookingCreated}
                onViewTracking={handleViewTracking}
                initialWizardState={wizardState}
                onUpdateState={handleUpdateWizardState}
                existingBookings={scopedBookings}
                onResetWizard={handleResetWizard}
                userEmail={email || 'accounts@meridian.co.uk'}
                userName={userProfile.full_name}
                companyId={userProfile.company_id}
              />
            )}

            {currentView === 'live-tracking' && (
              <LiveTrackingView
                isDarkMode={isDarkMode}
                activeBooking={activeTrackingBooking}
                bookings={scopedBookings}
                onSelectBooking={(id) => {
                  setActiveTrackingBookingId(id);
                  persistActiveTrackingId(id);
                }}
                onBookingUpdated={handleBookingUpdated}
                onNavigate={setCurrentView}
              />
            )}

            {currentView === 'booking-history' && (
              <BookingHistoryView
                isDarkMode={isDarkMode}
                bookings={scopedBookings}
                onNavigate={setCurrentView}
                onRebook={handleRebook}
                onViewPod={(ref) => {
                  setPodHighlightRef(ref);
                  setCurrentView('documents');
                }}
              />
            )}

            {currentView === 'quotes' && (
              <QuotesView
                isDarkMode={isDarkMode}
                quotes={scopedQuotes}
                onAcceptQuote={handleAcceptQuote}
                onDiscardQuote={handleDiscardQuote}
                onAddNewQuote={handleAddNewQuote}
                onNavigate={setCurrentView}
              />
            )}

            {currentView === 'invoices' && (
              <InvoicesView isDarkMode={isDarkMode} invoices={scopedInvoices} />
            )}

            {currentView === 'documents' && (
              <DocumentsView
                isDarkMode={isDarkMode}
                documents={scopedDocuments}
                onAddDocument={handleAddDocument}
                highlightRef={podHighlightRef}
              />
            )}

            {currentView === 'support' && (
              <SupportView isDarkMode={isDarkMode} companyId={userProfile.company_id} />
            )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Dock (Visible on screens < lg) */}
      <MobileBottomNav
        currentView={currentView}
        onNavigate={setCurrentView}
        isDarkMode={isDarkMode}
        onToggleTheme={onToggleTheme}
        onSignOut={handleSignOut}
        userRole={userProfile.role}
        onSwitchToAdmin={userProfile.role === 'admin' ? () => setPortalMode('admin') : undefined}
        hasActiveInTransit={scopedBookings.some((b: Booking) => b.status === 'IN TRANSIT')}
        documentCount={scopedDocuments.length}
        unpaidInvoiceCount={scopedInvoices.filter((i: Invoice) => i.status === 'DUE' || i.status === 'OVERDUE').length}
      />
    </div>
  );
};

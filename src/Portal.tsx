import React, { useState, useEffect } from 'react';
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
import {
  INITIAL_BOOKINGS,
  INITIAL_QUOTES,
  INITIAL_INVOICES,
  INITIAL_DOCUMENTS,
} from './data/mockData';
import { ViewMode, Booking, Quote, DocumentItem, BookingWizardState, Invoice } from './types';
import {
  getPersistedBookings,
  persistBooking,
  getPersistedQuotes,
  persistQuotes,
  getPersistedInvoices,
  getPersistedDocuments,
  persistDocuments,
  getPersistedActiveTrackingId,
  persistActiveTrackingId,
  getPersistedWizardDraft,
  persistWizardDraft,
  deleteQuote,
  INITIAL_WIZARD_DRAFT,
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
  authenticateCustomer,
  requestPasswordReset,
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
  initialLoggedIn = true,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(initialLoggedIn);
  const [email, setEmail] = useState('chris@meridian.co.uk');
  const [password, setPassword] = useState('••••••••');
  const [rememberMe, setRememberMe] = useState(true);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Authenticated user's profile state
  const [userProfile, setUserProfile] = useState<{
    full_name: string;
    initials: string;
    companyName: string;
  }>({
    full_name: DEFAULT_PROFILE.full_name,
    initials: DEFAULT_PROFILE.initials,
    companyName: DEFAULT_COMPANY.name,
  });

  const [portalMode, setPortalMode] = useState<'customer' | 'admin'>('customer');
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [bookings, setBookings] = useState<Booking[]>(() => {
    try {
      const raw = localStorage.getItem('neo_portal_bookings');
      return raw ? JSON.parse(raw) : INITIAL_BOOKINGS;
    } catch {
      return INITIAL_BOOKINGS;
    }
  });
  const [quotes, setQuotes] = useState<Quote[]>(() => getPersistedQuotes());
  const [invoices, setInvoices] = useState<Invoice[]>(() => getPersistedInvoices());
  const [documents, setDocuments] = useState<DocumentItem[]>(() => getPersistedDocuments());
  const [activeTrackingBookingId, setActiveTrackingBookingId] = useState<string>(() => getPersistedActiveTrackingId());
  const [wizardState, setWizardState] = useState<BookingWizardState>(() => getPersistedWizardDraft());
  const [podHighlightRef, setPodHighlightRef] = useState<string | undefined>(undefined);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Sync bookings from Supabase & listen for Admin/Portal cross-updates in real-time
  useEffect(() => {
    getPersistedBookings().then((fetched) => {
      if (fetched && fetched.length > 0) {
        setBookings(fetched);
      }
    });

    const handleSync = () => {
      getPersistedBookings().then((fetched) => {
        if (fetched) setBookings(fetched);
      });
      setQuotes(getPersistedQuotes());
      setInvoices(getPersistedInvoices());
      setDocuments(getPersistedDocuments());
    };

    window.addEventListener('neo_portal_sync', handleSync);
    return () => {
      window.removeEventListener('neo_portal_sync', handleSync);
    };
  }, []);

  // Handle Login with Supabase / Fallback
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setResetStatus(null);
    setLoginLoading(true);

    try {
      const authResult = await authenticateCustomer(email, password);
      setUserProfile({
        full_name: authResult.profile.full_name,
        initials: authResult.profile.initials,
        companyName: authResult.company.name,
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
  const handleSignOut = () => {
    setIsAuthenticated(false);
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
  const handleBookingCreated = async (newBooking: Booking, finalWizardState?: BookingWizardState) => {
    const draft = finalWizardState || wizardState;
    await persistBooking(newBooking, draft);
    setBookings((prev) => [newBooking, ...prev.filter((b) => b.id !== newBooking.id && b.reference !== newBooking.reference)]);
    setActiveTrackingBookingId(newBooking.id);
    persistActiveTrackingId(newBooking.id);
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

  const handleAddNewQuote = (newQuote: Quote) => {
    const updatedQuotes = [newQuote, ...quotes];
    setQuotes(updatedQuotes);
    persistQuotes(updatedQuotes);
  };

  const handleAddDocument = (newDoc: DocumentItem) => {
    const updatedDocs = [newDoc, ...documents];
    setDocuments(updatedDocs);
    persistDocuments(updatedDocs);
  };

  // Active tracking booking object
  const activeTrackingBooking =
    bookings.find((b) => b.id === activeTrackingBookingId || b.reference === activeTrackingBookingId) ||
    bookings.find((b) => b.status === 'IN TRANSIT') ||
    bookings[0];

  // 1. IF NOT LOGGED IN: Render Login Screen (Matching Screenshot 1)
  if (!isAuthenticated) {
    return (
      <div
        className={`min-h-screen flex flex-col justify-between transition-colors duration-200 ${
          isDarkMode ? 'bg-[#060b11] text-white' : 'bg-slate-50 text-slate-900'
        }`}
      >
        {/* Top bar on Login Screen */}
        <header className="w-full px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 relative flex items-center justify-center">
              <svg viewBox="0 0 32 32" className="w-8 h-8 fill-none">
                <path d="M6 10L14 4L18 7L10 13L6 10Z" fill="#3898EC" />
                <path d="M14 28L22 22L26 25L18 31L14 28Z" fill="#3898EC" />
                <path d="M10 13L18 7L26 13L18 19L10 13Z" fill="#2b85d6" />
                <path d="M6 19L14 13L18 16L10 22L6 19Z" fill="#3898EC" />
                <path d="M14 19L22 13L26 16L18 22L14 19Z" fill="#60a5fa" />
              </svg>
            </div>
            <span className="font-extrabold tracking-tight text-lg uppercase font-sans">
              NEO TRANSPORT
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme switcher */}
            <div
              className={`flex items-center p-0.5 rounded-full border ${
                isDarkMode
                  ? 'bg-[#0b121c] border-slate-700/60'
                  : 'bg-slate-200/60 border-slate-300'
              }`}
            >
              <button
                onClick={onToggleTheme}
                className={`p-1.5 rounded-full transition-all ${
                  !isDarkMode ? 'bg-white text-amber-500 shadow-xs' : 'text-slate-400'
                }`}
                title="Light mode"
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onToggleTheme}
                className={`p-1.5 rounded-full transition-all ${
                  isDarkMode ? 'bg-slate-800 text-sky-400 shadow-xs' : 'text-slate-400'
                }`}
                title="Dark mode"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={onBackToLanding}
              className={`text-xs font-semibold px-4 py-2 rounded-full transition-colors ${
                isDarkMode
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              Back to site
            </button>
          </div>
        </header>

        {/* Center Card */}
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="w-4 h-0.5 bg-[#3898EC]" />
                <span className="font-mono text-xs uppercase tracking-widest text-[#3898EC] font-semibold">
                  CUSTOMER LOGIN
                </span>
              </div>
              <h1
                className={`text-3xl font-extrabold tracking-tight ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                Welcome back
              </h1>
              <p className="text-xs text-slate-400 mt-1.5">
                Sign in to your NEO TRANSPORT standby account.
              </p>
            </div>

            <div
              className={`p-7 rounded-3xl border shadow-xl transition-all ${
                isDarkMode
                  ? 'bg-[#0b121c] border-[#172334]'
                  : 'bg-white border-slate-200'
              }`}
            >
              {loginError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              {resetStatus && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{resetStatus}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Work email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                      isDarkMode
                        ? 'bg-[#060b11] border-[#1a2636] text-white focus:border-[#3898EC]'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#3898EC]'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-400">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={isResetting}
                      className="text-xs font-medium text-[#3898EC] hover:underline disabled:opacity-50"
                    >
                      {isResetting ? 'Sending reset link...' : 'Forgot password?'}
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                      isDarkMode
                        ? 'bg-[#060b11] border-[#1a2636] text-white focus:border-[#3898EC]'
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#3898EC]'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[#3898EC] accent-[#3898EC]"
                  />
                  <label
                    htmlFor="remember"
                    className="text-xs text-slate-400 select-none cursor-pointer"
                  >
                    Remember me on this device
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full bg-[#3898EC] hover:bg-[#2b85d6] text-white py-2.5 px-4 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md group mt-2 disabled:opacity-60"
                >
                  {loginLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign in</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>

                {/* Fast role switcher for development/demo mode */}
                <div className="pt-3 border-t border-slate-700/30 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono text-[10px]">Demo credentials:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('chris@meridian.co.uk');
                        setPassword('••••••••');
                      }}
                      className="px-2.5 py-1 rounded-full bg-slate-800 hover:text-white text-slate-300 font-mono text-[10px] border border-slate-700 cursor-pointer"
                    >
                      Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('ops@neotransport.co.uk');
                        setPassword('••••••••');
                      }}
                      className="px-2.5 py-1 rounded-full bg-rose-950/40 border border-rose-800/40 text-rose-300 hover:text-white font-mono text-[10px] cursor-pointer"
                    >
                      Dispatch Admin
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <p className="text-center text-xs text-slate-400 mt-6">
              No account yet?{' '}
              <button
                onClick={onBackToLanding}
                className="text-[#3898EC] font-semibold hover:underline"
              >
                Open a £0 standby account
              </button>
            </p>
          </div>
        </main>

        <footer className="w-full py-4 text-center text-[11px] font-mono text-slate-400">
          NEO Transport Ltd · Emergency Freight & Rapid Response Network · 24/7 Dispatch 0800 246 8135
        </footer>
      </div>
    );
  }

  // 2. AUTHENTICATED ADMIN DISPATCH PORTAL
  if (portalMode === 'admin') {
    return (
      <AdminPortal
        isDarkMode={isDarkMode}
        onToggleTheme={onToggleTheme}
        onSignOut={handleSignOut}
        onSwitchToCustomerPortal={() => setPortalMode('customer')}
      />
    );
  }

  // 3. AUTHENTICATED CUSTOMER PORTAL
  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        isDarkMode ? 'bg-[#060b11] text-white' : 'bg-slate-50 text-slate-900'
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
        onSwitchToAdmin={() => setPortalMode('admin')}
      />

      {/* Mobile Portal Navigation Bar (< 1024px / lg:hidden) - Phase 1 requirement */}
      <nav
        aria-label="Mobile Navigation"
        className={`lg:hidden w-full overflow-x-auto py-2.5 px-4 flex items-center gap-2 border-b sticky top-16 z-20 scrollbar-none transition-colors ${
          isDarkMode
            ? 'bg-[#060b11]/95 border-[#172334] text-slate-300 backdrop-blur-md'
            : 'bg-white/95 border-slate-200 text-slate-700 backdrop-blur-md shadow-xs'
        }`}
      >
        {NAV.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-medium shrink-0 transition-all ${
                isActive
                  ? 'bg-sky-500/10 text-[#3898EC] border border-[#3898EC] font-semibold shadow-xs'
                  : isDarkMode
                  ? 'bg-[#0b121c] text-slate-400 border border-[#1a2636] hover:text-white'
                  : 'bg-slate-100 text-slate-600 border border-slate-200 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

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
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
          {currentView === 'dashboard' && (
            <DashboardView
              isDarkMode={isDarkMode}
              onNavigate={setCurrentView}
              bookings={bookings}
              invoices={invoices}
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
              existingBookings={bookings}
              onResetWizard={handleResetWizard}
            />
          )}

          {currentView === 'live-tracking' && (
            <LiveTrackingView
              isDarkMode={isDarkMode}
              activeBooking={activeTrackingBooking}
              bookings={bookings}
              onSelectBooking={(id) => {
                setActiveTrackingBookingId(id);
                persistActiveTrackingId(id);
              }}
            />
          )}

          {currentView === 'booking-history' && (
            <BookingHistoryView
              isDarkMode={isDarkMode}
              bookings={bookings}
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
              quotes={quotes}
              onAcceptQuote={handleAcceptQuote}
              onDiscardQuote={handleDiscardQuote}
              onAddNewQuote={handleAddNewQuote}
              onNavigate={setCurrentView}
            />
          )}

          {currentView === 'invoices' && (
            <InvoicesView isDarkMode={isDarkMode} invoices={invoices} />
          )}

          {currentView === 'documents' && (
            <DocumentsView
              isDarkMode={isDarkMode}
              documents={documents}
              onAddDocument={handleAddDocument}
              highlightRef={podHighlightRef}
            />
          )}

          {currentView === 'support' && (
            <SupportView isDarkMode={isDarkMode} />
          )}
        </main>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Building2,
  CreditCard,
  FileCheck,
  Search,
  Plus,
  CheckCircle2,
  Clock,
  MapPin,
  Shield,
  LogOut,
  Users,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Phone,
  Mail,
  Sliders,
  Check,
  X,
  FileText,
  Upload,
} from 'lucide-react';
import { Booking, Quote, Invoice, DocumentItem } from './types';
import { StandbyApplication } from './lib/types';
import {
  getPersistedBookings,
  updateBooking,
  getPersistedApplications,
  approveApplication,
  getPersistedQuotes,
  addQuote,
  deleteQuote,
  getPersistedInvoices,
  updateInvoiceStatus,
  getPersistedDocuments,
  addDocument,
} from './lib/portalStore';
import {
  Panel,
  PrimaryButton,
  GhostButton,
  StatusPill,
  Field,
  SelectField,
  Eyebrow,
  Logo,
  ThemeToggle,
} from './components/ui/DesignSystem';

// Re-export design system components for consumers
export {
  Panel,
  PrimaryButton,
  GhostButton,
  StatusPill,
  Field,
  SelectField,
  Eyebrow,
  Logo,
  ThemeToggle,
};

export type AdminTab = 'dispatch' | 'applications' | 'billing' | 'documents';

interface AdminPortalProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onSignOut: () => void;
  onSwitchToCustomerPortal: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  isDarkMode,
  onToggleTheme,
  onSignOut,
  onSwitchToCustomerPortal,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dispatch');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [applications, setApplications] = useState<StandbyApplication[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('ALL');
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  // Progress slider state inside booking editor
  const [editProgress, setEditProgress] = useState<number>(45);

  // New Quote Modal / State
  const [isNewQuoteOpen, setIsNewQuoteOpen] = useState(false);
  const [quoteOrigin, setQuoteOrigin] = useState('Manchester M17 1AB');
  const [quoteDestination, setQuoteDestination] = useState('Birmingham B6 7EU');
  const [quoteVehicle, setQuoteVehicle] = useState('Sprinter LWB');
  const [quoteService, setQuoteService] = useState('Emergency (ASAP)');
  const [quoteTotal, setQuoteTotal] = useState<number>(355);

  // Attach Document Modal / State
  const [isNewDocOpen, setIsNewDocOpen] = useState(false);
  const [docBookingRef, setDocBookingRef] = useState('NT-24817');
  const [docTitle, setDocTitle] = useState('Signed Proof of Delivery — Direct Transit');
  const [docCategory, setDocCategory] = useState<'pod' | 'cmr' | 'invoice' | 'compliance'>('pod');
  const [docSigner, setDocSigner] = useState('G. Henderson (Receiving Bay 4)');
  const [docFile, setDocFile] = useState<File | null>(null);

  // Refresh all store data
  const loadStoreData = async () => {
    try {
      const [b, a, q, inv, d] = await Promise.all([
        getPersistedBookings(),
        getPersistedApplications(),
        getPersistedQuotes(),
        getPersistedInvoices(),
        getPersistedDocuments(),
      ]);
      setBookings(b);
      setApplications(a);
      setQuotes(q);
      setInvoices(inv);
      setDocuments(d);
    } catch (e) {
      console.error('Failed loading admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStoreData();

    // Real-time synchronization: listen to store updates from Customer Portal or Admin
    const handleSync = () => {
      loadStoreData();
    };

    window.addEventListener('neo_portal_sync', handleSync);
    return () => {
      window.removeEventListener('neo_portal_sync', handleSync);
    };
  }, []);

  // Filtered Bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchSearch =
        b.reference.toLowerCase().includes(bookingSearch.toLowerCase()) ||
        b.origin.toLowerCase().includes(bookingSearch.toLowerCase()) ||
        b.destination.toLowerCase().includes(bookingSearch.toLowerCase()) ||
        (b.driver?.name && b.driver.name.toLowerCase().includes(bookingSearch.toLowerCase())) ||
        (b.cargo && b.cargo.toLowerCase().includes(bookingSearch.toLowerCase()));

      if (!matchSearch) return false;
      if (bookingStatusFilter !== 'ALL' && b.status !== bookingStatusFilter) return false;
      return true;
    });
  }, [bookings, bookingSearch, bookingStatusFilter]);

  // Handle Booking Save in Dispatch Board
  const handleSaveBookingEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;

    const updatedBooking: Booking = {
      ...editingBooking,
      progress: editProgress,
    };
    const updated = await updateBooking(updatedBooking);
    setBookings(updated);
    setEditingBooking(null);
  };

  // Quick Status change directly from list
  const handleQuickStatusChange = async (booking: Booking, newStatus: 'IN TRANSIT' | 'DELIVERED' | 'SCHEDULED' | 'CANCELLED') => {
    const updatedBooking: Booking = {
      ...booking,
      status: newStatus,
      driver: booking.driver
        ? {
            ...booking.driver,
            status:
              newStatus === 'IN TRANSIT'
                ? 'ON THE MOVE'
                : newStatus === 'DELIVERED'
                ? 'DELIVERED AT DOCK'
                : newStatus === 'CANCELLED'
                ? 'STANDBY RELEASED'
                : 'ASSIGNED & AWAITING DISPATCH',
          }
        : undefined,
    };
    const updatedList = await updateBooking(updatedBooking);
    setBookings(updatedList);
  };

  // Handle Application Approval
  const handleApproveApp = async (appId: string) => {
    const updated = await approveApplication(appId);
    setApplications(updated);
  };

  // Handle New Quote Submit
  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    const newQuote: Quote = {
      id: `q-${Date.now()}`,
      reference: `Q-${Math.floor(4850 + Math.random() * 150)}`,
      origin: quoteOrigin,
      destination: quoteDestination,
      vehicle: quoteVehicle,
      serviceType: quoteService,
      total: Number(quoteTotal) || 355,
      expiresText: 'EXPIRES IN 3 DAYS',
      isUrgent: quoteService.includes('Emergency'),
    };

    const updated = await addQuote(newQuote);
    setQuotes(updated);
    setIsNewQuoteOpen(false);
  };

  // Handle Invoice Status Toggle
  const handleToggleInvoice = async (invoiceId: string, currentStatus: 'PAID' | 'DUE' | 'OVERDUE') => {
    const nextStatus: 'PAID' | 'DUE' | 'OVERDUE' =
      currentStatus === 'DUE' ? 'PAID' : currentStatus === 'PAID' ? 'OVERDUE' : 'DUE';
    const updated = await updateInvoiceStatus(invoiceId, nextStatus);
    setInvoices(updated);
  };

  // Handle Attach Document Submit
  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    const newDoc: DocumentItem = {
      id: `doc-${Date.now()}`,
      title: `${docTitle} (${docBookingRef})`,
      type: docCategory.toUpperCase(),
      date: 'Today',
      category: docCategory,
      fileSize: docFile ? `${Math.round(docFile.size / 1024)} KB` : '248 KB',
      verified: true,
      pdf_url: docFile ? URL.createObjectURL(docFile) : undefined,
    };

    const updated = await addDocument(newDoc);
    setDocuments(updated);
    setIsNewDocOpen(false);
    setDocFile(null);
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-200 font-sans ${
        isDarkMode ? 'bg-[#060b11] text-white' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* 1. TOP DISPATCH ADMIN HEADER */}
      <header
        className={`w-full h-16 border-b transition-colors duration-200 z-30 sticky top-0 backdrop-blur-md px-4 lg:px-8 flex items-center justify-between ${
          isDarkMode
            ? 'bg-[#060b11]/90 border-[#172334] text-white'
            : 'bg-white/95 border-slate-200 text-slate-900 shadow-xs'
        }`}
      >
        <div className="flex items-center gap-3">
          <Logo subtitle="24/7 FLEET DISPATCH CONTROL" isAdmin={true} />
        </div>

        {/* System dispatch indicator */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>UK CORRIDOR DISPATCH ESTIMATES · ACTIVE</span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Switch to Customer Portal button */}
          <button
            onClick={onSwitchToCustomerPortal}
            title="Switch to Customer Portal view"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#3898EC]/10 hover:bg-[#3898EC]/20 text-[#3898EC] border border-[#3898EC]/30 transition-all cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Customer Portal</span>
          </button>

          <ThemeToggle isDarkMode={isDarkMode} onToggleTheme={onToggleTheme} />

          <button
            onClick={onSignOut}
            title="Sign out of Admin Dispatch"
            className={`p-2 rounded-full border transition-all cursor-pointer ${
              isDarkMode
                ? 'border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white'
                : 'border-slate-300 hover:bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. ADMIN NAVIGATION TABS */}
      <div
        className={`w-full border-b sticky top-16 z-20 backdrop-blur-md px-4 lg:px-8 py-2.5 transition-colors ${
          isDarkMode ? 'bg-[#080f18]/95 border-[#172334]' : 'bg-white/95 border-slate-200 shadow-xs'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2">
            {[
              {
                id: 'dispatch',
                label: 'Dispatch Board',
                icon: Truck,
                badge: bookings.filter((b) => b.status === 'IN TRANSIT').length,
              },
              {
                id: 'applications',
                label: 'Standby Applications',
                icon: Building2,
                badge: applications.filter((a) => a.status === 'pending').length,
              },
              {
                id: 'billing',
                label: 'Quotes & Billing',
                icon: CreditCard,
                badge: invoices.filter((i) => i.status === 'DUE' || i.status === 'OVERDUE').length,
              },
              {
                id: 'documents',
                label: 'POD & Documents',
                icon: FileCheck,
                badge: documents.length,
              },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as AdminTab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono font-medium shrink-0 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#3898EC] text-white font-bold shadow-md shadow-[#3898EC]/20'
                      : isDarkMode
                      ? 'bg-[#060b11] text-slate-400 border border-[#1a2636] hover:text-white'
                      : 'bg-slate-100 text-slate-600 border border-slate-200 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-[#3898EC]/20 text-[#3898EC]'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadStoreData}
              title="Refresh store from Supabase"
              className={`p-2 rounded-full text-xs border transition-all cursor-pointer flex items-center gap-1.5 ${
                isDarkMode
                  ? 'border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-mono text-[11px]">Sync</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. MAIN TAB CONTENT */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* =========================================================================
            TAB 1: DISPATCH BOARD (BOOKINGS)
            ========================================================================= */}
        {activeTab === 'dispatch' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <Eyebrow text="OPERATIONS DISPATCH CONSOLE" />
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Dispatch Board & Live Fleet
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Control active customer bookings, driver assignments, route progress, and corridor dispatch estimates.
                </p>
              </div>

              {/* Status filter pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {['ALL', 'IN TRANSIT', 'SCHEDULED', 'DELIVERED', 'CANCELLED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setBookingStatusFilter(st)}
                    className={`px-3 py-1 rounded-full text-xs font-mono transition-all cursor-pointer ${
                      bookingStatusFilter === st
                        ? 'bg-[#3898EC] text-white font-bold'
                        : isDarkMode
                        ? 'bg-[#0b121c] text-slate-400 border border-[#172334] hover:text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick KPI stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <Panel isDarkMode={isDarkMode} compact>
                <span className="font-mono text-[10px] uppercase text-slate-400">Total Bookings</span>
                <p className="text-2xl font-black mt-1">{bookings.length}</p>
                <span className="text-[11px] text-slate-400 font-mono">Real-time synced</span>
              </Panel>
              <Panel isDarkMode={isDarkMode} compact>
                <span className="font-mono text-[10px] uppercase text-sky-400 font-semibold">In Transit</span>
                <p className="text-2xl font-black text-[#3898EC] mt-1">
                  {bookings.filter((b) => b.status === 'IN TRANSIT').length}
                </p>
                <span className="text-[11px] text-slate-400 font-mono">Wheels rolling</span>
              </Panel>
              <Panel isDarkMode={isDarkMode} compact>
                <span className="font-mono text-[10px] uppercase text-amber-400 font-semibold">Scheduled</span>
                <p className="text-2xl font-black text-amber-400 mt-1">
                  {bookings.filter((b) => b.status === 'SCHEDULED').length}
                </p>
                <span className="text-[11px] text-slate-400 font-mono">Awaiting collection</span>
              </Panel>
              <Panel isDarkMode={isDarkMode} compact>
                <span className="font-mono text-[10px] uppercase text-emerald-400 font-semibold">Delivered</span>
                <p className="text-2xl font-black text-emerald-400 mt-1">
                  {bookings.filter((b) => b.status === 'DELIVERED').length}
                </p>
                <span className="text-[11px] text-slate-400 font-mono">Signed at dock</span>
              </Panel>
            </div>

            {/* Search Bar */}
            <div
              className={`p-3 rounded-2xl border flex items-center gap-3 ${
                isDarkMode ? 'bg-[#0b121c] border-[#172334]' : 'bg-white border-slate-200'
              }`}
            >
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search by booking reference (e.g. NT-24817), origin, destination, driver name, cargo..."
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
                className="w-full text-xs bg-transparent focus:outline-none"
              />
              {bookingSearch && (
                <button
                  onClick={() => setBookingSearch('')}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Bookings List */}
            <div className="space-y-4">
              {filteredBookings.length === 0 ? (
                <Panel isDarkMode={isDarkMode}>
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No bookings found matching current filter or search criteria.
                  </div>
                </Panel>
              ) : (
                filteredBookings.map((b) => {
                  const isBeingEdited = editingBooking?.id === b.id;
                  return (
                    <Panel
                      key={b.id}
                      isDarkMode={isDarkMode}
                      className={
                        b.status === 'IN TRANSIT'
                          ? isDarkMode
                            ? 'border-sky-500/30 bg-[#091322]'
                            : 'border-sky-200 bg-sky-50/30'
                          : ''
                      }
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Booking Meta */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-base font-extrabold text-[#3898EC]">
                              {b.reference}
                            </span>
                            <StatusPill status={b.status} />
                            <span className="text-xs text-slate-400 font-mono">
                              Date: {b.date}
                            </span>
                          </div>

                          {/* Route */}
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-slate-300">
                              {b.origin}
                            </span>
                            <span className="text-[#3898EC] font-bold">→</span>
                            <span className="font-semibold text-white">
                              {b.destination}
                            </span>
                          </div>

                          {/* Cargo & Vehicle */}
                          <div className="flex items-center gap-4 text-[11px] text-slate-400">
                            <span>Vehicle: <strong className="text-slate-200">{b.vehicle}</strong></span>
                            <span>Cargo: <strong className="text-slate-200">{b.cargo || 'Palletised goods'}</strong></span>
                            <span>Tariff: <strong className="text-emerald-400">£{b.total}</strong></span>
                          </div>
                        </div>

                        {/* Assigned Driver & Live Telemetry */}
                        <div className="p-3 rounded-xl bg-black/20 border border-slate-700/30 min-w-[260px] space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 text-[11px]">ASSIGNED DRIVER:</span>
                            <span className="font-mono text-xs font-bold text-white">
                              {b.driver?.name || 'Unassigned'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                            <span>{b.driver?.vehicleModel || b.vehicle}</span>
                            <span className="px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-300 font-bold">
                              {b.driver?.registration || 'NO REG'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800 text-slate-400">
                            <span>ETA / Deadline:</span>
                            <span className="text-sky-400 font-mono font-semibold">
                              {b.deliveryTime || '88 min'}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <GhostButton
                            isDarkMode={isDarkMode}
                            onClick={() => {
                              setEditingBooking(b);
                              setEditProgress(
                                b.progress ??
                                  (b.status === 'DELIVERED' ? 100 : b.status === 'SCHEDULED' ? 0 : 45)
                              );
                            }}
                            icon={<Sliders className="w-3.5 h-3.5" />}
                          >
                            Dispatch Controls
                          </GhostButton>

                          {/* Fast status switcher */}
                          <div className="flex items-center gap-1">
                            {b.status !== 'IN TRANSIT' && (
                              <button
                                onClick={() => handleQuickStatusChange(b, 'IN TRANSIT')}
                                title="Mark In transit"
                                className="px-2.5 py-1.5 rounded-full text-[10px] font-mono bg-sky-500/20 text-[#3898EC] border border-sky-500/40 hover:bg-sky-500/30 transition-all cursor-pointer font-bold"
                              >
                                Dispatch
                              </button>
                            )}
                            {b.status !== 'DELIVERED' && (
                              <button
                                onClick={() => handleQuickStatusChange(b, 'DELIVERED')}
                                title="Mark Delivered"
                                className="px-2.5 py-1.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all cursor-pointer font-bold"
                              >
                                Delivered
                              </button>
                            )}
                            {b.status !== 'CANCELLED' && (
                              <button
                                onClick={() => handleQuickStatusChange(b, 'CANCELLED')}
                                title="Cancel booking"
                                className="px-2 py-1.5 rounded-full text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-all cursor-pointer"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* EDIT MODAL / INLINE DRAWER */}
                      {isBeingEdited && (
                        <div className="mt-5 pt-5 border-t border-slate-700/40 bg-black/30 p-5 rounded-2xl">
                          <form onSubmit={handleSaveBookingEdit} className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-sm text-[#3898EC] flex items-center gap-2">
                                <Sliders className="w-4 h-4" />
                                <span>Edit Dispatch & Telemetry for {editingBooking.reference}</span>
                              </h4>
                              <button
                                type="button"
                                onClick={() => setEditingBooking(null)}
                                className="text-slate-400 hover:text-white"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <SelectField
                                label="Status"
                                isDarkMode={isDarkMode}
                                value={editingBooking.status}
                                onChange={(e) =>
                                  setEditingBooking({
                                    ...editingBooking,
                                    status: e.target.value as any,
                                  })
                                }
                                options={[
                                  { value: 'SCHEDULED', label: 'SCHEDULED (Awaiting)' },
                                  { value: 'IN TRANSIT', label: 'IN TRANSIT (Active)' },
                                  { value: 'DELIVERED', label: 'DELIVERED (Signed)' },
                                  { value: 'CANCELLED', label: 'CANCELLED' },
                                ]}
                              />

                              <Field
                                label="Driver Full Name"
                                isDarkMode={isDarkMode}
                                value={editingBooking.driver?.name || ''}
                                onChange={(e) =>
                                  setEditingBooking({
                                    ...editingBooking,
                                    driver: {
                                      name: e.target.value,
                                      vehicleModel: editingBooking.driver?.vehicleModel || editingBooking.vehicle,
                                      registration: editingBooking.driver?.registration || 'GN71 XPO',
                                      phone: editingBooking.driver?.phone || '07700 900821',
                                      status: 'ACTIVE ASSIGNMENT',
                                    },
                                  })
                                }
                                placeholder="e.g. Marek Kowalski"
                              />

                              <Field
                                label="Vehicle Model"
                                isDarkMode={isDarkMode}
                                value={editingBooking.driver?.vehicleModel || editingBooking.vehicle}
                                onChange={(e) =>
                                  setEditingBooking({
                                    ...editingBooking,
                                    vehicle: e.target.value,
                                    driver: {
                                      name: editingBooking.driver?.name || 'Marek Kowalski',
                                      vehicleModel: e.target.value,
                                      registration: editingBooking.driver?.registration || 'GN71 XPO',
                                      phone: editingBooking.driver?.phone || '07700 900821',
                                      status: 'ACTIVE ASSIGNMENT',
                                    },
                                  })
                                }
                                placeholder="e.g. Sprinter LWB"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Field
                                label="Vehicle Registration"
                                isDarkMode={isDarkMode}
                                value={editingBooking.driver?.registration || ''}
                                onChange={(e) =>
                                  setEditingBooking({
                                    ...editingBooking,
                                    driver: {
                                      name: editingBooking.driver?.name || 'Marek Kowalski',
                                      vehicleModel: editingBooking.driver?.vehicleModel || editingBooking.vehicle,
                                      registration: e.target.value,
                                      phone: editingBooking.driver?.phone || '07700 900821',
                                      status: 'ACTIVE ASSIGNMENT',
                                    },
                                  })
                                }
                                placeholder="e.g. GN71 XPO"
                              />

                              <Field
                                label="Driver Mobile Phone"
                                isDarkMode={isDarkMode}
                                value={editingBooking.driver?.phone || ''}
                                onChange={(e) =>
                                  setEditingBooking({
                                    ...editingBooking,
                                    driver: {
                                      name: editingBooking.driver?.name || 'Marek Kowalski',
                                      vehicleModel: editingBooking.driver?.vehicleModel || editingBooking.vehicle,
                                      registration: editingBooking.driver?.registration || 'GN71 XPO',
                                      phone: e.target.value,
                                      status: 'ACTIVE ASSIGNMENT',
                                    },
                                  })
                                }
                                placeholder="07700 900821"
                              />

                              <Field
                                label="ETA / Delivery Time"
                                isDarkMode={isDarkMode}
                                value={editingBooking.deliveryTime || ''}
                                onChange={(e) =>
                                  setEditingBooking({
                                    ...editingBooking,
                                    deliveryTime: e.target.value,
                                  })
                                }
                                placeholder="e.g. 88 min or 15:45"
                              />
                            </div>

                            {/* Live Route Progress Slider (0% to 100%) */}
                            <div className="space-y-2 pt-2 border-t border-slate-700/40">
                              <div className="flex items-center justify-between text-xs">
                                <label className="font-semibold text-slate-300">
                                  Live Corridor Route Progress (Dispatch Estimate):
                                </label>
                                <span className="font-mono font-bold text-[#3898EC]">
                                  {editProgress}% Complete
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={editProgress}
                                onChange={(e) => setEditProgress(Number(e.target.value))}
                                className="w-full accent-[#3898EC] cursor-pointer"
                              />
                              <div className="flex items-center gap-2 pt-1">
                                {[0, 25, 50, 75, 100].map((pct) => (
                                  <button
                                    key={pct}
                                    type="button"
                                    onClick={() => setEditProgress(pct)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                                      editProgress === pct
                                        ? 'bg-[#3898EC] text-white border-[#3898EC]'
                                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                                    }`}
                                  >
                                    {pct}%
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3">
                              <GhostButton
                                type="button"
                                isDarkMode={isDarkMode}
                                onClick={() => setEditingBooking(null)}
                              >
                                Cancel
                              </GhostButton>
                              <PrimaryButton type="submit">
                                Save Dispatch Updates
                              </PrimaryButton>
                            </div>
                          </form>
                        </div>
                      )}
                    </Panel>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: STANDBY APPLICATIONS
            ========================================================================= */}
        {activeTab === 'applications' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <Eyebrow text="CORPORATE CLIENT ONBOARDING" />
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Standby Account Applications
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Review £0 emergency freight standby applications submitted from the landing page. Approve credit facilities and activate instant dispatch accounts.
                </p>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  {applications.filter((a) => a.status === 'pending').length} Pending Review
                </span>
                <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  {applications.filter((a) => a.status === 'approved').length} Active Accounts
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {applications.length === 0 ? (
                <Panel isDarkMode={isDarkMode}>
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No standby applications registered yet. Submit an application in the landing page Onboarding form to test.
                  </div>
                </Panel>
              ) : (
                applications.map((app) => (
                  <Panel key={app.id} isDarkMode={isDarkMode}>
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                      {/* Left: Company & Key Person */}
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="font-extrabold text-lg text-white">
                            {app.company_name}
                          </h3>
                          {app.trading_name && (
                            <span className="text-xs text-slate-400 font-mono">
                              t/a {app.trading_name}
                            </span>
                          )}
                          <StatusPill status={app.status === 'approved' ? 'APPROVED' : 'PENDING'} />
                          {app.account_code && (
                            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-[#3898EC]/10 text-[#3898EC] border border-[#3898EC]/30 font-bold">
                              {app.account_code}
                            </span>
                          )}
                        </div>

                        {/* Address */}
                        <div className="flex items-center gap-2 text-xs text-slate-300">
                          <MapPin className="w-3.5 h-3.5 text-[#3898EC] shrink-0" />
                          <span>
                            {app.dispatch_address}, {app.town_city} ({app.postcode})
                          </span>
                        </div>

                        {/* Contact Person Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 text-xs">
                          <div className="p-2.5 rounded-xl bg-black/20 border border-slate-800">
                            <span className="text-slate-400 text-[10px] uppercase font-mono block">
                              Primary Logistics Contact
                            </span>
                            <span className="font-bold text-white block mt-0.5">
                              {app.contact_name}
                            </span>
                            <span className="text-slate-400 text-[11px] block">
                              {app.job_title}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-black/20 border border-slate-800">
                            <span className="text-slate-400 text-[10px] uppercase font-mono block">
                              Direct Telephony
                            </span>
                            <div className="flex items-center gap-1.5 text-slate-200 mt-0.5">
                              <Phone className="w-3 h-3 text-[#3898EC]" />
                              <span>{app.driver_mobile}</span>
                            </div>
                            <span className="text-slate-400 text-[11px] block">
                              24/7 Desk: {app.emergency_line}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-black/20 border border-slate-800">
                            <span className="text-slate-400 text-[10px] uppercase font-mono block">
                              Operations & Billing
                            </span>
                            <div className="flex items-center gap-1.5 text-slate-200 mt-0.5 truncate">
                              <Mail className="w-3 h-3 text-[#3898EC]" />
                              <span className="truncate">{app.ops_email}</span>
                            </div>
                            <span className="text-slate-400 text-[11px] block truncate">
                              Accounts: {app.accounts_email}
                            </span>
                          </div>
                        </div>

                        {/* Freight Volume & Carriers */}
                        <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                          <span>
                            Monthly Volume: <strong className="text-white">{app.volume || '5-15 loads'}</strong>
                          </span>
                          <span>
                            Current Carriers:{' '}
                            <strong className="text-white">
                              {Array.isArray(app.selected_carriers)
                                ? app.selected_carriers.join(', ')
                                : 'DPD, DHL'}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Right: Approval Action */}
                      <div className="flex flex-col items-end justify-between gap-4 shrink-0">
                        <div className="text-right">
                          <span className="font-mono text-[10px] text-slate-400 uppercase block">
                            Credit Facility
                          </span>
                          <span className="font-extrabold text-lg text-emerald-400 block">
                            £15,000 Standby Limit
                          </span>
                          <span className="text-[11px] text-slate-400">
                            30-Day BACS Terms
                          </span>
                        </div>

                        {app.status === 'pending' ? (
                          <PrimaryButton
                            onClick={() => handleApproveApp(app.id)}
                            icon={<CheckCircle2 className="w-4 h-4" />}
                          >
                            Approve & Activate Account
                          </PrimaryButton>
                        ) : (
                          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold font-mono">
                            <Check className="w-3.5 h-3.5" />
                            <span>STANDBY ACCOUNT ACTIVE</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Panel>
                ))
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: QUOTES & BILLING
            ========================================================================= */}
        {activeTab === 'billing' && (
          <div className="space-y-8">
            {/* Section A: Quotes Management */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <Eyebrow text="TARIFF LOCK & TENDER" />
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                    Customer Quotes
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Issue new locked emergency freight quotes directly to customer accounts. Quotes reflect instantly in the Customer Portal.
                  </p>
                </div>

                <PrimaryButton
                  onClick={() => setIsNewQuoteOpen(true)}
                  icon={<Plus className="w-4 h-4" />}
                >
                  Issue New Quote
                </PrimaryButton>
              </div>

              {/* Issue New Quote Form (Modal/Drawer) */}
              {isNewQuoteOpen && (
                <Panel isDarkMode={isDarkMode} className="border-[#3898EC]/40 bg-[#091322]">
                  <form onSubmit={handleCreateQuote} className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-700/40">
                      <h3 className="font-bold text-sm text-[#3898EC] flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        <span>Issue New Customer Quote</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setIsNewQuoteOpen(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <Field
                        label="Pickup Origin"
                        isDarkMode={isDarkMode}
                        value={quoteOrigin}
                        onChange={(e) => setQuoteOrigin(e.target.value)}
                        placeholder="e.g. Manchester M17 1AB"
                        required
                      />

                      <Field
                        label="Drop-off Destination"
                        isDarkMode={isDarkMode}
                        value={quoteDestination}
                        onChange={(e) => setQuoteDestination(e.target.value)}
                        placeholder="e.g. Birmingham B6 7EU"
                        required
                      />

                      <SelectField
                        label="Vehicle"
                        isDarkMode={isDarkMode}
                        value={quoteVehicle}
                        onChange={(e) => setQuoteVehicle(e.target.value)}
                        options={[
                          { value: 'Sprinter LWB', label: 'Sprinter LWB (3 Pallets · 1,200kg)' },
                          { value: 'Luton Box Tail-Lift', label: 'Luton Box with Tail-Lift (6 Pallets)' },
                          { value: 'Curtainsider 7.5t', label: 'Curtainsider 7.5t (10 Pallets)' },
                          { value: 'Small Van', label: 'Small Van (1 Pallet · 500kg)' },
                        ]}
                      />

                      <Field
                        label="Total Tariff (£)"
                        type="number"
                        isDarkMode={isDarkMode}
                        value={quoteTotal}
                        onChange={(e) => setQuoteTotal(Number(e.target.value))}
                        placeholder="355"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <GhostButton
                        type="button"
                        isDarkMode={isDarkMode}
                        onClick={() => setIsNewQuoteOpen(false)}
                      >
                        Cancel
                      </GhostButton>
                      <PrimaryButton type="submit">
                        Issue Quote to Customer
                      </PrimaryButton>
                    </div>
                  </form>
                </Panel>
              )}

              {/* Quotes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {quotes.map((q) => (
                  <Panel key={q.id} isDarkMode={isDarkMode}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-[#3898EC]">
                          {q.reference}
                        </span>
                        <span className="font-mono text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                          {q.expiresText}
                        </span>
                      </div>

                      <div className="text-xs space-y-1">
                        <p className="font-semibold text-slate-300 truncate">
                          From: {q.origin}
                        </p>
                        <p className="font-semibold text-white truncate">
                          To: {q.destination}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-700/30 text-xs">
                        <span className="text-slate-400">{q.vehicle}</span>
                        <span className="font-extrabold text-base text-white">
                          £{q.total}
                        </span>
                      </div>

                      <div className="flex items-center justify-end pt-1">
                        <button
                          onClick={() => deleteQuote(q.id)}
                          className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                        >
                          Revoke Quote
                        </button>
                      </div>
                    </div>
                  </Panel>
                ))}
              </div>
            </div>

            {/* Section B: Invoicing & Billing Management */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <Eyebrow text="CREDIT FACILITY & SETTLEMENT" />
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                    Invoices & Statements
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Manage 30-day corporate consolidated statements. Toggle invoice payment states to reflect across customer portal metrics.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {invoices.map((inv) => (
                  <Panel key={inv.id} isDarkMode={isDarkMode} compact>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[#3898EC]/10 border border-[#3898EC]/20 flex items-center justify-center font-mono text-[#3898EC] font-bold text-xs shrink-0">
                          INV
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-white">
                              {inv.reference}
                            </span>
                            <StatusPill status={inv.status} />
                          </div>
                          <span className="text-xs text-slate-400 font-mono">
                            Period: {inv.period} · Date: {inv.date}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <span className="text-slate-400 text-[10px] font-mono uppercase block">
                            Statement Total
                          </span>
                          <span className="text-lg font-extrabold text-white">
                            £{inv.amount.toLocaleString()}
                          </span>
                        </div>

                        {/* Status Toggle Button */}
                        <GhostButton
                          isDarkMode={isDarkMode}
                          onClick={() => handleToggleInvoice(inv.id, inv.status)}
                        >
                          Toggle: {inv.status === 'DUE' ? 'Mark Paid' : inv.status === 'PAID' ? 'Mark Overdue' : 'Mark Due'}
                        </GhostButton>
                      </div>
                    </div>
                  </Panel>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: POD & DOCUMENTS
            ========================================================================= */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <Eyebrow text="COMPLIANCE & PROOF OF DELIVERY REPOSITORY" />
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  POD & Consignment Documents
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Upload signed Proof of Delivery receipts, CMR international consignment notes, and audited dock stamps directly to customer shipments.
                </p>
              </div>

              <PrimaryButton
                onClick={() => setIsNewDocOpen(true)}
                icon={<Upload className="w-4 h-4" />}
              >
                Upload / Attach POD
              </PrimaryButton>
            </div>

            {/* Attach Document Modal / Form */}
            {isNewDocOpen && (
              <Panel isDarkMode={isDarkMode} className="border-[#3898EC]/40 bg-[#091322]">
                <form onSubmit={handleCreateDocument} className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-700/40">
                    <h3 className="font-bold text-sm text-[#3898EC] flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      <span>Attach Proof of Delivery or CMR to Booking</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsNewDocOpen(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <SelectField
                      label="Link to Booking"
                      isDarkMode={isDarkMode}
                      value={docBookingRef}
                      onChange={(e) => setDocBookingRef(e.target.value)}
                      options={bookings.map((b) => ({
                        value: b.reference,
                        label: `${b.reference} (${b.origin} → ${b.destination})`,
                      }))}
                    />

                    <Field
                      label="Document Title"
                      isDarkMode={isDarkMode}
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      placeholder="e.g. Signed Delivery Receipt Bay 4"
                      required
                    />

                    <SelectField
                      label="Document Category"
                      isDarkMode={isDarkMode}
                      value={docCategory}
                      onChange={(e) => setDocCategory(e.target.value as any)}
                      options={[
                        { value: 'pod', label: 'Proof of Delivery (POD)' },
                        { value: 'cmr', label: 'CMR Consignment Note' },
                        { value: 'invoice', label: 'Consolidated Invoice' },
                        { value: 'compliance', label: 'ADR & Compliance Certificate' },
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field
                      label="Signee Name / Receiving Dept"
                      isDarkMode={isDarkMode}
                      value={docSigner}
                      onChange={(e) => setDocSigner(e.target.value)}
                      placeholder="e.g. G. Henderson · Goods Inwards"
                    />

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-6">
                      <label className="cursor-pointer px-3 py-2 rounded-xl bg-[#3898EC]/10 hover:bg-[#3898EC]/20 border border-[#3898EC]/30 text-[#3898EC] text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{docFile ? 'Replace File' : 'Select File (.pdf/.png)'}</span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setDocFile(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                      <div className="px-3 py-2 rounded-xl bg-black/30 border border-slate-700 text-slate-400 text-xs font-mono flex-1 flex items-center justify-between">
                        <span className="truncate">{docFile ? docFile.name : `signed_pod_${docBookingRef.toLowerCase()}.pdf`}</span>
                        <span className="text-[#3898EC] shrink-0 ml-2">{docFile ? `${Math.round(docFile.size / 1024)} KB` : '248 KB'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <GhostButton
                      type="button"
                      isDarkMode={isDarkMode}
                      onClick={() => setIsNewDocOpen(false)}
                    >
                      Cancel
                    </GhostButton>
                    <PrimaryButton type="submit">
                      Save & Link Document
                    </PrimaryButton>
                  </div>
                </form>
              </Panel>
            )}

            {/* Documents List */}
            <div className="space-y-3">
              {documents.map((doc) => (
                <Panel key={doc.id} isDarkMode={isDarkMode} compact>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-white">
                            {doc.title}
                          </h4>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 uppercase">
                            {doc.type}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">
                          Date: {doc.date} · File size: {doc.fileSize || '184 KB'} · Audited & Tamper-Sealed
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verified</span>
                      </span>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

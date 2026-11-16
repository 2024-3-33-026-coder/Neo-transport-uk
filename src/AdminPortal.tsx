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
  Headphones,
  MessageSquare,
  Send,
  Loader2,
  UserPlus,
  KeyRound,
  Copy,
  CheckCheck,
  Ban,
  UserCheck,
  UserX,
  ArrowRight,
  Package,
  Tag,
  Calendar,
  Info,
  ChevronRight,
  SlidersHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  Booking,
  Quote,
  Invoice,
  DocumentItem,
  SupportTicket,
  SupportTicketMessage,
  ProfileWithCompany,
  CompanyDetails,
} from './types';
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
  uploadDocumentFile,
  removeDocumentFile,
  getPersistedTickets,
  updateSupportTicketStatus,
  getPersistedTicketMessages,
  addTicketMessage,
  getPersistedProfiles,
  createProfile,
  updateProfileStatus,
  updateProfileRole,
  triggerAdminPasswordReset,
  getPersistedCompanies,
  createCompany,
  executeSpokeDryRun,
  executeSpokePilotDispatch,
  isPilotDispatchExecutable,
  SpokeDryRunResult,
  SpokePilotDispatchResult,
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

import { isSupabaseConfigured, supabase } from './lib/supabase';
import { AIRCALL_CONFIG, getAircallDialUrl, initiateAircallDial } from './lib/aircall';

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

export type AdminTab = 'dispatch' | 'users' | 'applications' | 'billing' | 'documents' | 'tickets';

interface AdminPortalProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onSignOut: () => void;
  onSwitchToCustomerPortal: () => void;
  userRole?: string;
  currentUserId?: string;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  isDarkMode,
  onToggleTheme,
  onSignOut,
  onSwitchToCustomerPortal,
  userRole = 'admin',
  currentUserId,
}) => {
  if (userRole !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060b11] text-white p-6">
        <div className="max-w-md w-full bg-[#12151b] border border-rose-500/30 rounded-xl p-6 text-center space-y-4">
          <div className="w-10 h-10 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <X className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Access Restricted</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            NEO Fleet Dispatch Control requires verified administrative clearance. Your authenticated user account does not have admin permissions.
          </p>
          <button
            onClick={onSwitchToCustomerPortal}
            className="bg-[#206bc4] hover:bg-[#1a5bb0] active:bg-[#164e96] text-white px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors"
          >
            Return to Customer Portal
          </button>
        </div>
      </div>
    );
  }
  const [activeTab, setActiveTab] = useState<AdminTab>('dispatch');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [applications, setApplications] = useState<StandbyApplication[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [profiles, setProfiles] = useState<ProfileWithCompany[]>([]);
  const [companies, setCompanies] = useState<CompanyDetails[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('ALL');
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedBookingDetails, setSelectedBookingDetails] = useState<Booking | null>(null);
  const [copiedBookingRef, setCopiedBookingRef] = useState<string | null>(null);

  const handleCopyBookingRef = (ref: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(ref);
      setCopiedBookingRef(ref);
      setTimeout(() => {
        setCopiedBookingRef((prev) => (prev === ref ? null : prev));
      }, 2000);
    }
  };

  // User Management State
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('ALL');

  // Create User Form State
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [createFullName, setCreateFullName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createCompanyId, setCreateCompanyId] = useState('');
  const [createNewCompanyMode, setCreateNewCompanyMode] = useState(false);
  const [createCompanyName, setCreateCompanyName] = useState('');
  const [createRole, setCreateRole] = useState<'customer' | 'admin'>('customer');
  const [createPassword, setCreatePassword] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [createdUserResult, setCreatedUserResult] = useState<{
    profile: ProfileWithCompany;
    temporaryPassword?: string;
  } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // User Quick Action State
  const [isMutatingUser, setIsMutatingUser] = useState<string | null>(null);
  const [userActionError, setUserActionError] = useState<string | null>(null);
  const [userActionSuccess, setUserActionSuccess] = useState<string | null>(null);
  const [lastRecoveryLink, setLastRecoveryLink] = useState<{ email: string; url: string } | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.id) {
          setSessionUserId(session.user.id);
        }
      }).catch((e) => console.warn('[Admin Portal] Failed to read auth session:', e));
    }
  }, []);

  const activeAdminId = currentUserId || sessionUserId;

  // Ticket Search & Filter States
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('ALL');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isUpdatingTicketStatus, setIsUpdatingTicketStatus] = useState(false);

  // Ticket Conversation & Reply States
  const [ticketMessages, setTicketMessages] = useState<SupportTicketMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySuccess, setReplySuccess] = useState<string | null>(null);

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
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);

  // Spoke Pilot Dispatch Modal State (TASK-001)
  const [pilotDispatchBooking, setPilotDispatchBooking] = useState<Booking | null>(null);
  const [pilotDispatchDate, setPilotDispatchDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [pilotAuthToken, setPilotAuthToken] = useState<string>('');
  const [pilotConfirmed, setPilotConfirmed] = useState<boolean>(false);
  const [isDryRunLoading, setIsDryRunLoading] = useState<boolean>(false);
  const [dryRunResult, setDryRunResult] = useState<SpokeDryRunResult | null>(null);
  const [dryRunError, setDryRunError] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [dispatchSuccessResult, setDispatchSuccessResult] = useState<SpokePilotDispatchResult | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [existingClaimConflict, setExistingClaimConflict] = useState<any | null>(null);
  const [allowGeocodeOverride, setAllowGeocodeOverride] = useState<boolean>(false);

  // Refresh all store data
  const loadStoreData = async () => {
    try {
      const [b, a, q, inv, d, t, p, comp] = await Promise.all([
        getPersistedBookings(),
        getPersistedApplications(),
        getPersistedQuotes(),
        getPersistedInvoices(),
        getPersistedDocuments(),
        getPersistedTickets(),
        getPersistedProfiles(),
        getPersistedCompanies(),
      ]);
      setBookings(b);
      setApplications(a);
      setQuotes(q);
      setInvoices(inv);
      setDocuments(d);
      setTickets(t);
      setProfiles(p);
      setCompanies(comp);
      if (comp.length > 0 && !createCompanyId) {
        setCreateCompanyId(comp[0].id);
      }
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
      if (selectedTicket) {
        getPersistedTicketMessages(selectedTicket.id).then(setTicketMessages);
      }
    };

    window.addEventListener('neo_portal_sync', handleSync);
    return () => {
      window.removeEventListener('neo_portal_sync', handleSync);
    };
  }, [selectedTicket]);

  // Load ticket conversation whenever selectedTicket changes
  useEffect(() => {
    if (selectedTicket) {
      setReplyText('');
      setReplyError(null);
      setReplySuccess(null);
      setLoadingMessages(true);
      getPersistedTicketMessages(selectedTicket.id)
        .then((msgs) => setTicketMessages(msgs))
        .catch((err) => console.error('Failed fetching ticket messages:', err))
        .finally(() => setLoadingMessages(false));
    } else {
      setTicketMessages([]);
      setReplyText('');
      setReplyError(null);
      setReplySuccess(null);
    }
  }, [selectedTicket?.id]);

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

  // Filtered Users
  const filteredProfiles = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    return profiles.filter((p) => {
      const matchSearch =
        !q ||
        p.full_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.companies?.name && p.companies.name.toLowerCase().includes(q)) ||
        (p.companies?.account_code && p.companies.account_code.toLowerCase().includes(q)) ||
        p.id.toLowerCase().includes(q);

      if (!matchSearch) return false;
      if (userRoleFilter !== 'ALL' && p.role !== userRoleFilter) return false;
      if (userStatusFilter !== 'ALL' && (p.status || 'active') !== userStatusFilter) return false;
      return true;
    });
  }, [profiles, userSearch, userRoleFilter, userStatusFilter]);

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = createFullName.trim();
    const email = createEmail.trim().toLowerCase();

    if (!name) {
      setCreateUserError('Full name is required.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setCreateUserError('A valid email address is required.');
      return;
    }
    if (createPassword.trim() && createPassword.trim().length < 8) {
      setCreateUserError('If specified, password must be at least 8 characters long.');
      return;
    }

    setIsCreatingUser(true);
    setCreateUserError(null);

    let targetCompId = createCompanyId;

    if (createNewCompanyMode && createCompanyName.trim()) {
      try {
        const cleanCompName = createCompanyName.trim();
        const genId = `comp-${cleanCompName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'client'}-${Date.now().toString(36)}`;
        const codeSuffix = Math.floor(100 + Math.random() * 900);
        const newComp = await createCompany({
          name: cleanCompName,
          account_code: `NEO-SB-${new Date().getFullYear()}-${codeSuffix}`,
          standby_active: true,
          verified: true,
        });
        targetCompId = newComp.id;
        const refreshedCompanies = await getPersistedCompanies();
        setCompanies(refreshedCompanies);
      } catch (compErr: any) {
        setCreateUserError(`Failed to provision new company: ${compErr?.message || compErr}`);
        setIsCreatingUser(false);
        return;
      }
    } else if (!targetCompId || targetCompId === '__new__') {
      targetCompId = companies.length > 0 ? companies[0].id : 'comp-meridian-001';
    }

    try {
      const result = await createProfile({
        fullName: name,
        email,
        companyId: targetCompId,
        role: createRole,
        password: createPassword.trim() || undefined,
      });

      setCreatedUserResult(result);
      const refreshed = await getPersistedProfiles();
      setProfiles(refreshed);
    } catch (err: any) {
      setCreateUserError(err?.message || 'Failed to create user account.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleCloseCreateUser = () => {
    setIsCreateUserOpen(false);
    setCreateFullName('');
    setCreateEmail('');
    setCreatePassword('');
    setCreateRole('customer');
    setCreateCompanyId('');
    setCreateNewCompanyMode(false);
    setCreateCompanyName('');
    setCreateUserError(null);
    setCreatedUserResult(null);
    setCopiedPassword(false);
  };

  const handleCopyPassword = () => {
    if (createdUserResult?.temporaryPassword) {
      navigator.clipboard.writeText(createdUserResult.temporaryPassword);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 3000);
    }
  };

  const handleToggleUserStatus = async (user: ProfileWithCompany) => {
    if (isMutatingUser) return;
    const nextStatus = user.status === 'suspended' ? 'active' : 'suspended';

    // Prevent self-suspension in UI
    if (activeAdminId && user.id === activeAdminId && nextStatus === 'suspended') {
      setUserActionError('Administrators cannot suspend their own account.');
      return;
    }

    setUserActionError(null);
    setUserActionSuccess(null);
    setIsMutatingUser(user.id);
    try {
      const updated = await updateProfileStatus(user.id, nextStatus);
      setProfiles((prev) => prev.map((p) => (p.id === user.id ? updated : p)));
      setUserActionSuccess(
        `User ${user.full_name} (${user.email}) status successfully updated to ${nextStatus.toUpperCase()}.`
      );
      // Background directory refresh from server
      getPersistedProfiles().then(setProfiles).catch(() => {});
    } catch (err: any) {
      setUserActionError(err?.message || 'Failed to update user status.');
    } finally {
      setIsMutatingUser(null);
    }
  };

  const handleToggleUserRole = async (user: ProfileWithCompany) => {
    if (isMutatingUser) return;
    const nextRole = user.role === 'admin' ? 'customer' : 'admin';

    // Prevent self-demotion in UI
    if (activeAdminId && user.id === activeAdminId && nextRole !== 'admin') {
      setUserActionError('Administrators cannot demote their own account. Another administrator must perform this action.');
      return;
    }

    setUserActionError(null);
    setUserActionSuccess(null);
    setIsMutatingUser(user.id);
    try {
      const updated = await updateProfileRole(user.id, nextRole);
      setProfiles((prev) => prev.map((p) => (p.id === user.id ? updated : p)));
      setUserActionSuccess(
        `User ${user.full_name} role updated to ${nextRole === 'admin' ? 'Administrator' : 'Customer'}.`
      );
      // Background directory refresh from server
      getPersistedProfiles().then(setProfiles).catch(() => {});
    } catch (err: any) {
      setUserActionError(err?.message || 'Failed to update user role.');
    } finally {
      setIsMutatingUser(null);
    }
  };

  const handleTriggerReset = async (user: ProfileWithCompany) => {
    if (isMutatingUser) return;
    setUserActionError(null);
    setUserActionSuccess(null);
    setLastRecoveryLink(null);
    setIsMutatingUser(user.id);
    try {
      const res = await triggerAdminPasswordReset({ email: user.email, targetUserId: user.id });
      if (res.success && res.emailDispatched) {
        setUserActionSuccess(res.message || `Password reset link dispatched to ${user.email}.`);
      } else if (res.partialSuccess && res.recoveryLink) {
        setUserActionSuccess(res.message);
        setLastRecoveryLink({ email: user.email, url: res.recoveryLink });
      } else {
        setUserActionError(res.message || 'Password reset could not be completed.');
      }
    } catch (err: any) {
      setUserActionError(err?.message || 'Failed to send password reset email.');
    } finally {
      setIsMutatingUser(null);
    }
  };

  // Handle Booking Save in Dispatch Board
  const handleSaveBookingEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;

    // Status integrity guards: Prevent manual transition to IN TRANSIT or DELIVERED from admin edit controls
    const matchesEditingBooking = (b: Booking) =>
      Boolean((editingBooking.id && (b.id === editingBooking.id || b.reference === editingBooking.id)) ||
      (editingBooking.reference && (b.reference === editingBooking.reference || b.id === editingBooking.reference)));
    const existing = bookings.find(matchesEditingBooking);
    if (editingBooking.status === 'IN TRANSIT' && existing?.status !== 'IN TRANSIT') {
      alert('Spoke dispatch integration pending: Bookings cannot be transitioned to In transit from manual admin controls.');
      return;
    }
    if (editingBooking.status === 'DELIVERED' && existing?.status !== 'DELIVERED') {
      alert('Operational completion required: Bookings can only be marked Delivered via verified Spoke delivery events or signed POD.');
      return;
    }

    const updatedBooking: Booking = {
      ...editingBooking,
      progress: editingBooking.status === 'SCHEDULED' ? (existing?.progress ?? 0.05) : editProgress,
    };
    const updated = await updateBooking(updatedBooking);
    setBookings(updated);
    setEditingBooking(null);
  };

  // Quick Status change directly from list
  const handleQuickStatusChange = async (booking: Booking, newStatus: 'IN TRANSIT' | 'DELIVERED' | 'SCHEDULED' | 'CANCELLED') => {
    if (newStatus === 'IN TRANSIT') {
      alert('Spoke dispatch integration pending: Bookings cannot be transitioned to In transit from manual UI buttons. Dispatches must be executed via the verified server-side Spoke integration pipeline.');
      return;
    }
    if (newStatus === 'DELIVERED') {
      alert('Operational completion required: Bookings can only be marked Delivered via verified Spoke delivery completion events or signed POD.');
      return;
    }

    if (newStatus === 'CANCELLED') {
      const updatedBooking: Booking = {
        ...booking,
        status: 'CANCELLED',
        driver: booking.driver
          ? {
              ...booking.driver,
              status: 'STANDBY RELEASED',
            }
          : undefined,
      };
      const updatedList = await updateBooking(updatedBooking);
      setBookings(updatedList);
    }
  };

  // Spoke Pilot Dispatch Handlers (TASK-001)
  const handleOpenPilotDispatchModal = (b: Booking) => {
    if (b.status !== 'SCHEDULED') return;
    const todayStr = new Date().toISOString().split('T')[0];
    setPilotDispatchBooking(b);
    setPilotDispatchDate(todayStr);
    setPilotAuthToken('');
    setPilotConfirmed(false);
    setAllowGeocodeOverride(false);
    setDispatchSuccessResult(null);
    setDispatchError(null);
    setExistingClaimConflict(null);
    setDryRunResult(null);
    setDryRunError(null);

    fetchDryRunPreview(b.id, todayStr);
  };

  const fetchDryRunPreview = async (bookingId: string, planDate: string) => {
    setIsDryRunLoading(true);
    setDryRunError(null);
    setDryRunResult(null);
    try {
      const preview = await executeSpokeDryRun(bookingId, planDate);
      setDryRunResult(preview);
    } catch (err: any) {
      setDryRunError(err?.message || 'Failed to generate pre-flight dry-run preview.');
      setDryRunResult(null);
    } finally {
      setIsDryRunLoading(false);
    }
  };

  const handlePilotDispatchDateChange = (newDate: string) => {
    setPilotDispatchDate(newDate);
    // Immediate invalidation: changing plan date invalidates previous pre-flight results
    setDryRunResult(null);
    setDryRunError(null);
    setAllowGeocodeOverride(false);
    if (pilotDispatchBooking && newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      fetchDryRunPreview(pilotDispatchBooking.id, newDate);
    } else {
      setDryRunError('A valid plan date (YYYY-MM-DD) is required to generate dry-run preview.');
    }
  };

  const handleExecutePilotDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    // Fail-Closed Guard: Block execution if dry-run is absent, unverified, errored, or loading
    if (
      isDispatching ||
      isDryRunLoading ||
      !dryRunResult ||
      !dryRunResult.success ||
      Boolean(dryRunError) ||
      !pilotDispatchBooking ||
      !pilotAuthToken.trim() || !pilotConfirmed ||
      !isPilotDispatchExecutable({
        isDispatching,
        isDryRunLoading,
        dryRunResult,
        dryRunError,
        pilotAuthToken,
        pilotConfirmed,
        pilotDispatchBooking,
        allowGeocodeOverride,
      })
    ) {
      if (dryRunError || !dryRunResult || !dryRunResult.success) {
        setDispatchError('Pre-flight dry-run validation must succeed before pilot dispatch can be executed.');
      } else if (dryRunResult?.geocoding?.anyRequiresManualReview && !allowGeocodeOverride) {
        setDispatchError('Dispatch blocked: address geocoding requires manual review and explicit authorization.');
      }
      return;
    }

    setIsDispatching(true);
    setDispatchError(null);

    try {
      const result = await executeSpokePilotDispatch({
        bookingId: pilotDispatchBooking.id,
        planDate: pilotDispatchDate,
        pilotAuthorizationToken: pilotAuthToken.trim(),
        allowImpreciseGeocodeOverride: allowGeocodeOverride,
      });

      if (result && result.success && result.planId) {
        setDispatchSuccessResult(result);

        // Authoritatively refresh bookings from database without fabricating local state
        const refreshedBookings = await getPersistedBookings();
        setBookings(refreshedBookings);
      } else {
        throw new Error(result?.error || 'Pilot dispatch returned unverified outcome.');
      }
    } catch (err: any) {
      setDispatchError(err?.message || 'Pilot dispatch execution failed.');
      if (err?.existingClaim) {
        setExistingClaimConflict(err.existingClaim);
      }
    } finally {
      setIsDispatching(false);
    }
  };

  const handleRecoverExistingPlan = async () => {
    if (!pilotDispatchBooking || !pilotAuthToken.trim()) return;
    setIsDispatching(true);
    setDispatchError(null);
    try {
      const result = await executeSpokePilotDispatch({
        bookingId: pilotDispatchBooking.id,
        planDate: pilotDispatchDate,
        pilotAuthorizationToken: pilotAuthToken.trim(),
        recoverExistingPlan: true,
      });
      if (result && result.success && result.planId) {
        setDispatchSuccessResult(result);
        const refreshedBookings = await getPersistedBookings();
        setBookings(refreshedBookings);
      } else {
        throw new Error(result?.error || 'Plan recovery returned unverified outcome.');
      }
    } catch (err: any) {
      setDispatchError(err?.message || 'Plan recovery execution failed.');
      if (err?.existingClaim) setExistingClaimConflict(err.existingClaim);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleSupersedeStaleClaimAndDispatch = async () => {
    if (!pilotDispatchBooking || !pilotAuthToken.trim()) return;
    setIsDispatching(true);
    setDispatchError(null);
    try {
      const result = await executeSpokePilotDispatch({
        bookingId: pilotDispatchBooking.id,
        planDate: pilotDispatchDate,
        pilotAuthorizationToken: pilotAuthToken.trim(),
        supersedeStaleClaim: true,
        staleResolutionReason: `Admin superseded stale claim (${existingClaimConflict?.planDate || 'previous attempt'}) for same-day dispatch on ${pilotDispatchDate}.`,
        allowImpreciseGeocodeOverride: allowGeocodeOverride,
      });
      if (result && result.success && result.planId) {
        setDispatchSuccessResult(result);
        const refreshedBookings = await getPersistedBookings();
        setBookings(refreshedBookings);
      } else {
        throw new Error(result?.error || 'Same-day pilot dispatch returned unverified outcome.');
      }
    } catch (err: any) {
      setDispatchError(err?.message || 'Same-day pilot dispatch execution failed.');
      if (err?.existingClaim) setExistingClaimConflict(err.existingClaim);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleClosePilotDispatchModal = () => {
    if (isDispatching) return;
    setPilotDispatchBooking(null);
    setDispatchSuccessResult(null);
    setDispatchError(null);
    setDryRunResult(null);
    setDryRunError(null);
    setPilotAuthToken('');
    setPilotConfirmed(false);
    setAllowGeocodeOverride(false);
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
    if (isUploadingDoc) return;

    setDocUploadError(null);

    const booking = bookings.find((b) => b.reference === docBookingRef);
    if (!booking) {
      setDocUploadError(`Selected booking "${docBookingRef}" was not found.`);
      return;
    }

    if (!booking.company_id || !booking.company_id.trim()) {
      setDocUploadError(`Selected booking "${booking.reference}" is not associated with a valid company.`);
      return;
    }

    if (!docFile) {
      setDocUploadError('Please select a document file (.pdf, .png, .jpg) to upload.');
      return;
    }

    if (!docTitle.trim()) {
      setDocUploadError('Please provide a document title.');
      return;
    }

    setIsUploadingDoc(true);
    let uploadedStoragePath: string | null = null;

    try {
      const uploadResult = await uploadDocumentFile(docFile, booking.company_id);
      uploadedStoragePath = uploadResult.storagePath;

      const newDoc: DocumentItem = {
        id: `doc-${Date.now()}`,
        title: `${docTitle.trim()} (${booking.reference})`,
        type: docCategory.toUpperCase(),
        date: 'Today',
        category: docCategory,
        fileSize: `${Math.round(docFile.size / 1024)} KB`,
        verified: true,
        pdf_url: uploadedStoragePath,
      };

      const updated = await addDocument(newDoc, booking.company_id, booking.id || booking.reference);
      setDocuments(updated);
      setIsNewDocOpen(false);
      setDocFile(null);
      setDocUploadError(null);
    } catch (err: any) {
      console.error('Failed to attach document:', err);
      let errorMsg = err?.message || 'Failed to attach document. Please try again.';

      if (uploadedStoragePath) {
        try {
          await removeDocumentFile(uploadedStoragePath);
        } catch (cleanupErr: any) {
          console.warn('Storage cleanup failed after database insert error:', cleanupErr);
          errorMsg = `${errorMsg} (Storage cleanup failed: ${cleanupErr?.message || 'unknown error'})`;
        }
      }

      setDocUploadError(errorMsg);
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Handle Support Ticket Status Update
  const handleUpdateTicketStatus = async (
    ticketId: string,
    newStatus: 'Open' | 'In Progress' | 'Resolved'
  ) => {
    setIsUpdatingTicketStatus(true);
    try {
      const updated = await updateSupportTicketStatus(ticketId, newStatus);
      setTickets(updated);
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err) {
      console.error('Failed to update ticket status:', err);
    } finally {
      setIsUpdatingTicketStatus(false);
    }
  };

  // Handle Admin Sending Reply
  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim() || isSendingReply) return;

    setIsSendingReply(true);
    setReplyError(null);
    setReplySuccess(null);

    try {
      const newMsg = await addTicketMessage(
        selectedTicket.id,
        replyText.trim(),
        'admin',
        'NEO Duty Dispatch'
      );
      setTicketMessages((prev) => [...prev.filter((m) => m.id !== newMsg.id), newMsg]);
      setReplyText('');
      setReplySuccess('Reply delivered & logged.');
      setTimeout(() => setReplySuccess(null), 3000);
    } catch (err: unknown) {
      console.error('Failed sending admin reply:', err);
      const msg = err instanceof Error ? err.message : 'Failed to send reply. Please check connection.';
      setReplyError(msg);
    } finally {
      setIsSendingReply(false);
    }
  };

  // Filtered Support Tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const q = ticketSearch.toLowerCase();
      const matchSearch =
        t.id.toLowerCase().includes(q) ||
        t.topic.toLowerCase().includes(q) ||
        t.message.toLowerCase().includes(q) ||
        (t.company_name && t.company_name.toLowerCase().includes(q)) ||
        (t.date && t.date.toLowerCase().includes(q));

      if (!matchSearch) return false;
      if (ticketStatusFilter !== 'ALL' && t.status !== ticketStatusFilter) return false;
      return true;
    });
  }, [tickets, ticketSearch, ticketStatusFilter]);

  return (
    <div
      className={`min-h-screen transition-colors duration-200 font-sans ${
        isDarkMode ? 'bg-[#060b11] text-white' : 'bg-[#f8fafc] text-slate-900'
      }`}
    >
      {/* 1. TOP DISPATCH ADMIN HEADER */}
      <header
        className={`w-full h-16 border-b transition-colors duration-200 z-30 sticky top-0 backdrop-blur-md px-3 sm:px-4 lg:px-8 flex items-center justify-between ${
          isDarkMode
            ? 'bg-[#060b11]/90 border-[#172334] text-white'
            : 'bg-white/95 backdrop-blur-sm border-slate-200/80 text-slate-900 shadow-advertz'
        }`}
      >
        <div className="flex items-center gap-3">
          <Logo subtitle="24/7 FLEET DISPATCH CONTROL" isAdmin={true} isDarkMode={isDarkMode} />
        </div>

        {/* System dispatch indicator */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>UK corridor dispatch estimates · Active</span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Aircall Operations Telephony Desk */}
          <button
            onClick={() => initiateAircallDial(AIRCALL_CONFIG.hqNumber, true)}
            title={`Aircall Operations Desk: ${AIRCALL_CONFIG.hqNumber} (${AIRCALL_CONFIG.primaryAgent}) — Click to open Aircall Phone`}
            className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 transition-colors cursor-pointer shadow-xs"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Aircall HQ</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </button>

          {/* Switch to Customer Portal button */}
          <button
            onClick={onSwitchToCustomerPortal}
            title="Switch to Customer Portal view"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 dark:bg-[#206bc4]/10 dark:hover:bg-[#206bc4]/20 dark:text-[#206bc4] dark:border-[#206bc4]/30 transition-colors cursor-pointer shadow-xs"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Customer portal</span>
          </button>

          <ThemeToggle isDarkMode={isDarkMode} onToggleTheme={onToggleTheme} />

          <button
            onClick={onSignOut}
            title="Sign out of Admin Dispatch"
            className={`p-2 rounded-full border transition-colors cursor-pointer ${
              isDarkMode
                ? 'border-[#1e2229] hover:bg-[#1a1f28] text-slate-400 hover:text-white'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 shadow-advertz'
            }`}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. ADMIN NAVIGATION TABS */}
      <div
        className={`w-full border-b sticky top-16 z-20 backdrop-blur-md px-4 lg:px-8 py-2.5 transition-colors ${
          isDarkMode ? 'bg-[#080f18]/95 border-[#172334]' : 'bg-white/95 backdrop-blur-sm border-slate-200/80 shadow-advertz'
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
                id: 'users',
                label: 'User Accounts',
                icon: Users,
                badge: profiles.length,
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
              {
                id: 'tickets',
                label: 'Support Tickets',
                icon: Headphones,
                badge: tickets.filter((t) => t.status === 'Open').length,
              },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as AdminTab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium shrink-0 cursor-pointer select-none border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : isDarkMode
                      ? 'bg-[#12151b] text-slate-400 border-[#1e2229] hover:text-white hover:border-slate-600'
                      : 'bg-white text-slate-600 border-slate-200 shadow-advertz hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-blue-50 text-blue-700 border border-blue-200/80'
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
              className={`p-2 rounded-lg text-xs border transition-colors cursor-pointer flex items-center gap-1.5 ${
                isDarkMode
                  ? 'border-[#1e2229] text-slate-400 hover:text-white hover:bg-[#1a1f28]'
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
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8 space-y-6">
        <div key={activeTab} className="animate-view-entrance space-y-6">
          {/* =========================================================================
              TAB 1: DISPATCH BOARD (BOOKINGS)
              ========================================================================= */}
          {activeTab === 'dispatch' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <Eyebrow text="Operations dispatch console" />
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
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
                    className={`px-3 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                      bookingStatusFilter === st
                        ? 'bg-[#206bc4] text-white font-medium'
                        : isDarkMode
                        ? 'bg-[#12151b] text-slate-400 border border-[#1e2229] hover:text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {st === 'ALL' ? 'All' : st === 'IN TRANSIT' ? 'In transit' : st === 'SCHEDULED' ? 'Scheduled' : st === 'DELIVERED' ? 'Delivered' : 'Cancelled'}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick KPI stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <Panel isDarkMode={isDarkMode} compact>
                <span
                  className={`font-mono text-[10px] uppercase ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500 font-semibold'
                  }`}
                >
                  Total Bookings
                </span>
                <p
                  className={`text-2xl font-black mt-1 ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {bookings.length}
                </p>
                <span
                  className={`text-[11px] font-mono ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Real-time synced
                </span>
              </Panel>
              <Panel isDarkMode={isDarkMode} compact>
                <span className="font-mono text-[10px] uppercase text-sky-400 font-semibold">In Transit</span>
                <p className="text-2xl font-black text-[#3898EC] mt-1">
                  {bookings.filter((b) => b.status === 'IN TRANSIT').length}
                </p>
                <span
                  className={`text-[11px] font-mono ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Wheels rolling
                </span>
              </Panel>
              <Panel isDarkMode={isDarkMode} compact>
                <span
                  className={`font-mono text-[10px] uppercase font-semibold ${
                    isDarkMode ? 'text-amber-400' : 'text-amber-700'
                  }`}
                >
                  Scheduled
                </span>
                <p
                  className={`text-2xl font-black mt-1 ${
                    isDarkMode ? 'text-amber-400' : 'text-amber-700'
                  }`}
                >
                  {bookings.filter((b) => b.status === 'SCHEDULED').length}
                </p>
                <span
                  className={`text-[11px] font-mono ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Awaiting collection
                </span>
              </Panel>
              <Panel isDarkMode={isDarkMode} compact>
                <span
                  className={`font-mono text-[10px] uppercase font-semibold ${
                    isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                  }`}
                >
                  Delivered
                </span>
                <p
                  className={`text-2xl font-black mt-1 ${
                    isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                  }`}
                >
                  {bookings.filter((b) => b.status === 'DELIVERED').length}
                </p>
                <span
                  className={`text-[11px] font-mono ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Signed at dock
                </span>
              </Panel>
            </div>

            {/* Search Bar */}
            <div
              className={`p-3 rounded-2xl border flex items-center gap-3 transition-colors ${
                isDarkMode
                  ? 'bg-[#0b121c] border-[#172334] text-white'
                  : 'bg-white border-slate-200/90 text-slate-900 shadow-xs focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-[#3898EC]/15'
              }`}
            >
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                id="admin-dispatch-search"
                name="adminDispatchSearchQuery"
                type="search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                data-1p-ignore="true"
                placeholder="Search by booking reference (e.g. NT-24817), origin, destination, driver name, cargo..."
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
                className={`w-full text-xs bg-transparent focus:outline-none ${
                  isDarkMode
                    ? 'text-white placeholder-slate-500'
                    : 'text-slate-900 placeholder-slate-400'
                }`}
              />
              {bookingSearch && (
                <button
                  onClick={() => setBookingSearch('')}
                  className={`text-xs ${
                    isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                  }`}
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
                    <div
                      key={b.id}
                      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                        b.status === 'IN TRANSIT'
                          ? isDarkMode
                            ? 'bg-[#070D14] border-sky-500/30 shadow-lg shadow-sky-950/20'
                            : 'bg-white border-sky-300 shadow-md'
                          : isDarkMode
                          ? 'bg-[#070D14] border-[#142334] hover:border-[#1E3550] shadow-md'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                      }`}
                    >
                      <div className="p-5 sm:p-6">
                        <div className="flex flex-col xl:flex-row items-stretch gap-5">
                          {/* =========================================================
                              ZONE 1: BOOKING REF, STATUS, DATE/TIME, ROUTE & SPECS (~52%)
                              ========================================================= */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between space-y-4">
                            {/* Header: Ref + Copy + Status Pill + Date & Time */}
                            <div className="flex items-center flex-wrap gap-3">
                              <div className="flex items-center gap-2">
                                <span className={`font-mono text-xl sm:text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                  {b.reference}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyBookingRef(b.reference)}
                                  className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800/80 transition-all cursor-pointer"
                                  title="Copy Booking Reference"
                                  aria-label={`Copy reference ${b.reference}`}
                                >
                                  {copiedBookingRef === b.reference ? (
                                    <Check className="w-4 h-4 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </div>

                              {/* Status Pill */}
                              {b.status === 'IN TRANSIT' && (
                                <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-medium flex items-center gap-1.5 bg-sky-500/10 text-sky-400 border border-sky-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                  <span>In transit</span>
                                </span>
                              )}
                              {b.status === 'SCHEDULED' && (
                                <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-medium flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                  <span>Scheduled</span>
                                </span>
                              )}
                              {b.status === 'DELIVERED' && (
                                <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-medium flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <span>Delivered</span>
                                </span>
                              )}
                              {b.status === 'CANCELLED' && (
                                <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-medium flex items-center gap-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                  <span>Cancelled</span>
                                </span>
                              )}

                              {/* Date & Time */}
                              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                                <span>Date: {b.date || 'Today'}</span>
                                <span className="text-slate-600">|</span>
                                <span className={`font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                  {b.pickupTime || '12:30'}
                                </span>
                              </div>
                            </div>

                            {/* Route Flow (FROM -> TO with circular arrow button) */}
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3 py-1">
                              {/* Pickup (FROM) */}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                                    <MapPin className="w-3 h-3 text-emerald-400" />
                                  </div>
                                  <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">FROM</span>
                                </div>
                                <p className={`text-xs font-normal leading-relaxed line-clamp-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`} title={b.origin}>
                                  {b.origin}
                                </p>
                              </div>

                              {/* Circular Arrow Divider */}
                              <div className="hidden sm:flex flex-col items-center justify-center px-2">
                                <div className={`w-8 h-8 rounded-full border flex items-center justify-center shadow-xs ${
                                  isDarkMode ? 'bg-[#0E1724] border-[#1E2E42] text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-600'
                                }`}>
                                  <ArrowRight className="w-4 h-4" />
                                </div>
                              </div>

                              {/* Dropoff (TO) */}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <div className="w-5 h-5 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                                    <MapPin className="w-3 h-3 text-rose-400" />
                                  </div>
                                  <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">TO</span>
                                </div>
                                <p className={`text-xs font-normal leading-relaxed line-clamp-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`} title={b.destination}>
                                  {b.destination}
                                </p>
                              </div>
                            </div>

                            {/* Specs Strip (Vehicle, Cargo, Tariff) */}
                            <div className="flex items-center flex-wrap gap-5 pt-2 border-t border-slate-800/60 text-xs">
                              <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-slate-400 shrink-0" />
                                <span className="text-slate-400 text-[11px]">Vehicle</span>
                                <strong className={`text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{b.vehicle}</strong>
                              </div>

                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-slate-400 shrink-0" />
                                <span className="text-slate-400 text-[11px]">Cargo</span>
                                <strong className={`text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                  {b.cargo || (b.weightKg ? `Palletised parts · ${b.weightKg} kg` : 'Palletised goods')}
                                </strong>
                              </div>

                              <div className="flex items-center gap-2">
                                <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                                <span className="text-slate-400 text-[11px]">Tariff</span>
                                <strong className="text-sm font-bold text-emerald-400">£{b.total}</strong>
                              </div>
                            </div>
                          </div>

                          {/* =========================================================
                              ZONE 2: ASSIGNED DRIVER & SCHEDULE (~24%)
                              ========================================================= */}
                          <div className="w-full xl:w-[260px] 2xl:w-[280px] shrink-0">
                            <div className={`h-full p-4 rounded-xl border flex flex-col justify-between gap-2.5 ${
                              isDarkMode ? 'bg-[#04080F] border-[#142335]' : 'bg-slate-50 border-slate-200'
                            }`}>
                              {/* Driver Name Row */}
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                                  ASSIGNED DRIVER
                                </span>
                                <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${
                                  isDarkMode ? 'bg-[#132030] border-slate-700/40 text-slate-200' : 'bg-slate-200 border-slate-300 text-slate-800'
                                }`}>
                                  {b.driver?.name || 'Unassigned'}
                                </span>
                              </div>

                              {/* Vehicle Model & Registration */}
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-xs font-medium truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                  {b.driver?.vehicleModel || b.vehicle}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 border ${
                                  isDarkMode ? 'bg-[#0A1420] border-slate-800 text-slate-400' : 'bg-slate-200 border-slate-300 text-slate-700'
                                }`}>
                                  {b.driver?.registration || 'NO REG'}
                                </span>
                              </div>

                              {/* ETA */}
                              <div className="flex items-start gap-2 pt-1.5 border-t border-slate-800/60">
                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                <div className="flex-1 flex items-baseline justify-between gap-1">
                                  <span className="text-[11px] text-slate-400 font-medium">ETA</span>
                                  <div className="text-right">
                                    <span className="text-xs font-semibold text-[#00B4D8] block">
                                      Direct road transit
                                    </span>
                                    <span className="text-[10px] text-[#00B4D8]/80 block">
                                      (approx {b.deliveryTime || '17 min'})
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Deadline */}
                              <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800/60">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <div className="flex-1 flex items-center justify-between gap-1">
                                  <span className="text-[11px] text-slate-400 font-medium">Deadline</span>
                                  <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {b.date || 'Today'}, {b.deliveryTime?.includes(':') ? b.deliveryTime : '13:00'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* =========================================================
                              ZONE 3: ACTIONS PANEL (~24%)
                              ========================================================= */}
                          <div className="w-full xl:w-[240px] 2xl:w-[260px] shrink-0 flex flex-col justify-between gap-2.5">
                            {/* Top Primary Action */}
                            {b.status === 'IN TRANSIT' && (
                              <button
                                type="button"
                                onClick={() => setSelectedBookingDetails(b)}
                                className="w-full bg-[#061B2E] border border-[#0284C7]/40 hover:bg-[#09253F] text-[#38BDF8] rounded-xl py-2.5 px-3.5 flex items-center justify-between text-xs font-semibold transition-all shadow-xs cursor-pointer"
                                title="Delivery completion requires verified Spoke stop event or signed POD"
                              >
                                <div className="flex items-center gap-2">
                                  <Info className="w-4 h-4 shrink-0 text-[#38BDF8]" />
                                  <span>Delivery event pending</span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-[#38BDF8]/70" />
                              </button>
                            )}

                            {b.status === 'SCHEDULED' && (
                              <button
                                type="button"
                                onClick={() => handleOpenPilotDispatchModal(b)}
                                title="Dispatch to Spoke (Pilot) — Spoke dispatch integration pending server execution"
                                className="w-full bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-medium rounded-lg py-2.5 px-3.5 flex items-center justify-between text-xs transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <Send className="w-4 h-4 shrink-0" />
                                  <span>Dispatch to Spoke (Pilot)</span>
                                </div>
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            )}

                            {b.status === 'DELIVERED' && (
                              <div className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg py-2.5 px-3.5 flex items-center justify-between text-xs font-medium">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                                  <span>Delivered & reconciled</span>
                                </div>
                                <Check className="w-4 h-4 text-emerald-400" />
                              </div>
                            )}

                            {b.status === 'CANCELLED' && (
                              <div className="w-full bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg py-2.5 px-3.5 flex items-center justify-between text-xs font-medium">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                                  <span>Booking cancelled</span>
                                </div>
                              </div>
                            )}

                            {/* Middle Button: Dispatch Controls */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBooking(b);
                                setEditProgress(
                                  b.progress ?? (b.status === 'DELIVERED' ? 100 : b.status === 'SCHEDULED' ? 0 : 45)
                                );
                              }}
                              className="w-full bg-[#0070F3] hover:bg-[#0060DF] text-white font-bold rounded-xl py-2.5 px-3.5 flex items-center justify-between text-xs shadow-md shadow-blue-900/30 transition-all cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <SlidersHorizontal className="w-4 h-4 shrink-0" />
                                <span>Dispatch Controls</span>
                              </div>
                              <ChevronRight className="w-4 h-4" />
                            </button>

                            {/* Bottom Row: 3 Secondary Buttons */}
                            <div className="grid grid-cols-3 gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedBookingDetails(b)}
                                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                                  isDarkMode
                                    ? 'bg-[#0B1522] hover:bg-[#132236] border-slate-800 text-slate-200 hover:text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
                                }`}
                                title="View Full Booking Details"
                              >
                                <FileText className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                <span className="truncate">View Details</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingBooking(b);
                                  setEditProgress(
                                    b.progress ?? (b.status === 'DELIVERED' ? 100 : b.status === 'SCHEDULED' ? 0 : 45)
                                  );
                                }}
                                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                                  isDarkMode
                                    ? 'bg-[#0B1522] hover:bg-[#132236] border-slate-800 text-slate-200 hover:text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
                                }`}
                                title="Edit Booking Telemetry"
                              >
                                <Pencil className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                <span>Edit</span>
                              </button>

                              {b.status !== 'CANCELLED' && b.status !== 'DELIVERED' ? (
                                <button
                                  type="button"
                                  onClick={() => handleQuickStatusChange(b, 'CANCELLED')}
                                  className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 text-xs font-medium transition-all cursor-pointer"
                                  title="Cancel Booking"
                                >
                                  <Trash2 className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                                  <span>Cancel</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled
                                  className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-slate-900/40 border border-slate-800/40 text-slate-600 text-xs font-medium cursor-not-allowed"
                                >
                                  <Trash2 className="w-3.5 h-3.5 shrink-0 text-slate-700" />
                                  <span>Cancel</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                      {/* EDIT MODAL / INLINE DRAWER */}
                      {isBeingEdited && (
                        <div className="mt-5 pt-5 border-t border-slate-700/40 bg-black/30 p-5 rounded-2xl">
                          <form onSubmit={handleSaveBookingEdit} autoComplete="off" data-lpignore="true" className="space-y-4">
                            <input type="text" name="decoy_edit_search" tabIndex={-1} aria-hidden="true" autoComplete="off" className="sr-only opacity-0 pointer-events-none fixed -top-[9999px] left-0" />
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
                                  { value: 'SCHEDULED', label: 'SCHEDULED (Awaiting Dispatch)' },
                                  ...(editingBooking.status === 'IN TRANSIT'
                                    ? [{ value: 'IN TRANSIT', label: 'IN TRANSIT (Active Spoke)' }]
                                    : []),
                                  ...(editingBooking.status === 'DELIVERED'
                                    ? [{ value: 'DELIVERED', label: 'DELIVERED (Verified)' }]
                                    : []),
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
                                      registration: editingBooking.driver?.registration || '',
                                      phone: editingBooking.driver?.phone || '',
                                      status: 'ACTIVE ASSIGNMENT',
                                    },
                                  })
                                }
                                placeholder="e.g. Assigned Driver"
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
                                      name: editingBooking.driver?.name || '',
                                      vehicleModel: e.target.value,
                                      registration: editingBooking.driver?.registration || '',
                                      phone: editingBooking.driver?.phone || '',
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
                                      name: editingBooking.driver?.name || '',
                                      vehicleModel: editingBooking.driver?.vehicleModel || editingBooking.vehicle,
                                      registration: e.target.value,
                                      phone: editingBooking.driver?.phone || '',
                                      status: 'ACTIVE ASSIGNMENT',
                                    },
                                  })
                                }
                                placeholder="e.g. AB12 CDE"
                              />

                              <Field
                                label="Driver Mobile Phone"
                                isDarkMode={isDarkMode}
                                value={editingBooking.driver?.phone || ''}
                                onChange={(e) =>
                                  setEditingBooking({
                                    ...editingBooking,
                                    driver: {
                                      name: editingBooking.driver?.name || '',
                                      vehicleModel: editingBooking.driver?.vehicleModel || editingBooking.vehicle,
                                      registration: editingBooking.driver?.registration || '',
                                      phone: e.target.value,
                                      status: 'ACTIVE ASSIGNMENT',
                                    },
                                  })
                                }
                                placeholder="07700 900000"
                              />

                              {editingBooking.driver?.phone && (
                                <div className="flex justify-end -mt-2">
                                  <button
                                    type="button"
                                    onClick={() => initiateAircallDial(editingBooking.driver!.phone, true)}
                                    className="flex items-center gap-1 text-[11px] text-[#3898EC] hover:underline font-mono cursor-pointer"
                                  >
                                    <Phone className="w-3 h-3" />
                                    <span>Dial {editingBooking.driver.phone} via Aircall</span>
                                  </button>
                                </div>
                              )}

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

                            {editingBooking.status === 'SCHEDULED' && (
                              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-xs text-amber-300">
                                  <Shield className="w-4 h-4 shrink-0 text-amber-400" />
                                  <span>Ready to dispatch this consignment to Spoke?</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const target = bookings.find(
                                      (b) => b.id === editingBooking.id || b.reference === editingBooking.reference
                                    ) || editingBooking;
                                    setEditingBooking(null);
                                    handleOpenPilotDispatchModal(target);
                                  }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 flex items-center gap-1.5 transition-all cursor-pointer shrink-0 self-start sm:self-auto"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Open Spoke Pilot Dispatch</span>
                                </button>
                              </div>
                            )}

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
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB: USER & ACCOUNT MANAGEMENT
            ========================================================================= */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <Eyebrow text="Identity & access control" />
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  User Accounts & Access Management
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Provision new authenticated users, manage corporate tenant assignments, and control administrator and customer permissions.
                </p>
              </div>

              <PrimaryButton
                onClick={() => {
                  handleCloseCreateUser();
                  setIsCreateUserOpen(true);
                }}
                icon={<UserPlus className="w-4 h-4" />}
              >
                Create User
              </PrimaryButton>
            </div>

            {/* User Action Feedback Banners */}
            {userActionSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{userActionSuccess}</span>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {lastRecoveryLink && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(lastRecoveryLink.url);
                        setUserActionSuccess(`Recovery link for ${lastRecoveryLink.email} copied to clipboard!`);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-[11px] cursor-pointer flex items-center gap-1 border border-emerald-500/40"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy Recovery Link</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setUserActionSuccess(null);
                      setLastRecoveryLink(null);
                    }}
                    className="text-emerald-400/70 hover:text-emerald-300 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {userActionError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between animate-fadeIn">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{userActionError}</span>
                </div>
                <button
                  onClick={() => setUserActionError(null)}
                  className="text-rose-400/70 hover:text-rose-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Create User Form / Modal Panel */}
            {isCreateUserOpen && (
              <Panel isDarkMode={isDarkMode} className="border-[#3898EC]/40 bg-[#091322]">
                {createdUserResult ? (
                  /* Success State with auto-generated temporary password display */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-700/40">
                      <h3 className="font-bold text-sm text-emerald-400 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>User Account Successfully Provisioned</span>
                      </h3>
                      <button
                        type="button"
                        onClick={handleCloseCreateUser}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl bg-black/40 border border-slate-800 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-mono text-slate-400">Full Name</span>
                        <p className="font-bold text-white mt-0.5">{createdUserResult.profile.full_name}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-mono text-slate-400">Email Address</span>
                        <p className="font-mono text-white mt-0.5 truncate">{createdUserResult.profile.email}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-mono text-slate-400">Company</span>
                        <p className="text-white mt-0.5 truncate">
                          {createdUserResult.profile.companies?.name || createdUserResult.profile.company_id}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-mono text-slate-400">Assigned Role</span>
                        <p className="mt-0.5">
                          <StatusPill status={createdUserResult.profile.role.toUpperCase()} />
                        </p>
                      </div>
                    </div>

                    {createdUserResult.temporaryPassword ? (
                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                        <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                          <KeyRound className="w-4 h-4" />
                          <span>Autogenerated Temporary Password</span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          Provide this temporary credentials to the user. This key is displayed only once and was not logged in plaintext.
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            readOnly
                            value={createdUserResult.temporaryPassword}
                            className="bg-black/50 border border-amber-500/40 rounded-lg px-3 py-2 text-xs font-mono text-amber-300 flex-1 select-all focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleCopyPassword}
                            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                              copiedPassword
                                ? 'bg-emerald-500 text-white'
                                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                            }`}
                          >
                            {copiedPassword ? (
                              <>
                                <CheckCheck className="w-3.5 h-3.5" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Password</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-300">
                        The specified custom password was provisioned for this account.
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <PrimaryButton
                        onClick={() => {
                          handleCloseCreateUser();
                          setIsCreateUserOpen(true);
                        }}
                        icon={<UserPlus className="w-4 h-4" />}
                      >
                        Create Another User
                      </PrimaryButton>
                      <GhostButton isDarkMode={isDarkMode} onClick={handleCloseCreateUser}>
                        Done
                      </GhostButton>
                    </div>
                  </div>
                ) : (
                  /* Form State */
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-700/40">
                      <div>
                        <h3 className="font-bold text-sm text-[#3898EC] flex items-center gap-2">
                          <UserPlus className="w-4 h-4" />
                          <span>Provision New User Account</span>
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Creates an authenticated Supabase user and establishes an active profile with tenant isolation.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCloseCreateUser}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {createUserError && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 animate-fadeIn">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{createUserError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        label="Full Name *"
                        isDarkMode={isDarkMode}
                        value={createFullName}
                        onChange={(e) => setCreateFullName(e.target.value)}
                        placeholder="e.g. Eleanor Vance"
                        disabled={isCreatingUser}
                        required
                      />

                      <Field
                        label="Email Address *"
                        isDarkMode={isDarkMode}
                        type="email"
                        value={createEmail}
                        onChange={(e) => setCreateEmail(e.target.value)}
                        placeholder="e.g. eleanor@meridian.co.uk"
                        disabled={isCreatingUser}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <SelectField
                        label="Company Assignment *"
                        isDarkMode={isDarkMode}
                        value={createNewCompanyMode ? '__new__' : createCompanyId}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__new__') {
                            setCreateNewCompanyMode(true);
                            setCreateCompanyId('__new__');
                          } else {
                            setCreateNewCompanyMode(false);
                            setCreateCompanyId(val);
                          }
                        }}
                        disabled={isCreatingUser}
                        options={[
                          ...(companies.length > 0
                            ? companies.map((c) => ({
                                value: c.id,
                                label: `${c.name} (${c.account_code || c.id})`,
                              }))
                            : [
                                { value: 'comp-meridian-001', label: 'Meridian Logistics Ltd (NEO-SB-2026)' },
                                { value: 'c-neo-ops', label: 'NEO Transport Ops Control (NEO-DISPATCH-01)' },
                              ]),
                          { value: '__new__', label: '+ Register New Company / Standby Account...' },
                        ]}
                      />

                      <SelectField
                        label="Access Role *"
                        isDarkMode={isDarkMode}
                        value={createRole}
                        onChange={(e) => setCreateRole(e.target.value as 'customer' | 'admin')}
                        disabled={isCreatingUser}
                        options={[
                          { value: 'customer', label: 'Customer (Standard Booking Access)' },
                          { value: 'admin', label: 'Administrator (Full Dispatch & System Control)' },
                        ]}
                      />
                    </div>

                    {createNewCompanyMode && (
                      <div className="space-y-1 p-3 rounded-xl bg-[#3898EC]/10 border border-[#3898EC]/30">
                        <Field
                          label="New Company / Trading Name *"
                          isDarkMode={isDarkMode}
                          value={createCompanyName}
                          onChange={(e) => setCreateCompanyName(e.target.value)}
                          placeholder="e.g. Apex Freight Logistics Ltd"
                          disabled={isCreatingUser}
                          required
                        />
                        <p className="text-[10px] text-sky-400 font-mono">
                          A dedicated tenant account will be provisioned. This client will start with a fresh, clean dashboard with 0 prior bookings.
                        </p>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Field
                        label="Initial Password (Optional)"
                        isDarkMode={isDarkMode}
                        type="password"
                        value={createPassword}
                        onChange={(e) => setCreatePassword(e.target.value)}
                        placeholder="Leave blank to auto-generate temporary password"
                        disabled={isCreatingUser}
                      />
                      <p className="text-[10px] text-slate-400 font-mono">
                        Leave blank to automatically generate a secure 16-character temporary password that you can copy after creation. If provided, must be at least 8 characters.
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <GhostButton
                        type="button"
                        isDarkMode={isDarkMode}
                        onClick={handleCloseCreateUser}
                        disabled={isCreatingUser}
                      >
                        Cancel
                      </GhostButton>

                      <PrimaryButton
                        type="submit"
                        disabled={isCreatingUser}
                        icon={
                          isCreatingUser ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <UserPlus className="w-4 h-4" />
                          )
                        }
                      >
                        {isCreatingUser ? 'Provisioning Account...' : 'Provision User Account'}
                      </PrimaryButton>
                    </div>
                  </form>
                )}
              </Panel>
            )}

            {/* Quick KPI stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <Panel isDarkMode={isDarkMode} compact>
                <span
                  className={`font-mono text-[10px] uppercase ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500 font-semibold'
                  }`}
                >
                  Total Users
                </span>
                <p
                  className={`text-2xl font-black mt-1 ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {profiles.length}
                </p>
                <span
                  className={`text-[11px] font-mono ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Directory profiles
                </span>
              </Panel>
              <Panel isDarkMode={isDarkMode} compact>
                <span className="font-mono text-[10px] uppercase text-sky-400 font-semibold">Customers</span>
                <p className="text-2xl font-black text-[#3898EC] mt-1">
                  {profiles.filter((p) => p.role === 'customer').length}
                </p>
                <span
                  className={`text-[11px] font-mono ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Standard portal
                </span>
              </Panel>
              <Panel isDarkMode={isDarkMode} compact>
                <span
                  className={`font-mono text-[10px] uppercase font-semibold ${
                    isDarkMode ? 'text-purple-400' : 'text-purple-700'
                  }`}
                >
                  Admins
                </span>
                <p
                  className={`text-2xl font-black mt-1 ${
                    isDarkMode ? 'text-purple-400' : 'text-purple-700'
                  }`}
                >
                  {profiles.filter((p) => p.role === 'admin').length}
                </p>
                <span
                  className={`text-[11px] font-mono ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Privileged clearance
                </span>
              </Panel>
              <Panel isDarkMode={isDarkMode} compact>
                <span
                  className={`font-mono text-[10px] uppercase font-semibold ${
                    isDarkMode ? 'text-rose-400' : 'text-rose-700'
                  }`}
                >
                  Suspended
                </span>
                <p
                  className={`text-2xl font-black mt-1 ${
                    isDarkMode ? 'text-rose-400' : 'text-rose-700'
                  }`}
                >
                  {profiles.filter((p) => p.status === 'suspended').length}
                </p>
                <span
                  className={`text-[11px] font-mono ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Access revoked
                </span>
              </Panel>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div
                className={`p-3 rounded-2xl border flex items-center gap-3 flex-1 transition-colors ${
                  isDarkMode
                    ? 'bg-[#0b121c] border-[#172334] text-white'
                    : 'bg-white border-slate-200/90 text-slate-900 shadow-xs focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-[#3898EC]/15'
                }`}
              >
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search users by name, email, company, account code, or ID..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className={`w-full text-xs bg-transparent focus:outline-none ${
                    isDarkMode
                      ? 'text-white placeholder-slate-500'
                      : 'text-slate-900 placeholder-slate-400'
                  }`}
                />
                {userSearch && (
                  <button
                    onClick={() => setUserSearch('')}
                    className={`text-xs ${
                      isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Role filter pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {['ALL', 'customer', 'admin'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setUserRoleFilter(r)}
                    className={`px-3 py-1 rounded-full text-xs font-mono transition-all duration-180 cursor-pointer active:scale-95 ${
                      userRoleFilter === r
                        ? 'bg-[#3898EC] text-white font-bold shadow-xs'
                        : isDarkMode
                        ? 'bg-[#0b121c] text-slate-400 border border-[#172334] hover:text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 shadow-xs'
                    }`}
                  >
                    {r === 'ALL' ? 'ALL ROLES' : r.toUpperCase()}
                  </button>
                ))}

                {['ALL', 'active', 'suspended'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setUserStatusFilter(st)}
                    className={`px-3 py-1 rounded-full text-xs font-mono transition-all duration-180 cursor-pointer active:scale-95 ${
                      userStatusFilter === st
                        ? 'bg-[#3898EC] text-white font-bold shadow-xs'
                        : isDarkMode
                        ? 'bg-[#0b121c] text-slate-400 border border-[#172334] hover:text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 shadow-xs'
                    }`}
                  >
                    {st === 'ALL' ? 'ALL STATUS' : st.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Directory List */}
            <div className="space-y-3">
              {filteredProfiles.length === 0 ? (
                <Panel isDarkMode={isDarkMode}>
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No user accounts found matching current filter or search criteria.
                  </div>
                </Panel>
              ) : (
                filteredProfiles.map((user) => {
                  const isMutating = isMutatingUser === user.id;
                  const isSuspended = user.status === 'suspended';
                  const isAdmin = user.role === 'admin';
                  const isSelf = Boolean(activeAdminId && user.id === activeAdminId);
                  const isAnyMutating = isMutatingUser !== null;

                  return (
                    <Panel
                      key={user.id}
                      isDarkMode={isDarkMode}
                      className={`transition-all ${
                        isSuspended
                          ? 'opacity-70 border-rose-500/20 bg-rose-500/5'
                          : isAdmin
                          ? isDarkMode
                            ? 'border-purple-500/20 bg-[#0d0f1c]'
                            : 'border-purple-200 bg-purple-50/20'
                          : ''
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Profile Info */}
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              isAdmin
                                ? isDarkMode
                                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                  : 'bg-purple-100 text-purple-700 border border-purple-200'
                                : isDarkMode
                                ? 'bg-[#3898EC]/20 text-[#3898EC] border border-[#3898EC]/30'
                                : 'bg-sky-100 text-sky-700 border border-sky-200'
                            }`}
                          >
                            {user.initials || user.full_name?.slice(0, 2).toUpperCase() || 'U'}
                          </div>

                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4
                                className={`font-bold text-sm ${
                                  isDarkMode ? 'text-white' : 'text-slate-900'
                                }`}
                              >
                                {user.full_name}
                              </h4>
                              <StatusPill status={user.role.toUpperCase()} isDarkMode={isDarkMode} />
                              <StatusPill
                                status={(user.status || 'active').toUpperCase()}
                                isDarkMode={isDarkMode}
                              />
                              {isSelf && (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                                    isDarkMode
                                      ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                                      : 'bg-purple-50 text-purple-800 border-purple-200 font-medium'
                                  }`}
                                >
                                  Current Active Admin
                                </span>
                              )}
                            </div>
                            <div
                              className={`flex items-center gap-3 text-[11px] font-mono flex-wrap ${
                                isDarkMode ? 'text-slate-400' : 'text-slate-600 font-medium'
                              }`}
                            >
                              <span className="flex items-center gap-1">
                                <Mail className={`w-3 h-3 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                                {user.email}
                              </span>
                              <span className="flex items-center gap-1">
                                <Building2 className={`w-3 h-3 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                                {user.companies?.name || user.company_id}
                                {user.companies?.account_code && (
                                  <span className={isDarkMode ? 'text-slate-500' : 'text-slate-500'}>
                                    ({user.companies.account_code})
                                  </span>
                                )}
                              </span>
                              {user.created_at && (
                                <span className={isDarkMode ? 'text-slate-500' : 'text-slate-500'}>
                                  Joined {new Date(user.created_at).toLocaleDateString('en-GB')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-wrap self-end lg:self-center">
                          {/* Password Reset */}
                          <button
                            onClick={() => handleTriggerReset(user)}
                            disabled={isAnyMutating}
                            title={`Send Supabase password reset email to ${user.email}`}
                            className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition-all duration-180 ease-out active:scale-95 flex items-center gap-1.5 ${
                              isAnyMutating ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                            } ${
                              isDarkMode
                                ? 'border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                                : 'border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-xs hover:border-slate-300'
                            }`}
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>{isMutating ? 'Sending...' : 'Reset Password'}</span>
                          </button>

                          {/* Role Toggle */}
                          <button
                            onClick={() => handleToggleUserRole(user)}
                            disabled={isAnyMutating || (isSelf && isAdmin)}
                            title={
                              isSelf && isAdmin
                                ? 'Administrators cannot demote their own account'
                                : isAdmin
                                ? 'Demote to Customer'
                                : 'Promote to Administrator'
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition-all duration-180 ease-out active:scale-95 flex items-center gap-1.5 ${
                              isAnyMutating || (isSelf && isAdmin)
                                ? 'opacity-40 cursor-not-allowed'
                                : 'cursor-pointer'
                            } ${
                              isAdmin
                                ? isDarkMode
                                  ? 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10'
                                  : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 shadow-xs'
                                : isDarkMode
                                ? 'border-[#3898EC]/30 text-[#3898EC] hover:bg-[#3898EC]/10'
                                : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 shadow-xs'
                            }`}
                          >
                            <Shield className="w-3.5 h-3.5" />
                            <span>{isAdmin ? 'Make Customer' : 'Make Admin'}</span>
                          </button>

                          {/* Suspend / Reactivate */}
                          <button
                            onClick={() => handleToggleUserStatus(user)}
                            disabled={isAnyMutating || (isSelf && !isSuspended)}
                            title={
                              isSelf && !isSuspended
                                ? 'Administrators cannot suspend their own account'
                                : isSuspended
                                ? 'Reactivate account access'
                                : 'Suspend account access'
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition-all duration-180 ease-out active:scale-95 flex items-center gap-1.5 ${
                              isAnyMutating || (isSelf && !isSuspended)
                                ? 'opacity-40 cursor-not-allowed'
                                : 'cursor-pointer'
                            } ${
                              isSuspended
                                ? isDarkMode
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 shadow-xs'
                                : isDarkMode
                                ? 'border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                                : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 shadow-xs'
                            }`}
                          >
                            {isSuspended ? (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Reactivate</span>
                              </>
                            ) : (
                              <>
                                <Ban className="w-3.5 h-3.5" />
                                <span>Suspend</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
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
                <Eyebrow text="Corporate client onboarding" />
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Standby Account Applications
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Review £0 emergency freight standby applications submitted from the landing page. Approve credit facilities and activate instant dispatch accounts.
                </p>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <span
                  className={`px-3 py-1.5 rounded-full border ${
                    isDarkMode
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-amber-50 border-amber-200 text-amber-800 font-semibold shadow-xs'
                  }`}
                >
                  {applications.filter((a) => a.status === 'pending').length} Pending Review
                </span>
                <span
                  className={`px-3 py-1.5 rounded-full border ${
                    isDarkMode
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold shadow-xs'
                  }`}
                >
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
                          <h3
                            className={`font-extrabold text-lg ${
                              isDarkMode ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {app.company_name}
                          </h3>
                          {app.trading_name && (
                            <span
                              className={`text-xs font-mono ${
                                isDarkMode ? 'text-slate-400' : 'text-slate-500 font-medium'
                              }`}
                            >
                              t/a {app.trading_name}
                            </span>
                          )}
                          <StatusPill
                            status={app.status === 'approved' ? 'APPROVED' : 'PENDING'}
                            isDarkMode={isDarkMode}
                          />
                          {app.account_code && (
                            <span
                              className={`font-mono text-xs px-2.5 py-0.5 rounded-full border font-bold ${
                                isDarkMode
                                  ? 'bg-[#3898EC]/10 text-[#3898EC] border-[#3898EC]/30'
                                  : 'bg-sky-50 text-sky-700 border-sky-200 shadow-xs'
                              }`}
                            >
                              {app.account_code}
                            </span>
                          )}
                        </div>

                        {/* Address */}
                        <div
                          className={`flex items-center gap-2 text-xs ${
                            isDarkMode ? 'text-slate-300' : 'text-slate-700 font-medium'
                          }`}
                        >
                          <MapPin className="w-3.5 h-3.5 text-[#3898EC] shrink-0" />
                          <span>
                            {app.dispatch_address}, {app.town_city} ({app.postcode})
                          </span>
                        </div>

                        {/* Contact Person Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 text-xs">
                          <div
                            className={`p-3 rounded-xl border transition-all ${
                              isDarkMode
                                ? 'bg-black/20 border-slate-800'
                                : 'bg-slate-50/90 border-slate-200/90 shadow-xs'
                            }`}
                          >
                            <span
                              className={`text-[10px] uppercase font-mono block ${
                                isDarkMode ? 'text-slate-400' : 'text-slate-500 font-semibold'
                              }`}
                            >
                              Primary Logistics Contact
                            </span>
                            <span
                              className={`font-bold block mt-0.5 ${
                                isDarkMode ? 'text-white' : 'text-slate-900'
                              }`}
                            >
                              {app.contact_name}
                            </span>
                            <span
                              className={`text-[11px] block ${
                                isDarkMode ? 'text-slate-400' : 'text-slate-600'
                              }`}
                            >
                              {app.job_title}
                            </span>
                          </div>

                          <div
                            className={`p-3 rounded-xl border transition-all ${
                              isDarkMode
                                ? 'bg-black/20 border-slate-800'
                                : 'bg-slate-50/90 border-slate-200/90 shadow-xs'
                            }`}
                          >
                            <span
                              className={`text-[10px] uppercase font-mono block ${
                                isDarkMode ? 'text-slate-400' : 'text-slate-500 font-semibold'
                              }`}
                            >
                              Direct Telephony
                            </span>
                            <div
                              className={`flex items-center gap-1.5 mt-0.5 font-semibold ${
                                isDarkMode ? 'text-slate-200' : 'text-slate-900'
                              }`}
                            >
                              <Phone className="w-3 h-3 text-[#3898EC]" />
                              <button
                                onClick={() => initiateAircallDial(app.driver_mobile, true)}
                                title={`Click to call ${app.driver_mobile} via Aircall`}
                                className="hover:underline text-[#3898EC] flex items-center gap-1 cursor-pointer"
                              >
                                <span>{app.driver_mobile}</span>
                                <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/10 border border-sky-500/20 text-[#3898EC] font-mono">
                                  Call
                                </span>
                              </button>
                            </div>
                            <span
                              className={`text-[11px] block ${
                                isDarkMode ? 'text-slate-400' : 'text-slate-600'
                              }`}
                            >
                              24/7 Desk: {app.emergency_line}
                            </span>
                          </div>

                          <div
                            className={`p-3 rounded-xl border transition-all ${
                              isDarkMode
                                ? 'bg-black/20 border-slate-800'
                                : 'bg-slate-50/90 border-slate-200/90 shadow-xs'
                            }`}
                          >
                            <span
                              className={`text-[10px] uppercase font-mono block ${
                                isDarkMode ? 'text-slate-400' : 'text-slate-500 font-semibold'
                              }`}
                            >
                              Operations & Billing
                            </span>
                            <div
                              className={`flex items-center gap-1.5 mt-0.5 truncate font-semibold ${
                                isDarkMode ? 'text-slate-200' : 'text-slate-900'
                              }`}
                            >
                              <Mail className="w-3 h-3 text-[#3898EC]" />
                              <span className="truncate">{app.ops_email}</span>
                            </div>
                            <span
                              className={`text-[11px] block truncate ${
                                isDarkMode ? 'text-slate-400' : 'text-slate-600'
                              }`}
                            >
                              Accounts: {app.accounts_email}
                            </span>
                          </div>
                        </div>

                        {/* Freight Volume & Carriers */}
                        <div
                          className={`flex items-center gap-4 text-xs pt-1 ${
                            isDarkMode ? 'text-slate-400' : 'text-slate-600'
                          }`}
                        >
                          <span>
                            Monthly Volume:{' '}
                            <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>
                              {app.volume || '5-15 loads'}
                            </strong>
                          </span>
                          <span>
                            Current Carriers:{' '}
                            <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>
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
                          <span
                            className={`font-mono text-[10px] uppercase block ${
                              isDarkMode ? 'text-slate-400' : 'text-slate-500 font-medium'
                            }`}
                          >
                            Credit Facility
                          </span>
                          <span
                            className={`font-extrabold text-lg block ${
                              isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                            }`}
                          >
                            £15,000 Standby Limit
                          </span>
                          <span
                            className={`text-[11px] ${
                              isDarkMode ? 'text-slate-400' : 'text-slate-600 font-medium'
                            }`}
                          >
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
                          <div
                            className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-semibold font-mono ${
                              isDarkMode
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-xs'
                            }`}
                          >
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
                  <Eyebrow text="Tariff lock & tender" />
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
                        <p
                          className={`font-semibold truncate ${
                            isDarkMode ? 'text-slate-300' : 'text-slate-700 font-medium'
                          }`}
                        >
                          From: {q.origin}
                        </p>
                        <p
                          className={`font-semibold truncate ${
                            isDarkMode ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          To: {q.destination}
                        </p>
                      </div>

                      <div
                        className={`flex items-center justify-between pt-2 border-t text-xs ${
                          isDarkMode ? 'border-slate-700/30' : 'border-slate-100'
                        }`}
                      >
                        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>
                          {q.vehicle}
                        </span>
                        <span
                          className={`font-extrabold text-base ${
                            isDarkMode ? 'text-white' : 'text-slate-900'
                          }`}
                        >
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
            <div
              className={`space-y-4 pt-4 border-t ${
                isDarkMode ? 'border-slate-800' : 'border-slate-100'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <Eyebrow text="Credit facility & settlement" />
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                    Invoices & Statements
                  </h2>
                  <p
                    className={`text-xs mt-1 ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-600 font-medium'
                    }`}
                  >
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
                            <span
                              className={`font-mono text-sm font-bold ${
                                isDarkMode ? 'text-white' : 'text-slate-900'
                              }`}
                            >
                              {inv.reference}
                            </span>
                            <StatusPill status={inv.status} isDarkMode={isDarkMode} />
                          </div>
                          <span
                            className={`text-xs font-mono ${
                              isDarkMode ? 'text-slate-400' : 'text-slate-600 font-medium'
                            }`}
                          >
                            Period: {inv.period} · Date: {inv.date}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <span
                            className={`text-[10px] font-mono uppercase block ${
                              isDarkMode ? 'text-slate-400' : 'text-slate-500 font-medium'
                            }`}
                          >
                            Statement Total
                          </span>
                          <span
                            className={`text-lg font-extrabold ${
                              isDarkMode ? 'text-white' : 'text-slate-900'
                            }`}
                          >
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
                <Eyebrow text="Compliance & proof of delivery repository" />
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  POD & Consignment Documents
                </h1>
                <p
                  className={`text-xs sm:text-sm mt-1 ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-600 font-medium'
                  }`}
                >
                  Upload signed Proof of Delivery receipts, CMR international consignment notes, and audited dock stamps directly to customer shipments.
                </p>
              </div>

              <PrimaryButton
                onClick={() => {
                  setIsNewDocOpen(true);
                  setDocUploadError(null);
                  if (bookings.length > 0 && !bookings.some((b) => b.reference === docBookingRef)) {
                    setDocBookingRef(bookings[0].reference);
                  }
                }}
                icon={<Upload className="w-4 h-4" />}
              >
                Upload / Attach POD
              </PrimaryButton>
            </div>

            {/* Attach Document Modal / Form */}
            {isNewDocOpen && (
              <Panel isDarkMode={isDarkMode} className="border-[#3898EC]/40 bg-[#091322]">
                <form onSubmit={handleCreateDocument} className="space-y-4">
                  <div
                    className={`flex items-center justify-between pb-3 border-b ${
                      isDarkMode ? 'border-slate-700/40' : 'border-slate-100'
                    }`}
                  >
                    <h3 className="font-bold text-sm text-[#3898EC] flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      <span>Attach Proof of Delivery or CMR to Booking</span>
                    </h3>
                    <button
                      type="button"
                      disabled={isUploadingDoc}
                      onClick={() => {
                        setIsNewDocOpen(false);
                        setDocUploadError(null);
                      }}
                      className="text-slate-400 hover:text-white disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {docUploadError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 animate-fadeIn">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{docUploadError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <SelectField
                      label="Link to Booking"
                      isDarkMode={isDarkMode}
                      value={docBookingRef}
                      disabled={isUploadingDoc}
                      onChange={(e) => {
                        setDocBookingRef(e.target.value);
                        setDocUploadError(null);
                      }}
                      options={bookings.map((b) => ({
                        value: b.reference,
                        label: `${b.reference} (${b.origin} → ${b.destination})`,
                      }))}
                    />

                    <Field
                      label="Document Title"
                      isDarkMode={isDarkMode}
                      value={docTitle}
                      disabled={isUploadingDoc}
                      onChange={(e) => {
                        setDocTitle(e.target.value);
                        setDocUploadError(null);
                      }}
                      placeholder="e.g. Signed Delivery Receipt Bay 4"
                      required
                    />

                    <SelectField
                      label="Document Category"
                      isDarkMode={isDarkMode}
                      value={docCategory}
                      disabled={isUploadingDoc}
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
                      disabled={isUploadingDoc}
                      onChange={(e) => setDocSigner(e.target.value)}
                      placeholder="e.g. G. Henderson · Goods Inwards"
                    />

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-6">
                      <label className={`cursor-pointer px-3 py-2 rounded-xl bg-[#3898EC]/10 hover:bg-[#3898EC]/20 border border-[#3898EC]/30 text-[#3898EC] text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all ${isUploadingDoc ? 'opacity-50 pointer-events-none' : ''}`}>
                        <Upload className="w-3.5 h-3.5" />
                        <span>{docFile ? 'Replace File' : 'Select File (.pdf/.png)'}</span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          disabled={isUploadingDoc}
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setDocFile(e.target.files[0]);
                              setDocUploadError(null);
                            }
                          }}
                        />
                      </label>
                      <div
                        className={`px-3 py-2 rounded-xl border text-xs font-mono flex-1 flex items-center justify-between ${
                          isDarkMode
                            ? 'bg-black/30 border-slate-700 text-slate-400'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        <span className="truncate">{docFile ? docFile.name : 'No file selected (required)'}</span>
                        <span className="text-[#3898EC] shrink-0 ml-2">{docFile ? `${Math.round(docFile.size / 1024)} KB` : '—'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <GhostButton
                      type="button"
                      isDarkMode={isDarkMode}
                      disabled={isUploadingDoc}
                      onClick={() => {
                        setIsNewDocOpen(false);
                        setDocUploadError(null);
                      }}
                    >
                      Cancel
                    </GhostButton>
                    <PrimaryButton type="submit" disabled={isUploadingDoc} loading={isUploadingDoc}>
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
                          <h4
                            className={`font-bold text-sm ${
                              isDarkMode ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {doc.title}
                          </h4>
                          <span
                            className={`font-mono text-[10px] px-2 py-0.5 rounded-full border ${
                              isDarkMode
                                ? 'bg-slate-800 text-slate-300 border-slate-700'
                                : 'bg-slate-100 text-slate-700 border-slate-200 font-medium'
                            }`}
                          >
                            {doc.type}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-mono ${
                            isDarkMode ? 'text-slate-400' : 'text-slate-600'
                          }`}
                        >
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

        {/* =========================================================================
            TAB 5: SUPPORT TICKETS & CLIENT ENQUIRIES
            ========================================================================= */}
        {activeTab === 'tickets' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <Eyebrow text="Customer service & duty dispatch" />
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Support Tickets & Enquiries
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Review and coordinate real-time customer support inquiries across all registered client companies.
                </p>
              </div>

              {/* Status filter pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {['ALL', 'Open', 'In Progress', 'Resolved'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setTicketStatusFilter(st)}
                    className={`px-3 py-1 rounded-full text-xs font-mono transition-all cursor-pointer ${
                      ticketStatusFilter === st
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

            {/* KPI Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Panel isDarkMode={isDarkMode} compact>
                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className={`text-[11px] font-mono uppercase ${
                        isDarkMode ? 'text-slate-400' : 'text-slate-500 font-semibold'
                      }`}
                    >
                      Total Tickets
                    </span>
                    <h4
                      className={`text-2xl font-bold mt-1 ${
                        isDarkMode ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {tickets.length}
                    </h4>
                  </div>
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isDarkMode
                        ? 'bg-sky-500/10 text-[#3898EC]'
                        : 'bg-sky-50 text-sky-600 border border-sky-100'
                    }`}
                  >
                    <Headphones className="w-5 h-5" />
                  </div>
                </div>
              </Panel>

              <Panel isDarkMode={isDarkMode} compact>
                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className={`text-[11px] font-mono uppercase font-semibold ${
                        isDarkMode ? 'text-amber-400' : 'text-amber-700'
                      }`}
                    >
                      Open / Awaiting
                    </span>
                    <h4
                      className={`text-2xl font-bold mt-1 ${
                        isDarkMode ? 'text-amber-400' : 'text-amber-700'
                      }`}
                    >
                      {tickets.filter((t) => t.status === 'Open').length}
                    </h4>
                  </div>
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isDarkMode
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-amber-50 text-amber-600 border border-amber-100'
                    }`}
                  >
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
              </Panel>

              <Panel isDarkMode={isDarkMode} compact>
                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className={`text-[11px] font-mono uppercase font-semibold ${
                        isDarkMode ? 'text-sky-400' : 'text-sky-700'
                      }`}
                    >
                      In Progress
                    </span>
                    <h4
                      className={`text-2xl font-bold mt-1 ${
                        isDarkMode ? 'text-sky-400' : 'text-sky-700'
                      }`}
                    >
                      {tickets.filter((t) => t.status === 'In Progress').length}
                    </h4>
                  </div>
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isDarkMode
                        ? 'bg-sky-500/10 text-sky-400'
                        : 'bg-sky-50 text-sky-600 border border-sky-100'
                    }`}
                  >
                    <MessageSquare className="w-5 h-5" />
                  </div>
                </div>
              </Panel>

              <Panel isDarkMode={isDarkMode} compact>
                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className={`text-[11px] font-mono uppercase font-semibold ${
                        isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                      }`}
                    >
                      Resolved
                    </span>
                    <h4
                      className={`text-2xl font-bold mt-1 ${
                        isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                      }`}
                    >
                      {tickets.filter((t) => t.status === 'Resolved').length}
                    </h4>
                  </div>
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isDarkMode
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
              </Panel>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Ticket ID (SR-...), topic, message content, or company name..."
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs font-mono transition-all ${
                  isDarkMode
                    ? 'bg-[#0b121c] border-[#172334] text-white placeholder-slate-500 focus:border-[#3898EC]'
                    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#3898EC] shadow-xs'
                }`}
              />
            </div>

            {/* Tickets List */}
            <div className="space-y-3">
              {filteredTickets.length === 0 ? (
                <Panel isDarkMode={isDarkMode}>
                  <div className="text-center py-12 space-y-3">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
                        isDarkMode
                          ? 'bg-slate-800/60 text-slate-400'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Headphones className="w-6 h-6" />
                    </div>
                    <h4
                      className={`font-bold text-sm ${
                        isDarkMode ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      No Support Tickets Found
                    </h4>
                    <p
                      className={`text-xs max-w-sm mx-auto ${
                        isDarkMode ? 'text-slate-400' : 'text-slate-600'
                      }`}
                    >
                      {tickets.length === 0
                        ? 'There are currently no support inquiries submitted in the system. Customer tickets created from the portal will appear here in real-time.'
                        : 'No tickets matched your search and filter criteria.'}
                    </p>
                  </div>
                </Panel>
              ) : (
                filteredTickets.map((t) => (
                  <Panel key={t.id} isDarkMode={isDarkMode}>
                    <div className="space-y-4">
                      <div
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b ${
                          isDarkMode ? 'border-slate-800/40' : 'border-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <span
                            className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md border ${
                              isDarkMode
                                ? 'text-white bg-slate-800/80 border-slate-700/60'
                                : 'text-slate-900 bg-slate-100 border-slate-200'
                            }`}
                          >
                            {t.id}
                          </span>
                          {t.company_name && (
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-0.5 rounded-md border font-semibold ${
                                isDarkMode
                                  ? 'text-[#3898EC] bg-[#3898EC]/10 border-[#3898EC]/20'
                                  : 'text-sky-700 bg-sky-50 border-sky-200'
                              }`}
                            >
                              <Building2 className="w-3.5 h-3.5" />
                              {t.company_name}
                            </span>
                          )}
                          <span
                            className={`text-xs flex items-center gap-1 font-mono ${
                              isDarkMode ? 'text-slate-400' : 'text-slate-600 font-medium'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {t.date}
                          </span>
                        </div>

                        <StatusPill status={t.status} isDarkMode={isDarkMode} />
                      </div>

                      <div>
                        <h3
                          className={`font-bold text-sm ${
                            isDarkMode ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {t.topic}
                        </h3>
                        <p
                          className={`text-xs mt-1 leading-relaxed ${
                            isDarkMode ? 'text-slate-400' : 'text-slate-600'
                          }`}
                        >
                          {t.message}
                        </p>
                      </div>

                      <div
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t ${
                          isDarkMode ? 'border-slate-800/40' : 'border-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[11px] font-mono ${
                              isDarkMode ? 'text-slate-400' : 'text-slate-600 font-medium'
                            }`}
                          >
                            Change Status:
                          </span>
                          {t.status !== 'In Progress' && (
                            <button
                              type="button"
                              disabled={isUpdatingTicketStatus}
                              onClick={() => handleUpdateTicketStatus(t.id, 'In Progress')}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border transition-all duration-180 cursor-pointer disabled:opacity-50 active:scale-95 ${
                                isDarkMode
                                  ? 'border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400'
                                  : 'border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-700 shadow-xs'
                              }`}
                            >
                              Mark In Progress
                            </button>
                          )}
                          {t.status !== 'Resolved' && (
                            <button
                              type="button"
                              disabled={isUpdatingTicketStatus}
                              onClick={() => handleUpdateTicketStatus(t.id, 'Resolved')}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border transition-all duration-180 cursor-pointer disabled:opacity-50 active:scale-95 ${
                                isDarkMode
                                  ? 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                                  : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 shadow-xs'
                              }`}
                            >
                              Mark Resolved
                            </button>
                          )}
                          {t.status !== 'Open' && (
                            <button
                              type="button"
                              disabled={isUpdatingTicketStatus}
                              onClick={() => handleUpdateTicketStatus(t.id, 'Open')}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border transition-all duration-180 cursor-pointer disabled:opacity-50 active:scale-95 ${
                                isDarkMode
                                  ? 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400'
                                  : 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 shadow-xs'
                              }`}
                            >
                              Reopen
                            </button>
                          )}
                        </div>

                        <GhostButton
                          isDarkMode={isDarkMode}
                          size="sm"
                          onClick={() => setSelectedTicket(t)}
                          icon={<MessageSquare className="w-3.5 h-3.5" />}
                        >
                          Inspect Ticket
                        </GhostButton>
                      </div>
                    </div>
                  </Panel>
                ))
              )}
            </div>
          </div>
        )}
        </div>

        {/* Ticket Inspection & Conversation Modal */}
        {selectedTicket && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
            <div
              className={`p-5 sm:p-6 rounded-2xl border max-w-2xl w-full max-h-[92vh] flex flex-col ${
                isDarkMode ? 'bg-[#0b121c] border-[#172334]' : 'bg-white border-slate-200'
              } shadow-2xl space-y-4`}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-700/40 shrink-0">
                <div className="flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-[#3898EC]" />
                  <h3 className="font-bold text-sm text-white">
                    Ticket Conversation · {selectedTicket.id}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="text-slate-400 hover:text-white text-xs font-mono p-1 rounded-md hover:bg-slate-800 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Container for Metadata & Conversation */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {/* Metadata Card */}
                <div className="p-3.5 rounded-xl bg-[#060b11] border border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Client Account</span>
                      <p className="text-xs font-bold text-[#3898EC] flex items-center gap-1.5 mt-0.5">
                        <Building2 className="w-3.5 h-3.5" />
                        {selectedTicket.company_name || 'Client Company'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Logged Date</span>
                        <p className="text-xs font-mono text-slate-300 mt-0.5">{selectedTicket.date}</p>
                      </div>
                      <StatusPill status={selectedTicket.status} />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Consignment Topic / Subject</span>
                    <p className="text-xs font-bold text-white mt-0.5">{selectedTicket.topic}</p>
                  </div>

                  {/* Status Transition Control */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
                      Operational Status:
                    </span>
                    <div className="flex items-center gap-2">
                      {(['Open', 'In Progress', 'Resolved'] as const).map((statusVal) => {
                        const isCurrent = selectedTicket.status === statusVal;
                        return (
                          <button
                            key={statusVal}
                            type="button"
                            disabled={isUpdatingTicketStatus || isCurrent}
                            onClick={() => handleUpdateTicketStatus(selectedTicket.id, statusVal)}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-[11px] font-mono font-semibold transition-all cursor-pointer disabled:cursor-default ${
                              isCurrent
                                ? statusVal === 'Resolved'
                                  ? 'bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/20'
                                  : statusVal === 'In Progress'
                                  ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/20'
                                  : 'bg-amber-500 text-white font-bold shadow-md shadow-amber-500/20'
                                : isDarkMode
                                ? 'bg-[#0b121c] text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-white'
                                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:text-slate-900'
                            }`}
                          >
                            {statusVal}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Conversation History Thread */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                      Message Thread
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {1 + ticketMessages.length} message{ticketMessages.length === 0 ? '' : 's'}
                    </span>
                  </div>

                  {/* Original Customer Message */}
                  <div className="p-3.5 rounded-xl bg-[#060b11] border border-slate-800/90 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800/60">
                      <span className="text-[11px] font-mono font-bold text-slate-300 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#3898EC]" />
                        <span>{selectedTicket.company_name || 'Client Customer'} (Original Enquiry)</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">{selectedTicket.date}</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                      {selectedTicket.message}
                    </p>
                  </div>

                  {/* Subsequent Messages */}
                  {ticketMessages.map((msg) => {
                    const isAdmin = msg.sender_role === 'admin';
                    return (
                      <div
                        key={msg.id}
                        className={`p-3.5 rounded-xl space-y-1.5 transition-all ${
                          isAdmin
                            ? 'bg-[#3898EC]/10 border border-[#3898EC]/30 ml-4 sm:ml-8'
                            : 'bg-[#060b11] border border-slate-700/80 mr-4 sm:mr-8'
                        }`}
                      >
                        <div
                          className={`flex items-center justify-between gap-2 pb-1.5 border-b ${
                            isAdmin ? 'border-[#3898EC]/20' : 'border-slate-800'
                          }`}
                        >
                          <span
                            className={`text-[11px] font-mono font-bold flex items-center gap-1.5 ${
                              isAdmin ? 'text-[#3898EC]' : 'text-slate-300'
                            }`}
                          >
                            {isAdmin ? (
                              <Headphones className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                            )}
                            <span>{isAdmin ? `NEO Dispatch Control · ${msg.sender_name}` : `${msg.sender_name} (Client Reply)`}</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                            · {new Date(msg.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-100 leading-relaxed whitespace-pre-wrap font-sans">
                          {msg.message}
                        </p>
                      </div>
                    );
                  })}

                  {loadingMessages && (
                    <div className="flex items-center justify-center gap-2 py-4 text-xs font-mono text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3898EC]" />
                      <span>Syncing message thread...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Reply Composer Form */}
              <form onSubmit={handleSendAdminReply} className="pt-2 border-t border-slate-700/40 space-y-2.5 shrink-0">
                {replyError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{replyError}</span>
                  </div>
                )}
                {replySuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{replySuccess}</span>
                  </div>
                )}

                <div>
                  <textarea
                    rows={3}
                    placeholder="Type dispatch response, driver confirmation, or operational update to client..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={isSendingReply}
                    className="w-full text-xs p-3 rounded-xl border border-slate-700 bg-[#060b11] text-white placeholder-slate-500 focus:border-[#3898EC] focus:outline-none transition-colors"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                    Replies synchronize immediately to the customer portal.
                  </span>
                  <div className="flex items-center gap-2 ml-auto">
                    <GhostButton
                      type="button"
                      isDarkMode={isDarkMode}
                      size="sm"
                      onClick={() => setSelectedTicket(null)}
                    >
                      Close
                    </GhostButton>
                    <PrimaryButton
                      type="submit"
                      disabled={!replyText.trim() || isSendingReply}
                      size="sm"
                      icon={isSendingReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    >
                      {isSendingReply ? 'Sending Reply...' : 'Send Reply'}
                    </PrimaryButton>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Spoke Pilot Dispatch Confirmation Modal (TASK-001) */}
        {pilotDispatchBooking && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pilot-dispatch-modal-title"
            className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200"
          >
            <div
              className={`p-5 sm:p-6 rounded-2xl border max-w-2xl w-full max-h-[92vh] flex flex-col ${
                isDarkMode ? 'bg-[#0b121c] border-[#172334] text-white' : 'bg-white border-slate-200 text-slate-900'
              } shadow-2xl space-y-4`}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-700/40 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 id="pilot-dispatch-modal-title" className="font-bold text-base text-white">
                        Dispatch to Spoke (Pilot)
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        Pilot Mode
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Consignment Ref: <span className="text-[#3898EC] font-bold">{pilotDispatchBooking.reference || pilotDispatchBooking.id}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isDispatching}
                  onClick={handleClosePilotDispatchModal}
                  aria-label="Close dispatch modal"
                  className="text-slate-400 hover:text-white text-xs font-mono p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* SUCCESS STATE */}
                {dispatchSuccessResult ? (
                  <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-3">
                    <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Pilot Dispatch Succeeded</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {dispatchSuccessResult.message || 'Spoke plan created, stops imported, and pilot driver allocated successfully.'}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs font-mono">
                      <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Spoke Plan ID</span>
                        <span className="text-emerald-300 font-bold select-all break-all">{dispatchSuccessResult.planId}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Claim ID</span>
                        <span className="text-slate-300 select-all break-all">{dispatchSuccessResult.claimId}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Stops Imported</span>
                        <span className="text-slate-200 font-bold">{dispatchSuccessResult.stopsImported ?? 2} (Pickup & Dropoff)</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Driver Allocation</span>
                        <span className="text-emerald-300 font-bold">{dispatchSuccessResult.driverAssigned || 'Configured Pilot Driver'}</span>
                      </div>
                    </div>
                    {dispatchSuccessResult.persistenceWarning ? (
                      <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/40 text-[11px] text-amber-300 font-mono">
                        ⚠️ Local database synchronization warning: {dispatchSuccessResult.persistenceWarning}
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 font-mono">
                        ✓ Authoritative database records refreshed. Booking transitioned to <span className="text-sky-400 font-bold">IN TRANSIT</span> via verified server pipeline.
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* CONSIGNMENT PRE-FLIGHT SUMMARY CARD */}
                    <div className="p-3.5 rounded-xl bg-[#060b11] border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                          Pre-Flight Consignment Details
                        </span>
                        <span className="text-xs font-mono text-emerald-400 font-bold">
                          {pilotDispatchBooking.total ? `£${pilotDispatchBooking.total.toFixed(2)}` : 'Standby Agreed'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Collection / Origin</span>
                          <div className="flex items-start gap-1.5 mt-0.5 text-slate-200">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="font-medium">{pilotDispatchBooking.origin}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Destination / Dropoff</span>
                          <div className="flex items-start gap-1.5 mt-0.5 text-slate-200">
                            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                            <span className="font-medium">{pilotDispatchBooking.destination}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Vehicle</span>
                          <span className="text-slate-300 font-bold">{pilotDispatchBooking.vehicle}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Weight</span>
                          <span className="text-slate-300 font-bold">{pilotDispatchBooking.weightKg ? `${pilotDispatchBooking.weightKg} kg` : 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Cargo</span>
                          <span className="text-slate-300 truncate block" title={pilotDispatchBooking.cargo || 'General Freight'}>
                            {pilotDispatchBooking.cargo || 'General Freight'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* PLAN DATE SELECTOR */}
                    <div className="space-y-1.5">
                      <label htmlFor="pilot-plan-date" className="block text-xs font-mono font-semibold text-slate-300">
                        Spoke Dispatch Plan Date (YYYY-MM-DD)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id="pilot-plan-date"
                          type="date"
                          disabled={isDispatching}
                          value={pilotDispatchDate}
                          onChange={(e) => handlePilotDispatchDateChange(e.target.value)}
                          className="px-3 py-2 rounded-xl text-xs font-mono bg-black/40 border border-slate-700 text-white focus:outline-hidden focus:border-[#3898EC] disabled:opacity-50 flex-1"
                        />
                        <button
                          type="button"
                          disabled={isDispatching || isDryRunLoading}
                          onClick={() => pilotDispatchBooking && fetchDryRunPreview(pilotDispatchBooking.id, pilotDispatchDate)}
                          className="px-3 py-2 rounded-xl text-xs font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
                          title="Re-run dry run preview"
                        >
                          {isDryRunLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          <span>Re-check</span>
                        </button>
                      </div>
                    </div>

                    {/* PRE-FLIGHT DRY-RUN PREVIEW */}
                    <div className="p-3.5 rounded-xl bg-[#060b11] border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sliders className="w-3.5 h-3.5 text-[#3898EC]" />
                          <span className="text-xs font-mono font-bold text-white">
                            Pre-Flight Payload Simulation (/dry-run)
                          </span>
                        </div>
                        {isDryRunLoading && (
                          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin text-[#3898EC]" />
                            Simulating...
                          </span>
                        )}
                      </div>

                      {dryRunError && (
                        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                          <div className="flex-1">
                            <span className="font-bold block">Pre-Flight Simulation Warning:</span>
                            <span>{dryRunError}</span>
                          </div>
                        </div>
                      )}

                      {dryRunResult && dryRunResult.success && (
                        <div className="space-y-2 text-xs font-mono">
                          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                            <span className="text-slate-400 text-[11px]">Proposed Spoke Plan:</span>
                            <span className="text-sky-300 font-bold truncate max-w-[280px]" title={dryRunResult.plan?.title}>
                              {dryRunResult.plan?.title}
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px]">
                            <span className="text-slate-400">Mapped Stops:</span>
                            <span className="text-emerald-400 font-bold">
                              {dryRunResult.stops?.length ?? 2} Stops (1 Pickup + 1 Delivery)
                            </span>
                          </div>
                          {dryRunResult.summary?.warnings && dryRunResult.summary.warnings.length > 0 && (
                            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] space-y-1">
                              <span className="font-bold block">Mapper Notices:</span>
                              {dryRunResult.summary.warnings.map((w, i) => (
                                <p key={i} className="leading-tight">• {w}</p>
                              ))}
                            </div>
                          )}
                          <p className="text-[10px] text-slate-500">
                            ✓ Pure dry-run validated in-memory. Zero network writes executed to Spoke API.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* ADDRESS GEOCODING MANUAL REVIEW & OVERRIDE */}
                    {dryRunResult && dryRunResult.success && dryRunResult.geocoding?.anyRequiresManualReview && (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border-2 border-amber-500/40 space-y-2.5">
                        <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>Address Geocoding Manual Review Required</span>
                        </div>
                        <p className="text-[11px] text-amber-200/90 leading-relaxed font-mono">
                          One or more consignment addresses resolved to imprecise or ambiguous coordinates (such as an industrial estate or business park centroid rather than an exact building unit). Inspect precision details below:
                        </p>

                        <div className="space-y-2 text-[11px] font-mono">
                          {dryRunResult.geocoding.pickup && (
                            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 font-semibold">Pickup Address Geocode:</span>
                                <span className={dryRunResult.geocoding.pickup.requiresManualReview ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                                  Precision: {dryRunResult.geocoding.pickup.precision || 'unknown'}
                                </span>
                              </div>
                              <div className="text-slate-300 truncate" title={dryRunResult.geocoding.pickup.matchedName}>
                                Matched: {dryRunResult.geocoding.pickup.matchedName || 'N/A'}
                              </div>
                              {dryRunResult.stops?.[0]?.address && (
                                <div className="text-slate-400 text-[10px]">
                                  Coordinates: {dryRunResult.stops[0].address.latitude}, {dryRunResult.stops[0].address.longitude}
                                </div>
                              )}
                              {dryRunResult.geocoding.pickup.reviewReasons?.map((r: string, idx: number) => (
                                <div key={idx} className="text-amber-300 text-[10px] pl-2 border-l border-amber-500/50">
                                  ⚠ {r}
                                </div>
                              ))}
                            </div>
                          )}

                          {dryRunResult.geocoding.dropoff && (
                            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 font-semibold">Delivery Address Geocode:</span>
                                <span className={dryRunResult.geocoding.dropoff.requiresManualReview ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                                  Precision: {dryRunResult.geocoding.dropoff.precision || 'unknown'}
                                </span>
                              </div>
                              <div className="text-slate-300 truncate" title={dryRunResult.geocoding.dropoff.matchedName}>
                                Matched: {dryRunResult.geocoding.dropoff.matchedName || 'N/A'}
                              </div>
                              {dryRunResult.stops?.[1]?.address && (
                                <div className="text-slate-400 text-[10px]">
                                  Coordinates: {dryRunResult.stops[1].address.latitude}, {dryRunResult.stops[1].address.longitude}
                                </div>
                              )}
                              {dryRunResult.geocoding.dropoff.reviewReasons?.map((r: string, idx: number) => (
                                <div key={idx} className="text-amber-300 text-[10px] pl-2 border-l border-amber-500/50">
                                  ⚠ {r}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* EXPLICIT AUTHORIZATION OVERRIDE CHECKBOX */}
                        <div className="pt-2 border-t border-amber-500/20">
                          <label className="flex items-start gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              id="pilot-geocode-override"
                              disabled={isDispatching}
                              checked={allowGeocodeOverride}
                              onChange={(e) => setAllowGeocodeOverride(e.target.checked)}
                              className="mt-0.5 rounded border-amber-600 text-amber-500 focus:ring-amber-500 cursor-pointer disabled:opacity-50"
                            />
                            <span className="text-xs text-amber-200 leading-snug">
                              <strong>Authorize Imprecise Geocode Override:</strong> I have reviewed the flagged address precision above and explicitly authorize pilot dispatch with the centroid / imprecise location for booking{' '}
                              <span className="text-white font-mono font-bold">{pilotDispatchBooking.reference || pilotDispatchBooking.id}</span>.
                            </span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* CRITICAL SECURITY & OPERATIONAL WARNING */}
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Operational Warning: Active Spoke Pilot Consignment</span>
                      </div>
                      <p className="text-xs text-amber-200/90 leading-relaxed">
                        Submitting this dispatch will create an active Spoke plan, import 2 delivery stops, and allocate the designated pilot driver. Ensure consignment addresses, weights, and scheduling window are operational.
                      </p>
                    </div>

                    {/* PILOT AUTHORIZATION TOKEN INPUT */}
                    <div className="space-y-1.5">
                      {/* Hidden decoy fields to intercept Chrome credential manager from latching onto search bar */}
                      <input
                        type="text"
                        name="decoy_pilot_username"
                        tabIndex={-1}
                        aria-hidden="true"
                        autoComplete="off"
                        className="sr-only opacity-0 pointer-events-none fixed -top-[9999px] left-0"
                      />
                      <input
                        type="password"
                        name="decoy_pilot_password"
                        tabIndex={-1}
                        aria-hidden="true"
                        autoComplete="new-password"
                        className="sr-only opacity-0 pointer-events-none fixed -top-[9999px] left-0"
                      />

                      <div className="flex items-center justify-between">
                        <label htmlFor="pilot-auth-token" className="block text-xs font-mono font-semibold text-slate-300">
                          Pilot Authorization Secret Token <span className="text-rose-400">*</span>
                        </label>
                        <span className="text-[10px] font-mono text-slate-500">Requires server approved token</span>
                      </div>
                      <input
                        id="pilot-auth-token"
                        name="pilotAuthTokenSecret"
                        type="password"
                        autoComplete="new-password"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        disabled={isDispatching}
                        value={pilotAuthToken}
                        onChange={(e) => setPilotAuthToken(e.target.value)}
                        placeholder="Enter approved pilot authorization token..."
                        className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-black/40 border border-slate-700 text-white placeholder-slate-600 focus:outline-hidden focus:border-amber-400 disabled:opacity-50"
                      />
                      <p className="text-[10px] text-slate-500 font-mono">
                        Validated server-side against <code className="text-slate-400">NEO_SPOKE_PILOT_DISPATCH_APPROVED_TOKEN</code>. Never cached in browser storage or logs.
                      </p>
                    </div>

                    {/* EXPLICIT CONFIRMATION CHECKBOX */}
                    <div className="p-3 rounded-xl bg-black/30 border border-slate-800">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          disabled={isDispatching}
                          checked={pilotConfirmed}
                          onChange={(e) => setPilotConfirmed(e.target.checked)}
                          className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer disabled:opacity-50"
                        />
                        <span className="text-xs text-slate-300 leading-snug">
                          I confirm this initiates an active Spoke dispatch plan and driver assignment for pilot booking{' ' }
                          <span className="text-amber-400 font-mono font-bold">{pilotDispatchBooking.reference || pilotDispatchBooking.id}</span>. I understand this allocates live pilot resources.
                        </span>
                      </label>
                    </div>

                    {/* DISPATCH ERROR BANNER */}
                    {dispatchError && (
                      <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono space-y-2.5">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                          <div className="flex-1">
                            <span className="font-bold block">Dispatch Rejected:</span>
                            <span className="leading-relaxed">{dispatchError}</span>
                          </div>
                        </div>

                        {existingClaimConflict && existingClaimConflict.status === 'failed_unknown' && (
                          <div className="pt-2 border-t border-rose-500/20 space-y-2">
                            {existingClaimConflict.planDate === pilotDispatchDate ? (
                              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/40 border border-amber-500/30">
                                <span className="text-[11px] text-amber-300">
                                  Empty plan <code>{existingClaimConflict.planId}</code> exists for this date.
                                </span>
                                <button
                                  type="button"
                                  disabled={isDispatching}
                                  onClick={handleRecoverExistingPlan}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                                >
                                  {isDispatching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                  <span>Recover Existing Plan</span>
                                </button>
                              </div>
                            ) : (
                              <div className="p-2 rounded-lg bg-black/40 border border-cyan-500/30 space-y-2">
                                <span className="text-[11px] text-cyan-300 block">
                                  Previous plan was created for <strong>{existingClaimConflict.planDate}</strong> ({existingClaimConflict.planId || 'unknown'}). Target dispatch date is <strong>{pilotDispatchDate}</strong>.
                                </span>
                                <button
                                  type="button"
                                  disabled={isDispatching}
                                  onClick={handleSupersedeStaleClaimAndDispatch}
                                  className="w-full px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                >
                                  {isDispatching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                  <span>Supersede Stale Claim & Dispatch for Today ({pilotDispatchDate})</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-700/40 flex items-center justify-end gap-2.5 shrink-0">
                {dispatchSuccessResult ? (
                  <button
                    type="button"
                    onClick={handleClosePilotDispatchModal}
                    className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-[#3898EC] hover:bg-[#3898EC]/90 text-white transition-all cursor-pointer shadow-xs"
                  >
                    Close & Return to Dispatch Console
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={isDispatching}
                      onClick={handleClosePilotDispatchModal}
                      className="px-3.5 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={
                        isDispatching ||
                        isDryRunLoading ||
                        !dryRunResult ||
                        !dryRunResult.success ||
                        Boolean(dryRunError) ||
                        !pilotAuthToken.trim() || !pilotConfirmed ||
                        !isPilotDispatchExecutable({
                          isDispatching,
                          isDryRunLoading,
                          dryRunResult,
                          dryRunError,
                          pilotAuthToken,
                          pilotConfirmed,
                          pilotDispatchBooking,
                          allowGeocodeOverride,
                        })
                      }
                      onClick={handleExecutePilotDispatch}
                      className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                      {isDispatching ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Dispatching to Spoke...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Execute Pilot Dispatch</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            BOOKING DETAILS MODAL (VIEW DETAILS)
            ========================================================================= */}
        {selectedBookingDetails && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-details-modal-title"
            className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200"
          >
            <div
              className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col ${
                isDarkMode ? 'bg-[#070D14] border-[#172436] text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-700/40 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-[#3898EC]">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 id="booking-details-modal-title" className="font-mono text-xl font-bold tracking-tight">
                        {selectedBookingDetails.reference}
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleCopyBookingRef(selectedBookingDetails.reference)}
                        className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Copy Reference"
                      >
                        {copiedBookingRef === selectedBookingDetails.reference ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <StatusPill status={selectedBookingDetails.status} isDarkMode={isDarkMode} />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Consignment & Corridor Dispatch Details · Booked {selectedBookingDetails.date}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBookingDetails(null)}
                  className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                {/* Route Corridor */}
                <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#04080F] border-[#142335]' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-3">
                    TRANSIT CORRIDOR & ROUTE
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                        <MapPin className="w-4 h-4" />
                        <span>ORIGIN / COLLECTION</span>
                      </div>
                      <p className="text-xs font-medium leading-relaxed">{selectedBookingDetails.origin}</p>
                      {selectedBookingDetails.pickupTime && (
                        <p className="text-[11px] text-slate-400 font-mono">Collection window: {selectedBookingDetails.pickupTime}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold">
                        <MapPin className="w-4 h-4" />
                        <span>DESTINATION / DROPOFF</span>
                      </div>
                      <p className="text-xs font-medium leading-relaxed">{selectedBookingDetails.destination}</p>
                      {selectedBookingDetails.deliveryTime && (
                        <p className="text-[11px] text-slate-400 font-mono">Estimated arrival: {selectedBookingDetails.deliveryTime}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Consignment Specs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-[#04080F] border-[#142335]' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Vehicle Class</span>
                    <span className="text-xs font-bold mt-1 block truncate">{selectedBookingDetails.vehicle}</span>
                  </div>
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-[#04080F] border-[#142335]' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Agreed Tariff</span>
                    <span className="text-sm font-bold text-emerald-400 mt-1 block">£{selectedBookingDetails.total}</span>
                  </div>
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-[#04080F] border-[#142335]' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Cargo / Goods</span>
                    <span className="text-xs font-semibold mt-1 block truncate">
                      {selectedBookingDetails.cargo || (selectedBookingDetails.weightKg ? `${selectedBookingDetails.weightKg} kg` : 'Palletised goods')}
                    </span>
                  </div>
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-[#04080F] border-[#142335]' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Pallet Count</span>
                    <span className="text-xs font-bold mt-1 block">{selectedBookingDetails.palletCount ?? 1} Pallets</span>
                  </div>
                </div>

                {/* Driver & Telemetry */}
                <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#04080F] border-[#142335]' : 'bg-slate-50 border-slate-200'} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      ASSIGNED DRIVER & FLEET TELEMETRY
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                      {selectedBookingDetails.driver?.registration || 'NO REG'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Driver Name:</span>
                      <span className="font-semibold text-slate-200">{selectedBookingDetails.driver?.name || 'Unassigned'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Vehicle Assigned:</span>
                      <span className="font-semibold text-slate-200">{selectedBookingDetails.driver?.vehicleModel || selectedBookingDetails.vehicle}</span>
                    </div>
                    {selectedBookingDetails.driver?.phone && (
                      <div>
                        <span className="text-slate-400 block text-[11px]">Driver Contact:</span>
                        <button
                          type="button"
                          onClick={() => initiateAircallDial(selectedBookingDetails.driver!.phone, true)}
                          className="font-mono text-sky-400 hover:underline flex items-center gap-1 mt-0.5 cursor-pointer"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{selectedBookingDetails.driver.phone} (Aircall)</span>
                        </button>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-400 block text-[11px]">Corridor Progress:</span>
                      <span className="font-mono text-[#3898EC] font-bold">
                        {selectedBookingDetails.progress ?? (selectedBookingDetails.status === 'DELIVERED' ? 100 : selectedBookingDetails.status === 'IN TRANSIT' ? 45 : 0)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-700/40 bg-black/20 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedBookingDetails(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <div className="flex items-center gap-2">
                  {selectedBookingDetails.status === 'SCHEDULED' && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedBookingDetails;
                        setSelectedBookingDetails(null);
                        handleOpenPilotDispatchModal(target);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Dispatch to Spoke</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedBookingDetails;
                      setSelectedBookingDetails(null);
                      setEditingBooking(target);
                      setEditProgress(target.progress ?? (target.status === 'DELIVERED' ? 100 : target.status === 'SCHEDULED' ? 0 : 45));
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0070F3] hover:bg-[#0060DF] text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Open Dispatch Controls</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Dock for Admin */}
      <nav
        aria-label="Admin Mobile Navigation Dock"
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[#0b0d11] border-t border-[#1e2229]"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
        }}
      >
        <div className="grid grid-cols-5 items-center px-1 pt-2">
          {[
            {
              id: 'dispatch' as AdminTab,
              label: 'Dispatch',
              icon: Truck,
              badge: bookings.filter((b) => b.status === 'IN TRANSIT' || b.status === 'SCHEDULED').length,
            },
            {
              id: 'users' as AdminTab,
              label: 'Accounts',
              icon: Users,
              badge: undefined,
            },
            {
              id: 'applications' as AdminTab,
              label: 'Pilots',
              icon: UserCheck,
              badge: applications.filter((a) => a.status === 'pending').length,
            },
            {
              id: 'billing' as AdminTab,
              label: 'Finance',
              icon: CreditCard,
              badge: invoices.filter((i) => i.status === 'DUE' || i.status === 'OVERDUE').length,
            },
            {
              id: 'tickets' as AdminTab,
              label: 'Support',
              icon: Headphones,
              badge: tickets.filter((t) => t.status === 'Open').length,
            },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`relative flex flex-col items-center justify-center py-1.5 px-1 transition-colors select-none ${
                  isActive ? 'text-[#206bc4]' : 'text-slate-400 hover:text-slate-200'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Active Indicator Top Line */}
                {isActive && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#206bc4] rounded-full" />
                )}

                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 bg-amber-500 text-slate-950 text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </div>

                <span
                  className={`text-[10px] tracking-tight mt-1 font-mono ${
                    isActive ? 'font-medium text-white' : 'font-normal text-slate-400'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

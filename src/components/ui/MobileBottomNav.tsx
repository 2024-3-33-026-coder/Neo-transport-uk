import React, { useState } from 'react';
import {
  Package,
  Navigation,
  Download,
  CreditCard,
  Headphones,
  Home,
  Plus,
  Moon,
  Sun,
  Shield,
  LogOut,
  X,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { ViewMode } from '../../types';

interface MobileBottomNavProps {
  currentView: ViewMode;
  onNavigate: (view: ViewMode) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onSignOut: () => void;
  userRole?: string;
  onSwitchToAdmin?: () => void;
  hasActiveInTransit?: boolean;
  documentCount?: number;
  unpaidInvoiceCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate,
  isDarkMode,
  onToggleTheme,
  onSignOut,
  userRole,
  onSwitchToAdmin,
  hasActiveInTransit = false,
  documentCount = 0,
  unpaidInvoiceCount = 0,
}) => {
  const [showQuickDrawer, setShowQuickDrawer] = useState(false);

  const handleTabClick = (view: ViewMode) => {
    onNavigate(view);
    setShowQuickDrawer(false);
  };

  // Check which tab is active
  const isBookingsActive =
    currentView === 'booking-history' || currentView === 'new-booking' || currentView === 'quotes';
  const isTrackingActive = currentView === 'live-tracking';
  const isDownloadsActive = currentView === 'documents';
  const isPaymentsActive = currentView === 'invoices';
  const isContactActive = currentView === 'support';

  return (
    <>
      {/* =========================================================================
          FIXED MOBILE BOTTOM NAVIGATION DOCK (lg:hidden)
          5 Primary Tabs: Bookings | Tracking | Downloads | Payments | Contact
          ========================================================================= */}
      <nav
        aria-label="Mobile Navigation Dock"
        className={`fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t transition-colors ${
          isDarkMode
            ? 'bg-[#0b0f19] border-[#1e293b] text-slate-400'
            : 'bg-white/95 backdrop-blur-sm border-slate-200/80 text-slate-500 shadow-advertz'
        }`}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
      >
        <div className="grid grid-cols-5 items-center h-16 px-1 max-w-lg mx-auto w-full">
          {/* TAB 1: BOOKING */}
          <button
            type="button"
            onClick={() => handleTabClick('booking-history')}
            className={`flex flex-col items-center justify-center w-full min-w-0 py-1 relative select-none cursor-pointer group transition-colors ${
              isBookingsActive
                ? 'text-blue-600'
                : isDarkMode
                ? 'hover:text-slate-200 text-slate-400'
                : 'hover:text-slate-900 text-slate-500'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-colors flex items-center justify-center relative ${
                isBookingsActive
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                  : 'group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
              }`}
            >
              <Package
                className={`w-5 h-5 ${
                  isBookingsActive ? 'stroke-[2.2]' : 'stroke-[1.8]'
                }`}
              />
            </div>
            <span
              className={`text-[10px] mt-0.5 tracking-tight transition-colors truncate ${
                isBookingsActive ? 'font-semibold text-blue-600 dark:text-blue-400' : 'font-medium'
              }`}
            >
              Bookings
            </span>
            {isBookingsActive && (
              <span className="w-1.5 h-1 rounded-full bg-blue-600 dark:bg-blue-400 mt-0.5" />
            )}
          </button>

          {/* TAB 2: TRACKING */}
          <button
            type="button"
            onClick={() => handleTabClick('live-tracking')}
            className={`flex flex-col items-center justify-center w-full min-w-0 py-1 relative select-none cursor-pointer group transition-colors ${
              isTrackingActive
                ? 'text-blue-600'
                : isDarkMode
                ? 'hover:text-slate-200 text-slate-400'
                : 'hover:text-slate-900 text-slate-500'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-colors flex items-center justify-center relative ${
                isTrackingActive
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                  : 'group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
              }`}
            >
              <Navigation
                className={`w-5 h-5 ${
                  isTrackingActive ? 'stroke-[2.2] text-blue-600 dark:text-blue-400' : 'stroke-[1.8]'
                }`}
              />
              {/* Active in transit indicator dot */}
              {hasActiveInTransit && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
            </div>
            <span
              className={`text-[10px] mt-0.5 tracking-tight transition-colors truncate ${
                isTrackingActive ? 'font-semibold text-blue-600 dark:text-blue-400' : 'font-medium'
              }`}
            >
              Tracking
            </span>
            {isTrackingActive && (
              <span className="w-1.5 h-1 rounded-full bg-blue-600 dark:bg-blue-400 mt-0.5" />
            )}
          </button>

          {/* TAB 3: DOWNLOADS */}
          <button
            type="button"
            onClick={() => handleTabClick('documents')}
            className={`flex flex-col items-center justify-center w-full min-w-0 py-1 relative select-none cursor-pointer group transition-colors ${
              isDownloadsActive
                ? 'text-blue-600'
                : isDarkMode
                ? 'hover:text-slate-200 text-slate-400'
                : 'hover:text-slate-900 text-slate-500'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-colors flex items-center justify-center relative ${
                isDownloadsActive
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                  : 'group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
              }`}
            >
              <Download
                className={`w-5 h-5 ${
                  isDownloadsActive ? 'stroke-[2.2]' : 'stroke-[1.8]'
                }`}
              />
              {documentCount > 0 && !isDownloadsActive && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 bg-slate-700 text-slate-200 rounded-full text-[9px] font-mono font-medium flex items-center justify-center">
                  {documentCount}
                </span>
              )}
            </div>
            <span
              className={`text-[10px] mt-0.5 tracking-tight transition-colors truncate ${
                isDownloadsActive ? 'font-semibold text-blue-600 dark:text-blue-400' : 'font-medium'
              }`}
            >
              Downloads
            </span>
            {isDownloadsActive && (
              <span className="w-1.5 h-1 rounded-full bg-blue-600 dark:bg-blue-400 mt-0.5" />
            )}
          </button>

          {/* TAB 4: PAYMENTS */}
          <button
            type="button"
            onClick={() => handleTabClick('invoices')}
            className={`flex flex-col items-center justify-center w-full min-w-0 py-1 relative select-none cursor-pointer group transition-colors ${
              isPaymentsActive
                ? 'text-blue-600'
                : isDarkMode
                ? 'hover:text-slate-200 text-slate-400'
                : 'hover:text-slate-900 text-slate-500'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-colors flex items-center justify-center relative ${
                isPaymentsActive
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                  : 'group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
              }`}
            >
              <CreditCard
                className={`w-5 h-5 ${
                  isPaymentsActive ? 'stroke-[2.2]' : 'stroke-[1.8]'
                }`}
              />
              {unpaidInvoiceCount > 0 && !isPaymentsActive && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 bg-amber-500 text-slate-950 rounded-full text-[9px] font-mono font-bold flex items-center justify-center">
                  {unpaidInvoiceCount}
                </span>
              )}
            </div>
            <span
              className={`text-[10px] mt-0.5 tracking-tight transition-colors truncate ${
                isPaymentsActive ? 'font-semibold text-blue-600 dark:text-blue-400' : 'font-medium'
              }`}
            >
              Payments
            </span>
            {isPaymentsActive && (
              <span className="w-1.5 h-1 rounded-full bg-blue-600 dark:bg-blue-400 mt-0.5" />
            )}
          </button>

          {/* TAB 5: CONTACT */}
          <button
            type="button"
            onClick={() => handleTabClick('support')}
            className={`flex flex-col items-center justify-center w-full min-w-0 py-1 relative select-none cursor-pointer group transition-colors ${
              isContactActive
                ? 'text-blue-600'
                : isDarkMode
                ? 'hover:text-slate-200 text-slate-400'
                : 'hover:text-slate-900 text-slate-500'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-colors flex items-center justify-center relative ${
                isContactActive
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                  : 'group-hover:bg-slate-100 dark:group-hover:bg-slate-800'
              }`}
            >
              <Headphones
                className={`w-5 h-5 ${
                  isContactActive ? 'stroke-[2.2]' : 'stroke-[1.8]'
                }`}
              />
            </div>
            <span
              className={`text-[10px] mt-0.5 tracking-tight transition-colors truncate ${
                isContactActive ? 'font-semibold text-blue-600 dark:text-blue-400' : 'font-medium'
              }`}
            >
              Contact
            </span>
            {isContactActive && (
              <span className="w-1.5 h-1 rounded-full bg-blue-600 dark:bg-blue-400 mt-0.5" />
            )}
          </button>
        </div>
      </nav>

      {/* Slide-up Preferences / Quick Actions Modal if needed */}
      {showQuickDrawer && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-black/70 transition-opacity"
            onClick={() => setShowQuickDrawer(false)}
          />
          <div
            className={`relative w-full rounded-t-xl border-t p-5 transition-transform animate-view-entrance z-10 max-h-[85vh] overflow-y-auto ${
              isDarkMode ? 'bg-[#12151b] border-[#1e2229] text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
          >
            <div className="w-8 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Quick actions</h3>
              <button
                type="button"
                onClick={() => setShowQuickDrawer(false)}
                className={`p-1.5 rounded-lg cursor-pointer ${isDarkMode ? 'bg-[#1e2229] text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick buttons */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleTabClick('new-booking')}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-[#206bc4] hover:bg-[#1a5bb0] text-white font-medium text-xs cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  <span>Start new booking</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleTabClick('dashboard')}
                className={`w-full flex items-center justify-between p-3 rounded-lg border text-xs font-medium cursor-pointer ${
                  isDarkMode ? 'border-[#1e2229] hover:bg-[#1e2229]' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  <span>Return to overview</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

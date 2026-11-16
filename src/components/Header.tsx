import React, { useState } from 'react';
import { Bell, Sun, Moon, LogOut, Shield, CheckCheck, ChevronDown } from 'lucide-react';
import {
  InAppNotification,
  fetchCustomerNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../lib/portalStore';

interface HeaderUserProfile {
  full_name?: string;
  initials?: string;
  companyName?: string;
  company_id?: string;
  email?: string;
  role?: string;
  id?: string;
}

interface HeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onSignOut: () => void;
  subtitle?: string;
  isLanding?: boolean;
  onNavigatePortal?: () => void;
  userProfile?: HeaderUserProfile;
  onSwitchToAdmin?: () => void;
  notifications?: InAppNotification[];
  onSelectNotification?: (notification: InAppNotification) => void;
}

export const Header: React.FC<HeaderProps> = ({
  isDarkMode,
  onToggleTheme,
  onSignOut,
  subtitle = 'CUSTOMER PORTAL',
  isLanding = false,
  onNavigatePortal,
  userProfile = {
    full_name: 'Chris Sullivan',
    initials: 'CS',
    companyName: 'Meridian Logistics',
  },
  onSwitchToAdmin,
  notifications: propNotifications,
  onSelectNotification,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);
  const [internalNotifications, setInternalNotifications] = useState<InAppNotification[]>([]);
  const notificationRef = React.useRef<HTMLDivElement>(null);
  const bellButtonRef = React.useRef<HTMLButtonElement>(null);

  // Load real notifications from store
  const loadNotifications = React.useCallback(async () => {
    try {
      const items = await fetchCustomerNotifications(userProfile?.company_id, userProfile?.email);
      setInternalNotifications(items);
    } catch (e) {
      console.warn('[Header] Failed to load notifications:', e);
    }
  }, [userProfile?.company_id, userProfile?.email]);

  React.useEffect(() => {
    loadNotifications();
    const handleSync = () => { loadNotifications(); };
    window.addEventListener('neo_portal_sync', handleSync);
    return () => { window.removeEventListener('neo_portal_sync', handleSync); };
  }, [loadNotifications]);

  const activeNotifications = propNotifications || internalNotifications;
  const unreadCount = activeNotifications.filter((n: InAppNotification) => !n.read).length;

  const handleNotificationClick = (notif: InAppNotification) => {
    markNotificationAsRead(notif.id);
    setInternalNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    if (onSelectNotification) {
      onSelectNotification(notif);
    }
    setShowNotifications(false);
  };

  const handleMarkAllRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    markAllNotificationsAsRead(activeNotifications.map((n) => n.id));
    setInternalNotifications((prev) => prev.map((n: InAppNotification) => ({ ...n, read: true })));
  };

  React.useEffect(() => {
    if (showNotifications || showUserMenu) {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(e.target as Node) &&
        bellButtonRef.current &&
        !bellButtonRef.current.contains(e.target as Node)
      ) {
        setShowNotifications(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(e.target as Node) &&
        bellButtonRef.current &&
        !bellButtonRef.current.contains(e.target as Node)
      ) {
        setShowNotifications(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNotifications]);

  return (
    <header
      className={`w-full h-16 border-b transition-colors z-30 sticky top-0 px-4 lg:px-8 flex items-center justify-between ${
        isDarkMode
          ? 'bg-[#0b0f19]/95 backdrop-blur-sm border-[#1e293b] text-white'
          : 'bg-white/95 backdrop-blur-sm border-slate-200/80 text-slate-900 shadow-advertz'
      }`}
    >
      {/* Brand & Subtitle */}
      <div className="flex items-center gap-3 shrink-0">
        <div
          onClick={onNavigatePortal}
          className="flex items-center cursor-pointer shrink-0"
          role="button"
          tabIndex={0}
          aria-label="NEO Transport Customer Portal"
        >
          {/* Customer portal mobile header: icon only */}
          <img
            src="/brand/logos/neo-transport-icon-blue.svg"
            alt="NEO Transport"
            className="sm:hidden h-6.5 w-auto object-contain shrink-0"
            style={{ aspectRatio: '267.04 / 191.82' }}
          />

          {/* Desktop headers: appropriate full logo variant for the background */}
          <img
            src={
              isDarkMode
                ? '/brand/logos/neo-transport-full-blue-white.svg'
                : '/brand/logos/neo-transport-full-blue-navy.svg'
            }
            alt="NEO TRANSPORT"
            className="hidden sm:block w-[165px] md:w-[185px] h-auto object-contain shrink-0"
            style={{ aspectRatio: '1310.75 / 191.82' }}
          />
        </div>

        <div
          className={`hidden md:block h-4 w-px mx-1 ${
            isDarkMode ? 'bg-[#1e293b]' : 'bg-slate-200'
          }`}
        />

        <span
          className={`hidden md:inline-block text-xs font-medium ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          {subtitle}
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {!isLanding && (
          <>
            {/* Standby Active Badge */}
            <div
              className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                isDarkMode
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Standby Active</span>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                ref={bellButtonRef}
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 rounded-full transition-colors relative cursor-pointer ${
                  isDarkMode
                    ? 'hover:bg-[#1e293b] text-slate-300'
                    : 'hover:bg-slate-100 text-slate-600'
                }`}
                title="Notifications"
                aria-label="Notifications"
                aria-expanded={showNotifications}
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 bg-blue-600 text-white text-[9px] font-semibold rounded-full flex items-center justify-center font-mono">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div
                  ref={notificationRef}
                  className={`fixed sm:absolute right-3 sm:right-0 top-16 sm:top-full mt-2 w-[calc(100vw-24px)] max-w-sm sm:w-88 max-h-[calc(100dvh-90px)] overflow-y-auto rounded-2xl p-4 border z-[100] transition-colors ${
                    isDarkMode
                      ? 'bg-[#111827] border-[#1e293b] text-white shadow-xl shadow-black/50'
                      : 'bg-white border-slate-200/80 text-slate-800 shadow-advertz-lg'
                  }`}
                  role="dialog"
                  aria-label="Notifications panel"
                >
                  <div
                    className={`flex items-center justify-between pb-3 border-b ${
                      isDarkMode ? 'border-[#1e293b]' : 'border-slate-100'
                    }`}
                  >
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Notifications
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] ${
                          isDarkMode ? 'text-slate-400' : 'text-slate-500 font-medium'
                        }`}
                      >
                        {unreadCount} unread
                      </span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="text-[10px] text-blue-600 hover:text-blue-700 hover:underline cursor-pointer font-medium flex items-center gap-1"
                          title="Mark all as read"
                        >
                          <CheckCheck className="w-3 h-3" />
                          Mark all read
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 pt-3 text-xs">
                    {activeNotifications.length === 0 ? (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        No notifications yet
                      </div>
                    ) : (
                      activeNotifications.map((notif: InAppNotification) => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${
                            !notif.read
                              ? isDarkMode
                                ? 'bg-blue-950/20 border-blue-900/40 text-slate-100'
                                : 'bg-blue-50/60 border-blue-100 text-slate-900'
                              : isDarkMode
                              ? 'bg-transparent border-[#1e293b] text-slate-400 hover:bg-[#1e293b]/50'
                              : 'bg-transparent border-slate-100 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className={`font-semibold text-xs leading-snug ${
                              !notif.read
                                ? isDarkMode ? 'text-white' : 'text-slate-900'
                                : isDarkMode ? 'text-slate-300' : 'text-slate-700'
                            }`}>
                              {notif.title}
                            </p>
                            <span className="font-mono text-[10px] text-slate-400 shrink-0">
                              {notif.timestamp}
                            </span>
                          </div>
                          <p className={`text-[11px] mt-1 leading-relaxed ${
                            isDarkMode ? 'text-slate-400' : 'text-slate-500'
                          }`}>
                            {notif.message}
                          </p>
                          {notif.bookingId && (
                            <span className="inline-block mt-1.5 text-[10px] text-blue-600 font-medium hover:underline">
                              View tracking →
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Discreet Dispatch Admin Switcher (Only visible to verified admins) */}
        {onSwitchToAdmin && (userProfile as any)?.role === 'admin' && (
          <button
            onClick={onSwitchToAdmin}
            title="Switch to Dispatch Admin console"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border cursor-pointer ${
              isDarkMode
                ? 'bg-rose-950/20 hover:bg-rose-900/30 text-rose-300 border-rose-900/50'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline">Dispatch Admin</span>
          </button>
        )}

        {/* Theme Switcher */}
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
              !isDarkMode
                ? 'bg-white text-slate-900 shadow-advertz'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Light mode"
            aria-label="Light mode"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={!isDarkMode ? onToggleTheme : undefined}
            className={`p-1.5 rounded-full transition-all cursor-pointer ${
              isDarkMode
                ? 'bg-[#1e293b] text-slate-100 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Dark mode"
            aria-label="Dark mode"
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
        </div>

        {!isLanding && (
          <>
            {/* User Profile Chip */}
            <div
              className={`flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full border transition-colors ${
                isDarkMode ? 'border-[#1e293b] hover:bg-[#1e293b]/50' : 'border-slate-200/80 hover:bg-slate-50 shadow-xs'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold text-xs tracking-tight">
                {userProfile.initials}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className={`text-xs font-semibold leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {userProfile.full_name}
                </span>
                <span
                  className={`text-[11px] leading-tight ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {userProfile.companyName}
                </span>
              </div>
            </div>

            {/* Logout icon */}
            <button
              onClick={onSignOut}
              className={`p-2 rounded-full transition-colors ${
                isDarkMode
                  ? 'hover:bg-[#1e293b] text-slate-400 hover:text-rose-400'
                  : 'hover:bg-slate-100 text-slate-500 hover:text-rose-600'
              }`}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        )}

        {isLanding && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={onNavigatePortal}
              className={`text-xs sm:text-sm font-medium px-4 py-2 rounded-full transition-colors ${
                isDarkMode
                  ? 'text-slate-300 hover:text-white hover:bg-[#1e293b]'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Customer Login
            </button>
            <button
              onClick={onNavigatePortal}
              className="bg-slate-900 hover:bg-black text-white text-xs sm:text-sm font-medium px-5 py-2 rounded-full transition-all shadow-xs"
            >
              Open account
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

import React, { useState } from 'react';
import { Bell, Sun, Moon, LogOut, Shield } from 'lucide-react';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onSignOut: () => void;
  subtitle?: string;
  isLanding?: boolean;
  onNavigatePortal?: () => void;
  userProfile?: {
    full_name: string;
    initials: string;
    companyName: string;
  };
  onSwitchToAdmin?: () => void;
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
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header
      className={`w-full h-16 border-b transition-colors duration-200 z-30 sticky top-0 backdrop-blur-md px-4 lg:px-8 flex items-center justify-between ${
        isDarkMode
          ? 'bg-[#060b11]/90 border-[#172334] text-white'
          : 'bg-white/95 border-slate-200 text-slate-900 shadow-xs'
      }`}
    >
      {/* Brand & Subtitle */}
      <div className="flex items-center gap-3">
        <div
          onClick={onNavigatePortal}
          className="flex items-center gap-2.5 cursor-pointer group"
          role="button"
          tabIndex={0}
        >
          {/* Geometric interlocking chevrons logo */}
          <div className="w-8 h-8 relative flex items-center justify-center">
            <svg viewBox="0 0 32 32" className="w-8 h-8 fill-none">
              <path
                d="M6 10L14 4L18 7L10 13L6 10Z"
                fill="#3898EC"
              />
              <path
                d="M14 28L22 22L26 25L18 31L14 28Z"
                fill="#3898EC"
              />
              <path
                d="M10 13L18 7L26 13L18 19L10 13Z"
                fill="#2b85d6"
                className="opacity-90"
              />
              <path
                d="M6 19L14 13L18 16L10 22L6 19Z"
                fill="#3898EC"
              />
              <path
                d="M14 19L22 13L26 16L18 22L14 19Z"
                fill="#60a5fa"
              />
            </svg>
          </div>
          <span className="font-extrabold tracking-tight text-lg uppercase font-sans">
            NEO TRANSPORT
          </span>
        </div>

        <div className="hidden sm:block h-4 w-px bg-slate-700/60 mx-1" />

        <span
          className={`hidden sm:inline-block font-mono text-[11px] tracking-widest uppercase ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500 font-medium'
          }`}
        >
          {subtitle}
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 sm:gap-4">
        {!isLanding && (
          <>
            {/* Standby Active Badge */}
            <div
              className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium tracking-wide ${
                isDarkMode
                  ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-glow" />
              <span>STANDBY ACTIVE</span>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 rounded-full transition-colors relative ${
                  isDarkMode
                    ? 'hover:bg-slate-800 text-slate-300'
                    : 'hover:bg-slate-100 text-slate-600'
                }`}
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#3898EC] rounded-full" />
              </button>

              {showNotifications && (
                <div
                  className={`absolute right-0 mt-2 w-80 rounded-2xl p-4 shadow-xl border z-50 transition-all ${
                    isDarkMode
                      ? 'bg-[#0b121c] border-[#1e2c40] text-white'
                      : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-700/30">
                    <span className="font-mono text-xs uppercase tracking-wider text-[#3898EC]">
                      Notifications
                    </span>
                    <span className="text-[11px] text-slate-400">2 unread</span>
                  </div>
                  <div className="space-y-3 pt-3 text-xs">
                    <div className="p-2.5 rounded-xl bg-[#3898EC]/10 border border-[#3898EC]/20">
                      <p className="font-semibold text-slate-200">
                        Booking NT-24817 in transit
                      </p>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Marek K. passing M6 J18 · ETA 88 min
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40">
                      <p className="font-semibold text-slate-200">
                        July 2026 Statement Ready
                      </p>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Consolidated invoice INV-2026-0481 available for download
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Discreet Dispatch Admin Switcher (Development/Demo Mode) */}
        {onSwitchToAdmin && (
          <button
            onClick={onSwitchToAdmin}
            title="Switch to Dispatch Admin console"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition-all border cursor-pointer ${
              isDarkMode
                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dispatch Admin</span>
          </button>
        )}

        {/* Theme Switcher Pill */}
        <div
          className={`flex items-center p-0.5 rounded-full border ${
            isDarkMode
              ? 'bg-[#0b121c] border-slate-700/60'
              : 'bg-slate-100 border-slate-300'
          }`}
        >
          <button
            onClick={onToggleTheme}
            className={`p-1.5 rounded-full transition-all ${
              !isDarkMode
                ? 'bg-white text-amber-500 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Light mode"
            aria-label="Light mode"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggleTheme}
            className={`p-1.5 rounded-full transition-all ${
              isDarkMode
                ? 'bg-slate-800 text-sky-400 shadow-xs'
                : 'text-slate-400 hover:text-slate-700'
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
              className={`flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-full transition-colors ${
                isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-slate-100'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-[#3898EC] text-white flex items-center justify-center font-bold text-xs tracking-tight">
                {userProfile.initials}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-semibold leading-tight">
                  {userProfile.full_name}
                </span>
                <span
                  className={`text-[10px] font-mono tracking-wider uppercase leading-tight ${
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
                  ? 'hover:bg-slate-800 text-slate-400 hover:text-rose-400'
                  : 'hover:bg-slate-100 text-slate-500 hover:text-rose-600'
              }`}
              title="Sign out to landing page"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        )}

        {isLanding && (
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigatePortal}
              className={`text-xs font-medium px-4 py-2 rounded-full transition-colors ${
                isDarkMode
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Customer Login
            </button>
            <button
              onClick={onNavigatePortal}
              className="bg-[#3898EC] hover:bg-[#2b85d6] text-white text-xs font-semibold px-4 py-2 rounded-full transition-all shadow-sm"
            >
              Open account
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

import React from 'react';
import {
  LayoutGrid,
  Plus,
  MapPin,
  Clock,
  List,
  Receipt,
  FileText,
  Headphones,
  LogOut,
} from 'lucide-react';
import { ViewMode } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  onSignOut: () => void;
  isDarkMode: boolean;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  onSignOut,
  isDarkMode,
  isOpenMobile,
  onCloseMobile,
}) => {
  const navItems: Array<{ id: ViewMode; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'new-booking', label: 'New Booking', icon: <Plus className="w-4 h-4" /> },
    { id: 'live-tracking', label: 'Live Tracking', icon: <MapPin className="w-4 h-4" /> },
    { id: 'booking-history', label: 'Booking History', icon: <Clock className="w-4 h-4" /> },
    { id: 'quotes', label: 'Quotes', icon: <List className="w-4 h-4" /> },
    { id: 'invoices', label: 'Invoices', icon: <Receipt className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
    { id: 'support', label: 'Support', icon: <Headphones className="w-4 h-4" /> },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:sticky top-16 left-0 bottom-0 z-40 lg:z-10 w-64 h-[calc(100vh-4rem)] flex flex-col justify-between p-4 border-r transition-transform overflow-y-auto ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          isDarkMode
            ? 'bg-[#0b0f19] border-[#1e293b] text-slate-300'
            : 'bg-white border-slate-200/80 text-slate-700'
        }`}
      >
        {/* Navigation items */}
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectView(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`group relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium cursor-pointer select-none transition-all ${
                  isActive
                    ? isDarkMode
                      ? 'bg-blue-950/30 text-blue-400 font-semibold'
                      : 'bg-blue-50/80 text-blue-700 font-semibold'
                    : isDarkMode
                    ? 'text-slate-400 hover:bg-[#111827] hover:text-slate-200'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span
                  className={`shrink-0 transition-colors ${
                    isActive
                      ? isDarkMode
                        ? 'text-blue-400'
                        : 'text-blue-600'
                      : isDarkMode
                      ? 'text-slate-500 group-hover:text-slate-300'
                      : 'text-slate-400 group-hover:text-slate-700'
                  }`}
                >
                  {item.icon}
                </span>
                <span className="tracking-tight text-xs sm:text-[13px]">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bottom actions & Dispatch Card */}
        <div
          className={`space-y-3 pt-3 border-t ${
            isDarkMode ? 'border-[#1e293b]' : 'border-slate-100'
          }`}
        >
          <button
            onClick={onSignOut}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              isDarkMode
                ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-950/20'
                : 'text-slate-600 hover:text-rose-600 hover:bg-rose-50'
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign out</span>
          </button>

          {/* DISPATCH 24/7 Emergency Box */}
          <div
            className={`p-4 rounded-2xl border transition-colors ${
              isDarkMode
                ? 'bg-[#111827] border-[#1e293b]'
                : 'bg-slate-50/70 border-slate-200/80'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Headphones className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Dispatch 24/7
              </span>
            </div>
            <a
              href="tel:08002468135"
              className={`block font-bold text-sm tracking-tight transition-colors ${
                isDarkMode ? 'text-white hover:text-blue-400' : 'text-slate-900 hover:text-blue-600'
              }`}
            >
              0800 246 8135
            </a>
            <p
              className={`text-[11px] mt-0.5 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Avg. response 3 min
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

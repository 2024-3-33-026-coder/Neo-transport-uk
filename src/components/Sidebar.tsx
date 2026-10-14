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
        className={`fixed lg:sticky top-16 left-0 bottom-0 z-40 lg:z-10 w-64 h-[calc(100vh-4rem)] flex flex-col justify-between p-4 border-r transition-transform duration-200 overflow-y-auto ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          isDarkMode
            ? 'bg-[#060b11] border-[#172334] text-slate-300'
            : 'bg-white border-slate-200 text-slate-700'
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
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? isDarkMode
                      ? 'bg-[#0e1622] text-[#3898EC] border border-[#1e2c40] shadow-xs'
                      : 'bg-sky-50 text-[#3898EC] border border-sky-100 font-semibold shadow-xs'
                    : isDarkMode
                    ? 'hover:bg-[#0c121a] hover:text-white text-slate-400'
                    : 'hover:bg-slate-100 hover:text-slate-900 text-slate-600'
                }`}
              >
                <span className={isActive ? 'text-[#3898EC]' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Bottom actions & Dispatch Card */}
        <div className="space-y-4 pt-4 border-t border-slate-700/20">
          <button
            onClick={onSignOut}
            className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors ${
              isDarkMode
                ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-950/20'
                : 'text-slate-600 hover:text-rose-600 hover:bg-rose-50'
            }`}
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>

          {/* DISPATCH 24/7 Emergency Box */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isDarkMode
                ? 'bg-[#0b121c] border-[#1a2636]'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Headphones className="w-3.5 h-3.5 text-[#3898EC]" />
              <span className="font-mono text-[11px] font-bold tracking-wider text-[#3898EC] uppercase">
                DISPATCH 24/7
              </span>
            </div>
            <a
              href="tel:08002468135"
              className={`block font-bold text-sm tracking-tight transition-colors ${
                isDarkMode ? 'text-white hover:text-[#3898EC]' : 'text-slate-900 hover:text-[#3898EC]'
              }`}
            >
              0800 246 8135
            </a>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Avg. response 3 min
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

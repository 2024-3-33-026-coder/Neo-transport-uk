import React from 'react';
import {
  CheckCircle2,
  Plus,
  Truck,
  Zap,
  CreditCard,
  FileText,
  MapPin,
  Download,
  Headphones,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Booking, ViewMode, Invoice } from '../../types';
import { INITIAL_INVOICES } from '../../data/mockData';

interface DashboardViewProps {
  isDarkMode: boolean;
  onNavigate: (view: ViewMode) => void;
  bookings: Booking[];
  invoices?: Invoice[];
  userName?: string;
  onSelectJob?: (job: Booking) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  isDarkMode,
  onNavigate,
  bookings,
  invoices = INITIAL_INVOICES,
  userName = 'Chris Sullivan',
  onSelectJob,
}) => {
  const cardBg = isDarkMode ? 'bg-[#0b121c] border-[#172334]' : 'bg-white border-slate-200';
  const firstName = userName.split(' ')[0] || 'Chris';

  // Dynamic KPI computations from shared state
  const inTransitCount = bookings.filter((b) => b.status === 'IN TRANSIT').length;
  const todaysJobsCount = bookings.filter(
    (b) => b.date === 'Today' || b.date.includes('Aug 2026') || b.status === 'IN TRANSIT'
  ).length || bookings.length;

  const emergencyCount = bookings.filter(
    (b) => b.status === 'IN TRANSIT' || b.cargo?.toLowerCase().includes('critical') || b.vehicle.includes('Sprinter')
  ).length || 1;

  const outstandingInvoices = invoices.filter((i) => i.status === 'DUE' || i.status === 'OVERDUE');
  const outstandingAmount = outstandingInvoices.reduce((acc, curr) => acc + curr.amount, 0);
  const dueThisWeekCount = outstandingInvoices.length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-4 h-0.5 bg-[#3898EC]" />
            <span className="font-mono text-xs uppercase tracking-widest text-[#3898EC] font-semibold">
              OVERVIEW
            </span>
          </div>
          <h1
            className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            Good morning, {firstName}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Your standby account is active and dispatch is ready 24/7.
          </p>
        </div>

        <button
          onClick={() => onNavigate('new-booking')}
          className="self-start sm:self-auto flex items-center gap-2 bg-[#3898EC] hover:bg-[#2b85d6] text-white px-5 py-2.5 rounded-full text-xs font-semibold shadow-md transition-all group"
        >
          <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
          <span>New Booking</span>
        </button>
      </div>

      {/* Standby Account Active Banner */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${cardBg}`}
      >
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2
              className={`font-bold text-sm sm:text-base ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              Standby Account Active
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              £0 monthly fee · Priority dispatch · Dedicated fleet access
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <span className="font-mono text-[11px] font-semibold tracking-wider px-2.5 py-1 rounded-md bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 uppercase">
            VERIFIED
          </span>
          <button
            onClick={() => onNavigate('invoices')}
            className={`px-4 py-2 rounded-xl text-xs font-medium border transition-colors ${
              isDarkMode
                ? 'border-slate-700/80 hover:bg-slate-800 text-slate-200'
                : 'border-slate-300 hover:bg-slate-100 text-slate-800'
            }`}
          >
            Statements
          </button>
        </div>
      </div>

      {/* 4 KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className={`p-5 rounded-2xl border ${cardBg}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-[#3898EC]">
              <Truck className="w-4 h-4" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
              {inTransitCount} IN TRANSIT
            </span>
          </div>
          <div
            className={`text-2xl sm:text-3xl font-extrabold ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            {todaysJobsCount}
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium">Today's Jobs</p>
        </div>

        {/* KPI 2 */}
        <div className={`p-5 rounded-2xl border ${cardBg}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              PRIORITY ACTIVE
            </span>
          </div>
          <div
            className={`text-2xl sm:text-3xl font-extrabold ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            {emergencyCount}
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium">Emergency Bookings</p>
        </div>

        {/* KPI 3 */}
        <div className={`p-5 rounded-2xl border ${cardBg}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-[#3898EC]">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
              +12% VS LAST MO
            </span>
          </div>
          <div
            className={`text-2xl sm:text-3xl font-extrabold ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            £4,280
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium">Monthly Spend</p>
        </div>

        {/* KPI 4 */}
        <div className={`p-5 rounded-2xl border ${cardBg}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {dueThisWeekCount} DUE THIS WEEK
            </span>
          </div>
          <div
            className={`text-2xl sm:text-3xl font-extrabold ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            £{outstandingAmount.toLocaleString()}
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium">Outstanding Invoices</p>
        </div>
      </div>

      {/* Main Content: Today's Jobs & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Jobs List */}
        <div className={`lg:col-span-2 p-5 sm:p-6 rounded-2xl border ${cardBg}`}>
          <div className="flex items-center justify-between mb-5">
            <h2
              className={`font-bold text-base sm:text-lg ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              Today's Jobs
            </h2>
            <button
              onClick={() => onNavigate('booking-history')}
              className="text-xs font-semibold text-[#3898EC] hover:underline cursor-pointer"
            >
              View all
            </button>
          </div>

          <div className="divide-y divide-slate-800/40">
            {bookings.slice(0, 4).map((job) => (
              <div
                key={job.id}
                onClick={() => {
                  if (onSelectJob) {
                    onSelectJob(job);
                  } else if (job.status === 'IN TRANSIT') {
                    onNavigate('live-tracking');
                  } else {
                    onNavigate('booking-history');
                  }
                }}
                className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4 cursor-pointer group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-semibold text-sm group-hover:text-[#3898EC] transition-colors ${
                        isDarkMode ? 'text-slate-200' : 'text-slate-800'
                      }`}
                    >
                      {job.origin.split(' ')[0]} → {job.destination.split(' ')[0]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs text-slate-400">
                      {job.reference}
                    </span>
                    <span className="text-slate-600 text-xs">•</span>
                    <span className="font-mono text-[11px] text-slate-400 uppercase">
                      {job.vehicle}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400">
                    {job.deliveryTime || '14:20'}
                  </span>

                  {job.status === 'IN TRANSIT' && (
                    <span className="font-mono text-[10px] font-semibold tracking-wider px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                      IN TRANSIT
                    </span>
                  )}
                  {job.status === 'DELIVERED' && (
                    <span className="font-mono text-[10px] font-semibold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                      DELIVERED
                    </span>
                  )}
                  {job.status === 'SCHEDULED' && (
                    <span className="font-mono text-[10px] font-semibold tracking-wider px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20 uppercase">
                      SCHEDULED
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className={`p-5 sm:p-6 rounded-2xl border flex flex-col justify-between ${cardBg}`}>
          <div>
            <h2
              className={`font-bold text-base sm:text-lg mb-4 ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              Quick Actions
            </h2>

            <div className="space-y-2">
              <button
                onClick={() => onNavigate('new-booking')}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all group ${
                  isDarkMode
                    ? 'border-[#1a2636] hover:border-[#3898EC]/40 hover:bg-[#0e1622] text-slate-200'
                    : 'border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-[#3898EC]" />
                  <span>Book emergency delivery</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={() => onNavigate('live-tracking')}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all group ${
                  isDarkMode
                    ? 'border-[#1a2636] hover:border-[#3898EC]/40 hover:bg-[#0e1622] text-slate-200'
                    : 'border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-[#3898EC]" />
                  <span>Track a live shipment</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={() => onNavigate('documents')}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all group ${
                  isDarkMode
                    ? 'border-[#1a2636] hover:border-[#3898EC]/40 hover:bg-[#0e1622] text-slate-200'
                    : 'border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Download className="w-4 h-4 text-[#3898EC]" />
                  <span>Download a POD</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={() => onNavigate('invoices')}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all group ${
                  isDarkMode
                    ? 'border-[#1a2636] hover:border-[#3898EC]/40 hover:bg-[#0e1622] text-slate-200'
                    : 'border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-[#3898EC]" />
                  <span>Pay an invoice</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={() => onNavigate('support')}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all group ${
                  isDarkMode
                    ? 'border-[#1a2636] hover:border-[#3898EC]/40 hover:bg-[#0e1622] text-slate-200'
                    : 'border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Headphones className="w-4 h-4 text-[#3898EC]" />
                  <span>Contact dispatch</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Gemini Standby Intelligence Status */}
          <div className="mt-4 pt-4 border-t border-slate-700/30">
            <div className="flex items-center gap-2 text-xs font-mono text-[#3898EC]">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="font-semibold uppercase tracking-wider">
                Gemini Logistics Pulse
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Nationwide fleet status: 14 emergency vehicles ready across Manchester, Birmingham, and London M25 corridor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

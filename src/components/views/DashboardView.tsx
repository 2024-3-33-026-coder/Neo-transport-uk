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
  Package,
} from 'lucide-react';
import { Booking, ViewMode, Invoice } from '../../types';
import { INITIAL_INVOICES } from '../../data/mockData';
import { MobileDashboardView } from './MobileDashboardView';

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
  invoices = [],
  userName = 'Chris Sullivan',
  onSelectJob,
}) => {
  const cardBg = isDarkMode
    ? 'bg-[#0b121c] border-[#172334] text-white'
    : 'bg-white border-slate-200/90 text-slate-900 shadow-[0_1px_3px_0_rgba(15,23,42,0.06),0_1px_2px_-1px_rgba(15,23,42,0.04)]';
  const firstName = userName.split(' ')[0] || 'Chris';

  // Dynamic KPI computations from shared state
  const inTransitCount = bookings.filter((b) => b.status === 'IN TRANSIT').length;
  const todaysJobsCount = bookings.filter(
    (b) => b.date === 'Today' || b.date.includes('Aug 2026') || b.status === 'IN TRANSIT'
  ).length;

  const emergencyCount = bookings.filter(
    (b) => b.status === 'IN TRANSIT' || b.cargo?.toLowerCase().includes('critical') || b.vehicle.includes('Sprinter')
  ).length;

  const outstandingInvoices = invoices.filter((i) => i.status === 'DUE' || i.status === 'OVERDUE');
  const outstandingAmount = outstandingInvoices.reduce((acc, curr) => acc + curr.amount, 0);
  const dueThisWeekCount = outstandingInvoices.length;
  const monthlySpend = bookings.reduce((acc, curr) => acc + (curr.total || 0), 0);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Mobile-Optimized Dashboard View (screens < md) */}
      <div className="block md:hidden">
        <MobileDashboardView
          isDarkMode={isDarkMode}
          onNavigate={onNavigate}
          bookings={bookings}
          invoices={invoices}
          userName={userName}
          onSelectJob={onSelectJob}
        />
      </div>

      {/* Full Desktop Dashboard View (screens >= md) */}
      <div className="hidden md:block space-y-5">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-blue-600 bg-blue-50/80 border border-blue-200/60 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <span>Operations overview</span>
            </div>
            <h1
              className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              Operations Overview
            </h1>
            <p
              className={`text-xs sm:text-sm mt-1 text-slate-500 dark:text-slate-400`}
            >
              Standby account active · Fleet dispatch ready 24/7
            </p>
          </div>

          <button
            onClick={() => onNavigate('new-booking')}
            className="self-start sm:self-auto flex items-center gap-2 bg-slate-900 hover:bg-black text-white px-5 py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all shadow-xs cursor-pointer active:scale-[0.99]"
          >
            <Plus className="w-4 h-4" />
            <span>New Booking</span>
          </button>
        </div>

        {/* Standby Account Active Banner */}
        <div
          className={`p-6 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-advertz ${
            isDarkMode ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-200/80'
          }`}
        >
          <div className="flex items-start sm:items-center gap-4">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                isDarkMode
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-600'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2
                className={`font-semibold text-base ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                Standby Account Active
              </h2>
              <p
                className={`text-xs sm:text-sm mt-0.5 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                £0 monthly fee · Priority dispatch · Dedicated fleet access
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <span
              className={`text-xs font-medium px-3 py-1 rounded-full border ${
                isDarkMode
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              Verified
            </span>
            <button
              onClick={() => onNavigate('invoices')}
              className={`px-4 py-2 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                isDarkMode
                  ? 'border-[#1e293b] bg-[#111827] hover:bg-[#1e293b] text-slate-200'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-advertz'
              }`}
            >
              Statements
            </button>
          </div>
        </div>

        {/* 4 KPIs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* KPI 1 */}
          <div className={`p-6 rounded-2xl border transition-all shadow-advertz shadow-advertz-hover ${
            isDarkMode ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-200/80'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isDarkMode
                    ? 'bg-blue-500/15 text-blue-400'
                    : 'bg-blue-50 text-blue-600 border border-blue-100'
                }`}
              >
                <Truck className="w-4 h-4" />
              </div>
              <span
                className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                  isDarkMode
                    ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                    : 'bg-blue-50 text-blue-700 border-blue-200/80'
                }`}
              >
                {inTransitCount} in transit
              </span>
            </div>
            <div
              className={`text-3xl font-bold tracking-tight tabular-nums ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              {todaysJobsCount}
            </div>
            <p
              className={`text-xs sm:text-sm mt-1 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Today's Jobs
            </p>
          </div>

          {/* KPI 2 */}
          <div className={`p-6 rounded-2xl border transition-all shadow-advertz shadow-advertz-hover ${
            isDarkMode ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-200/80'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isDarkMode
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'bg-amber-50 text-amber-600 border border-amber-100'
                }`}
              >
                <Zap className="w-4 h-4" />
              </div>
              <span
                className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                  isDarkMode
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-amber-50 text-amber-800 border-amber-200/80'
                }`}
              >
                Priority active
              </span>
            </div>
            <div
              className={`text-3xl font-bold tracking-tight tabular-nums ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              {emergencyCount}
            </div>
            <p
              className={`text-xs sm:text-sm mt-1 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Emergency Bookings
            </p>
          </div>

          {/* KPI 3 */}
          <div className={`p-6 rounded-2xl border transition-all shadow-advertz shadow-advertz-hover ${
            isDarkMode ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-200/80'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isDarkMode
                    ? 'bg-blue-500/15 text-blue-400'
                    : 'bg-blue-50 text-blue-600 border border-blue-100'
                }`}
              >
                <CreditCard className="w-4 h-4" />
              </div>
              <span
                className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                  isDarkMode
                    ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                }`}
              >
                +12% vs last month
              </span>
            </div>
            <div
              className={`text-3xl font-bold tracking-tight tabular-nums ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              £{monthlySpend.toLocaleString()}
            </div>
            <p
              className={`text-xs sm:text-sm mt-1 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Monthly Spend
            </p>
          </div>

          {/* KPI 4 */}
          <div className={`p-6 rounded-2xl border transition-all shadow-advertz shadow-advertz-hover ${
            isDarkMode ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-200/80'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isDarkMode
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'bg-amber-50 text-amber-600 border border-amber-100'
                }`}
              >
                <FileText className="w-4 h-4" />
              </div>
              <span
                className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                  isDarkMode
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-amber-50 text-amber-800 border-amber-200/80'
                }`}
              >
                {dueThisWeekCount} due this week
              </span>
            </div>
            <div
              className={`text-3xl font-bold tracking-tight tabular-nums ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              £{outstandingAmount.toLocaleString()}
            </div>
            <p
              className={`text-xs sm:text-sm mt-1 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Outstanding Invoices
            </p>
          </div>
        </div>

        {/* Main Content: Today's Jobs & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Jobs List */}
          <div className={`lg:col-span-2 p-6 rounded-2xl border transition-all shadow-advertz ${
            isDarkMode ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-200/80'
          }`}>
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-[#1e293b]">
              <h2
                className={`font-semibold text-base ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                Today's Jobs
              </h2>
              <button
                onClick={() => onNavigate('booking-history')}
                className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>

            <div
              className={`divide-y ${
                isDarkMode ? 'divide-[#1e222b]' : 'divide-slate-100'
              }`}
            >
              {bookings.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="w-10 h-10 rounded-lg bg-[#206bc4]/10 text-[#206bc4] flex items-center justify-center mx-auto mb-2.5">
                    <Package className="w-5 h-5" />
                  </div>
                  <p className={`text-xs font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                    No active consignments found
                  </p>
                  <p className={`text-[11px] mt-0.5 max-w-sm mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    You currently have zero bookings. Create your first delivery to begin tracking in real time.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('new-booking')}
                    className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#206bc4] text-white hover:bg-[#1a5bb0] transition-colors cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Book Emergency Delivery</span>
                  </button>
                </div>
              ) : (
                bookings.slice(0, 4).map((job) => (
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
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4 cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium text-xs group-hover:text-[#206bc4] transition-colors ${
                          isDarkMode ? 'text-slate-200' : 'text-slate-900'
                        }`}
                      >
                        {job.origin.split(' ')[0]} → {job.destination.split(' ')[0]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`font-mono text-[11px] ${
                          isDarkMode ? 'text-slate-500' : 'text-slate-500'
                        }`}
                      >
                        {job.reference}
                      </span>
                      <span className="text-slate-600 text-xs">•</span>
                      <span
                        className={`text-[11px] ${
                          isDarkMode ? 'text-slate-400' : 'text-slate-600'
                        }`}
                      >
                        {job.vehicle}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        isDarkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      {job.deliveryTime || '14:20'}
                    </span>

                    {job.status === 'IN TRANSIT' && (
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${
                          isDarkMode
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                            : 'bg-sky-50 text-sky-700 border-sky-200'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                        In transit
                      </span>
                    )}
                    {job.status === 'DELIVERED' && (
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                          isDarkMode
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        Delivered
                      </span>
                    )}
                    {job.status === 'SCHEDULED' && (
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                          isDarkMode
                            ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        Scheduled
                      </span>
                    )}
                  </div>
                </div>
              )))}
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className={`p-6 rounded-2xl border flex flex-col justify-between transition-all shadow-advertz ${
            isDarkMode ? 'bg-[#111827] border-[#1e293b]' : 'bg-white border-slate-200/80'
          }`}>
            <div>
              <h2
                className={`font-semibold text-base mb-4 pb-3 border-b ${
                  isDarkMode ? 'text-white border-[#1e293b]' : 'text-slate-900 border-slate-100'
                }`}
              >
                Quick Actions
              </h2>

              <div className="space-y-2">
                <button
                  onClick={() => onNavigate('new-booking')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    isDarkMode
                      ? 'border-[#1e293b] hover:bg-[#1e293b] text-slate-200'
                      : 'border-slate-100 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Zap className="w-4 h-4 text-blue-600" />
                    <span>Book emergency delivery</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => onNavigate('live-tracking')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    isDarkMode
                      ? 'border-[#1e293b] hover:bg-[#1e293b] text-slate-200'
                      : 'border-slate-100 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span>Track a live shipment</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => onNavigate('documents')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    isDarkMode
                      ? 'border-[#1e293b] hover:bg-[#1e293b] text-slate-200'
                      : 'border-slate-100 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Download className="w-4 h-4 text-blue-600" />
                    <span>Download a POD</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => onNavigate('invoices')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    isDarkMode
                      ? 'border-[#1e293b] hover:bg-[#1e293b] text-slate-200'
                      : 'border-slate-100 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span>Pay an invoice</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => onNavigate('support')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    isDarkMode
                      ? 'border-[#1e293b] hover:bg-[#1e293b] text-slate-200'
                      : 'border-slate-100 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Headphones className="w-4 h-4 text-blue-600" />
                    <span>Contact dispatch</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Fleet Status Note */}
            <div
              className={`mt-4 pt-3.5 border-t ${
                isDarkMode ? 'border-[#1e293b]' : 'border-slate-100'
              }`}
            >
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-semibold">
                  Dispatch Readiness
                </span>
              </div>
              <p
                className={`text-xs mt-1 leading-relaxed ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                14 emergency vehicles on standby across Manchester, Birmingham, and London M25 corridor.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

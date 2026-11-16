import React from 'react';
import {
  Plus,
  MapPin,
  Clock,
  Package,
  Download,
  CreditCard,
  ChevronRight,
  ArrowRight,
  Truck,
  CheckCircle2,
} from 'lucide-react';
import { Booking, ViewMode, Invoice } from '../../types';
import {
  NeoTruckHero,
  NeoSprinterVanCard,
  NeoRigidTruckThumbnail,
  NeoVanThumbnail,
} from '../ui/VehicleGraphics';

interface MobileDashboardViewProps {
  isDarkMode: boolean;
  onNavigate: (view: ViewMode) => void;
  bookings: Booking[];
  invoices?: Invoice[];
  userName?: string;
  onSelectJob?: (job: Booking) => void;
}

export const MobileDashboardView: React.FC<MobileDashboardViewProps> = ({
  isDarkMode,
  onNavigate,
  bookings,
  invoices = [],
  userName = 'MD',
  onSelectJob,
}) => {
  // Derive active shipment (prefer in transit or NT-25121, fallback to first booking)
  const hasBookings = bookings && bookings.length > 0;
  const activeShipment = hasBookings
    ? (bookings.find((b) => b.reference === 'NT-25121') ||
       bookings.find((b) => b.status === 'IN TRANSIT') ||
       bookings[0])
    : null;

  // Extract clean town names for route display
  const cleanCity = (loc?: string) => {
    if (!loc) return '';
    return loc.split(',')[0].trim().split(' ')[0].trim();
  };

  const originTown = activeShipment ? (cleanCity(activeShipment.origin) || 'Origin') : '';
  const destTown = activeShipment ? (cleanCity(activeShipment.destination) || 'Destination') : '';
  const etaMinutes = activeShipment?.deliveryTime || '17 min';

  // Recent jobs (excluding the active one if possible, or up to 3)
  const recentJobs = hasBookings && activeShipment
    ? bookings.filter((b) => b.reference !== activeShipment.reference).slice(0, 3)
    : [];

  return (
    <div className="space-y-4 pb-20 animate-view-entrance">
      {/* 1. Hero Banner */}
      <section
        className={`relative overflow-hidden rounded-2xl border transition-all ${
          isDarkMode
            ? 'bg-[#111827] border-[#1e293b]'
            : 'bg-white border-slate-200/80 shadow-advertz'
        }`}
      >
        <div className="relative p-5 z-10">
          <div className="grid grid-cols-12 gap-3 items-center">
            {/* Left Content */}
            <div className="col-span-7 sm:col-span-8 space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-200/60 mb-1">
                <span>Welcome, {userName}</span>
              </div>

              <h1
                className={`text-lg sm:text-xl font-bold tracking-tight leading-[1.2] ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                Fleet dispatch &amp; transport operations.
              </h1>

              <p
                className={`text-[11px] leading-relaxed pt-0.5 line-clamp-2 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Reliable same-day courier dispatch and freight recovery across the UK.
              </p>
            </div>

            {/* Right Graphic: Branded Freight Truck */}
            <div className="col-span-5 sm:col-span-4 flex items-center justify-end -mr-2">
              <NeoTruckHero
                isDarkMode={isDarkMode}
                className="w-full h-24 sm:h-28 object-contain"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-4 flex-wrap">
            <button
              type="button"
              onClick={() => onNavigate('new-booking')}
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New booking</span>
              <ChevronRight className="w-3.5 h-3.5 stroke-[2.5] ml-0.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (onSelectJob && activeShipment) {
                  onSelectJob(activeShipment as Booking);
                } else {
                  onNavigate('live-tracking');
                }
              }}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 border cursor-pointer shrink-0 ${
                isDarkMode
                  ? 'border-[#1e293b] bg-[#0b0d11] hover:bg-[#1e293b] text-white'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800 shadow-advertz'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>Live tracking</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Active Shipment Card */}
      {activeShipment ? (
        <section
          onClick={() => {
            if (onSelectJob && activeShipment) {
              onSelectJob(activeShipment as Booking);
            } else {
              onNavigate('live-tracking');
            }
          }}
          className={`rounded-xl border p-4 sm:p-5 transition-colors cursor-pointer ${
            isDarkMode
              ? 'bg-[#12151b] border-[#1e2229] text-white'
              : 'bg-white border-slate-200/90 shadow-[0_1px_3px_0_rgba(15,23,42,0.06),0_1px_2px_-1px_rgba(15,23,42,0.04)] text-slate-900'
          }`}
        >
          {/* Top header row: Active Shipment + View all */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Active shipment
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate('booking-history');
              }}
              className="text-xs font-medium text-[#206bc4] hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>View all</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Shipment Details & Van Graphic */}
          <div className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-7 sm:col-span-8 space-y-2">
              {/* Reference & Status */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base sm:text-lg font-bold tracking-tight font-mono">
                  {activeShipment.reference}
                </span>
                <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-mono font-medium px-2 py-0.5 rounded-md uppercase tracking-wider">
                  {activeShipment.status || 'IN TRANSIT'}
                </span>
              </div>

              {/* Route */}
              <div className="flex items-center gap-2 text-xs font-semibold">
                <MapPin className="w-3.5 h-3.5 text-[#206bc4] shrink-0" />
                <span>
                  {originTown} → {destTown}
                </span>
              </div>
            </div>

            {/* Right Van Graphic */}
            <div className="col-span-5 sm:col-span-4 flex items-center justify-end">
              <NeoSprinterVanCard
                isDarkMode={isDarkMode}
                className="w-full h-20 sm:h-24 object-contain"
              />
            </div>
          </div>

          {/* Bottom Metadata: ETA & Vehicle */}
          <div
            className={`mt-3 pt-3 border-t flex items-center gap-6 text-xs ${
              isDarkMode ? 'border-[#1e2229] text-slate-300' : 'border-slate-100 text-slate-600'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">ETA</span>
              <span className="font-semibold text-slate-900 dark:text-white font-mono tabular-nums">
                {etaMinutes}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Vehicle</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {activeShipment.vehicle || 'Sprinter LWB'}
              </span>
            </div>
          </div>
        </section>
      ) : (
        <section
          className={`rounded-2xl border p-6 text-center transition-all ${
            isDarkMode
              ? 'bg-[#111827] border-[#1e293b] text-white'
              : 'bg-white border-slate-200/80 shadow-advertz text-slate-900'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto mb-3">
            <Package className="w-5 h-5 stroke-[2]" />
          </div>
          <h3 className="font-bold text-base tracking-tight">No Active Consignments</h3>
          <p className={`text-xs mt-1 max-w-xs mx-auto leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            You currently have zero bookings. Book your first courier or freight run to start tracking your delivery.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('new-booking')}
            className="mt-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-5 py-2.5 rounded-full text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Book Your First Delivery</span>
          </button>
        </section>
      )}

      {/* 3. Quick Actions Grid */}
      <section className="space-y-3">
        <h2
          className={`text-sm font-bold tracking-tight ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}
        >
          Quick actions
        </h2>

        <div className="grid grid-cols-4 gap-3">
          {/* Action 1: New Booking */}
          <button
            type="button"
            onClick={() => onNavigate('new-booking')}
            className={`p-3.5 rounded-2xl border transition-all flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-advertz ${
              isDarkMode
                ? 'bg-[#111827] border-[#1e293b] hover:bg-[#1a1f29] text-white'
                : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-900'
            }`}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 border border-blue-100">
              <Package className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium leading-tight">
              New<br />booking
            </span>
          </button>

          {/* Action 2: Track Shipment */}
          <button
            type="button"
            onClick={() => onNavigate('live-tracking')}
            className={`p-3.5 rounded-2xl border transition-all flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-advertz ${
              isDarkMode
                ? 'bg-[#111827] border-[#1e293b] hover:bg-[#1a1f29] text-white'
                : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-900'
            }`}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 border border-blue-100">
              <MapPin className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium leading-tight">
              Track<br />shipment
            </span>
          </button>

          {/* Action 3: Download POD */}
          <button
            type="button"
            onClick={() => onNavigate('documents')}
            className={`p-3.5 rounded-2xl border transition-all flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-advertz ${
              isDarkMode
                ? 'bg-[#111827] border-[#1e293b] hover:bg-[#1a1f29] text-white'
                : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-900'
            }`}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 border border-blue-100">
              <Download className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium leading-tight">
              Download<br />POD
            </span>
          </button>

          {/* Action 4: Pay Invoice */}
          <button
            type="button"
            onClick={() => onNavigate('invoices')}
            className={`p-3.5 rounded-2xl border transition-all flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-advertz ${
              isDarkMode
                ? 'bg-[#111827] border-[#1e293b] hover:bg-[#1a1f29] text-white'
                : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-900'
            }`}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 border border-blue-100">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-medium leading-tight">
              Pay<br />invoice
            </span>
          </button>
        </div>
      </section>

      {/* 4. Recent Jobs Section */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2
            className={`text-sm font-semibold tracking-tight ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            Recent jobs
          </h2>

          <button
            type="button"
            onClick={() => onNavigate('booking-history')}
            className="text-xs font-medium text-[#206bc4] hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>View all</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          {recentJobs.length === 0 ? (
            <div className={`p-4 rounded-xl border text-center text-xs ${
              isDarkMode ? 'bg-[#12151b] border-[#1e2229] text-slate-400' : 'bg-white border-slate-200 text-slate-500'
            }`}>
              No recent bookings recorded yet.
            </div>
          ) : (
            recentJobs.map((job) => {
            const isRigid = (job.vehicle || '').toLowerCase().includes('rigid') || (job.vehicle || '').toLowerCase().includes('7.5');
            const jobOrigin = cleanCity(job.origin);
            const jobDest = cleanCity(job.destination);
            const status = job.status || 'IN TRANSIT';

            return (
              <div
                key={job.id || job.reference}
                onClick={() => {
                  if (onSelectJob) {
                    onSelectJob(job as Booking);
                  } else if (status === 'IN TRANSIT') {
                    onNavigate('live-tracking');
                  } else {
                    onNavigate('booking-history');
                  }
                }}
                className={`p-3 sm:p-3.5 rounded-xl border transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                  isDarkMode
                    ? 'bg-[#12151b] border-[#1e2229] hover:bg-[#1a1f29] text-white'
                    : 'bg-white border-slate-200/90 hover:bg-slate-50 text-slate-900'
                }`}
              >
                {/* Vehicle Thumbnail & Info */}
                <div className="flex items-center gap-3 min-w-0">
                  {isRigid ? (
                    <NeoRigidTruckThumbnail isDarkMode={isDarkMode} className="w-14 h-12" />
                  ) : (
                    <NeoVanThumbnail isDarkMode={isDarkMode} className="w-14 h-12" />
                  )}

                  <div className="min-w-0 space-y-1">
                    {/* Reference & Badge */}
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs font-mono">
                        {job.reference}
                      </span>
                      <span
                        className={`text-[9px] font-mono font-medium px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          status === 'IN TRANSIT'
                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                            : status === 'SCHEDULED'
                            ? isDarkMode
                              ? 'bg-[#1e2229] text-slate-300 border border-slate-700'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {status}
                      </span>
                    </div>

                    {/* Route */}
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">
                      <MapPin className="w-3 h-3 text-[#206bc4] shrink-0" />
                      <span>
                        {jobOrigin} → {jobDest}
                      </span>
                    </div>

                    {/* Vehicle */}
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                      <Truck className="w-3 h-3" />
                      <span>{job.vehicle || 'Sprinter MWB'}</span>
                    </div>
                  </div>
                </div>

                {/* Right: ETA & Chevron */}
                <div className="flex items-center gap-1 text-right shrink-0">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-normal">ETA</span>
                    <span className="text-xs font-semibold font-mono tabular-nums">
                      {job.deliveryTime || '255 min'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 ml-1" />
                </div>
              </div>
            );
          }))}
        </div>
      </section>
    </div>
  );
};

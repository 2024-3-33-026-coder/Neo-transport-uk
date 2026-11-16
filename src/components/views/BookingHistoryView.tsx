import React, { useState, useMemo } from 'react';
import { Search, Download, FileText, CheckCircle2, MapPin, Truck, ArrowRight } from 'lucide-react';
import { Booking, ViewMode } from '../../types';

interface BookingHistoryViewProps {
  isDarkMode: boolean;
  bookings: Booking[];
  onNavigate: (view: ViewMode) => void;
  onRebook: (booking: Booking) => void;
  onViewPod?: (bookingRef: string) => void;
}

export const BookingHistoryView: React.FC<BookingHistoryViewProps> = ({
  isDarkMode,
  bookings,
  onNavigate,
  onRebook,
  onViewPod,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'All' | 'In transit' | 'Delivered' | 'Cancelled' | 'Scheduled'>('All');
  const [selectedPod, setSelectedPod] = useState<Booking | null>(null);

  const cardBg = isDarkMode
    ? 'bg-[#111827] border-[#1e293b]'
    : 'bg-white border border-slate-200/80 shadow-advertz';

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchSearch =
        b.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.cargo && b.cargo.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchSearch) return false;

      if (selectedFilter === 'In transit') return b.status === 'IN TRANSIT';
      if (selectedFilter === 'Delivered') return b.status === 'DELIVERED';
      if (selectedFilter === 'Cancelled') return b.status === 'CANCELLED';
      if (selectedFilter === 'Scheduled') return b.status === 'SCHEDULED';

      return true;
    });
  }, [bookings, searchTerm, selectedFilter]);

  const handleExportCsv = () => {
    const headers = ['Reference', 'Date', 'Origin', 'Destination', 'Vehicle', 'Goods/Cargo', 'Total GBP', 'Status'];
    const rows = filteredBookings.map((b) => [
      b.reference,
      b.date,
      `"${b.origin.replace(/"/g, '""')}"`,
      `"${b.destination.replace(/"/g, '""')}"`,
      `"${b.vehicle.replace(/"/g, '""')}"`,
      `"${(b.cargo || 'Palletised goods').replace(/"/g, '""')}"`,
      b.total,
      b.status,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NEO_Transport_Bookings_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPod = (b: Booking) => {
    const isDelivered = b.status === 'DELIVERED';
    const podText = [
      '================================================================',
      'NEO TRANSPORT — PROOF OF DELIVERY (POD) ADVISORY',
      '================================================================',
      `Booking Reference: ${b.reference}`,
      `Date:              ${b.date}`,
      `Origin:            ${b.origin}`,
      `Destination:       ${b.destination}`,
      `Vehicle:           ${b.vehicle}`,
      `Goods / Cargo:     ${b.cargo || 'Palletised goods'}`,
      `Status:            ${b.status}`,
      `Delivery Time:     ${isDelivered ? (b.deliveryTime || 'Recorded') : 'Pending delivery'}`,
      `Driver:            ${b.driver?.name ? `${b.driver.name} (${b.driver.registration || 'Reg pending'})` : 'Driver unassigned'}`,
      '----------------------------------------------------------------',
      'Consignee Signoff: Evidence not on file (consignee details unavailable)',
      'Signature Status:  NO VERIFIED SIGNATURE ON FILE',
      'Delivery Evidence: Operational verification pending signed document upload',
      '================================================================',
    ].join('\n');

    const blob = new Blob([podText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `POD_${b.reference}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-blue-600 bg-blue-50/80 border border-blue-200/60 mb-2">
            <span>Consignments archive · Records</span>
          </div>
          <h1
            className={`text-2xl sm:text-3xl font-bold tracking-tight ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            Booking History
          </h1>
        </div>

        <button
          onClick={handleExportCsv}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
            isDarkMode
              ? 'border-[#1e222b] bg-[#12151b] hover:bg-[#18202c] text-slate-200'
              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-advertz'
          }`}
        >
          <Download className="w-4 h-4 text-blue-600" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className={`p-6 sm:p-7 rounded-2xl border ${cardBg}`}>
        {/* Search & Filter bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search reference, route..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-medium border transition-colors ${
                isDarkMode
                  ? 'bg-[#0f1115] border-[#1e222b] text-white focus:border-blue-500'
                  : 'bg-white border-slate-200 text-slate-900 shadow-advertz focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
              }`}
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {(['All', 'In transit', 'Delivered', 'Cancelled', 'Scheduled'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                  selectedFilter === filter
                    ? 'bg-blue-600 text-white font-medium shadow-xs'
                    : isDarkMode
                    ? 'bg-[#12151b] text-slate-400 border border-[#1e222b] hover:text-white'
                    : 'bg-white text-slate-600 border border-slate-200 shadow-advertz hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Card Stack (screens < md) */}
        <div className="block md:hidden space-y-3">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No bookings found matching current criteria.
            </div>
          ) : (
            filteredBookings.map((b) => (
              <div
                key={b.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isDarkMode ? 'bg-[#0f1115] border-[#1e222b]' : 'bg-white border-slate-200/80 shadow-advertz'
                }`}
              >
                {/* Header row: Reference + Status Pill */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-semibold text-blue-600">
                      {b.reference}
                    </span>
                    <span className="text-slate-500 text-xs font-mono">· {b.date}</span>
                  </div>

                  {b.status === 'IN TRANSIT' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/80 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                      <span>In transit</span>
                    </span>
                  )}
                  {b.status === 'DELIVERED' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1">
                      <span>Delivered</span>
                    </span>
                  )}
                  {b.status === 'CANCELLED' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/80 flex items-center gap-1">
                      <span>Cancelled</span>
                    </span>
                  )}
                  {b.status === 'SCHEDULED' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/80 flex items-center gap-1">
                      <span>Scheduled</span>
                    </span>
                  )}
                </div>

                {/* Route */}
                <div className="space-y-1.5 py-2.5 border-y border-slate-100 dark:border-slate-800/40 text-xs">
                  <div className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className={`font-medium line-clamp-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                      {b.origin}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <span className={`font-medium line-clamp-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                      {b.destination}
                    </span>
                  </div>
                </div>

                {/* Specs and action buttons */}
                <div className="flex items-center justify-between pt-3 gap-2">
                  <div className="text-xs">
                    <span className="text-slate-400 text-[11px] block">{b.vehicle}</span>
                    <strong className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                      £{b.total}
                    </strong>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPod(b)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                        isDarkMode
                          ? 'border-slate-700 bg-slate-800/80 text-slate-200 hover:text-white'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-advertz'
                      }`}
                    >
                      {b.status === 'DELIVERED' ? 'POD' : 'POD (Pending)'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onRebook(b);
                        onNavigate('new-booking');
                      }}
                      className="px-4 py-1.5 rounded-full text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      Rebook
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Bookings Table (screens >= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr
                className={`border-b text-xs font-semibold ${
                  isDarkMode ? 'border-[#1e222b] text-slate-400' : 'border-slate-200/80 bg-slate-50/60 text-slate-600'
                }`}
              >
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Route</th>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-[#1e222b]' : 'divide-slate-100'}`}>
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 text-xs">
                    No bookings found matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => (
                <tr
                  key={b.id}
                  className={`transition-colors ${
                    isDarkMode ? 'hover:bg-[#12151b]' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <td
                    className={`py-3.5 px-4 font-mono font-medium ${
                      isDarkMode ? 'text-slate-200' : 'text-slate-900'
                    }`}
                  >
                    {b.reference}
                  </td>
                  <td
                    className={`py-3.5 px-4 ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    {b.date}
                  </td>
                  <td
                    className={`py-3.5 px-4 font-medium ${
                      isDarkMode ? 'text-slate-200' : 'text-slate-900'
                    }`}
                  >
                    {b.origin.split(' ')[0]} → {b.destination.split(' ')[0]}
                  </td>
                  <td
                    className={`py-3.5 px-4 ${
                      isDarkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    {b.vehicle}
                  </td>
                  <td
                    className={`py-3.5 px-4 font-medium font-mono tabular-nums ${
                      isDarkMode ? 'text-slate-200' : 'text-slate-900'
                    }`}
                  >
                    £{b.total}
                  </td>
                  <td className="py-3.5 px-4">
                    {b.status === 'IN TRANSIT' && (
                      <span
                        className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1.5 ${
                          isDarkMode
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-blue-50 text-blue-700 border-blue-200/80'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        In transit
                      </span>
                    )}
                    {b.status === 'DELIVERED' && (
                      <span
                        className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                          isDarkMode
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                        }`}
                      >
                        Delivered
                      </span>
                    )}
                    {b.status === 'CANCELLED' && (
                      <span
                        className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                          isDarkMode
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-rose-50 text-rose-700 border-rose-200/80'
                        }`}
                      >
                        Cancelled
                      </span>
                    )}
                    {b.status === 'SCHEDULED' && (
                      <span
                        className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                          isDarkMode
                            ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                            : 'bg-slate-100 text-slate-700 border-slate-200/80'
                        }`}
                      >
                        Scheduled
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2 font-medium">
                      <button
                        onClick={() => setSelectedPod(b)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                          isDarkMode
                            ? 'border-slate-700 bg-slate-800/80 text-slate-200 hover:text-white'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-advertz'
                        }`}
                      >
                        {b.status === 'DELIVERED' ? 'POD' : 'POD (Pending)'}
                      </button>
                      <button
                        onClick={() => {
                          onRebook(b);
                          onNavigate('new-booking');
                        }}
                        className="px-3.5 py-1 rounded-full text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
                      >
                        Rebook
                      </button>
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* POD Modal */}
      {selectedPod && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className={`p-6 sm:p-7 rounded-3xl border max-w-md w-full ${cardBg} shadow-advertz-lg space-y-4`}>
            <div
              className={`flex items-center justify-between pb-3 border-b ${
                isDarkMode ? 'border-[#1e222b]' : 'border-slate-200/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3
                  className={`font-bold text-sm tracking-tight ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Proof of Delivery — {selectedPod.reference}
                </h3>
              </div>
              <button
                onClick={() => setSelectedPod(null)}
                className={`p-1 rounded-full transition-colors cursor-pointer ${
                  isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                ✕
              </button>
            </div>

            <div
              className={`p-4 rounded-2xl border space-y-2.5 text-xs ${
                isDarkMode
                  ? 'bg-[#0f1115] border-[#1e222b]'
                  : 'bg-slate-50/70 border-slate-200/80'
              }`}
            >
              <div className="flex justify-between">
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Route:</span>
                <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {selectedPod.origin} → {selectedPod.destination}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Delivered at:</span>
                <span className={`font-mono tabular-nums ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {selectedPod.deliveryTime || '14:20 BST'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Consignee Signature:</span>
                <span className="font-mono text-slate-500 text-right">
                  Signature unavailable (not on file)
                </span>
              </div>
              <div className="flex justify-between">
                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Receiver Signoff:</span>
                <span className={isDarkMode ? 'text-slate-500' : 'text-slate-500'}>Evidence not on file</span>
              </div>
            </div>

            <div
              className={`flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-3 border-t ${
                isDarkMode ? 'border-[#1e222b]' : 'border-slate-200/80'
              }`}
            >
              <button
                onClick={() => handleDownloadPod(selectedPod)}
                className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100 shadow-advertz'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download POD Summary</span>
              </button>

              <button
                onClick={() => {
                  setSelectedPod(null);
                  if (onViewPod) {
                    onViewPod(selectedPod.reference);
                  } else {
                    onNavigate('documents');
                  }
                }}
                className={`w-full sm:w-auto px-4 py-2 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/25 hover:bg-blue-500/20'
                    : 'bg-blue-50 text-blue-700 border-blue-200/80 hover:bg-blue-100 shadow-advertz'
                }`}
              >
                <span>View in Documents →</span>
              </button>

              <button
                onClick={() => setSelectedPod(null)}
                className={`w-full sm:w-auto px-4 py-2 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'border-[#1e222b] hover:bg-[#161a22] text-slate-300'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-advertz'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

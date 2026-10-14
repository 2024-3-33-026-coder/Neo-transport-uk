import React, { useState, useMemo } from 'react';
import { Search, Download, FileText, CheckCircle2 } from 'lucide-react';
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

  const cardBg = isDarkMode ? 'bg-[#0b121c] border-[#172334]' : 'bg-white border-slate-200';

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
    const podText = [
      '================================================================',
      'NEO TRANSPORT — OFFICIAL PROOF OF DELIVERY (POD)',
      '================================================================',
      `Booking Reference: ${b.reference}`,
      `Date:              ${b.date}`,
      `Origin:            ${b.origin}`,
      `Destination:       ${b.destination}`,
      `Vehicle:           ${b.vehicle}`,
      `Goods / Cargo:     ${b.cargo || 'Palletised parts'}`,
      `Delivery Time:     ${b.deliveryTime || '14:20 BST'}`,
      `Driver:            ${b.driver?.name || 'Marek Kowalski'} (${b.driver?.registration || 'GN71 XPO'})`,
      '----------------------------------------------------------------',
      'Consignee Signoff: J. Higgins (Receiving Lead)',
      'Signature Status:  VERIFIED DIGITAL STYLUS SIGNATURE CAPTURED',
      'GPS Geofence:      Lat 52.4862° N, Lon 1.8904° W (On-site Dock)',
      'Timestamp:         2026-08-02T14:20:18Z',
      '================================================================',
    ].join('\n');

    const blob = new Blob([podText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `POD_${b.reference}_Signed.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-4 h-0.5 bg-[#3898EC]" />
            <span className="font-mono text-xs uppercase tracking-widest text-[#3898EC] font-semibold">
              ARCHIVE
            </span>
          </div>
          <h1
            className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            Booking History
          </h1>
        </div>

        <button
          onClick={handleExportCsv}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
            isDarkMode
              ? 'border-slate-700/80 hover:bg-slate-800 text-slate-200'
              : 'border-slate-300 hover:bg-slate-100 text-slate-800'
          }`}
        >
          <Download className="w-4 h-4 text-[#3898EC]" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Main Table Card (Matching Screenshot 7) */}
      <div className={`p-5 sm:p-6 rounded-2xl border ${cardBg}`}>
        {/* Search & Filter bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search reference, route..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-xl text-xs font-medium border transition-colors ${
                isDarkMode
                  ? 'bg-[#060b11] border-[#1a2636] text-white focus:border-[#3898EC]'
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#3898EC]'
              }`}
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {(['All', 'In transit', 'Delivered', 'Cancelled', 'Scheduled'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
                  selectedFilter === filter
                    ? 'bg-[#3898EC] text-white font-semibold'
                    : isDarkMode
                    ? 'bg-[#090e17] text-slate-400 border border-slate-800 hover:text-white'
                    : 'bg-slate-100 text-slate-600 border border-slate-200 hover:text-slate-900'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Bookings Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr
                className={`border-b font-mono text-[10px] uppercase tracking-wider ${
                  isDarkMode ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                }`}
              >
                <th className="py-3 px-3">REFERENCE</th>
                <th className="py-3 px-3">DATE</th>
                <th className="py-3 px-3">ROUTE</th>
                <th className="py-3 px-3">VEHICLE</th>
                <th className="py-3 px-3">TOTAL</th>
                <th className="py-3 px-3">STATUS</th>
                <th className="py-3 px-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filteredBookings.map((b) => (
                <tr
                  key={b.id}
                  className={`transition-colors ${
                    isDarkMode ? 'hover:bg-[#0e1622]/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-4 px-3 font-mono font-bold text-slate-200">
                    {b.reference}
                  </td>
                  <td className="py-4 px-3 text-slate-400">
                    {b.date}
                  </td>
                  <td className="py-4 px-3 font-semibold text-slate-200">
                    {b.origin.split(' ')[0]} → {b.destination.split(' ')[0]}
                  </td>
                  <td className="py-4 px-3 text-slate-400">
                    {b.vehicle}
                  </td>
                  <td className="py-4 px-3 font-extrabold text-slate-200 font-mono">
                    £{b.total}
                  </td>
                  <td className="py-4 px-3">
                    {b.status === 'IN TRANSIT' && (
                      <span className="font-mono text-[10px] font-semibold tracking-wider px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase">
                        IN TRANSIT
                      </span>
                    )}
                    {b.status === 'DELIVERED' && (
                      <span className="font-mono text-[10px] font-semibold tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                        DELIVERED
                      </span>
                    )}
                    {b.status === 'CANCELLED' && (
                      <span className="font-mono text-[10px] font-semibold tracking-wider px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase">
                        CANCELLED
                      </span>
                    )}
                    {b.status === 'SCHEDULED' && (
                      <span className="font-mono text-[10px] font-semibold tracking-wider px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 uppercase">
                        SCHEDULED
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-3 text-right">
                    <div className="flex items-center justify-end gap-3 font-medium">
                      <button
                        onClick={() => setSelectedPod(b)}
                        className="text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        POD
                      </button>
                      <button
                        onClick={() => {
                          onRebook(b);
                          onNavigate('new-booking');
                        }}
                        className="text-[#3898EC] hover:underline transition-colors font-semibold"
                      >
                        Rebook
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* POD Modal */}
      {selectedPod && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className={`p-6 rounded-2xl border max-w-md w-full ${cardBg} shadow-2xl space-y-4`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/40">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#3898EC]" />
                <h3 className="font-bold text-sm text-white">
                  Proof of Delivery — {selectedPod.reference}
                </h3>
              </div>
              <button
                onClick={() => setSelectedPod(null)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#060b11] border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Route:</span>
                <span className="text-white font-semibold">{selectedPod.origin} → {selectedPod.destination}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Delivered at:</span>
                <span className="text-white font-mono">{selectedPod.deliveryTime || '14:20 BST'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Consignee Signature:</span>
                <span className="text-emerald-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified Digital Stylus
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Receiver:</span>
                <span className="text-white">J. Higgins (Receiving Lead)</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-3 border-t border-slate-800/80">
              <button
                onClick={() => handleDownloadPod(selectedPod)}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Signed POD</span>
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
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-[#3898EC]/10 text-[#3898EC] border border-[#3898EC]/30 hover:bg-[#3898EC]/20 transition-all cursor-pointer"
              >
                <span>View in Documents →</span>
              </button>

              <button
                onClick={() => setSelectedPod(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
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

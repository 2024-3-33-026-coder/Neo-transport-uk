import React, { useState } from 'react';
import {
  ArrowLeft,
  MoreVertical,
  MapPin,
  Clock,
  Truck,
  Check,
  CheckCircle2,
  Headphones,
  Navigation,
  Phone,
  Share2,
  RotateCw,
  X,
  Send,
} from 'lucide-react';
import { Booking, ViewMode } from '../../types';

interface MobileTrackingViewProps {
  isDarkMode: boolean;
  booking: Booking;
  onBack: () => void;
  onNavigate: (view: ViewMode) => void;
}

export const MobileTrackingView: React.FC<MobileTrackingViewProps> = ({
  isDarkMode,
  booking,
  onBack,
  onNavigate,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatSent, setChatSent] = useState(false);

  const reference = booking.reference || 'NT-25121';
  const status = booking.status || 'IN TRANSIT';
  const origin = booking.origin || 'Warrington WA3 6BL';
  const destination = booking.destination || 'Leigh WN7 3PT';
  const vehicle = booking.vehicle || 'Sprinter LWB';
  const eta = booking.deliveryTime || '17 min';
  const driverName = booking.driver?.name || 'Unassigned';

  const cleanOrigin = origin.split(',')[0].trim().split(' ')[0].trim() || 'Warrington';
  const cleanDest = destination.split(',')[0].trim().split(' ')[0].trim() || 'Leigh';

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    setChatSent(true);
    setTimeout(() => {
      setChatMessage('');
      setChatSent(false);
      setShowContactModal(false);
    }, 1800);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col pb-20 animate-view-entrance -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8">
      {/* 1. Header Bar */}
      <div
        className={`px-4 py-3 border-b flex items-center justify-between sticky top-16 z-20 transition-colors ${
          isDarkMode
            ? 'bg-[#0b0d11] border-[#1e2229] text-white'
            : 'bg-white border-slate-200 text-slate-900 shadow-xs'
        }`}
      >
        <button
          type="button"
          onClick={onBack}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isDarkMode ? 'hover:bg-[#1e2229] text-slate-300' : 'hover:bg-slate-100 text-slate-700'
          }`}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h1 className="text-base font-semibold tracking-tight">Consignment tracking</h1>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDarkMode ? 'hover:bg-[#1e2229] text-slate-300' : 'hover:bg-slate-100 text-slate-700'
            }`}
            aria-label="More options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showMenu && (
            <div
              className={`absolute right-0 mt-2 w-48 rounded-xl p-1.5 shadow-xl border z-30 ${
                isDarkMode
                  ? 'bg-[#12151b] border-[#1e2229] text-white'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setShowContactModal(true);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 cursor-pointer ${
                  isDarkMode ? 'hover:bg-[#1e2229]' : 'hover:bg-slate-100'
                }`}
              >
                <Headphones className="w-4 h-4 text-[#206bc4]" />
                <span>Contact dispatch</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  navigator.clipboard?.writeText(window.location.href);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 cursor-pointer ${
                  isDarkMode ? 'hover:bg-[#1e2229]' : 'hover:bg-slate-100'
                }`}
              >
                <Share2 className="w-4 h-4 text-[#206bc4]" />
                <span>Share tracking</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  onNavigate('booking-history');
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 cursor-pointer ${
                  isDarkMode ? 'hover:bg-[#1e2229]' : 'hover:bg-slate-100'
                }`}
              >
                <Clock className="w-4 h-4 text-[#206bc4]" />
                <span>Booking history</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Interactive Route Map Area */}
      <div className="relative w-full h-72 sm:h-80 overflow-hidden bg-slate-200 dark:bg-[#0b0d11]">
        <svg
          viewBox="0 0 400 300"
          className="w-full h-full object-cover"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Map Grid / Land Background */}
          <rect
            width="400"
            height="300"
            fill={isDarkMode ? '#0b0d11' : '#eef2f6'}
          />

          {/* Road Network Lines */}
          <path
            d="M 0 50 Q 150 70 400 60"
            stroke={isDarkMode ? '#1e2229' : '#cbd5e1'}
            strokeWidth="6"
            fill="none"
          />
          <path
            d="M 30 0 L 70 300"
            stroke={isDarkMode ? '#1e2229' : '#cbd5e1'}
            strokeWidth="5"
            fill="none"
          />
          <path
            d="M 330 0 L 360 300"
            stroke={isDarkMode ? '#1e2229' : '#cbd5e1'}
            strokeWidth="5"
            fill="none"
          />
          <path
            d="M 0 220 Q 200 210 400 240"
            stroke={isDarkMode ? '#1e2229' : '#cbd5e1'}
            strokeWidth="8"
            fill="none"
          />

          {/* Active Navigation Route (Warrington to Leigh) */}
          <path
            d="M 90 200 C 130 190, 180 140, 240 130 S 300 80, 330 90"
            stroke={isDarkMode ? '#1a365d' : '#bae6fd'}
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 90 200 C 130 190, 180 140, 240 130 S 300 80, 330 90"
            stroke="#206bc4"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Origin Marker (Warrington) */}
          <g transform="translate(90, 200)">
            <circle cx="0" cy="0" r="7" fill="white" stroke="#206bc4" strokeWidth="3" />
            <circle cx="0" cy="0" r="3" fill="#206bc4" />
            <rect
              x="-35"
              y="12"
              width="70"
              height="20"
              rx="4"
              fill={isDarkMode ? '#12151b' : '#ffffff'}
              stroke={isDarkMode ? '#1e2229' : '#cbd5e1'}
              strokeWidth="1"
            />
            <text
              x="0"
              y="26"
              textAnchor="middle"
              fill={isDarkMode ? '#ffffff' : '#0f172a'}
              fontSize="10"
              fontWeight="600"
            >
              Warrington
            </text>
          </g>

          {/* Destination Marker (Leigh) */}
          <g transform="translate(330, 90)">
            <circle cx="0" cy="0" r="9" fill="#0f172a" stroke="white" strokeWidth="2.5" />
            <circle cx="0" cy="0" r="4" fill="#206bc4" />
            <rect
              x="-25"
              y="-28"
              width="50"
              height="20"
              rx="4"
              fill={isDarkMode ? '#12151b' : '#ffffff'}
              stroke={isDarkMode ? '#1e2229' : '#cbd5e1'}
              strokeWidth="1"
            />
            <text
              x="0"
              y="-14"
              textAnchor="middle"
              fill={isDarkMode ? '#ffffff' : '#0f172a'}
              fontSize="10"
              fontWeight="600"
            >
              Leigh
            </text>
          </g>

          {/* Vehicle Marker on Route (M62 Near Manchester) */}
          <g transform="translate(230, 132)">
            <rect x="-12" y="-12" width="24" height="24" rx="4" fill="#1e2229" stroke="#206bc4" strokeWidth="2" />
            {/* Mini truck icon in vehicle marker */}
            <path
              d="M -6 -2 L -1 -2 L 1 1 L 6 1 L 6 6 L -6 6 Z"
              fill="#206bc4"
            />
            <circle cx="-3" cy="6" r="1.5" fill="white" />
            <circle cx="3" cy="6" r="1.5" fill="white" />
          </g>
        </svg>

        {/* Live Indicator Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0b0d11]/90 text-white text-[11px] font-mono border border-[#1e2229]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>GPS live · M62 corridor</span>
        </div>
      </div>

      {/* 3. Bottom Tracking Details Sheet */}
      <div
        className={`flex-1 rounded-t-xl border-t p-5 sm:p-6 -mt-6 relative z-10 space-y-4 transition-colors ${
          isDarkMode
            ? 'bg-[#12151b] border-[#1e2229] text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Grab bar */}
        <div className="w-8 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto" />

        {/* Header: Reference + Route + ETA */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold font-mono tracking-tight">
                {reference}
              </span>
              <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-mono font-medium px-2 py-0.5 rounded-md uppercase tracking-wider">
                {status}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-1.5 font-semibold">
              <MapPin className="w-3.5 h-3.5 text-[#206bc4] shrink-0" />
              <span>
                {cleanOrigin} → {cleanDest}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-normal">ETA</span>
              <span className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                {eta}
              </span>
            </div>
          </div>

          {/* Vehicle and Driver */}
          <div
            className={`pt-2 border-t flex items-center justify-between text-xs font-mono ${
              isDarkMode ? 'border-[#1e2229] text-slate-400' : 'border-slate-100 text-slate-500'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              <span>Vehicle</span>
              <span className="font-semibold text-slate-900 dark:text-white">{vehicle}</span>
            </div>

            <div>
              <span>Driver: </span>
              <span className="font-semibold text-slate-900 dark:text-white">{driverName}</span>
            </div>
          </div>
        </div>

        {/* 4. Delivery Milestone Progress Timeline */}
        <div className="space-y-0 pt-2">
          {/* Milestone 1: Shipment picked up (completed) */}
          <div className="flex items-start gap-3 relative pb-5">
            {/* Connecting line */}
            <div className="absolute left-[11px] top-5 bottom-0 w-0.5 bg-[#206bc4]" />

            {/* Checkmark icon in blue circle */}
            <div className="w-6 h-6 rounded-full bg-[#206bc4] text-white flex items-center justify-center shrink-0 z-10">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>

            <div className="space-y-0.5 pt-0.5">
              <h4 className="font-semibold text-xs">Shipment picked up</h4>
              <p className="text-[11px] font-mono text-slate-400">Today, 09:15</p>
              <p className={`text-[11px] ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                Warrington, WA3 6BL
              </p>
            </div>
          </div>

          {/* Milestone 2: In transit (active) */}
          <div className="flex items-start gap-3 relative pb-5">
            {/* Connecting line */}
            <div
              className={`absolute left-[11px] top-5 bottom-0 w-0.5 ${
                isDarkMode ? 'bg-[#1e2229]' : 'bg-slate-200'
              }`}
            />

            {/* Truck icon in blue circle */}
            <div className="w-6 h-6 rounded-full bg-[#206bc4] text-white flex items-center justify-center shrink-0 z-10 ring-2 ring-[#206bc4]/20">
              <Truck className="w-3 h-3" />
            </div>

            <div className="space-y-0.5 pt-0.5">
              <h4 className="font-semibold text-xs text-[#206bc4]">In transit</h4>
              <p className="text-[11px] font-mono text-slate-400">Today, 09:20</p>
              <p className={`text-[11px] ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                M62, Near Manchester
              </p>
            </div>
          </div>

          {/* Milestone 3: Out for delivery (pending) */}
          <div className="flex items-start gap-3 relative pb-5">
            {/* Connecting line */}
            <div
              className={`absolute left-[11px] top-5 bottom-0 w-0.5 ${
                isDarkMode ? 'bg-[#1e2229]' : 'bg-slate-200'
              }`}
            />

            {/* Gray hollow circle */}
            <div
              className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 z-10 ${
                isDarkMode
                  ? 'border-[#1e2229] bg-[#0b0d11]'
                  : 'border-slate-300 bg-white'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isDarkMode ? 'bg-slate-600' : 'bg-slate-300'
                }`}
              />
            </div>

            <div className="space-y-0.5 pt-0.5">
              <h4 className={`font-medium text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Out for delivery
              </h4>
              <p className="text-[11px] font-mono text-slate-400">Est. 10:00</p>
              <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Leigh, WN7 3PT
              </p>
            </div>
          </div>

          {/* Milestone 4: Delivered (pending) */}
          <div className="flex items-start gap-3 relative">
            {/* Gray check circle */}
            <div
              className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 z-10 ${
                isDarkMode
                  ? 'border-[#1e2229] bg-[#0b0d11] text-slate-500'
                  : 'border-slate-200 bg-slate-100 text-slate-400'
              }`}
            >
              <Check className="w-3 h-3 stroke-[2]" />
            </div>

            <div className="space-y-0.5 pt-0.5">
              <h4 className={`font-medium text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Delivered
              </h4>
              <p className="text-[11px] font-mono text-slate-400">Pending</p>
            </div>
          </div>
        </div>

        {/* 5. Contact Dispatch Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowContactModal(true)}
            className="w-full bg-[#206bc4] hover:bg-[#1a5bb0] active:bg-[#164e96] text-white py-2.5 px-4 rounded-lg font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Headphones className="w-4 h-4" />
            <span>Contact dispatch</span>
          </button>
        </div>
      </div>

      {/* Contact Dispatch Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setShowContactModal(false)}
          />

          <div
            className={`relative w-full max-w-sm rounded-xl border p-5 z-10 ${
              isDarkMode ? 'bg-[#12151b] border-[#1e2229] text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-[#206bc4]" />
                <h3 className="font-semibold text-sm">24/7 Operations dispatch</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className={`p-1.5 rounded-lg cursor-pointer ${isDarkMode ? 'hover:bg-[#1e2229]' : 'hover:bg-slate-100'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Direct telemetry & line coordination for booking <strong className="font-mono text-slate-200 dark:text-white">{reference}</strong>.
            </p>

            {chatSent ? (
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center space-y-1">
                <CheckCircle2 className="w-5 h-5 mx-auto" />
                <p className="font-semibold">Message delivered to dispatcher</p>
                <p className="text-[11px] opacity-80">Controller on duty will respond or call via standby priority line.</p>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="space-y-3">
                <textarea
                  rows={3}
                  required
                  placeholder="Ask dispatch for a live update or deliver instruction..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  className={`w-full p-2.5 rounded-lg border text-xs outline-none transition-colors ${
                    isDarkMode
                      ? 'bg-[#0b0d11] border-[#1e2229] text-white focus:border-[#206bc4]'
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#206bc4]'
                  }`}
                />

                <div className="flex items-center gap-2">
                  <a
                    href="tel:08002468135"
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      isDarkMode
                        ? 'bg-[#0b0d11] border-[#1e2229] text-slate-200 hover:text-white'
                        : 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200'
                    }`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>0800 246 8135</span>
                  </a>

                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#206bc4] hover:bg-[#1a5bb0] text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send note</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

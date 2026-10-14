import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Phone,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  RotateCw,
  Loader2,
  Navigation,
  Truck,
  Check,
  X,
  Send,
  MapPin,
  Clock,
} from 'lucide-react';
import { Booking } from '../../types';
import { getRouteRiskAnalysis } from '../../lib/geminiClient';
import { calculateUkRoadDistanceSync, guessCityName } from '../../lib/routing';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface LiveTrackingViewProps {
  isDarkMode: boolean;
  activeBooking?: Booking;
  bookings?: Booking[];
  onSelectBooking?: (bookingId: string) => void;
}

export const LiveTrackingView: React.FC<LiveTrackingViewProps> = ({
  isDarkMode,
  activeBooking,
  bookings = [],
  onSelectBooking,
}) => {
  // Local active booking selection state (synced with activeBooking prop)
  const [selectedBookingId, setSelectedBookingId] = useState<string>(
    activeBooking?.id || activeBooking?.reference || 'b-1'
  );

  useEffect(() => {
    if (activeBooking) {
      setSelectedBookingId(activeBooking.id || activeBooking.reference);
    }
  }, [activeBooking]);

  // Determine current active booking from list or prop
  const currentBooking: Booking = useMemo(() => {
    const found = bookings.find(
      (b) => b.id === selectedBookingId || b.reference === selectedBookingId
    );
    if (found) return found;
    if (activeBooking) return activeBooking;
    return bookings[0] || {
      id: 'b-1',
      reference: 'NT-24817',
      date: 'Today',
      origin: 'Manchester M17 1AB',
      destination: 'Birmingham B6 7EU',
      vehicle: 'Sprinter LWB',
      total: 248,
      status: 'IN TRANSIT',
      cargo: 'Palletised parts · 650 kg',
      deliveryTime: '88 min',
      driver: {
        name: 'Marek Kowalski',
        vehicleModel: 'Sprinter LWB',
        registration: 'GN71 XPO',
        phone: '07700 900821',
        status: 'ON THE MOVE',
      },
    };
  }, [bookings, selectedBookingId, activeBooking]);

  // Active in-transit bookings for the header pill switcher
  const inTransitBookings = useMemo(() => {
    const list = bookings.filter((b) => b.status === 'IN TRANSIT');
    if (list.length === 0 && currentBooking) {
      return [currentBooking];
    }
    // Ensure current booking is present in the list if it's active
    if (!list.some((b) => b.id === currentBooking.id || b.reference === currentBooking.reference)) {
      return [currentBooking, ...list];
    }
    return list;
  }, [bookings, currentBooking]);

  // Derived metadata from current booking
  const bookingRef = currentBooking.reference;
  const bookingOrigin = currentBooking.origin;
  const bookingDestination = currentBooking.destination;
  const bookingVehicle = currentBooking.vehicle;

  // Extract real city endpoint labels
  const originCity = guessCityName(bookingOrigin, '');
  const destCity = guessCityName(bookingDestination, '');

  // Driver details
  const driverName = currentBooking.driver?.name || 'Marek Kowalski';
  const driverVehicle = currentBooking.driver?.vehicleModel || bookingVehicle;
  const driverReg = currentBooking.driver?.registration || 'GN71 XPO';
  const driverPhone = currentBooking.driver?.phone || '07700 900821';
  const driverInitials =
    driverName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() || 'MK';

  // Dynamic road distance & ETA
  const routeCalc = useMemo(() => {
    return calculateUkRoadDistanceSync(bookingOrigin, bookingDestination);
  }, [bookingOrigin, bookingDestination]);

  const totalMiles = routeCalc.distanceMiles;
  const etaDisplay = currentBooking.deliveryTime || `${routeCalc.etaMinutes} min`;

  // Target progress percentage (0 - 100)
  const targetProgress = useMemo(() => {
    if (currentBooking.progress !== undefined) return currentBooking.progress;
    if (currentBooking.status === 'DELIVERED') return 100;
    if (currentBooking.status === 'SCHEDULED') return 0;
    if (currentBooking.reference === 'NT-24816') return 62;
    return 45;
  }, [currentBooking]);

  // Smooth requestAnimationFrame progress interpolation
  const [animatedProgress, setAnimatedProgress] = useState<number>(targetProgress);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const startProgress = animatedProgress;
    const endProgress = targetProgress;
    const duration = 800; // ms
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progressRatio = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progressRatio, 3);
      const nextVal = startProgress + (endProgress - startProgress) * ease;
      setAnimatedProgress(nextVal);

      if (progressRatio < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [targetProgress]);

  // Calculate live position on custom SVG curve
  // Route curve: M 195 80 Q 240 150 250 180 T 310 320
  const t = Math.max(0, Math.min(1, animatedProgress / 100));
  const vehicleX = Math.round((1 - t) * (1 - t) * 195 + 2 * (1 - t) * t * 240 + t * t * 310);
  const vehicleY = Math.round((1 - t) * (1 - t) * 80 + 2 * (1 - t) * t * 150 + t * t * 320);

  const traveledMiles = Math.round((totalMiles * animatedProgress) / 100);

  // Modals state
  const [isCalling, setIsCalling] = useState(false);
  const [isMessaging, setIsMessaging] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  // Gemini AI Analysis
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<{
    riskLevel: string;
    headline: string;
    summary: string;
    confidencePercent: number;
    recommendation: string;
    trafficHotspots: Array<{ location: string; delayMinutes: number; status: string }>;
    estimatedArrivalFormatted: string;
  } | null>(null);

  const cardBg = isDarkMode ? 'bg-[#0b121c] border-[#172334]' : 'bg-white border-slate-200';

  // Realtime Supabase Subscription
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !currentBooking.id) return;

    const channel = supabase
      .channel(`live-tracking-${currentBooking.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${currentBooking.id}`,
        },
        (payload) => {
          if (payload.new && onSelectBooking) {
            onSelectBooking(payload.new.id);
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentBooking.id, onSelectBooking]);

  const handleRunAiRiskAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const data = await getRouteRiskAnalysis({
        bookingId: bookingRef,
        origin: bookingOrigin,
        destination: bookingDestination,
        vehicle: bookingVehicle,
        progressPercent: Math.round(animatedProgress),
        currentEtaMinutes: parseInt(etaDisplay) || routeCalc.etaMinutes,
      });
      setAiAnalysis(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectShipment = (b: Booking) => {
    setSelectedBookingId(b.id || b.reference);
    if (onSelectBooking) {
      onSelectBooking(b.id || b.reference);
    }
  };

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    setSentMessage(`Dispatched to ${driverName}'s cab terminal`);
    setTimeout(() => {
      setIsMessaging(false);
      setSentMessage(null);
      setMessageText('');
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-4 h-0.5 bg-[#3898EC]" />
            <span className="font-mono text-xs uppercase tracking-widest text-[#3898EC] font-semibold">
              CORRIDOR ESTIMATE · DISPATCH PROGRESS
            </span>
          </div>
          <h1
            className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            Live Tracking
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Booking <strong className="text-white font-mono">{bookingRef}</strong> · {originCity} → {destCity}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-sky-400 pulse-glow" />
            <span>ESTIMATED CORRIDOR</span>
          </div>

          <button
            onClick={handleRunAiRiskAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-2 bg-[#0e1622] hover:bg-[#141f30] text-[#3898EC] border border-[#1e2c40] px-4 py-1.5 rounded-full text-xs font-mono font-medium transition-all shadow-xs cursor-pointer"
          >
            {isAnalyzing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Gemini Route Advisory</span>
          </button>
        </div>
      </div>

      {/* In-Transit Multi-Booking Switcher (Phase 6 Requirement) */}
      <div className="p-3 rounded-2xl bg-black/20 border border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full sm:w-auto">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5 mr-1 font-semibold">
            <Truck className="w-3.5 h-3.5 text-[#3898EC]" />
            <span>Active Shipments:</span>
          </span>

          {inTransitBookings.map((b) => {
            const isSelected =
              selectedBookingId === b.id || selectedBookingId === b.reference;
            const bOrigin = guessCityName(b.origin, '');
            const bDest = guessCityName(b.destination, '');

            return (
              <button
                key={b.id || b.reference}
                onClick={() => handleSelectShipment(b)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-medium shrink-0 flex items-center gap-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#3898EC] text-white shadow-md font-bold'
                    : isDarkMode
                    ? 'bg-[#09111c] text-slate-300 border border-[#1a2636] hover:border-slate-500 hover:text-white'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isSelected ? 'bg-white animate-pulse' : 'bg-sky-400'
                  }`}
                />
                <span>{b.reference}</span>
                <span className="opacity-80 text-[11px]">
                  · {bOrigin} → {bDest}
                </span>
              </button>
            );
          })}
        </div>

        <span className="text-[11px] font-mono text-slate-400 hidden lg:inline">
          {inTransitBookings.length} rapid-dispatch vehicle{inTransitBookings.length === 1 ? '' : 's'} on corridor
        </span>
      </div>

      {/* Optional Gemini Real-time AI Risk Advisory */}
      {aiAnalysis && (
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isDarkMode ? 'bg-[#09111c] border-[#1e2f46]' : 'bg-sky-50/80 border-sky-200'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#3898EC]/20 text-[#3898EC] flex items-center justify-center">
                <Navigation className="w-4 h-4" />
              </div>
              <div>
                <span className="font-mono text-[10px] text-[#3898EC] uppercase tracking-wider font-semibold">
                  Gemini 3.8 Flash · UK Expressway Intelligence
                </span>
                <h3 className="font-bold text-sm text-white">{aiAnalysis.headline}</h3>
              </div>
            </div>

            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {aiAnalysis.confidencePercent}% Confidence
            </span>
          </div>

          <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
            {aiAnalysis.summary}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-700/40 text-xs">
            <div className="text-slate-400">
              <span className="text-slate-200 font-semibold">Dispatch Directive: </span>
              {aiAnalysis.recommendation}
            </div>
            <div className="flex items-center gap-2 justify-end font-mono text-[11px] text-slate-400">
              <span>Traffic delay index:</span>
              <span className="text-emerald-400 font-bold">+2 min nominal</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Tracking Layout: Route Map + Driver & Timeline Column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Custom SVG UK Route Map (2 cols) */}
        <div
          className={`lg:col-span-2 rounded-2xl border p-6 relative overflow-hidden flex flex-col justify-between min-h-[440px] sm:min-h-[520px] ${
            isDarkMode ? 'bg-[#080d15] border-[#172334]' : 'bg-slate-900 border-slate-800'
          }`}
        >
          {/* Subtle Grid background */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(rgba(56, 152, 236, 0.4) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Floating ETA Card in Top Left */}
          <div className="z-10 bg-[#0e1622]/90 backdrop-blur-md border border-[#1e2c40] p-4 rounded-xl max-w-[220px] shadow-lg">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
              ESTIMATED ARRIVAL
            </span>
            <div className="text-3xl font-extrabold text-white mt-0.5">
              {etaDisplay}
            </div>
            <p className="font-mono text-xs text-slate-400 mt-0.5">
              {traveledMiles} of {totalMiles} miles ({Math.round(animatedProgress)}%)
            </p>
            <p className="font-mono text-[10px] text-sky-400/80 mt-1">
              Corridor estimate · Dispatch synced
            </p>
          </div>

          {/* Custom SVG Route Illustration */}
          <div className="relative w-full h-80 my-auto flex items-center justify-center">
            <svg viewBox="0 0 500 380" className="w-full h-full max-w-lg drop-shadow-md">
              <defs>
                <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3898EC" />
                  <stop offset="50%" stopColor="#3898EC" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>

                {/* Shaded Corridor Contour matching screenshot */}
                <path
                  id="corridor"
                  d="M190 60 C 130 90, 110 170, 150 250 C 180 310, 240 330, 280 340 C 230 330, 200 270, 190 200 C 180 140, 210 90, 190 60 Z"
                  fill="rgba(56, 152, 236, 0.08)"
                />
              </defs>

              {/* Shaded contour behind route */}
              <use href="#corridor" />

              {/* Full Route Path */}
              <path
                id="main-route-path"
                d="M 195 80 Q 240 150 250 180 T 310 320"
                fill="none"
                stroke="#1e2c40"
                strokeWidth="6"
                strokeLinecap="round"
              />

              {/* Traveled portion (dashed blue line from origin to vehicle position) */}
              <path
                d={`M 195 80 Q 240 150 ${vehicleX} ${vehicleY}`}
                fill="none"
                stroke="#3898EC"
                strokeWidth="3.5"
                strokeDasharray="4 4"
                strokeLinecap="round"
              />

              {/* Remaining portion (dark gray to destination) */}
              <path
                d={`M ${vehicleX} ${vehicleY} Q 280 250 310 320`}
                fill="none"
                stroke="#334155"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Origin Point */}
              <circle cx="195" cy="80" r="5" fill="#3898EC" />
              <text
                x="185"
                y="65"
                fill="#ffffff"
                fontSize="12"
                fontWeight="700"
                textAnchor="middle"
                fontFamily="sans-serif"
              >
                {originCity}
              </text>

              {/* Live Vehicle Marker with real-time ping and position */}
              <circle
                cx={vehicleX}
                cy={vehicleY}
                r="14"
                fill="rgba(56, 152, 236, 0.25)"
                className="animate-ping"
              />
              <circle cx={vehicleX} cy={vehicleY} r="7" fill="#3898EC" />
              <circle cx={vehicleX} cy={vehicleY} r="3" fill="#ffffff" />

              {/* Destination Point */}
              <circle cx="310" cy="320" r="6" fill="#080d15" stroke="#10b981" strokeWidth="2.5" />
              <text
                x="320"
                y="335"
                fill="#ffffff"
                fontSize="12"
                fontWeight="700"
                fontFamily="sans-serif"
              >
                {destCity} hub
              </text>
            </svg>
          </div>

          {/* Bottom Dispatch Progress Bar */}
          <div className="z-10 flex items-center justify-between text-xs font-mono text-slate-400 pt-3 border-t border-slate-800/80">
            <span className="uppercase">
              {routeCalc.routeSummary} · Calculated Corridor
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <RotateCw className="w-3 h-3 text-[#3898EC] animate-spin" />
              <span>Dispatch progress estimate · Synced</span>
            </span>
          </div>
        </div>

        {/* Right: Driver Card & Status Timeline */}
        <div className="space-y-6">
          {/* Driver Card */}
          <div className={`p-6 rounded-2xl border ${cardBg}`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#3898EC] text-white flex items-center justify-center font-bold text-sm tracking-tight shrink-0 shadow-md">
                {driverInitials}
              </div>
              <div className="min-w-0">
                <h2
                  className={`font-bold text-base truncate ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {driverName}
                </h2>
                <p className="font-mono text-xs text-slate-400 mt-0.5 truncate">
                  {driverVehicle} · {driverReg}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="font-mono text-[10px] font-semibold tracking-wider px-2.5 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase">
                {currentBooking.status === 'IN TRANSIT' ? 'ON THE MOVE' : currentBooking.status}
              </span>
              <span className="font-mono text-[10px] font-semibold tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                VERIFIED DRIVER
              </span>
            </div>

            {/* Action buttons: Call / Message */}
            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                onClick={() => setIsCalling(true)}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  isDarkMode
                    ? 'border-slate-700/80 hover:bg-slate-800 text-slate-200'
                    : 'border-slate-300 hover:bg-slate-100 text-slate-800'
                }`}
              >
                <Phone className="w-3.5 h-3.5 text-[#3898EC]" />
                <span>Call</span>
              </button>

              <button
                onClick={() => setIsMessaging(true)}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  isDarkMode
                    ? 'border-slate-700/80 hover:bg-slate-800 text-slate-200'
                    : 'border-slate-300 hover:bg-slate-100 text-slate-800'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#3898EC]" />
                <span>Message</span>
              </button>
            </div>
          </div>

          {/* Status Timeline Card */}
          <div className={`p-6 rounded-2xl border ${cardBg}`}>
            <h3
              className={`font-bold text-sm mb-4 ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              Status timeline · {bookingRef}
            </h3>

            <div className="space-y-4 relative pl-4 border-l-2 border-slate-700/50">
              {/* Step 1 */}
              <div className="relative">
                <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#3898EC] ring-4 ring-[#0b121c]" />
                <p className="text-xs font-bold text-white">Booking confirmed</p>
                <p className="font-mono text-[11px] text-slate-400">
                  {currentBooking.pickupTime || '11:42'}
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#3898EC] ring-4 ring-[#0b121c]" />
                <p className="text-xs font-bold text-white">
                  Driver assigned — {driverName}
                </p>
                <p className="font-mono text-[11px] text-slate-400">Direct Express</p>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#3898EC] ring-4 ring-[#0b121c]" />
                <p className="text-xs font-bold text-white">
                  Collected from {originCity}
                </p>
                <p className="font-mono text-[11px] text-slate-400">Loading verified</p>
              </div>

              {/* Step 4 */}
              <div className="relative">
                <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#3898EC] ring-4 ring-[#0b121c]" />
                <p className="text-xs font-bold text-white">
                  In transit on UK Expressway Corridor
                </p>
                <p className="font-mono text-[11px] text-slate-400">
                  Passing corridor checkpoint
                </p>
              </div>

              {/* Step 5 */}
              <div className="relative">
                <span
                  className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-[#0b121c] ${
                    currentBooking.status === 'DELIVERED'
                      ? 'bg-emerald-400'
                      : 'bg-slate-600'
                  }`}
                />
                <p className="text-xs font-medium text-slate-400">
                  Arriving at {destCity} hub
                </p>
                <p className="font-mono text-[11px] text-slate-500">
                  ~{etaDisplay}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Call Driver Modal */}
      {isCalling && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className={`p-6 rounded-2xl border max-w-sm w-full ${cardBg} shadow-2xl text-center space-y-4`}>
            <div className="w-14 h-14 rounded-full bg-[#3898EC]/20 text-[#3898EC] flex items-center justify-center mx-auto">
              <Phone className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Connecting to Driver</h3>
              <p className="text-xs text-slate-400 mt-1">
                {driverName} · {driverPhone}
              </p>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              For highway safety during vehicle transit, driver calls are routed through vehicle hands-free Bluetooth.
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <a
                href={`tel:${driverPhone.replace(/\s+/g, '')}`}
                className="bg-[#3898EC] hover:bg-[#2b85d6] text-white px-5 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Dial Now</span>
              </a>
              <button
                onClick={() => setIsCalling(false)}
                className="px-4 py-2 rounded-full border border-slate-700 text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Driver Modal */}
      {isMessaging && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className={`p-6 rounded-2xl border max-w-md w-full ${cardBg} shadow-2xl space-y-4`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">Message {driverName}</h3>
                <p className="text-xs text-slate-400">
                  Vehicle: {driverVehicle} · {driverReg}
                </p>
              </div>
              <button
                onClick={() => setIsMessaging(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Preset Directives */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                'Dock via Bay 3',
                'Call on gate arrival',
                'Goods in contact ready',
                'Hi-vis & boots required',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setMessageText(preset)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  + {preset}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              placeholder="e.g. Please pull up to Bay 3 on arrival, contact John on gate intercom..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-700 bg-[#060b11] text-white focus:border-[#3898EC] outline-none"
            />

            {sentMessage && (
              <p className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>{sentMessage}</span>
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsMessaging(false)}
                className="px-4 py-2 rounded-full border border-slate-700 text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleSendMessage}
                disabled={!messageText.trim()}
                className="bg-[#3898EC] hover:bg-[#2b85d6] disabled:opacity-50 text-white px-5 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send to Cab</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

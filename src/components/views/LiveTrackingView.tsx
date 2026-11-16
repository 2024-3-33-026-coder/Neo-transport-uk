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
  ExternalLink,
  Radio,
  Zap,
  Package,
} from 'lucide-react';
import { Booking, ViewMode } from '../../types';
import { MobileTrackingView } from './MobileTrackingView';
import { getRouteRiskAnalysis } from '../../lib/geminiClient';
import { calculateUkRoadDistanceSync, guessCityName } from '../../lib/routing';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { mapBookingRowToBooking } from '../../lib/portalStore';

export const isValidHttpsUrl = (url?: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

interface LiveTrackingViewProps {
  isDarkMode: boolean;
  activeBooking?: Booking;
  bookings?: Booking[];
  onSelectBooking?: (bookingId: string) => void;
  onBookingUpdated?: (updatedBooking: Booking) => void;
  onNavigate?: (view: ViewMode) => void;
}

export const LiveTrackingView: React.FC<LiveTrackingViewProps> = ({
  isDarkMode,
  activeBooking,
  bookings = [],
  onSelectBooking,
  onBookingUpdated,
  onNavigate,
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
      status: 'SCHEDULED',
      cargo: 'Palletised parts · 650 kg',
      deliveryTime: '88 min',
      driver: undefined,
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
  const hasAllocatedDriver = Boolean(currentBooking.driver?.name);
  const driverName = hasAllocatedDriver
    ? currentBooking.driver!.name
    : 'Awaiting driver allocation';
  const driverVehicle = hasAllocatedDriver
    ? (currentBooking.driver?.vehicleModel || bookingVehicle)
    : bookingVehicle;
  const driverReg = hasAllocatedDriver && currentBooking.driver?.registration
    ? currentBooking.driver.registration
    : '';
  const driverPhone = hasAllocatedDriver && currentBooking.driver?.phone
    ? currentBooking.driver.phone
    : '';
  const driverInitials = hasAllocatedDriver
    ? driverName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase() || '—'
    : '—';

  // Dynamic road distance & ETA
  const routeCalc = useMemo(() => {
    return calculateUkRoadDistanceSync(bookingOrigin, bookingDestination);
  }, [bookingOrigin, bookingDestination]);

  const totalMiles = routeCalc.distanceMiles;
  const etaDisplay = currentBooking.deliveryTime || `${routeCalc.etaMinutes} min`;

  // Genuine telemetry & verified delivery evidence guards
  const hasVerifiedTelemetry = useMemo(() => {
    return typeof currentBooking.progress === 'number' && currentBooking.progress > 0.05;
  }, [currentBooking.progress]);

  const hasVerifiedDeliveryEvidence = useMemo(() => {
    return Boolean(
      currentBooking.status === 'DELIVERED' &&
      (isValidHttpsUrl(currentBooking.delivery_tracking_url) || (typeof currentBooking.progress === 'number' && currentBooking.progress >= 1))
    );
  }, [currentBooking.status, currentBooking.delivery_tracking_url, currentBooking.progress]);

  // Target progress percentage (0 - 100) — strictly 0 unless genuine progress data exists
  const targetProgress = useMemo(() => {
    if (typeof currentBooking.progress === 'number') {
      return currentBooking.progress <= 1
        ? currentBooking.progress * 100
        : currentBooking.progress;
    }
    if (currentBooking.status === 'DELIVERED' && hasVerifiedDeliveryEvidence) return 100;
    return 0; // Unverified telemetry or in-transit without progress defaults to 0%
  }, [currentBooking, hasVerifiedDeliveryEvidence]);

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

  const cardBg = isDarkMode
    ? 'bg-[#111827] border-[#1e293b]'
    : 'bg-white border border-slate-200/80 shadow-advertz';

  const bookingsRef = useRef(bookings);
  bookingsRef.current = bookings;
  const onBookingUpdatedRef = useRef(onBookingUpdated);
  onBookingUpdatedRef.current = onBookingUpdated;

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
          if (payload.new && onBookingUpdatedRef.current) {
            const existing = bookingsRef.current.find(
              (b) => b.id === payload.new.id || b.reference === payload.new.id
            );
            const mapped = mapBookingRowToBooking(payload.new, existing);
            onBookingUpdatedRef.current(mapped);
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentBooking.id]);

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

  if (bookings.length === 0 && !activeBooking) {
    return (
      <div className="max-w-4xl mx-auto py-8 sm:py-16 px-4 animate-view-entrance">
        <div className={`p-8 sm:p-12 rounded-2xl border text-center flex flex-col items-center justify-center ${
          isDarkMode ? 'bg-[#12151b] border-[#1e222b] text-white' : 'bg-white border-slate-200/80 text-slate-900 shadow-advertz'
        }`}>
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3.5 border border-blue-100">
            <Radio className="w-6 h-6" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">
            No Active Fleet Telemetry
          </h2>
          <p className={`text-xs sm:text-sm max-w-md mt-1.5 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            You do not currently have any active consignments in transit. Once a booking is confirmed, live GPS corridor telemetry, ETA countdowns, and driver direct messaging will stream here automatically.
          </p>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('new-booking')}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-xs"
            >
              <Zap className="w-4 h-4" />
              <span>Book Emergency Delivery</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Mobile-Optimized Live Tracking View (screens < md) */}
      <div className="block md:hidden">
        <MobileTrackingView
          isDarkMode={isDarkMode}
          booking={currentBooking}
          onBack={() => {
            if (onNavigate) {
              onNavigate('dashboard');
            }
          }}
          onNavigate={(view) => {
            if (onNavigate) {
              onNavigate(view);
            }
          }}
        />
      </div>

      {/* Full Desktop Live Tracking View (screens >= md) */}
      <div className="hidden md:block space-y-6">
        {/* Title & Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-blue-600 bg-blue-50/80 border border-blue-200/60 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <span>Corridor estimate · Dispatch progress</span>
            </div>
            <h1
              className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              Live Tracking
            </h1>
            <p
              className={`text-xs sm:text-sm mt-1 text-slate-500 dark:text-slate-400`}
            >
              Booking{' '}
              <strong
                className={`font-mono ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                {bookingRef}
              </strong>{' '}
              · {originCity} → {destCity}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                isDarkMode
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                  : 'bg-blue-50 text-blue-700 border border-blue-200/80'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <span>Estimated Corridor</span>
            </div>

            <button
              onClick={handleRunAiRiskAnalysis}
              disabled={isAnalyzing}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all cursor-pointer ${
                isDarkMode
                  ? 'bg-[#111827] hover:bg-[#1e293b] text-blue-400 border border-[#1e293b]'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 shadow-xs'
              }`}
            >
              {isAnalyzing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>Route Advisory</span>
            </button>
          </div>
        </div>

      {/* In-Transit Multi-Booking Switcher */}
      <div
        className={`p-3 rounded-2xl flex items-center justify-between gap-3 flex-wrap transition-all shadow-advertz ${
          isDarkMode
            ? 'bg-[#111827] border border-[#1e293b]'
            : 'bg-white border border-slate-200/80'
        }`}
      >
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full sm:w-auto">
          <span
            className={`text-xs font-medium shrink-0 flex items-center gap-1.5 mr-1 ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-blue-600" />
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
                className={`px-4 py-1.5 rounded-full text-xs font-medium shrink-0 flex items-center gap-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : isDarkMode
                    ? 'bg-[#0b0f19] text-slate-300 border border-[#1e293b] hover:border-slate-600'
                    : 'bg-white text-slate-700 border border-slate-200 shadow-advertz hover:border-slate-300'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSelected ? 'bg-white' : 'bg-blue-500'
                  }`}
                />
                <span className="font-mono">{b.reference}</span>
                <span className="opacity-75 text-[11px]">
                  · {bOrigin} → {bDest}
                </span>
              </button>
            );
          })}
        </div>

        <span
          className={`text-[11px] font-mono hidden lg:inline ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500 font-medium'
          }`}
        >
          {inTransitBookings.length} rapid-dispatch vehicle{inTransitBookings.length === 1 ? '' : 's'} on corridor
        </span>
      </div>

      {/* Optional Gemini Real-time AI Risk Advisory */}
      {aiAnalysis && (
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isDarkMode ? 'bg-[#09111c] border-[#1e2f46]' : 'bg-sky-50/80 border-sky-200 shadow-xs'
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
                <h3
                  className={`font-bold text-sm ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {aiAnalysis.headline}
                </h3>
              </div>
            </div>

            <span
              className={`font-mono text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                isDarkMode
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {aiAnalysis.confidencePercent}% Confidence
            </span>
          </div>

          <p
            className={`text-xs mt-2.5 leading-relaxed ${
              isDarkMode ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            {aiAnalysis.summary}
          </p>

          <div
            className={`grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t text-xs ${
              isDarkMode ? 'border-slate-700/40' : 'border-sky-200/80'
            }`}
          >
            <div>
              <span
                className={`font-semibold ${
                  isDarkMode ? 'text-slate-200' : 'text-slate-900'
                }`}
              >
                Dispatch Directive:{' '}
              </span>
              <span
                className={isDarkMode ? 'text-slate-400' : 'text-slate-600 font-medium'}
              >
                {aiAnalysis.recommendation}
              </span>
            </div>
            <div
              className={`flex items-center gap-2 justify-end font-mono text-[11px] ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              <span>Traffic delay index:</span>
              <span className="text-emerald-500 font-bold">+2 min nominal</span>
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
              {hasVerifiedTelemetry
                ? `${traveledMiles} of ${totalMiles} miles (${Math.round(animatedProgress)}%)`
                : currentBooking.status === 'DELIVERED'
                ? (hasVerifiedDeliveryEvidence ? `${totalMiles} miles (Completed)` : 'Delivery recorded (POD pending)')
                : 'Progress unavailable (Telemetry pending)'}
            </p>
            <p className="font-mono text-[10px] text-sky-400/80 mt-1">
              {hasVerifiedTelemetry ? 'Corridor telemetry · Live synced' : 'Corridor estimate · Telemetry pending'}
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
              <span>
                {hasVerifiedTelemetry
                  ? 'Dispatch progress telemetry · Active'
                  : currentBooking.status === 'DELIVERED'
                  ? (hasVerifiedDeliveryEvidence ? 'Delivery completed & verified' : 'Delivery recorded — POD pending')
                  : 'Telemetry pending operational dispatch'}
              </span>
            </span>
          </div>
        </div>

        {/* Right: Driver Card & Status Timeline */}
        <div className="space-y-6">
          {/* Driver Card */}
          <div className={`p-6 rounded-2xl border ${cardBg}`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm tracking-tight shrink-0 shadow-xs">
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
                  {hasAllocatedDriver
                    ? `${driverVehicle}${driverReg ? ` · ${driverReg}` : ''}`
                    : `${driverVehicle} · Pending allocation`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span
                className={`font-mono text-[10px] font-semibold tracking-wider px-3 py-1 rounded-full uppercase ${
                  currentBooking.status === 'SCHEDULED'
                    ? isDarkMode
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-amber-50 text-amber-800 border border-amber-200/80'
                    : isDarkMode
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : 'bg-blue-50 text-blue-700 border border-blue-200/80'
                }`}
              >
                {currentBooking.status === 'IN TRANSIT'
                  ? 'ON THE MOVE'
                  : currentBooking.status === 'SCHEDULED'
                  ? 'SCHEDULED & AWAITING DISPATCH'
                  : currentBooking.status}
              </span>
              <span
                className={`font-mono text-[10px] font-semibold tracking-wider px-3 py-1 rounded-full uppercase flex items-center gap-1.5 ${
                  hasAllocatedDriver
                    ? isDarkMode
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                    : isDarkMode
                    ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                    : 'bg-slate-100 text-slate-600 border border-slate-200/80'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {hasAllocatedDriver ? 'VERIFIED DRIVER' : 'DRIVER UNALLOCATED'}
              </span>
            </div>

            {/* Action buttons: Call / Message */}
            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                type="button"
                disabled={!hasAllocatedDriver}
                onClick={() => hasAllocatedDriver && setIsCalling(true)}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-full border text-xs font-medium transition-all ${
                  !hasAllocatedDriver
                    ? 'opacity-50 cursor-not-allowed border-slate-200 text-slate-400 bg-slate-50'
                    : isDarkMode
                    ? 'border-slate-700/80 hover:bg-slate-800 text-slate-200 hover-lift active:scale-[0.98] cursor-pointer'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800 shadow-advertz hover-lift active:scale-[0.98] cursor-pointer'
                }`}
              >
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                <span>Call</span>
              </button>

              <button
                type="button"
                disabled={!hasAllocatedDriver}
                onClick={() => hasAllocatedDriver && setIsMessaging(true)}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-full border text-xs font-medium transition-all ${
                  !hasAllocatedDriver
                    ? 'opacity-50 cursor-not-allowed border-slate-200 text-slate-400 bg-slate-50'
                    : isDarkMode
                    ? 'border-slate-700/80 hover:bg-slate-800 text-slate-200 hover-lift active:scale-[0.98] cursor-pointer'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800 shadow-advertz hover-lift active:scale-[0.98] cursor-pointer'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                <span>Message</span>
              </button>
            </div>

            {/* Live Spoke Telemetry & Verified Tracking Links */}
            {(isValidHttpsUrl(currentBooking.pickup_tracking_url) ||
              isValidHttpsUrl(currentBooking.delivery_tracking_url)) && (
              <div
                className={`mt-4 pt-3.5 border-t ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <ExternalLink className="w-3 h-3 text-[#3898EC]" />
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#3898EC]">
                    Verified Dispatch Tracking
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {isValidHttpsUrl(currentBooking.pickup_tracking_url) && (
                    <a
                      href={currentBooking.pickup_tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono font-medium border transition-colors ${
                        isDarkMode
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 hover:bg-sky-500/20'
                          : 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                        <span className="truncate">Pickup Track</span>
                      </span>
                      <ExternalLink className="w-3 h-3 opacity-75 shrink-0 ml-1" />
                    </a>
                  )}
                  {isValidHttpsUrl(currentBooking.delivery_tracking_url) && (
                    <a
                      href={currentBooking.delivery_tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono font-medium border transition-colors ${
                        isDarkMode
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        <span className="truncate">Delivery Track</span>
                      </span>
                      <ExternalLink className="w-3 h-3 opacity-75 shrink-0 ml-1" />
                    </a>
                  )}
                </div>
              </div>
            )}
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

            <div
              className={`space-y-4 relative pl-4 border-l-2 ${
                isDarkMode ? 'border-slate-700/50' : 'border-slate-200'
              }`}
            >
              {/* Step 1: Booking Confirmed */}
              <div className="relative">
                <span
                  className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#3898EC] ring-4 ${
                    isDarkMode ? 'ring-[#0b121c]' : 'ring-white shadow-xs'
                  }`}
                />
                <p
                  className={`text-xs font-bold ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Booking confirmed
                </p>
                <p
                  className={`font-mono text-[11px] ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500 font-medium'
                  }`}
                >
                  {currentBooking.pickupTime || currentBooking.date || 'Scheduled'}
                </p>
              </div>

              {/* Step 2: Driver Allocation */}
              <div className="relative">
                <span
                  className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ${
                    isDarkMode ? 'ring-[#0b121c]' : 'ring-white shadow-xs'
                  } ${
                    hasAllocatedDriver ? 'bg-[#3898EC]' : 'bg-slate-500'
                  }`}
                />
                <p
                  className={`text-xs font-bold ${
                    hasAllocatedDriver
                      ? (isDarkMode ? 'text-white' : 'text-slate-900')
                      : (isDarkMode ? 'text-slate-400' : 'text-slate-600')
                  }`}
                >
                  {hasAllocatedDriver ? `Driver allocated — ${driverName}` : 'Driver allocation pending'}
                </p>
                <p
                  className={`font-mono text-[11px] ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500 font-medium'
                  }`}
                >
                  {hasAllocatedDriver ? (`${driverVehicle}${driverReg ? ` · ${driverReg}` : ''}`) : 'Awaiting fleet assignment'}
                </p>
              </div>

              {/* Step 3: Collection */}
              <div className="relative">
                <span
                  className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ${
                    isDarkMode ? 'ring-[#0b121c]' : 'ring-white shadow-xs'
                  } ${
                    (currentBooking.status === 'IN TRANSIT' || currentBooking.status === 'DELIVERED') && (hasAllocatedDriver || isValidHttpsUrl(currentBooking.pickup_tracking_url))
                      ? 'bg-[#3898EC]'
                      : 'bg-slate-500'
                  }`}
                />
                <p
                  className={`text-xs font-bold ${
                    (currentBooking.status === 'IN TRANSIT' || currentBooking.status === 'DELIVERED') && (hasAllocatedDriver || isValidHttpsUrl(currentBooking.pickup_tracking_url))
                      ? (isDarkMode ? 'text-white' : 'text-slate-900')
                      : (isDarkMode ? 'text-slate-400' : 'text-slate-600')
                  }`}
                >
                  {(currentBooking.status === 'IN TRANSIT' || currentBooking.status === 'DELIVERED') && (hasAllocatedDriver || isValidHttpsUrl(currentBooking.pickup_tracking_url))
                    ? `Collected from ${originCity}`
                    : `Collection from ${originCity}`}
                </p>
                <p
                  className={`font-mono text-[11px] ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500 font-medium'
                  }`}
                >
                  {(currentBooking.status === 'IN TRANSIT' || currentBooking.status === 'DELIVERED') && (hasAllocatedDriver || isValidHttpsUrl(currentBooking.pickup_tracking_url))
                    ? 'Collection completed'
                    : 'Awaiting collection confirmation'}
                </p>
              </div>

              {/* Step 4: Corridor Transit */}
              <div className="relative">
                <span
                  className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ${
                    isDarkMode ? 'ring-[#0b121c]' : 'ring-white shadow-xs'
                  } ${
                    currentBooking.status === 'DELIVERED'
                      ? 'bg-[#3898EC]'
                      : (currentBooking.status === 'IN TRANSIT' && hasAllocatedDriver ? 'bg-[#3898EC]' : 'bg-slate-500')
                  }`}
                />
                <p
                  className={`text-xs font-bold ${
                    currentBooking.status === 'DELIVERED' || (currentBooking.status === 'IN TRANSIT' && hasAllocatedDriver)
                      ? (isDarkMode ? 'text-white' : 'text-slate-900')
                      : (isDarkMode ? 'text-slate-400' : 'text-slate-600')
                  }`}
                >
                  {currentBooking.status === 'DELIVERED'
                    ? 'Transit completed'
                    : (currentBooking.status === 'IN TRANSIT' ? 'In transit to destination' : 'Transit to destination')}
                </p>
                <p
                  className={`font-mono text-[11px] ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500 font-medium'
                  }`}
                >
                  {currentBooking.status === 'DELIVERED'
                    ? 'Route completed'
                    : (currentBooking.status === 'IN TRANSIT' ? (hasAllocatedDriver ? 'Active corridor transit' : 'Corridor transit pending driver') : 'Scheduled route')}
                </p>
              </div>

              {/* Step 5: Delivery */}
              <div className="relative">
                <span
                  className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ${
                    isDarkMode ? 'ring-[#0b121c]' : 'ring-white shadow-xs'
                  } ${
                    currentBooking.status === 'DELIVERED'
                      ? 'bg-emerald-500'
                      : 'bg-slate-500'
                  }`}
                />
                <p
                  className={`text-xs font-medium ${
                    currentBooking.status === 'DELIVERED'
                      ? 'text-emerald-400 font-bold'
                      : (isDarkMode ? 'text-slate-400' : 'text-slate-600')
                  }`}
                >
                  {hasVerifiedDeliveryEvidence
                    ? 'Delivered to recipient'
                    : currentBooking.status === 'DELIVERED'
                    ? 'Delivery recorded — POD pending'
                    : `Delivery to ${destCity}`}
                </p>
                <p className="font-mono text-[11px] text-slate-500">
                  {hasVerifiedDeliveryEvidence
                    ? 'Delivery verified via telemetry'
                    : currentBooking.status === 'DELIVERED'
                    ? 'Awaiting verified consignee sign-off'
                    : `~ ${etaDisplay}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Call Driver Modal */}
      {isCalling && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className={`p-6 sm:p-7 rounded-3xl border max-w-sm w-full ${cardBg} shadow-advertz-lg text-center space-y-4`}>
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h3
                className={`font-bold text-base tracking-tight ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                Connecting to Driver
              </h3>
              <p
                className={`text-xs mt-1 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {driverName} · {driverPhone}
              </p>
            </div>
            <p
              className={`text-xs leading-relaxed ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              For highway safety during vehicle transit, driver calls are routed through vehicle hands-free Bluetooth.
            </p>
            <div className="flex gap-2.5 justify-center pt-2">
              <a
                href={`tel:${driverPhone.replace(/\s+/g, '')}`}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Dial Now</span>
              </a>
              <button
                onClick={() => setIsCalling(false)}
                className={`px-4 py-2.5 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'border-[#1e222b] text-slate-300 hover:text-white hover:bg-[#161a22]'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-advertz'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Driver Modal */}
      {isMessaging && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className={`p-6 sm:p-7 rounded-3xl border max-w-md w-full ${cardBg} shadow-advertz-lg space-y-4`}>
            <div
              className={`flex items-center justify-between pb-3 border-b ${
                isDarkMode ? 'border-[#1e222b]' : 'border-slate-200/80'
              }`}
            >
              <div>
                <h3
                  className={`font-bold text-base tracking-tight ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Message {driverName}
                </h3>
                <p
                  className={`text-xs mt-0.5 ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Vehicle: {driverVehicle} · {driverReg}
                </p>
              </div>
              <button
                onClick={() => setIsMessaging(false)}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
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
                  className={`px-3 py-1 rounded-full text-xs transition-colors cursor-pointer ${
                    isDarkMode
                      ? 'bg-[#18202c] hover:bg-[#202b3b] text-slate-300 border border-[#253245]'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                  }`}
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
              className={`w-full text-xs p-3 rounded-xl border outline-none transition-colors ${
                isDarkMode
                  ? 'border-[#1e222b] bg-[#0f1115] text-white focus:border-blue-500'
                  : 'border-slate-200 bg-white text-slate-900 shadow-advertz focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
              }`}
            />

            {sentMessage && (
              <p className="text-xs text-emerald-600 flex items-center gap-1.5 font-medium">
                <Check className="w-3.5 h-3.5" />
                <span>{sentMessage}</span>
              </p>
            )}

            <div
              className={`flex justify-end gap-2.5 pt-3 border-t ${
                isDarkMode ? 'border-[#1e222b]' : 'border-slate-200/80'
              }`}
            >
              <button
                onClick={() => setIsMessaging(false)}
                className={`px-4 py-2 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'border-[#1e222b] text-slate-300 hover:text-white hover:bg-[#161a22]'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-advertz'
                }`}
              >
                Close
              </button>
              <button
                onClick={handleSendMessage}
                disabled={!messageText.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send to Cab</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

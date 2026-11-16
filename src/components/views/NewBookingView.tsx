import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Package,
  Truck,
  ShieldCheck,
  CreditCard,
  CheckCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Clock,
  Info,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { BookingWizardState, Booking } from '../../types';
import { AddressAutocomplete } from '../ui/AddressAutocomplete';
import { VEHICLE_OPTIONS } from '../../data/mockData';
import { parseShipmentWithGemini } from '../../lib/geminiClient';
import {
  getNextBookingReference,
  getNextBookingReferenceAsync,
  persistWizardDraft,
  createStripeCheckoutSession,
  pollBookingPaymentStatus,
  updateBookingPaymentStatus,
} from '../../lib/portalStore';
import { calculateUkRoadDistance } from '../../lib/routing';

interface NewBookingViewProps {
  isDarkMode: boolean;
  onBookingCreated: (newBooking: Booking, wizardState?: BookingWizardState) => Promise<Booking | void> | Booking | void;
  onViewTracking: (bookingId?: string) => void;
  initialWizardState?: Partial<BookingWizardState>;
  onUpdateState?: (state: BookingWizardState) => void;
  existingBookings?: Booking[];
  onResetWizard?: () => void;
  userEmail?: string;
  userName?: string;
  companyId?: string;
}

export const BookingWizard: React.FC<NewBookingViewProps> = ({
  isDarkMode,
  onBookingCreated,
  onViewTracking,
  initialWizardState,
  existingBookings = [],
  onResetWizard,
  userEmail,
  userName,
  companyId,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isAiParsing, setIsAiParsing] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiNote, setAiNote] = useState<string | null>(null);

  // Stripe card checkout states
  const [isSubmittingCardPayment, setIsSubmittingCardPayment] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentCancelNotice, setPaymentCancelNotice] = useState<string | null>(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState<boolean>(false);
  const [verifyingBookingRef, setVerifyingBookingRef] = useState<string | null>(null);
  const [paymentPendingWarning, setPaymentPendingWarning] = useState<string | null>(null);

  // Complete Controlled State in BookingWizard lifted and preserved
  const [form, setForm] = useState<BookingWizardState>(() => ({
    pickupPostcode: initialWizardState?.pickupPostcode || 'Manchester M17 1AB',
    pickupContact: initialWizardState?.pickupContact || initialWizardState?.contactName || 'Warehouse desk',
    pickupPhone: initialWizardState?.pickupPhone || initialWizardState?.contactPhone || '0161 555 0134',
    contactName: initialWizardState?.contactName || initialWizardState?.pickupContact || 'Warehouse desk',
    contactPhone: initialWizardState?.contactPhone || initialWizardState?.pickupPhone || '0161 555 0134',
    collectionWindow: initialWizardState?.collectionWindow || 'ASAP — ready now',
    dropoffPostcode: initialWizardState?.dropoffPostcode || 'Birmingham B6 7EU',
    dropoffContact: initialWizardState?.dropoffContact || initialWizardState?.recipientName || 'Goods Inwards / Receiving',
    dropoffPhone: initialWizardState?.dropoffPhone || initialWizardState?.recipientPhone || '0121 496 0281',
    recipientName: initialWizardState?.recipientName || initialWizardState?.dropoffContact || 'Goods Inwards / Receiving',
    recipientPhone: initialWizardState?.recipientPhone || initialWizardState?.dropoffPhone || '0121 496 0281',
    deliveryWindow: initialWizardState?.deliveryWindow || 'Direct transit (approx 88 min)',
    deliveryInstructions: initialWizardState?.deliveryInstructions || 'Access via Bay 4. Contact goods inwards before docking.',
    cargoDescription: initialWizardState?.cargoDescription || 'Palletised parts · 650 kg',
    cargoWeightKg: initialWizardState?.cargoWeightKg || 650,
    palletCount: initialWizardState?.palletCount || 2,
    itemsCount: initialWizardState?.itemsCount || 2,
    cargoHazmat: initialWizardState?.cargoHazmat || false,
    selectedVehicle: initialWizardState?.selectedVehicle || 'Sprinter LWB',
    selectedService: initialWizardState?.selectedService || 'Emergency (ASAP)',
    estimatedMiles: initialWizardState?.estimatedMiles || 88,
    estimatedTotal: initialWizardState?.estimatedTotal || 355,
    paymentMethod: initialWizardState?.paymentMethod || 'standby-account',
    poReference: initialWizardState?.poReference || initialWizardState?.poNumber || 'PO-2026-8910',
    poNumber: initialWizardState?.poNumber || initialWizardState?.poReference || 'PO-2026-8910',
    notes: initialWizardState?.notes || 'Access via Gate 4 dock. Driver needs safety boots & hi-vis.',
  }));

  // Synchronize initialWizardState updates from parent (e.g. Rebook action or Reset)
  useEffect(() => {
    if (initialWizardState) {
      setForm((prev) => {
        let changed = false;
        for (const key of Object.keys(initialWizardState) as (keyof BookingWizardState)[]) {
          if (initialWizardState[key] !== undefined && initialWizardState[key] !== prev[key]) {
            changed = true;
            break;
          }
        }
        return changed ? { ...prev, ...initialWizardState } : prev;
      });
    }
  }, [initialWizardState]);

  // Persist draft to storage safely in effect without triggering parent render
  useEffect(() => {
    persistWizardDraft(form);
  }, [form]);

  const [isCalculatingRoute, setIsCalculatingRoute] = useState<boolean>(false);
  const [routeSummaryText, setRouteSummaryText] = useState<string | null>(null);

  // Real UK Postcode Distance Calculation (queries api.postcodes.io with local UK fallback)
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      if (form.pickupPostcode?.trim() && form.dropoffPostcode?.trim()) {
        setIsCalculatingRoute(true);
        try {
          const route = await calculateUkRoadDistance(form.pickupPostcode, form.dropoffPostcode);
          if (!active) return;

          const selectedVeh =
            VEHICLE_OPTIONS.find((v) => v.name === form.selectedVehicle) || VEHICLE_OPTIONS[2];
          const newTotal = Math.round(selectedVeh.baseRate + selectedVeh.perMile * route.distanceMiles);

          setRouteSummaryText(
            `${route.originCity} → ${route.destCity} · ${route.distanceMiles} road miles (approx ${route.etaMinutes} min)`
          );

          setForm((prev) => ({
            ...prev,
            estimatedMiles: route.distanceMiles,
            estimatedTotal: newTotal,
            deliveryWindow: `Direct transit (approx ${route.etaMinutes} min)`,
          }));
        } catch (e) {
          console.error('Failed to compute UK road distance:', e);
        } finally {
          if (active) setIsCalculatingRoute(false);
        }
      }
    }, 450);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [form.pickupPostcode, form.dropoffPostcode, form.selectedVehicle]);

  const updateForm = (updater: (prev: BookingWizardState) => BookingWizardState) => {
    setForm(updater);
  };

  const steps = [
    { num: 1, label: '01 Pickup' },
    { num: 2, label: '02 Drop-off' },
    { num: 3, label: '03 Cargo' },
    { num: 4, label: '04 Vehicle' },
    { num: 5, label: '05 Service' },
    { num: 6, label: '06 Quote' },
    { num: 7, label: '07 Payment' },
    { num: 8, label: '08 Done' },
  ];

  const cardBg = isDarkMode
    ? 'bg-[#111827] border-[#1e293b]'
    : 'bg-white border border-slate-200/80 shadow-advertz';
  const inputBg = isDarkMode
    ? 'bg-[#060b11] border-[#1a2636] text-white focus:border-blue-500'
    : 'bg-white border border-slate-200 text-slate-900 shadow-advertz focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500';

  const handleAiAutoFill = async () => {
    const textToParse =
      aiPrompt.trim() ||
      'Urgent recovery: 2 euro pallets 650kg of automotive line-stop parts from Manchester M17 1AB to Birmingham B6 7EU. Ready for collection immediately.';
    setIsAiParsing(true);
    setAiNote(null);
    try {
      const parsed = await parseShipmentWithGemini(textToParse);
      updateForm((prev) => ({
        ...prev,
        pickupPostcode: parsed.pickupAddress || prev.pickupPostcode,
        pickupContact: parsed.pickupContact || prev.pickupContact,
        contactName: parsed.pickupContact || prev.contactName,
        dropoffPostcode: parsed.dropoffAddress || prev.dropoffPostcode,
        dropoffContact: parsed.dropoffContact || prev.dropoffContact,
        recipientName: parsed.dropoffContact || prev.recipientName,
        cargoDescription: parsed.cargoType
          ? `${parsed.cargoType} · ${parsed.weightKg || 650} kg`
          : prev.cargoDescription,
        cargoWeightKg: parsed.weightKg || prev.cargoWeightKg,
        palletCount: parsed.palletCount ?? prev.palletCount,
        itemsCount: parsed.palletCount ?? prev.itemsCount,
        selectedVehicle: parsed.vehicleRecommended || prev.selectedVehicle,
        selectedService: parsed.serviceType || prev.selectedService,
        estimatedMiles: parsed.estimatedMiles || prev.estimatedMiles,
        estimatedTotal: parsed.estimatedTotal || prev.estimatedTotal,
      }));
      setAiNote(
        parsed.aiExplanation ||
          'Parsed successfully with Gemini 3.1 Flash Lite. Review fields and continue.'
      );
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiParsing(false);
    }
  };

  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  // Detect Stripe Checkout Return Redirects (?payment=success&bookingId=NT-xxxxx or ?payment=cancelled&bookingId=NT-xxxxx)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const paymentParam = params.get('payment');
    const bookingIdParam = params.get('bookingId');

    if (!paymentParam && !bookingIdParam) return;

    // Remove query params cleanly from browser history so refresh does not re-trigger
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    if (paymentParam === 'cancelled') {
      setCurrentStep(7);
      setPaymentCancelNotice(
        `Stripe Checkout was cancelled for booking ${bookingIdParam || 'reference'}. No payment was taken. Your booking details have been preserved below — you may retry card checkout or choose an alternative payment method.`
      );
      return;
    }

    if (paymentParam === 'success' && bookingIdParam) {
      setIsVerifyingPayment(true);
      setVerifyingBookingRef(bookingIdParam);
      setPaymentError(null);
      setPaymentCancelNotice(null);
      setPaymentPendingWarning(null);

      // Server-authoritative verification loop: fails closed until GET /api/payments/status/:id confirms isFullyPaid: true
      pollBookingPaymentStatus(bookingIdParam, 6, 1500)
        .then(async (statusRes) => {
          setIsVerifyingPayment(false);
          if (statusRes.isFullyPaid) {
            const existing = existingBookings.find(
              (b) => b.id === bookingIdParam || b.reference === bookingIdParam
            );
            const updated = await updateBookingPaymentStatus(
              bookingIdParam,
              'paid',
              statusRes.amountPaidGbp,
              statusRes.stripePaymentIntentId
            );
            const confirmed: Booking = updated || {
              id: bookingIdParam,
              reference: bookingIdParam,
              date: 'Today',
              origin: existing?.origin || form.pickupPostcode,
              destination: existing?.destination || form.dropoffPostcode,
              vehicle: existing?.vehicle || form.selectedVehicle,
              total: statusRes.totalGbp || form.estimatedTotal,
              status: 'SCHEDULED',
              payment_method: 'card',
              payment_status: 'paid',
              amount_paid_gbp: statusRes.amountPaidGbp,
              stripe_payment_intent_id: statusRes.stripePaymentIntentId,
              cargo: existing?.cargo || form.cargoDescription,
              weightKg: existing?.weightKg || form.cargoWeightKg,
              palletCount: existing?.palletCount || form.palletCount,
              deliveryTime: form.deliveryWindow || 'Direct transit (approx 88 min)',
              progress: 0.05,
            };
            setConfirmedBooking(confirmed);
            setCurrentStep(8);
          } else if (statusRes.paymentStatus === 'failed' || statusRes.paymentStatus === 'cancelled') {
            setCurrentStep(7);
            setPaymentError(
              `Payment was marked as ${statusRes.paymentStatus} by Stripe for booking ${bookingIdParam}. Please review your payment details and retry.`
            );
          } else {
            // Still requires_payment or pending after polling attempts
            setCurrentStep(7);
            setPaymentPendingWarning(
              `Payment is awaiting final webhook confirmation for booking ${bookingIdParam}. Dispatches are strictly gated until bank payment confirmation is received.`
            );
          }
        })
        .catch((err) => {
          setIsVerifyingPayment(false);
          setCurrentStep(7);
          setPaymentError(
            `Unable to verify payment status with server: ${err?.message || err}. Dispatches remain gated until payment is verified.`
          );
        });
    }
  }, []);

  const handleManualRecheckStatus = (bookingRef: string) => {
    setIsVerifyingPayment(true);
    setPaymentError(null);
    setPaymentPendingWarning(null);

    pollBookingPaymentStatus(bookingRef, 4, 1500)
      .then(async (statusRes) => {
        setIsVerifyingPayment(false);
        if (statusRes.isFullyPaid) {
          const updated = await updateBookingPaymentStatus(
            bookingRef,
            'paid',
            statusRes.amountPaidGbp,
            statusRes.stripePaymentIntentId
          );
          setConfirmedBooking(
            updated || {
              id: bookingRef,
              reference: bookingRef,
              date: 'Today',
              origin: form.pickupPostcode,
              destination: form.dropoffPostcode,
              vehicle: form.selectedVehicle,
              total: statusRes.totalGbp || form.estimatedTotal,
              status: 'SCHEDULED',
              payment_method: 'card',
              payment_status: 'paid',
              amount_paid_gbp: statusRes.amountPaidGbp,
              stripe_payment_intent_id: statusRes.stripePaymentIntentId,
              deliveryTime: form.deliveryWindow || 'Direct transit (approx 88 min)',
              progress: 0.05,
            }
          );
          setCurrentStep(8);
        } else {
          setPaymentPendingWarning(
            `Payment verification is still pending for booking ${bookingRef}. Dispatches remain gated until payment is confirmed.`
          );
        }
      })
      .catch((err) => {
        setIsVerifyingPayment(false);
        setPaymentError(`Status check failed: ${err?.message || err}`);
      });
  };

  const handleNextStep = async () => {
    if (currentStep < 7) {
      setCurrentStep(currentStep + 1);
    } else if (currentStep === 7) {
      if (form.paymentMethod === 'card') {
        if (isSubmittingCardPayment || isVerifyingPayment) return;
        setIsSubmittingCardPayment(true);
        setPaymentError(null);
        setPaymentCancelNotice(null);
        setPaymentPendingWarning(null);

        try {
          const newRef = await getNextBookingReferenceAsync(existingBookings);
          const newBooking: Booking = {
            id: newRef,
            reference: newRef,
            date: 'Today',
            origin: form.pickupPostcode,
            destination: form.dropoffPostcode,
            vehicle: form.selectedVehicle,
            total: form.estimatedTotal,
            status: 'SCHEDULED',
            payment_method: 'card',
            payment_status: 'requires_payment',
            amount_paid_gbp: 0,
            cargo: form.cargoDescription,
            weightKg: form.cargoWeightKg,
            palletCount: form.palletCount,
            pickupTime: 'Now',
            deliveryTime: form.deliveryWindow || 'Direct transit (approx 88 min)',
            driver: undefined,
            progress: 0.05,
          };

          // Save booking to local cache & Supabase
          const savedBooking = await onBookingCreated(newBooking, form);
          const confirmedRef = (savedBooking && savedBooking.reference) ? savedBooking.reference : newRef;

          // Correlate with server-authoritative Stripe Checkout Session
          const sessionRes = await createStripeCheckoutSession({
            bookingId: confirmedRef,
            customerEmail: userEmail || 'accounts@meridian.co.uk',
            customerName: userName || form.contactName || 'Valued Customer',
            originPostcode: form.pickupPostcode,
            destinationPostcode: form.dropoffPostcode,
            vehicle: form.selectedVehicle,
            companyId: companyId,
            successUrl: `${window.location.origin}/?payment=success&bookingId=${encodeURIComponent(confirmedRef)}`,
            cancelUrl: `${window.location.origin}/?payment=cancelled&bookingId=${encodeURIComponent(confirmedRef)}`,
          });

          if (!sessionRes.checkoutUrl) {
            throw new Error('Server returned success but did not provide a Stripe Checkout URL.');
          }

          // Safely redirect to Stripe hosted checkout
          window.location.href = sessionRes.checkoutUrl;
        } catch (err: any) {
          setIsSubmittingCardPayment(false);
          setPaymentError(
            err?.message || 'Failed to initialize Stripe Checkout. Please try again or choose an alternative payment method.'
          );
        }
        return;
      }

      // Non-card payment methods (standby-account, corporate-bacs)
      const newRef = await getNextBookingReferenceAsync(existingBookings);
      const newBooking: Booking = {
        id: newRef,
        reference: newRef,
        date: 'Today',
        origin: form.pickupPostcode,
        destination: form.dropoffPostcode,
        vehicle: form.selectedVehicle,
        total: form.estimatedTotal,
        status: 'SCHEDULED',
        payment_method: form.paymentMethod,
        payment_status: form.paymentMethod === 'standby-account' ? 'standby_terms' : 'bacs_invoice',
        amount_paid_gbp: 0,
        cargo: form.cargoDescription,
        weightKg: form.cargoWeightKg,
        palletCount: form.palletCount,
        pickupTime: 'Now',
        deliveryTime: form.deliveryWindow || 'Direct transit (approx 88 min)',
        driver: undefined,
        progress: 0.05,
      };
      try {
        const savedBooking = await onBookingCreated(newBooking, form);
        setConfirmedBooking(savedBooking || newBooking);
        setCurrentStep(8);
      } catch (err: any) {
        setPaymentError(
          `Unable to confirm booking with central dispatch: ${err?.message || 'Database rejected insertion'}. Your details have been preserved below; please click "Confirm Booking" to retry.`
        );
      }
    }
  };

  const handleCreateAnother = () => {
    setConfirmedBooking(null);
    setCurrentStep(1);
    if (onResetWizard) {
      onResetWizard();
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1 && currentStep < 8) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title section */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-blue-600 bg-blue-50/80 border border-blue-200/60 mb-2">
          <span>Rapid dispatch booking</span>
        </div>
        <h1
          className={`text-2xl sm:text-3xl font-bold tracking-tight ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}
        >
          Create a booking
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Instant quote, vehicle recommendation and dispatch in under a minute.
        </p>
      </div>

      {/* Step Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {steps.map((s) => {
          const isActive = currentStep === s.num;
          const isDone = currentStep > s.num;
          return (
            <button
              key={s.num}
              onClick={() => setCurrentStep(s.num)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white font-medium shadow-xs'
                  : isDone
                  ? isDarkMode
                    ? 'bg-[#12151b] text-emerald-400 border border-emerald-800/40'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-medium'
                  : isDarkMode
                  ? 'bg-[#0f1115] text-slate-400 border border-[#1e222b] hover:text-slate-200'
                  : 'bg-white text-slate-600 border border-slate-200 shadow-advertz hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {isDone && <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Gemini AI Smart Assistant Bar */}
      <div
        className={`p-5 rounded-2xl border transition-all ${
          isDarkMode ? 'bg-[#09111c] border-[#1e2f46]' : 'bg-blue-50/70 border border-blue-200/80 shadow-advertz'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/15 flex items-center justify-center text-blue-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p
                className={`text-xs font-bold tracking-tight ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                Gemini Express Autofill
              </p>
              <p
                className={`text-[11px] ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-600 font-medium'
                }`}
              >
                Paste an email or describe the job. Gemini 3.1 Flash Lite populates addresses, payload, and vehicle.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. 2 pallets 650kg from Manchester to Birmingham..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className={`text-xs px-3.5 py-2 rounded-xl border w-full sm:w-72 ${inputBg}`}
            />
            <button
              onClick={handleAiAutoFill}
              disabled={isAiParsing}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-xs font-medium flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isAiParsing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Parsing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Autofill</span>
                </>
              )}
            </button>
          </div>
        </div>

        {aiNote && (
          <div className="mt-2.5 pt-2.5 border-t border-blue-200 text-xs text-blue-700 flex items-center gap-2 font-mono">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>{aiNote}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Wizard Form + Live Summary Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Form (2 cols) */}
        <div className={`lg:col-span-2 p-6 sm:p-7 rounded-2xl border ${cardBg}`}>
          {/* STEP 1: PICKUP (Step 0) */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center text-[#3898EC]">
                  <MapPin className="w-4 h-4" />
                </div>
                <h2
                  className={`font-bold text-base sm:text-lg ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Pickup details
                </h2>
              </div>

              <div className="space-y-4">
                <AddressAutocomplete
                  id="pickup-address-input"
                  name="pickupAddress"
                  label="Pickup postcode / address"
                  value={form.pickupPostcode}
                  placeholder="e.g. Manchester M17 1AB or warehouse address"
                  selectedAddress={form.pickupAddressDetails}
                  onSelect={(address) => {
                    updateForm((prev) => ({
                      ...prev,
                      pickupPostcode: address.formattedAddress,
                      pickupAddressDetails: address,
                    }));
                  }}
                  onChange={(val) => {
                    updateForm((prev) => ({
                      ...prev,
                      pickupPostcode: val,
                    }));
                  }}
                  onInvalidate={() => {
                    updateForm((prev) => ({
                      ...prev,
                      pickupAddressDetails: null,
                    }));
                  }}
                  isDarkMode={isDarkMode}
                  inputBg={inputBg}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                      Contact name (Step 0)
                    </label>
                    <input
                      type="text"
                      value={form.contactName || form.pickupContact}
                      onChange={(e) =>
                        updateForm((prev) => ({
                          ...prev,
                          contactName: e.target.value,
                          pickupContact: e.target.value,
                        }))
                      }
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${inputBg}`}
                      placeholder="Warehouse desk"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                      Contact phone (Step 0)
                    </label>
                    <input
                      type="text"
                      value={form.contactPhone || form.pickupPhone}
                      onChange={(e) =>
                        updateForm((prev) => ({
                          ...prev,
                          contactPhone: e.target.value,
                          pickupPhone: e.target.value,
                        }))
                      }
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${inputBg}`}
                      placeholder="0161 555 0134"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Collection window (Step 0)
                  </label>
                  <input
                    type="text"
                    value={form.collectionWindow}
                    onChange={(e) =>
                      updateForm((prev) => ({ ...prev, collectionWindow: e.target.value }))
                    }
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${inputBg}`}
                    placeholder="ASAP — ready now"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: DROP-OFF (Step 1) */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center text-[#3898EC]">
                  <MapPin className="w-4 h-4" />
                </div>
                <h2
                  className={`font-bold text-base sm:text-lg ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Drop-off details
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <AddressAutocomplete
                    id="dropoff-address-input"
                    name="dropoffAddress"
                    label="Drop-off postcode / delivery address"
                    value={form.dropoffPostcode}
                    placeholder="e.g. Birmingham B6 7EU or delivery site"
                    selectedAddress={form.dropoffAddressDetails}
                    onSelect={(address) => {
                      updateForm((prev) => ({
                        ...prev,
                        dropoffPostcode: address.formattedAddress,
                        dropoffAddressDetails: address,
                      }));
                    }}
                    onChange={(val) => {
                      updateForm((prev) => ({
                        ...prev,
                        dropoffPostcode: val,
                      }));
                    }}
                    onInvalidate={() => {
                      updateForm((prev) => ({
                        ...prev,
                        dropoffAddressDetails: null,
                      }));
                    }}
                    isDarkMode={isDarkMode}
                    inputBg={inputBg}
                  />
                  {routeSummaryText && (
                    <div className="flex items-center gap-2 text-xs font-mono text-[#3898EC] bg-sky-500/10 border border-sky-500/20 px-3 py-1.5 rounded-xl mt-2">
                      {isCalculatingRoute ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5" />
                      )}
                      <span>{routeSummaryText}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                      Recipient name (Step 1)
                    </label>
                    <input
                      type="text"
                      value={form.recipientName || form.dropoffContact}
                      onChange={(e) =>
                        updateForm((prev) => ({
                          ...prev,
                          recipientName: e.target.value,
                          dropoffContact: e.target.value,
                        }))
                      }
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${inputBg}`}
                      placeholder="Goods Inwards"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                      Recipient phone (Step 1)
                    </label>
                    <input
                      type="text"
                      value={form.recipientPhone || form.dropoffPhone}
                      onChange={(e) =>
                        updateForm((prev) => ({
                          ...prev,
                          recipientPhone: e.target.value,
                          dropoffPhone: e.target.value,
                        }))
                      }
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${inputBg}`}
                      placeholder="0121 496 0281"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Delivery deadline / instructions (Step 1)
                  </label>
                  <input
                    type="text"
                    value={form.deliveryInstructions || form.deliveryWindow}
                    onChange={(e) =>
                      updateForm((prev) => ({
                        ...prev,
                        deliveryInstructions: e.target.value,
                        deliveryWindow: e.target.value,
                      }))
                    }
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${inputBg}`}
                    placeholder="Direct emergency transit. Contact goods inwards before docking."
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CARGO (Step 2) */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center text-[#3898EC]">
                  <Package className="w-4 h-4" />
                </div>
                <h2
                  className={`font-bold text-base sm:text-lg ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Cargo specifications
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Cargo description
                  </label>
                  <input
                    type="text"
                    value={form.cargoDescription}
                    onChange={(e) =>
                      updateForm((prev) => ({ ...prev, cargoDescription: e.target.value }))
                    }
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${inputBg}`}
                    placeholder="Palletised machinery parts"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                      Total weight (kg)
                    </label>
                    <input
                      type="number"
                      value={form.cargoWeightKg}
                      onChange={(e) =>
                        updateForm((prev) => ({
                          ...prev,
                          cargoWeightKg: parseInt(e.target.value) || 0,
                        }))
                      }
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${inputBg}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                      Pallet count
                    </label>
                    <input
                      type="number"
                      value={form.palletCount}
                      onChange={(e) =>
                        updateForm((prev) => ({
                          ...prev,
                          palletCount: parseInt(e.target.value) || 0,
                        }))
                      }
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${inputBg}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                      Items / Cartons count (Step 2)
                    </label>
                    <input
                      type="number"
                      value={form.itemsCount}
                      onChange={(e) =>
                        updateForm((prev) => ({
                          ...prev,
                          itemsCount: parseInt(e.target.value) || 0,
                        }))
                      }
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${inputBg}`}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="hazmat"
                    checked={form.cargoHazmat}
                    onChange={(e) =>
                      updateForm((prev) => ({ ...prev, cargoHazmat: e.target.checked }))
                    }
                    className="w-4 h-4 rounded text-[#3898EC]"
                  />
                  <label
                    htmlFor="hazmat"
                    className={`text-xs ${
                      isDarkMode ? 'text-slate-300' : 'text-slate-700 font-medium'
                    }`}
                  >
                    ADR / Dangerous Goods classification applies (Requires certified driver)
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: VEHICLE SELECTION */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center text-[#3898EC]">
                  <Truck className="w-4 h-4" />
                </div>
                <h2
                  className={`font-bold text-base sm:text-lg ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Select fleet vehicle
                </h2>
              </div>

              <div className="space-y-3">
                {VEHICLE_OPTIONS.map((v) => {
                  const isSelected = form.selectedVehicle === v.name;
                  return (
                    <div
                      key={v.id}
                      onClick={() =>
                        updateForm((prev) => ({
                          ...prev,
                          selectedVehicle: v.name,
                          estimatedTotal: Math.round(v.baseRate + v.perMile * prev.estimatedMiles),
                        }))
                      }
                      className={`p-4 rounded-xl border cursor-pointer transition-all duration-180 hover-lift flex items-center justify-between ${
                        isSelected
                          ? 'border-[#3898EC] bg-sky-500/10 shadow-xs ring-1 ring-[#3898EC]/30'
                          : isDarkMode
                          ? 'border-[#1a2636] hover:border-slate-600 bg-[#060b11]'
                          : 'border-slate-200 hover:border-slate-400 bg-white shadow-xs'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold text-sm ${
                              isDarkMode ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {v.name}
                          </span>
                          <span
                            className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${
                              isDarkMode
                                ? 'bg-slate-800 text-slate-300'
                                : 'bg-slate-100 text-slate-700 border border-slate-200 font-medium'
                            }`}
                          >
                            {v.capacity}
                          </span>
                        </div>
                        <p
                          className={`text-xs mt-1 ${
                            isDarkMode ? 'text-slate-400' : 'text-slate-600 font-medium'
                          }`}
                        >
                          {v.pallets} · {v.dimensions}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-base text-[#3898EC]">
                          £{Math.round(v.baseRate + v.perMile * form.estimatedMiles)}
                        </span>
                        <p
                          className={`font-mono text-[10px] ${
                            isDarkMode ? 'text-slate-400' : 'text-slate-500 font-medium'
                          }`}
                        >
                          Standby rate
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 5: SERVICE TIER */}
          {currentStep === 5 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center text-[#3898EC]">
                  <Clock className="w-4 h-4" />
                </div>
                <h2
                  className={`font-bold text-base sm:text-lg ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Choose Service Level
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    name: 'Emergency (ASAP)',
                    desc: 'Wheels rolling in under 60 minutes. Direct express dedicated transport.',
                    tag: 'FASTEST RESPONSE',
                  },
                  {
                    name: 'Same-Day Scheduled',
                    desc: 'Dedicated driver at agreed collection slot today.',
                    tag: 'PLANNED RECOVERY',
                  },
                  {
                    name: 'Midnight Standby Recovery',
                    desc: 'Late-night freight rescue until 00:00 for next morning assembly lines.',
                    tag: 'NIGHT COURIER',
                  },
                  {
                    name: 'Next-Day Priority',
                    desc: 'Guaranteed first-delivery slot tomorrow before 09:00 AM.',
                    tag: 'EARLY MORNING',
                  },
                ].map((tier) => (
                  <div
                    key={tier.name}
                    onClick={() =>
                      updateForm((prev) => ({
                        ...prev,
                        selectedService: tier.name,
                      }))
                    }
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-180 hover-lift ${
                      form.selectedService === tier.name
                        ? 'border-[#3898EC] bg-sky-500/10 shadow-xs ring-1 ring-[#3898EC]/30'
                        : isDarkMode
                        ? 'border-[#1a2636] bg-[#060b11]'
                        : 'border-slate-200 bg-white shadow-xs hover:border-slate-300'
                    }`}
                  >
                    <span className="font-mono text-[10px] text-[#3898EC] font-semibold tracking-wider">
                      {tier.tag}
                    </span>
                    <h3
                      className={`font-bold text-sm mt-1 ${
                        isDarkMode ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {tier.name}
                    </h3>
                    <p
                      className={`text-xs mt-1 leading-relaxed ${
                        isDarkMode ? 'text-slate-400' : 'text-slate-600 font-medium'
                      }`}
                    >
                      {tier.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 6: QUOTE CONFIRMATION */}
          {currentStep === 6 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center text-[#3898EC]">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h2
                  className={`font-bold text-base sm:text-lg ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Quote & Rate Lock
                </h2>
              </div>

              <div
                className={`p-5 rounded-2xl border ${
                  isDarkMode ? 'bg-[#060b11] border-[#1e2c40]' : 'bg-slate-50/90 border-slate-200/90 shadow-xs'
                }`}
              >
                <div
                  className={`flex justify-between items-center pb-4 border-b ${
                    isDarkMode ? 'border-slate-700/40' : 'border-slate-200'
                  }`}
                >
                  <div>
                    <span
                      className={`font-mono text-xs uppercase ${
                        isDarkMode ? 'text-slate-400' : 'text-slate-500 font-medium'
                      }`}
                    >
                      Standard Commercial Tariff
                    </span>
                    <p className="text-sm line-through text-slate-500">£420.00</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xs text-emerald-500 font-bold uppercase">
                      Standby Account Rate (15% Off)
                    </span>
                    <p className="text-2xl font-extrabold text-[#3898EC]">
                      £{form.estimatedTotal}.00
                    </p>
                  </div>
                </div>

                <div className="pt-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600 font-medium'}>
                      Base emergency dispatch ({form.selectedVehicle}):
                    </span>
                    <span className={`font-mono font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      £{(VEHICLE_OPTIONS.find((v) => v.name === form.selectedVehicle)?.baseRate || 90).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600 font-medium'}>
                      Mileage charge ({form.estimatedMiles} miles @ £
                      {(VEHICLE_OPTIONS.find((v) => v.name === form.selectedVehicle)?.perMile || 1.8).toFixed(2)}/mi):
                    </span>
                    <span className={`font-mono font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      £{(
                        form.estimatedMiles *
                        (VEHICLE_OPTIONS.find((v) => v.name === form.selectedVehicle)?.perMile || 1.8)
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600 font-medium'}>
                      Goods in Transit Insurance (£50,000 cover):
                    </span>
                    <span className="text-emerald-500 font-mono font-bold">INCLUDED FREE</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600 font-medium'}>
                      Live Corridor Tracking Share Link:
                    </span>
                    <span className="text-emerald-500 font-mono font-bold">INCLUDED FREE</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: PAYMENT (Step 6) */}
          {currentStep === 7 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center text-[#3898EC]">
                  <CreditCard className="w-4 h-4" />
                </div>
                <h2
                  className={`font-bold text-base sm:text-lg ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Payment & Account Terms
                </h2>
              </div>

              {/* Status Alert Banners */}
              {paymentCancelNotice && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="p-4 rounded-xl border bg-amber-500/10 border-amber-500/30 text-amber-300 text-xs flex items-start gap-3"
                >
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-amber-200">Checkout Cancelled</p>
                    <p className="leading-relaxed opacity-90">{paymentCancelNotice}</p>
                  </div>
                </div>
              )}

              {paymentError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="p-4 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-300 text-xs flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <p className="font-bold text-rose-200">Payment Error</p>
                    <p className="leading-relaxed opacity-90">{paymentError}</p>
                  </div>
                </div>
              )}

              {paymentPendingWarning && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="p-4 rounded-xl border bg-sky-500/10 border-sky-500/30 text-sky-200 text-xs flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-[#3898EC] shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-sky-100">Payment Confirmation In Progress</p>
                      <p className="leading-relaxed opacity-90">{paymentPendingWarning}</p>
                    </div>
                  </div>
                  {verifyingBookingRef && (
                    <button
                      type="button"
                      onClick={() => handleManualRecheckStatus(verifyingBookingRef)}
                      className="px-3 py-1.5 rounded-lg bg-[#3898EC] hover:bg-[#2b85d6] text-white text-[11px] font-bold shrink-0 self-center cursor-pointer"
                    >
                      Re-check Status
                    </button>
                  )}
                </div>
              )}

              {/* Payment Verification Active Spinner Card */}
              {isVerifyingPayment && (
                <div className="text-center py-10 px-4 space-y-4" role="status" aria-live="polite">
                  <div className="w-14 h-14 rounded-full bg-sky-500/10 border border-[#3898EC]/40 text-[#3898EC] flex items-center justify-center mx-auto">
                    <Loader2 className="w-7 h-7 animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <span className="font-mono text-xs uppercase tracking-widest text-[#3898EC] font-bold">
                      CARD PAYMENT VERIFICATION
                    </span>
                    <h3 className={`text-lg font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      Verifying Transaction with Stripe...
                    </h3>
                    <p className={`text-xs max-w-md mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Authoritative payment confirmation in progress for booking reference{' '}
                      <span className="font-mono font-bold text-[#3898EC]">{verifyingBookingRef}</span>. Dispatches are strictly gated until payment confirmation is verified by the server.
                    </p>
                  </div>
                </div>
              )}

              {/* Payment Method Selector */}
              <div className="space-y-3">
                <label
                  className={`block text-xs font-semibold ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-700'
                  }`}
                >
                  Payment Method (Step 6)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'card',
                      title: 'Credit / Debit Card',
                      subtitle: 'Stripe test checkout (Visa, MC, Amex, Apple/Google Pay)',
                      badge: 'Instant Dispatch',
                    },
                    {
                      id: 'standby-account',
                      title: 'Standby Facility',
                      subtitle: 'Approved 30-Day Terms (£15,000 credit limit)',
                      badge: '30-Day Terms',
                    },
                    {
                      id: 'corporate-bacs',
                      title: 'Corporate BACS',
                      subtitle: 'Electronic settlement on monthly statement issue',
                      badge: 'Direct Wire',
                    },
                  ].map((m) => (
                    <div
                      key={m.id}
                      onClick={() =>
                        updateForm((prev) => ({ ...prev, paymentMethod: m.id }))
                      }
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-180 hover-lift flex flex-col justify-between ${
                        form.paymentMethod === m.id
                          ? 'border-[#3898EC] bg-sky-500/10 shadow-xs ring-1 ring-[#3898EC]/30'
                          : isDarkMode
                          ? 'border-[#1a2636] bg-[#060b11]'
                          : 'border-slate-200 bg-white shadow-xs hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 rounded-full border border-[#3898EC] flex items-center justify-center">
                              {form.paymentMethod === m.id && (
                                <span className="w-2 h-2 rounded-full bg-[#3898EC]" />
                              )}
                            </span>
                            <span
                              className={`font-bold text-xs ${
                                isDarkMode ? 'text-white' : 'text-slate-900'
                              }`}
                            >
                              {m.title}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-500/10 text-[#3898EC] font-semibold border border-[#3898EC]/20">
                            {m.badge}
                          </span>
                        </div>
                        <p
                          className={`text-[11px] mt-1 pl-5 ${
                            isDarkMode ? 'text-slate-400' : 'text-slate-600 font-medium'
                          }`}
                        >
                          {m.subtitle}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stripe Hosted Checkout Callout when Card is selected */}
              {form.paymentMethod === 'card' && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    isDarkMode
                      ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                      : 'bg-sky-50 border-sky-200 text-sky-800'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5 shrink-0 text-[#3898EC] mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-sm">Official Stripe Hosted Checkout</p>
                    <p className="opacity-90">
                      Clicking &quot;Pay with Card &amp; Confirm&quot; will securely redirect you to Stripe Checkout to authorize £{form.estimatedTotal}.00. Your card details are processed directly by Stripe and never stored on NEO Transport servers.
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1 font-mono text-[11px] opacity-80">
                      <span>🔒 256-Bit TLS</span>
                      <span>⚡ Real-Time Webhook Verification</span>
                      <span>💳 Stripe Test Mode</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label
                  className={`block text-xs font-semibold mb-1.5 ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-700'
                  }`}
                >
                  Purchase Order / Reference Number (Step 6)
                </label>
                <input
                  type="text"
                  value={form.poReference || form.poNumber}
                  onChange={(e) =>
                    updateForm((prev) => ({
                      ...prev,
                      poReference: e.target.value,
                      poNumber: e.target.value,
                    }))
                  }
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${inputBg}`}
                  placeholder="e.g. PO-2026-8910"
                />
              </div>
            </div>
          )}

          {/* STEP 8: DONE */}
          {currentStep === 8 && (
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <span className="font-mono text-xs uppercase tracking-widest text-emerald-500 font-bold">
                  BOOKING CONFIRMED &amp; SCHEDULED
                </span>
                <h2
                  className={`text-2xl font-extrabold tracking-tight ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Ready for Dispatch Allocation
                </h2>
              </div>

              {/* Display exact generated reference */}
              <div
                className={`inline-flex flex-col sm:flex-row items-center gap-2 px-6 py-3 rounded-2xl border ${
                  isDarkMode
                    ? 'bg-[#060b11] border-emerald-500/40 shadow-inner'
                    : 'bg-emerald-50/60 border-emerald-300 shadow-xs'
                }`}
              >
                <span
                  className={`text-xs font-mono font-medium ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  BOOKING REFERENCE:
                </span>
                <span className="font-mono text-emerald-500 font-extrabold text-xl tracking-wider">
                  {confirmedBooking?.reference || 'NT-24818'}
                </span>
              </div>

              {/* Payment Verification Status Badge */}
              {(confirmedBooking?.payment_method === 'card' || form.paymentMethod === 'card') && (
                <div
                  className={`inline-flex flex-col sm:flex-row items-center gap-2 px-5 py-2 rounded-xl border ${
                    confirmedBooking?.payment_status === 'paid'
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {confirmedBooking?.payment_status === 'paid'
                        ? `✓ Stripe Payment Verified (£${(confirmedBooking.amount_paid_gbp || confirmedBooking.total || form.estimatedTotal).toFixed(2)})`
                        : 'Payment Processing via Stripe'}
                    </span>
                  </div>
                  {confirmedBooking?.stripe_payment_intent_id && (
                    <span className="font-mono text-[11px] text-slate-400">
                      ID: {confirmedBooking.stripe_payment_intent_id}
                    </span>
                  )}
                </div>
              )}

              {form.paymentMethod === 'standby-account' && (
                <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl border bg-sky-500/10 border-[#3898EC]/30 text-[#3898EC] text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Approved Standby Credit Facility (30-Day Terms)</span>
                </div>
              )}

              {form.paymentMethod === 'corporate-bacs' && (
                <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl border bg-sky-500/10 border-[#3898EC]/30 text-[#3898EC] text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Direct Corporate BACS Terms</span>
                </div>
              )}

              <p
                className={`text-xs max-w-md mx-auto leading-relaxed ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-600 font-medium'
                }`}
              >
                Your booking is registered in the standby corridor. Vehicle class ({form.selectedVehicle}) is scheduled for collection at {form.pickupPostcode}. Driver allocation and real-time corridor dispatch tracking will be activated upon dispatch.
              </p>

              {/* Action buttons on Step 7 (Done): "Track live shipment" & "Create another booking" */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onViewTracking(confirmedBooking?.id || confirmedBooking?.reference)}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-full text-xs font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Track live shipment</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleCreateAnother}
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                    isDarkMode
                      ? 'border-[#1e222b] hover:bg-[#161a22] text-slate-300'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-advertz'
                  }`}
                >
                  <span>Create another booking</span>
                </button>
              </div>
            </div>
          )}

          {/* Form Navigation Buttons (Steps 1-7) */}
          {currentStep < 8 && (
            <div
              className={`flex items-center justify-between pt-5 mt-5 border-t ${
                isDarkMode ? 'border-[#1e222b]' : 'border-slate-200/80'
              }`}
            >
              <button
                onClick={handlePrevStep}
                disabled={currentStep === 1}
                className={`px-5 py-2.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-2 cursor-pointer ${
                  currentStep === 1
                    ? 'opacity-40 cursor-not-allowed border-slate-200 text-slate-400 bg-slate-50'
                    : isDarkMode
                    ? 'border-[#1e222b] hover:bg-[#161a22] text-slate-300'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-advertz'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleNextStep}
                disabled={isSubmittingCardPayment || isVerifyingPayment}
                aria-busy={isSubmittingCardPayment || isVerifyingPayment}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-full text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                {isSubmittingCardPayment ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting to Stripe...</span>
                  </>
                ) : currentStep === 7 && form.paymentMethod === 'card' ? (
                  <>
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pay £{form.estimatedTotal}.00 with Card</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>{currentStep === 7 ? 'Confirm booking' : 'Continue'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right Live Booking Summary Sidebar */}
        <div className={`p-6 rounded-2xl border ${cardBg}`}>
          <div className="flex items-center justify-between mb-5">
            <span className="font-mono text-xs uppercase tracking-wider text-[#3898EC] font-bold">
              BOOKING SUMMARY
            </span>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-start">
              <span className={isDarkMode ? 'text-slate-400 font-medium' : 'text-slate-600 font-medium'}>
                From
              </span>
              <span
                className={`font-semibold text-right max-w-[180px] ${
                  isDarkMode ? 'text-slate-200' : 'text-slate-900 font-bold'
                }`}
              >
                {form.pickupPostcode}
              </span>
            </div>

            <div className="flex justify-between items-start">
              <span className={isDarkMode ? 'text-slate-400 font-medium' : 'text-slate-600 font-medium'}>
                To
              </span>
              <span
                className={`font-semibold text-right max-w-[180px] ${
                  isDarkMode ? 'text-slate-200' : 'text-slate-900 font-bold'
                }`}
              >
                {form.dropoffPostcode}
              </span>
            </div>

            <div className="flex justify-between items-start">
              <span className={isDarkMode ? 'text-slate-400 font-medium' : 'text-slate-600 font-medium'}>
                Cargo
              </span>
              <span
                className={`font-semibold text-right ${
                  isDarkMode ? 'text-slate-200' : 'text-slate-900'
                }`}
              >
                {form.cargoDescription}
              </span>
            </div>

            <div className="flex justify-between items-start">
              <span className={isDarkMode ? 'text-slate-400 font-medium' : 'text-slate-600 font-medium'}>
                Vehicle
              </span>
              <span
                className={`font-semibold text-right ${
                  isDarkMode ? 'text-slate-200' : 'text-slate-900 font-semibold'
                }`}
              >
                {form.selectedVehicle}
              </span>
            </div>

            <div className="flex justify-between items-start">
              <span className={isDarkMode ? 'text-slate-400 font-medium' : 'text-slate-600 font-medium'}>
                Service
              </span>
              <span
                className={`font-semibold text-right ${
                  isDarkMode ? 'text-slate-200' : 'text-slate-900 font-semibold'
                }`}
              >
                {form.selectedService}
              </span>
            </div>

            <div
              className={`pt-6 border-t ${
                isDarkMode ? 'border-slate-700/40' : 'border-slate-100'
              }`}
            >
              <div className="flex justify-between items-baseline">
                <span
                  className={`text-xs font-semibold ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Estimated total
                </span>
                <span
                  className={`text-3xl font-extrabold font-mono ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  £{form.estimatedTotal}
                </span>
              </div>
              <p
                className={`text-[11px] mt-1 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500 font-medium'
                }`}
              >
                Includes standby account pricing
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const NewBookingView = BookingWizard;

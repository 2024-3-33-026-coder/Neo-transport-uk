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
} from 'lucide-react';
import { BookingWizardState, Booking } from '../../types';
import { VEHICLE_OPTIONS } from '../../data/mockData';
import { parseShipmentWithGemini } from '../../lib/geminiClient';
import { getNextBookingReference, persistWizardDraft } from '../../lib/portalStore';
import { calculateUkRoadDistance } from '../../lib/routing';

interface NewBookingViewProps {
  isDarkMode: boolean;
  onBookingCreated: (newBooking: Booking, wizardState?: BookingWizardState) => void;
  onViewTracking: (bookingId?: string) => void;
  initialWizardState?: Partial<BookingWizardState>;
  onUpdateState?: (state: BookingWizardState) => void;
  existingBookings?: Booking[];
  onResetWizard?: () => void;
}

export const BookingWizard: React.FC<NewBookingViewProps> = ({
  isDarkMode,
  onBookingCreated,
  onViewTracking,
  initialWizardState,
  existingBookings = [],
  onResetWizard,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isAiParsing, setIsAiParsing] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiNote, setAiNote] = useState<string | null>(null);

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

  const cardBg = isDarkMode ? 'bg-[#0b121c] border-[#172334]' : 'bg-white border-slate-200';
  const inputBg = isDarkMode
    ? 'bg-[#060b11] border-[#1a2636] text-white focus:border-[#3898EC]'
    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#3898EC]';

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

  const handleNextStep = () => {
    if (currentStep < 7) {
      setCurrentStep(currentStep + 1);
    } else if (currentStep === 7) {
      // Step 7 (Payment) -> Click "Confirm booking" -> Generate sequential reference, persist & advance to Step 8 (Done)
      const newRef = getNextBookingReference(existingBookings);
      const newBooking: Booking = {
        id: `b-${Date.now()}`,
        reference: newRef,
        date: 'Today',
        origin: form.pickupPostcode,
        destination: form.dropoffPostcode,
        vehicle: form.selectedVehicle,
        total: form.estimatedTotal,
        status: 'IN TRANSIT',
        cargo: form.cargoDescription,
        weightKg: form.cargoWeightKg,
        palletCount: form.palletCount,
        pickupTime: 'Now',
        deliveryTime: 'Direct transit (approx 88 min)',
        driver: {
          name: 'Marek Kowalski',
          vehicleModel: form.selectedVehicle,
          registration: 'GN71 XPO',
          phone: '07700 900821',
          status: 'ASSIGNED & EN ROUTE',
        },
      };
      setConfirmedBooking(newBooking);
      onBookingCreated(newBooking, form);
      setCurrentStep(8);
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
        <div className="flex items-center gap-2 mb-1">
          <span className="w-4 h-0.5 bg-[#3898EC]" />
          <span className="font-mono text-xs uppercase tracking-widest text-[#3898EC] font-semibold">
            NEW BOOKING
          </span>
        </div>
        <h1
          className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}
        >
          Create a booking
        </h1>
        <p className="text-sm text-slate-400 mt-1">
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
              className={`px-3.5 py-1.5 rounded-full font-mono text-xs transition-all shrink-0 flex items-center gap-1.5 ${
                isActive
                  ? 'bg-sky-500/10 text-[#3898EC] border border-[#3898EC] font-semibold shadow-xs'
                  : isDone
                  ? isDarkMode
                    ? 'bg-[#0b121c] text-emerald-400 border border-emerald-800/40'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : isDarkMode
                  ? 'bg-[#090e17] text-slate-500 border border-slate-800 hover:text-slate-300'
                  : 'bg-slate-100 text-slate-500 border border-slate-200 hover:text-slate-800'
              }`}
            >
              {isDone && <CheckCircle className="w-3 h-3 text-emerald-500" />}
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Gemini AI Smart Assistant Bar */}
      <div
        className={`p-4 rounded-2xl border transition-all ${
          isDarkMode ? 'bg-[#09111c] border-[#1e2f46]' : 'bg-sky-50/70 border-sky-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#3898EC]/20 flex items-center justify-center text-[#3898EC]">
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
              <p className="text-[11px] text-slate-400">
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
              className={`text-xs px-3 py-1.5 rounded-xl border w-full sm:w-72 ${inputBg}`}
            />
            <button
              onClick={handleAiAutoFill}
              disabled={isAiParsing}
              className="bg-[#3898EC] hover:bg-[#2b85d6] text-white px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all disabled:opacity-50"
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
          <div className="mt-2.5 pt-2.5 border-t border-sky-500/20 text-xs text-[#3898EC] flex items-center gap-2 font-mono">
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
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Pickup postcode / address
                  </label>
                  <input
                    type="text"
                    value={form.pickupPostcode}
                    onChange={(e) =>
                      updateForm((prev) => ({ ...prev, pickupPostcode: e.target.value }))
                    }
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${inputBg}`}
                    placeholder="e.g. Manchester M17 1AB"
                  />
                </div>

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
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Drop-off postcode / delivery address
                  </label>
                  <input
                    type="text"
                    value={form.dropoffPostcode}
                    onChange={(e) =>
                      updateForm((prev) => ({ ...prev, dropoffPostcode: e.target.value }))
                    }
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium ${inputBg}`}
                    placeholder="e.g. Birmingham B6 7EU"
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
                  <label htmlFor="hazmat" className="text-xs text-slate-300">
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
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-[#3898EC] bg-sky-500/10 shadow-xs'
                          : isDarkMode
                          ? 'border-[#1a2636] hover:border-slate-600 bg-[#060b11]'
                          : 'border-slate-200 hover:border-slate-400 bg-slate-50'
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
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                            {v.capacity}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {v.pallets} · {v.dimensions}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-base text-[#3898EC]">
                          £{Math.round(v.baseRate + v.perMile * form.estimatedMiles)}
                        </span>
                        <p className="font-mono text-[10px] text-slate-400">
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
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      form.selectedService === tier.name
                        ? 'border-[#3898EC] bg-sky-500/10'
                        : isDarkMode
                        ? 'border-[#1a2636] bg-[#060b11]'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <span className="font-mono text-[10px] text-[#3898EC] font-semibold tracking-wider">
                      {tier.tag}
                    </span>
                    <h3 className="font-bold text-sm mt-1 text-white">
                      {tier.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
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
                  isDarkMode ? 'bg-[#060b11] border-[#1e2c40]' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex justify-between items-center pb-4 border-b border-slate-700/40">
                  <div>
                    <span className="font-mono text-xs uppercase text-slate-400">
                      Standard Commercial Tariff
                    </span>
                    <p className="text-sm line-through text-slate-500">£420.00</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xs text-emerald-400 font-semibold uppercase">
                      Standby Account Rate (15% Off)
                    </span>
                    <p className="text-2xl font-extrabold text-[#3898EC]">
                      £{form.estimatedTotal}.00
                    </p>
                  </div>
                </div>

                <div className="pt-4 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Base emergency dispatch ({form.selectedVehicle}):</span>
                    <span className="text-white font-mono">
                      £{(VEHICLE_OPTIONS.find((v) => v.name === form.selectedVehicle)?.baseRate || 90).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>
                      Mileage charge ({form.estimatedMiles} miles @ £
                      {(VEHICLE_OPTIONS.find((v) => v.name === form.selectedVehicle)?.perMile || 1.8).toFixed(2)}/mi):
                    </span>
                    <span className="text-white font-mono">
                      £{(
                        form.estimatedMiles *
                        (VEHICLE_OPTIONS.find((v) => v.name === form.selectedVehicle)?.perMile || 1.8)
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Goods in Transit Insurance (£50,000 cover):</span>
                    <span className="text-emerald-400 font-mono">INCLUDED FREE</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Live GPS Client Share Link:</span>
                    <span className="text-emerald-400 font-mono">INCLUDED FREE</span>
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

              {/* Payment Method Selector */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-400">
                  Payment Method (Step 6)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      id: 'standby-account',
                      title: 'Standby Credit Facility',
                      subtitle: 'Approved 30-Day Terms (£15,000 credit limit)',
                    },
                    {
                      id: 'corporate-bacs',
                      title: 'Direct Corporate BACS',
                      subtitle: 'Electronic settlement on statement issue',
                    },
                  ].map((m) => (
                    <div
                      key={m.id}
                      onClick={() =>
                        updateForm((prev) => ({ ...prev, paymentMethod: m.id }))
                      }
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        form.paymentMethod === m.id
                          ? 'border-[#3898EC] bg-sky-500/10'
                          : isDarkMode
                          ? 'border-[#1a2636] bg-[#060b11]'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full border border-[#3898EC] flex items-center justify-center">
                          {form.paymentMethod === m.id && (
                            <span className="w-2 h-2 rounded-full bg-[#3898EC]" />
                          )}
                        </span>
                        <span className="font-bold text-xs text-white">
                          {m.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 pl-5">
                        {m.subtitle}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
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
                <span className="font-mono text-xs uppercase tracking-widest text-emerald-400 font-bold">
                  STANDBY DISPATCH CONFIRMED
                </span>
                <h2
                  className={`text-2xl font-extrabold tracking-tight ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Ready for Instant Dispatch!
                </h2>
              </div>

              {/* Display exact generated reference */}
              <div className="inline-flex flex-col sm:flex-row items-center gap-2 px-6 py-3 rounded-2xl bg-[#060b11] border border-emerald-500/40 shadow-inner">
                <span className="text-slate-400 text-xs font-mono">BOOKING REFERENCE:</span>
                <span className="font-mono text-emerald-400 font-extrabold text-xl tracking-wider">
                  {confirmedBooking?.reference || 'NT-24818'}
                </span>
              </div>

              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Driver Marek Kowalski ({form.selectedVehicle} · GN71 XPO) is en route to {form.pickupPostcode}. Real-time GPS corridor telemetry is active.
              </p>

              {/* Action buttons on Step 7 (Done): "Track live shipment" & "Create another booking" */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onViewTracking(confirmedBooking?.id || confirmedBooking?.reference)}
                  className="w-full sm:w-auto bg-[#3898EC] hover:bg-[#2b85d6] text-white px-7 py-3 rounded-full text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Track live shipment</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={handleCreateAnother}
                  className={`w-full sm:w-auto px-6 py-3 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                    isDarkMode
                      ? 'border-slate-700 hover:bg-slate-800 text-slate-300'
                      : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span>Create another booking</span>
                </button>
              </div>
            </div>
          )}

          {/* Form Navigation Buttons (Steps 1-7) */}
          {currentStep < 8 && (
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-800/40">
              <button
                onClick={handlePrevStep}
                disabled={currentStep === 1}
                className={`px-5 py-2.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-2 ${
                  currentStep === 1
                    ? 'opacity-40 cursor-not-allowed'
                    : isDarkMode
                    ? 'border-slate-700 hover:bg-slate-800 text-slate-300'
                    : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                onClick={handleNextStep}
                className="bg-[#3898EC] hover:bg-[#2b85d6] text-white px-6 py-2.5 rounded-full text-xs font-bold shadow-md transition-all flex items-center gap-2 group cursor-pointer"
              >
                <span>{currentStep === 7 ? 'Confirm booking' : 'Continue'}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
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
              <span className="text-slate-400 font-medium">From</span>
              <span
                className={`font-semibold text-right max-w-[180px] ${
                  isDarkMode ? 'text-slate-200' : 'text-slate-800'
                }`}
              >
                {form.pickupPostcode}
              </span>
            </div>

            <div className="flex justify-between items-start">
              <span className="text-slate-400 font-medium">To</span>
              <span
                className={`font-semibold text-right max-w-[180px] ${
                  isDarkMode ? 'text-slate-200' : 'text-slate-800'
                }`}
              >
                {form.dropoffPostcode}
              </span>
            </div>

            <div className="flex justify-between items-start">
              <span className="text-slate-400 font-medium">Cargo</span>
              <span
                className={`font-semibold text-right ${
                  isDarkMode ? 'text-slate-200' : 'text-slate-800'
                }`}
              >
                {form.cargoDescription}
              </span>
            </div>

            <div className="flex justify-between items-start">
              <span className="text-slate-400 font-medium">Vehicle</span>
              <span
                className={`font-semibold text-right ${
                  isDarkMode ? 'text-slate-200' : 'text-slate-800'
                }`}
              >
                {form.selectedVehicle}
              </span>
            </div>

            <div className="flex justify-between items-start">
              <span className="text-slate-400 font-medium">Service</span>
              <span
                className={`font-semibold text-right ${
                  isDarkMode ? 'text-slate-200' : 'text-slate-800'
                }`}
              >
                {form.selectedService}
              </span>
            </div>

            <div className="pt-6 border-t border-slate-700/40">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-400 font-medium">
                  Estimated total
                </span>
                <span className="text-3xl font-extrabold text-white">
                  £{form.estimatedTotal}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
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

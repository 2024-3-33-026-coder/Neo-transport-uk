import React, { useState } from 'react';
import {
  CheckCircle2,
  Truck,
  Zap,
  CreditCard,
  FileText,
  MapPin,
  Download,
  Headphones,
  ArrowRight,
  Sparkles,
  Plus,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import {
  BRAND_CONFIG,
  GEMINI_LOGISTICS_PULSE_DEFAULT,
  PORTAL_KPIS,
  PORTAL_QUICK_ACTIONS,
  PORTAL_TODAYS_JOBS,
  WORKFLOW_STEPS,
} from '../data/siteContent';
import { ScrollReveal } from './MotionPrimitives';
import { NeoBrandMark } from './Navbar';

export const PortalPreviewSection: React.FC = () => {
  const [selectedJobId, setSelectedJobId] = useState<string>('NT-25102');
  const [showPlanner, setShowPlanner] = useState<boolean>(false);
  const [scenarioInput, setScenarioInput] = useState<string>(
    'Regular pallet carrier missed a 16:00 pickup in Manchester. 6 standard pallets weighing 950kg need to reach Birmingham before 21:00. No forklift at the delivery site.'
  );
  const [plannerLoading, setPlannerLoading] = useState<boolean>(false);
  const [plannerResult, setPlannerResult] = useState<string | null>(null);

  const selectedJob =
    PORTAL_TODAYS_JOBS.find((j) => j.id === selectedJobId) || PORTAL_TODAYS_JOBS[0];

  const handleRunLogisticsPulse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scenarioInput.trim()) return;
    setPlannerLoading(true);
    try {
      const response = await fetch('/api/logistics-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: 'Manchester Hub',
          destination: 'Birmingham',
          scenario: scenarioInput.trim(),
        }),
      });
      const data = await response.json();
      setPlannerResult(data.plan || GEMINI_LOGISTICS_PULSE_DEFAULT);
    } catch {
      setPlannerResult(
        'Route: Manchester to Birmingham.\n1. Vehicle: Luton box van with 500kg tail-lift, unit NT-25012, up to 6 pallets and 1,000kg.\n2. Timing: Collection within 42 minutes. Direct drive takes 109 minutes.\n3. Booking: Book in the Customer Portal or call 0800 246 8135.'
      );
    } finally {
      setPlannerLoading(false);
    }
  };

  const renderKpiIcon = (iconName: string) => {
    switch (iconName) {
      case 'truck':
        return <Truck className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />;
      case 'zap':
        return <Zap className="h-4 w-4 text-[#D97706]" aria-hidden="true" />;
      case 'credit-card':
        return <CreditCard className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />;
      default:
        return <FileText className="h-4 w-4 text-[#D97706]" aria-hidden="true" />;
    }
  };

  const renderQuickActionIcon = (iconName: string) => {
    switch (iconName) {
      case 'zap':
        return <Zap className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />;
      case 'map-pin':
        return <MapPin className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />;
      case 'download':
        return <Download className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />;
      case 'credit-card':
        return <CreditCard className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />;
      default:
        return <Headphones className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />;
    }
  };

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="py-20 sm:py-28 bg-[#FAFAFA] border-b border-[#E5E7EB] scroll-mt-16"
    >
      <div className="mx-auto max-w-[1160px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <ScrollReveal className="max-w-3xl mb-12 lg:mb-14">
          <div className="inline-flex items-center gap-2 mb-3.5">
            <span className="h-1.5 w-1.5 rounded-[2px] bg-[#2563EB]" aria-hidden="true" />
            <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
              HOW IT WORKS
            </span>
          </div>
          <h2 id="how-it-works-heading" className="section-h2 text-[#111827] mb-3">
            Book, track, and get proof of delivery in one place
          </h2>
          <p className="text-[16px] leading-[1.65] text-[#4B5563]">
            Book a single same-day van or schedule a multi-vehicle run in the NEO Transport
            Customer Portal. You see live vehicle positions and signed delivery receipts for every
            job.
          </p>
        </ScrollReveal>

        {/* 3-Step Operational Flow */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-14">
          {WORKFLOW_STEPS.map((step, idx) => (
            <ScrollReveal key={step.stepNumber} delayMs={idx * 75} className="h-full">
              <div className="neo-card rounded-2xl p-7 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-5">
                    <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.1em] text-[#2563EB]">
                      {step.code}
                    </span>
                    <span className="font-mono-tech text-[28px] font-bold leading-none text-[#E5E7EB] select-none">
                      {step.stepNumber}
                    </span>
                  </div>

                  <h3 className="card-h3 text-[#111827] mb-2.5">
                    {step.stepNumber}. {step.title}
                  </h3>

                  <p className="text-[14.5px] leading-[1.65] text-[#4B5563] mb-5">
                    {step.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-between">
                  <span className="font-mono-tech text-[11px] font-medium text-[#059669]">
                    {step.slaNote}
                  </span>
                  <a
                    href={BRAND_CONFIG.portalUrl}
                    className="font-mono-tech text-[11px] font-semibold text-[#111827] hover:text-[#2563EB]"
                  >
                    Open portal
                  </a>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Light Minimalist Customer Portal Preview Window */}
        <ScrollReveal delayMs={150}>
          <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_24px_60px_-24px_rgba(17,24,39,0.09)] overflow-hidden">
            {/* Portal Window Top Chrome */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E5E7EB]">
              <div className="flex items-center gap-3">
                <NeoBrandMark className="h-5 w-7" />
                <span className="text-[13.5px] font-extrabold tracking-tight text-[#111827]">
                  {BRAND_CONFIG.companyName}
                </span>
                <span className="h-4 w-[1px] bg-[#E5E7EB]" aria-hidden="true" />
                <span className="font-mono-tech text-[10.5px] uppercase tracking-[0.14em] text-[#6B7280]">
                  CUSTOMER PORTAL
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-2 px-2.5 py-1">
                  <span className="h-2 w-2 rounded-full bg-[#10B981] telemetry-dot" aria-hidden="true" />
                  <span className="font-mono-tech text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#059669]">
                    STANDBY ACTIVE
                  </span>
                </div>

                <a
                  href={BRAND_CONFIG.portalBookingUrl}
                  className="btn-primary-black inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Book a delivery</span>
                </a>

                <a
                  href={BRAND_CONFIG.portalLoginUrl}
                  className="btn-secondary-light inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] font-medium"
                >
                  <span>Customer login</span>
                  <ExternalLink className="h-3 w-3 text-[#2563EB]" aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Portal Main Interior */}
            <div className="p-5 sm:p-8 bg-white">
              {/* Overview Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2563EB] mb-1">
                    OVERVIEW
                  </div>
                  <h3 className="text-[24px] sm:text-[28px] font-bold text-[#111827] tracking-[-0.02em]">
                    Operations control room
                  </h3>
                  <p className="text-[13.5px] text-[#4B5563]">
                    Your account is active and live GPS tracking is online 24/7.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <a
                    href={BRAND_CONFIG.dispatchPhoneHref}
                    className="btn-secondary-light inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[12.5px] font-semibold"
                  >
                    <Headphones className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                    <span>24/7 dispatch: {BRAND_CONFIG.dispatchPhoneDisplay}</span>
                  </a>
                </div>
              </div>

              {/* Standby Account Active Banner */}
              <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4 sm:px-6 sm:py-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-[#059669]" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-[15px] font-bold text-[#111827]">
                      Standby account active
                    </div>
                    <div className="text-[12.5px] text-[#4B5563]">
                      £0 monthly fee, priority dispatch, and dedicated vehicle access
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="font-mono-tech text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[#059669]">
                    VERIFIED
                  </span>
                  <a
                    href={BRAND_CONFIG.portalInvoicesUrl}
                    className="btn-secondary-light rounded-lg px-3.5 py-1.5 text-[12px] font-medium"
                  >
                    Statements
                  </a>
                </div>
              </div>

              {/* 4 KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {PORTAL_KPIS.map((kpi) => (
                  <div
                    key={kpi.id}
                    className="rounded-xl border border-[#E5E7EB] bg-white p-5"
                  >
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] bg-[#FAFAFA]">
                        {renderKpiIcon(kpi.iconName)}
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 font-mono-tech text-[10px] font-semibold uppercase tracking-[0.08em] ${
                          kpi.badgeTone === 'amber' ? 'text-[#D97706]' : 'text-[#2563EB]'
                        }`}
                      >
                        {kpi.id === 'active-shipments' && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB] telemetry-dot" aria-hidden="true" />
                        )}
                        {kpi.badgeText}
                      </span>
                    </div>

                    <div className="text-[28px] font-bold text-[#111827] leading-none mb-1.5 font-mono-tech">
                      {kpi.value}
                    </div>
                    <div className="text-[12.5px] text-[#6B7280]">{kpi.label}</div>
                  </div>
                ))}
              </div>

              {/* Bottom 2-Column Split: Today's Jobs (7 cols) & Quick Actions + Route Checker (5 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Today's Jobs Module */}
                <div className="lg:col-span-7 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-5 sm:p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <h4 className="text-[16px] font-bold text-[#111827]">Today&apos;s jobs</h4>
                        <span className="inline-flex items-center gap-1.5 font-mono-tech text-[10px] font-semibold uppercase tracking-[0.08em] text-[#059669]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] telemetry-dot" aria-hidden="true" />
                          LIVE GPS
                        </span>
                      </div>
                      <a
                        href={BRAND_CONFIG.portalTrackingUrl}
                        className="text-[12.5px] font-medium text-[#2563EB] hover:underline"
                      >
                        View all
                      </a>
                    </div>

                    <div className="divide-y divide-[#E5E7EB]">
                      {PORTAL_TODAYS_JOBS.map((job) => {
                        const isSelected = job.id === selectedJobId;
                        const progressPercent = job.status === 'IN_TRANSIT' ? 68 : 22;
                        return (
                          <button
                            key={job.id}
                            type="button"
                            onClick={() => setSelectedJobId(job.id)}
                            className={`w-full py-3.5 px-3 -mx-3 rounded-lg flex flex-col gap-2.5 text-left transition-colors cursor-pointer ${
                              isSelected ? 'bg-white shadow-xs' : 'hover:bg-white/70'
                            }`}
                          >
                            <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <div className="text-[14px] font-semibold text-[#111827]">
                                  {job.route}
                                </div>
                                <div className="font-mono-tech text-[11px] uppercase tracking-[0.06em] text-[#6B7280] mt-0.5">
                                  {job.vehicleCode} • {job.vehicleType}
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5">
                                <span className="font-mono-tech text-[11.5px] text-[#4B5563]">
                                  {job.transitNote}
                                </span>
                                {job.status === 'IN_TRANSIT' ? (
                                  <span className="inline-flex items-center gap-1.5 font-mono-tech text-[10px] font-semibold uppercase tracking-[0.08em] px-2 py-0.5 rounded bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB]">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB] telemetry-dot" aria-hidden="true" />
                                    IN TRANSIT
                                  </span>
                                ) : (
                                  <span className="font-mono-tech text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 rounded bg-white border border-[#E5E7EB] text-[#6B7280]">
                                    SCHEDULED
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Route Progress Bar with Shimmer Animation */}
                            <div className="w-full">
                              <div className="h-1.5 w-full rounded-full bg-[#E5E7EB] overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    job.status === 'IN_TRANSIT'
                                      ? 'portal-shimmer-bar'
                                      : 'bg-[#9CA3AF]'
                                  }`}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Job Live Status Strip */}
                  <div className="mt-5 pt-4 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2 text-[12px]">
                    <div className="font-mono-tech text-[#4B5563]">
                      Selected job:{' '}
                      <span className="text-[#2563EB] font-semibold">{selectedJob.vehicleCode}</span>,{' '}
                      {selectedJob.vehicleType}, {selectedJob.transitNote}
                    </div>
                    <a
                      href={BRAND_CONFIG.portalTrackingUrl}
                      className="font-mono-tech text-[11px] font-semibold text-[#059669] hover:underline"
                    >
                      Open live GPS map
                    </a>
                  </div>
                </div>

                {/* Quick Actions + Dispatch Route Checker Module */}
                <div className="lg:col-span-5 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-5 sm:p-6 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[16px] font-bold text-[#111827] mb-4">Quick actions</h4>

                    <div className="space-y-2.5 mb-6">
                      {PORTAL_QUICK_ACTIONS.map((action) => (
                        <a
                          key={action.id}
                          href={action.href}
                          className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 text-[13px] font-semibold text-[#111827] transition-all hover:border-[#D1D5DB] hover:shadow-xs group"
                        >
                          <span className="flex items-center gap-3">
                            {renderQuickActionIcon(action.iconName)}
                            <span>{action.label}</span>
                          </span>
                          <ArrowRight
                            className="h-3.5 w-3.5 text-[#6B7280] transition-transform duration-150 group-hover:translate-x-1 group-hover:text-[#111827]"
                            aria-hidden="true"
                          />
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* Live Fleet Status & Route Planner */}
                  <div className="pt-4 border-t border-[#E5E7EB]">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 font-mono-tech text-[11px] font-semibold uppercase tracking-[0.1em] text-[#2563EB]">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>LIVE FLEET STATUS</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowPlanner(!showPlanner)}
                        className="font-mono-tech text-[10.5px] text-[#4B5563] hover:text-[#111827] underline cursor-pointer"
                      >
                        {showPlanner ? 'Close route planner' : 'Check route and vehicle'}
                      </button>
                    </div>

                    <p className="text-[12.5px] leading-relaxed text-[#4B5563]">
                      {GEMINI_LOGISTICS_PULSE_DEFAULT}
                    </p>

                    {showPlanner && (
                      <form onSubmit={handleRunLogisticsPulse} className="mt-3 space-y-2.5">
                        <label
                          htmlFor="gemini-pulse-input"
                          className="block font-mono-tech text-[10px] uppercase tracking-[0.08em] text-[#4B5563]"
                        >
                          Enter pickup, drop-off, pallet count, and deadline
                        </label>
                        <textarea
                          id="gemini-pulse-input"
                          rows={3}
                          value={scenarioInput}
                          onChange={(e) => setScenarioInput(e.target.value)}
                          className="w-full rounded-lg p-2.5 text-[12px] text-[#111827] bg-white border border-[#E5E7EB]"
                        />
                        <button
                          type="submit"
                          disabled={plannerLoading}
                          className="btn-primary-black inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg px-3 text-[12px] font-semibold cursor-pointer disabled:opacity-60"
                        >
                          {plannerLoading ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              <span>Checking vehicle and timing...</span>
                            </>
                          ) : (
                            <span>Get dispatch plan</span>
                          )}
                        </button>

                        {plannerResult && (
                          <div className="rounded-lg p-3 font-mono-tech text-[11px] whitespace-pre-line text-[#111827] leading-relaxed bg-white border border-[#BFDBFE]">
                            {plannerResult}
                          </div>
                        )}
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

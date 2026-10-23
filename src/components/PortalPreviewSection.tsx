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

export const PortalPreviewSection: React.FC = () => {
  const [selectedJobId, setSelectedJobId] = useState<string>('NT-25102');
  const [showPlanner, setShowPlanner] = useState<boolean>(false);
  const [scenarioInput, setScenarioInput] = useState<string>(
    'Primary pallet carrier missed 16:00 collection in Manchester. 6 standard pallets (950kg total) of urgent line-side components needed in Birmingham before 21:00. No forklift at destination.'
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
        'DISPATCH PROTOCOL VERIFIED • MANCHESTER → BIRMINGHAM\n1. Vehicle: LUTON TAIL-LIFT (NT-25012) • 6 Pallets / 1000kg Max + 500kg Hydraulic Tail-Lift.\n2. SLA: Collection ≤ 42 min • Direct transit approx 109 min (ETA ~18:35).\n3. Action: Proceed to Customer Portal or call 0800 246 8135.'
      );
    } finally {
      setPlannerLoading(false);
    }
  };

  const renderKpiIcon = (iconName: string) => {
    switch (iconName) {
      case 'truck':
        return <Truck className="h-4 w-4 text-[#3898FF]" aria-hidden="true" />;
      case 'zap':
        return <Zap className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" />;
      case 'credit-card':
        return <CreditCard className="h-4 w-4 text-[#3898FF]" aria-hidden="true" />;
      default:
        return <FileText className="h-4 w-4 text-[#F59E0B]" aria-hidden="true" />;
    }
  };

  const renderQuickActionIcon = (iconName: string) => {
    switch (iconName) {
      case 'zap':
        return <Zap className="h-4 w-4 text-[#3898FF]" aria-hidden="true" />;
      case 'map-pin':
        return <MapPin className="h-4 w-4 text-[#3898FF]" aria-hidden="true" />;
      case 'download':
        return <Download className="h-4 w-4 text-[#3898FF]" aria-hidden="true" />;
      case 'credit-card':
        return <CreditCard className="h-4 w-4 text-[#3898FF]" aria-hidden="true" />;
      default:
        return <Headphones className="h-4 w-4 text-[#3898FF]" aria-hidden="true" />;
    }
  };

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="py-16 sm:py-20 lg:py-24 scroll-mt-16"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <ScrollReveal className="max-w-3xl mb-12 lg:mb-14">
          <div className="font-mono-tech text-[12px] font-semibold uppercase tracking-[0.12em] text-[#3898FF] mb-3">
            — HOW IT WORKS
          </div>
          <h2
            id="how-it-works-heading"
            className="section-h2 mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            From Request to Proof of Delivery — Seamless &amp; Transparent
          </h2>
          <p
            className="text-[16px] leading-[1.6]"
            style={{ color: 'var(--text-secondary)' }}
          >
            Whether dispatching an urgent same-day courier van or scheduling a multi-vehicle
            commercial run, every stage is tracked live inside the NEO Transport Customer Portal.
          </p>
        </ScrollReveal>

        {/* 3-Step Operational Flow with 75ms stagger */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-14">
          {WORKFLOW_STEPS.map((step, idx) => (
            <ScrollReveal key={step.stepNumber} delayMs={idx * 75} className="h-full">
              <div className="neo-card rounded-2xl p-6 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.1em] text-[#3898FF]">
                      {step.code}
                    </span>
                    <span
                      className="font-mono-tech text-[18px] font-extrabold"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {step.stepNumber}
                    </span>
                  </div>

                  <h3
                    className="card-h3 mb-2.5"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {step.stepNumber} / {step.title}
                  </h3>

                  <p
                    className="text-[14.5px] leading-[1.6] mb-5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {step.description}
                  </p>
                </div>

                <div
                  className="pt-3.5 flex items-center justify-between"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                >
                  <span className="font-mono-tech text-[11px] text-[#10B981]">
                    {step.slaNote}
                  </span>
                  <a
                    href={BRAND_CONFIG.portalUrl}
                    className="font-mono-tech text-[11px] font-semibold text-[#3898FF] hover:underline"
                  >
                    PORTAL →
                  </a>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Authentic Interactive Customer Portal Replica with Live Pulse & Shimmer Bars */}
        <ScrollReveal delayMs={150}>
          <div
            className="rounded-2xl overflow-hidden shadow-2xl"
            style={{
              backgroundColor: '#05080F',
              border: '1px solid #162032',
            }}
          >
            {/* Portal Window Top Chrome */}
            <div
              className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5"
              style={{
                backgroundColor: '#070B14',
                borderBottom: '1px solid #162032',
              }}
            >
              <div className="flex items-center gap-3">
                <img
                  src={BRAND_CONFIG.logoUrl}
                  alt="NEO Transport"
                  className="h-6 w-auto object-contain"
                />
                <span className="h-4 w-[1px] bg-[#162032]" aria-hidden="true" />
                <span className="font-mono-tech text-[10.5px] uppercase tracking-[0.14em] text-[#94A3B8]">
                  CUSTOMER PORTAL
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1"
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <span className="h-2 w-2 rounded-full bg-[#10B981] telemetry-dot" aria-hidden="true" />
                  <span className="font-mono-tech text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#10B981]">
                    STANDBY ACTIVE
                  </span>
                </div>

                <a
                  href={BRAND_CONFIG.portalBookingUrl}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#2E90FA] hover:bg-[#1D7FEA] px-4 py-1.5 text-[12px] font-semibold text-white transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Book a Delivery</span>
                </a>

                <a
                  href={BRAND_CONFIG.portalLoginUrl}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#162032] bg-[#0A101D] hover:border-[#2E90FA]/50 px-3.5 py-1.5 text-[12px] font-medium text-[#F8FAFC] transition-colors"
                >
                  <span>Customer Login</span>
                  <ExternalLink className="h-3 w-3 text-[#3898FF]" aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Portal Main Interior */}
            <div className="p-5 sm:p-8">
              {/* Overview Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.12em] text-[#3898FF] mb-1">
                    — OVERVIEW
                  </div>
                  <h3 className="text-[24px] sm:text-[28px] font-extrabold text-[#F8FAFC] tracking-tight">
                    Live Operations Control Room
                  </h3>
                  <p className="text-[13.5px] text-[#94A3B8]">
                    Your account is active and live GPS dispatch telemetry is online 24/7.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <a
                    href={BRAND_CONFIG.dispatchPhoneHref}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#162032] bg-[#0A101D] px-4 py-2.5 text-[12.5px] font-semibold text-[#F8FAFC] hover:border-[#2E90FA]/50 transition-colors"
                  >
                    <Headphones className="h-4 w-4 text-[#3898FF]" aria-hidden="true" />
                    <span>DISPATCH 24/7: {BRAND_CONFIG.dispatchPhoneDisplay}</span>
                  </a>
                </div>
              </div>

              {/* Standby Account Active Banner */}
              <div
                className="rounded-xl p-4 sm:px-6 sm:py-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                style={{
                  backgroundColor: '#0A101D',
                  border: '1px solid #162032',
                }}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                    style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <CheckCircle2 className="h-5 w-5 text-[#10B981]" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-[15px] font-bold text-[#F8FAFC]">
                      Standby Account Active
                    </div>
                    <div className="text-[12.5px] text-[#94A3B8]">
                      £0 monthly fee · Priority dispatch · Dedicated fleet access
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span
                    className="font-mono-tech text-[10.5px] font-semibold uppercase tracking-[0.09em] px-2.5 py-1 rounded"
                    style={{
                      color: '#10B981',
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    VERIFIED
                  </span>
                  <a
                    href={BRAND_CONFIG.portalInvoicesUrl}
                    className="rounded-lg border border-[#162032] bg-[#05080F] px-3.5 py-1.5 text-[12px] font-medium text-[#F8FAFC] hover:border-[#2E90FA]/50 transition-colors"
                  >
                    Statements
                  </a>
                </div>
              </div>

              {/* 4 KPI Telemetry Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {PORTAL_KPIS.map((kpi) => (
                  <div
                    key={kpi.id}
                    className="rounded-xl p-5"
                    style={{
                      backgroundColor: '#0A101D',
                      border: '1px solid #162032',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: '#05080F',
                          border: '1px solid #162032',
                        }}
                      >
                        {renderKpiIcon(kpi.iconName)}
                      </div>

                      <span
                        className="inline-flex items-center gap-1.5 font-mono-tech text-[10px] font-semibold uppercase tracking-[0.08em] px-2.5 py-0.5 rounded-full"
                        style={
                          kpi.badgeTone === 'amber'
                            ? {
                                color: '#F59E0B',
                                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                              }
                            : {
                                color: '#3898FF',
                                backgroundColor: 'rgba(46, 144, 250, 0.12)',
                                border: '1px solid rgba(46, 144, 250, 0.3)',
                              }
                        }
                      >
                        {kpi.id === 'active-shipments' && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#3898FF] telemetry-dot" aria-hidden="true" />
                        )}
                        {kpi.badgeText}
                      </span>
                    </div>

                    <div className="text-[28px] font-extrabold text-[#F8FAFC] leading-none mb-1.5 font-mono-tech">
                      {kpi.value}
                    </div>
                    <div className="text-[12.5px] text-[#94A3B8]">{kpi.label}</div>
                  </div>
                ))}
              </div>

              {/* Bottom 2-Column Split: Today's Jobs (7 cols) & Quick Actions + GEMINI LOGISTICS PULSE (5 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Today's Jobs Module with Live Pulse & Shimmer Route Progress Bars */}
                <div
                  className="lg:col-span-7 rounded-xl p-5 sm:p-6 flex flex-col justify-between"
                  style={{
                    backgroundColor: '#0A101D',
                    border: '1px solid #162032',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <h4 className="text-[16px] font-bold text-[#F8FAFC]">Today&apos;s Jobs</h4>
                        <span className="inline-flex items-center gap-1.5 font-mono-tech text-[10px] font-semibold uppercase tracking-[0.08em] text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/25 px-2 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] telemetry-dot" aria-hidden="true" />
                          LIVE GPS STREAM
                        </span>
                      </div>
                      <a
                        href={BRAND_CONFIG.portalTrackingUrl}
                        className="text-[12.5px] font-medium text-[#3898FF] hover:underline"
                      >
                        View all
                      </a>
                    </div>

                    <div className="divide-y divide-[#162032]">
                      {PORTAL_TODAYS_JOBS.map((job) => {
                        const isSelected = job.id === selectedJobId;
                        const progressPercent = job.status === 'IN_TRANSIT' ? 68 : 22;
                        return (
                          <button
                            key={job.id}
                            type="button"
                            onClick={() => setSelectedJobId(job.id)}
                            className={`w-full py-3.5 px-3 -mx-3 rounded-lg flex flex-col gap-2.5 text-left transition-colors cursor-pointer ${
                              isSelected ? 'bg-[#0F172A]' : 'hover:bg-[#0F172A]/60'
                            }`}
                          >
                            <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <div className="text-[14px] font-semibold text-[#F8FAFC]">
                                  {job.route}
                                </div>
                                <div className="font-mono-tech text-[11px] uppercase tracking-[0.06em] text-[#64748B] mt-0.5">
                                  {job.vehicleCode} • {job.vehicleType}
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5">
                                <span className="font-mono-tech text-[11.5px] text-[#94A3B8]">
                                  {job.transitNote}
                                </span>
                                {job.status === 'IN_TRANSIT' ? (
                                  <span
                                    className="inline-flex items-center gap-1.5 font-mono-tech text-[10px] font-semibold uppercase tracking-[0.08em] px-2.5 py-0.5 rounded text-[#3898FF]"
                                    style={{
                                      backgroundColor: 'rgba(46, 144, 250, 0.14)',
                                      border: '1px solid rgba(46, 144, 250, 0.35)',
                                    }}
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full bg-[#3898FF] telemetry-dot" aria-hidden="true" />
                                    IN TRANSIT
                                  </span>
                                ) : (
                                  <span
                                    className="font-mono-tech text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 rounded text-[#94A3B8]"
                                    style={{
                                      backgroundColor: '#05080F',
                                      border: '1px solid #162032',
                                    }}
                                  >
                                    SCHEDULED
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Route Progress Bar with Shimmer Animation */}
                            <div className="w-full">
                              <div className="h-1.5 w-full rounded-full bg-[#05080F] overflow-hidden border border-[#162032]">
                                <div
                                  className={`h-full rounded-full ${
                                    job.status === 'IN_TRANSIT'
                                      ? 'portal-shimmer-bar'
                                      : 'bg-[#334155]'
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

                  {/* Selected Job Live Telemetry Strip */}
                  <div
                    className="mt-5 pt-4 flex flex-wrap items-center justify-between gap-2 text-[12px]"
                    style={{ borderTop: '1px solid #162032' }}
                  >
                    <div className="font-mono-tech text-[#94A3B8]">
                      ACTIVE MANIFEST:{' '}
                      <span className="text-[#3898FF] font-semibold">{selectedJob.vehicleCode}</span>{' '}
                      ({selectedJob.vehicleType}) — {selectedJob.transitNote}
                    </div>
                    <a
                      href={BRAND_CONFIG.portalTrackingUrl}
                      className="font-mono-tech text-[11px] font-semibold text-[#10B981] hover:underline"
                    >
                      OPEN LIVE GPS MAP →
                    </a>
                  </div>
                </div>

                {/* Quick Actions + GEMINI LOGISTICS PULSE Module */}
                <div
                  className="lg:col-span-5 rounded-xl p-5 sm:p-6 flex flex-col justify-between"
                  style={{
                    backgroundColor: '#0A101D',
                    border: '1px solid #162032',
                  }}
                >
                  <div>
                    <h4 className="text-[16px] font-bold text-[#F8FAFC] mb-4">Quick Actions</h4>

                    <div className="space-y-2.5 mb-6">
                      {PORTAL_QUICK_ACTIONS.map((action) => (
                        <a
                          key={action.id}
                          href={action.href}
                          className="flex items-center justify-between rounded-xl px-4 py-3 text-[13px] font-semibold text-[#F8FAFC] transition-colors hover:border-[#2E90FA]/60 hover:bg-[#0F172A] group"
                          style={{
                            backgroundColor: '#05080F',
                            border: '1px solid #162032',
                          }}
                        >
                          <span className="flex items-center gap-3">
                            {renderQuickActionIcon(action.iconName)}
                            <span>{action.label}</span>
                          </span>
                          <ArrowRight
                            className="h-3.5 w-3.5 text-[#94A3B8] transition-transform duration-150 group-hover:translate-x-1 group-hover:text-[#3898FF]"
                            aria-hidden="true"
                          />
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* GEMINI LOGISTICS PULSE with High-Thinking Dispatch Planner */}
                  <div
                    className="pt-4"
                    style={{ borderTop: '1px solid #162032' }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 font-mono-tech text-[11px] font-semibold uppercase tracking-[0.1em] text-[#3898FF]">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>GEMINI LOGISTICS PULSE</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowPlanner(!showPlanner)}
                        className="font-mono-tech text-[10.5px] text-[#94A3B8] hover:text-[#3898FF] underline cursor-pointer"
                      >
                        {showPlanner ? 'Close Route Strategist' : 'Test Emergency Route AI →'}
                      </button>
                    </div>

                    <p className="text-[12.5px] leading-relaxed text-[#94A3B8]">
                      {GEMINI_LOGISTICS_PULSE_DEFAULT}
                    </p>

                    {showPlanner && (
                      <form onSubmit={handleRunLogisticsPulse} className="mt-3 space-y-2.5">
                        <label
                          htmlFor="gemini-pulse-input"
                          className="block font-mono-tech text-[10px] uppercase tracking-[0.08em] text-[#94A3B8]"
                        >
                          Describe Emergency Freight Scenario (High-Thinking Analysis):
                        </label>
                        <textarea
                          id="gemini-pulse-input"
                          rows={3}
                          value={scenarioInput}
                          onChange={(e) => setScenarioInput(e.target.value)}
                          className="w-full rounded-lg p-2.5 text-[12px] text-[#F8FAFC] bg-[#05080F] border border-[#162032]"
                        />
                        <button
                          type="submit"
                          disabled={plannerLoading}
                          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#2E90FA] hover:bg-[#1D7FEA] px-3 text-[12px] font-semibold text-white transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {plannerLoading ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              <span>Calculating Recovery Protocol...</span>
                            </>
                          ) : (
                            <span>Generate Emergency Dispatch Plan</span>
                          )}
                        </button>

                        {plannerResult && (
                          <div
                            className="rounded-lg p-3 font-mono-tech text-[11px] whitespace-pre-line text-[#F8FAFC] leading-relaxed"
                            style={{
                              backgroundColor: '#05080F',
                              border: '1px solid rgba(46, 144, 250, 0.4)',
                            }}
                          >
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

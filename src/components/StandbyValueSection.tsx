import React, { useState } from 'react';
import { Clock, Zap, ShieldCheck, MapPin, ArrowUpRight, ArrowRight, CheckCircle2 } from 'lucide-react';
import { BRAND_CONFIG, DISPATCH_HUBS, STANDBY_PILLARS } from '../data/siteContent';
import { AnimatedCounter, ScrollReveal } from './MotionPrimitives';

export const StandbyValueSection: React.FC = () => {
  const [selectedHubId, setSelectedHubId] = useState<string>('manchester');
  const activeHub = DISPATCH_HUBS.find((h) => h.id === selectedHubId) || DISPATCH_HUBS[0];

  const getPillarIcon = (id: string) => {
    switch (id) {
      case 'around-the-clock':
        return <Clock className="h-5 w-5 text-[#2E90FA]" aria-hidden="true" />;
      case 'deliver-full-speed':
        return <Zap className="h-5 w-5 text-[#2E90FA]" aria-hidden="true" />;
      default:
        return <ShieldCheck className="h-5 w-5 text-[#10B981]" aria-hidden="true" />;
    }
  };

  return (
    <section
      id="standby"
      aria-labelledby="standby-heading"
      className="py-16 sm:py-20 lg:py-24 scroll-mt-16"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <ScrollReveal className="mx-auto max-w-3xl text-center mb-12 lg:mb-16">
          <div className="font-mono-tech text-[12px] font-semibold uppercase tracking-[0.12em] text-[#3898FF] mb-3">
            — WHY CHOOSE NEO TRANSPORT
          </div>
          <h2
            id="standby-heading"
            className="section-h2 mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Built on Three Core Operational Pillars
          </h2>
          <p
            className="text-[16px] sm:text-[17px] leading-[1.6]"
            style={{ color: 'var(--text-secondary)' }}
          >
            Whether you need scheduled business deliveries, rapid same-day shipping, or a £0
            Emergency Standby Account when a primary carrier lets you down, our team dispatches a
            dedicated direct vehicle within 60 minutes.
          </p>
        </ScrollReveal>

        {/* 3-Pillar Value Grid with 75ms stagger, electric blue hover glow, -translate-y-1 & arrow slide */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-16">
          {STANDBY_PILLARS.map((pillar, idx) => (
            <ScrollReveal key={pillar.id} delayMs={idx * 75} className="h-full">
              <article className="neo-card-interactive rounded-2xl p-6 sm:p-7 h-full flex flex-col justify-between group">
                <div>
                  {/* Top row: Icon box + Status Pill */}
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: 'rgba(46, 144, 250, 0.1)',
                        border: '1px solid rgba(46, 144, 250, 0.25)',
                      }}
                    >
                      {getPillarIcon(pillar.id)}
                    </div>

                    <span
                      className="font-mono-tech text-[10.5px] font-semibold uppercase tracking-[0.09em] px-2.5 py-1 rounded-full"
                      style={
                        pillar.id === 'here-for-you'
                          ? {
                              color: 'var(--status-green)',
                              backgroundColor: 'var(--status-green-bg)',
                              border: '1px solid var(--status-green-border)',
                            }
                          : {
                              color: '#3898FF',
                              backgroundColor: 'rgba(46, 144, 250, 0.1)',
                              border: '1px solid rgba(46, 144, 250, 0.28)',
                            }
                      }
                    >
                      {pillar.badge}
                    </span>
                  </div>

                  {/* Title */}
                  <h3
                    className="card-h3 mb-3"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {pillar.title}
                  </h3>

                  {/* Body copy */}
                  <p
                    className="text-[14.5px] leading-[1.6] mb-6"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {pillar.description}
                  </p>
                </div>

                {/* Telemetry Footer inside card with sliding arrow */}
                <div
                  className="pt-4 flex items-center justify-between"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                >
                  <div>
                    <span
                      className="block font-mono-tech text-[10px] uppercase tracking-[0.08em]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {pillar.metricLabel}
                    </span>
                    <span
                      className="font-mono-tech text-[12px] font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {pillar.metricValue}
                    </span>
                  </div>

                  <a
                    href={BRAND_CONFIG.portalBookingUrl}
                    aria-label={`${pillar.title} — Book a Delivery`}
                    className="inline-flex items-center gap-1.5 font-mono-tech text-[11px] font-semibold text-[#3898FF]"
                  >
                    <span>DISPATCH</span>
                    <ArrowRight className="h-4 w-4 card-arrow text-[#3898FF]" aria-hidden="true" />
                  </a>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>

        {/* Coverage Anchor Block (#coverage): UK Mainland & European Rapid Response Network */}
        <ScrollReveal delayMs={100}>
          <div
            id="coverage"
            className="neo-card rounded-2xl p-6 sm:p-8 scroll-mt-24"
          >
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-5">
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-4"
                  style={{
                    backgroundColor: 'var(--status-green-bg)',
                    border: '1px solid var(--status-green-border)',
                  }}
                >
                  <span className="h-2 w-2 rounded-full bg-[#10B981] telemetry-dot" aria-hidden="true" />
                  <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.1em] text-[#10B981]">
                    LIVE FLEET NETWORK • UK &amp; EU
                  </span>
                </div>

                <h3
                  className="text-[22px] sm:text-[26px] font-bold tracking-tight mb-3"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Nationwide UK Hubs &amp; Direct European Corridors
                </h3>

                <p
                  className="text-[14.5px] leading-[1.6] mb-6"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Pre-staged vehicles across Manchester, Birmingham, and the London M25 corridor provide
                  rapid 60-minute same-day collection nationwide, backed by direct door-to-door road
                  freight across European industrial zones.
                </p>

                <div className="space-y-2.5 mb-6">
                  <div className="flex items-center gap-2.5 text-[13.5px]" style={{ color: 'var(--text-primary)' }}>
                    <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0" aria-hidden="true" />
                    <span>14 dedicated vehicles pre-staged across primary UK motorway hubs</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[13.5px]" style={{ color: 'var(--text-primary)' }}>
                    <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0" aria-hidden="true" />
                    <span>Zero hub transloading — dedicated vehicle from collection bay to destination</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[13.5px]" style={{ color: 'var(--text-primary)' }}>
                    <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0" aria-hidden="true" />
                    <span>Direct UK ↔ EU cross-border customs &amp; urgent transit coordination</span>
                  </div>
                </div>

                <a
                  href={BRAND_CONFIG.portalBookingUrl}
                  className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-[#3898FF] hover:underline"
                >
                  <span>Book a Same-Day Delivery or Open a £0 Standby Account</span>
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>

              {/* Right: Interactive Hub Telemetry Matrix with Smooth Count-Up */}
              <div className="lg:col-span-7">
                <div
                  className="rounded-xl p-4 sm:p-5"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <span className="font-mono-tech text-[11px] uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
                      LIVE REGIONAL DISPATCH CORRIDORS
                    </span>
                    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Regional Dispatch Hubs">
                      {DISPATCH_HUBS.map((hub) => {
                        const isSelected = hub.id === selectedHubId;
                        return (
                          <button
                            key={hub.id}
                            type="button"
                            role="tab"
                            aria-selected={isSelected}
                            onClick={() => setSelectedHubId(hub.id)}
                            className={`font-mono-tech text-[11px] px-3 py-1 rounded-full transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#2E90FA] text-white font-semibold'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                            style={
                              !isSelected
                                ? {
                                    backgroundColor: 'var(--bg-surface)',
                                    border: '1px solid var(--border-subtle)',
                                  }
                                : undefined
                            }
                          >
                            {hub.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Hub Telemetry Detail with Count-Up Animation */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div
                      className="rounded-lg p-3.5"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div className="font-mono-tech text-[10px] uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--text-muted)' }}>
                        SELECTED HUB
                      </div>
                      <div className="font-mono-tech text-[13px] font-semibold text-[#3898FF]">
                        {activeHub.code}
                      </div>
                      <div className="font-mono-tech text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                        {activeHub.coordinates}
                      </div>
                    </div>

                    <div
                      className="rounded-lg p-3.5"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div className="font-mono-tech text-[10px] uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--text-muted)' }}>
                        AVG COLLECTION SLA
                      </div>
                      <div className="font-mono-tech text-[20px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        <AnimatedCounter target={activeHub.avgCollectionMins} suffix=" min" />
                      </div>
                      <div className="font-mono-tech text-[11px] text-[#10B981]">
                        Target ≤ 60 min nationwide
                      </div>
                    </div>

                    <div
                      className="rounded-lg p-3.5"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div className="font-mono-tech text-[10px] uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--text-muted)' }}>
                        STANDBY FLEET READY
                      </div>
                      <div className="font-mono-tech text-[20px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        <AnimatedCounter target={activeHub.activeVehicles} suffix=" Units" />
                      </div>
                      <div className="font-mono-tech text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        Bay {activeHub.bayNumber} • Immediate Rollout
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg px-4 py-3"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                      <MapPin className="h-4 w-4 text-[#2E90FA] shrink-0" aria-hidden="true" />
                      <span>Primary Motorway Arteries: <strong style={{ color: 'var(--text-primary)' }}>{activeHub.corridor}</strong></span>
                    </div>
                    <a
                      href={BRAND_CONFIG.portalBookingUrl}
                      className="font-mono-tech text-[11.5px] font-semibold text-[#3898FF] hover:underline whitespace-nowrap"
                    >
                      DISPATCH FROM {activeHub.id.toUpperCase()} →
                    </a>
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

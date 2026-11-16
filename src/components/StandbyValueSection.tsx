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
        return <Clock className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />;
      case 'deliver-full-speed':
        return <Zap className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />;
      default:
        return <ShieldCheck className="h-5 w-5 text-[#059669]" aria-hidden="true" />;
    }
  };

  return (
    <section
      id="standby"
      aria-labelledby="standby-heading"
      className="py-20 sm:py-28 bg-white border-b border-[#E5E7EB] scroll-mt-16"
    >
      <div className="mx-auto max-w-[1160px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <ScrollReveal className="mx-auto max-w-3xl text-center mb-14 lg:mb-16">
          <div className="inline-flex items-center gap-2 mb-3.5">
            <span className="h-1.5 w-1.5 rounded-[2px] bg-[#2563EB]" aria-hidden="true" />
            <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
              WHY CHOOSE NEO TRANSPORT
            </span>
          </div>
          <h2 id="standby-heading" className="section-h2 text-[#111827] mb-4">
            Built on Three Core Operational Pillars
          </h2>
          <p className="text-[16px] sm:text-[17px] leading-[1.65] text-[#4B5563]">
            Whether you need scheduled business deliveries, rapid same-day shipping, or a £0
            Emergency Standby Account when a primary carrier lets you down, our team dispatches a
            dedicated direct vehicle within 60 minutes.
          </p>
        </ScrollReveal>

        {/* 3-Pillar Minimalist Cards with large subtle index numerals (01, 02, 03) */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-20">
          {STANDBY_PILLARS.map((pillar, idx) => (
            <ScrollReveal key={pillar.id} delayMs={idx * 75} className="h-full">
              <article className="neo-card-interactive rounded-2xl p-7 sm:p-8 h-full flex flex-col justify-between group">
                <div>
                  {/* Top row: Minimalist Icon + Subtle Editorial Numeral */}
                  <div className="flex items-start justify-between gap-3 mb-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]">
                      {getPillarIcon(pillar.id)}
                    </div>
                    <span className="font-mono-tech text-[28px] font-bold leading-none text-[#E5E7EB] select-none">
                      {pillar.index}
                    </span>
                  </div>

                  <div className="font-mono-tech text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#2563EB] mb-2">
                    {pillar.badge}
                  </div>

                  <h3 className="card-h3 text-[#111827] mb-3">
                    {pillar.title}
                  </h3>

                  <p className="text-[14.5px] leading-[1.65] text-[#4B5563] mb-6">
                    {pillar.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-between gap-2">
                  <div>
                    <span className="block font-mono-tech text-[10px] uppercase tracking-[0.08em] text-[#6B7280]">
                      {pillar.metricLabel}
                    </span>
                    <span className="font-mono-tech text-[12px] font-semibold text-[#111827]">
                      {pillar.metricValue}
                    </span>
                  </div>

                  <a
                    href={BRAND_CONFIG.portalBookingUrl}
                    aria-label={`${pillar.title} — Book a Delivery`}
                    className="inline-flex items-center gap-1 font-mono-tech text-[11px] font-semibold text-[#111827] hover:text-[#2563EB]"
                  >
                    <span>DISPATCH</span>
                    <ArrowRight className="h-3.5 w-3.5 card-arrow text-[#2563EB]" aria-hidden="true" />
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
            className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] p-6 sm:p-10 scroll-mt-24"
          >
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-5">
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="h-2 w-2 rounded-full bg-[#10B981] telemetry-dot" aria-hidden="true" />
                  <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.1em] text-[#059669]">
                    LIVE FLEET NETWORK • UK &amp; EU
                  </span>
                </div>

                <h3 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.02em] text-[#111827] mb-3">
                  Nationwide UK Hubs &amp; Direct European Corridors
                </h3>

                <p className="text-[14.5px] leading-[1.65] text-[#4B5563] mb-6">
                  Pre-staged vehicles across Manchester, Birmingham, and the London M25 corridor provide
                  rapid 60-minute same-day collection nationwide, backed by direct door-to-door road
                  freight across European industrial zones.
                </p>

                <div className="space-y-2.5 mb-6">
                  <div className="flex items-center gap-2.5 text-[13.5px] text-[#111827]">
                    <CheckCircle2 className="h-4 w-4 text-[#059669] shrink-0" aria-hidden="true" />
                    <span>14 dedicated vehicles pre-staged across primary UK motorway hubs</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[13.5px] text-[#111827]">
                    <CheckCircle2 className="h-4 w-4 text-[#059669] shrink-0" aria-hidden="true" />
                    <span>Zero hub transloading — dedicated vehicle from collection bay to destination</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[13.5px] text-[#111827]">
                    <CheckCircle2 className="h-4 w-4 text-[#059669] shrink-0" aria-hidden="true" />
                    <span>Direct UK ↔ EU cross-border customs &amp; urgent transit coordination</span>
                  </div>
                </div>

                <a
                  href={BRAND_CONFIG.portalBookingUrl}
                  className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#2563EB] hover:underline"
                >
                  <span>Book a Same-Day Delivery or Open a £0 Standby Account</span>
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>

              {/* Right: Interactive Hub Telemetry Matrix */}
              <div className="lg:col-span-7">
                <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-[#E5E7EB]">
                    <span className="font-mono-tech text-[11px] uppercase tracking-[0.1em] text-[#6B7280]">
                      LIVE REGIONAL DISPATCH CORRIDORS
                    </span>
                    <div className="flex flex-wrap gap-1 rounded-lg bg-[#F3F4F6] p-1" role="tablist" aria-label="Regional Dispatch Hubs">
                      {DISPATCH_HUBS.map((hub) => {
                        const isSelected = hub.id === selectedHubId;
                        return (
                          <button
                            key={hub.id}
                            type="button"
                            role="tab"
                            aria-selected={isSelected}
                            onClick={() => setSelectedHubId(hub.id)}
                            className={`font-mono-tech text-[11px] px-3 py-1 rounded-md transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#111827] text-white font-semibold shadow-xs'
                                : 'text-[#4B5563] hover:text-[#111827]'
                            }`}
                          >
                            {hub.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Hub Telemetry Detail */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-3.5">
                      <div className="font-mono-tech text-[10px] uppercase tracking-[0.08em] text-[#6B7280] mb-1">
                        SELECTED HUB
                      </div>
                      <div className="font-mono-tech text-[13px] font-semibold text-[#2563EB]">
                        {activeHub.code}
                      </div>
                      <div className="font-mono-tech text-[11px] text-[#6B7280] mt-1">
                        {activeHub.coordinates}
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-3.5">
                      <div className="font-mono-tech text-[10px] uppercase tracking-[0.08em] text-[#6B7280] mb-1">
                        AVG COLLECTION SLA
                      </div>
                      <div className="font-mono-tech text-[20px] font-bold text-[#111827]">
                        <AnimatedCounter target={activeHub.avgCollectionMins} suffix=" min" />
                      </div>
                      <div className="font-mono-tech text-[11px] text-[#059669]">
                        Target ≤ 60 min nationwide
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-3.5">
                      <div className="font-mono-tech text-[10px] uppercase tracking-[0.08em] text-[#6B7280] mb-1">
                        STANDBY FLEET READY
                      </div>
                      <div className="font-mono-tech text-[20px] font-bold text-[#111827]">
                        <AnimatedCounter target={activeHub.activeVehicles} suffix=" Units" />
                      </div>
                      <div className="font-mono-tech text-[11px] text-[#4B5563]">
                        Bay {activeHub.bayNumber} • Immediate Rollout
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3">
                    <div className="flex items-center gap-2 text-[12.5px] text-[#4B5563]">
                      <MapPin className="h-4 w-4 text-[#2563EB] shrink-0" aria-hidden="true" />
                      <span>
                        Primary Motorway Arteries:{' '}
                        <strong className="text-[#111827]">{activeHub.corridor}</strong>
                      </span>
                    </div>
                    <a
                      href={BRAND_CONFIG.portalBookingUrl}
                      className="font-mono-tech text-[11.5px] font-semibold text-[#2563EB] hover:underline whitespace-nowrap"
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

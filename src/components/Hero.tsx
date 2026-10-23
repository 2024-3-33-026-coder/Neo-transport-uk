import React, { useState, useEffect } from 'react';
import { Phone, ArrowRight, Compass } from 'lucide-react';
import { BRAND_CONFIG, DISPATCH_HUBS, HERO_METRICS } from '../data/siteContent';
import { AnimatedCounter, ScrollReveal, scrollToSectionAnchor } from './MotionPrimitives';

export const Hero: React.FC = () => {
  const [activeHubIndex, setActiveHubIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveHubIndex((prev) => (prev + 1) % DISPATCH_HUBS.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [isPaused]);

  const currentHub = DISPATCH_HUBS[activeHubIndex];

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative w-full pt-10 pb-0 sm:pt-14 lg:pt-20"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        {/* Two-column asymmetric grid (7fr / 5fr on desktop) */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center lg:gap-12 pb-14 lg:pb-20">
          {/* Left Column (7 cols on lg): Main Website Messaging */}
          <ScrollReveal className="lg:col-span-7 flex flex-col items-start">
            {/* Top Badge */}
            <div
              className="inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 mb-7"
              style={{
                backgroundColor: 'rgba(46, 144, 250, 0.08)',
                border: '1px solid rgba(46, 144, 250, 0.28)',
              }}
            >
              <span
                className="h-2 w-2 rounded-full bg-[#2E90FA] telemetry-dot"
                aria-hidden="true"
              />
              <span className="font-mono-tech text-[11.5px] font-medium uppercase tracking-[0.11em] text-[#3898FF]">
                UK &amp; EU SAME DAY COURIER SPECIALISTS • 60 MIN COLLECTION
              </span>
            </div>

            {/* Main Headline (H1) */}
            <h1
              id="hero-heading"
              className="hero-h1 mb-6 max-w-[18ch]"
              style={{ color: 'var(--text-primary)' }}
            >
              Same-Day Courier &amp; End-to-End{' '}
              <span className="text-[#2E90FA] underline decoration-[#2E90FA] decoration-[3px] underline-offset-[8px]">
                Logistics Across the UK &amp; Europe
              </span>
            </h1>

            {/* Sub-headline */}
            <p
              className="mb-9 max-w-[62ch] text-[16.5px] sm:text-[18px] leading-[1.6] font-normal"
              style={{ color: 'var(--text-secondary)' }}
            >
              We&apos;re NEO Transport – your trusted partner for same-day shipping, end-to-end
              logistics, and dedicated business deliveries across the UK and Europe. Nationwide
              collection within 60 minutes, tracked live 24/7.
            </p>

            {/* Action Row */}
            <div className="flex flex-wrap items-center gap-3.5 mb-5 w-full sm:w-auto">
              {/* Primary CTA: Book a Delivery -> */}
              <a
                href={BRAND_CONFIG.portalUrl}
                className="inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-[#2E90FA] hover:bg-[#1D7FEA] px-6 text-[14.5px] font-semibold text-white transition-all duration-150 shadow-sm whitespace-nowrap"
              >
                <span>Book a Delivery</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>

              {/* Secondary CTA: Explore Services (#services) */}
              <a
                href="#services"
                onClick={(e) => scrollToSectionAnchor(e, '#services')}
                className="inline-flex h-12 items-center justify-center gap-2.5 rounded-full px-6 text-[14px] font-semibold transition-all duration-150 hover:border-[#2E90FA]/60 whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <Compass className="h-4 w-4 text-[#2E90FA]" aria-hidden="true" />
                <span>Explore Services</span>
              </a>
            </div>

            {/* Below Buttons: 24/7 Dispatch Desk: 0800 246 8135 */}
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={BRAND_CONFIG.dispatchPhoneHref}
                className="inline-flex items-center gap-2 font-mono-tech text-[13px] font-medium transition-colors hover:text-[#2E90FA]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Phone className="h-3.5 w-3.5 text-[#2E90FA]" aria-hidden="true" />
                <span>24/7 Dispatch Desk: {BRAND_CONFIG.dispatchPhoneDisplay}</span>
              </a>
            </div>
          </ScrollReveal>

          {/* Right Column (5 cols on lg): Animated Live Dispatch Telemetry Card */}
          <ScrollReveal
            delayMs={100}
            className="lg:col-span-5"
          >
            <div
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              className="neo-card rounded-2xl overflow-hidden shadow-2xl"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {/* Top Bar + Hub Selector */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 pb-2">
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full bg-[#3898FF] telemetry-dot"
                    aria-hidden="true"
                  />
                  <span
                    className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.1em]"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {currentHub.code}
                  </span>
                </div>

                {/* Hub quick switcher pills */}
                <div
                  className="flex items-center gap-1"
                  role="tablist"
                  aria-label="Select Dispatch Hub Telemetry"
                >
                  {DISPATCH_HUBS.map((hub, idx) => {
                    const active = idx === activeHubIndex;
                    return (
                      <button
                        key={hub.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setActiveHubIndex(idx)}
                        className={`font-mono-tech text-[10px] uppercase px-2 py-0.5 rounded transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#2E90FA]/20 text-[#3898FF] border border-[#2E90FA]/40'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {hub.id === 'manchester'
                          ? 'MCR'
                          : hub.id === 'birmingham'
                          ? 'BHX'
                          : 'M25'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Centre Stage: Custom Architectural SVG Illustration with Animated Road Lines, Pulsing Headlight & Rotating Wheels */}
              <div className="relative px-4 pt-2 pb-4">
                <svg
                  viewBox="0 0 460 250"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-auto select-none"
                  role="img"
                  aria-label={`NEO Transport live dispatch courier van departing loading bay ${currentHub.bayNumber} at ${currentHub.label}`}
                >
                  <defs>
                    <linearGradient id="baySpotlight" x1="350" y1="15" x2="210" y2="215" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#1E293B" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#0A101D" stopOpacity="0" />
                    </linearGradient>

                    <linearGradient id="headlightCone" x1="88" y1="168" x2="0" y2="152" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#2E90FA" stopOpacity="0.55" />
                      <stop offset="65%" stopColor="#2E90FA" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#2E90FA" stopOpacity="0" />
                    </linearGradient>

                    <linearGradient id="vanBodyGrad" x1="90" y1="100" x2="360" y2="195" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#111A2E" />
                      <stop offset="50%" stopColor="#0B1220" />
                      <stop offset="100%" stopColor="#080D18" />
                    </linearGradient>
                  </defs>

                  {/* Diagonal ambient light beam from depot roof */}
                  <polygon points="348,16 190,210 385,210" fill="url(#baySpotlight)" />

                  {/* Depot Bay 23 Structure on right */}
                  <rect
                    x="332"
                    y="38"
                    width="82"
                    height="168"
                    fill="#080E1A"
                    stroke="#1E293B"
                    strokeWidth="1.2"
                  />
                  <text
                    x="352"
                    y="62"
                    fill="#475569"
                    fontFamily="JetBrains Mono, monospace"
                    fontSize="14"
                    fontWeight="600"
                  >
                    {currentHub.bayNumber}
                  </text>
                  <line x1="332" y1="74" x2="414" y2="74" stroke="#162032" strokeWidth="1" />
                  <line x1="332" y1="104" x2="414" y2="104" stroke="#162032" strokeWidth="1" />
                  <line x1="332" y1="134" x2="414" y2="134" stroke="#162032" strokeWidth="1" />
                  <line x1="332" y1="164" x2="414" y2="164" stroke="#162032" strokeWidth="1" />
                  <line x1="332" y1="194" x2="414" y2="194" stroke="#162032" strokeWidth="1" />

                  {/* Ground Road Horizon Hairlines + Animated Moving Road Telemetry Line */}
                  <line x1="8" y1="206" x2="452" y2="206" stroke="#1E293B" strokeWidth="1.2" />
                  <line
                    x1="8"
                    y1="216"
                    x2="452"
                    y2="216"
                    stroke="#2E90FA"
                    strokeOpacity="0.45"
                    strokeWidth="1.5"
                    className="svg-road-flow"
                  />
                  <line x1="8" y1="226" x2="452" y2="226" stroke="#162032" strokeWidth="1" />

                  {/* Pulsing Headlight Beam Cone projecting left */}
                  <polygon
                    points="92,163 2,144 2,188 86,177"
                    fill="url(#headlightCone)"
                    className="svg-headlight-pulse"
                  />

                  {/* Courier Van Body Silhouette */}
                  <path
                    d="M84 176 L88 152 L145 112 L348 112 L348 188 L90 188 C86 188 84 183 84 176 Z"
                    fill="url(#vanBodyGrad)"
                    stroke="#334155"
                    strokeWidth="1.5"
                  />

                  {/* Cab Window & Divider */}
                  <path
                    d="M150 119 L196 119 L196 148 L112 148 L150 119 Z"
                    fill="#070B14"
                    stroke="#26354D"
                    strokeWidth="1.2"
                  />

                  {/* Cargo panel seam lines */}
                  <line x1="206" y1="114" x2="206" y2="184" stroke="#1E293B" strokeWidth="1" />
                  <line x1="86" y1="181" x2="346" y2="181" stroke="#1E293B" strokeWidth="1" />

                  {/* Side Branded Decal inside Cargo Area */}
                  <g transform="translate(212, 136)">
                    <polygon points="5,2 10,5 5,8 0,5" fill="#3898FF" />
                    <polygon points="5,10 10,7 5,13 0,7" fill="#1D7FEA" />
                    <text
                      x="15"
                      y="10"
                      fill="#F8FAFC"
                      fontFamily="Plus Jakarta Sans, sans-serif"
                      fontSize="11"
                      fontWeight="800"
                      letterSpacing="0.03em"
                    >
                      NEO TRANSPORT
                    </text>
                    <text
                      x="15"
                      y="18.5"
                      fill="#64748B"
                      fontFamily="JetBrains Mono, monospace"
                      fontSize="4.5"
                      fontWeight="500"
                      letterSpacing="0.06em"
                    >
                      UK &amp; EU SAME DAY COURIER SPECIALISTS
                    </text>
                  </g>

                  {/* Glowing Headlight */}
                  <ellipse
                    cx="94"
                    cy="166"
                    rx="5.5"
                    ry="3"
                    fill="#60A5FA"
                    className="svg-headlight-pulse"
                  />
                  <ellipse cx="94" cy="166" rx="3" ry="1.5" fill="#F8FAFC" />

                  {/* Yellow Registration Plate: NEO 1 */}
                  <rect x="78" y="173" width="22" height="7" rx="1.2" fill="#FACC15" />
                  <text
                    x="81"
                    y="178.3"
                    fill="#05080F"
                    fontFamily="JetBrains Mono, monospace"
                    fontSize="5.2"
                    fontWeight="700"
                  >
                    NEO 1
                  </text>

                  {/* Rear Taillight Accent */}
                  <rect x="345" y="158" width="3" height="14" rx="1" fill="#EF4444" opacity="0.85" />

                  {/* Front Wheel (Left) with Delicate Rotation */}
                  <g transform="translate(145, 188)">
                    <g className="svg-wheel-spin">
                      <circle cx="0" cy="0" r="22" fill="#070B12" stroke="#334155" strokeWidth="2" />
                      <circle
                        cx="0"
                        cy="0"
                        r="14"
                        fill="#0F172A"
                        stroke="#2E90FA"
                        strokeOpacity="0.45"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                      />
                      <line x1="-12" y1="0" x2="12" y2="0" stroke="#334155" strokeWidth="1.2" />
                      <line x1="0" y1="-12" x2="0" y2="12" stroke="#334155" strokeWidth="1.2" />
                      <circle cx="0" cy="0" r="5" fill="#334155" />
                    </g>
                  </g>

                  {/* Rear Wheel (Right) with Delicate Rotation */}
                  <g transform="translate(302, 188)">
                    <g className="svg-wheel-spin">
                      <circle cx="0" cy="0" r="22" fill="#070B12" stroke="#334155" strokeWidth="2" />
                      <circle
                        cx="0"
                        cy="0"
                        r="14"
                        fill="#0F172A"
                        stroke="#2E90FA"
                        strokeOpacity="0.45"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                      />
                      <line x1="-12" y1="0" x2="12" y2="0" stroke="#334155" strokeWidth="1.2" />
                      <line x1="0" y1="-12" x2="0" y2="12" stroke="#334155" strokeWidth="1.2" />
                      <circle cx="0" cy="0" r="5" fill="#334155" />
                    </g>
                  </g>
                </svg>
              </div>

              {/* Live Dispatch Telemetry Footer Grid Divided by 1px solid #162032 hairlines */}
              <div
                className="grid grid-cols-2 px-6 py-4"
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                {/* Left metric: COLLECTION SLA -> < 60 MIN */}
                <div>
                  <div
                    className="font-mono-tech text-[10.5px] uppercase tracking-[0.1em] mb-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    COLLECTION SLA
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="font-mono-tech text-[22px] sm:text-[24px] font-extrabold tracking-tight"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      &lt; 60 MIN
                    </span>
                  </div>
                </div>

                {/* Right metric: COVERAGE -> UK & EU 24/7 */}
                <div className="pl-4" style={{ borderLeft: '1px solid var(--border-subtle)' }}>
                  <div
                    className="font-mono-tech text-[10.5px] uppercase tracking-[0.1em] mb-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    COVERAGE
                  </div>
                  <div
                    className="font-mono-tech text-[22px] sm:text-[24px] font-bold tracking-tight"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    UK &amp; EU 24/7
                  </div>
                </div>
              </div>

              {/* Bottom Status Bar */}
              <div className="flex items-center justify-between px-6 py-3.5">
                <span className="inline-flex items-center gap-2 font-mono-tech text-[11px] font-semibold uppercase tracking-[0.1em] text-[#3898FF]">
                  <span className="h-2 w-2 rounded-full bg-[#10B981] telemetry-dot" aria-hidden="true" />
                  <span>LIVE FLEET TRACKING ACTIVE</span>
                </span>
                <span
                  className="font-mono-tech text-[11px]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Dedicated point-to-point
                </span>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>

      {/* Bottom Metrics Bar (3-Column Structural Strip with Count-Up Animation) */}
      <div
        className="w-full"
        style={{
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 py-10 sm:grid-cols-3 sm:gap-6 lg:py-12">
            {HERO_METRICS.map((stat, idx) => (
              <ScrollReveal key={stat.id} delayMs={idx * 75} className="flex flex-col">
                <div
                  className="text-[36px] sm:text-[42px] lg:text-[48px] font-extrabold tracking-tight leading-none mb-2.5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {stat.id === 'collection-time' ? (
                    <AnimatedCounter target={60} decimals={0} suffix=" min" />
                  ) : stat.id === 'recovery-rate' ? (
                    <AnimatedCounter target={98.7} decimals={1} suffix="%" />
                  ) : (
                    stat.value
                  )}
                </div>
                <div
                  className="text-[13.5px] sm:text-[14px] leading-snug"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {stat.label}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

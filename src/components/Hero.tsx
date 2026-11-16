import React, { useState, useEffect } from 'react';
import { Phone, ArrowRight, Compass, CheckCircle2, MapPin, Clock } from 'lucide-react';
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
      className="relative w-full bg-white"
    >
      {/* Centered Minimalist Hero Section matching Advertz.ai spacious hierarchy */}
      <div className="mx-auto max-w-[1160px] px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <ScrollReveal className="flex flex-col items-center text-center">
          {/* Top Kicker with small blue square indicator */}
          <div className="inline-flex items-center justify-center gap-2.5 mb-7 max-w-full">
            <span className="h-1.5 w-1.5 shrink-0 rounded-[2px] bg-[#2563EB]" aria-hidden="true" />
            <span className="font-mono-tech text-[11px] font-medium uppercase tracking-[0.14em] text-[#2563EB]">
              UK &amp; EU SAME DAY COURIER SPECIALISTS • 60 MIN COLLECTION
            </span>
          </div>

          {/* Centered Large Bold Hero Headline in sentence case */}
          <h1
            id="hero-heading"
            className="hero-h1 text-[#111827] max-w-[19ch] mb-6"
          >
            Same-day courier and <span className="whitespace-nowrap">end-to-end</span>{' '}
            <span className="hero-gradient-text">
              logistics across the UK and Europe
            </span>
          </h1>

          {/* Centered Sub-headline without en dashes or fluff */}
          <p className="max-w-[58ch] text-[16.5px] sm:text-[18px] leading-[1.65] text-[#4B5563] mb-9">
            NEO Transport handles same-day shipping, dedicated van and truck loads, and business
            deliveries across the UK and Europe. We collect nationwide within 60 minutes and track
            every vehicle live 24/7.
          </p>

          {/* Centered CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 mb-5">
            <a
              href={BRAND_CONFIG.portalUrl}
              className="btn-primary-black inline-flex h-12 items-center justify-center gap-2.5 rounded-lg px-6 text-[14.5px] font-semibold whitespace-nowrap"
            >
              <span>Book a delivery</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>

            <a
              href="#services"
              onClick={(e) => scrollToSectionAnchor(e, '#services')}
              className="btn-secondary-light inline-flex h-12 items-center justify-center gap-2 rounded-lg px-6 text-[14px] font-semibold whitespace-nowrap"
            >
              <Compass className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
              <span>Explore services</span>
            </a>
          </div>

          {/* 24/7 Dispatch Desk Phone */}
          <a
            href={BRAND_CONFIG.dispatchPhoneHref}
            className="inline-flex items-center gap-2 font-mono-tech text-[12.5px] font-medium text-[#6B7280] hover:text-[#111827] transition-colors"
          >
            <Phone className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
            <span>24/7 dispatch desk: {BRAND_CONFIG.dispatchPhoneDisplay}</span>
          </a>
        </ScrollReveal>

        {/* Centered Live Dispatch Product Card (mirroring Advertz.ai framed showcase window below hero CTA) */}
        <ScrollReveal delayMs={110} className="mt-14 sm:mt-16 max-w-[1000px] mx-auto">
          <div
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            className="rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_24px_60px_-24px_rgba(17,24,39,0.09)] overflow-hidden"
          >
            {/* Top Window Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-[#FAFAFA] border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-[#10B981] telemetry-dot" aria-hidden="true" />
                <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-[0.1em] text-[#111827]">
                  {currentHub.code}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-block font-mono-tech text-[10.5px] uppercase tracking-[0.08em] text-[#6B7280]">
                  LIVE FLEET TRACKING ACTIVE
                </span>

                {/* Hub quick switcher tabs */}
                <div
                  className="flex items-center gap-1 rounded-lg bg-[#F3F4F6] p-0.5"
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
                        className={`font-mono-tech text-[10.5px] font-medium uppercase px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          active
                            ? 'bg-white text-[#111827] shadow-xs'
                            : 'text-[#6B7280] hover:text-[#111827]'
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
            </div>

            {/* 2-Column Split Inside Framed Card (Left: Light Blueprint Van SVG | Right: Live Dispatch Log) */}
            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* Left 7 Cols: Crisp Light Blueprint Van Illustration */}
              <div className="lg:col-span-7 p-5 sm:p-7 bg-[#FAFAFA]/60 lg:border-r border-b lg:border-b-0 border-[#E5E7EB] flex items-center justify-center">
                <svg
                  viewBox="0 0 460 235"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-auto select-none"
                  role="img"
                  aria-label={`NEO Transport live dispatch courier van departing loading bay ${currentHub.bayNumber} at ${currentHub.label}`}
                >
                  <defs>
                    <linearGradient id="baySpotlightLight" x1="350" y1="15" x2="210" y2="205" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.55" />
                      <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                    </linearGradient>

                    <linearGradient id="headlightConeLight" x1="88" y1="168" x2="0" y2="152" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.28" />
                      <stop offset="65%" stopColor="#60A5FA" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
                    </linearGradient>

                    <linearGradient id="vanBodyLight" x1="90" y1="100" x2="360" y2="195" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#1F2937" />
                      <stop offset="100%" stopColor="#111827" />
                    </linearGradient>
                  </defs>

                  {/* Ambient light cone from depot bay */}
                  <polygon points="348,16 190,206 385,206" fill="url(#baySpotlightLight)" />

                  {/* Depot Bay Structure on right */}
                  <rect
                    x="332"
                    y="38"
                    width="82"
                    height="168"
                    fill="#FFFFFF"
                    stroke="#E5E7EB"
                    strokeWidth="1.4"
                  />
                  <text
                    x="352"
                    y="62"
                    fill="#6B7280"
                    fontFamily="JetBrains Mono, monospace"
                    fontSize="14"
                    fontWeight="600"
                  >
                    {currentHub.bayNumber}
                  </text>
                  <line x1="332" y1="74" x2="414" y2="74" stroke="#E5E7EB" strokeWidth="1" />
                  <line x1="332" y1="104" x2="414" y2="104" stroke="#E5E7EB" strokeWidth="1" />
                  <line x1="332" y1="134" x2="414" y2="134" stroke="#E5E7EB" strokeWidth="1" />
                  <line x1="332" y1="164" x2="414" y2="164" stroke="#E5E7EB" strokeWidth="1" />
                  <line x1="332" y1="194" x2="414" y2="194" stroke="#E5E7EB" strokeWidth="1" />

                  {/* Ground Road Horizon Hairlines + Animated Moving Road Telemetry Line (moving rightwards) */}
                  <line x1="12" y1="208" x2="448" y2="208" stroke="#D1D5DB" strokeWidth="1.5" />
                  <line
                    x1="12"
                    y1="217"
                    x2="448"
                    y2="217"
                    stroke="#2563EB"
                    strokeOpacity="0.65"
                    strokeWidth="2"
                    className="svg-road-flow"
                  />
                  <line x1="12" y1="226" x2="448" y2="226" stroke="#E5E7EB" strokeWidth="1.2" />

                  {/* Pulsing Headlight Beam Cone projecting left */}
                  <polygon
                    points="92,163 2,144 2,188 86,177"
                    fill="url(#headlightConeLight)"
                    className="svg-headlight-pulse"
                  />

                  {/* Courier Van Body Silhouette */}
                  <path
                    d="M84 176 L88 152 L145 112 L348 112 L348 188 L90 188 C86 188 84 183 84 176 Z"
                    fill="url(#vanBodyLight)"
                    stroke="#111827"
                    strokeWidth="1.5"
                  />

                  {/* Cab Window */}
                  <path
                    d="M150 119 L196 119 L196 148 L112 148 L150 119 Z"
                    fill="#374151"
                    stroke="#4B5563"
                    strokeWidth="1.2"
                  />

                  {/* Cargo panel seam lines */}
                  <line x1="206" y1="114" x2="206" y2="184" stroke="#374151" strokeWidth="1" />
                  <line x1="86" y1="181" x2="346" y2="181" stroke="#374151" strokeWidth="1" />

                  {/* Side Branded Decal inside Cargo Area */}
                  <g transform="translate(212, 136)">
                    <polygon points="5,2 10,5 5,8 0,5" fill="#60A5FA" />
                    <polygon points="5,10 10,7 5,13 0,7" fill="#3B82F6" />
                    <text
                      x="15"
                      y="10"
                      fill="#FFFFFF"
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
                      fill="#9CA3AF"
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
                    fill="#3B82F6"
                    className="svg-headlight-pulse"
                  />
                  <ellipse cx="94" cy="166" rx="3" ry="1.5" fill="#FFFFFF" />

                  {/* Yellow Registration Plate: NEO 1 */}
                  <rect x="78" y="173" width="22" height="7" rx="1.2" fill="#FACC15" />
                  <text
                    x="81"
                    y="178.3"
                    fill="#111827"
                    fontFamily="JetBrains Mono, monospace"
                    fontSize="5.2"
                    fontWeight="700"
                  >
                    NEO 1
                  </text>

                  {/* Rear Taillight Accent */}
                  <rect x="345" y="158" width="3" height="14" rx="1" fill="#EF4444" opacity="0.9" />

                  {/* Front Wheel (Left) resting level on y=208 road surface */}
                  <g transform="translate(145, 188)">
                    <circle cx="0" cy="0" r="20" fill="#111827" stroke="#4B5563" strokeWidth="2.2" />
                    <g className="svg-wheel-spin">
                      <circle
                        cx="0"
                        cy="0"
                        r="12"
                        fill="#1F2937"
                        stroke="#60A5FA"
                        strokeOpacity="0.65"
                        strokeWidth="1.5"
                        strokeDasharray="6 6"
                      />
                      <line x1="-11" y1="0" x2="11" y2="0" stroke="#9CA3AF" strokeWidth="1.4" />
                      <line x1="0" y1="-11" x2="0" y2="11" stroke="#9CA3AF" strokeWidth="1.4" />
                    </g>
                    <circle cx="0" cy="0" r="4.5" fill="#3B82F6" />
                  </g>

                  {/* Rear Wheel (Right) resting level on y=208 road surface */}
                  <g transform="translate(302, 188)">
                    <circle cx="0" cy="0" r="20" fill="#111827" stroke="#4B5563" strokeWidth="2.2" />
                    <g className="svg-wheel-spin">
                      <circle
                        cx="0"
                        cy="0"
                        r="12"
                        fill="#1F2937"
                        stroke="#60A5FA"
                        strokeOpacity="0.65"
                        strokeWidth="1.5"
                        strokeDasharray="6 6"
                      />
                      <line x1="-11" y1="0" x2="11" y2="0" stroke="#9CA3AF" strokeWidth="1.4" />
                      <line x1="0" y1="-11" x2="0" y2="11" stroke="#9CA3AF" strokeWidth="1.4" />
                    </g>
                    <circle cx="0" cy="0" r="4.5" fill="#3B82F6" />
                  </g>
                </svg>
              </div>

              {/* Right 5 Cols: Clean Dispatch Activity & Status Rows */}
              <div className="lg:col-span-5 p-5 sm:p-6 bg-white flex flex-col justify-between">
                <div>
                  <div className="font-mono-tech text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#6B7280] mb-4">
                    LIVE DISPATCH STATUS
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3.5">
                      <div className="font-mono-tech text-[10px] uppercase tracking-[0.08em] text-[#6B7280] mb-1">
                        COLLECTION TARGET
                      </div>
                      <div className="font-mono-tech text-[20px] font-bold text-[#111827]">
                        Under 60 min
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3.5">
                      <div className="font-mono-tech text-[10px] uppercase tracking-[0.08em] text-[#6B7280] mb-1">
                        COVERAGE
                      </div>
                      <div className="font-mono-tech text-[20px] font-bold text-[#111827]">
                        UK &amp; EU 24/7
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-[12.5px]">
                    <div className="flex items-center justify-between py-2 border-b border-[#F3F4F6]">
                      <span className="flex items-center gap-2 text-[#4B5563]">
                        <MapPin className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                        <span>Active dispatch hub</span>
                      </span>
                      <span className="font-mono-tech font-medium text-[#111827]">
                        {currentHub.label}, Bay {currentHub.bayNumber}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-2 border-b border-[#F3F4F6]">
                      <span className="flex items-center gap-2 text-[#4B5563]">
                        <Clock className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                        <span>Average hub pickup</span>
                      </span>
                      <span className="font-mono-tech font-medium text-[#059669]">
                        {currentHub.avgCollectionMins} mins
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <span className="flex items-center gap-2 text-[#4B5563]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" aria-hidden="true" />
                        <span>Delivery method</span>
                      </span>
                      <span className="font-mono-tech font-medium text-[#111827]">
                        Direct, one vehicle
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-[#E5E7EB] flex items-center justify-between">
                  <span className="font-mono-tech text-[10.5px] text-[#6B7280] truncate pr-2">
                    {currentHub.corridor}
                  </span>
                  <a
                    href={BRAND_CONFIG.portalBookingUrl}
                    className="font-mono-tech text-[11px] font-semibold text-[#2563EB] hover:underline whitespace-nowrap shrink-0"
                  >
                    Book now
                  </a>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>

      {/* Bottom Metrics Band (matching Advertz.ai crisp off-white KPI row) */}
      <div className="w-full bg-[#FAFAFA] border-t border-b border-[#E5E7EB]">
        <div className="mx-auto max-w-[1160px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 py-12 sm:grid-cols-3 sm:gap-10 lg:py-16">
            {HERO_METRICS.map((stat, idx) => (
              <ScrollReveal
                key={stat.id}
                delayMs={idx * 75}
                className="flex flex-col sm:border-l sm:first:border-l-0 sm:pl-8 sm:first:pl-0 border-[#E5E7EB]"
              >
                <div className="text-[36px] sm:text-[42px] font-bold tracking-[-0.03em] leading-none text-[#111827] mb-2.5">
                  {stat.id === 'collection-time' ? (
                    <AnimatedCounter target={60} decimals={0} suffix=" min" />
                  ) : stat.id === 'recovery-rate' ? (
                    <AnimatedCounter target={98.7} decimals={1} suffix="%" />
                  ) : (
                    stat.value
                  )}
                </div>
                <div className="text-[13.5px] sm:text-[14px] leading-snug text-[#4B5563] max-w-[28ch]">
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

import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, SlidersHorizontal, Package, Weight, Maximize } from 'lucide-react';
import {
  BRAND_CONFIG,
  DISPATCH_HUBS,
  FLEET_VEHICLES,
  FleetVehicle,
} from '../data/siteContent';
import { calculateDispatchEstimate } from '../utils/logisticsLogic';
import { ScrollReveal } from './MotionPrimitives';

const AnimatedWheel: React.FC<{ cx: number; cy: number; r: number; innerR: number }> = ({
  cx,
  cy,
  r,
  innerR,
}) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill="#070B12" stroke="#475569" strokeWidth="2.2" />
    <g className="svg-wheel-spin" style={{ transformOrigin: `${cx}px ${cy}px` }}>
      <circle cx={cx} cy={cy} r={innerR} fill="#1E293B" stroke="#3898FF" strokeWidth="1.2" strokeDasharray="4 3" />
      <line x1={cx - innerR} y1={cy} x2={cx + innerR} y2={cy} stroke="#64748B" strokeWidth="1.4" />
      <line x1={cx} y1={cy - innerR} x2={cx} y2={cy + innerR} stroke="#64748B" strokeWidth="1.4" />
    </g>
    <circle cx={cx} cy={cy} r={3} fill="#3898FF" />
  </g>
);

const FleetSilhouetteSvg: React.FC<{ type: FleetVehicle['silhouetteType']; code: string }> = ({
  type,
  code,
}) => {
  return (
    <svg
      viewBox="0 0 540 210"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
      role="img"
      aria-label={`Technical architectural profile of ${code}`}
    >
      <defs>
        <linearGradient id={`beam-${type}`} x1="85" y1="145" x2="5" y2="132" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2E90FA" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#2E90FA" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`body-${type}`} x1="80" y1="50" x2="460" y2="170" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#131E35" />
          <stop offset="100%" stopColor="#090F1C" />
        </linearGradient>
      </defs>

      {/* Subtle Technical Grid Lines */}
      <line x1="20" y1="35" x2="520" y2="35" stroke="#162032" strokeDasharray="3 3" />
      <line x1="20" y1="172" x2="520" y2="172" stroke="#1E293B" strokeWidth="1.5" />

      {/* Moving Road-Line Telemetry Animation */}
      <line
        x1="20"
        y1="181"
        x2="520"
        y2="181"
        stroke="#2E90FA"
        strokeWidth="2"
        strokeDasharray="16 20"
        strokeOpacity="0.65"
        className="svg-road-flow"
      />
      <line x1="20" y1="192" x2="520" y2="192" stroke="#162032" strokeWidth="1" />

      {/* Pulsing Headlight Cone */}
      <polygon
        points="88,138 6,120 6,162 84,154"
        fill={`url(#beam-${type})`}
        className="svg-headlight-pulse"
      />

      {type === 'small-van' && (
        <g>
          <path
            d="M84 152 L90 128 L145 92 L320 92 L320 162 L90 162 C86 162 84 158 84 152 Z"
            fill={`url(#body-${type})`}
            stroke="#3898FF"
            strokeWidth="1.5"
          />
          <path d="M148 98 L195 98 L195 126 L112 126 L148 98 Z" fill="#060A12" stroke="#26354D" />
          <line x1="204" y1="94" x2="204" y2="160" stroke="#1E293B" />
          <text x="218" y="125" fill="#F8FAFC" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="11" fontWeight="800">
            NEO TRANSPORT
          </text>
          <text x="218" y="136" fill="#3898FF" fontFamily="JetBrains Mono, monospace" fontSize="7">
            SMALL RAPID VAN • 400KG
          </text>
          <rect x="78" y="148" width="20" height="6" rx="1" fill="#FACC15" />
          <AnimatedWheel cx={138} cy={164} r={19} innerR={9} />
          <AnimatedWheel cx={282} cy={164} r={19} innerR={9} />
        </g>
      )}

      {type === 'swb-lwb' && (
        <g>
          <path
            d="M80 152 L86 124 L142 80 L380 80 L380 162 L86 162 C82 162 80 158 80 152 Z"
            fill={`url(#body-${type})`}
            stroke="#3898FF"
            strokeWidth="1.5"
          />
          <path d="M146 87 L194 87 L194 120 L108 120 L146 87 Z" fill="#060A12" stroke="#26354D" />
          <line x1="204" y1="82" x2="204" y2="160" stroke="#1E293B" />
          <text x="224" y="118" fill="#F8FAFC" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="12.5" fontWeight="800">
            NEO TRANSPORT
          </text>
          <text x="224" y="131" fill="#3898FF" fontFamily="JetBrains Mono, monospace" fontSize="7.5">
            SWB / LWB • UP TO 3 PALLETS
          </text>
          <rect x="74" y="148" width="20" height="6" rx="1" fill="#FACC15" />
          <AnimatedWheel cx={140} cy={164} r={21} innerR={10} />
          <AnimatedWheel cx={336} cy={164} r={21} innerR={10} />
        </g>
      )}

      {type === 'xlwb' && (
        <g>
          <path
            d="M72 152 L78 122 L134 72 L438 72 L438 162 L78 162 C74 162 72 158 72 152 Z"
            fill={`url(#body-${type})`}
            stroke="#3898FF"
            strokeWidth="1.5"
          />
          <path d="M138 80 L186 80 L186 118 L100 118 L138 80 Z" fill="#060A12" stroke="#26354D" />
          <line x1="196" y1="74" x2="196" y2="160" stroke="#1E293B" />
          <line x1="316" y1="74" x2="316" y2="160" stroke="#162032" strokeDasharray="2 2" />
          <text x="225" y="114" fill="#F8FAFC" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="13" fontWeight="800">
            NEO TRANSPORT
          </text>
          <text x="225" y="128" fill="#3898FF" fontFamily="JetBrains Mono, monospace" fontSize="8">
            XLWB HIGH-CUBE • 4.2M LOAD BED • 4 PALLETS
          </text>
          <rect x="66" y="148" width="20" height="6" rx="1" fill="#FACC15" />
          <AnimatedWheel cx={134} cy={164} r={21} innerR={10} />
          <AnimatedWheel cx={382} cy={164} r={21} innerR={10} />
        </g>
      )}

      {type === 'luton' && (
        <g>
          {/* Cab */}
          <path
            d="M76 152 L82 124 L128 88 L184 88 L184 162 L82 162 Z"
            fill="#0D1628"
            stroke="#334155"
            strokeWidth="1.5"
          />
          <path d="M130 94 L174 94 L174 122 L98 122 L130 94 Z" fill="#060A12" stroke="#26354D" />
          {/* Luton Box Body with Over-Cab Pod */}
          <path
            d="M122 56 L442 56 L442 158 L184 158 L184 84 L122 84 Z"
            fill={`url(#body-${type})`}
            stroke="#3898FF"
            strokeWidth="1.6"
          />
          {/* Hydraulic Tail-Lift Assembly at Rear */}
          <rect x="442" y="118" width="8" height="42" fill="#2E90FA" />
          <line x1="450" y1="158" x2="482" y2="158" stroke="#3898FF" strokeWidth="3" />
          <text x="225" y="106" fill="#F8FAFC" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="14" fontWeight="800">
            NEO TRANSPORT
          </text>
          <text x="225" y="121" fill="#3898FF" fontFamily="JetBrains Mono, monospace" fontSize="8">
            NT-25012 • LUTON BOX + 500KG TAIL-LIFT
          </text>
          <rect x="70" y="148" width="20" height="6" rx="1" fill="#FACC15" />
          <AnimatedWheel cx={134} cy={164} r={21} innerR={10} />
          <AnimatedWheel cx={386} cy={164} r={21} innerR={10} />
        </g>
      )}

      {type === 'rigid-75t' && (
        <g>
          {/* HGV Rigid Cab */}
          <path
            d="M66 154 L66 106 L104 72 L166 72 L166 160 L66 160 Z"
            fill="#0D1628"
            stroke="#334155"
            strokeWidth="1.5"
          />
          <path d="M106 80 L154 80 L154 114 L78 114 L106 80 Z" fill="#060A12" stroke="#26354D" />
          {/* 7.5T Heavy Box Body */}
          <rect
            x="170"
            y="48"
            width="310"
            height="110"
            rx="2"
            fill={`url(#body-${type})`}
            stroke="#3898FF"
            strokeWidth="1.6"
          />
          {/* Heavy Tail-Lift */}
          <rect x="480" y="108" width="9" height="50" fill="#2E90FA" />
          <line x1="489" y1="156" x2="522" y2="156" stroke="#3898FF" strokeWidth="3.5" />
          <text x="230" y="102" fill="#F8FAFC" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="15" fontWeight="800">
            NEO TRANSPORT
          </text>
          <text x="230" y="118" fill="#3898FF" fontFamily="JetBrains Mono, monospace" fontSize="8.5">
            NT-25102 • 7.5T RIGID • 10 PALLETS • 2,500KG
          </text>
          <rect x="60" y="148" width="22" height="6" rx="1" fill="#FACC15" />
          <AnimatedWheel cx={122} cy={164} r={22} innerR={11} />
          <AnimatedWheel cx={412} cy={164} r={22} innerR={11} />
        </g>
      )}
    </svg>
  );
};

export const FleetSpecs: React.FC = () => {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('luton-tail-lift');

  // Refs & state for smooth sliding active blue pill background
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pillGeometry, setPillGeometry] = useState<{ left: number; width: number; height: number } | null>(null);

  useEffect(() => {
    const updatePill = () => {
      const btn = tabRefs.current[selectedVehicleId];
      if (btn) {
        setPillGeometry({
          left: btn.offsetLeft,
          width: btn.offsetWidth,
          height: btn.offsetHeight,
        });
      }
    };
    updatePill();
    window.addEventListener('resize', updatePill);
    return () => window.removeEventListener('resize', updatePill);
  }, [selectedVehicleId]);

  // Interactive Load Matcher state
  const [originHubId, setOriginHubId] = useState<string>('manchester');
  const [destinationCity, setDestinationCity] = useState<string>('Birmingham');
  const [palletCount, setPalletCount] = useState<number>(4);
  const [weightKg, setWeightKg] = useState<number>(850);
  const [requiresTailLift, setRequiresTailLift] = useState<boolean>(true);

  const selectedVehicle =
    FLEET_VEHICLES.find((v) => v.id === selectedVehicleId) || FLEET_VEHICLES[3];

  const dispatchEstimate = calculateDispatchEstimate({
    originHubId,
    destinationCity,
    palletCount,
    weightKg,
    requiresTailLift,
    isUrgentStandby: true,
  });

  return (
    <section
      id="fleet"
      aria-labelledby="fleet-heading"
      className="py-16 sm:py-20 lg:py-24 scroll-mt-16"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <ScrollReveal className="max-w-3xl mb-10 lg:mb-12">
          <div className="font-mono-tech text-[12px] font-semibold uppercase tracking-[0.12em] text-[#3898FF] mb-3">
            — DEDICATED FLEET &amp; PAYLOAD TELEMETRY
          </div>
          <h2
            id="fleet-heading"
            className="section-h2 mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            Engineered Fleet Classes From Rapid Courier Vans to 7.5T Rigids
          </h2>
          <p
            className="text-[16px] leading-[1.6]"
            style={{ color: 'var(--text-secondary)' }}
          >
            Select a vehicle class below to inspect verified load-bed dimensions, Euro/UK pallet
            capacities, and tail-lift specifications—or use the interactive load matcher to auto-assign
            the optimal vehicle for your consignment.
          </p>
        </ScrollReveal>

        {/* Horizontal Swipeable Vehicle Class Selector Tabs (zero scrollbar + smooth sliding active blue pill) */}
        <ScrollReveal delayMs={75}>
          <div
            role="tablist"
            aria-label="NEO Transport Fleet Classes"
            className="relative flex items-center gap-2.5 overflow-x-auto pb-2 mb-8 no-scrollbar"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* Smooth Sliding Blue Pill Background */}
            {pillGeometry && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-0 left-0 rounded-full bg-[#2E90FA]"
                style={{
                  width: `${pillGeometry.width}px`,
                  height: `${pillGeometry.height}px`,
                  transform: `translateX(${pillGeometry.left}px)`,
                  transition:
                    'transform 300ms cubic-bezier(0.22, 1, 0.36, 1), width 300ms cubic-bezier(0.22, 1, 0.36, 1)',
                  boxShadow: '0 4px 18px rgba(46, 144, 250, 0.38)',
                }}
              />
            )}

            {FLEET_VEHICLES.map((vehicle) => {
              const active = vehicle.id === selectedVehicleId;
              return (
                <button
                  key={vehicle.id}
                  ref={(el) => {
                    tabRefs.current[vehicle.id] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedVehicleId(vehicle.id)}
                  className={`relative z-10 flex items-center gap-2.5 rounded-full px-5 py-2.5 text-[13.5px] font-semibold transition-colors duration-200 whitespace-nowrap cursor-pointer ${
                    active ? 'text-white' : 'hover:border-[#2E90FA]/50'
                  }`}
                  style={
                    !active
                      ? {
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                        }
                      : {
                          backgroundColor: pillGeometry ? 'transparent' : '#2E90FA',
                          border: '1px solid transparent',
                        }
                  }
                >
                  <span>{vehicle.shortName}</span>
                  <span
                    className={`font-mono-tech text-[10.5px] px-2 py-0.5 rounded-full transition-colors ${
                      active
                        ? 'bg-black/25 text-white'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {vehicle.pallets} pallets
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollReveal>

        {/* Main Fleet Showcase Grid (7 cols Active Vehicle Spec / 5 cols Interactive Load Matcher) */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left 7 Cols: Active Vehicle Architectural Card */}
          <ScrollReveal delayMs={120} className="lg:col-span-7 h-full">
            <div className="neo-card rounded-2xl overflow-hidden h-full flex flex-col justify-between">
              <div>
                {/* Top Telemetry Bar */}
                <div
                  className="flex flex-wrap items-center justify-between gap-2 px-6 py-4"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-[#10B981] telemetry-dot" aria-hidden="true" />
                    <span
                      className="font-mono-tech text-[11.5px] font-semibold uppercase tracking-[0.09em]"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {selectedVehicle.code}
                    </span>
                  </div>

                  <span
                    className="font-mono-tech text-[10.5px] font-semibold uppercase tracking-[0.09em] px-3 py-1 rounded-full"
                    style={{
                      color: '#3898FF',
                      backgroundColor: 'rgba(46, 144, 250, 0.1)',
                      border: '1px solid rgba(46, 144, 250, 0.28)',
                    }}
                  >
                    {selectedVehicle.badge}
                  </span>
                </div>

                {/* SVG Architectural Vehicle Diagram with Animated Road, Headlight & Wheels */}
                <div
                  className="px-6 py-5"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <FleetSilhouetteSvg
                    type={selectedVehicle.silhouetteType}
                    code={selectedVehicle.code}
                  />
                </div>

                {/* Vehicle Details & Dimension Telemetry Badges */}
                <div className="p-6">
                  <h3
                    className="text-[22px] font-bold tracking-tight mb-2"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {selectedVehicle.name}
                  </h3>
                  <p
                    className="text-[14.5px] leading-[1.6] mb-6"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {selectedVehicle.tagline}
                  </p>

                  {/* 5-Column Dimension & Payload Telemetry Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                    <div
                      className="rounded-xl p-3"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div className="font-mono-tech text-[10px] uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--text-muted)' }}>
                        LENGTH
                      </div>
                      <div className="font-mono-tech text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        {selectedVehicle.lengthM}
                      </div>
                    </div>

                    <div
                      className="rounded-xl p-3"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div className="font-mono-tech text-[10px] uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--text-muted)' }}>
                        WIDTH
                      </div>
                      <div className="font-mono-tech text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        {selectedVehicle.widthM}
                      </div>
                    </div>

                    <div
                      className="rounded-xl p-3"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div className="font-mono-tech text-[10px] uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--text-muted)' }}>
                        HEIGHT
                      </div>
                      <div className="font-mono-tech text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        {selectedVehicle.heightM}
                      </div>
                    </div>

                    <div
                      className="rounded-xl p-3"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div className="font-mono-tech text-[10px] uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--text-muted)' }}>
                        PALLETS
                      </div>
                      <div className="font-mono-tech text-[15px] font-bold text-[#3898FF]">
                        {selectedVehicle.pallets}
                      </div>
                    </div>

                    <div
                      className="rounded-xl p-3 col-span-2 sm:col-span-1"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div className="font-mono-tech text-[10px] uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--text-muted)' }}>
                        MAX WEIGHT
                      </div>
                      <div className="font-mono-tech text-[15px] font-bold text-[#10B981]">
                        {selectedVehicle.maxPayloadLabel}
                      </div>
                    </div>
                  </div>

                  {/* Ideal Applications */}
                  <div className="flex flex-wrap gap-2">
                    {selectedVehicle.idealFor.map((useCase) => (
                      <span
                        key={useCase}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px]"
                        style={{
                          backgroundColor: 'var(--bg-canvas)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#2E90FA]" aria-hidden="true" />
                        <span>{useCase}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer Bar */}
              <div
                className="px-6 py-4 flex flex-wrap items-center justify-between gap-3"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                <span className="font-mono-tech text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                  LOADING: {selectedVehicle.loadingType.toUpperCase()}
                </span>
                <a
                  href={BRAND_CONFIG.portalBookingUrl}
                  className="inline-flex items-center gap-2 rounded-full bg-[#2E90FA] hover:bg-[#1D7FEA] px-4 py-2 text-[12.5px] font-semibold text-white transition-colors"
                >
                  <span>Book {selectedVehicle.shortName}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          </ScrollReveal>

          {/* Right 5 Cols: Interactive Consignment & Fleet Auto-Matcher */}
          <ScrollReveal delayMs={195} className="lg:col-span-5 h-full">
            <div className="neo-card rounded-2xl p-6 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 pb-4 mb-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-[#2E90FA]" aria-hidden="true" />
                    <span className="font-mono-tech text-[11.5px] font-semibold uppercase tracking-[0.09em]" style={{ color: 'var(--text-primary)' }}>
                      INSTANT FLEET &amp; SLA CALCULATOR
                    </span>
                  </div>
                  <span className="font-mono-tech text-[10.5px] text-[#10B981] uppercase">
                    LIVE TELEMETRY
                  </span>
                </div>

                {/* Origin & Destination Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
                  <div>
                    <label
                      htmlFor="calc-origin-hub"
                      className="block font-mono-tech text-[10.5px] uppercase tracking-[0.08em] mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Origin Dispatch Hub
                    </label>
                    <select
                      id="calc-origin-hub"
                      value={originHubId}
                      onChange={(e) => setOriginHubId(e.target.value)}
                      className="w-full rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {DISPATCH_HUBS.map((hub) => (
                        <option key={hub.id} value={hub.id}>
                          {hub.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="calc-dest-city"
                      className="block font-mono-tech text-[10.5px] uppercase tracking-[0.08em] mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Destination Corridor
                    </label>
                    <select
                      id="calc-dest-city"
                      value={destinationCity}
                      onChange={(e) => setDestinationCity(e.target.value)}
                      className="w-full rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <option value="Birmingham">Birmingham</option>
                      <option value="Manchester">Manchester</option>
                      <option value="London M25">London M25</option>
                      <option value="Leeds">Leeds</option>
                      <option value="Bristol">Bristol</option>
                      <option value="Glasgow">Glasgow</option>
                      <option value="Calais / EU Gateway">Calais / EU Gateway</option>
                    </select>
                  </div>
                </div>

                {/* Pallet Count Slider */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="calc-pallets"
                      className="flex items-center gap-1.5 font-mono-tech text-[11px] uppercase tracking-[0.08em]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <Package className="h-3.5 w-3.5 text-[#2E90FA]" aria-hidden="true" />
                      <span>Standard Pallets</span>
                    </label>
                    <span className="font-mono-tech text-[13px] font-bold text-[#3898FF]">
                      {palletCount} {palletCount === 1 ? 'Pallet' : 'Pallets'}
                    </span>
                  </div>
                  <input
                    id="calc-pallets"
                    type="range"
                    min={1}
                    max={10}
                    value={palletCount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPalletCount(val);
                      const matched = calculateDispatchEstimate({
                        originHubId,
                        destinationCity,
                        palletCount: val,
                        weightKg,
                        requiresTailLift,
                        isUrgentStandby: true,
                      });
                      setSelectedVehicleId(matched.recommendedVehicle.id);
                    }}
                    className="w-full accent-[#2E90FA] cursor-pointer"
                  />
                </div>

                {/* Consignment Weight Slider */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="calc-weight"
                      className="flex items-center gap-1.5 font-mono-tech text-[11px] uppercase tracking-[0.08em]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <Weight className="h-3.5 w-3.5 text-[#2E90FA]" aria-hidden="true" />
                      <span>Total Payload Weight</span>
                    </label>
                    <span className="font-mono-tech text-[13px] font-bold text-[#3898FF]">
                      {weightKg} kg
                    </span>
                  </div>
                  <input
                    id="calc-weight"
                    type="range"
                    min={50}
                    max={2500}
                    step={50}
                    value={weightKg}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setWeightKg(val);
                      const matched = calculateDispatchEstimate({
                        originHubId,
                        destinationCity,
                        palletCount,
                        weightKg: val,
                        requiresTailLift,
                        isUrgentStandby: true,
                      });
                      setSelectedVehicleId(matched.recommendedVehicle.id);
                    }}
                    className="w-full accent-[#2E90FA] cursor-pointer"
                  />
                </div>

                {/* Tail-Lift Requirement Toggle */}
                <div className="mb-6">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={requiresTailLift}
                    onClick={() => {
                      const next = !requiresTailLift;
                      setRequiresTailLift(next);
                      const matched = calculateDispatchEstimate({
                        originHubId,
                        destinationCity,
                        palletCount,
                        weightKg,
                        requiresTailLift: next,
                        isUrgentStandby: true,
                      });
                      setSelectedVehicleId(matched.recommendedVehicle.id);
                    }}
                    className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-left transition-colors cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      border: requiresTailLift
                        ? '1px solid rgba(46, 144, 250, 0.5)'
                        : '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <Maximize className="h-4 w-4 text-[#2E90FA]" aria-hidden="true" />
                      <div>
                        <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                          Hydraulic Tail-Lift &amp; Pump Truck
                        </div>
                        <div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                          Required if collection/delivery site has no forklift
                        </div>
                      </div>
                    </div>
                    <span
                      className={`font-mono-tech text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                        requiresTailLift
                          ? 'bg-[#2E90FA]/20 text-[#3898FF]'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {requiresTailLift ? 'REQUIRED' : 'OPTIONAL'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Matched Vehicle Telemetry Output */}
              <div
                className="rounded-xl p-4"
                style={{
                  backgroundColor: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono-tech text-[10.5px] uppercase tracking-[0.09em]" style={{ color: 'var(--text-muted)' }}>
                    RECOMMENDED ALLOCATION
                  </span>
                  <span
                    className="font-mono-tech text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      color: 'var(--status-green)',
                      backgroundColor: 'var(--status-green-bg)',
                      border: '1px solid var(--status-green-border)',
                    }}
                  >
                    COLLECTION ≤ {dispatchEstimate.estimatedCollectionMins} MIN
                  </span>
                </div>

                <div className="text-[17px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {dispatchEstimate.recommendedVehicle.name}
                </div>
                <div className="font-mono-tech text-[11.5px] mb-4" style={{ color: 'var(--text-secondary)' }}>
                  {dispatchEstimate.dispatchSummary}
                </div>

                <a
                  href={BRAND_CONFIG.portalBookingUrl}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#2E90FA] hover:bg-[#1D7FEA] px-5 text-[13.5px] font-semibold text-white transition-colors"
                >
                  <span>Book {dispatchEstimate.recommendedVehicle.shortName}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
};

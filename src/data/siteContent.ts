export interface MetricItem {
  id: string;
  value: string;
  label: string;
}

export interface HubTelemetry {
  id: string;
  code: string;
  label: string;
  bayNumber: string;
  activeVehicles: number;
  avgCollectionMins: number;
  corridor: string;
  coordinates: string;
}

export interface StandbyPillar {
  id: string;
  index: string;
  title: string;
  badge: string;
  description: string;
  metricLabel: string;
  metricValue: string;
}

export interface ServiceItem {
  id: string;
  index: string;
  title: string;
  code: string;
  slaBadge: string;
  description: string;
  capabilities: string[];
  featured?: boolean;
  portalPath: string;
}

export interface FleetVehicle {
  id: string;
  code: string;
  name: string;
  shortName: string;
  badge: string;
  tagline: string;
  lengthM: string;
  widthM: string;
  heightM: string;
  pallets: string;
  maxPayloadKg: number;
  maxPayloadLabel: string;
  loadingType: string;
  idealFor: string[];
  silhouetteType: 'small-van' | 'swb-lwb' | 'xlwb' | 'luton' | 'rigid-75t';
}

export interface WorkflowStep {
  stepNumber: string;
  code: string;
  title: string;
  description: string;
  slaNote: string;
}

export interface PortalJob {
  id: string;
  route: string;
  vehicleCode: string;
  vehicleType: string;
  transitNote: string;
  status?: 'IN_TRANSIT' | 'SCHEDULED';
}

export interface PortalKpi {
  id: string;
  value: string;
  label: string;
  badgeText: string;
  badgeTone: 'blue' | 'amber' | 'green';
  iconName: 'truck' | 'zap' | 'credit-card' | 'file-text';
}

export interface IndustryVertical {
  id: string;
  code: string;
  title: string;
  description: string;
  typicalLoads: string;
  slaCommitment: string;
  iconName: 'shopping-bag' | 'hard-hat' | 'utensils' | 'sprout' | 'clapperboard' | 'printer';
}

export interface FaqItem {
  id: string;
  code: string;
  question: string;
  answer: string;
  category: 'Operations' | 'Standby Account' | 'Portal & Tracking' | 'Coverage';
}

export const BRAND_CONFIG = {
  companyName: 'NEO TRANSPORT',
  logoUrl: 'https://admin.neotransport.co.uk/brand/logos/neo-transport-full-blue-white.svg',
  subLabel: 'UK & EU SAME DAY COURIER SPECIALISTS',
  portalSubLabel: 'CUSTOMER PORTAL',
  publicDomain: 'neotransport.co.uk',
  portalUrl: 'https://admin.neotransport.co.uk/',
  portalLoginUrl: 'https://admin.neotransport.co.uk/',
  portalOnboardingUrl: 'https://admin.neotransport.co.uk/',
  portalBookingUrl: 'https://admin.neotransport.co.uk/',
  portalTrackingUrl: 'https://admin.neotransport.co.uk/?action=live-tracking',
  portalQuotesUrl: 'https://admin.neotransport.co.uk/?action=quotes',
  portalPodUrl: 'https://admin.neotransport.co.uk/?action=documents',
  portalInvoicesUrl: 'https://admin.neotransport.co.uk/?action=invoices',
  dispatchPhoneDisplay: '0800 246 8135',
  dispatchPhoneHref: 'tel:08002468135',
  dispatchResponseAvg: 'Avg. response 3 min',
  standbyMonthlyFee: '£0',
  standbySetupNote: '60-second setup • No commitment',
} as const;

export const HERO_METRICS: MetricItem[] = [
  {
    id: 'collection-time',
    value: '60 min',
    label: 'Average emergency collection time nationwide',
  },
  {
    id: 'recovery-rate',
    value: '98.7%',
    label: 'Same-day delivery recovery success rate',
  },
  {
    id: 'coverage-scope',
    value: 'Nationwide',
    label: 'UK mainland & European emergency road hubs',
  },
];

export const DISPATCH_HUBS: HubTelemetry[] = [
  {
    id: 'manchester',
    code: 'HUB • MANCHESTER, UK',
    label: 'Manchester Hub',
    bayNumber: '23',
    activeVehicles: 6,
    avgCollectionMins: 42,
    corridor: 'M6 / M62 / M60 North West & Trans-Pennine',
    coordinates: '53.4808° N, 2.2426° W',
  },
  {
    id: 'birmingham',
    code: 'HUB • BIRMINGHAM, UK',
    label: 'Birmingham Hub',
    bayNumber: '14',
    activeVehicles: 4,
    avgCollectionMins: 38,
    corridor: 'M6 / M5 / M42 Midlands Logistics Triangle',
    coordinates: '52.4862° N, 1.8904° W',
  },
  {
    id: 'london-m25',
    code: 'HUB • LONDON M25, UK',
    label: 'London M25 Hub',
    bayNumber: '08',
    activeVehicles: 4,
    avgCollectionMins: 45,
    corridor: 'M25 / M1 / M4 / A20 Channel Port Gateway',
    coordinates: '51.5072° N, 0.1276° W',
  },
];

export const STANDBY_PILLARS: StandbyPillar[] = [
  {
    id: 'around-the-clock',
    index: '01',
    title: 'Around the Clock (24/7/365)',
    badge: 'COLLECTION SLA • ≤ 60 MIN',
    description:
      'Nationwide same-day collections within 60 minutes, with dedicated vehicle delivery day or night across the UK and Europe. Whenever your schedule demands rapid response, our fleet rolls out immediately.',
    metricLabel: 'DISPATCH AVAILABILITY',
    metricValue: '24/7/365 • UK & EU',
  },
  {
    id: 'deliver-full-speed',
    index: '02',
    title: 'Deliver at Full Speed',
    badge: 'LIVE PORTAL TELEMETRY',
    description:
      'Real-time delivery management lets you book same-day shipments, view live GPS ETAs, download instant POD signatures, and track consignments online day or night via the Customer Portal.',
    metricLabel: 'ON-TIME RECOVERY SLA',
    metricValue: '98.7% Same-Day',
  },
  {
    id: 'here-for-you',
    index: '03',
    title: 'Here for You & Dedicated Support',
    badge: '24/7 SUPPORT + £0 STANDBY',
    description:
      'Our operations team is here for you whenever you need us to ensure your shipments run smoothly—including a pre-approved £0-monthly-fee Standby Account ready the moment a primary carrier lets you down.',
    metricLabel: 'DISPATCH DESK & STANDBY',
    metricValue: '3-Min Response • £0 Retainer',
  },
];

export const LOGISTICS_SERVICES: ServiceItem[] = [
  {
    id: 'same-day-delivery',
    index: '01',
    title: 'Same Day Delivery',
    code: 'SVC-01 • POINT-TO-POINT',
    slaBadge: '60-MIN COLLECTION',
    description:
      'Rapid 60-minute nationwide collection with dedicated point-to-point courier transit. Zero hub transloading or cargo co-mingling from pickup to final signature.',
    capabilities: ['Dedicated sole-use vehicle', 'Direct transit to consignee', 'Live GPS portal link'],
    featured: true,
    portalPath: 'https://admin.neotransport.co.uk/?service=same-day',
  },
  {
    id: 'full-half-day-rates',
    index: '02',
    title: 'Full Day & Half Day Rates',
    code: 'SVC-02 • CONTRACT FLEET',
    slaBadge: 'DEDICATED HIRE',
    description:
      'Dedicated vehicle and driver hire for scheduled business operations, seasonal volume surges, and recurring inter-branch contract runs.',
    capabilities: ['Fixed half-day or full-day tariff', 'Uniformed ADR-trained operatives', 'Custom manifest integration'],
    portalPath: 'https://admin.neotransport.co.uk/?service=day-rates',
  },
  {
    id: 'multi-drop-delivery',
    index: '03',
    title: 'Multi-Drop Delivery',
    code: 'SVC-03 • ROUTE OPTIMISED',
    slaBadge: 'PER-STOP POD',
    description:
      'Optimised multi-stop routing with real-time ETA telemetry and instant per-stop digital POD capture across regional or nationwide distribution schedules.',
    capabilities: ['Dynamic sequence optimisation', 'Per-drop digital signature & photo', 'Live exception alerts'],
    portalPath: 'https://admin.neotransport.co.uk/?service=multi-drop',
  },
  {
    id: 'european-road-transport',
    index: '04',
    title: 'European Road Transport',
    code: 'SVC-04 • UK & EU CORRIDOR',
    slaBadge: 'CROSS-BORDER DIRECT',
    description:
      'Direct cross-border dedicated vans and rigid trucks across UK mainland and EU corridors with coordinated customs clearance and unaccompanied/accompanied transit.',
    capabilities: ['Door-to-door UK ↔ EU express', 'T1/T2 customs documentation support', 'Single-driver or double-manned'],
    featured: true,
    portalPath: 'https://admin.neotransport.co.uk/?service=european-road',
  },
  {
    id: 'irregular-and-oversize',
    index: '05',
    title: 'Irregular and Oversize',
    code: 'SVC-05 • OUT-OF-GAUGE',
    slaBadge: 'SPECIALIST LOAD',
    description:
      'Specialist handling for non-standard palletised, fragile, long-length, or out-of-gauge commercial cargo requiring bespoke load restraint and strapping.',
    capabilities: ['Heavy-duty ratchet & load bars', 'No conveyor belt handling', 'Site-specific RAMS compliance'],
    portalPath: 'https://admin.neotransport.co.uk/?service=irregular-oversize',
  },
  {
    id: 'full-load-solutions',
    index: '06',
    title: 'Full Load Solutions',
    code: 'SVC-06 • FTL CAPACITY',
    slaBadge: 'BULK PALLET TRANSIT',
    description:
      'Dedicated Full Truck Load (FTL) capacity for high-volume warehouse-to-warehouse, linehaul, and manufacturing plant transfers on tight dock windows.',
    capabilities: ['Timed booking-slot adherence', 'Sealed direct trunking', 'Real-time dispatch telemetry'],
    portalPath: 'https://admin.neotransport.co.uk/?service=full-load',
  },
  {
    id: 'two-man-delivery',
    index: '07',
    title: 'Two-Man Delivery',
    code: 'SVC-07 • DUAL OPERATIVE',
    slaBadge: 'WHITE-GLOVE SITE',
    description:
      'White-glove dual-operative transport for heavy, high-value, or complex commercial installations requiring room-of-choice placement and packaging removal.',
    capabilities: ['Two vetted logistics specialists', 'Tail-lift & stair-walker equipped', 'Room-of-choice positioning'],
    portalPath: 'https://admin.neotransport.co.uk/?service=two-man',
  },
  {
    id: 'air-freight',
    index: '08',
    title: 'Air Freight',
    code: 'SVC-08 • NEXT-FLIGHT-OUT',
    slaBadge: 'INTERNATIONAL CRITICAL',
    description:
      'Next-flight-out (NFO), onboard courier, and coordinated air cargo logistics with dedicated tarmac-to-door road transfer for time-critical international shipments.',
    capabilities: ['UK major airport hub transfers', 'Priority air waybill coordination', 'End-to-end chain of custody'],
    portalPath: 'https://admin.neotransport.co.uk/?service=air-freight',
  },
];

export const FLEET_VEHICLES: FleetVehicle[] = [
  {
    id: 'small-van',
    code: 'CLASS 01 • SMALL COURIER VAN',
    name: 'Small Courier Van',
    shortName: 'Small Van',
    badge: 'RAPID RESPONSE • 1 EURO PALLET',
    tagline: 'Agile urban and motorway response vehicle for urgent documents, AOG parts, medical samples, and single-pallet consignments.',
    lengthM: '1.7m',
    widthM: '1.2m',
    heightM: '1.2m',
    pallets: 'Up to 1',
    maxPayloadKg: 400,
    maxPayloadLabel: '400kg',
    loadingType: 'Rear & side sliding doors',
    idealFor: ['Urgent engineering & AOG parts', 'Single Euro/UK pallet', 'High-security medical & IT hardware'],
    silhouetteType: 'small-van',
  },
  {
    id: 'swb-lwb',
    code: 'CLASS 02 • SWB & LWB TRANSIT',
    name: 'Short & Long Wheelbase (SWB / LWB)',
    shortName: 'SWB & LWB',
    badge: 'COMMERCIAL STANDARD • UP TO 3 PALLETS',
    tagline: 'Versatile medium-to-long wheelbase commercial vans engineered for rapid inter-depot pallet transfers and multi-drop commercial routes.',
    lengthM: '2.7m – 3.3m',
    widthM: '1.2m – 1.7m',
    heightM: '1.4m – 1.7m',
    pallets: 'Up to 3',
    maxPayloadKg: 1200,
    maxPayloadLabel: '900kg – 1200kg',
    loadingType: 'Forklift rear/side load',
    idealFor: ['Standard commercial pallet loads', 'Retail stock replenishment', 'Regional multi-drop schedules'],
    silhouetteType: 'swb-lwb',
  },
  {
    id: 'xlwb',
    code: 'CLASS 03 • EXTRA LONG WHEELBASE',
    name: 'Extra Long Wheelbase (XLWB)',
    shortName: 'XLWB High-Cube',
    badge: 'HIGH-CUBE EXPRESS • UP TO 4 PALLETS',
    tagline: 'Maximum non-HGV motorway speed combined with extended 4.2m load bed length for bulky freight, long extrusions, and 4-pallet emergency recoveries.',
    lengthM: '4.2m',
    widthM: '1.7m',
    heightM: '1.75m',
    pallets: 'Up to 4',
    maxPayloadKg: 1000,
    maxPayloadLabel: '1000kg',
    loadingType: 'Forklift rear/side load',
    idealFor: ['4-pallet urgent factory transfers', 'Long-length construction materials', 'Exhibition & event staging'],
    silhouetteType: 'xlwb',
  },
  {
    id: 'luton-tail-lift',
    code: 'NT-25012 • LUTON TAIL-LIFT',
    name: 'Luton Box Van (Tail-Lift)',
    shortName: 'Luton Tail-Lift',
    badge: 'LUTON TAIL-LIFT • UP TO 6 PALLETS',
    tagline: 'Box-body commercial vehicle equipped with a 500kg hydraulic tail-lift and onboard pump truck for sites without forklift offloading facilities.',
    lengthM: '4.2m',
    widthM: '2.0m',
    heightM: '2.1m',
    pallets: 'Up to 6',
    maxPayloadKg: 1000,
    maxPayloadLabel: '1000kg',
    loadingType: '500kg Hydraulic Tail-Lift + Pump Truck',
    idealFor: ['Forklift-free collection & delivery sites', 'Catering, hospitality & server racks', 'Two-man white-glove installations'],
    silhouetteType: 'luton',
  },
  {
    id: 'rigid-75t',
    code: 'NT-25102 • 7.5T RIGID',
    name: '7.5 Tonne Rigid Truck',
    shortName: '7.5T Rigid',
    badge: '7.5T RIGID • UP TO 10 PALLETS',
    tagline: 'Heavy-duty commercial rigid box/curtainsider truck with 2,500kg payload capacity and heavy tail-lift for bulk palletised industrial freight.',
    lengthM: '6.0m',
    widthM: '2.4m',
    heightM: '2.3m',
    pallets: 'Up to 10',
    maxPayloadKg: 2500,
    maxPayloadLabel: '2500kg',
    loadingType: 'Dock-height or 1000kg Tail-Lift',
    idealFor: ['Heavy industrial & plant machinery', 'Bulk warehouse-to-warehouse FTL', 'UK & European trunking corridors'],
    silhouetteType: 'rigid-75t',
  },
];

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    stepNumber: '01',
    code: 'STEP 01 • INSTANT DISPATCH',
    title: 'Make a Booking',
    description:
      'Book business or emergency deliveries online via the Customer Portal in under 60 seconds, or contact our 24/7 dispatch desk on 0800 246 8135.',
    slaNote: 'Avg. dispatch confirmation: 3 mins',
  },
  {
    stepNumber: '02',
    code: 'STEP 02 • LIVE TELEMETRY',
    title: 'Track and Trace',
    description:
      'Dedicated vehicle dispatch within 60 minutes nationwide, complete with real-time GPS tracking, live route ETAs, and automated transit notifications.',
    slaNote: 'Direct point-to-point transit',
  },
  {
    stepNumber: '03',
    code: 'STEP 03 • VERIFIED HANDOFF',
    title: 'Instant Proof of Delivery',
    description:
      'Receive instant digital PODs, consignee signatures, timestamps, and transparent invoice documentation inside your portal the moment delivery completes.',
    slaNote: 'Zero paperwork delay',
  },
];

export const PORTAL_KPIS: PortalKpi[] = [
  {
    id: 'todays-jobs',
    value: '11',
    label: "Today's Jobs",
    badgeText: '1 IN TRANSIT',
    badgeTone: 'blue',
    iconName: 'truck',
  },
  {
    id: 'emergency-bookings',
    value: '2',
    label: 'Emergency Bookings',
    badgeText: 'PRIORITY ACTIVE',
    badgeTone: 'amber',
    iconName: 'zap',
  },
  {
    id: 'monthly-spend',
    value: '£4,280',
    label: 'Monthly Spend',
    badgeText: '+12% VS LAST MO',
    badgeTone: 'blue',
    iconName: 'credit-card',
  },
  {
    id: 'outstanding-invoices',
    value: '£0',
    label: 'Outstanding Invoices',
    badgeText: '0 DUE THIS WEEK',
    badgeTone: 'amber',
    iconName: 'file-text',
  },
];

export const PORTAL_TODAYS_JOBS: PortalJob[] = [
  {
    id: 'NT-25102',
    route: 'Manchester → Birmingham',
    vehicleCode: 'NT-25102',
    vehicleType: '7.5T RIGID',
    transitNote: 'Direct transit (approx 109 min)',
    status: 'IN_TRANSIT',
  },
  {
    id: 'NT-25101',
    route: 'Manchester → Birmingham',
    vehicleCode: 'NT-25101',
    vehicleType: '7.5T RIGID',
    transitNote: 'Direct transit (approx 109 min)',
    status: 'IN_TRANSIT',
  },
  {
    id: 'NT-25012',
    route: 'Manchester → Birmingham',
    vehicleCode: 'NT-25012',
    vehicleType: 'LUTON TAIL-LIFT',
    transitNote: 'Direct transit (approx 109 min)',
    status: 'IN_TRANSIT',
  },
  {
    id: 'NT-25011',
    route: 'Manchester → Birmingham',
    vehicleCode: 'NT-25011',
    vehicleType: 'LUTON TAIL-LIFT',
    transitNote: 'Direct transit (approx 88 min)',
    status: 'SCHEDULED',
  },
];

export const PORTAL_QUICK_ACTIONS = [
  {
    id: 'book-emergency',
    label: 'Book emergency delivery',
    href: 'https://admin.neotransport.co.uk/?action=book-emergency',
    iconName: 'zap' as const,
  },
  {
    id: 'track-shipment',
    label: 'Track a live shipment',
    href: 'https://admin.neotransport.co.uk/?action=live-tracking',
    iconName: 'map-pin' as const,
  },
  {
    id: 'download-pod',
    label: 'Download a POD',
    href: 'https://admin.neotransport.co.uk/?action=documents',
    iconName: 'download' as const,
  },
  {
    id: 'pay-invoice',
    label: 'Pay an invoice',
    href: 'https://admin.neotransport.co.uk/?action=invoices',
    iconName: 'credit-card' as const,
  },
  {
    id: 'contact-dispatch',
    label: 'Contact dispatch',
    href: 'tel:08002468135',
    iconName: 'headphones' as const,
  },
];

export const GEMINI_LOGISTICS_PULSE_DEFAULT =
  'Nationwide fleet status: 14 emergency vehicles ready across Manchester, Birmingham, and London M25 corridor.';

export const INDUSTRY_VERTICALS: IndustryVertical[] = [
  {
    id: 'retail-ecommerce',
    code: 'SECTOR 01 • RETAIL & FULFILMENT',
    title: 'Retail & eCommerce',
    description:
      'Rapid stock replenishment, peak-season carrier overflow recovery, and urgent distribution centre transfers to protect store availability and customer SLAs.',
    typicalLoads: 'Cage roll-pallets, boxed inventory, hanging garments',
    slaCommitment: '60-min DC & store collection',
    iconName: 'shopping-bag',
  },
  {
    id: 'construction',
    code: 'SECTOR 02 • SITE INFRASTRUCTURE',
    title: 'Construction',
    description:
      'Direct-to-site delivery of critical building materials, specialist fixings, tools, and replacement plant parts to prevent costly crane or contractor downtime.',
    typicalLoads: 'Palletised materials, steelwork, plant spares',
    slaCommitment: 'Timed site-gate delivery',
    iconName: 'hard-hat',
  },
  {
    id: 'hospitality',
    code: 'SECTOR 03 • VENUES & EVENTS',
    title: 'Hospitality',
    description:
      'Time-sensitive commercial catering equipment, ambient goods, bar infrastructure, and live event supply replenishment with tail-lift and two-man placement.',
    typicalLoads: 'Commercial kitchen units, event staging, ambient stock',
    slaCommitment: 'Pre-opening & late-night windows',
    iconName: 'utensils',
  },
  {
    id: 'agricultural',
    code: 'SECTOR 04 • RURAL SUPPLY CHAIN',
    title: 'Agricultural',
    description:
      'Urgent machinery parts, irrigation components, and rural supply chain support delivered direct to farms, estates, and food processing hubs nationwide.',
    typicalLoads: 'Harvester/tractor components, bulk agricultural inputs',
    slaCommitment: 'Direct rural & off-grid routing',
    iconName: 'sprout',
  },
  {
    id: 'tv-film-production',
    code: 'SECTOR 05 • BROADCAST & STUDIO',
    title: 'TV & Film Production',
    description:
      'High-security, time-critical transport for cinema camera rigs, lighting arrays, props, set staging, and live broadcast hardware between studios and location shoots.',
    typicalLoads: 'Flight cases, camera packages, set carpentry',
    slaCommitment: 'Dedicated sole-use security transit',
    iconName: 'clapperboard',
  },
  {
    id: 'marketing-print',
    code: 'SECTOR 06 • EXHIBITIONS & POS',
    title: 'Marketing & Print',
    description:
      'Exhibition stands, retail point-of-sale displays, and embargoed commercial print runs delivered directly to conference centres, press halls, and flagship stores.',
    typicalLoads: 'Bespokecrated stands, palletised print, POS displays',
    slaCommitment: 'Direct-to-stand hall handoff',
    iconName: 'printer',
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-services',
    code: 'FAQ 01',
    category: 'Operations',
    question: 'What services does NEO Transport offer?',
    answer:
      'NEO Transport provides UK & European same-day courier services, pre-approved £0-monthly-fee emergency standby freight, full-day and half-day dedicated vehicle hire, multi-drop delivery, irregular and oversize cargo transport, full truck load (FTL) solutions, two-man white-glove delivery, and next-flight-out air freight—all backed by real-time GPS tracking via our Customer Portal.',
  },
  {
    id: 'faq-standby-account',
    code: 'FAQ 02',
    category: 'Standby Account',
    question: 'How does the £0 Emergency Standby Account work?',
    answer:
      'Your Emergency Standby Account is a pre-approved business logistics account with a £0 monthly fee forever and zero minimum spend commitment. It sits quietly in the background until your primary carrier fails, misses a collection, or experiences a network delay—allowing your team to dispatch a dedicated recovery vehicle within 60 minutes nationwide, until midnight.',
  },
  {
    id: 'faq-quote-booking',
    code: 'FAQ 03',
    category: 'Portal & Tracking',
    question: 'How do I request a quote or book a shipment?',
    answer:
      'You can generate instant quotes, book emergency or scheduled deliveries, and manage active consignments 24/7 inside the NEO Transport Customer Portal at admin.neotransport.co.uk. For immediate voice dispatch or complex routing, call our 24/7 operations desk on 0800 246 8135 (average response time: 3 minutes).',
  },
  {
    id: 'faq-realtime-tracking',
    code: 'FAQ 04',
    category: 'Portal & Tracking',
    question: 'Can I track my shipment in real-time?',
    answer:
      'Yes. Every shipment booked with NEO Transport includes live GPS vehicle telemetry, dynamic route ETAs, and automated status updates accessible directly from your Customer Portal dashboard.',
  },
  {
    id: 'faq-european-shipments',
    code: 'FAQ 05',
    category: 'Coverage',
    question: 'Do you handle European and cross-border shipments?',
    answer:
      'Yes. We operate dedicated point-to-point vans and rigid trucks across the UK mainland and European road corridors, providing end-to-end transit coordination and customs documentation support for time-critical international freight.',
  },
  {
    id: 'faq-cargo-security',
    code: 'FAQ 06',
    category: 'Operations',
    question: 'How secure are my goods during transport?',
    answer:
      'All same-day and emergency consignments travel on dedicated, sole-use vehicles straight from collection to delivery. Because your freight is never offloaded at sorting hubs or co-mingled with third-party goods, damage and loss risk is virtually eliminated, and a digital Proof of Delivery (POD) signature is captured instantly upon handoff.',
  },
  {
    id: 'faq-modify-cancel',
    code: 'FAQ 07',
    category: 'Operations',
    question: 'Can I change or cancel a shipment after booking?',
    answer:
      'Yes. Route modifications, collection time updates, or cancellations can be managed directly through your Customer Portal or by calling our 24/7 dispatch desk on 0800 246 8135 prior to vehicle collection.',
  },
];

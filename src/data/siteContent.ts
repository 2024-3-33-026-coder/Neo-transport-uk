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
  dispatchResponseAvg: '3-minute average answer time',
  standbyMonthlyFee: '£0',
  standbySetupNote: '60-second setup with no minimum spend',
} as const;

export const HERO_METRICS: MetricItem[] = [
  {
    id: 'collection-time',
    value: '60 min',
    label: 'Average collection time across the UK',
  },
  {
    id: 'recovery-rate',
    value: '98.7%',
    label: 'On-time same-day delivery rate',
  },
  {
    id: 'coverage-scope',
    value: 'Nationwide',
    label: 'UK mainland and European road hubs',
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
    corridor: 'M6, M62, and M60 North West routes',
    coordinates: '53.4808° N, 2.2426° W',
  },
  {
    id: 'birmingham',
    code: 'HUB • BIRMINGHAM, UK',
    label: 'Birmingham Hub',
    bayNumber: '14',
    activeVehicles: 4,
    avgCollectionMins: 38,
    corridor: 'M6, M5, and M42 Midlands routes',
    coordinates: '52.4862° N, 1.8904° W',
  },
  {
    id: 'london-m25',
    code: 'HUB • LONDON M25, UK',
    label: 'London M25 Hub',
    bayNumber: '08',
    activeVehicles: 4,
    avgCollectionMins: 45,
    corridor: 'M25, M1, M4, and A20 Channel port routes',
    coordinates: '51.5072° N, 0.1276° W',
  },
];

export const STANDBY_PILLARS: StandbyPillar[] = [
  {
    id: 'around-the-clock',
    index: '01',
    title: '24/7 collection within 60 minutes',
    badge: 'COLLECTION TARGET UNDER 60 MIN',
    description:
      'We collect nationwide within 60 minutes, day or night. One vehicle carries your load straight to the destination across the UK and Europe.',
    metricLabel: 'DISPATCH HOURS',
    metricValue: '24/7, 365 days a year',
  },
  {
    id: 'deliver-full-speed',
    index: '02',
    title: 'Live GPS tracking and instant proof of delivery',
    badge: 'CUSTOMER PORTAL',
    description:
      'Book jobs, check live vehicle GPS locations, view arrival times, and download signed delivery receipts in the Customer Portal.',
    metricLabel: 'ON-TIME DELIVERY RATE',
    metricValue: '98.7% same-day',
  },
  {
    id: 'here-for-you',
    index: '03',
    title: '£0 standby account and 24/7 dispatch desk',
    badge: '£0 MONTHLY FEE',
    description:
      'Open a standby account for £0 a month with no minimum spend. When your usual carrier misses a collection, we send a recovery vehicle within 60 minutes.',
    metricLabel: 'DISPATCH DESK',
    metricValue: '3-minute answer time, £0 fee',
  },
];

export const LOGISTICS_SERVICES: ServiceItem[] = [
  {
    id: 'same-day-delivery',
    index: '01',
    title: 'Same-day delivery',
    code: 'SERVICE 01',
    slaBadge: '60-MIN COLLECTION',
    description:
      'We collect within 60 minutes nationwide and drive straight to the delivery address. Your goods stay on one vehicle from pickup to signature.',
    capabilities: [
      'One vehicle for your load only',
      'Direct drive to the recipient',
      'Live GPS tracking link',
    ],
    featured: true,
    portalPath: 'https://admin.neotransport.co.uk/?service=same-day',
  },
  {
    id: 'full-half-day-rates',
    index: '02',
    title: 'Full-day and half-day hire',
    code: 'SERVICE 02',
    slaBadge: 'DEDICATED HIRE',
    description:
      'Hire a vehicle and driver by the half day or full day for scheduled runs, busy retail periods, and regular transfers between branches.',
    capabilities: [
      'Fixed half-day or full-day rate',
      'ADR-certified drivers available',
      'Works with your delivery manifest',
    ],
    portalPath: 'https://admin.neotransport.co.uk/?service=day-rates',
  },
  {
    id: 'multi-drop-delivery',
    index: '03',
    title: 'Multi-drop delivery',
    code: 'SERVICE 03',
    slaBadge: 'SIGNED AT EVERY STOP',
    description:
      'We plan multi-stop routes and record a digital signature and photo at every drop. You see live arrival times for each stop in the portal.',
    capabilities: [
      'Planned stop order',
      'Signature and photo at every stop',
      'Instant delay alerts',
    ],
    portalPath: 'https://admin.neotransport.co.uk/?service=multi-drop',
  },
  {
    id: 'european-road-transport',
    index: '04',
    title: 'European road transport',
    code: 'SERVICE 04',
    slaBadge: 'UK AND EU DIRECT',
    description:
      'Dedicated vans and rigid trucks run direct between the UK and Europe. We handle border paperwork and offer single-driver or two-driver teams.',
    capabilities: [
      'Direct door-to-door UK and EU runs',
      'T1 and T2 customs paperwork support',
      'Single-driver or two-driver crews',
    ],
    featured: true,
    portalPath: 'https://admin.neotransport.co.uk/?service=european-road',
  },
  {
    id: 'irregular-and-oversize',
    index: '05',
    title: 'Irregular and oversize freight',
    code: 'SERVICE 05',
    slaBadge: 'NON-STANDARD LOADS',
    description:
      'We carry long, fragile, or awkward loads that do not fit standard pallets. Drivers secure every item with heavy-duty straps and load bars.',
    capabilities: [
      'Ratchet straps and load bars',
      'No sorting hubs or conveyor belts',
      'Site risk assessments provided',
    ],
    portalPath: 'https://admin.neotransport.co.uk/?service=irregular-oversize',
  },
  {
    id: 'full-load-solutions',
    index: '06',
    title: 'Full truck loads',
    code: 'SERVICE 06',
    slaBadge: 'BULK PALLETS',
    description:
      'Book full-capacity trucks for warehouse transfers and factory runs. We meet booked loading bay times and drive sealed loads straight to the site.',
    capabilities: [
      'On-time loading bay arrivals',
      'Sealed direct road transit',
      'Live GPS position updates',
    ],
    portalPath: 'https://admin.neotransport.co.uk/?service=full-load',
  },
  {
    id: 'two-man-delivery',
    index: '07',
    title: 'Two-man delivery',
    code: 'SERVICE 07',
    slaBadge: 'TWO-PERSON CREW',
    description:
      'Two crew members lift, carry, and place heavy or fragile equipment in the exact room you choose, then remove the packaging.',
    capabilities: [
      'Two trained crew members',
      'Tail-lift and stair-climber gear',
      'Placed in your chosen room',
    ],
    portalPath: 'https://admin.neotransport.co.uk/?service=two-man',
  },
  {
    id: 'air-freight',
    index: '08',
    title: 'Air freight',
    code: 'SERVICE 08',
    slaBadge: 'NEXT FLIGHT OUT',
    description:
      'We combine next-flight-out air cargo and onboard couriers with direct van transfers to and from major UK and European airports.',
    capabilities: [
      'Direct airport collection and delivery',
      'Air waybill preparation',
      'Tracked handoff at every step',
    ],
    portalPath: 'https://admin.neotransport.co.uk/?service=air-freight',
  },
];

export const FLEET_VEHICLES: FleetVehicle[] = [
  {
    id: 'small-van',
    code: 'CLASS 01 • SMALL COURIER VAN',
    name: 'Small courier van',
    shortName: 'Small van',
    badge: '1 EURO PALLET, 400KG MAX',
    tagline:
      'Fits 1 Euro pallet or up to 400kg of boxes, tools, aircraft parts, or medical samples.',
    lengthM: '1.7m',
    widthM: '1.2m',
    heightM: '1.2m',
    pallets: 'Up to 1',
    maxPayloadKg: 400,
    maxPayloadLabel: '400kg',
    loadingType: 'Rear and side sliding doors',
    idealFor: [
      'Urgent spare parts and tools',
      'Single Euro or UK pallet',
      'Medical samples and IT equipment',
    ],
    silhouetteType: 'small-van',
  },
  {
    id: 'swb-lwb',
    code: 'CLASS 02 • SWB & LWB TRANSIT',
    name: 'Short and long wheelbase vans',
    shortName: 'SWB & LWB',
    badge: 'UP TO 3 PALLETS, 1,200KG MAX',
    tagline:
      'Carries up to 3 standard pallets and 1,200kg for depot transfers and multi-drop runs.',
    lengthM: '2.7m to 3.3m',
    widthM: '1.2m to 1.7m',
    heightM: '1.4m to 1.7m',
    pallets: 'Up to 3',
    maxPayloadKg: 1200,
    maxPayloadLabel: '900kg to 1,200kg',
    loadingType: 'Forklift load via rear or side doors',
    idealFor: [
      '1 to 3 standard pallets',
      'Retail store restocking',
      'Regional multi-drop routes',
    ],
    silhouetteType: 'swb-lwb',
  },
  {
    id: 'xlwb',
    code: 'CLASS 03 • EXTRA LONG WHEELBASE',
    name: 'Extra-long wheelbase van',
    shortName: 'XLWB van',
    badge: 'UP TO 4 PALLETS, 1,000KG MAX',
    tagline:
      '4.2-metre load bed holds 4 pallets or long pipes, timber, and exhibition frames up to 1,000kg.',
    lengthM: '4.2m',
    widthM: '1.7m',
    heightM: '1.75m',
    pallets: 'Up to 4',
    maxPayloadKg: 1000,
    maxPayloadLabel: '1,000kg',
    loadingType: 'Forklift load via rear or side doors',
    idealFor: [
      '4-pallet factory transfers',
      '4-metre building materials',
      'Exhibition stands and staging',
    ],
    silhouetteType: 'xlwb',
  },
  {
    id: 'luton-tail-lift',
    code: 'NT-25012 • LUTON TAIL-LIFT',
    name: 'Luton box van with tail-lift',
    shortName: 'Luton tail-lift',
    badge: 'UP TO 6 PALLETS, 1,000KG MAX',
    tagline:
      'Box van with a 500kg hydraulic tail-lift and pallet pump truck for sites without a forklift.',
    lengthM: '4.2m',
    widthM: '2.0m',
    heightM: '2.1m',
    pallets: 'Up to 6',
    maxPayloadKg: 1000,
    maxPayloadLabel: '1,000kg',
    loadingType: '500kg hydraulic tail-lift and pump truck',
    idealFor: [
      'Sites without a forklift',
      'Catering gear and server racks',
      'Two-person equipment installs',
    ],
    silhouetteType: 'luton',
  },
  {
    id: 'rigid-75t',
    code: 'NT-25102 • 7.5T RIGID',
    name: '7.5-tonne rigid truck',
    shortName: '7.5T rigid',
    badge: 'UP TO 10 PALLETS, 2,500KG MAX',
    tagline:
      '6-metre box or curtainsider truck carrying up to 10 pallets and 2,500kg with a 1,000kg tail-lift.',
    lengthM: '6.0m',
    widthM: '2.4m',
    heightM: '2.3m',
    pallets: 'Up to 10',
    maxPayloadKg: 2500,
    maxPayloadLabel: '2,500kg',
    loadingType: 'Loading dock or 1,000kg tail-lift',
    idealFor: [
      'Heavy machinery and plant parts',
      '10-pallet warehouse transfers',
      'UK and European road runs',
    ],
    silhouetteType: 'rigid-75t',
  },
];

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    stepNumber: '01',
    code: 'STEP 01',
    title: 'Book online or by phone',
    description:
      'Book in the Customer Portal in under 60 seconds, or call our 24/7 dispatch desk on 0800 246 8135.',
    slaNote: 'Confirmed in 3 minutes on average',
  },
  {
    stepNumber: '02',
    code: 'STEP 02',
    title: 'Track the vehicle live',
    description:
      'A dedicated vehicle collects within 60 minutes nationwide. Follow the driver on a live GPS map with updated arrival times.',
    slaNote: 'Direct drive with no hub stops',
  },
  {
    stepNumber: '03',
    code: 'STEP 03',
    title: 'Download proof of delivery',
    description:
      'As soon as the recipient signs, the timestamped signature, photo, and invoice appear in your Customer Portal.',
    slaNote: 'Signed receipt available immediately',
  },
];

export const PORTAL_KPIS: PortalKpi[] = [
  {
    id: 'todays-jobs',
    value: '11',
    label: "Today's jobs",
    badgeText: '1 IN TRANSIT',
    badgeTone: 'blue',
    iconName: 'truck',
  },
  {
    id: 'emergency-bookings',
    value: '2',
    label: 'Urgent bookings',
    badgeText: 'PRIORITY',
    badgeTone: 'amber',
    iconName: 'zap',
  },
  {
    id: 'monthly-spend',
    value: '£4,280',
    label: 'Monthly spend',
    badgeText: '+12% VS LAST MONTH',
    badgeTone: 'blue',
    iconName: 'credit-card',
  },
  {
    id: 'outstanding-invoices',
    value: '£0',
    label: 'Unpaid invoices',
    badgeText: '0 DUE THIS WEEK',
    badgeTone: 'amber',
    iconName: 'file-text',
  },
];

export const PORTAL_TODAYS_JOBS: PortalJob[] = [
  {
    id: 'NT-25102',
    route: 'Manchester to Birmingham',
    vehicleCode: 'NT-25102',
    vehicleType: '7.5T RIGID',
    transitNote: 'Direct drive, 109 mins',
    status: 'IN_TRANSIT',
  },
  {
    id: 'NT-25101',
    route: 'Manchester to Birmingham',
    vehicleCode: 'NT-25101',
    vehicleType: '7.5T RIGID',
    transitNote: 'Direct drive, 109 mins',
    status: 'IN_TRANSIT',
  },
  {
    id: 'NT-25012',
    route: 'Manchester to Birmingham',
    vehicleCode: 'NT-25012',
    vehicleType: 'LUTON TAIL-LIFT',
    transitNote: 'Direct drive, 109 mins',
    status: 'IN_TRANSIT',
  },
  {
    id: 'NT-25011',
    route: 'Manchester to Birmingham',
    vehicleCode: 'NT-25011',
    vehicleType: 'LUTON TAIL-LIFT',
    transitNote: 'Direct drive, 88 mins',
    status: 'SCHEDULED',
  },
];

export const PORTAL_QUICK_ACTIONS = [
  {
    id: 'book-emergency',
    label: 'Book urgent delivery',
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
    label: 'Download proof of delivery',
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
    label: 'Call dispatch desk',
    href: 'tel:08002468135',
    iconName: 'headphones' as const,
  },
];

export const GEMINI_LOGISTICS_PULSE_DEFAULT =
  '14 vehicles are on standby across Manchester, Birmingham, and the London M25.',
  DISPATCH_STATUS_DEFAULT = GEMINI_LOGISTICS_PULSE_DEFAULT;

export const INDUSTRY_VERTICALS: IndustryVertical[] = [
  {
    id: 'retail-ecommerce',
    code: 'SECTOR 01',
    title: 'Retail and ecommerce',
    description:
      'We move stock between distribution centres and retail stores on the same day when regular carriers fall behind.',
    typicalLoads: 'Roll cages, boxed stock, hanging garments',
    slaCommitment: '60-min warehouse collection',
    iconName: 'shopping-bag',
  },
  {
    id: 'construction',
    code: 'SECTOR 02',
    title: 'Construction',
    description:
      'We deliver building materials, fixings, tools, and spare plant parts straight to site gates so crews and cranes do not sit idle.',
    typicalLoads: 'Palletised materials, steelwork, plant spares',
    slaCommitment: 'Timed site-gate delivery',
    iconName: 'hard-hat',
  },
  {
    id: 'hospitality',
    code: 'SECTOR 03',
    title: 'Hospitality',
    description:
      'We deliver kitchen appliances, bar equipment, dry goods, and event staging before opening hours or late at night.',
    typicalLoads: 'Ovens, chillers, event staging, dry stock',
    slaCommitment: 'Early-morning and late-night slots',
    iconName: 'utensils',
  },
  {
    id: 'agricultural',
    code: 'SECTOR 04',
    title: 'Agriculture',
    description:
      'We take urgent tractor parts, irrigation fittings, and farm supplies straight to farms, estates, and packing plants.',
    typicalLoads: 'Harvester and tractor parts, feed, seed',
    slaCommitment: 'Direct rural delivery',
    iconName: 'sprout',
  },
  {
    id: 'tv-film-production',
    code: 'SECTOR 05',
    title: 'TV and film production',
    description:
      'Sole-use vans and trucks carry cameras, lighting rigs, props, and set carpentry directly between studios and shoot locations.',
    typicalLoads: 'Flight cases, camera rigs, set carpentry',
    slaCommitment: 'Sole-use vehicle security',
    iconName: 'clapperboard',
  },
  {
    id: 'marketing-print',
    code: 'SECTOR 06',
    title: 'Marketing and print',
    description:
      'We deliver exhibition stands, retail displays, and dated print runs directly to exhibition halls, press rooms, and stores.',
    typicalLoads: 'Crated exhibition stands, print pallets, displays',
    slaCommitment: 'Direct delivery to hall stand',
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
      'We run UK and European same-day courier deliveries, £0-per-month standby accounts, half-day and full-day van hire, multi-drop routes, oversize freight, full truck loads, two-man deliveries, and airport transfers. You can track every job live in our Customer Portal.',
  },
  {
    id: 'faq-standby-account',
    code: 'FAQ 02',
    category: 'Standby Account',
    question: 'How does the £0 standby account work?',
    answer:
      'The standby account gives your business a pre-approved courier account with a £0 monthly fee and no minimum spend. You pay nothing until you book a job. When your regular carrier misses a pickup, you can book a dedicated recovery vehicle that collects within 60 minutes nationwide.',
  },
  {
    id: 'faq-quote-booking',
    code: 'FAQ 03',
    category: 'Portal & Tracking',
    question: 'How do I get a quote or book a shipment?',
    answer:
      'Log in to the Customer Portal at admin.neotransport.co.uk to price a route and book online at any hour. To book by phone, call our 24/7 dispatch desk on 0800 246 8135. We answer calls in under 3 minutes on average.',
  },
  {
    id: 'faq-realtime-tracking',
    code: 'FAQ 04',
    category: 'Portal & Tracking',
    question: 'Can I track my shipment in real time?',
    answer:
      'Yes. Every booking shows the vehicle position on a live GPS map, updated arrival times, and delivery status inside the Customer Portal.',
  },
  {
    id: 'faq-european-shipments',
    code: 'FAQ 05',
    category: 'Coverage',
    question: 'Do you handle European and cross-border shipments?',
    answer:
      'Yes. Our vans and rigid trucks drive direct between the UK mainland and Europe. We help prepare T1 and T2 customs paperwork so your load clears the border without changing vehicles.',
  },
  {
    id: 'faq-cargo-security',
    code: 'FAQ 06',
    category: 'Operations',
    question: 'How do you keep goods safe in transit?',
    answer:
      'Same-day loads travel on a single vehicle from collection to delivery. We never unload your freight at sorting hubs or mix it with other customers\' goods. The driver records a digital signature and photo as soon as the recipient takes delivery.',
  },
  {
    id: 'faq-modify-cancel',
    code: 'FAQ 07',
    category: 'Operations',
    question: 'Can I change or cancel a shipment after booking?',
    answer:
      'Yes. You can update the route, change the collection time, or cancel a booking in the Customer Portal or by calling 0800 246 8135 before the driver collects.',
  },
];

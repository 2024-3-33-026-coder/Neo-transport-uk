import {
  BRAND_CONFIG,
  DISPATCH_HUBS,
  FAQ_ITEMS,
  FLEET_VEHICLES,
  HERO_METRICS,
  INDUSTRY_VERTICALS,
  LOGISTICS_SERVICES,
  FleetVehicle,
  HubTelemetry,
} from '../data/siteContent';

export interface DispatchEstimateInput {
  originHubId: string;
  destinationCity: string;
  palletCount: number;
  weightKg: number;
  requiresTailLift: boolean;
  isUrgentStandby: boolean;
}

export interface DispatchEstimateResult {
  recommendedVehicle: FleetVehicle;
  originHub: HubTelemetry;
  estimatedCollectionMins: number;
  estimatedTransitMins: number;
  portalBookingHref: string;
  dispatchSummary: string;
}

const DESTINATION_TRANSIT_MAP: Record<string, Record<string, number>> = {
  manchester: {
    Birmingham: 109,
    'London M25': 215,
    Leeds: 58,
    Bristol: 185,
    Glasgow: 225,
    'Calais / EU Gateway': 310,
  },
  birmingham: {
    Manchester: 109,
    'London M25': 135,
    Leeds: 140,
    Bristol: 105,
    Glasgow: 295,
    'Calais / EU Gateway': 210,
  },
  'london-m25': {
    Manchester: 215,
    Birmingham: 135,
    Leeds: 220,
    Bristol: 145,
    Glasgow: 410,
    'Calais / EU Gateway': 95,
  },
};

/**
 * Recommends the optimal NEO Transport vehicle class based on pallet count,
 * total payload weight (kg), and tail-lift requirement.
 */
export function selectOptimalFleetVehicle(
  palletCount: number,
  weightKg: number,
  requiresTailLift: boolean
): FleetVehicle {
  const safePallets = Math.max(1, Math.min(10, Math.round(palletCount)));
  const safeWeight = Math.max(10, Math.min(2500, Math.round(weightKg)));

  if (safePallets > 6 || safeWeight > 1200) {
    return FLEET_VEHICLES.find((v) => v.id === 'rigid-75t')!;
  }

  if (requiresTailLift || safePallets >= 5) {
    return FLEET_VEHICLES.find((v) => v.id === 'luton-tail-lift')!;
  }

  if (safePallets === 4) {
    return FLEET_VEHICLES.find((v) => v.id === 'xlwb')!;
  }

  if (safePallets >= 2 || safeWeight > 400) {
    return FLEET_VEHICLES.find((v) => v.id === 'swb-lwb')!;
  }

  return FLEET_VEHICLES.find((v) => v.id === 'small-van')!;
}

/**
 * Computes a deterministic emergency dispatch estimate and builds a deep-link
 * URL into https://admin.neotransport.co.uk/ preserving query parameters.
 */
export function calculateDispatchEstimate(input: DispatchEstimateInput): DispatchEstimateResult {
  const originHub =
    DISPATCH_HUBS.find((h) => h.id === input.originHubId) || DISPATCH_HUBS[0];
  const recommendedVehicle = selectOptimalFleetVehicle(
    input.palletCount,
    input.weightKg,
    input.requiresTailLift
  );

  const hubRoutes = DESTINATION_TRANSIT_MAP[originHub.id] || DESTINATION_TRANSIT_MAP.manchester;
  const estimatedTransitMins = hubRoutes[input.destinationCity] ?? 125;
  const estimatedCollectionMins = input.isUrgentStandby
    ? originHub.avgCollectionMins
    : Math.min(60, originHub.avgCollectionMins + 12);

  const params = new URLSearchParams({
    action: input.isUrgentStandby ? 'book-emergency' : 'new-booking',
    hub: originHub.id,
    dest: input.destinationCity,
    vehicle: recommendedVehicle.id,
    pallets: String(input.palletCount),
    weightKg: String(input.weightKg),
    tailLift: input.requiresTailLift ? '1' : '0',
  });

  const portalBookingHref = `${BRAND_CONFIG.portalUrl}?${params.toString()}`;

  const dispatchSummary = `${originHub.label.replace(' Hub', '')} → ${
    input.destinationCity
  } • ${recommendedVehicle.code} • Collection ≤ ${estimatedCollectionMins} min • Direct transit (approx ${estimatedTransitMins} min)`;

  return {
    recommendedVehicle,
    originHub,
    estimatedCollectionMins,
    estimatedTransitMins,
    portalBookingHref,
    dispatchSummary,
  };
}

/**
 * Validates that site content strictly adheres to NEO Transport data hygiene rules:
 * - Zero mentions of banned legacy template strings ("Logistiqa", "Handgrid", "2% On-Time Delivery", "0/7 Customer Support")
 * - All 8 core services and 6 industry verticals present
 * - All portal links point to https://admin.neotransport.co.uk/
 */
export function verifyDataHygiene(): {
  valid: boolean;
  violations: string[];
  serviceCount: number;
  industryCount: number;
  faqCount: number;
} {
  const bannedTerms = [
    'logistiqa',
    'handgrid',
    '2% on-time',
    '0/7 customer support',
    '0+ years of experience',
    '0.94 averaged',
    'olivia martinez',
    'michael chen',
    'sophia turner',
  ];

  const serializedContent = JSON.stringify({
    BRAND_CONFIG,
    HERO_METRICS,
    DISPATCH_HUBS,
    LOGISTICS_SERVICES,
    FLEET_VEHICLES,
    INDUSTRY_VERTICALS,
    FAQ_ITEMS,
  }).toLowerCase();

  const violations: string[] = [];

  for (const term of bannedTerms) {
    if (serializedContent.includes(term)) {
      violations.push(`Banned legacy template term found: "${term}"`);
    }
  }

  if (LOGISTICS_SERVICES.length !== 8) {
    violations.push(`Expected 8 core services, found ${LOGISTICS_SERVICES.length}`);
  }

  if (INDUSTRY_VERTICALS.length !== 6) {
    violations.push(`Expected 6 industry verticals, found ${INDUSTRY_VERTICALS.length}`);
  }

  if (FAQ_ITEMS.length !== 7) {
    violations.push(`Expected 7 FAQs, found ${FAQ_ITEMS.length}`);
  }

  for (const svc of LOGISTICS_SERVICES) {
    if (!svc.portalPath.startsWith('https://admin.neotransport.co.uk/')) {
      violations.push(`Service ${svc.id} has invalid portal URL: ${svc.portalPath}`);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    serviceCount: LOGISTICS_SERVICES.length,
    industryCount: INDUSTRY_VERTICALS.length,
    faqCount: FAQ_ITEMS.length,
  };
}

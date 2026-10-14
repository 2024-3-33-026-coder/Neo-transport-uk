/**
 * NEO TRANSPORT - CENTRAL CONTACT & REGIONAL HUB CONSTANTS
 * 
 * Centralized source of truth for telephone routing, dispatch lines,
 * physical hub locations, operational SLAs, and company metadata.
 */

export const CONTACT_CONFIG = {
  company: {
    name: 'NEO Transport',
    legalName: 'Emergency Freight Network Ltd',
    companyNumber: '12948192',
    vatNumber: 'GB 384 9182 44',
  },
  phone: {
    // Primary 24/7 UK Freephone Hotline
    primary: '0800 246 8135',
    primaryRaw: '08002468135',
    primaryTel: 'tel:08002468135',

    // Regional Duty Desks (Fallback/Direct)
    birmingham: '0121 558 2845',
    birminghamTel: 'tel:+441215582845',
    manchester: '0161 820 4492',
    manchesterTel: 'tel:+441618204492',
    warrington: '01925 800 999',
    warringtonTel: 'tel:+441925800999',
  },
  email: {
    dispatch: 'dispatch@neotransport.co.uk',
    ops: 'ops@neotransport.co.uk',
    support: 'support@neotransport.co.uk',
    accounts: 'accounts@neotransport.co.uk',
  },
  hubs: [
    {
      id: 'hub-mcr',
      name: 'Manchester Hub & Depot',
      city: 'Manchester',
      address: 'Trafford Park, Manchester M17 1AB',
      postcode: 'M17 1AB',
      phone: '0161 820 4492',
      bays: 24,
      status: 'OPERATIONAL 24/7',
    },
    {
      id: 'hub-bhx',
      name: 'Birmingham Central Hub',
      city: 'Birmingham',
      address: 'Heartlands Parkway, Birmingham B6 7EU',
      postcode: 'B6 7EU',
      phone: '0121 558 2845',
      bays: 18,
      status: 'OPERATIONAL 24/7',
    },
    {
      id: 'hub-lds',
      name: 'Leeds & Yorkshire Corridor Hub',
      city: 'Leeds',
      address: 'Stourton Point, Leeds LS10 1DW',
      postcode: 'LS10 1DW',
      phone: '0800 246 8135',
      bays: 16,
      status: 'OPERATIONAL 24/7',
    },
    {
      id: 'hub-war',
      name: 'Warrington M6/M62 Interchange',
      city: 'Warrington',
      address: 'Omega South, Warrington WA5 3UG',
      postcode: 'WA5 3UG',
      phone: '01925 800 999',
      bays: 14,
      status: 'OPERATIONAL 24/7',
    },
    {
      id: 'hub-lon',
      name: 'London Orbital Hub',
      city: 'London',
      address: 'Dartford Crossing Depot, DA1 5PZ',
      postcode: 'DA1 5PZ',
      phone: '0800 246 8135',
      bays: 20,
      status: 'OPERATIONAL 24/7',
    },
    {
      id: 'hub-brs',
      name: 'Bristol & South West Gateway',
      city: 'Bristol',
      address: 'Avonmouth Docks, Bristol BS11 9QD',
      postcode: 'BS11 9QD',
      phone: '0800 246 8135',
      bays: 12,
      status: 'OPERATIONAL 24/7',
    },
  ],
  sla: {
    dispatchResponseSeconds: 18,
    averageCollectionMinutes: 42,
    guaranteedCollectionMinutes: 60,
    coverage: '24/7/365 Nationwide',
  },
} as const;

export default CONTACT_CONFIG;

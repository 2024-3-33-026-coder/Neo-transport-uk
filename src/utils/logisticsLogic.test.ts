import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDispatchEstimate,
  selectOptimalFleetVehicle,
  verifyDataHygiene,
} from './logisticsLogic';

test('verifyDataHygiene enforces zero legacy template strings and exact counts', () => {
  const report = verifyDataHygiene();
  assert.equal(report.valid, true, `Violations: ${report.violations.join(', ')}`);
  assert.equal(report.serviceCount, 8);
  assert.equal(report.industryCount, 6);
  assert.equal(report.faqCount, 7);
});

test('selectOptimalFleetVehicle selects Small Van for 1 pallet / 250kg without tail-lift', () => {
  const vehicle = selectOptimalFleetVehicle(1, 250, false);
  assert.equal(vehicle.id, 'small-van');
});

test('selectOptimalFleetVehicle selects Luton Tail-Lift when tail-lift is required', () => {
  const vehicle = selectOptimalFleetVehicle(2, 600, true);
  assert.equal(vehicle.id, 'luton-tail-lift');
});

test('selectOptimalFleetVehicle selects 7.5T Rigid for heavy multi-pallet loads', () => {
  const vehicle = selectOptimalFleetVehicle(8, 2100, true);
  assert.equal(vehicle.id, 'rigid-75t');
});

test('calculateDispatchEstimate returns valid Manchester -> Birmingham SLA and portal deep link', () => {
  const estimate = calculateDispatchEstimate({
    originHubId: 'manchester',
    destinationCity: 'Birmingham',
    palletCount: 8,
    weightKg: 2000,
    requiresTailLift: false,
    isUrgentStandby: true,
  });

  assert.equal(estimate.originHub.code, 'HUB • MANCHESTER, UK');
  assert.equal(estimate.recommendedVehicle.id, 'rigid-75t');
  assert.equal(estimate.estimatedTransitMins, 109);
  assert.ok(estimate.portalBookingHref.startsWith('https://admin.neotransport.co.uk/?'));
  assert.ok(estimate.portalBookingHref.includes('hub=manchester'));
  assert.ok(estimate.portalBookingHref.includes('dest=Birmingham'));
});

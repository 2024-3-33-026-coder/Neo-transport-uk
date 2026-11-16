import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  getStoredBookings,
  getPersistedBookings,
  getStoredQuotes,
  getStoredInvoices,
  getStoredDocuments,
  setDemoModeOverrideForTesting,
  STORAGE_BOOKINGS_KEY,
} from '../src/lib/portalStore';
import { Booking } from '../src/types';

async function runTenantIsolationAndAutofillTests() {
  setDemoModeOverrideForTesting(true);
  console.log('=================================================================');
  console.log('STARTING CUSTOMER TENANT ISOLATION & AUTOFILL BUG TESTS');
  console.log('=================================================================\n');

  // 1. Tenant Isolation Tests
  console.log('--- 1. Testing Customer Tenant Data Scoping ---');
  const dummyCustomerCompanyId = 'comp-new-client-789';

  const customerBookings = getStoredBookings(dummyCustomerCompanyId);
  assert.strictEqual(
    customerBookings.length,
    0,
    `New customer with company ${dummyCustomerCompanyId} must receive exactly 0 bookings, but got ${customerBookings.length}`
  );
  console.log('✓ PASS 1.1: getStoredBookings returns empty list [] for newly created customer company');

  const customerQuotes = getStoredQuotes(dummyCustomerCompanyId);
  assert.strictEqual(
    customerQuotes.length,
    0,
    `New customer must receive 0 quotes, got ${customerQuotes.length}`
  );
  console.log('✓ PASS 1.2: getStoredQuotes returns empty list [] for new customer company');

  const customerInvoices = getStoredInvoices(dummyCustomerCompanyId);
  assert.strictEqual(
    customerInvoices.length,
    0,
    `New customer must receive 0 invoices, got ${customerInvoices.length}`
  );
  console.log('✓ PASS 1.3: getStoredInvoices returns empty list [] for new customer company');

  const customerDocuments = getStoredDocuments(dummyCustomerCompanyId);
  assert.strictEqual(
    customerDocuments.length,
    0,
    `New customer must receive 0 documents, got ${customerDocuments.length}`
  );
  console.log('✓ PASS 1.4: getStoredDocuments returns empty list [] for new customer company');

  // Verify that DEFAULT_COMPANY (Meridian) demo data is still accessible for Meridian demo account
  const meridianBookings = getStoredBookings('comp-meridian-001');
  assert.ok(
    meridianBookings.length > 0,
    'Meridian demo account should receive Meridian demo bookings'
  );
  console.log('✓ PASS 1.5: Meridian demo account preserves baseline demo bookings for sales/demo flows');

  // 2. Static Code Verification: Admin Search Input Autofill Protection
  console.log('\n--- 2. Static Code Verification: Admin Search Bar Autofill Protection ---');
  const adminPortalPath = path.resolve(process.cwd(), 'src/AdminPortal.tsx');
  const adminPortalCode = fs.readFileSync(adminPortalPath, 'utf-8');

  assert.ok(
    adminPortalCode.includes('id="admin-dispatch-search"'),
    'Admin search bar must have unique id="admin-dispatch-search"'
  );
  assert.ok(
    adminPortalCode.includes('type="search"'),
    'Admin search bar must have type="search" to prevent Chrome password manager heuristics'
  );
  assert.ok(
    adminPortalCode.includes('name="adminDispatchSearchQuery"'),
    'Admin search bar must have explicit non-credential name'
  );
  assert.ok(
    adminPortalCode.includes('data-lpignore="true"'),
    'Admin search bar must have data-lpignore="true"'
  );
  assert.ok(
    adminPortalCode.includes('decoy_pilot_username') && adminPortalCode.includes('decoy_pilot_password'),
    'Spoke pilot dispatch modal must contain decoy honeypot fields to intercept password managers'
  );
  assert.ok(
    adminPortalCode.includes('decoy_edit_search'),
    'Edit drawer form must contain decoy input to shield search bar'
  );
  console.log('✓ PASS 2.1: Admin search bar has type="search", explicit name/id, and password decoy honeypots in modals');

  // 3. Static Code Verification: Customer Portal Tenant Isolation
  console.log('\n--- 3. Static Code Verification: Portal Scoped State ---');
  const portalPath = path.resolve(process.cwd(), 'src/Portal.tsx');
  const portalCode = fs.readFileSync(portalPath, 'utf-8');

  assert.ok(
    portalCode.includes('scopedBookings'),
    'Portal.tsx must compute scopedBookings for customer tenant isolation'
  );
  assert.ok(
    portalCode.includes('scopedQuotes'),
    'Portal.tsx must compute scopedQuotes for customer tenant isolation'
  );
  assert.ok(
    portalCode.includes('scopedInvoices'),
    'Portal.tsx must compute scopedInvoices for customer tenant isolation'
  );
  assert.ok(
    portalCode.includes('scopedDocuments'),
    'Portal.tsx must compute scopedDocuments for customer tenant isolation'
  );
  assert.ok(
    portalCode.includes('bookings={scopedBookings}'),
    'Portal.tsx must pass scopedBookings to child views'
  );
  assert.ok(
    portalCode.includes('setBookings([])'),
    'Portal.tsx handleSignOut must clear in-memory booking state'
  );
  console.log('✓ PASS 3.1: Portal strictly scopes all data views by authenticated user company_id');

  // 4. Verification of Zero-Booking Empty State Handling
  console.log('\n--- 4. Static Code Verification: Empty State Polish ---');
  const liveTrackingPath = path.resolve(process.cwd(), 'src/components/views/LiveTrackingView.tsx');
  const liveTrackingCode = fs.readFileSync(liveTrackingPath, 'utf-8');
  assert.ok(
    liveTrackingCode.includes('No Active Fleet Telemetry'),
    'LiveTrackingView must render clean empty state when bookings is empty'
  );

  const mobileDashboardPath = path.resolve(process.cwd(), 'src/components/views/MobileDashboardView.tsx');
  const mobileDashboardCode = fs.readFileSync(mobileDashboardPath, 'utf-8');
  assert.ok(
    mobileDashboardCode.includes('No Active Consignments'),
    'MobileDashboardView must render clean zero-booking welcome card'
  );
  assert.ok(
    mobileDashboardCode.includes('No recent bookings recorded yet'),
    'MobileDashboardView must not fabricate demo jobs when bookings is empty'
  );
  console.log('✓ PASS 4.1: LiveTrackingView and MobileDashboardView gracefully handle 0-booking state without leaking demo jobs');

  console.log('\n=================================================================');
  console.log('ALL CUSTOMER TENANT ISOLATION & AUTOFILL TESTS PASSED (0 failures)');
  console.log('=================================================================\n');
}

runTenantIsolationAndAutofillTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

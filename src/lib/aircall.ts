/**
 * NEO Transport — Aircall Client Telephony Utilities
 *
 * Provides:
 * - Aircall configuration (HQ Number, duty line).
 * - Dial URL generation (aircall:, web phone CTI, tel:).
 * - Click-to-call handler with popup support for Aircall Web Phone.
 */

export const AIRCALL_CONFIG = {
  hqNumber: '+44 1925 986076',
  hqNumberNational: '01925 986076',
  hqName: 'NEO - HQ Desk',
  primaryAgent: 'Nnamdi Ohiaeri',
  aircallWebPhoneBase: 'https://phone.aircall.io',
} as const;

/**
 * Normalizes phone number into clean dialable digits.
 */
export function cleanPhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  return rawPhone.trim().replace(/[^\d+]/g, '');
}

/**
 * Generates dial URL based on preferred mode.
 * - 'app': standard desktop app protocol (aircall:+441925986076)
 * - 'web': browser-based Aircall Web Phone CTI (https://phone.aircall.io?phone_number=...)
 * - 'tel': OS fallback telephony handler (tel:+441925986076)
 */
export function getAircallDialUrl(
  phone: string,
  mode: 'app' | 'web' | 'tel' = 'app'
): string {
  const clean = cleanPhoneNumber(phone);
  if (!clean) return '#';

  switch (mode) {
    case 'app':
      return `aircall:${clean}`;
    case 'web':
      return `${AIRCALL_CONFIG.aircallWebPhoneBase}?phone_number=${encodeURIComponent(clean)}`;
    case 'tel':
    default:
      return `tel:${clean}`;
  }
}

/**
 * Initiates an Aircall outbound call.
 * If preferWeb is true or app protocol isn't caught, opens the official Aircall Web Phone in a dedicated compact popup window.
 */
export function initiateAircallDial(phone: string, preferWeb: boolean = false): void {
  const clean = cleanPhoneNumber(phone);
  if (!clean) return;

  if (preferWeb) {
    const webUrl = getAircallDialUrl(clean, 'web');
    const width = 380;
    const height = 660;
    const left = window.screen.width - width - 40;
    const top = 60;
    window.open(
      webUrl,
      'AircallWebPhone',
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=no`
    );
  } else {
    // Open aircall: protocol via hidden link / location
    const appUrl = getAircallDialUrl(clean, 'app');
    window.location.href = appUrl;
  }
}

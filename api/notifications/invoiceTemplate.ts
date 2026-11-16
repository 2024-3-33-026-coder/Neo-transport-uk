/**
 * NEO TRANSPORT LTD — PREMIUM TRANSACTIONAL INVOICE EMAIL TEMPLATE
 *
 * Implements a bespoke, corporate-editorial transactional invoice email
 * sent to customers immediately following a server-verified payment.
 *
 * ARCHITECTURAL STANDARDS:
 * - Table-based HTML layout with inline CSS for 100% email client compatibility
 *   (Gmail Web/Mobile, Outlook Desktop/Web, Apple Mail, iOS Mail, Android clients).
 * - Complete Outlook MSO conditional wrappers and DPI normalization.
 * - Responsive mobile styling with clean fluid scaling down to 320px.
 * - XSS-proof dynamic escaping on all interpolated text parameters.
 * - Authoritative UK logistics brand typography, metadata hierarchy, and palette.
 * - Synchronous generation of matching plain-text fallback.
 */

import { CONTACT_CONFIG } from '../../src/lib/config.js';

export interface PaymentInvoiceEmailPayload {
  bookingId: string;
  amountGbp: number;
  paymentIntentId?: string;
  customerName?: string;
  companyName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  paymentDate?: string;
  paymentMethod?: string;
  currency?: string;
  pickup?: string;
  dropoff?: string;
  vehicle?: string;
  serviceDescription?: string;
  invoiceUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  logoUrl?: string;
}

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * Escapes unsafe characters to prevent HTML/XSS injection in email renderers.
 */
export function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validates URLs to ensure only safe HTTP/HTTPS, relative portal, or data-URI protocols are accepted.
 * Returns raw string (unescaped) for plain-text or further escaping.
 */
export function validateUrl(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (
    /^https?:\/\//i.test(trimmed) ||
    /^\//i.test(trimmed) ||
    /^data:image\/[a-z0-9+.-]+;base64,/i.test(trimmed)
  ) {
    return trimmed;
  }
  return '';
}

/**
 * Sanitizes URLs for safe inclusion in HTML attributes (href, src).
 */
export function sanitizeUrl(url?: string): string {
  const validated = validateUrl(url);
  return validated ? escapeHtml(validated) : '';
}

/**
 * Resolves the base app origin from environment variables or authoritative production domain.
 */
function getBaseAppUrl(): string {
  return (
    process.env.APP_ORIGIN ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    'https://neotransport.co.uk'
  ).replace(/\/+$/, '');
}

/**
 * Formats a given monetary amount into a clean, locale-aware currency string (e.g. £285.00).
 */
export function formatCurrency(amount: number, currency = 'GBP'): string {
  const numericAmount = Number(amount);
  const safeAmount = isNaN(numericAmount) ? 0 : numericAmount;

  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch (_e) {
    // Fallback if an unexpected currency code is supplied
    return `£${safeAmount.toFixed(2)}`;
  }
}

/**
 * Formats a date string, timestamp, or Date instance into a dignified UK business date/time string.
 */
export function formatUkDate(dateInput?: string | Date | number): string {
  if (!dateInput) {
    const now = new Date();
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/London',
    }).format(now) + ' UK';
  }

  // If already formatted like "25 Oct 2026, 03:25 UK"
  if (typeof dateInput === 'string' && /^[0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{4}/.test(dateInput)) {
    return dateInput;
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return String(dateInput);
  }

  return (
    new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/London',
    }).format(d) + ' UK'
  );
}

/**
 * Renders the authoritative NEO Transport Transactional Invoice Email.
 */
export function renderPaymentInvoiceEmail(payload: PaymentInvoiceEmailPayload): RenderedTemplate {
  const rawBookingId = (payload.bookingId || '').trim();
  const bookingRef = rawBookingId || 'NT-BOOKING';
  const escapedBookingRef = escapeHtml(bookingRef);

  // Validate amount
  const numericAmount = Number(payload.amountGbp);
  const amountGbp = isNaN(numericAmount) ? 0 : numericAmount;
  const currency = (payload.currency || 'GBP').toUpperCase();
  const formattedAmount = formatCurrency(amountGbp, currency);

  // Customer & Company
  const customerName = (payload.customerName || 'Valued Customer').trim();
  const escapedCustomerName = escapeHtml(customerName);
  const companyName = payload.companyName ? payload.companyName.trim() : '';
  const escapedCompanyName = escapeHtml(companyName);

  // Invoice & Payment Details
  const defaultInvoiceNumber = `INV-${bookingRef.replace(/[^A-Za-z0-9]/g, '')}`;
  const invoiceNumber = (payload.invoiceNumber || defaultInvoiceNumber).trim();
  const escapedInvoiceNumber = escapeHtml(invoiceNumber);

  const paymentDate = formatUkDate(payload.paymentDate);
  const escapedPaymentDate = escapeHtml(paymentDate);

  const invoiceDate = payload.invoiceDate ? formatUkDate(payload.invoiceDate) : paymentDate;
  const escapedInvoiceDate = escapeHtml(invoiceDate);

  const paymentMethod = (payload.paymentMethod || 'Debit / Credit Card (Stripe)').trim();
  const escapedPaymentMethod = escapeHtml(paymentMethod);

  const paymentIntentId = (payload.paymentIntentId || '').trim();
  const escapedPaymentIntentId = escapeHtml(paymentIntentId);

  // Logistics Route Context
  const pickup = (payload.pickup || '').trim();
  const escapedPickup = escapeHtml(pickup);
  const dropoff = (payload.dropoff || '').trim();
  const escapedDropoff = escapeHtml(dropoff);
  const vehicle = (payload.vehicle || '').trim();
  const escapedVehicle = escapeHtml(vehicle);
  const serviceDescription = (payload.serviceDescription || '').trim();
  const escapedServiceDescription = escapeHtml(serviceDescription);
  const hasRouteContext = Boolean(pickup && dropoff);

  // URLs & Branding Assets
  const appUrl = getBaseAppUrl();
  const rawInvoiceUrl = validateUrl(payload.invoiceUrl) || `${appUrl}/portal?view=invoices&highlight=${encodeURIComponent(invoiceNumber)}`;
  const htmlInvoiceUrl = escapeHtml(rawInvoiceUrl);

  const rawLogoUrl = validateUrl(payload.logoUrl || process.env.NEO_EMAIL_LOGO_URL) || `${appUrl}/brand/logos/neo-transport-full-blue-navy.png`;
  const htmlLogoUrl = escapeHtml(rawLogoUrl);

  // Support Contacts from authoritative config
  const supportEmail = (payload.supportEmail || CONTACT_CONFIG.email.accounts || 'accounts@neotransport.co.uk').trim();
  const escapedSupportEmail = escapeHtml(supportEmail);
  const supportPhone = (payload.supportPhone || CONTACT_CONFIG.phone.primary || '0800 246 8135').trim();
  const escapedSupportPhone = escapeHtml(supportPhone);

  // 1. Authoritative Subject & Preheader
  const subject = `Payment Received: ${formattedAmount} for Booking ${escapedBookingRef}`;
  const preheaderText = `Your payment of ${formattedAmount} is confirmed. View your invoice and booking summary for ${escapedBookingRef}.`;

  // 2. High-Performance, Bulletproof HTML Email Template
  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    /* Client resets */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; min-width: 100%; background-color: #F3F6F9; }
    
    /* Hover and interaction */
    a { color: #10243A; text-decoration: none; }
    .cta-button:hover { background-color: #182B40 !important; }
    
    /* Responsive breakpoints */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .mobile-padding { padding-left: 20px !important; padding-right: 20px !important; }
      .mobile-header-padding { padding: 20px 20px 16px 20px !important; }
      .mobile-headline { font-size: 24px !important; line-height: 30px !important; }
      .mobile-amount { font-size: 28px !important; line-height: 34px !important; }
      .mobile-stack { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .mobile-stack-cell { display: block !important; width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; }
      .mobile-cta-btn { display: block !important; width: 100% !important; text-align: center !important; box-sizing: border-box !important; }
      .mobile-meta-table td { padding-top: 8px !important; padding-bottom: 8px !important; word-break: break-word !important; overflow-wrap: anywhere !important; }
      .break-word-cell { word-break: break-word !important; overflow-wrap: anywhere !important; }
    }
  </style>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a, span { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important; }
    .vml-btn { text-decoration: none; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #F3F6F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">

  <!-- Preheader Hidden Text -->
  <div style="display: none; font-size: 1px; color: #333333; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    ${preheaderText}
    &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <!-- Outer Canvas Table -->
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #F3F6F9; width: 100%; margin: 0; padding: 36px 12px 48px;">
    <tr>
      <td align="center" valign="top">

        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
        <![endif]-->

        <!-- Main Card Container (Max 600px) -->
        <table role="presentation" class="email-container" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border-radius: 8px; border: 1px solid #DCE4EC; overflow: hidden; box-shadow: 0 1px 3px rgba(16, 36, 58, 0.04);">
          
          <!-- 1. BRAND HEADER -->
          <tr>
            <td class="mobile-header-padding" style="padding: 30px 36px 22px; background-color: #FFFFFF; border-bottom: 1px solid #EAEFF5;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" valign="middle">
                    <!-- Official NEO Transport Logo -->
                    <a href="${sanitizeUrl(appUrl)}" target="_blank" style="display: inline-block; text-decoration: none;">
                      <img src="${htmlLogoUrl}" alt="NEO Transport" width="160" height="24" border="0" style="width: 160px; height: auto; max-width: 175px; display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 18px; font-weight: 800; color: #10243A; letter-spacing: -0.5px;" />
                    </a>
                  </td>
                  <td align="right" valign="middle">
                    <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace, sans-serif; font-size: 11px; font-weight: 700; color: #738196; letter-spacing: 1.2px; text-transform: uppercase;">
                      INVOICE RECEIPT
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 2. PAYMENT CONFIRMATION & INTRO -->
          <tr>
            <td class="mobile-padding" style="padding: 32px 36px 20px;">
              
              <!-- Status Indicator Badge -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 14px;">
                <tr>
                  <td style="background-color: #EBF8F2; border: 1px solid #BBE5D0; border-radius: 4px; padding: 4px 10px;">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: #1D7C50; letter-spacing: 0.8px; text-transform: uppercase;">
                      &#9679; PAYMENT VERIFIED
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Main Headline -->
              <h1 class="mobile-headline" style="margin: 0 0 12px; font-size: 28px; font-weight: 800; line-height: 34px; color: #10243A; letter-spacing: -0.6px;">
                Payment received. Thank you.
              </h1>

              <!-- Personalized Greeting & Intro Copy -->
              <p style="margin: 0 0 8px; font-size: 15px; line-height: 24px; color: #344256;">
                Hi <strong>${escapedCustomerName}</strong>${escapedCompanyName ? ` (${escapedCompanyName})` : ''},
              </p>
              <p style="margin: 0; font-size: 15px; line-height: 24px; color: #344256;">
                Thank you for your payment. We have successfully received and verified your payment for transport booking <strong style="font-family: 'SFMono-Regular', Consolas, monospace; color: #10243A;">${escapedBookingRef}</strong>. Your booking is active on the central dispatch board and your official VAT invoice is available below.
              </p>

            </td>
          </tr>

          <!-- 3. AMOUNT PAID HIGHLIGHT BOX -->
          <tr>
            <td class="mobile-padding" style="padding: 12px 36px 24px;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; border: 1px solid #DCE4EC; border-left: 4px solid #3898EC; border-radius: 6px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <div style="font-family: 'SFMono-Regular', Consolas, monospace, sans-serif; font-size: 11px; font-weight: 700; color: #738196; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px;">
                            TOTAL AMOUNT PAID
                          </div>
                          <div class="mobile-amount" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 32px; font-weight: 800; line-height: 38px; color: #10243A; letter-spacing: -0.5px;">
                            ${formattedAmount} <span style="font-size: 14px; font-weight: 600; color: #738196; letter-spacing: 0.5px;">${escapeHtml(currency)}</span>
                          </div>
                          <div style="margin-top: 6px; font-size: 12px; font-weight: 600; color: #247A57;">
                            Status: Paid in full &middot; Zero balance remaining
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 4. TRANSACTION & INVOICE METADATA TABLE -->
          <tr>
            <td class="mobile-padding" style="padding: 4px 36px 24px;">
              <div style="font-family: 'SFMono-Regular', Consolas, monospace, sans-serif; font-size: 11px; font-weight: 700; color: #738196; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px;">
                PAYMENT &amp; INVOICE SUMMARY
              </div>

              <table role="presentation" class="mobile-meta-table" width="100%" border="0" cellpadding="0" cellspacing="0" style="border: 1px solid #EAEFF5; border-radius: 6px; overflow: hidden;">
                <!-- Booking Reference -->
                <tr style="background-color: #FFFFFF;">
                  <td width="38%" style="padding: 12px 16px; font-size: 13px; color: #738196; border-bottom: 1px solid #EAEFF5; font-weight: 500;">
                    Booking Reference
                  </td>
                  <td width="62%" class="break-word-cell" style="padding: 12px 16px; font-size: 14px; font-weight: 700; color: #10243A; font-family: 'SFMono-Regular', Consolas, monospace; border-bottom: 1px solid #EAEFF5; word-break: break-word; overflow-wrap: anywhere;">
                    ${escapedBookingRef}
                  </td>
                </tr>

                <!-- Invoice Number -->
                <tr style="background-color: #F8FAFC;">
                  <td width="38%" style="padding: 12px 16px; font-size: 13px; color: #738196; border-bottom: 1px solid #EAEFF5; font-weight: 500;">
                    Invoice Number
                  </td>
                  <td width="62%" class="break-word-cell" style="padding: 12px 16px; font-size: 14px; font-weight: 700; color: #10243A; font-family: 'SFMono-Regular', Consolas, monospace; border-bottom: 1px solid #EAEFF5; word-break: break-word; overflow-wrap: anywhere;">
                    ${escapedInvoiceNumber}
                  </td>
                </tr>

                <!-- Payment Date -->
                <tr style="background-color: #FFFFFF;">
                  <td width="38%" style="padding: 12px 16px; font-size: 13px; color: #738196; border-bottom: 1px solid #EAEFF5; font-weight: 500;">
                    Payment Verified At
                  </td>
                  <td width="62%" class="break-word-cell" style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #344256; border-bottom: 1px solid #EAEFF5; word-break: break-word; overflow-wrap: anywhere;">
                    ${escapedPaymentDate}
                  </td>
                </tr>

                <!-- Payment Method -->
                <tr style="background-color: #F8FAFC;">
                  <td width="38%" style="padding: 12px 16px; font-size: 13px; color: #738196; border-bottom: 1px solid #EAEFF5; font-weight: 500;">
                    Payment Method
                  </td>
                  <td width="62%" class="break-word-cell" style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #344256; border-bottom: 1px solid #EAEFF5; word-break: break-word; overflow-wrap: anywhere;">
                    ${escapedPaymentMethod}
                  </td>
                </tr>

                <!-- Stripe Transaction ID (if present) -->
                ${
                  escapedPaymentIntentId
                    ? `<tr style="background-color: #FFFFFF;">
                  <td width="38%" style="padding: 12px 16px; font-size: 13px; color: #738196; border-bottom: 1px solid #EAEFF5; font-weight: 500;">
                    Stripe Reference
                  </td>
                  <td width="62%" class="break-word-cell" style="padding: 12px 16px; font-size: 12px; font-family: 'SFMono-Regular', Consolas, monospace; color: #526B82; border-bottom: 1px solid #EAEFF5; word-break: break-all; overflow-wrap: anywhere;">
                    ${escapedPaymentIntentId}
                  </td>
                </tr>`
                    : ''
                }

                <!-- VAT Status -->
                <tr style="background-color: ${escapedPaymentIntentId ? '#F8FAFC' : '#FFFFFF'};">
                  <td width="38%" style="padding: 12px 16px; font-size: 13px; color: #738196; font-weight: 500;">
                    VAT Registration
                  </td>
                  <td width="62%" style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #344256; font-family: 'SFMono-Regular', Consolas, monospace;">
                    ${CONTACT_CONFIG.company.vatNumber} (UK)
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${
            hasRouteContext
              ? `<!-- 5. LOGISTICS ROUTE CONTEXT -->
          <tr>
            <td class="mobile-padding" style="padding: 0 36px 24px;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border: 1px solid #EAEFF5; border-radius: 6px; padding: 14px 16px;">
                <tr>
                  <td>
                    <div style="font-family: 'SFMono-Regular', Consolas, monospace, sans-serif; font-size: 11px; font-weight: 700; color: #738196; letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 6px;">
                      TRANSIT ROUTE &amp; SERVICE ALLOCATION
                    </div>
                    <div style="font-size: 13px; font-weight: 700; color: #10243A; margin-bottom: 4px;">
                      ${escapedPickup} &rarr; ${escapedDropoff}
                    </div>
                    <div style="font-size: 12px; color: #526B82;">
                      Allocated Vehicle: <strong>${escapedVehicle || 'Dedicated Urgent Freight'}</strong>${escapedServiceDescription ? ` &middot; Cargo: ${escapedServiceDescription}` : ''}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
              : ''
          }

          <!-- 6. PRIMARY CALL TO ACTION -->
          <tr>
            <td class="mobile-padding" style="padding: 8px 36px 28px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 0 14px;">
                <tr>
                  <td align="left">
                    <!-- Bulletproof Navy CTA Button with MSO VML Support -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="mobile-btn-container">
                      <tr>
                        <td align="center" bgcolor="#10243A" style="border-radius: 6px; background-color: #10243A;">
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${htmlInvoiceUrl}" style="height:46px;v-text-anchor:middle;width:220px;" arcsize="13%" stroke="f" fillcolor="#10243A">
                            <w:anchorlock/>
                            <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">View your invoice &rarr;</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-- -->
                          <a href="${htmlInvoiceUrl}" target="_blank" class="cta-button mobile-cta-btn" style="display: inline-block; padding: 14px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 700; color: #FFFFFF; text-decoration: none; border-radius: 6px; background-color: #10243A; border: 1px solid #10243A; letter-spacing: 0.2px; line-height: 18px; text-align: center;">
                            View your invoice &rarr;
                          </a>
                          <!--<![endif]-->
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Invoice Access Notice -->
              <p style="margin: 0; font-size: 13px; line-height: 20px; color: #738196;">
                Your official invoice is available to view, print, and download securely through your NEO Transport customer portal.
              </p>
            </td>
          </tr>

          <!-- 7. CUSTOMER SUPPORT SECTION -->
          <tr>
            <td class="mobile-padding" style="padding: 24px 36px; background-color: #FAFBFD; border-top: 1px solid #EAEFF5;">
              <div style="font-size: 13px; font-weight: 700; color: #10243A; margin-bottom: 4px;">
                Need help with your invoice?
              </div>
              <p style="margin: 0 0 10px; font-size: 13px; line-height: 20px; color: #526B82;">
                If you have questions regarding this payment, billing reconciliation, or transport dispatch, our dedicated accounts desk is ready to help:
              </p>
              <div style="font-size: 13px; color: #344256;">
                <strong>Email:</strong> <a href="mailto:${escapedSupportEmail}" style="color: #3898EC; text-decoration: none; font-weight: 600;">${escapedSupportEmail}</a>
                &nbsp;&middot;&nbsp;
                <strong>24/7 Telephone:</strong> <a href="tel:${CONTACT_CONFIG.phone.primaryRaw}" style="color: #10243A; text-decoration: none; font-weight: 600;">${escapedSupportPhone}</a>
              </div>
            </td>
          </tr>

          <!-- 8. REFINED CORPORATE FOOTER -->
          <tr>
            <td class="mobile-padding" style="padding: 24px 36px; background-color: #F8FAFC; border-top: 1px solid #DCE4EC;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" style="font-size: 11px; line-height: 18px; color: #738196;">
                    <div style="font-weight: 700; color: #344256; margin-bottom: 3px;">
                      NEO Transport Ltd &middot; Emergency Freight &amp; Dedicated Logistics
                    </div>
                    <div>
                      Emergency Freight Network Ltd t/a NEO Transport &middot; Company Registered in England &amp; Wales: ${CONTACT_CONFIG.company.companyNumber}
                    </div>
                    <div>
                      VAT Registration: ${CONTACT_CONFIG.company.vatNumber} &middot; Central Priority Hotline: 0800 246 8135
                    </div>
                    <div style="margin-top: 10px; color: #94A3B8;">
                      This is an automated transactional confirmation regarding your account payment. Thank you for choosing NEO Transport.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- End Main Card Container -->

        <!--[if (gte mso 9)|(IE)]>
            </td>
          </tr>
        </table>
        <![endif]-->

      </td>
    </tr>
  </table>

</body>
</html>`;

  // 3. Clean, Professional Plain-Text Fallback
  const text = `================================================================================
NEO TRANSPORT — PAYMENT CONFIRMATION & INVOICE RECEIPT
================================================================================

Status: PAYMENT VERIFIED & CONFIRMED (PAID IN FULL)

Hi ${customerName}${companyName ? ` (${companyName})` : ''},

Thank you for your business. We have successfully received and verified your
payment of ${formattedAmount} ${currency} for transport booking ${bookingRef}.
Your booking is confirmed on the central dispatch board and your official
VAT invoice is available to view and download below.

--------------------------------------------------------------------------------
PAYMENT SUMMARY
--------------------------------------------------------------------------------
Total Amount Paid:  ${formattedAmount} ${currency}
Payment Status:     Paid in Full · Zero Balance Remaining
Payment Verified:   ${paymentDate}
Payment Method:     ${paymentMethod}
${paymentIntentId ? `Stripe Reference:   ${paymentIntentId}\n` : ''}VAT Registration:   ${CONTACT_CONFIG.company.vatNumber} (UK)

--------------------------------------------------------------------------------
INVOICE & BOOKING DETAILS
--------------------------------------------------------------------------------
Booking Reference:  ${bookingRef}
Invoice Number:     ${invoiceNumber}
Invoice Date:       ${invoiceDate}
${
  hasRouteContext
    ? `Route:              ${pickup} -> ${dropoff}
Allocated Vehicle:  ${vehicle || 'Dedicated Urgent Freight'}
${serviceDescription ? `Cargo / Service:    ${serviceDescription}\n` : ''}`
    : ''
}
--------------------------------------------------------------------------------
INVOICE ACCESS
--------------------------------------------------------------------------------
Your official VAT invoice is available to view, print, and download securely
through the NEO Transport customer portal:
${rawInvoiceUrl}

--------------------------------------------------------------------------------
NEED HELP WITH YOUR INVOICE?
--------------------------------------------------------------------------------
If you have any questions regarding your invoice, payment, or transport booking,
please contact our accounts and operations desk:
- Accounts Email:   ${supportEmail}
- 24/7 Telephone:   ${supportPhone} (UK Freephone)
- Central Dispatch: dispatch@neotransport.co.uk

================================================================================
NEO Transport Ltd · Dedicated Logistics & Emergency Freight
Emergency Freight Network Ltd (Company No. ${CONTACT_CONFIG.company.companyNumber})
VAT Number: ${CONTACT_CONFIG.company.vatNumber}
Customer Portal: ${appUrl}
Thank you for choosing NEO Transport.
================================================================================
`;

  return { subject, html, text };
}

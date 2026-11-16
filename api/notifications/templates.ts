/**
 * NEO TRANSPORT LTD — TRANSACTIONAL NOTIFICATION EMAIL TEMPLATES
 * 
 * Generates clean, accessible, UK commercial transport email templates
 * in both responsive HTML and plain text formats.
 * 
 * SECURITY:
 * - All dynamic parameters are HTML-escaped to prevent injection.
 * - Monospace styling is applied to booking references, account codes, and VAT numbers.
 * - Links use authoritative app origin from APP_ORIGIN environment variable.
 */

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getBaseAppUrl(): string {
  return process.env.APP_ORIGIN || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://neotransport.co.uk';
}

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * 1. Standby Application Submitted — Customer Receipt
 */
export function templateStandbySubmittedCustomer(payload: {
  companyName: string;
  contactName: string;
  volume?: string;
}): RenderedTemplate {
  const company = escapeHtml(payload.companyName);
  const contact = escapeHtml(payload.contactName);
  const appUrl = getBaseAppUrl();

  const subject = `Standby Facility Application Received — ${company}`;
  const text = `NEO TRANSPORT — STANDBY APPLICATION CONFIRMATION

Hello ${contact},

Thank you for applying for a dedicated Standby Logistics Facility with NEO Transport Ltd.

Application Details:
- Company Name: ${company}
- Anticipated Volume: ${payload.volume || '10-30 pallets/wk'}
- Status: PENDING OPERATIONS REVIEW
- Target Facility: £15,000 Credit Facility · 30-Day Terms

What happens next:
Our dispatch and credit underwriting team reviews all commercial applications within 15 minutes during operating hours. Once approved, you will receive your unique standby account code and instructions to access the 24/7 dedicated dispatch priority line.

Customer Portal: ${appUrl}
Emergency Operations: 0800 246 8135

NEO Transport Ltd — Dedicated Logistics & Emergency Freight
`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:24px;background-color:#0b1118;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f1f5f9;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#101923;border-radius:16px;border:1px solid #1e293b;overflow:hidden;">
    <tr>
      <td style="padding:32px 32px 24px;background-color:#070d14;border-bottom:1px solid #1e293b;">
        <span style="font-family:monospace;font-size:12px;color:#3898EC;letter-spacing:2px;font-weight:bold;text-transform:uppercase;">NEO TRANSPORT</span>
        <h1 style="margin:8px 0 0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Standby Facility Application Received</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 32px;font-size:14px;line-height:1.6;color:#cbd5e1;">
        <p style="margin:0 0 16px;">Hello <strong>${contact}</strong>,</p>
        <p style="margin:0 0 20px;">We have securely received your corporate standby facility application for <strong>${company}</strong>. Our underwriting team is currently reviewing your application.</p>
        
        <table width="100%" style="background-color:#0b1118;border-radius:12px;border:1px solid #1e293b;margin:0 0 24px;" cellpadding="14">
          <tr>
            <td>
              <div style="font-size:11px;font-family:monospace;color:#94a3b8;text-transform:uppercase;">Application Status</div>
              <div style="font-size:14px;font-weight:bold;color:#10b981;margin-top:2px;">● PENDING OPERATIONS REVIEW</div>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid #1e293b;">
              <div style="font-size:11px;font-family:monospace;color:#94a3b8;text-transform:uppercase;">Requested Facility</div>
              <div style="font-size:13px;font-weight:600;color:#f1f5f9;margin-top:2px;">£15,000 Standby Facility · 30-Day Monthly Statement Terms</div>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 16px;font-size:13px;color:#94a3b8;">Review SLA: Applications are typically processed within <strong>15 minutes</strong> during operating hours. You will receive an email confirmation containing your active account code upon approval.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px;background-color:#070d14;border-top:1px solid #1e293b;font-size:11px;color:#64748b;">
        NEO Transport Ltd · 24/7 Dedicated Logistics Priority Desk: 0800 246 8135
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * 2. Standby Application Submitted — Operations Alert
 */
export function templateStandbySubmittedOps(payload: {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  volume?: string;
  postcode?: string;
}): RenderedTemplate {
  const company = escapeHtml(payload.companyName);
  const contact = escapeHtml(payload.contactName);
  const email = escapeHtml(payload.email);
  const appUrl = getBaseAppUrl();

  const subject = `[ACTION REQUIRED] New Standby Application: ${company}`;
  const text = `[OPS ALERT] NEW STANDBY ACCOUNT APPLICATION

Company: ${company}
Contact: ${contact} (${email}, Phone: ${payload.phone || 'Not provided'})
Postcode: ${payload.postcode || 'Not provided'}
Stated Volume: ${payload.volume || 'Not specified'}

Action Required:
Review commercial credentials and approve or reject in the Admin Portal:
${appUrl}/admin

Timestamp: ${new Date().toISOString()}
`;

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background-color:#0f172a;color:#f8fafc;padding:20px;">
  <div style="max-width:550px;margin:auto;background:#1e293b;border-radius:12px;padding:24px;border:1px solid #334155;">
    <span style="font-family:monospace;color:#3898EC;font-weight:bold;font-size:12px;">DISPATCH OPERATIONS QUEUE</span>
    <h2 style="color:#ffffff;margin:8px 0 16px;">New Standby Account Application</h2>
    <p><strong>Company:</strong> ${company}</p>
    <p><strong>Contact:</strong> ${contact} &lt;${email}&gt;</p>
    <p><strong>Phone:</strong> ${escapeHtml(payload.phone || 'N/A')}</p>
    <p><strong>Volume:</strong> ${escapeHtml(payload.volume || 'N/A')}</p>
    <p><strong>Dispatch Hub Postcode:</strong> ${escapeHtml(payload.postcode || 'N/A')}</p>
    <div style="margin-top:24px;">
      <a href="${appUrl}/admin" style="background:#3898EC;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;display:inline-block;">Open Admin Review Queue</a>
    </div>
  </div>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * 3. Standby Application Approved — Customer Notification
 */
export function templateStandbyApprovedCustomer(payload: {
  companyName: string;
  contactName: string;
  accountCode: string;
}): RenderedTemplate {
  const company = escapeHtml(payload.companyName);
  const contact = escapeHtml(payload.contactName);
  const accountCode = escapeHtml(payload.accountCode);
  const appUrl = getBaseAppUrl();

  const subject = `Standby Account Approved & Active — ${accountCode} (${company})`;
  const text = `NEO TRANSPORT — ACCOUNT APPROVAL NOTIFICATION

Hello ${contact},

Congratulations. Your standby account application for ${company} has been APPROVED.

Account Summary:
- Approved Account Code: ${accountCode}
- Assigned Facility: £15,000 Credit Facility
- Commercial Terms: 30-Day Monthly Statement (BACS / Direct Settlement)
- Status: ACTIVE & DISPATCH ELIGIBLE

You can now sign in to the NEO Transport Customer Portal to place priority bookings and monitor live GPS tracking:
${appUrl}

24/7 Priority Emergency Dispatch Line: 0800 246 8135

NEO Transport Ltd
`;

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background-color:#0b1118;font-family:sans-serif;color:#f1f5f9;">
  <table width="100%" style="max-width:600px;margin:auto;background-color:#101923;border-radius:16px;border:1px solid #1e293b;overflow:hidden;">
    <tr>
      <td style="padding:28px 32px;background:#064e3b;border-bottom:1px solid #059669;">
        <span style="font-family:monospace;font-size:12px;color:#a7f3d0;font-weight:bold;letter-spacing:2px;">STANDBY ACCOUNT ACTIVE</span>
        <h1 style="color:#ffffff;margin:6px 0 0;font-size:22px;font-weight:800;">Welcome to NEO Transport</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 32px;font-size:14px;color:#cbd5e1;line-height:1.6;">
        <p style="margin:0 0 16px;">Hello <strong>${contact}</strong>,</p>
        <p style="margin:0 0 20px;">Your standby facility for <strong>${company}</strong> has been approved. Priority dispatch booking is now active on your account.</p>
        
        <div style="background:#0b1118;border:1px solid #10b981;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
          <div style="font-size:11px;font-family:monospace;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Approved Account Code</div>
          <div style="font-size:24px;font-family:monospace;font-weight:900;color:#10b981;margin:6px 0;">${accountCode}</div>
          <div style="font-size:12px;color:#a7f3d0;">£15,000 Credit Facility Assigned · 30-Day Terms</div>
        </div>

        <p style="margin:0 0 20px;"><a href="${appUrl}" style="background:#10b981;color:#ffffff;padding:12px 24px;border-radius:9999px;font-weight:bold;text-decoration:none;display:inline-block;">Access Customer Portal</a></p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * 4. Booking Confirmed — Customer Receipt
 */
export function templateBookingConfirmedCustomer(payload: {
  bookingId: string;
  companyName: string;
  contactName: string;
  pickup: string;
  dropoff: string;
  vehicle: string;
  totalGbp: number;
  paymentMethod: string;
}): RenderedTemplate {
  const ref = escapeHtml(payload.bookingId);
  const contact = escapeHtml(payload.contactName);
  const pickup = escapeHtml(payload.pickup);
  const dropoff = escapeHtml(payload.dropoff);
  const vehicle = escapeHtml(payload.vehicle);
  const total = Number(payload.totalGbp).toFixed(2);
  const appUrl = getBaseAppUrl();

  const subject = `Booking Confirmed: ${ref} — ${pickup} to ${dropoff}`;
  const text = `NEO TRANSPORT — BOOKING CONFIRMATION

Hello ${contact},

Your emergency freight booking has been confirmed and placed on the dispatch board.

Booking Reference: ${ref}
Route: ${pickup} → ${dropoff}
Allocated Vehicle: ${vehicle}
Agreed Total: £${total} (inc VAT)
Payment Method: ${payload.paymentMethod}
Status: SCHEDULED (Awaiting Driver Allocation)

Track Live: ${appUrl}
Operations Hotline: 0800 246 8135

NEO Transport Ltd
`;

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background-color:#0b1118;font-family:sans-serif;color:#f1f5f9;">
  <table width="100%" style="max-width:600px;margin:auto;background-color:#101923;border-radius:16px;border:1px solid #1e293b;overflow:hidden;">
    <tr>
      <td style="padding:28px 32px;background:#0c1c2e;border-bottom:1px solid #1e293b;">
        <span style="font-family:monospace;font-size:12px;color:#3898EC;font-weight:bold;letter-spacing:2px;">BOOKING CONFIRMED &amp; SCHEDULED</span>
        <h1 style="color:#ffffff;margin:6px 0 0;font-size:22px;font-weight:800;font-family:monospace;">${ref}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 32px;font-size:14px;color:#cbd5e1;line-height:1.6;">
        <p style="margin:0 0 16px;">Hello <strong>${contact}</strong>,</p>
        <p style="margin:0 0 20px;">Your transport booking has been accepted by central operations and scheduled for vehicle allocation.</p>

        <table width="100%" style="background:#0b1118;border-radius:12px;border:1px solid #1e293b;margin:0 0 24px;" cellpadding="12">
          <tr>
            <td style="font-size:12px;color:#94a3b8;width:120px;">Pickup Address:</td>
            <td style="font-size:13px;font-weight:600;color:#f8fafc;">${pickup}</td>
          </tr>
          <tr>
            <td style="font-size:12px;color:#94a3b8;border-top:1px solid #1e293b;">Drop-off Address:</td>
            <td style="font-size:13px;font-weight:600;color:#f8fafc;border-top:1px solid #1e293b;">${dropoff}</td>
          </tr>
          <tr>
            <td style="font-size:12px;color:#94a3b8;border-top:1px solid #1e293b;">Vehicle Type:</td>
            <td style="font-size:13px;font-weight:600;color:#f8fafc;border-top:1px solid #1e293b;">${vehicle}</td>
          </tr>
          <tr>
            <td style="font-size:12px;color:#94a3b8;border-top:1px solid #1e293b;">Agreed Total:</td>
            <td style="font-size:14px;font-weight:800;color:#10b981;border-top:1px solid #1e293b;font-family:monospace;">£${total}</td>
          </tr>
        </table>

        <a href="${appUrl}" style="background:#3898EC;color:#ffffff;padding:12px 24px;border-radius:9999px;font-weight:bold;text-decoration:none;display:inline-block;">View Live Shipment Tracking</a>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * 5. Booking Confirmed — Operations Alert
 */
export function templateBookingConfirmedOps(payload: {
  bookingId: string;
  companyName: string;
  pickup: string;
  dropoff: string;
  vehicle: string;
  totalGbp: number;
}): RenderedTemplate {
  const ref = escapeHtml(payload.bookingId);
  const company = escapeHtml(payload.companyName);
  const pickup = escapeHtml(payload.pickup);
  const dropoff = escapeHtml(payload.dropoff);

  const subject = `[NEW BOOKING] ${ref} — ${company} (${payload.vehicle})`;
  const text = `[DISPATCH ALERT] NEW BOOKING RECEIVED

Reference: ${ref}
Company: ${company}
Route: ${pickup} → ${dropoff}
Vehicle: ${payload.vehicle}
Agreed Price: £${Number(payload.totalGbp).toFixed(2)}
Timestamp: ${new Date().toISOString()}

Action: Allocate driver via Admin Portal Dispatch Board.
`;

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background-color:#0f172a;color:#f8fafc;padding:20px;">
  <div style="max-width:550px;margin:auto;background:#1e293b;border-radius:12px;padding:24px;border:1px solid #334155;">
    <span style="font-family:monospace;color:#3898EC;font-weight:bold;font-size:12px;">NEW DISPATCH ASSIGNMENT</span>
    <h2 style="color:#ffffff;margin:8px 0 16px;font-family:monospace;">${ref}</h2>
    <p><strong>Customer:</strong> ${company}</p>
    <p><strong>Pickup:</strong> ${pickup}</p>
    <p><strong>Dropoff:</strong> ${dropoff}</p>
    <p><strong>Vehicle:</strong> ${escapeHtml(payload.vehicle)}</p>
    <p><strong>Value:</strong> £${Number(payload.totalGbp).toFixed(2)}</p>
  </div>
</body>
</html>`;

  return { subject, html, text };
}

import {
  renderPaymentInvoiceEmail,
  type PaymentInvoiceEmailPayload,
} from './invoiceTemplate.js';

export {
  renderPaymentInvoiceEmail,
  type PaymentInvoiceEmailPayload,
};

/**
 * 6. Payment Status Verified — Customer Receipt & Invoice Notification
 * Delegates to the bespoke corporate editorial template.
 */
export function templatePaymentVerifiedCustomer(payload: PaymentInvoiceEmailPayload): RenderedTemplate {
  return renderPaymentInvoiceEmail(payload);
}

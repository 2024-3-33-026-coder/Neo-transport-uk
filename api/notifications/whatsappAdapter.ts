/**
 * NEO TRANSPORT LTD — TRANSACTIONAL WHATSAPP ADAPTER
 * 
 * Provides an extensible WhatsApp delivery adapter interface for Aircall WhatsApp API,
 * with a fail-closed mock adapter for automated offline testing.
 * 
 * SECURITY & GOVERNANCE:
 * - Credentials (AIRCALL_API_ID, AIRCALL_API_TOKEN, AIRCALL_WHATSAPP_LINE_ID)
 *   are loaded strictly from server-side environment variables.
 * - Outbound WhatsApp delivery is DISABLED by default.
 *   (Requires AIRCALL_WHATSAPP_ENABLED === 'true' and verified server configuration).
 * - Live client fails closed: outbound live network calls are guarded until
 *   the official Aircall account eligibility, line ID binding, and Meta templates are verified.
 * - Phone numbers and message bodies are strictly redacted/masked in production logs.
 * - Credentials and tokens are NEVER printed, logged, or exposed in error messages.
 */

export interface SendWhatsAppParams {
  to: string;
  templateId?: string;
  templateParams?: Record<string, any> | Array<{ key: string; value: string }>;
  text?: string;
  idempotencyKey?: string;
  bookingId?: string;
  companyId?: string;
  correlationId?: string;
}

export interface SendWhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
  status?: number;
  conversationId?: string;
}

export interface IWhatsAppProviderAdapter {
  readonly name: string;
  readonly isConfigured: boolean;
  readonly isEnabled: boolean;
  sendWhatsApp(params: SendWhatsAppParams): Promise<SendWhatsAppResult>;
}

/**
 * Sanitizes and masks phone numbers for secure logging without exposing customer PII.
 * Example: '+44 1925 986076' -> '+44 1925 ****76'
 * Example: '07700900123' -> '07700 ****23'
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') return '[REDACTED]';
  const clean = phone.trim();
  if (clean.length <= 4) return '****';
  const visiblePrefix = clean.length > 8 ? clean.slice(0, clean.length - 6).trimEnd() : clean.slice(0, 2);
  const visibleSuffix = clean.slice(-2);
  return `${visiblePrefix} ****${visibleSuffix}`;
}

/**
 * Validates and normalizes phone numbers to standard international/E.164 digits.
 */
export function validatePhoneNumber(rawPhone?: string | null): {
  isValid: boolean;
  normalized?: string;
  error?: string;
} {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { isValid: false, error: 'Phone number is required' };
  }

  const trimmed = rawPhone.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Phone number cannot be empty' };
  }

  // Remove whitespace, dashes, parentheses, dots
  let sanitized = trimmed.replace(/[\s\-\(\)\.]/g, '');

  // Must only contain digits and optional leading plus
  if (!/^\+?[0-9]{8,15}$/.test(sanitized)) {
    return { isValid: false, error: 'Phone number must contain between 8 and 15 digits' };
  }

  // Normalize UK standard national format: 07XXXXXXXXX -> +447XXXXXXXXX
  if (sanitized.startsWith('0') && sanitized.length === 11) {
    sanitized = `+44${sanitized.slice(1)}`;
  } else if (!sanitized.startsWith('+')) {
    // Default to + prefix if missing leading plus
    sanitized = `+${sanitized}`;
  }

  return { isValid: true, normalized: sanitized };
}

/**
 * Production Aircall WhatsApp Adapter (Phase 1 Safe Offline Stub)
 * 
 * Fails closed: outbound delivery is disabled by default and guarded.
 * Live HTTP client will only be activated when Aircall account eligibility,
 * line ID, and Meta approved templates are confirmed.
 */
export class AircallWhatsAppAdapter implements IWhatsAppProviderAdapter {
  public readonly name = 'aircall';

  private get apiId(): string {
    return process.env.AIRCALL_API_ID || '';
  }

  private get apiToken(): string {
    return process.env.AIRCALL_API_TOKEN || '';
  }

  private get lineId(): string {
    return process.env.AIRCALL_WHATSAPP_LINE_ID || '';
  }

  public get isConfigured(): boolean {
    const id = this.apiId.trim();
    const token = this.apiToken.trim();
    const line = this.lineId.trim();
    return Boolean(id && token && line);
  }

  public get isEnabled(): boolean {
    return process.env.AIRCALL_WHATSAPP_ENABLED === 'true' && this.isConfigured;
  }

  public async sendWhatsApp(params: SendWhatsAppParams): Promise<SendWhatsAppResult> {
    if (!this.isEnabled) {
      const reason = !this.isConfigured
        ? 'AIRCALL_API_ID, AIRCALL_API_TOKEN, or AIRCALL_WHATSAPP_LINE_ID are unconfigured'
        : 'AIRCALL_WHATSAPP_ENABLED is not set to true';
      return {
        success: false,
        error: `WHATSAPP_DELIVERY_DISABLED: ${reason}`,
        status: 503,
      };
    }

    // Safety guard for Phase 1: Fail closed until official API contract and line ID access are verified
    return {
      success: false,
      error: 'AIRCALL_WHATSAPP_LIVE_CLIENT_UNAVAILABLE: Live outbound WhatsApp dispatch is guarded until account eligibility, line ID binding, and pre-approved templates are confirmed by Aircall operations.',
      status: 503,
    };
  }
}

/**
 * Mock WhatsApp Adapter for hermetic unit and regression testing
 */
export class MockWhatsAppAdapter implements IWhatsAppProviderAdapter {
  public readonly name = 'mock';
  public isConfigured = true;
  public isEnabled = true;
  public sentMessages: Array<SendWhatsAppParams & { sentAt: string; messageId: string }> = [];
  public shouldFailNext = false;
  public failureMessage = 'Simulated Aircall upstream network failure';

  public async sendWhatsApp(params: SendWhatsAppParams): Promise<SendWhatsAppResult> {
    if (!this.isEnabled) {
      return {
        success: false,
        error: 'MOCK_WHATSAPP_DISABLED',
        status: 503,
      };
    }

    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      return {
        success: false,
        error: this.failureMessage,
        status: 500,
      };
    }

    const phoneValidation = validatePhoneNumber(params.to);
    if (!phoneValidation.isValid) {
      return {
        success: false,
        error: `INVALID_PHONE_NUMBER: ${phoneValidation.error}`,
        status: 400,
      };
    }

    const messageId = `mock-wa-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    this.sentMessages.push({
      ...params,
      to: phoneValidation.normalized || params.to,
      sentAt: new Date().toISOString(),
      messageId,
    });

    return {
      success: true,
      messageId,
      status: 200,
    };
  }

  public clear(): void {
    this.sentMessages = [];
    this.shouldFailNext = false;
  }
}

// Singleton adapter instance
let activeWhatsAppAdapter: IWhatsAppProviderAdapter = new AircallWhatsAppAdapter();

export function getActiveWhatsAppAdapter(): IWhatsAppProviderAdapter {
  return activeWhatsAppAdapter;
}

export function setWhatsAppAdapterForTesting(adapter: IWhatsAppProviderAdapter): void {
  activeWhatsAppAdapter = adapter;
}

export function resetWhatsAppAdapterForTesting(): void {
  activeWhatsAppAdapter = new AircallWhatsAppAdapter();
}

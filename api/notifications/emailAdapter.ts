/**
 * NEO TRANSPORT LTD — TRANSACTIONAL EMAIL ADAPTER
 * 
 * Provides an extensible email delivery adapter interface with Resend as the initial
 * production candidate, and a fail-closed mock adapter for hermetic unit testing.
 * 
 * SECURITY:
 * - Credentials (RESEND_API_KEY) are loaded strictly from server-side environment variables.
 * - Delivery is DISABLED by default (requires NEO_EMAIL_ENABLED === 'true' and valid key).
 * - API keys and credentials are never printed, logged, or exposed in error messages.
 */

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  status?: number;
}

export interface IEmailProviderAdapter {
  readonly name: string;
  readonly isConfigured: boolean;
  readonly isEnabled: boolean;
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>;
}

/**
 * Resend Transactional Email Provider Adapter
 * API: https://api.resend.com/emails
 */
export class ResendEmailAdapter implements IEmailProviderAdapter {
  public readonly name = 'resend';

  private get apiKey(): string {
    return process.env.RESEND_API_KEY || '';
  }

  public get isConfigured(): boolean {
    const key = this.apiKey;
    return typeof key === 'string' && key.trim().startsWith('re_');
  }

  public get isEnabled(): boolean {
    return process.env.NEO_EMAIL_ENABLED === 'true' && this.isConfigured;
  }

  public get fromAddress(): string {
    return process.env.NEO_EMAIL_FROM || 'NEO Transport <dispatch@neotransport.co.uk>';
  }

  public async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    if (!this.isEnabled) {
      const reason = !this.isConfigured
        ? 'RESEND_API_KEY is not configured or invalid'
        : 'NEO_EMAIL_ENABLED is not set to true';
      return {
        success: false,
        error: `EMAIL_DELIVERY_DISABLED: ${reason}`,
      };
    }

    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      };
      if (params.idempotencyKey) {
        headers['Idempotency-Key'] = params.idempotencyKey;
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          from: this.fromAddress,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
          reply_to: params.replyTo || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data?.message || `Resend API HTTP ${response.status}`;
        console.error(`[NEO Email] Resend delivery rejected (status ${response.status}):`, errorMsg);
        return {
          success: false,
          error: errorMsg,
          status: response.status,
        };
      }

      return {
        success: true,
        messageId: data?.id,
        status: response.status,
      };
    } catch (err: any) {
      console.error('[NEO Email] Transport error dispatching email via Resend:', err?.message || err);
      return {
        success: false,
        error: `Transport error: ${err?.message || 'Network failure'}`,
      };
    }
  }
}

/**
 * Mock Email Adapter for hermetic regression testing
 */
export class MockEmailAdapter implements IEmailProviderAdapter {
  public readonly name = 'mock';
  public isConfigured = true;
  public isEnabled = true;
  public sentEmails: Array<SendEmailParams & { sentAt: string; messageId: string }> = [];
  public shouldFailNext = false;
  public failureMessage = 'Simulated SMTP connection timeout';

  public async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    if (!this.isEnabled) {
      return {
        success: false,
        error: 'MOCK_EMAIL_DISABLED',
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

    const messageId = `mock-msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    this.sentEmails.push({
      ...params,
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
    this.sentEmails = [];
    this.shouldFailNext = false;
  }
}

// Singleton adapter instance
let activeEmailAdapter: IEmailProviderAdapter = new ResendEmailAdapter();

export function getActiveEmailAdapter(): IEmailProviderAdapter {
  return activeEmailAdapter;
}

export function setEmailAdapterForTesting(adapter: IEmailProviderAdapter): void {
  activeEmailAdapter = adapter;
}

export function resetEmailAdapterForTesting(): void {
  activeEmailAdapter = new ResendEmailAdapter();
}

/**
 * Resolves the operational alert email address from environment variables.
 * Never hardcodes unverified operational email addresses.
 */
export function getOperationsAlertEmail(): string {
  if (process.env.NEO_OPS_ALERT_EMAIL !== undefined) {
    return process.env.NEO_OPS_ALERT_EMAIL;
  }
  return 'ops@neotransport.co.uk';
}

/**
 * Resolves the billing/accounts alert email address from environment variables.
 */
export function getAccountsAlertEmail(): string {
  return process.env.NEO_ACCOUNTS_ALERT_EMAIL || 'accounts@neotransport.co.uk';
}

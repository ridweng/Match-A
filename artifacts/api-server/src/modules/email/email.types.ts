export type EmailLocale = "es" | "en";

export type EmailAddress = {
  email: string;
  name?: string;
};

export type EmailHealthStatus = {
  smtpEnabled: boolean;
  emailLogOnly: boolean;
  verifyOnStartup: boolean;
  provider: string;
  healthy: boolean | null;
  lastVerificationAttemptAt: string | null;
  lastVerificationSucceededAt: string | null;
  lastVerificationErrorCode: string | null;
};

export type EmailSendResult = {
  provider: string;
  messageId: string | null;
  accepted: number;
  skipped: boolean;
  logOnly: boolean;
};

export class EmailDeliveryError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable = true,
    public readonly provider = "smtp"
  ) {
    super(code);
  }
}

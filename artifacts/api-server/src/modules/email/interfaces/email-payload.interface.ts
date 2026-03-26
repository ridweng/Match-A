import type { EmailAddress } from "../email.types";

export interface EmailPayload {
  to: EmailAddress | EmailAddress[];
  from?: EmailAddress;
  subject: string;
  text: string;
  html: string;
  metadata?: Record<string, string | number | boolean | null>;
}

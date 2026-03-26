import type { EmailAddress } from "../email.types";

export type SendEmailDto = {
  to: EmailAddress | EmailAddress[];
  subject: string;
  text: string;
  html: string;
  metadata?: Record<string, string | number | boolean | null>;
};

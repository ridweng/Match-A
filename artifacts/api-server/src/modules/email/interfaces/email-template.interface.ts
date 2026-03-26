import type { EmailLocale } from "../email.types";

export interface EmailTemplateContent {
  subject: string;
  text: string;
  html: string;
}

export interface BaseEmailTemplateInput {
  locale: EmailLocale;
  appName: string;
  recipientName?: string;
}

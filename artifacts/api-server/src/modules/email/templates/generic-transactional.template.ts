import type { EmailTemplateContent } from "../interfaces/email-template.interface";

export type GenericTransactionalTemplateInput = {
  title: string;
  bodyText: string;
  bodyHtml?: string;
};

export function renderGenericTransactionalTemplate(
  input: GenericTransactionalTemplateInput
): EmailTemplateContent {
  return {
    subject: input.title,
    text: input.bodyText,
    html: input.bodyHtml || `<p>${input.bodyText}</p>`,
  };
}

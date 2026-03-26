import type {
  BaseEmailTemplateInput,
  EmailTemplateContent,
} from "../interfaces/email-template.interface";

export type VerifyEmailTemplateInput = BaseEmailTemplateInput & {
  verificationLink: string;
};

export function renderVerifyEmailTemplate(
  input: VerifyEmailTemplateInput
): EmailTemplateContent {
  const recipientName = input.recipientName || (input.locale === "es" ? "hola" : "there");

  if (input.locale === "es") {
    return {
      subject: `Verifica tu cuenta de ${input.appName}`,
      text: `Hola ${recipientName},\n\nVerifica tu cuenta de ${input.appName} abriendo este enlace:\n${input.verificationLink}\n\nSi no creaste esta cuenta, puedes ignorar este correo.`,
      html: `<p>Hola ${recipientName},</p><p>Verifica tu cuenta de ${input.appName} abriendo este enlace:</p><p><a href="${input.verificationLink}">${input.verificationLink}</a></p><p>Si no creaste esta cuenta, puedes ignorar este correo.</p>`,
    };
  }

  return {
    subject: `Verify your ${input.appName} account`,
    text: `Hi ${recipientName},\n\nVerify your ${input.appName} account by opening this link:\n${input.verificationLink}\n\nIf you did not create this account, you can ignore this email.`,
    html: `<p>Hi ${recipientName},</p><p>Verify your ${input.appName} account by opening this link:</p><p><a href="${input.verificationLink}">${input.verificationLink}</a></p><p>If you did not create this account, you can ignore this email.</p>`,
  };
}

import type {
  BaseEmailTemplateInput,
  EmailTemplateContent,
} from "../interfaces/email-template.interface";

export function renderWelcomeTemplate(
  input: BaseEmailTemplateInput
): EmailTemplateContent {
  const recipientName = input.recipientName || (input.locale === "es" ? "hola" : "there");

  if (input.locale === "es") {
    return {
      subject: `Bienvenido a ${input.appName}`,
      text: `Hola ${recipientName},\n\nTu cuenta ya está verificada. Bienvenido a ${input.appName}.\n\nEstamos listos para acompañarte en tu progreso.`,
      html: `<p>Hola ${recipientName},</p><p>Tu cuenta ya está verificada. Bienvenido a ${input.appName}.</p><p>Estamos listos para acompañarte en tu progreso.</p>`,
    };
  }

  return {
    subject: `Welcome to ${input.appName}`,
    text: `Hi ${recipientName},\n\nYour account is now verified. Welcome to ${input.appName}.\n\nWe are ready to support your progress.`,
    html: `<p>Hi ${recipientName},</p><p>Your account is now verified. Welcome to ${input.appName}.</p><p>We are ready to support your progress.</p>`,
  };
}

import type {
  BaseEmailTemplateInput,
  EmailTemplateContent,
} from "../interfaces/email-template.interface";

export type ResetPasswordTemplateInput = BaseEmailTemplateInput & {
  resetLink: string;
};

export function renderResetPasswordTemplate(
  input: ResetPasswordTemplateInput
): EmailTemplateContent {
  const recipientName = input.recipientName || (input.locale === "es" ? "hola" : "there");

  if (input.locale === "es") {
    return {
      subject: `Restablece tu contraseña de ${input.appName}`,
      text: `Hola ${recipientName},\n\nRecibimos una solicitud para restablecer tu contraseña. Usa este enlace:\n${input.resetLink}\n\nSi no solicitaste este cambio, puedes ignorar este correo.`,
      html: `<p>Hola ${recipientName},</p><p>Recibimos una solicitud para restablecer tu contraseña. Usa este enlace:</p><p><a href="${input.resetLink}">${input.resetLink}</a></p><p>Si no solicitaste este cambio, puedes ignorar este correo.</p>`,
    };
  }

  return {
    subject: `Reset your ${input.appName} password`,
    text: `Hi ${recipientName},\n\nWe received a request to reset your password. Use this link:\n${input.resetLink}\n\nIf you did not request this change, you can ignore this email.`,
    html: `<p>Hi ${recipientName},</p><p>We received a request to reset your password. Use this link:</p><p><a href="${input.resetLink}">${input.resetLink}</a></p><p>If you did not request this change, you can ignore this email.</p>`,
  };
}

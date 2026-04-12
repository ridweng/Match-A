import type {
  BaseEmailTemplateInput,
  EmailTemplateContent,
} from "../interfaces/email-template.interface";
import { renderMatchaAuthEmailHtml } from "./matcha-auth-email.template";

export type ResetPasswordTemplateInput = BaseEmailTemplateInput & {
  resetLink: string;
};

export function renderResetPasswordTemplate(
  input: ResetPasswordTemplateInput
): EmailTemplateContent {
  const recipientName = input.recipientName || "hola";
  const subject = `Restablece tu contraseña de ${input.appName}`;
  return {
    subject,
    text: [
      `Hola ${recipientName},`,
      "",
      "Recibimos una solicitud para restablecer tu contraseña en MatchA.",
      "",
      `Crear nueva contraseña: ${input.resetLink}`,
      "",
      "Si no solicitaste este cambio, puedes ignorar este mensaje. Tu cuenta seguirá protegida.",
      "Por seguridad, este enlace solo puede usarse una vez y vence automáticamente.",
    ].join("\n"),
    html: renderMatchaAuthEmailHtml({
      subject,
      preheader: "Usa este enlace para crear una nueva contraseña en MatchA.",
      eyebrow: "Recuperación de acceso",
      title: "Restablece tu contraseña",
      greeting: `Hola ${recipientName},`,
      paragraphs: [
        "Recibimos una solicitud para restablecer tu contraseña en MatchA.",
        "Usa el siguiente enlace para crear una nueva contraseña.",
        "Si no solicitaste este cambio, puedes ignorar este mensaje. Tu cuenta seguirá protegida.",
      ],
      actionLabel: "Crear nueva contraseña",
      actionUrl: input.resetLink,
      supportingNote:
        "Por seguridad, este enlace solo puede usarse una vez y vence automáticamente.",
      footer:
        "Si no reconoces esta solicitud, no necesitas hacer nada más. Nadie podrá cambiar tu contraseña sin este enlace.",
    }),
  };
}

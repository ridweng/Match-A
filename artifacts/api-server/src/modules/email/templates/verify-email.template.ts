import type {
  BaseEmailTemplateInput,
  EmailTemplateContent,
} from "../interfaces/email-template.interface";
import { renderMatchaAuthEmailHtml } from "./matcha-auth-email.template";

export type VerifyEmailTemplateInput = BaseEmailTemplateInput & {
  verificationLink: string;
};

export function renderVerifyEmailTemplate(
  input: VerifyEmailTemplateInput
): EmailTemplateContent {
  const recipientName = input.recipientName || "hola";
  const subject = `Confirma tu correo en ${input.appName}`;
  return {
    subject,
    text: [
      `Hola ${recipientName},`,
      "",
      "Ya casi estás dentro de MatchA. Confirma tu correo para activar tu cuenta y continuar con tu experiencia.",
      "",
      `Confirmar correo: ${input.verificationLink}`,
      "",
      "Si tú no creaste esta cuenta, puedes ignorar este mensaje.",
      "Por seguridad, este enlace vence automáticamente.",
    ].join("\n"),
    html: renderMatchaAuthEmailHtml({
      subject,
      preheader: "Confirma tu correo para activar tu cuenta en MatchA.",
      eyebrow: "Confirmación de correo",
      title: "Confirma tu correo en MatchA",
      greeting: `Hola ${recipientName},`,
      paragraphs: [
        "Ya casi estás dentro de MatchA. Confirma tu correo para activar tu cuenta y continuar con tu experiencia.",
        "Si tú no creaste esta cuenta, puedes ignorar este mensaje.",
      ],
      actionLabel: "Confirmar correo",
      actionUrl: input.verificationLink,
      supportingNote: "Por seguridad, este enlace vence automáticamente.",
      footer:
        "Recibiste este correo porque se creó una cuenta o se solicitó una verificación para este correo en MatchA.",
    }),
  };
}

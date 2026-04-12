import type {
  BaseEmailTemplateInput,
  EmailTemplateContent,
} from "../interfaces/email-template.interface";
import { renderMatchaAuthEmailHtml } from "./matcha-auth-email.template";

export type WelcomeTemplateInput = BaseEmailTemplateInput & {
  appLink: string;
};

export function renderWelcomeTemplate(
  input: WelcomeTemplateInput
): EmailTemplateContent {
  const recipientName = input.recipientName || "hola";
  const subject = `Bienvenido a ${input.appName}`;
  return {
    subject,
    text: [
      `Hola ${recipientName},`,
      "",
      "Tu correo ya fue confirmado y tu cuenta está lista.",
      `Bienvenido a ${input.appName}, un espacio para mejorar, atraer y conectar mejor.`,
      "",
      `Abrir ${input.appName}: ${input.appLink}`,
      "",
      "Nos alegra tenerte aquí.",
      "Si no reconoces esta actividad, contáctanos y cambia tu contraseña.",
    ].join("\n"),
    html: renderMatchaAuthEmailHtml({
      subject,
      preheader: "Tu cuenta ya está lista. Abre MatchA y continúa.",
      eyebrow: "Bienvenido a MatchA",
      title: "Tu cuenta ya está lista",
      greeting: `Hola ${recipientName},`,
      paragraphs: [
        "Tu correo ya fue confirmado y tu cuenta está lista.",
        `Bienvenido a ${input.appName}, un espacio para mejorar, atraer y conectar mejor.`,
        "Nos alegra tenerte aquí.",
      ],
      actionLabel: "Abrir MatchA",
      actionUrl: input.appLink,
      supportingNote:
        "Si no reconoces esta actividad, contáctanos y cambia tu contraseña.",
      footer:
        "Gracias por unirte a MatchA. Estamos listos para acompañarte en tu progreso.",
    }),
  };
}

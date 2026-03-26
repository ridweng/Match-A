import { Inject, Injectable, Logger } from "@nestjs/common";
import { emailConfig } from "../../../config/email.config";
import type { ConfigType } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";
import { EmailDeliveryError, type EmailSendResult } from "../email.types";
import type { EmailPayload } from "../interfaces/email-payload.interface";
import type { EmailProvider } from "./email.provider";

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  private readonly logger = new Logger(SmtpEmailProvider.name);
  private transport: Transporter | null = null;

  constructor(
    @Inject(emailConfig.KEY)
    private readonly config: ConfigType<typeof emailConfig>
  ) {}

  private getMaskedRecipients(payload: EmailPayload) {
    const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
    return recipients.map((recipient) => {
      const [localPart, domain = ""] = recipient.email.split("@");
      return `${localPart.slice(0, 2)}***@${domain}`;
    });
  }

  private getTransport() {
    if (!this.transport) {
      const auth =
        this.config.smtp.user && this.config.smtp.pass
          ? {
              user: this.config.smtp.user,
              pass: this.config.smtp.pass,
            }
          : undefined;

      this.transport = nodemailer.createTransport({
        host: this.config.smtp.host,
        port: this.config.smtp.port,
        secure: this.config.smtp.secure,
        auth,
        connectionTimeout: this.config.smtp.connectionTimeoutMs,
        socketTimeout: this.config.smtp.socketTimeoutMs,
      });
    }

    return this.transport;
  }

  async verify() {
    if (!this.config.enabled || this.config.logOnly) {
      return;
    }

    try {
      await this.getTransport().verify();
    } catch (error) {
      this.logger.error("SMTP verification failed", {
        provider: this.name,
        code: error instanceof Error ? error.message : "SMTP_VERIFY_FAILED",
      });
      throw new EmailDeliveryError(
        error instanceof Error ? error.message : "SMTP_VERIFY_FAILED",
        true,
        this.name
      );
    }
  }

  async send(payload: EmailPayload): Promise<EmailSendResult> {
    if (!this.config.enabled) {
      this.logger.log("Email delivery skipped because SMTP is disabled", {
        provider: this.name,
        to: this.getMaskedRecipients(payload),
        subject: payload.subject,
      });
      return {
        provider: this.name,
        messageId: null,
        accepted: 0,
        skipped: true,
        logOnly: false,
      };
    }

    if (this.config.logOnly) {
      this.logger.log("Email rendered in log-only mode", {
        provider: this.name,
        to: this.getMaskedRecipients(payload),
        subject: payload.subject,
      });
      return {
        provider: this.name,
        messageId: null,
        accepted: 0,
        skipped: false,
        logOnly: true,
      };
    }

    try {
      const response = await this.getTransport().sendMail({
        from: payload.from
          ? payload.from.name
            ? `${payload.from.name} <${payload.from.email}>`
            : payload.from.email
          : this.config.from.name
            ? `${this.config.from.name} <${this.config.from.email}>`
            : this.config.from.email,
        to: Array.isArray(payload.to)
          ? payload.to.map((item) =>
              item.name ? `${item.name} <${item.email}>` : item.email
            )
          : payload.to.name
            ? `${payload.to.name} <${payload.to.email}>`
            : payload.to.email,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });

      this.logger.log("Email sent", {
        provider: this.name,
        messageId: response.messageId,
        accepted: response.accepted.length,
        to: this.getMaskedRecipients(payload),
      });

      return {
        provider: this.name,
        messageId: response.messageId || null,
        accepted: response.accepted.length,
        skipped: false,
        logOnly: false,
      };
    } catch (error) {
      this.logger.error("Email send failed", {
        provider: this.name,
        code: error instanceof Error ? error.message : "SMTP_SEND_FAILED",
      });
      throw new EmailDeliveryError(
        error instanceof Error ? error.message : "SMTP_SEND_FAILED",
        true,
        this.name
      );
    }
  }
}

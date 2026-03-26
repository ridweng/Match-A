import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { appConfig } from "../../config/app.config";
import { emailConfig } from "../../config/email.config";
import type { ConfigType } from "@nestjs/config";
import { EMAIL_PROVIDER } from "./email.constants";
import type { SendEmailDto } from "./dto/send-email.dto";
import type { EmailPayload } from "./interfaces/email-payload.interface";
import type { EmailProvider } from "./providers/email.provider";
import {
  type EmailHealthStatus,
  type EmailLocale,
  EmailDeliveryError,
} from "./email.types";
import {
  renderVerifyEmailTemplate,
  type VerifyEmailTemplateInput,
} from "./templates/verify-email.template";
import {
  renderResetPasswordTemplate,
  type ResetPasswordTemplateInput,
} from "./templates/reset-password.template";
import { renderWelcomeTemplate } from "./templates/welcome.template";
import { renderGenericTransactionalTemplate } from "./templates/generic-transactional.template";

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private healthStatus: EmailHealthStatus;

  constructor(
    @Inject(EMAIL_PROVIDER)
    private readonly provider: EmailProvider,
    @Inject(emailConfig.KEY)
    private readonly emailRuntime: ConfigType<typeof emailConfig>,
    @Inject(appConfig.KEY)
    private readonly appRuntime: ConfigType<typeof appConfig>
  ) {
    this.healthStatus = {
      smtpEnabled: this.emailRuntime.enabled,
      emailLogOnly: this.emailRuntime.logOnly,
      verifyOnStartup: this.emailRuntime.verifyOnStartup,
      provider: this.provider.name,
      healthy: this.emailRuntime.enabled ? null : true,
      lastVerificationAttemptAt: null,
      lastVerificationSucceededAt: null,
      lastVerificationErrorCode: null,
    };
  }

  async onModuleInit() {
    if (!this.emailRuntime.enabled || !this.emailRuntime.verifyOnStartup) {
      return;
    }

    await this.verifyProviderOnStartup();
  }

  async verifyProviderOnStartup() {
    this.healthStatus.lastVerificationAttemptAt = new Date().toISOString();
    try {
      await this.provider.verify?.();
      this.healthStatus.healthy = true;
      this.healthStatus.lastVerificationSucceededAt = new Date().toISOString();
      this.healthStatus.lastVerificationErrorCode = null;
      this.logger.log("Email provider verified on startup", {
        provider: this.provider.name,
      });
    } catch (error) {
      this.healthStatus.healthy = false;
      this.healthStatus.lastVerificationErrorCode =
        error instanceof Error ? error.message : "EMAIL_PROVIDER_VERIFY_FAILED";
      this.logger.error("Email provider startup verification failed", {
        provider: this.provider.name,
        code: this.healthStatus.lastVerificationErrorCode,
      });
    }
  }

  getHealthStatus(): EmailHealthStatus {
    return { ...this.healthStatus };
  }

  private buildPayloadFromTemplate(
    to: { email: string; name?: string },
    template: { subject: string; text: string; html: string },
    metadata?: Record<string, string | number | boolean | null>
  ): EmailPayload {
    return {
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
      metadata,
    };
  }

  async sendRawEmail(input: SendEmailDto) {
    return this.provider.send({
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      metadata: input.metadata,
    });
  }

  async sendVerificationEmail(input: {
    recipientEmail: string;
    recipientName?: string;
    locale?: EmailLocale;
    verificationLink: string;
  }) {
    const templateInput: VerifyEmailTemplateInput = {
      appName: this.appRuntime.name,
      locale: input.locale || "en",
      recipientName: input.recipientName,
      verificationLink: input.verificationLink,
    };
    const template = renderVerifyEmailTemplate(templateInput);
    try {
      await this.provider.send(
        this.buildPayloadFromTemplate(
          {
            email: input.recipientEmail,
            name: input.recipientName,
          },
          template,
          { template: "verify-email" }
        )
      );
    } catch (error) {
      throw error instanceof EmailDeliveryError
        ? error
        : new EmailDeliveryError("EMAIL_VERIFICATION_SEND_FAILED");
    }
  }

  async sendPasswordResetEmail(input: {
    recipientEmail: string;
    recipientName?: string;
    locale?: EmailLocale;
    resetLink: string;
  }) {
    const templateInput: ResetPasswordTemplateInput = {
      appName: this.appRuntime.name,
      locale: input.locale || "en",
      recipientName: input.recipientName,
      resetLink: input.resetLink,
    };
    const template = renderResetPasswordTemplate(templateInput);
    try {
      await this.provider.send(
        this.buildPayloadFromTemplate(
          {
            email: input.recipientEmail,
            name: input.recipientName,
          },
          template,
          { template: "reset-password" }
        )
      );
    } catch (error) {
      throw error instanceof EmailDeliveryError
        ? error
        : new EmailDeliveryError("EMAIL_PASSWORD_RESET_SEND_FAILED");
    }
  }

  async sendWelcomeEmail(input: {
    recipientEmail: string;
    recipientName?: string;
    locale?: EmailLocale;
  }) {
    const template = renderWelcomeTemplate({
      appName: this.appRuntime.name,
      locale: input.locale || "en",
      recipientName: input.recipientName,
    });
    try {
      await this.provider.send(
        this.buildPayloadFromTemplate(
          {
            email: input.recipientEmail,
            name: input.recipientName,
          },
          template,
          { template: "welcome" }
        )
      );
    } catch (error) {
      throw error instanceof EmailDeliveryError
        ? error
        : new EmailDeliveryError("EMAIL_WELCOME_SEND_FAILED");
    }
  }

  async sendGenericTransactionalEmail(input: {
    to: { email: string; name?: string };
    title: string;
    bodyText: string;
    bodyHtml?: string;
  }) {
    const template = renderGenericTransactionalTemplate(input);
    return this.provider.send(
      this.buildPayloadFromTemplate(input.to, template, {
        template: "generic-transactional",
      })
    );
  }
}

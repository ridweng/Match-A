import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { appConfig } from "../../config/app.config";
import { emailConfig } from "../../config/email.config";
import { EMAIL_PROVIDER } from "./email.constants";
import { EmailService } from "./email.service";
import { SmtpEmailProvider } from "./providers/smtp-email.provider";

@Module({
  imports: [ConfigModule.forFeature(appConfig), ConfigModule.forFeature(emailConfig)],
  providers: [
    EmailService,
    SmtpEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      useExisting: SmtpEmailProvider,
    },
  ],
  exports: [EmailService],
})
export class EmailModule {}

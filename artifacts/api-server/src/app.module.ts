import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { appConfig } from "./config/app.config";
import { authConfig } from "./config/auth.config";
import { emailConfig } from "./config/email.config";
import { validateApiEnv } from "./config/env.schema";
import { AuthModule } from "./modules/auth/auth.module";
import { DiscoveryModule } from "./modules/discovery/discovery.module";
import { EmailModule } from "./modules/email/email.module";
import { GoalsModule } from "./modules/goals/goals.module";
import { HealthModule } from "./modules/health/health.module";
import { MediaModule } from "./modules/media/media.module";
import { ViewerModule } from "./modules/viewer/viewer.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, authConfig, emailConfig],
      validate: validateApiEnv,
    }),
    HealthModule,
    GoalsModule,
    EmailModule,
    AuthModule,
    DiscoveryModule,
    MediaModule,
    ViewerModule,
  ],
})
export class AppModule {}

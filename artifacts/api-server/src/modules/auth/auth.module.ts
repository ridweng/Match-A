import { Module } from "@nestjs/common";
import { CacheModule } from "../cache/cache.module";
import { EmailModule } from "../email/email.module";
import { GoalsModule } from "../goals/goals.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [CacheModule, GoalsModule, EmailModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}

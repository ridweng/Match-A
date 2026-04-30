import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CacheModule } from "../cache/cache.module";
import { GoalsModule } from "../goals/goals.module";
import { DiscoveryController } from "./discovery.controller";
import { DiscoveryService } from "./discovery.service";

@Module({
  imports: [AuthModule, CacheModule, GoalsModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}

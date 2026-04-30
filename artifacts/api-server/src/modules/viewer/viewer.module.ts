import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CacheModule } from "../cache/cache.module";
import { DiscoveryModule } from "../discovery/discovery.module";
import { GoalsModule } from "../goals/goals.module";
import { MediaModule } from "../media/media.module";
import { ViewerController } from "./viewer.controller";
import { ViewerService } from "./viewer.service";

@Module({
  imports: [AuthModule, CacheModule, DiscoveryModule, GoalsModule, MediaModule],
  controllers: [ViewerController],
  providers: [ViewerService],
  exports: [ViewerService],
})
export class ViewerModule {}

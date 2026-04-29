import { Module } from "@nestjs/common";
import { CacheModule } from "../cache/cache.module";
import { AdminController } from "./admin.controller";
import { AdminOpsController } from "./admin-ops.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [CacheModule],
  controllers: [AdminController, AdminOpsController],
  providers: [AdminService],
})
export class AdminModule {}

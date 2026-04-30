import { Module } from "@nestjs/common";
import { CacheModule } from "../cache/cache.module";
import { GoalsService } from "./goals.service";

@Module({
  imports: [CacheModule],
  providers: [GoalsService],
  exports: [GoalsService],
})
export class GoalsModule {}

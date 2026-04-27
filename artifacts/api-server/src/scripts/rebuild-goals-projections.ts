import "reflect-metadata";
import { loadApiEnv } from "../config/env";
import { CacheService } from "../modules/cache/cache.service";
import { GoalsService } from "../modules/goals/goals.service";
import { HealthService } from "../modules/health/health.service";

async function main() {
  loadApiEnv();
  const cacheService = new CacheService();
  const healthService = new HealthService(cacheService);
  await healthService.assertSchemaReady();
  const goalsService = new GoalsService(cacheService);
  const userId = Number(process.env.USER_ID || "");

  if (Number.isFinite(userId) && userId > 0) {
    const result = await goalsService.rebuildUserGoalTargets(userId, undefined, {
      refreshPreferences: true,
    });
    console.log("[api-server] rebuilt goal targets", result);
    return;
  }

  const result = await goalsService.rebuildAllUserGoalTargets();
  console.log("[api-server] rebuilt goal targets", result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

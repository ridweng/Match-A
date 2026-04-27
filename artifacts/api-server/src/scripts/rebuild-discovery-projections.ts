import "reflect-metadata";
import { pool } from "@workspace/db";
import { loadApiEnv } from "../config/env";
import { CacheService } from "../modules/cache/cache.service";
import { rebuildDiscoveryProjectionsForActor } from "../modules/discovery/discovery.projections";
import { HealthService } from "../modules/health/health.service";

async function resolveActorProfileIds() {
  const actorProfileId = Number(process.env.ACTOR_PROFILE_ID || "");
  if (Number.isFinite(actorProfileId) && actorProfileId > 0) {
    return [actorProfileId];
  }

  const userId = Number(process.env.USER_ID || "");
  if (Number.isFinite(userId) && userId > 0) {
    const result = await pool.query<{ id: number }>(
      `SELECT id FROM core.profiles WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    return result.rows[0]?.id ? [result.rows[0].id] : [];
  }

  const result = await pool.query<{ actor_profile_id: number }>(
    `SELECT DISTINCT actor_profile_id
     FROM discovery.profile_interactions
     ORDER BY actor_profile_id ASC`
  );
  return result.rows.map((row) => row.actor_profile_id);
}

async function main() {
  loadApiEnv();
  const cacheService = new CacheService();
  const healthService = new HealthService(cacheService);
  await healthService.assertSchemaReady();
  const actorProfileIds = await resolveActorProfileIds();
  const client = await pool.connect();

  try {
    for (const actorProfileId of actorProfileIds) {
      await client.query("BEGIN");
      await rebuildDiscoveryProjectionsForActor(client, actorProfileId);
      await client.query("COMMIT");
    }
    console.log("[api-server] rebuilt discovery projections", {
      rebuiltProfiles: actorProfileIds.length,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(async (error) => {
  console.error(error);
  await pool.end().catch(() => {});
  process.exit(1);
});

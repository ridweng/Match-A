import "reflect-metadata";
import { pool } from "@workspace/db";
import { loadApiEnv } from "../config/env";
import { CacheService } from "../modules/cache/cache.service";
import { GoalsService } from "../modules/goals/goals.service";
import { HealthService } from "../modules/health/health.service";
import { seedLaunchReferenceV2Profiles } from "./seed-launch-reference-profiles-v2";
import { validateLaunchReferenceV2Database } from "./validate-launch-reference-profiles-v2";
import {
  LAUNCH_REFERENCE_V2_BATCH_KEY,
  LAUNCH_REFERENCE_V2_GENERATION_VERSION,
} from "../seeds/launch-reference-profiles-v2";

type DbClient = {
  query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }>;
};

async function deleteLaunchReferenceV2Profiles(client: DbClient) {
  const batchResult = await client.query<{
    id: number;
    user_id: number | null;
    public_id: string;
  }>(
    `SELECT p.id, p.user_id, p.public_id
     FROM core.profiles p
     JOIN core.profile_dummy_metadata pdm ON pdm.profile_id = p.id
     WHERE pdm.dummy_batch_key = $1
     ORDER BY p.id ASC`,
    [LAUNCH_REFERENCE_V2_BATCH_KEY]
  );

  const profileIds = batchResult.rows.map((row) => row.id);
  const publicIds = batchResult.rows.map((row) => row.public_id);
  const userIds = batchResult.rows
    .map((row) => Number(row.user_id))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!profileIds.length) {
    return {
      deletedProfiles: 0,
      deletedUsers: 0,
      deletedDecisions: 0,
      deletedInteractions: 0,
      deletedQueueRows: 0,
    };
  }

  const queueDelete = await client.query(
    `DELETE FROM discovery.actor_queue
     WHERE actor_profile_id = ANY($1::bigint[])
        OR target_profile_id = ANY($1::bigint[])
        OR target_profile_public_id = ANY($2::varchar[])
     RETURNING 1`,
    [profileIds, publicIds]
  );
  const decisionDelete = await client.query(
    `DELETE FROM discovery.profile_decisions
     WHERE actor_profile_id = ANY($1::bigint[])
        OR target_profile_id = ANY($1::bigint[])
        OR target_profile_public_id = ANY($2::varchar[])
     RETURNING 1`,
    [profileIds, publicIds]
  );
  const interactionDelete = await client.query(
    `DELETE FROM discovery.profile_interactions
     WHERE actor_profile_id = ANY($1::bigint[])
        OR target_profile_id = ANY($1::bigint[])
        OR target_profile_public_id = ANY($2::varchar[])
     RETURNING 1`,
    [profileIds, publicIds]
  );

  let deletedUsers = 0;
  if (userIds.length) {
    const userDelete = await client.query(
      `DELETE FROM auth.users
       WHERE id = ANY($1::bigint[])
       RETURNING 1`,
      [userIds]
    );
    deletedUsers = userDelete.rows.length;
  }

  const profileDelete = await client.query(
    `DELETE FROM core.profiles
     WHERE id = ANY($1::bigint[])
     RETURNING 1`,
    [profileIds]
  );

  return {
    deletedProfiles: profileDelete.rows.length,
    deletedUsers,
    deletedDecisions: decisionDelete.rows.length,
    deletedInteractions: interactionDelete.rows.length,
    deletedQueueRows: queueDelete.rows.length,
  };
}

async function main() {
  loadApiEnv();
  const requireReadyMedia = process.argv.includes("--require-ready-media");
  const cacheService = new CacheService();
  const healthService = new HealthService(cacheService);
  await healthService.assertSchemaReady();
  await new GoalsService(cacheService).seedCatalog();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const deleted = await deleteLaunchReferenceV2Profiles(client);
    const seeded = await seedLaunchReferenceV2Profiles(client);
    const validation = await validateLaunchReferenceV2Database(client, { requireReadyMedia });

    if (!validation.ok) {
      throw new Error(
        `Launch reference V2 validation failed after refresh:\n${validation.errors.join("\n")}`
      );
    }

    await client.query("COMMIT");
    console.log("[api-server] launch reference V2 profiles refreshed", {
      batchKey: LAUNCH_REFERENCE_V2_BATCH_KEY,
      generationVersion: LAUNCH_REFERENCE_V2_GENERATION_VERSION,
      deleted,
      seeded,
      validation: validation.summary,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

main().catch(async (error) => {
  console.error(error);
  await pool.end().catch(() => {});
  process.exit(1);
});

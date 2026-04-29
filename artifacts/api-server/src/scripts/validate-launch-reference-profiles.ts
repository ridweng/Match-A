import "reflect-metadata";
import { pool } from "@workspace/db";
import { loadApiEnv } from "../config/env";
import { CacheService } from "../modules/cache/cache.service";
import { HealthService } from "../modules/health/health.service";
import {
  LAUNCH_REFERENCE_BATCH_KEY,
  LAUNCH_REFERENCE_GENERATION_VERSION_NUMBER,
  launchReferenceProfiles,
  validateLaunchReferenceSource,
} from "../seeds/launch-reference-profiles";

type DbClient = {
  query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }>;
};

export type LaunchReferenceDbValidation = {
  ok: boolean;
  errors: string[];
  summary: {
    total: number;
    female: number;
    male: number;
    readyMedia: number;
    discoverable: number;
    failingProfiles: number;
  };
};

export async function validateLaunchReferenceDatabase(
  client: DbClient
): Promise<LaunchReferenceDbValidation> {
  const errors = [...validateLaunchReferenceSource().errors];
  const publicIds = launchReferenceProfiles.map((profile) => profile.publicId);
  const internalNames = launchReferenceProfiles.map((profile) => profile.internalReferencePerson);

  const summaryResult = await client.query<{
    total: string;
    female: string;
    male: string;
    ready_media: string;
    discoverable: string;
    distinct_public_ids: string;
    distinct_display_names: string;
    kind_dummy: string;
  }>(
    `WITH batch AS (
       SELECT p.*
       FROM core.profiles p
       JOIN core.profile_dummy_metadata pdm ON pdm.profile_id = p.id
       WHERE pdm.dummy_batch_key = $1
         AND pdm.generation_version = $2
     )
     SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE gender_identity = 'female')::text AS female,
       COUNT(*) FILTER (WHERE gender_identity = 'male')::text AS male,
       COALESCE((
         SELECT COUNT(*)::text
         FROM media.profile_images pi
         JOIN media.media_assets ma ON ma.id = pi.media_asset_id
         JOIN batch b ON b.id = pi.profile_id
         WHERE ma.status = 'ready'
       ), '0') AS ready_media,
       COUNT(*) FILTER (WHERE is_discoverable = true)::text AS discoverable,
       COUNT(DISTINCT public_id)::text AS distinct_public_ids,
       COUNT(DISTINCT display_name)::text AS distinct_display_names,
       COUNT(*) FILTER (WHERE kind = 'dummy')::text AS kind_dummy
     FROM batch`,
    [LAUNCH_REFERENCE_BATCH_KEY, LAUNCH_REFERENCE_GENERATION_VERSION_NUMBER]
  );
  const row = summaryResult.rows[0];
  const summary = {
    total: Number(row?.total || 0),
    female: Number(row?.female || 0),
    male: Number(row?.male || 0),
    readyMedia: Number(row?.ready_media || 0),
    discoverable: Number(row?.discoverable || 0),
    failingProfiles: 0,
  };

  if (summary.total !== 46) errors.push(`Expected 46 database profiles, found ${summary.total}`);
  if (summary.female !== 33) errors.push(`Expected 33 database female profiles, found ${summary.female}`);
  if (summary.male !== 13) errors.push(`Expected 13 database male profiles, found ${summary.male}`);
  if (summary.readyMedia !== 184) errors.push(`Expected 184 ready media rows, found ${summary.readyMedia}`);
  if (summary.discoverable !== 46) errors.push(`Expected 46 discoverable profiles, found ${summary.discoverable}`);
  if (Number(row?.distinct_public_ids || 0) !== 46) errors.push("Duplicate database publicId in launch batch");
  if (Number(row?.distinct_display_names || 0) !== 46) errors.push("Duplicate database displayName in launch batch");
  if (Number(row?.kind_dummy || 0) !== 46) errors.push("Every launch batch profile must have kind=dummy");

  const missingResult = await client.query<{ public_id: string }>(
    `SELECT expected.public_id
     FROM UNNEST($1::varchar[]) AS expected(public_id)
     LEFT JOIN core.profiles p ON p.public_id = expected.public_id
     LEFT JOIN core.profile_dummy_metadata pdm
       ON pdm.profile_id = p.id
      AND pdm.dummy_batch_key = $2
      AND pdm.generation_version = $3
     WHERE pdm.profile_id IS NULL
     ORDER BY expected.public_id`,
    [publicIds, LAUNCH_REFERENCE_BATCH_KEY, LAUNCH_REFERENCE_GENERATION_VERSION_NUMBER]
  );
  for (const missing of missingResult.rows) errors.push(`Missing launch profile ${missing.public_id}`);

  const failingResult = await client.query<{ public_id: string; reasons: string[] }>(
    `WITH batch AS (
       SELECT p.*, pdm.synthetic_group
       FROM core.profiles p
       JOIN core.profile_dummy_metadata pdm ON pdm.profile_id = p.id
       WHERE pdm.dummy_batch_key = $1
         AND pdm.generation_version = $2
     ),
     counts AS (
       SELECT
         b.id,
         COUNT(*) FILTER (WHERE ma.status = 'ready') AS ready_media_count,
         COUNT(DISTINCT pcv.category_code) AS category_count,
         COUNT(DISTINCT pl.language_code) AS language_count,
         COUNT(DISTINCT fp.actor_profile_id) AS preference_count
       FROM batch b
       LEFT JOIN media.profile_images pi ON pi.profile_id = b.id
       LEFT JOIN media.media_assets ma ON ma.id = pi.media_asset_id
       LEFT JOIN core.profile_category_values pcv ON pcv.profile_id = b.id
       LEFT JOIN core.profile_languages pl ON pl.profile_id = b.id
       LEFT JOIN discovery.filter_preferences fp ON fp.actor_profile_id = b.id
       GROUP BY b.id
     )
     SELECT
       b.public_id,
       ARRAY_REMOVE(ARRAY[
         CASE WHEN b.kind <> 'dummy' THEN 'kind' END,
         CASE WHEN b.synthetic_group NOT IN ('female', 'male') THEN 'synthetic_group' END,
         CASE WHEN c.ready_media_count < 4 THEN 'ready_media' END,
         CASE WHEN c.category_count < 6 THEN 'category_values' END,
         CASE WHEN c.language_count < 1 THEN 'languages' END,
         CASE WHEN c.preference_count < 1 THEN 'interested_in_filter_preferences' END,
         CASE WHEN b.is_discoverable IS NOT TRUE THEN 'discoverable' END
       ], NULL) AS reasons
     FROM batch b
     JOIN counts c ON c.id = b.id
     WHERE b.kind <> 'dummy'
        OR b.synthetic_group NOT IN ('female', 'male')
        OR c.ready_media_count < 4
        OR c.category_count < 6
        OR c.language_count < 1
        OR c.preference_count < 1
        OR b.is_discoverable IS NOT TRUE
     ORDER BY b.public_id`,
    [LAUNCH_REFERENCE_BATCH_KEY, LAUNCH_REFERENCE_GENERATION_VERSION_NUMBER]
  );
  summary.failingProfiles = failingResult.rows.length;
  for (const failing of failingResult.rows) {
    errors.push(`${failing.public_id} fails validation: ${failing.reasons.join(", ")}`);
  }

  const invalidCategoryResult = await client.query<{
    public_id: string;
    category_code: string;
    value_key: string;
  }>(
    `SELECT p.public_id, pcv.category_code, pcv.value_key
     FROM core.profile_category_values pcv
     JOIN core.profiles p ON p.id = pcv.profile_id
     JOIN core.profile_dummy_metadata pdm ON pdm.profile_id = p.id
     LEFT JOIN catalog.preference_values pv
       ON pv.category_code = pcv.category_code
      AND pv.value_key = pcv.value_key
      AND pv.is_active = true
     WHERE pdm.dummy_batch_key = $1
       AND pdm.generation_version = $2
       AND pv.value_key IS NULL
     ORDER BY p.public_id, pcv.category_code`,
    [LAUNCH_REFERENCE_BATCH_KEY, LAUNCH_REFERENCE_GENERATION_VERSION_NUMBER]
  );
  for (const invalid of invalidCategoryResult.rows) {
    errors.push(`${invalid.public_id} invalid catalog value ${invalid.category_code}:${invalid.value_key}`);
  }

  const publicLeakResult = await client.query<{ public_id: string; leaked_reference: string }>(
    `SELECT p.public_id, ref.name AS leaked_reference
     FROM core.profiles p
     JOIN core.profile_dummy_metadata pdm ON pdm.profile_id = p.id
     CROSS JOIN UNNEST($3::text[]) AS ref(name)
     WHERE pdm.dummy_batch_key = $1
       AND pdm.generation_version = $2
       AND (
         LOWER(p.public_id) LIKE '%' || LOWER(ref.name) || '%'
         OR LOWER(p.display_name) LIKE '%' || LOWER(ref.name) || '%'
         OR LOWER(p.profession) LIKE '%' || LOWER(ref.name) || '%'
         OR LOWER(p.bio) LIKE '%' || LOWER(ref.name) || '%'
         OR LOWER(p.location) LIKE '%' || LOWER(ref.name) || '%'
       )
     ORDER BY p.public_id`,
    [LAUNCH_REFERENCE_BATCH_KEY, LAUNCH_REFERENCE_GENERATION_VERSION_NUMBER, internalNames]
  );
  for (const leak of publicLeakResult.rows) {
    errors.push(`${leak.public_id} leaks internal reference ${leak.leaked_reference}`);
  }

  return { ok: errors.length === 0, errors, summary };
}

async function main() {
  loadApiEnv();
  const cacheService = new CacheService();
  const healthService = new HealthService(cacheService);
  await healthService.assertSchemaReady();
  const result = await validateLaunchReferenceDatabase(pool);
  console.log("[api-server] launch reference validation", result);
  await pool.end().catch(() => {});
  if (!result.ok) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await pool.end().catch(() => {});
  process.exit(1);
});

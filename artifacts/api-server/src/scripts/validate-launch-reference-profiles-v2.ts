import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import { pool } from "@workspace/db";
import { loadApiEnv } from "../config/env";
import { CacheService } from "../modules/cache/cache.service";
import { HealthService } from "../modules/health/health.service";
import {
  LAUNCH_REFERENCE_V2_BATCH_KEY,
  LAUNCH_REFERENCE_V2_GENERATION_VERSION_NUMBER,
  launchReferenceV2Profiles,
  validateLaunchReferenceV2Source,
} from "../seeds/launch-reference-profiles-v2";

type DbClient = {
  query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }>;
};

export type LaunchReferenceV2DbValidation = {
  ok: boolean;
  errors: string[];
  summary: {
    total: number;
    female: number;
    male: number;
    mediaRecords: number;
    readyMedia: number;
    pendingMedia: number;
    discoverable: number;
    failingProfiles: number;
  };
  failingProfiles: Array<{ publicId: string; reasons: string[] }>;
  missingFiles: string[];
  pendingFiles: string[];
  readyFiles: string[];
};

function resolveMediaRoot() {
  return path.basename(process.cwd()) === "api-server"
    ? path.join(process.cwd(), "storage", "media")
    : path.join(process.cwd(), "artifacts", "api-server", "storage", "media");
}

function hasUnsafePublicUrl(publicUrl: string | null) {
  const trimmed = String(publicUrl || "").trim();
  if (!trimmed) return false;
  if (trimmed.includes("static.matcha.local")) return true;
  return !(
    trimmed.startsWith("/api/media/public/") ||
    /^https:\/\/api\.matcha\.xylo-solutions\.com\/api\/media\/public\/\d+$/.test(trimmed)
  );
}

export async function validateLaunchReferenceV2Database(
  client: DbClient,
  options?: { requireReadyMedia?: boolean }
): Promise<LaunchReferenceV2DbValidation> {
  const errors = [...validateLaunchReferenceV2Source().errors];
  const mediaRoot = resolveMediaRoot();
  const publicIds = launchReferenceV2Profiles.map((profile) => profile.publicId);
  const internalNames = launchReferenceV2Profiles.map((profile) => profile.internalReferencePerson);

  const summaryResult = await client.query<{
    total: string;
    female: string;
    male: string;
    media_records: string;
    ready_media: string;
    pending_media: string;
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
         FROM media.media_assets ma
         JOIN batch b ON b.id = ma.owner_profile_id
       ), '0') AS media_records,
       COALESCE((
         SELECT COUNT(*)::text
         FROM media.media_assets ma
         JOIN batch b ON b.id = ma.owner_profile_id
         WHERE ma.status = 'ready'
       ), '0') AS ready_media,
       COALESCE((
         SELECT COUNT(*)::text
         FROM media.media_assets ma
         JOIN batch b ON b.id = ma.owner_profile_id
         WHERE ma.status = 'pending'
       ), '0') AS pending_media,
       COUNT(*) FILTER (WHERE is_discoverable = true)::text AS discoverable,
       COUNT(DISTINCT public_id)::text AS distinct_public_ids,
       COUNT(DISTINCT display_name)::text AS distinct_display_names,
       COUNT(*) FILTER (WHERE kind = 'dummy')::text AS kind_dummy
     FROM batch`,
    [LAUNCH_REFERENCE_V2_BATCH_KEY, LAUNCH_REFERENCE_V2_GENERATION_VERSION_NUMBER]
  );
  const row = summaryResult.rows[0];
  const summary = {
    total: Number(row?.total || 0),
    female: Number(row?.female || 0),
    male: Number(row?.male || 0),
    mediaRecords: Number(row?.media_records || 0),
    readyMedia: Number(row?.ready_media || 0),
    pendingMedia: Number(row?.pending_media || 0),
    discoverable: Number(row?.discoverable || 0),
    failingProfiles: 0,
  };

  if (summary.total !== 33) errors.push(`Expected 33 database profiles, found ${summary.total}`);
  if (summary.female !== 23) errors.push(`Expected 23 database female profiles, found ${summary.female}`);
  if (summary.male !== 10) errors.push(`Expected 10 database male profiles, found ${summary.male}`);
  if (summary.mediaRecords !== 76) errors.push(`Expected 76 media rows, found ${summary.mediaRecords}`);
  if (Number(row?.distinct_public_ids || 0) !== 33) errors.push("Duplicate database publicId in V2 launch batch");
  if (Number(row?.distinct_display_names || 0) !== 33) errors.push("Duplicate database displayName in V2 launch batch");
  if (Number(row?.kind_dummy || 0) !== 33) errors.push("Every V2 launch profile must have kind=dummy");
  if (options?.requireReadyMedia) {
    if (summary.readyMedia !== 76) errors.push(`Expected 76 ready media rows, found ${summary.readyMedia}`);
    if (summary.discoverable !== 33) errors.push(`Expected 33 discoverable profiles, found ${summary.discoverable}`);
  }

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
    [publicIds, LAUNCH_REFERENCE_V2_BATCH_KEY, LAUNCH_REFERENCE_V2_GENERATION_VERSION_NUMBER]
  );
  for (const missing of missingResult.rows) errors.push(`Missing V2 launch profile ${missing.public_id}`);

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
         COUNT(*) AS media_count,
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
         CASE WHEN c.media_count < 2 THEN 'media_records' END,
         CASE WHEN c.ready_media_count < 2 AND b.is_discoverable IS TRUE THEN 'discoverable_without_ready_media' END,
         CASE WHEN $3::boolean AND c.ready_media_count < 2 THEN 'ready_media' END,
         CASE WHEN c.category_count < 6 THEN 'category_values' END,
         CASE WHEN c.language_count < 1 THEN 'languages' END,
         CASE WHEN c.preference_count < 1 THEN 'interested_in_filter_preferences' END,
         CASE WHEN $3::boolean AND b.is_discoverable IS NOT TRUE THEN 'discoverable' END
       ], NULL) AS reasons
     FROM batch b
     JOIN counts c ON c.id = b.id
     WHERE b.kind <> 'dummy'
        OR b.synthetic_group NOT IN ('female', 'male')
        OR c.media_count < 2
        OR (c.ready_media_count < 2 AND b.is_discoverable IS TRUE)
        OR ($3::boolean AND c.ready_media_count < 2)
        OR c.category_count < 6
        OR c.language_count < 1
        OR c.preference_count < 1
        OR ($3::boolean AND b.is_discoverable IS NOT TRUE)
     ORDER BY b.public_id`,
    [LAUNCH_REFERENCE_V2_BATCH_KEY, LAUNCH_REFERENCE_V2_GENERATION_VERSION_NUMBER, Boolean(options?.requireReadyMedia)]
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
    [LAUNCH_REFERENCE_V2_BATCH_KEY, LAUNCH_REFERENCE_V2_GENERATION_VERSION_NUMBER]
  );
  for (const invalid of invalidCategoryResult.rows) {
    errors.push(`${invalid.public_id} invalid catalog value ${invalid.category_code}:${invalid.value_key}`);
  }

  const publicLeakResult = await client.query<{ public_id: string; leaked_reference: string }>(
    `SELECT p.public_id, ref.name AS leaked_reference
     FROM core.profiles p
     JOIN core.profile_dummy_metadata pdm ON pdm.profile_id = p.id
     LEFT JOIN core.profile_copy pc ON pc.profile_id = p.id
     CROSS JOIN UNNEST($3::text[]) AS ref(name)
     WHERE pdm.dummy_batch_key = $1
       AND pdm.generation_version = $2
       AND (
         LOWER(p.public_id) LIKE '%' || LOWER(ref.name) || '%'
         OR LOWER(p.display_name) LIKE '%' || LOWER(ref.name) || '%'
         OR LOWER(p.profession) LIKE '%' || LOWER(ref.name) || '%'
         OR LOWER(p.bio) LIKE '%' || LOWER(ref.name) || '%'
         OR LOWER(p.location) LIKE '%' || LOWER(ref.name) || '%'
         OR LOWER(COALESCE(pc.occupation_text, '')) LIKE '%' || LOWER(ref.name) || '%'
         OR LOWER(COALESCE(pc.bio_text, '')) LIKE '%' || LOWER(ref.name) || '%'
       )
     ORDER BY p.public_id`,
    [LAUNCH_REFERENCE_V2_BATCH_KEY, LAUNCH_REFERENCE_V2_GENERATION_VERSION_NUMBER, internalNames]
  );
  for (const leak of publicLeakResult.rows) {
    errors.push(`${leak.public_id} leaks internal reference ${leak.leaked_reference}`);
  }

  const mediaRows = await client.query<{
    public_id: string;
    id: number;
    storage_key: string;
    public_url: string | null;
    status: string;
  }>(
    `SELECT p.public_id, ma.id, ma.storage_key, ma.public_url, ma.status
     FROM media.media_assets ma
     JOIN core.profiles p ON p.id = ma.owner_profile_id
     JOIN core.profile_dummy_metadata pdm ON pdm.profile_id = p.id
     WHERE pdm.dummy_batch_key = $1
       AND pdm.generation_version = $2
     ORDER BY p.public_id, ma.storage_key`,
    [LAUNCH_REFERENCE_V2_BATCH_KEY, LAUNCH_REFERENCE_V2_GENERATION_VERSION_NUMBER]
  );

  const missingFiles: string[] = [];
  const pendingFiles: string[] = [];
  const readyFiles: string[] = [];
  for (const media of mediaRows.rows) {
    if (!media.storage_key.startsWith(`synthetic/${LAUNCH_REFERENCE_V2_BATCH_KEY}/`)) {
      errors.push(`${media.public_id} media ${media.id} invalid storage_key ${media.storage_key}`);
    }
    if (hasUnsafePublicUrl(media.public_url)) {
      errors.push(`${media.public_id} media ${media.id} unsafe public_url ${media.public_url}`);
    }
    const filePath = path.join(mediaRoot, media.storage_key);
    const exists = fs.existsSync(filePath);
    if (exists) readyFiles.push(filePath);
    else missingFiles.push(filePath);
    if (media.status === "pending") pendingFiles.push(filePath);
    if (exists && media.status !== "ready") {
      errors.push(`${media.public_id} media ${media.id} file exists but status is ${media.status}`);
    }
    if (!exists && media.status === "ready") {
      errors.push(`${media.public_id} media ${media.id} file missing but status is ready`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    summary,
    failingProfiles: failingResult.rows.map((row) => ({
      publicId: row.public_id,
      reasons: row.reasons,
    })),
    missingFiles,
    pendingFiles,
    readyFiles,
  };
}

async function main() {
  loadApiEnv();
  const requireReadyMedia = process.argv.includes("--require-ready-media");
  const cacheService = new CacheService();
  const healthService = new HealthService(cacheService);
  await healthService.assertSchemaReady();
  const result = await validateLaunchReferenceV2Database(pool, { requireReadyMedia });
  console.log("[api-server] launch reference V2 validation", {
    summary: result.summary,
    failingProfiles: result.failingProfiles,
    missingFiles: result.missingFiles,
    pendingFiles: result.pendingFiles,
    readyFiles: result.readyFiles,
    errors: result.errors,
  });
  await pool.end().catch(() => {});
  if (!result.ok) process.exit(1);
}

const isMainModule =
  import.meta.url === new URL(process.argv[1] || "", "file://").href;

if (isMainModule) {
  main().catch(async (error) => {
    console.error(error);
    await pool.end().catch(() => {});
    process.exit(1);
  });
}

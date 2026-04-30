import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import { pool } from "@workspace/db";
import { loadApiEnv } from "../config/env";
import { CacheService } from "../modules/cache/cache.service";
import { GoalsService } from "../modules/goals/goals.service";
import { HealthService } from "../modules/health/health.service";
import {
  LAUNCH_REFERENCE_V2_BATCH_KEY,
  LAUNCH_REFERENCE_V2_EXTRA_PREFERENCE_VALUES,
  LAUNCH_REFERENCE_V2_GENERATION_VERSION,
  LAUNCH_REFERENCE_V2_GENERATION_VERSION_NUMBER,
  LAUNCH_REFERENCE_V2_PHYSICAL_VALUES,
  launchReferenceV2Profiles,
  validateLaunchReferenceV2Source,
  type LaunchReferenceV2Profile,
} from "../seeds/launch-reference-profiles-v2";

type DbClient = {
  query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }>;
};

function resolveMediaRoot() {
  return path.basename(process.cwd()) === "api-server"
    ? path.join(process.cwd(), "storage", "media")
    : path.join(process.cwd(), "artifacts", "api-server", "storage", "media");
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function seedExtraPreferenceValues(client: DbClient) {
  for (const value of [...LAUNCH_REFERENCE_V2_EXTRA_PREFERENCE_VALUES, ...LAUNCH_REFERENCE_V2_PHYSICAL_VALUES]) {
    await client.query(
      `INSERT INTO catalog.preference_values
        (category_code, value_key, label_es, label_en, sort_order, ordinal_rank, group_key, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NULL, true, NOW(), NOW())
       ON CONFLICT (category_code, value_key) DO UPDATE SET
         label_es = EXCLUDED.label_es,
         label_en = EXCLUDED.label_en,
         sort_order = EXCLUDED.sort_order,
         ordinal_rank = EXCLUDED.ordinal_rank,
         is_active = true,
         updated_at = NOW()`,
      [
        value.categoryCode,
        value.valueKey,
        titleCase(value.labelEs),
        titleCase(value.labelEn),
        value.sortOrder,
        "ordinalRank" in value ? value.ordinalRank : null,
      ]
    );
  }
}

async function upsertLaunchV2Profile(client: DbClient, profile: LaunchReferenceV2Profile, mediaRoot: string) {
  const userResult = await client.query<{ id: number }>(
    `INSERT INTO auth.users
       (email, password_hash, status, preferred_locale, created_provider, email_verified, email_verified_at, created_at, updated_at)
     VALUES ($1, NULL, 'active', 'en', 'local', true, NOW(), NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET
       status = 'active',
       email_verified = true,
       email_verified_at = COALESCE(auth.users.email_verified_at, EXCLUDED.email_verified_at),
       updated_at = NOW()
     RETURNING id`,
    [profile.email]
  );
  const userId = userResult.rows[0]!.id;

  const insertedProfile = await client.query<{ id: number }>(
    `INSERT INTO core.profiles
       (public_id, user_id, kind, display_name, profession, bio, content_locale, date_of_birth, location, country, gender_identity, pronouns, personality, relationship_goals, education, children_preference, physical_activity, alcohol_use, tobacco_use, political_interest, religion_importance, religion, body_type, height, hair_color, ethnicity, is_discoverable, created_at, updated_at)
     VALUES
       ($1, $2, 'dummy', $3, $4, $5, 'en', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, false, NOW(), NOW())
     ON CONFLICT (public_id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       kind = 'dummy',
       display_name = EXCLUDED.display_name,
       profession = EXCLUDED.profession,
       bio = EXCLUDED.bio,
       content_locale = EXCLUDED.content_locale,
       date_of_birth = EXCLUDED.date_of_birth,
       location = EXCLUDED.location,
       country = EXCLUDED.country,
       gender_identity = EXCLUDED.gender_identity,
       pronouns = EXCLUDED.pronouns,
       personality = EXCLUDED.personality,
       relationship_goals = EXCLUDED.relationship_goals,
       education = EXCLUDED.education,
       children_preference = EXCLUDED.children_preference,
       physical_activity = EXCLUDED.physical_activity,
       alcohol_use = EXCLUDED.alcohol_use,
       tobacco_use = EXCLUDED.tobacco_use,
       political_interest = EXCLUDED.political_interest,
       religion_importance = EXCLUDED.religion_importance,
       religion = EXCLUDED.religion,
       body_type = EXCLUDED.body_type,
       height = EXCLUDED.height,
       hair_color = EXCLUDED.hair_color,
       ethnicity = EXCLUDED.ethnicity,
       is_discoverable = false,
       updated_at = NOW()
     RETURNING id`,
    [
      profile.publicId,
      userId,
      profile.displayName,
      profile.occupation,
      profile.shortBio,
      profile.dateOfBirth,
      `${profile.city}, ${profile.country}`,
      profile.country,
      profile.gender,
      profile.gender === "female" ? "she/her" : "he/him",
      profile.lifestyle.personality,
      profile.relationshipGoal,
      profile.lifestyle.education,
      profile.lifestyle.childrenPreference,
      profile.lifestyle.physicalActivity,
      profile.lifestyle.alcoholUse,
      profile.lifestyle.tobaccoUse,
      profile.lifestyle.politicalInterest,
      profile.lifestyle.religionImportance,
      profile.lifestyle.religion,
      profile.lifestyle.bodyType,
      profile.lifestyle.height,
      profile.lifestyle.hairColor,
      profile.lifestyle.ethnicity,
    ]
  );
  const profileId = insertedProfile.rows[0]!.id;

  await client.query(
    `INSERT INTO core.profile_copy
       (profile_id, locale, occupation_text, bio_text, created_at, updated_at)
     VALUES
       ($1, 'en', $2, $3, NOW(), NOW()),
       ($1, 'es', $2, $4, NOW(), NOW())
     ON CONFLICT (profile_id, locale) DO UPDATE SET
       occupation_text = EXCLUDED.occupation_text,
       bio_text = EXCLUDED.bio_text,
       updated_at = NOW()`,
    [profileId, profile.occupation, profile.longBio, profile.longBioEs]
  );

  await client.query(
    `INSERT INTO core.profile_dummy_metadata
       (profile_id, dummy_batch_key, synthetic_group, synthetic_variant, generation_version, seed_source, created_at)
     VALUES ($1, $2, $3, $4, $5, 'launch-reference-profiles-v2', NOW())
     ON CONFLICT (profile_id) DO UPDATE SET
       dummy_batch_key = EXCLUDED.dummy_batch_key,
       synthetic_group = EXCLUDED.synthetic_group,
       synthetic_variant = EXCLUDED.synthetic_variant,
       generation_version = EXCLUDED.generation_version,
       seed_source = EXCLUDED.seed_source`,
    [
      profileId,
      LAUNCH_REFERENCE_V2_BATCH_KEY,
      profile.gender,
      LAUNCH_REFERENCE_V2_GENERATION_VERSION,
      LAUNCH_REFERENCE_V2_GENERATION_VERSION_NUMBER,
    ]
  );

  await client.query(`DELETE FROM core.profile_languages WHERE profile_id = $1`, [profileId]);
  for (const [position, language] of profile.languages.entries()) {
    await client.query(
      `INSERT INTO core.profile_languages
        (profile_id, language_code, position, is_primary, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [profileId, language, position, position === 0]
    );
  }

  await client.query(`DELETE FROM core.profile_interests WHERE profile_id = $1`, [profileId]);
  for (const [position, interest] of profile.interests.entries()) {
    await client.query(
      `INSERT INTO core.profile_interests
        (profile_id, interest_code, position, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [profileId, interest, position]
    );
  }

  await client.query(`DELETE FROM core.profile_category_values WHERE profile_id = $1`, [profileId]);
  for (const [category, value] of Object.entries(profile.categoryValues)) {
    await client.query(
      `INSERT INTO core.profile_category_values
        (profile_id, category_code, value_key, normalized_numeric_value, source, updated_at)
       VALUES ($1, $2, $3, NULL, 'launch_seed_v2', NOW())`,
      [profileId, category, value]
    );
  }

  await client.query(`DELETE FROM media.media_assets WHERE owner_profile_id = $1`, [profileId]);
  let readyMedia = 0;
  let pendingMedia = 0;
  for (const prompt of profile.imagePrompts) {
    const filePath = path.join(mediaRoot, prompt.targetStorageKey);
    const fileExists = fs.existsSync(filePath);
    const stat = fileExists ? fs.statSync(filePath) : null;
    const status = fileExists ? "ready" : "pending";
    if (fileExists) readyMedia += 1;
    else pendingMedia += 1;

    const asset = await client.query<{ id: number }>(
      `INSERT INTO media.media_assets
        (owner_profile_id, storage_provider, storage_key, public_url, mime_type, byte_size, width, height, status, created_at, updated_at)
       VALUES ($1, 'local', $2, '', 'image/jpeg', $3, 1200, 1600, $4, NOW(), NOW())
       RETURNING id`,
      [profileId, prompt.targetStorageKey, stat?.size ?? null, status]
    );
    await client.query(
      `INSERT INTO media.profile_images
        (profile_id, media_asset_id, sort_order, is_primary, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [profileId, asset.rows[0]!.id, prompt.sortOrder, prompt.sortOrder === 0]
    );
  }

  await client.query(
    `INSERT INTO discovery.filter_preferences
       (actor_profile_id, selected_genders, therian_mode, age_min, age_max, created_at, updated_at)
     VALUES ($1, $2::jsonb, 'exclude', 24, 42, NOW(), NOW())
     ON CONFLICT (actor_profile_id) DO UPDATE SET
       selected_genders = EXCLUDED.selected_genders,
       therian_mode = EXCLUDED.therian_mode,
       age_min = EXCLUDED.age_min,
       age_max = EXCLUDED.age_max,
       updated_at = NOW()`,
    [profileId, JSON.stringify(profile.interestedIn)]
  );

  await client.query(
    `DELETE FROM discovery.actor_queue
     WHERE actor_profile_id = $1
        OR target_profile_id = $1
        OR target_profile_public_id = $2`,
    [profileId, profile.publicId]
  );

  return { profileId, readyMedia, pendingMedia, imageRecords: profile.imagePrompts.length };
}

export async function seedLaunchReferenceV2Profiles(client: DbClient) {
  const sourceValidation = validateLaunchReferenceV2Source();
  if (!sourceValidation.ok) {
    throw new Error(`Launch reference V2 source validation failed:\n${sourceValidation.errors.join("\n")}`);
  }

  await seedExtraPreferenceValues(client);

  const mediaRoot = resolveMediaRoot();
  const results = [];
  for (const profile of launchReferenceV2Profiles) {
    results.push(await upsertLaunchV2Profile(client, profile, mediaRoot));
  }

  const profileIds = results.map((result) => result.profileId);
  await client.query(
    `UPDATE core.profiles p
     SET is_discoverable = CASE
       WHEN p.kind = 'dummy'
        AND pdm.profile_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM core.profile_languages pl WHERE pl.profile_id = p.id)
        AND EXISTS (SELECT 1 FROM core.profile_category_values pcv WHERE pcv.profile_id = p.id)
        AND EXISTS (SELECT 1 FROM discovery.filter_preferences fp WHERE fp.actor_profile_id = p.id)
        AND (
          SELECT COUNT(*)
          FROM media.profile_images pi
          JOIN media.media_assets ma ON ma.id = pi.media_asset_id
          WHERE pi.profile_id = p.id
            AND ma.status = 'ready'
        ) >= 2
       THEN true
       ELSE false
     END,
     updated_at = NOW()
     FROM core.profile_dummy_metadata pdm
     WHERE p.id = pdm.profile_id
       AND pdm.dummy_batch_key = $2
       AND p.id = ANY($1::bigint[])`,
    [profileIds, LAUNCH_REFERENCE_V2_BATCH_KEY]
  );

  const discoverableResult = await client.query<{ discoverable: string }>(
    `SELECT COUNT(*)::text AS discoverable
     FROM core.profiles p
     JOIN core.profile_dummy_metadata pdm ON pdm.profile_id = p.id
     WHERE pdm.dummy_batch_key = $1
       AND pdm.generation_version = $2
       AND p.is_discoverable = true`,
    [LAUNCH_REFERENCE_V2_BATCH_KEY, LAUNCH_REFERENCE_V2_GENERATION_VERSION_NUMBER]
  );

  return {
    insertedOrUpdated: results.length,
    female: launchReferenceV2Profiles.filter((profile) => profile.gender === "female").length,
    male: launchReferenceV2Profiles.filter((profile) => profile.gender === "male").length,
    imageRecords: results.reduce((sum, result) => sum + result.imageRecords, 0),
    readyMedia: results.reduce((sum, result) => sum + result.readyMedia, 0),
    pendingMedia: results.reduce((sum, result) => sum + result.pendingMedia, 0),
    discoverable: Number(discoverableResult.rows[0]?.discoverable || 0),
    mediaRoot,
  };
}

async function main() {
  loadApiEnv();
  const cacheService = new CacheService();
  const healthService = new HealthService(cacheService);
  await healthService.assertSchemaReady();
  await new GoalsService(cacheService).seedCatalog();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const summary = await seedLaunchReferenceV2Profiles(client);
    await client.query("COMMIT");
    console.log("[api-server] launch reference V2 profiles seeded", {
      ...summary,
      batchKey: LAUNCH_REFERENCE_V2_BATCH_KEY,
      generationVersion: LAUNCH_REFERENCE_V2_GENERATION_VERSION,
      generationVersionNumber: LAUNCH_REFERENCE_V2_GENERATION_VERSION_NUMBER,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
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

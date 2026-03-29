import "reflect-metadata";
import { pool } from "@workspace/db";
import { loadApiEnv } from "../config/env";
import { GoalsService } from "../modules/goals/goals.service";
import { HealthService } from "../modules/health/health.service";
import { rebuildDiscoveryProjectionsForActor } from "../modules/discovery/discovery.projections";

const DUMMY_BATCH_KEY = "dummy-v2";
const GENERATION_VERSION = 2;
const TOTAL_DUMMIES = 999;
const GROUP_SIZE = 333;

const FEMALE_DISCOVERY_IMAGES = [
  "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&q=80",
  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&q=80",
] as const;

const MALE_DISCOVERY_IMAGES = [
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&q=80",
  "https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=600&q=80",
  "https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=600&q=80",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80",
] as const;

const OTHER_DISCOVERY_IMAGES = [
  "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&q=80",
  "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=600&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&q=80",
  "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&q=80",
  "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&q=80",
] as const;

const maleNames = [
  "Lucas",
  "Mateo",
  "Leo",
  "Thiago",
  "Gael",
  "Bruno",
  "Nico",
  "Adri",
  "Iker",
  "Dani",
] as const;
const femaleNames = [
  "Sofía",
  "Valentina",
  "Martina",
  "Lucía",
  "Emma",
  "Mia",
  "Sara",
  "Elena",
  "Noa",
  "Julia",
] as const;
const otherNames = [
  "Alex",
  "Ari",
  "Noah",
  "Sam",
  "Kai",
  "Nico",
  "Cruz",
  "Jules",
  "River",
  "Sky",
] as const;
const surnames = [
  "Ortega",
  "Navarro",
  "Romero",
  "Santos",
  "Vega",
  "Paredes",
  "Molina",
  "Castro",
  "Blanco",
  "Ibarra",
] as const;
const cities = [
  "Madrid, España",
  "Barcelona, España",
  "Valencia, España",
  "Sevilla, España",
  "Bilbao, España",
  "Lisboa, Portugal",
  "Paris, France",
  "Berlin, Germany",
] as const;
const professions = [
  "Designer",
  "Engineer",
  "Teacher",
  "Physio",
  "Chef",
  "Photographer",
  "Product Manager",
  "Architect",
  "Researcher",
  "Developer",
] as const;
const personalities = [
  "empathetic",
  "curious",
  "playful",
  "calm",
  "adventurous",
  "thoughtful",
] as const;
const bodyTypes = [
  "slim",
  "lean",
  "athletic",
  "muscular",
  "medium_build",
  "compact_build",
  "curvy",
  "rounded_build",
  "sturdy",
  "large_build",
  "plus_size",
] as const;
const relationshipGoals = [
  "stable_relationship",
  "still_figuring_it_out",
  "making_friends",
  "nothing_serious",
] as const;
const educationLevels = [
  "high_school",
  "technical_school",
  "university_student",
  "bachelors_degree",
  "masters_degree",
  "doctorate",
] as const;
const childrenPreferences = [
  "want_children",
  "have_and_want_more",
  "have_and_dont_want_more",
  "not_sure",
  "dont_want_children",
] as const;
const languages = ["es", "en", "fr", "de", "it", "pt", "ca"] as const;
const interests = [
  "music",
  "travel",
  "fitness",
  "books",
  "food",
  "cinema",
  "hiking",
  "art",
  "coffee",
  "design",
] as const;
const otherVariants = [
  "agender",
  "genderfluid",
  "androgynous",
  "nonbinary",
  "queer",
  "two_spirit",
] as const;

type DummyProfileSeed = {
  email: string;
  publicId: string;
  displayName: string;
  profession: string;
  bio: string;
  dateOfBirth: string;
  location: string;
  genderIdentity: string;
  pronouns: string;
  personality: string;
  relationshipGoals: string;
  education: string;
  childrenPreference: string;
  physicalActivity: string;
  alcoholUse: string;
  tobaccoUse: string;
  politicalInterest: string;
  religionImportance: string;
  religion: string;
  bodyType: string;
  height: string;
  hairColor: string;
  ethnicity: string;
  syntheticGroup: "male" | "female" | "other";
  syntheticVariant: string;
  languages: string[];
  interests: string[];
  images: string[];
  insightTags: Array<{ es: string; en: string }>;
  goalFeedback: Array<{ goalKey: string; reasonEs: string; reasonEn: string }>;
};

type InsertedDummyActor = {
  index: number;
  userId: number;
  profileId: number;
  publicId: string;
  categoryValues: Record<string, string | null>;
};

function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let value = Math.imul(t ^ (t >>> 15), t | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, values: readonly T[]) {
  return values[Math.floor(random() * values.length)]!;
}

function pickUnique<T>(random: () => number, values: readonly T[], count: number) {
  const remaining = [...values];
  const selected: T[] = [];
  while (remaining.length > 0 && selected.length < count) {
    const index = Math.floor(random() * remaining.length);
    selected.push(remaining.splice(index, 1)[0]!);
  }
  return selected;
}

function dateFromAge(age: number) {
  const year = new Date().getUTCFullYear() - age;
  const month = String((age % 12) + 1).padStart(2, "0");
  const day = String(((age * 3) % 27) + 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function humanizeCode(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildGoalFeedback(random: () => number, profile: {
  relationshipGoals: string;
  bodyType: string;
  education: string;
}) {
  const base = [
    {
      goalKey: "1",
      reasonEs: `Valora una energía ${humanizeCode(profile.bodyType).toLowerCase()}.`,
      reasonEn: `Values a ${humanizeCode(profile.bodyType).toLowerCase()} energy.`,
    },
    {
      goalKey: "6",
      reasonEs: `Conecta con una mente ${humanizeCode(profile.education).toLowerCase()}.`,
      reasonEn: `Connects with a ${humanizeCode(profile.education).toLowerCase()} mindset.`,
    },
  ];

  if (random() > 0.5) {
    base.push({
      goalKey: "10",
      reasonEs: `Busca algo ${humanizeCode(profile.relationshipGoals).toLowerCase()}.`,
      reasonEn: `Looks for something ${humanizeCode(profile.relationshipGoals).toLowerCase()}.`,
    });
  }

  return base.slice(0, 2);
}

function buildDummy(index: number): DummyProfileSeed {
  const random = mulberry32(91001 + index * 17 + GENERATION_VERSION * 1000);
  const syntheticGroup =
    index < GROUP_SIZE ? "male" : index < GROUP_SIZE * 2 ? "female" : "other";
  const givenName =
    syntheticGroup === "male"
      ? pick(random, maleNames)
      : syntheticGroup === "female"
        ? pick(random, femaleNames)
        : pick(random, otherNames);
  const surname = pick(random, surnames);
  const genderIdentity =
    syntheticGroup === "male"
      ? "male"
      : syntheticGroup === "female"
        ? "female"
        : random() > 0.5
          ? "non_binary"
          : "fluid";
  const pronouns =
    syntheticGroup === "male"
      ? "he/him"
      : syntheticGroup === "female"
        ? "she/her"
        : "they/them";
  const bodyType = pick(random, bodyTypes);
  const education = pick(random, educationLevels);
  const relationship = pick(random, relationshipGoals);
  const children = pick(random, childrenPreferences);
  const spokenLanguages = pickUnique(random, languages, 2);
  const interestList = pickUnique(random, interests, 4);
  const age = 21 + Math.floor(random() * 18);
  const imagesSource =
    syntheticGroup === "female"
      ? FEMALE_DISCOVERY_IMAGES
      : syntheticGroup === "male"
        ? MALE_DISCOVERY_IMAGES
        : OTHER_DISCOVERY_IMAGES;
  const imageStart = index % imagesSource.length;
  const images = Array.from({ length: 4 }, (_, imageIndex) => {
    return imagesSource[(imageStart + imageIndex) % imagesSource.length]!;
  });

  const seed = {
    email: `dummy+${DUMMY_BATCH_KEY}-${index + 1}@matcha.local`,
    publicId: `dummy_${DUMMY_BATCH_KEY}_${index + 1}`,
    displayName: `${givenName} ${surname}`,
    profession: pick(random, professions),
    bio: `Synthetic profile ${index + 1} with a ${pick(random, ["warm", "focused", "curious", "grounded"] as const)} tone and complete discovery metadata.`,
    dateOfBirth: dateFromAge(age),
    location: pick(random, cities),
    genderIdentity,
    pronouns,
    personality: pick(random, personalities),
    relationshipGoals: relationship,
    education,
    childrenPreference: children,
    physicalActivity: pick(random, ["active", "moderate", "weekend_only"] as const),
    alcoholUse: pick(random, ["socially", "rarely", "never"] as const),
    tobaccoUse: pick(random, ["never", "occasionally"] as const),
    politicalInterest: pick(random, ["low", "moderate", "high"] as const),
    religionImportance: pick(
      random,
      ["not_important", "somewhat_important", "important"] as const
    ),
    religion: pick(random, ["none", "christian", "muslim", "spiritual"] as const),
    bodyType,
    height: String(160 + Math.floor(random() * 36)),
    hairColor: pick(random, ["brown", "black", "blonde", "red"] as const),
    ethnicity: pick(random, ["latinx", "white", "mixed", "asian", "black"] as const),
    syntheticGroup,
    syntheticVariant:
      syntheticGroup === "other" ? pick(random, otherVariants) : genderIdentity,
    languages: spokenLanguages,
    interests: interestList,
    images,
    insightTags: [
      {
        es: humanizeCode(bodyType),
        en: humanizeCode(bodyType),
      },
      {
        es: humanizeCode(education),
        en: humanizeCode(education),
      },
      {
        es: humanizeCode(relationship),
        en: humanizeCode(relationship),
      },
    ],
    goalFeedback: buildGoalFeedback(random, {
      relationshipGoals: relationship,
      bodyType,
      education,
    }),
  } satisfies DummyProfileSeed;

  return seed;
}

function buildDummyInteractionPlan(
  actor: InsertedDummyActor,
  actors: InsertedDummyActor[]
) {
  const random = mulberry32(actor.profileId * 97 + GENERATION_VERSION * 1009);
  const candidateIndices = actors
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.profileId !== actor.profileId);
  const ordered = [...candidateIndices].sort(
    (left, right) =>
      (mulberry32(left.candidate.profileId * 31 + actor.profileId)() -
        mulberry32(right.candidate.profileId * 31 + actor.profileId)()) ||
      left.index - right.index
  );

  const totalDecisions = 48;
  const likeCount = 36;

  return ordered.slice(0, totalDecisions).map(({ candidate }, interactionIndex) => ({
    target: candidate,
    interactionType: interactionIndex < likeCount ? ("like" as const) : ("pass" as const),
    createdAt: new Date(
      Date.UTC(
        2026,
        0,
        1 + (interactionIndex % 28),
        Math.floor(random() * 23),
        Math.floor(random() * 59),
        Math.floor(random() * 59)
      )
    ).toISOString(),
  }));
}

async function getActiveBatchSummary() {
  const result = await pool.query<{
    dummy_batch_key: string;
    generation_version: number;
    profile_count: string;
  }>(
    `SELECT dummy_batch_key, generation_version, COUNT(*)::text AS profile_count
     FROM core.profile_dummy_metadata
     GROUP BY dummy_batch_key, generation_version
     ORDER BY generation_version DESC, dummy_batch_key DESC`
  );
  return result.rows;
}

async function rebuildAllUserProjections(goalsService: GoalsService) {
  const actors = await pool.query<{ profile_id: number; user_id: number }>(
    `SELECT id AS profile_id, user_id
     FROM core.profiles
     WHERE user_id IS NOT NULL
     ORDER BY id ASC`
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const actor of actors.rows) {
      await rebuildDiscoveryProjectionsForActor(client, actor.profile_id);
      await goalsService.rebuildUserGoalTargets(actor.user_id, client, {
        refreshPreferences: false,
      });
    }
    await client.query("COMMIT");
    return actors.rows.length;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  loadApiEnv();
  const healthService = new HealthService();
  await healthService.assertSchemaReady();

  const goalsService = new GoalsService();
  await goalsService.seedCatalog();

  const beforeBatches = await getActiveBatchSummary();
  console.log("[api-server] active dummy batch before replacement", beforeBatches);

  const client = await pool.connect();
  let deletedProfiles = 0;
  let deletedInteractions = 0;
  let deletedUsers = 0;
  const insertedActors: InsertedDummyActor[] = [];

  try {
    await client.query("BEGIN");

    const existingDummies = await client.query<{
      id: number;
      public_id: string;
      user_id: number | null;
    }>(
      `SELECT id, public_id, user_id
       FROM core.profiles
       WHERE kind = 'dummy'
       ORDER BY id ASC`
    );

    const dummyProfileIds = existingDummies.rows.map((row) => row.id);
    const dummyPublicIds = existingDummies.rows.map((row) => row.public_id);
    const dummyUserIds = existingDummies.rows
      .map((row) => Number(row.user_id))
      .filter((value) => Number.isFinite(value) && value > 0);
    deletedProfiles = dummyProfileIds.length;

    if (dummyProfileIds.length > 0) {
      const deletedDecisions = await client.query<{ count: string }>(
        `DELETE FROM discovery.profile_decisions
         WHERE target_profile_id = ANY($1::bigint[])
            OR target_profile_public_id = ANY($2::varchar[])
         RETURNING 1::text AS count`,
        [dummyProfileIds, dummyPublicIds]
      );
      const deletedEvents = await client.query<{ count: string }>(
        `DELETE FROM discovery.profile_interactions
         WHERE target_profile_id = ANY($1::bigint[])
            OR target_profile_public_id = ANY($2::varchar[])
         RETURNING 1::text AS count`,
        [dummyProfileIds, dummyPublicIds]
      );
      deletedInteractions = deletedDecisions.rows.length + deletedEvents.rows.length;

      if (dummyUserIds.length > 0) {
        const deletedUsersResult = await client.query<{ id: number }>(
          `DELETE FROM auth.users
           WHERE id = ANY($1::bigint[])
           RETURNING id`,
          [dummyUserIds]
        );
        deletedUsers = deletedUsersResult.rows.length;
      }

      await client.query(
        `DELETE FROM core.profiles
         WHERE kind = 'dummy'
           AND user_id IS NULL`
      );
    }

    for (let index = 0; index < TOTAL_DUMMIES; index += 1) {
      const dummy = buildDummy(index);

      const insertedUser = await client.query<{ id: number }>(
        `INSERT INTO auth.users
          (email, password_hash, status, preferred_locale, created_provider, email_verified, email_verified_at, created_at, updated_at)
         VALUES ($1, NULL, 'active', 'es', 'local', true, NOW(), NOW(), NOW())
         RETURNING id`,
        [dummy.email]
      );
      const userId = insertedUser.rows[0]!.id;

      const inserted = await client.query<{ id: number }>(
        `INSERT INTO core.profiles
          (public_id, user_id, kind, display_name, profession, bio, content_locale, date_of_birth, location, gender_identity, pronouns, personality, relationship_goals, education, children_preference, physical_activity, alcohol_use, tobacco_use, political_interest, religion_importance, religion, body_type, height, hair_color, ethnicity, is_discoverable, created_at, updated_at)
         VALUES ($1, $2, 'dummy', $3, $4, $5, 'es', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, true, NOW(), NOW())
         RETURNING id`,
        [
          dummy.publicId,
          userId,
          dummy.displayName,
          dummy.profession,
          dummy.bio,
          dummy.dateOfBirth,
          dummy.location,
          dummy.genderIdentity,
          dummy.pronouns,
          dummy.personality,
          dummy.relationshipGoals,
          dummy.education,
          dummy.childrenPreference,
          dummy.physicalActivity,
          dummy.alcoholUse,
          dummy.tobaccoUse,
          dummy.politicalInterest,
          dummy.religionImportance,
          dummy.religion,
          dummy.bodyType,
          dummy.height,
          dummy.hairColor,
          dummy.ethnicity,
        ]
      );

      const profileId = inserted.rows[0]!.id;

      await client.query(
        `INSERT INTO core.profile_dummy_metadata
          (profile_id, dummy_batch_key, synthetic_group, synthetic_variant, generation_version, seed_source, created_at)
         VALUES ($1, $2, $3, $4, $5, 'seed-dummy-users', NOW())`,
        [
          profileId,
          DUMMY_BATCH_KEY,
          dummy.syntheticGroup,
          dummy.syntheticVariant,
          GENERATION_VERSION,
        ]
      );

      for (const [position, languageCode] of dummy.languages.entries()) {
        await client.query(
          `INSERT INTO core.profile_languages
            (profile_id, language_code, position, is_primary, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [profileId, languageCode, position, position === 0]
        );
      }

      for (const [position, interestCode] of dummy.interests.entries()) {
        await client.query(
          `INSERT INTO core.profile_interests
            (profile_id, interest_code, position, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())`,
          [profileId, interestCode, position]
        );
      }

      const categoryValues: Array<[string, string]> = [
        ["physical", dummy.bodyType],
        ["personality", dummy.personality],
        ["family", dummy.childrenPreference],
        ["expectations", dummy.relationshipGoals],
        ["language", dummy.languages[0]!],
        ["studies", dummy.education],
      ];

      for (const [categoryCode, valueKey] of categoryValues) {
        await client.query(
          `INSERT INTO core.profile_category_values
            (profile_id, category_code, value_key, normalized_numeric_value, source, updated_at)
           VALUES ($1, $2, $3, NULL, 'seed', NOW())`,
          [profileId, categoryCode, valueKey]
        );
      }

      for (const [sortOrder, imageUrl] of dummy.images.entries()) {
        const insertedAsset = await client.query<{ id: number }>(
          `INSERT INTO media.media_assets
            (owner_profile_id, storage_provider, storage_key, public_url, mime_type, byte_size, status, created_at, updated_at)
           VALUES ($1, 'local', $2, $3, 'image/jpeg', NULL, 'ready', NOW(), NOW())
           RETURNING id`,
          [profileId, `seed/${DUMMY_BATCH_KEY}/${profileId}/${sortOrder}`, imageUrl]
        );

        await client.query(
          `INSERT INTO media.profile_images
            (profile_id, media_asset_id, sort_order, is_primary, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [profileId, insertedAsset.rows[0]!.id, sortOrder, sortOrder === 0]
        );
      }

      for (const [sortOrder, tag] of dummy.insightTags.entries()) {
        await client.query(
          `INSERT INTO discovery.profile_insight_tags
            (profile_id, locale, value, sort_order, created_at, updated_at)
           VALUES ($1, 'es', $2, $3, NOW(), NOW()),
                  ($1, 'en', $4, $3, NOW(), NOW())`,
          [profileId, tag.es, sortOrder, tag.en]
        );
      }

      for (const feedback of dummy.goalFeedback) {
        await client.query(
          `INSERT INTO discovery.profile_goal_feedback
            (profile_id, goal_key, reason_es, reason_en, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [profileId, feedback.goalKey, feedback.reasonEs, feedback.reasonEn]
        );
      }

      insertedActors.push({
        index,
        userId,
        profileId,
        publicId: dummy.publicId,
        categoryValues: {
          physical: dummy.bodyType,
          personality: dummy.personality,
          family: dummy.childrenPreference,
          expectations: dummy.relationshipGoals,
          language: dummy.languages[0] || null,
          studies: dummy.education,
        },
      });
    }

    for (const actor of insertedActors) {
      const plan = buildDummyInteractionPlan(actor, insertedActors);
      for (const [interactionIndex, entry] of plan.entries()) {
        await client.query(
          `INSERT INTO discovery.profile_interactions
            (actor_profile_id, target_profile_id, target_profile_public_id, interaction_type, decision_source, request_id, category_values_json, metadata_json, created_at)
           VALUES ($1, $2, $3, $4, 'seed', $5, $6::jsonb, $7::jsonb, $8)`,
          [
            actor.profileId,
            entry.target.profileId,
            entry.target.publicId,
            entry.interactionType,
            `${DUMMY_BATCH_KEY}:${GENERATION_VERSION}:${actor.profileId}:${interactionIndex}`,
            JSON.stringify(entry.target.categoryValues),
            JSON.stringify({
              dummyBatchKey: DUMMY_BATCH_KEY,
              generationVersion: GENERATION_VERSION,
              actorProfileId: actor.profileId,
              targetProfileId: entry.target.profileId,
              simulated: true,
            }),
            entry.createdAt,
          ]
        );
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  console.log("[api-server] dummy batch replacement committed", {
    deletedProfiles,
    deletedUsers,
    deletedInteractions,
    insertedProfiles: TOTAL_DUMMIES,
    insertedUsers: insertedActors.length,
    simulatedActors: insertedActors.length,
    dummyBatchKey: DUMMY_BATCH_KEY,
    generationVersion: GENERATION_VERSION,
  });

  try {
    const rebuiltActors = await rebuildAllUserProjections(goalsService);
    console.log("[api-server] discovery and goal projections rebuilt", {
      rebuiltActors,
      dummyBatchKey: DUMMY_BATCH_KEY,
      generationVersion: GENERATION_VERSION,
    });
  } catch (error) {
    console.error("[api-server] dummy batch replacement committed but projection rebuild failed", {
      dummyBatchKey: DUMMY_BATCH_KEY,
      generationVersion: GENERATION_VERSION,
      error,
    });
    throw error;
  } finally {
    const afterBatches = await getActiveBatchSummary();
    console.log("[api-server] active dummy batch after replacement", afterBatches);
    await pool.end().catch(() => {});
  }
}

main().catch(async (error) => {
  console.error(error);
  await pool.end().catch(() => {});
  process.exit(1);
});

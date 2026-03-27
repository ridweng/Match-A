import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

const authSchema = pgSchema("auth");
const coreSchema = pgSchema("core");
const catalogSchema = pgSchema("catalog");
const goalsSchema = pgSchema("goals");
const discoverySchema = pgSchema("discovery");
const mediaSchema = pgSchema("media");

export const authProviderEnum = pgEnum("auth_provider", [
  "local",
  "google",
  "facebook",
  "apple",
]);

export const userStatusEnum = pgEnum("user_status", ["active", "disabled", "deleted"]);
export const profileKindEnum = pgEnum("profile_kind", ["user", "dummy"]);
export const onboardingStatusEnum = pgEnum("onboarding_status", [
  "pending",
  "completed",
  "exempt",
]);
export const syncStatusEnum = pgEnum("sync_status", ["pending", "completed"]);
export const taskStatusEnum = pgEnum("task_status", ["active", "completed"]);
export const interactionTypeEnum = pgEnum("interaction_type", ["like", "pass"]);
export const localeCodeEnum = pgEnum("locale_code", ["es", "en"]);
export const heightUnitEnum = pgEnum("height_unit", ["metric", "imperial"]);
export const mediaStatusEnum = pgEnum("media_status", ["pending", "ready", "deleted"]);
export const storageProviderEnum = pgEnum("storage_provider", ["local", "s3"]);
export const changeMessageTypeEnum = pgEnum("change_message_type", [
  "popular_mode_changed",
]);
export const emailActionTypeEnum = pgEnum("email_action_type", [
  "verify_resend",
  "password_reset_request",
]);

export const usersTable = authSchema.table(
  "users",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    email: varchar("email", { length: 255 }),
    passwordHash: varchar("password_hash", { length: 255 }),
    status: userStatusEnum("status").notNull().default("active"),
    preferredLocale: localeCodeEnum("preferred_locale").notNull().default("es"),
    createdProvider: authProviderEnum("created_provider").notNull().default("local"),
    emailVerified: boolean("email_verified").notNull().default(false),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    welcomeEmailSentAt: timestamp("welcome_email_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailUnique: uniqueIndex("auth_users_email_unique").on(table.email),
  })
);

export const authIdentitiesTable = authSchema.table(
  "auth_identities",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    provider: authProviderEnum("provider").notNull(),
    providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    providerIdentityUnique: uniqueIndex("auth_identities_provider_identity_unique").on(
      table.provider,
      table.providerUserId
    ),
  })
);

export const emailVerificationTokensTable = authSchema.table(
  "email_verification_tokens",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("auth_email_verification_tokens_token_hash_unique").on(
      table.tokenHash
    ),
  })
);

export const authSessionsTable = authSchema.table(
  "auth_sessions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    accessTokenHash: varchar("access_token_hash", { length: 255 }).notNull(),
    refreshTokenHash: varchar("refresh_token_hash", { length: 255 }).notNull(),
    accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }).notNull(),
    refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    devicePlatform: varchar("device_platform", { length: 32 }),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    accessTokenHashUnique: uniqueIndex("auth_sessions_access_token_hash_unique").on(
      table.accessTokenHash
    ),
    refreshTokenHashUnique: uniqueIndex("auth_sessions_refresh_token_hash_unique").on(
      table.refreshTokenHash
    ),
  })
);

export const passwordResetTokensTable = authSchema.table(
  "password_reset_tokens",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("auth_password_reset_tokens_token_hash_unique").on(
      table.tokenHash
    ),
    userStateIndex: index("auth_password_reset_tokens_user_state_idx").on(
      table.userId,
      table.usedAt,
      table.supersededAt,
      table.expiresAt
    ),
    userSingleActiveResetTokenUnique: uniqueIndex(
      "auth_password_reset_tokens_single_active_unique"
    )
      .on(table.userId)
      .where(sql`${table.usedAt} IS NULL AND ${table.supersededAt} IS NULL`),
  })
);

export const emailActionAttemptsTable = authSchema.table(
  "email_action_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actionType: emailActionTypeEnum("action_type").notNull(),
    ipHash: varchar("ip_hash", { length: 64 }).notNull(),
    emailHash: varchar("email_hash", { length: 64 }),
    userId: bigint("user_id", { mode: "number" }).references(() => usersTable.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actionTypeIpCreatedIndex: index("auth_email_action_attempts_ip_created_idx").on(
      table.actionType,
      table.ipHash,
      table.createdAt
    ),
    actionTypeEmailCreatedIndex: index(
      "auth_email_action_attempts_email_created_idx"
    ).on(table.actionType, table.emailHash, table.createdAt),
    actionTypeUserCreatedIndex: index("auth_email_action_attempts_user_created_idx").on(
      table.actionType,
      table.userId,
      table.createdAt
    ),
  })
);

export const profilesTable = coreSchema.table(
  "profiles",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    publicId: varchar("public_id", { length: 64 }).notNull(),
    userId: bigint("user_id", { mode: "number" }).references(() => usersTable.id, {
      onDelete: "cascade",
    }),
    kind: profileKindEnum("kind").notNull().default("user"),
    displayName: varchar("display_name", { length: 120 }).notNull().default(""),
    profession: varchar("profession", { length: 120 }).notNull().default(""),
    bio: text("bio").notNull().default(""),
    contentLocale: localeCodeEnum("content_locale").notNull().default("es"),
    dateOfBirth: date("date_of_birth"),
    location: varchar("location", { length: 255 }).notNull().default(""),
    genderIdentity: varchar("gender_identity", { length: 64 }).notNull().default(""),
    pronouns: varchar("pronouns", { length: 64 }).notNull().default(""),
    personality: varchar("personality", { length: 64 }).notNull().default(""),
    relationshipGoals: varchar("relationship_goals", { length: 120 })
      .notNull()
      .default(""),
    education: varchar("education", { length: 120 }).notNull().default(""),
    childrenPreference: varchar("children_preference", { length: 120 })
      .notNull()
      .default(""),
    physicalActivity: varchar("physical_activity", { length: 120 })
      .notNull()
      .default(""),
    alcoholUse: varchar("alcohol_use", { length: 120 }).notNull().default(""),
    tobaccoUse: varchar("tobacco_use", { length: 120 }).notNull().default(""),
    politicalInterest: varchar("political_interest", { length: 120 })
      .notNull()
      .default(""),
    religionImportance: varchar("religion_importance", { length: 120 })
      .notNull()
      .default(""),
    religion: varchar("religion", { length: 120 }).notNull().default(""),
    bodyType: varchar("body_type", { length: 120 }).notNull().default(""),
    height: varchar("height", { length: 32 }).notNull().default(""),
    hairColor: varchar("hair_color", { length: 120 }).notNull().default(""),
    ethnicity: varchar("ethnicity", { length: 160 }).notNull().default(""),
    isDiscoverable: boolean("is_discoverable").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    publicIdUnique: uniqueIndex("core_profiles_public_id_unique").on(table.publicId),
    userIdUnique: uniqueIndex("core_profiles_user_id_unique").on(table.userId),
  })
);

export const profileCopyTable = coreSchema.table(
  "profile_copy",
  {
    profileId: bigint("profile_id", { mode: "number" })
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    locale: localeCodeEnum("locale").notNull(),
    occupationText: text("occupation_text"),
    bioText: text("bio_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileCopyPk: primaryKey({
      name: "core_profile_copy_pk",
      columns: [table.profileId, table.locale],
    }),
  })
);

export const userSettingsTable = coreSchema.table("user_settings", {
  userId: bigint("user_id", { mode: "number" })
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  language: localeCodeEnum("language").notNull().default("es"),
  heightUnit: heightUnitEnum("height_unit").notNull().default("metric"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userOnboardingTable = coreSchema.table("user_onboarding", {
  userId: bigint("user_id", { mode: "number" })
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  status: onboardingStatusEnum("status").notNull().default("pending"),
  requiredVersion: integer("required_version").notNull().default(1),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  exemptedAt: timestamp("exempted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userSyncStateTable = coreSchema.table("user_sync_state", {
  userId: bigint("user_id", { mode: "number" })
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  initialDataMigrationStatus: syncStatusEnum("initial_data_migration_status")
    .notNull()
    .default("pending"),
  initialDataMigrationCompletedAt: timestamp(
    "initial_data_migration_completed_at",
    {
      withTimezone: true,
    }
  ),
  lastProfileSyncAt: timestamp("last_profile_sync_at", { withTimezone: true }),
  lastGoalsSyncAt: timestamp("last_goals_sync_at", { withTimezone: true }),
  lastMediaSyncAt: timestamp("last_media_sync_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profileLanguagesTable = coreSchema.table(
  "profile_languages",
  {
    profileId: bigint("profile_id", { mode: "number" })
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 64 }).notNull(),
    position: integer("position").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileLanguagesPk: primaryKey({
      name: "core_profile_languages_pk",
      columns: [table.profileId, table.languageCode],
    }),
    profileLanguagePositionUnique: uniqueIndex(
      "core_profile_languages_profile_position_unique"
    ).on(table.profileId, table.position),
  })
);

export const profileInterestsTable = coreSchema.table(
  "profile_interests",
  {
    profileId: bigint("profile_id", { mode: "number" })
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    interestCode: varchar("interest_code", { length: 64 }).notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileInterestsPk: primaryKey({
      name: "core_profile_interests_pk",
      columns: [table.profileId, table.interestCode],
    }),
    profileInterestPositionUnique: uniqueIndex(
      "core_profile_interests_profile_position_unique"
    ).on(table.profileId, table.position),
  })
);

export const goalCategoriesTable = catalogSchema.table(
  "goal_categories",
  {
    code: varchar("code", { length: 64 }).primaryKey(),
    labelEs: varchar("label_es", { length: 120 }).notNull(),
    labelEn: varchar("label_en", { length: 120 }).notNull(),
    sortOrder: integer("sort_order").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

export const goalTaskTemplatesTable = catalogSchema.table(
  "goal_task_templates",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    goalKey: varchar("goal_key", { length: 64 }).notNull(),
    categoryCode: varchar("category_code", { length: 64 })
      .notNull()
      .references(() => goalCategoriesTable.code, { onDelete: "cascade" }),
    titleEs: varchar("title_es", { length: 255 }).notNull(),
    titleEn: varchar("title_en", { length: 255 }).notNull(),
    nextActionEs: text("next_action_es").notNull().default(""),
    nextActionEn: text("next_action_en").notNull().default(""),
    impactEs: text("impact_es").notNull().default(""),
    impactEn: text("impact_en").notNull().default(""),
    defaultSortOrder: integer("default_sort_order").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    goalTaskTemplateGoalKeyUnique: uniqueIndex(
      "catalog_goal_task_templates_goal_key_unique"
    ).on(table.goalKey),
    goalTaskTemplateSortUnique: uniqueIndex(
      "catalog_goal_task_templates_category_sort_unique"
    ).on(table.categoryCode, table.defaultSortOrder),
  })
);

export const userGoalTasksTable = goalsSchema.table(
  "user_goal_tasks",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    templateId: bigint("template_id", { mode: "number" })
      .notNull()
      .references(() => goalTaskTemplatesTable.id, { onDelete: "cascade" }),
    categoryCode: varchar("category_code", { length: 64 })
      .notNull()
      .references(() => goalCategoriesTable.code, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    status: taskStatusEnum("status").notNull().default("active"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userGoalTaskUnique: uniqueIndex("goals_user_goal_tasks_user_template_unique").on(
      table.userId,
      table.templateId
    ),
    userGoalTaskOrderUnique: uniqueIndex(
      "goals_user_goal_tasks_user_category_sort_unique"
    ).on(table.userId, table.categoryCode, table.sortOrder),
  })
);

export const userCategoryProgressTable = goalsSchema.table(
  "user_category_progress",
  {
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    categoryCode: varchar("category_code", { length: 64 })
      .notNull()
      .references(() => goalCategoriesTable.code, { onDelete: "cascade" }),
    featuredUserTaskId: bigint("featured_user_task_id", { mode: "number" }).references(
      () => userGoalTasksTable.id,
      { onDelete: "set null" }
    ),
    completedTasks: integer("completed_tasks").notNull().default(0),
    totalTasks: integer("total_tasks").notNull().default(0),
    completionPercent: integer("completion_percent").notNull().default(0),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCategoryProgressPk: primaryKey({
      name: "goals_user_category_progress_pk",
      columns: [table.userId, table.categoryCode],
    }),
  })
);

export const userGlobalProgressTable = goalsSchema.table("user_global_progress", {
  userId: bigint("user_id", { mode: "number" })
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  completionPercent: integer("completion_percent").notNull().default(0),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profileInteractionsTable = discoverySchema.table(
  "profile_interactions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorProfileId: bigint("actor_profile_id", { mode: "number" })
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    targetProfileId: bigint("target_profile_id", { mode: "number" }).references(
      () => profilesTable.id,
      { onDelete: "set null" }
    ),
    targetProfilePublicId: varchar("target_profile_public_id", { length: 64 }).notNull(),
    interactionType: interactionTypeEnum("interaction_type").notNull(),
    categoryValuesJson: jsonb("category_values_json")
      .$type<Record<string, string | null>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileInteractionUnique: uniqueIndex(
      "discovery_profile_interactions_actor_target_type_unique"
    ).on(table.actorProfileId, table.targetProfilePublicId, table.interactionType),
  })
);

export const profileInsightTagsTable = discoverySchema.table(
  "profile_insight_tags",
  {
    profileId: bigint("profile_id", { mode: "number" })
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    locale: localeCodeEnum("locale").notNull(),
    value: varchar("value", { length: 120 }).notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileInsightTagsPk: primaryKey({
      name: "discovery_profile_insight_tags_pk",
      columns: [table.profileId, table.locale, table.sortOrder],
    }),
  })
);

export const profileGoalFeedbackTable = discoverySchema.table(
  "profile_goal_feedback",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    profileId: bigint("profile_id", { mode: "number" })
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    goalKey: varchar("goal_key", { length: 64 }).notNull(),
    reasonEs: text("reason_es").notNull().default(""),
    reasonEn: text("reason_en").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileGoalFeedbackUnique: uniqueIndex(
      "discovery_profile_goal_feedback_profile_goal_key_unique"
    ).on(table.profileId, table.goalKey),
  })
);

export const popularAttributeCountsTable = discoverySchema.table(
  "popular_attribute_counts",
  {
    actorProfileId: bigint("actor_profile_id", { mode: "number" })
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    categoryCode: varchar("category_code", { length: 64 })
      .notNull()
      .references(() => goalCategoriesTable.code, { onDelete: "cascade" }),
    valueKey: varchar("value_key", { length: 120 }).notNull(),
    likeCount: integer("like_count").notNull().default(0),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    popularAttributeCountsPk: primaryKey({
      name: "discovery_popular_attribute_counts_pk",
      columns: [table.actorProfileId, table.categoryCode, table.valueKey],
    }),
  })
);

export const popularAttributeModesTable = discoverySchema.table(
  "popular_attribute_modes",
  {
    actorProfileId: bigint("actor_profile_id", { mode: "number" })
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    categoryCode: varchar("category_code", { length: 64 })
      .notNull()
      .references(() => goalCategoriesTable.code, { onDelete: "cascade" }),
    currentValueKey: varchar("current_value_key", { length: 120 }),
    currentCount: integer("current_count").notNull().default(0),
    totalLikesConsidered: integer("total_likes_considered").notNull().default(0),
    lastChangedAtInteractionId: bigint("last_changed_at_interaction_id", {
      mode: "number",
    }).references(() => profileInteractionsTable.id, { onDelete: "set null" }),
    lastChangedAtLikeCount: integer("last_changed_at_like_count")
      .notNull()
      .default(0),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    popularAttributeModesPk: primaryKey({
      name: "discovery_popular_attribute_modes_pk",
      columns: [table.actorProfileId, table.categoryCode],
    }),
  })
);

export const discoveryChangeMessagesTable = discoverySchema.table("discovery_change_messages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  actorProfileId: bigint("actor_profile_id", { mode: "number" })
    .notNull()
    .references(() => profilesTable.id, { onDelete: "cascade" }),
  interactionId: bigint("interaction_id", { mode: "number" })
    .notNull()
    .references(() => profileInteractionsTable.id, { onDelete: "cascade" }),
  messageType: changeMessageTypeEnum("message_type").notNull(),
  likeCountAtEvent: integer("like_count_at_event").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const discoveryFilterPreferencesTable = discoverySchema.table(
  "filter_preferences",
  {
    actorProfileId: bigint("actor_profile_id", { mode: "number" })
      .primaryKey()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    selectedGenders: jsonb("selected_genders")
      .$type<string[]>()
      .notNull()
      .default([]),
    therianMode: varchar("therian_mode", { length: 16 }).notNull().default("exclude"),
    ageMin: integer("age_min").notNull().default(18),
    ageMax: integer("age_max").notNull().default(40),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

export const mediaAssetsTable = mediaSchema.table(
  "media_assets",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ownerProfileId: bigint("owner_profile_id", { mode: "number" })
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    storageProvider: storageProviderEnum("storage_provider").notNull().default("local"),
    storageKey: text("storage_key").notNull(),
    publicUrl: text("public_url"),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    byteSize: integer("byte_size"),
    width: integer("width"),
    height: integer("height"),
    blurhash: varchar("blurhash", { length: 255 }),
    status: mediaStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    mediaStorageKeyUnique: uniqueIndex("media_assets_storage_key_unique").on(
      table.storageKey
    ),
  })
);

export const profileImagesTable = mediaSchema.table(
  "profile_images",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    profileId: bigint("profile_id", { mode: "number" })
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    mediaAssetId: bigint("media_asset_id", { mode: "number" })
      .notNull()
      .references(() => mediaAssetsTable.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    profileImageAssetUnique: uniqueIndex("media_profile_images_asset_unique").on(
      table.mediaAssetId
    ),
    profileImageSortUnique: uniqueIndex("media_profile_images_profile_sort_unique").on(
      table.profileId,
      table.sortOrder
    ),
  })
);

export type UserRow = typeof usersTable.$inferSelect;

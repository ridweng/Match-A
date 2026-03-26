CREATE SCHEMA IF NOT EXISTS "auth";--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "core";--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "catalog";--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "goals";--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "discovery";--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "media";--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('local', 'google', 'facebook', 'apple');--> statement-breakpoint
CREATE TYPE "public"."change_message_type" AS ENUM('popular_mode_changed');--> statement-breakpoint
CREATE TYPE "public"."height_unit" AS ENUM('metric', 'imperial');--> statement-breakpoint
CREATE TYPE "public"."interaction_type" AS ENUM('like', 'pass');--> statement-breakpoint
CREATE TYPE "public"."locale_code" AS ENUM('es', 'en');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending', 'ready', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."onboarding_status" AS ENUM('pending', 'completed', 'exempt');--> statement-breakpoint
CREATE TYPE "public"."profile_kind" AS ENUM('user', 'dummy');--> statement-breakpoint
CREATE TYPE "public"."storage_provider" AS ENUM('local', 's3');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('pending', 'completed');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled', 'deleted');--> statement-breakpoint
CREATE TABLE "auth"."auth_identities" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"provider" "auth_provider" NOT NULL,
	"provider_user_id" varchar(255) NOT NULL,
	"email" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."auth_sessions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"access_token_hash" varchar(255) NOT NULL,
	"refresh_token_hash" varchar(255) NOT NULL,
	"access_expires_at" timestamp with time zone NOT NULL,
	"refresh_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"device_platform" varchar(32),
	"user_agent" text,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery"."discovery_change_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_profile_id" bigint NOT NULL,
	"interaction_id" bigint NOT NULL,
	"message_type" "change_message_type" NOT NULL,
	"like_count_at_event" integer NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."email_verification_tokens" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."goal_categories" (
	"code" varchar(64) PRIMARY KEY NOT NULL,
	"label_es" varchar(120) NOT NULL,
	"label_en" varchar(120) NOT NULL,
	"sort_order" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."goal_task_templates" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"goal_key" varchar(64) NOT NULL,
	"category_code" varchar(64) NOT NULL,
	"title_es" varchar(255) NOT NULL,
	"title_en" varchar(255) NOT NULL,
	"next_action_es" text DEFAULT '' NOT NULL,
	"next_action_en" text DEFAULT '' NOT NULL,
	"impact_es" text DEFAULT '' NOT NULL,
	"impact_en" text DEFAULT '' NOT NULL,
	"default_sort_order" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media"."media_assets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"owner_profile_id" bigint NOT NULL,
	"storage_provider" "storage_provider" DEFAULT 'local' NOT NULL,
	"storage_key" text NOT NULL,
	"public_url" text,
	"mime_type" varchar(120) NOT NULL,
	"byte_size" integer,
	"width" integer,
	"height" integer,
	"blurhash" varchar(255),
	"status" "media_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "discovery"."popular_attribute_counts" (
	"actor_profile_id" bigint NOT NULL,
	"category_code" varchar(64) NOT NULL,
	"value_key" varchar(120) NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discovery_popular_attribute_counts_pk" PRIMARY KEY("actor_profile_id","category_code","value_key")
);
--> statement-breakpoint
CREATE TABLE "discovery"."popular_attribute_modes" (
	"actor_profile_id" bigint NOT NULL,
	"category_code" varchar(64) NOT NULL,
	"current_value_key" varchar(120),
	"current_count" integer DEFAULT 0 NOT NULL,
	"total_likes_considered" integer DEFAULT 0 NOT NULL,
	"last_changed_at_interaction_id" bigint,
	"last_changed_at_like_count" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discovery_popular_attribute_modes_pk" PRIMARY KEY("actor_profile_id","category_code")
);
--> statement-breakpoint
CREATE TABLE "core"."profile_copy" (
	"profile_id" bigint NOT NULL,
	"locale" "locale_code" NOT NULL,
	"occupation_text" text,
	"bio_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "core_profile_copy_pk" PRIMARY KEY("profile_id","locale")
);
--> statement-breakpoint
CREATE TABLE "discovery"."profile_goal_feedback" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"profile_id" bigint NOT NULL,
	"goal_key" varchar(64) NOT NULL,
	"reason_es" text DEFAULT '' NOT NULL,
	"reason_en" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media"."profile_images" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"profile_id" bigint NOT NULL,
	"media_asset_id" bigint NOT NULL,
	"sort_order" integer NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery"."profile_insight_tags" (
	"profile_id" bigint NOT NULL,
	"locale" "locale_code" NOT NULL,
	"value" varchar(120) NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discovery_profile_insight_tags_pk" PRIMARY KEY("profile_id","locale","sort_order")
);
--> statement-breakpoint
CREATE TABLE "discovery"."profile_interactions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_profile_id" bigint NOT NULL,
	"target_profile_id" bigint,
	"target_profile_public_id" varchar(64) NOT NULL,
	"interaction_type" "interaction_type" NOT NULL,
	"category_values_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."profile_interests" (
	"profile_id" bigint NOT NULL,
	"interest_code" varchar(64) NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "core_profile_interests_pk" PRIMARY KEY("profile_id","interest_code")
);
--> statement-breakpoint
CREATE TABLE "core"."profile_languages" (
	"profile_id" bigint NOT NULL,
	"language_code" varchar(64) NOT NULL,
	"position" integer NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "core_profile_languages_pk" PRIMARY KEY("profile_id","language_code")
);
--> statement-breakpoint
CREATE TABLE "core"."profiles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"public_id" varchar(64) NOT NULL,
	"user_id" bigint,
	"kind" "profile_kind" DEFAULT 'user' NOT NULL,
	"display_name" varchar(120) DEFAULT '' NOT NULL,
	"profession" varchar(120) DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"content_locale" "locale_code" DEFAULT 'es' NOT NULL,
	"date_of_birth" date,
	"location" varchar(255) DEFAULT '' NOT NULL,
	"gender_identity" varchar(64) DEFAULT '' NOT NULL,
	"pronouns" varchar(64) DEFAULT '' NOT NULL,
	"personality" varchar(64) DEFAULT '' NOT NULL,
	"relationship_goals" varchar(120) DEFAULT '' NOT NULL,
	"education" varchar(120) DEFAULT '' NOT NULL,
	"children_preference" varchar(120) DEFAULT '' NOT NULL,
	"physical_activity" varchar(120) DEFAULT '' NOT NULL,
	"alcohol_use" varchar(120) DEFAULT '' NOT NULL,
	"tobacco_use" varchar(120) DEFAULT '' NOT NULL,
	"political_interest" varchar(120) DEFAULT '' NOT NULL,
	"religion_importance" varchar(120) DEFAULT '' NOT NULL,
	"religion" varchar(120) DEFAULT '' NOT NULL,
	"body_type" varchar(120) DEFAULT '' NOT NULL,
	"height" varchar(32) DEFAULT '' NOT NULL,
	"hair_color" varchar(120) DEFAULT '' NOT NULL,
	"ethnicity" varchar(160) DEFAULT '' NOT NULL,
	"is_discoverable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals"."user_category_progress" (
	"user_id" bigint NOT NULL,
	"category_code" varchar(64) NOT NULL,
	"featured_user_task_id" bigint,
	"completed_tasks" integer DEFAULT 0 NOT NULL,
	"total_tasks" integer DEFAULT 0 NOT NULL,
	"completion_percent" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_user_category_progress_pk" PRIMARY KEY("user_id","category_code")
);
--> statement-breakpoint
CREATE TABLE "goals"."user_global_progress" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"completion_percent" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals"."user_goal_tasks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"template_id" bigint NOT NULL,
	"category_code" varchar(64) NOT NULL,
	"sort_order" integer NOT NULL,
	"status" "task_status" DEFAULT 'active' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."user_onboarding" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"status" "onboarding_status" DEFAULT 'pending' NOT NULL,
	"required_version" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"exempted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."user_settings" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"language" "locale_code" DEFAULT 'es' NOT NULL,
	"height_unit" "height_unit" DEFAULT 'metric' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."user_sync_state" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"initial_data_migration_status" "sync_status" DEFAULT 'pending' NOT NULL,
	"initial_data_migration_completed_at" timestamp with time zone,
	"last_profile_sync_at" timestamp with time zone,
	"last_goals_sync_at" timestamp with time zone,
	"last_media_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" varchar(255),
	"password_hash" varchar(255),
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"preferred_locale" "locale_code" DEFAULT 'es' NOT NULL,
	"created_provider" "auth_provider" DEFAULT 'local' NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery"."discovery_change_messages" ADD CONSTRAINT "discovery_change_messages_actor_profile_id_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "core"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery"."discovery_change_messages" ADD CONSTRAINT "discovery_change_messages_interaction_id_profile_interactions_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "discovery"."profile_interactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."goal_task_templates" ADD CONSTRAINT "goal_task_templates_category_code_goal_categories_code_fk" FOREIGN KEY ("category_code") REFERENCES "catalog"."goal_categories"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media"."media_assets" ADD CONSTRAINT "media_assets_owner_profile_id_profiles_id_fk" FOREIGN KEY ("owner_profile_id") REFERENCES "core"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery"."popular_attribute_counts" ADD CONSTRAINT "popular_attribute_counts_actor_profile_id_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "core"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery"."popular_attribute_counts" ADD CONSTRAINT "popular_attribute_counts_category_code_goal_categories_code_fk" FOREIGN KEY ("category_code") REFERENCES "catalog"."goal_categories"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery"."popular_attribute_modes" ADD CONSTRAINT "popular_attribute_modes_actor_profile_id_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "core"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery"."popular_attribute_modes" ADD CONSTRAINT "popular_attribute_modes_category_code_goal_categories_code_fk" FOREIGN KEY ("category_code") REFERENCES "catalog"."goal_categories"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery"."popular_attribute_modes" ADD CONSTRAINT "popular_attribute_modes_last_changed_at_interaction_id_profile_interactions_id_fk" FOREIGN KEY ("last_changed_at_interaction_id") REFERENCES "discovery"."profile_interactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."profile_copy" ADD CONSTRAINT "profile_copy_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "core"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery"."profile_goal_feedback" ADD CONSTRAINT "profile_goal_feedback_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "core"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media"."profile_images" ADD CONSTRAINT "profile_images_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "core"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media"."profile_images" ADD CONSTRAINT "profile_images_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "media"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery"."profile_insight_tags" ADD CONSTRAINT "profile_insight_tags_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "core"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery"."profile_interactions" ADD CONSTRAINT "profile_interactions_actor_profile_id_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "core"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery"."profile_interactions" ADD CONSTRAINT "profile_interactions_target_profile_id_profiles_id_fk" FOREIGN KEY ("target_profile_id") REFERENCES "core"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."profile_interests" ADD CONSTRAINT "profile_interests_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "core"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."profile_languages" ADD CONSTRAINT "profile_languages_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "core"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals"."user_category_progress" ADD CONSTRAINT "user_category_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals"."user_category_progress" ADD CONSTRAINT "user_category_progress_category_code_goal_categories_code_fk" FOREIGN KEY ("category_code") REFERENCES "catalog"."goal_categories"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals"."user_category_progress" ADD CONSTRAINT "user_category_progress_featured_user_task_id_user_goal_tasks_id_fk" FOREIGN KEY ("featured_user_task_id") REFERENCES "goals"."user_goal_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals"."user_global_progress" ADD CONSTRAINT "user_global_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals"."user_goal_tasks" ADD CONSTRAINT "user_goal_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals"."user_goal_tasks" ADD CONSTRAINT "user_goal_tasks_template_id_goal_task_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "catalog"."goal_task_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals"."user_goal_tasks" ADD CONSTRAINT "user_goal_tasks_category_code_goal_categories_code_fk" FOREIGN KEY ("category_code") REFERENCES "catalog"."goal_categories"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."user_onboarding" ADD CONSTRAINT "user_onboarding_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."user_sync_state" ADD CONSTRAINT "user_sync_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_provider_identity_unique" ON "auth"."auth_identities" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_access_token_hash_unique" ON "auth"."auth_sessions" USING btree ("access_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_unique" ON "auth"."auth_sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_email_verification_tokens_token_hash_unique" ON "auth"."email_verification_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_goal_task_templates_goal_key_unique" ON "catalog"."goal_task_templates" USING btree ("goal_key");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_goal_task_templates_category_sort_unique" ON "catalog"."goal_task_templates" USING btree ("category_code","default_sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_storage_key_unique" ON "media"."media_assets" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_profile_goal_feedback_profile_goal_key_unique" ON "discovery"."profile_goal_feedback" USING btree ("profile_id","goal_key");--> statement-breakpoint
CREATE UNIQUE INDEX "media_profile_images_asset_unique" ON "media"."profile_images" USING btree ("media_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_profile_images_profile_sort_unique" ON "media"."profile_images" USING btree ("profile_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_profile_interactions_actor_target_type_unique" ON "discovery"."profile_interactions" USING btree ("actor_profile_id","target_profile_public_id","interaction_type");--> statement-breakpoint
CREATE UNIQUE INDEX "core_profile_interests_profile_position_unique" ON "core"."profile_interests" USING btree ("profile_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "core_profile_languages_profile_position_unique" ON "core"."profile_languages" USING btree ("profile_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "core_profiles_public_id_unique" ON "core"."profiles" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "core_profiles_user_id_unique" ON "core"."profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goals_user_goal_tasks_user_template_unique" ON "goals"."user_goal_tasks" USING btree ("user_id","template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goals_user_goal_tasks_user_category_sort_unique" ON "goals"."user_goal_tasks" USING btree ("user_id","category_code","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_users_email_unique" ON "auth"."users" USING btree ("email");

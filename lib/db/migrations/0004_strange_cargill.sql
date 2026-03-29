CREATE TABLE "catalog"."category_goal_rules" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"category_code" varchar(64) NOT NULL,
	"rule_key" varchar(64) NOT NULL,
	"gap_min" integer DEFAULT 0 NOT NULL,
	"gap_max" integer DEFAULT 1000 NOT NULL,
	"target_selection_strategy" varchar(64) DEFAULT 'mode_value' NOT NULL,
	"progress_formula_type" varchar(64) DEFAULT 'category_default' NOT NULL,
	"task_template_group_key" varchar(64) DEFAULT 'default' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog"."preference_values" (
	"category_code" varchar(64) NOT NULL,
	"value_key" varchar(120) NOT NULL,
	"label_es" varchar(120) DEFAULT '' NOT NULL,
	"label_en" varchar(120) DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"ordinal_rank" integer,
	"group_key" varchar(64),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_preference_values_pk" PRIMARY KEY("category_code","value_key")
);
--> statement-breakpoint
CREATE TABLE "core"."profile_category_values" (
	"profile_id" bigint NOT NULL,
	"category_code" varchar(64) NOT NULL,
	"value_key" varchar(120) NOT NULL,
	"normalized_numeric_value" integer,
	"source" varchar(32) DEFAULT 'profile' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "core_profile_category_values_pk" PRIMARY KEY("profile_id","category_code")
);
--> statement-breakpoint
CREATE TABLE "discovery"."profile_decisions" (
	"actor_profile_id" bigint NOT NULL,
	"target_profile_id" bigint,
	"target_profile_public_id" varchar(64) NOT NULL,
	"current_state" "interaction_type" NOT NULL,
	"first_event_id" bigint NOT NULL,
	"latest_event_id" bigint NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discovery_profile_decisions_pk" PRIMARY KEY("actor_profile_id","target_profile_public_id")
);
--> statement-breakpoint
CREATE TABLE "core"."profile_dummy_metadata" (
	"profile_id" bigint PRIMARY KEY NOT NULL,
	"dummy_batch_key" varchar(64) NOT NULL,
	"synthetic_group" varchar(32) NOT NULL,
	"synthetic_variant" varchar(64) NOT NULL,
	"generation_version" integer DEFAULT 1 NOT NULL,
	"seed_source" varchar(64) DEFAULT 'seed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery"."profile_preference_thresholds" (
	"actor_profile_id" bigint PRIMARY KEY NOT NULL,
	"total_likes" integer DEFAULT 0 NOT NULL,
	"total_passes" integer DEFAULT 0 NOT NULL,
	"likes_until_unlock" integer DEFAULT 30 NOT NULL,
	"threshold_reached" boolean DEFAULT false NOT NULL,
	"mode_unlocked_at" timestamp with time zone,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals"."user_category_target_progress" (
	"user_id" bigint NOT NULL,
	"category_code" varchar(64) NOT NULL,
	"current_value_key" varchar(120),
	"target_value_key" varchar(120),
	"distance_raw" integer DEFAULT 0 NOT NULL,
	"distance_normalized" integer DEFAULT 0 NOT NULL,
	"completion_percent" integer DEFAULT 0 NOT NULL,
	"progress_state" varchar(64) DEFAULT 'idle' NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_user_category_target_progress_pk" PRIMARY KEY("user_id","category_code")
);
--> statement-breakpoint
CREATE TABLE "goals"."user_category_targets" (
	"user_id" bigint NOT NULL,
	"category_code" varchar(64) NOT NULL,
	"current_value_key" varchar(120),
	"derived_mode_value_key" varchar(120),
	"target_value_key" varchar(120),
	"derivation_status" varchar(64) NOT NULL,
	"threshold_reached" boolean DEFAULT false NOT NULL,
	"source_event_id" bigint,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_user_category_targets_pk" PRIMARY KEY("user_id","category_code")
);
--> statement-breakpoint
CREATE TABLE "goals"."user_goal_projection_meta" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"last_source_event_id" bigint,
	"last_recomputed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_rule_version" integer DEFAULT 1 NOT NULL,
	"rebuild_status" varchar(32) DEFAULT 'ready' NOT NULL
);
--> statement-breakpoint
DROP INDEX "discovery"."discovery_profile_interactions_actor_target_type_unique";--> statement-breakpoint
ALTER TABLE "catalog"."goal_categories" ADD COLUMN "comparison_model" varchar(32) DEFAULT 'exact' NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."goal_categories" ADD COLUMN "supports_mode_display" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."goal_categories" ADD COLUMN "supports_goal_derivation" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."goal_categories" ADD COLUMN "supports_progress_calculation" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."goal_categories" ADD COLUMN "supports_task_generation" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."goal_categories" ADD COLUMN "threshold_like_count" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."goal_categories" ADD COLUMN "goal_engine_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."goal_task_templates" ADD COLUMN "task_template_group_key" varchar(64) DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "discovery"."profile_interactions" ADD COLUMN "decision_source" varchar(32) DEFAULT 'api' NOT NULL;--> statement-breakpoint
ALTER TABLE "discovery"."profile_interactions" ADD COLUMN "request_id" varchar(128);--> statement-breakpoint
ALTER TABLE "discovery"."profile_interactions" ADD COLUMN "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "goals"."user_goal_tasks" ADD COLUMN "assignment_source" varchar(64) DEFAULT 'seed' NOT NULL;--> statement-breakpoint
ALTER TABLE "goals"."user_goal_tasks" ADD COLUMN "target_value_key" varchar(120);--> statement-breakpoint
ALTER TABLE "goals"."user_goal_tasks" ADD COLUMN "rule_key" varchar(64);--> statement-breakpoint
ALTER TABLE "goals"."user_goal_tasks" ADD COLUMN "task_template_group_key" varchar(64) DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "goals"."user_goal_tasks" ADD COLUMN "projection_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "goals"."user_goal_tasks" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "goals"."user_goal_tasks" ADD COLUMN "superseded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "catalog"."category_goal_rules" ADD CONSTRAINT "category_goal_rules_category_code_goal_categories_code_fk" FOREIGN KEY ("category_code") REFERENCES "catalog"."goal_categories"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."preference_values" ADD CONSTRAINT "preference_values_category_code_goal_categories_code_fk" FOREIGN KEY ("category_code") REFERENCES "catalog"."goal_categories"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."profile_category_values" ADD CONSTRAINT "profile_category_values_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "core"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."profile_category_values" ADD CONSTRAINT "profile_category_values_category_code_goal_categories_code_fk" FOREIGN KEY ("category_code") REFERENCES "catalog"."goal_categories"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery"."profile_decisions" ADD CONSTRAINT "profile_decisions_actor_profile_id_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "core"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery"."profile_decisions" ADD CONSTRAINT "profile_decisions_target_profile_id_profiles_id_fk" FOREIGN KEY ("target_profile_id") REFERENCES "core"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery"."profile_decisions" ADD CONSTRAINT "profile_decisions_first_event_id_profile_interactions_id_fk" FOREIGN KEY ("first_event_id") REFERENCES "discovery"."profile_interactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery"."profile_decisions" ADD CONSTRAINT "profile_decisions_latest_event_id_profile_interactions_id_fk" FOREIGN KEY ("latest_event_id") REFERENCES "discovery"."profile_interactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery"."profile_decisions" ADD CONSTRAINT "profile_decisions_actor_target_distinct_check" CHECK ("actor_profile_id" <> "target_profile_id");--> statement-breakpoint
ALTER TABLE "core"."profile_dummy_metadata" ADD CONSTRAINT "profile_dummy_metadata_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "core"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery"."profile_preference_thresholds" ADD CONSTRAINT "profile_preference_thresholds_actor_profile_id_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "core"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals"."user_category_target_progress" ADD CONSTRAINT "user_category_target_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals"."user_category_target_progress" ADD CONSTRAINT "user_category_target_progress_category_code_goal_categories_code_fk" FOREIGN KEY ("category_code") REFERENCES "catalog"."goal_categories"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals"."user_category_targets" ADD CONSTRAINT "user_category_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals"."user_category_targets" ADD CONSTRAINT "user_category_targets_category_code_goal_categories_code_fk" FOREIGN KEY ("category_code") REFERENCES "catalog"."goal_categories"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals"."user_category_targets" ADD CONSTRAINT "user_category_targets_source_event_id_profile_interactions_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "discovery"."profile_interactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals"."user_goal_projection_meta" ADD CONSTRAINT "user_goal_projection_meta_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals"."user_goal_projection_meta" ADD CONSTRAINT "user_goal_projection_meta_last_source_event_id_profile_interactions_id_fk" FOREIGN KEY ("last_source_event_id") REFERENCES "discovery"."profile_interactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_category_goal_rules_category_rule_unique" ON "catalog"."category_goal_rules" USING btree ("category_code","rule_key");--> statement-breakpoint
CREATE INDEX "catalog_preference_values_category_rank_idx" ON "catalog"."preference_values" USING btree ("category_code","ordinal_rank");--> statement-breakpoint
CREATE INDEX "discovery_profile_decisions_actor_state_decided_idx" ON "discovery"."profile_decisions" USING btree ("actor_profile_id","current_state","decided_at");--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_profile_interactions_actor_request_unique" ON "discovery"."profile_interactions" USING btree ("actor_profile_id","request_id") WHERE "discovery"."profile_interactions"."request_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "discovery_profile_interactions_actor_created_idx" ON "discovery"."profile_interactions" USING btree ("actor_profile_id","created_at");

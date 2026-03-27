CREATE TABLE "discovery"."filter_preferences" (
	"actor_profile_id" bigint PRIMARY KEY NOT NULL,
	"selected_genders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"therian_mode" varchar(16) DEFAULT 'exclude' NOT NULL,
	"age_min" integer DEFAULT 18 NOT NULL,
	"age_max" integer DEFAULT 40 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discovery"."filter_preferences" ADD CONSTRAINT "filter_preferences_actor_profile_id_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "core"."profiles"("id") ON DELETE cascade ON UPDATE no action;

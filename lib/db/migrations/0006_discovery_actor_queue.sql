CREATE TYPE "public"."discovery_queue_status" AS ENUM('reserved', 'consumed', 'invalidated');
--> statement-breakpoint

CREATE TABLE "discovery"."actor_state" (
  "actor_profile_id" bigint PRIMARY KEY NOT NULL,
  "queue_version" integer DEFAULT 1 NOT NULL,
  "stream_version" integer DEFAULT 1 NOT NULL,
  "filters_hash" varchar(255) DEFAULT '' NOT NULL,
  "last_served_sort_key" bigint,
  "last_served_profile_id" bigint,
  "active_queue_head_position" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discovery"."actor_state"
  ADD CONSTRAINT "actor_state_actor_profile_id_profiles_id_fk"
  FOREIGN KEY ("actor_profile_id")
  REFERENCES "core"."profiles"("id")
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "discovery"."actor_state"
  ADD CONSTRAINT "actor_state_last_served_profile_id_profiles_id_fk"
  FOREIGN KEY ("last_served_profile_id")
  REFERENCES "core"."profiles"("id")
  ON DELETE set null
  ON UPDATE no action;
--> statement-breakpoint

CREATE TABLE "discovery"."actor_queue" (
  "actor_profile_id" bigint NOT NULL,
  "queue_version" integer NOT NULL,
  "position" integer NOT NULL,
  "target_profile_id" bigint NOT NULL,
  "status" "public"."discovery_queue_status" DEFAULT 'reserved' NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "source_bucket" varchar(64),
  "rank_score" bigint,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "discovery_actor_queue_pk" PRIMARY KEY("actor_profile_id","queue_version","position")
);
--> statement-breakpoint
ALTER TABLE "discovery"."actor_queue"
  ADD CONSTRAINT "actor_queue_actor_profile_id_profiles_id_fk"
  FOREIGN KEY ("actor_profile_id")
  REFERENCES "core"."profiles"("id")
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "discovery"."actor_queue"
  ADD CONSTRAINT "actor_queue_target_profile_id_profiles_id_fk"
  FOREIGN KEY ("target_profile_id")
  REFERENCES "core"."profiles"("id")
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "discovery_actor_queue_actor_queue_position_idx"
  ON "discovery"."actor_queue" USING btree ("actor_profile_id","queue_version","position");
--> statement-breakpoint
CREATE INDEX "discovery_actor_queue_actor_status_idx"
  ON "discovery"."actor_queue" USING btree ("actor_profile_id","queue_version","status");
--> statement-breakpoint

INSERT INTO "discovery"."actor_state" (
  "actor_profile_id",
  "queue_version",
  "stream_version",
  "filters_hash",
  "active_queue_head_position",
  "updated_at"
)
SELECT
  p."id",
  1,
  1,
  COALESCE(
    (
      SELECT jsonb_build_object(
        'selectedGenders', COALESCE(fp."selected_genders", '[]'::jsonb),
        'therianMode', COALESCE(fp."therian_mode", 'exclude'),
        'ageMin', COALESCE(fp."age_min", 18),
        'ageMax', COALESCE(fp."age_max", 40)
      )::text
      FROM "discovery"."filter_preferences" fp
      WHERE fp."actor_profile_id" = p."id"
    ),
    '{"selectedGenders":[],"therianMode":"exclude","ageMin":18,"ageMax":40}'
  ),
  1,
  NOW()
FROM "core"."profiles" p
ON CONFLICT ("actor_profile_id") DO NOTHING;

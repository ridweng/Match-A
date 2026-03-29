ALTER TABLE "discovery"."profile_preference_thresholds"
  ADD COLUMN "threshold_reached_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "discovery"."profile_preference_thresholds"
  ADD COLUMN "last_decision_event_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "discovery"."profile_preference_thresholds"
  ADD COLUMN "last_decision_interaction_id" bigint;
--> statement-breakpoint
ALTER TABLE "discovery"."profile_preference_thresholds"
  ADD CONSTRAINT "profile_preference_thresholds_last_decision_interaction_id_profile_interactions_id_fk"
  FOREIGN KEY ("last_decision_interaction_id")
  REFERENCES "discovery"."profile_interactions"("id")
  ON DELETE set null
  ON UPDATE no action;
--> statement-breakpoint

CREATE TABLE "goals"."user_unlock_state" (
  "user_id" bigint PRIMARY KEY NOT NULL,
  "actor_profile_id" bigint NOT NULL,
  "threshold_like_count" integer DEFAULT 30 NOT NULL,
  "threshold_reached_at" timestamp with time zone,
  "threshold_reached_event_id" bigint,
  "goals_unlock_event_emitted_at" timestamp with time zone,
  "goals_unlock_message_seen_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals"."user_unlock_state"
  ADD CONSTRAINT "user_unlock_state_user_id_users_id_fk"
  FOREIGN KEY ("user_id")
  REFERENCES "auth"."users"("id")
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "goals"."user_unlock_state"
  ADD CONSTRAINT "user_unlock_state_actor_profile_id_profiles_id_fk"
  FOREIGN KEY ("actor_profile_id")
  REFERENCES "core"."profiles"("id")
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "goals"."user_unlock_state"
  ADD CONSTRAINT "user_unlock_state_threshold_reached_event_id_profile_interactions_id_fk"
  FOREIGN KEY ("threshold_reached_event_id")
  REFERENCES "discovery"."profile_interactions"("id")
  ON DELETE set null
  ON UPDATE no action;
--> statement-breakpoint

CREATE TABLE "discovery"."profile_reset_state" (
  "actor_profile_id" bigint PRIMARY KEY NOT NULL,
  "last_reset_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discovery"."profile_reset_state"
  ADD CONSTRAINT "profile_reset_state_actor_profile_id_profiles_id_fk"
  FOREIGN KEY ("actor_profile_id")
  REFERENCES "core"."profiles"("id")
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint

UPDATE "discovery"."profile_preference_thresholds" pth
SET
  "threshold_reached_at" = COALESCE(pth."mode_unlocked_at", pth."computed_at"),
  "last_decision_event_at" = latest."created_at",
  "last_decision_interaction_id" = latest."id"
FROM (
  SELECT DISTINCT ON (pi."actor_profile_id")
    pi."actor_profile_id",
    pi."id",
    pi."created_at"
  FROM "discovery"."profile_interactions" pi
  ORDER BY pi."actor_profile_id", pi."created_at" DESC, pi."id" DESC
) latest
WHERE latest."actor_profile_id" = pth."actor_profile_id";
--> statement-breakpoint

UPDATE "discovery"."profile_preference_thresholds"
SET "threshold_reached_at" = COALESCE("threshold_reached_at", "mode_unlocked_at", "computed_at")
WHERE "threshold_reached" = true;
--> statement-breakpoint

INSERT INTO "goals"."user_unlock_state" (
  "user_id",
  "actor_profile_id",
  "threshold_like_count",
  "threshold_reached_at",
  "threshold_reached_event_id",
  "goals_unlock_event_emitted_at",
  "goals_unlock_message_seen_at",
  "created_at",
  "updated_at"
)
SELECT
  p."user_id",
  p."id",
  30,
  COALESCE(pth."threshold_reached_at", pth."mode_unlocked_at", pth."computed_at"),
  pth."last_decision_interaction_id",
  COALESCE(pth."threshold_reached_at", pth."mode_unlocked_at", pth."computed_at"),
  COALESCE(pth."threshold_reached_at", pth."mode_unlocked_at", pth."computed_at"),
  NOW(),
  NOW()
FROM "core"."profiles" p
JOIN "discovery"."profile_preference_thresholds" pth
  ON pth."actor_profile_id" = p."id"
WHERE p."user_id" IS NOT NULL
  AND pth."threshold_reached" = true
ON CONFLICT ("user_id") DO NOTHING;

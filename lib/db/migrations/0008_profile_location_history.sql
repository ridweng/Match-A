CREATE TABLE "core"."profile_location_history" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "user_id" bigint NOT NULL,
  "profile_id" bigint NOT NULL,
  "location" varchar(255) DEFAULT '' NOT NULL,
  "country" varchar(120) DEFAULT '' NOT NULL,
  "latitude_e6" integer,
  "longitude_e6" integer,
  "source" varchar(64) DEFAULT 'profile_update' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core"."profile_location_history"
  ADD CONSTRAINT "profile_location_history_user_id_users_id_fk"
  FOREIGN KEY ("user_id")
  REFERENCES "auth"."users"("id")
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "core"."profile_location_history"
  ADD CONSTRAINT "profile_location_history_profile_id_profiles_id_fk"
  FOREIGN KEY ("profile_id")
  REFERENCES "core"."profiles"("id")
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "core_profile_location_history_user_created_idx"
  ON "core"."profile_location_history" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "core_profile_location_history_profile_created_idx"
  ON "core"."profile_location_history" USING btree ("profile_id","created_at");

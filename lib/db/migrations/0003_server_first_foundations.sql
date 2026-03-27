CREATE SCHEMA IF NOT EXISTS "notifications";
--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('terms_of_service', 'privacy_policy', 'marketing_email');
--> statement-breakpoint
CREATE TYPE "public"."notification_device_platform" AS ENUM('ios', 'android', 'web');
--> statement-breakpoint
CREATE TABLE "core"."user_consents" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"consent_type" "public"."consent_type" NOT NULL,
	"policy_version" varchar(64) NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" varchar(64) DEFAULT 'mobile_app' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."user_devices" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"push_token" varchar(512) NOT NULL,
	"platform" "public"."notification_device_platform" NOT NULL,
	"app_version" varchar(64),
	"device_model" varchar(120),
	"locale" "public"."locale_code",
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core"."user_consents" ADD CONSTRAINT "user_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications"."user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "core_user_consents_user_type_version_unique" ON "core"."user_consents" USING btree ("user_id","consent_type","policy_version");
--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_devices_push_token_unique" ON "notifications"."user_devices" USING btree ("push_token");
--> statement-breakpoint
CREATE INDEX "notifications_user_devices_user_seen_idx" ON "notifications"."user_devices" USING btree ("user_id","last_seen_at");

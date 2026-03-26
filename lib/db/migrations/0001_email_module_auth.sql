CREATE TYPE "public"."email_action_type" AS ENUM('verify_resend', 'password_reset_request');--> statement-breakpoint
CREATE TABLE "auth"."email_action_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"action_type" "email_action_type" NOT NULL,
	"ip_hash" varchar(64) NOT NULL,
	"email_hash" varchar(64),
	"user_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."password_reset_tokens" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "welcome_email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth"."email_action_attempts" ADD CONSTRAINT "email_action_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_email_action_attempts_ip_created_idx" ON "auth"."email_action_attempts" USING btree ("action_type","ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "auth_email_action_attempts_email_created_idx" ON "auth"."email_action_attempts" USING btree ("action_type","email_hash","created_at");--> statement-breakpoint
CREATE INDEX "auth_email_action_attempts_user_created_idx" ON "auth"."email_action_attempts" USING btree ("action_type","user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_password_reset_tokens_token_hash_unique" ON "auth"."password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_password_reset_tokens_user_state_idx" ON "auth"."password_reset_tokens" USING btree ("user_id","used_at","superseded_at","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_password_reset_tokens_single_active_unique" ON "auth"."password_reset_tokens" USING btree ("user_id") WHERE "auth"."password_reset_tokens"."used_at" IS NULL AND "auth"."password_reset_tokens"."superseded_at" IS NULL;
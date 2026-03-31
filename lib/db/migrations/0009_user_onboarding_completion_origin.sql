ALTER TABLE "core"."user_onboarding"
  ADD COLUMN IF NOT EXISTS "completion_origin" varchar(32);

UPDATE "core"."user_onboarding"
SET "completion_origin" = CASE
  WHEN "status" = 'completed'::onboarding_status THEN 'user_flow'
  ELSE NULL
END
WHERE "completion_origin" IS NULL;

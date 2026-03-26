import "reflect-metadata";
import { pool } from "@workspace/db";
import { loadApiEnv } from "../config/env";

async function main() {
  loadApiEnv();
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await pool.query("DROP SCHEMA IF EXISTS media CASCADE");
  await pool.query("DROP SCHEMA IF EXISTS discovery CASCADE");
  await pool.query("DROP SCHEMA IF EXISTS goals CASCADE");
  await pool.query("DROP SCHEMA IF EXISTS catalog CASCADE");
  await pool.query("DROP SCHEMA IF EXISTS core CASCADE");
  await pool.query("DROP SCHEMA IF EXISTS auth CASCADE");
  await pool.query('DROP TYPE IF EXISTS "public"."user_status" CASCADE');
  await pool.query('DROP TYPE IF EXISTS "public"."task_status" CASCADE');
  await pool.query('DROP TYPE IF EXISTS "public"."sync_status" CASCADE');
  await pool.query('DROP TYPE IF EXISTS "public"."storage_provider" CASCADE');
  await pool.query('DROP TYPE IF EXISTS "public"."profile_kind" CASCADE');
  await pool.query('DROP TYPE IF EXISTS "public"."onboarding_status" CASCADE');
  await pool.query('DROP TYPE IF EXISTS "public"."media_status" CASCADE');
  await pool.query('DROP TYPE IF EXISTS "public"."locale_code" CASCADE');
  await pool.query('DROP TYPE IF EXISTS "public"."interaction_type" CASCADE');
  await pool.query('DROP TYPE IF EXISTS "public"."height_unit" CASCADE');
  await pool.query('DROP TYPE IF EXISTS "public"."change_message_type" CASCADE');
  await pool.query('DROP TYPE IF EXISTS "public"."auth_provider" CASCADE');
  await pool.query('DROP TYPE IF EXISTS "public"."email_action_type" CASCADE');
  console.log("[api-server] database schemas dropped");
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end().catch(() => {});
  process.exit(1);
});

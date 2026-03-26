import "reflect-metadata";
import { loadApiEnv } from "../config/env";
import { AuthService } from "../modules/auth/auth.service";
import type { EmailService } from "../modules/email/email.service";
import { GoalsService } from "../modules/goals/goals.service";
import { HealthService } from "../modules/health/health.service";

async function main() {
  loadApiEnv();
  const healthService = new HealthService();
  await healthService.assertSchemaReady();

  const goalsService = new GoalsService();
  await goalsService.seedCatalog();

  if ((process.env.NODE_ENV || "development") !== "production") {
    const emailServiceStub = {
      sendWelcomeEmail: async () => undefined,
      sendVerificationEmail: async () => undefined,
      sendPasswordResetEmail: async () => undefined,
      sendRawEmail: async () => ({
        provider: "stub",
        messageId: null,
        accepted: 0,
        skipped: true,
        logOnly: true,
      }),
    } as unknown as EmailService;
    const authService = new AuthService(goalsService, emailServiceStub);
    await authService.ensureDefaultAccount();
  }

  console.log("[api-server] seed complete");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

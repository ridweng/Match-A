import { registerAs } from "@nestjs/config";
import { getCachedApiEnv } from "./env.schema";

export const emailConfig = registerAs("email", () => {
  const env = getCachedApiEnv();

  return {
    enabled: env.SMTP_ENABLED,
    logOnly: env.EMAIL_LOG_ONLY,
    verifyOnStartup: env.SMTP_VERIFY_ON_STARTUP,
    provider: "smtp" as const,
    from: {
      email: env.SMTP_FROM_EMAIL,
      name: env.SMTP_FROM_NAME,
    },
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      connectionTimeoutMs: env.SMTP_CONNECTION_TIMEOUT_MS,
      socketTimeoutMs: env.SMTP_SOCKET_TIMEOUT_MS,
    },
  };
});

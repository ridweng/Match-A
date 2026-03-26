import { z } from "zod";

const booleanLikeSchema = z
  .union([z.boolean(), z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value !== "string" || !value.trim()) return undefined;
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "on"].includes(normalized);
  });

const integerLikeSchema = z
  .union([z.number(), z.string()])
  .optional()
  .transform((value) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string" || !value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  });

const envSchema = z
  .object({
    APP_NAME: z.string().trim().min(1).default("Matcha"),
    APP_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_PORT: integerLikeSchema.default(8082),
    API_BASE_URL: z.string().trim().url().default("http://127.0.0.1:8082"),
    FRONTEND_BASE_URL: z.string().trim().default("http://localhost:8080"),
    AUTH_FRONTEND_REDIRECT_URI: z
      .string()
      .trim()
      .default("matcha://auth-callback"),
    AUTH_SESSION_SECRET: z.string().trim().min(1).default("matcha-dev-secret"),
    AUTH_MINIMUM_AGE: integerLikeSchema.default(18),
    AUTH_ACCESS_TTL_MINUTES: integerLikeSchema.default(15),
    AUTH_REFRESH_TTL_DAYS: integerLikeSchema.default(30),
    AUTH_PASSWORD_RESET_TTL_MINUTES: integerLikeSchema.default(60),
    AUTH_EMAIL_VERIFICATION_TTL_MINUTES: integerLikeSchema.default(1440),
    AUTH_ONBOARDING_ROLLOUT_AT: z
      .string()
      .trim()
      .default("2026-03-26T00:00:00.000Z"),
    AUTH_PASSWORD_RESET_URL_BASE: z.string().trim().optional(),
    SMTP_ENABLED: booleanLikeSchema.default(false),
    EMAIL_LOG_ONLY: booleanLikeSchema.default(false),
    SMTP_HOST: z.string().trim().default(""),
    SMTP_PORT: integerLikeSchema.default(587),
    SMTP_SECURE: booleanLikeSchema.default(false),
    SMTP_USER: z.string().trim().default(""),
    SMTP_PASS: z.string().trim().default(""),
    SMTP_FROM_EMAIL: z.string().trim().default("no-reply@matcha.local"),
    SMTP_FROM_NAME: z.string().trim().default("Matcha"),
    SMTP_CONNECTION_TIMEOUT_MS: integerLikeSchema.default(10000),
    SMTP_SOCKET_TIMEOUT_MS: integerLikeSchema.default(20000),
    SMTP_VERIFY_ON_STARTUP: booleanLikeSchema.default(false),
    GOOGLE_CLIENT_ID: z.string().trim().default(""),
    GOOGLE_CLIENT_SECRET: z.string().trim().default(""),
    FACEBOOK_CLIENT_ID: z.string().trim().default(""),
    FACEBOOK_CLIENT_SECRET: z.string().trim().default(""),
    APPLE_TEAM_ID: z.string().trim().default(""),
    APPLE_KEY_ID: z.string().trim().default(""),
    APPLE_PRIVATE_KEY: z.string().trim().default(""),
    APPLE_SERVICE_ID: z.string().trim().default(""),
  })
  .superRefine((env, ctx) => {
    if (env.SMTP_ENABLED && !env.EMAIL_LOG_ONLY) {
      const required = [
        ["SMTP_HOST", env.SMTP_HOST],
        ["SMTP_PORT", String(env.SMTP_PORT)],
        ["SMTP_FROM_EMAIL", env.SMTP_FROM_EMAIL],
      ] as const;

      for (const [key, value] of required) {
        if (!value || !String(value).trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when SMTP is enabled`,
          });
        }
      }
    }
  });

export type ApiEnv = z.infer<typeof envSchema>;

function normalizeEnv(env: NodeJS.ProcessEnv): Record<string, unknown> {
  const appPort = env.APP_PORT ?? env.PORT ?? "8082";
  const apiBaseUrl =
    env.API_BASE_URL ?? env.AUTH_BASE_URL ?? `http://127.0.0.1:${appPort}`;
  const frontendBaseUrl = env.FRONTEND_BASE_URL ?? "http://localhost:8080";

  return {
    APP_NAME: env.APP_NAME ?? "Matcha",
    APP_ENV: env.APP_ENV ?? env.NODE_ENV ?? "development",
    APP_PORT: appPort,
    API_BASE_URL: apiBaseUrl,
    FRONTEND_BASE_URL: frontendBaseUrl,
    AUTH_FRONTEND_REDIRECT_URI:
      env.AUTH_FRONTEND_REDIRECT_URI ?? "matcha://auth-callback",
    AUTH_SESSION_SECRET: env.AUTH_SESSION_SECRET ?? "matcha-dev-secret",
    AUTH_MINIMUM_AGE: env.AUTH_MINIMUM_AGE ?? "18",
    AUTH_ACCESS_TTL_MINUTES: env.AUTH_ACCESS_TTL_MINUTES ?? "15",
    AUTH_REFRESH_TTL_DAYS: env.AUTH_REFRESH_TTL_DAYS ?? "30",
    AUTH_PASSWORD_RESET_TTL_MINUTES:
      env.AUTH_PASSWORD_RESET_TTL_MINUTES ?? "60",
    AUTH_EMAIL_VERIFICATION_TTL_MINUTES:
      env.AUTH_EMAIL_VERIFICATION_TTL_MINUTES ?? "1440",
    AUTH_ONBOARDING_ROLLOUT_AT:
      env.AUTH_ONBOARDING_ROLLOUT_AT ?? "2026-03-26T00:00:00.000Z",
    AUTH_PASSWORD_RESET_URL_BASE:
      env.AUTH_PASSWORD_RESET_URL_BASE ??
      `${frontendBaseUrl.replace(/\/+$/, "")}/reset-password`,
    SMTP_ENABLED: env.SMTP_ENABLED ?? "false",
    EMAIL_LOG_ONLY: env.EMAIL_LOG_ONLY ?? "false",
    SMTP_HOST: env.SMTP_HOST ?? "",
    SMTP_PORT: env.SMTP_PORT ?? "587",
    SMTP_SECURE:
      env.SMTP_SECURE ?? (String(env.SMTP_PORT || "") === "465" ? "true" : "false"),
    SMTP_USER: env.SMTP_USER ?? "",
    SMTP_PASS: env.SMTP_PASS ?? env.SMTP_PASSWORD ?? "",
    SMTP_FROM_EMAIL: env.SMTP_FROM_EMAIL ?? "",
    SMTP_FROM_NAME: env.SMTP_FROM_NAME ?? "",
    SMTP_CONNECTION_TIMEOUT_MS: env.SMTP_CONNECTION_TIMEOUT_MS ?? "10000",
    SMTP_SOCKET_TIMEOUT_MS: env.SMTP_SOCKET_TIMEOUT_MS ?? "20000",
    SMTP_VERIFY_ON_STARTUP: env.SMTP_VERIFY_ON_STARTUP ?? "false",
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID ?? "",
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET ?? "",
    FACEBOOK_CLIENT_ID: env.FACEBOOK_CLIENT_ID ?? "",
    FACEBOOK_CLIENT_SECRET: env.FACEBOOK_CLIENT_SECRET ?? "",
    APPLE_TEAM_ID: env.APPLE_TEAM_ID ?? "",
    APPLE_KEY_ID: env.APPLE_KEY_ID ?? "",
    APPLE_PRIVATE_KEY: env.APPLE_PRIVATE_KEY ?? "",
    APPLE_SERVICE_ID: env.APPLE_SERVICE_ID ?? "",
  };
}

let cachedEnv: ApiEnv | null = null;

export function parseApiEnv(env: NodeJS.ProcessEnv = process.env): ApiEnv {
  return envSchema.parse(normalizeEnv(env));
}

export function getCachedApiEnv(env: NodeJS.ProcessEnv = process.env): ApiEnv {
  if (!cachedEnv) {
    cachedEnv = parseApiEnv(env);
  }
  return cachedEnv;
}

export function validateApiEnv(env: Record<string, unknown>) {
  parseApiEnv(env as NodeJS.ProcessEnv);
  return env;
}

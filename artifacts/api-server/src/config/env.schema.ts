import crypto from "node:crypto";
import { z } from "zod";

function parseUrlOrNull(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isIpLikeHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized) ||
    /^\[[0-9a-f:]+\]$/i.test(normalized)
  );
}

function hasForbiddenPublicPort(url: URL) {
  if (!url.port) {
    return false;
  }
  if (url.protocol === "https:" && url.port === "443") {
    return false;
  }
  if (url.protocol === "http:" && url.port === "80") {
    return false;
  }
  return true;
}

function looksLikePlaceholder(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    !normalized ||
    normalized.startsWith("<") ||
    normalized.includes("change-me") ||
    normalized.includes("example-password") ||
    normalized.includes("placeholder")
  );
}

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

const csvSchema = z
  .string()
  .optional()
  .transform((value) =>
    String(value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );

const envSchema = z
  .object({
    APP_NAME: z.string().trim().min(1).default("Matcha"),
    APP_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_LOG_LEVEL: z
      .enum(["error", "warn", "log", "debug", "verbose"])
      .default("debug"),
    APP_PORT: integerLikeSchema.default(8082),
    API_BASE_URL: z.string().trim().url().default("http://127.0.0.1:8082"),
    DATABASE_URL: z.string().trim().optional(),
    ADMIN_BASE_URL: z.string().trim().url().optional(),
    FRONTEND_BASE_URL: z.string().trim().default("http://localhost:8080"),
    CORS_ALLOWED_ORIGINS: csvSchema.default(""),
    ADMIN_CORS_ALLOWED_ORIGINS: csvSchema.default(""),
    RATE_LIMIT_GENERAL_MAX: integerLikeSchema.default(300),
    RATE_LIMIT_REDIS_ENABLED: booleanLikeSchema.default(false),
    REDIS_URL: z.string().trim().default(""),
    CACHE_ENABLED: booleanLikeSchema.default(false),
    CACHE_DEFAULT_TTL_SECONDS: integerLikeSchema.default(60),
    AUTH_FRONTEND_REDIRECT_URI: z
      .string()
      .trim()
      .default("matcha:///auth-callback"),
    AUTH_SESSION_SECRET: z.string().trim().min(1),
    AUTH_MINIMUM_AGE: integerLikeSchema.default(18),
    AUTH_ACCESS_TTL_MINUTES: integerLikeSchema.default(43200),
    AUTH_REFRESH_TTL_DAYS: integerLikeSchema.default(30),
    AUTH_PASSWORD_RESET_TTL_MINUTES: integerLikeSchema.default(60),
    AUTH_EMAIL_VERIFICATION_TTL_MINUTES: integerLikeSchema.default(1440),
    AUTH_ONBOARDING_ROLLOUT_AT: z
      .string()
      .trim()
      .default("2026-03-26T00:00:00.000Z"),
    AUTH_PASSWORD_RESET_URL_BASE: z.string().trim().optional(),
    ADMIN_DASHBOARD_ENABLED: booleanLikeSchema.default(false),
    ADMIN_BASIC_AUTH_USERNAME: z.string().trim().default(""),
    ADMIN_BASIC_AUTH_PASSWORD: z.string().trim().default(""),
    ADMIN_ALLOWED_CIDRS: csvSchema.default(""),
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

    if (env.APP_ENV === "production") {
      const frontendBaseUrl = parseUrlOrNull(env.FRONTEND_BASE_URL);
      const passwordResetUrlBase = parseUrlOrNull(
        env.AUTH_PASSWORD_RESET_URL_BASE ||
          `${env.FRONTEND_BASE_URL.replace(/\/+$/, "")}/reset-password`
      );

      if (!frontendBaseUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["FRONTEND_BASE_URL"],
          message: "FRONTEND_BASE_URL must be a valid public URL in production",
        });
      } else {
        if (frontendBaseUrl.protocol !== "https:") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["FRONTEND_BASE_URL"],
            message: "FRONTEND_BASE_URL must use https in production",
          });
        }
        if (isIpLikeHostname(frontendBaseUrl.hostname)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["FRONTEND_BASE_URL"],
            message: "FRONTEND_BASE_URL must not point to localhost or an IP host in production",
          });
        }
        if (hasForbiddenPublicPort(frontendBaseUrl)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["FRONTEND_BASE_URL"],
            message: "FRONTEND_BASE_URL must not use a non-standard public port in production",
          });
        }
      }

      if (!passwordResetUrlBase) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_PASSWORD_RESET_URL_BASE"],
          message: "AUTH_PASSWORD_RESET_URL_BASE must be a valid public URL in production",
        });
      } else {
        if (passwordResetUrlBase.protocol !== "https:") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["AUTH_PASSWORD_RESET_URL_BASE"],
            message: "AUTH_PASSWORD_RESET_URL_BASE must use https in production",
          });
        }
        if (isIpLikeHostname(passwordResetUrlBase.hostname)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["AUTH_PASSWORD_RESET_URL_BASE"],
            message:
              "AUTH_PASSWORD_RESET_URL_BASE must not point to localhost or an IP host in production",
          });
        }
        if (hasForbiddenPublicPort(passwordResetUrlBase)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["AUTH_PASSWORD_RESET_URL_BASE"],
            message:
              "AUTH_PASSWORD_RESET_URL_BASE must not use a non-standard public port in production",
          });
        }
        if (
          frontendBaseUrl &&
          passwordResetUrlBase.origin !== frontendBaseUrl.origin
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["AUTH_PASSWORD_RESET_URL_BASE"],
            message:
              "AUTH_PASSWORD_RESET_URL_BASE must share the same public origin as FRONTEND_BASE_URL in production",
          });
        }
        if (passwordResetUrlBase.pathname.replace(/\/+$/, "") !== "/reset-password") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["AUTH_PASSWORD_RESET_URL_BASE"],
            message:
              "AUTH_PASSWORD_RESET_URL_BASE must point to the /reset-password route in production",
          });
        }
      }

      if (
        env.AUTH_SESSION_SECRET === "change-me" ||
        looksLikePlaceholder(env.AUTH_SESSION_SECRET) ||
        env.AUTH_SESSION_SECRET.length < 32
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_SESSION_SECRET"],
          message:
            "AUTH_SESSION_SECRET must be a unique high-entropy value in production",
        });
      }

      if (env.ADMIN_DASHBOARD_ENABLED) {
        if (!env.ADMIN_BASIC_AUTH_USERNAME || !env.ADMIN_BASIC_AUTH_PASSWORD) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["ADMIN_BASIC_AUTH_PASSWORD"],
            message:
              "ADMIN_BASIC_AUTH_USERNAME and ADMIN_BASIC_AUTH_PASSWORD are required when the admin dashboard is enabled",
          });
        }
        if (
          env.ADMIN_BASIC_AUTH_PASSWORD === "change-me-now" ||
          looksLikePlaceholder(env.ADMIN_BASIC_AUTH_PASSWORD) ||
          env.ADMIN_BASIC_AUTH_PASSWORD.length < 16
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["ADMIN_BASIC_AUTH_PASSWORD"],
            message:
              "ADMIN_BASIC_AUTH_PASSWORD must be a unique high-entropy value in production",
          });
        }
        if (!env.ADMIN_ALLOWED_CIDRS.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["ADMIN_ALLOWED_CIDRS"],
            message:
              "ADMIN_ALLOWED_CIDRS is required in production when the admin dashboard is enabled",
          });
        }
      }

      if (!env.DATABASE_URL || looksLikePlaceholder(env.DATABASE_URL)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["DATABASE_URL"],
          message: "DATABASE_URL must be set to a non-placeholder value in production",
        });
      }

      if (env.SMTP_ENABLED && !env.EMAIL_LOG_ONLY && looksLikePlaceholder(env.SMTP_PASS)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SMTP_PASS"],
          message: "SMTP_PASS must be a non-placeholder value when SMTP is enabled in production",
        });
      }
    }
  });

export type ApiEnv = z.infer<typeof envSchema>;

function normalizeEnv(env: NodeJS.ProcessEnv): Record<string, unknown> {
  const appEnv = env.APP_ENV ?? env.NODE_ENV ?? "development";
  const appPort = env.APP_PORT ?? env.PORT ?? "8082";
  const apiBaseUrl =
    env.API_BASE_URL ?? env.AUTH_BASE_URL ?? `http://127.0.0.1:${appPort}`;
  const frontendBaseUrl = env.FRONTEND_BASE_URL ?? "http://localhost:8080";

  return {
    APP_NAME: env.APP_NAME ?? "Matcha",
    APP_ENV: appEnv,
    APP_LOG_LEVEL:
      env.APP_LOG_LEVEL ?? (appEnv === "production" ? "warn" : "debug"),
    APP_PORT: appPort,
    API_BASE_URL: apiBaseUrl,
    DATABASE_URL: env.DATABASE_URL ?? "",
    ADMIN_BASE_URL: env.ADMIN_BASE_URL ?? "",
    FRONTEND_BASE_URL: frontendBaseUrl,
    CORS_ALLOWED_ORIGINS: env.CORS_ALLOWED_ORIGINS ?? "",
    ADMIN_CORS_ALLOWED_ORIGINS: env.ADMIN_CORS_ALLOWED_ORIGINS ?? "",
    RATE_LIMIT_GENERAL_MAX: env.RATE_LIMIT_GENERAL_MAX ?? "300",
    RATE_LIMIT_REDIS_ENABLED:
      env.RATE_LIMIT_REDIS_ENABLED ?? (env.REDIS_URL ? "true" : "false"),
    REDIS_URL: env.REDIS_URL ?? "",
    CACHE_ENABLED: env.CACHE_ENABLED ?? (env.REDIS_URL ? "true" : "false"),
    CACHE_DEFAULT_TTL_SECONDS: env.CACHE_DEFAULT_TTL_SECONDS ?? "60",
    AUTH_FRONTEND_REDIRECT_URI:
      env.AUTH_FRONTEND_REDIRECT_URI ?? "matcha:///auth-callback",
    AUTH_SESSION_SECRET:
      env.AUTH_SESSION_SECRET ??
      (appEnv === "production" ? "" : crypto.randomBytes(32).toString("hex")),
    AUTH_MINIMUM_AGE: env.AUTH_MINIMUM_AGE ?? "18",
    AUTH_ACCESS_TTL_MINUTES: env.AUTH_ACCESS_TTL_MINUTES ?? "43200",
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
    ADMIN_DASHBOARD_ENABLED: env.ADMIN_DASHBOARD_ENABLED ?? "false",
    ADMIN_BASIC_AUTH_USERNAME: env.ADMIN_BASIC_AUTH_USERNAME ?? "",
    ADMIN_BASIC_AUTH_PASSWORD: env.ADMIN_BASIC_AUTH_PASSWORD ?? "",
    ADMIN_ALLOWED_CIDRS: env.ADMIN_ALLOWED_CIDRS ?? "",
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

import { getCachedApiEnv } from "./env.schema";

const env = getCachedApiEnv();

export const runtimeConfig = {
  appName: env.APP_NAME,
  port: env.APP_PORT,
  nodeEnv: env.APP_ENV,
  logLevel: env.APP_LOG_LEVEL,
  sessionSecret: env.AUTH_SESSION_SECRET,
  baseUrl: env.API_BASE_URL,
  adminBaseUrl: env.ADMIN_BASE_URL || "",
  frontendBaseUrl: env.FRONTEND_BASE_URL,
  cors: {
    allowedOrigins: env.CORS_ALLOWED_ORIGINS,
    adminAllowedOrigins: env.ADMIN_CORS_ALLOWED_ORIGINS,
  },
  rateLimit: {
    generalMax: env.RATE_LIMIT_GENERAL_MAX,
    redisEnabled: env.RATE_LIMIT_REDIS_ENABLED,
    redisUrl: env.REDIS_URL,
  },
  frontendRedirectUri: env.AUTH_FRONTEND_REDIRECT_URI,
  minimumAge: env.AUTH_MINIMUM_AGE,
  accessTtlMinutes: env.AUTH_ACCESS_TTL_MINUTES,
  refreshTtlDays: env.AUTH_REFRESH_TTL_DAYS,
  passwordResetTtlMinutes: env.AUTH_PASSWORD_RESET_TTL_MINUTES,
  emailVerificationTtlMinutes: env.AUTH_EMAIL_VERIFICATION_TTL_MINUTES,
  onboardingRolloutAt: env.AUTH_ONBOARDING_ROLLOUT_AT,
  passwordResetUrlBase: env.AUTH_PASSWORD_RESET_URL_BASE,
  admin: {
    enabled: env.ADMIN_DASHBOARD_ENABLED,
    username: env.ADMIN_BASIC_AUTH_USERNAME,
    password: env.ADMIN_BASIC_AUTH_PASSWORD,
    allowedCidrs: env.ADMIN_ALLOWED_CIDRS,
    baseUrl: env.ADMIN_BASE_URL || "",
  },
  email: {
    enabled: env.SMTP_ENABLED,
    logOnly: env.EMAIL_LOG_ONLY,
    verifyOnStartup: env.SMTP_VERIFY_ON_STARTUP,
    fromEmail: env.SMTP_FROM_EMAIL,
    fromName: env.SMTP_FROM_NAME,
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      connectionTimeoutMs: env.SMTP_CONNECTION_TIMEOUT_MS,
      socketTimeoutMs: env.SMTP_SOCKET_TIMEOUT_MS,
    },
  },
  providers: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      scopes: ["openid", "email", "profile"],
    },
    facebook: {
      clientId: env.FACEBOOK_CLIENT_ID,
      clientSecret: env.FACEBOOK_CLIENT_SECRET,
      scopes: ["email", "public_profile"],
    },
    apple: {
      teamId: env.APPLE_TEAM_ID,
      keyId: env.APPLE_KEY_ID,
      privateKey: env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      serviceId: env.APPLE_SERVICE_ID,
      scopes: ["name", "email"],
    },
  },
};

export function isProviderConfigured(provider: "google" | "facebook" | "apple") {
  if (provider === "google") {
    const { clientId, clientSecret } = runtimeConfig.providers.google;
    return Boolean(clientId && clientSecret);
  }
  if (provider === "facebook") {
    const { clientId, clientSecret } = runtimeConfig.providers.facebook;
    return Boolean(clientId && clientSecret);
  }
  const { teamId, keyId, privateKey, serviceId } = runtimeConfig.providers.apple;
  return Boolean(teamId && keyId && privateKey && serviceId);
}

export function getProviderRedirectUri(provider: "google" | "facebook" | "apple") {
  return `${runtimeConfig.baseUrl}/api/auth/social/callback/${provider}`;
}

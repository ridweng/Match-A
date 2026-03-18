function numberFromEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: numberFromEnv("PORT", 8082),
  nodeEnv: process.env.NODE_ENV || "development",
  sessionSecret: process.env.AUTH_SESSION_SECRET || "matcha-dev-secret",
  baseUrl: process.env.AUTH_BASE_URL || "http://localhost:8082",
  frontendRedirectUri:
    process.env.AUTH_FRONTEND_REDIRECT_URI || "matcha://auth-callback",
  minimumAge: numberFromEnv("AUTH_MINIMUM_AGE", 18),
  fileStorePath:
    process.env.AUTH_FILE_STORE_PATH || new URL("../data/auth-dev.json", import.meta.url),
  mysql: {
    url: process.env.MYSQL_URL || "",
    host: process.env.MYSQL_HOST || "",
    port: numberFromEnv("MYSQL_PORT", 3306),
    user: process.env.MYSQL_USER || "",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "",
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: numberFromEnv("SMTP_PORT", 587),
    user: process.env.SMTP_USER || "",
    password: process.env.SMTP_PASSWORD || "",
    from: process.env.SMTP_FROM || "MatchA <no-reply@matcha.local>",
  },
  providers: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      scopes: ["openid", "email", "profile"],
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID || "",
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || "",
      scopes: ["email", "public_profile"],
    },
    apple: {
      teamId: process.env.APPLE_TEAM_ID || "",
      keyId: process.env.APPLE_KEY_ID || "",
      privateKey: (process.env.APPLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      serviceId: process.env.APPLE_SERVICE_ID || "",
      scopes: ["name", "email"],
    },
  },
};

export function isProviderConfigured(provider) {
  if (provider === "google") {
    const { clientId, clientSecret } = config.providers.google;
    return Boolean(clientId && clientSecret);
  }
  if (provider === "facebook") {
    const { clientId, clientSecret } = config.providers.facebook;
    return Boolean(clientId && clientSecret);
  }
  if (provider === "apple") {
    const { teamId, keyId, privateKey, serviceId } = config.providers.apple;
    return Boolean(teamId && keyId && privateKey && serviceId);
  }
  return false;
}

export function getProviderRedirectUri(provider) {
  return `${config.baseUrl}/api/auth/social/callback/${provider}`;
}

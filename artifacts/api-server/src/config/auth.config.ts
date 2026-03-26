import { registerAs } from "@nestjs/config";
import { getCachedApiEnv } from "./env.schema";

export const authConfig = registerAs("auth", () => {
  const env = getCachedApiEnv();

  return {
    sessionSecret: env.AUTH_SESSION_SECRET,
    minimumAge: env.AUTH_MINIMUM_AGE,
    accessTtlMinutes: env.AUTH_ACCESS_TTL_MINUTES,
    refreshTtlDays: env.AUTH_REFRESH_TTL_DAYS,
    passwordResetTtlMinutes: env.AUTH_PASSWORD_RESET_TTL_MINUTES,
    emailVerificationTtlMinutes: env.AUTH_EMAIL_VERIFICATION_TTL_MINUTES,
    onboardingRolloutAt: env.AUTH_ONBOARDING_ROLLOUT_AT,
    passwordResetUrlBase: env.AUTH_PASSWORD_RESET_URL_BASE,
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
});

import { registerAs } from "@nestjs/config";
import { getCachedApiEnv } from "./env.schema";

export const appConfig = registerAs("app", () => {
  const env = getCachedApiEnv();

  return {
    name: env.APP_NAME,
    env: env.APP_ENV,
    port: env.APP_PORT,
    apiBaseUrl: env.API_BASE_URL,
    frontendBaseUrl: env.FRONTEND_BASE_URL,
    frontendRedirectUri: env.AUTH_FRONTEND_REDIRECT_URI,
  };
});

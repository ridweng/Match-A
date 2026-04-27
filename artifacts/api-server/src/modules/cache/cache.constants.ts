export const CACHE_NAMESPACE = "matcha:v1";

export const CACHE_TTL_SECONDS = {
  viewerBootstrap: 60,
  viewerProfile: 300,
  discoveryPreferences: 60,
  goals: 180,
  mediaMetadata: 300,
  adminMetrics: 20,
} as const;

export const CACHE_FALLBACK_COOLDOWN_MS = 30_000;

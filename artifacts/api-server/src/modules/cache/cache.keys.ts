import crypto from "node:crypto";
import { CACHE_NAMESPACE } from "./cache.constants";

type CacheKeyPart = string | number | boolean | null | undefined;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

function normalizePart(part: CacheKeyPart) {
  return String(part ?? "none")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "none";
}

export function cacheHash(value: unknown) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex")
    .slice(0, 24);
}

export function cacheKey(...parts: CacheKeyPart[]) {
  return [CACHE_NAMESPACE, ...parts.map(normalizePart)].join(":");
}

export function cachePrefix(...parts: CacheKeyPart[]) {
  return `${cacheKey(...parts)}:`;
}

export const cacheKeys = {
  viewerBootstrap(userId: number) {
    return cacheKey("viewer", "bootstrap", "user", userId);
  },
  viewerProfile(userId: number) {
    return cacheKey("viewer", "profile", "user", userId);
  },
  goals(userId: number) {
    return cacheKey("goals", "user", userId);
  },
  discoveryPreferences(userId: number) {
    return cacheKey("discovery", "preferences", "user", userId);
  },
  adminOverview(filters: unknown) {
    return cacheKey("admin", "overview", cacheHash(filters));
  },
  adminDatabaseView() {
    return cacheKey("admin", "database-view");
  },
  adminUsers(filters: unknown) {
    return cacheKey("admin", "users", cacheHash(filters));
  },
  adminGeneratedBatches() {
    return cacheKey("admin", "generated-batches");
  },
  adminUserFilterOptions() {
    return cacheKey("admin", "user-filter-options");
  },
  adminPrefix() {
    return cachePrefix("admin");
  },
};

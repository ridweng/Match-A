import { Logger } from "@nestjs/common";
import { CacheService } from "./cache.service";

type CacheLoadOptions<T> = {
  cacheService?: CacheService;
  logger: Logger;
  scope: string;
  key: string;
  ttlSeconds: number;
  loader: () => Promise<T>;
};

type CacheInvalidateOptions = {
  cacheService?: CacheService;
  logger: Logger;
  scope: string;
  description: string;
  invalidate: (cacheService: CacheService) => Promise<void>;
};

export async function getOrComputeWithCache<T>({
  cacheService,
  logger,
  scope,
  key,
  ttlSeconds,
  loader,
}: CacheLoadOptions<T>): Promise<T> {
  if (!cacheService) {
    logger.warn(
      `[${scope}] unavailable ${JSON.stringify({ key, reason: "provider_missing" })}`
    );
    return loader();
  }

  try {
    return await cacheService.getOrSet(key, ttlSeconds, loader);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logger.warn(
      `[${scope}] fallback ${JSON.stringify({ key, reason: "cache_error", message })}`
    );
    return loader();
  }
}

export async function invalidateWithCache({
  cacheService,
  logger,
  scope,
  description,
  invalidate,
}: CacheInvalidateOptions): Promise<void> {
  if (!cacheService) {
    logger.warn(
      `[${scope}] unavailable ${JSON.stringify({ description, reason: "provider_missing" })}`
    );
    return;
  }

  try {
    await invalidate(cacheService);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logger.warn(
      `[${scope}] invalidate_failed ${JSON.stringify({ description, message })}`
    );
  }
}

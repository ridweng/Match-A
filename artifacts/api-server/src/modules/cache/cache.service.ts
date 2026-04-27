import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { createClient, type RedisClientType } from "redis";
import { getCachedApiEnv } from "../../config/env.schema";
import { CACHE_FALLBACK_COOLDOWN_MS } from "./cache.constants";

type CacheStatus = {
  enabled: boolean;
  configured: boolean;
  connected: boolean;
  degraded: boolean;
  fallbackActive: boolean;
};

type CacheRuntimeConfig = {
  enabled: boolean;
  redisUrl: string;
  defaultTtlSeconds: number;
};

type RedisLikeClient = Pick<RedisClientType, "get" | "setEx" | "del" | "quit"> & {
  connect?: () => Promise<unknown>;
  isOpen?: boolean;
  scanIterator?: (options: { MATCH: string; COUNT: number }) => AsyncIterable<string | string[]>;
};

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: RedisLikeClient | null = null;
  private connectPromise: Promise<RedisLikeClient | null> | null = null;
  private unavailableUntil = 0;
  private fallbackWarningLoggedAt = 0;
  private configOverride: CacheRuntimeConfig | null = null;

  configureForTesting(config: CacheRuntimeConfig, client?: RedisLikeClient | null) {
    this.configOverride = config;
    this.client = client ?? null;
    this.connectPromise = null;
    this.unavailableUntil = 0;
    this.fallbackWarningLoggedAt = 0;
  }

  private getConfig(): CacheRuntimeConfig {
    if (this.configOverride) {
      return this.configOverride;
    }
    const env = getCachedApiEnv();
    return {
      enabled: env.CACHE_ENABLED,
      redisUrl: env.REDIS_URL || "",
      defaultTtlSeconds: env.CACHE_DEFAULT_TTL_SECONDS,
    };
  }

  getStatus(): CacheStatus {
    const config = this.getConfig();
    const connected = Boolean(this.client?.isOpen);
    const unavailable = Date.now() < this.unavailableUntil;
    return {
      enabled: config.enabled,
      configured: Boolean(config.redisUrl),
      connected,
      degraded: config.enabled && Boolean(config.redisUrl) && unavailable,
      fallbackActive:
        !config.enabled ||
        !config.redisUrl ||
        unavailable,
    };
  }

  async onModuleDestroy() {
    if (!this.client) {
      return;
    }
    await this.client.quit().catch(() => undefined);
    this.client = null;
  }

  private logFallback(reason: string, error?: unknown) {
    const now = Date.now();
    if (now - this.fallbackWarningLoggedAt < CACHE_FALLBACK_COOLDOWN_MS) {
      return;
    }
    this.fallbackWarningLoggedAt = now;
    const message = error instanceof Error ? error.message : undefined;
    this.logger.warn(
      `[cache] fallback ${JSON.stringify({ reason, message: message || null })}`
    );
  }

  private async getClient(): Promise<RedisLikeClient | null> {
    const config = this.getConfig();
    if (!config.enabled || !config.redisUrl) {
      return null;
    }
    if (Date.now() < this.unavailableUntil) {
      return null;
    }
    if (this.client?.isOpen) {
      return this.client;
    }
    if (this.client && this.configOverride) {
      return this.client;
    }
    if (!this.connectPromise) {
      this.connectPromise = (async () => {
        const client = createClient({ url: config.redisUrl }) as RedisLikeClient;
        try {
          await client.connect?.();
          this.logger.log("[cache] redis connected");
          this.client = client;
          return client;
        } catch (error) {
          this.unavailableUntil = Date.now() + CACHE_FALLBACK_COOLDOWN_MS;
          this.logFallback("redis_unavailable", error);
          await client.quit().catch(() => undefined);
          this.client = null;
          return null;
        } finally {
          this.connectPromise = null;
        }
      })();
    }
    return this.connectPromise;
  }

  async get<T>(key: string): Promise<T | null> {
    const client = await this.getClient();
    if (!client) {
      this.logger.debug(`[cache] bypass ${JSON.stringify({ key })}`);
      return null;
    }

    try {
      const value = await client.get(key);
      if (value == null) {
        this.logger.debug(`[cache] miss ${JSON.stringify({ key })}`);
        return null;
      }
      this.logger.debug(`[cache] hit ${JSON.stringify({ key })}`);
      return JSON.parse(value) as T;
    } catch (error) {
      this.unavailableUntil = Date.now() + CACHE_FALLBACK_COOLDOWN_MS;
      this.logFallback("get_failed", error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    const ttl = Math.max(1, Math.floor(ttlSeconds || this.getConfig().defaultTtlSeconds));
    try {
      await client.setEx(key, ttl, JSON.stringify(value));
      this.logger.debug(`[cache] set ${JSON.stringify({ key, ttlSeconds: ttl })}`);
    } catch (error) {
      this.unavailableUntil = Date.now() + CACHE_FALLBACK_COOLDOWN_MS;
      this.logFallback("set_failed", error);
    }
  }

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const loaded = await loader();
    await this.set(key, loaded, ttlSeconds);
    return loaded;
  }

  async delete(key: string): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      return;
    }
    try {
      await client.del(key);
      this.logger.debug(`[cache] invalidation ${JSON.stringify({ key })}`);
    } catch (error) {
      this.unavailableUntil = Date.now() + CACHE_FALLBACK_COOLDOWN_MS;
      this.logFallback("delete_failed", error);
    }
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    try {
      const keys: string[] = [];
      if (client.scanIterator) {
        for await (const entry of client.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
          if (Array.isArray(entry)) {
            keys.push(...entry);
          } else {
            keys.push(entry);
          }
        }
      }
      if (keys.length > 0) {
        await client.del(keys as never);
      }
      this.logger.debug(
        `[cache] invalidation ${JSON.stringify({ prefix, keyCount: keys.length })}`
      );
    } catch (error) {
      this.unavailableUntil = Date.now() + CACHE_FALLBACK_COOLDOWN_MS;
      this.logFallback("delete_by_prefix_failed", error);
    }
  }
}

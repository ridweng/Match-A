import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { createClient, type RedisClientType } from "redis";
import { pool } from "@workspace/db";
import { getCachedApiEnv } from "../config/env.schema";
import { CACHE_FALLBACK_COOLDOWN_MS, CACHE_NAMESPACE } from "../modules/cache/cache.constants";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
  keyGenerator?: (req: Request) => string;
  limiterName?: string;
  keyType?: "ip" | "route-ip" | "identifier";
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

type RateLimitCounterRow = {
  key: string;
  count: number;
  reset_at: string | Date;
};

export type RateLimitKeyDescriptor = {
  limiterName: string;
  keyType: "ip" | "route-ip" | "identifier";
  storageKey: string;
  redisKey: string;
  route?: string;
  routePath?: string;
  method?: string;
  rawValueDescription: string;
};

export type RateLimitCounterSnapshot = {
  source: "database" | "redis";
  key: string;
  count: number;
  resetAt: string | null;
  ttlMs: number | null;
};

const AUTH_ROUTE_PATHS = {
  "sign-in": "/api/auth/sign-in",
  "sign-up": "/api/auth/sign-up",
  refresh: "/api/auth/refresh",
  "password-reset/request": "/api/auth/password-reset/request",
  "password-reset/confirm": "/api/auth/password-reset/confirm",
  "verify-email/resend": "/api/auth/verify-email/resend",
} as const;

type AuthRateLimitedRoute = keyof typeof AUTH_ROUTE_PATHS;

export interface RateLimiterBackend {
  consume(key: string, options: { windowMs: number; max: number }): Promise<RateLimitResult>;
}

export class DatabaseRateLimiter implements RateLimiterBackend {
  async consume(key: string, options: { windowMs: number; max: number }): Promise<RateLimitResult> {
    const resetAt = new Date(Date.now() + options.windowMs);
    const result = await pool.query<RateLimitCounterRow>(
      `INSERT INTO security.rate_limit_counters (key, count, reset_at, created_at, updated_at)
       VALUES ($1, 1, $2, NOW(), NOW())
       ON CONFLICT (key) DO UPDATE SET
         count = CASE
           WHEN security.rate_limit_counters.reset_at <= NOW() THEN 1
           ELSE security.rate_limit_counters.count + 1
         END,
         reset_at = CASE
           WHEN security.rate_limit_counters.reset_at <= NOW() THEN EXCLUDED.reset_at
           ELSE security.rate_limit_counters.reset_at
         END,
         updated_at = NOW()
       RETURNING key, count, reset_at`,
      [key, resetAt.toISOString()]
    );
    const row = result.rows[0]!;
    const actualResetAt = new Date(row.reset_at).getTime();
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((actualResetAt - Date.now()) / 1000)
    );

    return {
      allowed: row.count <= options.max,
      limit: options.max,
      remaining: Math.max(options.max - row.count, 0),
      resetAt: actualResetAt,
      retryAfterSeconds,
    };
  }

  async prune() {
    await pool.query(
      `DELETE FROM security.rate_limit_counters
       WHERE reset_at < NOW() - INTERVAL '1 hour'`
    );
  }
}

type RedisRateLimitClient = Pick<RedisClientType, "quit"> & {
  isOpen?: boolean;
  connect?: () => Promise<unknown>;
  eval?: (script: string, options: { keys: string[]; arguments: string[] }) => Promise<unknown>;
};

type RedisAdminClient = {
  connect: () => Promise<unknown>;
  quit: () => Promise<unknown>;
  get: (key: string) => Promise<string | null>;
  pTTL: (key: string) => Promise<number>;
  del: (keys: string[] | string) => Promise<number>;
};

const RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`;

export class RedisRateLimiter implements RateLimiterBackend {
  private client: RedisRateLimitClient | null = null;
  private connectPromise: Promise<RedisRateLimitClient | null> | null = null;
  private unavailableUntil = 0;
  private warningLoggedAt = 0;

  constructor(
    private readonly options: {
      redisUrl: string;
      enabled: boolean;
      fallback: RateLimiterBackend;
      client?: RedisRateLimitClient | null;
    }
  ) {
    if (options.client) {
      this.client = options.client;
    }
  }

  private logFallback(reason: string, error?: unknown) {
    const now = Date.now();
    if (now - this.warningLoggedAt < CACHE_FALLBACK_COOLDOWN_MS) {
      return;
    }
    this.warningLoggedAt = now;
    const message = error instanceof Error ? error.message : undefined;
    console.warn(
      `[rate-limit] fallback ${JSON.stringify({ reason, message: message || null })}`
    );
  }

  private async getClient() {
    if (!this.options.enabled || !this.options.redisUrl) {
      return null;
    }
    if (Date.now() < this.unavailableUntil) {
      return null;
    }
    if (this.client?.isOpen) {
      return this.client;
    }
    if (this.client && this.options.client) {
      return this.client;
    }
    if (!this.connectPromise) {
      this.connectPromise = (async () => {
        const client = createClient({ url: this.options.redisUrl }) as RedisRateLimitClient;
        try {
          await client.connect?.();
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

  async consume(key: string, options: { windowMs: number; max: number }) {
    const client = await this.getClient();
    if (!client?.eval) {
      return this.options.fallback.consume(key, options);
    }

    try {
      const redisKey = `${CACHE_NAMESPACE}:rate-limit:${key}`;
      const result = (await client.eval(RATE_LIMIT_SCRIPT, {
        keys: [redisKey],
        arguments: [String(options.windowMs)],
      })) as [number | string, number | string];
      const count = Number(result?.[0] || 0);
      const ttlMs = Number(result?.[1] || options.windowMs);
      const resetAt = Date.now() + Math.max(ttlMs, 1);
      const retryAfterSeconds = Math.max(1, Math.ceil(Math.max(ttlMs, 1) / 1000));

      return {
        allowed: count <= options.max,
        limit: options.max,
        remaining: Math.max(options.max - count, 0),
        resetAt,
        retryAfterSeconds,
      };
    } catch (error) {
      this.unavailableUntil = Date.now() + CACHE_FALLBACK_COOLDOWN_MS;
      this.logFallback("redis_consume_failed", error);
      return this.options.fallback.consume(key, options);
    }
  }
}

function createRateLimiter() {
  const dbLimiter = new DatabaseRateLimiter();
  const env = getCachedApiEnv();
  return new RedisRateLimiter({
    enabled: env.RATE_LIMIT_REDIS_ENABLED,
    redisUrl: env.REDIS_URL,
    fallback: dbLimiter,
  });
}

let sharedLimiter: RateLimiterBackend | null = null;
let identifierLimiter: RateLimiterBackend | null = null;
const pruneLimiter = new DatabaseRateLimiter();

function getSharedLimiter() {
  sharedLimiter ||= createRateLimiter();
  return sharedLimiter;
}

function getIdentifierLimiter() {
  identifierLimiter ||= createRateLimiter();
  return identifierLimiter;
}

setInterval(() => {
  void pruneLimiter.prune().catch(() => undefined);
}, 5 * 60 * 1000).unref();

export class RateLimitExceededError extends Error {
  constructor(
    readonly details: {
      retryAfterSeconds: number;
      limiterName: string;
      keyType: "ip" | "route-ip" | "identifier";
      key: string;
      requestPath?: string;
      requestMethod?: string;
      requestIp?: string;
    }
  ) {
    super("RATE_LIMITED");
  }
}

export function getClientIp(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function getRequestPath(req: Request) {
  return req.originalUrl?.split("?")[0] || req.baseUrl || req.path;
}

function hashRateLimitValue(value: string) {
  return crypto
    .createHash("sha256")
    .update(String(value || "").trim().toLowerCase())
    .digest("hex");
}

function buildStorageKey(keyPrefix: string, rawValue: string) {
  return `${keyPrefix}:${hashRateLimitValue(rawValue)}`;
}

function toRedisStorageKey(storageKey: string) {
  return `${CACHE_NAMESPACE}:rate-limit:${storageKey}`;
}

function resolveAuthRoutePath(route: string) {
  if (route in AUTH_ROUTE_PATHS) {
    return AUTH_ROUTE_PATHS[route as AuthRateLimitedRoute];
  }
  return route.startsWith("/") ? route : `/api/auth/${route}`;
}

export function describeGeneralRateLimitKey(ip: string): RateLimitKeyDescriptor {
  const storageKey = buildStorageKey("api-general", ip);
  return {
    limiterName: "api-general",
    keyType: "ip",
    storageKey,
    redisKey: toRedisStorageKey(storageKey),
    rawValueDescription: `ip=${ip}`,
  };
}

export function describeStrictAuthRateLimitKey(input: {
  route: string;
  ip: string;
  method?: string;
}): RateLimitKeyDescriptor {
  const routePath = resolveAuthRoutePath(input.route);
  const method = (input.method || "POST").toUpperCase();
  const rawValue = `${method}:${routePath}:${input.ip}`;
  const storageKey = buildStorageKey("api-auth-strict", rawValue);
  return {
    limiterName: "api-auth-strict",
    keyType: "route-ip",
    storageKey,
    redisKey: toRedisStorageKey(storageKey),
    route: input.route,
    routePath,
    method,
    rawValueDescription: `method=${method} route=${routePath} ip=${input.ip}`,
  };
}

export function describeIdentifierRateLimitKey(input: {
  route: string;
  identifier: string;
}): RateLimitKeyDescriptor {
  const storageKey = `identifier:${input.route}:${hashRateLimitValue(input.identifier)}`;
  return {
    limiterName: "auth-identifier",
    keyType: "identifier",
    storageKey,
    redisKey: toRedisStorageKey(storageKey),
    route: input.route,
    rawValueDescription: `route=${input.route} identifier=${String(input.identifier).trim().toLowerCase()}`,
  };
}

export function collectRateLimitKeyDescriptors(input: {
  route?: string;
  email?: string;
  ip?: string;
  includeGeneral?: boolean;
  includeStrict?: boolean;
  includeIdentifier?: boolean;
}) {
  const descriptors: RateLimitKeyDescriptor[] = [];
  const route = input.route || "sign-up";
  const includeGeneral = input.includeGeneral ?? Boolean(input.ip);
  const includeStrict = input.includeStrict ?? Boolean(input.ip && route);
  const includeIdentifier = input.includeIdentifier ?? Boolean(input.email && route);

  if (input.ip && includeGeneral) {
    descriptors.push(describeGeneralRateLimitKey(input.ip));
  }
  if (input.ip && includeStrict) {
    descriptors.push(
      describeStrictAuthRateLimitKey({
        route,
        ip: input.ip,
      })
    );
  }
  if (input.email && includeIdentifier) {
    descriptors.push(
      describeIdentifierRateLimitKey({
        route,
        identifier: input.email,
      })
    );
  }

  return descriptors;
}

function getRedisConfig() {
  const env = getCachedApiEnv();
  return {
    enabled: env.RATE_LIMIT_REDIS_ENABLED && Boolean(env.REDIS_URL),
    redisUrl: env.REDIS_URL,
  };
}

async function withRedisClient<T>(
  callback: (client: RedisAdminClient) => Promise<T>
): Promise<T | null> {
  const config = getRedisConfig();
  if (!config.enabled || !config.redisUrl) {
    return null;
  }

  const client = createClient({ url: config.redisUrl }) as unknown as RedisAdminClient;
  try {
    await client.connect();
    return await callback(client);
  } finally {
    await client.quit().catch(() => undefined);
  }
}

function mapDatabaseRows(rows: RateLimitCounterRow[]): RateLimitCounterSnapshot[] {
  const now = Date.now();
  return rows.map((row) => {
    const resetAtMs = new Date(row.reset_at).getTime();
    return {
      source: "database",
      key: row.key,
      count: row.count,
      resetAt: new Date(resetAtMs).toISOString(),
      ttlMs: Math.max(resetAtMs - now, 0),
    };
  });
}

async function getDatabaseSnapshots(storageKeys: string[]) {
  if (!storageKeys.length) {
    return [] as RateLimitCounterSnapshot[];
  }
  const result = await pool.query<RateLimitCounterRow>(
    `SELECT key, count, reset_at
     FROM security.rate_limit_counters
     WHERE key = ANY($1::text[])`,
    [storageKeys]
  );
  return mapDatabaseRows(result.rows);
}

async function deleteDatabaseSnapshots(storageKeys: string[]) {
  if (!storageKeys.length) {
    return [] as RateLimitCounterSnapshot[];
  }
  const result = await pool.query<RateLimitCounterRow>(
    `DELETE FROM security.rate_limit_counters
     WHERE key = ANY($1::text[])
     RETURNING key, count, reset_at`,
    [storageKeys]
  );
  return mapDatabaseRows(result.rows);
}

async function getRedisSnapshots(descriptors: RateLimitKeyDescriptor[]) {
  const result = await withRedisClient(async (client) => {
    const snapshots: RateLimitCounterSnapshot[] = [];
    for (const descriptor of descriptors) {
      const value = await client.get(descriptor.redisKey);
      if (value === null) {
        continue;
      }
      const ttlMs = await client.pTTL(descriptor.redisKey);
      snapshots.push({
        source: "redis",
        key: descriptor.redisKey,
        count: Number(value),
        resetAt: ttlMs > 0 ? new Date(Date.now() + ttlMs).toISOString() : null,
        ttlMs: ttlMs >= 0 ? ttlMs : null,
      });
    }
    return snapshots;
  });
  return result || [];
}

async function deleteRedisSnapshots(descriptors: RateLimitKeyDescriptor[]) {
  const result = await withRedisClient(async (client) => {
    const existing: RateLimitCounterSnapshot[] = [];
    for (const descriptor of descriptors) {
      const value = await client.get(descriptor.redisKey);
      if (value === null) {
        continue;
      }
      const ttlMs = await client.pTTL(descriptor.redisKey);
      existing.push({
        source: "redis",
        key: descriptor.redisKey,
        count: Number(value),
        resetAt: ttlMs > 0 ? new Date(Date.now() + ttlMs).toISOString() : null,
        ttlMs: ttlMs >= 0 ? ttlMs : null,
      });
    }
    if (!existing.length) {
      return [] as RateLimitCounterSnapshot[];
    }
    await client.del(existing.map((entry) => entry.key));
    return existing;
  });
  return result || [];
}

export async function inspectRateLimitKeys(descriptors: RateLimitKeyDescriptor[]) {
  const [database, redis] = await Promise.all([
    getDatabaseSnapshots(descriptors.map((descriptor) => descriptor.storageKey)),
    getRedisSnapshots(descriptors),
  ]);
  return [...database, ...redis];
}

export async function clearRateLimitKeys(descriptors: RateLimitKeyDescriptor[]) {
  const [database, redis] = await Promise.all([
    deleteDatabaseSnapshots(descriptors.map((descriptor) => descriptor.storageKey)),
    deleteRedisSnapshots(descriptors),
  ]);
  return [...database, ...redis];
}

export function logRateLimitHit(details: {
  limiterName: string;
  keyType: "ip" | "route-ip" | "identifier";
  storageKey: string;
  retryAfterSeconds: number;
  requestPath?: string;
  requestMethod?: string;
  requestIp?: string;
}) {
  console.warn(
    `[rate-limit-block] ${JSON.stringify({
      limiterName: details.limiterName,
      keyType: details.keyType,
      storageKey: details.storageKey,
      retryAfterSeconds: details.retryAfterSeconds,
      path: details.requestPath || null,
      method: details.requestMethod || null,
      ip: details.requestIp || null,
    })}`
  );
}

function setRateLimitHeaders(
  res: Response,
  result: RateLimitResult
) {
  res.setHeader("RateLimit-Limit", String(result.limit));
  res.setHeader("RateLimit-Remaining", String(result.remaining));
  res.setHeader("RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
  if (!result.allowed) {
    res.setHeader("Retry-After", String(result.retryAfterSeconds));
  }
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const rawKey = options.keyGenerator?.(req) || getClientIp(req);
    const key = buildStorageKey(options.keyPrefix, rawKey);
    try {
      const result = await getSharedLimiter().consume(key, options);
      setRateLimitHeaders(res, result);

      if (!result.allowed) {
        logRateLimitHit({
          limiterName: options.limiterName || options.keyPrefix,
          keyType: options.keyType || "ip",
          storageKey: key,
          retryAfterSeconds: result.retryAfterSeconds,
          requestPath: getRequestPath(req),
          requestMethod: req.method,
          requestIp: getClientIp(req),
        });
        return res.status(429).json({
          error: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please try again later.",
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export async function assertIdentifierRateLimit(input: {
  route: string;
  identifier: string;
  windowMs: number;
  max: number;
}) {
  const descriptor = describeIdentifierRateLimitKey({
    route: input.route,
    identifier: input.identifier,
  });
  const result = await getIdentifierLimiter().consume(descriptor.storageKey, {
    windowMs: input.windowMs,
    max: input.max,
  });

  if (!result.allowed) {
    throw new RateLimitExceededError({
      retryAfterSeconds: result.retryAfterSeconds,
      limiterName: descriptor.limiterName,
      keyType: descriptor.keyType,
      key: descriptor.storageKey,
    });
  }
}

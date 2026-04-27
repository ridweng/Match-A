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
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

type RateLimitCounterRow = {
  count: number;
  reset_at: string | Date;
};

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
       RETURNING count, reset_at`,
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
  constructor(readonly retryAfterSeconds: number) {
    super("RATE_LIMITED");
  }
}

export function getClientIp(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function hashRateLimitValue(value: string) {
  return crypto
    .createHash("sha256")
    .update(String(value || "").trim().toLowerCase())
    .digest("hex");
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
    const key = `${options.keyPrefix}:${hashRateLimitValue(rawKey)}`;
    try {
      const result = await getSharedLimiter().consume(key, options);
      setRateLimitHeaders(res, result);

      if (!result.allowed) {
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
  const key = `identifier:${input.route}:${hashRateLimitValue(input.identifier)}`;
  const result = await getIdentifierLimiter().consume(key, {
    windowMs: input.windowMs,
    max: input.max,
  });

  if (!result.allowed) {
    throw new RateLimitExceededError(result.retryAfterSeconds);
  }
}

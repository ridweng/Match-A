import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { pool } from "@workspace/db";

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

export class DatabaseRateLimiter {
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

const sharedLimiter = new DatabaseRateLimiter();
const identifierLimiter = new DatabaseRateLimiter();

setInterval(() => {
  void sharedLimiter.prune().catch(() => undefined);
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
      const result = await sharedLimiter.consume(key, options);
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
  const result = await identifierLimiter.consume(key, {
    windowMs: input.windowMs,
    max: input.max,
  });

  if (!result.allowed) {
    throw new RateLimitExceededError(result.retryAfterSeconds);
  }
}

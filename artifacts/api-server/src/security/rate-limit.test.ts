import test from "node:test";
import assert from "node:assert/strict";
import { RedisRateLimiter, type RateLimiterBackend } from "./rate-limit";

class FakeFallbackLimiter implements RateLimiterBackend {
  calls = 0;

  async consume(_key: string, options: { windowMs: number; max: number }) {
    this.calls += 1;
    return {
      allowed: true,
      limit: options.max,
      remaining: options.max - 1,
      resetAt: Date.now() + options.windowMs,
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    };
  }
}

class FakeRedisClient {
  isOpen = true;
  counts = new Map<string, number>();
  failEval = false;

  async eval(_script: string, options: { keys: string[]; arguments: string[] }) {
    if (this.failEval) {
      throw new Error("redis down");
    }
    const key = options.keys[0]!;
    const next = (this.counts.get(key) || 0) + 1;
    this.counts.set(key, next);
    return [next, Number(options.arguments[0])];
  }

  async quit() {
    this.isOpen = false;
  }
}

test("Redis rate limiter counts over the configured window", async () => {
  const redis = new FakeRedisClient();
  const fallback = new FakeFallbackLimiter();
  const limiter = new RedisRateLimiter({
    enabled: true,
    redisUrl: "redis://test",
    fallback,
    client: redis as never,
  });

  const first = await limiter.consume("api:test", { windowMs: 900_000, max: 2 });
  const second = await limiter.consume("api:test", { windowMs: 900_000, max: 2 });
  const third = await limiter.consume("api:test", { windowMs: 900_000, max: 2 });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);
  assert.equal(fallback.calls, 0);
});

test("Redis rate limiter falls back when disabled or unavailable", async () => {
  const disabledFallback = new FakeFallbackLimiter();
  const disabled = new RedisRateLimiter({
    enabled: false,
    redisUrl: "redis://test",
    fallback: disabledFallback,
  });
  await disabled.consume("api:test", { windowMs: 900_000, max: 5 });
  assert.equal(disabledFallback.calls, 1);

  const redis = new FakeRedisClient();
  redis.failEval = true;
  const failingFallback = new FakeFallbackLimiter();
  const failing = new RedisRateLimiter({
    enabled: true,
    redisUrl: "redis://test",
    fallback: failingFallback,
    client: redis as never,
  });
  await failing.consume("api:test", { windowMs: 900_000, max: 5 });
  assert.equal(failingFallback.calls, 1);
});

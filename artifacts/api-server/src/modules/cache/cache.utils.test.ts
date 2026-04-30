import assert from "node:assert/strict";
import test from "node:test";
import { Logger } from "@nestjs/common";
import { CacheService } from "./cache.service";
import { getOrComputeWithCache, invalidateWithCache } from "./cache.utils";

test("getOrComputeWithCache falls back to loader when provider is missing", async () => {
  let loadCount = 0;

  const result = await getOrComputeWithCache({
    logger: new Logger("CacheUtilsTest"),
    scope: "test-cache",
    key: "matcha:v1:test:item",
    ttlSeconds: 30,
    loader: async () => {
      loadCount += 1;
      return { ok: true };
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(loadCount, 1);
});

test("invalidateWithCache returns cleanly when provider is missing", async () => {
  await assert.doesNotReject(() =>
    invalidateWithCache({
      logger: new Logger("CacheUtilsTest"),
      scope: "test-cache",
      description: "missing-provider",
      invalidate: async () => undefined,
    })
  );
});

test("getOrComputeWithCache falls back when cache throws", async () => {
  const cacheService = {
    async getOrSet() {
      throw new Error("redis unavailable");
    },
  } as unknown as CacheService;

  const result = await getOrComputeWithCache({
    cacheService,
    logger: new Logger("CacheUtilsTest"),
    scope: "test-cache",
    key: "matcha:v1:test:item",
    ttlSeconds: 30,
    loader: async () => ({ ok: true }),
  });

  assert.deepEqual(result, { ok: true });
});

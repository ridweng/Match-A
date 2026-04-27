import test from "node:test";
import assert from "node:assert/strict";
import { CacheService } from "./cache.service";

class FakeRedisClient {
  isOpen = true;
  store = new Map<string, string>();
  getCalls = 0;
  setCalls = 0;
  delCalls = 0;
  failGet = false;

  async get(key: string) {
    this.getCalls += 1;
    if (this.failGet) {
      throw new Error("redis down");
    }
    return this.store.get(key) ?? null;
  }

  async setEx(key: string, _ttlSeconds: number, value: string) {
    this.setCalls += 1;
    this.store.set(key, value);
  }

  async del(keys: string | string[]) {
    this.delCalls += 1;
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      this.store.delete(key);
    }
  }

  async *scanIterator(options: { MATCH: string }) {
    const prefix = options.MATCH.replace(/\*$/, "");
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        yield key;
      }
    }
  }

  async quit() {
    this.isOpen = false;
  }
}

function createEnabledService(client: FakeRedisClient) {
  const service = new CacheService();
  service.configureForTesting(
    {
      enabled: true,
      redisUrl: "redis://test",
      defaultTtlSeconds: 60,
    },
    client as never
  );
  return service;
}

test("getOrSet loads on miss and reuses cached hit", async () => {
  const client = new FakeRedisClient();
  const service = createEnabledService(client);
  let loadCount = 0;

  const first = await service.getOrSet("matcha:v1:test:item", 30, async () => {
    loadCount += 1;
    return { ok: true };
  });
  const second = await service.getOrSet("matcha:v1:test:item", 30, async () => {
    loadCount += 1;
    return { ok: false };
  });

  assert.deepEqual(first, { ok: true });
  assert.deepEqual(second, { ok: true });
  assert.equal(loadCount, 1);
  assert.equal(client.setCalls, 1);
});

test("disabled cache bypasses Redis and does not store", async () => {
  const client = new FakeRedisClient();
  const service = new CacheService();
  service.configureForTesting(
    {
      enabled: false,
      redisUrl: "redis://test",
      defaultTtlSeconds: 60,
    },
    client as never
  );
  let loadCount = 0;

  await service.getOrSet("matcha:v1:test:item", 30, async () => {
    loadCount += 1;
    return { ok: true };
  });
  await service.getOrSet("matcha:v1:test:item", 30, async () => {
    loadCount += 1;
    return { ok: true };
  });

  assert.equal(loadCount, 2);
  assert.equal(client.getCalls, 0);
  assert.equal(client.setCalls, 0);
});

test("Redis errors fall back to loader without caching failed reads", async () => {
  const client = new FakeRedisClient();
  client.failGet = true;
  const service = createEnabledService(client);

  const value = await service.getOrSet("matcha:v1:test:item", 30, async () => ({
    ok: true,
  }));

  assert.deepEqual(value, { ok: true });
  assert.equal(client.setCalls, 0);
});

test("loader errors are not cached", async () => {
  const client = new FakeRedisClient();
  const service = createEnabledService(client);

  await assert.rejects(
    () =>
      service.getOrSet("matcha:v1:test:item", 30, async () => {
        throw new Error("db failed");
      }),
    /db failed/
  );

  assert.equal(client.setCalls, 0);
  assert.equal(client.store.has("matcha:v1:test:item"), false);
});

test("deleteByPrefix invalidates matching keys only", async () => {
  const client = new FakeRedisClient();
  const service = createEnabledService(client);
  await service.set("matcha:v1:a:1", { value: 1 }, 30);
  await service.set("matcha:v1:a:2", { value: 2 }, 30);
  await service.set("matcha:v1:b:1", { value: 3 }, 30);

  await service.deleteByPrefix("matcha:v1:a:");

  assert.equal(client.store.has("matcha:v1:a:1"), false);
  assert.equal(client.store.has("matcha:v1:a:2"), false);
  assert.equal(client.store.has("matcha:v1:b:1"), true);
});

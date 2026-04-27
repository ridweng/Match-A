import test from "node:test";
import assert from "node:assert/strict";
import { CACHE_NAMESPACE } from "./cache.constants";
import { cacheHash, cacheKey, cacheKeys } from "./cache.keys";

test("cacheKey namespaces and normalizes key parts", () => {
  assert.equal(
    cacheKey("viewer", "bootstrap", "user", 42),
    `${CACHE_NAMESPACE}:viewer:bootstrap:user:42`
  );
  assert.equal(cacheKey("domain", "unsafe value!"), `${CACHE_NAMESPACE}:domain:unsafe_value`);
});

test("cacheHash is stable for equivalent object key order", () => {
  assert.equal(
    cacheHash({ b: 2, a: { d: 4, c: 3 } }),
    cacheHash({ a: { c: 3, d: 4 }, b: 2 })
  );
});

test("admin metric keys vary by filter hash", () => {
  const base = cacheKeys.adminOverview({ timeframe: "1w", country: "all" });
  const differentTimeframe = cacheKeys.adminOverview({ timeframe: "1m", country: "all" });
  const differentCountry = cacheKeys.adminOverview({ timeframe: "1w", country: "ES" });

  assert.notEqual(base, differentTimeframe);
  assert.notEqual(base, differentCountry);
  assert.match(base, /^matcha:v1:admin:overview:/);
});

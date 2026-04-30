import assert from "node:assert/strict";
import test from "node:test";

process.env.ADMIN_BASE_URL = "http://127.0.0.1:8082";
process.env.AUTH_SESSION_SECRET = "test-secret-that-is-long-enough-for-local";

test("sanitizeAnalyticsMetadata drops sensitive and unknown fields", async () => {
  const { sanitizeAnalyticsMetadata } = await import("./analytics.service");
  const result = sanitizeAnalyticsMetadata(
    {
      requestId: "req_1",
      password: "secret",
      accessToken: "token",
      bio: "private text",
      unknownRawText: "do not store",
      latencyMs: 42,
    },
    4096
  );

  assert.deepEqual(result, {
    requestId: "req_1",
    latencyMs: 42,
  });
});

test("sanitizeAnalyticsMetadata trims string values to keep metadata compact", async () => {
  const { sanitizeAnalyticsMetadata } = await import("./analytics.service");
  const result = sanitizeAnalyticsMetadata(
    {
      errorCode: "x".repeat(500),
      reason: "ok",
    },
    4096
  ) as Record<string, unknown>;

  assert.equal(String(result.errorCode).length, 160);
  assert.equal(result.reason, "ok");
});

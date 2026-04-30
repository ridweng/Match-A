import assert from "node:assert/strict";
import test from "node:test";
import { GoalsService } from "./goals.service";

test("getUserGoals does not crash when cache provider is unavailable", async () => {
  const service = new GoalsService(undefined as never);

  (service as any).loadUserGoals = async (userId: number) => ({
    userId,
    goals: [],
  });

  const result = await service.getUserGoals(42);

  assert.deepEqual(result, {
    userId: 42,
    goals: [],
  });
});

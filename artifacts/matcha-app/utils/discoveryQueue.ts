import type { DiscoveryFeedProfileResponse } from "@/services/auth";

type DiscoveryQueueProfile = Pick<DiscoveryFeedProfileResponse, "id">;

export function getDiscoveryQueueIds(
  queue: readonly DiscoveryQueueProfile[] | null | undefined
): Array<string | number> {
  return Array.isArray(queue) ? queue.map((profile) => profile.id) : [];
}

export function assertDiscoveryQueueInvariants(
  queue: readonly DiscoveryQueueProfile[],
  options?: {
    targetProfileId?: string | number | null;
    expectedHeadId?: string | number | null;
  }
) {
  const ids = getDiscoveryQueueIds(queue);

  if (ids.length > 3) {
    throw new Error(`Queue length invariant violated: ${ids.length}`);
  }

  if (new Set(ids).size !== ids.length) {
    throw new Error(`Queue duplicate invariant violated: [${ids.join(", ")}]`);
  }

  if (
    options?.expectedHeadId !== undefined &&
    options.expectedHeadId !== null &&
    ids[0] !== options.expectedHeadId
  ) {
    throw new Error(
      `Queue head mismatch: expected ${options.expectedHeadId}, got ${ids[0] ?? "none"}`
    );
  }

  if (
    options?.targetProfileId !== undefined &&
    options.targetProfileId !== null &&
    ids.includes(options.targetProfileId)
  ) {
    throw new Error(`Target profile still present after mutation: ${options.targetProfileId}`);
  }
}

export function applyDecisionToQueue<T extends DiscoveryQueueProfile>(
  queue: readonly T[],
  targetProfileId: string | number,
  replacement?: T | null
): T[] {
  const head = queue[0];

  if (!head || head.id !== targetProfileId) {
    throw new Error(
      `Queue head mismatch: expected ${head?.id ?? "none"}, got ${targetProfileId}`
    );
  }

  const next = queue
    .slice(1)
    .filter((profile, index, all) => all.findIndex((candidate) => candidate.id === profile.id) === index)
    .filter((profile) => profile.id !== targetProfileId);

  if (
    replacement &&
    replacement.id !== targetProfileId &&
    !next.some((profile) => profile.id === replacement.id)
  ) {
    next.push(replacement);
  }

  const result = next.slice(0, 3);
  assertDiscoveryQueueInvariants(result, {
    targetProfileId,
  });
  return result;
}

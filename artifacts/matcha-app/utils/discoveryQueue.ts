import type { DiscoveryFeedProfileResponse } from "@/services/auth";

type DiscoveryQueueProfile = Pick<DiscoveryFeedProfileResponse, "id">;

export function normalizeDiscoveryProfileId(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length
        ? Number(value)
        : Number.NaN;

  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

export function discoveryIdsEqual(
  left: string | number | null | undefined,
  right: string | number | null | undefined
): boolean {
  const normalizedLeft = normalizeDiscoveryProfileId(left);
  const normalizedRight = normalizeDiscoveryProfileId(right);

  return normalizedLeft !== null && normalizedRight !== null && normalizedLeft === normalizedRight;
}

function normalizeQueueIds(
  queue: readonly DiscoveryQueueProfile[] | null | undefined
): Array<number | null> {
  return Array.isArray(queue)
    ? queue.map((profile) => normalizeDiscoveryProfileId(profile.id))
    : [];
}

function requireQueueIds(queue: readonly DiscoveryQueueProfile[]): number[] {
  const ids = normalizeQueueIds(queue);
  const invalidIndex = ids.findIndex((id) => id === null);

  if (invalidIndex !== -1) {
    throw new Error(`Queue invalid profile id invariant violated at index ${invalidIndex}`);
  }

  return ids as number[];
}

function withNormalizedProfileId<T extends DiscoveryQueueProfile>(
  profile: T,
  normalizedId: number
): T {
  return profile.id === normalizedId
    ? profile
    : ({ ...profile, id: normalizedId } as T);
}

export function getDiscoveryQueueIds(
  queue: readonly DiscoveryQueueProfile[] | null | undefined
): number[] {
  return normalizeQueueIds(queue).filter((id): id is number => id !== null);
}

export function assertDiscoveryQueueInvariants(
  queue: readonly DiscoveryQueueProfile[],
  options?: {
    targetProfileId?: string | number | null;
    expectedHeadId?: string | number | null;
  }
) {
  const ids = requireQueueIds(queue);
  const expectedHeadId = normalizeDiscoveryProfileId(options?.expectedHeadId);
  const targetProfileId = normalizeDiscoveryProfileId(options?.targetProfileId);

  if (ids.length > 3) {
    throw new Error(`Queue length invariant violated: ${ids.length}`);
  }

  if (new Set(ids).size !== ids.length) {
    throw new Error(`Queue duplicate invariant violated: [${ids.join(", ")}]`);
  }

  if (
    options?.expectedHeadId !== undefined &&
    options.expectedHeadId !== null &&
    (expectedHeadId === null || ids[0] !== expectedHeadId)
  ) {
    throw new Error(
      `Queue head mismatch: expected ${options.expectedHeadId}, got ${ids[0] ?? "none"}`
    );
  }

  if (
    options?.targetProfileId !== undefined &&
    options.targetProfileId !== null &&
    targetProfileId !== null &&
    ids.includes(targetProfileId)
  ) {
    throw new Error(`Target profile still present after mutation: ${targetProfileId}`);
  }
}

export function applyDecisionToQueue<T extends DiscoveryQueueProfile>(
  queue: readonly T[],
  targetProfileId: string | number,
  replacement?: T | null
): T[] {
  const head = queue[0];
  const normalizedTargetProfileId = normalizeDiscoveryProfileId(targetProfileId);

  if (normalizedTargetProfileId === null) {
    throw new Error(`Queue target id is invalid: ${targetProfileId}`);
  }

  if (!head || !discoveryIdsEqual(head.id, normalizedTargetProfileId)) {
    throw new Error(
      `Queue head mismatch: expected ${head?.id ?? "none"}, got ${normalizedTargetProfileId}`
    );
  }

  const seen = new Set<number>();
  const next = queue.slice(1).reduce<T[]>((result, profile) => {
    const normalizedProfileId = normalizeDiscoveryProfileId(profile.id);

    if (normalizedProfileId === null) {
      throw new Error("Queue contains invalid profile id during mutation");
    }

    if (
      normalizedProfileId === normalizedTargetProfileId ||
      seen.has(normalizedProfileId)
    ) {
      return result;
    }

    seen.add(normalizedProfileId);
    result.push(withNormalizedProfileId(profile, normalizedProfileId));
    return result;
  }, []);

  const normalizedReplacementId = normalizeDiscoveryProfileId(replacement?.id ?? null);

  if (
    replacement &&
    normalizedReplacementId !== null &&
    normalizedReplacementId !== normalizedTargetProfileId &&
    !seen.has(normalizedReplacementId)
  ) {
    next.push(withNormalizedProfileId(replacement, normalizedReplacementId));
  }

  const result = next.slice(0, 3);
  assertDiscoveryQueueInvariants(result, {
    targetProfileId: normalizedTargetProfileId,
  });
  return result;
}

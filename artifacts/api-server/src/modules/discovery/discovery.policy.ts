type BaseGender = "male" | "female" | "non_binary" | "fluid";
type TherianMode = "exclude" | "include" | "only";

export type DiscoveryPolicyVersion = "discovery_policy_v1";

export type DiscoveryFilters = {
  selectedGenders: BaseGender[];
  therianMode: TherianMode;
  ageMin: number;
  ageMax: number;
};

export type DiscoveryCandidateBucket = "real" | "dummy";

export type DiscoveryExclusionReason =
  | "self_excluded"
  | "not_activated"
  | "not_discoverable"
  | "missing_ready_media"
  | "gender_filtered"
  | "age_filtered"
  | "therian_filtered"
  | "already_decided"
  | "dummy_fallback_used"
  | "pool_exhausted";

export type DiscoveryExhaustedReason =
  | "pool_exhausted_real_and_dummy"
  | "pool_exhausted_real_only_dummy_available"
  | "filters_too_narrow"
  | "all_candidates_already_decided";

export type DiscoveryQueueInvalidationReason =
  | "filters_changed"
  | "clear_filters"
  | "actor_changed"
  | "policy_version_changed"
  | "cursor_stale"
  | "backend_queue_invalidated";

export type DiscoveryWindowCursorPayload = {
  policyVersion: DiscoveryPolicyVersion;
  actorProfileId: number;
  filtersHash: string;
  afterRank: number | null;
  afterProfileId: number | null;
};

export const DISCOVERY_POLICY_V1 = {
  policyVersion: "discovery_policy_v1" as const,
  queueTargetSize: 12,
  visibleDeckSize: 3,
  replacementBatchSize: 1,
  refillThreshold: 1,
  windowMaxSize: 3,
  bucketPriority: ["real", "dummy"] as const,
  dominantReasonOrder: [
    "already_decided",
    "missing_ready_media",
    "gender_filtered",
    "age_filtered",
    "therian_filtered",
    "not_activated",
    "not_discoverable",
    "self_excluded",
    "dummy_fallback_used",
    "pool_exhausted",
  ] satisfies readonly DiscoveryExclusionReason[],
} as const;

const THERIAN_BY_BASE: Record<BaseGender, string> = {
  male: "therian_male",
  female: "therian_female",
  non_binary: "therian_non_binary",
  fluid: "therian_fluid",
};

export function computeStableDiscoveryRank(
  actorProfileId: number,
  targetProfileId: number,
  policyVersion: DiscoveryPolicyVersion
) {
  const raw = `${policyVersion}:${actorProfileId}:${targetProfileId}`;
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function encodeDiscoveryWindowCursor(payload: DiscoveryWindowCursorPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeDiscoveryWindowCursor(
  cursor: string | null | undefined
): DiscoveryWindowCursorPayload | null {
  const raw = String(cursor || "").trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      parsed?.policyVersion !== DISCOVERY_POLICY_V1.policyVersion ||
      !Number.isFinite(parsed?.actorProfileId) ||
      Number(parsed.actorProfileId) <= 0 ||
      typeof parsed?.filtersHash !== "string" ||
      !parsed.filtersHash.trim() ||
      !(
        parsed?.afterRank === null ||
        (Number.isFinite(parsed?.afterRank) && Number(parsed.afterRank) >= 0)
      ) ||
      !(
        parsed?.afterProfileId === null ||
        (Number.isFinite(parsed?.afterProfileId) && Number(parsed.afterProfileId) > 0)
      )
    ) {
      return null;
    }

    return {
      policyVersion: parsed.policyVersion,
      actorProfileId: Math.floor(Number(parsed.actorProfileId)),
      filtersHash: parsed.filtersHash,
      afterRank:
        parsed.afterRank === null ? null : Math.floor(Number(parsed.afterRank)),
      afterProfileId:
        parsed.afterProfileId === null ? null : Math.floor(Number(parsed.afterProfileId)),
    };
  } catch {
    return null;
  }
}

export function getDominantExclusionReason(
  counts: Partial<Record<DiscoveryExclusionReason, number>>
): DiscoveryExclusionReason | null {
  let dominant: DiscoveryExclusionReason | null = null;
  let dominantCount = -1;

  for (const reason of DISCOVERY_POLICY_V1.dominantReasonOrder) {
    const count = Number(counts[reason] || 0);
    if (count > dominantCount) {
      dominant = reason;
      dominantCount = count;
    }
  }

  return dominantCount > 0 ? dominant : null;
}

export function evaluateGenderTherianReason(
  genderIdentity: string,
  filters: DiscoveryFilters
): "gender_filtered" | "therian_filtered" | null {
  const normalized = String(genderIdentity || "").trim().toLowerCase();
  const selected = filters.selectedGenders.length
    ? filters.selectedGenders
    : (["male", "female", "non_binary", "fluid"] satisfies BaseGender[]);

  const selectedSet = new Set(selected);
  const matchedBase = (
    Object.entries(THERIAN_BY_BASE) as Array<[BaseGender, string]>
  ).find(([base, therian]) => normalized === base || normalized === therian)?.[0];

  if (!matchedBase || !selectedSet.has(matchedBase)) {
    return "gender_filtered";
  }

  const isTherian = normalized.startsWith("therian_");
  if (filters.therianMode === "exclude" && isTherian) {
    return "therian_filtered";
  }
  if (filters.therianMode === "only" && !isTherian) {
    return "therian_filtered";
  }

  return null;
}

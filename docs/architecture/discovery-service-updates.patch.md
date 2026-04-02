# Discovery Service Updates - Identity Resolution Patch

**File:** `artifacts/api-server/src/modules/discovery/discovery.service.ts`

Apply these changes to complete the P0 implementation:

---

## 1. Add Type Definitions (After line ~100)

```typescript
type DiscoveryDecisionPayload = {
  targetProfilePublicId?: string;
  targetProfileId?: number;
  categoryValues: Partial<Record<PopularAttributeCategory, string | null>>;
  requestId?: string | null;
  cursor?: string | null;
  visibleProfilePublicIds?: string[];
  visibleProfileIds?: number[];
  queueVersion?: number | null;
  presentedPosition?: number | null;
};
```

---

## 2. Add ID Resolution Helper (After findTargetProfileById, ~line 315)

```typescript
/**
 * Resolve target profile using public_id (preferred) or numeric id (fallback)
 * @returns Profile with both id and public_id, or null if not found
 */
private async resolveTargetProfile(
  client: { query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }> },
  payload: { targetProfilePublicId?: string; targetProfileId?: number },
  requestId?: string | null
): Promise<{ id: number; public_id: string } | null> {
  const hasPublicId = Boolean(payload.targetProfilePublicId);
  const hasNumericId = Boolean(payload.targetProfileId);
  
  // Log identity resolution attempt
  this.logger.log(`[discovery-identity] Resolution attempt`, {
    requestId,
    hasPublicId,
    hasNumericId,
    preferredMethod: hasPublicId ? 'public_id' : 'numeric_id',
  });
  
  // Prefer public_id if provided
  if (payload.targetProfilePublicId) {
    const result = await client.query<{ id: number; public_id: string }>(
      `SELECT id, public_id
       FROM core.profiles
       WHERE public_id = $1
       LIMIT 1`,
      [payload.targetProfilePublicId]
    );
    
    const profile = result.rows[0] || null;
    
    if (profile) {
      this.logger.log(`[discovery-identity] Resolved by public_id`, {
        requestId,
        targetProfileId: profile.id,
        targetProfilePublicId: profile.public_id,
      });
      
      // Detect identity drift if both IDs were provided
      if (payload.targetProfileId && profile.id !== payload.targetProfileId) {
        this.logger.error(`[identity-drift] Numeric ID mismatch`, {
          requestId,
          providedNumericId: payload.targetProfileId,
          resolvedNumericId: profile.id,
          publicId: profile.public_id,
          message: 'CRITICAL: Numeric and public IDs point to different profiles',
        });
      }
      
      return profile;
    }
    
    this.logger.warn(`[discovery-identity] Public ID not found`, {
      requestId,
      targetProfilePublicId: payload.targetProfilePublicId,
    });
    
    return null;
  }
  
  // Fallback to numeric ID (backward compatibility)
  if (payload.targetProfileId) {
    const result = await client.query<{ id: number; public_id: string }>(
      `SELECT id, public_id
       FROM core.profiles
       WHERE id = $1
       LIMIT 1`,
      [payload.targetProfileId]
    );
    
    const profile = result.rows[0] || null;
    
    if (profile) {
      this.logger.log(`[discovery-identity] Resolved by numeric_id (deprecated)`, {
        requestId,
        targetProfileId: profile.id,
        targetProfilePublicId: profile.public_id,
        warning: 'Client should migrate to using targetProfilePublicId',
      });
      
      return profile;
    }
    
    this.logger.warn(`[discovery-identity] Numeric ID not found`, {
      requestId,
      targetProfileId: payload.targetProfileId,
    });
    
    return null;
  }
  
  this.logger.error(`[discovery-identity] No ID provided`, {
    requestId,
    message: 'Either targetProfilePublicId or targetProfileId must be provided',
  });
  
  return null;
}
```

---

## 3. Update likeProfile Method Signature (Line ~1484)

**Replace:**
```typescript
async likeProfile(
  userId: number,
  payload: {
    targetProfileId: number;
    categoryValues: Partial<Record<PopularAttributeCategory, string | null>>;
    requestId?: string | null;
    cursor?: string | null;
    visibleProfileIds?: number[];
    queueVersion?: number | null;
    presentedPosition?: number | null;
  }
) {
  return this.recordProfileDecision(userId, "like", payload);
}
```

**With:**
```typescript
async likeProfile(userId: number, payload: DiscoveryDecisionPayload) {
  return this.recordProfileDecision(userId, "like", payload);
}
```

---

## 4. Update passProfile Method Signature (Line ~1495)

**Replace:**
```typescript
async passProfile(
  userId: number,
  payload: {
    targetProfileId: number;
    categoryValues: Partial<Record<PopularAttributeCategory, string | null>>;
    requestId?: string | null;
    cursor?: string | null;
    visibleProfileIds?: number[];
    queueVersion?: number | null;
    presentedPosition?: number | null;
  }
) {
  return this.recordProfileDecision(userId, "pass", payload);
}
```

**With:**
```typescript
async passProfile(userId: number, payload: DiscoveryDecisionPayload) {
  return this.recordProfileDecision(userId, "pass", payload);
}
```

---

## 5. Update decideProfile Method Signature (Line ~1506)

**Replace:**
```typescript
async decideProfile(
  userId: number,
  payload: {
    action: "like" | "pass";
    targetProfileId: number;
    categoryValues: Partial<Record<PopularAttributeCategory, string | null>>;
    requestId?: string | null;
    cursor?: string | null;
    visibleProfileIds?: number[];
    queueVersion?: number | null;
    presentedPosition?: number | null;
  }
) {
  return this.recordProfileDecision(userId, payload.action, payload);
}
```

**With:**
```typescript
async decideProfile(
  userId: number,
  payload: DiscoveryDecisionPayload & { action: "like" | "pass" }
) {
  return this.recordProfileDecision(userId, payload.action, payload);
}
```

---

## 6. Update recordProfileDecision Method (Line ~1522)

**Replace the parameter type:**
```typescript
private async recordProfileDecision(
  userId: number,
  interactionType: "like" | "pass",
  payload: {
    targetProfileId: number;
    categoryValues: Partial<Record<PopularAttributeCategory, string | null>>;
    requestId?: string | null;
    cursor?: string | null;
    visibleProfileIds?: number[];
    queueVersion?: number | null;
    presentedPosition?: number | null;
  }
) {
```

**With:**
```typescript
private async recordProfileDecision(
  userId: number,
  interactionType: "like" | "pass",
  payload: DiscoveryDecisionPayload
) {
```

**Then replace lines ~1545-1556:**
```typescript
const normalizedRequestId = String(payload.requestId || "").trim() || null;
const normalizedCursor = String(payload.cursor || "").trim() || null;
const normalizedVisibleProfileIds = this.normalizeVisibleProfileIds(
  payload.visibleProfileIds
);
const targetProfileId = Number(payload.targetProfileId);
const requestedQueueVersion =
  Number.isFinite(Number(payload.queueVersion)) && Number(payload.queueVersion) > 0
    ? Number(payload.queueVersion)
    : null;
const targetProfile = await this.findTargetProfileById(client, targetProfileId);
const currentFilters = await this.getStoredFiltersForActor(client, actorProfileId);
```

**With:**
```typescript
const normalizedRequestId = String(payload.requestId || "").trim() || null;
const normalizedCursor = String(payload.cursor || "").trim() || null;

// NEW: Resolve visible profile IDs (prefer public IDs)
let normalizedVisibleProfileIds: number[] = [];
if (payload.visibleProfilePublicIds && payload.visibleProfilePublicIds.length > 0) {
  // Convert public IDs to numeric IDs for internal processing
  const result = await client.query<{ id: number }>(
    `SELECT id FROM core.profiles WHERE public_id = ANY($1::text[])`,
    [payload.visibleProfilePublicIds]
  );
  normalizedVisibleProfileIds = result.rows.map(r => r.id);
} else if (payload.visibleProfileIds) {
  normalizedVisibleProfileIds = this.normalizeVisibleProfileIds(payload.visibleProfileIds);
}

const requestedQueueVersion =
  Number.isFinite(Number(payload.queueVersion)) && Number(payload.queueVersion) > 0
    ? Number(payload.queueVersion)
    : null;

// NEW: Use resolveTargetProfile instead of findTargetProfileById
const targetProfile = await this.resolveTargetProfile(client, payload, normalizedRequestId);
const currentFilters = await this.getStoredFiltersForActor(client, actorProfileId);
```

---

## 7. Update Target Profile Validation (Line ~1583)

**Replace:**
```typescript
if (!targetProfile?.id || targetProfile.id === actorProfileId) {
  this.warnDecisionEvent("invalid_target", {
    requestId: normalizedRequestId,
    userId,
    actorProfileId,
    targetProfileId,
    interactionType,
    durationMs: Date.now() - startedAt,
  });
  throw new Error("DISCOVERY_TARGET_NOT_FOUND");
}
```

**With:**
```typescript
if (!targetProfile) {
  this.warnDecisionEvent("invalid_target_not_found", {
    requestId: normalizedRequestId,
    userId,
    actorProfileId,
    hasPublicId: Boolean(payload.targetProfilePublicId),
    hasNumericId: Boolean(payload.targetProfileId),
    interactionType,
    durationMs: Date.now() - startedAt,
  });
  throw new Error("DISCOVERY_TARGET_NOT_FOUND");
}

if (targetProfile.id === actorProfileId) {
  this.warnDecisionEvent("invalid_target_is_self", {
    requestId: normalizedRequestId,
    userId,
    actorProfileId,
    targetProfileId: targetProfile.id,
    targetProfilePublicId: targetProfile.public_id,
    interactionType,
    durationMs: Date.now() - startedAt,
  });
  throw new Error("DISCOVERY_CANNOT_DECIDE_ON_SELF");
}
```

---

## Testing Checklist

After applying these changes:

- [ ] TypeScript compiles without errors
- [ ] Can send decision with `targetProfilePublicId` (NEW)
- [ ] Can still send decision with `targetProfileId` (backward compat)
- [ ] Identity resolution logs show which method was used
- [ ] No identity drift errors in logs
- [ ] Visible profile IDs work with both formats

---

## Migration Deployment Order

1. ✅ Run DB migration (`0010_actor_queue_public_id.sql`)
2. ✅ Deploy backend with these service updates
3. ⏳ Monitor logs for 24-48 hours
4. ⏳ Update mobile clients to use `targetProfilePublicId`
5. ⏳ After 2 weeks, deprecate numeric ID support

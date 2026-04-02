# Discovery P0 Implementation Status

**Date:** April 3, 2026  
**Status:** In Progress - Phase 1 (P0 Critical Fixes)

---

## ✅ Completed

### 1. Database Migration Created
**File:** `lib/db/migrations/0010_actor_queue_public_id.sql`

- ✅ Adds `target_profile_public_id VARCHAR(64)` to `discovery.actor_queue`
- ✅ Backfills existing rows from `core.profiles.public_id`
- ✅ Validates backfill (throws error if NULL values remain)
- ✅ Sets `NOT NULL` constraint after backfill
- ✅ Creates index on `target_profile_public_id`
- ✅ Adds `hydration_level VARCHAR(16)` for 3-slot deck support
- ✅ Sets default hydration levels based on position

**Status:** Ready to run. Execute with:
```bash
cd lib/db
pnpm drizzle-kit push:pg
# OR manually:
psql $DATABASE_URL < migrations/0010_actor_queue_public_id.sql
```

### 2. Schema Definition Updated
**File:** `lib/db/src/schema/index.ts`

- ✅ Added `targetProfilePublicId` field to `discoveryActorQueueTable`
- ✅ Added `hydrationLevel` field to `discoveryActorQueueTable`
- ✅ Created index `actorQueueTargetPublicIdIndex` on public_id

### 3. API Controller Schema Updated
**File:** `artifacts/api-server/src/modules/discovery/discovery.controller.ts`

- ✅ Created `discoveryDecisionBaseSchema` accepting both:
  - `targetProfilePublicId?: string` (NEW - preferred)
  - `targetProfileId?: number` (DEPRECATED - backward compat)
- ✅ Added `visibleProfilePublicIds?: string[]` (NEW)
- ✅ Added validation: at least one ID type must be provided
- ✅ Applied to both `discoveryDecisionSchema` and `discoveryQueuedDecisionSchema`

---

## ⚠️ Remaining Work (Blocking TypeScript Compilation)

### 4. Discovery Service Method Signatures
**File:** `artifacts/api-server/src/modules/discovery/discovery.service.ts`

**Current Problem:**
The service methods still expect the old payload format with **required** `targetProfileId: number`:

```typescript
// Current (WRONG):
async likeProfile(userId: number, payload: {
  targetProfileId: number;  // ❌ Required number
  // ...
}) { ... }

async decideProfile(userId: number, payload: {
  action: "like" | "pass";
  targetProfileId: number;  // ❌ Required number
  // ...
}) { ... }
```

**Required Changes:**

#### 4.1. Update Method Payloads
```typescript
// NEW (CORRECT):
type DiscoveryDecisionPayload = {
  targetProfilePublicId?: string;  // ✅ Preferred
  targetProfileId?: number;        // ✅ Backward compat
  visibleProfilePublicIds?: string[];
  visibleProfileIds?: number[];
  // ... other fields
};

async likeProfile(userId: number, payload: DiscoveryDecisionPayload) { ... }

async decideProfile(userId: number, payload: DiscoveryDecisionPayload & {
  action: "like" | "pass";
}) { ... }
```

#### 4.2. Add ID Resolution Helper
Add to `DiscoveryService`:

```typescript
private async resolveTargetProfile(
  client: { query: <T = any>(queryText: string, values?: unknown[]) => Promise<{ rows: T[] }> },
  payload: { targetProfilePublicId?: string; targetProfileId?: number }
): Promise<{ id: number; public_id: string } | null> {
  // Prefer public_id if provided
  if (payload.targetProfilePublicId) {
    const result = await client.query<{ id: number; public_id: string }>(
      `SELECT id, public_id
       FROM core.profiles
       WHERE public_id = $1
       LIMIT 1`,
      [payload.targetProfilePublicId]
    );
    return result.rows[0] || null;
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
    return result.rows[0] || null;
  }
  
  return null;
}
```

#### 4.3. Update Decision Methods
Replace calls to `this.findTargetProfileById(client, payload.targetProfileId)` with:

```typescript
const targetProfile = await this.resolveTargetProfile(client, payload);
if (!targetProfile) {
  throw new Error("TARGET_PROFILE_NOT_FOUND");
}
```

#### 4.4. Update Visible Profile ID Handling
```typescript
// NEW: Resolve visible profile IDs (prefer public IDs)
const visiblePublicIds = payload.visibleProfilePublicIds || [];

// DEPRECATED: Convert numeric IDs to public IDs if provided
if (payload.visibleProfileIds && payload.visibleProfileIds.length > 0 && visiblePublicIds.length === 0) {
  const result = await client.query<{ public_id: string }>(
    `SELECT public_id FROM core.profiles WHERE id = ANY($1::bigint[])`,
    [payload.visibleProfileIds]
  );
  visiblePublicIds.push(...result.rows.map(r => r.public_id));
}

// Use visiblePublicIds in exclusion logic
const excludedIds = new Set(visiblePublicIds);
```

### 5. Enhanced Identity Logging
Add structured logging for identity operations:

```typescript
// At decision start
this.logger.log(`[discovery-decision] Identity resolution`, {
  requestId,
  userId,
  hasPublicId: Boolean(payload.targetProfilePublicId),
  hasNumericId: Boolean(payload.targetProfileId),
  preferredIdType: payload.targetProfilePublicId ? 'public_id' : 'numeric_id',
});

// After resolution
this.logger.log(`[discovery-decision] Target resolved`, {
  requestId,
  targetProfileId: targetProfile.id,
  targetProfilePublicId: targetProfile.public_id,
  resolutionMethod: payload.targetProfilePublicId ? 'by_public_id' : 'by_numeric_id',
});

// Identity drift detection
if (payload.targetProfileId && targetProfile.id !== payload.targetProfileId) {
  this.logger.error(`[identity-drift] Numeric ID mismatch`, {
    requestId,
    providedNumericId: payload.targetProfileId,
    resolvedNumericId: targetProfile.id,
    publicId: targetProfile.public_id,
  });
}
```

---

## 📋 Implementation Steps (In Order)

### Step 1: Run the Migration ⏳
```bash
cd /Users/ignaciokaiser/Desktop/mines/Match-A/lib/db
pnpm drizzle-kit push:pg
```

Verify:
```sql
SELECT 
  COUNT(*) as total_rows,
  COUNT(target_profile_public_id) as rows_with_public_id,
  COUNT(DISTINCT hydration_level) as hydration_levels
FROM discovery.actor_queue;
```

Expected: `total_rows = rows_with_public_id`, `hydration_levels = 3`

### Step 2: Update Discovery Service ⏳

1. Add `DiscoveryDecisionPayload` type definition
2. Add `resolveTargetProfile()` helper method
3. Update `likeProfile()` signature and implementation
4. Update `passProfile()` signature and implementation  
5. Update `decideProfile()` signature and implementation
6. Add enhanced identity logging

### Step 3: Test Backward Compatibility ⏳

Test that both ID types work:

```typescript
// NEW: Using public_id (preferred)
await request(app)
  .post('/api/discovery/decision')
  .send({
    targetProfilePublicId: "abc123xyz",
    action: "like",
  });

// OLD: Using numeric ID (backward compat)
await request(app)
  .post('/api/discovery/decision')
  .send({
    targetProfileId: 42,
    action: "like",
  });
```

### Step 4: Monitor Production Logs ⏳

After deployment, verify:
- ✅ No identity drift errors
- ✅ Both ID types are accepted
- ✅ Public ID is preferred when both are provided
- ✅ Replacement profiles use public IDs

---

## 🎯 Success Criteria

After completing P0 fixes:

1. ✅ **Database:** `actor_queue` table has `target_profile_public_id` column
2. ✅ **Schema:** TypeScript types include public_id field
3. ✅ **API:** Accepts both `targetProfilePublicId` (preferred) and `targetProfileId` (deprecated)
4. ✅ **Service:** Resolves profiles using public_id first, falls back to numeric ID
5. ✅ **Logging:** Structured logs show which ID type was used
6. ✅ **No Errors:** TypeScript compilation succeeds
7. ✅ **No Identity Drift:** Logs show 0 drift errors after deployment

---

## 📊 Current Status Summary

| Component | Status | Progress |
|-----------|--------|----------|
| Database Migration | ✅ Ready | 100% |
| Schema Definition | ✅ Complete | 100% |
| API Controller | ✅ Complete | 100% |
| Service Layer | ⚠️ In Progress | 30% |
| Identity Logging | ⏳ Pending | 0% |
| Testing | ⏳ Pending | 0% |

**Overall Progress: 55%**

---

## 🔧 Quick Fix for TypeScript Errors

To temporarily fix compilation while working on service updates:

```typescript
// In discovery.controller.ts, cast payload types:
const result = await this.discoveryService.likeProfile(
  auth.user.id, 
  payload as any  // TEMPORARY: Remove after service is updated
);
```

**Note:** This is a temporary workaround only. Complete the service layer updates ASAP.

---

## 📚 Related Files

- **Assessment Document:** `docs/architecture/discovery-system-assessment.md`
- **Migration:** `lib/db/migrations/0010_actor_queue_public_id.sql`
- **Schema:** `lib/db/src/schema/index.ts`
- **Controller:** `artifacts/api-server/src/modules/discovery/discovery.controller.ts`
- **Service:** `artifacts/api-server/src/modules/discovery/discovery.service.ts` (⚠️ Needs updates)

---

**Next Step:** Update `discovery.service.ts` method signatures and add ID resolution logic.

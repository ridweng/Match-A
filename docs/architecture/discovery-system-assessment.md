# Discovery System Architecture Assessment

**Date:** April 3, 2026  
**Assessment Type:** Deep Technical Review  
**Scope:** Core Discovery DB Structure, Identity Model, and Endpoint Contracts  
**Version:** 1.0

---

## Executive Summary

This document provides a critical assessment of the Matcha discovery system's database structure, identity model, and core endpoint contracts (`GET /window` and `POST /decision`). Based on recent debugging findings and the app's 3-slot deck model requirements, this assessment identifies architectural gaps and provides concrete recommendations for building a robust, authoritative, scalable discovery system.

**Key Findings:**
- ✅ System correctly uses `target_profile_public_id` for decision tracking and exclusion
- ⚠️ API contract accepts numeric `targetProfileId` requiring internal translation
- ⚠️ No explicit 3-slot hydration support in endpoint responses
- ⚠️ Queue table (`actor_queue`) uses numeric IDs, creating potential identity drift
- ⚠️ No profile change-tracking mechanism for real-user re-eligibility
- ⚠️ Real-first vs dummy-fallback logic exists but isn't formalized in DB structure

---

## 1. Assessment of Current Architecture

### 1.1 Database Structure Analysis

#### Current Tables

**`discovery.profile_interactions` (Event History)**
```sql
CREATE TABLE discovery.profile_interactions (
  id BIGSERIAL PRIMARY KEY,
  actor_profile_id BIGINT NOT NULL REFERENCES core.profiles(id),
  target_profile_id BIGINT REFERENCES core.profiles(id),
  target_profile_public_id VARCHAR(64) NOT NULL,  -- ✅ Canonical identity
  interaction_type ENUM('like', 'pass') NOT NULL,
  decision_source VARCHAR(32) NOT NULL DEFAULT 'api',
  request_id VARCHAR(128),
  category_values_json JSONB NOT NULL DEFAULT '{}',
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Indexes: (actor_profile_id, request_id) UNIQUE WHERE request_id IS NOT NULL
--          (actor_profile_id, created_at)
```

**`discovery.profile_decisions` (Final State)**
```sql
CREATE TABLE discovery.profile_decisions (
  actor_profile_id BIGINT NOT NULL REFERENCES core.profiles(id),
  target_profile_id BIGINT REFERENCES core.profiles(id),
  target_profile_public_id VARCHAR(64) NOT NULL,  -- ✅ Canonical identity
  current_state ENUM('like', 'pass') NOT NULL,
  first_event_id BIGINT NOT NULL REFERENCES profile_interactions(id),
  latest_event_id BIGINT NOT NULL REFERENCES profile_interactions(id),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (actor_profile_id, target_profile_public_id)  -- ✅ Uses public_id
);
-- Index: (actor_profile_id, current_state, decided_at)
```

**`discovery.actor_queue` (Queue/Window Storage)**
```sql
CREATE TABLE discovery.actor_queue (
  actor_profile_id BIGINT NOT NULL REFERENCES core.profiles(id),
  queue_version INTEGER NOT NULL,
  position INTEGER NOT NULL,
  target_profile_id BIGINT NOT NULL REFERENCES core.profiles(id),  -- ⚠️ Numeric only
  status ENUM('reserved', 'consumed', 'invalidated') NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  source_bucket VARCHAR(32),  -- 'real' or 'dummy'
  rank_score NUMERIC,
  PRIMARY KEY (actor_profile_id, queue_version, position)
);
```

**`discovery.actor_state` (Actor Queue State)**
```sql
CREATE TABLE discovery.actor_state (
  actor_profile_id BIGINT PRIMARY KEY REFERENCES core.profiles(id),
  queue_version INTEGER NOT NULL DEFAULT 1,
  stream_version INTEGER NOT NULL DEFAULT 1,
  filters_hash VARCHAR(255) NOT NULL DEFAULT '',
  last_served_sort_key BIGINT,
  last_served_profile_id BIGINT REFERENCES core.profiles(id),
  active_queue_head_position INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**`core.profiles` (Profile Identity)**
```sql
-- Relevant fields:
id BIGINT PRIMARY KEY,
public_id VARCHAR(64) NOT NULL UNIQUE,  -- ✅ Canonical external identity
user_id BIGINT REFERENCES auth.users(id),
kind ENUM('user', 'dummy') NOT NULL,
synthetic_group VARCHAR(32),  -- Populated for dummy profiles
onboarding_status VARCHAR(32),
onboarding_completed_at TIMESTAMPTZ,
-- ... (profile attributes)
```

#### Strengths

1. ✅ **Dual-Table Event Model**: Separates immutable event history (`profile_interactions`) from mutable final state (`profile_decisions`)
2. ✅ **Public ID Canonical**: Decision tables use `target_profile_public_id` as part of the primary key, preventing identity drift
3. ✅ **Idempotency Support**: Request ID tracking in interactions table prevents duplicate decisions
4. ✅ **Profile Kind Differentiation**: `kind` field distinguishes real users from dummy profiles
5. ✅ **Queue Versioning**: `actor_state` and `actor_queue` support queue invalidation on filter changes

#### Critical Weaknesses

1. ⚠️ **Queue Identity Inconsistency**: `actor_queue.target_profile_id` is numeric only, while decisions use public IDs. This creates a translation layer requirement and potential for drift.

2. ⚠️ **No 3-Slot Hydration Metadata**: The queue table doesn't store hydration level hints (full/partial/metadata-only) for the 3-slot deck model.

3. ⚠️ **No Profile Change Tracking**: No mechanism to detect when a real user's profile changes significantly enough to warrant re-eligibility in discovery.

4. ⚠️ **Bucket Logic Implicit**: Real-first vs dummy-fallback logic is in application code, not enforced or tracked at the DB level beyond `source_bucket`.

5. ⚠️ **No Re-Eligibility Version**: No field to support "real user changed enough to show again" future use case.

### 1.2 Endpoint Contract Analysis

#### Current `GET /api/discovery/window`

**Request:**
```typescript
GET /api/discovery/window?size=3&cursor=optional_base64_cursor

Headers:
  Authorization: Bearer {token}
  x-matcha-request-id: {optional_request_id}
```

**Response:**
```typescript
{
  queueVersion: number,
  policyVersion: string,
  generatedAt: string,
  windowSize: number,
  reserveCount: number,
  profiles: Array<{
    id: number,              // ⚠️ Numeric ID
    publicId: string,        // ✅ Public ID also present
    name: string,
    age: number,
    images: string[],        // ⚠️ No hydration level indicator
    // ... (full attributes)
  }>,
  nextCursor: string | null,
  hasMore: boolean,
  supply: {
    eligibleCount: number,
    unseenCount: number,
    decidedCount: number,
    exhausted: boolean,
    eligibleRealCount: number,
    eligibleDummyCount: number,
    returnedRealCount: number,
    returnedDummyCount: number,
    dominantExclusionReason: string | null,
    exhaustedReason: string | null,
  }
}
```

**Strengths:**
- ✅ Returns public IDs alongside numeric IDs
- ✅ Provides rich supply diagnostics
- ✅ Supports cursor-based pagination
- ✅ Tracks real vs dummy counts

**Weaknesses:**
- ⚠️ **No explicit 3-slot hydration levels**: Response doesn't indicate which profile should be fully hydrated (A), partially hydrated (B), or metadata-only (C)
- ⚠️ **Size parameter allows any value (1-3)**: Not enforced as always-3 for the deck model
- ⚠️ **No queue position indicators**: Frontend can't verify deck position/continuity

#### Current `POST /api/discovery/decision`

**Request:**
```typescript
POST /api/discovery/decision

Headers:
  Authorization: Bearer {token}
  x-matcha-request-id: {optional_request_id}

Body:
{
  targetProfileId: number,           // ⚠️ Numeric, not public_id
  action: "like" | "pass",
  categoryValues: {
    physical?: string | null,
    personality?: string | null,
    family?: string | null,
    expectations?: string | null,
    language?: string | null,
    studies?: string | null,
  },
  requestId?: string,
  cursor?: string | null,
  visibleProfileIds?: number[],      // ⚠️ Numeric IDs
  queueVersion?: number,
  presentedPosition?: number,
}
```

**Response:**
```typescript
{
  requestId: string | null,
  decisionApplied: boolean,
  decisionState: "like" | "pass",
  targetProfileId: number,           // ⚠️ Numeric ID
  decisionRejectedReason: string | null,
  changedCategories: Array<PopularAttributeCategory>,
  shouldShowDiscoveryUpdate: boolean,
  replacementProfile: {              // ⚠️ Single replacement (good!)
    id: number,
    publicId: string,
    // ... (full profile attributes)
  } | null,
  nextCursor: string | null,
  hasMore: boolean,
  supply: { /* same as window */ },
  // ... (goals/threshold state)
}
```

**Strengths:**
- ✅ Returns single replacement profile (aligns with slot C model)
- ✅ Idempotency via requestId
- ✅ Rejection reason when decision not applied
- ✅ Tracks visible queue for duplicate prevention

**Weaknesses:**
- ⚠️ **Accepts numeric `targetProfileId`**: Requires internal translation to public_id, creates identity mismatch risk
- ⚠️ **Accepts numeric `visibleProfileIds`**: Same issue as targetProfileId
- ⚠️ **No explicit slot position**: Doesn't enforce "this was slot A" validation
- ⚠️ **Replacement has full hydration**: No control over replacement being metadata-only for slot C

### 1.3 Backend Authoritativeness

**Current State:**
- ✅ Backend builds ordered candidate list from DB
- ✅ Backend excludes already-decided profiles using public_id
- ✅ Backend returns single replacement on decision
- ⚠️ Frontend still has queue derivation logic (not fully authoritative)
- ⚠️ No strict "backend always serves exactly 3" enforcement

**Assessment:** Backend is **partially authoritative** but not **strictly authoritative** for the 3-slot model.

### 1.4 No-Repeat Behavior

**Current Implementation:**
```sql
-- Exclusion query (line ~600-750 in discovery.service.ts)
WHERE NOT EXISTS (
  SELECT 1 
  FROM discovery.profile_decisions pd
  WHERE pd.actor_profile_id = $actorId
    AND pd.target_profile_public_id = p.public_id  -- ✅ Uses public_id
)
```

**Replacement Logic:**
```typescript
// Lines 1182-1185 in discovery.service.ts
if (targetProfileId != null && Number.isFinite(targetProfileId) && targetProfileId > 0) {
  excludedIds.add(targetProfileId);  // ✅ Excludes just-decided profile
}
```

**Assessment:**
- ✅ **Exclusion works correctly** using public_id
- ✅ **Just-decided profile excluded** from replacement
- ✅ **No duplicates in visible queue** (checked against visibleProfileIds)
- ❌ **No change-based re-eligibility** for real users

### 1.5 Real vs Dummy Handling

**Current Implementation:**
```typescript
// Lines 810-814 in discovery.service.ts
if (bucket === "real") {
  orderedReal.push(candidate);
} else {
  orderedDummy.push(candidate);
}
// Lines 827: const orderedCandidates = [...orderedReal, ...orderedDummy];
```

**Assessment:**
- ✅ **Real-first ordering** implemented in application logic
- ✅ **Bucket tracking** in diagnostics
- ⚠️ **Not enforced at DB level** - could drift if selection query changes
- ⚠️ **No explicit "dummy exhaustion threshold"** before showing dummies

### 1.6 Scalability Concerns

1. **Selection Query**: Uses exclusion subquery on every window fetch. At scale (millions of decisions), this could be slow.
   - **Recommendation**: Add decision count tracking to actor_state, use limit-based short-circuits

2. **Queue Table Growth**: `actor_queue` retains all versions. No cleanup mechanism visible.
   - **Recommendation**: Add TTL-based cleanup for old queue_version entries

3. **Candidate Pool**: No pre-filtered candidate table. Every window fetch scans all profiles.
   - **Recommendation**: Consider materialized candidate pool per actor or global discoverable profiles view

---

## 2. Recommended Canonical Identity Model

### 2.1 Identity Hierarchy

**Recommendation: Use `profile.public_id` (VARCHAR 64) as canonical identity everywhere.**

| Context | Identity Type | Rationale |
|---------|--------------|-----------|
| **API Requests** | `public_id` (string) | External contract should never expose internal numeric IDs |
| **API Responses** | `public_id` (string) primary, `id` (number) deprecated | Transition clients away from numeric IDs |
| **Decision Tracking** | `target_profile_public_id` | ✅ Already correct |
| **Event History** | `target_profile_public_id` | ✅ Already correct |
| **Queue Storage** | `target_profile_public_id` ⚠️ **CHANGE NEEDED** | Currently uses numeric, must migrate |
| **Exclusion Logic** | `public_id` | ✅ Already correct |
| **Internal Lookups** | Translate `public_id` → numeric `id` for joins | Internal optimization only |

### 2.2 Migration Strategy

**Phase 1: Add `target_profile_public_id` to `actor_queue`**
```sql
ALTER TABLE discovery.actor_queue 
ADD COLUMN target_profile_public_id VARCHAR(64);

-- Backfill existing rows
UPDATE discovery.actor_queue aq
SET target_profile_public_id = p.public_id
FROM core.profiles p
WHERE aq.target_profile_id = p.id;

-- Make NOT NULL after backfill
ALTER TABLE discovery.actor_queue 
ALTER COLUMN target_profile_public_id SET NOT NULL;

-- Add index
CREATE INDEX actor_queue_target_public_id_idx 
ON discovery.actor_queue(target_profile_public_id);
```

**Phase 2: Update API contracts to accept `targetProfilePublicId`**
```typescript
// NEW contract (support both during transition)
{
  targetProfilePublicId: string,  // NEW, required
  targetProfileId?: number,       // DEPRECATED, ignored if public_id present
  // ...
}
```

**Phase 3: Update all queries to use `target_profile_public_id`**

**Phase 4: Remove numeric `target_profile_id` columns (after transition period)**

### 2.3 Preventing Identity Drift

**Rules:**
1. **Single Source of Truth**: `core.profiles.public_id` is immutable, globally unique
2. **Never expose internal IDs**: API layer must not return numeric `id` in new contracts
3. **All foreign references via public_id**: Any table referencing profiles should use public_id
4. **Numeric ID for optimization only**: Use numeric `id` only for internal DB joins after lookup

---

## 3. Recommended DB Structure

### 3.1 Core Principle

**"Server-driven, identity-consistent, change-aware discovery with explicit 3-slot support"**

### 3.2 Revised Tables

#### 3.2.1 `discovery.profile_decisions` (No changes needed)

✅ **Already correct.** Uses `target_profile_public_id` as part of PK.

#### 3.2.2 `discovery.profile_interactions` (No changes needed)

✅ **Already correct.** Stores `target_profile_public_id`.

#### 3.2.3 `discovery.actor_queue` (Add public_id + hydration metadata)

```sql
ALTER TABLE discovery.actor_queue
ADD COLUMN target_profile_public_id VARCHAR(64),
ADD COLUMN hydration_level VARCHAR(16);  -- 'full', 'partial', 'metadata'

-- After backfill:
ALTER TABLE discovery.actor_queue
ALTER COLUMN target_profile_public_id SET NOT NULL,
ALTER COLUMN hydration_level SET DEFAULT 'full';

-- Update PK to use public_id (requires recreation)
-- Consider: Keep both IDs during transition, use public_id in queries
```

**Rationale:** 
- Public ID prevents identity drift
- Hydration level supports explicit 3-slot deck model

#### 3.2.4 NEW: `discovery.profile_change_log` (For real-user re-eligibility)

```sql
CREATE TABLE discovery.profile_change_log (
  profile_id BIGINT NOT NULL REFERENCES core.profiles(id),
  change_version INTEGER NOT NULL DEFAULT 1,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_fields JSONB NOT NULL DEFAULT '{}',  -- Track which fields changed
  change_significance VARCHAR(32) NOT NULL,   -- 'minor', 'major', 'critical'
  PRIMARY KEY (profile_id, change_version)
);

CREATE INDEX profile_change_log_changed_at_idx 
ON discovery.profile_change_log(changed_at DESC);
```

**Rationale:** Supports future "show real user again if profile changed" use case.

#### 3.2.5 UPDATE: `discovery.actor_state` (Add decision counts cache)

```sql
ALTER TABLE discovery.actor_state
ADD COLUMN total_decisions_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN last_decision_at TIMESTAMPTZ;

CREATE INDEX actor_state_last_decision_idx 
ON discovery.actor_state(last_decision_at DESC) 
WHERE last_decision_at IS NOT NULL;
```

**Rationale:** Optimize exclusion queries at scale by short-circuiting when decision count is low.

#### 3.2.6 UPDATE: `core.profiles` (Add discovery eligibility version)

```sql
ALTER TABLE core.profiles
ADD COLUMN discovery_eligibility_version INTEGER NOT NULL DEFAULT 1,
ADD COLUMN last_discovery_material_change_at TIMESTAMPTZ;

CREATE INDEX profiles_discovery_eligibility_idx 
ON core.profiles(discovery_eligibility_version, last_discovery_material_change_at) 
WHERE is_discoverable = true;
```

**Rationale:** 
- Tracks when profile changed in discovery-relevant ways
- Future support for "show again if version > last_seen_version"

### 3.3 Complete Recommended Schema

```sql
-- ============================================================================
-- RECOMMENDED DISCOVERY SCHEMA V2
-- ============================================================================

-- 1. Event History (immutable append-only log)
CREATE TABLE discovery.profile_interactions (
  id BIGSERIAL PRIMARY KEY,
  actor_profile_id BIGINT NOT NULL REFERENCES core.profiles(id) ON DELETE CASCADE,
  target_profile_id BIGINT REFERENCES core.profiles(id) ON DELETE SET NULL,
  target_profile_public_id VARCHAR(64) NOT NULL,  -- ✅ Canonical
  interaction_type VARCHAR(16) NOT NULL CHECK (interaction_type IN ('like', 'pass')),
  decision_source VARCHAR(32) NOT NULL DEFAULT 'api',
  request_id VARCHAR(128),
  category_values_json JSONB NOT NULL DEFAULT '{}',
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX profile_interactions_actor_request_unique 
ON discovery.profile_interactions(actor_profile_id, request_id) 
WHERE request_id IS NOT NULL;

CREATE INDEX profile_interactions_actor_created_idx 
ON discovery.profile_interactions(actor_profile_id, created_at DESC);

-- 2. Final State (mutable current decision per actor-target pair)
CREATE TABLE discovery.profile_decisions (
  actor_profile_id BIGINT NOT NULL REFERENCES core.profiles(id) ON DELETE CASCADE,
  target_profile_id BIGINT REFERENCES core.profiles(id) ON DELETE SET NULL,
  target_profile_public_id VARCHAR(64) NOT NULL,  -- ✅ Canonical in PK
  current_state VARCHAR(16) NOT NULL CHECK (current_state IN ('like', 'pass')),
  first_event_id BIGINT NOT NULL REFERENCES profile_interactions(id) ON DELETE CASCADE,
  latest_event_id BIGINT NOT NULL REFERENCES profile_interactions(id) ON DELETE CASCADE,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (actor_profile_id, target_profile_public_id)
);

CREATE INDEX profile_decisions_actor_state_decided_idx 
ON discovery.profile_decisions(actor_profile_id, current_state, decided_at DESC);

-- 3. Actor Queue (server-managed window)
CREATE TABLE discovery.actor_queue (
  actor_profile_id BIGINT NOT NULL REFERENCES core.profiles(id) ON DELETE CASCADE,
  queue_version INTEGER NOT NULL,
  position INTEGER NOT NULL,
  target_profile_id BIGINT NOT NULL REFERENCES core.profiles(id) ON DELETE CASCADE,
  target_profile_public_id VARCHAR(64) NOT NULL,  -- ✅ NEW: Canonical ID
  status VARCHAR(32) NOT NULL DEFAULT 'reserved' 
    CHECK (status IN ('reserved', 'consumed', 'invalidated')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_bucket VARCHAR(32) CHECK (source_bucket IN ('real', 'dummy')),
  rank_score NUMERIC,
  hydration_level VARCHAR(16) DEFAULT 'full' 
    CHECK (hydration_level IN ('full', 'partial', 'metadata')),  -- ✅ NEW
  PRIMARY KEY (actor_profile_id, queue_version, position)
);

CREATE INDEX actor_queue_actor_queue_position_idx 
ON discovery.actor_queue(actor_profile_id, queue_version, status, position);

CREATE INDEX actor_queue_target_public_id_idx 
ON discovery.actor_queue(target_profile_public_id);

-- 4. Actor State (cursor + cache)
CREATE TABLE discovery.actor_state (
  actor_profile_id BIGINT PRIMARY KEY REFERENCES core.profiles(id) ON DELETE CASCADE,
  queue_version INTEGER NOT NULL DEFAULT 1,
  stream_version INTEGER NOT NULL DEFAULT 1,
  filters_hash VARCHAR(255) NOT NULL DEFAULT '',
  last_served_sort_key BIGINT,
  last_served_profile_id BIGINT REFERENCES core.profiles(id) ON DELETE SET NULL,
  active_queue_head_position INTEGER NOT NULL DEFAULT 1,
  total_decisions_count INTEGER NOT NULL DEFAULT 0,  -- ✅ NEW: Cache
  last_decision_at TIMESTAMPTZ,                      -- ✅ NEW: Cache
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX actor_state_last_decision_idx 
ON discovery.actor_state(last_decision_at DESC) 
WHERE last_decision_at IS NOT NULL;

-- 5. Profile Change Log (for re-eligibility)
CREATE TABLE discovery.profile_change_log (
  profile_id BIGINT NOT NULL REFERENCES core.profiles(id) ON DELETE CASCADE,
  change_version INTEGER NOT NULL DEFAULT 1,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_fields JSONB NOT NULL DEFAULT '{}',
  change_significance VARCHAR(32) NOT NULL 
    CHECK (change_significance IN ('minor', 'major', 'critical')),
  change_type VARCHAR(64),  -- 'profile_photo_added', 'bio_updated', etc.
  PRIMARY KEY (profile_id, change_version)
);

CREATE INDEX profile_change_log_changed_at_idx 
ON discovery.profile_change_log(profile_id, changed_at DESC);

-- 6. Filter Preferences (no changes needed)
CREATE TABLE discovery.filter_preferences (
  actor_profile_id BIGINT PRIMARY KEY REFERENCES core.profiles(id) ON DELETE CASCADE,
  selected_genders TEXT[] NOT NULL DEFAULT '{}',
  therian_mode VARCHAR(16) NOT NULL DEFAULT 'exclude' 
    CHECK (therian_mode IN ('exclude', 'include', 'only')),
  age_min INTEGER NOT NULL DEFAULT 18,
  age_max INTEGER NOT NULL DEFAULT 40,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Profile Discovery Metadata (in core.profiles)
ALTER TABLE core.profiles
ADD COLUMN IF NOT EXISTS discovery_eligibility_version INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_discovery_material_change_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_discovery_eligibility_idx 
ON core.profiles(discovery_eligibility_version, last_discovery_material_change_at) 
WHERE is_discoverable = true;
```

### 3.4 Key Constraints

1. **PK on `(actor_profile_id, target_profile_public_id)`** in decisions ✅
2. **NOT NULL on `target_profile_public_id`** in all tables ✅
3. **Unique on `core.profiles.public_id`** ✅
4. **Check constraints on enums** (status, hydration_level) ✅
5. **Cascading deletes** for actor cleanup ✅

---

## 4. Recommended Endpoint Contracts

### 4.1 `GET /api/discovery/window`

#### Purpose
**Authoritative 3-slot deck initializer**. Use for:
- App launch/login
- Filter changes
- Queue invalidation
- Full refresh after errors

#### Request
```typescript
GET /api/discovery/window

Query Parameters:
  size?: 3         // Always 3 for production (validate server-side)
  cursor?: string  // Optional: for pagination (rare)

Headers:
  Authorization: Bearer {token}
  x-matcha-request-id?: string  // Optional tracking
```

#### Response
```typescript
{
  // Queue Metadata
  queueVersion: number,           // Server queue version
  policyVersion: string,          // "v1" or "v2"
  generatedAt: string,            // ISO timestamp
  windowSize: 3,                  // Always 3
  
  // 3-Slot Deck (ALWAYS exactly 3 items, or fewer if exhausted)
  slots: [
    {
      position: 1,                // Slot A (front card)
      hydrationLevel: "full",     // ✅ NEW: Explicit hydration
      profile: {
        publicId: string,         // ✅ Canonical ID
        name: string,
        age: number,
        pronouns: string,
        location: string,
        images: string[],         // Full array for slot A
        about: { /* full */ },
        lifestyle: { /* full */ },
        physical: { /* full */ },
        insightTags: Array<{es: string, en: string}>,
        goalFeedback: Array<{goalId: string, reason: {es, en}}>,
        // ... (all attributes)
      }
    },
    {
      position: 2,                // Slot B (second card)
      hydrationLevel: "partial",  // ✅ NEW
      profile: {
        publicId: string,
        name: string,
        age: number,
        location: string,
        images: [string],         // Single primary image
        insightTags: Array<{es: string, en: string}>,
        // ... (limited attributes)
      }
    },
    {
      position: 3,                // Slot C (third card)
      hydrationLevel: "metadata", // ✅ NEW
      profile: {
        publicId: string,
        name: string,
        age: number,
        location: string,
        // NO images, minimal data
      }
    }
  ],
  
  // Supply Diagnostics
  supply: {
    eligibleCount: number,        // Total eligible candidates
    unseenCount: number,          // Not yet in window
    decidedCount: number,         // Already decided
    exhausted: boolean,           // No more candidates
    policyVersion: string,
    eligibleRealCount: number,    // Real users available
    eligibleDummyCount: number,   // Dummy profiles available
    returnedRealCount: number,    // Real users in this window
    returnedDummyCount: number,   // Dummies in this window
    dominantExclusionReason: string | null,
    exhaustedReason: string | null,
    refillThreshold: number,      // When to call window again
  },
  
  // Continuation
  nextCursor: string | null,      // For pagination (rare)
  hasMore: boolean,               // More candidates available
}
```

#### Business Rules

1. **Always return exactly 3 slots** unless supply exhausted (return 0-2)
2. **Slot 1 = full hydration** (all images, all attributes)
3. **Slot 2 = partial hydration** (primary image, core attributes)
4. **Slot 3 = metadata only** (no images, name/age/location only)
5. **Cursor is optional** - most calls won't use it
6. **Idempotent** - same filters = same initial window

### 4.2 `POST /api/discovery/decision`

#### Purpose
**Authoritative decision application + single replacement for slot C**. This is the only mutation endpoint.

#### Request
```typescript
POST /api/discovery/decision

Headers:
  Authorization: Bearer {token}
  x-matcha-request-id?: string  // Recommended for idempotency

Body:
{
  // Identity (✅ NEW: Use public_id)
  targetProfilePublicId: string,  // ✅ Canonical ID
  targetProfileId?: number,       // ⚠️ DEPRECATED (accept but ignore)
  
  // Action
  action: "like" | "pass",
  
  // Context (for diagnostics and replacement logic)
  categoryValues: {
    physical?: string | null,
    personality?: string | null,
    family?: string | null,
    expectations?: string | null,
    language?: string | null,
    studies?: string | null,
  },
  
  // Queue State (for validation)
  queueVersion?: number,
  cursor?: string | null,
  visibleProfilePublicIds?: string[],  // ✅ NEW: Use public IDs
  visibleProfileIds?: number[],        // ⚠️ DEPRECATED
  presentedPosition?: number,          // 1, 2, or 3 (which slot was swiped)
  
  // Idempotency
  requestId?: string,
}
```

#### Response
```typescript
{
  // Decision Outcome
  requestId: string | null,
  decisionApplied: boolean,
  decisionState: "like" | "pass",
  targetProfilePublicId: string,       // ✅ NEW
  targetProfileId: number,             // ⚠️ DEPRECATED
  decisionRejectedReason: string | null,  // "duplicate_request_id", "same_state_existing_decision", etc.
  
  // Replacement (for slot C only)
  replacementProfile: {
    position: 3,                       // ✅ NEW: Always slot C
    hydrationLevel: "metadata",        // ✅ NEW: Metadata only
    profile: {
      publicId: string,
      name: string,
      age: number,
      location: string,
      // NO images, minimal data for slot C
    }
  } | null,
  
  // Discovery State Changes (if like)
  changedCategories: Array<string>,     // Popular attribute categories that changed
  shouldShowDiscoveryUpdate: boolean,   // Show "Your preferences updated" message
  
  // Supply Diagnostics
  supply: { /* same as window */ },
  nextCursor: string | null,
  hasMore: boolean,
  
  // Queue Metadata
  queueVersion: number,
  policyVersion: string,
  
  // Goals/Unlock State
  goalsUnlock: {
    available: boolean,
    justUnlocked: boolean,
    unlockMessagePending: boolean,
  },
  
  // Preference/Threshold State
  threshold: {
    totalLikes: number,
    totalPasses: number,
    likesUntilUnlock: number,
    thresholdReached: boolean,
  },
  
  // Filters
  filters: {
    selectedGenders: string[],
    therianMode: string,
    ageMin: number,
    ageMax: number,
  },
}
```

#### Business Rules

1. **Idempotent via `requestId`** - duplicate requests return cached response
2. **Single replacement** - always for slot C (position 3)
3. **Replacement hydration = metadata only** - frontend hydrates progressively
4. **Exclude visible queue** - replacement must not be in current visible slots
5. **Exclude just-decided** - replacement must not be the profile just swiped
6. **Update decision tables atomically** - interaction + decision in same transaction
7. **Return rejection reason** if not applied (don't throw error)
8. **Rebuild projections** after successful decision
9. **Return goals unlock state** for UI logic

### 4.3 Deprecated Endpoints

**Mark for removal in v2:**
- `POST /api/discovery/like` → Use `POST /decision` with `action: "like"`
- `POST /api/discovery/pass` → Use `POST /decision` with `action: "pass"`
- `GET /api/discovery/feed` → Use `GET /window` with size=3

---

## 5. Candidate Selection Algorithm

### 5.1 High-Level Flow

```
1. Get actor's filter preferences
2. Get actor's decision history (public IDs)
3. Query eligible profiles:
   - Match filters (gender, age, therian mode)
   - Exclude already-decided (by public_id)
   - Exclude current visible queue (by public_id)
   - Separate real vs dummy
4. Rank candidates deterministically
5. Take real-first, then dummy fallback
6. Return top N (3 for window, 1 for replacement)
7. Record in actor_queue
```

### 5.2 Detailed Selection Query

```sql
-- Candidate Selection Query (v2)
WITH actor_filters AS (
  SELECT 
    selected_genders,
    therian_mode,
    age_min,
    age_max
  FROM discovery.filter_preferences
  WHERE actor_profile_id = $actor_id
),
actor_decisions AS (
  SELECT target_profile_public_id
  FROM discovery.profile_decisions
  WHERE actor_profile_id = $actor_id
),
eligible_profiles AS (
  SELECT 
    p.id,
    p.public_id,
    p.kind,
    p.synthetic_group,
    p.display_name,
    p.date_of_birth,
    p.gender_identity,
    p.onboarding_status,
    p.onboarding_completed_at,
    p.is_discoverable,
    -- ... (all discovery fields)
    
    -- Compute bucket
    CASE 
      WHEN p.kind = 'user' THEN 'real'
      ELSE 'dummy'
    END AS bucket,
    
    -- Compute age
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth::date)) AS age
    
  FROM core.profiles p
  CROSS JOIN actor_filters af
  
  WHERE p.is_discoverable = true
    AND p.id != $actor_id  -- Exclude self
    
    -- Not already decided
    AND p.public_id NOT IN (SELECT target_profile_public_id FROM actor_decisions)
    
    -- Not in current visible queue
    AND p.public_id != ALL($visible_public_ids::text[])
    
    -- Filter: Gender
    AND (
      af.selected_genders = '{}' 
      OR p.gender_identity = ANY(af.selected_genders)
    )
    
    -- Filter: Age
    AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth::date)) 
        BETWEEN af.age_min AND af.age_max
    
    -- Filter: Therian mode
    AND (
      (af.therian_mode = 'exclude' AND p.synthetic_group IS NULL)
      OR (af.therian_mode = 'include')  -- All profiles
      OR (af.therian_mode = 'only' AND p.synthetic_group IS NOT NULL)
    )
)
SELECT * FROM eligible_profiles
ORDER BY 
  bucket DESC,  -- 'real' before 'dummy' (alphabetical)
  id ASC        -- Deterministic secondary sort
LIMIT $limit;
```

### 5.3 Rank Computation

```typescript
function computeStableDiscoveryRank(
  actorProfileId: number,
  targetProfileId: number,
  policyVersion: string
): number {
  // Use cryptographic hash for deterministic but seemingly random order
  const seed = `${actorProfileId}:${targetProfileId}:${policyVersion}`;
  const hash = sha256(seed);
  return parseInt(hash.substring(0, 8), 16); // First 8 hex chars as number
}
```

**Properties:**
- ✅ Deterministic: same actor + target + policy = same rank
- ✅ Unique: collisions extremely rare
- ✅ Stable: rank doesn't change unless policy version changes
- ✅ Seemingly random: actors see different orders for same target pool

### 5.4 Real-First vs Dummy-Fallback

**Algorithm:**
```typescript
// 1. Separate buckets
const realCandidates = eligibleProfiles.filter(p => p.kind === 'user');
const dummyCandidates = eligibleProfiles.filter(p => p.kind === 'dummy');

// 2. Rank within buckets
realCandidates.sort((a, b) => computeRank(actor, a.id) - computeRank(actor, b.id));
dummyCandidates.sort((a, b) => computeRank(actor, a.id) - computeRank(actor, b.id));

// 3. Concatenate real-first
const orderedCandidates = [...realCandidates, ...dummyCandidates];

// 4. Take top N
return orderedCandidates.slice(0, requestedSize);
```

**Supply Metrics:**
```typescript
const metrics = {
  eligibleRealCount: realCandidates.length,
  eligibleDummyCount: dummyCandidates.length,
  returnedRealCount: Math.min(requestedSize, realCandidates.length),
  returnedDummyCount: Math.max(0, requestedSize - realCandidates.length),
};
```

### 5.5 One-Replacement Generation

**For `POST /decision` replacement:**
```typescript
async function getReplacementForSlotC(
  actorProfileId: number,
  filters: Filters,
  cursor: string | null,
  visiblePublicIds: string[],
  justDecidedPublicId: string  // CRITICAL: Must exclude
): Promise<Profile | null> {
  
  // Build exclusion set
  const excluded = new Set([
    ...visiblePublicIds,
    justDecidedPublicId,  // ✅ Never show the profile that was just swiped
  ]);
  
  // Get ordered candidates (same query as window)
  const candidates = await selectEligibleProfiles(actorProfileId, filters, excluded);
  
  // Decode cursor to determine starting position
  const startIndex = cursor ? decodeCursorPosition(cursor) : 0;
  
  // Find first candidate after cursor that's not in excluded set
  for (let i = startIndex; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (!excluded.has(candidate.publicId)) {
      return candidate;  // Return first eligible
    }
  }
  
  return null;  // Exhausted
}
```

### 5.6 Supply Exhaustion

**When supply is exhausted:**
```typescript
if (orderedCandidates.length === 0) {
  // Determine reason
  let exhaustedReason: string;
  
  if (decidedCount > 0 && decidedCount === (realBeforeDecisions + dummyBeforeDecisions)) {
    exhaustedReason = "all_candidates_already_decided";
  } else if (realBeforeDecisions === 0 && dummyBeforeDecisions === 0) {
    exhaustedReason = "filters_too_narrow";
  } else if (realBeforeDecisions === 0 && dummyBeforeDecisions > 0) {
    exhaustedReason = "pool_exhausted_real_only_dummy_available";
  } else {
    exhaustedReason = "pool_exhausted_real_and_dummy";
  }
  
  return {
    slots: [],  // Empty array
    supply: {
      exhausted: true,
      exhaustedReason,
      // ... other metrics
    }
  };
}
```

---

## 6. Rule for Repeating Real Users

### 6.1 V1 Safe Rule: **Never Repeat**

**Recommendation for v1/v2:**
> **Real users and dummy users, once decided (like OR pass), are permanently excluded from that actor's discovery queue.**

**Rationale:**
1. ✅ **Simplest to implement** - no change tracking needed
2. ✅ **Safest UX** - users won't see "Why am I seeing this person again?"
3. ✅ **Privacy-friendly** - respects the finality of a pass/rejection
4. ✅ **Matches user expectations** - discovery feels like "new people every time"
5. ✅ **Prevents stalking patterns** - can't keep re-seeing someone you liked

**Implementation:**
```sql
-- Already implemented correctly
WHERE p.public_id NOT IN (
  SELECT target_profile_public_id 
  FROM discovery.profile_decisions
  WHERE actor_profile_id = $actor_id
)
```

### 6.2 Future Evolution: **Conditional Re-Eligibility**

**For v3+ (future product rules):**

If the product team wants to support "show real users again if their profile changed significantly", implement:

#### 6.2.1 Profile Change Tracking

```sql
-- Trigger on core.profiles UPDATE
CREATE OR REPLACE FUNCTION track_profile_discovery_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Detect significant changes
  IF (
    OLD.display_name != NEW.display_name OR
    OLD.bio != NEW.bio OR
    OLD.location != NEW.location OR
    OLD.relationship_goals != NEW.relationship_goals OR
    -- ... other relevant fields
  ) THEN
    -- Increment eligibility version
    NEW.discovery_eligibility_version = OLD.discovery_eligibility_version + 1;
    NEW.last_discovery_material_change_at = NOW();
    
    -- Log the change
    INSERT INTO discovery.profile_change_log (
      profile_id,
      change_version,
      changed_at,
      change_fields,
      change_significance,
      change_type
    ) VALUES (
      NEW.id,
      NEW.discovery_eligibility_version,
      NOW(),
      jsonb_build_object(
        'changed_fields', ARRAY['display_name', 'bio', ...]  -- List changed
      ),
      'major',  -- Compute significance
      'profile_update'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profile_discovery_change_trigger
BEFORE UPDATE ON core.profiles
FOR EACH ROW
EXECUTE FUNCTION track_profile_discovery_change();
```

#### 6.2.2 Re-Eligibility Decision

**Option A: Automatic (risky)**
```sql
-- Exclude only if decided AND profile hasn't changed
WHERE p.public_id NOT IN (
  SELECT pd.target_profile_public_id
  FROM discovery.profile_decisions pd
  JOIN core.profiles p ON p.public_id = pd.target_profile_public_id
  WHERE pd.actor_profile_id = $actor_id
    AND p.discovery_eligibility_version <= pd.seen_at_eligibility_version
    --  ⬆️ Only exclude if version hasn't changed since decision
)
```

**Option B: Explicit Re-Opt-In (safer)**
```sql
-- Add seen_at_eligibility_version to profile_decisions
ALTER TABLE discovery.profile_decisions
ADD COLUMN seen_at_eligibility_version INTEGER NOT NULL DEFAULT 1;

-- User must explicitly "re-enter discovery" by updating their profile
-- Backend validates that change is significant enough
-- Only then does eligibility_version increment
```

**Option C: Time-Based (hybrid)**
```sql
-- Exclude only if decided within last N days
WHERE p.public_id NOT IN (
  SELECT target_profile_public_id
  FROM discovery.profile_decisions
  WHERE actor_profile_id = $actor_id
    AND decided_at > NOW() - INTERVAL '90 days'  -- Re-eligible after 90 days
)
```

### 6.3 Recommended Rule by Profile Type

| Profile Type | V1/V2 Rule | Future V3+ Option |
|--------------|-----------|-------------------|
| **Dummy Profiles** | Never repeat once decided | Never repeat (permanent) |
| **Real Users (passed)** | Never repeat once passed | Time-based re-eligibility after 90+ days + profile change |
| **Real Users (liked)** | Never repeat once liked | Only if mutual match expires OR user profile changes significantly |

### 6.4 Change Significance Levels

**For future change-tracking:**

| Significance | Examples | Re-Eligibility Impact |
|--------------|----------|----------------------|
| **Minor** | Typo fix, pronouns tweak | No re-eligibility |
| **Major** | New photos, bio rewrite, location change | Potential re-eligibility after 90 days |
| **Critical** | Relationship goals change, gender identity update | Immediate re-eligibility if product allows |

### 6.5 Final Recommendation

**For v1/v2 (current):**
> **Implement permanent exclusion for all profiles (real and dummy) once decided. No repeats.**

**For v3+ (future):**
> **Add change-tracking infrastructure now (profile_change_log table), but don't enable re-eligibility until product requirements are clear.**

**Why wait:**
1. UX implications are complex (user expectations, privacy)
2. Match system complexity increases
3. Need A/B testing to validate user response
4. Must avoid "stalking" or "rejection loop" patterns

---

## 7. Logging and Observability

### 7.1 Critical Log Events

Based on debugging lessons, log these events with structured JSON:

#### 7.1.1 Window Request

```typescript
{
  event: "discovery_window_requested",
  requestId: string,
  userId: number,
  actorProfileId: number,
  requestedSize: number,
  hasCursor: boolean,
  filtersHash: string,
}
```

#### 7.1.2 Window Response

```typescript
{
  event: "discovery_window_response",
  requestId: string,
  actorProfileId: number,
  queueVersion: number,
  policyVersion: string,
  windowSize: number,
  returnedProfilePublicIds: string[],  // ✅ Use public IDs
  eligibleRealCount: number,
  eligibleDummyCount: number,
  returnedRealCount: number,
  returnedDummyCount: number,
  dominantExclusionReason: string | null,
  exhausted: boolean,
  latencyMs: number,
}
```

#### 7.1.3 Decision Request

```typescript
{
  event: "discovery_decision_requested",
  requestId: string,
  userId: number,
  actorProfileId: number,
  targetProfilePublicId: string,  // ✅ Use public ID
  action: "like" | "pass",
  queueVersion: number,
  presentedPosition: number,
  visibleProfilePublicIds: string[],  // ✅ Use public IDs
}
```

#### 7.1.4 Decision Applied

```typescript
{
  event: "discovery_decision_applied",
  requestId: string,
  actorProfileId: number,
  targetProfilePublicId: string,  // ✅ Use public ID
  action: "like" | "pass",
  interactionId: number,
  decisionApplied: true,
  projectionRebuildMs: number,
  previousTotals: {
    totalLikes: number,
    totalPasses: number,
  },
  nextTotals: {
    totalLikes: number,
    totalPasses: number,
  },
  replacementProfilePublicId: string | null,  // ✅ Use public ID
  latencyMs: number,
}
```

#### 7.1.5 Decision Rejected

```typescript
{
  event: "discovery_decision_rejected",
  requestId: string,
  actorProfileId: number,
  targetProfilePublicId: string,  // ✅ Use public ID
  action: "like" | "pass",
  decisionApplied: false,
  rejectionReason: "duplicate_request_id" | "same_state_existing_decision" | "target_not_found",
  latencyMs: number,
}
```

#### 7.1.6 Identity Drift Detection

```typescript
{
  event: "identity_drift_detected",
  severity: "warning",
  actorProfileId: number,
  targetProfileNumericId: number,
  targetProfilePublicId: string | null,
  context: "decision" | "window" | "replacement",
  message: "Target profile numeric ID found but public_id lookup failed",
}
```

#### 7.1.7 Queue Exhaustion

```typescript
{
  event: "discovery_queue_exhausted",
  actorProfileId: number,
  queueVersion: number,
  exhaustedReason: string,
  eligibleRealCount: 0,
  eligibleDummyCount: 0,
  decidedCount: number,
  filtersHash: string,
}
```

#### 7.1.8 Duplicate Profile Detected

```typescript
{
  event: "duplicate_profile_in_window",
  severity: "error",
  actorProfileId: number,
  duplicateProfilePublicId: string,  // ✅ Use public ID
  queueVersion: number,
  positions: number[],  // [1, 3] if duplicate in slot 1 and 3
  message: "Profile appeared multiple times in single window response",
}
```

### 7.2 Log Levels

| Event Type | Level | When to Use |
|------------|-------|-------------|
| Window requested | INFO | Always |
| Window response | INFO | Always |
| Decision requested | INFO | Always |
| Decision applied | INFO | Always |
| Decision rejected (duplicate requestId) | WARN | Idempotency fallback |
| Decision rejected (same state) | INFO | Valid re-submission |
| Identity drift | ERROR | Should never happen after v2 |
| Duplicate profile in window | ERROR | Should never happen |
| Queue exhausted | INFO | Normal for small pools |
| Exclusion query slow (>100ms) | WARN | Performance issue |

### 7.3 Tracing

**Use request IDs** for distributed tracing:
```typescript
const requestId = headers["x-matcha-request-id"] || generateUUID();

// Include in all logs
logger.info({
  requestId,
  event: "discovery_window_requested",
  // ...
});

// Pass to all service calls
await discoveryService.getWindow(userId, { requestId });
```

### 7.4 Metrics

**Track these key metrics:**

1. **Latency:**
   - `discovery_window_latency_ms` (p50, p95, p99)
   - `discovery_decision_latency_ms` (p50, p95, p99)
   - `projection_rebuild_latency_ms` (p50, p95, p99)

2. **Success Rate:**
   - `discovery_decision_applied_count` (counter)
   - `discovery_decision_rejected_count` (counter, by reason)
   - `discovery_window_success_rate` (%)

3. **Supply Health:**
   - `discovery_eligible_real_count` (gauge, by actor)
   - `discovery_eligible_dummy_count` (gauge, by actor)
   - `discovery_exhausted_actors_count` (gauge)
   - `discovery_exhaustion_reason_count` (counter, by reason)

4. **Identity Consistency:**
   - `discovery_identity_drift_count` (counter) - should be 0 after v2
   - `discovery_duplicate_profile_count` (counter) - should be 0

5. **Queue Health:**
   - `discovery_queue_version_count` (gauge) - active queue versions per actor
   - `discovery_queue_invalidation_count` (counter, by reason)

### 7.5 Alerts

**Set up alerts for:**

1. **Error Rate > 1%**
   - Alert: `discovery_decision_error_rate > 0.01 for 5m`
   - Action: Investigate logs for error patterns

2. **Identity Drift Detected**
   - Alert: `discovery_identity_drift_count > 0 for 1m`
   - Action: Immediate investigation, potential data corruption

3. **High Latency**
   - Alert: `discovery_decision_p95_latency > 500ms for 5m`
   - Action: Check DB query performance, add indexes

4. **High Exhaustion Rate**
   - Alert: `discovery_exhausted_actors_count / total_active_actors > 0.20 for 10m`
   - Action: Review dummy profile supply, filter defaults

5. **Duplicate Profile Bug**
   - Alert: `discovery_duplicate_profile_count > 0 for 1m`
   - Action: Immediate bug investigation, potential queue corruption

---

## 8. Migration and Refinement Plan

### 8.1 Phased Approach

**Phase 1: Foundation (Week 1-2)**
- ✅ Add `target_profile_public_id` to `actor_queue`
- ✅ Backfill existing queue rows with public IDs
- ✅ Add `hydration_level` column to `actor_queue`
- ✅ Update all queries to use public_id for exclusion
- ✅ Add logging for identity operations

**Phase 2: API Contract Transition (Week 3-4)**
- ✅ Update `POST /decision` to accept `targetProfilePublicId`
- ✅ Maintain backward compatibility with numeric IDs
- ✅ Update responses to include explicit `position` and `hydrationLevel`
- ✅ Deploy and monitor for errors

**Phase 3: Client Migration (Week 5-6)**
- ✅ Update mobile app to use `targetProfilePublicId`
- ✅ Update mobile app to respect `hydrationLevel` hints
- ✅ Gradual rollout with feature flags
- ✅ Monitor client logs for errors

**Phase 4: Profile Change Tracking (Week 7-8)**
- ✅ Create `profile_change_log` table
- ✅ Add `discovery_eligibility_version` to `core.profiles`
- ✅ Create triggers to track material changes
- ✅ Deploy but don't enable re-eligibility yet

**Phase 5: Optimization (Week 9-10)**
- ✅ Add decision count cache to `actor_state`
- ✅ Optimize exclusion queries with cached counts
- ✅ Add indexes based on production query patterns
- ✅ Review and tune DB performance

**Phase 6: Deprecation (Week 11-12)**
- ✅ Remove support for numeric `targetProfileId` in requests
- ✅ Remove numeric `id` from profile responses (keep only `publicId`)
- ✅ Drop redundant numeric ID columns from queue table
- ✅ Final cleanup and documentation

### 8.2 Rollback Plan

**At each phase:**
1. Feature flag all changes
2. Maintain dual code paths during transition
3. Keep old API contracts working for 2+ weeks
4. Monitor error rates and rollback if > 1% error rate
5. Have DB migration rollback scripts ready

**Rollback triggers:**
- Identity drift detected
- Error rate spike
- Latency degradation > 2x baseline
- Client crash rate increase

### 8.3 Testing Strategy

#### Unit Tests
```typescript
describe("Discovery Service", () => {
  it("excludes profiles by public_id consistently", async () => {
    // Test that numeric and public_id exclusion produce same results
  });
  
  it("returns exactly 3 slots for window", async () => {
    // Test 3-slot contract
  });
  
  it("never returns just-decided profile as replacement", async () => {
    // Test critical exclusion logic
  });
  
  it("handles identity drift gracefully", async () => {
    // Test when numeric ID exists but public_id doesn't match
  });
});
```

#### Integration Tests
```typescript
describe("Discovery Endpoints", () => {
  it("GET /window returns 3 slots with hydration levels", async () => {
    const response = await request(app).get("/api/discovery/window");
    expect(response.body.slots).toHaveLength(3);
    expect(response.body.slots[0].hydrationLevel).toBe("full");
    expect(response.body.slots[2].hydrationLevel).toBe("metadata");
  });
  
  it("POST /decision returns single replacement for slot C", async () => {
    const response = await request(app)
      .post("/api/discovery/decision")
      .send({
        targetProfilePublicId: "abc123",
        action: "like",
      });
    expect(response.body.replacementProfile).toBeDefined();
    expect(response.body.replacementProfile.position).toBe(3);
  });
  
  it("POST /decision excludes just-decided profile from replacement", async () => {
    // Swipe on profile A
    // Verify replacement is not profile A
  });
});
```

#### End-to-End Tests
```typescript
describe("Discovery Flow", () => {
  it("complete discovery session maintains no-repeat invariant", async () => {
    const session = await createTestSession();
    const seenPublicIds = new Set<string>();
    
    // Get initial window
    const window = await session.getWindow();
    window.slots.forEach(slot => seenPublicIds.add(slot.profile.publicId));
    
    // Swipe through 20 profiles
    for (let i = 0; i < 20; i++) {
      const decision = await session.decide({
        targetProfilePublicId: window.slots[0].profile.publicId,
        action: "like",
      });
      
      if (decision.replacementProfile) {
        // Verify replacement is not a duplicate
        expect(seenPublicIds.has(decision.replacementProfile.profile.publicId)).toBe(false);
        seenPublicIds.add(decision.replacementProfile.profile.publicId);
      }
    }
  });
});
```

### 8.4 Data Migration Scripts

#### Add public_id to actor_queue
```sql
-- Migration: 0010_actor_queue_public_id.sql

BEGIN;

-- Add column
ALTER TABLE discovery.actor_queue
ADD COLUMN target_profile_public_id VARCHAR(64);

-- Backfill
UPDATE discovery.actor_queue aq
SET target_profile_public_id = p.public_id
FROM core.profiles p
WHERE aq.target_profile_id = p.id;

-- Validate (should be 0)
SELECT COUNT(*) FROM discovery.actor_queue
WHERE target_profile_public_id IS NULL;

-- Make NOT NULL
ALTER TABLE discovery.actor_queue
ALTER COLUMN target_profile_public_id SET NOT NULL;

-- Add index
CREATE INDEX actor_queue_target_public_id_idx
ON discovery.actor_queue(target_profile_public_id);

COMMIT;
```

#### Add hydration_level to actor_queue
```sql
-- Migration: 0011_actor_queue_hydration_level.sql

BEGIN;

-- Add column with default
ALTER TABLE discovery.actor_queue
ADD COLUMN hydration_level VARCHAR(16) DEFAULT 'full'
CHECK (hydration_level IN ('full', 'partial', 'metadata'));

-- Update based on position (if queue positions exist)
UPDATE discovery.actor_queue
SET hydration_level = CASE
  WHEN position = 1 THEN 'full'
  WHEN position = 2 THEN 'partial'
  WHEN position = 3 THEN 'metadata'
  ELSE 'full'
END;

COMMIT;
```

#### Create profile_change_log table
```sql
-- Migration: 0012_profile_change_log.sql

BEGIN;

CREATE TABLE discovery.profile_change_log (
  profile_id BIGINT NOT NULL REFERENCES core.profiles(id) ON DELETE CASCADE,
  change_version INTEGER NOT NULL DEFAULT 1,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_fields JSONB NOT NULL DEFAULT '{}',
  change_significance VARCHAR(32) NOT NULL 
    CHECK (change_significance IN ('minor', 'major', 'critical')),
  change_type VARCHAR(64),
  PRIMARY KEY (profile_id, change_version)
);

CREATE INDEX profile_change_log_changed_at_idx
ON discovery.profile_change_log(profile_id, changed_at DESC);

COMMIT;
```

#### Add eligibility_version to profiles
```sql
-- Migration: 0013_profile_eligibility_version.sql

BEGIN;

ALTER TABLE core.profiles
ADD COLUMN discovery_eligibility_version INTEGER NOT NULL DEFAULT 1,
ADD COLUMN last_discovery_material_change_at TIMESTAMPTZ;

CREATE INDEX profiles_discovery_eligibility_idx
ON core.profiles(discovery_eligibility_version, last_discovery_material_change_at)
WHERE is_discoverable = true;

COMMIT;
```

### 8.5 Deployment Checklist

**Pre-Deployment:**
- [ ] All migrations tested in staging
- [ ] Feature flags configured
- [ ] Rollback scripts prepared
- [ ] Monitoring dashboards updated
- [ ] Alert rules configured
- [ ] Load testing completed
- [ ] Documentation updated

**Deployment:**
- [ ] Deploy DB migrations (with rollback window)
- [ ] Deploy backend code (with feature flags off)
- [ ] Enable feature flags for 1% traffic
- [ ] Monitor error rates and latency
- [ ] Gradually increase to 10%, 50%, 100%
- [ ] Monitor for 24 hours at each stage

**Post-Deployment:**
- [ ] Verify no identity drift errors
- [ ] Verify no duplicate profile errors
- [ ] Verify latency within acceptable range
- [ ] Verify supply health metrics stable
- [ ] Update client apps to use new contracts
- [ ] Deprecate old endpoints after 2 weeks

---

## 9. Summary and Next Steps

### 9.1 Key Recommendations

1. **✅ Identity Model:** Use `profile.public_id` as canonical everywhere. Migrate `actor_queue` to use public IDs.

2. **✅ 3-Slot Support:** Add explicit `hydration_level` to queue and responses. Backend enforces 3-slot model.

3. **✅ Endpoint Contracts:** Update to accept/return public IDs. Add position and hydration metadata.

4. **✅ No-Repeat Rule:** Permanently exclude all decided profiles (real and dummy) in v1/v2. Add change-tracking infrastructure for future.

5. **✅ Logging:** Implement structured logging with request ID tracing. Use public IDs in all logs.

6. **✅ Migration:** Phased approach over 12 weeks with feature flags and rollback plans.

### 9.2 Priority Order

**P0 (Critical - Fix now):**
- Add `target_profile_public_id` to `actor_queue`
- Update all exclusion queries to use public IDs consistently
- Add logging for identity operations

**P1 (High - Fix in v2):**
- Update API contracts to accept `targetProfilePublicId`
- Add explicit 3-slot hydration metadata
- Implement comprehensive logging and monitoring

**P2 (Medium - Fix in v3):**
- Add profile change tracking infrastructure
- Optimize exclusion queries with caching
- Remove deprecated numeric ID contracts

**P3 (Low - Future):**
- Implement conditional re-eligibility (if product requires)
- Add advanced supply optimization
- Build candidate pool pre-filtering

### 9.3 Success Metrics

**After v2 deployment, we should see:**
- ✅ 0 identity drift errors
- ✅ 0 duplicate profile errors
- ✅ < 0.1% decision rejection rate (excluding legitimate duplicates)
- ✅ < 300ms p95 decision latency
- ✅ < 200ms p95 window latency
- ✅ > 99.9% decision success rate

### 9.4 Long-Term Vision

**The ideal discovery system:**
- Backend is fully authoritative (frontend is just a view)
- Identity is consistent and canonical everywhere
- Queue continuity is seamless across swipes
- Real users are prioritized, dummies are graceful fallback
- No profile is ever shown twice (unless explicitly allowed by product)
- System scales to millions of users and decisions
- Observability enables rapid debugging and optimization

---

## Appendix: References

- **Current Implementation:** `artifacts/api-server/src/modules/discovery/discovery.service.ts`
- **Schema Definition:** `lib/db/src/schema/index.ts`
- **API Controller:** `artifacts/api-server/src/modules/discovery/discovery.controller.ts`
- **Frontend Queue Logic:** `artifacts/matcha-app/utils/discoveryQueue.ts`
- **Recent Fixes:** Identity bug fix commit (public_id in decisions, exclusion)

---

**Document End**

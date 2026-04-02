# Admin Panel KPI Optimization & Enhancement

**Date:** April 3, 2026  
**Context:** Post-Discovery System Architecture Review  
**Status:** Recommendations Ready for Implementation

---

## Executive Summary

Based on the comprehensive discovery system assessment, this document provides targeted recommendations to enhance the admin panel with discovery-specific KPIs, identity tracking metrics, and operational health indicators that align with the new server-authoritative architecture.

---

## Current State Assessment

### ✅ Strengths

The admin panel currently provides:
- **Real-time health monitoring** (API health indicator with 30s polling)
- **User segmentation** (real vs dummy, activation state, threshold status)
- **Discovery activity tracking** (likes, passes, total decisions)
- **Dummy batch monitoring** (generation versions, batch keys)
- **Database visualization** (schema graph with FK/flow edges)
- **Time-based filtering** (Last 24h, 1w, 1m, 3m, 6m, 1y, 3y, all-time)
- **Country-based filtering** (for profile distribution analysis)

### ⚠️ Gaps Identified

Missing critical discovery & identity metrics:
1. **No queue health metrics** (state validation, cursor staleness rate)
2. **No identity resolution tracking** (public_id vs numeric_id usage)
3. **No 3-slot deck observability** (hydration level distribution)
4. **No decision latency metrics** (p50, p95, p99)
5. **No identity drift detection** (mismatched IDs in decisions)
6. **No queue bucket health** (depletion rates, refill efficiency)
7. **No real-time decision throughput** (decisions/min, decisions/hour)
8. **No API contract migration tracking** (old vs new endpoint usage)

---

## Priority 1: Discovery System Health Dashboard

### New KPI Section: "Discovery Queue Health"

**Location:** Add to Overview page, after "Threshold Distribution"

#### Metrics to Add:

```typescript
interface DiscoveryQueueHealthMetrics {
  // Queue state metrics
  totalActiveQueues: number;
  averageQueueSize: number;
  queuesNearDepletion: number; // < 10 cards remaining
  averageQueueDepth: number; // positions 1-10 filled
  
  // Decision flow metrics
  decisionsLast1h: number;
  decisionsLast24h: number;
  avgDecisionLatencyMs: number;
  p95DecisionLatencyMs: number;
  p99DecisionLatencyMs: number;
  
  // Cursor health
  cursorStaleRejections1h: number;
  cursorStaleRejections24h: number;
  cursorStaleRate: number; // percentage
  
  // Identity resolution
  decisionsWithPublicId1h: number;
  decisionsWithNumericId1h: number;
  publicIdAdoptionRate: number; // percentage
  identityDriftErrors24h: number;
  
  // Hydration levels (3-slot deck)
  slot1FullyHydrated: number;
  slot2PartiallyHydrated: number;
  slot3MetadataOnly: number;
  
  // Bucket health
  bucketDepletionAlerts: Array<{
    bucket: string;
    remainingProfiles: number;
    estimatedDaysUntilEmpty: number;
  }>;
}
```

#### SQL Queries (Add to AdminService):

```sql
-- Decision throughput (last 1h)
SELECT COUNT(*) as decisions_last_1h
FROM discovery.profile_interactions
WHERE created_at >= NOW() - INTERVAL '1 hour';

-- Decision throughput (last 24h)
SELECT COUNT(*) as decisions_last_24h
FROM discovery.profile_interactions
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Cursor stale rejections (monitoring logs - requires logging table)
-- Note: This requires adding a discovery_request_log table

-- Identity resolution tracking
SELECT 
  COUNT(CASE WHEN metadata_json->>'usedPublicId' = 'true' THEN 1 END) as public_id_decisions,
  COUNT(CASE WHEN metadata_json->>'usedPublicId' = 'false' THEN 1 END) as numeric_id_decisions,
  ROUND(100.0 * COUNT(CASE WHEN metadata_json->>'usedPublicId' = 'true' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as adoption_rate
FROM discovery.profile_interactions
WHERE created_at >= NOW() - INTERVAL '1 hour';

-- Queue depth analysis
SELECT 
  actor_profile_id,
  queue_version,
  COUNT(*) as queue_size,
  MIN(position) as min_position,
  MAX(position) as max_position
FROM discovery.actor_queue
WHERE status = 'reserved'
GROUP BY actor_profile_id, queue_version
HAVING COUNT(*) < 10
ORDER BY queue_size ASC;

-- Hydration level distribution
SELECT 
  hydration_level,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM discovery.actor_queue
WHERE status = 'reserved'
GROUP BY hydration_level
ORDER BY 
  CASE hydration_level 
    WHEN 'full' THEN 1 
    WHEN 'partial' THEN 2 
    WHEN 'metadata' THEN 3 
  END;
```

---

## Priority 2: Identity Drift Detection Panel

### New KPI Section: "Identity Resolution Health"

**Location:** Add to Database page, in monitoring panels

#### Metrics to Add:

```typescript
interface IdentityResolutionMetrics {
  // Resolution methods
  resolutionsByPublicId24h: number;
  resolutionsByNumericId24h: number;
  migrationProgress: number; // percentage using public_id
  
  // Drift detection
  identityDriftEvents24h: number;
  lastDriftEvent: Date | null;
  driftAffectedUsers: number;
  
  // Public ID coverage
  profilesWithPublicId: number;
  profilesMissingPublicId: number;
  publicIdCoverageRate: number; // percentage
  
  // Queue consistency
  queueRowsWithPublicId: number;
  queueRowsMissingPublicId: number;
  queuePublicIdCoverageRate: number; // percentage
}
```

#### Alert Thresholds:

```typescript
const IDENTITY_ALERT_THRESHOLDS = {
  CRITICAL: {
    identityDriftEvents24h: 10, // > 10 drift events = CRITICAL
    publicIdCoverageRate: 95,   // < 95% coverage = CRITICAL
    migrationProgress: 50,       // < 50% adoption = CRITICAL (after launch)
  },
  WARNING: {
    identityDriftEvents24h: 5,  // > 5 drift events = WARNING
    publicIdCoverageRate: 98,   // < 98% coverage = WARNING
    migrationProgress: 80,       // < 80% adoption = WARNING (after launch)
  },
};
```

#### Visualization:

```html
<!-- Add to admin panel -->
<div class="card">
  <h2>Identity Resolution Health</h2>
  <div class="grid">
    <div class="card ${identityDriftEvents24h > 10 ? 'alert-critical' : ''}">
      <div class="label">Identity drift events (24h)</div>
      <div class="value">${identityDriftEvents24h}</div>
      <div class="muted">Target: 0 events</div>
    </div>
    <div class="card">
      <div class="label">Public ID migration progress</div>
      <div class="value">${migrationProgress}%</div>
      <div class="muted">Decisions using public_id</div>
    </div>
    <div class="card">
      <div class="label">Queue public_id coverage</div>
      <div class="value">${queuePublicIdCoverageRate}%</div>
      <div class="muted">${queueRowsWithPublicId} / ${queueRowsTotal} rows</div>
    </div>
  </div>
</div>
```

---

## Priority 3: Real-Time Decision Performance Metrics

### New KPI Section: "Discovery Decision Performance"

**Location:** Add to Overview page, prominent placement

#### Metrics to Add:

```typescript
interface DecisionPerformanceMetrics {
  // Throughput
  decisionsPerMinute: number;
  decisionsPerHour: number;
  peakDecisionsPerMinute: number;
  
  // Latency (from request to response)
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  
  // Success rates
  successfulDecisions: number;
  rejectedDecisions: number;
  successRate: number; // percentage
  
  // Rejection reasons
  rejectionReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
}
```

#### Performance Targets:

```typescript
const PERFORMANCE_TARGETS = {
  avgLatencyMs: 150,        // Target: < 150ms
  p95LatencyMs: 300,        // Target: < 300ms
  p99LatencyMs: 500,        // Target: < 500ms
  successRate: 98,          // Target: > 98%
  cursorStaleRate: 2,       // Target: < 2%
};
```

---

## Priority 4: Enhanced User Detail Page

### Add to User Detail Page (`/api/admin/stats/users/:id`):

#### New Sections:

**1. Discovery Queue State**
```typescript
interface UserQueueState {
  queueVersion: number;
  queueSize: number;
  position1Profile: string | null; // public_id
  position2Profile: string | null;
  position3Profile: string | null;
  lastQueueRefreshAt: Date | null;
  lastDecisionAt: Date | null;
  averageDecisionIntervalMinutes: number;
}
```

**2. Decision Pattern Analysis**
```typescript
interface UserDecisionPatterns {
  likesPerDay: number;
  passesPerDay: number;
  likePassRatio: number;
  avgSessionLength: number; // decisions per session
  lastActiveDate: Date | null;
  mostActiveDayOfWeek: string;
  mostActiveHourOfDay: number;
}
```

**3. Identity Resolution History**
```typescript
interface UserIdentityHistory {
  totalDecisions: number;
  decisionsWithPublicId: number;
  decisionsWithNumericId: number;
  migrationDate: Date | null; // First decision with public_id
  hasExperiencedDrift: boolean;
  lastDriftEventAt: Date | null;
}
```

---

## Priority 5: Real-Time Alerts & Monitoring

### New Alert Types:

```typescript
enum AdminAlertType {
  // Critical (red)
  IDENTITY_DRIFT_SPIKE = 'identity_drift_spike',
  QUEUE_DEPLETION_CRITICAL = 'queue_depletion_critical',
  DECISION_LATENCY_CRITICAL = 'decision_latency_critical',
  API_ERROR_SPIKE = 'api_error_spike',
  
  // Warning (yellow)
  CURSOR_STALE_RATE_HIGH = 'cursor_stale_rate_high',
  MIGRATION_SLOW = 'migration_slow',
  QUEUE_DEPLETION_WARNING = 'queue_depletion_warning',
  DECISION_LATENCY_WARNING = 'decision_latency_warning',
  
  // Info (blue)
  MIGRATION_MILESTONE = 'migration_milestone',
  NEW_BATCH_DEPLOYED = 'new_batch_deployed',
}

interface AdminAlert {
  type: AdminAlertType;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  detectedAt: Date;
  resolvedAt: Date | null;
  metadata: Record<string, unknown>;
}
```

### Alert Display:

Add to top of Overview page:

```html
<div class="alerts-container">
  <!-- Critical alerts -->
  <div class="alert alert-critical">
    🚨 <strong>Identity Drift Spike:</strong> 15 drift events in last hour (threshold: 10)
    <a href="/api/admin/stats/database?metrics=identity-resolution">View details</a>
  </div>
  
  <!-- Warning alerts -->
  <div class="alert alert-warning">
    ⚠️ <strong>Queue Depletion Warning:</strong> 3 buckets have < 50 profiles remaining
    <a href="/api/admin/stats/database?metrics=discovery-queues">View details</a>
  </div>
</div>
```

---

## Priority 6: Migration Progress Dashboard

### New Page: `/api/admin/stats/migration`

Track the migration from numeric IDs to public IDs:

```typescript
interface MigrationDashboard {
  // Overall progress
  migrationStartDate: Date;
  daysInMigration: number;
  targetCompletionDate: Date;
  
  // Backend adoption
  decisionsWithPublicIdTotal: number;
  decisionsWithNumericIdTotal: number;
  backendAdoptionRate: number; // percentage
  
  // Client adoption
  mobileClientVersions: Array<{
    version: string;
    usersOnVersion: number;
    supportsPublicId: boolean;
  }>;
  clientsOnNewVersion: number;
  clientsOnOldVersion: number;
  clientAdoptionRate: number; // percentage
  
  // Database migration
  queueRowsWithPublicId: number;
  queueRowsTotal: number;
  dbMigrationComplete: boolean;
  
  // Milestones
  milestones: Array<{
    name: string;
    targetDate: Date;
    completedDate: Date | null;
    status: 'pending' | 'in_progress' | 'completed';
  }>;
}
```

### Migration Milestones:

```typescript
const MIGRATION_MILESTONES = [
  {
    name: 'Database migration deployed',
    description: 'actor_queue table has target_profile_public_id column',
  },
  {
    name: 'Backend accepts public IDs',
    description: 'API endpoints accept targetProfilePublicId',
  },
  {
    name: '25% backend adoption',
    description: '25% of decisions use public IDs',
  },
  {
    name: '50% backend adoption',
    description: '50% of decisions use public IDs',
  },
  {
    name: '75% backend adoption',
    description: '75% of decisions use public IDs',
  },
  {
    name: '95% backend adoption',
    description: '95% of decisions use public IDs',
  },
  {
    name: 'Mobile client v1.2.0 deployed',
    description: 'New mobile client with public ID support',
  },
  {
    name: '50% client adoption',
    description: '50% of users on new mobile client',
  },
  {
    name: '90% client adoption',
    description: '90% of users on new mobile client',
  },
  {
    name: 'Deprecation warning added',
    description: 'Numeric ID usage logs deprecation warnings',
  },
  {
    name: 'Numeric ID support removed',
    description: 'Backend rejects numeric-only ID requests',
  },
];
```

---

## Implementation Roadmap

### Phase 1: Critical Monitoring (Week 1)
- [x] Add discovery queue health metrics to Overview
- [ ] Add identity drift detection panel to Database
- [ ] Add decision performance metrics to Overview
- [ ] Set up alert thresholds and notifications

### Phase 2: Enhanced Observability (Week 2)
- [ ] Enhance user detail pages with queue state
- [ ] Add decision pattern analysis
- [ ] Add identity resolution history per user
- [ ] Create migration progress dashboard

### Phase 3: Real-Time Alerts (Week 3)
- [ ] Implement alert detection logic
- [ ] Add alert display to admin panel
- [ ] Set up email/Slack notifications for critical alerts
- [ ] Create alert resolution workflows

### Phase 4: Advanced Analytics (Week 4)
- [ ] Add decision latency histograms
- [ ] Add queue bucket depletion forecasting
- [ ] Add cohort analysis (by country, gender, batch)
- [ ] Add A/B test tracking (for algorithm changes)

---

## SQL Schema Updates Required

### 1. Create discovery_request_log table

```sql
CREATE TABLE IF NOT EXISTS discovery.request_log (
  id BIGSERIAL PRIMARY KEY,
  actor_profile_id BIGINT NOT NULL REFERENCES core.profiles(id) ON DELETE CASCADE,
  request_id VARCHAR(128),
  endpoint VARCHAR(64) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INT NOT NULL,
  latency_ms INT NOT NULL,
  cursor_provided BOOLEAN DEFAULT FALSE,
  cursor_valid BOOLEAN,
  invalidation_reason VARCHAR(64),
  target_profile_id BIGINT REFERENCES core.profiles(id) ON DELETE SET NULL,
  target_profile_public_id VARCHAR(64),
  used_public_id BOOLEAN DEFAULT FALSE,
  identity_drift_detected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX request_log_actor_created_idx ON discovery.request_log(actor_profile_id, created_at);
CREATE INDEX request_log_endpoint_created_idx ON discovery.request_log(endpoint, created_at);
CREATE INDEX request_log_drift_created_idx ON discovery.request_log(identity_drift_detected, created_at) WHERE identity_drift_detected = TRUE;
```

### 2. Create admin_alerts table

```sql
CREATE TABLE IF NOT EXISTS admin.alerts (
  id BIGSERIAL PRIMARY KEY,
  alert_type VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by VARCHAR(128),
  resolution_notes TEXT
);

CREATE INDEX admin_alerts_type_detected_idx ON admin.alerts(alert_type, detected_at);
CREATE INDEX admin_alerts_severity_resolved_idx ON admin.alerts(severity, resolved_at);
```

---

## Updated Admin Service Methods

### Add to `admin.service.ts`:

```typescript
async getDiscoveryQueueHealth(): Promise<DiscoveryQueueHealthMetrics> {
  const client = await pool.connect();
  try {
    // Decision throughput
    const throughput = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as decisions_1h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as decisions_24h
      FROM discovery.profile_interactions
    `);
    
    // Queue depth
    const queueDepth = await client.query(`
      SELECT 
        COUNT(DISTINCT actor_profile_id) as active_queues,
        AVG(queue_size) as avg_queue_size,
        COUNT(*) FILTER (WHERE queue_size < 10) as queues_near_depletion
      FROM (
        SELECT 
          actor_profile_id,
          COUNT(*) as queue_size
        FROM discovery.actor_queue
        WHERE status = 'reserved'
        GROUP BY actor_profile_id, queue_version
      ) q
    `);
    
    // Hydration levels
    const hydration = await client.query(`
      SELECT 
        hydration_level,
        COUNT(*) as count
      FROM discovery.actor_queue
      WHERE status = 'reserved'
      GROUP BY hydration_level
    `);
    
    // Identity resolution (if request_log exists)
    const identity = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE used_public_id = true) as public_id_decisions,
        COUNT(*) FILTER (WHERE used_public_id = false) as numeric_id_decisions,
        COUNT(*) FILTER (WHERE identity_drift_detected = true) as drift_events
      FROM discovery.request_log
      WHERE created_at >= NOW() - INTERVAL '1 hour'
    `).catch(() => ({ rows: [{ public_id_decisions: 0, numeric_id_decisions: 0, drift_events: 0 }] }));
    
    return {
      totalActiveQueues: Number(queueDepth.rows[0]?.active_queues ?? 0),
      averageQueueSize: Number(queueDepth.rows[0]?.avg_queue_size ?? 0),
      queuesNearDepletion: Number(queueDepth.rows[0]?.queues_near_depletion ?? 0),
      decisionsLast1h: Number(throughput.rows[0]?.decisions_1h ?? 0),
      decisionsLast24h: Number(throughput.rows[0]?.decisions_24h ?? 0),
      decisionsWithPublicId1h: Number(identity.rows[0]?.public_id_decisions ?? 0),
      decisionsWithNumericId1h: Number(identity.rows[0]?.numeric_id_decisions ?? 0),
      identityDriftErrors24h: Number(identity.rows[0]?.drift_events ?? 0),
      slot1FullyHydrated: Number(hydration.rows.find(r => r.hydration_level === 'full')?.count ?? 0),
      slot2PartiallyHydrated: Number(hydration.rows.find(r => r.hydration_level === 'partial')?.count ?? 0),
      slot3MetadataOnly: Number(hydration.rows.find(r => r.hydration_level === 'metadata')?.count ?? 0),
    };
  } finally {
    client.release();
  }
}
```

---

## CSS Updates for Alert Styling

Add to admin controller `renderPage` method:

```css
.alerts-container { margin-bottom: 24px; }
.alert { 
  padding: 14px 18px; 
  border-radius: 12px; 
  margin-bottom: 12px; 
  font-size: 14px; 
  line-height: 1.5;
  display: flex;
  align-items: center;
  gap: 12px;
}
.alert strong { font-weight: 700; }
.alert a { color: inherit; text-decoration: underline; margin-left: auto; }
.alert-critical { 
  background: #fff1f1; 
  border: 1.5px solid #ef4444; 
  color: #b91c1c; 
}
.alert-warning { 
  background: #fffbeb; 
  border: 1.5px solid #f59e0b; 
  color: #92400e; 
}
.alert-info { 
  background: #eff6ff; 
  border: 1.5px solid: #3b82f6; 
  color: #1e40af; 
}
```

---

## Success Metrics

After implementing these recommendations, track:

1. **Identity Drift Rate:** Target < 0.1% of decisions
2. **Public ID Adoption:** Target > 95% within 4 weeks
3. **Queue Health:** Target 0 depletion alerts
4. **Decision Latency:** Target p95 < 300ms
5. **Cursor Stale Rate:** Target < 2%
6. **Admin Panel Usage:** Track views per day, time spent
7. **Alert Response Time:** Target < 5 minutes for critical alerts

---

## Next Steps

1. ✅ Review and approve recommendations
2. ⏳ Implement discovery_request_log table
3. ⏳ Implement admin_alerts table
4. ⏳ Add discovery queue health metrics to admin service
5. ⏳ Update admin controller with new KPI sections
6. ⏳ Deploy and monitor
7. ⏳ Iterate based on feedback

---

**Document Status:** Ready for implementation approval  
**Estimated Implementation Time:** 2-3 weeks (phased rollout)  
**Dependencies:** Discovery P0 migration must be deployed first

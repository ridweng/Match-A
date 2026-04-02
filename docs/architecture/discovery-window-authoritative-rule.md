# Discovery Window Authoritative Rule Implementation

**Date:** April 3, 2026  
**Status:** Implementation in Progress  
**Goal:** Make GET /window the authoritative source for discovery data

---

## Rule Definition

### Use GET `/api/discovery/window` on:
1. **Discover tab init** (first entry or return from another tab)
2. **After filters are applied**
3. **Reload when there are no more cards** (exhausted state)
4. **Tab return from Goals/Profile/Settings** (unless valid cache exists)

### Only Exception:
**Skip GET /window** if the app already has an **internal 3-card cache** where:
- `discoveryQueueRuntime.queue.items.length === 3`
- All 3 items have valid profile data
- Items are distinct (no duplicates)

---

## Implementation Changes

### 1. Add Cache Validation Helper (AppContext.tsx)

```typescript
/**
 * Check if we have a valid authoritative 3-card discovery window cached
 * If false, the app MUST call GET /window
 */
function hasValidDiscoveryWindowCache(
  queueRuntime: DiscoveryQueueRuntime
): boolean {
  const items = queueRuntime.queue.items;
  
  // Must have exactly 3 cards
  if (!Array.isArray(items) || items.length !== 3) {
    return false;
  }
  
  // All items must have valid IDs and profiles
  const ids = new Set<number>();
  for (const item of items) {
    if (!item || !item.profile || !item.id) {
      return false;
    }
    
    // Check for duplicates
    if (ids.has(item.id)) {
      return false;
    }
    ids.add(item.id);
  }
  
  return true;
}
```

### 2. Update refreshDiscoveryCandidates (AppContext.tsx)

Make this always authoritative - it MUST call GET /window:

```typescript
const refreshDiscoveryCandidates = useCallback(async (): Promise<boolean> => {
  // Log why we're fetching authoritative window
  debugDiscoveryLog("authoritative_window_fetch", {
    reason: "refresh_candidates",
    hasAccessToken,
    isOnline,
  });
  
  if (!hasAccessToken) {
    debugDiscoveryWarn("authoritative_window_skipped", {
      reason: "no_access_token",
    });
    return false;
  }
  
  try {
    const result = await refreshDiscoveryFeed();
    // ... rest of implementation
  } catch (error) {
    // ... error handling
  }
}, [hasAccessToken, isOnline]);
```

### 3. Update Discover Screen Init (app/(tabs)/discover.tsx)

**Current behavior:**
```typescript
useEffect(() => {
  if (!pathname.endsWith("/discover") || !hasAccessToken) {
    return;
  }
  if (discoveryFeed.profiles.length === 0) {
    setIsQueueLoading(true);
    void refreshDiscoveryCandidates().finally(() => {
      setIsQueueLoading(false);
    });
  }
}, [pathname, hasAccessToken]);
```

**New behavior:**
```typescript
useEffect(() => {
  if (!pathname.endsWith("/discover") || !hasAccessToken) {
    return;
  }
  
  // Check if we have valid 3-card cache
  const hasValidCache = hasValidDiscoveryWindowCache(discoveryQueueRuntime);
  
  if (!hasValidCache) {
    debugDiscoveryLog("discover_entry_fetch_window", {
      reason: hasValidCache ? "no_valid_cache" : "cache_invalid",
      queueSize: discoveryQueueRuntime.queue.items.length,
    });
    
    setIsQueueLoading(true);
    void refreshDiscoveryCandidates().finally(() => {
      setIsQueueLoading(false);
    });
  } else {
    debugDiscoveryLog("discover_entry_cache_valid", {
      queueSize: discoveryQueueRuntime.queue.items.length,
    });
  }
}, [pathname, hasAccessToken, discoveryQueueRuntime]);
```

### 4. Update Filter Save to Invalidate Cache (AppContext.tsx)

```typescript
const saveDiscoveryFilters = useCallback(
  async (filters: DiscoveryFilters): Promise<boolean> => {
    debugDiscoveryLog("filters_changed", {
      filters,
      willInvalidateCache: true,
    });
    
    try {
      // Save filters
      await updateDiscoveryPreferences(filters);
      
      // Clear cache
      if (user?.id) {
        await clearDiscoveryFrontCardCache(user.id).catch(() => {});
      }
      
      // Invalidate queue runtime
      setDiscoveryQueueRuntimeRef.current = (prev) => ({
        ...prev,
        queue: {
          ...prev.queue,
          items: [],
          invalidationReason: "filters_changed",
        },
        status: "idle",
      });
      
      // Fetch authoritative window
      debugDiscoveryLog("filters_changed_fetching_window", {
        filters,
      });
      
      await refreshDiscoveryCandidates();
      
      return true;
    } catch (error) {
      debugDiscoveryWarn("filters_save_failed", { error });
      return false;
    }
  },
  [user?.id, refreshDiscoveryCandidates]
);
```

### 5. Update Empty State / Reload Button

When user manually reloads or hits empty state, MUST use GET /window:

```typescript
// In discover screen, reload button handler
const handleReload = useCallback(async () => {
  debugDiscoveryLog("manual_reload", {
    reason: "user_action",
  });
  
  setIsQueueLoading(true);
  
  // Always fetch authoritative window on manual reload
  await refreshDiscoveryCandidates();
  
  setIsQueueLoading(false);
}, [refreshDiscoveryCandidates]);
```

---

## Testing Checklist

- [ ] Open Discover tab → should call GET /window (unless 3-card cache)
- [ ] Change filters → should always call GET /window
- [ ] Exhaust all cards → reload button calls GET /window
- [ ] Go to Goals tab, return to Discover → calls GET /window (unless cache valid)
- [ ] Make decision, queue has 2 cards left → should NOT call /window yet
- [ ] Make 2 more decisions, queue empty → reload calls GET /window
- [ ] App backgrounded and resumed on Discover → checks cache, calls /window if needed

---

## Expected Logs

After implementation, you should see:

```
[discovery] authoritative_window_fetch reason=discover_entry
[discovery] authoritative_window_fetch reason=filters_changed
[discovery] authoritative_window_fetch reason=queue_exhausted
[discovery] discover_entry_cache_valid queueSize=3
```

---

## Migration Notes

- This change makes the app more resilient to state sync issues
- Server is now the authoritative source for the 3-card deck
- Reduces client-side queue management complexity
- Aligns with server-authoritative architecture from P0 implementation

---

**Status:** Ready to implement in AppContext.tsx and discover.tsx

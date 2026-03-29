const rawDevelopmentFlag =
  process.env.EXPO_PUBLIC_DEVELOPMENT ?? process.env.DEVELOPMENT ?? "";
const rawDiscoveryDebugFlag =
  process.env.EXPO_PUBLIC_DEBUG_DISCOVERY ?? process.env.DEBUG_DISCOVERY ?? "";
const rawDiscoveryVerboseFlag =
  process.env.EXPO_PUBLIC_DEBUG_DISCOVERY_VERBOSE ??
  process.env.DEBUG_DISCOVERY_VERBOSE ??
  "";

function parseFlag(value: string, fallback = false) {
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export const debugEnabled = parseFlag(rawDevelopmentFlag);
export const discoveryDebugEnabled = parseFlag(rawDiscoveryDebugFlag, debugEnabled);
export const discoveryVerboseDebugEnabled =
  discoveryDebugEnabled && parseFlag(rawDiscoveryVerboseFlag, false);

export function debugLog(...args: unknown[]) {
  if (!debugEnabled) {
    return;
  }

  console.log(...args);
}

export function debugWarn(...args: unknown[]) {
  if (!debugEnabled) {
    return;
  }

  console.warn(...args);
}

export function debugDiscoveryLog(event: string, payload?: Record<string, unknown>) {
  if (!discoveryDebugEnabled) {
    return;
  }

  console.log("[discovery-debug]", event, payload || {});
}

export function debugDiscoveryWarn(event: string, payload?: Record<string, unknown>) {
  if (!discoveryDebugEnabled) {
    return;
  }

  console.warn("[discovery-debug]", event, payload || {});
}

export function debugDiscoveryVerboseLog(
  event: string,
  payload?: Record<string, unknown>
) {
  if (!discoveryVerboseDebugEnabled) {
    return;
  }

  console.log("[discovery-verbose]", event, payload || {});
}

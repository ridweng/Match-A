import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

export const ANALYTICS_QUEUE_STORAGE_KEY = "analyticsQueue:v1";

type AnalyticsPlatform = "ios" | "android" | "web";
type AnalyticsEvent = {
  eventName: string;
  screenName?: string | null;
  areaName?: string | null;
  occurredAt?: string;
  durationMs?: number | null;
  targetProfilePublicId?: string | null;
  targetProfileKind?: "user" | "dummy" | "synthetic" | "unknown" | null;
  targetProfileBatchKey?: string | null;
  metadata?: Record<string, unknown> | null;
};

type AnalyticsContext = {
  accessToken?: string | null;
  sessionId?: string | null;
};

const enabled = parseFlag(process.env.EXPO_PUBLIC_ANALYTICS_ENABLED);
const debugEnabled = parseFlag(process.env.EXPO_PUBLIC_ANALYTICS_DEBUG_LOGS);
export const analyticsHeartbeatIntervalSeconds = parseNumber(
  process.env.EXPO_PUBLIC_ANALYTICS_HEARTBEAT_INTERVAL_SECONDS,
  30
);
const queueMaxSize = parseNumber(process.env.EXPO_PUBLIC_ANALYTICS_QUEUE_MAX_SIZE, 300);
const metadataAllowlist = new Set([
  "step",
  "stepIndex",
  "stepName",
  "source",
  "reason",
  "status",
  "count",
  "queueVersion",
  "policyVersion",
  "requestId",
  "decision",
  "action",
  "latencyMs",
  "httpStatus",
  "errorCode",
  "isOnline",
  "profileCount",
  "likes",
  "passes",
  "totalLikes",
  "thresholdReached",
  "filtersChanged",
  "selectedGendersCount",
  "therianMode",
  "ageMin",
  "ageMax",
  "photoIndex",
  "photosViewed",
  "openedInfo",
  "targetProfileKind",
  "targetProfileBatchKey",
  "endedBy",
  "route",
  "fromRoute",
  "toRoute",
]);
const sensitiveKeyPattern = /(password|token|secret|authorization|cookie|bio|description|free.?text|private)/i;

// Product study/testing analytics only. Never enqueue credentials, auth tokens,
// reset/verification tokens, bios, or raw private form content as metadata.
function parseFlag(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function parseNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_AUTH_API_URL;
  if (configured) return configured;
  return Platform.select({
    android: "http://10.0.2.2:8082",
    default: "http://127.0.0.1:8082",
  })!;
}

function appContext() {
  const config = (Constants.expoConfig || Constants.manifest2?.extra?.expoClient || {}) as {
    version?: string;
    ios?: { buildNumber?: string };
    android?: { versionCode?: string | number };
  };
  return {
    platform: Platform.OS as AnalyticsPlatform,
    appVersion: String(config.version || ""),
    buildNumber: String(
      Platform.OS === "ios"
        ? config.ios?.buildNumber || ""
        : config.android?.versionCode || ""
    ),
    deviceFamily: Platform.OS,
  };
}

function sanitizeMetadata(input?: Record<string, unknown> | null) {
  if (!input || typeof input !== "object") return null;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!metadataAllowlist.has(key) || sensitiveKeyPattern.test(key)) continue;
    if (value == null || typeof value === "boolean") {
      output[key] = value;
    } else if (typeof value === "number") {
      output[key] = Number.isFinite(value) ? value : null;
    } else if (typeof value === "string") {
      output[key] = value.slice(0, 160);
    }
  }
  return output;
}

function log(message: string) {
  if (enabled && debugEnabled) {
    console.log(`[analytics] ${message}`);
  }
}

async function readQueue(): Promise<AnalyticsEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(ANALYTICS_QUEUE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(events: AnalyticsEvent[]) {
  await AsyncStorage.setItem(
    ANALYTICS_QUEUE_STORAGE_KEY,
    JSON.stringify(events.slice(-queueMaxSize))
  );
}

async function postAnalytics(path: string, accessToken: string, body: unknown) {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`ANALYTICS_${response.status}`);
  }
  return response.json().catch(() => ({}));
}

export const analytics = {
  enabled,
  debugEnabled,

  async startSession(accessToken: string | null | undefined) {
    if (!enabled || !accessToken) return null;
    try {
      const result = await postAnalytics("/api/analytics/session/start", accessToken, {
        ...appContext(),
        startedAt: new Date().toISOString(),
      });
      log("session_started");
      return typeof result?.id === "string" ? result.id : null;
    } catch {
      return null;
    }
  },

  heartbeat(accessToken: string | null | undefined, sessionId: string | null | undefined) {
    if (!enabled || !accessToken || !sessionId) return;
    void postAnalytics("/api/analytics/session/heartbeat", accessToken, { sessionId })
      .then(() => log("session_heartbeat"))
      .catch(() => undefined);
  },

  endSession(accessToken: string | null | undefined, sessionId: string | null | undefined, endReason: "background" | "logout" | "foreground_end" | "crash_or_unknown" = "background") {
    if (!enabled || !accessToken || !sessionId) return;
    void postAnalytics("/api/analytics/session/end", accessToken, {
      sessionId,
      endedAt: new Date().toISOString(),
      endReason,
    }).then(() => log("session_ended")).catch(() => undefined);
  },

  track(event: AnalyticsEvent, context: AnalyticsContext = {}) {
    if (!enabled) return;
    const payload: AnalyticsEvent = {
      ...event,
      occurredAt: event.occurredAt || new Date().toISOString(),
      metadata: sanitizeMetadata(event.metadata),
    };
    log(`event ${payload.eventName}`);
    void (async () => {
      if (!context.accessToken) {
        await writeQueue([...(await readQueue()), payload]);
        return;
      }
      try {
        await postAnalytics("/api/analytics/event", context.accessToken, {
          ...appContext(),
          sessionId: context.sessionId || undefined,
          ...payload,
        });
      } catch {
        await writeQueue([...(await readQueue()), payload]);
      }
    })();
  },

  screenTime(input: {
    accessToken?: string | null;
    sessionId?: string | null;
    screenName: string;
    areaName?: string | null;
    startedAt: string;
    endedAt?: string;
    durationMs: number;
    endedBy: "blur" | "background" | "logout" | "app_close" | "navigation";
  }) {
    if (!enabled || !input.accessToken || input.durationMs < 250) return;
    const body = {
      ...appContext(),
      sessionId: input.sessionId || undefined,
      screenName: input.screenName,
      areaName: input.areaName || undefined,
      startedAt: input.startedAt,
      endedAt: input.endedAt || new Date().toISOString(),
      durationMs: Math.round(input.durationMs),
      endedBy: input.endedBy,
    };
    log(`screen_time ${input.screenName} ${Math.round(input.durationMs)}ms`);
    void postAnalytics("/api/analytics/screen-time", input.accessToken, body).catch(() => undefined);
  },

  profileCardTime(input: {
    accessToken?: string | null;
    sessionId?: string | null;
    targetProfilePublicId: string;
    targetProfileKind?: "user" | "dummy" | "synthetic" | "unknown" | null;
    targetProfileBatchKey?: string | null;
    shownAt: string;
    decidedAt?: string | null;
    visibleDurationMs?: number | null;
    decision?: "like" | "pass" | "none" | null;
    openedInfo?: boolean;
    photosViewed?: number;
  }) {
    if (!enabled || !input.accessToken) return;
    void postAnalytics("/api/analytics/profile-card-time", input.accessToken, {
      ...appContext(),
      ...input,
    }).catch(() => undefined);
  },

  async flush(accessToken: string | null | undefined, sessionId?: string | null) {
    if (!enabled || !accessToken) return;
    const queued = await readQueue();
    if (!queued.length) return;
    try {
      await postAnalytics("/api/analytics/events/batch", accessToken, {
        events: queued.map((event) => ({
          ...appContext(),
          sessionId: sessionId || undefined,
          ...event,
          metadata: sanitizeMetadata(event.metadata),
        })),
      });
      await writeQueue([]);
      log(`queue_flush count=${queued.length}`);
    } catch {
      await writeQueue(queued);
    }
  },
};

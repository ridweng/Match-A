import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { discoverProfiles, getDiscoverProfilePopularInput } from "@/data/profiles";
import type { UserProfilePhoto } from "@/utils/profilePhotos";
import { normalizeStoredProfilePhotos } from "@/utils/profilePhotos";
import {
  calculatePopularAttributesFromLikes,
  createEmptyPopularAttributesByCategory,
  diffPopularAttributeSnapshots,
  type PopularAttributeCategory,
  type PopularAttributeChange,
  type PopularAttributeInputByCategory,
  type PopularAttributeSnapshot,
} from "@/utils/popularAttributes";
import { debugDiscoveryLog, debugLog, debugWarn } from "@/utils/debug";

export type AuthProvider = "google" | "facebook" | "apple";
export type AuthCallbackProvider = AuthProvider | "email";
export type BaseGender = "male" | "female" | "non_binary" | "fluid";
export type TherianMode = "exclude" | "include" | "only";
export type DiscoveryFilters = {
  selectedGenders: BaseGender[];
  therianMode: TherianMode;
  ageMin: number;
  ageMax: number;
};

export const DEFAULT_DISCOVERY_FILTERS: DiscoveryFilters = {
  selectedGenders: [],
  therianMode: "exclude",
  ageMin: 18,
  ageMax: 40,
};

export type AuthUser = {
  id: number;
  email: string | null;
  name: string;
  dateOfBirth: string | null;
  profession: string | null;
  emailVerified: boolean;
};

export type AuthSessionResponse = {
  status: "authenticated";
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  needsProfileCompletion: boolean;
  hasCompletedOnboarding: boolean;
};

export type SignUpResponse = {
  status: "verification_pending";
  email: string;
  message: string;
  verificationPreviewUrl?: string;
};

export type VerificationStatusResponse = {
  status: "pending" | "verified";
};

export type VerificationResendResponse = {
  message: string;
};

export type AuthCallbackPayload = {
  status?: string;
  provider?: AuthCallbackProvider | string;
  code?: string;
  message?: string;
  accessToken?: string;
  refreshToken?: string;
  needsProfileCompletion: boolean;
  email?: string;
};

export type MeResponse = {
  user: AuthUser;
  needsProfileCompletion: boolean;
  hasCompletedOnboarding: boolean;
};

export type CompleteOnboardingResponse = {
  status: "ok";
  hasCompletedOnboarding: boolean;
};

export type UserSettingsResponse = {
  settings: {
    language: "es" | "en";
    heightUnit: "metric" | "imperial";
    genderIdentity: string;
    pronouns: string;
    personality: string;
  };
};

export type GoalItemResponse = {
  id: string;
  titleEs: string;
  titleEn: string;
  category:
    | "physical"
    | "personality"
    | "family"
    | "expectations"
    | "language"
    | "studies";
  order: number;
  completed: boolean;
  progress: number;
  nextActionEs: string;
  nextActionEn: string;
  impactEs: string;
  impactEn: string;
};

export type ViewerProfileResponse = {
  name: string;
  age: string;
  dateOfBirth: string;
  updatedAt?: string | null;
  location: string;
  country: string;
  profession: string;
  genderIdentity: string;
  pronouns: string;
  personality: string;
  relationshipGoals: string;
  languagesSpoken: string[];
  education: string;
  childrenPreference: string;
  physicalActivity: string;
  alcoholUse: string;
  tobaccoUse: string;
  politicalInterest: string;
  religionImportance: string;
  religion: string;
  bio: string;
  bodyType: string;
  height: string;
  hairColor: string;
  ethnicity: string;
  interests: string[];
  photos: UserProfilePhoto[];
};

export type ViewerBootstrapResponse = {
  user: AuthUser;
  needsProfileCompletion: boolean;
  hasCompletedOnboarding: boolean;
  profile: ViewerProfileResponse;
  settings: UserSettingsResponse["settings"];
  photos: ProfileMediaItemResponse[];
  goals: GoalItemResponse[];
  discovery: DiscoveryStateResponse;
  syncedAt: string;
  bootstrapGeneratedAt: string;
  viewerVersion: string;
  updatedAtByDomain: {
    user: string | null;
    profile: string | null;
    settings: string | null;
    onboarding: string | null;
    media: string | null;
    goals: string | null;
    discovery: string | null;
  };
};

export type ProviderAvailability = Record<AuthProvider, boolean>;

export type DiscoveryPreferencesResponse = {
  likedProfileIds: number[];
  passedProfileIds: number[];
  currentDecisionCounts: {
    likes: number;
    passes: number;
  };
  popularAttributesByCategory: Record<
    PopularAttributeCategory,
    PopularAttributeSnapshot
  >;
  totalLikesCount: number;
  lifetimeCounts: {
    likes: number;
    passes: number;
  };
  threshold: {
    likeThreshold: number;
    totalLikes: number;
    totalPasses: number;
    likesUntilUnlock: number;
    thresholdReached: boolean;
    thresholdReachedAt: string | null;
    lastDecisionEventAt: string | null;
    lastDecisionInteractionId: number | null;
  };
  goalsUnlock: {
    available: boolean;
    justUnlocked: boolean;
    unlockMessagePending: boolean;
    goalsUnlockEventEmittedAt: string | null;
    goalsUnlockMessageSeenAt: string | null;
  };
  lastNotifiedPopularModeChangeAtLikeCount: number;
  filters: DiscoveryFilters;
  feed?: DiscoveryFeedResponse;
};

export type DiscoveryFeedProfileResponse = {
  id: number;
  publicId: string;
  name: string;
  age: number;
  dateOfBirth: string;
  pronouns: string;
  genderIdentity: string;
  location: string;
  occupation: {
    es: string;
    en: string;
  };
  attributes: {
    bodyType: string;
    height: string;
    interests: string[];
  };
  about: {
    bio: {
      es: string;
      en: string;
    };
    relationshipGoals: string;
    education: string;
    childrenPreference: string;
    languagesSpoken: string[];
  };
  lifestyle: {
    physicalActivity: string;
    alcoholUse: string;
    tobaccoUse: string;
    politicalInterest: string;
    religionImportance: string;
    religion: string;
  };
  physical: {
    bodyType: string;
    height: string;
    hairColor: string;
    ethnicity: string;
  };
  images: string[];
  insightTags: Array<{
    es: string;
    en: string;
  }>;
  goalFeedback: Array<{
    goalId: string;
    reason: {
      es: string;
      en: string;
    };
  }>;
  categoryValues: PopularAttributeInputByCategory;
  debugMedia?: {
    candidateBucket?: "real" | "dummy";
    profileKind?: "user" | "dummy";
    hasDummyMetadata?: boolean;
    hasReadyMedia?: boolean;
    mediaSource: "real_media" | "dummy_fallback" | "missing_real_media";
    imageCount: number;
    photos: Array<{
      profileImageId: number | null;
      mediaAssetId: number | null;
      sortOrder: number;
      remoteUrl: string;
      source: "db_confirmed" | "dummy_fallback";
    }>;
  };
};

export type DiscoveryFeedResponse = {
  queueVersion?: number;
  policyVersion?: string;
  generatedAt?: string;
  windowSize?: number;
  reserveCount?: number;
  queueInvalidated?: boolean;
  queueInvalidationReason?: string | null;
  profiles: DiscoveryFeedProfileResponse[];
  nextCursor: string | null;
  hasMore: boolean;
  supply: {
    eligibleCount: number;
    unseenCount: number;
    decidedCount: number;
    exhausted: boolean;
    fetchedAt: string;
    policyVersion?: string;
    eligibleRealCount?: number;
    eligibleDummyCount?: number;
    returnedRealCount?: number;
    returnedDummyCount?: number;
    dominantExclusionReason?: string | null;
    exhaustedReason?: string | null;
    refillThreshold?: number;
  };
};

export type DiscoveryDecisionRequestPayload = {
  targetProfileId: number;
  targetProfilePublicId?: string;
  action: "like" | "pass";
  categoryValues?: PopularAttributeInputByCategory | null;
  requestId?: string;
  cursor?: string | null;
  visibleProfileIds?: number[];
  visibleProfilePublicIds?: string[];
  queueVersion?: number | null;
  presentedPosition?: number | null;
};

export type DiscoveryStateResponse = DiscoveryPreferencesResponse;

export type DiscoveryDecisionNoopReason =
  | "duplicate_request_id"
  | "same_state_existing_decision"
  | "cursor_stale";

export type DiscoveryLikeResponse = DiscoveryPreferencesResponse & {
  requestId?: string | null;
  decisionApplied: boolean;
  decisionState: "like" | "pass";
  targetProfileId: number;
  targetProfilePublicId?: string;
  changedCategories: PopularAttributeChange[];
  shouldShowDiscoveryUpdate: boolean;
  queueVersion?: number | null;
  policyVersion?: string;
  replacementProfile: DiscoveryFeedProfileResponse | null;
  nextCursor: string | null;
  hasMore: boolean;
  supply: DiscoveryFeedResponse["supply"];
} & (
    | {
        decisionApplied: true;
        decisionRejectedReason: null;
      }
    | {
        decisionApplied: false;
        decisionRejectedReason: DiscoveryDecisionNoopReason;
      }
  );

export type ProfileMediaItemResponse = {
  profileImageId: number;
  mediaAssetId: number;
  sortOrder: number;
  isPrimary: boolean;
  updatedAt: string;
  remoteUrl: string;
  mimeType: string;
  status: "pending" | "ready" | "deleted";
};

export type ProfileMediaListResponse = {
  photos: ProfileMediaItemResponse[];
};

export type ServerHealthCheckResult = {
  healthy: boolean;
  status?: number;
  code?: string | null;
  checkedAt: string;
};

const DEMO_EMAIL = "test@gmail.com";
const DEMO_PASSWORD = "test";
const DEMO_ACCESS_TOKEN = "demo-access-token";
const DEMO_REFRESH_TOKEN = "demo-refresh-token";
const DEMO_USER: AuthUser = {
  id: 1,
  email: DEMO_EMAIL,
  name: "Test User",
  dateOfBirth: "2000-01-01",
  profession: "Demo User",
  emailVerified: true,
};
const DEMO_SETTINGS: UserSettingsResponse["settings"] = {
  language: "es",
  heightUnit: "metric",
  genderIdentity: "",
  pronouns: "",
  personality: "",
};
let DEMO_HAS_COMPLETED_ONBOARDING = true;
const DEMO_DISCOVERY_PREFERENCES: DiscoveryPreferencesResponse = {
  likedProfileIds: [],
  passedProfileIds: [],
  currentDecisionCounts: {
    likes: 0,
    passes: 0,
  },
  popularAttributesByCategory: createEmptyPopularAttributesByCategory(),
  totalLikesCount: 0,
  lifetimeCounts: {
    likes: 0,
    passes: 0,
  },
  threshold: {
    likeThreshold: 30,
    totalLikes: 0,
    totalPasses: 0,
    likesUntilUnlock: 30,
    thresholdReached: false,
    thresholdReachedAt: null,
    lastDecisionEventAt: null,
    lastDecisionInteractionId: null,
  },
  goalsUnlock: {
    available: false,
    justUnlocked: false,
    unlockMessagePending: false,
    goalsUnlockEventEmittedAt: null,
    goalsUnlockMessageSeenAt: null,
  },
  lastNotifiedPopularModeChangeAtLikeCount: 0,
  filters: {
    ...DEFAULT_DISCOVERY_FILTERS,
  },
};
const DEMO_DISCOVERY_PROFILE_KEY_BY_ID = new Map<number, string>();
const DEMO_DISCOVERY_PROFILES: DiscoveryFeedProfileResponse[] = discoverProfiles.map(
  (profile, index) => {
    const backendId = index + 1;
    DEMO_DISCOVERY_PROFILE_KEY_BY_ID.set(backendId, profile.id);
    return {
      ...profile,
      id: backendId,
      publicId: profile.id,
      categoryValues: getDiscoverProfilePopularInput(profile.id)!,
    };
  }
);
const DEMO_DISCOVERY_DEFAULT_LIMIT = 3;
let DEMO_DISCOVERY_QUEUE_VERSION = 1;
const DEMO_GOALS: GoalItemResponse[] = [
  {
    id: "1",
    titleEs: "Resistencia cardiovascular",
    titleEn: "Cardiovascular endurance",
    category: "physical",
    order: 0,
    completed: false,
    progress: 0,
    nextActionEs: "Corre 20 min hoy sin parar",
    nextActionEn: "Run 20 min today without stopping",
    impactEs: "Más energía y mejor postura",
    impactEn: "More energy and better posture",
  },
  {
    id: "2",
    titleEs: "Confianza social",
    titleEn: "Social confidence",
    category: "personality",
    order: 0,
    completed: false,
    progress: 0,
    nextActionEs: "Inicia una conversación con un extraño",
    nextActionEn: "Start a conversation with a stranger",
    impactEs: "Más atractivo en interacciones sociales",
    impactEn: "More attractive in social interactions",
  },
];
const DEMO_VIEWER_PROFILE: ViewerProfileResponse = {
  name: DEMO_USER.name,
  age: "",
  dateOfBirth: DEMO_USER.dateOfBirth || "",
  updatedAt: new Date().toISOString(),
  location: "",
  country: "",
  profession: DEMO_USER.profession || "",
  genderIdentity: "",
  pronouns: "",
  personality: "",
  relationshipGoals: "",
  languagesSpoken: [],
  education: "",
  childrenPreference: "",
  physicalActivity: "",
  alcoholUse: "",
  tobaccoUse: "",
  politicalInterest: "",
  religionImportance: "",
  religion: "",
  bio: "",
  bodyType: "",
  height: "",
  hairColor: "",
  ethnicity: "",
  interests: [],
  photos: [],
};

type RequestOptions = {
  method?: string;
  body?: unknown;
  accessToken?: string | null;
  headers?: Record<string, string>;
  timeoutMs?: number;
  debugContext?: {
    event: string;
    payload: Record<string, unknown>;
  };
};

type ProtectedRequestOptions = Pick<RequestOptions, "headers">;

export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
export const SERVER_HEALTH_TIMEOUT_MS = 10_000;
const MEDIA_UPLOAD_REQUEST_TIMEOUT_MS = 60_000;

class ApiError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message || code);
    this.code = code;
  }
}

function isDemoCredentials(input: { email: string; password: string }) {
  return (
    input.email.trim().toLowerCase() === DEMO_EMAIL &&
    input.password === DEMO_PASSWORD
  );
}

function isDemoToken(token: string | null | undefined) {
  return token === DEMO_ACCESS_TOKEN || token === DEMO_REFRESH_TOKEN;
}

function getBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_AUTH_API_URL;
  if (configured) return configured;
  return Platform.select({
    android: "http://10.0.2.2:8082",
    default: "http://127.0.0.1:8082",
  })!;
}

function normalizeRemoteMediaUrl(url: string) {
  const trimmed = String(url || "").trim();
  if (!trimmed) {
    return "";
  }

  const apiBase = new URL(getBaseUrl());

  if (trimmed.startsWith("/")) {
    return `${apiBase.toString().replace(/\/$/, "")}${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    const isPublicMediaPath = parsed.pathname.startsWith("/api/media/public/");
    if (
      isPublicMediaPath ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "0.0.0.0"
    ) {
      parsed.protocol = apiBase.protocol;
      parsed.host = apiBase.host;
      return parsed.toString();
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

function normalizeViewerProfileResponse(
  profile: ViewerProfileResponse | null | undefined
): ViewerProfileResponse {
  const normalizedPhotos = normalizeStoredProfilePhotos(profile?.photos).map((photo) => ({
    ...photo,
    remoteUrl: normalizeRemoteMediaUrl(photo.remoteUrl),
  }));

  return {
    name: String(profile?.name || ""),
    age: String(profile?.age || ""),
    dateOfBirth: String(profile?.dateOfBirth || ""),
    updatedAt: profile?.updatedAt ?? null,
    location: String(profile?.location || ""),
    country: String(profile?.country || ""),
    profession: String(profile?.profession || ""),
    genderIdentity: String(profile?.genderIdentity || ""),
    pronouns: String(profile?.pronouns || ""),
    personality: String(profile?.personality || ""),
    relationshipGoals: String(profile?.relationshipGoals || ""),
    languagesSpoken: Array.isArray(profile?.languagesSpoken) ? profile!.languagesSpoken : [],
    education: String(profile?.education || ""),
    childrenPreference: String(profile?.childrenPreference || ""),
    physicalActivity: String(profile?.physicalActivity || ""),
    alcoholUse: String(profile?.alcoholUse || ""),
    tobaccoUse: String(profile?.tobaccoUse || ""),
    politicalInterest: String(profile?.politicalInterest || ""),
    religionImportance: String(profile?.religionImportance || ""),
    religion: String(profile?.religion || ""),
    bio: String(profile?.bio || ""),
    bodyType: String(profile?.bodyType || ""),
    height: String(profile?.height || ""),
    hairColor: String(profile?.hairColor || ""),
    ethnicity: String(profile?.ethnicity || ""),
    interests: Array.isArray(profile?.interests) ? profile!.interests : [],
    photos: normalizedPhotos,
  };
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  let response: Response;
  const requestStartedAt = Date.now();
  const isDiscoveryDecision = path === "/api/discovery/decision";
  
  try {
    if (options.debugContext) {
      debugDiscoveryLog(options.debugContext.event, {
        ...options.debugContext.payload,
        path,
        method: options.method || "GET",
        hasAccessToken: Boolean(options.accessToken),
        timeoutMs,
      });
    }
    
    if (isDiscoveryDecision && options.method === "POST") {
      const payload = options.body as any;
      console.log("[api] [request] discovery decision request", {
        path,
        method: options.method,
        action: payload?.action,
        targetProfileId: payload?.targetProfileId,
        requestId: payload?.requestId,
        hasAccessToken: Boolean(options.accessToken),
      });
    }
    const fetchPromise = fetch(`${getBaseUrl()}${path}`, {
      method: options.method || "GET",
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(options.accessToken
          ? { Authorization: `Bearer ${options.accessToken}` }
          : {}),
        ...(options.headers || {}),
      },
      body: options.body
        ? isFormData
          ? (options.body as BodyInit)
          : JSON.stringify(options.body)
        : undefined,
      ...(controller ? { signal: controller.signal } : {}),
    });

    const timeoutPromise = new Promise<Response>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        controller?.abort();
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    response = await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error: any) {
    const isTimeoutError =
      error?.name === "AbortError" ||
      (typeof error?.message === "string" &&
        error.message.includes("Request timed out"));
    debugWarn("[api] network request failed", {
      ...(options.debugContext?.payload || {}),
      path,
      method: options.method || "GET",
      message: isTimeoutError
        ? `Request timed out after ${timeoutMs}ms`
        : error?.message || "Network request failed",
    });
    throw new ApiError(
      "NETWORK_REQUEST_FAILED",
      isTimeoutError
        ? `Request timed out after ${timeoutMs}ms`
        : error?.message || "Network request failed"
    );
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  const latencyMs = Date.now() - requestStartedAt;
  
  if (!response.ok) {
    console.log("[api] request error response", {
      path,
      status: response.status,
      error: data.error,
      message: data.message,
      body: JSON.stringify(data).slice(0, 300),
    });
    
    if (isDiscoveryDecision) {
      const payload = options.body as any;
      console.log("[api] [response] discovery decision failed", {
        path,
        status: response.status,
        latencyMs,
        action: payload?.action,
        targetProfileId: payload?.targetProfileId,
        requestId: payload?.requestId,
        error: data.error,
        message: data.message,
      });
    }
    
    debugWarn("[api] request failed", {
      ...(options.debugContext?.payload || {}),
      path,
      method: options.method || "GET",
      status: response.status,
      error: data.error || "REQUEST_FAILED",
    });
    throw new ApiError(data.error || "REQUEST_FAILED", data.message || data.error);
  }
  
  if (isDiscoveryDecision) {
    const payload = options.body as any;
    console.log("[api] [response] discovery decision success", {
      path,
      status: response.status,
      latencyMs,
      action: payload?.action,
      targetProfileId: payload?.targetProfileId,
      requestId: payload?.requestId,
      decisionApplied: data.decisionApplied,
      decisionRejectedReason: data.decisionRejectedReason,
      replacementProfileId: data.replacementProfile?.id ?? null,
    });
  }
  
  return data as T;
}

function parseAuthCallbackUrl(url: string) {
  const parsed = Linking.parse(url);
  const query = (parsed.queryParams || {}) as Record<string, string | undefined>;
  return {
    status: query.status,
    provider: query.provider,
    code: query.code,
    message: query.message,
    accessToken: query.accessToken,
    refreshToken: query.refreshToken,
    needsProfileCompletion: query.needsProfileCompletion === "true",
    email: query.email,
  } satisfies AuthCallbackPayload;
}

export async function fetchProviderAvailability(): Promise<ProviderAvailability> {
  try {
    return await request<ProviderAvailability>("/api/auth/providers");
  } catch {
    return {
      google: false,
      facebook: false,
      apple: false,
    };
  }
}

export async function checkServerHealth(options?: {
  timeoutMs?: number;
}): Promise<ServerHealthCheckResult> {
  const timeoutMs = options?.timeoutMs ?? SERVER_HEALTH_TIMEOUT_MS;
  const checkedAt = new Date().toISOString();
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  debugLog("[api] server health check started", {
    timeoutMs,
    checkedAt,
    path: "/api/healthz/ready",
  });

  try {
    const fetchPromise = fetch(`${getBaseUrl()}/api/healthz/ready`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      ...(controller ? { signal: controller.signal } : {}),
    });

    const timeoutPromise = new Promise<Response>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        controller?.abort();
        reject(new Error(`Server health check timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (!response.ok) {
      debugWarn("[api] server health check failed", {
        status: response.status,
        checkedAt,
        path: "/api/healthz/ready",
      });
      return {
        healthy: false,
        status: response.status,
        code: `HTTP_${response.status}`,
        checkedAt,
      };
    }

    debugLog("[api] server health check succeeded", {
      status: response.status,
      checkedAt,
      path: "/api/healthz/ready",
    });
    return {
      healthy: true,
      status: response.status,
      code: null,
      checkedAt,
    };
  } catch (error: any) {
    const isTimeoutError =
      error?.name === "AbortError" ||
      (typeof error?.message === "string" &&
        error.message.includes("timed out"));
    const code = isTimeoutError ? "TIMEOUT" : "NETWORK_REQUEST_FAILED";

    debugWarn("[api] server health check failed", {
      code,
      checkedAt,
      message: error?.message || "UNKNOWN_ERROR",
      path: "/api/healthz/ready",
    });
    return {
      healthy: false,
      code,
      checkedAt,
    };
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
  dateOfBirth: string;
}) {
  return request<SignUpResponse>("/api/auth/sign-up", {
    method: "POST",
    body: input,
  });
}

export async function signIn(input: { email: string; password: string }) {
  if (isDemoCredentials(input)) {
    try {
      return await request<AuthSessionResponse>("/api/auth/sign-in", {
        method: "POST",
        body: input,
      });
    } catch {
      return {
        status: "authenticated" as const,
        accessToken: DEMO_ACCESS_TOKEN,
        refreshToken: DEMO_REFRESH_TOKEN,
        user: DEMO_USER,
        needsProfileCompletion: false,
        hasCompletedOnboarding: DEMO_HAS_COMPLETED_ONBOARDING,
      };
    }
  }
  return request<AuthSessionResponse>("/api/auth/sign-in", {
    method: "POST",
    body: input,
  });
}

export async function refreshSession(refreshToken: string) {
  if (isDemoToken(refreshToken)) {
    return {
      status: "authenticated" as const,
      accessToken: DEMO_ACCESS_TOKEN,
      refreshToken: DEMO_REFRESH_TOKEN,
      user: DEMO_USER,
      needsProfileCompletion: false,
      hasCompletedOnboarding: DEMO_HAS_COMPLETED_ONBOARDING,
    };
  }
  debugLog("[auth] refreshing session");
  return request<AuthSessionResponse>("/api/auth/refresh", {
    method: "POST",
    body: { refreshToken },
  });
}

export async function signOut(accessToken: string) {
  if (isDemoToken(accessToken)) {
    return;
  }
  return request<void>("/api/auth/sign-out", {
    method: "POST",
    accessToken,
  });
}

export async function getMe(accessToken: string) {
  if (isDemoToken(accessToken)) {
    return {
      user: DEMO_USER,
      needsProfileCompletion: false,
      hasCompletedOnboarding: DEMO_HAS_COMPLETED_ONBOARDING,
    };
  }
  return request<MeResponse>("/api/auth/me", {
    accessToken,
  });
}

export async function getViewerBootstrap(accessToken: string) {
  if (isDemoToken(accessToken)) {
    const now = new Date().toISOString();
    return {
      user: DEMO_USER,
      needsProfileCompletion: false,
      hasCompletedOnboarding: DEMO_HAS_COMPLETED_ONBOARDING,
      profile: DEMO_VIEWER_PROFILE,
      settings: DEMO_SETTINGS,
      photos: [],
      goals: DEMO_GOALS,
      discovery: {
        ...DEMO_DISCOVERY_PREFERENCES,
        feed: buildDemoDiscoveryFeed(null, DEMO_DISCOVERY_DEFAULT_LIMIT),
      },
      syncedAt: now,
      bootstrapGeneratedAt: now,
      viewerVersion: "viewer-bootstrap-v1",
      updatedAtByDomain: {
        user: now,
        profile: now,
        settings: now,
        onboarding: now,
        media: now,
        goals: now,
        discovery: now,
      },
    } satisfies ViewerBootstrapResponse;
  }

  const response = await request<ViewerBootstrapResponse>("/api/viewer/bootstrap", {
    accessToken,
  });
  return {
    ...response,
    profile: normalizeViewerProfileResponse(response.profile),
    photos: response.photos.map((photo) => ({
      ...photo,
      remoteUrl: normalizeRemoteMediaUrl(photo.remoteUrl),
    })),
  };
}

export async function getViewerProfile(accessToken: string) {
  if (isDemoToken(accessToken)) {
    return { profile: DEMO_VIEWER_PROFILE };
  }

  const response = await request<{ profile: ViewerProfileResponse }>("/api/me/profile", {
    accessToken,
  });
  return {
    profile: normalizeViewerProfileResponse(response.profile),
  };
}

export async function updateViewerProfile(
  accessToken: string,
  payload: Partial<Omit<ViewerProfileResponse, "age" | "photos">> & {
    latitude?: number;
    longitude?: number;
  },
  options: ProtectedRequestOptions = {}
) {
  if (isDemoToken(accessToken)) {
    Object.assign(DEMO_VIEWER_PROFILE, payload);
    if (typeof payload.name === "string") {
      DEMO_USER.name = payload.name;
    }
    if (typeof payload.dateOfBirth === "string") {
      DEMO_USER.dateOfBirth = payload.dateOfBirth;
    }
    if (typeof payload.profession === "string") {
      DEMO_USER.profession = payload.profession;
    }
    return { profile: DEMO_VIEWER_PROFILE };
  }

  const response = await request<{ profile: ViewerProfileResponse }>("/api/me/profile", {
    method: "PATCH",
    accessToken,
    body: payload,
    headers: options.headers,
  });
  return {
    profile: normalizeViewerProfileResponse(response.profile),
  };
}

export async function updateMe(
  accessToken: string,
  payload: { name?: string; dateOfBirth?: string; profession?: string }
) {
  if (isDemoToken(accessToken)) {
    if (typeof payload.name === "string") DEMO_USER.name = payload.name;
    if (typeof payload.dateOfBirth === "string") DEMO_USER.dateOfBirth = payload.dateOfBirth;
    if (typeof payload.profession === "string") DEMO_USER.profession = payload.profession;
    return {
      user: DEMO_USER,
      needsProfileCompletion: false,
      hasCompletedOnboarding: DEMO_HAS_COMPLETED_ONBOARDING,
    };
  }
  return request<MeResponse>("/api/auth/me", {
    method: "PATCH",
    accessToken,
    body: payload,
  });
}

export async function getSettings(accessToken: string) {
  if (isDemoToken(accessToken)) {
    return { settings: DEMO_SETTINGS };
  }
  return request<UserSettingsResponse>("/api/me/settings", {
    accessToken,
  });
}

export async function updateSettings(
  accessToken: string,
  payload: Partial<UserSettingsResponse["settings"]>
) {
  if (isDemoToken(accessToken)) {
    Object.assign(DEMO_SETTINGS, payload);
    return { settings: DEMO_SETTINGS };
  }
  return request<UserSettingsResponse>("/api/me/settings", {
    method: "PATCH",
    accessToken,
    body: payload,
  });
}

export async function verifyEmail(token: string) {
  return request("/api/auth/verify-email", {
    method: "POST",
    body: { token },
  });
}

export async function checkVerificationStatus(email: string) {
  if (email.trim().toLowerCase() === DEMO_EMAIL) {
    return { status: "verified" } satisfies VerificationStatusResponse;
  }
  return request<VerificationStatusResponse>("/api/auth/verification-status", {
    method: "POST",
    body: { email },
  });
}

export async function resendVerificationEmail(email: string) {
  if (email.trim().toLowerCase() === DEMO_EMAIL) {
    return {
      message:
        "If the account exists and still needs verification, a new email will be sent.",
    } satisfies VerificationResendResponse;
  }
  return request<VerificationResendResponse>("/api/auth/verify-email/resend", {
    method: "POST",
    body: { email },
  });
}

export async function completeOnboarding(
  accessToken: string,
  options: ProtectedRequestOptions = {}
) {
  if (isDemoToken(accessToken)) {
    DEMO_HAS_COMPLETED_ONBOARDING = true;
    return {
      status: "ok" as const,
      hasCompletedOnboarding: true,
    };
  }
  return request<CompleteOnboardingResponse>("/api/auth/onboarding/complete", {
    method: "POST",
    accessToken,
    headers: options.headers,
  });
}

function inferMimeType(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  return "image/jpeg";
}

export async function listProfilePhotos(accessToken: string) {
  const response = await request<ProfileMediaListResponse>("/api/media/profile-images", {
    accessToken,
  });
  return {
    photos: response.photos.map((photo) => ({
      ...photo,
      remoteUrl: normalizeRemoteMediaUrl(photo.remoteUrl),
    })),
  } satisfies ProfileMediaListResponse;
}

export async function uploadProfilePhoto(
  accessToken: string,
  sortOrder: number,
  localUri: string,
  options: ProtectedRequestOptions = {}
) {
  const form = new FormData();
  form.append("sortOrder", String(sortOrder));
  form.append("file", {
    uri: localUri,
    name: localUri.split("/").pop() || `profile-${sortOrder}.jpg`,
    type: inferMimeType(localUri),
  } as any);

  const response = await request<ProfileMediaItemResponse>("/api/media/profile-images", {
    method: "POST",
    accessToken,
    body: form,
    headers: options.headers,
    timeoutMs: MEDIA_UPLOAD_REQUEST_TIMEOUT_MS,
  });
  return {
    ...response,
    remoteUrl: normalizeRemoteMediaUrl(response.remoteUrl),
  } satisfies ProfileMediaItemResponse;
}

export async function deleteProfilePhoto(
  accessToken: string,
  profileImageId: number
) {
  return request<void>(`/api/media/profile-images/${profileImageId}`, {
    method: "DELETE",
    accessToken,
  });
}

export async function deleteAccount(accessToken: string) {
  if (isDemoToken(accessToken)) {
    return { status: "deleted" as const };
  }
  return request<{ status: "deleted" }>("/api/auth/me", {
    method: "DELETE",
    accessToken,
  });
}

export function mergeRemotePhotosWithLocal(
  existing: UserProfilePhoto[],
  remotePhotos: ProfileMediaItemResponse[]
) {
  const bySort = new Map(existing.map((photo) => [photo.sortOrder, photo] as const));
  return remotePhotos
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((remote) => {
      const local = bySort.get(remote.sortOrder);
      return {
        localUri: local?.status === "error" ? "" : local?.localUri || "",
        remoteUrl: normalizeRemoteMediaUrl(remote.remoteUrl),
        mediaAssetId: remote.mediaAssetId,
        profileImageId: remote.profileImageId,
        sortOrder: remote.sortOrder,
        status: remote.status === "pending" ? "pending" : "ready",
      } satisfies UserProfilePhoto;
    });
}

export async function getDiscoveryPreferences(accessToken: string) {
  if (isDemoToken(accessToken)) {
    return DEMO_DISCOVERY_PREFERENCES;
  }
  return request<DiscoveryPreferencesResponse>("/api/me/discovery/preferences", {
    accessToken,
  });
}

function buildDemoDiscoveryFeed(cursor?: string | null, limit = DEMO_DISCOVERY_DEFAULT_LIMIT) {
  const excludedIds = new Set([
    ...DEMO_DISCOVERY_PREFERENCES.likedProfileIds,
    ...DEMO_DISCOVERY_PREFERENCES.passedProfileIds,
  ]);
  const unseenProfiles = DEMO_DISCOVERY_PROFILES.filter((profile) => !excludedIds.has(profile.id));
  const normalizedLimit = Math.max(1, Math.min(60, Math.floor(limit || DEMO_DISCOVERY_DEFAULT_LIMIT)));
  const startIndex = cursor ? Number(cursor) : 0;
  const safeStart = Number.isFinite(startIndex) && startIndex >= 0 ? startIndex : 0;
  const windowProfiles = unseenProfiles.slice(safeStart, safeStart + normalizedLimit);
  const now = new Date().toISOString();

  return {
    queueVersion: DEMO_DISCOVERY_QUEUE_VERSION,
    policyVersion: "demo_policy_v1",
    generatedAt: now,
    windowSize: windowProfiles.length,
    reserveCount: Math.min(unseenProfiles.length, 12),
    profiles: windowProfiles,
    nextCursor: null,
    hasMore: false,
    supply: {
      eligibleCount: DEMO_DISCOVERY_PROFILES.length,
      unseenCount: unseenProfiles.length,
      decidedCount: excludedIds.size,
      exhausted: unseenProfiles.length === 0,
      fetchedAt: now,
      policyVersion: "demo_policy_v1",
      eligibleRealCount: unseenProfiles.length,
      eligibleDummyCount: 0,
      returnedRealCount: windowProfiles.length,
      returnedDummyCount: 0,
      dominantExclusionReason: null,
      exhaustedReason: unseenProfiles.length === 0 ? "pool_exhausted_real_and_dummy" : null,
      refillThreshold: 1,
    },
  } satisfies DiscoveryFeedResponse;
}

function buildDemoDecisionMetadata(
  targetProfileId: number,
  visibleProfileIds: number[]
) {
  // After removing targetProfileId, these are still in the visible window
  const remainingVisibleIds = new Set(
    visibleProfileIds.filter((id) => id !== targetProfileId)
  );
  const decidedIds = new Set([
    ...DEMO_DISCOVERY_PREFERENCES.likedProfileIds,
    ...DEMO_DISCOVERY_PREFERENCES.passedProfileIds,
  ]);
  // Find the next profile that isn't already visible and isn't decided
  const replacementProfile =
    DEMO_DISCOVERY_PROFILES.find(
      (p) => !decidedIds.has(p.id) && !remainingVisibleIds.has(p.id)
    ) ?? null;
  const unseenCount = DEMO_DISCOVERY_PROFILES.filter(
    (p) => !decidedIds.has(p.id)
  ).length;
  const now = new Date().toISOString();
  return {
    queueVersion: DEMO_DISCOVERY_QUEUE_VERSION,
    policyVersion: "demo_policy_v1",
    replacementProfile,
    nextCursor: null,
    hasMore: false,
    supply: {
      eligibleCount: DEMO_DISCOVERY_PROFILES.length,
      unseenCount,
      decidedCount: decidedIds.size,
      exhausted: unseenCount === 0,
      fetchedAt: now,
      policyVersion: "demo_policy_v1",
      eligibleRealCount: DEMO_DISCOVERY_PROFILES.length,
      eligibleDummyCount: 0,
      returnedRealCount: replacementProfile ? 1 : 0,
      returnedDummyCount: 0,
      dominantExclusionReason: null,
      exhaustedReason: unseenCount === 0 ? "pool_exhausted_real_and_dummy" : null,
      refillThreshold: 1,
    },
  };
}

export async function getDiscoveryFeedWindow(
  accessToken: string,
  options?: {
    cursor?: string | null;
    limit?: number;
    size?: number;
    headers?: Record<string, string>;
  }
) {
  if (isDemoToken(accessToken)) {
    return buildDemoDiscoveryFeed(options?.cursor, options?.size ?? options?.limit);
  }

  const params = new URLSearchParams();
  const requestedSize = options?.size ?? options?.limit;
  if (Number.isFinite(requestedSize)) {
    params.set("size", String(requestedSize));
  }
  if (options?.cursor) {
    params.set("cursor", options.cursor);
  }

  return request<DiscoveryFeedResponse>(
    `/api/discovery/window${params.toString() ? `?${params.toString()}` : ""}`,
    {
      accessToken,
      headers: options?.headers,
    }
  );
}

export async function getDiscoveryFeed(accessToken: string) {
  return getDiscoveryFeedWindow(accessToken);
}

export async function refreshDiscoveryFeed(
  accessToken: string,
  limit?: number,
  options: ProtectedRequestOptions = {}
) {
  if (isDemoToken(accessToken)) {
    return buildDemoDiscoveryFeed(null, limit);
  }

  const windowPath = `/api/discovery/window${
    limit ? `?size=${encodeURIComponent(String(limit))}` : ""
  }`;
  console.log("[api] requesting discovery window", {
    path: windowPath,
    limit: limit ?? null,
    requestId: options.headers?.["X-Matcha-Request-Id"] ?? null,
  });

  const response = await request<DiscoveryFeedResponse>(windowPath, {
    accessToken,
    headers: options.headers,
  });

  console.log("[api] discovery window loaded", {
    path: windowPath,
    queueVersion: response.queueVersion ?? null,
    policyVersion: response.policyVersion ?? null,
    profileCount: Array.isArray(response.profiles) ? response.profiles.length : 0,
    nextCursor: response.nextCursor ?? null,
  });

  return response;
}

export async function getNextDiscoveryFeedWindow(
  accessToken: string,
  cursor: string,
  limit?: number,
  options: ProtectedRequestOptions = {}
) {
  return getDiscoveryFeedWindow(accessToken, {
    cursor,
    size: limit,
    ...(options.headers ? { headers: options.headers } : {}),
  });
}

export async function submitDiscoveryDecision(
  accessToken: string,
  payload: DiscoveryDecisionRequestPayload
): Promise<DiscoveryLikeResponse> {
  if (isDemoToken(accessToken)) {
    return payload.action === "like"
      ? likeDiscoveryProfile(accessToken, payload)
      : passDiscoveryProfile(accessToken, payload);
  }

  return request<DiscoveryLikeResponse>("/api/discovery/decision", {
    accessToken,
    method: "POST",
    body: payload,
    debugContext: {
      event: "decision_transport_attempt",
      payload: {
        requestId: payload.requestId ?? null,
        action: payload.action,
        targetProfileId: payload.targetProfileId,
        targetProfilePublicId: payload.targetProfilePublicId ?? null,
      },
    },
  });
}

export async function likeDiscoveryProfile(
  accessToken: string,
  payload: Omit<DiscoveryDecisionRequestPayload, "action">
): Promise<DiscoveryLikeResponse> {
  console.log("[api] sending decision to server", {
    action: "like",
    targetProfileId: payload.targetProfileId,
    targetProfilePublicId: payload.targetProfilePublicId ?? null,
    isDemoToken: isDemoToken(accessToken),
    url: `${getBaseUrl()}/api/discovery/decision`,
  });
  if (isDemoToken(accessToken)) {
    const existing = new Set(DEMO_DISCOVERY_PREFERENCES.likedProfileIds);
    if (existing.has(payload.targetProfileId)) {
      const decisionMeta = buildDemoDecisionMetadata(
      payload.targetProfileId,
      payload.visibleProfileIds ?? []
    );
      return {
        ...DEMO_DISCOVERY_PREFERENCES,
        requestId: payload.requestId ?? null,
        decisionApplied: false,
        decisionState: "like",
        targetProfileId: payload.targetProfileId,
        targetProfilePublicId:
          payload.targetProfilePublicId ??
          DEMO_DISCOVERY_PROFILE_KEY_BY_ID.get(payload.targetProfileId) ??
          undefined,
        decisionRejectedReason: "same_state_existing_decision",
        changedCategories: [],
        shouldShowDiscoveryUpdate: false,
        ...decisionMeta,
      } satisfies DiscoveryLikeResponse;
    }

    const demoProfileKey = DEMO_DISCOVERY_PROFILE_KEY_BY_ID.get(payload.targetProfileId);
    const categoryValues =
      payload.categoryValues ||
      (demoProfileKey ? getDiscoverProfilePopularInput(demoProfileKey) : null);
    if (!categoryValues) {
      throw new ApiError("UNKNOWN_DISCOVERY_PROFILE");
    }

    const previous = DEMO_DISCOVERY_PREFERENCES.popularAttributesByCategory;
    const nextPassedProfileIds = DEMO_DISCOVERY_PREFERENCES.passedProfileIds.filter(
      (profileId) => profileId !== payload.targetProfileId
    );
    const nextLikedProfileIds = [
      ...DEMO_DISCOVERY_PREFERENCES.likedProfileIds.filter(
        (profileId) => profileId !== payload.targetProfileId
      ),
      payload.targetProfileId,
    ];
    const nextSnapshots = calculatePopularAttributesFromLikes(
      nextLikedProfileIds.map((likedProfileId) => ({
        likedProfileId: String(likedProfileId),
        categoryValues: getDiscoverProfilePopularInput(
          DEMO_DISCOVERY_PROFILE_KEY_BY_ID.get(likedProfileId) || ""
        )!,
      }))
    );
    const changedCategories = diffPopularAttributeSnapshots(previous, nextSnapshots);
    const nextLifetimeLikes = DEMO_DISCOVERY_PREFERENCES.lifetimeCounts.likes + 1;
    const crossedThreshold =
      DEMO_DISCOVERY_PREFERENCES.threshold.thresholdReached === false && nextLifetimeLikes >= 30;
    const shouldShowDiscoveryUpdate =
      nextLifetimeLikes >= 30 && changedCategories.length > 0;
    const now = new Date().toISOString();

    DEMO_DISCOVERY_PREFERENCES.likedProfileIds = nextLikedProfileIds;
    DEMO_DISCOVERY_PREFERENCES.passedProfileIds = nextPassedProfileIds;
    DEMO_DISCOVERY_PREFERENCES.currentDecisionCounts = {
      likes: nextLikedProfileIds.length,
      passes: nextPassedProfileIds.length,
    };
    DEMO_DISCOVERY_PREFERENCES.popularAttributesByCategory = nextSnapshots;
    DEMO_DISCOVERY_PREFERENCES.totalLikesCount = nextLifetimeLikes;
    DEMO_DISCOVERY_PREFERENCES.lifetimeCounts = {
      likes: nextLifetimeLikes,
      passes: DEMO_DISCOVERY_PREFERENCES.lifetimeCounts.passes,
    };
    DEMO_DISCOVERY_PREFERENCES.threshold = {
      likeThreshold: 30,
      totalLikes: DEMO_DISCOVERY_PREFERENCES.lifetimeCounts.likes,
      totalPasses: DEMO_DISCOVERY_PREFERENCES.lifetimeCounts.passes,
      likesUntilUnlock: Math.max(0, 30 - DEMO_DISCOVERY_PREFERENCES.lifetimeCounts.likes),
      thresholdReached: DEMO_DISCOVERY_PREFERENCES.lifetimeCounts.likes >= 30,
      thresholdReachedAt:
        DEMO_DISCOVERY_PREFERENCES.threshold.thresholdReachedAt ||
        (DEMO_DISCOVERY_PREFERENCES.lifetimeCounts.likes >= 30 ? now : null),
      lastDecisionEventAt: now,
      lastDecisionInteractionId: payload.targetProfileId,
    };
    DEMO_DISCOVERY_PREFERENCES.goalsUnlock = {
      available: DEMO_DISCOVERY_PREFERENCES.lifetimeCounts.likes >= 30,
      justUnlocked: crossedThreshold,
      unlockMessagePending:
        crossedThreshold || DEMO_DISCOVERY_PREFERENCES.goalsUnlock.unlockMessagePending,
      goalsUnlockEventEmittedAt:
        DEMO_DISCOVERY_PREFERENCES.goalsUnlock.goalsUnlockEventEmittedAt ||
        (DEMO_DISCOVERY_PREFERENCES.lifetimeCounts.likes >= 30 ? now : null),
      goalsUnlockMessageSeenAt: DEMO_DISCOVERY_PREFERENCES.goalsUnlock.goalsUnlockMessageSeenAt,
    };
    DEMO_DISCOVERY_PREFERENCES.lastNotifiedPopularModeChangeAtLikeCount =
      shouldShowDiscoveryUpdate
        ? DEMO_DISCOVERY_PREFERENCES.lifetimeCounts.likes
        : DEMO_DISCOVERY_PREFERENCES.lastNotifiedPopularModeChangeAtLikeCount;
    DEMO_DISCOVERY_QUEUE_VERSION += 1;

    const decisionMeta = buildDemoDecisionMetadata(
      payload.targetProfileId,
      payload.visibleProfileIds ?? []
    );
    return {
      ...DEMO_DISCOVERY_PREFERENCES,
      requestId: payload.requestId ?? null,
      decisionApplied: true,
      decisionState: "like",
      targetProfileId: payload.targetProfileId,
      targetProfilePublicId:
        payload.targetProfilePublicId ??
        DEMO_DISCOVERY_PROFILE_KEY_BY_ID.get(payload.targetProfileId) ??
        undefined,
      decisionRejectedReason: null,
      changedCategories,
      shouldShowDiscoveryUpdate,
      ...decisionMeta,
    } satisfies DiscoveryLikeResponse;
  }

  return submitDiscoveryDecision(accessToken, {
    ...payload,
    action: "like",
  });
}

export async function passDiscoveryProfile(
  accessToken: string,
  payload: Omit<DiscoveryDecisionRequestPayload, "action">
): Promise<DiscoveryLikeResponse> {
  console.log("[api] sending decision to server", {
    action: "pass",
    targetProfileId: payload.targetProfileId,
    targetProfilePublicId: payload.targetProfilePublicId ?? null,
    isDemoToken: isDemoToken(accessToken),
    url: `${getBaseUrl()}/api/discovery/decision`,
  });
  if (isDemoToken(accessToken)) {
    const existing = new Set(DEMO_DISCOVERY_PREFERENCES.passedProfileIds);
    if (existing.has(payload.targetProfileId)) {
      const decisionMeta = buildDemoDecisionMetadata(
        payload.targetProfileId,
        payload.visibleProfileIds ?? []
      );
      return {
        ...DEMO_DISCOVERY_PREFERENCES,
        requestId: payload.requestId ?? null,
        decisionApplied: false,
        decisionState: "pass",
        targetProfileId: payload.targetProfileId,
        targetProfilePublicId:
          payload.targetProfilePublicId ??
          DEMO_DISCOVERY_PROFILE_KEY_BY_ID.get(payload.targetProfileId) ??
          undefined,
        decisionRejectedReason: "same_state_existing_decision",
        changedCategories: [],
        shouldShowDiscoveryUpdate: false,
        ...decisionMeta,
      } satisfies DiscoveryLikeResponse;
    }

    const nextLikedProfileIds = DEMO_DISCOVERY_PREFERENCES.likedProfileIds.filter(
      (profileId) => profileId !== payload.targetProfileId
    );
    const nextPassedProfileIds = [
      ...DEMO_DISCOVERY_PREFERENCES.passedProfileIds.filter(
        (profileId) => profileId !== payload.targetProfileId
      ),
      payload.targetProfileId,
    ];
    DEMO_DISCOVERY_PREFERENCES.likedProfileIds = nextLikedProfileIds;
    DEMO_DISCOVERY_PREFERENCES.passedProfileIds = nextPassedProfileIds;
    DEMO_DISCOVERY_PREFERENCES.currentDecisionCounts = {
      likes: nextLikedProfileIds.length,
      passes: nextPassedProfileIds.length,
    };
    DEMO_DISCOVERY_PREFERENCES.lifetimeCounts = {
      likes: DEMO_DISCOVERY_PREFERENCES.lifetimeCounts.likes,
      passes: DEMO_DISCOVERY_PREFERENCES.lifetimeCounts.passes + 1,
    };
    DEMO_DISCOVERY_PREFERENCES.totalLikesCount = DEMO_DISCOVERY_PREFERENCES.lifetimeCounts.likes;
    DEMO_DISCOVERY_PREFERENCES.threshold = {
      likeThreshold: 30,
      totalLikes: DEMO_DISCOVERY_PREFERENCES.lifetimeCounts.likes,
      totalPasses: DEMO_DISCOVERY_PREFERENCES.lifetimeCounts.passes,
      likesUntilUnlock: Math.max(0, 30 - DEMO_DISCOVERY_PREFERENCES.lifetimeCounts.likes),
      thresholdReached: DEMO_DISCOVERY_PREFERENCES.lifetimeCounts.likes >= 30,
      thresholdReachedAt: DEMO_DISCOVERY_PREFERENCES.threshold.thresholdReachedAt,
      lastDecisionEventAt: new Date().toISOString(),
      lastDecisionInteractionId: payload.targetProfileId,
    };
    DEMO_DISCOVERY_PREFERENCES.goalsUnlock = {
      ...DEMO_DISCOVERY_PREFERENCES.goalsUnlock,
      justUnlocked: false,
    };
    DEMO_DISCOVERY_QUEUE_VERSION += 1;

    const decisionMeta = buildDemoDecisionMetadata(
      payload.targetProfileId,
      payload.visibleProfileIds ?? []
    );
    return {
      ...DEMO_DISCOVERY_PREFERENCES,
      requestId: payload.requestId ?? null,
      decisionApplied: true,
      decisionState: "pass",
      targetProfileId: payload.targetProfileId,
      targetProfilePublicId:
        payload.targetProfilePublicId ??
        DEMO_DISCOVERY_PROFILE_KEY_BY_ID.get(payload.targetProfileId) ??
        undefined,
      decisionRejectedReason: null,
      changedCategories: [],
      shouldShowDiscoveryUpdate: false,
      ...decisionMeta,
    } satisfies DiscoveryLikeResponse;
  }

  return submitDiscoveryDecision(accessToken, {
    ...payload,
    action: "pass",
  });
}

export async function updateDiscoveryPreferences(
  accessToken: string,
  filters: DiscoveryFilters,
  options: ProtectedRequestOptions = {}
) {
  if (isDemoToken(accessToken)) {
    DEMO_DISCOVERY_PREFERENCES.filters = filters;
    DEMO_DISCOVERY_QUEUE_VERSION += 1;
    return DEMO_DISCOVERY_PREFERENCES;
  }

  return request<DiscoveryPreferencesResponse>("/api/me/discovery/preferences", {
    method: "PATCH",
    accessToken,
    body: { filters },
    headers: options.headers,
  });
}

export async function resetDiscoveryHistory(accessToken: string) {
  if (isDemoToken(accessToken)) {
    DEMO_DISCOVERY_PREFERENCES.likedProfileIds = [];
    DEMO_DISCOVERY_PREFERENCES.passedProfileIds = [];
    DEMO_DISCOVERY_PREFERENCES.currentDecisionCounts = {
      likes: 0,
      passes: 0,
    };
    DEMO_DISCOVERY_PREFERENCES.popularAttributesByCategory =
      createEmptyPopularAttributesByCategory();
    DEMO_DISCOVERY_PREFERENCES.totalLikesCount = 0;
    DEMO_DISCOVERY_PREFERENCES.lifetimeCounts = {
      likes: 0,
      passes: 0,
    };
    DEMO_DISCOVERY_PREFERENCES.threshold = {
      likeThreshold: 30,
      totalLikes: 0,
      totalPasses: 0,
      likesUntilUnlock: 30,
      thresholdReached: false,
      thresholdReachedAt: null,
      lastDecisionEventAt: null,
      lastDecisionInteractionId: null,
    };
    DEMO_DISCOVERY_PREFERENCES.goalsUnlock = {
      available: false,
      justUnlocked: false,
      unlockMessagePending: false,
      goalsUnlockEventEmittedAt: null,
      goalsUnlockMessageSeenAt: null,
    };
    DEMO_DISCOVERY_PREFERENCES.lastNotifiedPopularModeChangeAtLikeCount = 0;
    DEMO_DISCOVERY_QUEUE_VERSION += 1;
    return DEMO_DISCOVERY_PREFERENCES;
  }

  return request<DiscoveryPreferencesResponse>("/api/discovery/reset", {
    method: "POST",
    accessToken,
  });
}

export async function getGoals(accessToken: string) {
  if (isDemoToken(accessToken)) {
    return { goals: DEMO_GOALS };
  }

  return request<{ goals: GoalItemResponse[] }>("/api/me/goals", {
    accessToken,
  });
}

export async function acknowledgeGoalsUnlockSeen(accessToken: string) {
  if (isDemoToken(accessToken)) {
    const now = new Date().toISOString();
    DEMO_DISCOVERY_PREFERENCES.goalsUnlock = {
      ...DEMO_DISCOVERY_PREFERENCES.goalsUnlock,
      justUnlocked: false,
      unlockMessagePending: false,
      goalsUnlockMessageSeenAt:
        DEMO_DISCOVERY_PREFERENCES.goalsUnlock.goalsUnlockMessageSeenAt || now,
    };
    return DEMO_DISCOVERY_PREFERENCES.goalsUnlock;
  }

  return request<DiscoveryPreferencesResponse["goalsUnlock"]>("/api/me/goals/unlock/seen", {
    method: "POST",
    accessToken,
  });
}

export async function completeGoal(accessToken: string, goalKey: string) {
  if (isDemoToken(accessToken)) {
    const nextGoals = DEMO_GOALS.map((goal) =>
      goal.id === goalKey ? { ...goal, completed: true } : goal
    );
    return { goals: nextGoals };
  }

  return request<{ goals: GoalItemResponse[] }>(`/api/me/goals/${goalKey}`, {
    method: "PATCH",
    accessToken,
    body: { completed: true },
  });
}

export async function reorderGoals(
  accessToken: string,
  payload: {
    category: GoalItemResponse["category"];
    orderedGoalKeys: string[];
  }
) {
  if (isDemoToken(accessToken)) {
    return { goals: DEMO_GOALS };
  }

  return request<{ goals: GoalItemResponse[] }>("/api/me/goals/reorder", {
    method: "POST",
    accessToken,
    body: payload,
  });
}

export async function signInWithProvider(
  provider: AuthProvider,
  mode: "signin" | "signup"
) {
  const redirectUri = Linking.createURL("auth-callback");
  const startUrl =
    `${getBaseUrl()}/api/auth/social/start/${provider}` +
    `?redirectUri=${encodeURIComponent(redirectUri)}` +
    `&mode=${mode}`;

  const result = await WebBrowser.openAuthSessionAsync(startUrl, redirectUri);
  if (result.type !== "success" || !result.url) {
    throw new ApiError("AUTH_CANCELLED", "Authentication was cancelled");
  }

  const callback = parseAuthCallbackUrl(result.url);
  if (callback.status !== "success" || !callback.accessToken || !callback.refreshToken) {
    throw new ApiError(callback.code || "SOCIAL_AUTH_FAILED", callback.message);
  }

  const me = await getMe(callback.accessToken);
  return {
    accessToken: callback.accessToken,
    refreshToken: callback.refreshToken,
    user: me.user,
    needsProfileCompletion: me.needsProfileCompletion,
    hasCompletedOnboarding: me.hasCompletedOnboarding,
  };
}

export function extractAuthCallback(url: string) {
  return parseAuthCallbackUrl(url);
}

export function toReadableAuthError(code: string) {
  switch (code) {
    case "EMAIL_ALREADY_IN_USE":
      return "EMAIL_ALREADY_IN_USE";
    case "INVALID_CREDENTIALS":
      return "INVALID_CREDENTIALS";
    case "EMAIL_VERIFICATION_REQUIRED":
      return "EMAIL_VERIFICATION_REQUIRED";
    case "EXPIRED_VERIFICATION_TOKEN":
      return "EXPIRED_VERIFICATION_TOKEN";
    case "INVALID_VERIFICATION_TOKEN":
      return "INVALID_VERIFICATION_TOKEN";
    case "VERIFICATION_LINK_REPLACED":
      return "VERIFICATION_LINK_REPLACED";
    case "UNDERAGE":
      return "UNDERAGE";
    case "PROVIDER_UNAVAILABLE":
      return "PROVIDER_UNAVAILABLE";
    case "SESSION_EXPIRED":
      return "SESSION_EXPIRED";
    default:
      return code || "UNKNOWN_ERROR";
  }
}

export function isNetworkApiError(error: unknown) {
  return error instanceof ApiError && error.code === "NETWORK_REQUEST_FAILED";
}

export function isInvalidRefreshError(error: unknown) {
  return (
    error instanceof ApiError &&
    ["INVALID_REFRESH_TOKEN", "UNAUTHORIZED", "INVALID_SESSION"].includes(error.code)
  );
}

export { ApiError };

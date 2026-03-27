import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { getDiscoverProfilePopularInput } from "@/data/profiles";
import type { UserProfilePhoto } from "@/utils/profilePhotos";
import {
  calculatePopularAttributesFromLikes,
  createEmptyPopularAttributesByCategory,
  diffPopularAttributeSnapshots,
  type PopularAttributeCategory,
  type PopularAttributeChange,
  type PopularAttributeInputByCategory,
  type PopularAttributeSnapshot,
} from "@/utils/popularAttributes";

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
  location: string;
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
  discovery: DiscoveryPreferencesResponse;
  syncedAt: string;
};

export type ProviderAvailability = Record<AuthProvider, boolean>;

export type DiscoveryPreferencesResponse = {
  likedProfileIds: string[];
  popularAttributesByCategory: Record<
    PopularAttributeCategory,
    PopularAttributeSnapshot
  >;
  totalLikesCount: number;
  lastNotifiedPopularModeChangeAtLikeCount: number;
  filters: DiscoveryFilters;
};

export type DiscoveryLikeResponse = DiscoveryPreferencesResponse & {
  changedCategories: PopularAttributeChange[];
  shouldShowDiscoveryUpdate: boolean;
};

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
  popularAttributesByCategory: createEmptyPopularAttributesByCategory(),
  totalLikesCount: 0,
  lastNotifiedPopularModeChangeAtLikeCount: 0,
  filters: {
    ...DEFAULT_DISCOVERY_FILTERS,
  },
};
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
  location: "",
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
};

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

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`${getBaseUrl()}${path}`, {
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
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new ApiError(data.error || "REQUEST_FAILED", data.message || data.error);
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
    return {
      user: DEMO_USER,
      needsProfileCompletion: false,
      hasCompletedOnboarding: DEMO_HAS_COMPLETED_ONBOARDING,
      profile: DEMO_VIEWER_PROFILE,
      settings: DEMO_SETTINGS,
      photos: [],
      goals: DEMO_GOALS,
      discovery: DEMO_DISCOVERY_PREFERENCES,
      syncedAt: new Date().toISOString(),
    } satisfies ViewerBootstrapResponse;
  }

  return request<ViewerBootstrapResponse>("/api/viewer/bootstrap", {
    accessToken,
  });
}

export async function getViewerProfile(accessToken: string) {
  if (isDemoToken(accessToken)) {
    return { profile: DEMO_VIEWER_PROFILE };
  }

  return request<{ profile: ViewerProfileResponse }>("/api/me/profile", {
    accessToken,
  });
}

export async function updateViewerProfile(
  accessToken: string,
  payload: Partial<Omit<ViewerProfileResponse, "age" | "photos">>
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

  return request<{ profile: ViewerProfileResponse }>("/api/me/profile", {
    method: "PATCH",
    accessToken,
    body: payload,
  });
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

export async function completeOnboarding(accessToken: string) {
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
  return request<ProfileMediaListResponse>("/api/media/profile-images", {
    accessToken,
  });
}

export async function uploadProfilePhoto(
  accessToken: string,
  sortOrder: number,
  localUri: string
) {
  const form = new FormData();
  form.append("sortOrder", String(sortOrder));
  form.append("file", {
    uri: localUri,
    name: localUri.split("/").pop() || `profile-${sortOrder}.jpg`,
    type: inferMimeType(localUri),
  } as any);

  return request<ProfileMediaItemResponse>("/api/media/profile-images", {
    method: "POST",
    accessToken,
    body: form,
  });
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
        localUri: local?.localUri || "",
        remoteUrl: remote.remoteUrl,
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

export async function likeDiscoveryProfile(
  accessToken: string,
  payload: { likedProfileId: string; categoryValues?: PopularAttributeInputByCategory | null }
) {
  if (isDemoToken(accessToken)) {
    const existing = new Set(DEMO_DISCOVERY_PREFERENCES.likedProfileIds);
    if (existing.has(payload.likedProfileId)) {
      return {
        ...DEMO_DISCOVERY_PREFERENCES,
        changedCategories: [],
        shouldShowDiscoveryUpdate: false,
      } satisfies DiscoveryLikeResponse;
    }

    const categoryValues =
      payload.categoryValues || getDiscoverProfilePopularInput(payload.likedProfileId);
    if (!categoryValues) {
      throw new ApiError("UNKNOWN_DISCOVERY_PROFILE");
    }

    const previous = DEMO_DISCOVERY_PREFERENCES.popularAttributesByCategory;
    const nextLikedProfileIds = [
      ...DEMO_DISCOVERY_PREFERENCES.likedProfileIds,
      payload.likedProfileId,
    ];
    const nextSnapshots = calculatePopularAttributesFromLikes(
      nextLikedProfileIds.map((likedProfileId) => ({
        likedProfileId,
        categoryValues: getDiscoverProfilePopularInput(likedProfileId)!,
      }))
    );
    const changedCategories = diffPopularAttributeSnapshots(previous, nextSnapshots);
    const totalLikesCount = nextLikedProfileIds.length;
    const shouldShowDiscoveryUpdate =
      totalLikesCount >= 30 && changedCategories.length > 0;

    DEMO_DISCOVERY_PREFERENCES.likedProfileIds = nextLikedProfileIds;
    DEMO_DISCOVERY_PREFERENCES.popularAttributesByCategory = nextSnapshots;
    DEMO_DISCOVERY_PREFERENCES.totalLikesCount = totalLikesCount;
    DEMO_DISCOVERY_PREFERENCES.lastNotifiedPopularModeChangeAtLikeCount =
      shouldShowDiscoveryUpdate
        ? totalLikesCount
        : DEMO_DISCOVERY_PREFERENCES.lastNotifiedPopularModeChangeAtLikeCount;

    return {
      ...DEMO_DISCOVERY_PREFERENCES,
      changedCategories,
      shouldShowDiscoveryUpdate,
    } satisfies DiscoveryLikeResponse;
  }

  return request<DiscoveryLikeResponse>("/api/discovery/like", {
    method: "POST",
    accessToken,
    body: payload,
  });
}

export async function updateDiscoveryPreferences(
  accessToken: string,
  filters: DiscoveryFilters
) {
  if (isDemoToken(accessToken)) {
    DEMO_DISCOVERY_PREFERENCES.filters = filters;
    return DEMO_DISCOVERY_PREFERENCES;
  }

  return request<DiscoveryPreferencesResponse>("/api/me/discovery/preferences", {
    method: "PATCH",
    accessToken,
    body: { filters },
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
    default:
      return code || "UNKNOWN_ERROR";
  }
}

export { ApiError };

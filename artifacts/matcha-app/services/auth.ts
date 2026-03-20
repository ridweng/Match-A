import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

export type AuthProvider = "google" | "facebook" | "apple";

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
};

export type SignUpResponse = {
  status: "verification_pending";
  email: string;
  message: string;
  verificationPreviewUrl?: string;
};

export type MeResponse = {
  user: AuthUser;
  needsProfileCompletion: boolean;
};

export type UserSettingsResponse = {
  settings: {
    language: "es" | "en";
    heightUnit: "metric" | "imperial";
    genderIdentity: string;
    pronouns: string;
  };
};

export type ProviderAvailability = Record<AuthProvider, boolean>;

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
};

type RequestOptions = {
  method?: string;
  body?: unknown;
  accessToken?: string | null;
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
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.accessToken
        ? { Authorization: `Bearer ${options.accessToken}` }
        : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
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
  };
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
    };
  }
  return request<MeResponse>("/api/auth/me", {
    accessToken,
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
  return request<UserSettingsResponse>("/api/auth/settings", {
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
  return request<UserSettingsResponse>("/api/auth/settings", {
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
    case "UNDERAGE":
      return "UNDERAGE";
    case "PROVIDER_UNAVAILABLE":
      return "PROVIDER_UNAVAILABLE";
    default:
      return code || "UNKNOWN_ERROR";
  }
}

export { ApiError };

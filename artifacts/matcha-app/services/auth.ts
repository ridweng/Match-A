import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

export type AuthProvider = "google" | "facebook" | "apple";

export type AuthUser = {
  id: number;
  email: string | null;
  name: string;
  dateOfBirth: string | null;
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

export type ProviderAvailability = Record<AuthProvider, boolean>;

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
  return request<AuthSessionResponse>("/api/auth/sign-in", {
    method: "POST",
    body: input,
  });
}

export async function refreshSession(refreshToken: string) {
  return request<AuthSessionResponse>("/api/auth/refresh", {
    method: "POST",
    body: { refreshToken },
  });
}

export async function signOut(accessToken: string) {
  return request<void>("/api/auth/sign-out", {
    method: "POST",
    accessToken,
  });
}

export async function getMe(accessToken: string) {
  return request<MeResponse>("/api/auth/me", {
    accessToken,
  });
}

export async function updateMe(
  accessToken: string,
  payload: { name?: string; dateOfBirth?: string }
) {
  return request<MeResponse>("/api/auth/me", {
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

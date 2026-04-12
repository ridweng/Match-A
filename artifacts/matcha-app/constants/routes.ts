export const AUTH_SIGN_IN_ROUTE = "/login" as const;
export const AUTH_CALLBACK_ROUTE = "/auth-callback" as const;
export const FORGOT_PASSWORD_ROUTE = "/forgot-password" as const;
export const RESET_PASSWORD_ROUTE = "/reset-password" as const;
export const VERIFY_EMAIL_RESULT_ROUTE = "/verify-email-result" as const;
export const DISCOVER_ROUTE = "/(tabs)/discover" as const;

export const PUBLIC_UNAUTHENTICATED_ROUTES = [
  AUTH_SIGN_IN_ROUTE,
  AUTH_CALLBACK_ROUTE,
  FORGOT_PASSWORD_ROUTE,
  RESET_PASSWORD_ROUTE,
  VERIFY_EMAIL_RESULT_ROUTE,
] as const;

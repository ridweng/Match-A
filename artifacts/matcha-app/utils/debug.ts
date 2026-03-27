const rawDevelopmentFlag =
  process.env.EXPO_PUBLIC_DEVELOPMENT ?? process.env.DEVELOPMENT ?? "";

export const debugEnabled = String(rawDevelopmentFlag).trim().toLowerCase() === "true";

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

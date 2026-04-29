import { Platform } from "react-native";

export function isAdminWebSurface() {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return false;
  }

  const hostname = window.location.hostname.toLowerCase();
  const pathname = window.location.pathname;

  return hostname.startsWith("admin.") || pathname === "/admin" || pathname.startsWith("/admin/");
}

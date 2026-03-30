import { Feather } from "@expo/vector-icons";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { KeyboardProviderCompat } from "@/components/KeyboardProviderCompat";
import Colors from "@/constants/colors";
import { AppProvider, useApp } from "@/context/AppContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const {
    authStatus,
    authBusy,
    postAuthRedirectRoute,
    clearPostAuthRedirectRoute,
    biometricLockRequired,
    t,
    goalsUnlockPromptVisible,
    dismissGoalsUnlockPrompt,
  } = useApp();
  const pathname = usePathname();
  const isAuthCallbackActive = pathname === "/auth-callback";
  const isLocked = authStatus === "authenticated" && biometricLockRequired;
  const shouldShowTabs =
    authStatus === "authenticated" && !biometricLockRequired;

  const [loadingVisible, setLoadingVisible] = useState(true);
  const [shouldRenderLoadingScreen, setShouldRenderLoadingScreen] =
    useState(true);
  const lastRedirectRef = useRef<string | null>(null);

  useEffect(() => {
    if (loadingVisible) {
      setShouldRenderLoadingScreen(true);
    }
  }, [loadingVisible]);

  useEffect(() => {
    if (authStatus === "loading") {
      setLoadingVisible(true);
      return;
    }

    if (isAuthCallbackActive && authBusy) {
      setLoadingVisible(true);
      return;
    }

    let nextRoute: string | null = null;

    if (authStatus !== "authenticated") {
      if (pathname !== "/login" && !isAuthCallbackActive) {
        nextRoute = "/login";
      }
    } else if (isLocked) {
      if (pathname !== "/biometric-lock") {
        nextRoute = "/biometric-lock";
      }
    } else if (postAuthRedirectRoute) {
      if (pathname === postAuthRedirectRoute) {
        clearPostAuthRedirectRoute();
      } else {
        nextRoute = postAuthRedirectRoute;
      }
    } else if (
      shouldShowTabs &&
      (pathname === "/login" ||
        pathname === "/biometric-lock" ||
        pathname === "/auth-callback")
    ) {
      nextRoute = "/(tabs)/discover";
    }

    if (nextRoute) {
      setLoadingVisible(true);
      if (lastRedirectRef.current !== nextRoute) {
        lastRedirectRef.current = nextRoute;
        router.replace(nextRoute as any);
      }
      return;
    }

    lastRedirectRef.current = null;

    const frame = requestAnimationFrame(() => {
      setLoadingVisible(false);
    });

    return () => cancelAnimationFrame(frame);
  }, [
    authStatus,
    authBusy,
    clearPostAuthRedirectRoute,
    isAuthCallbackActive,
    isLocked,
    pathname,
    postAuthRedirectRoute,
    shouldShowTabs,
  ]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth-callback" />
        <Stack.Screen name="login" />
        <Stack.Screen name="biometric-lock" />
        <Stack.Screen name="complete-profile" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
      </Stack>

      {shouldRenderLoadingScreen ? (
        <AppLoadingScreen
          visible={loadingVisible}
          onHidden={() => setShouldRenderLoadingScreen(false)}
        />
      ) : null}

      {shouldShowTabs && goalsUnlockPromptVisible ? (
        <Modal
          transparent
          animationType="fade"
          visible
          onRequestClose={() => {
            void dismissGoalsUnlockPrompt();
          }}
        >
          <View style={styles.unlockOverlay}>
            <View style={styles.unlockCardShell}>
              <LinearGradient
                colors={[Colors.backgroundElevated, Colors.backgroundCard]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.unlockCard}
              >
                <View style={styles.unlockHeaderRow}>
                  <View style={styles.unlockBadge}>
                    <Feather name="target" size={18} color={Colors.primaryLight} />
                  </View>
                  <View style={styles.unlockEyebrowPill}>
                    <Text style={styles.unlockEyebrow}>
                      {t("Metas desbloqueadas", "Goals unlocked")}
                    </Text>
                  </View>
                </View>

                <Text style={styles.unlockTitle}>
                  {t(
                    "Ya puedes entrar en Mis Metas",
                    "You can now enter My Goals"
                  )}
                </Text>
                <Text style={styles.unlockCopy}>
                  {t(
                    "Llegaste a 30 likes. Tus tendencias, objetivos y progreso personalizado ya están listos.",
                    "You reached 30 likes. Your trends, targets, and personalized progress are now ready."
                  )}
                </Text>

                <View style={styles.unlockHighlight}>
                  <View style={styles.unlockHighlightMetric}>
                    <Text style={styles.unlockHighlightValue}>30</Text>
                    <Text style={styles.unlockHighlightLabel}>
                      {t("likes alcanzados", "likes reached")}
                    </Text>
                  </View>
                  <View style={styles.unlockHighlightDivider} />
                  <View style={styles.unlockHighlightList}>
                    <Text style={styles.unlockHighlightItem}>
                      {t("Tendencias visibles", "Visible trends")}
                    </Text>
                    <Text style={styles.unlockHighlightItem}>
                      {t("Objetivos activos", "Active goals")}
                    </Text>
                    <Text style={styles.unlockHighlightItem}>
                      {t("Progreso desbloqueado", "Progress unlocked")}
                    </Text>
                  </View>
                </View>

                <View style={styles.unlockActions}>
                  <Pressable
                    onPress={() => {
                      void dismissGoalsUnlockPrompt().then(() => {
                        router.push("/(tabs)/goals" as any);
                      });
                    }}
                    style={({ pressed }) => [
                      styles.unlockPrimary,
                      pressed && styles.unlockPrimaryPressed,
                    ]}
                  >
                    <Text style={styles.unlockPrimaryText}>
                      {t("Ir a Mis Metas", "Go to My Goals")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      void dismissGoalsUnlockPrompt();
                    }}
                    style={({ pressed }) => [
                      styles.unlockSecondary,
                      pressed && styles.unlockSecondaryPressed,
                    ]}
                  >
                    <Text style={styles.unlockSecondaryText}>
                      {t("Ahora no", "Not now")}
                    </Text>
                  </Pressable>
                </View>
              </LinearGradient>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProviderCompat>
              <AppProvider>
                <RootLayoutNav />
              </AppProvider>
            </KeyboardProviderCompat>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  unlockOverlay: {
    flex: 1,
    backgroundColor: Colors.overlayHeavy,
    padding: 24,
    justifyContent: "center",
  },
  unlockCardShell: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: "#000",
    shadowOpacity: 0.34,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  unlockCard: {
    padding: 24,
    gap: 14,
  },
  unlockHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  unlockBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(82, 183, 136, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(82, 183, 136, 0.28)",
  },
  unlockEyebrowPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "rgba(183, 152, 110, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(212, 184, 150, 0.24)",
  },
  unlockEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: Colors.goldLight,
  },
  unlockTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.text,
  },
  unlockCopy: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 23,
    color: Colors.textSecondary,
  },
  unlockHighlight: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: "rgba(15, 26, 20, 0.52)",
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 16,
  },
  unlockHighlightMetric: {
    minWidth: 92,
    justifyContent: "center",
    gap: 4,
  },
  unlockHighlightValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: Colors.primaryLight,
  },
  unlockHighlightLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  unlockHighlightDivider: {
    width: 1,
    backgroundColor: Colors.borderLight,
  },
  unlockHighlightList: {
    flex: 1,
    justifyContent: "center",
    gap: 8,
  },
  unlockHighlightItem: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.ivory,
  },
  unlockActions: {
    gap: 12,
    marginTop: 2,
  },
  unlockPrimary: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
  },
  unlockPrimaryPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  unlockPrimaryText: {
    fontFamily: "Inter_700Bold",
    color: Colors.textInverted,
    fontSize: 15,
  },
  unlockSecondary: {
    backgroundColor: "rgba(15, 26, 20, 0.36)",
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  unlockSecondaryPressed: {
    opacity: 0.88,
  },
  unlockSecondaryText: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.ivoryDim,
    fontSize: 15,
  },
});

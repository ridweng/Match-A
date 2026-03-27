import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { KeyboardProviderCompat } from "@/components/KeyboardProviderCompat";
import { AppProvider, useApp } from "@/context/AppContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const {
    authStatus,
    authBusy,
    biometricLockRequired,
    needsProfileCompletion,
    hasCompletedOnboarding,
  } = useApp();
  const pathname = usePathname();

  const [loadingVisible, setLoadingVisible] = useState(true);
  const [shouldRenderLoadingScreen, setShouldRenderLoadingScreen] =
    useState(true);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (pathname === "/auth-callback" && authBusy) {
      return;
    }

    if (authStatus !== "authenticated") {
      if (pathname !== "/login" && pathname !== "/auth-callback") {
        router.replace("/login" as any);
      }
    } else if (biometricLockRequired) {
      if (pathname !== "/biometric-lock") {
        router.replace("/biometric-lock" as any);
      }
    } else if (needsProfileCompletion) {
      if (pathname !== "/complete-profile") {
        router.replace("/complete-profile" as any);
      }
    } else if (!hasCompletedOnboarding) {
      if (pathname !== "/onboarding") {
        router.replace("/onboarding" as any);
      }
    } else if (
      pathname === "/login" ||
      pathname === "/biometric-lock" ||
      pathname === "/complete-profile" ||
      pathname === "/onboarding" ||
      pathname === "/auth-callback"
    ) {
      router.replace("/(tabs)/discover" as any);
    }

    const frame = requestAnimationFrame(() => {
      setLoadingVisible(false);
    });

    return () => cancelAnimationFrame(frame);
  }, [
    authStatus,
    authBusy,
    biometricLockRequired,
    needsProfileCompletion,
    hasCompletedOnboarding,
    pathname,
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

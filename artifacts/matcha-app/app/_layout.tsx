import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider, useApp } from "@/context/AppContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const {
    authStatus,
    biometricLockRequired,
    needsProfileCompletion,
    hasCompletedOnboarding,
  } = useApp();

  const [loadingVisible, setLoadingVisible] = useState(true);
  const [shouldRenderLoadingScreen, setShouldRenderLoadingScreen] =
    useState(true);
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    if (authStatus === "loading") return;

    if (!hasNavigatedRef.current) {
      hasNavigatedRef.current = true;

      if (authStatus !== "authenticated") {
        router.replace("/login" as any);
      } else if (biometricLockRequired) {
        router.replace("/biometric-lock" as any);
      } else if (needsProfileCompletion) {
        router.replace("/complete-profile" as any);
      } else if (!hasCompletedOnboarding) {
        router.replace("/onboarding" as any);
      } else {
        router.replace("/(tabs)/discover" as any);
      }
    }

    const frame = requestAnimationFrame(() => {
      setLoadingVisible(false);
    });

    return () => cancelAnimationFrame(frame);
  }, [
    authStatus,
    biometricLockRequired,
    needsProfileCompletion,
    hasCompletedOnboarding,
  ]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
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
            <AppProvider>
              <RootLayoutNav />
            </AppProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

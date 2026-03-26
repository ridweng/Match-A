import { router } from "expo-router";
import React, { useEffect } from "react";
import { View } from "react-native";

import { useApp } from "@/context/AppContext";
import colors from "@/constants/colors";

export default function Entry() {
  const {
    authStatus,
    biometricLockRequired,
    needsProfileCompletion,
    hasCompletedOnboarding,
  } = useApp();

  useEffect(() => {
    if (authStatus === "loading") return;
    const timeout = setTimeout(() => {
      if (authStatus !== "authenticated") {
        router.replace("/login");
      } else if (biometricLockRequired) {
        router.replace("/biometric-lock");
      } else if (needsProfileCompletion) {
        router.replace("/complete-profile");
      } else if (!hasCompletedOnboarding) {
        router.replace("/onboarding");
      } else {
        router.replace("/(tabs)/discover");
      }
    }, 100);
    return () => clearTimeout(timeout);
  }, [
    authStatus,
    biometricLockRequired,
    needsProfileCompletion,
    hasCompletedOnboarding,
  ]);

  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}

import React from "react";
import { Redirect } from "expo-router";

import { useApp } from "@/context/AppContext";

export default function Entry() {
  const {
    authStatus,
    biometricLockRequired,
    needsProfileCompletion,
    hasCompletedOnboarding,
  } = useApp();

  if (authStatus === "loading") {
    return null;
  }

  if (authStatus !== "authenticated") {
    return <Redirect href="/login" />;
  }

  if (biometricLockRequired) {
    return <Redirect href="/biometric-lock" />;
  }

  if (needsProfileCompletion) {
    return <Redirect href="/complete-profile" />;
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)/discover" />;
}

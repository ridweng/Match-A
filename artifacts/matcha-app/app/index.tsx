import React from "react";
import { Redirect } from "expo-router";

import { useApp } from "@/context/AppContext";

export default function Entry() {
  const { authStatus, biometricLockRequired } = useApp();

  if (authStatus === "loading") {
    return null;
  }

  if (authStatus !== "authenticated") {
    return <Redirect href="/login" />;
  }

  if (biometricLockRequired) {
    return <Redirect href="/biometric-lock" />;
  }

  return <Redirect href="/(tabs)/discover" />;
}

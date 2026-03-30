import React from "react";
import { Platform } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";

export function KeyboardProviderCompat({
  children,
}: {
  children: React.ReactNode;
}) {
  if (Platform.OS === "web") {
    return <>{children}</>;
  }

  return (
    <KeyboardProvider enabled>{children}</KeyboardProvider>
  );
}

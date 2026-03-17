import { router } from "expo-router";
import React, { useEffect } from "react";
import { View } from "react-native";

import { useApp } from "@/context/AppContext";
import colors from "@/constants/colors";

export default function Entry() {
  const { isLoggedIn } = useApp();

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoggedIn) {
        router.replace("/(tabs)/discover");
      } else {
        router.replace("/login");
      }
    }, 100);
    return () => clearTimeout(timeout);
  }, [isLoggedIn]);

  return <View style={{ flex: 1, backgroundColor: colors.navy }} />;
}

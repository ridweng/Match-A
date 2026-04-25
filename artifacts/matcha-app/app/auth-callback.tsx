import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { View } from "react-native";

import Colors from "@/constants/colors";
import { AUTH_SIGN_IN_ROUTE } from "@/constants/routes";
import { useApp } from "@/context/AppContext";
import type { AuthCallbackPayload } from "@/services/auth";

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const { handleAuthCallback } = useApp();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }
    handledRef.current = true;

    const payload: AuthCallbackPayload = {
      status: typeof params.status === "string" ? params.status : undefined,
      provider: typeof params.provider === "string" ? params.provider : undefined,
      code: typeof params.code === "string" ? params.code : undefined,
      handoffCode:
        typeof params.handoffCode === "string" ? params.handoffCode : undefined,
      message: typeof params.message === "string" ? params.message : undefined,
      needsProfileCompletion:
        typeof params.needsProfileCompletion === "string"
          ? params.needsProfileCompletion === "true"
          : false,
      email: typeof params.email === "string" ? params.email : undefined,
    };

    void (async () => {
      const success = await handleAuthCallback(payload);
      if (!success) {
        router.replace(AUTH_SIGN_IN_ROUTE);
      }
    })();
  }, [handleAuthCallback, params]);

  return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
}

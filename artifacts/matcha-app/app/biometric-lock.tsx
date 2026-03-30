import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

function getBiometricMessage(
  code: string | undefined,
  t: (es: string, en: string) => string
) {
  switch (code) {
    case "BIOMETRICS_UNAVAILABLE":
      return t(
        "Este dispositivo no tiene biometría disponible.",
        "This device does not have biometric support available."
      );
    case "BIOMETRICS_NOT_ENROLLED":
      return t(
        "Configura Face ID, Touch ID o huella en tu dispositivo primero.",
        "Set up Face ID, Touch ID, or fingerprint on your device first."
      );
    case "BIOMETRIC_CANCELLED":
      return t("Desbloqueo cancelado.", "Unlock cancelled.");
    case "BIOMETRIC_AUTH_FAILED":
      return t("No pudimos verificar tu identidad.", "We could not verify your identity.");
    default:
      return "";
  }
}

export default function BiometricLockScreen() {
  const insets = useSafeAreaInsets();
  const {
    authStatus,
    biometricBusy,
    biometricLockRequired,
    logout,
    t,
    unlockWithBiometrics,
  } = useApp();
  const hasPromptedRef = useRef(false);
  const [message, setMessage] = React.useState("");

  const runBiometricUnlock = async () => {
    const result = await unlockWithBiometrics();
    if (result.ok) {
      setMessage("");
      return;
    }
    setMessage(getBiometricMessage(result.code, t));
  };

  useEffect(() => {
    if (authStatus !== "authenticated") {
      router.replace("/login");
      return;
    }
    if (!biometricLockRequired) {
      router.replace("/(tabs)/discover");
      return;
    }
    if (!hasPromptedRef.current) {
      hasPromptedRef.current = true;
      runBiometricUnlock().catch(() => {});
    }
  }, [authStatus, biometricLockRequired]);

  const handleFallbackLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 18) },
      ]}
    >
      <View style={styles.iconWrap}>
        <Feather name="shield" size={30} color={Colors.primaryLight} />
      </View>
      <Text style={styles.title}>{t("Desbloquear MatchA", "Unlock MatchA")}</Text>
      <Text style={styles.subtitle}>
        {t(
          "Esta cuenta tiene biometría activada en este dispositivo.",
          "This account has biometric unlock enabled on this device."
        )}
      </Text>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Pressable
        onPress={() => runBiometricUnlock().catch(() => {})}
        disabled={biometricBusy}
        style={({ pressed }) => [
          styles.primaryBtn,
          pressed && !biometricBusy && { opacity: 0.84 },
        ]}
      >
        {biometricBusy ? (
          <ActivityIndicator color={Colors.textInverted} />
        ) : (
          <>
            <Feather name="lock" size={16} color={Colors.textInverted} />
            <Text style={styles.primaryBtnText}>
              {t("Intentar de nuevo", "Try again")}
            </Text>
          </>
        )}
      </Pressable>

      <Pressable
        onPress={handleFallbackLogout}
        style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.84 }]}
      >
        <Feather name="log-out" size={16} color={Colors.ivory} />
        <Text style={styles.secondaryBtnText}>
          {t("Volver al inicio de sesión", "Back to sign in")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(82,183,136,0.16)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.28)",
  },
  title: {
    marginTop: 18,
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.text,
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 10,
    maxWidth: 320,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  message: {
    marginTop: 18,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 19,
    color: Colors.warning,
    textAlign: "center",
  },
  primaryBtn: {
    marginTop: 28,
    minWidth: 240,
    height: 54,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.textInverted,
  },
  secondaryBtn: {
    marginTop: 12,
    minWidth: 240,
    height: 52,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.ivory,
  },
});

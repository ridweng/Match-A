import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateOfBirthField } from "@/components/DateOfBirthField";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useBottomObstruction } from "@/components/useBottomObstruction";
import Colors from "@/constants/colors";
import { AUTH_SIGN_IN_ROUTE } from "@/constants/routes";
import { useApp } from "@/context/AppContext";
import { isAdultBirthDate } from "@/utils/dateOfBirth";

export default function CompleteProfileScreen() {
  const insets = useSafeAreaInsets();
  const { restingBottomInset } = useBottomObstruction({
    safeAreaBottomInset: insets.bottom,
    restingBottomSpacing: 24,
  });
  const {
    authStatus,
    authBusy,
    authError,
    clearAuthFeedback,
    completeProfile,
    isOnline,
    resolvedAccessGate,
    sessionOfflineFallback,
    t,
    user,
  } = useApp();

  const [name, setName] = useState(user?.name || "");
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth || "");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      router.replace(AUTH_SIGN_IN_ROUTE);
      return;
    }
    if (resolvedAccessGate.route !== "/complete-profile") {
      router.replace(resolvedAccessGate.route);
    }
  }, [authStatus, resolvedAccessGate.route]);

  const isServerSaveBlocked = !isOnline || sessionOfflineFallback;
  const offlineBannerCopy = t(
    "Necesitas conexión para continuar con el onboarding.",
    "You need a connection to continue onboarding."
  );

  const handleSave = async () => {
    clearAuthFeedback();
    setLocalError(null);
    if (!name.trim() || !dateOfBirth.trim()) {
      setLocalError(
        t(
          "Completa nombre y fecha de nacimiento.",
          "Complete name and date of birth."
        )
      );
      return;
    }
    if (!isAdultBirthDate(dateOfBirth)) {
      setLocalError(
        t(
          "Debes tener al menos 18 años.",
          "You must be at least 18 years old."
        )
      );
      return;
    }
    if (isServerSaveBlocked) {
      setLocalError(offlineBannerCopy);
      return;
    }
    const ok = await completeProfile({
      name: name.trim(),
      dateOfBirth,
    });
    if (ok) {
      router.replace(resolvedAccessGate.route === "/complete-profile" ? "/onboarding" : resolvedAccessGate.route);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollViewCompat
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 18),
            paddingBottom: restingBottomInset,
          },
        ]}
        bottomOffset={restingBottomInset}
        extraKeyboardSpace={24}
        keyboardDismissMode="none"
      >
        <View
          style={[
            styles.content,
            Platform.OS !== "android" && styles.contentCentered,
          ]}
        >
        {isServerSaveBlocked ? (
          <View style={styles.offlineBanner}>
            <Feather name="wifi-off" size={16} color={Colors.info} />
            <Text style={styles.offlineBannerText}>{offlineBannerCopy}</Text>
          </View>
        ) : null}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Feather name="user-check" size={18} color={Colors.primaryLight} />
          </View>
          <Text style={styles.title}>
            {t("Completa tu perfil", "Complete your profile")}
          </Text>
          <Text style={styles.sub}>
            {t(
              "Para terminar el registro necesitamos tu nombre y fecha de nacimiento.",
              "To finish sign-up we need your name and date of birth."
            )}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t("Nombre", "Name")}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t("Tu nombre", "Your name")}
            placeholderTextColor="rgba(240,245,241,0.28)"
          />

          <DateOfBirthField
            label={t("Fecha de nacimiento", "Date of birth")}
            value={dateOfBirth}
            onChange={setDateOfBirth}
            cancelLabel={t("Cancelar", "Cancel")}
            confirmLabel={t("Guardar", "Save")}
          />

          {localError ? <Text style={styles.error}>{localError}</Text> : null}
          {!localError && authError ? <Text style={styles.error}>{authError}</Text> : null}

          <Pressable
            onPress={handleSave}
            disabled={authBusy || isServerSaveBlocked}
            style={({ pressed }) => [
              styles.submit,
              pressed && !authBusy && !isServerSaveBlocked && { opacity: 0.88 },
              (authBusy || isServerSaveBlocked) && { opacity: 0.7 },
            ]}
          >
            {authBusy ? (
              <ActivityIndicator color={Colors.textInverted} />
            ) : (
              <>
                <Text style={styles.submitText}>
                  {t("Guardar y continuar", "Save and continue")}
                </Text>
                <Feather name="arrow-right" size={18} color={Colors.textInverted} />
              </>
            )}
          </Pressable>
        </View>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
  },
  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingTop: 12,
  },
  contentCentered: {
    flex: 1,
    justifyContent: "center",
  },
  offlineBanner: {
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.infoOverlay,
    borderWidth: 1,
    borderColor: "rgba(90,169,255,0.28)",
  },
  offlineBannerText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 18,
    color: Colors.text,
  },
  header: {
    paddingTop: 12,
    gap: 8,
  },
  badge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(82,183,136,0.14)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.24)",
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: Colors.text,
    letterSpacing: -0.9,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  card: {
    marginTop: 26,
    padding: 18,
    borderRadius: 24,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  label: {
    marginTop: 4,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
  },
  error: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.error,
    lineHeight: 18,
  },
  submit: {
    marginTop: 8,
    height: 54,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  submitText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.textInverted,
  },
});

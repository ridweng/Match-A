import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AuthScreenShell } from "@/components/AuthScreenShell";
import { AuthTextField } from "@/components/AuthTextField";
import Colors from "@/constants/colors";
import { AUTH_SIGN_IN_ROUTE } from "@/constants/routes";
import { useApp } from "@/context/AppContext";
import { ApiError, requestPasswordReset } from "@/services/auth";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function ForgotPasswordScreen() {
  const { t } = useApp();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const successCopy = useMemo(
    () => ({
      title: t("Revisa tu correo", "Check your email"),
      body: t(
        "Si el correo existe en MatchA, ya enviamos un enlace para restablecer tu contraseña.",
        "If the email exists in MatchA, we already sent a reset link."
      ),
      note: t(
        "Puedes cerrar esta pestaña ahora.",
        "You can close this tab now."
      ),
    }),
    [t]
  );

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setError(
        t(
          "Escribe un correo válido para continuar.",
          "Enter a valid email to continue."
        )
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(normalizedEmail);
      setSubmitted(true);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "UNKNOWN_ERROR";
      setError(
        code === "NETWORK_REQUEST_FAILED"
          ? t(
              "No pudimos contactar al servidor. Inténtalo de nuevo en un momento.",
              "We could not reach the server. Try again in a moment."
            )
          : t(
              "No pudimos procesar la solicitud. Inténtalo de nuevo.",
              "We could not process the request. Try again."
            )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreenShell
      title={t("Recuperar acceso", "Recover access")}
      subtitle={t(
        "Te enviaremos un enlace seguro para crear una nueva contraseña.",
        "We will send you a secure link to create a new password."
      )}
      eyebrow={t("Ayuda con tu cuenta", "Account help")}
      icon="mail"
      keyboardEnabled
      onBack={() => router.replace(AUTH_SIGN_IN_ROUTE)}
      cardVerticalAlign="center"
    >
      {submitted ? (
        <View style={styles.feedbackCard}>
          <View style={styles.feedbackIcon}>
            <Feather name="mail" size={20} color={Colors.primaryLight} />
          </View>
          <Text style={styles.feedbackTitle}>{successCopy.title}</Text>
          <Text style={styles.feedbackText}>{successCopy.body}</Text>
          <Text style={styles.feedbackHint}>{successCopy.note}</Text>

          <Pressable
            onPress={() => router.replace(AUTH_SIGN_IN_ROUTE)}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && { opacity: 0.84 },
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {t("Volver a iniciar sesión", "Back to sign in")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <AuthTextField
            label={t("Correo electrónico", "Email")}
            value={email}
            onChangeText={setEmail}
            placeholder={t("tu@email.com", "you@email.com")}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && !isSubmitting && { opacity: 0.86 },
              isSubmitting && { opacity: 0.7 },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={Colors.textInverted} />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>
                  {t("Enviar enlace", "Send link")}
                </Text>
                <Feather
                  name="arrow-right"
                  size={18}
                  color={Colors.textInverted}
                />
              </>
            )}
          </Pressable>
        </>
      )}
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  primaryButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.textInverted,
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.error,
    lineHeight: 18,
  },
  feedbackCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: "rgba(82,183,136,0.1)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.18)",
    gap: 10,
  },
  feedbackIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(82,183,136,0.14)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.22)",
  },
  feedbackTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  feedbackText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  feedbackHint: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 19,
    color: Colors.primaryLight,
  },
});

import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
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
import {
  ApiError,
  confirmPasswordReset,
  validatePasswordResetToken,
} from "@/services/auth";

type ResetTokenStatus = "checking" | "valid" | "invalid";

function getResetTokenMessage(
  code: string | null,
  t: (es: string, en: string) => string
) {
  switch (code) {
    case "EXPIRED_PASSWORD_RESET_TOKEN":
      return {
        title: t("Este enlace venció", "This link expired"),
        body: t(
          "Por seguridad, los enlaces para cambiar la contraseña expiran. Solicita uno nuevo para continuar.",
          "For security reasons, password reset links expire. Request a new one to continue."
        ),
      };
    case "USED_PASSWORD_RESET_TOKEN":
      return {
        title: t("Este enlace ya fue usado", "This link was already used"),
        body: t(
          "Este enlace solo puede usarse una vez. Solicita uno nuevo si necesitas volver a cambiar tu contraseña.",
          "This link can only be used once. Request a new one if you need to change your password again."
        ),
      };
    case "SUPERSEDED_PASSWORD_RESET_TOKEN":
      return {
        title: t("Este enlace fue reemplazado", "This link was replaced"),
        body: t(
          "Usa el correo más reciente que te enviamos para restablecer tu contraseña.",
          "Use the most recent email we sent you to reset your password."
        ),
      };
    default:
      return {
        title: t("Este enlace no es válido", "This link is not valid"),
        body: t(
          "Es posible que el enlace esté incompleto o ya no corresponda a una recuperación activa.",
          "The link may be incomplete or no longer belong to an active recovery flow."
        ),
      };
  }
}

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { t } = useApp();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [tokenStatus, setTokenStatus] = useState<ResetTokenStatus>("checking");
  const [tokenErrorCode, setTokenErrorCode] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [closeAttempted, setCloseAttempted] = useState(false);
  const closeStartedRef = useRef(false);

  useEffect(() => {
    const currentToken = typeof token === "string" ? token : "";
    if (!currentToken) {
      setTokenStatus("invalid");
      setTokenErrorCode("INVALID_PASSWORD_RESET_TOKEN");
      return;
    }

    let cancelled = false;
    setTokenStatus("checking");
    setTokenErrorCode(null);

    void (async () => {
      try {
        await validatePasswordResetToken(currentToken);
        if (!cancelled) {
          setTokenStatus("valid");
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        const code =
          error instanceof ApiError ? error.code : "INVALID_PASSWORD_RESET_TOKEN";
        setTokenStatus("invalid");
        setTokenErrorCode(code);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!resetComplete || closeStartedRef.current) {
      return;
    }

    closeStartedRef.current = true;
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }

    let closeCheckTimeout: ReturnType<typeof window.setTimeout> | undefined;

    const timeout = setTimeout(() => {
      try {
        window.close();
      } catch {}

      closeCheckTimeout = window.setTimeout(() => {
        if (!window.closed) {
          setCloseAttempted(true);
        }
      }, 250);
    }, 1500);

    return () => {
      clearTimeout(timeout);
      if (closeCheckTimeout) {
        window.clearTimeout(closeCheckTimeout);
      }
    };
  }, [resetComplete]);

  const invalidState = useMemo(
    () => getResetTokenMessage(tokenErrorCode, t),
    [t, tokenErrorCode]
  );
  const successHint = useMemo(() => {
    if (Platform.OS !== "web") {
      return t(
        "Ya puedes iniciar sesión con tu nueva contraseña.",
        "You can now sign in with your new password."
      );
    }
    if (closeAttempted) {
      return t(
        "Ya puedes cerrar esta pestaña.",
        "You can close this tab now."
      );
    }
    return t(
      "Estamos cerrando esta pestaña.",
      "We are closing this tab."
    );
  }, [closeAttempted, t]);

  const handleSubmit = async () => {
    const currentToken = typeof token === "string" ? token : "";
    if (!currentToken) {
      setTokenStatus("invalid");
      setTokenErrorCode("INVALID_PASSWORD_RESET_TOKEN");
      return;
    }
    if (!password.trim()) {
      setFormError(
        t(
          "Escribe una nueva contraseña para continuar.",
          "Enter a new password to continue."
        )
      );
      return;
    }
    if (password.length < 8) {
      setFormError(
        t(
          "La nueva contraseña debe tener al menos 8 caracteres.",
          "The new password must be at least 8 characters."
        )
      );
      return;
    }
    if (password !== confirmPassword) {
      setFormError(
        t(
          "Las contraseñas no coinciden.",
          "The passwords do not match."
        )
      );
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await confirmPasswordReset(currentToken, password);
      setResetComplete(true);
    } catch (error) {
      const code =
        error instanceof ApiError ? error.code : "INVALID_PASSWORD_RESET_TOKEN";
      if (
        [
          "INVALID_PASSWORD_RESET_TOKEN",
          "EXPIRED_PASSWORD_RESET_TOKEN",
          "USED_PASSWORD_RESET_TOKEN",
          "SUPERSEDED_PASSWORD_RESET_TOKEN",
        ].includes(code)
      ) {
        setTokenStatus("invalid");
        setTokenErrorCode(code);
        return;
      }
      setFormError(
        code === "NETWORK_REQUEST_FAILED"
          ? t(
              "No pudimos actualizar tu contraseña. Inténtalo de nuevo en un momento.",
              "We could not update your password. Try again in a moment."
            )
          : t(
              "No pudimos actualizar tu contraseña. Vuelve a intentarlo.",
              "We could not update your password. Try again."
            )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreenShell
      title={t("Crear nueva contraseña", "Create a new password")}
      subtitle={t(
        "Elige una contraseña nueva para volver a entrar en MatchA.",
        "Choose a new password to sign back in to MatchA."
      )}
      eyebrow={t("Restablecimiento seguro", "Secure reset")}
      icon="lock"
      keyboardEnabled={tokenStatus === "valid" && !resetComplete}
      onBack={() => router.replace(AUTH_SIGN_IN_ROUTE)}
      cardVerticalAlign="center"
      contentVerticalAlign="center"
    >
      {tokenStatus === "checking" ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={Colors.primaryLight} />
          <Text style={styles.stateText}>
            {t(
              "Estamos validando tu enlace...",
              "We are validating your link..."
            )}
          </Text>
        </View>
      ) : null}

      {tokenStatus === "invalid" ? (
        <View style={styles.feedbackCard}>
          <View style={styles.feedbackIconError}>
            <Feather name="x" size={20} color={Colors.error} />
          </View>
          <Text style={styles.feedbackTitle}>{invalidState.title}</Text>
          <Text style={styles.feedbackText}>{invalidState.body}</Text>
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
      ) : null}

      {tokenStatus === "valid" && !resetComplete ? (
        <>
          <AuthTextField
            label={t("Nueva contraseña", "New password")}
            value={password}
            onChangeText={setPassword}
            placeholder={t("Mínimo 8 caracteres", "At least 8 characters")}
            secureTextEntry
          />
          <AuthTextField
            label={t("Confirmar nueva contraseña", "Confirm new password")}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t("Repite tu nueva contraseña", "Repeat your new password")}
            secureTextEntry
          />

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

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
                  {t("Guardar contraseña", "Save password")}
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
      ) : null}

      {resetComplete ? (
        <View style={styles.feedbackCard}>
          <View style={styles.feedbackIcon}>
            <Feather name="check" size={20} color={Colors.primaryLight} />
          </View>
          <Text style={styles.feedbackTitle}>
            {t("Contraseña actualizada", "Password updated")}
          </Text>
          <Text style={styles.feedbackText}>
            {t(
              "Tu contraseña fue actualizada correctamente.",
              "Your password was updated successfully."
            )}
          </Text>
          <Text style={styles.feedbackHint}>{successHint}</Text>
          <Pressable
            onPress={() => router.replace(AUTH_SIGN_IN_ROUTE)}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && { opacity: 0.84 },
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {t("Ir a iniciar sesión", "Go to sign in")}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  centerState: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  stateText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.textSecondary,
  },
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
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
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
  feedbackIconError: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(230,57,70,0.12)",
    borderWidth: 1,
    borderColor: "rgba(230,57,70,0.18)",
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

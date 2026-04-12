import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AuthScreenShell } from "@/components/AuthScreenShell";
import Colors from "@/constants/colors";
import { AUTH_SIGN_IN_ROUTE } from "@/constants/routes";
import { useApp } from "@/context/AppContext";
import { ApiError, verifyEmail, type VerifyEmailResponse } from "@/services/auth";

type VerificationViewState =
  | { kind: "loading" }
  | { kind: "success" | "already_verified"; email: string | null }
  | {
      kind: "error";
      code:
        | "INVALID_VERIFICATION_TOKEN"
        | "EXPIRED_VERIFICATION_TOKEN"
        | "VERIFICATION_LINK_REPLACED"
        | "NETWORK_REQUEST_FAILED"
        | "UNKNOWN_ERROR";
    };

function buildEmailAuthCallbackDeepLink(
  status: "verified" | "already_verified",
  email: string | null
) {
  const params = new URLSearchParams({
    status,
    provider: "email",
  });
  if (email) {
    params.set("email", email);
  }
  return `matcha:///auth-callback?${params.toString()}`;
}

export default function VerifyEmailResultScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { t } = useApp();
  const [viewState, setViewState] = useState<VerificationViewState>({ kind: "loading" });
  const [secondsRemaining, setSecondsRemaining] = useState(10);
  const completionStartedRef = useRef(false);

  useEffect(() => {
    const currentToken = typeof token === "string" ? token : "";
    if (!currentToken) {
      setViewState({ kind: "error", code: "INVALID_VERIFICATION_TOKEN" });
      return;
    }

    let cancelled = false;
    setViewState({ kind: "loading" });

    void (async () => {
      try {
        const result = await verifyEmail(currentToken);
        if (cancelled) {
          return;
        }
        const status =
          result.status === "already_verified" ? "already_verified" : "success";
        setViewState({
          kind: status,
          email: result.user?.email ?? null,
        });
        setSecondsRemaining(10);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const code = error instanceof ApiError ? error.code : "UNKNOWN_ERROR";
        setViewState({
          kind: "error",
          code:
            code === "EXPIRED_VERIFICATION_TOKEN" ||
            code === "VERIFICATION_LINK_REPLACED" ||
            code === "INVALID_VERIFICATION_TOKEN" ||
            code === "NETWORK_REQUEST_FAILED"
              ? code
              : "UNKNOWN_ERROR",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const finalizeSuccessFlow = useCallback(() => {
    if (completionStartedRef.current) {
      return;
    }
    completionStartedRef.current = true;

    if (Platform.OS !== "web" || typeof window === "undefined") {
      router.replace(AUTH_SIGN_IN_ROUTE);
      return;
    }

    const status = viewState.kind === "already_verified" ? "already_verified" : "verified";
    const deepLink = buildEmailAuthCallbackDeepLink(
      status,
      "email" in viewState ? viewState.email : null
    );

    try {
      window.location.href = deepLink;
    } catch {}

    window.setTimeout(() => {
      try {
        window.close();
      } catch {}

      window.setTimeout(() => {
        if (!window.closed) {
          router.replace(AUTH_SIGN_IN_ROUTE);
        }
      }, 250);
    }, 1500);
  }, [viewState]);

  useEffect(() => {
    if (
      viewState.kind !== "success" &&
      viewState.kind !== "already_verified"
    ) {
      return;
    }
    if (secondsRemaining <= 0) {
      finalizeSuccessFlow();
      return;
    }

    const timeout = setTimeout(() => {
      setSecondsRemaining((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [finalizeSuccessFlow, secondsRemaining, viewState.kind]);

  const content = useMemo(() => {
    if (viewState.kind === "loading") {
      return {
        icon: "mail",
        eyebrow: t("Verificando tu correo", "Verifying your email"),
        title: t("Estamos confirmando tu acceso", "We are confirming your access"),
        subtitle: t(
          "Un momento. Estamos validando tu enlace de MatchA.",
          "One moment. We are validating your MatchA link."
        ),
        body: null,
      };
    }

    if (viewState.kind === "success") {
      return {
        icon: "check-circle",
        eyebrow: t("Correo confirmado", "Email confirmed"),
        title: t("Tu correo fue confirmado", "Your email was confirmed"),
        subtitle: t(
          "Tu cuenta ya está activa y lista para usarse en MatchA.",
          "Your account is now active and ready to use in MatchA."
        ),
        body: t(
          `Intentaremos abrir la app automáticamente. Esta ventana se cerrará en ${secondsRemaining} segundos.`,
          `We will try to open the app automatically. This window will close in ${secondsRemaining} seconds.`
        ),
      };
    }

    if (viewState.kind === "already_verified") {
      return {
        icon: "check-circle",
        eyebrow: t("Correo ya confirmado", "Email already confirmed"),
        title: t("Tu correo ya estaba confirmado", "Your email was already confirmed"),
        subtitle: t(
          "Tu cuenta ya estaba activa. Puedes continuar en MatchA sin hacer nada más.",
          "Your account was already active. You can continue in MatchA without doing anything else."
        ),
        body: t(
          `Intentaremos abrir la app automáticamente. Esta ventana se cerrará en ${secondsRemaining} segundos.`,
          `We will try to open the app automatically. This window will close in ${secondsRemaining} seconds.`
        ),
      };
    }

    const errorCode = viewState.kind === "error" ? viewState.code : "UNKNOWN_ERROR";

    switch (errorCode) {
      case "EXPIRED_VERIFICATION_TOKEN":
        return {
          icon: "clock",
          eyebrow: t("Enlace vencido", "Expired link"),
          title: t("Este enlace venció", "This link expired"),
          subtitle: t(
            "Por seguridad, los enlaces de verificación expiran. Solicita uno nuevo para continuar.",
            "For security reasons, verification links expire. Request a new one to continue."
          ),
          body: null,
        };
      case "VERIFICATION_LINK_REPLACED":
        return {
          icon: "refresh-cw",
          eyebrow: t("Enlace reemplazado", "Replaced link"),
          title: t("Este enlace ya fue reemplazado", "This link was replaced"),
          subtitle: t(
            "Usa el correo de verificación más reciente que te enviamos.",
            "Use the most recent verification email we sent you."
          ),
          body: null,
        };
      case "NETWORK_REQUEST_FAILED":
        return {
          icon: "wifi-off",
          eyebrow: t("Sin conexión", "Offline"),
          title: t("No pudimos verificar tu correo", "We could not verify your email"),
          subtitle: t(
            "No pudimos conectar con el servidor en este momento. Inténtalo de nuevo en unos segundos.",
            "We could not reach the server right now. Try again in a few seconds."
          ),
          body: null,
        };
      default:
        return {
          icon: "x-circle",
          eyebrow: t("Enlace inválido", "Invalid link"),
          title: t("Este enlace no es válido", "This link is not valid"),
          subtitle: t(
            "Es posible que el enlace esté incompleto o ya no corresponda a una verificación activa.",
            "The link may be incomplete or may no longer belong to an active verification."
          ),
          body: null,
        };
    }
  }, [secondsRemaining, t, viewState]);

  return (
    <AuthScreenShell
      title={content.title}
      subtitle={content.subtitle}
      eyebrow={content.eyebrow}
      icon={content.icon as React.ComponentProps<typeof Feather>["name"]}
      onBack={() => router.replace(AUTH_SIGN_IN_ROUTE)}
    >
      {viewState.kind === "loading" ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={Colors.primaryLight} />
          <Text style={styles.stateText}>
            {t(
              "Estamos verificando tu correo...",
              "We are verifying your email..."
            )}
          </Text>
        </View>
      ) : (
        <View style={styles.feedbackCard}>
          <View
            style={[
              styles.feedbackIcon,
              viewState.kind === "error" && styles.feedbackIconError,
            ]}
          >
            <Feather
              name={content.icon as React.ComponentProps<typeof Feather>["name"]}
              size={20}
              color={viewState.kind === "error" ? Colors.error : Colors.primaryLight}
            />
          </View>
          {content.body ? <Text style={styles.feedbackHint}>{content.body}</Text> : null}

          {viewState.kind === "success" || viewState.kind === "already_verified" ? (
            <Pressable
              onPress={finalizeSuccessFlow}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && { opacity: 0.86 },
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {t("Abrir MatchA ahora", "Open MatchA now")}
              </Text>
            </Pressable>
          ) : (
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
          )}
        </View>
      )}
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
    textAlign: "center",
  },
  feedbackCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 12,
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
    backgroundColor: "rgba(230,57,70,0.12)",
    borderColor: "rgba(230,57,70,0.18)",
  },
  feedbackHint: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 20,
    color: Colors.primaryLight,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
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
});

import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateOfBirthField } from "@/components/DateOfBirthField";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import type { AuthProvider } from "@/services/auth";
import { isAdultBirthDate } from "@/utils/dateOfBirth";

type AuthMode = "landing" | "signin" | "signup";
type AuthCardFace = "front" | "back";

const { width } = Dimensions.get("window");
const INITIAL_VERIFICATION_POLL_MS = 60_000;
const VERIFICATION_POLL_INCREMENT_MS = 30_000;

const providerMeta: Array<{
  provider: AuthProvider;
  icon: string;
  labelEs: string;
  labelEn: string;
}> = [
  { provider: "google", icon: "globe", labelEs: "Continuar con Google", labelEn: "Continue with Google" },
  { provider: "facebook", icon: "users", labelEs: "Continuar con Facebook", labelEn: "Continue with Facebook" },
  { provider: "apple", icon: "smartphone", labelEs: "Continuar con Apple", labelEn: "Continue with Apple" },
];

function translateAuthError(code: string | null, t: (es: string, en: string) => string) {
  switch (code) {
    case "EMAIL_ALREADY_IN_USE":
      return t("Este correo ya está registrado.", "This email is already registered.");
    case "INVALID_CREDENTIALS":
      return t("Correo o contraseña inválidos.", "Invalid email or password.");
    case "EMAIL_VERIFICATION_REQUIRED":
      return t("Verifica tu correo antes de iniciar sesión.", "Verify your email before signing in.");
    case "EXPIRED_VERIFICATION_TOKEN":
      return t(
        "Este enlace de verificación expiró. Solicita uno nuevo.",
        "This verification link expired. Request a new one."
      );
    case "INVALID_VERIFICATION_TOKEN":
      return t(
        "Este enlace de verificación no es válido.",
        "This verification link is not valid."
      );
    case "VERIFICATION_LINK_REPLACED":
      return t(
        "Este enlace ya fue reemplazado. Usa el correo de verificación más reciente.",
        "This link was replaced. Use the most recent verification email."
      );
    case "UNDERAGE":
      return t("Debes tener al menos 18 años.", "You must be at least 18 years old.");
    case "PROVIDER_UNAVAILABLE":
      return t(
        "Este proveedor todavía no está configurado en este entorno.",
        "This provider is not configured in this environment yet."
      );
    case "AUTH_CANCELLED":
      return t("Autenticación cancelada.", "Authentication cancelled.");
    default:
      return code
        ? t("No pudimos completar la acción.", "We could not complete the action.")
        : null;
  }
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric";
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(240,245,241,0.28)"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  );
}

function formatCountdownLabel(
  totalSeconds: number | null,
  t: (es: string, en: string) => string
) {
  if (totalSeconds === null) {
    return t("1 min", "1 min");
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return t(`${seconds}s`, `${seconds}s`);
  }

  if (seconds === 0) {
    return t(`${minutes} min`, `${minutes} min`);
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const {
    signIn,
    signUp,
    signInWithProvider,
    authBusy,
    authError,
    authFormPrefill,
    pendingVerificationEmail,
    verificationStatus,
    checkPendingVerificationStatus,
    providerAvailability,
    clearAuthFeedback,
    t,
  } = useApp();

  const primaryScale = useRef(new Animated.Value(1)).current;
  const secondaryScale = useRef(new Animated.Value(1)).current;
  const cardFlip = useRef(new Animated.Value(0)).current;
  const wasVerificationBackVisibleRef = useRef(false);

  const [mode, setMode] = useState<AuthMode>("landing");
  const [visibleCardFace, setVisibleCardFace] = useState<AuthCardFace>("front");
  const [isCardFlipping, setIsCardFlipping] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [verificationDelayMs, setVerificationDelayMs] = useState(
    INITIAL_VERIFICATION_POLL_MS
  );
  const [nextVerificationCheckAt, setNextVerificationCheckAt] = useState<number | null>(
    null
  );
  const [secondsUntilVerificationCheck, setSecondsUntilVerificationCheck] = useState<
    number | null
  >(null);

  const animatePress = (anim: Animated.Value, down: boolean) => {
    Animated.spring(anim, {
      toValue: down ? 0.95 : 1,
      useNativeDriver: true,
    }).start();
  };

  const resetMessages = () => {
    setLocalError(null);
    clearAuthFeedback();
  };

  const switchMode = (nextMode: AuthMode) => {
    resetMessages();
    setMode(nextMode);
  };

  const animateCardToFace = useCallback(
    (nextFace: AuthCardFace) => {
      if (visibleCardFace === nextFace || isCardFlipping) {
        return;
      }

      setIsCardFlipping(true);

      const finalValue = nextFace === "back" ? 1 : 0;
      const halfwayValue = 0.5;

      Animated.timing(cardFlip, {
        toValue: halfwayValue,
        duration: 170,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          setIsCardFlipping(false);
          return;
        }

        setVisibleCardFace(nextFace);
        cardFlip.setValue(halfwayValue);

        Animated.timing(cardFlip, {
          toValue: finalValue,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          setIsCardFlipping(false);
        });
      });
    },
    [cardFlip, isCardFlipping, visibleCardFace]
  );

  const validateSignIn = () => {
    if (!email.trim() || !password.trim()) {
      setLocalError(
        t(
          "Completa correo y contraseña.",
          "Complete email and password."
        )
      );
      return false;
    }
    return true;
  };

  const validateSignUp = () => {
    if (!name.trim() || !email.trim() || !password.trim() || !dateOfBirth.trim()) {
      setLocalError(
        t(
          "Completa nombre, correo, contraseña y fecha de nacimiento.",
          "Complete name, email, password, and date of birth."
        )
      );
      return false;
    }
    if (!isAdultBirthDate(dateOfBirth)) {
      setLocalError(
        t(
          "Debes tener al menos 18 años para registrarte.",
          "You must be at least 18 years old to sign up."
        )
      );
      return false;
    }
    if (password.length < 8) {
      setLocalError(
        t(
          "La contraseña debe tener al menos 8 caracteres.",
          "Password must be at least 8 characters."
        )
      );
      return false;
    }
    return true;
  };

  const handleSignIn = async () => {
    resetMessages();
    if (!validateSignIn()) return;
    const ok = await signIn({ email, password });
    if (!ok) return;
    setPassword("");
  };

  const handleSignUp = async () => {
    resetMessages();
    if (!validateSignUp()) return;
    const ok = await signUp({
      name: name.trim(),
      email: email.trim(),
      password,
      dateOfBirth,
    });
    if (!ok) return;
    setPassword("");
  };

  const handleProviderAuth = async (provider: AuthProvider) => {
    resetMessages();
    await signInWithProvider(provider, mode === "signup" ? "signup" : "signin");
  };

  const activeError = localError || translateAuthError(authError, t);
  const shouldShowVerificationBack =
    mode !== "landing" &&
    Boolean(pendingVerificationEmail) &&
    verificationStatus !== "idle" &&
    verificationStatus !== "verified";
  const topOffset = insets.top + (Platform.OS === "web" ? 67 : 16);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 34 : 24);
  const landingPaddingTop = topOffset + 24;
  const verificationChecking = verificationStatus === "checking";
  const nextCheckLabel = formatCountdownLabel(secondsUntilVerificationCheck, t);
  const cardScaleX = cardFlip.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.88, 1],
  });
  const cardScaleY = cardFlip.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.965, 1],
  });
  const cardOpacity = cardFlip.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.82, 1],
  });
  const cardTranslateY = cardFlip.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -6, 0],
  });

  useEffect(() => {
    if (shouldShowVerificationBack) {
      animateCardToFace("back");
      if (!wasVerificationBackVisibleRef.current) {
        setVerificationDelayMs(INITIAL_VERIFICATION_POLL_MS);
        setNextVerificationCheckAt(Date.now() + INITIAL_VERIFICATION_POLL_MS);
      }
    } else {
      animateCardToFace("front");
      if (wasVerificationBackVisibleRef.current) {
        setVerificationDelayMs(INITIAL_VERIFICATION_POLL_MS);
        setNextVerificationCheckAt(null);
        setSecondsUntilVerificationCheck(null);
      }
    }

    wasVerificationBackVisibleRef.current = shouldShowVerificationBack;
  }, [animateCardToFace, shouldShowVerificationBack]);

  useEffect(() => {
    if (!authFormPrefill) {
      return;
    }

    setEmail(authFormPrefill.email);
    setMode(authFormPrefill.mode);
    setPassword("");
    setName("");
    setDateOfBirth("");
    setLocalError(null);
  }, [authFormPrefill]);

  useEffect(() => {
    if (!shouldShowVerificationBack || nextVerificationCheckAt === null) {
      setSecondsUntilVerificationCheck(null);
      return;
    }

    const syncCountdown = () => {
      setSecondsUntilVerificationCheck(
        Math.max(0, Math.ceil((nextVerificationCheckAt - Date.now()) / 1000))
      );
    };

    syncCountdown();
    const interval = setInterval(syncCountdown, 1000);

    return () => clearInterval(interval);
  }, [nextVerificationCheckAt, shouldShowVerificationBack]);

  useEffect(() => {
    if (!shouldShowVerificationBack || nextVerificationCheckAt === null) {
      return;
    }

    const delayMs = Math.max(0, nextVerificationCheckAt - Date.now());
    const timeout = setTimeout(() => {
      void (async () => {
        const result = await checkPendingVerificationStatus();
        if (result === "verified") {
          setNextVerificationCheckAt(null);
          return;
        }

        const nextDelay =
          result === "pending"
            ? verificationDelayMs + VERIFICATION_POLL_INCREMENT_MS
            : verificationDelayMs;

        setVerificationDelayMs(nextDelay);
        setNextVerificationCheckAt(Date.now() + nextDelay);
      })();
    }, delayMs);

    return () => clearTimeout(timeout);
  }, [
    checkPendingVerificationStatus,
    nextVerificationCheckAt,
    shouldShowVerificationBack,
    verificationDelayMs,
  ]);

  const handleManualVerificationCheck = useCallback(async () => {
    const remainingDelayMs =
      nextVerificationCheckAt === null
        ? verificationDelayMs
        : Math.max(1000, nextVerificationCheckAt - Date.now());

    setNextVerificationCheckAt(null);

    const result = await checkPendingVerificationStatus();
    if (result === "verified") {
      return;
    }

    setNextVerificationCheckAt(Date.now() + remainingDelayMs);
  }, [
    checkPendingVerificationStatus,
    nextVerificationCheckAt,
    verificationDelayMs,
  ]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <Image
        source={require("../assets/images/login-bg.png")}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      <LinearGradient
        colors={[
          "rgba(15,26,20,0.16)",
          "rgba(15,26,20,0.5)",
          "rgba(15,26,20,0.9)",
          "#0F1A14",
        ]}
        locations={[0, 0.34, 0.64, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View
        style={[
          styles.scrollContent,
          { paddingBottom: bottomPadding, paddingTop: landingPaddingTop },
        ]}
      >
        <View style={styles.heroBlock}>
          <View style={styles.logoArea}>
            <View style={styles.logoMark}>
              <Feather name="compass" size={28} color={Colors.primaryLight} />
            </View>
            <Text style={styles.logoText}>MatchA</Text>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>
                {t("Mejórate. Atrae.", "Improve. Attract.")}
              </Text>
            </View>
          </View>

          <View style={styles.headlineArea}>
            <Text style={styles.headline}>
              {t("Tu mejor versión", "Your best self")}
            </Text>
            <Text style={styles.headline2}>{t("te espera.", "awaits you.")}</Text>
            <Text style={styles.subheadline}>
              {t(
                "Descubre qué aspectos de ti mismo puedes mejorar para atraer más y conectar mejor.",
                "Discover which parts of yourself you can improve to attract more and connect better."
              )}
            </Text>
          </View>
        </View>

        {mode === "landing" ? (
          <View style={styles.ctaArea}>
            <Animated.View style={{ transform: [{ scale: primaryScale }] }}>
              <Pressable
                onPressIn={() => animatePress(primaryScale, true)}
                onPressOut={() => animatePress(primaryScale, false)}
                onPress={() => switchMode("signup")}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>
                  {t("Crear mi cuenta", "Create my account")}
                </Text>
                <Feather name="arrow-right" size={18} color={Colors.textInverted} />
              </Pressable>
            </Animated.View>

            <Animated.View style={{ transform: [{ scale: secondaryScale }] }}>
              <Pressable
                onPressIn={() => animatePress(secondaryScale, true)}
                onPressOut={() => animatePress(secondaryScale, false)}
                onPress={() => switchMode("signin")}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>
                  {t("Ya tengo cuenta", "I already have an account")}
                </Text>
              </Pressable>
            </Animated.View>

            <View style={styles.featuresRow}>
              {[
                { icon: "zap" as const, label: t("Insights", "Insights") },
                { icon: "target" as const, label: t("Metas", "Goals") },
                { icon: "trending-up" as const, label: t("Progreso", "Progress") },
              ].map((feature) => (
                <View key={feature.icon} style={styles.featureItem}>
                  <Feather name={feature.icon} size={16} color={Colors.primaryLight} />
                  <Text style={styles.featureLabel}>{feature.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={styles.legal}>
          {t(
            "Al continuar, aceptas nuestros Términos y Política de privacidad.",
            "By continuing, you agree to our Terms and Privacy Policy."
          )}
        </Text>
      </View>

      {mode !== "landing" ? (
        <View style={[styles.overlayWrap, { paddingTop: topOffset, paddingBottom: bottomPadding }]}>
          <KeyboardAwareScrollViewCompat
            contentContainerStyle={styles.overlayScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bottomOffset={bottomPadding}
            extraKeyboardSpace={28}
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          >
            <Animated.View
              style={[
                styles.authCard,
                {
                  opacity: cardOpacity,
                  transform: [
                    { translateY: cardTranslateY },
                    { scaleX: cardScaleX },
                    { scaleY: cardScaleY },
                  ],
                },
              ]}
            >
              <View style={styles.authCardContent} pointerEvents={isCardFlipping ? "none" : "auto"}>
                {visibleCardFace === "front" ? (
                  <>
                    <View style={styles.authHeader}>
                      <Pressable
                        onPress={() => switchMode("landing")}
                        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
                      >
                        <Feather name="chevron-left" size={18} color={Colors.text} />
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.authTitle}>
                          {mode === "signin"
                            ? t("Iniciar sesión", "Sign in")
                            : t("Crear cuenta", "Create account")}
                        </Text>
                        <Text style={styles.authSub}>
                          {mode === "signin"
                            ? t("Vuelve a entrar a tu progreso.", "Get back to your progress.")
                            : t(
                                "Crea tu cuenta con correo o proveedor social.",
                                "Create your account with email or a social provider."
                              )}
                        </Text>
                      </View>
                    </View>

                    {providerMeta.map((item) => {
                      const enabled = providerAvailability[item.provider];
                      return (
                        <Pressable
                          key={item.provider}
                          onPress={() => handleProviderAuth(item.provider)}
                          disabled={authBusy || !enabled}
                          style={({ pressed }) => [
                            styles.providerBtn,
                            !enabled && styles.providerBtnDisabled,
                            pressed && enabled && { opacity: 0.84 },
                          ]}
                        >
                          <View style={styles.providerIconWrap}>
                            <Feather
                              name={item.icon as any}
                              size={16}
                              color={enabled ? Colors.text : Colors.textMuted}
                            />
                          </View>
                          <Text
                            style={[
                              styles.providerText,
                              !enabled && styles.providerTextDisabled,
                            ]}
                          >
                            {t(item.labelEs, item.labelEn)}
                          </Text>
                          {!enabled && (
                            <Text style={styles.providerPill}>
                              {t("Pronto", "Soon")}
                            </Text>
                          )}
                        </Pressable>
                      );
                    })}

                    <View style={styles.dividerRow}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>
                        {mode === "signin"
                          ? t("o entra con correo", "or sign in with email")
                          : t("o regístrate con correo", "or register with email")}
                      </Text>
                      <View style={styles.dividerLine} />
                    </View>

                    {mode === "signup" && (
                      <>
                        <Field
                          label={t("Nombre", "Name")}
                          value={name}
                          onChangeText={setName}
                          placeholder={t("Tu nombre", "Your name")}
                        />
                        <DateOfBirthField
                          label={t("Fecha de nacimiento", "Date of birth")}
                          value={dateOfBirth}
                          onChange={setDateOfBirth}
                          cancelLabel={t("Cancelar", "Cancel")}
                          confirmLabel={t("Guardar", "Save")}
                        />
                      </>
                    )}

                    <Field
                      label={t("Correo electrónico", "Email")}
                      value={email}
                      onChangeText={setEmail}
                      placeholder={t("tu@email.com", "you@email.com")}
                      keyboardType="email-address"
                    />

                    <Field
                      label={t("Contraseña", "Password")}
                      value={password}
                      onChangeText={setPassword}
                      placeholder={t("Mínimo 8 caracteres", "At least 8 characters")}
                      secureTextEntry
                    />

                    {activeError ? <Text style={styles.errorText}>{activeError}</Text> : null}

                    <Pressable
                      onPress={mode === "signin" ? handleSignIn : handleSignUp}
                      disabled={authBusy}
                      style={({ pressed }) => [
                        styles.submitBtn,
                        pressed && !authBusy && { opacity: 0.86 },
                        authBusy && { opacity: 0.7 },
                      ]}
                    >
                      {authBusy ? (
                        <ActivityIndicator color={Colors.textInverted} />
                      ) : (
                        <>
                          <Text style={styles.submitBtnText}>
                            {mode === "signin"
                              ? t("Entrar", "Sign in")
                              : t("Crear cuenta", "Create account")}
                          </Text>
                          <Feather
                            name="arrow-right"
                            size={18}
                            color={Colors.textInverted}
                          />
                        </>
                      )}
                    </Pressable>

                    <Pressable
                      onPress={() => switchMode(mode === "signin" ? "signup" : "signin")}
                      style={styles.swapAction}
                    >
                      <Text style={styles.swapActionText}>
                        {mode === "signin"
                          ? t("¿No tienes cuenta? Crear una", "No account yet? Create one")
                          : t(
                              "¿Ya tienes cuenta? Iniciar sesión",
                              "Already have an account? Sign in"
                            )}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <View style={styles.verificationBack}>
                    <View style={styles.authHeader}>
                      <Pressable
                        onPress={() => switchMode("landing")}
                        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
                      >
                        <Feather name="chevron-left" size={18} color={Colors.text} />
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.authTitle}>
                          {t("Verificación pendiente", "Verification pending")}
                        </Text>
                        <Text style={styles.authSub}>
                          {t(
                            "Mantén esta tarjeta abierta. Revisaremos tu verificación automáticamente.",
                            "Keep this card open. We will check your verification automatically."
                          )}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.verificationBadge}>
                      <Feather name="mail" size={18} color={Colors.primaryLight} />
                      <Text style={styles.verificationBadgeText}>
                        {t("Correo enviado", "Email sent")}
                      </Text>
                    </View>

                    <View style={styles.verifyBox}>
                      <Text style={styles.verifyTitle}>
                        {t("Revisa tu bandeja de entrada", "Check your inbox")}
                      </Text>
                      <Text style={styles.verifyText}>
                        {t(
                          `Tu cuenta ya está creada. Falta verificar ${pendingVerificationEmail}.`,
                          `Your account is ready. ${pendingVerificationEmail} still needs verification.`
                        )}
                      </Text>
                      <Text style={styles.verifyText}>
                        {t(
                          "La primera comprobación automática será en 1 minuto. Si sigue pendiente, aumentará 30 segundos cada vez.",
                          "The first automatic check will happen in 1 minute. If it is still pending, it will increase by 30 seconds each time."
                        )}
                      </Text>
                    </View>

                    <View style={styles.verificationMeta}>
                      <Text style={styles.verificationMetaLabel}>
                        {t(
                          `Próxima comprobación automática en ${nextCheckLabel}.`,
                          `Next automatic check in ${nextCheckLabel}.`
                        )}
                      </Text>
                      <Text style={styles.verificationMetaHint}>
                        {t(
                          "También puedes comprobarlo manualmente en cualquier momento.",
                          "You can also check it manually at any time."
                        )}
                      </Text>
                    </View>

                    {activeError ? (
                      <Text style={styles.errorText}>{activeError}</Text>
                    ) : null}

                    <Pressable
                      onPress={handleManualVerificationCheck}
                      disabled={verificationChecking}
                      style={({ pressed }) => [
                        styles.submitBtn,
                        pressed && !verificationChecking && { opacity: 0.86 },
                        verificationChecking && { opacity: 0.7 },
                      ]}
                    >
                      {verificationChecking ? (
                        <ActivityIndicator color={Colors.textInverted} />
                      ) : (
                        <>
                          <Text style={styles.submitBtnText}>
                            {t("Comprobar ahora", "Check now")}
                          </Text>
                          <Feather
                            name="refresh-cw"
                            size={18}
                            color={Colors.textInverted}
                          />
                        </>
                      )}
                    </Pressable>
                  </View>
                )}
              </View>
            </Animated.View>
          </KeyboardAwareScrollViewCompat>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    minHeight: "100%",
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  heroBlock: {
    gap: 28,
  },
  logoArea: {
    alignItems: "flex-start",
    gap: 8,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(82,183,136,0.15)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontFamily: "Inter_700Bold",
    fontSize: 38,
    color: Colors.text,
    letterSpacing: -1.3,
  },
  logoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "rgba(82,183,136,0.15)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.25)",
  },
  logoBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.primaryLight,
    letterSpacing: 0.5,
  },
  headlineArea: {
    gap: 6,
  },
  headline: {
    fontFamily: "Inter_700Bold",
    fontSize: width > 420 ? 44 : 40,
    color: Colors.text,
    lineHeight: 48,
    letterSpacing: -1.6,
  },
  headline2: {
    fontFamily: "Inter_700Bold",
    fontSize: width > 420 ? 44 : 40,
    color: Colors.primaryLight,
    lineHeight: 48,
    letterSpacing: -1.6,
    marginBottom: 10,
  },
  subheadline: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 23,
    color: "rgba(240,245,241,0.68)",
    maxWidth: 330,
  },
  ctaArea: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 18,
    paddingVertical: 17,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.textInverted,
    letterSpacing: -0.3,
  },
  secondaryBtn: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "rgba(240,245,241,0.2)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  secondaryBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: "rgba(240,245,241,0.78)",
  },
  featuresRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    paddingTop: 4,
  },
  featureItem: {
    alignItems: "center",
    gap: 4,
  },
  featureLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.textSecondary,
  },
  authCard: {
    borderRadius: 28,
    backgroundColor: "rgba(20,31,24,1)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.16)",
    width: "100%",
    maxWidth: 460,
    minHeight: 540,
    overflow: "hidden",
  },
  authCardContent: {
    flex: 1,
    padding: 20,
    gap: 14,
  },
  overlayWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    backgroundColor: "rgba(7,11,9,0.24)",
  },
  overlayScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  authHeader: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  authTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  authSub: {
    marginTop: 4,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(240,245,241,0.62)",
  },
  providerBtn: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  providerBtnDisabled: {
    opacity: 0.5,
  },
  providerIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  providerText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.text,
  },
  providerTextDisabled: {
    color: Colors.textSecondary,
  },
  providerPill: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.warning,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  dividerText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  fieldGroup: {
    gap: 7,
  },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.error,
    lineHeight: 18,
  },
  noticeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.primaryLight,
    lineHeight: 18,
  },
  verifyBox: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(82,183,136,0.09)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.18)",
    gap: 8,
  },
  verifyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: Colors.text,
  },
  verifyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  verificationBack: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
  },
  verificationBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(82,183,136,0.15)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.22)",
  },
  verificationBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.primaryLight,
    letterSpacing: 0.2,
  },
  verificationMeta: {
    gap: 6,
  },
  verificationMetaLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.text,
    lineHeight: 19,
  },
  verificationMetaHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  submitBtn: {
    height: 54,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  submitBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.textInverted,
  },
  swapAction: {
    alignSelf: "center",
    paddingTop: 4,
  },
  swapActionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.primaryLight,
  },
  legal: {
    marginTop: 22,
    marginBottom: 6,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 16,
    color: "rgba(240,245,241,0.3)",
    textAlign: "center",
  },
});

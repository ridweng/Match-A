import { Feather } from "@expo/vector-icons";
<<<<<<< HEAD
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
=======
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  Pressable,
  StatusBar,
>>>>>>> f81a9b8 (second try)
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

<<<<<<< HEAD
import colors from "@/constants/colors";
import { getTranslations } from "@/constants/i18n";
import { useApp } from "@/context/AppContext";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { language, setIsLoggedIn, setLanguage } = useApp();
  const t = getTranslations(language).login;

  const isWeb = Platform.OS === "web";
  const fadeAnim = useRef(new Animated.Value(isWeb ? 1 : 0)).current;
  const slideAnim = useRef(new Animated.Value(isWeb ? 0 : 40)).current;
  const logoAnim = useRef(new Animated.Value(isWeb ? 1 : 0)).current;

  useEffect(() => {
    if (isWeb) return;
    Animated.sequence([
      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const handleCreateAccount = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoggedIn(true);
    router.replace("/(tabs)/discover");
  };

  const handleSignIn = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsLoggedIn(true);
    router.replace("/(tabs)/discover");
=======
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";

const { width, height } = Dimensions.get("window");

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, t, language, setLanguage } = useApp();

  const primaryScale = useRef(new Animated.Value(1)).current;
  const secondaryScale = useRef(new Animated.Value(1)).current;

  const animatePress = (anim: Animated.Value, down: boolean) => {
    Animated.spring(anim, {
      toValue: down ? 0.95 : 1,
      useNativeDriver: true,
    }).start();
  };

  const handleLogin = () => {
    login();
    router.replace("/(tabs)/discover" as any);
>>>>>>> f81a9b8 (second try)
  };

  return (
    <View style={styles.container}>
<<<<<<< HEAD
      <LinearGradient
        colors={[colors.navy, "#091A10", "#0D2218"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.geometricDecor, styles.circle1]} />
      <View style={[styles.geometricDecor, styles.circle2]} />
      <View style={[styles.geometricDecor, styles.circle3]} />
      <LinearGradient
        colors={["transparent", "rgba(13,34,24,0.7)", colors.navy]}
        style={styles.bottomGradient}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop:
              insets.top + (Platform.OS === "web" ? 67 : 0),
            paddingBottom:
              insets.bottom + (Platform.OS === "web" ? 34 : 0),
          },
        ]}
      >
        <View style={styles.topSection}>
          <Animated.View
            style={[
              styles.logoContainer,
              { opacity: logoAnim, transform: [{ scale: logoAnim }] },
            ]}
          >
            <View style={styles.logoMark}>
              <View style={styles.logoDiamond} />
            </View>
            <Text style={styles.logoText}>MatchA</Text>
            <View style={styles.logoDot} />
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.bottomSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.tagline}>{t.tagline}</Text>
          <Text style={styles.sub}>{t.sub}</Text>

          <View style={styles.buttonStack}>
            <Pressable
              onPress={handleCreateAccount}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>{t.cta}</Text>
              <Feather name="arrow-right" size={18} color={colors.navy} />
            </Pressable>

            <Pressable
              onPress={handleSignIn}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>{t.signin}</Text>
            </Pressable>
          </View>

          <Text style={styles.legal}>{t.legal}</Text>

          <View style={styles.langRow}>
            <Pressable
              onPress={() => setLanguage("es")}
              style={[
                styles.langBtn,
                language === "es" && styles.langBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.langBtnText,
                  language === "es" && styles.langBtnTextActive,
                ]}
              >
                ES
              </Text>
            </Pressable>
            <View style={styles.langDivider} />
            <Pressable
              onPress={() => setLanguage("en")}
              style={[
                styles.langBtn,
                language === "en" && styles.langBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.langBtnText,
                  language === "en" && styles.langBtnTextActive,
                ]}
              >
                EN
              </Text>
            </Pressable>
          </View>
        </Animated.View>
=======
      <StatusBar barStyle="light-content" />

      {/* Background */}
      <Image
        source={require("../assets/images/login-bg.png")}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      {/* Dark overlay gradient */}
      <LinearGradient
        colors={[
          "rgba(15,26,20,0.25)",
          "rgba(15,26,20,0.55)",
          "rgba(15,26,20,0.92)",
          "#0F1A14",
        ]}
        locations={[0, 0.35, 0.65, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Language switcher */}
      <View
        style={[
          styles.langSwitch,
          { top: insets.top + (Platform.OS === "web" ? 67 : 16) },
        ]}
      >
        <Pressable
          onPress={() => setLanguage("es")}
          style={[styles.langBtn, language === "es" && styles.langBtnActive]}
        >
          <Text
            style={[
              styles.langText,
              language === "es" && styles.langTextActive,
            ]}
          >
            ES
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setLanguage("en")}
          style={[styles.langBtn, language === "en" && styles.langBtnActive]}
        >
          <Text
            style={[
              styles.langText,
              language === "en" && styles.langTextActive,
            ]}
          >
            EN
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <View
        style={[
          styles.content,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24) },
        ]}
      >
        {/* Logo */}
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

        {/* Headline */}
        <View style={styles.headlineArea}>
          <Text style={styles.headline}>
            {t("Tu mejor versión", "Your best self")}
          </Text>
          <Text style={styles.headline2}>
            {t("te espera.", "awaits you.")}
          </Text>
          <Text style={styles.subheadline}>
            {t(
              "Descubre qué aspectos de ti mismo puedes mejorar para atraer más y conectar mejor.",
              "Discover which aspects of yourself you can improve to attract more and connect better."
            )}
          </Text>
        </View>

        {/* CTAs */}
        <View style={styles.ctaArea}>
          <Animated.View style={{ transform: [{ scale: primaryScale }] }}>
            <Pressable
              onPressIn={() => animatePress(primaryScale, true)}
              onPressOut={() => animatePress(primaryScale, false)}
              onPress={handleLogin}
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
              onPress={handleLogin}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>
                {t("Ya tengo cuenta", "I already have an account")}
              </Text>
            </Pressable>
          </Animated.View>

          {/* Features row */}
          <View style={styles.featuresRow}>
            {[
              {
                icon: "zap" as const,
                label: t("Insights", "Insights"),
              },
              {
                icon: "target" as const,
                label: t("Metas", "Goals"),
              },
              {
                icon: "trending-up" as const,
                label: t("Progreso", "Progress"),
              },
            ].map((f) => (
              <View key={f.icon} style={styles.featureItem}>
                <Feather name={f.icon} size={16} color={Colors.primaryLight} />
                <Text style={styles.featureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.legal}>
            {t(
              "Al continuar, aceptas nuestros Términos y Política de privacidad.",
              "By continuing, you agree to our Terms and Privacy Policy."
            )}
          </Text>
        </View>
>>>>>>> f81a9b8 (second try)
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
<<<<<<< HEAD
    backgroundColor: colors.navy,
  },
  geometricDecor: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `rgba(76,175,114,0.08)`,
  },
  circle1: {
    width: 500,
    height: 500,
    top: -200,
    right: -200,
    backgroundColor: "rgba(76,175,114,0.05)",
  },
  circle2: {
    width: 300,
    height: 300,
    top: 100,
    left: -150,
    borderColor: `rgba(76,175,114,0.06)`,
    backgroundColor: "transparent",
  },
  circle3: {
    width: 200,
    height: 200,
    bottom: 200,
    right: -80,
    borderColor: "rgba(76,175,114,0.07)",
    backgroundColor: "rgba(76,175,114,0.03)",
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 400,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "space-between",
  },
  topSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: {
    alignItems: "center",
    gap: 12,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(76,175,114,0.14)",
    borderWidth: 1,
    borderColor: "rgba(76,175,114,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoDiamond: {
    width: 28,
    height: 28,
    backgroundColor: colors.gold,
    transform: [{ rotate: "45deg" }],
    borderRadius: 4,
  },
  logoText: {
    fontFamily: "Inter_700Bold",
    fontSize: 38,
    color: colors.ivory,
    letterSpacing: 2,
  },
  logoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
  bottomSection: {
    paddingBottom: 16,
    gap: 20,
  },
  tagline: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    color: colors.ivory,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: colors.muted,
    lineHeight: 22,
  },
  buttonStack: {
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: colors.gold,
    borderRadius: 14,
    height: 56,
=======
    backgroundColor: Colors.background,
  },
  langSwitch: {
    position: "absolute",
    right: 20,
    flexDirection: "row",
    gap: 6,
    zIndex: 10,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  langBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  langText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
  },
  langTextActive: {
    color: Colors.text,
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 24,
    gap: 32,
  },
  logoArea: {
    alignItems: "flex-start",
    gap: 8,
  },
  logoMark: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(82,183,136,0.15)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontFamily: "Inter_700Bold",
    fontSize: 36,
    color: Colors.text,
    letterSpacing: -1,
  },
  logoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(82,183,136,0.15)",
    borderRadius: 20,
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
    fontSize: 40,
    color: Colors.text,
    lineHeight: 46,
    letterSpacing: -1.5,
  },
  headline2: {
    fontFamily: "Inter_700Bold",
    fontSize: 40,
    color: Colors.primaryLight,
    lineHeight: 46,
    letterSpacing: -1.5,
    marginBottom: 12,
  },
  subheadline: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(240,245,241,0.65)",
    lineHeight: 22,
    maxWidth: 320,
  },
  ctaArea: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 24,
>>>>>>> f81a9b8 (second try)
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
<<<<<<< HEAD
  primaryButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: colors.navy,
    letterSpacing: 0.2,
  },
  secondaryButton: {
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(76,175,114,0.3)",
  },
  secondaryButtonPressed: {
    backgroundColor: "rgba(76,175,114,0.07)",
  },
  secondaryButtonText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: colors.ivoryDim,
=======
  primaryBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.textInverted,
    letterSpacing: -0.3,
  },
  secondaryBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "rgba(240,245,241,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: "rgba(240,245,241,0.75)",
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
>>>>>>> f81a9b8 (second try)
  },
  legal: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
<<<<<<< HEAD
    color: colors.slateLight,
    textAlign: "center",
    lineHeight: 16,
  },
  langRow: {
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    gap: 0,
    marginTop: -4,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  langBtnActive: {},
  langBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: colors.slateLight,
    letterSpacing: 1,
  },
  langBtnTextActive: {
    color: colors.gold,
  },
  langDivider: {
    width: 1,
    height: 12,
    backgroundColor: colors.cardBorder,
  },
=======
    color: "rgba(240,245,241,0.3)",
    textAlign: "center",
    lineHeight: 16,
  },
>>>>>>> f81a9b8 (second try)
});

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  };

  return (
    <View style={styles.container}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
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
  },
  legal: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
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
});

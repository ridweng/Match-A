import { Feather } from "@expo/vector-icons";
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
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  };

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
          "rgba(15,26,20,0.2)",
          "rgba(15,26,20,0.5)",
          "rgba(15,26,20,0.92)",
          "#0F1A14",
        ]}
        locations={[0, 0.35, 0.65, 1]}
        style={StyleSheet.absoluteFillObject}
      />

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
          <Text style={[styles.langText, language === "es" && styles.langTextActive]}>
            ES
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setLanguage("en")}
          style={[styles.langBtn, language === "en" && styles.langBtnActive]}
        >
          <Text style={[styles.langText, language === "en" && styles.langTextActive]}>
            EN
          </Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.content,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24) },
        ]}
      >
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
          <Text style={styles.headline}>{t("Tu mejor versión", "Your best self")}</Text>
          <Text style={styles.headline2}>{t("te espera.", "awaits you.")}</Text>
          <Text style={styles.subheadline}>
            {t(
              "Descubre qué aspectos de ti mismo puedes mejorar para atraer más y conectar mejor.",
              "Discover which aspects of yourself you can improve to attract more and connect better."
            )}
          </Text>
        </View>

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

          <View style={styles.featuresRow}>
            {([
              { icon: "zap" as const, label: t("Insights", "Insights") },
              { icon: "target" as const, label: t("Metas", "Goals") },
              { icon: "trending-up" as const, label: t("Progreso", "Progress") },
            ]).map((f) => (
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  legal: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(240,245,241,0.3)",
    textAlign: "center",
    lineHeight: 16,
  },
});

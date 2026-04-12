import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardSheet } from "@/components/KeyboardSheet";
import {
  KEYBOARD_SURFACE_GAP,
  useBottomObstruction,
} from "@/components/useBottomObstruction";
import Colors from "@/constants/colors";

type AuthScreenShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onBack?: () => void;
  eyebrow?: string;
  icon?: React.ComponentProps<typeof Feather>["name"];
  keyboardEnabled?: boolean;
  footer?: React.ReactNode;
  cardVerticalAlign?: "bottom" | "center";
  contentVerticalAlign?: "top" | "center";
};

const AUTH_KEYBOARD_VERTICAL_OFFSET_IOS = -16;

export function AuthScreenShell({
  title,
  subtitle,
  children,
  onBack,
  eyebrow,
  icon = "shield",
  keyboardEnabled = false,
  footer,
  cardVerticalAlign = "bottom",
  contentVerticalAlign = "top",
}: AuthScreenShellProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const topOffset = insets.top + (Platform.OS === "web" ? 67 : 4);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 34 : 6);
  const authKeyboardVerticalOffset =
    Platform.OS === "ios" ? AUTH_KEYBOARD_VERTICAL_OFFSET_IOS : topOffset;
  const { bottomObstructionHeight } = useBottomObstruction({
    safeAreaBottomInset: insets.bottom,
    restingBottomSpacing: Platform.OS === "web" ? 34 : 24,
    extraKeyboardSpacing:
      Platform.OS === "ios" ? KEYBOARD_SURFACE_GAP.ios : KEYBOARD_SURFACE_GAP.android,
    enabled: keyboardEnabled,
  });
  const authCardMaxHeight = Math.max(
    360,
    windowHeight - topOffset - bottomObstructionHeight - 18
  );

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
          styles.overlayWrap,
          { paddingTop: topOffset, paddingBottom: bottomPadding },
        ]}
      >
        <KeyboardSheet
          style={[
            styles.overlayCardShell,
            cardVerticalAlign === "center" && styles.overlayCardShellCentered,
          ]}
          keyboardVerticalOffset={authKeyboardVerticalOffset}
          bottomInset={0}
          enabled={keyboardEnabled}
        >
          <View style={[styles.authCard, { maxHeight: authCardMaxHeight }]}>
            <ScrollView
              contentContainerStyle={[
                styles.authCardContent,
                contentVerticalAlign === "center" && styles.authCardContentCentered,
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.authHeader}>
                {onBack ? (
                  <Pressable
                    onPress={onBack}
                    style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Feather name="chevron-left" size={18} color={Colors.text} />
                  </Pressable>
                ) : (
                  <View style={styles.badgeWrap}>
                    <View style={styles.badge}>
                      <Feather name={icon} size={18} color={Colors.primaryLight} />
                    </View>
                  </View>
                )}

                <View style={styles.headerBody}>
                  {eyebrow ? (
                    <View style={styles.eyebrowPill}>
                      <Text style={styles.eyebrowText}>{eyebrow}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.authTitle}>{title}</Text>
                  {subtitle ? <Text style={styles.authSub}>{subtitle}</Text> : null}
                </View>
              </View>

              <View style={styles.content}>{children}</View>
            </ScrollView>
          </View>
        </KeyboardSheet>

        {footer ? <View style={styles.footerWrap}>{footer}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  overlayWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    backgroundColor: "rgba(7,11,9,0.24)",
    justifyContent: "flex-end",
  },
  overlayCardShell: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 24,
    justifyContent: "flex-end",
    paddingTop: 12,
  },
  overlayCardShellCentered: {
    justifyContent: "center",
  },
  authCard: {
    borderRadius: 28,
    backgroundColor: "rgba(20,31,24,1)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.16)",
    width: "100%",
    maxWidth: 460,
    minHeight: 0,
    overflow: "hidden",
    alignSelf: "center",
  },
  authCardContent: {
    padding: 20,
    gap: 18,
    paddingBottom: 28,
  },
  authCardContentCentered: {
    flexGrow: 1,
    justifyContent: "center",
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
  badgeWrap: {
    width: 36,
    alignItems: "center",
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(82,183,136,0.14)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.24)",
  },
  headerBody: {
    flex: 1,
    gap: 6,
  },
  eyebrowPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(82,183,136,0.12)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.22)",
  },
  eyebrowText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.primaryLight,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  authTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  authSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(240,245,241,0.62)",
  },
  content: {
    gap: 14,
  },
  footerWrap: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
});

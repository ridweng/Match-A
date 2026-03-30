import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

type Props = {
  visible: boolean;
  onHidden?: () => void;
};

export function AppLoadingScreen({ visible, onHidden }: Props) {
  const insets = useSafeAreaInsets();
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const breathScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.28)).current;
  const rippleScale = useRef(new Animated.Value(1)).current;
  const rippleOpacity = useRef(new Animated.Value(0.24)).current;
  const outerRippleScale = useRef(new Animated.Value(1)).current;
  const outerRippleOpacity = useRef(new Animated.Value(0.12)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const centerTranslateY = useRef(new Animated.Value(8)).current;
  const shimmerX = useRef(new Animated.Value(-72)).current;

  const breathLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const shimmerLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const rippleLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const outerRippleLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const entryAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const exitAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    entryAnimationRef.current = Animated.sequence([
      Animated.delay(80),
      Animated.parallel([
        Animated.timing(centerTranslateY, {
          toValue: 0,
          duration: 620,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(wordmarkOpacity, {
          toValue: 1,
          duration: 620,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 820,
          delay: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);
    entryAnimationRef.current.start();

    breathLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(breathScale, {
            toValue: 1.045,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.48,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(breathScale, {
            toValue: 1,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.28,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    breathLoopRef.current.start();

    rippleLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(rippleScale, {
            toValue: 1.55,
            duration: 2200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(rippleOpacity, {
            toValue: 0,
            duration: 2200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(220),
        Animated.parallel([
          Animated.timing(rippleScale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(rippleOpacity, {
            toValue: 0.24,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    rippleLoopRef.current.start();

    outerRippleLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(outerRippleScale, {
            toValue: 1.85,
            duration: 2800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(outerRippleOpacity, {
            toValue: 0,
            duration: 2800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(160),
        Animated.parallel([
          Animated.timing(outerRippleScale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(outerRippleOpacity, {
            toValue: 0.12,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    outerRippleLoopRef.current.start();

    shimmerLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, {
          toValue: 72,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(260),
        Animated.timing(shimmerX, {
          toValue: -72,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(200),
      ])
    );
    shimmerLoopRef.current.start();

    return () => {
      isMountedRef.current = false;
      entryAnimationRef.current?.stop();
      exitAnimationRef.current?.stop();
      breathLoopRef.current?.stop();
      shimmerLoopRef.current?.stop();
      rippleLoopRef.current?.stop();
      outerRippleLoopRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      breathLoopRef.current?.stop();
      shimmerLoopRef.current?.stop();
      rippleLoopRef.current?.stop();
      outerRippleLoopRef.current?.stop();
      exitAnimationRef.current?.stop();
      exitAnimationRef.current = Animated.parallel([
        Animated.timing(screenOpacity, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(centerTranslateY, {
          toValue: -10,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
      exitAnimationRef.current.start(({ finished }) => {
        if (finished && isMountedRef.current) {
          onHidden?.();
        }
      });
    }
  }, [centerTranslateY, onHidden, screenOpacity, visible]);

  return (
    <Animated.View
      style={[styles.root, { opacity: screenOpacity }]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <Animated.View
        style={[
          styles.center,
          { transform: [{ translateY: centerTranslateY }] },
        ]}
      >
        <View style={styles.iconContainer}>
          <Animated.View
            style={[
              styles.outerRipple,
              {
                opacity: outerRippleOpacity,
                transform: [{ scale: outerRippleScale }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.ripple,
              {
                opacity: rippleOpacity,
                transform: [{ scale: rippleScale }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.glow,
              { opacity: glowOpacity },
            ]}
          />
          <Animated.View
            style={[
              styles.iconCard,
              { transform: [{ scale: breathScale }] },
            ]}
          >
            <View style={styles.leafRow}>
              <View style={styles.leafLeft} />
              <View style={styles.leafRight} />
            </View>
            <View style={styles.stem} />
          </Animated.View>
        </View>

        <Animated.Text style={[styles.wordmark, { opacity: wordmarkOpacity }]}>
          MatchA
        </Animated.Text>

        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          Mejórate. Atrae.
        </Animated.Text>
      </Animated.View>

      <View
        style={[
          styles.shimmerTrack,
          { bottom: Math.max(insets.bottom + 20, 32) },
        ]}
      >
        <Animated.View
          style={[
            styles.shimmerDot,
            { transform: [{ translateX: shimmerX }] },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const ICON_SIZE = 76;
const GLOW_SIZE = 120;
const RIPPLE_SIZE = 112;
const OUTER_RIPPLE_SIZE = 140;

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  center: {
    alignItems: "center",
  },
  iconContainer: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  outerRipple: {
    position: "absolute",
    width: OUTER_RIPPLE_SIZE,
    height: OUTER_RIPPLE_SIZE,
    borderRadius: OUTER_RIPPLE_SIZE / 2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  ripple: {
    position: "absolute",
    width: RIPPLE_SIZE,
    height: RIPPLE_SIZE,
    borderRadius: RIPPLE_SIZE / 2,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  glow: {
    position: "absolute",
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    backgroundColor: Colors.primaryLight,
  },
  iconCard: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primaryLight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 10,
    gap: 4,
  },
  leafRow: {
    flexDirection: "row",
    gap: 4,
  },
  leafLeft: {
    width: 16,
    height: 22,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 10,
    backgroundColor: Colors.primaryLight,
    transform: [{ rotate: "-10deg" }],
  },
  leafRight: {
    width: 16,
    height: 22,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 3,
    backgroundColor: Colors.primaryDark,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    transform: [{ rotate: "10deg" }],
  },
  stem: {
    width: 2.5,
    height: 8,
    borderRadius: 2,
    backgroundColor: Colors.primaryLight,
    opacity: 0.7,
  },
  wordmark: {
    fontFamily: "Inter_700Bold",
    fontSize: 34,
    letterSpacing: -1.2,
    color: Colors.text,
    marginBottom: 6,
  },
  tagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    letterSpacing: 0.5,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  shimmerTrack: {
    position: "absolute",
    width: 144,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.surface,
    overflow: "hidden",
    alignSelf: "center",
  },
  shimmerDot: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.primaryLight,
    opacity: 0.85,
    shadowColor: Colors.primaryLight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
});

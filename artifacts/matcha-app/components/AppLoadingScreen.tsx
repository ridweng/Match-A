import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";

type Props = {
  visible: boolean;
  onHidden?: () => void;
};

export function AppLoadingScreen({ visible, onHidden }: Props) {
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const breathScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.35)).current;
  const rippleScale = useRef(new Animated.Value(1)).current;
  const rippleOpacity = useRef(new Animated.Value(0.6)).current;
  const outerRippleScale = useRef(new Animated.Value(1)).current;
  const outerRippleOpacity = useRef(new Animated.Value(0.3)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const shimmerX = useRef(new Animated.Value(-180)).current;

  const breathLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const shimmerLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const rippleLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    Animated.sequence([
      Animated.delay(120),
      Animated.parallel([
        Animated.timing(wordmarkOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 900,
          delay: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    breathLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(breathScale, {
            toValue: 1.065,
            duration: 1800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.75,
            duration: 1800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(breathScale, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.35,
            duration: 1800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    breathLoopRef.current.start();

    const startRipple = () => {
      rippleScale.setValue(1);
      rippleOpacity.setValue(0.5);
      Animated.parallel([
        Animated.timing(rippleScale, {
          toValue: 1.7,
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
      ]).start(() => setTimeout(startRipple, 400));
    };

    const startOuterRipple = () => {
      outerRippleScale.setValue(1);
      outerRippleOpacity.setValue(0.2);
      Animated.parallel([
        Animated.timing(outerRippleScale, {
          toValue: 2.1,
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
      ]).start(() => setTimeout(startOuterRipple, 200));
    };

    const r1 = setTimeout(startRipple, 600);
    const r2 = setTimeout(startOuterRipple, 1000);

    shimmerLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, {
          toValue: 180,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(300),
        Animated.timing(shimmerX, {
          toValue: -180,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(200),
      ])
    );
    shimmerLoopRef.current.start();

    return () => {
      breathLoopRef.current?.stop();
      shimmerLoopRef.current?.stop();
      clearTimeout(r1);
      clearTimeout(r2);
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      breathLoopRef.current?.stop();
      shimmerLoopRef.current?.stop();
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => onHidden?.());
    }
  }, [visible]);

  return (
    <Animated.View
      style={[styles.root, { opacity: screenOpacity }]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <View style={styles.center}>
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
      </View>

      <View style={styles.shimmerTrack}>
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
    gap: 0,
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
    borderColor: Colors.primaryLight,
  },
  ripple: {
    position: "absolute",
    width: RIPPLE_SIZE,
    height: RIPPLE_SIZE,
    borderRadius: RIPPLE_SIZE / 2,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
  },
  glow: {
    position: "absolute",
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    backgroundColor: Colors.primaryLight,
    opacity: 0.35,
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
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
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
  },
  shimmerTrack: {
    position: "absolute",
    bottom: 52,
    width: 160,
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
    width: 60,
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

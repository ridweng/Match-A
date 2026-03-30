import { useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { KeyboardEvents } from "react-native-keyboard-controller";

// Fine-tune these values to control the visual gap between the keyboard
// and lifted cards/sheets on native platforms.
export const KEYBOARD_SURFACE_GAP = {
  ios: 12,
  android: 3,
} as const;

type UseBottomObstructionOptions = {
  safeAreaBottomInset?: number;
  restingBottomSpacing?: number;
  extraKeyboardSpacing?: number;
  enabled?: boolean;
};

export function useBottomObstruction({
  safeAreaBottomInset = 0,
  restingBottomSpacing = 0,
  extraKeyboardSpacing = 0,
  enabled = true,
}: UseBottomObstructionOptions = {}) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!enabled || Platform.OS === "web") {
      setKeyboardHeight(0);
      setKeyboardVisible(false);
      return;
    }

    const handleShow = ({ height }: { height: number }) => {
      setKeyboardHeight(Math.max(0, height));
      setKeyboardVisible(height > 0);
    };

    const handleHide = () => {
      setKeyboardHeight(0);
      setKeyboardVisible(false);
    };

    const didShowSubscription = KeyboardEvents.addListener("keyboardDidShow", handleShow);
    const didHideSubscription = KeyboardEvents.addListener("keyboardDidHide", handleHide);

    return () => {
      didShowSubscription.remove();
      didHideSubscription.remove();
    };
  }, [enabled]);

  return useMemo(() => {
    const restingInset = safeAreaBottomInset + restingBottomSpacing;
    const keyboardInset = keyboardVisible ? keyboardHeight + extraKeyboardSpacing : 0;

    return {
      keyboardHeight,
      keyboardVisible,
      restingBottomInset: restingInset,
      bottomObstructionHeight: Math.max(restingInset, keyboardInset),
    };
  }, [
    extraKeyboardSpacing,
    keyboardHeight,
    keyboardVisible,
    restingBottomSpacing,
    safeAreaBottomInset,
  ]);
}

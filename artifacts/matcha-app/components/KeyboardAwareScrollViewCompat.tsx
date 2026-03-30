import React from "react";
import {
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
} from "react-native-keyboard-controller";

type Props = ScrollViewProps &
  Pick<
    KeyboardAwareScrollViewProps,
    "bottomOffset" | "extraKeyboardSpace" | "enabled"
  > & {
    bottomOffset?: number;
    extraKeyboardSpace?: number;
    contentContainerStyle?: StyleProp<ViewStyle>;
    keyboardDismissMode?: ScrollViewProps["keyboardDismissMode"];
  };

export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  keyboardDismissMode = Platform.OS === "web" ? "on-drag" : "none",
  bottomOffset = 0,
  extraKeyboardSpace = 0,
  contentContainerStyle,
  ...props
}: Props) {
  if (Platform.OS === "web") {
    return (
      <ScrollView
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
        contentContainerStyle={contentContainerStyle}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <KeyboardAwareScrollView
      bottomOffset={bottomOffset}
      extraKeyboardSpace={extraKeyboardSpace}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode={keyboardDismissMode}
      contentContainerStyle={contentContainerStyle}
      disableScrollOnKeyboardHide
      {...props}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}

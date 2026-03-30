import React, { useMemo } from "react";
import { Platform, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

type Props = ViewProps & {
  contentStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
  enabled?: boolean;
  bottomInset?: number;
};

export function KeyboardSheet({
  children,
  style,
  contentStyle,
  keyboardVerticalOffset = 0,
  enabled = true,
  bottomInset = 0,
  ...props
}: Props) {
  const resolvedContentStyle = useMemo(
    () => [{ paddingBottom: bottomInset }, contentStyle],
    [bottomInset, contentStyle]
  );

  if (Platform.OS === "web") {
    return (
      <View style={style} {...props}>
        <View style={resolvedContentStyle}>{children}</View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior="translate-with-padding"
      automaticOffset
      enabled={enabled}
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={style}
      {...props}
    >
      <View style={resolvedContentStyle}>{children}</View>
    </KeyboardAvoidingView>
  );
}

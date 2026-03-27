import React from "react";
import {
  Keyboard,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  View,
  ViewStyle,
} from "react-native";

type Props = ScrollViewProps & {
  bottomOffset?: number;
  extraKeyboardSpace?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  bottomOffset = 0,
  extraKeyboardSpace = 0,
  contentContainerStyle,
  ...props
}: Props) {
  const [keyboardInset, setKeyboardInset] = React.useState(0);

  React.useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const handleKeyboardShow = (event: any) => {
      const height = event?.endCoordinates?.height || 0;
      setKeyboardInset(
        Math.max(0, height - bottomOffset + extraKeyboardSpace)
      );
    };

    const handleKeyboardHide = () => {
      setKeyboardInset(0);
    };

    const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [bottomOffset, extraKeyboardSpace]);

  return (
    <View style={{ flex: 1, paddingBottom: keyboardInset }}>
      <ScrollView
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        contentContainerStyle={contentContainerStyle}
        {...props}
      >
        {children}
      </ScrollView>
    </View>
  );
}

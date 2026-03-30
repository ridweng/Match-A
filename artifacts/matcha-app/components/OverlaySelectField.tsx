import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardSheet } from "@/components/KeyboardSheet";
import Colors from "@/constants/colors";
import { debugLog } from "@/utils/debug";

type OverlaySelectFieldProps = {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder: string;
  getOptionLabel: (value: string) => string;
  style?: StyleProp<ViewStyle>;
  footer?: React.ReactNode;
  testId?: string;
};

export function OverlaySelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  getOptionLabel,
  style,
  footer,
  testId,
}: OverlaySelectFieldProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = React.useState(false);

  const close = React.useCallback(() => {
    Keyboard.dismiss();
    setOpen(false);
    debugLog("[overlay-select] close", {
      testId: testId || null,
      label,
    });
  }, [label, testId]);

  const openPicker = React.useCallback(() => {
    Keyboard.dismiss();
    setOpen(true);
    debugLog("[overlay-select] open", {
      testId: testId || null,
      label,
      optionCount: options.length,
    });
  }, [label, options.length, testId]);

  const handleSelect = React.useCallback(
    (nextValue: string) => {
      debugLog("[overlay-select] select", {
        testId: testId || null,
        label,
        value: nextValue,
      });
      onChange(nextValue);
      close();
    },
    [close, label, onChange, testId]
  );

  return (
    <View style={style}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        onPress={openPicker}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
      >
        <Text style={[styles.triggerValue, !value && styles.placeholderText]}>
          {value ? getOptionLabel(value) : placeholder}
        </Text>
        <Feather name="chevron-down" size={16} color={Colors.textSecondary} />
      </Pressable>
      {footer}

      <Modal
        visible={open}
        animationType="fade"
        presentationStyle="overFullScreen"
        transparent
        onRequestClose={close}
      >
        <View style={styles.modalOverlay}>
          <KeyboardSheet
            style={styles.modalKeyboardAvoider}
            contentStyle={styles.modalKeyboardContent}
            keyboardVerticalOffset={insets.top + 16}
            bottomInset={0}
          >
            <View
              style={[
                styles.modalContainer,
                {
                  marginTop: insets.top + 16,
                  marginBottom: insets.bottom + 16,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Pressable
                  onPress={close}
                  style={({ pressed }) => [
                    styles.modalHeaderBtn,
                    pressed && styles.modalHeaderBtnPressed,
                  ]}
                >
                  <Feather name="chevron-left" size={20} color={Colors.text} />
                </Pressable>
              </View>

              <Text style={styles.modalTitle}>{label}</Text>

              <ScrollView
                style={styles.optionsList}
                contentContainerStyle={styles.optionsContent}
                keyboardDismissMode="none"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {options.map((option) => {
                  const selected = value === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => handleSelect(option)}
                      style={({ pressed }) => [
                        styles.optionRow,
                        selected && styles.optionRowSelected,
                        pressed && styles.optionRowPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionLabel,
                          selected && styles.optionLabelSelected,
                        ]}
                      >
                        {getOptionLabel(option)}
                      </Text>
                      {selected ? (
                        <Feather name="check" size={16} color={Colors.primaryLight} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </KeyboardSheet>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    marginBottom: 8,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  trigger: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  triggerPressed: {
    opacity: 0.84,
  },
  triggerValue: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.text,
  },
  placeholderText: {
    color: Colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(6, 10, 14, 0.5)",
  },
  modalKeyboardAvoider: {
    flex: 1,
  },
  modalKeyboardContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  modalContainer: {
    marginHorizontal: 16,
    borderRadius: 28,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    maxHeight: "72%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 10,
  },
  modalHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeaderBtnPressed: {
    opacity: 0.8,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text,
    marginBottom: 14,
    letterSpacing: -0.4,
  },
  optionsList: {
    flexGrow: 0,
  },
  optionsContent: {
    paddingBottom: 8,
    gap: 10,
  },
  optionRow: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  optionRowSelected: {
    borderColor: Colors.primaryLight,
    backgroundColor: "rgba(82,183,136,0.14)",
  },
  optionRowPressed: {
    opacity: 0.88,
  },
  optionLabel: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.text,
  },
  optionLabelSelected: {
    color: Colors.primaryLight,
  },
});

import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import {
  formatDateForDisplay,
  getAdultMaximumDate,
  getInitialPickerDate,
  toIsoDate,
} from "@/utils/dateOfBirth";

type DateOfBirthFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  cancelLabel?: string;
  confirmLabel?: string;
};

export function DateOfBirthField({
  label,
  value,
  onChange,
  placeholder = "DD/MM/YYYY",
  cancelLabel = "Cancel",
  confirmLabel = "Done",
}: DateOfBirthFieldProps) {
  const [visible, setVisible] = useState(false);
  const [draftDate, setDraftDate] = useState(() => getInitialPickerDate(value));
  const maximumDate = getAdultMaximumDate();
  const displayValue = formatDateForDisplay(value);

  const openPicker = () => {
    Keyboard.dismiss();
    setDraftDate(getInitialPickerDate(value));
    setVisible(true);
  };

  const closePicker = () => {
    setVisible(false);
  };

  const commitValue = (date: Date) => {
    onChange(toIsoDate(date));
  };

  const handleIosConfirm = () => {
    commitValue(draftDate);
    closePicker();
  };

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (!selectedDate) {
      if (Platform.OS === "android") {
        closePicker();
      }
      return;
    }

    const safeDate =
      selectedDate.getTime() > maximumDate.getTime() ? maximumDate : selectedDate;

    if (Platform.OS === "android") {
      closePicker();
      commitValue(safeDate);
      return;
    }

    setDraftDate(safeDate);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={openPicker} style={styles.input} accessibilityRole="button">
        <Text style={[styles.value, !displayValue && styles.placeholder]}>
          {displayValue || placeholder}
        </Text>
        <Feather name="calendar" size={16} color={Colors.textSecondary} />
      </Pressable>

      {visible && Platform.OS === "android" ? (
        <DateTimePicker
          value={draftDate}
          mode="date"
          display="spinner"
          maximumDate={maximumDate}
          onChange={handleChange}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={closePicker}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closePicker} />
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Pressable onPress={closePicker}>
                  <Text style={styles.modalAction}>{cancelLabel}</Text>
                </Pressable>
                <Text style={styles.modalTitle}>{label}</Text>
                <Pressable onPress={handleIosConfirm}>
                  <Text style={styles.modalActionPrimary}>{confirmLabel}</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draftDate}
                mode="date"
                display="spinner"
                maximumDate={maximumDate}
                onChange={handleChange}
                themeVariant="dark"
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 7,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  value: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
  },
  placeholder: {
    color: Colors.textMuted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,26,20,0.78)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: Colors.backgroundCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingBottom: 28,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  modalAction: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.textSecondary,
  },
  modalActionPrimary: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.primaryLight,
  },
});

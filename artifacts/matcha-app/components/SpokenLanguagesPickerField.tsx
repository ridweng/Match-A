import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Alert,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardSheet } from "@/components/KeyboardSheet";
import Colors from "@/constants/colors";
import {
  getSpokenLanguageFlag,
  getSpokenLanguageLabel,
  matchesSpokenLanguageSearch,
  normalizeSpokenLanguages,
  SPOKEN_LANGUAGES,
} from "@/constants/profile-options";

const MAX_SPOKEN_LANGUAGES = 7;

type SpokenLanguagesPickerFieldProps = {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  language: "es" | "en";
  t: (es: string, en: string) => string;
  style?: StyleProp<ViewStyle>;
  footer?: React.ReactNode;
};

export function SpokenLanguagesPickerField({
  label,
  values,
  onChange,
  language,
  t,
  style,
  footer,
}: SpokenLanguagesPickerFieldProps) {
  const insets = useSafeAreaInsets();
  const [languagesModalOpen, setLanguagesModalOpen] = React.useState(false);
  const [languageSearch, setLanguageSearch] = React.useState("");
  const normalizedValues = React.useMemo(
    () => normalizeSpokenLanguages(values),
    [values]
  );
  const [draftLanguages, setDraftLanguages] = React.useState<string[]>(normalizedValues);

  React.useEffect(() => {
    if (!languagesModalOpen) {
      setDraftLanguages(normalizedValues);
    }
  }, [languagesModalOpen, normalizedValues]);

  const selectedLanguageOptions = React.useMemo(
    () =>
      normalizedValues
        .map((value) => SPOKEN_LANGUAGES.find((item) => item.value === value))
        .filter((item): item is (typeof SPOKEN_LANGUAGES)[number] => Boolean(item)),
    [normalizedValues]
  );

  const selectedDraftLanguageOptions = React.useMemo(
    () =>
      draftLanguages
        .map((value) => SPOKEN_LANGUAGES.find((item) => item.value === value))
        .filter((item): item is (typeof SPOKEN_LANGUAGES)[number] => Boolean(item)),
    [draftLanguages]
  );

  const filteredLanguages = React.useMemo(() => {
    return SPOKEN_LANGUAGES.filter((item) => {
      if (draftLanguages.includes(item.value)) {
        return false;
      }
      return matchesSpokenLanguageSearch(item.value, languageSearch);
    });
  }, [draftLanguages, languageSearch]);

  const openLanguagesModal = React.useCallback(() => {
    setDraftLanguages(normalizedValues);
    setLanguageSearch("");
    setLanguagesModalOpen(true);
  }, [normalizedValues]);

  const closeLanguagesModal = React.useCallback(() => {
    Keyboard.dismiss();
    setLanguagesModalOpen(false);
    setLanguageSearch("");
  }, []);

  const acceptLanguages = React.useCallback(() => {
    onChange(draftLanguages);
    closeLanguagesModal();
  }, [closeLanguagesModal, draftLanguages, onChange]);

  const toggleSpokenLanguage = React.useCallback(
    (value: string) => {
      setDraftLanguages((current) => {
        if (current.includes(value)) {
          return current.filter((item) => item !== value);
        }

        if (current.length >= MAX_SPOKEN_LANGUAGES) {
          Alert.alert(
            t("Máximo alcanzado", "Maximum reached"),
            t(
              "Puedes seleccionar hasta 7 idiomas.",
              "You can select up to 7 languages."
            )
          );
          return current;
        }

        return [...current, value];
      });
    },
    [t]
  );

  return (
    <View style={style}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        onPress={openLanguagesModal}
        style={({ pressed }) => [
          styles.selectField,
          pressed && { opacity: 0.82 },
        ]}
      >
        <Text
          style={[
            styles.selectValue,
            !selectedLanguageOptions.length && styles.selectPlaceholder,
          ]}
          numberOfLines={1}
        >
          {selectedLanguageOptions.length
            ? t(
                `${selectedLanguageOptions.length} idiomas seleccionados`,
                `${selectedLanguageOptions.length} languages selected`
              )
            : t("Selecciona idiomas", "Select languages")}
        </Text>
        <Feather name="chevron-right" size={16} color={Colors.textSecondary} />
      </Pressable>

      {selectedLanguageOptions.length ? (
        <View style={styles.languageChipsWrap}>
          {selectedLanguageOptions.map((item) => (
            <View key={item.value} style={styles.languageChip}>
              <Text style={styles.languageChipFlag}>
                {item.flag || getSpokenLanguageFlag(item.value)}
              </Text>
              <Text style={styles.languageChipText}>
                {getSpokenLanguageLabel(item.value, language)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {footer}

      <Modal
        visible={languagesModalOpen}
        animationType="fade"
        presentationStyle="overFullScreen"
        transparent
        onRequestClose={closeLanguagesModal}
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
                  onPress={closeLanguagesModal}
                  style={({ pressed }) => [
                    styles.modalHeaderBtn,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Feather name="chevron-left" size={20} color={Colors.text} />
                </Pressable>
                <Pressable
                  onPress={acceptLanguages}
                  style={({ pressed }) => [
                    styles.modalAcceptBtn,
                    pressed && { opacity: 0.82 },
                  ]}
                >
                  <Text style={styles.modalAcceptText}>{t("Aceptar", "Done")}</Text>
                </Pressable>
              </View>

              <Text style={styles.modalTitle}>
                {t("Idiomas que hablo", "Languages I speak")}
              </Text>
              <Text style={styles.modalDescription}>
                {t(
                  "Selecciona hasta 7 idiomas que hables para añadirlos a tu perfil.",
                  "Select up to 7 languages you speak to add them to your profile."
                )}
              </Text>
              <Text style={styles.modalCounter}>
                {draftLanguages.length}/{MAX_SPOKEN_LANGUAGES}{" "}
                {t("seleccionados", "selected")}
              </Text>

              <View style={styles.searchField}>
                <Feather name="search" size={15} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={languageSearch}
                  onChangeText={setLanguageSearch}
                  placeholder={t("Buscar idioma", "Search language")}
                  placeholderTextColor={Colors.textMuted}
                  selectionColor={Colors.primaryLight}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
              </View>

              {selectedDraftLanguageOptions.length ? (
                <View style={styles.selectedLanguagesBlock}>
                  <Text style={styles.selectedLanguagesLabel}>
                    {t("Seleccionados", "Selected")}
                  </Text>
                  <View style={styles.selectedLanguagesRow}>
                    {selectedDraftLanguageOptions.map((item) => (
                      <Pressable
                        key={item.value}
                        onPress={() => toggleSpokenLanguage(item.value)}
                        style={({ pressed }) => [
                          styles.selectedLanguageChip,
                          pressed && { opacity: 0.82 },
                        ]}
                      >
                        <Text style={styles.selectedLanguageFlag}>
                          {item.flag || getSpokenLanguageFlag(item.value)}
                        </Text>
                        <Text style={styles.selectedLanguageText}>
                          {getSpokenLanguageLabel(item.value, language)}
                        </Text>
                        <Feather name="x" size={12} color={Colors.primaryLight} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="none"
              >
                <View style={styles.modalOptionsWrap}>
                  {filteredLanguages.map((item) => {
                    const selected = draftLanguages.includes(item.value);
                    return (
                      <Pressable
                        key={item.value}
                        onPress={() => toggleSpokenLanguage(item.value)}
                        style={[
                          styles.modalOption,
                          selected && styles.modalOptionSelected,
                        ]}
                      >
                        <Text style={styles.modalOptionFlag}>
                          {item.flag || getSpokenLanguageFlag(item.value)}
                        </Text>
                        <Text
                          style={[
                            styles.modalOptionText,
                            selected && styles.modalOptionTextSelected,
                          ]}
                        >
                          {getSpokenLanguageLabel(item.value, language)}
                        </Text>
                        {selected ? (
                          <Feather
                            name="check"
                            size={13}
                            color={Colors.primaryLight}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                  {!filteredLanguages.length ? (
                    <View style={styles.languageEmptyState}>
                      <Feather name="search" size={18} color={Colors.textMuted} />
                      <Text style={styles.languageEmptyTitle}>
                        {t("No encontramos idiomas", "No languages found")}
                      </Text>
                      <Text style={styles.languageEmptyText}>
                        {t(
                          "Prueba otra búsqueda o elimina uno de los idiomas seleccionados.",
                          "Try another search or remove one of the selected languages."
                        )}
                      </Text>
                    </View>
                  ) : null}
                </View>
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
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
    marginBottom: 10,
  },
  selectField: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  selectValue: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
  },
  selectPlaceholder: {
    color: Colors.textMuted,
  },
  languageChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  languageChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  languageChipFlag: {
    fontSize: 14,
  },
  languageChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(6, 12, 10, 0.72)",
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  modalKeyboardAvoider: {
    flex: 1,
  },
  modalKeyboardContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  modalContainer: {
    flex: 1,
    maxHeight: "88%",
    backgroundColor: Colors.backgroundCard,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  modalHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  modalAcceptBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  modalAcceptText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: Colors.textInverted,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  modalDescription: {
    marginTop: 8,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  modalCounter: {
    marginTop: 14,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.primaryLight,
  },
  searchField: {
    marginTop: 16,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.text,
  },
  selectedLanguagesBlock: {
    marginTop: 14,
    gap: 10,
  },
  selectedLanguagesLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  selectedLanguagesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  selectedLanguageChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(82,183,136,0.12)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.24)",
  },
  selectedLanguageFlag: {
    fontSize: 14,
  },
  selectedLanguageText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.primaryLight,
  },
  modalScroll: {
    flex: 1,
    minHeight: 0,
    marginTop: 16,
  },
  modalScrollContent: {
    paddingBottom: 24,
  },
  modalOptionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modalOption: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  modalOptionFlag: {
    fontSize: 16,
  },
  modalOptionSelected: {
    borderColor: Colors.primaryLight,
    backgroundColor: "rgba(82,183,136,0.08)",
  },
  modalOptionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.text,
  },
  modalOptionTextSelected: {
    color: Colors.primaryLight,
    fontFamily: "Inter_500Medium",
  },
  languageEmptyState: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  languageEmptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  languageEmptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});

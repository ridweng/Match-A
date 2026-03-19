import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import {
  BODY_TYPES,
  ETHNICITIES,
  getBodyTypeLabel,
  getEthnicityLabel,
  getGenderIdentityLabel,
  getHairColorLabel,
  getPronounLabel,
  getRelationshipGoalLabel,
  getSpokenLanguageLabel,
  HAIR_COLORS,
  INTERESTS_LIST,
  MAX_PROFILE_PHOTOS,
  normalizeBodyType,
  normalizeEthnicity,
  normalizeHairColor,
  normalizeRelationshipGoal,
  RELATIONSHIP_GOALS,
  SPOKEN_LANGUAGES,
} from "@/constants/profile-options";
import { useApp, type UserProfile } from "@/context/AppContext";
import { getAgeFromIsoDate } from "@/utils/dateOfBirth";

const MAX_SPOKEN_LANGUAGES = 7;

function SummaryField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryField}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  getOptionLabel,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  getOptionLabel?: (value: string) => string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <View style={styles.editField}>
      <Text style={styles.editLabel}>{label}</Text>
      <Pressable onPress={() => setOpen((current) => !current)} style={styles.selectField}>
        <Text style={[styles.selectValue, !value && styles.selectPlaceholder]}>
          {value ? getOptionLabel?.(value) || value : "—"}
        </Text>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={Colors.textSecondary}
        />
      </Pressable>
      {open ? (
        <View style={styles.dropdown}>
          {options.map((option) => (
            <Pressable
              key={option}
              onPress={() => {
                onChange(option);
                setOpen(false);
              }}
              style={[styles.dropdownOption, value === option && styles.dropdownOptionActive]}
            >
              <Text
                style={[
                  styles.dropdownOptionText,
                  value === option && styles.dropdownOptionTextActive,
                ]}
              >
                {getOptionLabel?.(option) || option}
              </Text>
              {value === option ? (
                <Feather name="check" size={14} color={Colors.primaryLight} />
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function normalizeHeightInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const match = trimmed.match(/\d+(\.\d+)?/);
  return match?.[0] || "";
}

function getHeightLimit(unit: "metric" | "imperial") {
  return unit === "imperial" ? 157.5 : 400;
}

function clampHeightValue(value: string, unit: "metric" | "imperial") {
  const normalized = normalizeHeightInput(value);
  if (!normalized) {
    return "";
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return "";
  }

  const clamped = Math.min(Math.max(parsed, 0), getHeightLimit(unit));
  return Number.isInteger(clamped) ? String(clamped) : clamped.toFixed(1);
}

function validateHeightValue(value: string, unit: "metric" | "imperial") {
  const normalized = normalizeHeightInput(value);
  if (!normalized) {
    return "";
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return "";
  }

  if (parsed < 0 || parsed > getHeightLimit(unit)) {
    return clampHeightValue(normalized, unit);
  }

  return normalized;
}

function isHeightOutOfRange(value: string, unit: "metric" | "imperial") {
  const normalized = normalizeHeightInput(value);
  if (!normalized) {
    return false;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return false;
  }

  return parsed < 0 || parsed > getHeightLimit(unit);
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const {
    t,
    accountProfile,
    heightUnit,
    language,
    removeProfilePhoto,
    setProfilePhoto,
    updateProfile,
  } = useApp();

  const placeholder = t("Ninguno", "None");
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 16);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 100);
  const calculatedAge = getAgeFromIsoDate(accountProfile.dateOfBirth);
  const ageLabel = calculatedAge
    ? t(`${calculatedAge} años`, `${calculatedAge} years`)
    : placeholder;
  const pronounLabel = getPronounLabel(accountProfile.pronouns, language);
  const heightUnitLabel = heightUnit === "imperial" ? "in" : "cm";
  const heightMax = getHeightLimit(heightUnit);
  const heightOutOfRange = isHeightOutOfRange(accountProfile.height, heightUnit);
  const heightPlaceholder =
    heightUnit === "imperial"
      ? t("Tu altura en pulgadas", "Your height in inches")
      : t("Tu altura en cm", "Your height in cm");
  const spokenLanguages = Array.isArray(accountProfile.languagesSpoken)
    ? accountProfile.languagesSpoken
    : [];
  const [languagesModalOpen, setLanguagesModalOpen] = React.useState(false);
  const [languageSearch, setLanguageSearch] = React.useState("");
  const [draftLanguages, setDraftLanguages] = React.useState<string[]>(
    spokenLanguages
  );
  const selectedLanguageLabels = spokenLanguages.map((value) =>
    getSpokenLanguageLabel(value, language)
  );
  const filteredLanguages = React.useMemo(() => {
    const query = languageSearch.trim().toLowerCase();
    if (!query) {
      return SPOKEN_LANGUAGES;
    }

    return SPOKEN_LANGUAGES.filter((item) => {
      const haystack = [item.es, item.en, item.value].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [languageSearch]);

  const showValue = (value: string | string[]) => {
    if (Array.isArray(value)) {
      return value.length ? value.join(", ") : placeholder;
    }
    return value?.trim() ? value : placeholder;
  };

  const requestAndPickPhoto = async (index: number) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        t("Permiso requerido", "Permission required"),
        t(
          "Permite acceso a tus fotos para editar tu perfil.",
          "Allow photo access to edit your profile."
        )
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
      aspect: [4, 5],
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return;
    }

    setProfilePhoto(index, result.assets[0].uri);
  };

  const handlePhotoPress = (index: number) => {
    const currentPhoto = accountProfile.photos[index];
    if (!currentPhoto) {
      requestAndPickPhoto(index).catch(() => {});
      return;
    }

    Alert.alert(
      t("Editar foto", "Edit photo"),
      t(
        "Puedes reemplazar o eliminar esta foto.",
        "You can replace or remove this photo."
      ),
      [
        {
          text: t("Cancelar", "Cancel"),
          style: "cancel",
        },
        {
          text: t("Eliminar", "Remove"),
          style: "destructive",
          onPress: () => removeProfilePhoto(index),
        },
        {
          text: t("Reemplazar", "Replace"),
          onPress: () => {
            requestAndPickPhoto(index).catch(() => {});
          },
        },
      ]
    );
  };

  const update = (key: keyof UserProfile, value: string | string[]) => {
    updateProfile({
      [key]: value,
    } as Partial<UserProfile>);
  };

  const openLanguagesModal = () => {
    setDraftLanguages(spokenLanguages);
    setLanguageSearch("");
    setLanguagesModalOpen(true);
  };

  const closeLanguagesModal = () => {
    setLanguagesModalOpen(false);
    setLanguageSearch("");
  };

  const toggleSpokenLanguage = (value: string) => {
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
  };

  const acceptLanguages = () => {
    update("languagesSpoken", draftLanguages);
    closeLanguagesModal();
  };

  const updateHeight = (value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, "");
    const firstDecimalIndex = sanitized.indexOf(".");
    const nextValue =
      firstDecimalIndex === -1
        ? sanitized
        : `${sanitized.slice(0, firstDecimalIndex + 1)}${sanitized
            .slice(firstDecimalIndex + 1)
            .replace(/\./g, "")}`;
    update("height", nextValue);
  };

  const toggleInterest = (interest: string) => {
    const next = accountProfile.interests.includes(interest)
      ? accountProfile.interests.filter((item) => item !== interest)
      : [...accountProfile.interests, interest];
    update("interests", next);
  };

  const mainPhoto = accountProfile.photos[0];

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{t("Mi Perfil", "My Profile")}</Text>
            <Text style={styles.headerSub}>
              {t("Resumen de tu cuenta", "Your account summary")}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/settings")}
            style={({ pressed }) => [
              styles.settingsBtn,
              pressed && { opacity: 0.72 },
            ]}
          >
            <Feather name="settings" size={18} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <Pressable
            onPress={() => handlePhotoPress(0)}
            style={styles.mainPhotoWrap}
          >
            {mainPhoto ? (
              <Image source={{ uri: mainPhoto }} style={styles.mainPhoto} />
            ) : (
              <View style={styles.mainPhotoPlaceholder}>
                <Feather name="user" size={40} color={Colors.textMuted} />
              </View>
            )}
            <View style={styles.photoEditBadge}>
              <Feather name="camera" size={14} color={Colors.textInverted} />
            </View>
          </Pressable>

          <Text style={styles.nameText}>
            {pronounLabel ? (
              <Text style={styles.namePrefixText}>{pronounLabel} </Text>
            ) : null}
            {showValue(accountProfile.name)}
          </Text>
          <Text style={styles.emailText}>
            {showValue(accountProfile.email)}
          </Text>

          <View style={styles.quickStats}>
            <View style={styles.quickChip}>
              <Feather name="calendar" size={14} color={Colors.primaryLight} />
              <Text style={styles.quickChipText}>{ageLabel}</Text>
            </View>
            <View style={styles.quickChip}>
              <Feather name="user" size={14} color={Colors.accent} />
              <Text style={styles.quickChipText}>
                {getGenderIdentityLabel(accountProfile.genderIdentity, t) || placeholder}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>{t("Mis fotos", "My photos")}</Text>
            <Text style={styles.sectionHint}>
              {t(
                "Toca una foto para editarla",
                "Tap a photo to edit it"
              )}
            </Text>
          </View>

          <View style={styles.photoGrid}>
            {Array.from({ length: MAX_PROFILE_PHOTOS }).map((_, index) => {
              const photo = accountProfile.photos[index];
              const isMain = index === 0;
              return (
                <Pressable
                  key={index}
                  onPress={() => handlePhotoPress(index)}
                  style={[styles.photoSlot, isMain && styles.photoSlotMain]}
                >
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.photoSlotImage} />
                  ) : (
                    <View
                      style={[
                        styles.photoSlotPlaceholder,
                        isMain && styles.photoSlotPlaceholderMain,
                      ]}
                    >
                      <Feather
                        name={isMain ? "camera" : "plus"}
                        size={isMain ? 20 : 16}
                        color={isMain ? Colors.primaryLight : Colors.textMuted}
                      />
                    </View>
                  )}
                  {isMain ? (
                    <View style={styles.mainBadge}>
                      <Text style={styles.mainBadgeText}>{t("Principal", "Main")}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("Sobre mí", "About me")}</Text>
          <View style={styles.card}>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>{t("Sobre mí", "About me")}</Text>
              <TextInput
                style={[styles.editInput, styles.editInputMultiline]}
                value={accountProfile.bio}
                onChangeText={(value) => update("bio", value)}
                placeholder={t("Cuéntanos algo sobre ti...", "Tell us something about you...")}
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>
            <SelectField
              label={t("Metas de tu relación", "Your relationship goals")}
              value={normalizeRelationshipGoal(accountProfile.relationshipGoals)}
              options={RELATIONSHIP_GOALS}
              onChange={(value) => update("relationshipGoals", value)}
              getOptionLabel={(value) => getRelationshipGoalLabel(value, t)}
            />
            <View style={styles.editField}>
              <Text style={styles.editLabel}>{t("Idiomas que hablo", "Languages I speak")}</Text>
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
                    !selectedLanguageLabels.length && styles.selectPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {selectedLanguageLabels.length
                    ? t(
                        `${selectedLanguageLabels.length} idiomas seleccionados`,
                        `${selectedLanguageLabels.length} languages selected`
                      )
                    : t("Selecciona idiomas", "Select languages")}
                </Text>
                <Feather name="chevron-right" size={16} color={Colors.textSecondary} />
              </Pressable>
              {selectedLanguageLabels.length ? (
                <View style={styles.languageChipsWrap}>
                  {selectedLanguageLabels.map((label) => (
                    <View key={label} style={styles.languageChip}>
                      <Text style={styles.languageChipText}>{label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("Atributos físicos", "Physical attributes")}
          </Text>
          <View style={styles.card}>
            <SelectField
              label={t("Tipo de cuerpo", "Body type")}
              value={normalizeBodyType(accountProfile.bodyType)}
              options={BODY_TYPES}
              onChange={(value) => update("bodyType", value)}
              getOptionLabel={(value) => getBodyTypeLabel(value, t)}
            />
            <View style={styles.editField}>
              <Text style={styles.editLabel}>{t("Altura", "Height")}</Text>
              <View style={styles.heightRow}>
                <TextInput
                  style={[styles.editInput, styles.heightInput]}
                  value={normalizeHeightInput(accountProfile.height)}
                  onChangeText={updateHeight}
                  onBlur={() => update("height", validateHeightValue(accountProfile.height, heightUnit))}
                  placeholder={heightPlaceholder}
                  placeholderTextColor={Colors.textMuted}
                  keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                />
                <View style={styles.heightUnitBadge}>
                  <Text style={styles.heightUnitText}>{heightUnitLabel}</Text>
                </View>
              </View>
              {heightOutOfRange ? (
                <Text style={styles.heightHint}>
                  {t("Rango permitido: 0 a", "Allowed range: 0 to")} {heightMax}{" "}
                  {heightUnitLabel}
                </Text>
              ) : null}
            </View>
            <SelectField
              label={t("Color de cabello", "Hair color")}
              value={normalizeHairColor(accountProfile.hairColor)}
              options={HAIR_COLORS}
              onChange={(value) => update("hairColor", value)}
              getOptionLabel={(value) => getHairColorLabel(value, t)}
            />
            <SelectField
              label={t("Etnia", "Ethnicity")}
              value={normalizeEthnicity(accountProfile.ethnicity)}
              options={ETHNICITIES}
              onChange={(value) => update("ethnicity", value)}
              getOptionLabel={(value) => getEthnicityLabel(value, t)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("Intereses", "Interests")}</Text>
          <View style={styles.card}>
            <View style={styles.interestsWrap}>
              {INTERESTS_LIST.map((interest) => {
                const selected = accountProfile.interests.includes(interest);
                return (
                  <Pressable
                    key={interest}
                    onPress={() => toggleInterest(interest)}
                    style={[
                      styles.interestChip,
                      selected && styles.interestChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.interestChipText,
                        selected && styles.interestChipTextSelected,
                      ]}
                    >
                      {interest}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

      </ScrollView>

      <Modal
        visible={languagesModalOpen}
        animationType="fade"
        presentationStyle="overFullScreen"
        transparent
        onRequestClose={closeLanguagesModal}
      >
        <View style={styles.modalOverlay}>
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

            <Text style={styles.modalTitle}>{t("Idiomas que hablo", "Languages I speak")}</Text>
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
              />
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
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
                      <Text
                        style={[
                          styles.modalOptionText,
                          selected && styles.modalOptionTextSelected,
                        ]}
                      >
                        {getSpokenLanguageLabel(item.value, language)}
                      </Text>
                      {selected ? (
                        <Feather name="check" size={13} color={Colors.primaryLight} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.text,
    letterSpacing: -0.8,
  },
  headerSub: {
    marginTop: 2,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  settingsBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 28,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  mainPhotoWrap: {
    width: 126,
    height: 126,
    borderRadius: 63,
    overflow: "hidden",
    marginBottom: 16,
  },
  mainPhoto: {
    width: "100%",
    height: "100%",
    borderRadius: 63,
  },
  mainPhotoPlaceholder: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  photoEditBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  nameText: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.text,
    textAlign: "center",
  },
  namePrefixText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emailText: {
    marginTop: 4,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  quickStats: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  quickChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.text,
  },
  section: {
    marginTop: 26,
    paddingHorizontal: 20,
    gap: 12,
  },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  sectionHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  card: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoSlot: {
    width: "31%",
    aspectRatio: 0.82,
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
  },
  photoSlotMain: {
    width: "48.5%",
  },
  photoSlotImage: {
    width: "100%",
    height: "100%",
  },
  photoSlotPlaceholder: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  photoSlotPlaceholderMain: {
    backgroundColor: Colors.backgroundElevated,
    borderColor: Colors.primaryLight,
    borderStyle: "dashed",
  },
  mainBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(15,26,20,0.72)",
  },
  mainBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.text,
  },
  summaryField: {
    gap: 6,
  },
  summaryLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summaryValue: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  editField: {
    gap: 10,
  },
  editLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  editInput: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
  },
  heightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heightInput: {
    flex: 1,
  },
  heightUnitBadge: {
    minWidth: 60,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  heightUnitText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.primaryLight,
  },
  heightHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  editInputMultiline: {
    minHeight: 118,
  },
  languageChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  languageChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(82,183,136,0.12)",
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  languageChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.primaryLight,
  },
  selectField: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectValue: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
  },
  selectPlaceholder: {
    color: Colors.textMuted,
  },
  dropdown: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundElevated,
    overflow: "hidden",
  },
  dropdownOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownOptionActive: {
    backgroundColor: "rgba(82,183,136,0.08)",
  },
  dropdownOptionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  dropdownOptionTextActive: {
    color: Colors.primaryLight,
    fontFamily: "Inter_500Medium",
  },
  interestsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  interestChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.text,
  },
  interestChipSelected: {
    backgroundColor: "rgba(82,183,136,0.15)",
    borderColor: Colors.primaryLight,
  },
  interestChipTextSelected: {
    color: Colors.primaryLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(6, 12, 10, 0.72)",
    paddingHorizontal: 16,
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
  },
  modalDescription: {
    marginTop: 8,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  modalCounter: {
    marginTop: 10,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.primaryLight,
  },
  searchField: {
    marginTop: 16,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
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
  modalScroll: {
    flex: 1,
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
    alignSelf: "flex-start",
    gap: 6,
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
});

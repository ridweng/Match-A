import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Image,
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
  HAIR_COLORS,
  HEIGHTS,
  INTERESTS_LIST,
  MAX_PROFILE_PHOTOS,
} from "@/constants/profile-options";
import { useApp, type UserProfile } from "@/context/AppContext";
import { formatDateForDisplay } from "@/utils/dateOfBirth";

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
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <View style={styles.editField}>
      <Text style={styles.editLabel}>{label}</Text>
      <Pressable onPress={() => setOpen((current) => !current)} style={styles.selectField}>
        <Text style={[styles.selectValue, !value && styles.selectPlaceholder]}>
          {value || "—"}
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
                {option}
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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const {
    t,
    accountProfile,
    removeProfilePhoto,
    setProfilePhoto,
    updateProfile,
  } = useApp();

  const placeholder = t("Ninguno", "None");
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 16);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 100);

  const showValue = (value: string | string[]) => {
    if (Array.isArray(value)) {
      return value.length ? value.join(", ") : placeholder;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return formatDateForDisplay(value) || placeholder;
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
            {showValue(accountProfile.name)}
          </Text>
          <Text style={styles.emailText}>
            {showValue(accountProfile.email)}
          </Text>

          <View style={styles.quickStats}>
            <View style={styles.quickChip}>
              <Feather name="calendar" size={14} color={Colors.primaryLight} />
              <Text style={styles.quickChipText}>
                {accountProfile.age
                  ? t(`${accountProfile.age} años`, `${accountProfile.age} years`)
                  : placeholder}
              </Text>
            </View>
            <View style={styles.quickChip}>
              <Feather name="gift" size={14} color={Colors.accent} />
              <Text style={styles.quickChipText}>
                {showValue(accountProfile.dateOfBirth)}
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
          <Text style={styles.sectionTitle}>{t("Cuenta", "Account")}</Text>
          <View style={styles.card}>
            <SummaryField
              label={t("Nombre completo", "Full name")}
              value={showValue(accountProfile.name)}
            />
            <SummaryField
              label={t("Correo electrónico", "Email")}
              value={showValue(accountProfile.email)}
            />
            <SummaryField
              label={t("Edad", "Age")}
              value={accountProfile.age || placeholder}
            />
            <SummaryField
              label={t("Fecha de nacimiento", "Date of birth")}
              value={showValue(accountProfile.dateOfBirth)}
            />
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
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("Atributos físicos", "Physical attributes")}
          </Text>
          <View style={styles.card}>
            <SelectField
              label={t("Tipo de cuerpo", "Body type")}
              value={accountProfile.bodyType}
              options={BODY_TYPES}
              onChange={(value) => update("bodyType", value)}
            />
            <SelectField
              label={t("Altura", "Height")}
              value={accountProfile.height}
              options={HEIGHTS}
              onChange={(value) => update("height", value)}
            />
            <SelectField
              label={t("Color de cabello", "Hair color")}
              value={accountProfile.hairColor}
              options={HAIR_COLORS}
              onChange={(value) => update("hairColor", value)}
            />
            <SelectField
              label={t("Etnia", "Ethnicity")}
              value={accountProfile.ethnicity}
              options={ETHNICITIES}
              onChange={(value) => update("ethnicity", value)}
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
  editInputMultiline: {
    minHeight: 118,
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
});

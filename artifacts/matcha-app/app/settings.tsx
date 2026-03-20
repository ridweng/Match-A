import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateOfBirthField } from "@/components/DateOfBirthField";
import colors from "@/constants/colors";
import {
  ENGLISH_PRONOUNS,
  GENDER_IDENTITIES,
  getGenderIdentityLabel,
  getPronounLabel,
  normalizeGenderIdentity,
  normalizePronouns,
  SPANISH_PRONOUNS,
} from "@/constants/profile-options";
import { useApp, type HeightUnit, type UserProfile } from "@/context/AppContext";

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMultiline, !onChangeText && s.inputReadonly]}
        value={value}
        onChangeText={onChangeText}
        editable={Boolean(onChangeText)}
        multiline={multiline}
        numberOfLines={multiline ? 5 : 1}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primaryLight}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}

function LanguageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "es" | "en";
  onChange: (value: "es" | "en") => void;
}) {
  const [open, setOpen] = useState(false);
  const options: Array<{ value: "es" | "en"; label: string }> = [
    { value: "es", label: "Español" },
    { value: "en", label: "English" },
  ];

  return (
    <View style={[s.field, open && s.fieldOpen]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={[s.selectWrap, open && s.selectWrapOpen]}>
        <Pressable
          onPress={() => setOpen((current) => !current)}
          style={s.selectField}
        >
          <Text style={s.selectValue}>
            {options.find((option) => option.value === value)?.label || value}
          </Text>
          <Feather
            name={open ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textSecondary}
          />
        </Pressable>
        {open ? (
          <View style={s.dropdown}>
            {options.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={[s.dropdownOption, value === option.value && s.dropdownOptionActive]}
              >
                <Text
                  style={[
                    s.dropdownOptionText,
                    value === option.value && s.dropdownOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
                {value === option.value ? (
                  <Feather name="check" size={14} color={colors.primaryLight} />
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function HeightUnitField({
  label,
  value,
  onChange,
  t,
}: {
  label: string;
  value: HeightUnit;
  onChange: (value: HeightUnit) => void;
  t: (es: string, en: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const options: Array<{ value: HeightUnit; label: string }> = [
    { value: "metric", label: t("Métrico", "Metric") },
    { value: "imperial", label: t("Imperial", "Imperial") },
  ];

  return (
    <View style={[s.field, open && s.fieldOpen]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={[s.selectWrap, open && s.selectWrapOpen]}>
        <Pressable
          onPress={() => setOpen((current) => !current)}
          style={s.selectField}
        >
          <Text style={s.selectValue}>
            {options.find((option) => option.value === value)?.label || value}
          </Text>
          <Feather
            name={open ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textSecondary}
          />
        </Pressable>
        {open ? (
          <View style={s.dropdown}>
            {options.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={[s.dropdownOption, value === option.value && s.dropdownOptionActive]}
              >
                <Text
                  style={[
                    s.dropdownOptionText,
                    value === option.value && s.dropdownOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
                {value === option.value ? (
                  <Feather name="check" size={14} color={colors.primaryLight} />
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function IdentityField({
  label,
  value,
  onChange,
  placeholder,
  t,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  t: (es: string, en: string) => string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={[s.field, open && s.fieldOpen]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={[s.selectWrap, open && s.selectWrapOpen]}>
        <Pressable
          onPress={() => setOpen((current) => !current)}
          style={s.selectField}
        >
          <Text style={[s.selectValue, !value && s.selectPlaceholder]}>
            {value ? getGenderIdentityLabel(value, t) : placeholder}
          </Text>
          <Feather
            name={open ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textSecondary}
          />
        </Pressable>
        {open ? (
          <View style={s.dropdown}>
            {GENDER_IDENTITIES.map((option) => (
              <Pressable
                key={option}
                onPress={() => {
                  onChange(option);
                  setOpen(false);
                }}
                style={[s.dropdownOption, value === option && s.dropdownOptionActive]}
              >
                <Text
                  style={[
                    s.dropdownOptionText,
                    value === option && s.dropdownOptionTextActive,
                  ]}
                >
                  {getGenderIdentityLabel(option, t)}
                </Text>
                {value === option ? (
                  <Feather name="check" size={14} color={colors.primaryLight} />
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function PronounsField({
  label,
  value,
  onChange,
  placeholder,
  language,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  language: "es" | "en";
}) {
  const [open, setOpen] = useState(false);
  const options = language === "es" ? SPANISH_PRONOUNS : ENGLISH_PRONOUNS;

  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={[s.selectWrap, open && s.selectWrapOpen]}>
        <Pressable
          onPress={() => setOpen((current) => !current)}
          style={s.selectField}
        >
          <Text style={[s.selectValue, !value && s.selectPlaceholder]}>
            {value ? getPronounLabel(value, language) : placeholder}
          </Text>
          <Feather
            name={open ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textSecondary}
          />
        </Pressable>
        {open ? (
          <View style={s.dropdown}>
            {options.map((option) => (
              <Pressable
                key={option}
                onPress={() => {
                  onChange(option);
                  setOpen(false);
                }}
                style={[s.dropdownOption, value === option && s.dropdownOptionActive]}
              >
                <Text
                  style={[
                    s.dropdownOptionText,
                    value === option && s.dropdownOptionTextActive,
                  ]}
                >
                  {getPronounLabel(option, language)}
                </Text>
                {value === option ? (
                  <Feather name="check" size={14} color={colors.primaryLight} />
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.card}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    accountProfile,
    biometricsEnabled,
    heightUnit,
    language,
    logout,
    saveSettings,
    setBiometricsEnabled,
    t,
  } = useApp();

  const [local, setLocal] = useState<UserProfile>({
    name: accountProfile.name,
    age: accountProfile.age,
    dateOfBirth: accountProfile.dateOfBirth,
    location: accountProfile.location,
    genderIdentity: normalizeGenderIdentity(accountProfile.genderIdentity),
    pronouns: normalizePronouns(accountProfile.pronouns),
    relationshipGoals: accountProfile.relationshipGoals,
    languagesSpoken: accountProfile.languagesSpoken,
    education: accountProfile.education,
    childrenPreference: accountProfile.childrenPreference,
    physicalActivity: accountProfile.physicalActivity,
    alcoholUse: accountProfile.alcoholUse,
    tobaccoUse: accountProfile.tobaccoUse,
    politicalInterest: accountProfile.politicalInterest,
    religionImportance: accountProfile.religionImportance,
    religion: accountProfile.religion,
    bio: accountProfile.bio,
    bodyType: accountProfile.bodyType,
    height: accountProfile.height,
    hairColor: accountProfile.hairColor,
    ethnicity: accountProfile.ethnicity,
    interests: accountProfile.interests,
    photos: accountProfile.photos,
  });
  const [biometricPending, setBiometricPending] = useState(false);
  const [localHeightUnit, setLocalHeightUnit] = useState<HeightUnit>(heightUnit);
  const [localLanguage, setLocalLanguage] = useState<"es" | "en">(language);

  useEffect(() => {
    setLocal({
      name: accountProfile.name,
      age: accountProfile.age,
      dateOfBirth: accountProfile.dateOfBirth,
      location: accountProfile.location,
      genderIdentity: normalizeGenderIdentity(accountProfile.genderIdentity),
      pronouns: normalizePronouns(accountProfile.pronouns),
      relationshipGoals: accountProfile.relationshipGoals,
      languagesSpoken: accountProfile.languagesSpoken,
      education: accountProfile.education,
      childrenPreference: accountProfile.childrenPreference,
      physicalActivity: accountProfile.physicalActivity,
      alcoholUse: accountProfile.alcoholUse,
      tobaccoUse: accountProfile.tobaccoUse,
      politicalInterest: accountProfile.politicalInterest,
      religionImportance: accountProfile.religionImportance,
      religion: accountProfile.religion,
      bio: accountProfile.bio,
      bodyType: accountProfile.bodyType,
      height: accountProfile.height,
      hairColor: accountProfile.hairColor,
      ethnicity: accountProfile.ethnicity,
      interests: accountProfile.interests,
      photos: accountProfile.photos,
    });
    setLocalHeightUnit(heightUnit);
    setLocalLanguage(language);
  }, [accountProfile, heightUnit, language]);

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const hasChanges = useMemo(() => {
    const current = {
      name: accountProfile.name,
      age: accountProfile.age,
      dateOfBirth: accountProfile.dateOfBirth,
      location: accountProfile.location,
      genderIdentity: normalizeGenderIdentity(accountProfile.genderIdentity),
      pronouns: normalizePronouns(accountProfile.pronouns),
      relationshipGoals: accountProfile.relationshipGoals,
      languagesSpoken: accountProfile.languagesSpoken,
      education: accountProfile.education,
      childrenPreference: accountProfile.childrenPreference,
      physicalActivity: accountProfile.physicalActivity,
      alcoholUse: accountProfile.alcoholUse,
      tobaccoUse: accountProfile.tobaccoUse,
      politicalInterest: accountProfile.politicalInterest,
      religionImportance: accountProfile.religionImportance,
      religion: accountProfile.religion,
      bio: accountProfile.bio,
      bodyType: accountProfile.bodyType,
      height: accountProfile.height,
      hairColor: accountProfile.hairColor,
      ethnicity: accountProfile.ethnicity,
      interests: accountProfile.interests,
      photos: accountProfile.photos,
    };

    return (
      JSON.stringify(current) !== JSON.stringify(local) ||
      heightUnit !== localHeightUnit ||
      language !== localLanguage
    );
  }, [accountProfile, heightUnit, language, local, localHeightUnit, localLanguage]);

  const update = (key: keyof UserProfile, value: string | string[]) => {
    setLocal((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    const saved = await saveSettings({
      name: local.name,
      dateOfBirth: local.dateOfBirth,
      genderIdentity: local.genderIdentity,
      pronouns: local.pronouns,
      language: localLanguage,
      heightUnit: localHeightUnit,
    });
    if (!saved) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/(tabs)/profile");
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    setBiometricPending(true);
    const result = await setBiometricsEnabled(enabled);
    setBiometricPending(false);

    if (result.ok) {
      return;
    }

    if (result.code === "BIOMETRICS_UNAVAILABLE") {
      Alert.alert(
        t("Biometría no disponible", "Biometrics unavailable"),
        t(
          "Este dispositivo no admite desbloqueo biométrico.",
          "This device does not support biometric unlock."
        )
      );
      return;
    }

    if (result.code === "BIOMETRICS_NOT_ENROLLED") {
      Alert.alert(
        t("Biometría no configurada", "Biometrics not set up"),
        t(
          "Configura Face ID, Touch ID o huella en tu dispositivo antes de activar esta opción.",
          "Set up Face ID, Touch ID, or fingerprint on your device before enabling this."
        )
      );
      return;
    }
  };

  const handleLogout = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t("Cerrar sesión", "Log out"),
      t("¿Estás seguro que deseas salir?", "Are you sure you want to log out?"),
      [
        {
          text: t("Cancelar", "Cancel"),
          style: "cancel",
        },
        {
          text: t("Salir", "Log out"),
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/login");
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      t("Eliminar cuenta", "Delete account"),
      t(
        "Esta acción es permanente e irreversible.",
        "This action is permanent and irreversible."
      ),
      [
        {
          text: t("Cancelar", "Cancel"),
          style: "cancel",
        },
        {
          text: t("Eliminar", "Delete"),
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Demo",
              t(
                "La eliminación de cuenta aún no está conectada al backend.",
                "Account deletion is not connected to the backend yet."
              )
            ),
        },
      ]
    );
  };

  return (
    <View style={[s.container, { paddingTop: topPadding }]}>
      <View style={s.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
        >
          <Feather name="chevron-left" size={22} color={colors.ivory} />
        </Pressable>
        <Text style={s.headerTitle}>{t("Ajustes", "Settings")}</Text>
        <Pressable
          onPress={handleSave}
          disabled={!hasChanges}
          style={({ pressed }) => [
            s.saveIconBtn,
            hasChanges && s.saveIconBtnActive,
            !hasChanges && s.saveIconBtnDisabled,
            pressed && hasChanges && { opacity: 0.82 },
          ]}
        >
          <Feather
            name="check"
            size={22}
            color={hasChanges ? colors.textInverted : colors.textMuted}
          />
          <Text
            style={[
              s.saveIconBtnText,
              !hasChanges && s.saveIconBtnTextDisabled,
            ]}
          >
            {t("Guardar", "Save")}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: bottomPadding + 100 }]}
      >
        <Section title={t("Cuenta", "Account")}>
          <Field
            label={t("Correo electrónico", "Email")}
            value={accountProfile.email || t("Sin correo", "No email")}
          />
          <View style={s.divider} />
          <View style={s.toggleRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.toggleLabel}>
                {t("Desbloqueo con biometría", "Biometric unlock")}
              </Text>
              <Text style={s.toggleHint}>
                {t(
                  "Se pedirá al abrir la app solo si ya lo activaste para esta cuenta.",
                  "It will be requested on app open only if you already enabled it for this account."
                )}
              </Text>
            </View>
            <Switch
              value={biometricsEnabled}
              disabled={biometricPending}
              onValueChange={handleBiometricToggle}
              trackColor={{ false: colors.cardBorder, true: colors.gold }}
              thumbColor={colors.ivory}
            />
          </View>
          <View style={s.divider} />
          <LanguageField
            label={t("Idioma de la app", "App language")}
            value={localLanguage}
            onChange={setLocalLanguage}
          />
          <HeightUnitField
            label={t("Unidades de altura", "Height units")}
            value={localHeightUnit}
            onChange={setLocalHeightUnit}
            t={t}
          />
        </Section>

        <Section title={t("Información básica", "Basic info")}>
          <Field
            label={t("Nombre completo", "Full name")}
            value={local.name}
            onChangeText={(value) => update("name", value)}
            placeholder={t("Tu nombre", "Your name")}
          />
          <DateOfBirthField
            label={t("Fecha de nacimiento", "Date of birth")}
            value={local.dateOfBirth}
            onChange={(value) => update("dateOfBirth", value)}
            cancelLabel={t("Cancelar", "Cancel")}
            confirmLabel={t("Guardar", "Save")}
          />
          <IdentityField
            label={t("Cómo te identificas", "How you identify")}
            value={local.genderIdentity}
            onChange={(value) => update("genderIdentity", value)}
            placeholder={t("Selecciona una opción", "Select an option")}
            t={t}
          />
          <PronounsField
            label={t("Pronombres", "Pronouns")}
            value={local.pronouns}
            onChange={(value) => update("pronouns", value)}
            placeholder={t("Selecciona pronombres", "Select pronouns")}
            language={language}
          />
        </Section>

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [s.logoutBtn, pressed && { opacity: 0.84 }]}
        >
          <Feather name="log-out" size={18} color={colors.ivory} />
          <Text style={s.logoutText}>{t("Cerrar sesión", "Log out")}</Text>
        </Pressable>

        <View style={s.dangerZone}>
          <Text style={s.dangerTitle}>{t("Zona de peligro", "Danger zone")}</Text>
          <Pressable
            onPress={handleDeleteAccount}
            style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.8 }]}
          >
            <Feather name="trash-2" size={17} color={colors.dislikeRed} />
            <Text style={s.deleteBtnText}>
              {t("Eliminar mi cuenta", "Delete my account")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    position: "relative",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  saveIconBtn: {
    width: 94,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    paddingHorizontal: 14,
    flexDirection: "row",
    gap: 6,
  },
  saveIconBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
    shadowColor: colors.primaryLight,
    shadowOpacity: 0.38,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 6,
  },
  saveIconBtnDisabled: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  saveIconBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: colors.textInverted,
  },
  saveIconBtnTextDisabled: {
    color: colors.textMuted,
  },
  headerTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: colors.ivory,
    letterSpacing: -0.3,
    textAlign: "center",
    pointerEvents: "none",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  section: {
    marginTop: 24,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: colors.gold,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    gap: 14,
  },
  field: {
    gap: 7,
    zIndex: 1,
  },
  fieldOpen: {
    zIndex: 60,
  },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: colors.slateLight,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  selectWrap: {
    position: "relative",
    zIndex: 1,
  },
  selectWrapOpen: {
    zIndex: 40,
  },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: colors.ivory,
  },
  inputMultiline: {
    minHeight: 118,
  },
  inputReadonly: {
    color: colors.slateLight,
  },
  selectField: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectValue: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: colors.ivory,
  },
  selectPlaceholder: {
    color: colors.textMuted,
  },
  dropdown: {
    position: "absolute",
    top: 58,
    left: 0,
    right: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.backgroundElevated,
    overflow: "hidden",
    zIndex: 50,
    elevation: 8,
  },
  dropdownOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  dropdownOptionActive: {
    backgroundColor: "rgba(82,183,136,0.08)",
  },
  dropdownOptionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.slateLight,
  },
  dropdownOptionTextActive: {
    color: colors.primaryLight,
    fontFamily: "Inter_500Medium",
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  toggleLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: colors.ivory,
  },
  toggleHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: colors.slateLight,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  interestChipSelected: {
    backgroundColor: "rgba(82,183,136,0.15)",
    borderColor: colors.primaryLight,
  },
  interestChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: colors.slateLight,
  },
  interestChipTextSelected: {
    color: colors.primaryLight,
  },
  logoutBtn: {
    marginTop: 12,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  logoutText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.ivory,
  },
  dangerZone: {
    marginTop: 24,
    marginBottom: 12,
    gap: 10,
  },
  dangerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: colors.dislikeRed,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 4,
  },
  deleteBtn: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(230,57,70,0.25)",
    backgroundColor: "rgba(230,57,70,0.07)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  deleteBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.dislikeRed,
  },
});

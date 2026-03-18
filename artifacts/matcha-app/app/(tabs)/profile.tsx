import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Dimensions,
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
import { useApp, type UserProfile } from "@/context/AppContext";

const { width } = Dimensions.get("window");
const PHOTO_SIZE = Math.floor((width - 40 - 24) / 5);

const BODY_TYPES = [
  "Delgado / Slim",
  "Atlético / Athletic",
  "Musculoso / Muscular",
  "Normal / Average",
  "Con curvas / Curvy",
  "Robusto / Stocky",
];

const HAIR_COLORS = [
  "Negro / Black",
  "Castaño / Brown",
  "Rubio / Blonde",
  "Pelirrojo / Red",
  "Canoso / Grey",
  "Calvo / Bald",
];

const HEIGHTS = [
  "160-164 cm",
  "165-169 cm",
  "170-174 cm",
  "175-179 cm",
  "180-184 cm",
  "185-189 cm",
  "190+ cm",
];

const ETHNICITIES = [
  "Hispano / Hispanic",
  "Caucásico / Caucasian",
  "Afrolatino / Afro-Latino",
  "Asiático / Asian",
  "Árabe / Arab",
  "Mixto / Mixed",
  "Otro / Other",
];

const INTERESTS_LIST = [
  "Fitness",
  "Senderismo",
  "Meditación",
  "Lectura",
  "Fotografía",
  "Música",
  "Viajes",
  "Gastronomía",
  "Arte",
  "Tecnología",
  "Surf",
  "Yoga",
  "Ciclismo",
  "Cocina",
  "Cine",
];

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={sf.container}>
      <Text style={sf.label}>{label}</Text>
      <Pressable onPress={() => setOpen(!open)} style={sf.field}>
        <Text style={sf.fieldText}>{value || "—"}</Text>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={Colors.textSecondary}
        />
      </Pressable>
      {open && (
        <View style={sf.dropdown}>
          {options.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => {
                onChange(opt);
                setOpen(false);
              }}
              style={[sf.option, value === opt && sf.optionActive]}
            >
              <Text
                style={[sf.optionText, value === opt && sf.optionTextActive]}
              >
                {opt}
              </Text>
              {value === opt && (
                <Feather name="check" size={14} color={Colors.primaryLight} />
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const sf = StyleSheet.create({
  container: { gap: 6 },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  field: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fieldText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
  },
  dropdown: {
    backgroundColor: Colors.backgroundElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    overflow: "hidden",
    zIndex: 100,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionActive: {
    backgroundColor: "rgba(82,183,136,0.08)",
  },
  optionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  optionTextActive: {
    color: Colors.primaryLight,
    fontFamily: "Inter_500Medium",
  },
});

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { t, profile, setProfile, logout, language, setLanguage } = useApp();
  const [local, setLocal] = useState<UserProfile>({ ...profile });
  const [saved, setSaved] = useState(false);

  const update = (key: keyof UserProfile, val: any) =>
    setLocal((p) => ({ ...p, [key]: val }));

  const toggleInterest = (i: string) => {
    setLocal((p) => ({
      ...p,
      interests: p.interests.includes(i)
        ? p.interests.filter((x) => x !== i)
        : [...p.interests, i],
    }));
  };

  const handleSave = () => {
    setProfile(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 16);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 100);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>
              {t("Mi Perfil", "My Profile")}
            </Text>
            <Text style={styles.headerSub}>
              {t("Edita tu información", "Edit your info")}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setLanguage(language === "es" ? "en" : "es")}
              style={styles.langToggle}
            >
              <Text style={styles.langToggleText}>
                {language === "es" ? "EN" : "ES"}
              </Text>
            </Pressable>
            <Pressable style={styles.settingsBtn}>
              <Feather name="settings" size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* Photo section */}
        <View style={styles.photoSection}>
          <Text style={styles.sectionTitle}>
            {t("Mis fotos", "My photos")}
          </Text>
          <View style={styles.photoMainRow}>
            <View style={styles.photoMainSlot}>
              <View style={styles.photoPlaceholder}>
                <Feather name="user" size={36} color={Colors.textMuted} />
              </View>
              <View style={styles.photoMainBadge}>
                <Feather name="star" size={10} color={Colors.textInverted} />
              </View>
              <Pressable style={styles.photoEditOverlay}>
                <Feather name="camera" size={14} color="#fff" />
              </Pressable>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoRow}
          >
            {Array.from({ length: 9 }).map((_, i) => (
              <View key={i} style={styles.photoThumb}>
                {i < 2 ? (
                  <View style={styles.photoFilled}>
                    <Feather name="image" size={16} color={Colors.textMuted} />
                  </View>
                ) : i === 2 ? (
                  <View style={styles.photoAddBtn}>
                    <Feather name="plus" size={18} color={Colors.primaryLight} />
                  </View>
                ) : (
                  <View style={styles.photoEmpty}>
                    <Feather name="plus" size={12} color={Colors.textMuted} />
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
          <Text style={styles.photoHint}>
            {t(
              "Hasta 10 fotos · La primera es tu foto principal",
              "Up to 10 photos · First is your main photo"
            )}
          </Text>
        </View>

        {/* Basic info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("Información básica", "Basic info")}
          </Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              {t("Nombre completo", "Full name")}
            </Text>
            <TextInput
              style={styles.input}
              value={local.name}
              onChangeText={(v) => update("name", v)}
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primaryLight}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t("Edad", "Age")}</Text>
            <TextInput
              style={styles.input}
              value={local.age}
              onChangeText={(v) => update("age", v)}
              keyboardType="numeric"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primaryLight}
            />
          </View>
        </View>

        {/* Physical attributes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("Atributos físicos", "Physical attributes")}
          </Text>

          <SelectField
            label={t("Tipo de cuerpo", "Body type")}
            value={local.bodyType}
            options={BODY_TYPES}
            onChange={(v) => update("bodyType", v)}
          />
          <SelectField
            label={t("Color de cabello", "Hair color")}
            value={local.hairColor}
            options={HAIR_COLORS}
            onChange={(v) => update("hairColor", v)}
          />
          <SelectField
            label={t("Altura", "Height")}
            value={local.height}
            options={HEIGHTS}
            onChange={(v) => update("height", v)}
          />
          <SelectField
            label={t("Etnia", "Ethnicity")}
            value={local.ethnicity}
            options={ETHNICITIES}
            onChange={(v) => update("ethnicity", v)}
          />
        </View>

        {/* Interests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("Intereses", "Interests")}
          </Text>
          <View style={styles.interestsGrid}>
            {INTERESTS_LIST.map((interest) => {
              const selected = local.interests.includes(interest);
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

        {/* Bio */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("Sobre mí", "About me")}
          </Text>
          <TextInput
            style={styles.bioInput}
            value={local.bio}
            onChangeText={(v) => update("bio", v)}
            multiline
            numberOfLines={4}
            placeholder={t(
              "Cuéntanos algo sobre ti...",
              "Tell us something about you..."
            )}
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.primaryLight}
            textAlignVertical="top"
            maxLength={300}
          />
          <Text style={styles.charCount}>{local.bio.length} / 300</Text>
        </View>

        {/* Save button */}
        <View style={styles.saveArea}>
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveBtn,
              saved && styles.saveBtnSuccess,
              {
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <Feather
              name={saved ? "check" : "save"}
              size={18}
              color={Colors.textInverted}
            />
            <Text style={styles.saveBtnText}>
              {saved
                ? t("¡Guardado!", "Saved!")
                : t("Guardar cambios", "Save changes")}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Alert.alert(
                t("Cerrar sesión", "Log out"),
                t("¿Estás seguro?", "Are you sure?"),
                [
                  { text: t("Cancelar", "Cancel"), style: "cancel" },
                  {
                    text: t("Salir", "Log out"),
                    onPress: logout,
                    style: "destructive",
                  },
                ]
              );
            }}
            style={styles.logoutBtn}
          >
            <Feather name="log-out" size={16} color={Colors.error} />
            <Text style={styles.logoutText}>
              {t("Cerrar sesión", "Log out")}
            </Text>
          </Pressable>
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
    paddingBottom: 20,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.text,
    letterSpacing: -0.8,
  },
  headerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  langToggle: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langToggleText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: Colors.primaryLight,
    letterSpacing: 1,
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  photoSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  photoMainRow: {
    alignItems: "center",
  },
  photoMainSlot: {
    width: 120,
    height: 120,
    borderRadius: 60,
    position: "relative",
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  photoMainBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  photoEditOverlay: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  photoRow: {
    gap: 8,
    paddingVertical: 4,
  },
  photoThumb: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.3,
  },
  photoFilled: {
    flex: 1,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  photoAddBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(82,183,136,0.05)",
  },
  photoEmpty: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.4,
  },
  photoHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 28,
    gap: 12,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.text,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
  },
  interestsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  interestChipSelected: {
    backgroundColor: "rgba(82,183,136,0.15)",
    borderColor: Colors.primaryLight,
  },
  interestChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  interestChipTextSelected: {
    color: Colors.primaryLight,
  },
  bioInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
    minHeight: 100,
  },
  charCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "right",
  },
  saveArea: {
    paddingHorizontal: 20,
    gap: 12,
  },
  saveBtn: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveBtnSuccess: {
    backgroundColor: Colors.success,
  },
  saveBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.textInverted,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  logoutText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.error,
  },
});

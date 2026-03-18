import { Feather } from "@expo/vector-icons";
<<<<<<< HEAD
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
=======
>>>>>>> f81a9b8 (second try)
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
<<<<<<< HEAD
=======
  StatusBar,
>>>>>>> f81a9b8 (second try)
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

<<<<<<< HEAD
import colors from "@/constants/colors";
import { getTranslations } from "@/constants/i18n";
import { useApp } from "@/context/AppContext";

type SelectFieldProps = {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
};

function SelectField({ label, value, options, onSelect }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
=======
import Colors from "@/constants/colors";
import { useApp, type UserProfile } from "@/context/AppContext";

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
  "Senderismo / Hiking",
  "Meditación / Meditation",
  "Lectura / Reading",
  "Fotografía / Photography",
  "Música / Music",
  "Viajes / Travel",
  "Gastronomía / Food",
  "Arte / Art",
  "Tecnología / Tech",
  "Surf",
  "Yoga",
  "Ciclismo / Cycling",
  "Cocina / Cooking",
  "Cine / Film",
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

>>>>>>> f81a9b8 (second try)
  return (
    <View style={sf.container}>
      <Text style={sf.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(!open)}
<<<<<<< HEAD
        style={({ pressed }) => [
          sf.trigger,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={[sf.triggerText, !value && sf.placeholder]}>
          {value || "Seleccionar"}
        </Text>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.slateLight}
=======
        style={sf.field}
      >
        <Text style={sf.fieldText}>{value || "—"}</Text>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={Colors.textSecondary}
>>>>>>> f81a9b8 (second try)
        />
      </Pressable>
      {open && (
        <View style={sf.dropdown}>
<<<<<<< HEAD
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {options.map((opt) => (
              <Pressable
                key={opt}
                style={({ pressed }) => [
                  sf.option,
                  opt === value && sf.optionActive,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
              >
                <Text
                  style={[
                    sf.optionText,
                    opt === value && sf.optionTextActive,
                  ]}
                >
                  {opt}
                </Text>
                {opt === value && (
                  <Feather name="check" size={14} color={colors.gold} />
                )}
              </Pressable>
            ))}
          </ScrollView>
=======
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
>>>>>>> f81a9b8 (second try)
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
<<<<<<< HEAD
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  trigger: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
=======
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  field: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
>>>>>>> f81a9b8 (second try)
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
<<<<<<< HEAD
  triggerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: colors.ivory,
  },
  placeholder: {
    color: colors.slateLight,
  },
  dropdown: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: "hidden",
=======
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
>>>>>>> f81a9b8 (second try)
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
<<<<<<< HEAD
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  optionActive: {
    backgroundColor: "rgba(76,175,114,0.08)",
=======
    borderBottomColor: Colors.border,
  },
  optionActive: {
    backgroundColor: "rgba(82,183,136,0.08)",
>>>>>>> f81a9b8 (second try)
  },
  optionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
<<<<<<< HEAD
    color: colors.ivoryDim,
  },
  optionTextActive: {
    color: colors.gold,
=======
    color: Colors.textSecondary,
  },
  optionTextActive: {
    color: Colors.primaryLight,
>>>>>>> f81a9b8 (second try)
    fontFamily: "Inter_500Medium",
  },
});

<<<<<<< HEAD
function PhotosSection({
  photos,
  onAdd,
}: {
  photos: string[];
  onAdd: () => void;
}) {
  const slots = Array.from({ length: 10 });
  return (
    <View style={phs.grid}>
      {slots.map((_, i) => {
        const photo = photos[i];
        return (
          <View key={i} style={phs.slot}>
            {photo ? (
              <View style={phs.photoFilled}>
                <Feather name="image" size={20} color={colors.gold} />
              </View>
            ) : i === photos.length ? (
              <Pressable
                onPress={onAdd}
                style={({ pressed }) => [
                  phs.addSlot,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Feather name="plus" size={22} color={colors.gold} />
              </Pressable>
            ) : (
              <View style={phs.emptySlot}>
                <Feather name="image" size={16} color={colors.cardBorder} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const phs = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slot: {
    width: "30%",
    aspectRatio: 0.8,
  },
  photoFilled: {
    flex: 1,
    backgroundColor: "rgba(76,175,114,0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(76,175,114,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  addSlot: {
    flex: 1,
    backgroundColor: "rgba(76,175,114,0.06)",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(76,175,114,0.3)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  emptySlot: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { language, profile, saveProfile } = useApp();
  const t = getTranslations(language);
  const pt = t.profile;

  const [local, setLocal] = useState({ ...profile });
  const [saved, setSaved] = useState(false);

  const update = (key: keyof typeof local, value: string | string[]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const toggleInterest = (interest: string) => {
    const current = local.interests || [];
    if (current.includes(interest)) {
      update("interests", current.filter((i) => i !== interest));
    } else {
      update("interests", [...current, interest]);
    }
  };

  const handleSave = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await saveProfile(local);
=======
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
>>>>>>> f81a9b8 (second try)
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

<<<<<<< HEAD
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPadding = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{pt.header}</Text>
        <Pressable
          style={({ pressed }) => [
            styles.settingsBtn,
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => router.push("/settings")}
        >
          <Feather name="settings" size={20} color={colors.slateLight} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomPadding + 100 },
        ]}
      >
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{pt.photos}</Text>
          <PhotosSection
            photos={local.photos}
            onAdd={() => {
              Alert.alert("Agregar foto", "Selecciona una foto de tu galería.");
            }}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>{pt.fullName}</Text>
            <TextInput
              style={styles.input}
              value={local.fullName}
              onChangeText={(v) => update("fullName", v)}
              placeholder="ej. Alejandro Ruiz"
              placeholderTextColor={colors.slateLight}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>{pt.age}</Text>
=======
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
          <View style={styles.photoGrid}>
            <View style={[styles.photoSlot, styles.photoMain]}>
              <View style={styles.photoPlaceholder}>
                <Feather name="user" size={32} color={Colors.textMuted} />
              </View>
              <View style={styles.photoMainBadge}>
                <Feather name="star" size={10} color={Colors.textInverted} />
              </View>
            </View>
            {Array.from({ length: 9 }).map((_, i) => (
              <View key={i} style={styles.photoSlot}>
                {i < 2 ? (
                  <View style={styles.photoFilled}>
                    <Feather name="image" size={18} color={Colors.textMuted} />
                  </View>
                ) : i === 2 ? (
                  <View style={styles.photoAddBtn}>
                    <Feather name="plus" size={20} color={Colors.primaryLight} />
                  </View>
                ) : (
                  <View style={styles.photoEmpty}>
                    <Feather name="plus" size={14} color={Colors.textMuted} />
                  </View>
                )}
              </View>
            ))}
          </View>
          <Text style={styles.photoHint}>
            {t(
              "Hasta 10 fotos · La primera es tu foto principal",
              "Up to 10 photos · The first is your main photo"
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
>>>>>>> f81a9b8 (second try)
            <TextInput
              style={styles.input}
              value={local.age}
              onChangeText={(v) => update("age", v)}
<<<<<<< HEAD
              placeholder="ej. 31"
              placeholderTextColor={colors.slateLight}
              keyboardType="number-pad"
=======
              keyboardType="numeric"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.primaryLight}
>>>>>>> f81a9b8 (second try)
            />
          </View>
        </View>

<<<<<<< HEAD
        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{pt.physical}</Text>
          <SelectField
            label={pt.bodyType}
            value={local.bodyType}
            options={t.bodyTypes}
            onSelect={(v) => update("bodyType", v)}
          />
          <SelectField
            label={pt.hairColor}
            value={local.hairColor}
            options={t.hairColors}
            onSelect={(v) => update("hairColor", v)}
          />
          <SelectField
            label={pt.height}
            value={local.height}
            options={t.heights}
            onSelect={(v) => update("height", v)}
          />
          <SelectField
            label={pt.weight}
            value={local.weight}
            options={t.weights}
            onSelect={(v) => update("weight", v)}
          />
          <SelectField
            label={pt.ethnicity}
            value={local.ethnicity}
            options={t.ethnicities}
            onSelect={(v) => update("ethnicity", v)}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{pt.interests}</Text>
          <View style={styles.interestGrid}>
            {t.interestsList.map((interest) => (
              <Pressable
                key={interest}
                onPress={() => toggleInterest(interest)}
                style={({ pressed }) => [
                  styles.interestChip,
                  (local.interests || []).includes(interest) &&
                    styles.interestChipActive,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text
                  style={[
                    styles.interestChipText,
                    (local.interests || []).includes(interest) &&
                      styles.interestChipTextActive,
                  ]}
                >
                  {interest}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.fieldLabel}>{pt.bio}</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={local.bio}
            onChangeText={(v) => update("bio", v)}
            placeholder={pt.bioPlaceholder}
            placeholderTextColor={colors.slateLight}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveBtn,
            pressed && styles.saveBtnPressed,
            saved && styles.saveBtnSuccess,
          ]}
        >
          <Feather
            name={saved ? "check" : "save"}
            size={18}
            color={saved ? colors.navy : colors.navy}
          />
          <Text style={styles.saveBtnText}>
            {saved ? (language === "es" ? "Guardado" : "Saved") : pt.save}
          </Text>
        </Pressable>
=======
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
              { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
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
                  { text: t("Salir", "Log out"), onPress: logout, style: "destructive" },
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
>>>>>>> f81a9b8 (second try)
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
<<<<<<< HEAD
    backgroundColor: colors.navy,
=======
    backgroundColor: Colors.background,
>>>>>>> f81a9b8 (second try)
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
<<<<<<< HEAD
    paddingVertical: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: colors.ivory,
    letterSpacing: -0.5,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 0,
  },
  section: {
    gap: 14,
    paddingVertical: 20,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: colors.gold,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  inputGroup: {
=======
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
    gap: 10,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoSlot: {
    width: (Platform.OS === "web" ? 300 : (Dimensions ? 60 : 60)),
    aspectRatio: 3 / 4,
  },
  photoMain: {
    width: "100%",
    aspectRatio: 4 / 3,
    marginBottom: 2,
  },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  photoMainBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  photoFilled: {
    flex: 1,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  photoAddBtn: {
    flex: 1,
    borderRadius: 12,
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
    borderRadius: 12,
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
>>>>>>> f81a9b8 (second try)
    gap: 6,
  },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
<<<<<<< HEAD
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
=======
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
>>>>>>> f81a9b8 (second try)
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
<<<<<<< HEAD
    color: colors.ivory,
  },
  bioInput: {
    height: 100,
    paddingTop: 13,
  },
  interestGrid: {
=======
    color: Colors.text,
  },
  interestsGrid: {
>>>>>>> f81a9b8 (second try)
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
<<<<<<< HEAD
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  interestChipActive: {
    backgroundColor: "rgba(76,175,114,0.15)",
    borderColor: "rgba(76,175,114,0.4)",
  },
  interestChipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: colors.slateLight,
  },
  interestChipTextActive: {
    color: colors.goldLight,
    fontFamily: "Inter_500Medium",
  },
  saveBtn: {
    backgroundColor: colors.gold,
    borderRadius: 14,
    height: 54,
=======
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
>>>>>>> f81a9b8 (second try)
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
<<<<<<< HEAD
    marginTop: 8,
    marginBottom: 8,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  saveBtnSuccess: {
    backgroundColor: colors.success,
  },
  saveBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.navy,
  },
});
=======
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

// Fix missing Dimensions import
import { Dimensions } from "react-native";
>>>>>>> f81a9b8 (second try)

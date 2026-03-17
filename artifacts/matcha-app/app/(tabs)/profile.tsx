import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  return (
    <View style={sf.container}>
      <Text style={sf.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(!open)}
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
        />
      </Pressable>
      {open && (
        <View style={sf.dropdown}>
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
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  trigger: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
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
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  optionActive: {
    backgroundColor: "rgba(201,168,76,0.08)",
  },
  optionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: colors.ivoryDim,
  },
  optionTextActive: {
    color: colors.gold,
    fontFamily: "Inter_500Medium",
  },
});

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
    backgroundColor: "rgba(201,168,76,0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  addSlot: {
    flex: 1,
    backgroundColor: "rgba(201,168,76,0.06)",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(201,168,76,0.3)",
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
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
          onPress={() => Alert.alert("Ajustes / Settings", "Próximamente")}
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
            <TextInput
              style={styles.input}
              value={local.age}
              onChangeText={(v) => update("age", v)}
              placeholder="ej. 31"
              placeholderTextColor={colors.slateLight}
              keyboardType="number-pad"
            />
          </View>
        </View>

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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
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
    gap: 6,
  },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: colors.ivory,
  },
  bioInput: {
    height: 100,
    paddingTop: 13,
  },
  interestGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  interestChipActive: {
    backgroundColor: "rgba(201,168,76,0.15)",
    borderColor: "rgba(201,168,76,0.4)",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
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

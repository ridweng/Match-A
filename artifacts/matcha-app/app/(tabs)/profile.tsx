import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { OverlaySelectField } from "@/components/OverlaySelectField";
import { SpokenLanguagesPickerField } from "@/components/SpokenLanguagesPickerField";
import { useBottomObstruction } from "@/components/useBottomObstruction";
import Colors from "@/constants/colors";
import {
  ALCOHOL_USE_OPTIONS,
  BODY_TYPES,
  CHILDREN_PREFERENCES,
  EDUCATION_LEVELS,
  ETHNICITIES,
  getAlcoholUseLabel,
  getBodyTypeLabel,
  getChildrenPreferenceLabel,
  getEducationLabel,
  getEthnicityLabel,
  getHairColorLabel,
  getPhysicalActivityLabel,
  getPoliticalInterestLabel,
  getPronounLabel,
  getReligionImportanceLabel,
  getReligionLabel,
  getRelationshipGoalLabel,
  getTobaccoUseLabel,
  HAIR_COLORS,
  INTERESTS_LIST,
  MAX_PROFILE_PHOTOS,
  normalizeAlcoholUse,
  normalizeBodyType,
  normalizeChildrenPreference,
  normalizeEducation,
  normalizeEthnicity,
  normalizeHairColor,
  normalizePhysicalActivity,
  normalizePoliticalInterest,
  normalizeReligion,
  normalizeReligionImportance,
  normalizeRelationshipGoal,
  normalizeTobaccoUse,
  PHYSICAL_ACTIVITY_OPTIONS,
  POLITICAL_INTEREST_OPTIONS,
  RELIGION_IMPORTANCE_OPTIONS,
  RELIGION_OPTIONS,
  RELATIONSHIP_GOALS,
  TOBACCO_USE_OPTIONS,
} from "@/constants/profile-options";
import { useApp, type UserProfile } from "@/context/AppContext";
import {
  getAgeFromIsoDate,
  getZodiacSignFromIsoDate,
  getZodiacSignLabel,
} from "@/utils/dateOfBirth";
import {
  deleteStoredProfilePhoto,
  getProfilePhotoBySortOrder,
  getProfilePhotoDisplayUri,
  isStoredProfilePhoto,
  saveProfilePhotoLocally,
} from "@/utils/profilePhotos";
import type { ProfileEditableField } from "@/context/AppContext";
import { debugLog } from "@/utils/debug";

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

type ProfileSaveStatus = "idle" | "saving" | "saved" | "error";

function SaveFeedbackText({
  status,
  t,
}: {
  status: ProfileSaveStatus;
  t: (es: string, en: string) => string;
}) {
  if (status === "idle") {
    return null;
  }

  return (
    <Text
      style={[
        styles.saveStateText,
        status === "saved" && styles.saveStateTextSaved,
        status === "error" && styles.saveStateTextError,
      ]}
    >
      {status === "saving"
        ? t("Guardando cambios...", "Saving changes...")
        : status === "saved"
          ? t("Cambios guardados", "Changes saved")
          : t("No se pudo guardar. Intenta otra vez.", "Could not save. Try again.")}
    </Text>
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
    isOnline,
    language,
    removeProfilePhoto,
    saveProfileChanges,
    setProfilePhoto,
    user,
  } = useApp();

  const placeholder = t("Ninguno", "None");
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 16);
  const {
    restingBottomInset: profileRestingBottomInset,
  } = useBottomObstruction({
    safeAreaBottomInset: insets.bottom,
    restingBottomSpacing: Platform.OS === "web" ? 34 : 100,
  });
  const calculatedAge = getAgeFromIsoDate(accountProfile.dateOfBirth);
  const zodiacLabel = getZodiacSignLabel(
    getZodiacSignFromIsoDate(accountProfile.dateOfBirth),
    t
  );
  const ageLabel = calculatedAge
    ? t(`${calculatedAge} años`, `${calculatedAge} years`)
    : placeholder;
  const pronounLabel = getPronounLabel(accountProfile.pronouns, language);
  const ageWithSign = [ageLabel, zodiacLabel].filter(Boolean).join(" · ") || placeholder;
  const heroMetaParts = [accountProfile.location?.trim(), accountProfile.profession?.trim()].filter(
    Boolean
  ) as string[];
  const heroMetaIcon = accountProfile.location?.trim() ? "map-pin" : "briefcase";
  const previewInterests = accountProfile.interests.slice(0, 3);
  const heightUnitLabel = heightUnit === "imperial" ? "in" : "cm";
  const heightMax = getHeightLimit(heightUnit);
  const [draftProfile, setDraftProfile] = React.useState(accountProfile);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<ProfileSaveStatus>("idle");
  const [loadingImageKeys, setLoadingImageKeys] = React.useState<Record<string, boolean>>(
    {}
  );
  const isOffline = !isOnline;
  const heightOutOfRange = isHeightOutOfRange(draftProfile.height, heightUnit);
  const heightPlaceholder =
    heightUnit === "imperial"
      ? t("Tu altura en pulgadas", "Your height in inches")
      : t("Tu altura en cm", "Your height in cm");
  const showValue = (value: string | string[]) => {
    if (Array.isArray(value)) {
      return value.length ? value.join(", ") : placeholder;
    }
    return value?.trim() ? value : placeholder;
  };

  React.useEffect(() => {
    if (!hasUnsavedChanges) {
      setDraftProfile(accountProfile);
    }
  }, [accountProfile, hasUnsavedChanges]);

  const savePickedPhoto = async (index: number, sourceUri: string) => {
    if (!sourceUri) {
      return;
    }

    const targetUri = await saveProfilePhotoLocally(
      index,
      sourceUri,
      user?.id ?? "anonymous"
    );
    const previousPhoto = getProfilePhotoBySortOrder(accountProfile.photos, index);
    const nextPhoto = await setProfilePhoto(index, targetUri);
    if (nextPhoto?.status === "error") {
      Alert.alert(
        t("No se pudo subir la foto", "Couldn't upload photo"),
        t(
          "La foto quedó como pendiente con error. Puedes volver a intentarlo o eliminarla.",
          "The photo stayed in an error state. You can retry or remove it."
        )
      );
    }
    if (
      nextPhoto?.status !== "error" &&
      previousPhoto?.localUri &&
      previousPhoto.localUri !== targetUri &&
      isStoredProfilePhoto(previousPhoto.localUri)
    ) {
      deleteStoredProfilePhoto(previousPhoto.localUri).catch(() => {});
    }
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

    await savePickedPhoto(index, result.assets[0].uri);
  };

  const requestAndCapturePhoto = async (index: number) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        t("Permiso requerido", "Permission required"),
        t(
          "Permite acceso a la cámara para tomar una foto.",
          "Allow camera access to take a photo."
        )
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.85,
      aspect: [4, 5],
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return;
    }

    await savePickedPhoto(index, result.assets[0].uri);
  };

  const openMainPhotoPicker = (index: number) => {
    const currentPhoto = getProfilePhotoBySortOrder(accountProfile.photos, index);
    Alert.alert(
      index === 0 ? t("Foto principal", "Main photo") : t("Editar foto", "Edit photo"),
      t(
        "Elige si quieres usar una foto de tu galería o tomar una nueva.",
        "Choose whether to use a photo from your library or take a new one."
      ),
      [
        {
          text: t("Cancelar", "Cancel"),
          style: "cancel",
        },
        {
          text: t("Fotos", "Library"),
          onPress: () => {
            requestAndPickPhoto(index).catch(() => {});
          },
        },
        {
          text: t("Cámara", "Camera"),
          onPress: () => {
            requestAndCapturePhoto(index).catch(() => {});
          },
        },
        ...(currentPhoto
          ? [
              {
                text: t("Eliminar", "Remove"),
                style: "destructive" as const,
                onPress: () => {
                  if (isStoredProfilePhoto(currentPhoto.localUri)) {
                    deleteStoredProfilePhoto(currentPhoto.localUri).catch(() => {});
                  }
                  removeProfilePhoto(index).catch(() => {});
                },
              },
            ]
          : []),
      ]
    );
  };

  const handlePhotoPress = (index: number) => {
    const currentPhoto = getProfilePhotoBySortOrder(accountProfile.photos, index);
    if (!currentPhoto) {
      openMainPhotoPicker(index);
      return;
    }
    openMainPhotoPicker(index);
  };

  const update = <K extends ProfileEditableField>(key: K, value: UserProfile[K]) => {
    setDraftProfile((current) => ({
      ...current,
      [key]: value,
    }));
    setHasUnsavedChanges(true);
    if (saveStatus !== "idle") {
      setSaveStatus("idle");
    }
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
    const next = draftProfile.interests.includes(interest)
      ? draftProfile.interests.filter((item) => item !== interest)
      : [...draftProfile.interests, interest];
    update("interests", next);
  };

  const mainPhoto = getProfilePhotoDisplayUri(
    getProfilePhotoBySortOrder(accountProfile.photos, 0)
  );
  const mainPhotoKey = mainPhoto ? `main:${mainPhoto}` : "main:empty";

  const setImageLoading = React.useCallback((key: string, isLoading: boolean) => {
    setLoadingImageKeys((current) => {
      if (!isLoading && !current[key]) {
        return current;
      }
      return {
        ...current,
        [key]: isLoading,
      };
    });
  }, []);

  const handleSave = async () => {
    if (isOffline) {
      setSaveStatus("error");
      return;
    }
    if (!hasUnsavedChanges) {
      setSaveStatus("saved");
      return;
    }

    setSaveStatus("saving");
    const patch: Partial<Omit<UserProfile, "age" | "photos">> = {
      bio: draftProfile.bio,
      relationshipGoals: normalizeRelationshipGoal(draftProfile.relationshipGoals),
      education: normalizeEducation(draftProfile.education),
      childrenPreference: normalizeChildrenPreference(draftProfile.childrenPreference),
      languagesSpoken: draftProfile.languagesSpoken,
      physicalActivity: normalizePhysicalActivity(draftProfile.physicalActivity),
      alcoholUse: normalizeAlcoholUse(draftProfile.alcoholUse),
      tobaccoUse: normalizeTobaccoUse(draftProfile.tobaccoUse),
      politicalInterest: normalizePoliticalInterest(draftProfile.politicalInterest),
      religionImportance: normalizeReligionImportance(draftProfile.religionImportance),
      religion: normalizeReligion(draftProfile.religion),
      bodyType: normalizeBodyType(draftProfile.bodyType),
      height: validateHeightValue(draftProfile.height, heightUnit),
      hairColor: normalizeHairColor(draftProfile.hairColor),
      ethnicity: normalizeEthnicity(draftProfile.ethnicity),
      interests: draftProfile.interests,
    };

    debugLog("[profile-save] tapped", {
      fields: Object.keys(patch),
    });
    const ok = await saveProfileChanges(patch);
    setSaveStatus(ok ? "saved" : "error");
    if (ok) {
      setHasUnsavedChanges(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topPad,
            paddingBottom: profileRestingBottomInset,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={profileRestingBottomInset}
        extraKeyboardSpace={28}
        keyboardDismissMode="none"
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

        {isOffline ? (
          <View style={styles.offlineBanner}>
            <Feather name="wifi-off" size={14} color={Colors.info} />
            <Text style={styles.offlineBannerText}>
              {t(
                "Sin conexión. Puedes revisar tu perfil, pero guardar cambios está desactivado.",
                "You are offline. You can review your profile, but saving changes is disabled."
              )}
            </Text>
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <Pressable
            onPress={() => handlePhotoPress(0)}
            style={styles.mainPhotoWrap}
          >
            {mainPhoto ? (
              <>
                <Image
                  source={{ uri: mainPhoto }}
                  style={styles.mainPhoto}
                  onLoadStart={() => setImageLoading(mainPhotoKey, true)}
                  onLoadEnd={() => setImageLoading(mainPhotoKey, false)}
                  onError={() => setImageLoading(mainPhotoKey, false)}
                />
                {loadingImageKeys[mainPhotoKey] ? (
                  <View style={styles.photoLoadingOverlay}>
                    <ActivityIndicator color={Colors.primaryLight} />
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.mainPhotoPlaceholder}>
                <Feather name="user" size={68} color={Colors.textMuted} />
              </View>
            )}
          </Pressable>

          <View style={styles.heroContent}>
            {pronounLabel ? (
              <Text style={styles.heroPronounText}>{pronounLabel}</Text>
            ) : null}
            <Text style={styles.nameText}>{showValue(accountProfile.name)}</Text>
            <Text style={styles.heroAgeText}>{ageWithSign}</Text>
            {heroMetaParts.length ? (
              <View style={styles.heroMetaRow}>
                <Feather
                  name={heroMetaIcon}
                  size={13}
                  color={Colors.primaryLight}
                />
                <Text style={styles.heroMetaText}>{heroMetaParts.join(" · ")}</Text>
              </View>
            ) : null}
            {previewInterests.length ? (
              <View style={styles.heroInterestsRow}>
                {previewInterests.map((interest) => (
                  <View key={interest} style={styles.heroInterestChip}>
                    <Text style={styles.heroInterestChipText}>{interest}</Text>
                  </View>
                ))}
              </View>
            ) : null}
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
              const photo = getProfilePhotoBySortOrder(accountProfile.photos, index);
              const photoUri = getProfilePhotoDisplayUri(photo);
              const photoKey = photoUri ? `slot:${index}:${photoUri}` : `slot:${index}:empty`;
              const isMain = index === 0;
              return (
                <Pressable
                  key={index}
                  onPress={() => handlePhotoPress(index)}
                  style={[styles.photoSlot, isMain && styles.photoSlotMain]}
                >
                  {photoUri ? (
                    <>
                      <Image
                        source={{ uri: photoUri }}
                        style={styles.photoSlotImage}
                        onLoadStart={() => setImageLoading(photoKey, true)}
                        onLoadEnd={() => setImageLoading(photoKey, false)}
                        onError={() => setImageLoading(photoKey, false)}
                      />
                      {loadingImageKeys[photoKey] ? (
                        <View style={styles.photoLoadingOverlay}>
                          <ActivityIndicator color={Colors.primaryLight} size="small" />
                        </View>
                      ) : null}
                    </>
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
                  {photo?.status === "pending" ? (
                    <View style={styles.photoStateBadge}>
                      <Text style={styles.photoStateBadgeText}>
                        {t("Subiendo", "Uploading")}
                      </Text>
                    </View>
                  ) : null}
                  {photo?.status === "error" ? (
                    <View style={[styles.photoStateBadge, styles.photoStateBadgeError]}>
                      <Text style={styles.photoStateBadgeText}>
                        {t("Error", "Error")}
                      </Text>
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
                value={draftProfile.bio}
                onChangeText={(value) => update("bio", value)}
                placeholder={t("Cuéntanos algo sobre ti...", "Tell us something about you...")}
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={5}
                scrollEnabled
                textAlignVertical="top"
              />
            </View>
            <OverlaySelectField
              label={t("Metas de tu relación", "Your relationship goals")}
              value={normalizeRelationshipGoal(draftProfile.relationshipGoals)}
              options={RELATIONSHIP_GOALS}
              onChange={(value) => update("relationshipGoals", value)}
              getOptionLabel={(value) => getRelationshipGoalLabel(value, t)}
              placeholder={t("Selecciona una opción", "Select an option")}
            />
            <OverlaySelectField
              label={t("Educación", "Education")}
              value={normalizeEducation(draftProfile.education)}
              options={EDUCATION_LEVELS}
              onChange={(value) => update("education", value)}
              getOptionLabel={(value) => getEducationLabel(value, t)}
              placeholder={t("Selecciona una opción", "Select an option")}
            />
            <OverlaySelectField
              label={t("Quiero tener hijxs", "Having children")}
              value={normalizeChildrenPreference(draftProfile.childrenPreference)}
              options={CHILDREN_PREFERENCES}
              onChange={(value) => update("childrenPreference", value)}
              getOptionLabel={(value) => getChildrenPreferenceLabel(value, t)}
              placeholder={t("Selecciona una opción", "Select an option")}
            />
            <SpokenLanguagesPickerField
              style={styles.editField}
              label={t("Idiomas que hablo", "Languages I speak")}
              values={draftProfile.languagesSpoken}
              onChange={(values) => update("languagesSpoken", values)}
              language={language}
              t={t}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("Estilo de vida", "Life Style")}</Text>
          <View style={styles.card}>
            <OverlaySelectField
              label={t("Actividad física", "Physical activity")}
              value={normalizePhysicalActivity(draftProfile.physicalActivity)}
              options={PHYSICAL_ACTIVITY_OPTIONS}
              onChange={(value) => update("physicalActivity", value)}
              getOptionLabel={(value) => getPhysicalActivityLabel(value, t)}
              placeholder={t("Selecciona una opción", "Select an option")}
            />
            <OverlaySelectField
              label={t("Bebida", "Drink")}
              value={normalizeAlcoholUse(draftProfile.alcoholUse)}
              options={ALCOHOL_USE_OPTIONS}
              onChange={(value) => update("alcoholUse", value)}
              getOptionLabel={(value) => getAlcoholUseLabel(value, t)}
              placeholder={t("Selecciona una opción", "Select an option")}
            />
            <OverlaySelectField
              label={t("Tabaco", "Smoke")}
              value={normalizeTobaccoUse(draftProfile.tobaccoUse)}
              options={TOBACCO_USE_OPTIONS}
              onChange={(value) => update("tobaccoUse", value)}
              getOptionLabel={(value) => getTobaccoUseLabel(value, t)}
              placeholder={t("Selecciona una opción", "Select an option")}
            />
            <OverlaySelectField
              label={t("Interés en la política", "Interest in politics")}
              value={normalizePoliticalInterest(draftProfile.politicalInterest)}
              options={POLITICAL_INTEREST_OPTIONS}
              onChange={(value) => update("politicalInterest", value)}
              getOptionLabel={(value) => getPoliticalInterestLabel(value, t)}
              placeholder={t("Selecciona una opción", "Select an option")}
            />
            <OverlaySelectField
              label={t(
                "Importancia de la religión en tu vida",
                "Importance of religion in your life"
              )}
              value={normalizeReligionImportance(draftProfile.religionImportance)}
              options={RELIGION_IMPORTANCE_OPTIONS}
              onChange={(value) => update("religionImportance", value)}
              getOptionLabel={(value) => getReligionImportanceLabel(value, t)}
              placeholder={t("Selecciona una opción", "Select an option")}
            />
            <OverlaySelectField
              label={t("Religión", "Religion")}
              value={normalizeReligion(draftProfile.religion)}
              options={RELIGION_OPTIONS}
              onChange={(value) => update("religion", value)}
              getOptionLabel={(value) => getReligionLabel(value, t)}
              placeholder={t("Selecciona una opción", "Select an option")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t("Atributos físicos", "Physical attributes")}
          </Text>
          <View style={styles.card}>
            <OverlaySelectField
              label={t("Tipo de cuerpo", "Body type")}
              value={normalizeBodyType(draftProfile.bodyType)}
              options={BODY_TYPES}
              onChange={(value) => update("bodyType", value)}
              getOptionLabel={(value) => getBodyTypeLabel(value, t)}
              placeholder={t("Selecciona una opción", "Select an option")}
            />
            <View style={styles.editField}>
              <Text style={styles.editLabel}>{t("Altura", "Height")}</Text>
              <View style={styles.heightRow}>
                <TextInput
                  style={[styles.editInput, styles.heightInput]}
                  value={normalizeHeightInput(draftProfile.height)}
                  onChangeText={updateHeight}
                  onBlur={() => update("height", validateHeightValue(draftProfile.height, heightUnit))}
                  onEndEditing={() =>
                    update("height", validateHeightValue(draftProfile.height, heightUnit))
                  }
                  placeholder={heightPlaceholder}
                  placeholderTextColor={Colors.textMuted}
                  keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                  returnKeyType="done"
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
            <OverlaySelectField
              label={t("Color de cabello", "Hair color")}
              value={normalizeHairColor(draftProfile.hairColor)}
              options={HAIR_COLORS}
              onChange={(value) => update("hairColor", value)}
              getOptionLabel={(value) => getHairColorLabel(value, t)}
              placeholder={t("Selecciona una opción", "Select an option")}
            />
            <OverlaySelectField
              label={t("Etnia", "Ethnicity")}
              value={normalizeEthnicity(draftProfile.ethnicity)}
              options={ETHNICITIES}
              onChange={(value) => update("ethnicity", value)}
              getOptionLabel={(value) => getEthnicityLabel(value, t)}
              placeholder={t("Selecciona una opción", "Select an option")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("Intereses", "Interests")}</Text>
          <View style={styles.card}>
            <View style={styles.interestsWrap}>
              {INTERESTS_LIST.map((interest) => {
                const selected = draftProfile.interests.includes(interest);
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

        <View style={styles.section}>
          <Pressable
            onPress={() => {
              void handleSave();
            }}
            disabled={!hasUnsavedChanges || saveStatus === "saving" || isOffline}
            style={({ pressed }) => [
              styles.saveButton,
              (!hasUnsavedChanges || saveStatus === "saving" || isOffline) &&
                styles.saveButtonDisabled,
              pressed &&
                hasUnsavedChanges &&
                saveStatus !== "saving" &&
                !isOffline &&
                styles.saveButtonPressed,
            ]}
          >
            {saveStatus === "saving" ? (
              <ActivityIndicator color={Colors.textInverted} size="small" />
            ) : (
              <Text style={styles.saveButtonText}>
                {t("Guardar cambios", "Save changes")}
              </Text>
            )}
          </Pressable>
          <SaveFeedbackText status={saveStatus} t={t} />
        </View>

      </KeyboardAwareScrollViewCompat>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(111,168,255,0.22)",
    backgroundColor: "rgba(111,168,255,0.08)",
  },
  offlineBannerText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
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
    alignItems: "stretch",
  },
  mainPhotoWrap: {
    width: 126,
    height: 126,
    borderRadius: 63,
    overflow: "hidden",
    marginBottom: 16,
    alignSelf: "center",
  },
  mainPhoto: {
    width: "100%",
    height: "100%",
    borderRadius: 63,
  },
  mainPhotoPlaceholder: {
    flex: 1,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  heroContent: {
    width: "100%",
    alignItems: "flex-start",
  },
  heroPronounText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "left",
  },
  nameText: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.text,
    textAlign: "left",
  },
  heroAgeText: {
    marginTop: 4,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.primaryLight,
    textAlign: "left",
  },
  heroMetaRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "flex-start",
  },
  heroMetaText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "left",
  },
  heroInterestsRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  heroInterestChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(82,183,136,0.2)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.35)",
  },
  heroInterestChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.primaryLight,
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
  saveStateText: {
    marginTop: 8,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textMuted,
  },
  saveStateTextSaved: {
    color: Colors.primaryLight,
  },
  saveStateTextError: {
    color: Colors.error,
  },
  saveButton: {
    minHeight: 54,
    minWidth: 188,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 18,
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonPressed: {
    opacity: 0.88,
  },
  saveButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.textInverted,
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
  photoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,26,20,0.28)",
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
    borderColor: Colors.border,
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
  photoStateBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(15,26,20,0.76)",
  },
  photoStateBadgeError: {
    backgroundColor: "rgba(194,65,76,0.92)",
  },
  photoStateBadgeText: {
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
  editFieldOpen: {
    zIndex: 60,
  },
  editLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(82,183,136,0.12)",
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  languageChipFlag: {
    fontSize: 14,
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
    position: "absolute",
    top: 58,
    left: 0,
    right: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundElevated,
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
    flexGrow: 1,
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

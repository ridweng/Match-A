import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import Colors from "@/constants/colors";
import {
  BODY_TYPES,
  CHILDREN_PREFERENCES,
  EDUCATION_LEVELS,
  ENGLISH_PRONOUNS,
  GENDER_IDENTITIES,
  getBodyTypeLabel,
  getChildrenPreferenceLabel,
  getDefaultSpokenLanguageValue,
  getEducationLabel,
  getGenderIdentityLabel,
  getPersonalityLabel,
  getPhysicalActivityLabel,
  getPronounLabel,
  getRelationshipGoalLabel,
  getSpokenLanguageFlag,
  getSpokenLanguageLabel,
  matchesSpokenLanguageSearch,
  normalizeBodyType,
  normalizeChildrenPreference,
  normalizeEducation,
  normalizeGenderIdentity,
  normalizePersonality,
  normalizePhysicalActivity,
  normalizePronouns,
  normalizeRelationshipGoal,
  normalizeSpokenLanguages,
  PERSONALITY_TRAITS,
  PHYSICAL_ACTIVITY_OPTIONS,
  RELATIONSHIP_GOALS,
  SPOKEN_LANGUAGES,
  SPANISH_PRONOUNS,
} from "@/constants/profile-options";
import { useApp } from "@/context/AppContext";
import {
  deleteStoredProfilePhoto,
  isStoredProfilePhoto,
  saveProfilePhotoLocally,
} from "@/utils/profilePhotos";

const TOTAL_STEPS = 3;
const MAX_SPOKEN_LANGUAGES = 7;

function ProgressBar({
  currentStep,
  t,
}: {
  currentStep: number;
  t: (es: string, en: string) => string;
}) {
  return (
    <View style={styles.progressBlock}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>
          {t("Paso", "Step")} {currentStep}/{TOTAL_STEPS}
        </Text>
        <Text style={styles.progressSubtle}>
          {t("Conozcámonos mejor", "Let’s get to know each other")}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        {Array.from({ length: TOTAL_STEPS }).map((_, index) => {
          const active = index + 1 <= currentStep;
          return (
            <View
              key={index}
              style={[
                styles.progressSegment,
                active && styles.progressSegmentActive,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  getOptionLabel,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder: string;
  getOptionLabel: (value: string) => string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={[styles.field, open && styles.fieldOpen]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.selectWrap, open && styles.selectWrapOpen]}>
        <Pressable
          onPress={() => setOpen((current) => !current)}
          style={styles.selectField}
        >
          <Text style={[styles.selectValue, !value && styles.placeholderText]}>
            {value ? getOptionLabel(value) : placeholder}
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
                style={[
                  styles.dropdownOption,
                  value === option && styles.dropdownOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.dropdownOptionText,
                    value === option && styles.dropdownOptionTextActive,
                  ]}
                >
                  {getOptionLabel(option)}
                </Text>
                {value === option ? (
                  <Feather name="check" size={14} color={Colors.primaryLight} />
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const {
    accountProfile,
    authBusy,
    authError,
    authStatus,
    finishOnboarding,
    hasCompletedOnboarding,
    language,
    needsProfileCompletion,
    saveOnboardingDraft,
    t,
  } = useApp();

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [step, setStep] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [languagesModalOpen, setLanguagesModalOpen] = useState(false);
  const [languageSearch, setLanguageSearch] = useState("");
  const [genderIdentity, setGenderIdentity] = useState(
    normalizeGenderIdentity(accountProfile.genderIdentity)
  );
  const [pronouns, setPronouns] = useState(normalizePronouns(accountProfile.pronouns));
  const [photos, setPhotos] = useState<string[]>(accountProfile.photos || []);
  const [relationshipGoals, setRelationshipGoals] = useState(
    normalizeRelationshipGoal(accountProfile.relationshipGoals)
  );
  const [childrenPreference, setChildrenPreference] = useState(
    normalizeChildrenPreference(accountProfile.childrenPreference)
  );
  const [languagesSpoken, setLanguagesSpoken] = useState<string[]>(
    (() => {
      const normalized = normalizeSpokenLanguages(accountProfile.languagesSpoken);
      return normalized.length
        ? normalized
        : [getDefaultSpokenLanguageValue(language)];
    })()
  );
  const [draftLanguages, setDraftLanguages] = useState<string[]>(languagesSpoken);
  const [education, setEducation] = useState(
    normalizeEducation(accountProfile.education)
  );
  const [physicalActivity, setPhysicalActivity] = useState(
    normalizePhysicalActivity(accountProfile.physicalActivity)
  );
  const [bodyType, setBodyType] = useState(normalizeBodyType(accountProfile.bodyType));
  const [personality, setPersonality] = useState(
    normalizePersonality(accountProfile.personality)
  );

  React.useEffect(() => {
    if (authStatus !== "authenticated") {
      router.replace("/login");
      return;
    }
    if (needsProfileCompletion) {
      router.replace("/complete-profile");
      return;
    }
    if (hasCompletedOnboarding) {
      router.replace("/(tabs)/discover");
    }
  }, [authStatus, hasCompletedOnboarding, needsProfileCompletion]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 16);
  const bottomPad = insets.bottom + 24;
  const mainPhoto = photos[0] || "";
  const pronounOptions = language === "es" ? SPANISH_PRONOUNS : ENGLISH_PRONOUNS;
  const selectedLanguageOptions = useMemo(
    () =>
      languagesSpoken
        .map((value) => SPOKEN_LANGUAGES.find((item) => item.value === value))
        .filter((item): item is (typeof SPOKEN_LANGUAGES)[number] => Boolean(item)),
    [languagesSpoken]
  );
  const selectedDraftLanguageOptions = useMemo(
    () =>
      draftLanguages
        .map((value) => SPOKEN_LANGUAGES.find((item) => item.value === value))
        .filter((item): item is (typeof SPOKEN_LANGUAGES)[number] => Boolean(item)),
    [draftLanguages]
  );
  const filteredLanguages = useMemo(() => {
    return SPOKEN_LANGUAGES.filter((item) => {
      if (draftLanguages.includes(item.value)) {
        return false;
      }
      return matchesSpokenLanguageSearch(item.value, languageSearch);
    });
  }, [draftLanguages, languageSearch]);

  const isFormComplete =
    Boolean(genderIdentity) &&
    Boolean(pronouns) &&
    Boolean(mainPhoto) &&
    Boolean(relationshipGoals) &&
    Boolean(childrenPreference) &&
    languagesSpoken.length > 0 &&
    Boolean(education) &&
    Boolean(physicalActivity) &&
    Boolean(bodyType) &&
    Boolean(personality);

  const animateToStep = (nextStep: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 190,
        useNativeDriver: true,
      }),
    ]).start();
    setStep(nextStep);
  };

  const savePickedPhoto = async (sourceUri: string) => {
    const targetUri = await saveProfilePhotoLocally(0, sourceUri);
    const previous = photos[0];
    if (previous && previous !== targetUri && isStoredProfilePhoto(previous)) {
      deleteStoredProfilePhoto(previous).catch(() => {});
    }
    setPhotos((current) => {
      const next = [...current];
      next[0] = targetUri;
      return next.filter(Boolean);
    });
  };

  const requestAndPickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        t("Permiso requerido", "Permission required"),
        t(
          "Permite acceso a tus fotos para continuar.",
          "Allow photo access to continue."
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

    if (!result.canceled && result.assets?.[0]?.uri) {
      await savePickedPhoto(result.assets[0].uri);
    }
  };

  const requestAndCapturePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        t("Permiso requerido", "Permission required"),
        t(
          "Permite acceso a la cámara para continuar.",
          "Allow camera access to continue."
        )
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.85,
      aspect: [4, 5],
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      await savePickedPhoto(result.assets[0].uri);
    }
  };

  const openPhotoPicker = () => {
    Alert.alert(
      t("Tu foto", "Your photo"),
      t(
        "Elige una foto de tu galería o toma una nueva.",
        "Choose a photo from your library or take a new one."
      ),
      [
        {
          text: t("Cancelar", "Cancel"),
          style: "cancel",
        },
        {
          text: t("Fotos", "Library"),
          onPress: () => {
            requestAndPickPhoto().catch(() => {});
          },
        },
        {
          text: t("Cámara", "Camera"),
          onPress: () => {
            requestAndCapturePhoto().catch(() => {});
          },
        },
      ]
    );
  };

  const openLanguagesModal = () => {
    setDraftLanguages(languagesSpoken);
    setLanguageSearch("");
    setLanguagesModalOpen(true);
  };

  const closeLanguagesModal = () => {
    setLanguagesModalOpen(false);
    setLanguageSearch("");
  };

  const acceptLanguages = () => {
    setLanguagesSpoken(draftLanguages);
    closeLanguagesModal();
  };

  const toggleLanguage = (value: string) => {
    setDraftLanguages((current) => {
      if (current.includes(value)) {
        return current.filter((item) => item !== value);
      }
      if (current.length >= MAX_SPOKEN_LANGUAGES) {
        return current;
      }
      return [...current, value];
    });
  };

  const handleContinueFromIntro = () => {
    Haptics.selectionAsync().catch(() => {});
    animateToStep(2);
  };

  const handleContinueFromForm = async () => {
    if (!isFormComplete) {
      setFormError(
        t(
          "Completa todos los campos antes de continuar.",
          "Complete all fields before continuing."
        )
      );
      return;
    }

    setFormError(null);
    const ok = await saveOnboardingDraft({
      genderIdentity,
      pronouns,
      personality,
      relationshipGoals,
      childrenPreference,
      languagesSpoken,
      education,
      physicalActivity,
      bodyType,
      photos,
    });
    if (!ok) {
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    animateToStep(3);
  };

  const handleFinish = async () => {
    setFormError(null);
    const ok = await finishOnboarding();
    if (!ok) {
      return;
    }
    router.replace("/(tabs)/discover");
  };

  const renderIntro = () => (
    <View style={styles.stepCard}>
      <View style={styles.heroBadge}>
        <Feather name="star" size={18} color={Colors.primaryLight} />
      </View>
      <Text style={styles.title}>{t("Bienvenido a Matcha.", "Welcome to Matcha.")}</Text>
      <Text style={styles.body}>
        {t(
          "Queremos acompañarte en el camino de sacar tu mejor versión.",
          "We want to support you on the journey to becoming your best version."
        )}
      </Text>
      <Text style={styles.body}>
        {t(
          "Aquí encontrarás consejos, tareas y recompensas que te ayudarán a liberar tu máximo potencial personal y de seducción.",
          "Here you’ll find guidance, tasks, and rewards designed to help you unlock your full personal and attraction potential."
        )}
      </Text>
      <Text style={styles.bodyStrong}>
        {t(
          "Para desbloquear estos retos necesitamos conocerte:",
          "To unlock these challenges, we first need to get to know you."
        )}
      </Text>
      <Pressable
        onPress={handleContinueFromIntro}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && { opacity: 0.9 },
        ]}
      >
        <Text style={styles.primaryButtonText}>{t("Comenzar", "Start")}</Text>
        <Feather name="arrow-right" size={18} color={Colors.textInverted} />
      </Pressable>
    </View>
  );

  const renderForm = () => (
    <View style={styles.formWrap}>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionEyebrow}>
          {t("Cuéntanos sobre ti", "Tell us about yourself")}
        </Text>
        <Text style={styles.sectionCopy}>
          {t(
            "Queremos mostrar tu mejor versión desde el inicio.",
            "We want to show your best version from the very beginning."
          )}
        </Text>

        <SelectField
          label={t("Cómo te identificas", "How do you identify")}
          value={genderIdentity}
          options={GENDER_IDENTITIES}
          onChange={(value) => setGenderIdentity(normalizeGenderIdentity(value))}
          placeholder={t("Selecciona una opción", "Select an option")}
          getOptionLabel={(value) => getGenderIdentityLabel(value, t)}
        />

        <SelectField
          label={t("Pronombres", "Pronouns")}
          value={pronouns}
          options={pronounOptions}
          onChange={(value) => setPronouns(normalizePronouns(value))}
          placeholder={t("Selecciona tus pronombres", "Select your pronouns")}
          getOptionLabel={(value) => getPronounLabel(value, language)}
        />

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            {t("Añade una foto", "Add a photo")}
          </Text>
          <Pressable
            onPress={openPhotoPicker}
            style={({ pressed }) => [
              styles.photoCard,
              pressed && { opacity: 0.9 },
              !mainPhoto && styles.photoCardEmpty,
            ]}
          >
            {mainPhoto ? (
              <Image source={{ uri: mainPhoto }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Feather name="camera" size={26} color={Colors.primaryLight} />
                <Text style={styles.photoPlaceholderTitle}>
                  {t("Muéstranos cómo te ves", "Show us how you look")}
                </Text>
                <Text style={styles.photoPlaceholderSub}>
                  {t("Necesitamos al menos una foto", "We need at least one photo")}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        <SelectField
          label={t("Qué estás buscando", "What are you looking for")}
          value={relationshipGoals}
          options={RELATIONSHIP_GOALS}
          onChange={(value) => setRelationshipGoals(normalizeRelationshipGoal(value))}
          placeholder={t("Selecciona una opción", "Select an option")}
          getOptionLabel={(value) => getRelationshipGoalLabel(value, t)}
        />

        <SelectField
          label={t("Quieres tener hijxs", "Do you want kids")}
          value={childrenPreference}
          options={CHILDREN_PREFERENCES}
          onChange={(value) => setChildrenPreference(normalizeChildrenPreference(value))}
          placeholder={t("Selecciona una opción", "Select an option")}
          getOptionLabel={(value) => getChildrenPreferenceLabel(value, t)}
        />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionEyebrow}>
          {t("Cómo ha sido tu vida", "How has your life been")}
        </Text>
        <Text style={styles.sectionCopy}>
          {t(
            "Esto nos ayuda a proponerte retos más útiles para ti.",
            "This helps us suggest challenges that fit you better."
          )}
        </Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t("Idiomas", "Languages")}</Text>
          <Pressable
            onPress={openLanguagesModal}
            style={styles.languagePickerButton}
          >
            <Text
              style={[
                styles.selectValue,
                !selectedLanguageOptions.length && styles.placeholderText,
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
            <View style={styles.languageChipRow}>
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
        </View>

        <SelectField
          label={t("Educación", "Education")}
          value={education}
          options={EDUCATION_LEVELS}
          onChange={(value) => setEducation(normalizeEducation(value))}
          placeholder={t("Selecciona una opción", "Select an option")}
          getOptionLabel={(value) => getEducationLabel(value, t)}
        />

        <SelectField
          label={t("Con qué frecuencia entrenas", "How often do you train")}
          value={physicalActivity}
          options={PHYSICAL_ACTIVITY_OPTIONS}
          onChange={(value) => setPhysicalActivity(normalizePhysicalActivity(value))}
          placeholder={t("Selecciona una opción", "Select an option")}
          getOptionLabel={(value) => getPhysicalActivityLabel(value, t)}
        />

        <SelectField
          label={t("Tipo de cuerpo", "Body type")}
          value={bodyType}
          options={BODY_TYPES}
          onChange={(value) => setBodyType(normalizeBodyType(value))}
          placeholder={t("Selecciona una opción", "Select an option")}
          getOptionLabel={(value) => getBodyTypeLabel(value, t)}
        />

        <SelectField
          label={t("Personalidad", "Personality")}
          value={personality}
          options={PERSONALITY_TRAITS}
          onChange={(value) => setPersonality(normalizePersonality(value))}
          placeholder={t("Selecciona una opción", "Select an option")}
          getOptionLabel={(value) => getPersonalityLabel(value, t)}
        />
      </View>

      {formError || authError ? (
        <Text style={styles.inlineError}>{formError || authError}</Text>
      ) : (
        <Text style={styles.inlineHint}>
          {t(
            "Completa todos los campos para continuar.",
            "Complete every field to continue."
          )}
        </Text>
      )}

      <Pressable
        onPress={handleContinueFromForm}
        disabled={!isFormComplete || authBusy}
        style={({ pressed }) => [
          styles.primaryButton,
          (!isFormComplete || authBusy) && styles.primaryButtonDisabled,
          pressed && isFormComplete && !authBusy && { opacity: 0.92 },
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {t("Continuar", "Continue")}
        </Text>
        <Feather name="arrow-right" size={18} color={Colors.textInverted} />
      </Pressable>
    </View>
  );

  const renderCompletion = () => (
    <View style={styles.stepCard}>
      <View style={[styles.heroBadge, styles.heroBadgeSuccess]}>
        <Feather name="sunrise" size={18} color={Colors.primaryLight} />
      </View>
      <Text style={styles.title}>
        {t("Ya estás listx para empezar.", "You’re ready to begin.")}
      </Text>
      <Text style={styles.body}>
        {t(
          "Tu perfil inicial ya está preparado para que Matcha te acompañe con metas, retos y señales claras de crecimiento.",
          "Your initial profile is ready so Matcha can support you with goals, challenges, and clearer signals of growth."
        )}
      </Text>
      <Text style={styles.body}>
        {t(
          "Este es el comienzo de una versión más segura, atractiva y consciente de ti.",
          "This is the beginning of a more confident, attractive, and intentional version of you."
        )}
      </Text>
      {(formError || authError) ? (
        <Text style={styles.inlineError}>{formError || authError}</Text>
      ) : null}
      <Pressable
        onPress={handleFinish}
        disabled={authBusy}
        style={({ pressed }) => [
          styles.primaryButton,
          authBusy && styles.primaryButtonDisabled,
          pressed && !authBusy && { opacity: 0.92 },
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {t("Ir a Matcha", "Enter Matcha")}
        </Text>
        <Feather name="arrow-right" size={18} color={Colors.textInverted} />
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <StatusBar barStyle="light-content" />
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={bottomPad}
        extraKeyboardSpace={28}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        <ProgressBar currentStep={step} t={t} />
        <Animated.View
          style={[
            styles.animatedWrap,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {step === 1 ? renderIntro() : step === 2 ? renderForm() : renderCompletion()}
        </Animated.View>
      </KeyboardAwareScrollViewCompat>

      <Modal
        visible={languagesModalOpen}
        animationType="fade"
        presentationStyle="overFullScreen"
        transparent
        onRequestClose={closeLanguagesModal}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalKeyboardAvoider}
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
              value={languageSearch}
              onChangeText={setLanguageSearch}
              placeholder={t("Buscar idioma", "Search language")}
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
              selectionColor={Colors.primaryLight}
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
                      onPress={() => toggleLanguage(item.value)}
                      style={({ pressed }) => [
                        styles.selectedLanguageChip,
                        pressed && { opacity: 0.82 },
                      ]}
                    >
                      <Text style={styles.selectedLanguageFlag}>
                        {item.flag || getSpokenLanguageFlag(item.value)}
                      </Text>
                      <Text style={styles.selectedLanguageText}>
                        {language === "es" ? item.es : item.en}
                      </Text>
                      <Feather name="x" size={12} color={Colors.primaryLight} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <KeyboardAwareScrollViewCompat
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bottomOffset={insets.bottom + 16}
              extraKeyboardSpace={18}
            >
              <View style={styles.modalOptionsWrap}>
                {filteredLanguages.map((item) => {
                  const selected = draftLanguages.includes(item.value);
                  return (
                    <Pressable
                      key={item.value}
                      onPress={() => toggleLanguage(item.value)}
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
                        <Feather name="check" size={13} color={Colors.primaryLight} />
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
            </KeyboardAwareScrollViewCompat>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
  },
  animatedWrap: {
    flex: 1,
  },
  progressBlock: {
    paddingTop: 8,
    gap: 10,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.text,
  },
  progressSubtle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  progressTrack: {
    flexDirection: "row",
    gap: 8,
  },
  progressSegment: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: Colors.surface,
  },
  progressSegmentActive: {
    backgroundColor: Colors.primaryLight,
  },
  stepCard: {
    marginTop: 22,
    padding: 22,
    borderRadius: 30,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  heroBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(82,183,136,0.14)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.24)",
  },
  heroBadgeSuccess: {
    backgroundColor: "rgba(82,183,136,0.16)",
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    lineHeight: 34,
    color: Colors.text,
    letterSpacing: -0.8,
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 23,
    color: Colors.textSecondary,
  },
  bodyStrong: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    lineHeight: 23,
    color: Colors.text,
  },
  formWrap: {
    marginTop: 22,
    gap: 16,
  },
  sectionCard: {
    padding: 18,
    borderRadius: 28,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  sectionEyebrow: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  sectionCopy: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  field: {
    zIndex: 1,
    gap: 8,
  },
  fieldOpen: {
    zIndex: 30,
  },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  selectWrap: {
    position: "relative",
    zIndex: 1,
  },
  selectWrapOpen: {
    zIndex: 40,
  },
  selectField: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  selectValue: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.text,
  },
  placeholderText: {
    color: Colors.textMuted,
  },
  dropdown: {
    position: "absolute",
    top: 58,
    left: 0,
    right: 0,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  dropdownOptionActive: {
    backgroundColor: "rgba(82,183,136,0.12)",
  },
  dropdownOptionText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.text,
  },
  dropdownOptionTextActive: {
    color: Colors.primaryLight,
  },
  photoCard: {
    minHeight: 200,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  photoCardEmpty: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  photoPreview: {
    width: "100%",
    height: 220,
  },
  photoPlaceholder: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  photoPlaceholderTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.text,
  },
  photoPlaceholderSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  languagePickerButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  languageChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  languageChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(82,183,136,0.12)",
    borderWidth: 1,
    borderColor: "rgba(82,183,136,0.2)",
  },
  languageChipFlag: {
    fontSize: 14,
  },
  languageChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.primaryLight,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.textInverted,
  },
  inlineHint: {
    paddingHorizontal: 4,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  inlineError: {
    paddingHorizontal: 4,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.error,
    textAlign: "center",
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(6, 12, 10, 0.72)",
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  modalKeyboardAvoider: {
    flex: 1,
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
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

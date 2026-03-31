import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { OverlaySelectField } from "@/components/OverlaySelectField";
import { SpokenLanguagesPickerField } from "@/components/SpokenLanguagesPickerField";
import { useBottomObstruction } from "@/components/useBottomObstruction";
import Colors from "@/constants/colors";
import {
  BODY_TYPES,
  CHILDREN_PREFERENCES,
  EDUCATION_LEVELS,
  ENGLISH_PRONOUNS,
  GENDER_IDENTITIES,
  MAX_PROFILE_PHOTOS,
  getBodyTypeLabel,
  getChildrenPreferenceLabel,
  getDefaultSpokenLanguageValue,
  getEducationLabel,
  getGenderIdentityLabel,
  getPersonalityLabel,
  getPhysicalActivityLabel,
  getPronounLabel,
  getRelationshipGoalLabel,
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
  SPANISH_PRONOUNS,
} from "@/constants/profile-options";
import { useApp } from "@/context/AppContext";
import {
  getProfilePhotoMatchKind,
  deleteStoredProfilePhoto,
  getProfilePhotoBySortOrder,
  getProfilePhotoDisplayUri,
  getProfilePhotoSource,
  isStoredProfilePhoto,
  normalizeStoredProfilePhotos,
  saveProfilePhotoLocally,
  type UserProfilePhoto,
} from "@/utils/profilePhotos";

const TOTAL_STEPS = 3;

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
    onboardingResumeStep,
    saveOnboardingDraft,
    setOnboardingResumeStep,
    t,
    user,
  } = useApp();

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const hasLocalPhotoDraftChangesRef = useRef(false);
  const hasLocalDraftChangesRef = useRef(false);
  const buildProfileSeed = React.useCallback(() => {
    const normalizedPhotos = normalizeStoredProfilePhotos(accountProfile.photos || []);
    return {
      genderIdentity: accountProfile.genderIdentity || "",
      pronouns: accountProfile.pronouns || "",
      photos: normalizedPhotos,
      relationshipGoals: accountProfile.relationshipGoals || "",
      childrenPreference: accountProfile.childrenPreference || "",
      languagesSpoken: accountProfile.languagesSpoken.length
        ? normalizeSpokenLanguages(accountProfile.languagesSpoken)
        : [getDefaultSpokenLanguageValue(language)],
      education: accountProfile.education || "",
      physicalActivity: accountProfile.physicalActivity || "",
      bodyType: accountProfile.bodyType || "",
      personality: accountProfile.personality || "",
    };
  }, [accountProfile, language]);
  const initialProfileSeed = buildProfileSeed();
  const [step, setStep] = useState(onboardingResumeStep);
  const [formError, setFormError] = useState<string | null>(null);
  const [genderIdentity, setGenderIdentity] = useState(initialProfileSeed.genderIdentity);
  const [pronouns, setPronouns] = useState(initialProfileSeed.pronouns);
  const [photos, setPhotos] = useState<UserProfilePhoto[]>(initialProfileSeed.photos);
  const [relationshipGoals, setRelationshipGoals] = useState(
    initialProfileSeed.relationshipGoals
  );
  const [childrenPreference, setChildrenPreference] = useState(
    initialProfileSeed.childrenPreference
  );
  const [languagesSpoken, setLanguagesSpoken] = useState<string[]>(
    initialProfileSeed.languagesSpoken
  );
  const [education, setEducation] = useState(initialProfileSeed.education);
  const [physicalActivity, setPhysicalActivity] = useState(
    initialProfileSeed.physicalActivity
  );
  const [bodyType, setBodyType] = useState(initialProfileSeed.bodyType);
  const [personality, setPersonality] = useState(initialProfileSeed.personality);

  const applySeedToForm = React.useCallback(
    (seed: ReturnType<typeof buildProfileSeed>) => {
      setGenderIdentity(seed.genderIdentity);
      setPronouns(seed.pronouns);
      setPhotos(seed.photos);
      setRelationshipGoals(seed.relationshipGoals);
      setChildrenPreference(seed.childrenPreference);
      setLanguagesSpoken(seed.languagesSpoken);
      setEducation(seed.education);
      setPhysicalActivity(seed.physicalActivity);
      setBodyType(seed.bodyType);
      setPersonality(seed.personality);
    },
    []
  );

  const markDraftDirty = React.useCallback(() => {
    hasLocalDraftChangesRef.current = true;
  }, []);

  React.useEffect(() => {
    if (!hasLocalDraftChangesRef.current) {
      applySeedToForm(buildProfileSeed());
    }
  }, [applySeedToForm, buildProfileSeed]);

  React.useEffect(() => {
    if (hasCompletedOnboarding || onboardingResumeStep !== 1) {
      return;
    }

    const seed = buildProfileSeed();
    hasLocalDraftChangesRef.current = false;
    hasLocalPhotoDraftChangesRef.current = false;
    applySeedToForm(seed);
  }, [applySeedToForm, buildProfileSeed, hasCompletedOnboarding, onboardingResumeStep]);

  React.useEffect(() => {
    setStep(onboardingResumeStep);
  }, [onboardingResumeStep]);

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
  const { restingBottomInset } = useBottomObstruction({
    safeAreaBottomInset: insets.bottom,
    restingBottomSpacing: 16,
  });
  const getPhotoForSlot = React.useCallback(
    (index: number) => getProfilePhotoBySortOrder(photos, index),
    [photos]
  );
  const mainPhoto = getProfilePhotoDisplayUri(getPhotoForSlot(0));
  const canonicalMainPhoto = getProfilePhotoBySortOrder(accountProfile.photos, 0);
  const onboardingMainPhoto = getPhotoForSlot(0);
  const primaryPhotoMatchKind = getProfilePhotoMatchKind(
    onboardingMainPhoto,
    canonicalMainPhoto
  );
  const pronounOptions = language === "es" ? SPANISH_PRONOUNS : ENGLISH_PRONOUNS;

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
    void setOnboardingResumeStep(nextStep);
  };

  const savePickedPhoto = async (index: number, sourceUri: string) => {
    const targetUri = await saveProfilePhotoLocally(
      index,
      sourceUri,
      user?.id ?? "anonymous"
    );
    const previous = getPhotoForSlot(index);
    const nextPhoto: UserProfilePhoto = {
      localUri: targetUri,
      remoteUrl: "",
      mediaAssetId: null,
      profileImageId: null,
      sortOrder: index,
      status: "ready",
    };
    hasLocalPhotoDraftChangesRef.current = true;
    markDraftDirty();
    if (previous?.localUri && previous.localUri !== targetUri && isStoredProfilePhoto(previous.localUri)) {
      deleteStoredProfilePhoto(previous.localUri).catch(() => {});
    }
    setPhotos((current) => {
      const next = normalizeStoredProfilePhotos(current).filter(
        (photo) => photo.sortOrder !== index
      );
      next.push(nextPhoto);
      return next.sort((a, b) => a.sortOrder - b.sortOrder);
    });
  };

  const requestAndPickPhoto = async (index: number) => {
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
      allowsEditing: Platform.OS === "ios",
      quality: 0.85,
      aspect: [4, 5],
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      await savePickedPhoto(index, result.assets[0].uri);
    }
  };

  const requestAndCapturePhoto = async (index: number) => {
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
      allowsEditing: Platform.OS === "ios",
      quality: 0.85,
      aspect: [4, 5],
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      await savePickedPhoto(index, result.assets[0].uri);
    }
  };

  const openPhotoPicker = (index: number) => {
    Alert.alert(
      index === 0
        ? t("Tu foto principal", "Your main photo")
        : t("Tu foto", "Your photo"),
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
            requestAndPickPhoto(index).catch(() => {});
          },
        },
        {
          text: t("Cámara", "Camera"),
          onPress: () => {
            requestAndCapturePhoto(index).catch(() => {});
          },
        },
      ]
    );
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
    const requestId = `onboarding_draft_${Date.now()}`;
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
    }, {
      requestId,
      step,
    });
    if (!ok) {
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    animateToStep(3);
  };

  const handleFinish = async () => {
    if (!isFormComplete) {
      setFormError(
        t(
          "Completa todos los campos antes de continuar.",
          "Complete all fields before continuing."
        )
      );
      animateToStep(2);
      return;
    }

    setFormError(null);
    const draftSaved = await saveOnboardingDraft({
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
    }, {
      requestId: `onboarding_finish_draft_${Date.now()}`,
      step,
    });
    if (!draftSaved) {
      return;
    }

    const ok = await finishOnboarding({
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

        <OverlaySelectField
          label={t("Cómo te identificas", "How do you identify")}
          value={genderIdentity}
          options={GENDER_IDENTITIES}
          onChange={(value) => {
            markDraftDirty();
            setGenderIdentity(normalizeGenderIdentity(value));
          }}
          placeholder={t("Selecciona una opción", "Select an option")}
          getOptionLabel={(value) => getGenderIdentityLabel(value, t)}
        />

        <OverlaySelectField
          label={t("Pronombres", "Pronouns")}
          value={pronouns}
          options={pronounOptions}
          onChange={(value) => {
            markDraftDirty();
            setPronouns(normalizePronouns(value));
          }}
          placeholder={t("Selecciona tus pronombres", "Select your pronouns")}
          getOptionLabel={(value) => getPronounLabel(value, language)}
        />

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            {t("Añade tus fotos", "Add your photos")}
          </Text>
          <View style={styles.photoGrid}>
            {Array.from({ length: MAX_PROFILE_PHOTOS }).map((_, index) => {
              const photo = getPhotoForSlot(index);
              const photoUri = getProfilePhotoDisplayUri(photo);
              const isMain = index === 0;

              return (
                <Pressable
                  key={index}
                  onPress={() => openPhotoPicker(index)}
                  testID={isMain ? "onboarding-main-photo" : `onboarding-photo-slot-${index}`}
                  style={({ pressed }) => [
                    styles.photoSlot,
                    isMain && styles.photoSlotMain,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.photoSlotImage} />
                  ) : (
                    <View
                      style={[
                        styles.photoSlotPlaceholder,
                        isMain && styles.photoSlotPlaceholderMain,
                      ]}
                    >
                      <Feather
                        name={isMain ? "camera" : "plus"}
                        size={isMain ? 22 : 16}
                        color={isMain ? Colors.primaryLight : Colors.textMuted}
                      />
                      {isMain ? (
                        <>
                          <Text style={styles.photoPlaceholderTitle}>
                            {t("Foto principal", "Main photo")}
                          </Text>
                          <Text style={styles.photoPlaceholderSub}>
                            {t("Necesitamos al menos una foto", "We need at least one photo")}
                          </Text>
                        </>
                      ) : null}
                    </View>
                  )}
                  {isMain ? (
                    <View style={styles.mainBadge}>
                      <Text style={styles.mainBadgeText}>
                        {t("Principal", "Main")}
                      </Text>
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
                      <Text style={styles.photoStateBadgeText}>{t("Error", "Error")}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <OverlaySelectField
          label={t("Qué estás buscando", "What are you looking for")}
          value={relationshipGoals}
          options={RELATIONSHIP_GOALS}
          onChange={(value) => {
            markDraftDirty();
            setRelationshipGoals(normalizeRelationshipGoal(value));
          }}
          placeholder={t("Selecciona una opción", "Select an option")}
          getOptionLabel={(value) => getRelationshipGoalLabel(value, t)}
        />

        <OverlaySelectField
          label={t("Quieres tener hijxs", "Do you want kids")}
          value={childrenPreference}
          options={CHILDREN_PREFERENCES}
          onChange={(value) => {
            markDraftDirty();
            setChildrenPreference(normalizeChildrenPreference(value));
          }}
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

        <SpokenLanguagesPickerField
          style={styles.field}
          label={t("Idiomas que hablo", "Languages I speak")}
          values={languagesSpoken}
          onChange={(values) => {
            markDraftDirty();
            setLanguagesSpoken(values);
          }}
          language={language}
          t={t}
        />

        <OverlaySelectField
          label={t("Educación", "Education")}
          value={education}
          options={EDUCATION_LEVELS}
          onChange={(value) => {
            markDraftDirty();
            setEducation(normalizeEducation(value));
          }}
          placeholder={t("Selecciona una opción", "Select an option")}
          getOptionLabel={(value) => getEducationLabel(value, t)}
        />

        <OverlaySelectField
          label={t("Con qué frecuencia entrenas", "How often do you train")}
          value={physicalActivity}
          options={PHYSICAL_ACTIVITY_OPTIONS}
          onChange={(value) => {
            markDraftDirty();
            setPhysicalActivity(normalizePhysicalActivity(value));
          }}
          placeholder={t("Selecciona una opción", "Select an option")}
          getOptionLabel={(value) => getPhysicalActivityLabel(value, t)}
        />

        <OverlaySelectField
          label={t("Tipo de cuerpo", "Body type")}
          value={bodyType}
          options={BODY_TYPES}
          onChange={(value) => {
            markDraftDirty();
            setBodyType(normalizeBodyType(value));
          }}
          placeholder={t("Selecciona una opción", "Select an option")}
          getOptionLabel={(value) => getBodyTypeLabel(value, t)}
        />

        <OverlaySelectField
          label={t("Personalidad", "Personality")}
          value={personality}
          options={PERSONALITY_TRAITS}
          onChange={(value) => {
            markDraftDirty();
            setPersonality(normalizePersonality(value));
          }}
          placeholder={t("Selecciona una opción", "Select an option")}
          getOptionLabel={(value) => getPersonalityLabel(value, t)}
        />

        {__DEV__ ? (
          <View style={styles.debugCard} testID="onboarding-photo-debug">
            <Text style={styles.debugTitle}>
              {t("Inspector de onboarding", "Onboarding inspector")}
            </Text>
            <Text style={styles.debugLine} testID="onboarding-primary-photo-match">
              {`primaryMatchStatus=${primaryPhotoMatchKind ? "ok" : "mismatch"} primaryMatch=${primaryPhotoMatchKind || "none"}`}
            </Text>
            <Text style={styles.debugLine} testID="onboarding-primary-photo-debug">
              {`onboardingPrimary profileImageId=${onboardingMainPhoto?.profileImageId ?? "null"} mediaAssetId=${onboardingMainPhoto?.mediaAssetId ?? "null"} sortOrder=${onboardingMainPhoto?.sortOrder ?? "null"} source=${getProfilePhotoSource(onboardingMainPhoto)}`}
            </Text>
            <Text style={styles.debugLine} testID="onboarding-canonical-photo-debug">
              {`profilePrimary profileImageId=${canonicalMainPhoto?.profileImageId ?? "null"} mediaAssetId=${canonicalMainPhoto?.mediaAssetId ?? "null"} sortOrder=${canonicalMainPhoto?.sortOrder ?? "null"} source=${getProfilePhotoSource(canonicalMainPhoto)}`}
            </Text>
          </View>
        ) : null}
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
        style={styles.modalScroll}
        contentContainerStyle={[
          styles.modalScrollContent,
            { paddingBottom: restingBottomInset + 8 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bottomOffset={restingBottomInset}
          extraKeyboardSpace={18}
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
    flexGrow: 1,
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
    paddingBottom: 12,
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
  debugCard: {
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(111,168,255,0.22)",
    backgroundColor: "rgba(111,168,255,0.08)",
    padding: 14,
    gap: 6,
  },
  debugTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: Colors.info,
  },
  debugLine: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
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
    gap: 8,
    padding: 12,
  },
  photoSlotPlaceholderMain: {
    backgroundColor: Colors.backgroundElevated,
    borderColor: Colors.border,
  },
  photoPlaceholderTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.text,
    textAlign: "center",
  },
  photoPlaceholderSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
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
  },
  modalKeyboardContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  modalContainer: {
    width: "100%",
    maxHeight: "88%",
    flexShrink: 1,
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
    minHeight: 0,
    marginTop: 16,
  },
  modalScrollContent: {
    flexGrow: 0,
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

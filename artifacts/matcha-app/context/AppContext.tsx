import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as LocalAuthentication from "expo-local-authentication";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AppState, Keyboard, Platform } from "react-native";

import {
  type AuthCallbackPayload,
  type AuthUser,
  type DiscoveryLikeResponse,
  type ProviderAvailability,
  type AuthProvider,
  checkVerificationStatus as authCheckVerificationStatus,
  fetchProviderAvailability,
  getDiscoveryPreferences,
  getSettings,
  likeDiscoveryProfile,
  completeOnboarding as completeOnboardingRequest,
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
  getMe,
  updateMe,
  updateSettings,
  refreshSession,
  signInWithProvider as authSignInWithProvider,
  toReadableAuthError,
  ApiError,
} from "@/services/auth";
import { getDiscoverProfilePopularInput } from "@/data/profiles";
import {
  createEmptyPopularAttributesByCategory,
  type PopularAttributeCategory,
  type PopularAttributeSnapshot,
} from "@/utils/popularAttributes";

export type { AuthUser };

export type GoalCategory =
  | "physical"
  | "personality"
  | "family"
  | "expectations"
  | "language"
  | "studies";

export type Goal = {
  id: string;
  titleEs: string;
  titleEn: string;
  category: GoalCategory;
  order: number;
  completed: boolean;
  progress: number;
  nextActionEs: string;
  nextActionEn: string;
  impactEs: string;
  impactEn: string;
};

export type UserProfile = {
  name: string;
  age: string;
  dateOfBirth: string;
  location: string;
  profession: string;
  genderIdentity: string;
  pronouns: string;
  personality: string;
  relationshipGoals: string;
  languagesSpoken: string[];
  education: string;
  childrenPreference: string;
  physicalActivity: string;
  alcoholUse: string;
  tobaccoUse: string;
  politicalInterest: string;
  religionImportance: string;
  religion: string;
  bio: string;
  bodyType: string;
  height: string;
  hairColor: string;
  ethnicity: string;
  interests: string[];
  photos: string[];
};

export type AccountProfile = UserProfile & {
  email: string;
};

export type HeightUnit = "metric" | "imperial";

type AuthStatus =
  | "loading"
  | "unauthenticated"
  | "authenticated"
  | "verification_pending";
type VerificationStatus = "idle" | "pending" | "checking" | "verified";
type AuthFormPrefill = {
  email: string;
  mode: "signin" | "signup";
};

type BiometricResult = { ok: boolean; code?: string };

const GOAL_CATEGORIES: GoalCategory[] = [
  "physical",
  "personality",
  "family",
  "expectations",
  "language",
  "studies",
];

const DEFAULT_GOALS: Goal[] = [
  {
    id: "1",
    titleEs: "Resistencia cardiovascular",
    titleEn: "Cardiovascular endurance",
    category: "physical",
    order: 0,
    completed: false,
    progress: 0,
    nextActionEs: "Corre 20 min hoy sin parar",
    nextActionEn: "Run 20 min today without stopping",
    impactEs: "Más energía y mejor postura",
    impactEn: "More energy and better posture",
  },
  {
    id: "2",
    titleEs: "Confianza social",
    titleEn: "Social confidence",
    category: "personality",
    order: 0,
    completed: false,
    progress: 0,
    nextActionEs: "Inicia una conversación con un extraño",
    nextActionEn: "Start a conversation with a stranger",
    impactEs: "Más atractivo en interacciones sociales",
    impactEn: "More attractive in social interactions",
  },
  {
    id: "3",
    titleEs: "Cuidado personal consistente",
    titleEn: "Consistent grooming routine",
    category: "physical",
    order: 2,
    completed: true,
    progress: 0,
    nextActionEs: "Mantén un ritual simple de autocuidado esta semana",
    nextActionEn: "Keep a simple self-care ritual this week",
    impactEs: "Refuerza tu presencia y seguridad personal",
    impactEn: "Reinforces your presence and self-confidence",
  },
  {
    id: "4",
    titleEs: "Inteligencia emocional",
    titleEn: "Emotional intelligence",
    category: "personality",
    order: 2,
    completed: true,
    progress: 0,
    nextActionEs: "Escucha activa en tu próxima conversación",
    nextActionEn: "Active listening in your next conversation",
    impactEs: "Conexiones más profundas y auténticas",
    impactEn: "Deeper and more authentic connections",
  },
  {
    id: "5",
    titleEs: "Postura corporal",
    titleEn: "Body posture",
    category: "physical",
    order: 1,
    completed: true,
    progress: 0,
    nextActionEs: "10 min de ejercicios de postura ahora",
    nextActionEn: "10 min posture exercises right now",
    impactEs: "Proyectas más confianza y presencia",
    impactEn: "Project more confidence and presence",
  },
  {
    id: "6",
    titleEs: "Habilidades de conversación",
    titleEn: "Conversation skills",
    category: "language",
    order: 0,
    completed: false,
    progress: 0,
    nextActionEs: "Aprende 3 preguntas abiertas interesantes",
    nextActionEn: "Learn 3 interesting open-ended questions",
    impactEs: "Conversaciones más atractivas y fluidas",
    impactEn: "More engaging and fluid conversations",
  },
  {
    id: "7",
    titleEs: "Límites personales claros",
    titleEn: "Clear personal boundaries",
    category: "personality",
    order: 1,
    completed: false,
    progress: 0,
    nextActionEs: "Define una situación donde quieras responder con más calma",
    nextActionEn: "Define one situation where you want to respond more calmly",
    impactEs: "Te ayuda a sentir más control y coherencia",
    impactEn: "Helps you feel more in control and aligned",
  },
  {
    id: "8",
    titleEs: "Visión familiar clara",
    titleEn: "Clear family vision",
    category: "family",
    order: 0,
    completed: false,
    progress: 0,
    nextActionEs: "Escribe qué significa familia para ti hoy",
    nextActionEn: "Write down what family means to you today",
    impactEs: "Aclara tus prioridades a largo plazo",
    impactEn: "Clarifies your long-term priorities",
  },
  {
    id: "9",
    titleEs: "Conversación sobre hijxs",
    titleEn: "Children conversation",
    category: "family",
    order: 1,
    completed: false,
    progress: 0,
    nextActionEs: "Prepara cómo hablarías de este tema con honestidad",
    nextActionEn: "Prepare how you would talk about this topic honestly",
    impactEs: "Reduce fricciones futuras y alinea expectativas",
    impactEn: "Reduces future friction and aligns expectations",
  },
  {
    id: "10",
    titleEs: "Ritmo de estabilidad",
    titleEn: "Pace of stability",
    category: "family",
    order: 2,
    completed: false,
    progress: 0,
    nextActionEs: "Piensa qué tipo de rutina compartida te hace sentir en paz",
    nextActionEn: "Think about what kind of shared routine gives you peace",
    impactEs: "Te acerca a vínculos más sostenibles",
    impactEn: "Moves you toward more sustainable bonds",
  },
  {
    id: "11",
    titleEs: "Claridad romántica",
    titleEn: "Relationship clarity",
    category: "expectations",
    order: 0,
    completed: false,
    progress: 0,
    nextActionEs: "Resume en una frase lo que buscas construir",
    nextActionEn: "Summarize in one sentence what you want to build",
    impactEs: "Hace tu intención más visible y coherente",
    impactEn: "Makes your intention more visible and consistent",
  },
  {
    id: "12",
    titleEs: "No negociables sanos",
    titleEn: "Healthy non-negotiables",
    category: "expectations",
    order: 2,
    completed: true,
    progress: 0,
    nextActionEs: "Anota los tres valores que no quieres comprometer",
    nextActionEn: "Write down the three values you do not want to compromise",
    impactEs: "Refuerza decisiones más conscientes",
    impactEn: "Supports more intentional decisions",
  },
  {
    id: "13",
    titleEs: "Ritmo consciente",
    titleEn: "Intentional pacing",
    category: "expectations",
    order: 1,
    completed: false,
    progress: 0,
    nextActionEs: "Define el ritmo que se siente sano para ti al conocer a alguien",
    nextActionEn: "Define the pace that feels healthy for you when meeting someone",
    impactEs: "Genera más control emocional y claridad",
    impactEn: "Creates more emotional control and clarity",
  },
  {
    id: "14",
    titleEs: "Presentación natural",
    titleEn: "Natural self-introduction",
    category: "language",
    order: 2,
    completed: true,
    progress: 0,
    nextActionEs: "Practica una introducción breve que suene auténtica",
    nextActionEn: "Practice a short introduction that sounds authentic",
    impactEs: "Te hace sonar más seguro desde el inicio",
    impactEn: "Makes you sound more confident from the start",
  },
  {
    id: "15",
    titleEs: "Escucha activa verbal",
    titleEn: "Verbal active listening",
    category: "language",
    order: 1,
    completed: false,
    progress: 0,
    nextActionEs: "Prueba una frase de validación en tu próxima charla",
    nextActionEn: "Try one validation phrase in your next conversation",
    impactEs: "Aumenta conexión y reciprocidad",
    impactEn: "Improves connection and reciprocity",
  },
  {
    id: "16",
    titleEs: "Historia profesional clara",
    titleEn: "Clear learning story",
    category: "studies",
    order: 2,
    completed: true,
    progress: 0,
    nextActionEs: "Resume tu recorrido de estudio o aprendizaje en dos líneas",
    nextActionEn: "Summarize your study or learning path in two lines",
    impactEs: "Hace tu perfil más nítido y memorable",
    impactEn: "Makes your profile sharper and more memorable",
  },
  {
    id: "17",
    titleEs: "Plan de crecimiento",
    titleEn: "Growth plan",
    category: "studies",
    order: 0,
    completed: false,
    progress: 0,
    nextActionEs: "Elige una habilidad que quieras reforzar este mes",
    nextActionEn: "Choose one skill you want to strengthen this month",
    impactEs: "Transmite ambición tranquila y dirección",
    impactEn: "Signals calm ambition and direction",
  },
  {
    id: "18",
    titleEs: "Mostrar tu especialidad",
    titleEn: "Show your expertise",
    category: "studies",
    order: 1,
    completed: false,
    progress: 0,
    nextActionEs: "Piensa cómo explicarías tu fortaleza principal con claridad",
    nextActionEn: "Think about how you would explain your main strength clearly",
    impactEs: "Te ayuda a destacar con naturalidad",
    impactEn: "Helps you stand out naturally",
  },
];

const DEFAULT_PROFILE: UserProfile = {
  name: "",
  age: "",
  dateOfBirth: "",
  location: "",
  profession: "",
  genderIdentity: "",
  pronouns: "",
  personality: "",
  relationshipGoals: "",
  languagesSpoken: [],
  education: "",
  childrenPreference: "",
  physicalActivity: "",
  alcoholUse: "",
  tobaccoUse: "",
  politicalInterest: "",
  religionImportance: "",
  religion: "",
  bio: "",
  bodyType: "",
  height: "",
  hairColor: "",
  ethnicity: "",
  interests: [],
  photos: [],
};

function normalizeStoredProfile(input: Partial<UserProfile> | null | undefined): UserProfile {
  return {
    ...DEFAULT_PROFILE,
    ...(input || {}),
    interests: Array.isArray(input?.interests) ? input.interests : [],
    photos: Array.isArray(input?.photos) ? input.photos : [],
    languagesSpoken: Array.isArray(input?.languagesSpoken) ? input.languagesSpoken : [],
  };
}

function recalculateGoalProgress(goals: Goal[]): Goal[] {
  const progressByCategory = new Map<GoalCategory, number>();

  GOAL_CATEGORIES.forEach((category) => {
    const categoryGoals = goals.filter((goal) => goal.category === category);
    const completedCount = categoryGoals.filter((goal) => goal.completed).length;
    const progress = categoryGoals.length
      ? Math.round((completedCount / categoryGoals.length) * 100)
      : 0;
    progressByCategory.set(category, progress);
  });

  return goals.map((goal) => ({
    ...goal,
    progress: progressByCategory.get(goal.category) || 0,
  }));
}

function normalizeStoredGoals(input: Partial<Goal>[] | null | undefined): Goal[] {
  const savedGoals = Array.isArray(input) ? input : [];
  const savedGoalsById = new Map(
    savedGoals.map((goal) => [String(goal.id), goal] as const)
  );

  const merged = DEFAULT_GOALS.map((goal) => {
    const saved = savedGoalsById.get(goal.id);
    return {
      ...goal,
      order: typeof saved?.order === "number" ? saved.order : goal.order,
      completed:
        typeof saved?.completed === "boolean" ? saved.completed : goal.completed,
    };
  });

  const ordered = GOAL_CATEGORIES.flatMap((category) =>
    merged
      .filter((goal) => goal.category === category)
      .sort((a, b) => a.order - b.order)
      .map((goal, index) => ({
        ...goal,
        order: index,
      }))
  );

  return recalculateGoalProgress(ordered);
}

type AppContextType = {
  authStatus: AuthStatus;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<boolean>;
  signUp: (input: {
    name: string;
    email: string;
    password: string;
    dateOfBirth: string;
  }) => Promise<boolean>;
  signInWithProvider: (
    provider: AuthProvider,
    mode: "signin" | "signup"
  ) => Promise<boolean>;
  user: AuthUser | null;
  authBusy: boolean;
  authError: string | null;
  authFormPrefill: AuthFormPrefill | null;
  pendingVerificationEmail: string | null;
  verificationStatus: VerificationStatus;
  checkPendingVerificationStatus: () => Promise<"pending" | "verified" | null>;
  resetPendingVerificationState: () => void;
  handleAuthCallback: (payload: AuthCallbackPayload) => Promise<boolean>;
  clearAuthFeedback: () => void;
  providerAvailability: ProviderAvailability;
  needsProfileCompletion: boolean;
  hasCompletedOnboarding: boolean;
  completeProfile: (data: { name: string; dateOfBirth: string }) => Promise<boolean>;
  saveOnboardingDraft: (data: {
    genderIdentity: string;
    pronouns: string;
    personality: string;
    relationshipGoals: string;
    childrenPreference: string;
    languagesSpoken: string[];
    education: string;
    physicalActivity: string;
    bodyType: string;
    photos: string[];
  }) => Promise<boolean>;
  finishOnboarding: () => Promise<boolean>;
  biometricLockRequired: boolean;
  biometricBusy: boolean;
  biometricsEnabled: boolean;
  unlockWithBiometrics: () => Promise<BiometricResult>;
  setBiometricsEnabled: (enabled: boolean) => Promise<BiometricResult>;
  language: "es" | "en";
  setLanguage: (lang: "es" | "en") => void;
  heightUnit: HeightUnit;
  setHeightUnit: (unit: HeightUnit) => void;
  saveSettings: (input: {
    name: string;
    dateOfBirth: string;
    profession: string;
    genderIdentity: string;
    pronouns: string;
    personality: string;
    language: "es" | "en";
    heightUnit: HeightUnit;
  }) => Promise<boolean>;
  t: (es: string, en: string) => string;
  goals: Goal[];
  completeGoalTask: (id: string) => void;
  reorderGoalTasks: (
    category: GoalCategory,
    fromIndex: number,
    toIndex: number
  ) => void;
  popularAttributesByCategory: Record<
    PopularAttributeCategory,
    PopularAttributeSnapshot
  >;
  totalLikesCount: number;
  likedProfiles: string[];
  likeProfile: (profileId: string) => Promise<DiscoveryLikeResponse | null>;
  profile: UserProfile;
  accountProfile: AccountProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
  setProfilePhoto: (index: number, uri: string) => void;
  removeProfilePhoto: (index: number) => void;
};

const AppContext = createContext<AppContextType | null>(null);
const ACCESS_TOKEN_STORAGE_KEY = "accessToken";
const REFRESH_TOKEN_STORAGE_KEY = "refreshToken";

async function checkBiometricHardware(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [, setRefreshToken] = useState<string | null>(null);
  const [language, setLanguageState] = useState<"es" | "en">("es");
  const [heightUnit, setHeightUnitState] = useState<HeightUnit>("metric");
  const [goals, setGoals] = useState<Goal[]>(() =>
    normalizeStoredGoals(DEFAULT_GOALS)
  );
  const [likedProfiles, setLikedProfiles] = useState<string[]>([]);
  const [popularAttributesByCategory, setPopularAttributesByCategory] = useState<
    Record<PopularAttributeCategory, PopularAttributeSnapshot>
  >(() => createEmptyPopularAttributesByCategory());
  const [totalLikesCount, setTotalLikesCount] = useState(0);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authFormPrefill, setAuthFormPrefill] = useState<AuthFormPrefill | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [pendingVerificationPassword, setPendingVerificationPassword] = useState<string | null>(
    null
  );
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>("idle");
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);
  const [biometricLockRequired, setBiometricLockRequired] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [providerAvailability, setProviderAvailability] = useState<ProviderAvailability>({
    google: false,
    facebook: false,
    apple: false,
  });

  useEffect(() => {
    fetchProviderAvailability().then(setProviderAvailability).catch(() => {});
  }, []);

  const t = useCallback(
    (es: string, en: string) => (language === "es" ? es : en),
    [language]
  );

  const refreshProfileLocation = useCallback(async () => {
    if (Platform.OS === "web") {
      return;
    }

    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (!permission.granted) {
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      if (!place) {
        return;
      }

      const city =
        place.city ||
        place.subregion ||
        place.district ||
        place.region ||
        "";
      const country = place.country || "";
      const nextLocation = [city, country].filter(Boolean).join(", ");

      if (!nextLocation) {
        return;
      }

      setProfile((prev) => {
        if (prev.location === nextLocation) {
          return prev;
        }
        const updated = normalizeStoredProfile({ ...prev, location: nextLocation });
        AsyncStorage.setItem("profile", JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    } catch {}
  }, []);

  const setLanguage = useCallback((lang: "es" | "en") => {
    setLanguageState(lang);
    AsyncStorage.setItem("language", lang).catch(() => {});
  }, []);

  const setHeightUnit = useCallback((unit: HeightUnit) => {
    setHeightUnitState(unit);
    AsyncStorage.setItem("heightUnit", unit).catch(() => {});
  }, []);

  const clearAuthFeedback = useCallback(() => {
    setAuthError(null);
  }, []);

  const resetPendingVerificationState = useCallback(() => {
    setPendingVerificationEmail(null);
    setPendingVerificationPassword(null);
    setVerificationStatus("idle");
    setAuthStatus((prev) =>
      prev === "verification_pending" ? "unauthenticated" : prev
    );
  }, []);

  const clearStoredSessionTokens = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY),
      AsyncStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY),
    ]);
  }, []);

  const setSignInPrefill = useCallback((email: string | null | undefined) => {
    if (!email) return;
    setAuthFormPrefill({
      email,
      mode: "signin",
    });
  }, []);

  const applyServerSettings = useCallback(
    async (settings: {
      language: "es" | "en";
      heightUnit: HeightUnit;
      genderIdentity: string;
      pronouns: string;
      personality: string;
    }) => {
      setLanguageState(settings.language);
      setHeightUnitState(settings.heightUnit);
      await AsyncStorage.setItem("language", settings.language);
      await AsyncStorage.setItem("heightUnit", settings.heightUnit);
      setProfile((prev) => {
        const updated = normalizeStoredProfile({
          ...prev,
          genderIdentity: settings.genderIdentity,
          pronouns: settings.pronouns,
          personality: settings.personality,
        });
        AsyncStorage.setItem("profile", JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    },
    []
  );

  const hydrateServerSettings = useCallback(
    async (token: string) => {
      try {
        const result = await getSettings(token);
        await applyServerSettings(result.settings);
      } catch {}
    },
    [applyServerSettings]
  );

  const hydrateDiscoveryState = useCallback(async (token: string) => {
    try {
      const result = await getDiscoveryPreferences(token);
      setLikedProfiles(result.likedProfileIds);
      setPopularAttributesByCategory(result.popularAttributesByCategory);
      setTotalLikesCount(result.totalLikesCount);
    } catch {
      setLikedProfiles([]);
      setPopularAttributesByCategory(createEmptyPopularAttributesByCategory());
      setTotalLikesCount(0);
    }
  }, []);

  const applySession = useCallback(
    async (session: {
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
      needsProfileCompletion: boolean;
      hasCompletedOnboarding: boolean;
    }) => {
      Keyboard.dismiss();
      setAccessToken(session.accessToken);
      setRefreshToken(session.refreshToken);
      setUser(session.user);
      setAuthFormPrefill(null);
      setPendingVerificationEmail(null);
      setPendingVerificationPassword(null);
      setVerificationStatus("idle");
      setAuthError(null);
      setNeedsProfileCompletion(session.needsProfileCompletion);
      setHasCompletedOnboarding(session.hasCompletedOnboarding);
      await Promise.all([
        AsyncStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, session.accessToken),
        AsyncStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, session.refreshToken),
      ]);
      setProfile((prev) => normalizeStoredProfile({
        ...prev,
        name: session.user.name || prev.name,
        dateOfBirth: session.user.dateOfBirth || prev.dateOfBirth,
      profession: session.user.profession || prev.profession,
    }));
      setAuthStatus("authenticated");
      await hydrateServerSettings(session.accessToken);
      await hydrateDiscoveryState(session.accessToken);
    },
    [hydrateDiscoveryState, hydrateServerSettings]
  );

  const hydrateSessionFromTokens = useCallback(
    async (tokens: { accessToken: string; refreshToken: string }) => {
      const me = await getMe(tokens.accessToken);
      await applySession({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: me.user,
        needsProfileCompletion: me.needsProfileCompletion,
        hasCompletedOnboarding: me.hasCompletedOnboarding,
      });
    },
    [applySession]
  );

  const completePendingVerificationSignIn = useCallback(async () => {
    if (!pendingVerificationEmail || !pendingVerificationPassword) {
      setSignInPrefill(pendingVerificationEmail);
      resetPendingVerificationState();
      setAuthStatus("unauthenticated");
      return false;
    }

    try {
      const session = await authSignIn({
        email: pendingVerificationEmail,
        password: pendingVerificationPassword,
      });
      await applySession(session);
      if (__DEV__) {
        console.log("[auth] pending verification auto-login succeeded");
      }
      return true;
    } catch (e: any) {
      if (__DEV__) {
        console.log("[auth] pending verification auto-login failed", e?.code || e?.message);
      }
      const code = e instanceof ApiError ? toReadableAuthError(e.code) : "UNKNOWN_ERROR";
      setAuthError(code);
      setSignInPrefill(pendingVerificationEmail);
      resetPendingVerificationState();
      setAuthStatus("unauthenticated");
      return false;
    }
  }, [
    applySession,
    pendingVerificationEmail,
    pendingVerificationPassword,
    resetPendingVerificationState,
    setSignInPrefill,
  ]);

  useEffect(() => {
    (async () => {
      try {
        const [
          lang,
          storedAccessToken,
          storedRefreshToken,
          savedGoals,
          savedProfile,
          savedBiometrics,
          savedHeightUnit,
        ] =
          await Promise.all([
            AsyncStorage.getItem("language"),
            AsyncStorage.getItem(ACCESS_TOKEN_STORAGE_KEY),
            AsyncStorage.getItem(REFRESH_TOKEN_STORAGE_KEY),
            AsyncStorage.getItem("goals"),
            AsyncStorage.getItem("profile"),
            AsyncStorage.getItem("biometricsEnabled"),
            AsyncStorage.getItem("heightUnit"),
          ]);

        if (lang === "es" || lang === "en") setLanguageState(lang);
        if (savedHeightUnit === "metric" || savedHeightUnit === "imperial") {
          setHeightUnitState(savedHeightUnit);
        }
        if (savedGoals) setGoals(normalizeStoredGoals(JSON.parse(savedGoals)));
        if (savedProfile) {
          const p = JSON.parse(savedProfile);
          setProfile(normalizeStoredProfile(p));
        }

        const bioEnabled = savedBiometrics === "true";
        setBiometricsEnabledState(bioEnabled);

        if (storedRefreshToken) {
          try {
            const session = await refreshSession(storedRefreshToken);
            await applySession(session);
            refreshProfileLocation().catch(() => {});
            if (bioEnabled && Platform.OS !== "web") {
              setBiometricLockRequired(true);
            }
          } catch {
            setAccessToken(null);
            setRefreshToken(null);
            if (storedAccessToken) {
              setUser(null);
            }
            await clearStoredSessionTokens();
            setAuthStatus("unauthenticated");
          }
        } else {
          setAuthStatus("unauthenticated");
        }
      } catch {
        setAuthStatus("unauthenticated");
      }
    })();
  }, [applySession, clearStoredSessionTokens, refreshProfileLocation]);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refreshProfileLocation().catch(() => {});
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshProfileLocation]);

  const saveSettings = useCallback(
    async (input: {
      name: string;
      dateOfBirth: string;
      profession: string;
      genderIdentity: string;
      pronouns: string;
      personality: string;
      language: "es" | "en";
      heightUnit: HeightUnit;
    }) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        if (accessToken) {
          const me = await updateMe(accessToken, {
            name: input.name,
            dateOfBirth: input.dateOfBirth,
            profession: input.profession,
          });
          await updateSettings(accessToken, {
            language: input.language,
            heightUnit: input.heightUnit,
            genderIdentity: input.genderIdentity,
            pronouns: input.pronouns,
            personality: input.personality,
          });
          setUser(me.user);
          setNeedsProfileCompletion(me.needsProfileCompletion);
          setHasCompletedOnboarding(me.hasCompletedOnboarding);
        }

        await applyServerSettings({
          language: input.language,
          heightUnit: input.heightUnit,
          genderIdentity: input.genderIdentity,
          pronouns: input.pronouns,
          personality: input.personality,
        });

        setProfile((prev) => {
          const updated = normalizeStoredProfile({
            ...prev,
            name: input.name,
            dateOfBirth: input.dateOfBirth,
            profession: input.profession,
            genderIdentity: input.genderIdentity,
            pronouns: input.pronouns,
            personality: input.personality,
          });
          AsyncStorage.setItem("profile", JSON.stringify(updated)).catch(() => {});
          return updated;
        });

        return true;
      } catch (e: any) {
        setAuthError(e?.code || e?.message || "UNKNOWN_ERROR");
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [accessToken, applyServerSettings]
  );

  const login = useCallback(async () => {
    await applySession({
      accessToken: "demo-access-token",
      refreshToken: "demo-refresh-token",
      user: {
        id: 1,
        email: "demo@matcha.app",
        name: "Alejandro",
        dateOfBirth: "1995-06-15",
        profession: "Demo User",
        emailVerified: true,
      },
      needsProfileCompletion: false,
      hasCompletedOnboarding: false,
    });
  }, [applySession]);

  const signIn = useCallback(
    async (input: { email: string; password: string }) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        const session = await authSignIn(input);
        setSignInPrefill(input.email);
        await applySession(session);
        return true;
      } catch (e: any) {
        const code = e instanceof ApiError ? toReadableAuthError(e.code) : "UNKNOWN_ERROR";
        setAuthError(code);
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [applySession]
  );

  const signUp = useCallback(
    async (input: { name: string; email: string; password: string; dateOfBirth: string }) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        const result = await authSignUp(input);
        if (result.status === "verification_pending") {
          setAuthStatus("verification_pending");
          setPendingVerificationEmail(result.email);
          setPendingVerificationPassword(input.password);
          setSignInPrefill(result.email);
          setVerificationStatus("pending");
        }
        return true;
      } catch (e: any) {
        const code = e instanceof ApiError ? toReadableAuthError(e.code) : "UNKNOWN_ERROR";
        setAuthError(code);
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [setSignInPrefill]
  );

  const signInWithProvider = useCallback(
    async (provider: AuthProvider, mode: "signin" | "signup") => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        const session = await authSignInWithProvider(provider, mode);
        await applySession(session);
        return true;
      } catch (e: any) {
        const code = e instanceof ApiError ? toReadableAuthError(e.code) : "UNKNOWN_ERROR";
        setAuthError(code);
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [applySession]
  );

  const handleAuthCallback = useCallback(
    async (payload: AuthCallbackPayload) => {
      Keyboard.dismiss();
      setAuthBusy(true);
      setAuthError(null);

      if (__DEV__) {
        console.log("[auth-callback] payload", {
          status: payload.status,
          provider: payload.provider,
          code: payload.code,
          email: payload.email,
        });
      }

      try {
        if (
          payload.status === "success" &&
          payload.accessToken &&
          payload.refreshToken
        ) {
          await hydrateSessionFromTokens({
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
          });
          return true;
        }

        if (payload.status === "already_verified" || payload.status === "verified") {
          if (payload.email) {
            setSignInPrefill(payload.email);
          }
          const loggedIn = await completePendingVerificationSignIn();
          if (loggedIn) {
            return true;
          }
          return false;
        }

        if (payload.email) {
          setSignInPrefill(payload.email);
        }
        resetPendingVerificationState();
        setAuthStatus("unauthenticated");
        setAuthError(
          toReadableAuthError(payload.code || "INVALID_VERIFICATION_TOKEN")
        );
        return false;
      } catch (e: any) {
        const code = e instanceof ApiError ? toReadableAuthError(e.code) : "UNKNOWN_ERROR";
        setAuthError(code);
        if (payload.email) {
          setSignInPrefill(payload.email);
        }
        resetPendingVerificationState();
        setAuthStatus("unauthenticated");
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [
      completePendingVerificationSignIn,
      hydrateSessionFromTokens,
      resetPendingVerificationState,
      setSignInPrefill,
    ]
  );

  const checkPendingVerificationStatus = useCallback(async () => {
    if (!pendingVerificationEmail) {
      return null;
    }

    setAuthError(null);
    setVerificationStatus("checking");

    try {
      const result = await authCheckVerificationStatus(pendingVerificationEmail);
      if (result.status === "verified") {
        const loggedIn = await completePendingVerificationSignIn();
        if (!loggedIn) {
          setVerificationStatus("idle");
        }
        return "verified";
      }

      setVerificationStatus("pending");
      return "pending";
    } catch (e: any) {
      const code = e instanceof ApiError ? toReadableAuthError(e.code) : "UNKNOWN_ERROR";
      setAuthError(code);
      setVerificationStatus("pending");
      return null;
    }
  }, [completePendingVerificationSignIn, pendingVerificationEmail]);

  const logout = useCallback(async () => {
    try {
      if (accessToken) await authSignOut(accessToken);
    } catch {}
    setAuthStatus("unauthenticated");
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    setBiometricLockRequired(false);
    setHasCompletedOnboarding(false);
    setAuthError(null);
    setAuthFormPrefill(null);
    setPendingVerificationEmail(null);
    setPendingVerificationPassword(null);
    setVerificationStatus("idle");
    setLikedProfiles([]);
    setPopularAttributesByCategory(createEmptyPopularAttributesByCategory());
    setTotalLikesCount(0);
    await clearStoredSessionTokens();
  }, [accessToken, clearStoredSessionTokens]);

  const completeProfile = useCallback(
    async (data: { name: string; dateOfBirth: string }) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        if (accessToken) {
          const result = await updateMe(accessToken, data);
          setUser(result.user);
          setNeedsProfileCompletion(result.needsProfileCompletion);
          setHasCompletedOnboarding(result.hasCompletedOnboarding);
        }
        const updated = normalizeStoredProfile({
          ...profile,
          name: data.name,
          dateOfBirth: data.dateOfBirth,
          profession: profile.profession,
        });
        setProfile(updated);
        await AsyncStorage.setItem("profile", JSON.stringify(updated));
        setNeedsProfileCompletion(false);
        return true;
      } catch (e: any) {
        setAuthError(e?.message || "UNKNOWN_ERROR");
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [profile, accessToken]
  );

  const saveOnboardingDraft = useCallback(
    async (data: {
      genderIdentity: string;
      pronouns: string;
      personality: string;
      relationshipGoals: string;
      childrenPreference: string;
      languagesSpoken: string[];
      education: string;
      physicalActivity: string;
      bodyType: string;
      photos: string[];
    }) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        if (accessToken) {
          await updateSettings(accessToken, {
            genderIdentity: data.genderIdentity,
            pronouns: data.pronouns,
            personality: data.personality,
          });
        }

        setProfile((prev) => {
          const updated = normalizeStoredProfile({
            ...prev,
            genderIdentity: data.genderIdentity,
            pronouns: data.pronouns,
            personality: data.personality,
            relationshipGoals: data.relationshipGoals,
            childrenPreference: data.childrenPreference,
            languagesSpoken: data.languagesSpoken,
            education: data.education,
            physicalActivity: data.physicalActivity,
            bodyType: data.bodyType,
            photos: data.photos,
          });
          AsyncStorage.setItem("profile", JSON.stringify(updated)).catch(() => {});
          return updated;
        });
        return true;
      } catch (e: any) {
        setAuthError(e?.code || e?.message || "UNKNOWN_ERROR");
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [accessToken]
  );

  const finishOnboarding = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      if (accessToken) {
        const result = await completeOnboardingRequest(accessToken);
        setHasCompletedOnboarding(result.hasCompletedOnboarding);
      } else {
        setHasCompletedOnboarding(true);
      }
      return true;
    } catch (e: any) {
      setAuthError(e?.code || e?.message || "UNKNOWN_ERROR");
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, [accessToken]);

  const unlockWithBiometrics = useCallback(async (): Promise<BiometricResult> => {
    if (Platform.OS === "web") {
      setBiometricLockRequired(false);
      return { ok: true };
    }
    setBiometricBusy(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) return { ok: false, code: "BIOMETRICS_UNAVAILABLE" };
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) return { ok: false, code: "BIOMETRICS_NOT_ENROLLED" };
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Desbloquear MatchA",
        fallbackLabel: "Usar contraseña",
        cancelLabel: "Cancelar",
      });
      if (result.success) {
        setBiometricLockRequired(false);
        return { ok: true };
      }
      if (result.error === "user_cancel" || result.error === "system_cancel") {
        return { ok: false, code: "BIOMETRIC_CANCELLED" };
      }
      return { ok: false, code: "BIOMETRIC_AUTH_FAILED" };
    } catch {
      return { ok: false, code: "BIOMETRIC_AUTH_FAILED" };
    } finally {
      setBiometricBusy(false);
    }
  }, []);

  const setBiometricsEnabled = useCallback(
    async (enabled: boolean): Promise<BiometricResult> => {
      if (Platform.OS === "web") {
        return { ok: false, code: "BIOMETRICS_UNAVAILABLE" };
      }
      if (enabled) {
        const available = await checkBiometricHardware();
        if (!available) {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          if (!hasHardware) return { ok: false, code: "BIOMETRICS_UNAVAILABLE" };
          return { ok: false, code: "BIOMETRICS_NOT_ENROLLED" };
        }
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Confirmar biometría",
          cancelLabel: "Cancelar",
        });
        if (!result.success) return { ok: false, code: "BIOMETRIC_CANCELLED" };
      }
      setBiometricsEnabledState(enabled);
      await AsyncStorage.setItem("biometricsEnabled", enabled ? "true" : "false");
      return { ok: true };
    },
    []
  );

  const completeGoalTask = useCallback((id: string) => {
    setGoals((prev) => {
      const targetGoal = prev.find((goal) => goal.id === id);
      if (!targetGoal || targetGoal.completed) {
        return prev;
      }

      const categoryGoals = prev
        .filter((goal) => goal.category === targetGoal.category)
        .sort((a, b) => a.order - b.order);
      const remainingActive = categoryGoals.filter(
        (goal) => !goal.completed && goal.id !== id
      );
      const completedGoals = categoryGoals.filter(
        (goal) => goal.completed && goal.id !== id
      );
      const completedTarget = {
        ...targetGoal,
        completed: true,
      };

      const reorderedCategory = [
        ...remainingActive,
        ...completedGoals,
        completedTarget,
      ].map((goal, index) => ({
        ...goal,
        order: index,
      }));

      const otherGoals = prev.filter((goal) => goal.category !== targetGoal.category);
      const updated = normalizeStoredGoals([...otherGoals, ...reorderedCategory]);
      AsyncStorage.setItem("goals", JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const reorderGoalTasks = useCallback(
    (category: GoalCategory, fromIndex: number, toIndex: number) => {
      setGoals((prev) => {
        const categoryGoals = prev
          .filter((goal) => goal.category === category)
          .sort((a, b) => a.order - b.order);
        const activeGoals = categoryGoals.filter((goal) => !goal.completed);
        const completedGoals = categoryGoals.filter((goal) => goal.completed);

        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= activeGoals.length ||
          toIndex >= activeGoals.length ||
          fromIndex === toIndex
        ) {
          return prev;
        }

        const reorderedActive = [...activeGoals];
        const [moved] = reorderedActive.splice(fromIndex, 1);
        reorderedActive.splice(toIndex, 0, moved);

        const normalizedCategory = [...reorderedActive, ...completedGoals].map(
          (goal, index) => ({
            ...goal,
            order: index,
          })
        );

        const otherGoals = prev.filter((goal) => goal.category !== category);
        const updated = normalizeStoredGoals([...otherGoals, ...normalizedCategory]);
        AsyncStorage.setItem("goals", JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    },
    []
  );

  const likeProfile = useCallback(
    async (profileId: string) => {
      if (!accessToken) {
        return null;
      }

      const categoryValues = getDiscoverProfilePopularInput(profileId);
      if (!categoryValues) {
        return null;
      }

      try {
        const result = await likeDiscoveryProfile(accessToken, {
          likedProfileId: profileId,
          categoryValues,
        });
        setLikedProfiles(result.likedProfileIds);
        setPopularAttributesByCategory(result.popularAttributesByCategory);
        setTotalLikesCount(result.totalLikesCount);
        return result;
      } catch {
        return null;
      }
    },
    [accessToken]
  );

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile((prev) => {
      const updated = normalizeStoredProfile({ ...prev, ...updates });
      AsyncStorage.setItem("profile", JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const setProfilePhoto = useCallback((index: number, uri: string) => {
    setProfile((prev) => {
      const photos = [...prev.photos];
      photos[index] = uri;
      const updated = normalizeStoredProfile({ ...prev, photos });
      AsyncStorage.setItem("profile", JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const removeProfilePhoto = useCallback((index: number) => {
    setProfile((prev) => {
      const photos = prev.photos.filter((_, i) => i !== index);
      const updated = normalizeStoredProfile({ ...prev, photos });
      AsyncStorage.setItem("profile", JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  return (
    <AppContext.Provider
      value={{
        authStatus,
        login,
        logout,
        signIn,
        signUp,
        signInWithProvider,
        user,
        authBusy,
        authError,
        authFormPrefill,
        pendingVerificationEmail,
        verificationStatus,
        checkPendingVerificationStatus,
        resetPendingVerificationState,
        handleAuthCallback,
        clearAuthFeedback,
        providerAvailability,
        needsProfileCompletion,
        hasCompletedOnboarding,
        completeProfile,
        saveOnboardingDraft,
        finishOnboarding,
        biometricLockRequired,
        biometricBusy,
        biometricsEnabled,
        unlockWithBiometrics,
        setBiometricsEnabled,
        language,
        setLanguage,
        heightUnit,
        setHeightUnit,
        saveSettings,
        t,
        goals,
        completeGoalTask,
        reorderGoalTasks,
        popularAttributesByCategory,
        totalLikesCount,
        likedProfiles,
        likeProfile,
        profile,
        accountProfile: { ...normalizeStoredProfile(profile), email: user?.email || "" },
        updateProfile,
        setProfilePhoto,
        removeProfilePhoto,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

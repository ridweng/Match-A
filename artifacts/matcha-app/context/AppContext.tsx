import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";

import {
  type AuthUser,
  type ProviderAvailability,
  type AuthProvider,
  fetchProviderAvailability,
  getSettings,
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

export type { AuthUser };

export type Goal = {
  id: string;
  titleEs: string;
  titleEn: string;
  category: "fisica" | "personalidad" | "habitos" | "social";
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
  genderIdentity: string;
  pronouns: string;
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

type BiometricResult = { ok: boolean; code?: string };

const DEFAULT_GOALS: Goal[] = [
  {
    id: "1",
    titleEs: "Resistencia cardiovascular",
    titleEn: "Cardiovascular endurance",
    category: "fisica",
    progress: 68,
    nextActionEs: "Corre 20 min hoy sin parar",
    nextActionEn: "Run 20 min today without stopping",
    impactEs: "Más energía y mejor postura",
    impactEn: "More energy and better posture",
  },
  {
    id: "2",
    titleEs: "Confianza social",
    titleEn: "Social confidence",
    category: "social",
    progress: 42,
    nextActionEs: "Inicia una conversación con un extraño",
    nextActionEn: "Start a conversation with a stranger",
    impactEs: "Más atractivo en interacciones sociales",
    impactEn: "More attractive in social interactions",
  },
  {
    id: "3",
    titleEs: "Higiene y cuidado personal",
    titleEn: "Hygiene and grooming",
    category: "habitos",
    progress: 85,
    nextActionEs: "Hidrata tu piel antes de dormir",
    nextActionEn: "Moisturize your skin before sleep",
    impactEs: "Primera impresión significativamente mejor",
    impactEn: "Significantly better first impression",
  },
  {
    id: "4",
    titleEs: "Inteligencia emocional",
    titleEn: "Emotional intelligence",
    category: "personalidad",
    progress: 55,
    nextActionEs: "Escucha activa en tu próxima conversación",
    nextActionEn: "Active listening in your next conversation",
    impactEs: "Conexiones más profundas y auténticas",
    impactEn: "Deeper and more authentic connections",
  },
  {
    id: "5",
    titleEs: "Postura corporal",
    titleEn: "Body posture",
    category: "fisica",
    progress: 30,
    nextActionEs: "10 min de ejercicios de postura ahora",
    nextActionEn: "10 min posture exercises right now",
    impactEs: "Proyectas más confianza y presencia",
    impactEn: "Project more confidence and presence",
  },
  {
    id: "6",
    titleEs: "Habilidades de conversación",
    titleEn: "Conversation skills",
    category: "social",
    progress: 60,
    nextActionEs: "Aprende 3 preguntas abiertas interesantes",
    nextActionEn: "Learn 3 interesting open-ended questions",
    impactEs: "Conversaciones más atractivas y fluidas",
    impactEn: "More engaging and fluid conversations",
  },
];

const DEFAULT_PROFILE: UserProfile = {
  name: "",
  age: "",
  dateOfBirth: "",
  genderIdentity: "",
  pronouns: "",
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
  authNotice: string | null;
  pendingVerificationEmail: string | null;
  verificationPreviewUrl: string | null;
  clearAuthFeedback: () => void;
  providerAvailability: ProviderAvailability;
  needsProfileCompletion: boolean;
  completeProfile: (data: { name: string; dateOfBirth: string }) => Promise<boolean>;
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
    genderIdentity: string;
    pronouns: string;
    language: "es" | "en";
    heightUnit: HeightUnit;
  }) => Promise<boolean>;
  t: (es: string, en: string) => string;
  goals: Goal[];
  updateGoalProgress: (id: string, progress: number) => void;
  likedProfiles: string[];
  likeProfile: (profileId: string) => void;
  profile: UserProfile;
  accountProfile: AccountProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
  setProfilePhoto: (index: number, uri: string) => void;
  removeProfilePhoto: (index: number) => void;
};

const AppContext = createContext<AppContextType | null>(null);

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
  const [language, setLanguageState] = useState<"es" | "en">("es");
  const [heightUnit, setHeightUnitState] = useState<HeightUnit>("metric");
  const [goals, setGoals] = useState<Goal[]>(DEFAULT_GOALS);
  const [likedProfiles, setLikedProfiles] = useState<string[]>([]);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [verificationPreviewUrl, setVerificationPreviewUrl] = useState<string | null>(null);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
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
    setAuthNotice(null);
  }, []);

  const applyServerSettings = useCallback(
    async (settings: {
      language: "es" | "en";
      heightUnit: HeightUnit;
      genderIdentity: string;
      pronouns: string;
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

  const applySession = useCallback(
    async (session: {
      accessToken: string;
      refreshToken?: string;
      user: AuthUser;
      needsProfileCompletion: boolean;
    }) => {
      setAccessToken(session.accessToken);
      setUser(session.user);
      setNeedsProfileCompletion(session.needsProfileCompletion);
      await AsyncStorage.setItem("accessToken", session.accessToken);
      setProfile((prev) => normalizeStoredProfile({
        ...prev,
        name: session.user.name || prev.name,
        dateOfBirth: session.user.dateOfBirth || prev.dateOfBirth,
      }));
      setAuthStatus("authenticated");
      await hydrateServerSettings(session.accessToken);
    },
    [hydrateServerSettings]
  );

  useEffect(() => {
    (async () => {
      try {
        const [lang, storedToken, savedGoals, savedProfile, savedBiometrics, savedHeightUnit] =
          await Promise.all([
            AsyncStorage.getItem("language"),
            AsyncStorage.getItem("accessToken"),
            AsyncStorage.getItem("goals"),
            AsyncStorage.getItem("profile"),
            AsyncStorage.getItem("biometricsEnabled"),
            AsyncStorage.getItem("heightUnit"),
          ]);

        if (lang === "es" || lang === "en") setLanguageState(lang);
        if (savedHeightUnit === "metric" || savedHeightUnit === "imperial") {
          setHeightUnitState(savedHeightUnit);
        }
        if (savedGoals) setGoals(JSON.parse(savedGoals));
        if (savedProfile) {
          const p = JSON.parse(savedProfile);
          setProfile(normalizeStoredProfile(p));
        }

        const bioEnabled = savedBiometrics === "true";
        setBiometricsEnabledState(bioEnabled);

        if (storedToken) {
          try {
            const session = await refreshSession(storedToken);
            await applySession(session);
            if (bioEnabled && Platform.OS !== "web") {
              setBiometricLockRequired(true);
            }
          } catch {
            await AsyncStorage.removeItem("accessToken");
            setAuthStatus("unauthenticated");
          }
        } else {
          setAuthStatus("unauthenticated");
        }
      } catch {
        setAuthStatus("unauthenticated");
      }
    })();
  }, [applySession]);

  const saveSettings = useCallback(
    async (input: {
      name: string;
      dateOfBirth: string;
      genderIdentity: string;
      pronouns: string;
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
          });
          await updateSettings(accessToken, {
            language: input.language,
            heightUnit: input.heightUnit,
            genderIdentity: input.genderIdentity,
            pronouns: input.pronouns,
          });
          setUser(me.user);
          setNeedsProfileCompletion(me.needsProfileCompletion);
        }

        await applyServerSettings({
          language: input.language,
          heightUnit: input.heightUnit,
          genderIdentity: input.genderIdentity,
          pronouns: input.pronouns,
        });

        setProfile((prev) => {
          const updated = normalizeStoredProfile({
            ...prev,
            name: input.name,
            dateOfBirth: input.dateOfBirth,
            genderIdentity: input.genderIdentity,
            pronouns: input.pronouns,
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
      user: {
        id: 1,
        email: "demo@matcha.app",
        name: "Alejandro",
        dateOfBirth: "1995-06-15",
        emailVerified: true,
      },
      needsProfileCompletion: false,
    });
  }, [applySession]);

  const signIn = useCallback(
    async (input: { email: string; password: string }) => {
      setAuthBusy(true);
      setAuthError(null);
      setAuthNotice(null);
      try {
        const session = await authSignIn(input);
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
      setAuthNotice(null);
      try {
        const result = await authSignUp(input);
        if (result.status === "verification_pending") {
          setAuthStatus("verification_pending");
          setPendingVerificationEmail(result.email);
          setVerificationPreviewUrl(result.verificationPreviewUrl || null);
          setAuthNotice("VERIFICATION_EMAIL_SENT");
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
    []
  );

  const signInWithProvider = useCallback(
    async (provider: AuthProvider, mode: "signin" | "signup") => {
      setAuthBusy(true);
      setAuthError(null);
      setAuthNotice(null);
      try {
        const session = await authSignInWithProvider(provider, mode);
        await applySession({
          accessToken: session.accessToken,
          user: session.user,
          needsProfileCompletion: session.needsProfileCompletion,
        });
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

  const logout = useCallback(async () => {
    try {
      if (accessToken) await authSignOut(accessToken);
    } catch {}
    setAuthStatus("unauthenticated");
    setUser(null);
    setAccessToken(null);
    setBiometricLockRequired(false);
    setAuthError(null);
    setAuthNotice(null);
    await AsyncStorage.removeItem("accessToken");
  }, [accessToken]);

  const completeProfile = useCallback(
    async (data: { name: string; dateOfBirth: string }) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        if (accessToken) {
          const result = await updateMe(accessToken, data);
          setUser(result.user);
          setNeedsProfileCompletion(result.needsProfileCompletion);
        }
        const updated = normalizeStoredProfile({
          ...profile,
          name: data.name,
          dateOfBirth: data.dateOfBirth,
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

  const updateGoalProgress = useCallback((id: string, progress: number) => {
    setGoals((prev) => {
      const updated = prev.map((g) => (g.id === id ? { ...g, progress } : g));
      AsyncStorage.setItem("goals", JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const likeProfile = useCallback((profileId: string) => {
    setLikedProfiles((prev) =>
      prev.includes(profileId) ? prev : [...prev, profileId]
    );
  }, []);

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
        authNotice,
        pendingVerificationEmail,
        verificationPreviewUrl,
        clearAuthFeedback,
        providerAvailability,
        needsProfileCompletion,
        completeProfile,
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
        updateGoalProgress,
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

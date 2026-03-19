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
  email?: string;
  bio: string;
  bodyType: string;
  height: string;
  hairColor: string;
  ethnicity: string;
  interests: string[];
  photos: string[];
};

export type AuthUser = {
  id: number;
  email: string | null;
  name: string;
  dateOfBirth: string | null;
  emailVerified: boolean;
};

type AuthStatus = "loading" | "unauthenticated" | "authenticated";

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
  name: "Alejandro",
  age: "29",
  dateOfBirth: "",
  email: "",
  bio: "",
  bodyType: "",
  height: "",
  hairColor: "",
  ethnicity: "",
  interests: [],
  photos: [],
};

type AppContextType = {
  authStatus: AuthStatus;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  user: AuthUser | null;
  authBusy: boolean;
  authError: string | null;
  clearAuthFeedback: () => void;
  needsProfileCompletion: boolean;
  completeProfile: (data: { name: string; dateOfBirth: string }) => Promise<void>;
  biometricLockRequired: boolean;
  biometricBusy: boolean;
  biometricsEnabled: boolean;
  unlockWithBiometrics: () => Promise<BiometricResult>;
  setBiometricsEnabled: (enabled: boolean) => Promise<BiometricResult>;
  language: "es" | "en";
  setLanguage: (lang: "es" | "en") => Promise<void>;
  t: (es: string, en: string) => string;
  goals: Goal[];
  updateGoalProgress: (id: string, progress: number) => void;
  likedProfiles: string[];
  likeProfile: (profileId: string) => void;
  profile: UserProfile;
  accountProfile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
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
  const [language, setLanguageState] = useState<"es" | "en">("es");
  const [goals, setGoals] = useState<Goal[]>(DEFAULT_GOALS);
  const [likedProfiles, setLikedProfiles] = useState<string[]>([]);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);
  const [biometricLockRequired, setBiometricLockRequired] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [
          lang,
          logged,
          savedGoals,
          savedProfile,
          savedBiometrics,
        ] = await Promise.all([
          AsyncStorage.getItem("language"),
          AsyncStorage.getItem("isLoggedIn"),
          AsyncStorage.getItem("goals"),
          AsyncStorage.getItem("profile"),
          AsyncStorage.getItem("biometricsEnabled"),
        ]);

        if (lang === "es" || lang === "en") setLanguageState(lang);
        if (savedGoals) setGoals(JSON.parse(savedGoals));
        if (savedProfile) setProfile(JSON.parse(savedProfile));

        const bioEnabled = savedBiometrics === "true";
        setBiometricsEnabledState(bioEnabled);

        if (logged === "true") {
          setAuthStatus("authenticated");
          setUser({
            id: 1,
            email: "user@matcha.app",
            name: "Alejandro",
            dateOfBirth: null,
            emailVerified: true,
          });
          if (bioEnabled && Platform.OS !== "web") {
            setBiometricLockRequired(true);
          }
        } else {
          setAuthStatus("unauthenticated");
        }
      } catch {
        setAuthStatus("unauthenticated");
      }
    })();
  }, []);

  const t = useCallback(
    (es: string, en: string) => (language === "es" ? es : en),
    [language]
  );

  const setLanguage = useCallback(async (lang: "es" | "en") => {
    setLanguageState(lang);
    await AsyncStorage.setItem("language", lang);
  }, []);

  const login = useCallback(async () => {
    setAuthStatus("authenticated");
    setNeedsProfileCompletion(false);
    setUser({
      id: 1,
      email: "user@matcha.app",
      name: "Alejandro",
      dateOfBirth: null,
      emailVerified: true,
    });
    await AsyncStorage.setItem("isLoggedIn", "true");
  }, []);

  const logout = useCallback(async () => {
    setAuthStatus("unauthenticated");
    setUser(null);
    setBiometricLockRequired(false);
    await AsyncStorage.setItem("isLoggedIn", "false");
  }, []);

  const clearAuthFeedback = useCallback(() => {
    setAuthError(null);
  }, []);

  const completeProfile = useCallback(
    async (data: { name: string; dateOfBirth: string }) => {
      setAuthBusy(true);
      try {
        const updated = { ...profile, name: data.name, dateOfBirth: data.dateOfBirth };
        setProfile(updated);
        await AsyncStorage.setItem("profile", JSON.stringify(updated));
        if (user) {
          setUser({ ...user, name: data.name, dateOfBirth: data.dateOfBirth });
        }
        setNeedsProfileCompletion(false);
      } catch (e: any) {
        setAuthError(e?.message || "UNKNOWN_ERROR");
      } finally {
        setAuthBusy(false);
      }
    },
    [profile, user]
  );

  const unlockWithBiometrics = useCallback(async (): Promise<BiometricResult> => {
    if (Platform.OS === "web") {
      setBiometricLockRequired(false);
      return { ok: true };
    }
    setBiometricBusy(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        return { ok: false, code: "BIOMETRICS_UNAVAILABLE" };
      }
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        return { ok: false, code: "BIOMETRICS_NOT_ENROLLED" };
      }
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
        if (!result.success) {
          return { ok: false, code: "BIOMETRIC_CANCELLED" };
        }
      }
      setBiometricsEnabledState(enabled);
      await AsyncStorage.setItem("biometricsEnabled", enabled ? "true" : "false");
      return { ok: true };
    },
    []
  );

  const updateGoalProgress = useCallback(async (id: string, progress: number) => {
    setGoals((prev) => {
      const updated = prev.map((g) => (g.id === id ? { ...g, progress } : g));
      AsyncStorage.setItem("goals", JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const likeProfile = useCallback(async (profileId: string) => {
    setLikedProfiles((prev) =>
      prev.includes(profileId) ? prev : [...prev, profileId]
    );
  }, []);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile((prev) => {
      const updated = { ...prev, ...updates };
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
        user,
        authBusy,
        authError,
        clearAuthFeedback,
        needsProfileCompletion,
        completeProfile,
        biometricLockRequired,
        biometricBusy,
        biometricsEnabled,
        unlockWithBiometrics,
        setBiometricsEnabled,
        language,
        setLanguage,
        t,
        goals,
        updateGoalProgress,
        likedProfiles,
        likeProfile,
        profile,
        accountProfile: { ...profile, email: user?.email || "" },
        updateProfile,
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

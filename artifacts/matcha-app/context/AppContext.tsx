import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ApiError,
  extractAuthCallback,
  fetchProviderAvailability,
  getMe,
  refreshSession,
  signIn,
  signInWithProvider,
  signOut,
  signUp,
  toReadableAuthError,
  updateMe,
  type AuthProvider,
  type AuthUser,
  type ProviderAvailability,
} from "@/services/auth";

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
  bio: string;
  bodyType: string;
  height: string;
  hairColor: string;
  ethnicity: string;
  interests: string[];
};

export type AuthStatus =
  | "loading"
  | "anonymous"
  | "authenticated"
  | "verification_pending";

type SessionState = {
  accessToken: string;
  refreshToken: string;
};

type AppContextType = {
  authStatus: AuthStatus;
  authBusy: boolean;
  authError: string | null;
  authNotice: string | null;
  isLoggedIn: boolean;
  user: AuthUser | null;
  needsProfileCompletion: boolean;
  pendingVerificationEmail: string | null;
  verificationPreviewUrl: string | null;
  providerAvailability: ProviderAvailability;
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
  completeProfile: (input: {
    name?: string;
    dateOfBirth?: string;
  }) => Promise<boolean>;
  logout: () => Promise<void>;
  clearAuthFeedback: () => void;
  refreshProviderSupport: () => Promise<void>;
  language: "es" | "en";
  setLanguage: (lang: "es" | "en") => Promise<void>;
  t: (es: string, en: string) => string;
  goals: Goal[];
  updateGoalProgress: (id: string, progress: number) => void;
  likedProfiles: string[];
  likeProfile: (profileId: string) => void;
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
};

const LANGUAGE_KEY = "language";
const GOALS_KEY = "goals";
const PROFILE_KEY = "profile";
const LIKED_PROFILES_KEY = "likedProfiles";
const SESSION_KEY = "auth.session.v1";

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
  bio: "",
  bodyType: "",
  height: "",
  hairColor: "",
  ethnicity: "",
  interests: [],
};

const DEFAULT_PROVIDER_AVAILABILITY: ProviderAvailability = {
  google: false,
  facebook: false,
  apple: false,
};

const AppContext = createContext<AppContextType | null>(null);

function calculateAge(dateOfBirth: string | null) {
  if (!dateOfBirth) return "";
  const birth = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime())) return "";
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const month = now.getUTCMonth() - birth.getUTCMonth();
  const day = now.getUTCDate() - birth.getUTCDate();
  if (month < 0 || (month === 0 && day < 0)) {
    age -= 1;
  }
  return String(age);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [verificationPreviewUrl, setVerificationPreviewUrl] = useState<string | null>(
    null
  );
  const [providerAvailability, setProviderAvailability] = useState<ProviderAvailability>(
    DEFAULT_PROVIDER_AVAILABILITY
  );

  const [language, setLanguageState] = useState<"es" | "en">("es");
  const [goals, setGoals] = useState<Goal[]>(DEFAULT_GOALS);
  const [likedProfiles, setLikedProfiles] = useState<string[]>([]);
  const [profile, setProfileState] = useState<UserProfile>(DEFAULT_PROFILE);

  const clearAuthFeedback = useCallback(() => {
    setAuthError(null);
    setAuthNotice(null);
  }, []);

  const persistSession = useCallback(async (nextSession: SessionState | null) => {
    if (!nextSession) {
      await AsyncStorage.removeItem(SESSION_KEY);
      return;
    }
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
  }, []);

  const syncProfileFromUser = useCallback((nextUser: AuthUser | null) => {
    if (!nextUser) return;
    setProfileState((prev) => {
      const merged = {
        ...prev,
        name: nextUser.name || prev.name,
        age: prev.age || calculateAge(nextUser.dateOfBirth),
      };
      AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
      return merged;
    });
  }, []);

  const applyAuthenticatedSession = useCallback(
    async (payload: {
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
      needsProfileCompletion: boolean;
    }) => {
      const nextSession = {
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
      };
      setSession(nextSession);
      setUser(payload.user);
      setNeedsProfileCompletion(payload.needsProfileCompletion);
      setAuthStatus("authenticated");
      setAuthError(null);
      setPendingVerificationEmail(null);
      setVerificationPreviewUrl(null);
      await persistSession(nextSession);
      syncProfileFromUser(payload.user);
    },
    [persistSession, syncProfileFromUser]
  );

  const clearSession = useCallback(async () => {
    setSession(null);
    setUser(null);
    setNeedsProfileCompletion(false);
    setAuthStatus("anonymous");
    await persistSession(null);
  }, [persistSession]);

  const refreshProviderSupport = useCallback(async () => {
    const availability = await fetchProviderAvailability();
    setProviderAvailability(availability);
  }, []);

  useEffect(() => {
    let active = true;

    const restore = async () => {
      try {
        const [storedLanguage, storedGoals, storedProfile, storedLikes, storedSession] =
          await Promise.all([
            AsyncStorage.getItem(LANGUAGE_KEY),
            AsyncStorage.getItem(GOALS_KEY),
            AsyncStorage.getItem(PROFILE_KEY),
            AsyncStorage.getItem(LIKED_PROFILES_KEY),
            AsyncStorage.getItem(SESSION_KEY),
          ]);

        if (!active) return;

        if (storedLanguage === "es" || storedLanguage === "en") {
          setLanguageState(storedLanguage);
        }
        if (storedGoals) {
          setGoals(JSON.parse(storedGoals));
        }
        if (storedProfile) {
          setProfileState(JSON.parse(storedProfile));
        }
        if (storedLikes) {
          setLikedProfiles(JSON.parse(storedLikes));
        }

        await refreshProviderSupport();

        if (!storedSession) {
          setAuthStatus("anonymous");
          return;
        }

        const parsedSession = JSON.parse(storedSession) as SessionState;
        try {
          const me = await getMe(parsedSession.accessToken);
          if (!active) return;
          setSession(parsedSession);
          setUser(me.user);
          setNeedsProfileCompletion(me.needsProfileCompletion);
          setAuthStatus("authenticated");
          syncProfileFromUser(me.user);
          return;
        } catch (error) {
          if (!(error instanceof ApiError)) {
            throw error;
          }
        }

        try {
          const refreshed = await refreshSession(parsedSession.refreshToken);
          if (!active) return;
          await applyAuthenticatedSession(refreshed);
        } catch {
          await clearSession();
        }
      } catch {
        if (active) {
          setAuthStatus("anonymous");
        }
      }
    };

    restore();

    return () => {
      active = false;
    };
  }, [applyAuthenticatedSession, clearSession, refreshProviderSupport, syncProfileFromUser]);

  useEffect(() => {
    const handleAuthLink = async (url: string | null) => {
      if (!url) return;
      const callback = extractAuthCallback(url);
      if (callback.status === "verified") {
        setAuthNotice(
          language === "es"
            ? "Correo verificado. Ahora puedes iniciar sesión."
            : "Email verified. You can sign in now."
        );
        setAuthStatus((current) => (current === "loading" ? "anonymous" : current));
      }
    };

    Linking.getInitialURL().then(handleAuthLink).catch(() => {});
    const subscription = Linking.addEventListener("url", (event) => {
      handleAuthLink(event.url).catch(() => {});
    });

    return () => {
      subscription.remove();
    };
  }, [language]);

  const t = useCallback(
    (es: string, en: string) => (language === "es" ? es : en),
    [language]
  );

  const setLanguage = useCallback(async (lang: "es" | "en") => {
    setLanguageState(lang);
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  }, []);

  const handleSignUp = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      dateOfBirth: string;
    }) => {
      setAuthBusy(true);
      clearAuthFeedback();
      try {
        const response = await signUp(input);
        setAuthStatus("verification_pending");
        setPendingVerificationEmail(response.email);
        setVerificationPreviewUrl(response.verificationPreviewUrl || null);
        setAuthNotice(
          language === "es"
            ? "Revisa tu correo para verificar la cuenta."
            : "Check your email to verify your account."
        );
        return true;
      } catch (error) {
        setAuthError(
          toReadableAuthError(error instanceof ApiError ? error.code : "SIGN_UP_FAILED")
        );
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [clearAuthFeedback, language]
  );

  const handleSignIn = useCallback(
    async (input: { email: string; password: string }) => {
      setAuthBusy(true);
      clearAuthFeedback();
      try {
        const response = await signIn(input);
        await applyAuthenticatedSession(response);
        return true;
      } catch (error) {
        setAuthError(
          toReadableAuthError(error instanceof ApiError ? error.code : "SIGN_IN_FAILED")
        );
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [applyAuthenticatedSession, clearAuthFeedback]
  );

  const handleProviderSignIn = useCallback(
    async (provider: AuthProvider, mode: "signin" | "signup") => {
      setAuthBusy(true);
      clearAuthFeedback();
      try {
        if (!providerAvailability[provider]) {
          throw new ApiError("PROVIDER_UNAVAILABLE");
        }
        const response = await signInWithProvider(provider, mode);
        await applyAuthenticatedSession(response);
        return true;
      } catch (error) {
        setAuthError(
          toReadableAuthError(
            error instanceof ApiError ? error.code : "SOCIAL_AUTH_FAILED"
          )
        );
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [applyAuthenticatedSession, clearAuthFeedback, providerAvailability]
  );

  const completeProfile = useCallback(
    async (input: { name?: string; dateOfBirth?: string }) => {
      if (!session) return false;
      setAuthBusy(true);
      clearAuthFeedback();
      try {
        const response = await updateMe(session.accessToken, input);
        setUser(response.user);
        setNeedsProfileCompletion(response.needsProfileCompletion);
        syncProfileFromUser(response.user);
        return true;
      } catch (error) {
        setAuthError(
          toReadableAuthError(
            error instanceof ApiError ? error.code : "PROFILE_UPDATE_FAILED"
          )
        );
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [clearAuthFeedback, session, syncProfileFromUser]
  );

  const logout = useCallback(async () => {
    if (session?.accessToken) {
      try {
        await signOut(session.accessToken);
      } catch {}
    }
    clearAuthFeedback();
    setPendingVerificationEmail(null);
    setVerificationPreviewUrl(null);
    await clearSession();
  }, [clearAuthFeedback, clearSession, session?.accessToken]);

  const updateGoalProgress = useCallback(async (id: string, progress: number) => {
    setGoals((prev) => {
      const updated = prev.map((goal) =>
        goal.id === id ? { ...goal, progress } : goal
      );
      AsyncStorage.setItem(GOALS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const likeProfile = useCallback(async (profileId: string) => {
    setLikedProfiles((prev) => {
      if (prev.includes(profileId)) return prev;
      const updated = [...prev, profileId];
      AsyncStorage.setItem(LIKED_PROFILES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const setProfile = useCallback((nextProfile: UserProfile) => {
    setProfileState(nextProfile);
    AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
  }, []);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfileState((prev) => {
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value = useMemo<AppContextType>(
    () => ({
      authStatus,
      authBusy,
      authError,
      authNotice,
      isLoggedIn: authStatus === "authenticated",
      user,
      needsProfileCompletion,
      pendingVerificationEmail,
      verificationPreviewUrl,
      providerAvailability,
      signIn: handleSignIn,
      signUp: handleSignUp,
      signInWithProvider: handleProviderSignIn,
      completeProfile,
      logout,
      clearAuthFeedback,
      refreshProviderSupport,
      language,
      setLanguage,
      t,
      goals,
      updateGoalProgress,
      likedProfiles,
      likeProfile,
      profile,
      setProfile,
      updateProfile,
    }),
    [
      authStatus,
      authBusy,
      authError,
      authNotice,
      user,
      needsProfileCompletion,
      pendingVerificationEmail,
      verificationPreviewUrl,
      providerAvailability,
      handleSignIn,
      handleSignUp,
      handleProviderSignIn,
      completeProfile,
      logout,
      clearAuthFeedback,
      refreshProviderSupport,
      language,
      setLanguage,
      t,
      goals,
      updateGoalProgress,
      likedProfiles,
      likeProfile,
      profile,
      setProfile,
      updateProfile,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}

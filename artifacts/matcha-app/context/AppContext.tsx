import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

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
  bio: "",
  bodyType: "",
  height: "",
  hairColor: "",
  ethnicity: "",
  interests: [],
};

type AppContextType = {
  isLoggedIn: boolean;
  login: () => void;
  logout: () => void;
  language: "es" | "en";
  setLanguage: (lang: "es" | "en") => void;
  t: (es: string, en: string) => string;
  goals: Goal[];
  updateGoalProgress: (id: string, progress: number) => void;
  likedProfiles: string[];
  likeProfile: (profileId: string) => void;
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [language, setLanguageState] = useState<"es" | "en">("es");
  const [goals, setGoals] = useState<Goal[]>(DEFAULT_GOALS);
  const [likedProfiles, setLikedProfiles] = useState<string[]>([]);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    (async () => {
      try {
        const [lang, logged, savedGoals, savedProfile] = await Promise.all([
          AsyncStorage.getItem("language"),
          AsyncStorage.getItem("isLoggedIn"),
          AsyncStorage.getItem("goals"),
          AsyncStorage.getItem("profile"),
        ]);
        if (lang === "es" || lang === "en") setLanguageState(lang);
        if (logged === "true") setIsLoggedIn(true);
        if (savedGoals) setGoals(JSON.parse(savedGoals));
        if (savedProfile) setProfile(JSON.parse(savedProfile));
      } catch {}
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
    setIsLoggedIn(true);
    await AsyncStorage.setItem("isLoggedIn", "true");
  }, []);

  const logout = useCallback(async () => {
    setIsLoggedIn(false);
    await AsyncStorage.setItem("isLoggedIn", "false");
  }, []);

  const updateGoalProgress = useCallback(
    async (id: string, progress: number) => {
      setGoals((prev) => {
        const updated = prev.map((g) => (g.id === id ? { ...g, progress } : g));
        AsyncStorage.setItem("goals", JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const likeProfile = useCallback(async (profileId: string) => {
    setLikedProfiles((prev) => {
      if (prev.includes(profileId)) return prev;
      const updated = [...prev, profileId];
      return updated;
    });
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    setProfile((prev) => {
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem("profile", JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AppContext.Provider
      value={{
        isLoggedIn,
        login,
        logout,
        language,
        setLanguage,
        t,
        goals,
        updateGoalProgress,
        likedProfiles,
        likeProfile,
        profile,
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

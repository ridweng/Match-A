import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

<<<<<<< HEAD
import { Language } from "@/constants/i18n";

export type UserProfile = {
  fullName: string;
=======
export type Language = "es" | "en";

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
>>>>>>> f81a9b8 (second try)
  age: string;
  bodyType: string;
  hairColor: string;
  height: string;
  weight: string;
  ethnicity: string;
<<<<<<< HEAD
  interests: string[];
  bio: string;
  photos: string[];
=======
  bio: string;
  interests: string[];
>>>>>>> f81a9b8 (second try)
};

type AppContextType = {
  language: Language;
<<<<<<< HEAD
  setLanguage: (lang: Language) => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  saveProfile: (p: UserProfile) => Promise<void>;
};

const defaultProfile: UserProfile = {
  fullName: "",
  age: "",
  bodyType: "",
  hairColor: "",
  height: "",
  weight: "",
  ethnicity: "",
  interests: [],
  bio: "",
  photos: [],
};

=======
  setLanguage: (l: Language) => void;
  t: (es: string, en: string) => string;
  isLoggedIn: boolean;
  login: () => void;
  logout: () => void;
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  goals: Goal[];
  updateGoalProgress: (id: string, progress: number) => void;
  likedProfiles: string[];
  likeProfile: (id: string) => void;
  dislikeProfile: (id: string) => void;
};

const defaultProfile: UserProfile = {
  name: "Alejandro Ruiz",
  age: "31",
  bodyType: "Atlético / Athletic",
  hairColor: "Castaño / Brown",
  height: "182 cm",
  weight: "78 kg",
  ethnicity: "Hispano / Hispanic",
  bio: "Apasionado del deporte, la naturaleza y el crecimiento personal. Buscando mejorar cada día.",
  interests: ["Fitness", "Senderismo", "Lectura", "Meditación", "Fotografía"],
};

const defaultGoals: Goal[] = [
  {
    id: "1",
    titleEs: "Resistencia cardiovascular",
    titleEn: "Cardiovascular endurance",
    category: "fisica",
    progress: 65,
    nextActionEs: "Corre 30 min sin parar esta semana",
    nextActionEn: "Run 30 min non-stop this week",
    impactEs: "+18% atractivo físico percibido",
    impactEn: "+18% perceived physical attractiveness",
  },
  {
    id: "2",
    titleEs: "Confianza social",
    titleEn: "Social confidence",
    category: "social",
    progress: 42,
    nextActionEs: "Inicia 3 conversaciones con desconocidos",
    nextActionEn: "Start 3 conversations with strangers",
    impactEs: "+25% en habilidades de conexión",
    impactEn: "+25% in connection skills",
  },
  {
    id: "3",
    titleEs: "Higiene y cuidado personal",
    titleEn: "Hygiene and grooming",
    category: "habitos",
    progress: 80,
    nextActionEs: "Actualiza tu rutina de skincare",
    nextActionEn: "Update your skincare routine",
    impactEs: "+30% en primera impresión",
    impactEn: "+30% in first impression",
  },
  {
    id: "4",
    titleEs: "Inteligencia emocional",
    titleEn: "Emotional intelligence",
    category: "personalidad",
    progress: 35,
    nextActionEs: "Practica escucha activa 15 min/día",
    nextActionEn: "Practice active listening 15 min/day",
    impactEs: "+40% en profundidad de conexión",
    impactEn: "+40% in depth of connection",
  },
  {
    id: "5",
    titleEs: "Postura corporal",
    titleEn: "Body posture",
    category: "fisica",
    progress: 58,
    nextActionEs: "Ejercicios de corrección postural x3",
    nextActionEn: "Postural correction exercises x3",
    impactEs: "+22% en presencia e imagen",
    impactEn: "+22% in presence and image",
  },
  {
    id: "6",
    titleEs: "Habilidades de conversación",
    titleEn: "Conversation skills",
    category: "social",
    progress: 50,
    nextActionEs: "Lee un artículo interesante y comenta",
    nextActionEn: "Read an interesting article and discuss it",
    impactEs: "+35% en interés generado",
    impactEn: "+35% in generated interest",
  },
];

>>>>>>> f81a9b8 (second try)
const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("es");
<<<<<<< HEAD
  const [loggedIn, setLoggedIn] = useState(false);
  const [profile, setProfileState] = useState<UserProfile>(defaultProfile);

  useEffect(() => {
    (async () => {
      const [storedLang, storedProfile, storedLoggedIn] = await Promise.all([
        AsyncStorage.getItem("matcha_lang"),
        AsyncStorage.getItem("matcha_profile"),
        AsyncStorage.getItem("matcha_loggedIn"),
      ]);
      if (storedLang) setLanguageState(storedLang as Language);
      if (storedProfile) setProfileState(JSON.parse(storedProfile));
      if (storedLoggedIn === "true") setLoggedIn(true);
    })();
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    await AsyncStorage.setItem("matcha_lang", lang);
  }, []);

  const setIsLoggedIn = useCallback((v: boolean) => {
    setLoggedIn(v);
    AsyncStorage.setItem("matcha_loggedIn", v ? "true" : "false");
  }, []);

  const saveProfile = useCallback(async (p: UserProfile) => {
    setProfileState(p);
    await AsyncStorage.setItem("matcha_profile", JSON.stringify(p));
=======
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfileState] = useState<UserProfile>(defaultProfile);
  const [goals, setGoals] = useState<Goal[]>(defaultGoals);
  const [likedProfiles, setLikedProfiles] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem("matcha_logged_in").then((v) => {
      if (v === "true") setIsLoggedIn(true);
    });
    AsyncStorage.getItem("matcha_language").then((v) => {
      if (v === "en" || v === "es") setLanguageState(v);
    });
    AsyncStorage.getItem("matcha_profile").then((v) => {
      if (v) setProfileState(JSON.parse(v));
    });
    AsyncStorage.getItem("matcha_goals").then((v) => {
      if (v) setGoals(JSON.parse(v));
    });
    AsyncStorage.getItem("matcha_liked").then((v) => {
      if (v) setLikedProfiles(JSON.parse(v));
    });
  }, []);

  const setLanguage = useCallback((l: Language) => {
    setLanguageState(l);
    AsyncStorage.setItem("matcha_language", l);
  }, []);

  const login = useCallback(() => {
    setIsLoggedIn(true);
    AsyncStorage.setItem("matcha_logged_in", "true");
  }, []);

  const logout = useCallback(() => {
    setIsLoggedIn(false);
    AsyncStorage.setItem("matcha_logged_in", "false");
>>>>>>> f81a9b8 (second try)
  }, []);

  const setProfile = useCallback((p: UserProfile) => {
    setProfileState(p);
<<<<<<< HEAD
  }, []);

=======
    AsyncStorage.setItem("matcha_profile", JSON.stringify(p));
  }, []);

  const updateGoalProgress = useCallback((id: string, progress: number) => {
    setGoals((prev) => {
      const updated = prev.map((g) =>
        g.id === id ? { ...g, progress } : g
      );
      AsyncStorage.setItem("matcha_goals", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const likeProfile = useCallback((id: string) => {
    setLikedProfiles((prev) => {
      const updated = [...prev, id];
      AsyncStorage.setItem("matcha_liked", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const dislikeProfile = useCallback((id: string) => {}, []);

  const t = useCallback(
    (es: string, en: string) => (language === "es" ? es : en),
    [language]
  );

>>>>>>> f81a9b8 (second try)
  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
<<<<<<< HEAD
        isLoggedIn: loggedIn,
        setIsLoggedIn,
        profile,
        setProfile,
        saveProfile,
=======
        t,
        isLoggedIn,
        login,
        logout,
        profile,
        setProfile,
        goals,
        updateGoalProgress,
        likedProfiles,
        likeProfile,
        dislikeProfile,
>>>>>>> f81a9b8 (second try)
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
<<<<<<< HEAD
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
=======
  if (!ctx) throw new Error("useApp must be used within AppProvider");
>>>>>>> f81a9b8 (second try)
  return ctx;
}

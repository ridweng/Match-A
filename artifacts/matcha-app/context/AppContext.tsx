import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { Language } from "@/constants/i18n";

export type UserProfile = {
  fullName: string;
  age: string;
  bodyType: string;
  hairColor: string;
  height: string;
  weight: string;
  ethnicity: string;
  interests: string[];
  bio: string;
  photos: string[];
};

type AppContextType = {
  language: Language;
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

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("es");
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
  }, []);

  const setProfile = useCallback((p: UserProfile) => {
    setProfileState(p);
  }, []);

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        isLoggedIn: loggedIn,
        setIsLoggedIn,
        profile,
        setProfile,
        saveProfile,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

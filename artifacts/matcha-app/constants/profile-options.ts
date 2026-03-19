export type BodyTypeValue =
  | "slim"
  | "lean"
  | "athletic"
  | "toned"
  | "muscular"
  | "medium_build"
  | "large_build"
  | "curvy"
  | "sturdy"
  | "compact_build"
  | "plus_size"
  | "broad_build"
  | "rounded_build";

export const BODY_TYPES: BodyTypeValue[] = [
  "slim",
  "lean",
  "athletic",
  "toned",
  "muscular",
  "medium_build",
  "large_build",
  "curvy",
  "sturdy",
  "compact_build",
  "plus_size",
  "broad_build",
  "rounded_build",
];

export type HairColorValue =
  | "black"
  | "dark_brown"
  | "medium_brown"
  | "light_brown"
  | "brown"
  | "dark_blonde"
  | "blonde"
  | "light_blonde"
  | "red"
  | "auburn_copper"
  | "gray_haired"
  | "gray"
  | "white"
  | "salt_and_pepper"
  | "fantasy_colored"
  | "multicolored"
  | "highlights"
  | "graying"
  | "shaved_head"
  | "bald";

export const HAIR_COLORS: HairColorValue[] = [
  "black",
  "dark_brown",
  "medium_brown",
  "light_brown",
  "brown",
  "dark_blonde",
  "blonde",
  "light_blonde",
  "red",
  "auburn_copper",
  "gray_haired",
  "gray",
  "white",
  "salt_and_pepper",
  "fantasy_colored",
  "multicolored",
  "highlights",
  "graying",
  "shaved_head",
  "bald",
];

export const HEIGHTS = [
  "160-164 cm",
  "165-169 cm",
  "170-174 cm",
  "175-179 cm",
  "180-184 cm",
  "185-189 cm",
  "190+ cm",
];

export type EthnicityValue =
  | "latino_latin_american"
  | "hispanic"
  | "afro_descendant"
  | "african"
  | "european"
  | "mediterranean"
  | "middle_eastern"
  | "north_african"
  | "east_asian"
  | "southeast_asian"
  | "south_asian"
  | "central_asian"
  | "indigenous_native"
  | "native_american"
  | "alaska_native"
  | "oceanian_pacific_islander"
  | "pacific_islander"
  | "caribbean"
  | "mestizo"
  | "multiracial"
  | "mixed"
  | "jewish_heritage"
  | "romani"
  | "caucasian"
  | "other_ethnic_background"
  | "prefer_not_to_say";

export const ETHNICITIES: EthnicityValue[] = [
  "latino_latin_american",
  "hispanic",
  "afro_descendant",
  "african",
  "european",
  "mediterranean",
  "middle_eastern",
  "north_african",
  "east_asian",
  "southeast_asian",
  "south_asian",
  "central_asian",
  "indigenous_native",
  "native_american",
  "alaska_native",
  "oceanian_pacific_islander",
  "pacific_islander",
  "caribbean",
  "mestizo",
  "multiracial",
  "mixed",
  "jewish_heritage",
  "romani",
  "caucasian",
  "other_ethnic_background",
  "prefer_not_to_say",
];

export type GenderIdentityValue = "male" | "female" | "non_binary";

export const GENDER_IDENTITIES: GenderIdentityValue[] = [
  "male",
  "female",
  "non_binary",
];

export type PronounValue = "he" | "she" | "they" | "elle" | "ellx";

export const SPANISH_PRONOUNS: PronounValue[] = ["he", "she", "elle", "ellx"];

export const ENGLISH_PRONOUNS: PronounValue[] = ["he", "she", "they"];

export type RelationshipGoalValue =
  | "stable_relationship"
  | "nothing_serious"
  | "making_friends"
  | "still_figuring_it_out";

export const RELATIONSHIP_GOALS: RelationshipGoalValue[] = [
  "stable_relationship",
  "nothing_serious",
  "making_friends",
  "still_figuring_it_out",
];

export type SpokenLanguageOption = {
  value: string;
  es: string;
  en: string;
};

export const SPOKEN_LANGUAGES: SpokenLanguageOption[] = [
  { value: "spanish", es: "Español", en: "Spanish" },
  { value: "english", es: "Inglés", en: "English" },
  { value: "portuguese", es: "Portugués", en: "Portuguese" },
  { value: "french", es: "Francés", en: "French" },
  { value: "italian", es: "Italiano", en: "Italian" },
  { value: "german", es: "Alemán", en: "German" },
  { value: "dutch", es: "Neerlandés", en: "Dutch" },
  { value: "catalan", es: "Catalán", en: "Catalan" },
  { value: "galician", es: "Gallego", en: "Galician" },
  { value: "basque", es: "Euskera / Vasco", en: "Basque" },
  { value: "romanian", es: "Rumano", en: "Romanian" },
  { value: "swedish", es: "Sueco", en: "Swedish" },
  { value: "norwegian", es: "Noruego", en: "Norwegian" },
  { value: "danish", es: "Danés", en: "Danish" },
  { value: "finnish", es: "Finlandés", en: "Finnish" },
  { value: "icelandic", es: "Islandés", en: "Icelandic" },
  { value: "irish", es: "Irlandés", en: "Irish" },
  { value: "welsh", es: "Galés", en: "Welsh" },
  { value: "scottish_gaelic", es: "Escocés gaélico", en: "Scottish Gaelic" },
  { value: "polish", es: "Polaco", en: "Polish" },
  { value: "czech", es: "Checo", en: "Czech" },
  { value: "slovak", es: "Eslovaco", en: "Slovak" },
  { value: "hungarian", es: "Húngaro", en: "Hungarian" },
  { value: "slovenian", es: "Esloveno", en: "Slovenian" },
  { value: "croatian", es: "Croata", en: "Croatian" },
  { value: "serbian", es: "Serbio", en: "Serbian" },
  { value: "bosnian", es: "Bosnio", en: "Bosnian" },
  { value: "montenegrin", es: "Montenegrino", en: "Montenegrin" },
  { value: "macedonian", es: "Macedonio", en: "Macedonian" },
  { value: "bulgarian", es: "Búlgaro", en: "Bulgarian" },
  { value: "albanian", es: "Albanés", en: "Albanian" },
  { value: "greek", es: "Griego", en: "Greek" },
  { value: "russian", es: "Ruso", en: "Russian" },
  { value: "ukrainian", es: "Ucraniano", en: "Ukrainian" },
  { value: "belarusian", es: "Bielorruso", en: "Belarusian" },
  { value: "lithuanian", es: "Lituano", en: "Lithuanian" },
  { value: "latvian", es: "Letón", en: "Latvian" },
  { value: "estonian", es: "Estonio", en: "Estonian" },
  { value: "maltese", es: "Maltés", en: "Maltese" },
  { value: "turkish", es: "Turco", en: "Turkish" },
  { value: "arabic", es: "Árabe", en: "Arabic" },
  { value: "hebrew", es: "Hebreo", en: "Hebrew" },
  { value: "persian_farsi", es: "Persa / Farsi", en: "Persian / Farsi" },
  { value: "kurdish", es: "Kurdo", en: "Kurdish" },
  { value: "armenian", es: "Armenio", en: "Armenian" },
  { value: "georgian", es: "Georgiano", en: "Georgian" },
  { value: "azerbaijani", es: "Azerbaiyano", en: "Azerbaijani" },
  { value: "kazakh", es: "Kazajo", en: "Kazakh" },
  { value: "uzbek", es: "Uzbeko", en: "Uzbek" },
  { value: "turkmen", es: "Turcomano", en: "Turkmen" },
  { value: "tajik", es: "Tayiko", en: "Tajik" },
  { value: "kyrgyz", es: "Kirguís", en: "Kyrgyz" },
  { value: "pashto", es: "Pastún", en: "Pashto" },
  { value: "dari", es: "Dari", en: "Dari" },
  { value: "urdu", es: "Urdu", en: "Urdu" },
  { value: "hindi", es: "Hindi", en: "Hindi" },
  { value: "bengali", es: "Bengalí", en: "Bengali" },
  { value: "punjabi", es: "Panyabí", en: "Punjabi" },
  { value: "gujarati", es: "Guyaratí", en: "Gujarati" },
  { value: "marathi", es: "Maratí", en: "Marathi" },
  { value: "tamil", es: "Tamil", en: "Tamil" },
  { value: "telugu", es: "Telugu", en: "Telugu" },
  { value: "kannada", es: "Canarés / Kannada", en: "Kannada" },
  { value: "malayalam", es: "Malayalam", en: "Malayalam" },
  { value: "odia", es: "Odia", en: "Odia" },
  { value: "assamese", es: "Asamés", en: "Assamese" },
  { value: "nepali", es: "Nepalí", en: "Nepali" },
  { value: "sinhala", es: "Cingalés", en: "Sinhala" },
  { value: "burmese", es: "Birmano", en: "Burmese" },
  { value: "thai", es: "Tailandés", en: "Thai" },
  { value: "lao", es: "Lao", en: "Lao" },
  { value: "khmer", es: "Jemer / Camboyano", en: "Khmer" },
  { value: "vietnamese", es: "Vietnamita", en: "Vietnamese" },
  { value: "indonesian", es: "Indonesio", en: "Indonesian" },
  { value: "malay", es: "Malayo", en: "Malay" },
  { value: "tagalog", es: "Tagalo", en: "Tagalog" },
  { value: "filipino", es: "Filipino", en: "Filipino" },
  { value: "cebuano", es: "Cebuano", en: "Cebuano" },
  { value: "javanese", es: "Javanés", en: "Javanese" },
  { value: "sundanese", es: "Sundanés", en: "Sundanese" },
  { value: "mandarin_chinese", es: "Chino mandarín", en: "Mandarin Chinese" },
  { value: "cantonese", es: "Cantonés", en: "Cantonese" },
  { value: "hakka", es: "Hakka", en: "Hakka" },
  { value: "japanese", es: "Japonés", en: "Japanese" },
  { value: "korean", es: "Coreano", en: "Korean" },
  { value: "mongolian", es: "Mongol", en: "Mongolian" },
  { value: "tibetan", es: "Tibetano", en: "Tibetan" },
  { value: "uyghur", es: "Uigur", en: "Uyghur" },
  { value: "swahili", es: "Suajili", en: "Swahili" },
  { value: "amharic", es: "Amhárico", en: "Amharic" },
  { value: "somali", es: "Somali", en: "Somali" },
  { value: "oromo", es: "Oromo", en: "Oromo" },
  { value: "tigrinya", es: "Tigrinya", en: "Tigrinya" },
  { value: "hausa", es: "Hausa", en: "Hausa" },
  { value: "yoruba", es: "Yoruba", en: "Yoruba" },
  { value: "igbo", es: "Igbo", en: "Igbo" },
  { value: "zulu", es: "Zulú", en: "Zulu" },
  { value: "xhosa", es: "Xhosa", en: "Xhosa" },
  { value: "afrikaans", es: "Afrikáans", en: "Afrikaans" },
  { value: "shona", es: "Shona", en: "Shona" },
  { value: "kinyarwanda", es: "Kinyarwanda", en: "Kinyarwanda" },
  { value: "lingala", es: "Lingala", en: "Lingala" },
  { value: "wolof", es: "Wolof", en: "Wolof" },
  { value: "malagasy", es: "Malagasy", en: "Malagasy" },
  { value: "quechua", es: "Quechua", en: "Quechua" },
  { value: "aymara", es: "Aymara", en: "Aymara" },
  { value: "guarani", es: "Guaraní", en: "Guarani" },
  { value: "nahuatl", es: "Náhuatl", en: "Nahuatl" },
  { value: "mapudungun", es: "Mapudungun", en: "Mapudungun" },
  { value: "yucatec_maya", es: "Maya yucateco", en: "Yucatec Maya" },
  { value: "inuktitut", es: "Inuit / Inuktitut", en: "Inuktitut" },
  { value: "hawaiian", es: "Hawaiano", en: "Hawaiian" },
  { value: "maori", es: "Maorí", en: "Maori" },
  { value: "samoan", es: "Samoano", en: "Samoan" },
  { value: "tongan", es: "Tongano", en: "Tongan" },
  { value: "fijian", es: "Fiyiano", en: "Fijian" },
  { value: "haitian_creole", es: "Criollo haitiano", en: "Haitian Creole" },
  { value: "papiamento", es: "Papiamento", en: "Papiamento" },
  { value: "luxembourgish", es: "Luxemburgués", en: "Luxembourgish" },
  { value: "esperanto", es: "Esperanto", en: "Esperanto" },
  { value: "asl", es: "Lengua de señas americana", en: "American Sign Language" },
  { value: "bsl", es: "Lengua de señas británica", en: "British Sign Language" },
  { value: "chilean_sign_language", es: "Lengua de señas chilena", en: "Chilean Sign Language" },
];

type Translator = (es: string, en: string) => string;

export function getSpokenLanguageLabel(
  value: string | null | undefined,
  language: "es" | "en"
) {
  const option = SPOKEN_LANGUAGES.find((item) => item.value === value);
  if (!option) {
    return value?.trim() || "";
  }
  return language === "es" ? option.es : option.en;
}

export function normalizeBodyType(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "delgado":
    case "slim":
    case "delgado / slim":
      return "slim";
    case "esbelto":
    case "esbelta":
    case "lean":
    case "esbelto / lean":
      return "lean";
    case "atlético":
    case "atlética":
    case "athletic":
    case "atlético / athletic":
      return "athletic";
    case "tonificado":
    case "tonificada":
    case "toned":
    case "tonificado / toned":
      return "toned";
    case "musculoso":
    case "muscular":
    case "musculoso / muscular":
      return "muscular";
    case "complexión media":
    case "medium build":
    case "complexión media / medium build":
      return "medium_build";
    case "complexión grande":
    case "large build":
    case "complexión grande / large build":
      return "large_build";
    case "curvilíneo":
    case "curvilínea":
    case "curvy":
    case "curvilíneo / curvy":
      return "curvy";
    case "robusto":
    case "sturdy":
    case "robusto / sturdy":
      return "sturdy";
    case "compacto":
    case "compact build":
    case "compacto / compact build":
      return "compact_build";
    case "plus-size":
    case "plus size":
      return "plus_size";
    case "cuerpo ancho":
    case "broad build":
    case "wide build":
    case "broad/wide build":
    case "cuerpo ancho / broad/wide build":
      return "broad_build";
    case "cuerpo redondeado":
    case "rounded build":
    case "cuerpo redondeado / rounded build":
      return "rounded_build";
    default:
      return value?.trim() || "";
  }
}

export function getBodyTypeLabel(value: string | null | undefined, t: Translator) {
  switch (normalizeBodyType(value)) {
    case "slim":
      return t("Delgado", "Slim");
    case "lean":
      return t("Esbelto", "Lean");
    case "athletic":
      return t("Atlético", "Athletic");
    case "toned":
      return t("Tonificado", "Toned");
    case "muscular":
      return t("Musculoso", "Muscular");
    case "medium_build":
      return t("Complexión media", "Medium build");
    case "large_build":
      return t("Complexión grande", "Large build");
    case "curvy":
      return t("Curvilíneo", "Curvy");
    case "sturdy":
      return t("Robusto", "Sturdy");
    case "compact_build":
      return t("Compacto", "Compact build");
    case "plus_size":
      return "Plus-size";
    case "broad_build":
      return t("Cuerpo ancho", "Broad/Wide build");
    case "rounded_build":
      return t("Cuerpo redondeado", "Rounded build");
    default:
      return value?.trim() || "";
  }
}

export function normalizeHairColor(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "negro":
    case "black":
    case "negro / black":
      return "black";
    case "castaño oscuro":
    case "dark brown":
      return "dark_brown";
    case "castaño medio":
    case "medium brown":
      return "medium_brown";
    case "castaño claro":
    case "light brown":
      return "light_brown";
    case "café":
    case "cafe":
    case "brown":
    case "castaño":
    case "castaño / brown":
      return "brown";
    case "rubio oscuro":
    case "dark blonde":
      return "dark_blonde";
    case "rubio":
    case "blonde":
    case "rubio / blonde":
      return "blonde";
    case "rubio claro":
    case "light blonde":
      return "light_blonde";
    case "pelirrojo":
    case "red":
    case "pelirrojo / red":
      return "red";
    case "cobrizo":
    case "auburn":
    case "copper":
    case "auburn / copper":
      return "auburn_copper";
    case "canoso":
    case "gray-haired":
    case "grey-haired":
      return "gray_haired";
    case "gris":
    case "gray":
    case "grey":
    case "canoso / grey":
      return "gray";
    case "blanco":
    case "white":
      return "white";
    case "sal y pimienta":
    case "salt and pepper":
      return "salt_and_pepper";
    case "teñido de color fantasía":
    case "tenido de color fantasia":
    case "fantasy-colored":
    case "fantasy colored":
      return "fantasy_colored";
    case "multicolor":
    case "multicolored":
      return "multicolored";
    case "mechas":
    case "highlights":
      return "highlights";
    case "con canas":
    case "graying":
      return "graying";
    case "rapado":
    case "shaved head":
      return "shaved_head";
    case "calvo":
    case "bald":
    case "calvo / bald":
      return "bald";
    default:
      return value?.trim() || "";
  }
}

export function getHairColorLabel(value: string | null | undefined, t: Translator) {
  switch (normalizeHairColor(value)) {
    case "black":
      return t("Negro", "Black");
    case "dark_brown":
      return t("Castaño oscuro", "Dark brown");
    case "medium_brown":
      return t("Castaño medio", "Medium brown");
    case "light_brown":
      return t("Castaño claro", "Light brown");
    case "brown":
      return t("Café", "Brown");
    case "dark_blonde":
      return t("Rubio oscuro", "Dark blonde");
    case "blonde":
      return t("Rubio", "Blonde");
    case "light_blonde":
      return t("Rubio claro", "Light blonde");
    case "red":
      return t("Pelirrojo", "Red");
    case "auburn_copper":
      return t("Cobrizo", "Auburn / Copper");
    case "gray_haired":
      return t("Canoso", "Gray-haired");
    case "gray":
      return t("Gris", "Gray");
    case "white":
      return t("Blanco", "White");
    case "salt_and_pepper":
      return t("Sal y pimienta", "Salt and pepper");
    case "fantasy_colored":
      return t("Teñido de color fantasía", "Fantasy-colored");
    case "multicolored":
      return t("Multicolor", "Multicolored");
    case "highlights":
      return t("Mechas", "Highlights");
    case "graying":
      return t("Con canas", "Graying");
    case "shaved_head":
      return t("Rapado", "Shaved head");
    case "bald":
      return t("Calvo", "Bald");
    default:
      return value?.trim() || "";
  }
}

export function normalizeEthnicity(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "latino":
    case "latina":
    case "latinoamericano":
    case "latinoamericana":
    case "latin american":
    case "latino / latina / latinoamericano":
    case "latino / latina / latin american":
      return "latino_latin_american";
    case "hispano":
    case "hispanic":
    case "hispano / hispanic":
      return "hispanic";
    case "afrodescendiente":
    case "black":
    case "african descent":
    case "afro-descendant":
      return "afro_descendant";
    case "africano":
    case "african":
      return "african";
    case "europeo":
    case "european":
      return "european";
    case "mediterráneo":
    case "mediterraneo":
    case "mediterranean":
      return "mediterranean";
    case "medio oriente":
    case "middle eastern":
      return "middle_eastern";
    case "norteafricano":
    case "north african":
      return "north_african";
    case "asiático oriental":
    case "asiatico oriental":
    case "east asian":
      return "east_asian";
    case "asiático del sudeste":
    case "asiatico del sudeste":
    case "southeast asian":
      return "southeast_asian";
    case "asiático del sur":
    case "asiatico del sur":
    case "south asian":
      return "south_asian";
    case "asiático central":
    case "asiatico central":
    case "central asian":
      return "central_asian";
    case "indígena":
    case "indigena":
    case "pueblo originario":
    case "indigenous":
    case "native":
      return "indigenous_native";
    case "nativo americano":
    case "native american":
      return "native_american";
    case "nativo de alaska":
    case "alaska native":
      return "alaska_native";
    case "originario de oceanía":
    case "originario de oceania":
    case "oceanian":
    case "pacific islander":
    case "oceanian / pacific islander":
      return "oceanian_pacific_islander";
    case "isleño del pacífico":
    case "isleno del pacifico":
    case "pacific islander":
      return "pacific_islander";
    case "caribeño":
    case "caribeno":
    case "caribbean":
      return "caribbean";
    case "mestizo":
      return "mestizo";
    case "multirracial":
    case "multiracial":
      return "multiracial";
    case "mixto":
    case "mixed":
    case "mixto / mixed":
      return "mixed";
    case "judío":
    case "judio":
    case "de ascendencia judía":
    case "de ascendencia judia":
    case "jewish":
    case "of jewish heritage":
      return "jewish_heritage";
    case "gitano":
    case "romaní":
    case "romani":
      return "romani";
    case "caucásico":
    case "caucasico":
    case "caucasian":
    case "caucásico / caucasian":
      return "caucasian";
    case "otro origen étnico":
    case "otro origen etnico":
    case "other ethnic background":
      return "other_ethnic_background";
    case "prefiero no decirlo":
    case "prefer not to say":
      return "prefer_not_to_say";
    default:
      return value?.trim() || "";
  }
}

export function getEthnicityLabel(value: string | null | undefined, t: Translator) {
  switch (normalizeEthnicity(value)) {
    case "latino_latin_american":
      return t(
        "Latino / Latina / Latinoamericano",
        "Latino / Latina / Latin American"
      );
    case "hispanic":
      return t("Hispano", "Hispanic");
    case "afro_descendant":
      return t(
        "Afrodescendiente",
        "Black / African descent / Afro-descendant"
      );
    case "african":
      return t("Africano", "African");
    case "european":
      return t("Europeo", "European");
    case "mediterranean":
      return t("Mediterráneo", "Mediterranean");
    case "middle_eastern":
      return t("Medio Oriente", "Middle Eastern");
    case "north_african":
      return t("Norteafricano", "North African");
    case "east_asian":
      return t("Asiático oriental", "East Asian");
    case "southeast_asian":
      return t("Asiático del sudeste", "Southeast Asian");
    case "south_asian":
      return t("Asiático del sur", "South Asian");
    case "central_asian":
      return t("Asiático central", "Central Asian");
    case "indigenous_native":
      return t(
        "Indígena / Pueblo originario",
        "Indigenous / Native"
      );
    case "native_american":
      return t("Nativo americano", "Native American");
    case "alaska_native":
      return t("Nativo de Alaska", "Alaska Native");
    case "oceanian_pacific_islander":
      return t(
        "Originario de Oceanía",
        "Oceanian / Pacific Islander"
      );
    case "pacific_islander":
      return t("Isleño del Pacífico", "Pacific Islander");
    case "caribbean":
      return t("Caribeño", "Caribbean");
    case "mestizo":
      return "Mestizo";
    case "multiracial":
      return t("Multirracial", "Multiracial");
    case "mixed":
      return t("Mixto", "Mixed");
    case "jewish_heritage":
      return t(
        "Judío / de ascendencia judía",
        "Jewish / of Jewish heritage"
      );
    case "romani":
      return t("Gitano / romaní", "Romani");
    case "caucasian":
      return t("Caucásico", "Caucasian");
    case "other_ethnic_background":
      return t("Otro origen étnico", "Other ethnic background");
    case "prefer_not_to_say":
      return t("Prefiero no decirlo", "Prefer not to say");
    default:
      return value?.trim() || "";
  }
}

export function normalizeGenderIdentity(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "male":
    case "hombre":
      return "male";
    case "female":
    case "mujer":
      return "female";
    case "non-binary":
    case "non binary":
    case "non_binary":
    case "no binario":
    case "no binaria":
    case "no binarie":
      return "non_binary";
    default:
      return value?.trim() || "";
  }
}

export function normalizePronouns(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "él":
    case "el":
    case "he":
    case "he / him / his":
      return "he";
    case "ella":
    case "she":
    case "she / her / hers":
      return "she";
    case "they":
    case "them":
    case "theirs":
    case "they / them / theirs":
      return "they";
    case "elle":
      return "elle";
    case "ellx":
      return "ellx";
    default:
      return value?.trim() || "";
  }
}

export function getPronounLabel(
  value: string | null | undefined,
  language: "es" | "en"
) {
  switch (normalizePronouns(value)) {
    case "he":
      return language === "es" ? "Él" : "He / Him / His";
    case "she":
      return language === "es" ? "Ella" : "She / Her / Hers";
    case "they":
      return language === "es" ? "Elle" : "They / Them / Theirs";
    case "elle":
      return language === "es" ? "Elle" : "They / Them / Theirs";
    case "ellx":
      return language === "es" ? "Ellx" : "They / Them / Theirs";
    default:
      return value?.trim() || "";
  }
}

export function normalizeRelationshipGoal(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "pareja estable":
    case "stable relationship":
      return "stable_relationship";
    case "nada serio":
    case "nothing serious":
      return "nothing_serious";
    case "hacer amigos":
    case "making friends":
      return "making_friends";
    case "lo sigo pensando":
    case "still figuring it out":
      return "still_figuring_it_out";
    default:
      return value?.trim() || "";
  }
}

export function getRelationshipGoalLabel(
  value: string | null | undefined,
  t: Translator
) {
  switch (normalizeRelationshipGoal(value)) {
    case "stable_relationship":
      return t("Pareja estable", "Stable relationship");
    case "nothing_serious":
      return t("Nada serio", "Nothing serious");
    case "making_friends":
      return t("Hacer amigos", "Making friends");
    case "still_figuring_it_out":
      return t("Lo sigo pensando", "Still figuring it out");
    default:
      return value?.trim() || "";
  }
}

export function getGenderIdentityLabel(
  value: string | null | undefined,
  t: Translator
) {
  switch (normalizeGenderIdentity(value)) {
    case "male":
      return t("Hombre", "Male");
    case "female":
      return t("Mujer", "Female");
    case "non_binary":
      return t("No binario", "Non-binary");
    default:
      return value?.trim() || "";
  }
}

export const INTERESTS_LIST = [
  "Fitness",
  "Senderismo",
  "Meditación",
  "Lectura",
  "Fotografía",
  "Música",
  "Viajes",
  "Gastronomía",
  "Arte",
  "Tecnología",
  "Surf",
  "Yoga",
  "Ciclismo",
  "Cocina",
  "Cine",
];

export const MAX_PROFILE_PHOTOS = 6;

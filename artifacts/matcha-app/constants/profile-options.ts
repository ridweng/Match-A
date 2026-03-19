export const BODY_TYPES = [
  "Delgado / Slim",
  "Atlético / Athletic",
  "Musculoso / Muscular",
  "Normal / Average",
  "Con curvas / Curvy",
  "Robusto / Stocky",
];

export const HAIR_COLORS = [
  "Negro / Black",
  "Castaño / Brown",
  "Rubio / Blonde",
  "Pelirrojo / Red",
  "Canoso / Grey",
  "Calvo / Bald",
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

export const ETHNICITIES = [
  "Hispano / Hispanic",
  "Caucásico / Caucasian",
  "Afrolatino / Afro-Latino",
  "Asiático / Asian",
  "Árabe / Arab",
  "Mixto / Mixed",
  "Otro / Other",
];

export type GenderIdentityValue = "male" | "female" | "non_binary";

export const GENDER_IDENTITIES: GenderIdentityValue[] = [
  "male",
  "female",
  "non_binary",
];

type Translator = (es: string, en: string) => string;

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

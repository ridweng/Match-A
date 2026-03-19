function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function getAdultMaximumDate(today = new Date()) {
  const maxDate = new Date(today);
  maxDate.setHours(0, 0, 0, 0);
  maxDate.setFullYear(maxDate.getFullYear() - 18);
  return maxDate;
}

export function parseIsoDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function toIsoDate(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function formatDateForDisplay(value: string | null | undefined) {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return "";
  }

  return `${pad(parsed.getDate())}/${pad(parsed.getMonth() + 1)}/${parsed.getFullYear()}`;
}

export function getInitialPickerDate(value: string | null | undefined) {
  return parseIsoDate(value) || getAdultMaximumDate();
}

export function isAdultBirthDate(value: string | null | undefined) {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return false;
  }

  return parsed.getTime() <= getAdultMaximumDate().getTime();
}

export function getAgeFromIsoDate(value: string | null | undefined, today = new Date()) {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return null;
  }

  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();
  const dayDiff = today.getDate() - parsed.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export type ZodiacSign =
  | "aries"
  | "taurus"
  | "gemini"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "scorpio"
  | "sagittarius"
  | "capricorn"
  | "aquarius"
  | "pisces";

export function getZodiacSignFromIsoDate(value: string | null | undefined): ZodiacSign | null {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return null;
  }

  const month = parsed.getMonth() + 1;
  const day = parsed.getDate();

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "aries";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "taurus";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "gemini";
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "cancer";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "leo";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "virgo";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "libra";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "scorpio";
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "sagittarius";
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "capricorn";
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "aquarius";
  return "pisces";
}

export function getZodiacSignLabel(
  sign: ZodiacSign | null,
  t: (es: string, en: string) => string
) {
  switch (sign) {
    case "aries":
      return "Aries";
    case "taurus":
      return t("Tauro", "Taurus");
    case "gemini":
      return t("Géminis", "Gemini");
    case "cancer":
      return t("Cáncer", "Cancer");
    case "leo":
      return "Leo";
    case "virgo":
      return "Virgo";
    case "libra":
      return "Libra";
    case "scorpio":
      return t("Escorpio", "Scorpio");
    case "sagittarius":
      return t("Sagitario", "Sagittarius");
    case "capricorn":
      return t("Capricornio", "Capricorn");
    case "aquarius":
      return t("Acuario", "Aquarius");
    case "pisces":
      return t("Piscis", "Pisces");
    default:
      return "";
  }
}

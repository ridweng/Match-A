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

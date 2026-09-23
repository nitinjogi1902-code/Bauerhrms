// HRSYNC — Central Date & Time Utilities
// Storage format remains ISO: YYYY-MM-DD.
// Display format is controlled from Settings.

export const DATE_TIME_SETTINGS_KEY = "bauerHrmsDateTimeSettings";

export const DEFAULT_DATE_TIME_SETTINGS = {
  dateFormat: "DD-MM-YYYY",
  timeFormat: "12-hour",
};

export function getDateTimeSettings() {
  try {
    const raw = localStorage.getItem(DATE_TIME_SETTINGS_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    return {
      ...DEFAULT_DATE_TIME_SETTINGS,
      ...(saved && typeof saved === "object" ? saved : {}),
    };
  } catch {
    return { ...DEFAULT_DATE_TIME_SETTINGS };
  }
}

export function saveDateTimeSettings(nextSettings = {}) {
  const value = {
    ...DEFAULT_DATE_TIME_SETTINGS,
    ...nextSettings,
  };

  localStorage.setItem(DATE_TIME_SETTINGS_KEY, JSON.stringify(value));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("bauerHrmsDateTimeSettingsUpdated"));
  }

  return value;
}

function parseDateValue(value) {
  if (!value) return null;

  const raw = String(value).trim();

  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy.map(Number);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value, overrideFormat) {
  const date = parseDateValue(value);
  if (!date) return value || "—";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());

  const monthShort = date.toLocaleString("en-IN", { month: "short" });
  const monthLong = date.toLocaleString("en-IN", { month: "long" });

  const format =
    overrideFormat || getDateTimeSettings().dateFormat || "DD-MM-YYYY";

  switch (format) {
    case "DD-MMM-YYYY":
      return `${day}-${monthShort}-${year}`;

    case "DD-Month Name-YYYY":
      return `${day}-${monthLong}-${year}`;

    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;

    case "DD-MM-YYYY":
    default:
      return `${day}-${month}-${year}`;
  }
}

export function formatTime(value, overrideFormat) {
  if (!value) return "—";

  const match = String(value).match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!match) return value;

  let hour = Number(match[1]);
  const minute = match[2];

  const format =
    overrideFormat || getDateTimeSettings().timeFormat || "12-hour";

  if (format === "24-hour") {
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;

  return `${hour}:${minute} ${suffix}`;
}

export function toISODate(value) {
  if (!value) return "";

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const match = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (!match) return "";

  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return "";
  }

  return `${year}-${month}-${day}`;
}

export function getDateInputPlaceholder() {
  const format = getDateTimeSettings().dateFormat;

  switch (format) {
    case "DD-MMM-YYYY":
      return "DD-MMM-YYYY";
    case "DD-Month Name-YYYY":
      return "DD-Month Name-YYYY";
    case "YYYY-MM-DD":
      return "YYYY-MM-DD";
    case "DD-MM-YYYY":
    default:
      return "DD-MM-YYYY";
  }
}

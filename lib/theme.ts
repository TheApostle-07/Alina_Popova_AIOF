export type AppTheme = "dark" | "light";
export type ThemePreference = AppTheme | "auto";

export const DEFAULT_THEME: AppTheme = "dark";
export const DEFAULT_THEME_PREFERENCE: ThemePreference = DEFAULT_THEME;
export const THEME_STORAGE_KEY = "alina_theme";
export const THEME_COOKIE_KEY = "alina_theme";
export const THEME_CHANGE_EVENT = "alina:theme-change";
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
export const AUTO_THEME_VALUE = "auto";
export const THEME_PREFERENCE_ORDER: readonly ThemePreference[] = ["dark", "light", "auto"] as const;

export const THEME_COLORS: Record<AppTheme, string> = {
  dark: "#07080C",
  light: "#F5F7FF"
};

export function isAppTheme(value: unknown): value is AppTheme {
  return value === "dark" || value === "light";
}

export function sanitizeTheme(value: unknown): AppTheme | null {
  return isAppTheme(value) ? value : null;
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === AUTO_THEME_VALUE || isAppTheme(value);
}

export function sanitizeThemePreference(value: unknown): ThemePreference | null {
  return isThemePreference(value) ? value : null;
}

export function parseThemeCookie(cookieString: string): ThemePreference | null {
  if (!cookieString) {
    return null;
  }

  const cookieParts = cookieString.split(";");
  for (const cookiePart of cookieParts) {
    const trimmedPart = cookiePart.trim();
    if (!trimmedPart.startsWith(`${THEME_COOKIE_KEY}=`)) {
      continue;
    }

    const rawValue = trimmedPart.slice(THEME_COOKIE_KEY.length + 1);
    try {
      return sanitizeThemePreference(decodeURIComponent(rawValue));
    } catch {
      return sanitizeThemePreference(rawValue);
    }
  }

  return null;
}

export function resolveThemeFromPreference(
  preference: ThemePreference,
  fallbackTheme: AppTheme = DEFAULT_THEME
): AppTheme {
  if (isAppTheme(preference)) {
    return preference;
  }

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    try {
      return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    } catch {
      // Ignore and fall through to time-based fallback.
    }
  }

  const localHour = new Date().getHours();
  if (localHour >= 7 && localHour < 19) {
    return "light";
  }

  return fallbackTheme;
}

export function nextThemePreference(current: ThemePreference): ThemePreference {
  const index = THEME_PREFERENCE_ORDER.indexOf(current);
  if (index < 0) {
    return THEME_PREFERENCE_ORDER[0];
  }
  return THEME_PREFERENCE_ORDER[(index + 1) % THEME_PREFERENCE_ORDER.length];
}

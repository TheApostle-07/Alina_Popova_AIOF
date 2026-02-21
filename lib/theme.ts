export type AppTheme = "dark" | "light";

export const DEFAULT_THEME: AppTheme = "dark";
export const THEME_STORAGE_KEY = "alina_theme";
export const THEME_COOKIE_KEY = "alina_theme";
export const THEME_CHANGE_EVENT = "alina:theme-change";
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

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

export function parseThemeCookie(cookieString: string): AppTheme | null {
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
      return sanitizeTheme(decodeURIComponent(rawValue));
    } catch {
      return sanitizeTheme(rawValue);
    }
  }

  return null;
}

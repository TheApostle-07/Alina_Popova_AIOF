import {
  type AppTheme,
  type ThemePreference,
  DEFAULT_THEME_PREFERENCE,
  DEFAULT_THEME,
  resolveThemeFromPreference,
  THEME_CHANGE_EVENT,
  THEME_COLORS,
  THEME_COOKIE_KEY,
  THEME_COOKIE_MAX_AGE_SECONDS,
  THEME_STORAGE_KEY,
  parseThemeCookie,
  sanitizeThemePreference,
  sanitizeTheme
} from "@/lib/theme";

const THEME_META_SELECTOR = "meta[name='theme-color'][data-dynamic-theme='1']";

function hasBrowserDom() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function getRootElement() {
  if (!hasBrowserDom()) {
    return null;
  }
  return document.documentElement;
}

export function readPersistedTheme(): AppTheme | null {
  const preference = readPersistedThemePreference();
  if (!preference) {
    return null;
  }
  return resolveThemeFromPreference(preference, DEFAULT_THEME);
}

export function readPersistedThemePreference(): ThemePreference | null {
  if (!hasBrowserDom()) {
    return null;
  }

  try {
    const stored = sanitizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
    if (stored) {
      return stored;
    }
  } catch {
    // Ignore localStorage read failures.
  }

  return parseThemeCookie(document.cookie || "");
}

export function resolveThemePreference(
  defaultPreference: ThemePreference = DEFAULT_THEME_PREFERENCE
): ThemePreference {
  const root = getRootElement();
  const rootPreference = sanitizeThemePreference(root?.dataset.themePreference);
  if (rootPreference) {
    return rootPreference;
  }

  return readPersistedThemePreference() ?? defaultPreference;
}

export function resolveTheme(defaultTheme: AppTheme = DEFAULT_THEME): AppTheme {
  const root = getRootElement();
  const rootTheme = sanitizeTheme(root?.dataset.theme);
  if (rootTheme) {
    return rootTheme;
  }

  const preference = readPersistedThemePreference();
  if (!preference) {
    return defaultTheme;
  }
  return resolveThemeFromPreference(preference, defaultTheme);
}

export function applyTheme(theme: AppTheme, preference?: ThemePreference) {
  const root = getRootElement();
  if (!root) {
    return;
  }

  root.dataset.theme = theme;
  if (preference) {
    root.dataset.themePreference = preference;
  } else if (!sanitizeThemePreference(root.dataset.themePreference)) {
    root.dataset.themePreference = theme;
  }
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;

  const themeColorMeta = document.querySelector<HTMLMetaElement>(THEME_META_SELECTOR);
  if (themeColorMeta) {
    themeColorMeta.content = THEME_COLORS[theme];
  }
}

export function persistTheme(theme: AppTheme) {
  persistThemePreference(theme);
}

export function persistThemePreference(preference: ThemePreference) {
  if (!hasBrowserDom()) {
    return;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Ignore localStorage write failures.
  }

  try {
    const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${THEME_COOKIE_KEY}=${encodeURIComponent(preference)}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secureFlag}`;
  } catch {
    // Ignore cookie write failures.
  }
}

export function setTheme(theme: ThemePreference) {
  const resolvedTheme = resolveThemeFromPreference(theme, DEFAULT_THEME);
  applyTheme(resolvedTheme, theme);
  persistThemePreference(theme);

  if (hasBrowserDom()) {
    window.dispatchEvent(
      new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme: resolvedTheme, preference: theme } })
    );
  }

  return resolvedTheme;
}

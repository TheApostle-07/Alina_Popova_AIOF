import {
  type AppTheme,
  DEFAULT_THEME,
  THEME_CHANGE_EVENT,
  THEME_COLORS,
  THEME_COOKIE_KEY,
  THEME_COOKIE_MAX_AGE_SECONDS,
  THEME_STORAGE_KEY,
  parseThemeCookie,
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
  if (!hasBrowserDom()) {
    return null;
  }

  try {
    const stored = sanitizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
    if (stored) {
      return stored;
    }
  } catch {
    // Ignore localStorage read failures.
  }

  return parseThemeCookie(document.cookie || "");
}

export function resolveTheme(defaultTheme: AppTheme = DEFAULT_THEME): AppTheme {
  const root = getRootElement();
  const rootTheme = sanitizeTheme(root?.dataset.theme);
  if (rootTheme) {
    return rootTheme;
  }

  return readPersistedTheme() ?? defaultTheme;
}

export function applyTheme(theme: AppTheme) {
  const root = getRootElement();
  if (!root) {
    return;
  }

  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;

  const themeColorMeta = document.querySelector<HTMLMetaElement>(THEME_META_SELECTOR);
  if (themeColorMeta) {
    themeColorMeta.content = THEME_COLORS[theme];
  }
}

export function persistTheme(theme: AppTheme) {
  if (!hasBrowserDom()) {
    return;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore localStorage write failures.
  }

  try {
    const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${THEME_COOKIE_KEY}=${encodeURIComponent(theme)}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secureFlag}`;
  } catch {
    // Ignore cookie write failures.
  }
}

export function setTheme(theme: AppTheme) {
  applyTheme(theme);
  persistTheme(theme);

  if (hasBrowserDom()) {
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } }));
  }
}

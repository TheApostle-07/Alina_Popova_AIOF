"use client";

import { useEffect, useState } from "react";
import { Monitor, MoonStar, SunMedium } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  applyTheme,
  readPersistedThemePreference,
  resolveTheme,
  resolveThemePreference,
  setTheme as setAndPersistTheme
} from "@/lib/theme-client";
import {
  type AppTheme,
  type ThemePreference,
  DEFAULT_THEME_PREFERENCE,
  DEFAULT_THEME,
  nextThemePreference,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  resolveThemeFromPreference,
  sanitizeThemePreference,
  sanitizeTheme
} from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [preference, setPreference] = useState<ThemePreference>(DEFAULT_THEME_PREFERENCE);
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_THEME);

  useEffect(() => {
    const initialPreference = resolveThemePreference(DEFAULT_THEME_PREFERENCE);
    const initialTheme = resolveTheme(DEFAULT_THEME);
    applyTheme(initialTheme, initialPreference);
    setPreference(initialPreference);
    setTheme(initialTheme);
    setMounted(true);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) {
        return;
      }

      const nextPreference =
        sanitizeThemePreference(event.newValue) ??
        readPersistedThemePreference() ??
        DEFAULT_THEME_PREFERENCE;
      const nextTheme = resolveThemeFromPreference(nextPreference, DEFAULT_THEME);
      applyTheme(nextTheme, nextPreference);
      setPreference(nextPreference);
      setTheme(nextTheme);
    };

    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{
        theme?: AppTheme;
        preference?: ThemePreference;
      }>;
      const hintedTheme = sanitizeTheme(customEvent.detail?.theme);
      const hintedPreference = sanitizeThemePreference(customEvent.detail?.preference);
      const nextPreference = hintedPreference ?? resolveThemePreference(DEFAULT_THEME_PREFERENCE);
      const nextTheme = hintedTheme ?? resolveThemeFromPreference(nextPreference, DEFAULT_THEME);
      applyTheme(nextTheme, nextPreference);
      setPreference(nextPreference);
      setTheme(nextTheme);
    };

    const mediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    const handleSystemThemeChange = () => {
      const nextPreference = resolveThemePreference(DEFAULT_THEME_PREFERENCE);
      if (nextPreference !== "auto") {
        return;
      }

      const nextTheme = resolveThemeFromPreference(nextPreference, DEFAULT_THEME);
      applyTheme(nextTheme, nextPreference);
      setPreference(nextPreference);
      setTheme(nextTheme);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange as EventListener);
    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener("change", handleSystemThemeChange);
    } else if (mediaQuery?.addListener) {
      mediaQuery.addListener(handleSystemThemeChange);
    }

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange as EventListener);
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener("change", handleSystemThemeChange);
      } else if (mediaQuery?.removeListener) {
        mediaQuery.removeListener(handleSystemThemeChange);
      }
    };
  }, []);

  const toggleTheme = () => {
    const nextPreference = nextThemePreference(preference);
    const resolvedTheme = setAndPersistTheme(nextPreference);
    setPreference(nextPreference);
    setTheme(resolvedTheme);
  };

  if (!mounted) {
    return (
      <div
        aria-hidden
        className={cn("h-10 w-10 rounded-xl border border-border/80 bg-surface/70", className)}
      />
    );
  }

  const isLight = theme === "light";
  const label =
    preference === "auto"
      ? `Theme: Auto (currently ${isLight ? "Light" : "Dark"})`
      : preference === "light"
        ? "Theme: Light"
        : "Theme: Dark";
  const Icon = preference === "auto" ? Monitor : isLight ? SunMedium : MoonStar;

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        "h-10 w-10 rounded-xl border-border/80 bg-surface/80 text-text shadow-none hover:bg-surface2/70",
        className
      )}
    >
      <Icon className="h-4.5 w-4.5" />
    </Button>
  );
}

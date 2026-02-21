"use client";

import { useEffect, useState } from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyTheme, readPersistedTheme, resolveTheme, setTheme as setAndPersistTheme } from "@/lib/theme-client";
import {
  type AppTheme,
  DEFAULT_THEME,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  sanitizeTheme
} from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_THEME);

  useEffect(() => {
    const initialTheme = resolveTheme(DEFAULT_THEME);
    applyTheme(initialTheme);
    setTheme(initialTheme);
    setMounted(true);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) {
        return;
      }

      const nextTheme = sanitizeTheme(event.newValue) ?? readPersistedTheme() ?? DEFAULT_THEME;
      applyTheme(nextTheme);
      setTheme(nextTheme);
    };

    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ theme?: AppTheme }>;
      const hintedTheme = sanitizeTheme(customEvent.detail?.theme);
      const nextTheme = hintedTheme ?? resolveTheme(DEFAULT_THEME);
      applyTheme(nextTheme);
      setTheme(nextTheme);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange as EventListener);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme: AppTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    setAndPersistTheme(nextTheme);
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
  const label = isLight ? "Switch to dark mode" : "Switch to light mode";

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
      {isLight ? <MoonStar className="h-4.5 w-4.5" /> : <SunMedium className="h-4.5 w-4.5" />}
    </Button>
  );
}

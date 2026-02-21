import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { cookies } from "next/headers";
import { SiteChrome } from "@/components/layout/site-chrome";
import { ToasterProvider } from "@/components/providers/toaster-provider";
import { BRAND_NAME } from "@/lib/constants";
import { getPublicSiteSettings } from "@/lib/site-settings";
import {
  DEFAULT_THEME,
  THEME_COLORS,
  THEME_COOKIE_KEY,
  THEME_COOKIE_MAX_AGE_SECONDS,
  THEME_STORAGE_KEY,
  sanitizeTheme
} from "@/lib/theme";
import "@/app/globals.css";

const themeBootScript = `
(() => {
  const DEFAULT_THEME = ${JSON.stringify(DEFAULT_THEME)};
  const STORAGE_KEY = ${JSON.stringify(THEME_STORAGE_KEY)};
  const COOKIE_KEY = ${JSON.stringify(THEME_COOKIE_KEY)};
  const COOKIE_MAX_AGE = ${THEME_COOKIE_MAX_AGE_SECONDS};
  const COLORS = ${JSON.stringify(THEME_COLORS)};
  const META_SELECTOR = "meta[name='theme-color'][data-dynamic-theme='1']";

  const sanitize = (value) => (value === "dark" || value === "light" ? value : null);
  const parseCookieTheme = () => {
    const raw = document.cookie || "";
    if (!raw) {
      return null;
    }

    const parts = raw.split(";");
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed.startsWith(COOKIE_KEY + "=")) {
        continue;
      }

      const cookieValue = trimmed.slice(COOKIE_KEY.length + 1);
      try {
        return sanitize(decodeURIComponent(cookieValue));
      } catch {
        return sanitize(cookieValue);
      }
    }

    return null;
  };

  const applyTheme = (theme) => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;

    const themeMeta = document.querySelector(META_SELECTOR);
    if (themeMeta) {
      themeMeta.setAttribute("content", COLORS[theme]);
    }
  };

  const persistTheme = (theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures.
    }

    try {
      const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = COOKIE_KEY + "=" + encodeURIComponent(theme) + "; Path=/; Max-Age=" + COOKIE_MAX_AGE + "; SameSite=Lax" + secureFlag;
    } catch {
      // Ignore cookie failures.
    }
  };

  let resolvedTheme = DEFAULT_THEME;
  try {
    const storedTheme = sanitize(window.localStorage.getItem(STORAGE_KEY));
    const cookieTheme = parseCookieTheme();
    resolvedTheme = storedTheme || cookieTheme || DEFAULT_THEME;
  } catch {
    resolvedTheme = parseCookieTheme() || DEFAULT_THEME;
  }

  applyTheme(resolvedTheme);
  persistTheme(resolvedTheme);
})();
`;

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${BRAND_NAME} Membership`,
  description: "Private member content feed with secure Razorpay subscription access.",
  icons: {
    icon: [
      { url: "/favicon-dark.svg", type: "image/svg+xml" },
      { url: "/favicon-light.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: "/favicon-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
      { url: "/favicon.svg", type: "image/svg+xml" }
    ],
    shortcut: [{ url: "/favicon-dark.svg", type: "image/svg+xml" }]
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: THEME_COLORS.dark
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let ageModeEnabled = true;
  try {
    const settings = await getPublicSiteSettings();
    ageModeEnabled = settings.ageModeEnabled;
  } catch {
    ageModeEnabled = true;
  }

  const cookieStore = await cookies();
  const cookieTheme = sanitizeTheme(cookieStore.get(THEME_COOKIE_KEY)?.value);
  const initialTheme = cookieTheme ?? DEFAULT_THEME;

  return (
    <html
      lang="en"
      data-theme={initialTheme}
      className={initialTheme === "dark" ? "dark" : undefined}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <meta name="theme-color" content={THEME_COLORS[initialTheme]} data-dynamic-theme="1" />
        <link rel="preconnect" href="https://checkout.razorpay.com" crossOrigin="" />
        <link rel="dns-prefetch" href="//checkout.razorpay.com" />
        <link rel="preconnect" href="https://api.razorpay.com" crossOrigin="" />
        <link rel="dns-prefetch" href="//api.razorpay.com" />
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="" />
        <link rel="dns-prefetch" href="//res.cloudinary.com" />
      </head>
      <body className={`${poppins.className} bg-grid antialiased`}>
        <SiteChrome ageModeEnabled={ageModeEnabled}>{children}</SiteChrome>
        <ToasterProvider />
      </body>
    </html>
  );
}

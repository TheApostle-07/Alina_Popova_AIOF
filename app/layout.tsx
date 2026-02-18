import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { SiteChrome } from "@/components/layout/site-chrome";
import { ToasterProvider } from "@/components/providers/toaster-provider";
import { BRAND_NAME } from "@/lib/constants";
import "@/app/globals.css";

const themeBootScript = `
(() => {
  try {
    const key = "alina_theme";
    const stored = window.localStorage.getItem(key);
    const theme = stored === "light" || stored === "dark" ? stored : "dark";
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

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
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F7FF" },
    { media: "(prefers-color-scheme: dark)", color: "#07080C" }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <link rel="preconnect" href="https://checkout.razorpay.com" crossOrigin="" />
        <link rel="dns-prefetch" href="//checkout.razorpay.com" />
        <link rel="preconnect" href="https://api.razorpay.com" crossOrigin="" />
        <link rel="dns-prefetch" href="//api.razorpay.com" />
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="" />
        <link rel="dns-prefetch" href="//res.cloudinary.com" />
      </head>
      <body className={`${poppins.className} bg-grid antialiased`}>
        <SiteChrome>{children}</SiteChrome>
        <ToasterProvider />
      </body>
    </html>
  );
}

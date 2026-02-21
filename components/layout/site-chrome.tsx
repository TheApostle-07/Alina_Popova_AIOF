"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  FileText,
  LayoutDashboard,
  Lock,
  ReceiptText,
  ShieldCheck
} from "lucide-react";
import { usePathname } from "next/navigation";
import { IntentLink } from "@/components/ui/intent-link";
import { BRAND_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/theme-toggle";

type SessionRole = "public" | "member" | "admin";
const SITE_ROLE_STORAGE_KEY = "alina_site_role";

function inferRoleFromPath(pathname: string): SessionRole | null {
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    return "admin";
  }

  if (pathname.startsWith("/access") || pathname.startsWith("/no-go-zone") || pathname.startsWith("/vip")) {
    return "member";
  }

  return null;
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function HeaderLink({
  pathname,
  href,
  label
}: {
  pathname: string;
  href: string;
  label: string;
}) {
  const active = isActivePath(pathname, href);
  return (
    <IntentLink
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-lg px-2.5 py-1.5 transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70",
        active ? "bg-accent/12 text-text" : "text-muted"
      )}
    >
      {label}
    </IntentLink>
  );
}

function PublicFooter({ ageModeEnabled }: { ageModeEnabled: boolean }) {
  return (
    <footer className="bg-theme-footer relative border-t border-border/80">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
      <div className="mx-auto w-full max-w-6xl px-4 py-7 md:py-8">
        <div className="grid gap-5 rounded-3xl border border-border/80 bg-surface/75 p-5 shadow-rose md:grid-cols-[1.1fr_0.9fr] md:p-6">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-accent">Legal & Safety</p>
            <p className="text-base font-medium text-text sm:text-lg">
              Built for secure access, clear boundaries, and transparent policies.
            </p>
            <p className="text-xs leading-relaxed text-muted sm:text-sm">
              Digital content membership. Purchases are non-refundable except where required by
              law.
            </p>
            <p className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-bg/70 px-3 py-1 text-xs text-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              {ageModeEnabled ? "Secured by Razorpay • 18+ only" : "Secured by Razorpay"}
            </p>
          </div>

          <nav className="grid gap-2 sm:grid-cols-3 md:grid-cols-1" aria-label="Legal links">
            <IntentLink
              href="/terms"
              className="group rounded-2xl border border-border/80 bg-bg/45 px-3 py-2.5 transition hover:border-accent/40 hover:bg-bg/80"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-text">
                <FileText className="h-4 w-4 text-accent" /> Terms
              </div>
              <p className="mt-0.5 text-xs text-muted">Rules, use limits, and liability terms</p>
            </IntentLink>

            <IntentLink
              href="/privacy"
              className="group rounded-2xl border border-border/80 bg-bg/45 px-3 py-2.5 transition hover:border-accent/40 hover:bg-bg/80"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-text">
                <Lock className="h-4 w-4 text-accent" /> Privacy
              </div>
              <p className="mt-0.5 text-xs text-muted">Data handling and security controls</p>
            </IntentLink>

            <IntentLink
              href="/refund"
              className="group rounded-2xl border border-border/80 bg-bg/45 px-3 py-2.5 transition hover:border-accent/40 hover:bg-bg/80"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-text">
                <ReceiptText className="h-4 w-4 text-accent" /> Refund
              </div>
              <p className="mt-0.5 text-xs text-muted">No-refund policy and dispute flow</p>
            </IntentLink>
          </nav>
        </div>
      </div>
    </footer>
  );
}

function AdminFooter() {
  return (
    <footer className="border-t border-border/80 bg-bg/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>Admin workspace: role-protected operational dashboard.</p>
        <nav className="flex items-center gap-3" aria-label="Admin footer links">
          <IntentLink href="/admin" className="hover:text-text">
            Dashboard
          </IntentLink>
          <IntentLink href="/admin/vip" className="hover:text-text">
            VIP auctions
          </IntentLink>
          <IntentLink href="/support" className="hover:text-text">
            Support
          </IntentLink>
        </nav>
      </div>
    </footer>
  );
}

export function SiteChrome({
  children,
  ageModeEnabled
}: {
  children: React.ReactNode;
  ageModeEnabled: boolean;
}) {
  const pathname = usePathname() || "/";
  const [sessionRole, setSessionRole] = useState<SessionRole>(() => {
    const inferred = inferRoleFromPath(pathname);
    if (inferred) {
      return inferred;
    }

    if (typeof window !== "undefined") {
      const storedRole = window.sessionStorage.getItem(SITE_ROLE_STORAGE_KEY);
      if (storedRole === "admin" || storedRole === "member" || storedRole === "public") {
        return storedRole;
      }
    }

    return "public";
  });
  const pathRole = inferRoleFromPath(pathname);
  const isAdminLogin = pathname === "/admin/login";
  const effectiveRole = useMemo<SessionRole>(() => pathRole || sessionRole, [pathRole, sessionRole]);
  const isAdminContext = effectiveRole === "admin";
  const isMemberContext = effectiveRole === "member";
  const showAdminNav = isAdminContext || pathname.startsWith("/admin");
  const logoHref = isAdminContext ? "/admin" : isMemberContext ? "/access" : "/";

  useEffect(() => {
    let cancelled = false;

    if (pathRole) {
      setSessionRole(pathRole);
      return () => {
        cancelled = true;
      };
    }

    const detectRole = async () => {
      try {
        const [adminResponse, memberResponse] = await Promise.all([
          fetch("/api/admin/access-check", {
            method: "GET",
            cache: "no-store",
            credentials: "include"
          }),
          fetch("/api/membership/access-check", {
            method: "GET",
            cache: "no-store",
            credentials: "include"
          })
        ]);

        const [adminPayload, memberPayload] = await Promise.all([
          adminResponse.ok ? adminResponse.json().catch(() => null) : Promise.resolve(null),
          memberResponse.ok ? memberResponse.json().catch(() => null) : Promise.resolve(null)
        ]);

        if (cancelled) {
          return;
        }

        const isAdminActive = Boolean(adminResponse.ok && adminPayload?.ok && adminPayload?.data?.active);
        if (isAdminActive) {
          setSessionRole("admin");
          return;
        }

        const isMemberActive = Boolean(
          memberResponse.ok && memberPayload?.ok && memberPayload?.data?.active
        );
        setSessionRole(isMemberActive ? "member" : "public");
      } catch {
        if (!cancelled) {
          setSessionRole("public");
        }
      }
    };

    void detectRole();

    return () => {
      cancelled = true;
    };
  }, [pathname, pathRole]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.sessionStorage.setItem(SITE_ROLE_STORAGE_KEY, sessionRole);
  }, [sessionRole]);

  const mainLabel = isAdminContext ? "Admin workspace" : isMemberContext ? "Member area" : "Public site";

  return (
    <div
      className={cn(
        "relative min-h-screen",
        isAdminContext && "bg-theme-admin-shell"
      )}
    >
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-xl border border-accent bg-surface px-3 py-2 text-sm text-text focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      <div
        className="pointer-events-none fixed right-3 top-[4.5rem] z-[58] sm:right-4 sm:top-[4.85rem]"
        aria-label="Theme control"
      >
        <ThemeToggle className="pointer-events-auto h-9 w-9 rounded-xl sm:h-10 sm:w-10" />
      </div>

      <header className="sticky top-0 z-50 border-b border-border/80 bg-bg/80 backdrop-blur" role="banner">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <IntentLink href={logoHref} className="inline-flex min-w-0 items-center gap-2.5">
            <span className="relative shrink-0 overflow-hidden rounded-xl border border-border/80 bg-surface/70 p-0.5 shadow-[0_10px_22px_-14px_rgba(230,75,140,0.7)]">
              <Image
                src="/icon.svg"
                alt={`${BRAND_NAME} mark`}
                width={64}
                height={64}
                priority
                className="h-8 w-8 rounded-[9px] md:h-9 md:w-9"
              />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold tracking-[0.03em] text-text sm:text-base">
                {BRAND_NAME}
              </span>
              <span className="hidden text-[10px] uppercase tracking-[0.16em] text-muted sm:block">
                Private Membership
              </span>
            </span>
          </IntentLink>

          {!showAdminNav ? (
            <nav
              className="flex items-center gap-1 text-xs sm:text-sm"
              aria-label={isMemberContext ? "Member navigation" : "Site navigation"}
            >
              {isMemberContext ? (
                <>
                  <HeaderLink pathname={pathname} href="/access" label="Home" />
                  <HeaderLink pathname={pathname} href="/vip" label="VIP" />
                  <HeaderLink pathname={pathname} href="/account" label="Account" />
                  <HeaderLink pathname={pathname} href="/support" label="Support" />
                </>
              ) : (
                <>
                  <HeaderLink pathname={pathname} href="/join" label="Join" />
                  <HeaderLink pathname={pathname} href="/account" label="Account" />
                  <HeaderLink pathname={pathname} href="/support" label="Support" />
                </>
              )}
            </nav>
          ) : (
            <nav
              className="flex items-center gap-1 text-xs sm:text-sm"
              aria-label="Admin navigation"
            >
              {isAdminLogin && !isAdminContext ? (
                <>
                  <HeaderLink pathname={pathname} href="/" label="Back to site" />
                  <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-muted">
                    <LayoutDashboard className="h-3.5 w-3.5 text-accent" />
                    Admin login
                  </span>
                </>
              ) : (
                <>
                  <HeaderLink pathname={pathname} href="/admin" label="Dashboard" />
                  <HeaderLink pathname={pathname} href="/admin/vip" label="VIP" />
                  <HeaderLink pathname={pathname} href="/support" label="Support" />
                </>
              )}
            </nav>
          )}
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        aria-label={mainLabel}
        className={cn(
          "mx-auto w-full px-4 py-8 md:py-12",
          isAdminContext ? "max-w-[90rem]" : "max-w-6xl"
        )}
      >
        {children}
      </main>

      {showAdminNav && !isAdminLogin ? <AdminFooter /> : <PublicFooter ageModeEnabled={ageModeEnabled} />}
    </div>
  );
}

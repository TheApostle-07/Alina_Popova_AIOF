import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  AGE_COOKIE_NAME,
  AGE_DECLINED_COOKIE_NAME,
  MEMBER_COOKIE_NAME
} from "@/lib/constants";
import { getAllowedOrigins, normalizeOrigin } from "@/lib/origin";
import { applyApiCorsHeaders, applySecurityHeaders } from "@/lib/security-headers";
import { getRequestId } from "@/lib/request";

const SITE_SETTINGS_CACHE_TTL_MS = 30_000;
const SITE_SETTINGS_FALLBACK_TTL_MS = 10_000;

let cachedAgeModeEnabled = true;
let cachedAgeModeExpiresAt = 0;

function isStaticPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots") ||
    pathname.startsWith("/sitemap") ||
    pathname.includes(".")
  );
}

function isMemberApiPath(pathname: string) {
  return pathname === "/api/member" || pathname.startsWith("/api/member/");
}

async function getAgeModeEnabled(request: NextRequest) {
  const now = Date.now();
  if (cachedAgeModeExpiresAt > now) {
    return cachedAgeModeEnabled;
  }

  try {
    const settingsUrl = new URL("/api/public/settings", request.url);
    const response = await fetch(settingsUrl.toString(), {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json"
      }
    });

    if (response.ok) {
      const payload = await response.json().catch(() => null);
      const parsed =
        Boolean(payload?.ok) && typeof payload?.data?.ageModeEnabled === "boolean"
          ? payload.data.ageModeEnabled
          : true;

      cachedAgeModeEnabled = parsed;
      cachedAgeModeExpiresAt = now + SITE_SETTINGS_CACHE_TTL_MS;
      return cachedAgeModeEnabled;
    }
  } catch {
    // Ignore and use fallback state.
  }

  cachedAgeModeEnabled = true;
  cachedAgeModeExpiresAt = now + SITE_SETTINGS_FALLBACK_TTL_MS;
  return cachedAgeModeEnabled;
}

function withSecurityHeaders(request: NextRequest, response: NextResponse) {
  const requestId = getRequestId(request);
  response.headers.set("x-request-id", requestId);
  applySecurityHeaders(response.headers);
  if (request.nextUrl.pathname.startsWith("/api")) {
    const requestOrigin = request.headers.get("origin");
    applyApiCorsHeaders(response.headers, requestOrigin, request);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    if (request.method === "OPTIONS") {
      const requestOrigin = request.headers.get("origin");
      const allowedOrigins = getAllowedOrigins(request);
      const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
      if (normalizedRequestOrigin && !allowedOrigins.includes(normalizedRequestOrigin)) {
        return withSecurityHeaders(
          request,
          NextResponse.json({ ok: false, error: "Forbidden origin" }, { status: 403 })
        );
      }
      return withSecurityHeaders(request, new NextResponse(null, { status: 204 }));
    }

    if (
      pathname.startsWith("/api/admin") &&
      pathname !== "/api/admin/login" &&
      pathname !== "/api/admin/access-check"
    ) {
      const adminCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
      if (!adminCookie) {
        return withSecurityHeaders(
          request,
          NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
        );
      }
    }

    if (
      pathname.startsWith("/api/content/feed") ||
      pathname.startsWith("/api/media/sign") ||
      pathname.startsWith("/api/vip") ||
      isMemberApiPath(pathname)
    ) {
      const memberCookie = request.cookies.get(MEMBER_COOKIE_NAME)?.value;
      if (!memberCookie) {
        return withSecurityHeaders(
          request,
          NextResponse.json({ ok: false, error: "Membership inactive" }, { status: 401 })
        );
      }
    }

    return withSecurityHeaders(request, NextResponse.next());
  }

  if (isStaticPath(pathname)) {
    return withSecurityHeaders(request, NextResponse.next());
  }

  const ageModeEnabled = await getAgeModeEnabled(request);
  if (ageModeEnabled) {
    const ageVerified = request.cookies.get(AGE_COOKIE_NAME)?.value === "1";
    const ageDeclined = request.cookies.get(AGE_DECLINED_COOKIE_NAME)?.value === "1";

    if (pathname !== "/age" && !pathname.startsWith("/age/") && (!ageVerified || ageDeclined)) {
      const url = new URL("/age", request.url);
      url.searchParams.set("next", `${pathname}${request.nextUrl.search || ""}`);
      return withSecurityHeaders(request, NextResponse.redirect(url));
    }
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const adminCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!adminCookie) {
      const loginUrl = new URL("/admin/login", request.url);
      return withSecurityHeaders(request, NextResponse.redirect(loginUrl));
    }
  }

  if (pathname.startsWith("/access") || pathname.startsWith("/no-go-zone") || pathname.startsWith("/vip")) {
    const memberCookie = request.cookies.get(MEMBER_COOKIE_NAME)?.value;
    if (!memberCookie) {
      const accountUrl = new URL("/account", request.url);
      accountUrl.searchParams.set("reason", "session");
      return withSecurityHeaders(request, NextResponse.redirect(accountUrl));
    }
  }

  return withSecurityHeaders(request, NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

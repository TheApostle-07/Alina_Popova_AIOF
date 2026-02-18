import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  AGE_COOKIE_NAME,
  AGE_DECLINED_COOKIE_NAME,
  MEMBER_COOKIE_NAME
} from "@/lib/constants";
import { applyApiCorsHeaders, applySecurityHeaders, getAllowedOrigin } from "@/lib/security-headers";
import { getRequestId } from "@/lib/request";

const PUBLIC_PATHS = ["/age", "/terms", "/privacy", "/refund", "/support"];

function isStaticPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots") ||
    pathname.startsWith("/sitemap") ||
    pathname.includes(".")
  );
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isMemberApiPath(pathname: string) {
  return pathname === "/api/member" || pathname.startsWith("/api/member/");
}

function withSecurityHeaders(request: NextRequest, response: NextResponse) {
  const requestId = getRequestId(request);
  response.headers.set("x-request-id", requestId);
  applySecurityHeaders(response.headers);
  if (request.nextUrl.pathname.startsWith("/api")) {
    const requestOrigin = request.headers.get("origin");
    applyApiCorsHeaders(response.headers, requestOrigin);
  }
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) {
    if (request.method === "OPTIONS") {
      const requestOrigin = request.headers.get("origin");
      const allowedOrigin = getAllowedOrigin();
      if (requestOrigin && requestOrigin !== allowedOrigin) {
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

  const ageVerified = request.cookies.get(AGE_COOKIE_NAME)?.value === "1";
  const ageDeclined = request.cookies.get(AGE_DECLINED_COOKIE_NAME)?.value === "1";

  if (!isPublicPath(pathname) && (!ageVerified || ageDeclined)) {
    const url = new URL("/age", request.url);
    url.searchParams.set("next", `${pathname}${request.nextUrl.search || ""}`);
    return withSecurityHeaders(request, NextResponse.redirect(url));
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const adminCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!adminCookie) {
      const loginUrl = new URL("/admin/login", request.url);
      return withSecurityHeaders(request, NextResponse.redirect(loginUrl));
    }
  }

  if (pathname.startsWith("/access") || pathname.startsWith("/no-go-zone")) {
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

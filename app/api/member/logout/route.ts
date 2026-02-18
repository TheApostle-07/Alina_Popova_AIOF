import { NextRequest, NextResponse } from "next/server";
import {
  clearAdminSessionCookie,
  clearMemberSessionCookie,
  revokeAdminSessionToken,
  revokeMemberSessionToken
} from "@/lib/auth/session";
import {
  ADMIN_COOKIE_NAME,
  LAST_CHECKOUT_ATTEMPT_COOKIE,
  LAST_SUBSCRIPTION_COOKIE,
  MEMBER_COOKIE_NAME
} from "@/lib/constants";
import { handleApiError, jsonOk } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

function clearCheckoutTrackingCookies(response: NextResponse) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set({
    name: LAST_SUBSCRIPTION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: new Date(0)
  });
  response.cookies.set({
    name: LAST_CHECKOUT_ATTEMPT_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: new Date(0)
  });
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await Promise.all([
      revokeMemberSessionToken(request.cookies.get(MEMBER_COOKIE_NAME)?.value),
      revokeAdminSessionToken(request.cookies.get(ADMIN_COOKIE_NAME)?.value)
    ]);
    const response = jsonOk({ success: true });
    clearMemberSessionCookie(response);
    clearAdminSessionCookie(response);
    clearCheckoutTrackingCookies(response);
    return response;
  } catch (error) {
    return handleApiError({
      request,
      route: "POST /api/member/logout",
      error,
      fallbackMessage: "Logout failed"
    });
  }
}

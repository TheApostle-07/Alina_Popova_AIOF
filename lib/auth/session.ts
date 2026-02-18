import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import crypto from "crypto";
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_HOURS, MEMBER_COOKIE_NAME, MEMBER_SESSION_DAYS } from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { RevokedSessionModel } from "@/lib/models/revoked-session";
import { logError } from "@/lib/log";

type MemberSessionPayload = JWTPayload & {
  type: "member";
  memberId: string;
  subscriptionId: string;
};

type AdminSessionPayload = JWTPayload & {
  type: "admin";
};

const encoder = new TextEncoder();

function getSecret() {
  const { SESSION_SECRET } = getEnv();
  return encoder.encode(SESSION_SECRET);
}

function getSecureCookieFlag() {
  return process.env.NODE_ENV === "production";
}

export async function signMemberSession(memberId: string, subscriptionId: string) {
  return new SignJWT({ type: "member", memberId, subscriptionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime(`${MEMBER_SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function signAdminSession() {
  return new SignJWT({ type: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime(`${ADMIN_SESSION_HOURS}h`)
    .sign(getSecret());
}

async function isSessionRevoked(jti?: string | null) {
  if (!jti) {
    return true;
  }

  await connectToDatabase();
  const revoked = await RevokedSessionModel.findById(jti).select({ _id: 1 }).lean();
  return Boolean(revoked);
}

export async function verifyMemberSession(token?: string | null) {
  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify(token, getSecret());
    if (verified.payload.type !== "member" || !verified.payload.jti) {
      return null;
    }
    if (await isSessionRevoked(verified.payload.jti)) {
      return null;
    }
    return verified.payload as MemberSessionPayload;
  } catch {
    return null;
  }
}

export async function verifyAdminSession(token?: string | null) {
  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify(token, getSecret());
    if (verified.payload.type !== "admin" || !verified.payload.jti) {
      return null;
    }
    if (await isSessionRevoked(verified.payload.jti)) {
      return null;
    }
    return verified.payload as AdminSessionPayload;
  } catch {
    return null;
  }
}

export function setMemberSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: MEMBER_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: getSecureCookieFlag(),
    path: "/",
    maxAge: MEMBER_SESSION_DAYS * 24 * 60 * 60
  });
}

export function clearMemberSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: MEMBER_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: getSecureCookieFlag(),
    path: "/",
    expires: new Date(0)
  });
}

export function setAdminSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "strict",
    secure: getSecureCookieFlag(),
    path: "/",
    maxAge: ADMIN_SESSION_HOURS * 60 * 60
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: getSecureCookieFlag(),
    path: "/",
    expires: new Date(0)
  });
}

export async function maybeRotateMemberSession(
  response: NextResponse,
  payload: MemberSessionPayload
) {
  if (!payload.exp) {
    return;
  }

  const remainingMs = payload.exp * 1000 - Date.now();
  const rotationWindowMs = 3 * 24 * 60 * 60 * 1000;
  if (remainingMs <= rotationWindowMs) {
    const freshToken = await signMemberSession(payload.memberId, payload.subscriptionId);
    setMemberSessionCookie(response, freshToken);
  }
}

async function revokeSessionToken(token: string | null | undefined, expectedType: "member" | "admin") {
  if (!token) {
    return;
  }

  try {
    const verified = await jwtVerify(token, getSecret());
    const payloadType = verified.payload.type;
    const jti = verified.payload.jti;
    const exp = verified.payload.exp;

    if (payloadType !== expectedType || !jti || !exp) {
      return;
    }

    await connectToDatabase();
    await RevokedSessionModel.updateOne(
      { _id: jti },
      {
        $setOnInsert: {
          type: expectedType,
          expiresAt: new Date(exp * 1000)
        }
      },
      { upsert: true }
    );
  } catch (error) {
    logError("session_revoke_failed", {
      expectedType,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export async function revokeMemberSessionToken(token?: string | null) {
  await revokeSessionToken(token, "member");
}

export async function revokeAdminSessionToken(token?: string | null) {
  await revokeSessionToken(token, "admin");
}

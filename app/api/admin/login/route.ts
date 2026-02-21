import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { handleApiError, jsonError, jsonOk, parseJsonBody } from "@/lib/http";
import { AdminAuthAttemptModel } from "@/lib/models/admin-auth-attempt";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, getIdentifierBucketKey } from "@/lib/request";
import { assertAdminIpAllowed, safeCompare } from "@/lib/security";
import { adminLoginSchema } from "@/lib/validators";
import { setAdminSessionCookie, signAdminSession } from "@/lib/auth/session";

export const runtime = "nodejs";

const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    assertAdminIpAllowed(ip);

    const parsedBody = await parseJsonBody(request, adminLoginSchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const memoryRate = await consumeRateLimit(`admin:login:${ip}`, {
      windowMs: 15 * 60 * 1000,
      limit: 20,
      lockoutMs: 15 * 60 * 1000,
      namespace: "admin_login_ip"
    });

    if (!memoryRate.allowed) {
      return jsonError("Too many attempts. Try again later.", 429);
    }

    const identifierRate = await consumeRateLimit(
      getIdentifierBucketKey("admin:login:identifier", `admin:${ip}`),
      {
        windowMs: 15 * 60 * 1000,
        limit: 10,
        lockoutMs: 15 * 60 * 1000,
        namespace: "admin_login_identifier"
      }
    );

    if (!identifierRate.allowed) {
      return jsonError("Too many attempts. Try again later.", 429);
    }

    await connectToDatabase();

    const identifier = `ip:${ip}`;
    const now = new Date();
    const attempt =
      (await AdminAuthAttemptModel.findOne({ identifier })) ||
      (await AdminAuthAttemptModel.create({ identifier, attempts: 0 }));

    if (attempt.lockUntil && attempt.lockUntil.getTime() > Date.now()) {
      return jsonError("Admin login temporarily locked. Please wait.", 429);
    }

    const { ADMIN_PASSWORD } = getEnv();
    const valid = safeCompare(parsedBody.data.password, ADMIN_PASSWORD);

    if (!valid) {
      attempt.attempts += 1;
      attempt.lastAttemptAt = now;
      if (attempt.attempts >= LOCK_THRESHOLD) {
        attempt.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
      }
      await attempt.save();

      if (attempt.lockUntil) {
        return jsonError("Too many failed attempts. Account locked temporarily.", 429);
      }

      return jsonError("Invalid credentials", 401);
    }

    attempt.attempts = 0;
    attempt.lockUntil = null;
    attempt.lastAttemptAt = now;
    await attempt.save();

    const response = jsonOk({ success: true });
    const token = await signAdminSession();
    setAdminSessionCookie(response, token);

    return response;
  } catch (error) {
    return handleApiError({
      request,
      route: "POST /api/admin/login",
      error,
      fallbackMessage: "Admin login failed"
    });
  }
}

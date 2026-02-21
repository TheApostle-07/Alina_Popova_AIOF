import crypto from "crypto";
import { getEnv } from "@/lib/env";
import { getAllowedOrigins, normalizeOrigin } from "@/lib/origin";

export function hashPayload(payload: string) {
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    throw new Error("Invalid request origin");
  }

  const allowedOrigins = getAllowedOrigins(request);
  if (!allowedOrigins.includes(normalizedOrigin)) {
    throw new Error("Invalid request origin");
  }
}

export function assertAdminIpAllowed(ip: string) {
  const { ADMIN_IP_ALLOWLIST } = getEnv();
  if (!ADMIN_IP_ALLOWLIST) {
    return;
  }

  const allowed = ADMIN_IP_ALLOWLIST.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!allowed.length) {
    return;
  }

  if (!allowed.includes(ip)) {
    throw new Error("IP address is not allowed");
  }
}

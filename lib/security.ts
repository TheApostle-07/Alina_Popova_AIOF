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

function getSecFetchSite(request: Request) {
  return (request.headers.get("sec-fetch-site") || "").trim().toLowerCase();
}

function isLikelySameSiteRequest(request: Request) {
  const secFetchSite = getSecFetchSite(request);
  return secFetchSite === "" || secFetchSite === "same-origin" || secFetchSite === "same-site";
}

export function assertSameOrigin(request: Request) {
  const allowedOrigins = new Set(getAllowedOrigins(request));
  const originHeader = request.headers.get("origin");
  const normalizedOrigin = normalizeOrigin(originHeader);

  if (originHeader && originHeader.toLowerCase() !== "null") {
    if (normalizedOrigin && allowedOrigins.has(normalizedOrigin)) {
      return;
    }

    const refererOrigin = normalizeOrigin(request.headers.get("referer"));
    if (refererOrigin && allowedOrigins.has(refererOrigin) && isLikelySameSiteRequest(request)) {
      return;
    }

    if (isLikelySameSiteRequest(request)) {
      return;
    }

    throw new Error("Invalid request origin");
  }

  const refererHeader = request.headers.get("referer");
  const normalizedRefererOrigin = normalizeOrigin(refererHeader);
  if (normalizedRefererOrigin && allowedOrigins.has(normalizedRefererOrigin)) {
    return;
  }

  if (isLikelySameSiteRequest(request)) {
    return;
  }

  throw new Error("Invalid request origin");
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

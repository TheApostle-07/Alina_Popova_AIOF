import { NextRequest } from "next/server";
import { parseGeoFromHeaders } from "@/lib/geo";
import { jsonError, jsonOk, parseJsonBody } from "@/lib/http";
import { logWarn } from "@/lib/log";
import { trackEvent } from "@/lib/metrics";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, getIdentifierBucketKey, getRequestId } from "@/lib/request";
import { assertSameOrigin } from "@/lib/security";
import { trackEventSchema } from "@/lib/validators";

export const runtime = "nodejs";
const TRACK_WRITE_TIMEOUT_MS = 1200;

function pickReferrerHost(value?: string | null) {
  if (!value) {
    return "direct";
  }

  try {
    return new URL(value).hostname.slice(0, 140);
  } catch {
    return value.slice(0, 140) || "direct";
  }
}

function inferDevice(userAgent?: string | null): "mobile" | "tablet" | "desktop" | "unknown" {
  if (!userAgent) {
    return "unknown";
  }

  const agent = userAgent.toLowerCase();
  if (agent.includes("ipad") || agent.includes("tablet")) {
    return "tablet";
  }
  if (agent.includes("mobi") || agent.includes("android")) {
    return "mobile";
  }
  if (agent.includes("windows") || agent.includes("macintosh") || agent.includes("linux")) {
    return "desktop";
  }
  return "unknown";
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const ip = getClientIp(request);
    const ipRate = await consumeRateLimit(`track:ip:${ip}`, {
      windowMs: 60 * 1000,
      limit: 120,
      lockoutMs: 60 * 1000,
      namespace: "track_ip"
    });
    if (!ipRate.allowed) {
      return jsonError("Too many requests", 429);
    }

    const parsedBody = await parseJsonBody(request, trackEventSchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const sessionId = parsedBody.data.sessionId;
    if (sessionId) {
      const sessionRate = await consumeRateLimit(getIdentifierBucketKey("track:session", sessionId), {
        windowMs: 60 * 1000,
        limit: 80,
        lockoutMs: 60 * 1000,
        namespace: "track_session"
      });
      if (!sessionRate.allowed) {
        return jsonError("Too many requests", 429);
      }
    }

    const requestReferrer = request.headers.get("referer");
    const requestUserAgent = request.headers.get("user-agent");
    const geo = parseGeoFromHeaders(request.headers);
    const requestId = getRequestId(request);
    let degraded = false;

    const payload = {
      ...parsedBody.data,
      referrer: pickReferrerHost(parsedBody.data.referrer || requestReferrer),
      device: parsedBody.data.device || inferDevice(requestUserAgent),
      ...geo
    };

    try {
      const trackingResult = await Promise.race([
        trackEvent(payload).then(() => "ok" as const),
        new Promise<"timeout">((resolve) => {
          setTimeout(() => resolve("timeout"), TRACK_WRITE_TIMEOUT_MS);
        })
      ]);

      if (trackingResult === "timeout") {
        degraded = true;
        logWarn("track_event_degraded", {
          route: "POST /api/track",
          requestId,
          event: payload.event,
          path: payload.path,
          error: "TRACK_WRITE_TIMEOUT"
        });
      }
    } catch (trackError) {
      degraded = true;
      logWarn("track_event_degraded", {
        route: "POST /api/track",
        requestId,
        event: payload.event,
        path: payload.path,
        error: trackError instanceof Error ? trackError.message : "Unknown error"
      });
    }

    return jsonOk({ success: true, degraded });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid request origin") {
      return jsonError("Forbidden", 403);
    }

    logWarn("track_request_failed", {
      route: "POST /api/track",
      requestId: getRequestId(request),
      error: error instanceof Error ? error.message : "Unknown error"
    });
    return jsonOk({ success: false, degraded: true });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { logError } from "@/lib/log";
import { getRequestId } from "@/lib/request";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(message: string, status = 400, extras?: Record<string, unknown>) {
  const safeMessage = status >= 500 ? "Internal server error" : message;
  const safeExtras = status >= 500 ? { requestId: extras?.requestId } : extras || {};
  return NextResponse.json(
    {
      ok: false,
      error: safeMessage,
      ...safeExtras
    },
    { status }
  );
}

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  fallbackError = "Invalid payload"
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false as const, response: jsonError(fallbackError, 422) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false as const, response: jsonError(parsed.error.issues[0]?.message || fallbackError, 422) };
  }
  return { ok: true as const, data: parsed.data };
}

export function parseSearchParams<T>(
  request: Request,
  schema: z.ZodType<T>,
  fallbackError = "Invalid query"
) {
  const url = new URL(request.url);
  const values: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    values[key] = value;
  }

  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return { ok: false as const, response: jsonError(parsed.error.issues[0]?.message || fallbackError, 422) };
  }
  return { ok: true as const, data: parsed.data };
}

type HandleApiErrorInput = {
  request: Request;
  route: string;
  error: unknown;
  fallbackMessage?: string;
};

export function handleApiError(input: HandleApiErrorInput) {
  const requestId = getRequestId(input.request);
  const errorMessage = input.error instanceof Error ? input.error.message : "Unknown error";
  logError("api_error", {
    route: input.route,
    requestId,
    error: errorMessage
  });

  if (errorMessage === "Invalid request origin") {
    return jsonError("Invalid request origin", 403, { requestId });
  }

  if (errorMessage === "IP address is not allowed") {
    return jsonError("Forbidden", 403, { requestId });
  }

  return jsonError(input.fallbackMessage || "Request failed", 500, { requestId });
}

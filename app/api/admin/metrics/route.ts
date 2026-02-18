import { NextRequest } from "next/server";
import { getAdminPayloadFromRequest } from "@/lib/auth/request-auth";
import { handleApiError, jsonError, jsonOk, parseSearchParams } from "@/lib/http";
import { getMetricsSummary } from "@/lib/metrics";
import { adminMetricsQuerySchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = await getAdminPayloadFromRequest(request);
  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const parsedQuery = parseSearchParams(request, adminMetricsQuerySchema);
    if (!parsedQuery.ok) {
      return parsedQuery.response;
    }
    const days = parsedQuery.data.days || 30;
    const metrics = await getMetricsSummary(days);
    return jsonOk(metrics);
  } catch (error) {
    return handleApiError({
      request,
      route: "GET /api/admin/metrics",
      error,
      fallbackMessage: "Unable to load metrics"
    });
  }
}

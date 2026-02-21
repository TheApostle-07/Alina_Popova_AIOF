import { NextRequest } from "next/server";
import { getPublicSiteSettings } from "@/lib/site-settings";
import { handleApiError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const settings = await getPublicSiteSettings();
    return jsonOk(settings, {
      headers: {
        "cache-control": "public, max-age=30, s-maxage=30"
      }
    });
  } catch (error) {
    return handleApiError({
      request,
      route: "GET /api/public/settings",
      error,
      fallbackMessage: "Unable to load site settings"
    });
  }
}

import { z } from "zod";
import { NextRequest } from "next/server";
import { getAdminPayloadFromRequest } from "@/lib/auth/request-auth";
import { handleApiError, jsonError, jsonOk, parseJsonBody } from "@/lib/http";
import { getPublicSiteSettings, updatePublicSiteSettings } from "@/lib/site-settings";
import { assertSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

const updateSchema = z
  .object({
    ageModeEnabled: z.boolean()
  })
  .strict();

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminPayloadFromRequest(request);
    if (!admin) {
      return jsonError("Unauthorized", 401);
    }

    const settings = await getPublicSiteSettings();
    return jsonOk(settings);
  } catch (error) {
    return handleApiError({
      request,
      route: "GET /api/admin/settings",
      error,
      fallbackMessage: "Unable to load admin settings"
    });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await getAdminPayloadFromRequest(request);
    if (!admin) {
      return jsonError("Unauthorized", 401);
    }

    assertSameOrigin(request);

    const parsedBody = await parseJsonBody(request, updateSchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const settings = await updatePublicSiteSettings({
      ageModeEnabled: parsedBody.data.ageModeEnabled
    });

    return jsonOk(settings);
  } catch (error) {
    return handleApiError({
      request,
      route: "PATCH /api/admin/settings",
      error,
      fallbackMessage: "Unable to update admin settings"
    });
  }
}

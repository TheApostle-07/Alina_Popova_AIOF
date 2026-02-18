import { NextRequest } from "next/server";
import { getCurrentMemberFromRequest } from "@/lib/auth/guards";
import { getMemberPayloadFromRequest } from "@/lib/auth/request-auth";
import { maybeRotateMemberSession } from "@/lib/auth/session";
import { createSignedMediaUrl } from "@/lib/cloudinary";
import { handleApiError, jsonError, jsonOk, parseSearchParams } from "@/lib/http";
import { mediaSignQuerySchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const member = await getCurrentMemberFromRequest(request);
    const sessionPayload = await getMemberPayloadFromRequest(request);
    if (!member) {
      return jsonError("Membership inactive", 401);
    }

    const parsedQuery = parseSearchParams(request, mediaSignQuerySchema);
    if (!parsedQuery.ok) {
      return parsedQuery.response;
    }
    const assetId = parsedQuery.data.assetId;
    const type = parsedQuery.data.type === "video" ? "video" : "image";

    const signedUrl = createSignedMediaUrl(assetId, type);
    const response = jsonOk({ signedUrl });
    if (sessionPayload) {
      await maybeRotateMemberSession(response, sessionPayload);
    }
    return response;
  } catch (error) {
    return handleApiError({
      request,
      route: "GET /api/media/sign",
      error,
      fallbackMessage: "Unable to sign media"
    });
  }
}

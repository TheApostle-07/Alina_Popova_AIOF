import { z } from "zod";
import { NextRequest } from "next/server";
import { getAdminPayloadFromRequest } from "@/lib/auth/request-auth";
import { createSignedUploadParams } from "@/lib/cloudinary";
import { handleApiError, jsonError, jsonOk, parseJsonBody } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  resourceType: z.enum(["image", "video", "auto"]).optional()
}).strict();

export async function POST(request: NextRequest) {
  const admin = await getAdminPayloadFromRequest(request);
  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  try {
    assertSameOrigin(request);

    const parsedBody = await parseJsonBody(request, schema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const upload = createSignedUploadParams({ resourceType: parsedBody.data.resourceType || "auto" });
    return jsonOk(upload);
  } catch (error) {
    return handleApiError({
      request,
      route: "POST /api/admin/media/sign-upload",
      error,
      fallbackMessage: "Unable to sign upload"
    });
  }
}

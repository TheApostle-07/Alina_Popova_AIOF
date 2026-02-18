import { Types } from "mongoose";
import { NextRequest } from "next/server";
import { getAdminPayloadFromRequest } from "@/lib/auth/request-auth";
import { deleteMediaAsset } from "@/lib/cloudinary";
import { connectToDatabase } from "@/lib/db";
import { handleApiError, jsonError, jsonOk, parseJsonBody } from "@/lib/http";
import { ContentModel } from "@/lib/models/content";
import { assertSameOrigin } from "@/lib/security";
import { contentUpdateSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminPayloadFromRequest(request);
  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  try {
    assertSameOrigin(request);

    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return jsonError("Invalid content id", 422);
    }

    const parsedBody = await parseJsonBody(request, contentUpdateSchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const updates: Record<string, unknown> = { ...parsedBody.data };

    if (parsedBody.data.publishAt) {
      updates.publishAt = new Date(parsedBody.data.publishAt);
    }

    await connectToDatabase();

    const item = await ContentModel.findByIdAndUpdate(id, updates, { new: true });
    if (!item) {
      return jsonError("Content not found", 404);
    }

    return jsonOk({
      item: {
        _id: String(item._id),
        status: item.status
      }
    });
  } catch (error) {
    return handleApiError({
      request,
      route: "PATCH /api/admin/content/[id]",
      error,
      fallbackMessage: "Content update failed"
    });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminPayloadFromRequest(request);
  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  try {
    assertSameOrigin(request);

    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return jsonError("Invalid content id", 422);
    }

    await connectToDatabase();

    const item = await ContentModel.findById(id);
    if (!item) {
      return jsonError("Content not found", 404);
    }

    await ContentModel.deleteOne({ _id: item._id });

    try {
      await deleteMediaAsset(item.mediaAssetId, item.type);
    } catch {
      // Content row is the source of truth; media cleanup failures can be retried manually.
    }

    return jsonOk({ deleted: true });
  } catch (error) {
    return handleApiError({
      request,
      route: "DELETE /api/admin/content/[id]",
      error,
      fallbackMessage: "Content delete failed"
    });
  }
}

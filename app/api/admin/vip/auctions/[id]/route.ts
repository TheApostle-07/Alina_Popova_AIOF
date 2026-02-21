import { NextRequest } from "next/server";
import { getAdminPayloadFromRequest } from "@/lib/auth/request-auth";
import { handleApiError, jsonError, jsonOk, parseJsonBody } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security";
import { updateVipAuctionByAdmin } from "@/lib/vip-service";
import { adminVipAuctionUpdateSchema } from "@/lib/validators";

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

    const params = await context.params;
    const parsedBody = await parseJsonBody(request, adminVipAuctionUpdateSchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const result = await updateVipAuctionByAdmin(params.id, {
      ...parsedBody.data,
      callStartsAt: parsedBody.data.callStartsAt
        ? new Date(parsedBody.data.callStartsAt)
        : undefined,
      biddingStartsAt: parsedBody.data.biddingStartsAt
        ? new Date(parsedBody.data.biddingStartsAt)
        : undefined,
      biddingEndsAt: parsedBody.data.biddingEndsAt
        ? new Date(parsedBody.data.biddingEndsAt)
        : undefined
    });

    if (!result.ok) {
      return jsonError(result.message, result.status);
    }

    return jsonOk({ id: result.id });
  } catch (error) {
    return handleApiError({
      request,
      route: "PATCH /api/admin/vip/auctions/:id",
      error,
      fallbackMessage: "Unable to update VIP auction"
    });
  }
}

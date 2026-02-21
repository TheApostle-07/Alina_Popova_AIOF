import { NextRequest } from "next/server";
import { getAdminPayloadFromRequest } from "@/lib/auth/request-auth";
import { handleApiError, jsonError, jsonOk, parseJsonBody, parseSearchParams } from "@/lib/http";
import { assertSameOrigin } from "@/lib/security";
import { createVipAuctionByAdmin, getVipAuctionsForAdmin } from "@/lib/vip-service";
import { adminVipAuctionCreateSchema, adminVipAuctionListQuerySchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = await getAdminPayloadFromRequest(request);
  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const parsedQuery = parseSearchParams(request, adminVipAuctionListQuerySchema);
    if (!parsedQuery.ok) {
      return parsedQuery.response;
    }

    const items = await getVipAuctionsForAdmin({
      status: parsedQuery.data.status,
      limit: parsedQuery.data.limit
    });

    return jsonOk({ items });
  } catch (error) {
    return handleApiError({
      request,
      route: "GET /api/admin/vip/auctions",
      error,
      fallbackMessage: "Unable to load VIP auctions"
    });
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminPayloadFromRequest(request);
  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  try {
    assertSameOrigin(request);

    const parsedBody = await parseJsonBody(request, adminVipAuctionCreateSchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const created = await createVipAuctionByAdmin({
      ...parsedBody.data,
      callStartsAt: new Date(parsedBody.data.callStartsAt),
      biddingStartsAt: new Date(parsedBody.data.biddingStartsAt),
      biddingEndsAt: new Date(parsedBody.data.biddingEndsAt)
    });

    if (!created.ok) {
      return jsonError(created.message, created.status);
    }

    return jsonOk({
      id: created.id
    });
  } catch (error) {
    return handleApiError({
      request,
      route: "POST /api/admin/vip/auctions",
      error,
      fallbackMessage: "Unable to create VIP auction"
    });
  }
}

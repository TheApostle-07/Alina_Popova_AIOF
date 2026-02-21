import { NextRequest } from "next/server";
import { getCurrentMemberFromRequest } from "@/lib/auth/guards";
import { handleApiError, jsonError, jsonOk, parseSearchParams } from "@/lib/http";
import { getVipAuctionBoardForMember } from "@/lib/vip-service";
import { vipAuctionListQuerySchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const member = await getCurrentMemberFromRequest(request);
    if (!member) {
      return jsonError("Membership inactive", 401);
    }

    const parsedQuery = parseSearchParams(request, vipAuctionListQuerySchema);
    if (!parsedQuery.ok) {
      return parsedQuery.response;
    }

    const board = await getVipAuctionBoardForMember(member.memberId, {
      liveLimit: parsedQuery.data.liveLimit,
      upcomingLimit: parsedQuery.data.upcomingLimit,
      pastLimit: parsedQuery.data.pastLimit
    });

    return jsonOk(board, {
      headers: {
        "cache-control": "private, no-store"
      }
    });
  } catch (error) {
    return handleApiError({
      request,
      route: "GET /api/vip/auctions",
      error,
      fallbackMessage: "Unable to load VIP auctions"
    });
  }
}

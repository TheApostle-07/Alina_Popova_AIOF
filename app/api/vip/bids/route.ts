import { NextRequest } from "next/server";
import { getCurrentMemberFromRequest } from "@/lib/auth/guards";
import { handleApiError, jsonError, jsonOk, parseJsonBody } from "@/lib/http";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, getIdentifierBucketKey } from "@/lib/request";
import { assertSameOrigin } from "@/lib/security";
import { placeVipBid } from "@/lib/vip-service";
import { vipBidCreateSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const member = await getCurrentMemberFromRequest(request);
    if (!member) {
      return jsonError("Membership inactive", 401);
    }

    const parsedBody = await parseJsonBody(request, vipBidCreateSchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const ip = getClientIp(request);
    const ipRate = await consumeRateLimit(`vip:bid:ip:${member.memberId}:${ip}`, {
      windowMs: 5 * 60 * 1000,
      limit: 30,
      lockoutMs: 5 * 60 * 1000,
      namespace: "vip_bid_ip"
    });
    if (!ipRate.allowed) {
      return jsonError("Too many bid attempts. Please slow down.", 429);
    }

    const auctionIdentifierRate = await consumeRateLimit(
      getIdentifierBucketKey("vip:bid:auction", `${member.memberId}:${parsedBody.data.auctionId}`),
      {
        windowMs: 60 * 1000,
        limit: 12,
        lockoutMs: 60 * 1000,
        namespace: "vip_bid_auction"
      }
    );
    if (!auctionIdentifierRate.allowed) {
      return jsonError("Too many bids on this slot in a short time. Please wait a moment.", 429);
    }

    const result = await placeVipBid({
      auctionId: parsedBody.data.auctionId,
      memberId: member.memberId,
      amount: parsedBody.data.amount,
      idempotencyKey: parsedBody.data.idempotencyKey || undefined
    });

    if (!result.ok) {
      return jsonError(result.message, result.status, {
        code: result.code,
        minRequired: result.minRequired,
        currentBidAmount: result.currentBidAmount
      });
    }

    return jsonOk({
      message: result.message,
      alreadyProcessed: Boolean(result.alreadyProcessed),
      autoExtended: result.autoExtended,
      board: result.board
    });
  } catch (error) {
    return handleApiError({
      request,
      route: "POST /api/vip/bids",
      error,
      fallbackMessage: "Unable to place bid"
    });
  }
}

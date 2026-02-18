import { NextRequest } from "next/server";
import { getCurrentMemberFromRequest } from "@/lib/auth/guards";
import { getEnv } from "@/lib/env";
import { handleApiError, jsonError, jsonOk, parseJsonBody } from "@/lib/http";
import {
  createDonationCheckoutOrder,
  ensureMemberProfile,
  getMemberLeaderboard
} from "@/lib/member-service";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, getIdentifierBucketKey } from "@/lib/request";
import { assertSameOrigin } from "@/lib/security";
import { memberDonateSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const member = await getCurrentMemberFromRequest(request);
    if (!member) {
      return jsonError("Membership inactive", 401);
    }

    const ip = getClientIp(request);
    const rate = await consumeRateLimit(`member:donation:${member.memberId}:${ip}`, {
      windowMs: 5 * 60 * 1000,
      limit: 20,
      lockoutMs: 5 * 60 * 1000,
      namespace: "member_donate_ip"
    });

    if (!rate.allowed) {
      return jsonError("Too many donation attempts. Please try later.", 429);
    }

    const identifierRate = await consumeRateLimit(
      getIdentifierBucketKey("member:donation", member.memberId),
      {
        windowMs: 5 * 60 * 1000,
        limit: 12,
        lockoutMs: 5 * 60 * 1000,
        namespace: "member_donate_identifier"
      }
    );
    if (!identifierRate.allowed) {
      return jsonError("Too many donation attempts. Please try later.", 429);
    }

    const parsedBody = await parseJsonBody(request, memberDonateSchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    await ensureMemberProfile(member.user);
    const createResult = await createDonationCheckoutOrder({
      userId: member.memberId,
      amount: parsedBody.data.amount,
      note: parsedBody.data.note,
      idempotencyKey: parsedBody.data.idempotencyKey
    });

    if (createResult.type === "already_paid") {
      const leaderboard = await getMemberLeaderboard({
        currentUserId: member.memberId,
        page: 1,
        pageSize: 12
      });

      return jsonOk({
        alreadyPaid: true,
        donation: {
          amount: createResult.amount,
          totalDonated: createResult.totalDonated
        },
        leaderboard
      });
    }

    return jsonOk({
      keyId: getEnv().RAZORPAY_KEY_ID,
      orderId: createResult.orderId,
      donationId: createResult.donationId,
      amount: createResult.amount * 100,
      currency: createResult.currency
    });
  } catch (error) {
    return handleApiError({
      request,
      route: "POST /api/member/donate",
      error,
      fallbackMessage: "Unable to start donation"
    });
  }
}

import { NextRequest } from "next/server";
import { getCurrentMemberFromRequest } from "@/lib/auth/guards";
import { handleApiError, jsonError, jsonOk, parseJsonBody } from "@/lib/http";
import { ensureMemberProfile, getMemberLeaderboard, verifyDonationPayment } from "@/lib/member-service";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, getIdentifierBucketKey } from "@/lib/request";
import { assertSameOrigin } from "@/lib/security";
import { memberDonateVerifySchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const member = await getCurrentMemberFromRequest(request);
    if (!member) {
      return jsonError("Membership inactive", 401);
    }

    const ip = getClientIp(request);
    const rate = await consumeRateLimit(`member:donation:verify:${member.memberId}:${ip}`, {
      windowMs: 5 * 60 * 1000,
      limit: 30,
      lockoutMs: 5 * 60 * 1000,
      namespace: "member_donate_verify_ip"
    });

    if (!rate.allowed) {
      return jsonError("Too many verification attempts. Please try later.", 429);
    }

    const identifierRate = await consumeRateLimit(
      getIdentifierBucketKey("member:donation:verify", member.memberId),
      {
        windowMs: 5 * 60 * 1000,
        limit: 20,
        lockoutMs: 5 * 60 * 1000,
        namespace: "member_donate_verify_identifier"
      }
    );
    if (!identifierRate.allowed) {
      return jsonError("Too many verification attempts. Please try later.", 429);
    }

    const parsedBody = await parseJsonBody(request, memberDonateVerifySchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    await ensureMemberProfile(member.user);

    const donation = await verifyDonationPayment({
      userId: member.memberId,
      orderId: parsedBody.data.orderId,
      paymentId: parsedBody.data.paymentId,
      signature: parsedBody.data.signature
    });

    const leaderboard = await getMemberLeaderboard({
      currentUserId: member.memberId,
      page: 1,
      pageSize: 12
    });

    return jsonOk({
      donation,
      leaderboard
    });
  } catch (error) {
    return handleApiError({
      request,
      route: "POST /api/member/donate/verify",
      error,
      fallbackMessage: "Unable to verify donation"
    });
  }
}

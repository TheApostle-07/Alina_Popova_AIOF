import { NextRequest } from "next/server";
import { getCurrentMemberFromRequest } from "@/lib/auth/guards";
import { handleApiError, jsonError, jsonOk, parseJsonBody, parseSearchParams } from "@/lib/http";
import {
  ensureMemberProfile,
  generateUniqueDisplayNameSuggestion,
  getMemberLeaderboard,
  isDisplayNameAvailable,
  updateMemberDisplayName
} from "@/lib/member-service";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, getIdentifierBucketKey } from "@/lib/request";
import { assertSameOrigin } from "@/lib/security";
import { memberProfileQuerySchema, memberProfileUpdateSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const member = await getCurrentMemberFromRequest(request);
    if (!member) {
      return jsonError("Membership inactive", 401);
    }

    const parsedQuery = parseSearchParams(request, memberProfileQuerySchema);
    if (!parsedQuery.ok) {
      return parsedQuery.response;
    }

    const suggestName = parsedQuery.data.suggestName === "1";
    if (suggestName) {
      const hint = parsedQuery.data.hint?.trim();
      const profile = await ensureMemberProfile(member.user);
      const suggestion = await generateUniqueDisplayNameSuggestion({
        excludeUserId: member.memberId,
        hint,
        avoidDisplayNameKey: profile.displayNameKey
      });
      return jsonOk({ suggestion });
    }

    const checkName = parsedQuery.data.checkName?.trim();
    if (checkName) {
      const available = await isDisplayNameAvailable(checkName, member.memberId);
      return jsonOk({ available });
    }

    const profile = await ensureMemberProfile(member.user);
    const leaderboard = await getMemberLeaderboard({
      currentUserId: member.memberId,
      page: 1,
      pageSize: 1
    });

    return jsonOk({
      profile,
      rank: leaderboard.currentMemberRank,
      totalMembers: leaderboard.pagination.total
    });
  } catch (error) {
    return handleApiError({
      request,
      route: "GET /api/member/profile",
      error,
      fallbackMessage: "Unable to load profile"
    });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const member = await getCurrentMemberFromRequest(request);
    if (!member) {
      return jsonError("Membership inactive", 401);
    }

    const ip = getClientIp(request);
    const rate = await consumeRateLimit(`member:profile:update:${member.memberId}:${ip}`, {
      windowMs: 10 * 60 * 1000,
      limit: 10,
      lockoutMs: 10 * 60 * 1000,
      namespace: "member_profile_update_ip"
    });

    if (!rate.allowed) {
      return jsonError("Too many profile updates. Please try later.", 429);
    }

    const identifierRate = await consumeRateLimit(
      getIdentifierBucketKey("member:profile:update", member.memberId),
      {
        windowMs: 10 * 60 * 1000,
        limit: 6,
        lockoutMs: 10 * 60 * 1000,
        namespace: "member_profile_update_identifier"
      }
    );
    if (!identifierRate.allowed) {
      return jsonError("Too many profile updates. Please try later.", 429);
    }

    const parsedBody = await parseJsonBody(request, memberProfileUpdateSchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    await ensureMemberProfile(member.user);
    const profile = await updateMemberDisplayName(member.memberId, parsedBody.data.displayName);

    const leaderboard = await getMemberLeaderboard({
      currentUserId: member.memberId,
      page: 1,
      pageSize: 1
    });

    return jsonOk({
      profile,
      rank: leaderboard.currentMemberRank,
      totalMembers: leaderboard.pagination.total
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unable to update profile",
      400
    );
  }
}

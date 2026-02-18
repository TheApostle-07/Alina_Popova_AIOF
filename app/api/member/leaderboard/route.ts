import { NextRequest } from "next/server";
import { getCurrentMemberFromRequest } from "@/lib/auth/guards";
import { handleApiError, jsonError, jsonOk, parseSearchParams } from "@/lib/http";
import { ensureMemberProfile, getMemberLeaderboard } from "@/lib/member-service";
import { memberLeaderboardQuerySchema } from "@/lib/validators";

export const runtime = "nodejs";

function parsePositiveInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export async function GET(request: NextRequest) {
  try {
    const member = await getCurrentMemberFromRequest(request);
    if (!member) {
      return jsonError("Membership inactive", 401);
    }

    await ensureMemberProfile(member.user);

    const parsedQuery = parseSearchParams(request, memberLeaderboardQuerySchema);
    if (!parsedQuery.ok) {
      return parsedQuery.response;
    }
    const page = parsePositiveInt(String(parsedQuery.data.page || 1), 1, 1, 1000);
    const pageSize = parsePositiveInt(String(parsedQuery.data.pageSize || 12), 12, 5, 50);
    const query = parsedQuery.data.q?.trim() || undefined;

    const leaderboard = await getMemberLeaderboard({
      currentUserId: member.memberId,
      page,
      pageSize,
      query
    });

    return jsonOk(leaderboard);
  } catch (error) {
    return handleApiError({
      request,
      route: "GET /api/member/leaderboard",
      error,
      fallbackMessage: "Unable to load leaderboard"
    });
  }
}

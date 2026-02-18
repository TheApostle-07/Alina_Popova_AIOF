import { NextRequest } from "next/server";
import { getCurrentMemberFromRequest } from "@/lib/auth/guards";
import { getMemberPayloadFromRequest } from "@/lib/auth/request-auth";
import { maybeRotateMemberSession } from "@/lib/auth/session";
import { createSignedMediaUrl } from "@/lib/cloudinary";
import { getPublishedFeed, getPublishedFeedPage } from "@/lib/content-service";
import { handleApiError, jsonError, jsonOk, parseSearchParams } from "@/lib/http";
import { feedQuerySchema } from "@/lib/validators";

export const runtime = "nodejs";

type FeedRecord = {
  _id: unknown;
  type: "image" | "video";
  title: string;
  tags?: string[];
  mediaAssetId: string;
  previewUrl?: string;
  publishAt?: Date | string | null;
  createdAt?: Date | string | null;
};

export async function GET(request: NextRequest) {
  try {
    const member = await getCurrentMemberFromRequest(request);
    const sessionPayload = await getMemberPayloadFromRequest(request);
    if (!member) {
      return jsonError("Membership inactive", 401);
    }

    const parsedQuery = parseSearchParams(request, feedQuerySchema);
    if (!parsedQuery.ok) {
      return parsedQuery.response;
    }

    const cursor = parsedQuery.data.cursor || undefined;
    const query = parsedQuery.data.q || undefined;
    const pageParam = parsedQuery.data.page;
    const pageSizeParam = parsedQuery.data.pageSize;
    const type = parsedQuery.data.type;
    const page = pageParam && pageParam > 0 ? pageParam : 0;
    const pageSize = pageSizeParam && pageSizeParam > 0 ? pageSizeParam : 9;

    const mapItem = (item: FeedRecord) => ({
      _id: String(item._id),
      type: item.type,
      title: item.title,
      tags: item.tags || [],
      mediaUrl:
        (() => {
          try {
            return createSignedMediaUrl(item.mediaAssetId, item.type);
          } catch {
            return item.previewUrl;
          }
        })(),
      publishedAt: item.publishAt
        ? new Date(item.publishAt).toISOString()
        : item.createdAt
          ? new Date(item.createdAt).toISOString()
          : new Date().toISOString()
    });

    const hasPageRequest = page > 0;

    let response;

    if (hasPageRequest) {
      const feed = await getPublishedFeedPage({
        page,
        pageSize,
        type,
        query
      });

      const items = (feed.items as unknown as FeedRecord[]).map(mapItem);
      response = jsonOk({
        items,
        nextCursor: null,
        pagination: feed.pagination
      });
    } else {
      const feed = await getPublishedFeed({ cursor, limit: 10, type, query });

      const items = (feed.items as unknown as FeedRecord[]).map(mapItem);
      response = jsonOk({
        items,
        nextCursor: feed.nextCursor
      });
    }

    if (sessionPayload) {
      await maybeRotateMemberSession(response, sessionPayload);
    }

    return response;
  } catch (error) {
    return handleApiError({
      request,
      route: "GET /api/content/feed",
      error,
      fallbackMessage: "Feed unavailable"
    });
  }
}

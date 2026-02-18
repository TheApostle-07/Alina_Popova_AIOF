import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { getAdminPayloadFromRequest } from "@/lib/auth/request-auth";
import { publishDueContent } from "@/lib/content-service";
import { connectToDatabase } from "@/lib/db";
import { handleApiError, jsonError, jsonOk, parseJsonBody, parseSearchParams } from "@/lib/http";
import { ContentModel } from "@/lib/models/content";
import { assertSameOrigin } from "@/lib/security";
import { adminContentQuerySchema, contentCreateSchema } from "@/lib/validators";

export const runtime = "nodejs";

function parsePositiveInt(value: string | null, fallback: number, min = 1, max = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

export async function GET(request: NextRequest) {
  const admin = await getAdminPayloadFromRequest(request);
  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const parsedQuery = parseSearchParams(request, adminContentQuerySchema);
    if (!parsedQuery.ok) {
      return parsedQuery.response;
    }

    await connectToDatabase();
    await publishDueContent();

    const page = parsePositiveInt(String(parsedQuery.data.page || 1), 1, 1, 10_000);
    const pageSize = parsePositiveInt(String(parsedQuery.data.pageSize || 12), 12, 1, 50);
    const status = parsedQuery.data.status;
    const type = parsedQuery.data.type;
    const cursor = parsedQuery.data.cursor;
    const cursorLimit = parsePositiveInt(String(parsedQuery.data.limit || pageSize), pageSize, 1, 50);

    const filter: Record<string, unknown> = {};
    if (status) {
      filter.status = status;
    }
    if (type) {
      filter.type = type;
    }

    if (cursor) {
      if (!Types.ObjectId.isValid(cursor)) {
        return jsonError("Invalid cursor", 422);
      }
      filter._id = { $lt: new Types.ObjectId(cursor) };

      const rows = await ContentModel.find(filter)
        .sort({ _id: -1 })
        .limit(cursorLimit + 1)
        .lean();
      const hasMore = rows.length > cursorLimit;
      const sliced = hasMore ? rows.slice(0, cursorLimit) : rows;

      return jsonOk({
        items: sliced.map((item) => ({
          _id: String(item._id),
          title: item.title,
          type: item.type,
          status: item.status,
          publishAt: item.publishAt ? item.publishAt.toISOString() : null,
          previewEligible: item.previewEligible,
          tags: item.tags
        })),
        nextCursor: hasMore ? String(sliced[sliced.length - 1]._id) : null
      });
    }

    const total = await ContentModel.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const skip = (currentPage - 1) * pageSize;

    const items = await ContentModel.find(filter)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    return jsonOk({
      items: items.map((item) => ({
        _id: String(item._id),
        title: item.title,
        type: item.type,
        status: item.status,
        publishAt: item.publishAt ? item.publishAt.toISOString() : null,
        previewEligible: item.previewEligible,
        tags: item.tags
      })),
      pagination: {
        page: currentPage,
        pageSize,
        total,
        totalPages,
        hasPrev: currentPage > 1,
        hasNext: currentPage < totalPages
      }
    });
  } catch (error) {
    return handleApiError({
      request,
      route: "GET /api/admin/content",
      error,
      fallbackMessage: "Unable to load content"
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

    const parsedBody = await parseJsonBody(request, contentCreateSchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    await connectToDatabase();

    const publishAt = parsedBody.data.publishAt ? new Date(parsedBody.data.publishAt) : null;
    if (parsedBody.data.status === "scheduled" && !publishAt) {
      return jsonError("publishAt is required for scheduled content", 422);
    }

    const item = await ContentModel.create({
      ...parsedBody.data,
      publishAt: publishAt || (parsedBody.data.status === "published" ? new Date() : null)
    });

    return jsonOk({
      item: {
        _id: String(item._id),
        title: item.title,
        type: item.type,
        status: item.status
      }
    });
  } catch (error) {
    return handleApiError({
      request,
      route: "POST /api/admin/content",
      error,
      fallbackMessage: "Unable to create content"
    });
  }
}

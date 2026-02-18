import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { ContentModel } from "@/lib/models/content";

let lastPublishSweepAt = 0;
let publishSweepPromise: Promise<void> | null = null;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function publishDueContent() {
  const now = Date.now();
  if (now - lastPublishSweepAt < 30_000 && !publishSweepPromise) {
    return;
  }
  if (publishSweepPromise) {
    return publishSweepPromise;
  }

  publishSweepPromise = (async () => {
    await connectToDatabase();
    await ContentModel.updateMany(
      {
        status: "scheduled",
        publishAt: { $lte: new Date() }
      },
      {
        $set: { status: "published" }
      }
    );
    lastPublishSweepAt = Date.now();
  })()
    .catch(() => undefined)
    .finally(() => {
      publishSweepPromise = null;
    });

  return publishSweepPromise;
}

export async function getPreviewContent(limit = 8) {
  await publishDueContent();

  return ContentModel.find({
    status: "published",
    previewEligible: true,
    publishAt: { $lte: new Date() }
  })
    .sort({ publishAt: -1, createdAt: -1 })
    .limit(limit)
    .lean();
}

function buildPublishedFeedFilter(params: { type?: "image" | "video"; query?: string }) {
  const filter: Record<string, unknown> = {
    status: "published",
    publishAt: { $lte: new Date() }
  };

  if (params.type && ["image", "video"].includes(params.type)) {
    filter.type = params.type;
  }

  const searchQuery = (params.query || "").trim();
  if (searchQuery) {
    const pattern = new RegExp(escapeRegex(searchQuery), "i");
    filter.$or = [{ title: pattern }, { tags: pattern }];
  }

  return filter;
}

export async function getPublishedFeed(params: {
  cursor?: string;
  limit?: number;
  type?: "image" | "video";
  query?: string;
}) {
  await publishDueContent();
  const limit = Math.min(Math.max(params.limit || 10, 1), 30);

  const filter = buildPublishedFeedFilter({
    type: params.type,
    query: params.query
  });

  if (params.cursor && Types.ObjectId.isValid(params.cursor)) {
    filter._id = { $lt: new Types.ObjectId(params.cursor) };
  }

  const items = await ContentModel.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? String(data[data.length - 1]._id) : null;

  return {
    items: data,
    nextCursor
  };
}

export async function getPublishedFeedPage(params: {
  page?: number;
  pageSize?: number;
  type?: "image" | "video";
  query?: string;
}) {
  await publishDueContent();

  const pageSize = Math.min(Math.max(params.pageSize || 9, 1), 30);
  const requestedPage = Math.max(1, Math.floor(params.page || 1));
  const filter = buildPublishedFeedFilter({
    type: params.type,
    query: params.query
  });

  const total = await ContentModel.countDocuments(filter);
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
  const page = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
  const skip = totalPages === 0 ? 0 : (page - 1) * pageSize;

  const items = await ContentModel.find(filter)
    .sort({ _id: -1 })
    .skip(skip)
    .limit(pageSize)
    .lean();

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasPrev: totalPages > 0 && page > 1,
      hasNext: totalPages > 0 && page < totalPages
    }
  };
}

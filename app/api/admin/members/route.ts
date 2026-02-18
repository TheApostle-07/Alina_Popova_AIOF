import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { getAdminPayloadFromRequest } from "@/lib/auth/request-auth";
import { connectToDatabase } from "@/lib/db";
import { handleApiError, jsonError, jsonOk, parseSearchParams } from "@/lib/http";
import { SubscriptionModel } from "@/lib/models/subscription";
import { UserModel } from "@/lib/models/user";
import { adminMembersQuerySchema } from "@/lib/validators";

export const runtime = "nodejs";

function parsePositiveInt(value: string | null, fallback: number, min = 1, max = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  const admin = await getAdminPayloadFromRequest(request);
  if (!admin) {
    return jsonError("Unauthorized", 401);
  }

  try {
    await connectToDatabase();

    type UserSearchRow = {
      _id: unknown;
      email?: string;
      phone?: string;
    };

    type SubscriptionSearchRow = {
      userId: unknown;
      status?: string;
      razorpaySubscriptionId?: string;
      updatedAt?: Date | string;
    };

    const parsedQuery = parseSearchParams(request, adminMembersQuerySchema);
    if (!parsedQuery.ok) {
      return parsedQuery.response;
    }

    const query = parsedQuery.data.query?.trim();
    const cursor = parsedQuery.data.cursor;
    const cursorLimit = parsePositiveInt(String(parsedQuery.data.limit || 12), 12, 1, 50);
    const page = parsePositiveInt(String(parsedQuery.data.page || 1), 1, 1, 10_000);
    const pageSize = parsePositiveInt(String(parsedQuery.data.pageSize || 12), 12, 1, 50);
    const filter = query
      ? {
          $or: [
            { email: { $regex: escapeRegex(query), $options: "i" } },
            { phone: { $regex: escapeRegex(query), $options: "i" } }
          ]
        }
      : {};

    if (cursor) {
      if (!Types.ObjectId.isValid(cursor)) {
        return jsonError("Invalid cursor", 422);
      }

      const cursorFilter = {
        ...filter,
        _id: { $lt: new Types.ObjectId(cursor) }
      };

      const users = (await UserModel.find(cursorFilter)
        .select({ _id: 1, email: 1, phone: 1 })
        .sort({ _id: -1 })
        .limit(cursorLimit + 1)
        .lean()) as unknown as UserSearchRow[];

      const hasMore = users.length > cursorLimit;
      const slicedUsers = hasMore ? users.slice(0, cursorLimit) : users;
      const userIds = slicedUsers.map((user) => user._id);

      const subscriptions = (await SubscriptionModel.find({
        userId: { $in: userIds }
      })
        .select({ userId: 1, status: 1, razorpaySubscriptionId: 1, updatedAt: 1 })
        .sort({ updatedAt: -1 })
        .lean()) as unknown as SubscriptionSearchRow[];

      type LatestSubscriptionSnapshot = {
        status?: string;
        razorpaySubscriptionId?: string;
        updatedAt?: Date | string;
      };

      const latestByUser = new Map<string, LatestSubscriptionSnapshot>();
      for (const subscription of subscriptions) {
        const userId = String(subscription.userId);
        if (!latestByUser.has(userId)) {
          latestByUser.set(userId, subscription);
        }
      }

      return jsonOk({
        items: slicedUsers.map((user) => {
          const latest = latestByUser.get(String(user._id));
          return {
            userId: String(user._id),
            email: user.email,
            phone: user.phone,
            status: latest?.status || "NONE",
            razorpaySubscriptionId: latest?.razorpaySubscriptionId,
            updatedAt: latest?.updatedAt ? new Date(latest.updatedAt).toISOString() : null
          };
        }),
        nextCursor: hasMore ? String(slicedUsers[slicedUsers.length - 1]._id) : null
      });
    }

    const total = await UserModel.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const skip = (currentPage - 1) * pageSize;

    const users = (await UserModel.find(filter)
      .select({ _id: 1, email: 1, phone: 1 })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean()) as unknown as UserSearchRow[];
    const userIds = users.map((user) => user._id);

    const subscriptions = (await SubscriptionModel.find({
      userId: { $in: userIds }
    })
      .select({ userId: 1, status: 1, razorpaySubscriptionId: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .lean()) as unknown as SubscriptionSearchRow[];

    type LatestSubscriptionSnapshot = {
      status?: string;
      razorpaySubscriptionId?: string;
      updatedAt?: Date | string;
    };

    const latestByUser = new Map<string, LatestSubscriptionSnapshot>();
    for (const subscription of subscriptions) {
      const userId = String(subscription.userId);
      if (!latestByUser.has(userId)) {
        latestByUser.set(userId, subscription);
      }
    }

    const items = users.map((user) => {
      const latest = latestByUser.get(String(user._id));
      return {
        userId: String(user._id),
        email: user.email,
        phone: user.phone,
        status: latest?.status || "NONE",
        razorpaySubscriptionId: latest?.razorpaySubscriptionId,
        updatedAt: latest?.updatedAt ? new Date(latest.updatedAt).toISOString() : null
      };
    });

    return jsonOk({
      items,
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
      route: "GET /api/admin/members",
      error,
      fallbackMessage: "Unable to load members"
    });
  }
}

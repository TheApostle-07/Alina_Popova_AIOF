import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { SubscriptionModel } from "@/lib/models/subscription";
import { UserModel } from "@/lib/models/user";
import { reconcileSubscriptionByRazorpayId } from "@/lib/subscription-service";

export function restoreMessage(status: string) {
  switch (status) {
    case "ACTIVE":
      return "Access restored on this device.";
    case "PENDING":
      return "Payment is still pending. Please check again shortly.";
    case "PAST_DUE":
      return "Payment retry is required. Update payment and restore again.";
    case "CANCELLED":
      return "Subscription was cancelled. Start a new subscription to continue.";
    case "EXPIRED":
      return "Subscription has expired. Please re-subscribe.";
    case "DISPUTED":
      return "Payment dispute detected. Access is paused until resolved.";
    default:
      return "No subscription found for provided details.";
  }
}

export type RestoreUserRow = {
  _id: Types.ObjectId;
  email?: string;
  phone?: string;
};

export type RestoreSubscriptionRow = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  status: string;
  razorpaySubscriptionId: string;
  updatedAt: Date | string;
};

export async function findUsersForRestore(email?: string, phone?: string) {
  await connectToDatabase();

  const filters: Record<string, string>[] = [];
  if (email) {
    filters.push({ email });
  }
  if (phone) {
    filters.push({ phone });
  }
  if (!filters.length) {
    return [] as RestoreUserRow[];
  }

  return (await UserModel.find({ $or: filters })
    .select({ _id: 1, email: 1, phone: 1 })
    .limit(25)
    .lean()) as unknown as RestoreUserRow[];
}

export async function getRestoreSubscriptions(userIds: Types.ObjectId[]) {
  if (!userIds.length) {
    return [] as RestoreSubscriptionRow[];
  }

  return (await SubscriptionModel.find({ userId: { $in: userIds } })
    .select({ _id: 1, userId: 1, status: 1, razorpaySubscriptionId: 1, updatedAt: 1 })
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean()) as unknown as RestoreSubscriptionRow[];
}

export async function reconcileRelevantSubscriptions(subscriptions: RestoreSubscriptionRow[]) {
  const candidates = subscriptions
    .filter((subscription) => ["PENDING", "PAST_DUE", "ACTIVE"].includes(subscription.status))
    .slice(0, 5);

  await Promise.all(
    candidates.map((subscription) =>
      reconcileSubscriptionByRazorpayId(subscription.razorpaySubscriptionId).catch(() => null)
    )
  );
}

export function pickBestSubscription(subscriptions: RestoreSubscriptionRow[]) {
  const active = subscriptions
    .filter((subscription) => subscription.status === "ACTIVE")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

  if (active) {
    return active;
  }

  return subscriptions[0] || null;
}

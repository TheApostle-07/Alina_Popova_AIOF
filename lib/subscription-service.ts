import { Types } from "mongoose";
import { MembershipState } from "@/lib/constants";
import { connectToDatabase } from "@/lib/db";
import { CheckoutAttemptModel } from "@/lib/models/checkout-attempt";
import { SubscriptionModel } from "@/lib/models/subscription";
import { mapRazorpayStatusToMembershipStatus, fetchRazorpaySubscription } from "@/lib/razorpay";
import { toDateFromUnixSeconds } from "@/lib/utils";

type RazorpaySubscriptionSnapshot = {
  id: string;
  status?: string;
  customer_id?: string | null;
  plan_id: string;
  current_start?: number | null;
  current_end?: number | null;
  charge_at?: number | null;
  latest_invoice?: {
    payment_id?: string | null;
  } | null;
  notes?: {
    userId?: string;
  };
};

function subscriptionCoreFields(razorpaySubscription: RazorpaySubscriptionSnapshot) {
  return {
    razorpayCustomerId: razorpaySubscription.customer_id || undefined,
    razorpayPlanId: razorpaySubscription.plan_id,
    currentStart: toDateFromUnixSeconds(razorpaySubscription.current_start),
    currentEnd: toDateFromUnixSeconds(razorpaySubscription.current_end),
    nextChargeAt: toDateFromUnixSeconds(razorpaySubscription.charge_at),
    lastPaymentId: razorpaySubscription?.latest_invoice?.payment_id || undefined
  };
}

export async function upsertSubscriptionFromRazorpay(params: {
  razorpaySubscription: RazorpaySubscriptionSnapshot;
  userId?: string;
  eventAt?: Date;
  forcedStatus?: MembershipState;
}) {
  await connectToDatabase();

  const razorpaySubscription = params.razorpaySubscription;
  const status = params.forcedStatus || mapRazorpayStatusToMembershipStatus(razorpaySubscription.status);

  let subscription = await SubscriptionModel.findOne({
    razorpaySubscriptionId: razorpaySubscription.id
  });

  if (!subscription) {
    const resolvedUserId =
      params.userId || (razorpaySubscription.notes?.userId as string | undefined) || undefined;
    if (!resolvedUserId) {
      return null;
    }

    subscription = await SubscriptionModel.create({
      userId: new Types.ObjectId(resolvedUserId),
      razorpaySubscriptionId: razorpaySubscription.id,
      status,
      ...subscriptionCoreFields(razorpaySubscription),
      lastEventAt: params.eventAt || new Date()
    });
  } else {
    subscription.status = status;
    subscription.razorpayPlanId = razorpaySubscription.plan_id;
    subscription.razorpayCustomerId = razorpaySubscription.customer_id || subscription.razorpayCustomerId;

    const fields = subscriptionCoreFields(razorpaySubscription);
    subscription.currentStart = fields.currentStart || subscription.currentStart;
    subscription.currentEnd = fields.currentEnd || subscription.currentEnd;
    subscription.nextChargeAt = fields.nextChargeAt || subscription.nextChargeAt;
    subscription.lastPaymentId = fields.lastPaymentId || subscription.lastPaymentId;
    subscription.lastEventAt =
      params.eventAt && subscription.lastEventAt
        ? new Date(Math.max(subscription.lastEventAt.getTime(), params.eventAt.getTime()))
        : params.eventAt || subscription.lastEventAt || new Date();

    await subscription.save();
  }

  if (status === "ACTIVE") {
    await CheckoutAttemptModel.updateMany(
      {
        razorpaySubscriptionId: subscription.razorpaySubscriptionId,
        status: { $in: ["created", "opened"] }
      },
      { $set: { status: "paid" } }
    );
  } else if (["CANCELLED", "EXPIRED", "PAST_DUE", "DISPUTED"].includes(status)) {
    await CheckoutAttemptModel.updateMany(
      {
        razorpaySubscriptionId: subscription.razorpaySubscriptionId,
        status: { $in: ["created", "opened"] }
      },
      { $set: { status: "failed" } }
    );
  }

  return subscription;
}

export async function reconcileSubscriptionByRazorpayId(
  razorpaySubscriptionId: string,
  options?: {
    eventAt?: Date;
  }
) {
  const remote = await fetchRazorpaySubscription(razorpaySubscriptionId);
  return upsertSubscriptionFromRazorpay({
    razorpaySubscription: remote,
    eventAt: options?.eventAt
  });
}

export async function markSubscriptionAsDisputed(params: {
  razorpaySubscriptionId: string;
  paymentId?: string;
  eventAt?: Date;
}) {
  await connectToDatabase();

  const subscription = await SubscriptionModel.findOne({
    razorpaySubscriptionId: params.razorpaySubscriptionId
  });

  if (!subscription) {
    return null;
  }

  subscription.status = "DISPUTED";
  subscription.lastPaymentId = params.paymentId || subscription.lastPaymentId;
  subscription.lastEventAt = params.eventAt || new Date();
  await subscription.save();

  return subscription;
}

export function isSubscriptionActive(status: MembershipState) {
  return status === "ACTIVE";
}

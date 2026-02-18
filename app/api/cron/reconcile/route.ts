import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { handleApiError, jsonError, jsonOk } from "@/lib/http";
import { SubscriptionModel } from "@/lib/models/subscription";
import { updateActiveMembersMetric } from "@/lib/metrics";
import { safeCompare } from "@/lib/security";
import { reconcileSubscriptionByRazorpayId } from "@/lib/subscription-service";

export const runtime = "nodejs";

function authorize(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secretHeader = request.headers.get("x-cron-secret");
  const token = auth?.startsWith("Bearer ") ? auth.replace("Bearer ", "") : null;

  const { CRON_SECRET } = getEnv();
  return (
    (token ? safeCompare(token, CRON_SECRET) : false) ||
    (secretHeader ? safeCompare(secretHeader, CRON_SECRET) : false)
  );
}

async function runReconciliation() {
  await connectToDatabase();

  const recentlyUpdatedSince = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const subscriptions = await SubscriptionModel.find({
    $or: [
      { status: { $in: ["PENDING", "PAST_DUE"] } },
      { updatedAt: { $gte: recentlyUpdatedSince } }
    ]
  })
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();

  let successCount = 0;
  const failures: string[] = [];

  for (const subscription of subscriptions) {
    try {
      await reconcileSubscriptionByRazorpayId(subscription.razorpaySubscriptionId);
      successCount += 1;
    } catch (error) {
      failures.push(
        `${subscription.razorpaySubscriptionId}: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
    }
  }

  const activeMembers = await updateActiveMembersMetric();

  return {
    scanned: subscriptions.length,
    reconciled: successCount,
    failed: failures.length,
    failures,
    activeMembers
  };
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const data = await runReconciliation();
    return jsonOk(data);
  } catch (error) {
    return handleApiError({
      request,
      route: "GET /api/cron/reconcile",
      error,
      fallbackMessage: "Reconciliation failed"
    });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

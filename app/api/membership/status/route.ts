import { Types } from "mongoose";
import { NextRequest } from "next/server";
import { LAST_CHECKOUT_ATTEMPT_COOKIE, LAST_SUBSCRIPTION_COOKIE } from "@/lib/constants";
import { connectToDatabase } from "@/lib/db";
import { handleApiError, jsonError, jsonOk, parseSearchParams } from "@/lib/http";
import { CheckoutAttemptModel } from "@/lib/models/checkout-attempt";
import { SubscriptionModel } from "@/lib/models/subscription";
import { fetchRazorpayPayment } from "@/lib/razorpay";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, getIdentifierBucketKey } from "@/lib/request";
import { reconcileSubscriptionByRazorpayId } from "@/lib/subscription-service";
import { membershipStatusQuerySchema } from "@/lib/validators";

export const runtime = "nodejs";

function statusMessage(status: string) {
  switch (status) {
    case "ACTIVE":
      return "Payment confirmed. Verify OTP to unlock access on this device.";
    case "PENDING":
      return "Payment is still pending confirmation.";
    case "PAST_DUE":
      return "Payment needs retry. Please restore access after update.";
    case "CANCELLED":
      return "Subscription was cancelled.";
    case "EXPIRED":
      return "Subscription has expired.";
    case "DISPUTED":
      return "A payment dispute is open. Access is temporarily blocked.";
    default:
      return "Membership not found.";
  }
}

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const ipRate = await consumeRateLimit(`membership:status:ip:${ip}`, {
      windowMs: 60 * 1000,
      limit: 120,
      lockoutMs: 60 * 1000,
      namespace: "membership_status_ip"
    });
    if (!ipRate.allowed) {
      return jsonError("Too many requests", 429);
    }

    await connectToDatabase();

    const parsedQuery = parseSearchParams(request, membershipStatusQuerySchema);
    if (!parsedQuery.ok) {
      return parsedQuery.response;
    }
    const requestedSubscriptionId = parsedQuery.data.subscriptionId;
    const requestedAttemptId = parsedQuery.data.attemptId;
    const requestedPaymentId = parsedQuery.data.paymentId;

    if (requestedSubscriptionId || requestedAttemptId || requestedPaymentId) {
      const identifierRate = await consumeRateLimit(
        getIdentifierBucketKey(
          "membership:status:identifier",
          `${requestedSubscriptionId || ""}:${requestedAttemptId || ""}:${requestedPaymentId || ""}`
        ),
        {
          windowMs: 60 * 1000,
          limit: 40,
          lockoutMs: 60 * 1000,
          namespace: "membership_status_identifier"
        }
      );
      if (!identifierRate.allowed) {
        return jsonError("Too many requests", 429);
      }
    }

    let subscriptionId = requestedSubscriptionId || request.cookies.get(LAST_SUBSCRIPTION_COOKIE)?.value || null;

    if (!subscriptionId && requestedPaymentId) {
      const matched = (await SubscriptionModel.findOne({
        lastPaymentId: requestedPaymentId
      })
        .select({ razorpaySubscriptionId: 1 })
        .lean()) as { razorpaySubscriptionId?: string } | null;
      if (matched?.razorpaySubscriptionId) {
        subscriptionId = matched.razorpaySubscriptionId;
      }
    }

    if (!subscriptionId) {
      const attemptId = requestedAttemptId || request.cookies.get(LAST_CHECKOUT_ATTEMPT_COOKIE)?.value;

      if (attemptId) {
        const attempt = Types.ObjectId.isValid(attemptId)
          ? await CheckoutAttemptModel.findById(attemptId)
          : await CheckoutAttemptModel.findOne({ idempotencyKey: attemptId });

        if (attempt?.razorpaySubscriptionId) {
          subscriptionId = attempt.razorpaySubscriptionId;
        }
      }
    }

    if (!subscriptionId && requestedPaymentId) {
      try {
        const payment = await fetchRazorpayPayment(requestedPaymentId);
        if (payment?.subscription_id) {
          subscriptionId = payment.subscription_id;
        }
      } catch {
        // Keep fallback behavior and return NONE if no mapping can be established.
      }
    }

    if (!subscriptionId) {
      return jsonOk({ status: "NONE", message: statusMessage("NONE") });
    }

    let subscription = await SubscriptionModel.findOne({
      razorpaySubscriptionId: subscriptionId
    });

    if (!subscription) {
      try {
        subscription = await reconcileSubscriptionByRazorpayId(subscriptionId);
      } catch {
        subscription = null;
      }
    }

    if (!subscription) {
      return jsonOk({ status: "NONE", message: statusMessage("NONE") });
    }

    if (subscription.status === "PENDING" || subscription.status === "PAST_DUE") {
      try {
        const reconciled = await reconcileSubscriptionByRazorpayId(subscription.razorpaySubscriptionId);
        if (reconciled) {
          subscription = reconciled;
        }
      } catch {
        // Keep last known status if reconciliation fails.
      }
    }

    const status = subscription.status;
    const response = jsonOk({
      status,
      message: statusMessage(status)
    });

    response.cookies.set({
      name: LAST_SUBSCRIPTION_COOKIE,
      value: subscription.razorpaySubscriptionId,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24,
      path: "/"
    });

    return response;
  } catch (error) {
    return handleApiError({
      request,
      route: "GET /api/membership/status",
      error,
      fallbackMessage: "Unable to get membership status"
    });
  }
}

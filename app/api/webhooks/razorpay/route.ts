import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { handleApiError, jsonError, jsonOk } from "@/lib/http";
import { logError, logInfo, logWarn } from "@/lib/log";
import { SubscriptionModel } from "@/lib/models/subscription";
import { WebhookEventModel } from "@/lib/models/webhook-event";
import { settleDonationFromWebhook } from "@/lib/member-service";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, getIdentifierBucketKey } from "@/lib/request";
import { hashPayload } from "@/lib/security";
import {
  markSubscriptionAsDisputed,
  reconcileSubscriptionByRazorpayId
} from "@/lib/subscription-service";
import { updateActiveMembersMetric } from "@/lib/metrics";

export const runtime = "nodejs";

const razorpayWebhookSchema = z
  .object({
    id: z.string().optional(),
    event: z.string().min(1),
    created_at: z.number().int().optional(),
    account_id: z.string().optional(),
    contains: z.array(z.string()).optional(),
    payload: z.record(z.unknown()).optional()
  })
  .strict();

type RazorpayWebhookPayload = {
  id?: string;
  event?: string;
  created_at?: number;
  payload?: {
    subscription?: {
      entity?: {
        id?: string;
      };
    };
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        subscription_id?: string;
      };
    };
    invoice?: {
      entity?: {
        subscription_id?: string;
      };
    };
    dispute?: {
      entity?: {
        payment_id?: string;
        subscription_id?: string;
      };
    };
  };
};

type MongoDuplicateErrorLike = {
  code?: number;
};

function resolveWebhookEventId(payload: RazorpayWebhookPayload, payloadHash: string) {
  if (typeof payload?.id === "string" && payload.id.length > 3) {
    return payload.id;
  }

  const eventName = payload?.event || "unknown";
  const createdAt = payload?.created_at || Date.now();
  return `${eventName}:${createdAt}:${payloadHash.slice(0, 12)}`;
}

function extractSubscriptionId(payload: RazorpayWebhookPayload) {
  return (
    payload?.payload?.subscription?.entity?.id ||
    payload?.payload?.payment?.entity?.subscription_id ||
    payload?.payload?.invoice?.entity?.subscription_id ||
    payload?.payload?.dispute?.entity?.subscription_id ||
    null
  );
}

function extractPaymentId(payload: RazorpayWebhookPayload) {
  return payload?.payload?.payment?.entity?.id || payload?.payload?.dispute?.entity?.payment_id || null;
}

function extractPaymentOrderId(payload: RazorpayWebhookPayload) {
  return payload?.payload?.payment?.entity?.order_id || null;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const ipRate = await consumeRateLimit(`webhook:razorpay:ip:${ip}`, {
    windowMs: 60 * 1000,
    limit: 180,
    lockoutMs: 30 * 1000,
    namespace: "webhook_ip"
  });
  if (!ipRate.allowed) {
    return jsonError("Too many webhook requests", 429);
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    return jsonError("Invalid webhook signature", 401);
  }

  let payload: RazorpayWebhookPayload;
  try {
    const rawPayload = JSON.parse(rawBody) as unknown;
    const parsedPayload = razorpayWebhookSchema.safeParse(rawPayload);
    if (!parsedPayload.success) {
      return jsonError(parsedPayload.error.issues[0]?.message || "Invalid webhook payload", 400);
    }
    payload = parsedPayload.data as RazorpayWebhookPayload;
  } catch {
    return jsonError("Invalid webhook payload", 400);
  }

  const payloadHash = hashPayload(rawBody);
  const eventId = resolveWebhookEventId(payload, payloadHash);
  const eventType = payload?.event || "unknown";
  const eventAt = payload?.created_at ? new Date(payload.created_at * 1000) : new Date();

  const eventRate = await consumeRateLimit(
    getIdentifierBucketKey("webhook:razorpay:event", `${eventId}:${eventType}`),
    {
      windowMs: 10 * 60 * 1000,
      limit: 4,
      lockoutMs: 5 * 60 * 1000,
      namespace: "webhook_event"
    }
  );
  if (!eventRate.allowed) {
    return jsonOk({ duplicate: true });
  }

  if (eventAt.getTime() < Date.now() - 10 * 24 * 60 * 60 * 1000) {
    logWarn("Ignored stale webhook event", { eventId, eventType, eventAt: eventAt.toISOString() });
    return jsonOk({ ignored: true, reason: "stale_event" });
  }

  try {
    await connectToDatabase();

    try {
      await WebhookEventModel.create({
        _id: eventId,
        type: eventType,
        processedAt: new Date(),
        payloadHash
      });
    } catch (insertError: unknown) {
      const duplicate = insertError as MongoDuplicateErrorLike;
      if (duplicate?.code === 11000) {
        logInfo("Duplicate webhook ignored", { eventId, eventType });
        return jsonOk({ duplicate: true });
      }
      throw insertError;
    }

    let subscriptionId = extractSubscriptionId(payload);
    const paymentId = extractPaymentId(payload);
    const paymentOrderId = extractPaymentOrderId(payload);
    let donationMatched = false;

    if (!subscriptionId && paymentId) {
      const mappedSubscription = (await SubscriptionModel.findOne({
        lastPaymentId: paymentId
      })
        .select({ razorpaySubscriptionId: 1 })
        .lean()) as { razorpaySubscriptionId?: string } | null;
      if (mappedSubscription) {
        subscriptionId = mappedSubscription.razorpaySubscriptionId || null;
      }
    }

    if ((eventType === "payment.captured" || eventType === "order.paid") && paymentId && paymentOrderId) {
      const donationResult = await settleDonationFromWebhook({
        orderId: paymentOrderId,
        paymentId,
        eventAt
      });

      donationMatched = donationResult.matched;
      if (donationResult.matched) {
        logInfo("Donation settled from webhook", {
          eventId,
          eventType,
          credited: donationResult.credited
        });
      }
    }

    if (subscriptionId) {
      await reconcileSubscriptionByRazorpayId(subscriptionId, { eventAt });

      if (eventType.startsWith("payment.dispute.")) {
        if (eventType === "payment.dispute.created" || eventType === "payment.dispute.lost") {
          await markSubscriptionAsDisputed({
            razorpaySubscriptionId: subscriptionId,
            paymentId: paymentId || undefined,
            eventAt
          });
        }

        if (eventType === "payment.dispute.won") {
          await reconcileSubscriptionByRazorpayId(subscriptionId, { eventAt });
        }
      }

      await updateActiveMembersMetric();
    } else if (!donationMatched) {
      logWarn("Webhook had no subscription mapping", { eventType, eventId });
    }

    return jsonOk({ processed: true });
  } catch (error) {
    logError("Webhook processing failed", {
      eventId,
      eventType,
      ip,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    return handleApiError({
      request,
      route: "POST /api/webhooks/razorpay",
      error,
      fallbackMessage: "Webhook processing failed"
    });
  }
}

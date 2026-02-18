import crypto from "crypto";
import Razorpay from "razorpay";
import { getEnv } from "@/lib/env";
import { safeCompare } from "@/lib/security";

let client: Razorpay | null = null;

type RazorpayLikeError = {
  statusCode?: number;
  error?: {
    code?: string;
    description?: string;
    reason?: string;
  };
  message?: string;
};

function parseRazorpayErrorMessage(error: unknown) {
  const err = error as RazorpayLikeError | undefined;
  const description = err?.error?.description?.trim();
  const reason = err?.error?.reason?.trim();
  const message = err?.message?.trim();
  const base = description || reason || message || "Razorpay request failed";

  if (err?.statusCode === 404 || /requested URL was not found/i.test(base)) {
    return `${base} Please verify RAZORPAY_PLAN_ID and ensure Razorpay Subscriptions is enabled for this account.`;
  }

  return base;
}

function getClient() {
  if (!client) {
    const env = getEnv();
    client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET
    });
  }

  return client;
}

export async function createRazorpaySubscription(params: {
  idempotencyKey: string;
  userId: string;
  email: string;
  phone: string;
}) {
  const env = getEnv();
  if (!env.RAZORPAY_PLAN_ID.startsWith("plan_") || /^plan_x+$/i.test(env.RAZORPAY_PLAN_ID)) {
    throw new Error("Invalid RAZORPAY_PLAN_ID. Set a real Razorpay plan id like plan_ABC123.");
  }

  try {
    const subscription = await getClient().subscriptions.create({
      plan_id: env.RAZORPAY_PLAN_ID,
      customer_notify: 1,
      quantity: 1,
      total_count: 120,
      notes: {
        userId: params.userId,
        idempotencyKey: params.idempotencyKey,
        email: params.email,
        phone: params.phone
      }
    });

    return subscription;
  } catch (error) {
    throw new Error(parseRazorpayErrorMessage(error));
  }
}

export async function fetchRazorpaySubscription(subscriptionId: string) {
  return getClient().subscriptions.fetch(subscriptionId);
}

export async function createRazorpayOrder(params: {
  amountInr: number;
  receipt: string;
  notes?: Record<string, string>;
}) {
  const amountInPaise = Math.max(100, Math.floor(params.amountInr * 100));
  const receipt = params.receipt.trim().slice(0, 40);

  if (!receipt) {
    throw new Error("Unable to create payment order.");
  }

  try {
    const order = await getClient().orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt,
      notes: params.notes
    });

    if (!order?.id || typeof order.id !== "string") {
      throw new Error("Razorpay returned an invalid order response.");
    }

    return order;
  } catch (error) {
    throw new Error(parseRazorpayErrorMessage(error));
  }
}

export async function fetchRazorpayPayment(paymentId: string) {
  try {
    return await getClient().payments.fetch(paymentId);
  } catch (error) {
    throw new Error(parseRazorpayErrorMessage(error));
  }
}

export function verifyRazorpayPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const { RAZORPAY_KEY_SECRET } = getEnv();
  const digest = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");

  if (digest.length !== params.signature.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(params.signature));
  } catch {
    return false;
  }
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) {
    return false;
  }

  const { RAZORPAY_WEBHOOK_SECRET } = getEnv();
  const digest = crypto
    .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  return safeCompare(digest, signature);
}

export function mapRazorpayStatusToMembershipStatus(status?: string | null) {
  switch (status) {
    case "active":
      return "ACTIVE" as const;
    case "halted":
      return "PAST_DUE" as const;
    case "cancelled":
      return "CANCELLED" as const;
    case "completed":
    case "expired":
      return "EXPIRED" as const;
    case "created":
    case "authenticated":
    case "pending":
    default:
      return "PENDING" as const;
  }
}

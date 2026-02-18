import { Types } from "mongoose";
import { NextRequest } from "next/server";
import {
  LAST_CHECKOUT_ATTEMPT_COOKIE,
  LAST_SUBSCRIPTION_COOKIE
} from "@/lib/constants";
import { connectToDatabase } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { handleApiError, jsonError, jsonOk, parseJsonBody } from "@/lib/http";
import { CheckoutAttemptModel } from "@/lib/models/checkout-attempt";
import { SubscriptionModel } from "@/lib/models/subscription";
import { UserModel } from "@/lib/models/user";
import { createRazorpaySubscription } from "@/lib/razorpay";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, getIdentifierBucketKey } from "@/lib/request";
import { assertSameOrigin } from "@/lib/security";
import { upsertSubscriptionFromRazorpay } from "@/lib/subscription-service";
import { normalizeEmail, normalizePhone } from "@/lib/utils";
import { checkoutCreateSchema } from "@/lib/validators";
import { setMemberSessionCookie, signMemberSession } from "@/lib/auth/session";

export const runtime = "nodejs";

type DuplicateKeyLikeError = {
  code?: number;
  keyValue?: {
    idempotencyKey?: string;
  };
  statusCode?: number;
  error?: {
    code?: string;
    description?: string;
    reason?: string;
  };
  message?: string;
};

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const ip = getClientIp(request);
    const ipRate = await consumeRateLimit(`checkout:create:ip:${ip}`, {
      windowMs: 10 * 60 * 1000,
      limit: 20,
      lockoutMs: 10 * 60 * 1000,
      namespace: "checkout_create_ip"
    });
    if (!ipRate.allowed) {
      return jsonError("Too many attempts. Please try again shortly.", 429);
    }

    const parsedBody = await parseJsonBody(request, checkoutCreateSchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const email = normalizeEmail(parsedBody.data.email);
    const phone = normalizePhone(parsedBody.data.phone);
    const idempotencyHeader = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyHeader) {
      return jsonError("Missing Idempotency-Key header", 422);
    }
    const idempotencyKey = idempotencyHeader;

    if (idempotencyHeader !== parsedBody.data.idempotencyKey) {
      return jsonError("Idempotency key mismatch", 422);
    }

    const identifierRate = await consumeRateLimit(
      getIdentifierBucketKey("checkout:create:identifier", email || phone || ip),
      {
        windowMs: 10 * 60 * 1000,
        limit: 12,
        lockoutMs: 10 * 60 * 1000,
        namespace: "checkout_create_identifier"
      }
    );
    if (!identifierRate.allowed) {
      return jsonError("Too many attempts. Please try again shortly.", 429);
    }

    await connectToDatabase();

    const userByPhone = phone ? await UserModel.findOne({ phone }) : null;
    const userByEmail = email ? await UserModel.findOne({ email }) : null;

    const user = userByPhone || userByEmail || (await UserModel.create({ email, phone }));
    const hasEmailConflict =
      userByEmail && String(userByEmail._id) !== String(user._id);
    const hasPhoneConflict =
      userByPhone && String(userByPhone._id) !== String(user._id);

    if (!user.email && email && !hasEmailConflict) {
      user.email = email;
    }
    if (!user.phone && phone && !hasPhoneConflict) {
      user.phone = phone;
    }
    await user.save();

    const latestActive = await SubscriptionModel.findOne({
      userId: user._id,
      status: "ACTIVE"
    }).sort({ updatedAt: -1 });

    if (latestActive) {
      const response = jsonOk({
        alreadyActive: true,
        subscriptionId: latestActive.razorpaySubscriptionId
      });
      const token = await signMemberSession(String(user._id), String(latestActive._id));
      setMemberSessionCookie(response, token);
      return response;
    }

    const existingAttempt = await CheckoutAttemptModel.findOne({ idempotencyKey });
    if (existingAttempt?.razorpaySubscriptionId) {
      const { RAZORPAY_KEY_ID } = getEnv();
      const response = jsonOk({
        keyId: RAZORPAY_KEY_ID,
        subscriptionId: existingAttempt.razorpaySubscriptionId,
        checkoutAttemptId: String(existingAttempt._id),
        prefill: {
          email,
          phone
        }
      });
      response.cookies.set({
        name: LAST_SUBSCRIPTION_COOKIE,
        value: existingAttempt.razorpaySubscriptionId,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24,
        path: "/"
      });
      response.cookies.set({
        name: LAST_CHECKOUT_ATTEMPT_COOKIE,
        value: String(existingAttempt._id),
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24,
        path: "/"
      });
      return response;
    }

    const recentPending = await SubscriptionModel.findOne({
      userId: user._id,
      status: "PENDING",
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
    }).sort({ createdAt: -1 });

    if (recentPending) {
      const attempt = await CheckoutAttemptModel.create({
        userId: user._id,
        idempotencyKey,
        razorpaySubscriptionId: recentPending.razorpaySubscriptionId,
        status: "opened"
      });

      const { RAZORPAY_KEY_ID } = getEnv();
      const response = jsonOk({
        keyId: RAZORPAY_KEY_ID,
        subscriptionId: recentPending.razorpaySubscriptionId,
        checkoutAttemptId: String(attempt._id),
        prefill: {
          email,
          phone
        }
      });

      response.cookies.set({
        name: LAST_SUBSCRIPTION_COOKIE,
        value: recentPending.razorpaySubscriptionId,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24,
        path: "/"
      });
      response.cookies.set({
        name: LAST_CHECKOUT_ATTEMPT_COOKIE,
        value: String(attempt._id),
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24,
        path: "/"
      });

      return response;
    }

    const remoteSubscription = await createRazorpaySubscription({
      idempotencyKey,
      userId: String(user._id),
      email,
      phone
    });

    await upsertSubscriptionFromRazorpay({
      razorpaySubscription: remoteSubscription,
      userId: String(user._id),
      eventAt: new Date()
    });

    const attempt = await CheckoutAttemptModel.create({
      userId: new Types.ObjectId(String(user._id)),
      idempotencyKey,
      razorpaySubscriptionId: remoteSubscription.id,
      status: "created"
    });

    const { RAZORPAY_KEY_ID } = getEnv();

    const response = jsonOk({
      keyId: RAZORPAY_KEY_ID,
      subscriptionId: remoteSubscription.id,
      checkoutAttemptId: String(attempt._id),
      prefill: {
        email,
        phone
      }
    });

    response.cookies.set({
      name: LAST_SUBSCRIPTION_COOKIE,
      value: remoteSubscription.id,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24,
      path: "/"
    });

    response.cookies.set({
      name: LAST_CHECKOUT_ATTEMPT_COOKIE,
      value: String(attempt._id),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24,
      path: "/"
    });

    return response;
  } catch (error: unknown) {
    const duplicateError = error as DuplicateKeyLikeError;
    if (duplicateError?.code === 11000) {
      const existingAttempt = await CheckoutAttemptModel.findOne({
        idempotencyKey: duplicateError?.keyValue?.idempotencyKey
      });

      if (existingAttempt?.razorpaySubscriptionId) {
        const { RAZORPAY_KEY_ID } = getEnv();
        return jsonOk({
          keyId: RAZORPAY_KEY_ID,
          subscriptionId: existingAttempt.razorpaySubscriptionId,
          checkoutAttemptId: String(existingAttempt._id)
        });
      }
    }

    const message =
      (error as DuplicateKeyLikeError)?.error?.description ||
      (error as DuplicateKeyLikeError)?.error?.reason ||
      (error as DuplicateKeyLikeError)?.message ||
      (error instanceof Error ? error.message : "Checkout creation failed");

    console.error("checkout_create_subscription_failed", {
      message,
      statusCode: (error as DuplicateKeyLikeError)?.statusCode,
      code: (error as DuplicateKeyLikeError)?.error?.code
    });

    return handleApiError({
      request,
      route: "POST /api/checkout/create-subscription",
      error: new Error(message),
      fallbackMessage: "Checkout creation failed"
    });
  }
}

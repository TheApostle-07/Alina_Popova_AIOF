import { Types } from "mongoose";
import { NextRequest } from "next/server";
import { setMemberSessionCookie, signMemberSession } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db";
import { handleApiError, jsonError, jsonOk, parseJsonBody } from "@/lib/http";
import {
  getRestoreSubscriptions,
  pickBestSubscription,
  reconcileRelevantSubscriptions,
  restoreMessage
} from "@/lib/membership-restore";
import { RestoreOtpChallengeModel } from "@/lib/models/restore-otp-challenge";
import { hashOtp } from "@/lib/otp";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, getIdentifierBucketKey } from "@/lib/request";
import { assertSameOrigin } from "@/lib/security";
import { restoreVerifySchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const ip = getClientIp(request);
    const ipRate = await consumeRateLimit(`restore:verify:ip:${ip}`, {
      windowMs: 15 * 60 * 1000,
      limit: 12,
      lockoutMs: 15 * 60 * 1000,
      namespace: "otp_verify_ip"
    });

    if (!ipRate.allowed) {
      return jsonError("Too many attempts. Please try later.", 429);
    }

    const parsedBody = await parseJsonBody(request, restoreVerifySchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const challengeRate = await consumeRateLimit(
      getIdentifierBucketKey("restore:verify:challenge", parsedBody.data.challengeId),
      {
      windowMs: 10 * 60 * 1000,
      limit: 8,
      lockoutMs: 10 * 60 * 1000,
      namespace: "otp_verify_challenge"
    }
    );
    if (!challengeRate.allowed) {
      return jsonError("Too many OTP attempts for this code. Request a new code.", 429);
    }

    await connectToDatabase();
    const challenge = await RestoreOtpChallengeModel.findById(parsedBody.data.challengeId);
    if (!challenge) {
      return jsonOk({
        status: "OTP_INVALID_OR_EXPIRED",
        message: "Code expired or invalid. Request a new verification code."
      });
    }

    if (challenge.consumedAt) {
      return jsonOk({
        status: "OTP_USED",
        message: "This code has already been used. Request a new one."
      });
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      return jsonOk({
        status: "OTP_EXPIRED",
        message: "Code expired. Request a new verification code."
      });
    }

    const incomingHash = hashOtp(challenge.id, parsedBody.data.otp);
    if (incomingHash !== challenge.codeHash) {
      challenge.attempts += 1;
      if (challenge.attempts >= challenge.maxAttempts) {
        challenge.consumedAt = new Date();
      }
      await challenge.save();
      const attemptsLeft = Math.max(0, challenge.maxAttempts - challenge.attempts);
      return jsonOk({
        status: attemptsLeft > 0 ? "OTP_INVALID" : "OTP_LOCKED",
        message:
          attemptsLeft > 0
            ? "Invalid code. Please try again."
            : "Too many invalid attempts. Request a new verification code.",
        attemptsLeft
      });
    }

    challenge.consumedAt = new Date();
    await challenge.save();

    const userIds = ((challenge.userIds || []) as Array<Types.ObjectId | string>).map(
      (value: Types.ObjectId | string) => new Types.ObjectId(String(value))
    );
    if (!userIds.length) {
      return jsonOk({ status: "NONE", message: restoreMessage("NONE") });
    }

    let subscriptions = await getRestoreSubscriptions(userIds);
    await reconcileRelevantSubscriptions(subscriptions);
    subscriptions = await getRestoreSubscriptions(userIds);

    const best = pickBestSubscription(subscriptions);
    if (!best) {
      return jsonOk({ status: "NONE", message: restoreMessage("NONE") });
    }

    if (best.status === "ACTIVE") {
      const response = jsonOk({
        status: "ACTIVE",
        message: restoreMessage("ACTIVE"),
        subscriptionId: best.razorpaySubscriptionId
      });

      const token = await signMemberSession(String(best.userId), String(best._id));
      setMemberSessionCookie(response, token);
      return response;
    }

    return jsonOk({
      status: best.status,
      message: restoreMessage(best.status),
      subscriptionId: best.razorpaySubscriptionId
    });
  } catch (error) {
    return handleApiError({
      request,
      route: "POST /api/membership/restore",
      error,
      fallbackMessage: "Restore failed"
    });
  }
}

import crypto from "crypto";
import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { sendMembershipOtpEmail } from "@/lib/email";
import { handleApiError, jsonError, jsonOk, parseJsonBody } from "@/lib/http";
import {
  findUsersForRestore,
  getRestoreSubscriptions,
  pickBestSubscription
} from "@/lib/membership-restore";
import { RestoreOtpChallengeModel } from "@/lib/models/restore-otp-challenge";
import { OTP_EXPIRES_IN_MS, OTP_MAX_ATTEMPTS, generateOtpCode, hashOtp } from "@/lib/otp";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, getIdentifierBucketKey } from "@/lib/request";
import { assertSameOrigin } from "@/lib/security";
import { normalizeEmail, normalizePhone } from "@/lib/utils";
import { restoreRequestOtpSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const ip = getClientIp(request);
    const ipRate = await consumeRateLimit(`restore:otp:ip:${ip}`, {
      windowMs: 15 * 60 * 1000,
      limit: 8,
      lockoutMs: 15 * 60 * 1000,
      namespace: "otp_request_ip"
    });
    if (!ipRate.allowed) {
      return jsonError("Too many attempts. Please try later.", 429);
    }

    const parsedBody = await parseJsonBody(request, restoreRequestOtpSchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const email = normalizeEmail(parsedBody.data.email || "");
    const phone = normalizePhone(parsedBody.data.phone || "");
    const requestedTheme = parsedBody.data.theme || "auto";

    const identityKey = email || phone || ip;
    const identifierRate = await consumeRateLimit(
      getIdentifierBucketKey("restore:otp:identifier", identityKey),
      {
        windowMs: 15 * 60 * 1000,
        limit: 6,
        lockoutMs: 15 * 60 * 1000,
        namespace: "otp_request_identifier"
      }
    );
    if (!identifierRate.allowed) {
      return jsonError("Too many attempts. Please try later.", 429);
    }

    const resendRate = await consumeRateLimit(
      getIdentifierBucketKey("restore:otp:cooldown", identityKey),
      {
        windowMs: 45 * 1000,
        limit: 1,
        lockoutMs: 30 * 1000,
        namespace: "otp_resend_cooldown"
      }
    );
    if (!resendRate.allowed) {
      return jsonError("Please wait before requesting another code.", 429);
    }

    const users = await findUsersForRestore(email, phone);
    const userIds = users.map((user) => user._id);
    const subscriptions = await getRestoreSubscriptions(userIds);
    const bestSubscription = pickBestSubscription(subscriptions);

    const fallbackUser = users[0];
    const bestUser = bestSubscription
      ? users.find((user) => String(user._id) === String(bestSubscription.userId))
      : fallbackUser;

    const targetEmail = normalizeEmail(bestUser?.email || email);

    await connectToDatabase();

    const challengeId = crypto.randomUUID();
    const otp = generateOtpCode();
    const otpHash = hashOtp(challengeId, otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_IN_MS);

    await RestoreOtpChallengeModel.create({
      _id: challengeId,
      email: targetEmail || undefined,
      phone,
      userIds,
      codeHash: otpHash,
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt
    });

    const mailResult = targetEmail
      ? await sendMembershipOtpEmail({
          to: targetEmail,
          otp,
          expiresMinutes: Math.floor(OTP_EXPIRES_IN_MS / 60_000),
          expiresAt,
          theme: requestedTheme
        })
      : { skipped: true };

    const isProduction = process.env.NODE_ENV === "production";
    if (targetEmail && mailResult.skipped && isProduction) {
      return jsonError("OTP service is unavailable right now. Please try again shortly.", 503);
    }

    return jsonOk({
      sent: true,
      challengeId,
      destination: "your registered email",
      expiresInSeconds: Math.floor(OTP_EXPIRES_IN_MS / 1000),
      expiresAt: expiresAt.toISOString(),
      devOtp: targetEmail && mailResult.skipped && !isProduction ? otp : undefined,
      message: "If the details match an account, a verification code has been sent."
    });
  } catch (error) {
    return handleApiError({
      request,
      route: "POST /api/membership/request-otp",
      error,
      fallbackMessage: "Unable to send OTP"
    });
  }
}

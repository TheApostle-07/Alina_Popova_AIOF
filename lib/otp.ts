import crypto from "crypto";
import { getEnv } from "@/lib/env";

export const OTP_LENGTH = 6;
export const OTP_EXPIRES_IN_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export function generateOtpCode() {
  return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

export function hashOtp(challengeId: string, otp: string) {
  const { SESSION_SECRET } = getEnv();
  return crypto
    .createHash("sha256")
    .update(`${challengeId}:${otp}:${SESSION_SECRET}`)
    .digest("hex");
}

export function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) {
    return email;
  }

  const first = localPart.slice(0, 1);
  const last = localPart.slice(-1);
  const hidden = "*".repeat(Math.max(localPart.length - 2, 2));
  return `${first}${hidden}${last}@${domain}`;
}

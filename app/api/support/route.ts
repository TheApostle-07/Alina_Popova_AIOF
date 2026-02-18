import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { sendSupportEmail } from "@/lib/email";
import { handleApiError, jsonError, jsonOk, parseJsonBody } from "@/lib/http";
import { SupportTicketModel } from "@/lib/models/support-ticket";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, getIdentifierBucketKey } from "@/lib/request";
import { assertSameOrigin } from "@/lib/security";
import { normalizeEmail, normalizePhone } from "@/lib/utils";
import { supportSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const ip = getClientIp(request);
    const rate = await consumeRateLimit(`support:${ip}`, {
      windowMs: 15 * 60 * 1000,
      limit: 8,
      lockoutMs: 15 * 60 * 1000,
      namespace: "support_ip"
    });

    if (!rate.allowed) {
      return jsonError("Too many requests. Please retry later.", 429);
    }

    const parsedBody = await parseJsonBody(request, supportSchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }
    const normalizedEmail = normalizeEmail(parsedBody.data.email || "");
    const normalizedPhone = normalizePhone(parsedBody.data.phone || "");
    const identifierKey = normalizedEmail || normalizedPhone || ip;
    const identifierRate = await consumeRateLimit(
      getIdentifierBucketKey("support:identifier", identifierKey),
      {
        windowMs: 15 * 60 * 1000,
        limit: 4,
        lockoutMs: 15 * 60 * 1000,
        namespace: "support_identifier"
      }
    );
    if (!identifierRate.allowed) {
      return jsonError("Too many requests. Please retry later.", 429);
    }

    await connectToDatabase();

    await SupportTicketModel.create({
      email: normalizedEmail,
      phone: normalizedPhone,
      topic: parsedBody.data.topic,
      message: parsedBody.data.message
    });

    await sendSupportEmail({
      topic: parsedBody.data.topic,
      message: parsedBody.data.message,
      email: parsedBody.data.email,
      phone: parsedBody.data.phone
    });

    return jsonOk({ success: true });
  } catch (error) {
    return handleApiError({
      request,
      route: "POST /api/support",
      error,
      fallbackMessage: "Unable to submit support request"
    });
  }
}

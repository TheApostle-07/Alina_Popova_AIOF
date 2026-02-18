import { NextRequest } from "next/server";
import { getAdminPayloadFromRequest } from "@/lib/auth/request-auth";
import { jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = await getAdminPayloadFromRequest(request);
  return jsonOk({
    active: Boolean(admin)
  });
}

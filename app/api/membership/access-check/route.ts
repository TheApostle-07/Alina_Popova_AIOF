import { NextRequest } from "next/server";
import { getCurrentMemberFromRequest } from "@/lib/auth/guards";
import { jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const member = await getCurrentMemberFromRequest(request);
  return jsonOk({
    active: Boolean(member)
  });
}

import { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, MEMBER_COOKIE_NAME } from "@/lib/constants";
import { verifyAdminSession, verifyMemberSession } from "@/lib/auth/session";

export async function getAdminPayloadFromRequest(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSession(token);
}

export async function getMemberPayloadFromRequest(request: NextRequest) {
  const token = request.cookies.get(MEMBER_COOKIE_NAME)?.value;
  return verifyMemberSession(token);
}

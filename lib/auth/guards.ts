import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, MEMBER_COOKIE_NAME } from "@/lib/constants";
import { connectToDatabase } from "@/lib/db";
import { SubscriptionModel } from "@/lib/models/subscription";
import { UserModel } from "@/lib/models/user";
import { verifyAdminSession, verifyMemberSession } from "@/lib/auth/session";

export type ActiveMemberContext = {
  memberId: string;
  subscriptionId: string;
};

type MemberUserSnapshot = {
  _id: unknown;
  email?: string;
  phone?: string;
};

type ActiveSubscriptionSnapshot = {
  _id: unknown;
  razorpaySubscriptionId: string;
  status: "ACTIVE";
};

export type HydratedMember = {
  memberId: string;
  subscriptionId: string;
  user: MemberUserSnapshot;
  subscription: ActiveSubscriptionSnapshot;
};

async function hydrateMember(memberId: string, subscriptionId: string): Promise<HydratedMember | null> {
  await connectToDatabase();
  const subscription = (await SubscriptionModel.findOne({
    _id: subscriptionId,
    userId: memberId,
    status: "ACTIVE"
  })
    .select({ _id: 1, razorpaySubscriptionId: 1, status: 1 })
    .lean()) as ActiveSubscriptionSnapshot | null;

  if (!subscription) {
    return null;
  }

  const user = (await UserModel.findById(memberId)
    .select({ _id: 1, email: 1, phone: 1 })
    .lean()) as MemberUserSnapshot | null;
  if (!user) {
    return null;
  }

  return {
    memberId,
    subscriptionId,
    user,
    subscription
  };
}

export async function getCurrentMemberFromRequest(request: NextRequest) {
  const token = request.cookies.get(MEMBER_COOKIE_NAME)?.value;
  const payload = await verifyMemberSession(token);
  if (!payload) {
    return null;
  }
  return hydrateMember(payload.memberId, payload.subscriptionId);
}

export async function getCurrentMemberFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(MEMBER_COOKIE_NAME)?.value;
  const payload = await verifyMemberSession(token);
  if (!payload) {
    return null;
  }
  return hydrateMember(payload.memberId, payload.subscriptionId);
}

export async function requireActiveMemberPage() {
  const member = await getCurrentMemberFromCookies();
  if (!member) {
    redirect("/account?reason=inactive");
  }
  return member;
}

export async function getCurrentAdminFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSession(token);
}

export async function requireAdminPage() {
  const admin = await getCurrentAdminFromCookies();
  if (!admin) {
    redirect("/admin/login");
  }
  return admin;
}

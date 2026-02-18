import type { Metadata } from "next";
import { MembershipHome } from "@/components/marketing/membership-home";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = {
  title: "Alina Popova - Private Membership",
  description:
    "Unlock Alina Popova's private members-only feed. Exclusive images and short videos. Secured by Razorpay. Cancel anytime. 18+ only."
};

export default async function MembershipStaticPage() {
  return <MembershipHome path="/membership" previewMode="placeholder" />;
}

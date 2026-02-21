import type { Metadata } from "next";
import { MembershipHome } from "@/components/marketing/membership-home";
import { getPublicSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Alina Popova - Private Membership",
  description:
    "Unlock Alina Popova's private members-only feed. Exclusive images and short videos. Secured by Razorpay. Cancel anytime."
};

export default async function MembershipStaticPage() {
  let ageModeEnabled = true;
  try {
    const settings = await getPublicSiteSettings();
    ageModeEnabled = settings.ageModeEnabled;
  } catch {
    ageModeEnabled = true;
  }

  return <MembershipHome path="/membership" previewMode="placeholder" ageModeEnabled={ageModeEnabled} />;
}

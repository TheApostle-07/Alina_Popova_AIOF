import { MembershipHome } from "@/components/marketing/membership-home";
import { getPublicSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let ageModeEnabled = true;
  try {
    const settings = await getPublicSiteSettings();
    ageModeEnabled = settings.ageModeEnabled;
  } catch {
    ageModeEnabled = true;
  }

  return <MembershipHome path="/" previewMode="live" ageModeEnabled={ageModeEnabled} />;
}

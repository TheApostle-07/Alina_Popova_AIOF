import { MembershipHome } from "@/components/marketing/membership-home";

export const revalidate = 120;

export default async function HomePage() {
  return <MembershipHome path="/" previewMode="live" />;
}

import { redirect } from "next/navigation";
import { requireActiveMemberPage } from "@/lib/auth/guards";

export default async function NoGoZonePage() {
  await requireActiveMemberPage();
  redirect("/vip");
}

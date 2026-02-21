import { AdminVipDashboard } from "@/components/admin/admin-vip-dashboard";
import { requireAdminPage } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminVipPage() {
  await requireAdminPage();
  return <AdminVipDashboard />;
}

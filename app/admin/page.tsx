import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { requireAdminPage } from "@/lib/auth/guards";

export default async function AdminPage() {
  await requireAdminPage();
  return <AdminDashboard />;
}

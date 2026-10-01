import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/security";
import { AdminDashboard } from "@/components/veyra/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/");
  return <AdminDashboard />;
}

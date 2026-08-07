import { AdminControlCenter } from "@/components/dashboard/admin/AdminControlCenterWithPreview";
import { requireRouteAccess } from "@/lib/platform/server-access";

export default async function AdminPage() {
  const { user, access } = await requireRouteAccess("/dashboard/admin", "/dashboard");

  return <AdminControlCenter adminIdentityLabel={user!.email ?? access.platformRole} />;
}

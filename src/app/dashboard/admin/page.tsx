import { redirect } from "next/navigation";

import { AdminControlCenter } from "@/components/dashboard/admin/AdminControlCenterWithPreview";
import { requireRouteAccess } from "@/lib/platform/server-access";

export default async function AdminPage() {
  const result = await requireRouteAccess("/dashboard/admin");
  if (!result.user) redirect("/sign-in?next=/dashboard/admin");
  if (!result.access.canAccessCommandCenter) redirect("/dashboard");

  return <AdminControlCenter ownerEmail={result.user.email ?? ""} />;
}

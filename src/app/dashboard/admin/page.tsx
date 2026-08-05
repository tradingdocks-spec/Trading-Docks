import { redirect } from "next/navigation";

import { AdminControlCenter } from "@/components/dashboard/admin/AdminControlCenterWithPreview";
import { canAccessAdminRoute, resolveServerAccess } from "@/lib/identity/server-access";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?next=/dashboard/admin");
  const access = await resolveServerAccess(supabase, user);
  if (!canAccessAdminRoute(access)) {
    redirect("/dashboard");
  }

  return <AdminControlCenter adminIdentityLabel={user.email ?? access.platformRole} />;
}

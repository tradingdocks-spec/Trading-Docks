import { redirect } from "next/navigation";

import { AdminControlCenter } from "@/components/dashboard/admin/AdminControlCenter";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?next=/dashboard/admin");
  if (user.email?.trim().toLowerCase() !== "tradingdocks@gmail.com") {
    redirect("/dashboard");
  }

  return <AdminControlCenter ownerEmail={user.email} />;
}

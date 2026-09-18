import { redirect } from "next/navigation";

import { SellingListingsWorkspace } from "@/components/dashboard/selling/SellingListingsWorkspace";
import { loadSellableInventoryPage } from "@/lib/selling/candidate-service";
import { createClient } from "@/lib/supabase/server";

export default async function SellingListingsPage({ searchParams }: { searchParams: Promise<{ chaosBatch?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/selling/listings");
  const { data: preferences } = await supabase.from("user_preferences").select("active_workspace_id").eq("user_id", user.id).maybeSingle();
  const workspaceId = preferences?.active_workspace_id as string | null;
  if (!workspaceId) redirect("/dashboard/selling");
  const params = await searchParams;
  const initialPage = await loadSellableInventoryPage({ supabase, userId: user.id, workspaceId, filters: { batchId: params.chaosBatch } });
  return <SellingListingsWorkspace initialPage={initialPage} />;
}

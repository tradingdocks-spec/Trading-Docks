import { notFound, redirect } from "next/navigation";

import { SellingListingBatchEditor } from "@/components/dashboard/selling/SellingListingBatchEditor";
import { loadSellingListingBatch } from "@/lib/selling/listing-service";
import { createClient } from "@/lib/supabase/server";

export default async function SellingListingBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/dashboard/selling/listings/${batchId}`);
  const { data: preferences } = await supabase.from("user_preferences").select("active_workspace_id").eq("user_id", user.id).maybeSingle();
  const workspaceId = preferences?.active_workspace_id as string | null;
  if (!workspaceId) redirect("/dashboard/selling");
  const batch = await loadSellingListingBatch({ supabase, userId: user.id, workspaceId, batchId });
  if (!batch) notFound();
  return <SellingListingBatchEditor batch={batch} />;
}

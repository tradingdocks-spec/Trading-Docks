import { notFound, redirect } from "next/navigation";

import { ChaosSortBatchDetail, type ChaosSortBatchDetailData } from "@/components/dashboard/inventory/ChaosSortBatchDetail";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ChaosSortBatchDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/sign-in?next=/dashboard/inventory/batches/${encodeURIComponent(batchId)}`);
  const { data: batch, error: batchError } = await supabase.from("chaos_sort_batches").select("id,batch_code,title,status,status_v2,session_id,destination_location_id,destination_label,initial_quantity,current_quantity,created_at,completed_at").eq("id", batchId).eq("user_id", auth.user.id).maybeSingle();
  if (batchError || !batch) notFound();
  const [{ data: positions }, { data: session }] = await Promise.all([
    supabase.from("chaos_sort_inventory_positions").select("id,item_id,card_name,scryfall_id,set_code,collector_number,finish,condition,quantity,location_id,status,created_at").eq("batch_id", batchId).eq("user_id", auth.user.id).gt("quantity", 0).order("card_name", { ascending: true }),
    batch.session_id ? supabase.from("chaos_sort_sessions").select("session_code,source,reference").eq("id", batch.session_id).eq("user_id", auth.user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return <ChaosSortBatchDetail data={{ batch, positions: positions ?? [], session }} />;
}

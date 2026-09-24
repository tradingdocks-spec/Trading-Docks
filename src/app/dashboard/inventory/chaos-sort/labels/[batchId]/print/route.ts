import { createClient } from "@/lib/supabase/server";
import { renderChaosSortPrintDocument } from "@/lib/chaos-sort/print-document";

import { renderChaosSortLabelSvg } from "@/lib/chaos-sort/batch-label";
import { resolveLabelMedia } from "@/lib/chaos-sort/label-media";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow, noarchive" };
  if (!user) {
    const signIn = new URL("/sign-in", request.url);
    const requested = new URL(request.url);
    signIn.searchParams.set("next", requested.pathname + requested.search);
    return new Response(null, { status: 303, headers: { ...headers, Location: signIn.href } });
  }
  // Exactly one owned batch. The print route never fetches positions, other batches or a label array.
  const { data: batch, error } = await supabase.from("chaos_sort_batches")
    .select("id,batch_code,session_id,destination_label,current_quantity,initial_quantity,physical_card_count,created_at,completed_at")
    .eq("id", batchId).eq("user_id", user.id).maybeSingle();
  if (error) return new Response("The batch label could not be loaded. Please retry.", { status: 503, headers });
  if (!batch) return new Response("Batch not found.", { status: 404, headers });
  const { data: session, error: sessionError } = batch.session_id
    ? await supabase.from("chaos_sort_sessions").select("session_code").eq("id", batch.session_id).eq("user_id", user.id).maybeSingle()
    : { data: null, error: null };
  if (sessionError) return new Response("The batch session could not be loaded. Please retry.", { status: 503, headers });
  const url = new URL(request.url);
  if (url.searchParams.get("format") === "svg" && url.searchParams.get("preview") === "1") {
    return new Response(renderChaosSortLabelSvg({ ...batch, session_code: session?.session_code ?? null }, resolveLabelMedia(url.searchParams), new URL(`/dashboard/inventory/batches/${encodeURIComponent(batch.id)}`, url.origin).href), {
      headers: { ...headers, "Content-Type": "image/svg+xml; charset=utf-8" },
    });
  }
  return new Response(renderChaosSortPrintDocument({ ...batch, session_code: session?.session_code ?? null }, request.url), {
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  });
}

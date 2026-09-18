import { NextResponse } from "next/server";

import { normalizeCandidatePatch } from "@/lib/selling/listing-service";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ candidateId: string }> }) {
  const { candidateId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data: preferences } = await supabase.from("user_preferences").select("active_workspace_id").eq("user_id", user.id).maybeSingle();
  const workspaceId = preferences?.active_workspace_id as string | null;
  if (!workspaceId) return NextResponse.json({ error: "An active workspace is required." }, { status: 400 });
  try {
    const input = await request.json() as Record<string, unknown>;
    const patch = normalizeCandidatePatch(input);
    if (!Object.keys(patch).length) return NextResponse.json({ error: "No editable fields were supplied." }, { status: 400 });
    if (patch.quantity !== undefined) {
      const { data, error } = await supabase.rpc("update_selling_candidate_quantity", { p_workspace_id: workspaceId, p_candidate_id: candidateId, p_quantity: patch.quantity, p_idempotency_key: `candidate-edit:${candidateId}:${patch.quantity}` });
      if (error) throw error;
      delete patch.quantity;
      if (!Object.keys(patch).length) return NextResponse.json({ candidate: data });
    }
    const { data, error } = await supabase.from("selling_listing_candidates").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", candidateId).eq("user_id", user.id).eq("workspace_id", workspaceId).select("id,listing_price,condition,finish,language,selected_marketplaces,quantity,allocated_quantity,updated_at").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    return NextResponse.json({ candidate: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Candidate could not be updated." }, { status: 400 });
  }
}

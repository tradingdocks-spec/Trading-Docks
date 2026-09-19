import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const url = new URL(request.url);
  const admin = createAdminClient();
  let query = admin.from("marketing_conversations").select("*,marketing_prospects(id,business_name,city,state,status,public_email,suppressed),marketing_outbound_campaigns(id,name,feature_id)").order("last_message_at", { ascending: false }).limit(100);
  const status = url.searchParams.get("status");
  const assignedTo = url.searchParams.get("assignedTo");
  if (status === "unmatched_inbound") query = query.eq("status", status);
  if (assignedTo === "mine") query = query.eq("assigned_to", actor.user.id);
  if (assignedTo === "unassigned") query = query.is("assigned_to", null);
  const result = await query;
  if (result.error) return NextResponse.json({ error: /relation .* does not exist|schema cache/i.test(result.error.message) ? "Sales inbox migration is not initialized. Apply the additive migration in staging." : "Inbox could not be loaded." }, { status: 503 });
  const conversations = result.data ?? [];
  const ids = conversations.map((row) => row.id);
  const messages = ids.length ? await admin.from("marketing_conversation_messages").select("conversation_id,body_text,classification,is_read,created_at,direction").in("conversation_id", ids).order("created_at", { ascending: false }) : { data: [], error: null };
  const search = url.searchParams.get("search")?.trim().toLowerCase();
  const latest = new Map<string, Record<string, unknown>>();
  for (const message of messages.data ?? []) if (!latest.has(message.conversation_id)) latest.set(message.conversation_id, message);
  const filtered = search ? conversations.filter((row) => `${row.subject ?? ""} ${row.marketing_prospects?.business_name ?? ""} ${row.marketing_prospects?.public_email ?? ""} ${latest.get(row.id)?.body_text ?? ""}`.toLowerCase().includes(search)) : conversations;
  return NextResponse.json({ conversations: filtered.map((row) => ({ ...row, latestMessage: latest.get(row.id) ?? null })), unreadCount: [...latest.values()].filter((message) => message.direction === "inbound" && !message.is_read).length });
}

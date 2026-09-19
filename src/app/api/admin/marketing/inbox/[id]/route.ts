import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPLY_CLASSIFICATIONS, suggestReplyDraft } from "@/lib/marketing/reply-classification";

export const dynamic = "force-dynamic";
const stages = ["new", "researched", "ready_to_contact", "emailed", "opened", "clicked", "replied", "engaged", "interested", "demo_requested", "demo_scheduled", "trial", "trial_started", "customer", "not_interested", "do_not_contact"];

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const { id } = await context.params;
  const admin = createAdminClient();
  const conversation = await admin.from("marketing_conversations").select("*,marketing_prospects(*),marketing_outbound_campaigns(*,marketing_feature_library(*))").eq("id", id).maybeSingle();
  if (conversation.error || !conversation.data) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const [messages, tasks, activities] = await Promise.all([
    admin.from("marketing_conversation_messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true }),
    admin.from("marketing_tasks").select("*").eq("conversation_id", id).order("due_at", { ascending: true }),
    conversation.data.prospect_id ? admin.from("marketing_activities").select("*").eq("prospect_id", conversation.data.prospect_id).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
  ]);
  await admin.from("marketing_conversation_messages").update({ is_read: true }).eq("conversation_id", id).eq("direction", "inbound");
  return NextResponse.json({ conversation: conversation.data, messages: messages.data ?? [], tasks: tasks.data ?? [], activities: activities.data ?? [], actorId: actor.user.id });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = body?.action;
  const admin = createAdminClient();
  if (action === "mark_read" || action === "mark_unread") { await admin.from("marketing_conversation_messages").update({ is_read: action === "mark_read" }).eq("conversation_id", id).eq("direction", "inbound"); return NextResponse.json({ ok: true }); }
  if (action === "assign") { await admin.from("marketing_conversations").update({ assigned_to: typeof body?.assignedTo === "string" ? body.assignedTo : null }).eq("id", id); return NextResponse.json({ ok: true }); }
  if (action === "close" || action === "snooze") { await admin.from("marketing_conversations").update({ status: action }).eq("id", id); return NextResponse.json({ ok: true }); }
  if (action === "classify" && typeof body?.classification === "string" && REPLY_CLASSIFICATIONS.includes(body.classification as typeof REPLY_CLASSIFICATIONS[number])) { await admin.from("marketing_conversation_messages").update({ classification: body.classification, classification_source: "manual", classification_confidence: "high" }).eq("conversation_id", id).eq("direction", "inbound").order("created_at", { ascending: false }).limit(1); return NextResponse.json({ ok: true }); }
  if (action === "stage" && typeof body?.stage === "string" && stages.includes(body.stage)) { const conversation = await admin.from("marketing_conversations").select("prospect_id").eq("id", id).single(); if (conversation.data?.prospect_id) { await admin.from("marketing_prospects").update({ status: body.stage }).eq("id", conversation.data.prospect_id); await admin.from("marketing_activities").insert({ prospect_id: conversation.data.prospect_id, actor_user_id: actor.user.id, activity_type: "stage_changed", body: `Prospect stage changed to ${body.stage}.`, metadata: { conversationId: id } }); } return NextResponse.json({ ok: true }); }
  return NextResponse.json({ error: "Unsupported inbox action." }, { status: 400 });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const admin = createAdminClient();
  if (body?.action === "suggest_reply") {
    const context = await admin.from("marketing_conversations").select("subject,marketing_outbound_campaigns(marketing_feature_library(name,approved_claims))").eq("id", id).single();
    const latest = await admin.from("marketing_conversation_messages").select("classification,body_text").eq("conversation_id", id).eq("direction", "inbound").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const campaign = Array.isArray(context.data?.marketing_outbound_campaigns) ? context.data.marketing_outbound_campaigns[0] : context.data?.marketing_outbound_campaigns;
    const feature = Array.isArray(campaign?.marketing_feature_library) ? campaign.marketing_feature_library[0] : campaign?.marketing_feature_library;
    const claims = Array.isArray(feature?.approved_claims) ? feature.approved_claims.flatMap((claim: unknown) => claim && typeof claim === "object" && "claim" in claim && typeof claim.claim === "string" ? [claim.claim] : typeof claim === "string" ? [claim] : []) : [];
    return NextResponse.json({ draft: suggestReplyDraft({ classification: (latest.data?.classification as never) ?? "other", featureName: typeof feature?.name === "string" ? feature.name : undefined, approvedClaims: claims }), requiresAdminReview: true });
  }
  if (body?.action === "create_task") {
    if (typeof body.title !== "string" || !body.title.trim()) return NextResponse.json({ error: "Task title is required." }, { status: 400 });
    const conversation = await admin.from("marketing_conversations").select("prospect_id").eq("id", id).single();
    const task = await admin.from("marketing_tasks").insert({ conversation_id: id, prospect_id: conversation.data?.prospect_id ?? null, assigned_to: typeof body.assignedTo === "string" ? body.assignedTo : actor.user.id, title: body.title.trim().slice(0, 200), description: typeof body.description === "string" ? body.description.slice(0, 5000) : "", due_at: typeof body.dueAt === "string" ? body.dueAt : null, created_by: actor.user.id }).select("*").single();
    if (task.error) return NextResponse.json({ error: "Task could not be created." }, { status: 503 });
    return NextResponse.json({ task: task.data }, { status: 201 });
  }
  return NextResponse.json({ error: "Unsupported inbox action." }, { status: 400 });
}

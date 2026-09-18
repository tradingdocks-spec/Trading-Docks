import { NextResponse } from "next/server";

import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { normalizeEmail } from "@/lib/marketing/growth-engine";
import { createGrowthEmailProvider } from "@/lib/marketing/growth-email-provider";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const { data, error } = await createAdminClient().from("marketing_outreach_drafts").select("id,prospect_id,campaign_id,subject,preview_text,body_text,rationale,status,scheduled_at,created_at,marketing_prospects(business_name,public_email,city,state)").order("updated_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: migrationMessage(error.message) }, { status: 503 });
  return NextResponse.json({ drafts: data ?? [] });
}

export async function PATCH(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { draftId?: unknown; action?: unknown } | null;
  if (typeof body?.draftId !== "string" || !["approve", "reject"].includes(String(body.action))) return NextResponse.json({ error: "Draft and approval action are required." }, { status: 400 });
  const status = body.action === "approve" ? "approved" : "rejected";
  const { data, error } = await createAdminClient().from("marketing_outreach_drafts").update({ status, approved_by: status === "approved" ? actor.user.id : null, approved_at: status === "approved" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", body.draftId).select("id,status").single();
  if (error) return NextResponse.json({ error: "Outreach draft could not be updated." }, { status: 503 });
  return NextResponse.json({ draft: data });
}

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { draftId?: unknown; action?: unknown } | null;
  if (body?.action !== "mock_send" || typeof body.draftId !== "string") return NextResponse.json({ error: "Only the development mock send action is available." }, { status: 400 });
  const admin = createAdminClient();
  const { data: draft, error: draftError } = await admin.from("marketing_outreach_drafts").select("id,status,prospect_id,marketing_prospects(public_email,suppressed)").eq("id", body.draftId).maybeSingle();
  if (draftError) return NextResponse.json({ error: migrationMessage(draftError.message) }, { status: 503 });
  if (!draft || draft.status !== "approved") return NextResponse.json({ error: "Only approved drafts can enter the mock send queue." }, { status: 409 });
  const prospect = Array.isArray(draft.marketing_prospects) ? draft.marketing_prospects[0] : draft.marketing_prospects;
  const email = typeof prospect?.public_email === "string" ? normalizeEmail(prospect.public_email) : "";
  if (!email) return NextResponse.json({ error: "A public recipient email is required." }, { status: 400 });
  const suppression = await admin.from("marketing_outbound_suppressions").select("id").eq("normalized_email", email).maybeSingle();
  if (suppression.data || prospect?.suppressed) {
    await admin.from("marketing_outreach_drafts").update({ status: "suppressed", updated_at: new Date().toISOString() }).eq("id", body.draftId);
    return NextResponse.json({ error: "This recipient is suppressed and cannot enter the queue." }, { status: 409 });
  }
  const idempotencyKey = `mock:${body.draftId}`;
  const providerResult = await createGrowthEmailProvider().send({ idempotencyKey, recipient: email, subject: "approved outreach draft", bodyText: "approved outreach draft" });
  const message = await admin.from("marketing_outreach_messages").upsert({ draft_id: body.draftId, normalized_email: email, status: "sent", idempotency_key: idempotencyKey, provider: providerResult.provider, provider_message_id: providerResult.providerMessageId, sent_at: new Date().toISOString() }, { onConflict: "idempotency_key" }).select("id,provider,provider_message_id,status").single();
  if (message.error || !message.data) return NextResponse.json({ error: "Mock message could not be recorded." }, { status: 503 });
  await admin.from("marketing_outreach_drafts").update({ status: "sent", updated_at: new Date().toISOString() }).eq("id", body.draftId);
  await admin.from("marketing_email_events").upsert({ message_id: message.data.id, provider_event_id: `mock:delivered:${message.data.id}`, event_type: "delivered", metadata: { provider: "mock" } }, { onConflict: "provider_event_id" });
  await admin.from("marketing_activities").insert({ prospect_id: draft.prospect_id, actor_user_id: actor.user.id, activity_type: "outreach_mock_sent", body: "Recorded a mock outreach send; no external email was delivered.", metadata: { messageId: message.data.id, provider: "mock" } });
  return NextResponse.json({ message: message.data, mockOnly: true });
}

function migrationMessage(message: string) {
  return /relation .* does not exist|schema cache/i.test(message)
    ? "Marketing growth tables are not initialized. Apply the documented staging migration first."
    : "Outreach data could not be loaded.";
}

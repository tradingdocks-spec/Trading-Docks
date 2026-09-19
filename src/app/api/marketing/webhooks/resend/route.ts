import { NextResponse } from "next/server";
import { verifyResendWebhook } from "@/lib/marketing/email-delivery";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  let event;
  try { event = verifyResendWebhook(rawBody, request.headers, process.env.MARKETING_EMAIL_WEBHOOK_SECRET); } catch { event = null; }
  const admin = createAdminClient();
  if (!event) {
    await admin.from("marketing_settings").update({ webhook_last_invalid_at: new Date().toISOString() }).eq("singleton_key", "default");
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }
  const existing = await admin.from("marketing_email_webhook_events").select("id").eq("provider", event.provider).eq("provider_event_id", event.providerEventId).maybeSingle();
  if (existing.data) return NextResponse.json({ received: true, duplicate: true });
  const message = event.providerMessageId ? await admin.from("marketing_outreach_messages").select("id,normalized_email,prospect_id,campaign_id,creative_id,status").eq("provider_message_id", event.providerMessageId).maybeSingle() : { data: null, error: null };
  const messageId = message.data?.id ?? null;
  const ledger = await admin.from("marketing_email_webhook_events").insert({ provider: event.provider, provider_event_id: event.providerEventId, message_id: messageId, event_type: event.type, payload: event.payload, received_at: new Date().toISOString() });
  if (ledger.error?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (ledger.error) return NextResponse.json({ error: "Webhook event could not be recorded." }, { status: 503 });
  await admin.from("marketing_settings").update({ webhook_last_valid_at: new Date().toISOString() }).eq("singleton_key", "default");
  if (!message.data) return NextResponse.json({ received: true, orphan: true });
  await admin.from("marketing_email_events").insert({ message_id: message.data.id, provider_event_id: event.providerEventId, event_type: event.type, occurred_at: event.occurredAt, metadata: { provider: event.provider, clickedUrl: event.clickedUrl ?? null, bounceCategory: event.bounceCategory ?? null, reason: event.reason ?? null } });
  const status = event.type === "clicked" ? "clicked" : event.type === "opened" ? "opened" : event.type === "bounced" ? "bounced" : event.type === "complained" ? "complained" : event.type === "unsubscribed" ? "unsubscribed" : event.type === "failed" ? "failed" : event.type;
  const updates: Record<string, unknown> = { status, delivered_at: event.type === "delivered" ? event.occurredAt : undefined, submitted_at: event.type === "sent" ? event.occurredAt : undefined, failure_reason: event.reason ?? null };
  await admin.from("marketing_outreach_messages").update(updates).eq("id", message.data.id);
  const suppressionReason = event.type === "bounced" && event.bounceCategory === "hard" ? "hard_bounce" : event.type === "complained" ? "complaint" : event.type === "unsubscribed" ? "unsubscribe" : null;
  if (suppressionReason) {
    await admin.from("marketing_outbound_suppressions").upsert({ normalized_email: message.data.normalized_email, reason: suppressionReason, source: "provider", notes: `Provider ${event.type} event.`, created_at: new Date().toISOString() }, { onConflict: "normalized_email" });
  }
  const body = event.type === "clicked" ? "CTA click tracked from provider webhook." : event.type === "opened" ? "Open tracked from provider webhook; this is not a guaranteed human read." : `${event.type.charAt(0).toUpperCase()}${event.type.slice(1)} event recorded from provider webhook.`;
  if (message.data.prospect_id) await admin.from("marketing_activities").insert({ prospect_id: message.data.prospect_id, activity_type: `email_${event.type}`, body, metadata: { messageId: message.data.id, providerEventId: event.providerEventId, creativeId: message.data.creative_id } });
  if (message.data.campaign_id) await admin.from("marketing_campaign_activities").insert({ campaign_id: message.data.campaign_id, activity_type: `email_${event.type}`, body, metadata: { messageId: message.data.id, providerEventId: event.providerEventId, creativeId: message.data.creative_id } });
  return NextResponse.json({ received: true, messageId: message.data.id });
}

import { NextResponse } from "next/server";
import { verifyAndParseResendInbound, matchInboundEmail, sanitizeInboundHtml } from "@/lib/marketing/inbound-email";
import { classifyInboundReply, interestEventForClassification } from "@/lib/marketing/reply-classification";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const inbound = await verifyAndParseResendInbound(rawBody, request.headers, process.env.MARKETING_EMAIL_WEBHOOK_SECRET);
  const admin = createAdminClient();
  if (!inbound) {
    await admin.from("marketing_settings").update({ webhook_last_invalid_at: new Date().toISOString() }).eq("singleton_key", "default");
    return NextResponse.json({ error: "Invalid inbound webhook." }, { status: 400 });
  }
  const eventId = request.headers.get("svix-id") ?? inbound.providerMessageId;
  const existing = await admin.from("marketing_email_webhook_events").select("id").eq("provider", "resend_inbound").eq("provider_event_id", eventId).maybeSingle();
  if (existing.data) return NextResponse.json({ received: true, duplicate: true });
  const ledger = await admin.from("marketing_email_webhook_events").insert({ provider: "resend_inbound", provider_event_id: eventId, event_type: "email.received", payload: { providerMessageId: inbound.providerMessageId, providerThreadId: inbound.providerThreadId, receivedAt: inbound.receivedAt }, received_at: new Date().toISOString() });
  if (ledger.error?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (ledger.error) return NextResponse.json({ error: "Inbound event could not be recorded." }, { status: 503 });

  const candidatesResult = await admin.from("marketing_outreach_messages").select("id,conversation_id,provider_message_id,provider_thread_id,normalized_email,subject,created_at,prospect_id,contact_id,campaign_id,creative_id").not("provider_message_id", "is", null).order("created_at", { ascending: false }).limit(500);
  if (candidatesResult.error) return NextResponse.json({ error: "Inbound matching is unavailable." }, { status: 503 });
  const match = matchInboundEmail(inbound, (candidatesResult.data ?? []).map((row) => ({ id: String(row.id), conversationId: row.conversation_id, providerMessageId: row.provider_message_id, providerThreadId: row.provider_thread_id, normalizedEmail: row.normalized_email, subject: row.subject, lastMessageAt: row.created_at })));
  const candidate = match.kind === "matched" ? candidatesResult.data?.find((row) => row.id === match.candidate.id) : null;
  let conversationId = candidate?.conversation_id ?? null;
  if (!conversationId) {
    const created = await admin.from("marketing_conversations").insert({ prospect_id: candidate?.prospect_id ?? null, contact_id: candidate?.contact_id ?? null, campaign_id: candidate?.campaign_id ?? null, acquisition_campaign_id: candidate?.campaign_id ?? null, acquisition_creative_id: candidate?.creative_id ?? null, acquisition_message_id: candidate?.id ?? null, status: match.kind === "matched" ? "open" : "unmatched_inbound", subject: inbound.subject, last_message_at: inbound.receivedAt, last_inbound_at: inbound.receivedAt }).select("id").single();
    if (created.error || !created.data) return NextResponse.json({ error: "Conversation could not be created." }, { status: 503 });
    conversationId = created.data.id;
    if (candidate) await admin.from("marketing_outreach_messages").update({ conversation_id: conversationId, provider_thread_id: inbound.providerThreadId ?? candidate.provider_thread_id }).eq("id", candidate.id);
  }
  const classification = classifyInboundReply({ subject: inbound.subject, text: inbound.text, headers: inbound.headers });
  const message = await admin.from("marketing_conversation_messages").insert({ conversation_id: conversationId, prospect_id: candidate?.prospect_id ?? null, contact_id: candidate?.contact_id ?? null, campaign_id: candidate?.campaign_id ?? null, direction: "inbound", provider: "resend", provider_message_id: inbound.providerMessageId, provider_thread_id: inbound.providerThreadId, in_reply_to_provider_message_id: inbound.inReplyToProviderMessageId, subject: inbound.subject, body_text: inbound.text ?? "", body_html: inbound.html ?? null, sanitized_body_html: sanitizeInboundHtml(inbound.html), sender_email: inbound.from.email, sender_name: inbound.from.name ?? null, recipient_emails: inbound.to, received_at: inbound.receivedAt, classification: classification.classification, classification_confidence: classification.confidence, classification_source: classification.source, headers: inbound.headers ?? {}, metadata: inbound.metadata ?? {} }).select("id").single();
  if (message.error?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (message.error || !message.data) return NextResponse.json({ error: "Inbound message could not be stored." }, { status: 503 });
  const isHuman = classification.classification !== "out_of_office";
  await admin.from("marketing_conversations").update({ status: classification.classification === "other" ? "needs_review" : "open", subject: inbound.subject, last_message_at: inbound.receivedAt, last_inbound_at: inbound.receivedAt }).eq("id", conversationId);
  if (candidate?.prospect_id && isHuman) {
    const stage = classification.classification === "demo_request" ? "demo_requested" : classification.classification === "interested" ? "interested" : classification.classification === "unsubscribe" ? "do_not_contact" : classification.classification === "not_interested" ? "not_interested" : "engaged";
    await admin.from("marketing_prospects").update({ status: stage, ...(stage === "do_not_contact" ? { suppressed: true, suppression_reason: "Inbound unsubscribe" } : {}) }).eq("id", candidate.prospect_id);
    await admin.from("marketing_activities").insert({ prospect_id: candidate.prospect_id, activity_type: classification.classification === "out_of_office" ? "out_of_office_received" : "reply_received", body: classification.classification === "out_of_office" ? "An out-of-office reply was received; it is not counted as engagement." : "A reply was received and future cold outreach is paused.", metadata: { conversationId, messageId: message.data.id, classification: classification.classification, sequenceStopReason: isHuman ? "human_reply_received" : null } });
    if (classification.classification === "unsubscribe") await admin.from("marketing_outbound_suppressions").upsert({ normalized_email: inbound.from.email, reason: "unsubscribe", source: "inbound_reply", notes: "Explicit unsubscribe received." }, { onConflict: "normalized_email" });
    if (classification.classification !== "out_of_office") await admin.from("marketing_interest_events").insert({ prospect_id: candidate.prospect_id, conversation_id: conversationId, campaign_id: candidate.campaign_id, message_id: message.data.id, event_type: interestEventForClassification(classification.classification), source: "inbound_email" });
  }
  await admin.from("marketing_settings").update({ webhook_last_valid_at: new Date().toISOString() }).eq("singleton_key", "default");
  return NextResponse.json({ received: true, matched: match.kind === "matched", conversationId, messageId: message.data.id });
}

import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { hashApprovedBody, normalizeClaims, outreachApprovalChecks } from "@/lib/marketing/campaign-workflow";
import { getMarketingEmailReadiness, type MarketingSenderSettings } from "@/lib/marketing/email-delivery";
import { renderMarketingEmail } from "@/lib/marketing/email-renderer";
import { normalizeEmail } from "@/lib/marketing/growth-engine";
import { createGrowthEmailProvider } from "@/lib/marketing/growth-email-provider";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const { data, error } = await createAdminClient().from("marketing_outreach_drafts").select("id,prospect_id,campaign_id,creative_id,subject,preview_text,body_text,rationale,status,version,scheduled_at,created_at,marketing_prospects(business_name,public_email,city,state)").order("updated_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: migrationMessage(error.message) }, { status: 503 });
  return NextResponse.json({ drafts: data ?? [] });
}

async function loadApprovalContext(draftId: string) {
  const admin = createAdminClient();
  const draftResult = await admin.from("marketing_outreach_drafts").select("id,prospect_id,campaign_id,creative_id,subject,preview_text,body_text,status,version,marketing_prospects(public_email,suppressed),marketing_outbound_campaigns(feature_id,cta,landing_url,marketing_feature_library(id,approved_claims))").eq("id", draftId).maybeSingle();
  if (draftResult.error || !draftResult.data) return { admin, draft: null, campaign: null, checks: [] as ReturnType<typeof outreachApprovalChecks>, settings: {} as MarketingSenderSettings, readiness: getMarketingEmailReadiness(null) };
  const draft = draftResult.data as Record<string, unknown>;
  const prospect = (Array.isArray(draft.marketing_prospects) ? draft.marketing_prospects[0] : draft.marketing_prospects) as Record<string, unknown> | undefined;
  const campaign = (Array.isArray(draft.marketing_outbound_campaigns) ? draft.marketing_outbound_campaigns[0] : draft.marketing_outbound_campaigns) as Record<string, unknown> | undefined;
  const feature = (Array.isArray(campaign?.marketing_feature_library) ? campaign?.marketing_feature_library[0] : campaign?.marketing_feature_library) as Record<string, unknown> | undefined;
  const settings = await admin.from("marketing_settings").select("email_provider,from_name,from_email,reply_to,business_name,business_address,unsubscribe_base_url").eq("singleton_key", "default").maybeSingle();
  const email = typeof prospect?.public_email === "string" ? normalizeEmail(prospect.public_email) : "";
  const suppression = email ? await admin.from("marketing_outbound_suppressions").select("id").eq("normalized_email", email).maybeSingle() : { data: null };
  const senderSettings = (settings.data ?? {}) as MarketingSenderSettings;
  const readiness = getMarketingEmailReadiness(senderSettings);
  const checks = outreachApprovalChecks({ email, subject: draft.subject as string, bodyText: draft.body_text as string, cta: campaign?.cta as string | null, landingUrl: campaign?.landing_url as string | null, campaignId: draft.campaign_id as string | null, featureId: campaign?.feature_id as string | null, suppressed: Boolean(suppression.data || prospect?.suppressed), senderConfigured: readiness.senderConfigured && readiness.complianceConfigured, claimsApproved: normalizeClaims(feature?.approved_claims).every((claim) => claim.approved) });
  return { admin, draft, campaign, checks, settings: senderSettings, readiness };
}

export async function PATCH(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { draftId?: unknown; action?: unknown } | null;
  if (typeof body?.draftId !== "string" || !["approve", "reject"].includes(String(body.action))) return NextResponse.json({ error: "Draft and approval action are required." }, { status: 400 });
  const context = await loadApprovalContext(body.draftId);
  if (!context.draft) return NextResponse.json({ error: "Outreach draft not found." }, { status: 404 });
  if (body.action === "approve") {
    const failed = context.checks.filter((check) => !check.ok);
    if (failed.length) return NextResponse.json({ error: "Draft approval checks failed.", checks: context.checks }, { status: 409 });
  }
  const status = body.action === "approve" ? "approved" : "rejected";
  const { data, error } = await context.admin.from("marketing_outreach_drafts").update({ status, approved_by: status === "approved" ? actor.user.id : null, approved_at: status === "approved" ? new Date().toISOString() : null, rejected_by: status === "rejected" ? actor.user.id : null, rejected_at: status === "rejected" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", body.draftId).select("id,status,version,approved_at").single();
  if (error) return NextResponse.json({ error: "Outreach draft could not be updated." }, { status: 503 });
  await context.admin.from("marketing_activities").insert({ prospect_id: context.draft.prospect_id, actor_user_id: actor.user.id, activity_type: `outreach_draft_${status}`, body: `Outreach draft ${status}.`, metadata: { draftId: body.draftId, campaignId: context.draft.campaign_id } });
  if (context.draft.campaign_id) await context.admin.from("marketing_campaign_activities").insert({ campaign_id: context.draft.campaign_id, actor_user_id: actor.user.id, activity_type: `draft_${status}`, body: `Outreach draft ${status}.`, metadata: { draftId: body.draftId } });
  return NextResponse.json({ draft: data, checks: context.checks });
}

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { draftId?: unknown; action?: unknown } | null;
  if (!(body?.action === "mock_send" || body?.action === "real_send") || typeof body.draftId !== "string") return NextResponse.json({ error: "A supported send action is required." }, { status: 400 });
  const context = await loadApprovalContext(body.draftId);
  if (!context.draft || context.draft.status !== "approved") return NextResponse.json({ error: "Only approved drafts can enter the mock send queue or real send flow." }, { status: 409 });
  const failed = context.checks.filter((check) => !check.ok && body.action === "mock_send" && check.key !== "sender");
  if (body.action === "real_send" && !context.readiness.ready) return NextResponse.json({ error: "Real sending is blocked by provider readiness.", readiness: context.readiness, checks: context.checks }, { status: 409 });
  if (failed.length || (body.action === "real_send" && context.checks.some((check) => !check.ok))) return NextResponse.json({ error: `${body.action === "real_send" ? "Real" : "Mock"} send checks failed.`, checks: context.checks }, { status: 409 });
  const prospect = (Array.isArray(context.draft.marketing_prospects) ? context.draft.marketing_prospects[0] : context.draft.marketing_prospects) as Record<string, unknown> | undefined;
  const email = typeof prospect?.public_email === "string" ? normalizeEmail(prospect.public_email) : "";
  const version = typeof context.draft.version === "number" ? context.draft.version : 1;
  const idempotencyKey = `${body.action === "real_send" ? "real" : "mock"}:${body.draftId}:v${version}`;
  const bodyHash = hashApprovedBody({ subject: String(context.draft.subject), bodyText: String(context.draft.body_text), creativeId: context.draft.creative_id as string | null, campaignId: context.draft.campaign_id as string | null });
  const existing = await context.admin.from("marketing_outreach_messages").select("id,provider,provider_message_id,status,campaign_id,creative_id,body_hash").eq("idempotency_key", idempotencyKey).maybeSingle();
  if (existing.data) return NextResponse.json({ message: existing.data, idempotent: true, mockOnly: body.action === "mock_send" });
  const provider = body.action === "real_send" ? "resend" : "mock";
  let providerResult: Awaited<ReturnType<ReturnType<typeof createGrowthEmailProvider>["send"]>>;
  try {
    providerResult = await createGrowthEmailProvider({ provider, env: process.env }).send({ idempotencyKey, recipient: email, subject: String(context.draft.subject), previewText: String(context.draft.preview_text ?? ""), bodyHtml: renderMarketingEmail({ subject: String(context.draft.subject), bodyText: String(context.draft.body_text), previewText: context.draft.preview_text as string | null, cta: context.campaign?.cta as string | null, ctaUrl: context.campaign?.landing_url as string | null, fromName: context.settings.from_name, businessName: context.settings.business_name }).html, bodyText: String(context.draft.body_text), from: `${context.settings.from_name} <${context.settings.from_email}>`, replyTo: String(context.settings.reply_to) });
  } catch {
    if (body.action !== "real_send") throw new Error("Mock provider unexpectedly failed.");
    const unknown = await context.admin.from("marketing_outreach_messages").insert({ draft_id: body.draftId, prospect_id: context.draft.prospect_id, normalized_email: email, status: "delivery_unknown", idempotency_key: idempotencyKey, provider, requested_at: new Date().toISOString(), campaign_id: context.draft.campaign_id, creative_id: context.draft.creative_id, placement: "email_hero", approved_version: version, body_hash: bodyHash, subject: String(context.draft.subject), preview_text: String(context.draft.preview_text ?? ""), body_text: String(context.draft.body_text), cta_url: context.campaign?.landing_url as string | null, sender_name: context.settings.from_name, sender_email: context.settings.from_email, reply_to: context.settings.reply_to, failure_reason: "Provider submission outcome is unknown; manual reconciliation is required." }).select("id,status,provider,provider_message_id,campaign_id,creative_id,body_hash").single();
    return NextResponse.json({ error: "Provider submission outcome is unknown; do not retry automatically.", message: unknown.data }, { status: 503 });
  }
  const message = await context.admin.from("marketing_outreach_messages").insert({ draft_id: body.draftId, prospect_id: context.draft.prospect_id, normalized_email: email, status: body.action === "real_send" ? "submitted" : "sent", idempotency_key: idempotencyKey, provider: providerResult.provider, provider_message_id: providerResult.providerMessageId, sent_at: body.action === "mock_send" ? new Date().toISOString() : null, submitted_at: body.action === "real_send" ? new Date().toISOString() : null, requested_at: new Date().toISOString(), campaign_id: context.draft.campaign_id, creative_id: context.draft.creative_id, placement: "email_hero", approved_version: version, body_hash: bodyHash, subject: String(context.draft.subject), preview_text: String(context.draft.preview_text ?? ""), body_html: renderMarketingEmail({ subject: String(context.draft.subject), bodyText: String(context.draft.body_text), previewText: context.draft.preview_text as string | null, cta: context.campaign?.cta as string | null, ctaUrl: context.campaign?.landing_url as string | null, fromName: context.settings.from_name, businessName: context.settings.business_name }).html, body_text: String(context.draft.body_text), cta_url: context.campaign?.landing_url as string | null, sender_name: context.settings.from_name, sender_email: context.settings.from_email, reply_to: context.settings.reply_to }).select("id,provider,provider_message_id,status,campaign_id,creative_id,body_hash").single();
  if (message.error || !message.data) return NextResponse.json({ error: "Email message could not be recorded." }, { status: 503 });
  await context.admin.from("marketing_outreach_drafts").update({ status: body.action === "mock_send" ? "mock_sent" : "sent", updated_at: new Date().toISOString() }).eq("id", body.draftId);
  if (body.action === "mock_send") await context.admin.from("marketing_email_events").upsert({ message_id: message.data.id, provider_event_id: `mock:delivered:${message.data.id}`, event_type: "delivered", metadata: { provider: "mock" } }, { onConflict: "provider_event_id" });
  await context.admin.from("marketing_email_events").upsert({ message_id: message.data.id, provider_event_id: `${provider}:submitted:${message.data.id}`, event_type: body.action === "real_send" ? "submitted" : "sent", metadata: { provider } }, { onConflict: "provider_event_id" });
  await context.admin.from("marketing_activities").insert({ prospect_id: context.draft.prospect_id, actor_user_id: actor.user.id, activity_type: body.action === "real_send" ? "outreach_real_send_requested" : "outreach_mock_sent", body: body.action === "real_send" ? "Submitted an approved outreach message to the configured provider." : "Recorded a mock outreach send; no external email was delivered.", metadata: { messageId: message.data.id, provider, campaignId: context.draft.campaign_id, creativeId: context.draft.creative_id } });
  if (context.draft.campaign_id) await context.admin.from("marketing_campaign_activities").insert({ campaign_id: context.draft.campaign_id, actor_user_id: actor.user.id, activity_type: body.action === "real_send" ? "real_send_submitted" : "mock_send_recorded", body: body.action === "real_send" ? "Submitted an approved outreach message to the configured provider." : "Recorded a mock outreach send; no external email was delivered.", metadata: { draftId: body.draftId, creativeId: context.draft.creative_id } });
  return NextResponse.json({ message: message.data, mockOnly: body.action === "mock_send", idempotencyKey });
}

function migrationMessage(message: string) { return /relation .* does not exist|schema cache/i.test(message) ? "Marketing growth tables are not initialized. Apply the documented staging migration first." : "Outreach data could not be loaded."; }

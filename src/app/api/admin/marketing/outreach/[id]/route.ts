import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { hashApprovedBody, normalizeClaims, outreachApprovalChecks } from "@/lib/marketing/campaign-workflow";
import { type CreativeRenderSpec } from "@/lib/marketing/creative-renderer";
import { getMarketingEmailReadiness } from "@/lib/marketing/email-delivery";
import { renderMarketingEmail } from "@/lib/marketing/email-renderer";
import { normalizeEmail } from "@/lib/marketing/growth-engine";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const { id } = await context.params;
  const admin = createAdminClient();
  const draftResult = await admin.from("marketing_outreach_drafts").select("id,prospect_id,campaign_id,creative_id,subject,preview_text,body_text,rationale,status,version,approved_at,created_at,marketing_prospects(id,business_name,public_email,city,state,suppressed)").eq("id", id).maybeSingle();
  if (draftResult.error || !draftResult.data) return NextResponse.json({ error: "Outreach draft not found." }, { status: 404 });
  const draft = draftResult.data as Record<string, unknown>;
  const prospect = (Array.isArray(draft.marketing_prospects) ? draft.marketing_prospects[0] : draft.marketing_prospects) as Record<string, unknown> | undefined;
  const [campaign, signals, settings, suppression, placement] = await Promise.all([
    draft.campaign_id ? admin.from("marketing_outbound_campaigns").select("id,name,status,feature_id,cta,landing_url,marketing_feature_library(id,name,customer_description,approved_claims)").eq("id", draft.campaign_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    draft.prospect_id ? admin.from("marketing_prospect_signals").select("signal,value,confidence,source_type,source_url").eq("prospect_id", draft.prospect_id).order("captured_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    admin.from("marketing_settings").select("email_provider,from_name,from_email,reply_to,business_name,business_address,unsubscribe_base_url").eq("singleton_key", "default").maybeSingle(),
    typeof prospect?.public_email === "string" ? admin.from("marketing_outbound_suppressions").select("id,reason").eq("normalized_email", normalizeEmail(prospect.public_email)).maybeSingle() : Promise.resolve({ data: null, error: null }),
    draft.campaign_id ? admin.from("marketing_campaign_creatives").select("placement,marketing_creatives(id,name,status,platform,width,height,render_spec,asset_ids)").eq("campaign_id", draft.campaign_id).eq("placement", "email_hero").maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  const feature = ((campaign.data as Record<string, unknown> | null)?.marketing_feature_library ?? null) as Record<string, unknown> | null;
  const claims = normalizeClaims(feature?.approved_claims);
  const creative = ((placement.data as Record<string, unknown> | null)?.marketing_creatives ?? null) as Record<string, unknown> | null;
  const renderSpec = creative?.render_spec && typeof creative.render_spec === "object" ? creative.render_spec as CreativeRenderSpec : null;
  const senderConfigured = Boolean(settings.data?.from_name && settings.data?.from_email && settings.data?.business_address);
  const checks = outreachApprovalChecks({ email: prospect?.public_email as string | null, subject: draft.subject as string, bodyText: draft.body_text as string, cta: campaign.data?.cta as string | null, landingUrl: campaign.data?.landing_url as string | null, campaignId: draft.campaign_id as string | null, featureId: campaign.data?.feature_id as string | null, suppressed: Boolean(suppression.data || prospect?.suppressed), senderConfigured, claimsApproved: true });
  const email = renderMarketingEmail({ subject: String(draft.subject ?? ""), bodyText: String(draft.body_text ?? ""), previewText: draft.preview_text as string | null, cta: String(campaign.data?.cta ?? ""), ctaUrl: campaign.data?.landing_url as string | null, heroRenderSpec: creative?.status === "approved" ? renderSpec : null, fromName: settings.data?.from_name as string | null, businessName: settings.data?.business_name as string | null, unsubscribeUrl: settings.data?.unsubscribe_base_url as string | null });
  return NextResponse.json({ draft: { ...draft, normalizedEmail: typeof prospect?.public_email === "string" ? normalizeEmail(prospect.public_email) : null }, campaign: campaign.data, emailCreative: creative?.status === "approved" ? { ...creative, placement: placement.data?.placement } : null, warning: creative ? creative.status === "approved" ? null : "No approved email creative attached" : "No approved email creative attached", email: { subject: draft.subject, html: email.html, plainText: email.plainText, previewText: draft.preview_text }, personalization: { rationale: draft.rationale ?? [], signals: signals.data ?? [] }, claims, checks, sender: { provider: settings.data?.email_provider ?? "mock", fromConfigured: Boolean(settings.data?.from_name && settings.data?.from_email), replyToConfigured: Boolean(settings.data?.reply_to), addressConfigured: Boolean(settings.data?.business_address), unsubscribeConfigured: Boolean(settings.data?.unsubscribe_base_url) }, readiness: getMarketingEmailReadiness(settings.data), bodyHash: hashApprovedBody({ subject: String(draft.subject ?? ""), bodyText: String(draft.body_text ?? ""), creativeId: creative?.id as string | null, campaignId: draft.campaign_id as string | null }) });
}

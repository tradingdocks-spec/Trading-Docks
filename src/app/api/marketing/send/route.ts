import { NextResponse } from "next/server";

import {
  campaignReadiness,
  evaluateMarketingAudience,
  type CampaignDraft,
  type MarketingContact,
} from "@/lib/marketing/campaigns";
import { createMarketingEmailProvider } from "@/lib/marketing/email-provider";
import { requireApiCapability } from "@/lib/platform/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const capability = await requireApiCapability("crm.manage");
  if (!capability.ok) return capability.response;
  const workspaceId = capability.access.workspaceId;
  if (!workspaceId) return NextResponse.json({ error: "No active workspace is available." }, { status: 400 });

  const body = await request.json().catch(() => null) as { campaign?: CampaignDraft; idempotencyKey?: string } | null;
  const campaign = body?.campaign;
  if (!campaign) return NextResponse.json({ error: "Campaign payload is required." }, { status: 400 });
  if (!body?.idempotencyKey?.trim()) {
    return NextResponse.json({ error: "An idempotency key is required before queueing a campaign." }, { status: 400 });
  }

  const { data, error } = await capability.supabase
    .from("crm_customers")
    .select("id,workspace_id,first_name,last_name,email,tags,marketing_email_consent")
    .eq("workspace_id", workspaceId);
  if (error) {
    return NextResponse.json({ error: "Marketing audience could not be loaded.", message: error.message, code: error.code }, { status: 500 });
  }

  const audience = evaluateMarketingAudience((data ?? []) as MarketingContact[], campaign.audience);
  const readiness = campaignReadiness(campaign, audience);
  if (!readiness.ready) {
    return NextResponse.json({ error: readiness.reasons[0] ?? "Campaign is not ready to send.", reasons: readiness.reasons }, { status: 400 });
  }

  const provider = createMarketingEmailProvider();
  if (!provider.configured) {
    return NextResponse.json({
      error: "Marketing email delivery is not configured for this environment. Configure a server-side provider before queueing campaigns.",
      status: "failed",
      eligible: audience.eligible.length,
      provider: provider.id,
    }, { status: 503 });
  }

  return NextResponse.json({ ok: true, status: "queued", eligible: audience.eligible.length });
}

import { NextResponse } from "next/server";

import { evaluateMarketingAudience, type CampaignDraft, type MarketingContact } from "@/lib/marketing/campaigns";
import { createMarketingEmailProvider } from "@/lib/marketing/email-provider";
import { requireApiCapability } from "@/lib/platform/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const capability = await requireApiCapability("crm.manage");
  if (!capability.ok) return capability.response;
  const workspaceId = capability.access.workspaceId;
  if (!workspaceId) return NextResponse.json({ error: "No active workspace is available." }, { status: 400 });

  const body = await request.json().catch(() => null) as { campaign?: CampaignDraft; testEmail?: string } | null;
  if (!body?.campaign?.subject?.trim() || !body.campaign.content?.trim()) {
    return NextResponse.json({ error: "Subject and email content are required before sending a test." }, { status: 400 });
  }

  const provider = createMarketingEmailProvider();
  if (!provider.configured) {
    return NextResponse.json({
      error: "Marketing email delivery is not configured for this environment.",
      provider: provider.id,
    }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}

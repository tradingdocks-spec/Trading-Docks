import { NextResponse } from "next/server";

import { evaluateMarketingAudience, type MarketingAudienceRule, type MarketingContact } from "@/lib/marketing/campaigns";
import { requireApiCapability } from "@/lib/platform/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const capability = await requireApiCapability("crm.manage");
  if (!capability.ok) return capability.response;
  const workspaceId = capability.access.workspaceId;
  if (!workspaceId) return NextResponse.json({ error: "No active workspace is available." }, { status: 400 });

  const body = await request.json().catch(() => null) as { audience?: MarketingAudienceRule } | null;
  const audience = body?.audience;
  if (!audience || !["all_subscribed", "tagged", "manual"].includes(audience.mode)) {
    return NextResponse.json({ error: "A valid marketing audience is required." }, { status: 400 });
  }

  const { data, error } = await capability.supabase
    .from("crm_customers")
    .select("id,workspace_id,first_name,last_name,email,tags,marketing_email_consent")
    .eq("workspace_id", workspaceId);
  if (error) {
    return NextResponse.json({ error: "Marketing audience could not be loaded.", message: error.message, code: error.code }, { status: 500 });
  }

  const summary = evaluateMarketingAudience((data ?? []) as MarketingContact[], audience);
  return NextResponse.json({
    eligible: summary.eligible.length,
    selected: summary.totalSelected,
    excluded: summary.excluded,
    totalExcluded: summary.totalExcluded,
  });
}

import { NextResponse } from "next/server";

import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const admin = createAdminClient();
  const [features, campaigns, drafts, settings] = await Promise.all([
    admin.from("marketing_feature_library").select("id,slug,name,status,internal_description,customer_description,target_audiences,problems_solved,capabilities,approved_claims,disallowed_claims,proof_points,relevant_cta,landing_url,suggested_angles").eq("status", "active").order("name"),
    admin.from("marketing_outbound_campaigns").select("id,name,status,audience,objective,feature_id,creative_brief,created_at,updated_at,marketing_feature_library(name)").order("updated_at", { ascending: false }).limit(50),
    admin.from("marketing_outreach_drafts").select("id,prospect_id,campaign_id,subject,status,scheduled_at,created_at").order("updated_at", { ascending: false }).limit(100),
    admin.from("marketing_settings").select("email_provider,outbound_enabled,from_name,from_email,reply_to,business_name,business_address,unsubscribe_base_url").eq("singleton_key", "default").maybeSingle(),
  ]);
  const failure = [features, campaigns, drafts, settings].find((result) => result.error);
  if (failure?.error) return NextResponse.json({ error: migrationMessage(failure.error.message) }, { status: 503 });
  return NextResponse.json({
    features: features.data ?? [],
    campaigns: campaigns.data ?? [],
    drafts: drafts.data ?? [],
    settings: settings.data ?? { email_provider: "mock", outbound_enabled: false },
  });
}

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as {
    action?: unknown;
    name?: unknown;
    featureId?: unknown;
    audience?: unknown;
    objective?: unknown;
    cta?: unknown;
    landingUrl?: unknown;
  } | null;
  if (body?.action !== "create_campaign") return NextResponse.json({ error: "A supported marketing action is required." }, { status: 400 });
  if (typeof body.name !== "string" || !body.name.trim() || typeof body.featureId !== "string") return NextResponse.json({ error: "Campaign name and feature are required." }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("marketing_outbound_campaigns").insert({
    name: body.name.trim().slice(0, 160),
    feature_id: body.featureId,
    audience: typeof body.audience === "string" ? body.audience.slice(0, 80) : "local_game_store",
    objective: typeof body.objective === "string" ? body.objective.slice(0, 80) : "awareness",
    cta: typeof body.cta === "string" ? body.cta.slice(0, 160) : "",
    landing_url: typeof body.landingUrl === "string" ? body.landingUrl.slice(0, 500) : null,
    created_by: actor.user.id,
  }).select("id,name,status").single();
  if (error) return NextResponse.json({ error: migrationMessage(error.message) }, { status: 503 });
  return NextResponse.json({ campaign: data }, { status: 201 });
}

function migrationMessage(message: string) {
  return /relation .* does not exist|schema cache/i.test(message)
    ? "Marketing growth tables are not initialized. Apply the documented staging migration first."
    : "Marketing growth data could not be loaded.";
}

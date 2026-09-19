import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { generateCreativeDirections } from "@/lib/marketing/brand-system";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { featureId?: string; objective?: string; audience?: string } | null;
  if (!body?.featureId) return NextResponse.json({ error: "A feature is required." }, { status: 400 });
  const admin = createAdminClient();
  const feature = await admin.from("marketing_feature_library").select("id,name,customer_description,relevant_cta").eq("id", body.featureId).maybeSingle();
  if (feature.error || !feature.data) return NextResponse.json({ error: "Feature not found." }, { status: 404 });
  const concepts = generateCreativeDirections({ featureName: feature.data.name, customerDescription: feature.data.customer_description, cta: feature.data.relevant_cta, objective: body.objective, audience: body.audience });
  return NextResponse.json({ concepts, generatedBy: "deterministic", generatedFor: actor.user.id });
}

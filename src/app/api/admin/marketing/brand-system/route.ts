import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { DEFAULT_MARKETING_BRAND_TOKENS, validateMarketingBrandTokens, type MarketingBrandTokens } from "@/lib/marketing/brand-system";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DEFAULT_COPY_RULES = { voice: ["concise", "confident", "TCG-native", "operator-aware", "understated", "direct"], preferredPhrases: ["Sort the chaos.", "Know what you own. Know where it is."], prohibitedPhrases: ["revolutionize your workflow", "unlock your potential", "game-changing solution"] };
const DEFAULT_LOGO_RULES = { preferredVariants: ["wordmark", "mark"], minimumSizing: "Preserve aspect ratio and clear space.", prohibited: ["stretching", "skewing", "rotation", "unapproved recoloring", "heavy glow"] };

function defaults() {
  return { id: null, brandProfileVersion: 1, tokens: DEFAULT_MARKETING_BRAND_TOKENS, copyRules: DEFAULT_COPY_RULES, logoUsageRules: DEFAULT_LOGO_RULES, personality: ["premium", "modern", "technical", "TCG-native", "confident", "restrained", "operator-aware"], visualRules: { style: "editorial, product-first, restrained", avoid: ["generic SaaS gradients", "fake UI", "random glow"] }, goldStandards: [] };
}

export async function GET() {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const admin = createAdminClient();
  const [rules, gold] = await Promise.all([
    admin.from("marketing_brand_rules").select("id,brand_profile_version,brand_tokens,logo_usage_rules,copy_rules,personality,visual_rules").eq("singleton_key", "default").maybeSingle(),
    admin.from("marketing_creatives").select("id,name,platform,composition_family,concept_direction,render_spec,brand_profile_version,gold_standard,quality_review").eq("gold_standard", true).eq("status", "approved").order("updated_at", { ascending: false }).limit(24),
  ]);
  if (rules.error && !rules.error.message.includes("column")) return NextResponse.json({ error: "Brand System is not initialized. Apply the documented additive migration first." }, { status: 503 });
  const base = defaults();
  const row = (rules.data ?? {}) as Record<string, unknown>;
  return NextResponse.json({ profile: { ...base, id: row.id ?? null, brandProfileVersion: typeof row.brand_profile_version === "number" ? row.brand_profile_version : 1, tokens: row.brand_tokens && typeof row.brand_tokens === "object" ? row.brand_tokens : base.tokens, copyRules: row.copy_rules && typeof row.copy_rules === "object" ? row.copy_rules : base.copyRules, logoUsageRules: row.logo_usage_rules && typeof row.logo_usage_rules === "object" ? row.logo_usage_rules : base.logoUsageRules, personality: Array.isArray(row.personality) ? row.personality : base.personality, visualRules: row.visual_rules && typeof row.visual_rules === "object" ? row.visual_rules : base.visualRules, goldStandards: gold.data ?? [] } });
}

export async function PATCH(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { tokens?: MarketingBrandTokens; copyRules?: Record<string, unknown>; logoUsageRules?: Record<string, unknown>; personality?: string[]; visualRules?: Record<string, unknown> } | null;
  if (!body?.tokens || validateMarketingBrandTokens(body.tokens).length) return NextResponse.json({ error: "Brand tokens contain an invalid color, typography, or spacing value." }, { status: 400 });
  const admin = createAdminClient();
  const current = await admin.from("marketing_brand_rules").select("brand_profile_version").eq("singleton_key", "default").maybeSingle();
  const version = (typeof current.data?.brand_profile_version === "number" ? current.data.brand_profile_version : 1) + 1;
  const saved = await admin.from("marketing_brand_rules").upsert({ singleton_key: "default", brand_profile_version: version, brand_tokens: body.tokens, copy_rules: body.copyRules ?? DEFAULT_COPY_RULES, logo_usage_rules: body.logoUsageRules ?? DEFAULT_LOGO_RULES, personality: body.personality ?? [], visual_rules: body.visualRules ?? {}, updated_by: actor.user.id, updated_at: new Date().toISOString() }, { onConflict: "singleton_key" }).select("id,brand_profile_version,brand_tokens,copy_rules,logo_usage_rules,personality,visual_rules").single();
  if (saved.error || !saved.data) return NextResponse.json({ error: "Brand System could not be saved. Apply the documented additive migration first." }, { status: 503 });
  return NextResponse.json({ profile: saved.data });
}

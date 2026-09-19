import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { getMarketingEmailReadiness, validEmail, validUrl, type MarketingSenderSettings } from "@/lib/marketing/email-delivery";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const fields = ["email_provider", "from_name", "from_email", "reply_to", "business_name", "business_address", "unsubscribe_base_url", "sending_domain", "spf_status", "dkim_status", "dmarc_status", "tracking_domain"] as const;

export async function GET() {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("marketing_settings").select(fields.join(",")).eq("singleton_key", "default").maybeSingle();
  if (error) return NextResponse.json({ error: "Marketing settings could not be loaded." }, { status: 503 });
  return NextResponse.json({ settings: data ?? { email_provider: "mock" }, readiness: getMarketingEmailReadiness(data as MarketingSenderSettings | null) });
}

export async function PATCH(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Settings payload is required." }, { status: 400 });
  if (body.from_email !== undefined && body.from_email !== "" && !validEmail(String(body.from_email))) return NextResponse.json({ error: "From email is invalid." }, { status: 400 });
  if (body.reply_to !== undefined && body.reply_to !== "" && !validEmail(String(body.reply_to))) return NextResponse.json({ error: "Reply-to email is invalid." }, { status: 400 });
  if (body.unsubscribe_base_url !== undefined && body.unsubscribe_base_url !== "" && !validUrl(String(body.unsubscribe_base_url))) return NextResponse.json({ error: "Unsubscribe URL must be a valid URL." }, { status: 400 });
  const updates: Record<string, unknown> = { updated_by: actor.user.id, updated_at: new Date().toISOString() };
  for (const field of fields) if (body[field] !== undefined) updates[field] = typeof body[field] === "string" ? String(body[field]).trim().slice(0, 1000) : body[field];
  if (updates.email_provider && !["mock", "resend"].includes(String(updates.email_provider))) return NextResponse.json({ error: "Unsupported marketing email provider." }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("marketing_settings").update(updates).eq("singleton_key", "default").select(fields.join(",")).single();
  if (error) return NextResponse.json({ error: "Marketing settings could not be saved." }, { status: 503 });
  return NextResponse.json({ settings: data, readiness: getMarketingEmailReadiness(data as MarketingSenderSettings) });
}

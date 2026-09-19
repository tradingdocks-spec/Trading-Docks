import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoverPublicContact } from "@/lib/marketing/contact-discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { prospectId?: unknown } | null;
  if (typeof body?.prospectId !== "string") return NextResponse.json({ error: "Prospect ID is required." }, { status: 400 });
  const admin = createAdminClient();
  const { data: prospect, error: lookupError } = await admin.from("marketing_prospects").select("id,website_url").eq("id", body.prospectId).maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Marketing CRM is not initialized. Apply the documented migration first." }, { status: 503 });
  if (!prospect?.website_url) return NextResponse.json({ error: "This prospect has no public website to inspect." }, { status: 400 });
  try {
    const result = await discoverPublicContact(prospect.website_url);
    if (result.email) {
      await admin.from("marketing_prospects").update({ public_email: result.email, public_email_normalized: result.email, public_email_source_url: result.sourceUrl, public_email_discovered_at: new Date().toISOString(), contact_page_url: result.contactPageUrl }).eq("id", body.prospectId);
      const contact = await admin.from("marketing_prospect_contacts").upsert({ prospect_id: body.prospectId, email: result.email, normalized_email: result.email, contact_type: "general", confidence: "verified", source_url: result.sourceUrl, is_primary: true, updated_at: new Date().toISOString() }, { onConflict: "prospect_id,normalized_email" });
      if (contact.error) return NextResponse.json({ error: "Public contact was found, but the contact record could not be saved." }, { status: 503 });
    } else if (result.contactPageUrl) await admin.from("marketing_prospects").update({ contact_page_url: result.contactPageUrl }).eq("id", body.prospectId);
    await admin.from("marketing_activities").insert({ prospect_id: body.prospectId, actor_user_id: actor.user.id, activity_type: "contact_discovery", body: result.email ? "Found a publicly listed email address." : "No public email found.", metadata: { sourceUrl: result.sourceUrl, pagesVisited: result.pagesVisited } });
    return NextResponse.json({ email: result.email, sourceUrl: result.sourceUrl, contactPageUrl: result.contactPageUrl, message: result.email ? "Public email found." : "No public email found." });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Contact discovery failed." }, { status: 400 }); }
}

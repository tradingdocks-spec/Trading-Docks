import { NextResponse } from "next/server";
import JSZip from "jszip";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { campaignId?: string } | null;
  if (!body?.campaignId) return NextResponse.json({ error: "A campaign is required for Export All." }, { status: 400 });
  const admin = createAdminClient();
  const [campaign, brief] = await Promise.all([
    admin.from("marketing_outbound_campaigns").select("id,name,objective,creative_brief").eq("id", body.campaignId).maybeSingle(),
    admin.from("marketing_creative_briefs").select("brief").eq("campaign_id", body.campaignId).maybeSingle(),
  ]);
  if (campaign.error || !campaign.data || brief.error || !brief.data) return NextResponse.json({ error: "Campaign package could not be loaded for export." }, { status: 404 });
  const packageData = (brief.data.brief ?? campaign.data.creative_brief) as Record<string, unknown>;
  const rendered = Array.isArray(packageData.renderedVariants) ? packageData.renderedVariants.filter((item): item is { filename: string; assetId?: string; previewUrl?: string | null } => Boolean(item && typeof item === "object" && typeof (item as { filename?: unknown }).filename === "string" && (typeof (item as { assetId?: unknown }).assetId === "string" || typeof (item as { previewUrl?: unknown }).previewUrl === "string"))) : [];
  if (!rendered.length) return NextResponse.json({ error: "No rendered creative variants are available for export." }, { status: 409 });
  const zip = new JSZip();
  for (const variant of rendered) {
    let bytes: Buffer | null = null;
    if (variant.assetId) {
      const asset = await admin.from("marketing_assets").select("storage_path").eq("id", variant.assetId).maybeSingle();
      if (!asset.error && asset.data?.storage_path) {
        const downloaded = await admin.storage.from("marketing-assets").download(asset.data.storage_path);
        if (!downloaded.error && downloaded.data) bytes = Buffer.from(await downloaded.data.arrayBuffer());
      }
    }
    if (!bytes && variant.previewUrl) {
      const response = await fetch(variant.previewUrl);
      if (response.ok) bytes = Buffer.from(await response.arrayBuffer());
    }
    if (!bytes) return NextResponse.json({ error: "A rendered creative could not be downloaded for export." }, { status: 503 });
    zip.file(variant.filename, bytes);
  }
  const copy = typeof packageData.copy === "object" && packageData.copy ? packageData.copy as Record<string, unknown> : {};
  zip.file("campaign-copy.md", [`# ${campaign.data.name}`, "", `Objective: ${campaign.data.objective}`, "", `## Headline\n${String(copy.primaryHeadline ?? "")}`, "", `## Supporting line\n${String(copy.supportingLine ?? "")}`, "", `## CTA\n${String(copy.cta ?? "")}`, "", `## Instagram caption\n${String(copy.instagramCaption ?? "")}`, "", `## Email subject\n${String(copy.emailSubject ?? "")}`, "", `## Email body\n${String(copy.emailBody ?? "")}`].join("\n"));
  zip.file("campaign-metadata.json", JSON.stringify({ campaign: campaign.data, package: packageData, exportedBy: actor.user.id }, null, 2));
  const output = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const slug = campaign.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new NextResponse(output as unknown as BodyInit, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${slug}-${campaign.data.objective}-campaign.zip"`, "Cache-Control": "no-store" } });
}

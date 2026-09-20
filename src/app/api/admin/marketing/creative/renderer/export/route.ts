import { NextResponse } from "next/server";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { buildRenderSpec, renderCreativeSvg, validateRenderSpec, type CreativeRenderSpec } from "@/lib/marketing/creative-renderer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { format?: string; spec?: Partial<CreativeRenderSpec> } | null;
  if (!body?.spec || typeof body.spec.featureName !== "string" || typeof body.spec.headline !== "string" || typeof body.spec.subheadline !== "string" || typeof body.spec.cta !== "string") return NextResponse.json({ error: "A complete render specification is required." }, { status: 400 });
  const spec = buildRenderSpec(body.spec as Partial<CreativeRenderSpec> & Pick<CreativeRenderSpec, "featureName" | "headline" | "subheadline" | "cta">);
  const validationIssues = validateRenderSpec(spec);
  if (validationIssues.includes("product_screenshot_unavailable")) return NextResponse.json({ error: `Add an approved ${spec.featureName} product screenshot before exporting this creative.` }, { status: 409 });
  if (validationIssues.length) return NextResponse.json({ error: `Export blocked: ${validationIssues.join(", ")}.` }, { status: 409 });
  if (spec.logoAssetUrl === "/Brand/trading-docks-horizontal.png") {
    const logo = await readFile("public/Brand/trading-docks-horizontal.png");
    spec.logoAssetUrl = `data:image/png;base64,${logo.toString("base64")}`;
  }
  const format = body.format === "jpeg" ? "jpeg" : "png";
  const output = await sharp(Buffer.from(renderCreativeSvg(spec))).resize(spec.width, spec.height).toFormat(format, format === "jpeg" ? { quality: 92 } : undefined).toBuffer();
  return new NextResponse(output as unknown as BodyInit, { headers: { "Content-Type": `image/${format}`, "Content-Disposition": `attachment; filename="trading-docks-${spec.featureName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${spec.platform}-${spec.width}x${spec.height}-v1.${format}"`, "Cache-Control": "no-store" } });
}

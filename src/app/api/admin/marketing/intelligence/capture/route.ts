import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { validateCanonicalCaptureRequest } from "@/lib/marketing/canonical-capture";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  try {
    const capture = validateCanonicalCaptureRequest(body ?? {});
    return NextResponse.json({ error: "A repository-compatible browser capture runner is required before storing a canonical PNG.", capture, storageSource: "marketing-assets", metadataSource: "canonical_product_capture" }, { status: 503 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid canonical capture request." }, { status: 400 });
  }
}

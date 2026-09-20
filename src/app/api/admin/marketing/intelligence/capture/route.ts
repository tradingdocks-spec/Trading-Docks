import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { validateCanonicalCaptureRequest } from "@/lib/marketing/canonical-capture";
import { captureCanonicalPage } from "@/lib/marketing/canonical-capture-runner";
import { registerCanonicalCapture, resolveCanonicalFeatureId } from "@/lib/marketing/canonical-capture-registration";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  try {
    const capture = validateCanonicalCaptureRequest(body ?? {});
    const baseUrl = process.env.MARKETING_CAPTURE_BASE_URL;
    if (!baseUrl) return NextResponse.json({ error: "Canonical capture requires MARKETING_CAPTURE_BASE_URL before a browser capture can run.", capture, storageSource: "marketing-assets", metadataSource: "canonical_product_capture" }, { status: 503 });
    const featureId = await resolveCanonicalFeatureId(capture.feature);
    if (!featureId) return NextResponse.json({ error: "The canonical capture feature is not initialized." }, { status: 503 });
    const captured = await captureCanonicalPage(capture, { baseUrl, featureId, storageState: process.env.MARKETING_CAPTURE_STORAGE_STATE });
    const asset = await registerCanonicalCapture(captured.metadata, captured.png);
    return NextResponse.json({ asset, capture: captured.metadata, storageSource: "marketing-assets", metadataSource: "canonical_product_capture" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid canonical capture request." }, { status: 400 });
  }
}

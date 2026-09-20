import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { validateCanonicalCaptureRequest } from "@/lib/marketing/canonical-capture";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  let browserRuntime: { status: "ready" | "unavailable"; kind?: "local" | "vercel" } = { status: "unavailable" };
  try {
    const { resolveCanonicalBrowserRuntime } = await import("@/lib/marketing/canonical-capture-runtime");
    const runtime = await resolveCanonicalBrowserRuntime();
    browserRuntime = { status: "ready", kind: runtime.kind };
  } catch {
    // Health output intentionally reports only readiness, never runtime or secret details.
  }

  let syntheticRoute = "ready";
  try {
    validateCanonicalCaptureRequest({ feature: "chaos-sort", state: "primary" });
  } catch {
    syntheticRoute = "unavailable";
  }

  return NextResponse.json({
    signedAuth: process.env.MARKETING_CAPTURE_SECRET ? "configured" : "missing",
    captureBaseUrl: process.env.MARKETING_CAPTURE_BASE_URL ? "configured" : "missing",
    syntheticRoute,
    browserRuntime,
  }, { headers: { "Cache-Control": "no-store" } });
}

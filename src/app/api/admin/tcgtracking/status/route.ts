import { NextResponse } from "next/server";

import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { loadTcgTrackingProviderHealth } from "@/lib/providers/tcgtracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireAdminActor();
  if (!actor) {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  }

  const health = await loadTcgTrackingProviderHealth();
  return NextResponse.json(health, {
    status: health.status === "available" ? 200 : 502,
  });
}

async function requireAdminActor() {
  try {
    return await requireServerPlatformRole("admin");
  } catch {
    return null;
  }
}

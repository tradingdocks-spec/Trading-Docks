import { NextResponse } from "next/server";
import { getEffectivePlan } from "@/lib/effective-plan";
import { hasPlanAccess } from "@/lib/tier-access";

async function requireFeatureAccess() {
  if (!hasPlanAccess(await getEffectivePlan(), "card-shows")) {
    return NextResponse.json(
      { error: "Card Shows requires a higher Trading Docks plan." },
      { status: 403 },
    );
  }
  return null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const accessDenied = await requireFeatureAccess();
  if (accessDenied) return accessDenied;
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const apiKey = process.env.JUSTTCG_API_KEY?.trim() ?? "";

  return NextResponse.json(
    {
      configured: Boolean(apiKey),
      keyFormatValid: apiKey.startsWith("tcg_") && apiKey.length > 8,
      runtime: "server",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

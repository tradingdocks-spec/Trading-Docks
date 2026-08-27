import { NextRequest, NextResponse } from "next/server";
import { searchCards } from "@/lib/card-intelligence";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ candidates: [], selectedPrintingId: null, requiresConfirmation: true, providers: [] });
  const result = await searchCards({
    game: (request.nextUrl.searchParams.get("game") ?? "magic") as "magic" | "pokemon" | "unknown",
    cardName: query,
    setCode: request.nextUrl.searchParams.get("set"),
    collectorNumber: request.nextUrl.searchParams.get("collectorNumber"),
    language: request.nextUrl.searchParams.get("language"),
  }, { limit: Math.min(Number(request.nextUrl.searchParams.get("limit")) || 12, 25), signal: request.signal });
  return NextResponse.json(result, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } });
}

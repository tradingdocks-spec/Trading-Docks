import { NextResponse } from "next/server";

import { logCardSightConfig, readCardSightConfigProbe } from "@/lib/card-intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  logCardSightConfig("/api/scanner/cardsight/config");
  const config = readCardSightConfigProbe();

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({
    cardsightConfigured: config.cardsightConfigured,
    cardsightBaseUrl: config.cardsightBaseUrl,
    keyPresent: config.keyPresent,
  }, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

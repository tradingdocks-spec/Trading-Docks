import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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

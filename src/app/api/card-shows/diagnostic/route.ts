import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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

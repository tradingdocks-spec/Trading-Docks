import { NextResponse } from "next/server";
import { requireApiCapability } from "@/lib/platform/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }
  const capability = await requireApiCapability("buying.manage");
  if (!capability.ok) return capability.response;

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

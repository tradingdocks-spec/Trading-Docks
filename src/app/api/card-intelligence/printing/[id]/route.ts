import { NextResponse } from "next/server";
import { getPrinting } from "@/lib/card-intelligence";

export const revalidate = 300;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const printing = await getPrinting(id);
  return printing
    ? NextResponse.json(printing, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } })
    : NextResponse.json({ error: "Printing not found." }, { status: 404 });
}

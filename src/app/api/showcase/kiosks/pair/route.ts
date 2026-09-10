import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SHOWCASE_KIOSK_COOKIE } from "@/lib/showcase-kiosk";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { action?: string; code?: string; name?: string } | null;
  if (body?.action !== "consume") {
    return NextResponse.json({ error: "Pairing code consumption requires action=consume." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_showcase_pairing_code", {
    input_code: body.code ?? "",
    device_name: body.name ?? "Front Counter",
  });
  if (error || !data?.token) {
    return NextResponse.json({ error: "Pairing code is invalid or expired." }, { status: 400 });
  }

  const response = NextResponse.json({ paired: true });
  response.cookies.set(SHOWCASE_KIOSK_COOKIE, String(data.token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SHOWCASE_KIOSK_COOKIE } from "@/lib/showcase-kiosk";

type DatabaseError = { code?: string; message?: string; details?: string; hint?: string };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { action?: string; code?: string; name?: string } | null;
  if (body?.action !== "consume") {
    return NextResponse.json({ error: "Pairing code consumption requires action=consume." }, { status: 400 });
  }

  const supabase = await createClient();
  const normalizedCode = body.code ? String(body.code).replace(/[^0-9]/g, "") : "";
  const { data, error } = await supabase.rpc("consume_showcase_pairing_code", {
    input_code: normalizedCode,
    device_name: body.name ?? "Front Counter",
  });
  if (error || !data?.token) {
    const databaseError = error as DatabaseError | null;
    console.error("Showcase kiosk pairing consume failed", {
      operation: "consume_pairing_code",
      rpc: "consume_showcase_pairing_code",
      normalizedCodeLength: normalizedCode.length,
      code: databaseError?.code,
      message: databaseError?.message,
      details: databaseError?.details,
      hint: databaseError?.hint,
      returnedToken: Boolean(data?.token),
    });
    const errorCode = databaseError?.code;
    if (errorCode === "42883") {
      return NextResponse.json({ error: "PAIRING_CODE_CONSUME_FAILED", message: "Kiosk pairing database function is out of date." }, { status: 503 });
    }
    if (errorCode === "P0003") return NextResponse.json({ error: "PAIRING_CODE_EXPIRED", message: "Pairing code is invalid or expired." }, { status: 400 });
    if (errorCode === "P0004") return NextResponse.json({ error: "PAIRING_CODE_ALREADY_USED", message: "Pairing code is invalid or expired." }, { status: 400 });
    return NextResponse.json({ error: "PAIRING_CODE_INVALID_OR_EXPIRED", message: "Pairing code is invalid or expired." }, { status: 400 });
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

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidatedKioskContext } from "@/lib/showcase-kiosk";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.slug !== "string" || typeof body.customerName !== "string" || !Array.isArray(body.items)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const supabase = await createClient();
  const kiosk = await getValidatedKioskContext();
  const slug = kiosk?.showcase_slug ?? body.slug;
  const { data, error } = await supabase.rpc("submit_showcase_request", { requested_slug: slug, customer_name: body.customerName, customer_phone: typeof body.customerPhone === "string" ? body.customerPhone : null, customer_email: typeof body.customerEmail === "string" ? body.customerEmail : null, customer_note: typeof body.customerNote === "string" ? body.customerNote : null, requested_items: body.items });
  if (error) return NextResponse.json({ error: error.code === "P0001" ? error.message : "We could not submit that request. Please try again." }, { status: error.code === "P0001" ? 409 : 400 });
  if (kiosk) await supabase.from("showcase_requests").update({ source: "kiosk", kiosk_device_id: kiosk.device_id }).eq("id", data).eq("workspace_id", kiosk.workspace_id);
  return NextResponse.json({ requestId: data });
}

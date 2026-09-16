import { NextResponse } from "next/server";
import { getShowcase } from "@/lib/showcase";
import { getValidatedKioskContext, SHOWCASE_KIOSK_COOKIE } from "@/lib/showcase-kiosk";

export async function GET(request: Request) {
  const context = await getValidatedKioskContext();
  if (!context) { const response = NextResponse.json({ error: "Kiosk session is invalid or revoked." }, { status: 401 }); response.cookies.delete(SHOWCASE_KIOSK_COOKIE); return response; }
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const showcase = await getShowcase(context.showcase_slug, query);
  if (!showcase) return NextResponse.json({ error: "Showcase is unavailable." }, { status: 404 });
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  await supabase.from("showcase_kiosk_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", context.device_id).eq("workspace_id", context.workspace_id);
  return NextResponse.json({ ...showcase, kiosk: context });
}

export async function DELETE() { const response = NextResponse.json({ ok: true }); response.cookies.delete(SHOWCASE_KIOSK_COOKIE); return response; }

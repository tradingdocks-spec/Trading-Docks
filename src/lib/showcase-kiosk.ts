import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const SHOWCASE_KIOSK_COOKIE = "td_showcase_kiosk";
export type KioskContext = { device_id: string; workspace_id: string; showcase_slug: string };

export async function getValidatedKioskContext(): Promise<KioskContext | null> {
  const token = (await cookies()).get(SHOWCASE_KIOSK_COOKIE)?.value;
  if (!token) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_kiosk_context", { input_token: token });
  if (error || !Array.isArray(data) || !data[0]) return null;
  return data[0] as KioskContext;
}

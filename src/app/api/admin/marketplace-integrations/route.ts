import { NextResponse } from "next/server";

import { encryptMarketplaceCredentials } from "@/lib/marketplaces/credentials";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const OWNER_EMAIL = "tradingdocks@gmail.com";

function mask(value: string) {
  return value.length <= 4 ? "••••" : `••••${value.slice(-4)}`;
}

async function ownerClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email?.trim().toLowerCase() !== OWNER_EMAIL) return null;
  return { supabase, user };
}

export async function GET() {
  const owner = await ownerClient();
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const { data, error } = await owner.supabase
    .from("platform_marketplace_integrations")
    .select("marketplace_id,credential_labels,enabled,updated_at")
    .order("marketplace_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ integrations: data ?? [] });
}

export async function POST(request: Request) {
  const owner = await ownerClient();
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as {
    marketplaceId?: string;
    credentials?: Record<string, string>;
    enabled?: boolean;
  } | null;
  if (body?.marketplaceId !== "ebay" || !body.credentials) {
    return NextResponse.json({ error: "Invalid integration configuration." }, { status: 400 });
  }
  const credentials = Object.fromEntries(
    Object.entries(body.credentials).map(([key, value]) => [key, String(value).trim()]),
  );
  if (!credentials.clientId || !credentials.clientSecret || !credentials.ruName) {
    return NextResponse.json({ error: "Client ID, Client Secret, and RuName are required." }, { status: 400 });
  }
  credentials.environment = credentials.environment === "sandbox" ? "sandbox" : "production";
  try {
    const encrypted = encryptMarketplaceCredentials(credentials);
    const labels = Object.fromEntries(
      Object.entries(credentials).map(([key, value]) => [key, mask(value)]),
    );
    const { error } = await owner.supabase.from("platform_marketplace_integrations").upsert({
      marketplace_id: "ebay",
      ...encrypted,
      credential_labels: labels,
      enabled: body.enabled !== false,
      configured_by: owner.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "marketplace_id" });
    if (error) throw error;
    await owner.supabase.from("admin_audit_log").insert({
      actor_id: owner.user.id,
      action: "marketplace.integration.updated",
      target_type: "marketplace",
      target_id: "ebay",
      details: { enabled: body.enabled !== false, environment: credentials.environment },
    });
    return NextResponse.json({ ok: true, masked: labels, enabled: body.enabled !== false });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not save integration.",
    }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const owner = await ownerClient();
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { marketplaceId?: string; enabled?: boolean } | null;
  if (body?.marketplaceId !== "ebay" || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid integration update." }, { status: 400 });
  }
  const { error } = await owner.supabase.from("platform_marketplace_integrations")
    .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
    .eq("marketplace_id", "ebay");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

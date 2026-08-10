import { NextResponse } from "next/server";

import { encryptMarketplaceCredentials } from "@/lib/marketplaces/credentials";
import { requireApiCapability } from "@/lib/platform/server-access";

export const runtime = "nodejs";

const ALLOWED_MARKETPLACES = new Set([
  "amazon",
  "cardtrader",
  "ebay",
  "etsy",
  "mana-pool",
  "shopify",
  "tcgplayer",
  "woocommerce",
]);

function maskedLabel(value: string) {
  if (value.length <= 4) return "****";
  return `****${value.slice(-4)}`;
}

export async function POST(request: Request) {
  const capability = await requireApiCapability("marketplaces.manage");
  if (!capability.ok) return capability.response;
  const { supabase } = capability;
  const user = capability.user!;

  const body = (await request.json().catch(() => null)) as {
    marketplaceId?: unknown;
    credentials?: unknown;
  } | null;
  if (
    !body ||
    typeof body.marketplaceId !== "string" ||
    !ALLOWED_MARKETPLACES.has(body.marketplaceId) ||
    !body.credentials ||
    typeof body.credentials !== "object" ||
    Array.isArray(body.credentials)
  ) {
    return NextResponse.json({ error: "Invalid marketplace credentials." }, { status: 400 });
  }

  const credentials: Record<string, string> = {};
  for (const [key, value] of Object.entries(body.credentials)) {
    if (!/^[a-zA-Z][a-zA-Z0-9]{0,39}$/.test(key) || typeof value !== "string") {
      return NextResponse.json({ error: "Invalid credential field." }, { status: 400 });
    }
    const clean = value.trim();
    if (!clean || clean.length > 4096) {
      return NextResponse.json({ error: "Every credential field is required." }, { status: 400 });
    }
    credentials[key] = clean;
  }
  if (!Object.keys(credentials).length || Object.keys(credentials).length > 12) {
    return NextResponse.json({ error: "Invalid credential field count." }, { status: 400 });
  }

  try {
    const encrypted = encryptMarketplaceCredentials(credentials);
    const labels = Object.fromEntries(
      Object.entries(credentials).map(([key, value]) => [key, maskedLabel(value)]),
    );
    const { error } = await supabase.from("marketplace_credentials").upsert(
      {
        user_id: user.id,
        marketplace_id: body.marketplaceId,
        ...encrypted,
        credential_labels: labels,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,marketplace_id" },
    );
    if (error) throw error;

    const connectionResult = await supabase.from("marketplace_connections").upsert(
      {
        user_id: user.id,
        marketplace_id: body.marketplaceId,
        connection_method: "api",
        status: body.marketplaceId === "mana-pool" ? "ready" : "setup_required",
        settings: { credentials_saved: true },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,marketplace_id" },
    );
    if (connectionResult.error) throw connectionResult.error;

    return NextResponse.json({
      ok: true,
      masked: labels,
      lastFour:
        body.marketplaceId === "mana-pool"
          ? credentials.apiToken?.slice(-4) ?? null
          : null,
      status:
        body.marketplaceId === "mana-pool" ? "ready" : "setup_required",
      connected: body.marketplaceId === "mana-pool",
      requiresAdminActivation: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save credentials.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const capability = await requireApiCapability("marketplaces.manage");
  if (!capability.ok) return capability.response;
  const { supabase } = capability;
  const user = capability.user!;

  const marketplaceId = new URL(request.url).searchParams.get("marketplaceId");
  if (!marketplaceId || !ALLOWED_MARKETPLACES.has(marketplaceId)) {
    return NextResponse.json({ error: "Invalid marketplace." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("marketplace_credentials")
    .select("credential_labels,updated_at")
    .eq("user_id", user.id)
    .eq("marketplace_id", marketplaceId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const masked = (data?.credential_labels ?? {}) as Record<string, string>;

  return NextResponse.json({
    saved: Boolean(data),
    masked,
    updatedAt: data?.updated_at ?? null,
    lastFour:
      marketplaceId === "mana-pool"
        ? masked.apiToken?.slice(-4) ?? null
        : null,
  });
}

export async function DELETE(request: Request) {
  const capability = await requireApiCapability("marketplaces.manage");
  if (!capability.ok) return capability.response;
  const { supabase } = capability;
  const user = capability.user!;

  const marketplaceId = new URL(request.url).searchParams.get("marketplaceId");
  if (!marketplaceId || !ALLOWED_MARKETPLACES.has(marketplaceId)) {
    return NextResponse.json({ error: "Invalid marketplace." }, { status: 400 });
  }
  const { error } = await supabase
    .from("marketplace_credentials")
    .delete()
    .eq("user_id", user.id)
    .eq("marketplace_id", marketplaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

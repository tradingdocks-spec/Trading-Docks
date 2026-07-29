import { NextResponse } from "next/server";

import { encryptMarketplaceCredentials } from "@/lib/marketplaces/credentials";
import { createAdminClient } from "@/lib/supabase/admin";
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
  return { user };
}

function databaseError(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const details = error as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    const parts = [details.message, details.details, details.hint]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (parts.length > 0) {
      const code = typeof details.code === "string" ? ` (${details.code})` : "";
      return `${parts.join(" ")}${code}`;
    }
  }
  return error instanceof Error ? error.message : fallback;
}

function adminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing from the deployed server environment.",
    );
  }
  return createAdminClient();
}

function serverConfigurationError() {
  const missing = [
    ["NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL],
    ["SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY],
    ["MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY", process.env.MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY],
  ].filter(([, value]) => !value);
  if (missing.length > 0) {
    return `Missing deployed server variable${missing.length === 1 ? "" : "s"}: ${missing
      .map(([name]) => name)
      .join(", ")}. Add ${missing.length === 1 ? "it" : "them"} in Vercel and redeploy.`;
  }
  if ((process.env.MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY?.length ?? 0) < 32) {
    return "MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY must contain at least 32 characters.";
  }
  return null;
}

export async function GET() {
  const owner = await ownerClient();
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  try {
    const { data, error } = await adminClient()
      .from("platform_marketplace_integrations")
      .select("marketplace_id,credential_labels,enabled,updated_at")
      .order("marketplace_id");
    if (error) throw error;
    return NextResponse.json({ integrations: data ?? [] });
  } catch (error) {
    return NextResponse.json({
      error: databaseError(error, "Could not load marketplace integrations."),
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const owner = await ownerClient();
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const configurationError = serverConfigurationError();
  if (configurationError) {
    return NextResponse.json({ error: configurationError }, { status: 503 });
  }
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
    const admin = adminClient();
    const { data, error } = await admin.from("platform_marketplace_integrations").upsert({
      marketplace_id: "ebay",
      ...encrypted,
      credential_labels: labels,
      enabled: body.enabled !== false,
      configured_by: owner.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "marketplace_id" }).select("marketplace_id").single();
    if (error) throw error;
    if (!data) throw new Error("Supabase did not confirm the saved integration.");

    // Audit history is useful, but an older deployment may not have this
    // optional table yet. A missing audit table must not undo a valid save.
    await admin.from("admin_audit_log").insert({
      actor_id: owner.user.id,
      action: "marketplace.integration.updated",
      target_type: "marketplace",
      target_id: "ebay",
      details: { enabled: body.enabled !== false, environment: credentials.environment },
    });
    return NextResponse.json({ ok: true, masked: labels, enabled: body.enabled !== false });
  } catch (error) {
    const message = databaseError(error, "Could not save integration.");
    const migrationHint = /platform_marketplace_integrations|relation .* does not exist|PGRST205/i
      .test(message)
      ? " Run supabase/migrations/202607290004_platform_marketplace_integrations_server_only.sql, then try again."
      : "";
    return NextResponse.json({
      error: `${message}${migrationHint}`,
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
  try {
    const { data, error } = await adminClient()
      .from("platform_marketplace_integrations")
      .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
      .eq("marketplace_id", "ebay")
      .select("marketplace_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "The eBay integration has not been configured yet." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({
      error: databaseError(error, "Could not update the marketplace integration."),
    }, { status: 500 });
  }
}

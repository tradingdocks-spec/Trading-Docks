import {
  createDecipheriv,
  createHash,
} from "node:crypto";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function encryptionKey() {
  const secret = process.env.MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("Marketplace credential encryption is not configured.");
  }
  return createHash("sha256").update(secret).digest();
}

function decryptCredential(row: {
  encrypted_payload: string;
  iv: string;
  auth_tag: string;
}) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(row.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(row.encrypted_payload, "base64")),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(decrypted) as Record<string, string>;
}

async function importJson(
  url: string | undefined,
  apiKey: string,
  label: string,
) {
  if (!url) {
    return {
      count: 0,
      configured: false,
      label,
    };
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-API-Key": apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `${label} import failed with Mana Pool status ${response.status}.`,
    );
  }

  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.results)
        ? payload.results
        : [];

  return {
    count: rows.length,
    configured: true,
    label,
  };
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { data: credential, error: credentialError } = await supabase
    .from("marketplace_credentials")
    .select("encrypted_payload,iv,auth_tag")
    .eq("user_id", user.id)
    .eq("marketplace_id", "mana-pool")
    .maybeSingle();

  if (credentialError) {
    return NextResponse.json(
      { error: "Could not read the saved Mana Pool credential." },
      { status: 500 },
    );
  }

  if (!credential) {
    return NextResponse.json(
      { error: "Save your Mana Pool API key before importing." },
      { status: 409 },
    );
  }

  try {
    const credentials = decryptCredential(credential);
    const apiKey = credentials.apiToken;

    if (!apiKey) {
      return NextResponse.json(
        { error: "The saved Mana Pool credential is incomplete." },
        { status: 409 },
      );
    }

    const inventoryUrl = process.env.MANAPOOL_INVENTORY_IMPORT_URL;
    const ordersUrl = process.env.MANAPOOL_ORDERS_IMPORT_URL;
    const pricingUrl = process.env.MANAPOOL_PRICING_IMPORT_URL;

    if (!inventoryUrl && !ordersUrl && !pricingUrl) {
      return NextResponse.json(
        {
          error:
            "Mana Pool import endpoints are not configured yet. Add the official Mana Pool inventory, orders, or pricing endpoint URLs in Vercel before running the first import.",
        },
        { status: 503 },
      );
    }

    const [inventory, orders, pricing] = await Promise.all([
      importJson(inventoryUrl, apiKey, "Inventory"),
      importJson(ordersUrl, apiKey, "Orders"),
      importJson(pricingUrl, apiKey, "Pricing"),
    ]);

    const now = new Date().toISOString();

    const { error: connectionError } = await supabase
      .from("marketplace_connections")
      .upsert(
        {
          user_id: user.id,
          marketplace_id: "mana-pool",
          connection_method: "api",
          status: "ready",
          settings: {
            credentials_saved: true,
            import_summary: {
              inventory: inventory.count,
              orders: orders.count,
              pricing: pricing.count,
            },
          },
          last_sync_at: now,
          updated_at: now,
        },
        { onConflict: "user_id,marketplace_id" },
      );

    if (connectionError) {
      throw connectionError;
    }

    return NextResponse.json({
      importedInventory: inventory.count,
      importedOrders: orders.count,
      importedPricing: pricing.count,
      message: `Mana Pool import complete: ${inventory.count} inventory rows, ${orders.count} orders, and ${pricing.count} pricing rows received.`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mana Pool import failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

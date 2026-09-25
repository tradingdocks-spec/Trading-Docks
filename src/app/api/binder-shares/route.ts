import { availableMoney, trustedInventoryValue } from "@/lib/intelligence-provenance";
import { NextResponse } from "next/server";

import {
  type SafeSharedCard,
  safeFiniteNumber,
  safeImageUrl,
  safeNullableText,
  safePositiveInteger,
  sanitizeLegacyBinderPayload,
  safeText,
} from "@/lib/public-share-security";
import { requireApiCapability } from "@/lib/platform/server-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type BinderShareRequest = {
  title?: string;
  mode?: "showcase" | "trade";
  inventoryItemIds?: string[];
  payload?: Record<string, unknown>;
  expiresAt?: string | null;
};

export async function POST(request: Request) {
  const capability = await requireApiCapability("binder.manage");
  if (!capability.ok) return capability.response;
  const { supabase, user } = capability;
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as BinderShareRequest | null;
  const title = safeText(body?.title, 120);
  const mode = body?.mode === "trade" ? "trade" : "showcase";
  const inventoryItemIds = normalizeInventoryItemIds(body?.inventoryItemIds);

  if (!title || inventoryItemIds.length === 0) {
    return NextResponse.json(
      { error: "Binder title and at least one owned inventory record are required." },
      { status: 400 },
    );
  }

  let expiresAt: string | null = null;
  if (body?.expiresAt) {
    const date = new Date(body.expiresAt);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "Expiration must be a valid future date." },
        { status: 400 },
      );
    }
    expiresAt = date.toISOString();
  }

  const payload = await buildOwnedBinderSharePayload(supabase, user.id, inventoryItemIds);
  if (!payload.ok) {
    return NextResponse.json(
      { error: payload.error },
      { status: payload.status },
    );
  }

  const token = crypto.randomUUID().replaceAll("-", "");
  const admin = createAdminClient();
  const { error } = await admin.from("binder_shares").insert({
    token,
    owner_id: user.id,
    title,
    mode,
    payload: payload.payload,
    expires_at: expiresAt,
    is_active: true,
    revoked_at: null,
    allow_interested_lists: mode === "trade",
    require_account_for_actions: true,
    noindex: true,
  });

  if (error) {
    return NextResponse.json(
      {
        error: error.message.includes("binder_shares")
          ? "Run the public share security migration first."
          : "The binder share could not be created.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url: `${new URL(request.url).origin}/share/binder/${token}`,
  });
}

export async function DELETE(request: Request) {
  const capability = await requireApiCapability("binder.manage");
  if (!capability.ok) return capability.response;
  const { user } = capability;
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = safeText(body?.token, 80);
  if (!token) {
    return NextResponse.json(
      { error: "Share token is required." },
      { status: 400 },
    );
  }

  const { data, error } = await createAdminClient()
    .from("binder_shares")
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq("owner_id", user.id)
    .eq("token", token)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "The binder share could not be revoked." },
      { status: 500 },
    );
  }
  if (!data) return NextResponse.json({ error: "Binder share not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

function normalizeInventoryItemIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter((id) => id.length > 0 && id.length <= 160),
    ),
  ].slice(0, 2500);
}

async function buildOwnedBinderSharePayload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  inventoryItemIds: string[],
) {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id,card_name,set_code,collector_number,quantity,inventory_value,data")
    .eq("user_id", userId)
    .in("id", inventoryItemIds);

  if (error) {
    return { ok: false as const, status: 500, error: "Owned inventory could not be verified." };
  }

  const rows = data ?? [];
  if (rows.length !== inventoryItemIds.length) {
    return {
      ok: false as const,
      status: 403,
      error: "Every shared card must belong to your inventory.",
    };
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  const cards = inventoryItemIds
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .map(rowToSharedCard)
    .filter((card): card is SafeSharedCard => Boolean(card));

  const payload = sanitizeLegacyBinderPayload({
    cards,
    totalValue: cards.reduce((sum, card) => sum + (card.value ?? 0) * card.quantity, 0),
    totalCards: cards.reduce((sum, card) => sum + card.quantity, 0),
    occupied: cards.length,
  });

  if (payload.cards.length === 0) {
    return {
      ok: false as const,
      status: 400,
      error: "At least one owned inventory record must be shareable.",
    };
  }

  return { ok: true as const, payload };
}

function rowToSharedCard(row: {
  card_name?: string | null;
  set_code?: string | null;
  quantity?: number | null;
  inventory_value?: number | null;
  data?: unknown;
}): SafeSharedCard | null {
  const data = isRecord(row.data) ? row.data : {};
  const quantity = safePositiveInteger(data.quantity ?? row.quantity, 1, 10_000);
  const inventoryValue = trustedInventoryValue(row);
  const unitValue =
    availableMoney(data.unitMarketValue) ??
    (quantity > 0 && inventoryValue !== null ? inventoryValue / quantity : null);
  const name = safeText(data.name ?? row.card_name, 180);
  if (!name) return null;

  return {
    name,
    imageUrl: safeImageUrl(data.imageUrl),
    value: unitValue === null || unitValue === undefined
      ? null
      : safeFiniteNumber(unitValue, 0, 0, 10_000_000),
    quantity,
    set: safeNullableText(data.set ?? row.set_code, 100),
    condition: safeNullableText(data.condition, 40),
    finish: safeNullableText(data.finish ?? data.treatment, 60),
    page: data.binderPage === null || data.binderPage === undefined
      ? null
      : safePositiveInteger(data.binderPage, 1, 10_000),
    slot: safeNullableText(data.binderSlot, 20),
    tradeStatus: safeNullableText(data.tradeStatus, 40),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

import {
  createDecipheriv,
  createHash,
  randomUUID,
} from "node:crypto";
import { NextResponse } from "next/server";

import { requireApiCapability } from "@/lib/platform/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_BASE_URL = "https://manapool.com/api/v1";
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

type CredentialRow = {
  encrypted_payload: string;
  iv: string;
  auth_tag: string;
};

type ManaPoolSellerDetail = {
  order_number?: string | number | null;
  seller_id?: string | null;
  seller_username?: string | null;
  shipping_cents?: number | null;
  item_count?: number | null;
  fulfillments?: unknown[];
  [key: string]: unknown;
};

type ManaPoolOrder = {
  id?: string | null;
  created_at?: string | null;
  subtotal_cents?: number | null;
  tax_cents?: number | null;
  shipping_cents?: number | null;
  total_cents?: number | null;
  order_number?: string | number | null;
  order_seller_details?: ManaPoolSellerDetail[];
  [key: string]: unknown;
};

type AuthMode = "bearer" | "x-api-key" | "token";

function encryptionKey() {
  const secret = process.env.MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("Marketplace credential encryption is not configured.");
  }
  return createHash("sha256").update(secret).digest();
}

function decryptCredential(row: CredentialRow) {
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

function headersFor(token: string, mode: AuthMode) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "TradingDocks/0.60 ManaPoolConnector",
  };

  if (mode === "bearer") headers.Authorization = `Bearer ${token}`;
  if (mode === "x-api-key") headers["X-API-Key"] = token;
  if (mode === "token") headers.Authorization = token;

  return headers;
}

async function manaPoolFetch(
  baseUrl: string,
  path: string,
  token: string,
  preferredMode?: AuthMode,
) {
  const modes: AuthMode[] = preferredMode
    ? [preferredMode]
    : ["bearer", "x-api-key", "token"];

  let lastStatus = 0;
  let lastBody: unknown = null;

  for (const mode of modes) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: headersFor(token, mode),
      cache: "no-store",
    });

    const body = await response.json().catch(() => null);
    lastStatus = response.status;
    lastBody = body;

    if (response.ok) {
      return { body, mode };
    }

    if (response.status !== 401 && response.status !== 403) {
      throw new Error(
        `Mana Pool request failed (${response.status}) for ${path}.`,
      );
    }
  }

  const apiMessage =
    typeof lastBody === "object" &&
    lastBody &&
    "message" in lastBody &&
    typeof (lastBody as { message?: unknown }).message === "string"
      ? (lastBody as { message: string }).message
      : null;

  throw new Error(
    apiMessage ??
      `Mana Pool rejected the saved API key (${lastStatus || 401}). Generate a new key and try again.`,
  );
}

function dollars(cents: unknown) {
  const number = Number(cents ?? 0);
  return Number.isFinite(number) ? number / 100 : 0;
}

function normalizedStatus(order: ManaPoolOrder) {
  const raw = JSON.stringify(order).toLowerCase();
  if (raw.includes("refund")) return "refunded";
  if (raw.includes("cancel")) return "cancelled";
  if (raw.includes("deliver")) return "delivered";
  if (raw.includes("ship") || raw.includes("fulfill")) return "shipped";
  if (raw.includes("paid") || raw.includes("process")) return "processing";
  return "new";
}

function statusFields(order: ManaPoolOrder) {
  const status = normalizedStatus(order);
  return {
    normalized_status: status,
    order_status: status,
    payment_status:
      status === "cancelled" || status === "refunded" ? status : "paid",
    fulfillment_status:
      status === "shipped" || status === "delivered"
        ? status
        : status === "cancelled"
          ? "cancelled"
          : "unfulfilled",
  };
}

function arraysFromObject(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;

  for (const key of keys) {
    if (Array.isArray(object[key])) return object[key] as unknown[];
  }

  return [];
}

function extractItems(detail: unknown, order: ManaPoolOrder) {
  const candidates = [
    ...arraysFromObject(detail, [
      "items",
      "order_items",
      "line_items",
      "products",
      "cards",
    ]),
    ...arraysFromObject(order, [
      "items",
      "order_items",
      "line_items",
      "products",
      "cards",
    ]),
  ];

  return candidates
    .map((value, index) => {
      if (!value || typeof value !== "object") return null;
      const item = value as Record<string, unknown>;
      const title = String(
        item.title ??
          item.name ??
          item.card_name ??
          item.product_name ??
          item.description ??
          "Mana Pool item",
      );
      const quantity = Math.max(
        1,
        Number(item.quantity ?? item.qty ?? item.item_count ?? 1) || 1,
      );
      const unitPrice =
        item.unit_price_cents != null
          ? dollars(item.unit_price_cents)
          : item.price_cents != null
            ? dollars(item.price_cents)
            : Number(item.unit_price ?? item.price ?? 0) || 0;

      return {
        externalLineItemId: String(
          item.id ??
            item.line_item_id ??
            item.product_id ??
            item.sku ??
            `${order.id ?? order.order_number ?? "order"}-${index + 1}`,
        ),
        externalSku:
          item.sku != null
            ? String(item.sku)
            : item.product_id != null
              ? String(item.product_id)
              : null,
        title,
        quantity,
        unitPrice,
        condition:
          item.condition != null ? String(item.condition) : null,
        language:
          item.language != null ? String(item.language) : "English",
        finish:
          item.finish != null
            ? String(item.finish)
            : item.foil === true
              ? "Foil"
              : null,
        raw: item,
      };
    })
    .filter(
      (
        value,
      ): value is {
        externalLineItemId: string;
        externalSku: string | null;
        title: string;
        quantity: number;
        unitPrice: number;
        condition: string | null;
        language: string;
        finish: string | null;
        raw: Record<string, unknown>;
      } => Boolean(value),
    );
}

async function fetchAllOrders(
  baseUrl: string,
  token: string,
  authMode: AuthMode,
  since: string,
) {
  const orders: ManaPoolOrder[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const offset = page * PAGE_SIZE;
    const params = new URLSearchParams({
      since,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });

    const { body } = await manaPoolFetch(
      baseUrl,
      `/buyer/orders?${params.toString()}`,
      token,
      authMode,
    );

    const pageOrders =
      body &&
      typeof body === "object" &&
      Array.isArray((body as { orders?: unknown[] }).orders)
        ? ((body as { orders: ManaPoolOrder[] }).orders ?? [])
        : [];

    orders.push(...pageOrders);

    if (pageOrders.length < PAGE_SIZE) break;
  }

  return orders;
}

export async function POST() {
  const capability = await requireApiCapability("marketplaces.manage");
  if (!capability.ok) return capability.response;
  const { supabase } = capability;
  const user = capability.user!;

  const { data: credential, error: credentialError } = await supabase
    .from("marketplace_credentials")
    .select("encrypted_payload,iv,auth_tag")
    .eq("user_id", user.id)
    .eq("marketplace_id", "mana-pool")
    .maybeSingle();

  if (credentialError) {
    return NextResponse.json(
      { error: "Could not read the saved Mana Pool API key." },
      { status: 500 },
    );
  }

  if (!credential) {
    return NextResponse.json(
      { error: "Save your Mana Pool API key before syncing." },
      { status: 409 },
    );
  }

  try {
    const credentials = decryptCredential(credential as CredentialRow);
    const token = credentials.apiToken;

    if (!token) {
      return NextResponse.json(
        { error: "The saved Mana Pool credential is incomplete." },
        { status: 409 },
      );
    }

    const baseUrl = (
      process.env.MANAPOOL_API_BASE_URL ?? DEFAULT_BASE_URL
    ).replace(/\/+$/, "");

    // Validate the key and remember the authentication format that succeeds.
    const accountResult = await manaPoolFetch(baseUrl, "/account", token);
    const account = accountResult.body;
    const authMode = accountResult.mode;

    const { data: connection } = await supabase
      .from("marketplace_connections")
      .select("last_sync_at,settings")
      .eq("user_id", user.id)
      .eq("marketplace_id", "mana-pool")
      .maybeSingle();

    const defaultSince = new Date(
      Date.now() - 365 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const since =
      connection?.last_sync_at ??
      process.env.MANAPOOL_INITIAL_SYNC_SINCE ??
      defaultSince;

    const orders = await fetchAllOrders(
      baseUrl,
      token,
      authMode,
      since,
    );

    const batchId = `manapool-${randomUUID()}`;
    let importedOrders = 0;
    let importedItems = 0;
    let failedOrders = 0;

    for (const summary of orders) {
      try {
        const orderId = String(
          summary.id ?? summary.order_number ?? randomUUID(),
        );

        let detail: unknown = null;
        if (summary.id) {
          const result = await manaPoolFetch(
            baseUrl,
            `/buyer/orders/${encodeURIComponent(String(summary.id))}`,
            token,
            authMode,
          );
          detail =
            result.body &&
            typeof result.body === "object" &&
            "order" in result.body
              ? (result.body as { order?: unknown }).order
              : result.body;
        }

        const fullOrder =
          detail && typeof detail === "object"
            ? ({ ...summary, ...(detail as Record<string, unknown>) } as ManaPoolOrder)
            : summary;

        const sellerDetails = Array.isArray(fullOrder.order_seller_details)
          ? fullOrder.order_seller_details
          : [];

        const buyerAlias =
          sellerDetails
            .map((seller) => seller.seller_username)
            .filter(Boolean)
            .join(", ") || "Mana Pool customer";

        const status = statusFields(fullOrder);
        const now = new Date().toISOString();

        const { data: savedOrder, error: orderError } = await supabase
          .from("marketplace_orders")
          .upsert(
            {
              user_id: user.id,
              marketplace_id: "mana-pool",
              external_order_id: orderId,
              ...status,
              currency: "USD",
              subtotal: dollars(fullOrder.subtotal_cents),
              shipping: dollars(fullOrder.shipping_cents),
              tax: dollars(fullOrder.tax_cents),
              total: dollars(fullOrder.total_cents),
              buyer_alias: buyerAlias,
              ordered_at: fullOrder.created_at ?? now,
              last_modified_at: now,
              source_type: "api",
              import_batch_id: batchId,
              raw_snapshot: {
                source: "mana_pool_api",
                endpoint: "/buyer/orders",
                account,
                summary,
                detail,
              },
              updated_at: now,
            },
            { onConflict: "user_id,marketplace_id,external_order_id" },
          )
          .select("id")
          .single();

        if (orderError || !savedOrder) {
          throw orderError ?? new Error("Mana Pool order upsert failed.");
        }

        const items = extractItems(detail, fullOrder);

        // The documented example can omit card-level lines. Preserve seller
        // segments as synthetic review lines instead of silently showing zero
        // units.
        const normalizedItems =
          items.length > 0
            ? items
            : sellerDetails.map((seller, index) => ({
                externalLineItemId: String(
                  seller.order_number ??
                    seller.seller_id ??
                    `${orderId}-seller-${index + 1}`,
                ),
                externalSku: seller.seller_id ?? null,
                title: seller.seller_username
                  ? `Mana Pool order from ${seller.seller_username}`
                  : "Mana Pool order items",
                quantity: Math.max(1, Number(seller.item_count ?? 1) || 1),
                unitPrice: 0,
                condition: null,
                language: "English",
                finish: null,
                raw: seller as Record<string, unknown>,
              }));

        for (const item of normalizedItems) {
          const { error: itemError } = await supabase
            .from("marketplace_order_items")
            .upsert(
              {
                user_id: user.id,
                marketplace_order_id: savedOrder.id,
                external_line_item_id: item.externalLineItemId,
                external_sku: item.externalSku,
                title: item.title,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                currency: "USD",
                condition: item.condition,
                language: item.language,
                finish: item.finish,
                match_status: "unmatched",
                raw_snapshot: {
                  source: "mana_pool_api",
                  data: item.raw,
                },
                updated_at: now,
              },
              {
                onConflict:
                  "user_id,marketplace_order_id,external_line_item_id",
              },
            );

          if (itemError) throw itemError;
          importedItems += 1;
        }

        importedOrders += 1;
      } catch {
        failedOrders += 1;
      }
    }

    const now = new Date().toISOString();
    const accountName =
      account &&
      typeof account === "object" &&
      "username" in account &&
      typeof (account as { username?: unknown }).username === "string"
        ? (account as { username: string }).username
        : null;

    const { error: connectionError } = await supabase
      .from("marketplace_connections")
      .upsert(
        {
          user_id: user.id,
          marketplace_id: "mana-pool",
          connection_method: "api",
          status: failedOrders > 0 && importedOrders === 0 ? "attention" : "ready",
          settings: {
            credentials_saved: true,
            auth_mode: authMode,
            account_name: accountName,
            last_import: {
              orders_received: orders.length,
              orders_imported: importedOrders,
              items_imported: importedItems,
              failed_orders: failedOrders,
              since,
              batch_id: batchId,
            },
          },
          last_sync_at: now,
          updated_at: now,
        },
        { onConflict: "user_id,marketplace_id" },
      );

    if (connectionError) throw connectionError;

    return NextResponse.json({
      importedInventory: 0,
      importedOrders,
      importedPricing: 0,
      importedItems,
      failedOrders,
      accountName,
      lastSyncAt: now,
      message:
        orders.length === 0
          ? "Mana Pool sync completed. No new orders were returned for the selected sync period."
          : `Mana Pool sync complete: ${importedOrders} orders and ${importedItems} order lines imported${failedOrders ? `; ${failedOrders} orders need review` : ""}.`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mana Pool sync failed.";

    await supabase
      .from("marketplace_connections")
      .update({
        status: "attention",
        settings: {
          credentials_saved: true,
          last_error: message,
          last_error_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("marketplace_id", "mana-pool");

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

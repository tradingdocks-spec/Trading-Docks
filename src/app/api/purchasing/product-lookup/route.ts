import { NextRequest, NextResponse } from "next/server";

import { requireApiCapability } from "@/lib/platform/server-access";
import {
  buildInventorySku,
  magicScryfallToPurchasingResult,
  magicSealedToPurchasingResult,
  pokemonSealedToPurchasingResult,
  tcgProductToPurchasingResult,
  type PurchasingLookupResult,
  type PurchasingProductType,
} from "@/lib/purchasing/product-lookup";
import {
  resolveTcgProductSkus,
  searchTcgProducts,
} from "@/lib/providers/tcgtracking/product-search";
import { TCGTRACKING_POKEMON_GAME_ID } from "@/lib/providers/tcgtracking/client";
import { searchSealedProducts } from "@/lib/tcgcsv/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCRYFALL = "https://api.scryfall.com";
const PRODUCT_ACTIONS = new Set(["add-inventory", "add-collection", "add-binder", "add-trade-binder", "add-wishlist"]);

type AuthorizedCapability = Extract<Awaited<ReturnType<typeof requireApiCapability>>, { ok: true }>;

export async function GET(request: NextRequest) {
  const capability = await requireApiCapability("buying.manage");
  if (!capability.ok) return capability.response;

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const gameId = request.nextUrl.searchParams.get("gameId") === "pokemon" ? "pokemon" : "magic";
  const productType = normalizeProductType(request.nextUrl.searchParams.get("productType"));
  const limit = Math.max(1, Math.min(16, Number(request.nextUrl.searchParams.get("limit") ?? 12)));

  if (query.length < 2) {
    return NextResponse.json({ results: [], message: "Search at least two characters." });
  }

  const results = gameId === "pokemon"
    ? await searchPokemonProducts({ query, productType, limit })
    : await searchMagicProducts({ query, productType, limit });

  return NextResponse.json({
    query,
    gameId,
    productType,
    results,
  });
}

export async function POST(request: Request) {
  const capability = await requireApiCapability("buying.manage");
  if (!capability.ok) return capability.response;

  const body = await request.json().catch(() => null);
  const payload = isRecord(body) ? body : {};
  const action = typeof payload.action === "string" ? payload.action : "";
  if (!PRODUCT_ACTIONS.has(action)) {
    return NextResponse.json({ error: "Unsupported Purchasing Intelligence action." }, { status: 400 });
  }

  const product = isRecord(payload.product) ? payload.product as PurchasingLookupResult : null;
  if (!product) return NextResponse.json({ error: "Choose a product first." }, { status: 400 });

  if (action === "add-wishlist") {
    return addProductToWishlist(capability, payload, product);
  }

  if (action === "add-binder" && typeof payload.storageLocationId !== "string") {
    return NextResponse.json({ error: "Choose a binder or storage location before adding this product to a binder." }, { status: 400 });
  }

  const inventoryResult = await upsertProductInventory(capability, payload, product);
  if (!inventoryResult.ok) return inventoryResult.response;

  if (action === "add-trade-binder") {
    const tradeResult = await addInventoryToTradeBinder(capability, inventoryResult.inventoryItemId, product);
    if (!tradeResult.ok) return tradeResult.response;
  }

  return NextResponse.json({
    ok: true,
    action,
    inventoryItemId: inventoryResult.inventoryItemId,
    quantity: inventoryResult.quantity,
    merged: inventoryResult.merged,
  }, { status: inventoryResult.merged ? 200 : 201 });
}

async function upsertProductInventory(
  capability: AuthorizedCapability,
  payload: Record<string, unknown>,
  product: PurchasingLookupResult,
) {
  const quantity = Math.max(1, Math.floor(Number(payload.quantity ?? 1)));
  const condition = typeof payload.condition === "string" ? payload.condition : null;
  const variant = typeof payload.variant === "string" ? payload.variant : null;
  const language = typeof payload.language === "string" ? payload.language : "English";
  const locationId = typeof payload.storageLocationId === "string" && payload.storageLocationId ? payload.storageLocationId : null;
  const costBasis = money(payload.costBasis);
  const sku = buildInventorySku({
    product,
    condition: condition ?? undefined,
    variant: variant ?? undefined,
    language,
  });

  if (locationId) {
    const { data: location, error: locationError } = await capability.supabase
      .from("inventory_locations")
      .select("id")
      .eq("user_id", capability.user?.id ?? "")
      .eq("id", locationId)
      .maybeSingle();
    if (locationError) return { ok: false as const, response: NextResponse.json({ error: locationError.message }, { status: 500 }) };
    if (!location) return { ok: false as const, response: NextResponse.json({ error: "Choose one of your storage locations." }, { status: 400 }) };
  }

  const existing = await capability.supabase
    .from("inventory_items")
    .select("id, quantity, data")
    .eq("user_id", capability.user?.id ?? "")
    .eq("sku", sku)
    .maybeSingle();
  if (existing.error) return { ok: false as const, response: NextResponse.json({ error: existing.error.message }, { status: 500 }) };

  const now = new Date().toISOString();
  if (existing.data) {
    const nextQuantity = Math.max(0, Number(existing.data.quantity ?? 0)) + quantity;
    const { error } = await capability.supabase
      .from("inventory_items")
      .update({
        quantity: nextQuantity,
        location_id: locationId,
        inventory_value: product.marketPrice ?? product.lowPrice ?? 0,
        data: {
          ...(isRecord(existing.data.data) ? existing.data.data : {}),
          costBasis,
          condition,
          variant,
          language,
          locationId,
          lastPurchasingIntelligenceAddAt: now,
        },
        updated_at: now,
      })
      .eq("user_id", capability.user?.id ?? "")
      .eq("id", existing.data.id);
    if (error) return { ok: false as const, response: NextResponse.json({ error: error.message }, { status: 500 }) };
    return { ok: true as const, inventoryItemId: String(existing.data.id), quantity: nextQuantity, merged: true };
  }

  const id = crypto.randomUUID();
  const { error } = await capability.supabase.from("inventory_items").insert({
    id,
    user_id: capability.user?.id ?? "",
    card_name: product.name,
    sku,
    location_id: locationId,
    scryfall_id: product.scryfallId ?? null,
    set_code: product.setCode,
    collector_number: product.collectorNumber,
    quantity,
    inventory_value: product.marketPrice ?? product.lowPrice ?? 0,
    data: {
      gameId: product.gameId,
      productType: product.productType,
      provider: product.provider,
      providerProductId: product.providerProductId,
      tcgplayerProductId: product.tcgplayerProductId,
      condition,
      variant,
      language,
      costBasis,
      locationId,
      imageUrl: product.imageUrl,
      setName: product.setName,
      productFamily: product.productFamily,
    },
    updated_at: now,
  });
  if (error) return { ok: false as const, response: NextResponse.json({ error: error.message }, { status: 500 }) };
  return { ok: true as const, inventoryItemId: id, quantity, merged: false };
}

async function addInventoryToTradeBinder(
  capability: AuthorizedCapability,
  inventoryItemId: string,
  product: PurchasingLookupResult,
) {
  const { error } = await capability.supabase
    .from("binder_card_trade_status")
    .upsert({
      user_id: capability.user?.id ?? "",
      inventory_item_id: inventoryItemId,
      status: "available",
      trade_value: product.marketPrice ?? product.lowPrice ?? null,
      notes: productActionNotes(product).slice(0, 500),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,inventory_item_id" });
  if (error) return { ok: false as const, response: NextResponse.json({ error: error.message }, { status: 500 }) };
  return { ok: true as const };
}

async function addProductToWishlist(
  capability: AuthorizedCapability,
  payload: Record<string, unknown>,
  product: PurchasingLookupResult,
) {
  const condition = typeof payload.condition === "string" ? payload.condition : product.productType === "sealed" ? "Sealed" : "Any";
  const variant = typeof payload.variant === "string" ? payload.variant : product.variants[0] ?? null;
  const targetValue = money(product.marketPrice ?? product.lowPrice);
  const { data, error } = await capability.supabase
    .from("collector_wishlist")
    .insert({
      user_id: capability.user?.id ?? "",
      card_name: product.name.slice(0, 160),
      set_code: product.setCode?.toUpperCase().slice(0, 12) ?? null,
      target_condition: condition.slice(0, 40),
      target_finish: variant?.slice(0, 40) ?? null,
      target_value: targetValue,
      priority: "medium",
      notes: productActionNotes(product).slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, action: "add-wishlist", wishlistItemId: data?.id ?? null }, { status: 201 });
}

function productActionNotes(product: PurchasingLookupResult) {
  return [
    "Added from Purchasing Intelligence.",
    `Game: ${product.gameLabel}`,
    `Product type: ${product.productType}`,
    product.provider ? `Provider: ${product.provider}` : null,
    product.providerProductId ? `Provider product ID: ${product.providerProductId}` : null,
    product.tcgplayerProductId ? `TCGplayer product ID: ${product.tcgplayerProductId}` : null,
    product.collectorNumber ? `Collector number: ${product.collectorNumber}` : null,
  ].filter(Boolean).join("\n");
}

async function searchPokemonProducts(input: { query: string; productType: "all" | PurchasingProductType; limit: number }) {
  const products = await searchTcgProducts({
    gameId: TCGTRACKING_POKEMON_GAME_ID,
    query: input.query,
    productType: input.productType,
    limit: input.limit,
  });
  const results = await Promise.all(products.map(async (product) => {
    if (input.productType === "sealed" || looksSealed(product.name)) {
      return pokemonSealedToPurchasingResult(product);
    }
    const resolved = await resolveTcgProductSkus({
      gameId: TCGTRACKING_POKEMON_GAME_ID,
      providerProductId: product.providerProductId,
      setId: product.setId,
    }).catch(() => ({ product, skus: [] }));
    return tcgProductToPurchasingResult(product, resolved.skus);
  }));
  return results;
}

async function searchMagicProducts(input: { query: string; productType: "all" | PurchasingProductType; limit: number }) {
  const results: PurchasingLookupResult[] = [];
  if (input.productType !== "sealed") {
    results.push(...await searchMagicSingles(input.query, input.limit));
  }
  if (input.productType !== "card") {
    const sealed = await searchSealedProducts({ query: input.query, categoryName: "Magic", limit: input.limit })
      .catch(() => ({ results: [] }));
    results.push(...(sealed.results ?? []).map(magicSealedToPurchasingResult));
  }
  return results.slice(0, input.limit);
}

async function searchMagicSingles(query: string, limit: number) {
  const response = await fetch(`${SCRYFALL}/cards/search?${new URLSearchParams({
    q: query,
    unique: "prints",
    order: "edhrec",
    include_extras: "true",
  })}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "TradingDocks/1.0 tradingdocks@gmail.com",
    },
    cache: "no-store",
  });
  if (!response.ok) return [];
  const payload = await response.json() as { data?: Record<string, unknown>[] };
  return (payload.data ?? []).slice(0, limit).map(magicScryfallToPurchasingResult);
}

function normalizeProductType(value: string | null): "all" | PurchasingProductType {
  if (value === "card" || value === "sealed") return value;
  return "all";
}

function looksSealed(name: string) {
  return /booster|box|bundle|tin|trainer|collection|blister|deck|pack|case/i.test(name);
}

function money(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

import { gunzipSync } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { physicalFinish, physicalLanguage, knownAttribute } from "../card-intelligence/resolution.ts";

type InventoryData = {
  id?: string; name?: string; set?: string; setCode?: string; collectorNumber?: string;
  scryfallId?: string; finish?: string; language?: string; condition?: string;
};
type SetCard = { uuid: string; name: string; number: string; identifiers?: { scryfallId?: string } };
type PricePoint = Record<string, number>;
type PriceEntry = { paper?: { cardkingdom?: { currency?: string; buylist?: { normal?: PricePoint; foil?: PricePoint; etched?: PricePoint } } } };
type PriceFile = { meta?: { date?: string }; data?: Record<string, PriceEntry> };

const API_ROOT = "https://mtgjson.com/api/v5";
const MAX_INVENTORY_ROWS = 10_000;
const REQUEST_TIMEOUT_MS = 120_000;
const CACHE_TTL_MS = 15 * 60_000;
let priceCache: { loadedAt: number; value: Promise<PriceFile> } | null = null;
const setCache = new Map<string, { loadedAt: number; value: Promise<SetCard[]> }>();

function latest(point?: PricePoint) {
  if (!point) return null;
  const dates = Object.keys(point).sort();
  const value = dates.length ? Number(point[dates[dates.length - 1]]) : NaN;
  return Number.isFinite(value) && value >= 0 ? value : null;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_ROOT}/${path}`, {
    headers: { "Accept-Encoding": "gzip", "User-Agent": "TradingDocks/1.0 buylist-sync" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: "no-store",
  });
  if (!response.ok) throw new Error(`MTGJSON returned ${response.status} for ${path}.`);
  if (path.endsWith(".gz")) {
    const body = Buffer.from(await response.arrayBuffer());
    const json = body[0] === 0x1f && body[1] === 0x8b ? gunzipSync(body) : body;
    return JSON.parse(json.toString("utf8")) as T;
  }
  return await response.json() as T;
}

function currentPrices() {
  if (!priceCache || Date.now() - priceCache.loadedAt > CACHE_TTL_MS) {
    const value = fetchJson<PriceFile>("AllPricesToday.json.gz").catch((error) => { priceCache = null; throw error; });
    priceCache = { loadedAt: Date.now(), value };
  }
  return priceCache.value;
}

function cardsForSet(code: string) {
  const cached = setCache.get(code);
  if (cached && Date.now() - cached.loadedAt <= CACHE_TTL_MS) return cached.value;
  const value = fetchJson<{ data?: { cards?: SetCard[] } }>(`${encodeURIComponent(code)}.json`)
    .then((payload) => payload.data?.cards ?? [])
    .catch((error) => { setCache.delete(code); throw error; });
  setCache.set(code, { loadedAt: Date.now(), value });
  return value;
}

export async function syncMtgjsonForUser(admin: SupabaseClient, userId: string) {
  const startedAt = new Date().toISOString();
  await admin.from("buylist_feed_connections").upsert({
    user_id: userId, provider: "mtgjson_cardkingdom", display_name: "MTGJSON · Card Kingdom",
    enabled: true, last_sync_at: startedAt, last_error: null, updated_at: startedAt,
  }, { onConflict: "user_id,provider" });

  try {
    const { data: inventoryRows, error } = await admin.from("inventory_items")
      .select("data").eq("user_id", userId).limit(MAX_INVENTORY_ROWS);
    if (error) throw error;
    const inventory = (inventoryRows ?? []).map((row) => row.data as InventoryData)
      .filter((item) => item?.name && (item.set || item.setCode));
    const setCodeFor = (item: InventoryData) => {
      if (item.setCode) return item.setCode.trim().toUpperCase();
      const fromLabel = item.set?.match(/\(([A-Za-z0-9_]+)\)\s*$/)?.[1];
      return (fromLabel || item.set || "").trim().toUpperCase();
    };
    const setCodes = [...new Set(inventory.map(setCodeFor).filter(Boolean))];

    if (!setCodes.length) {
      await markSuccess(admin, userId, 0, startedAt);
      return { offers: 0, inventoryRows: inventory.length, sets: 0, sourceDate: null };
    }

    const setPayloads = await Promise.all(setCodes.map(cardsForSet));
    const identity = new Map<string, SetCard>();
    for (const [setIndex, cards] of setPayloads.entries()) for (const card of cards) {
      const scryfall = card.identifiers?.scryfallId?.toLowerCase();
      if (scryfall) identity.set(`s:${scryfall}`, card);
      identity.set(`p:${setCodes[setIndex]}|${card.name.toLowerCase()}|${card.number.toLowerCase()}`, card);
    }

    const prices = await currentPrices();
    const verifiedAt = prices.meta?.date ? new Date(`${prices.meta.date}T09:00:00Z`).toISOString() : startedAt;
    const offers = inventory.flatMap((item) => {
      if (physicalLanguage(item.language) !== "en" || !knownAttribute(item.condition)) return [];
      const card = item.scryfallId ? identity.get(`s:${item.scryfallId.toLowerCase()}`)
        : identity.get(`p:${setCodeFor(item)}|${item.name!.toLowerCase()}|${(item.collectorNumber || "").toLowerCase()}`);
      if (!card) return [];
      // An explicit provider ID must not silently fall back to another printing.
      if (item.collectorNumber && item.collectorNumber.toLowerCase() !== card.number.toLowerCase()) return [];
      if (!setPayloads[setCodes.indexOf(setCodeFor(item))]?.some((candidate) => candidate.uuid === card.uuid)) return [];
      const buylist = prices.data?.[card.uuid]?.paper?.cardkingdom?.buylist;
      const finish = physicalFinish(item.finish);
      if (!finish) return [];
      const cashPrice = latest(finish === "foil" ? buylist?.foil : finish === "etched" ? buylist?.etched : buylist?.normal);
      if (cashPrice == null) return [];
      return [{
        user_id: userId, provider: "mtgjson_cardkingdom", source_kind: "aggregated", indicative: true,
        store_name: "Card Kingdom", scryfall_id: card.identifiers?.scryfallId || item.scryfallId || null,
        card_name: item.name!, set_code: setCodeFor(item).toLowerCase(),
        collector_number: item.collectorNumber || card.number, finish, language: item.language!, condition: item.condition!,
        cash_price: cashPrice, credit_price: null, quantity_wanted: 1,
        source_url: "https://www.cardkingdom.com/purchasing/mtg_singles", verified_at: verifiedAt,
        expires_at: new Date(new Date(verifiedAt).getTime() + 48 * 3_600_000).toISOString(), updated_at: startedAt,
      }];
    });

    await admin.from("buylist_offers").delete().eq("user_id", userId).eq("provider", "mtgjson_cardkingdom");
    for (let index = 0; index < offers.length; index += 500) {
      const { error: insertError } = await admin.from("buylist_offers").insert(offers.slice(index, index + 500));
      if (insertError) throw insertError;
    }
    await markSuccess(admin, userId, offers.length, startedAt);
    return { offers: offers.length, inventoryRows: inventory.length, sets: setCodes.length, sourceDate: verifiedAt };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unknown MTGJSON synchronization error.";
    await admin.from("buylist_feed_connections").update({ last_error: message.slice(0, 500), updated_at: new Date().toISOString() })
      .eq("user_id", userId).eq("provider", "mtgjson_cardkingdom");
    throw cause;
  }
}

async function markSuccess(admin: SupabaseClient, userId: string, count: number, syncedAt: string) {
  await admin.from("buylist_feed_connections").update({
    last_success_at: syncedAt, last_error: null, last_offer_count: count, updated_at: syncedAt,
  }).eq("user_id", userId).eq("provider", "mtgjson_cardkingdom");
}

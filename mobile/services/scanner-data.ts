import { supabase } from '@/lib/supabase';
import { runMobileTradeWishlistMutation } from '@/services/trade-binder-wishlist-data';
import { buildStorageLocation, type StorageLocation } from '@/services/storage-location-manager';
import { appStorage } from '@/services/storage/app-storage';
import { enqueueOfflineOperation } from '@/services/storage/offline';
import {
  SCANNER_COLLECTION_QUEUE_TYPE,
  buildScannerAddPayload,
  normalizeScannerCandidate,
  scannerDraftKey,
  scannerIdempotencyKey,
  validateScannerConfirmation,
  type ScannerCardCandidate,
  type ScannerConfirmation,
  type ScannerDraft,
  type ScannerRecognitionResult,
} from '@/services/scanner-foundation';

type ScannerSaveResult =
  | { ok: true; queued?: false; inventoryItemId: string }
  | { ok: true; queued: true; warning: string; inventoryItemId: string }
  | { ok: false; error: string };

type ScryfallCard = {
  id?: string;
  oracle_id?: string | null;
  name?: string;
  set?: string;
  set_name?: string;
  collector_number?: string;
  lang?: string;
  finishes?: string[];
  image_uris?: { normal?: string; large?: string };
  card_faces?: { image_uris?: { normal?: string; large?: string } }[];
  prices?: { usd?: string | null; usd_foil?: string | null; usd_etched?: string | null };
};

export async function searchScannerPrintings(query: string, online = true): Promise<ScannerRecognitionResult> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return { ok: true, candidates: [], assisted: false };
  if (!online) {
    const cached = await loadRecentScannerCandidates();
    const filtered = cached.filter((candidate) => candidate.name.toLowerCase().includes(cleanQuery.toLowerCase()));
    return filtered.length
      ? { ok: true, candidates: filtered, assisted: false, warning: 'Showing cached recent scan candidates while offline.' }
      : { ok: false, reason: 'Manual search needs internet unless a recent cached candidate matches.', offline: true };
  }
  try {
    const url = `https://api.scryfall.com/cards/search?${new URLSearchParams({
      q: `!"${cleanQuery.replaceAll('"', '')}" game:paper`,
      unique: 'prints',
      order: 'released',
      dir: 'desc',
    }).toString()}`;
    const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'TradingDocksMobile/1.0 scanner-foundation' } });
    if (!response.ok) return { ok: false, reason: 'No matching Magic card printings were found.' };
    const payload = await response.json() as { data?: ScryfallCard[] };
    const candidates = (payload.data ?? []).slice(0, 12).map(cardToCandidate).filter((candidate): candidate is ScannerCardCandidate => Boolean(candidate));
    await saveRecentScannerCandidates(candidates);
    return { ok: true, candidates, assisted: false };
  } catch (error) {
    const cached = await loadRecentScannerCandidates();
    return cached.length
      ? { ok: true, candidates: cached, assisted: false, warning: 'Search failed. Showing recent cached candidates.' }
      : { ok: false, reason: error instanceof Error ? error.message : 'Card search is unavailable.', offline: true };
  }
}

export async function loadScannerContext(): Promise<{ userId: string; locations: StorageLocation[]; currentTotalQuantity: number }> {
  if (!supabase) throw new Error('Supabase scanner storage is not configured.');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Sign in again to scan cards.');
  const userId = auth.user.id;
  const [{ data: locations }, { data: items, error: itemError }] = await Promise.all([
    supabase.from('inventory_locations').select('id, name, location_type, data').eq('user_id', userId).order('name', { ascending: true }).limit(500),
    supabase.from('inventory_items').select('quantity').eq('user_id', userId).limit(1000),
  ]);
  if (itemError) throw new Error(`Collection totals are unavailable: ${itemError.message}`);
  return {
    userId,
    locations: ((locations ?? []) as { id: string; name?: string | null; location_type?: string | null; data?: Record<string, unknown> | null }[]).map((location) => buildStorageLocation(userId, location)),
    currentTotalQuantity: (items ?? []).reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
  };
}

export async function saveScannerDraft(draft: ScannerDraft) {
  await appStorage.setItem(scannerDraftKey(draft.userId), JSON.stringify(draft));
}

export async function loadScannerDraft(userId: string): Promise<ScannerDraft | null> {
  const raw = await appStorage.getItem(scannerDraftKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ScannerDraft;
    return parsed.userId === userId ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearScannerDraft(userId: string) {
  await appStorage.removeItem(scannerDraftKey(userId));
}

export async function saveScannerConfirmation({
  confirmation,
  membershipTier,
  currentTotalQuantity,
}: {
  confirmation: ScannerConfirmation;
  membershipTier: unknown;
  currentTotalQuantity: number;
}): Promise<ScannerSaveResult> {
  const validation = validateScannerConfirmation(confirmation, { membershipTier, currentTotalQuantity });
  if (!validation.ok) return { ok: false, error: validation.reason };
  const inventoryItemId = createId('scan');
  const payload = buildScannerAddPayload(confirmation, inventoryItemId);
  if (!supabase) return queueScannerAdd(confirmation, inventoryItemId, 'Collection storage is offline. Scan queued for sync.');
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || auth.user.id !== confirmation.userId) return { ok: false, error: 'Sign in again to add scanned cards.' };
  try {
    const { error } = await supabase.from('inventory_items').insert(payload);
    if (error) throw new Error(error.message);
    if (confirmation.tradeStatus !== 'not_for_trade') {
      await runMobileTradeWishlistMutation({
        type: 'trade_status',
        userId: confirmation.userId,
        inventoryItemId,
        status: confirmation.tradeStatus,
      });
    }
    if (confirmation.addToWishlist) {
      await runMobileTradeWishlistMutation({
        type: 'wishlist_toggle',
        userId: confirmation.userId,
        cardName: confirmation.candidate.name,
        setCode: confirmation.candidate.setCode,
        condition: confirmation.condition,
        finish: confirmation.finish,
        wishlisted: true,
      });
    }
    await clearScannerDraft(confirmation.userId);
    return { ok: true, inventoryItemId };
  } catch (error) {
    return queueScannerAdd(confirmation, inventoryItemId, error instanceof Error ? error.message : 'Scanned card queued for sync.');
  }
}

async function queueScannerAdd(confirmation: ScannerConfirmation, inventoryItemId: string, warning: string): Promise<ScannerSaveResult> {
  const idempotencyKey = scannerIdempotencyKey(confirmation, inventoryItemId);
  await enqueueOfflineOperation(
    SCANNER_COLLECTION_QUEUE_TYPE,
    { confirmation, inventoryItemId, idempotencyKey } as unknown as Record<string, unknown>,
    { userId: confirmation.userId, dedupeKey: idempotencyKey },
  );
  return { ok: true, queued: true, warning, inventoryItemId };
}

async function loadRecentScannerCandidates(): Promise<ScannerCardCandidate[]> {
  const raw = await appStorage.getItem('trading-docks-scanner-recent-candidates-v1');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ScannerCardCandidate[];
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

async function saveRecentScannerCandidates(candidates: ScannerCardCandidate[]) {
  if (!candidates.length) return;
  await appStorage.setItem('trading-docks-scanner-recent-candidates-v1', JSON.stringify(candidates.slice(0, 12)));
}

function cardToCandidate(card: ScryfallCard) {
  return normalizeScannerCandidate({
    id: card.id,
    oracleId: card.oracle_id,
    name: card.name,
    setCode: card.set,
    setName: card.set_name,
    collectorNumber: card.collector_number,
    finishes: card.finishes,
    language: card.lang,
    imageUrl: card.image_uris?.normal ?? card.image_uris?.large ?? card.card_faces?.[0]?.image_uris?.normal ?? null,
    confidence: 0.91,
    recognitionMode: 'manual_search',
    marketPrice: scryfallPriceMetadata(card.prices),
  });
}

function scryfallPriceMetadata(prices: ScryfallCard['prices']) {
  if (!prices) return null;
  return {
    usd: parseScryfallPrice(prices.usd),
    usdFoil: parseScryfallPrice(prices.usd_foil),
    usdEtched: parseScryfallPrice(prices.usd_etched),
    source: 'scryfall' as const,
    fetchedAt: new Date().toISOString(),
  };
}

function parseScryfallPrice(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null;
}

function createId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

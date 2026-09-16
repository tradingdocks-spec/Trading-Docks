import { supabase } from '@/lib/supabase';
import { runMobileTradeWishlistMutation } from '@/services/trade-binder-wishlist-data';
import { buildStorageLocation, type StorageLocation } from '@/services/storage-location-manager';
import { appStorage } from '@/services/storage/app-storage';
import { enqueueOfflineOperation } from '@/services/storage/offline';
import { loadInventoryQuantityTotal } from '@/services/inventory-quantity-total';
import { MOBILE_CANONICAL_SITE_URL } from '@/services/mobile-release-config';
import { ScannerInventoryAuthorityError, validateScannerInventoryIdentity } from '@/services/scanner-inventory-authority';
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
export { lookupScannerPrintings } from '@/services/scanner-printing-lookup';

type ScannerSaveResult =
  | { ok: true; queued?: false; inventoryItemId: string }
  | { ok: true; queued: true; warning: string; inventoryItemId: string }
  | { ok: false; error: string; requiresConfirmation?: boolean };

type ScryfallCard = {
  id?: string;
  oracle_id?: string | null;
  name?: string;
  set?: string;
  set_name?: string;
  collector_number?: string;
  lang?: string;
  finishes?: string[];
  released_at?: string;
  set_type?: string;
  promo?: boolean;
  promo_types?: string[];
  frame_effects?: string[];
  layout?: string;
  image_uris?: { normal?: string; large?: string };
  card_faces?: { image_uris?: { normal?: string; large?: string } }[];
  prices?: { usd?: string | null; usd_foil?: string | null; usd_etched?: string | null };
};

type IntelligenceCandidate = {
  printingId?: string;
  canonicalCardId?: string;
  game?: 'magic' | 'pokemon';
  name?: string;
  setCode?: string | null;
  setName?: string | null;
  collectorNumber?: string | null;
  language?: string | null;
  finishes?: string[];
  imageUrl?: string | null;
  score?: number;
  providerIds?: Record<string, string | number>;
  prices?: Array<{ market?: number | null; source?: string }>;
  provenance?: string[];
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
    const url = `${MOBILE_CANONICAL_SITE_URL}/api/card-intelligence/search?${new URLSearchParams({ q: cleanQuery, game: 'magic', limit: '12' }).toString()}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return { ok: false, reason: 'No matching Magic card printings were found.' };
    const payload = await response.json() as { candidates?: IntelligenceCandidate[] };
    const candidates = (payload.candidates ?? []).slice(0, 12).map(intelligenceToCandidate).filter((candidate): candidate is ScannerCardCandidate => Boolean(candidate));
    await saveRecentScannerCandidates(candidates);
    return { ok: true, candidates, assisted: false };
  } catch (error) {
    const cached = await loadRecentScannerCandidates();
    return cached.length
      ? { ok: true, candidates: cached, assisted: false, warning: 'Search failed. Showing recent cached candidates.' }
      : { ok: false, reason: error instanceof Error ? error.message : 'Card search is unavailable.', offline: true };
  }
}

function intelligenceToCandidate(candidate: IntelligenceCandidate) {
  const tcgtrackingId = candidate.providerIds?.tcgtracking === undefined ? null : String(candidate.providerIds.tcgtracking);
  const tcgplayerId = Number(candidate.providerIds?.tcgplayer);
  const market = candidate.prices?.find((price) => price.source?.startsWith('scryfall:nonfoil'))?.market ?? null;
  const foil = candidate.prices?.find((price) => price.source?.startsWith('scryfall:foil'))?.market ?? null;
  const etched = candidate.prices?.find((price) => price.source?.startsWith('scryfall:etched'))?.market ?? null;
  return normalizeScannerCandidate({
    id: candidate.printingId,
    gameId: candidate.game,
    providerSource: candidate.provenance?.length === 1 && ['scryfall', 'tcgplayer', 'tcgtracking'].includes(candidate.provenance[0]) ? candidate.provenance[0] as 'scryfall' | 'tcgplayer' | 'tcgtracking' : candidate.provenance?.length ? 'multiple' : null,
    providerSources: candidate.provenance ?? [],
    providerIds: candidate.providerIds,
    identityAuthority: 'provider_confirmed',
    oracleId: candidate.canonicalCardId,
    name: candidate.name,
    setCode: candidate.setCode,
    setName: candidate.setName,
    collectorNumber: candidate.collectorNumber,
    finishes: candidate.finishes,
    language: candidate.language,
    imageUrl: candidate.imageUrl,
    confidence: candidate.score ?? 0,
    recognitionMode: 'manual_search',
    marketPrice: { usd: market, usdFoil: foil, usdEtched: etched, source: 'scryfall', fetchedAt: null },
    providerProductId: tcgtrackingId,
    tcgplayerProductId: Number.isSafeInteger(tcgplayerId) && tcgplayerId > 0 ? tcgplayerId : null,
  });
}

export async function loadScannerContext(): Promise<{ userId: string; locations: StorageLocation[]; currentTotalQuantity: number }> {
  if (!supabase) throw new Error('Supabase scanner storage is not configured.');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Sign in again to scan cards.');
  const userId = auth.user.id;
  const [{ data: locations }, currentTotalQuantity] = await Promise.all([
    supabase.from('inventory_locations').select('id, name, location_type, data').eq('user_id', userId).order('name', { ascending: true }).limit(500),
    loadInventoryQuantityTotal(supabase, userId),
  ]);
  return {
    userId,
    locations: ((locations ?? []) as { id: string; name?: string | null; location_type?: string | null; data?: Record<string, unknown> | null }[]).map((location) => buildStorageLocation(userId, location)),
    currentTotalQuantity,
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
  if (!supabase) return queueScannerAdd(confirmation, inventoryItemId, 'Collection storage is offline. Scan queued for sync.');
  const [{ data: auth }, { data: sessionData }] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);
  if (!auth.user || auth.user.id !== confirmation.userId || !sessionData.session?.access_token) return { ok: false, error: 'Sign in again to add scanned cards.' };
  let authoritativeConfirmation: ScannerConfirmation;
  try {
    authoritativeConfirmation = await validateScannerInventoryIdentity({
      confirmation,
      accessToken: sessionData.session.access_token,
    });
  } catch (error) {
    if (error instanceof ScannerInventoryAuthorityError && error.offline) {
      return queueScannerAdd(confirmation, inventoryItemId, error.message);
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'This card needs confirmation before it can be added.',
      requiresConfirmation: true,
    };
  }
  const payload = buildScannerAddPayload(authoritativeConfirmation, inventoryItemId);
  try {
    const { error } = await supabase.from('inventory_items').insert(payload);
    if (error) throw new Error(error.message);
    if (authoritativeConfirmation.tradeStatus !== 'not_for_trade') {
      await runMobileTradeWishlistMutation({
        type: 'trade_status',
        userId: authoritativeConfirmation.userId,
        inventoryItemId,
        status: authoritativeConfirmation.tradeStatus,
      });
    }
    if (authoritativeConfirmation.addToWishlist) {
      await runMobileTradeWishlistMutation({
        type: 'wishlist_toggle',
        userId: authoritativeConfirmation.userId,
        cardName: authoritativeConfirmation.candidate.name,
        setCode: authoritativeConfirmation.candidate.setCode,
        condition: authoritativeConfirmation.condition,
        finish: authoritativeConfirmation.finish,
        wishlisted: true,
      });
    }
    await clearScannerDraft(authoritativeConfirmation.userId);
    return { ok: true, inventoryItemId };
  } catch (error) {
    return queueScannerAdd(authoritativeConfirmation, inventoryItemId, error instanceof Error ? error.message : 'Scanned card queued for sync.');
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
    specialPrintingLabels: scryfallSpecialLabels(card),
    scryfallMetadata: {
      releasedAt: card.released_at ?? null,
      setType: card.set_type ?? null,
      promo: card.promo === true,
      promoTypes: card.promo_types ?? [],
      frameEffects: card.frame_effects ?? [],
      layout: card.layout ?? null,
    },
  });
}

function scryfallSpecialLabels(card: ScryfallCard) {
  const labels = new Set<string>();
  const set = card.set?.toUpperCase();
  const setName = card.set_name?.toLowerCase();
  const promoTypes = card.promo_types ?? [];
  const frameEffects = card.frame_effects ?? [];
  if (set === 'PLST' || setName === 'the list' || promoTypes.some((type) => normalizeScryfallTag(type) === 'the list')) labels.add('The List');
  if (card.promo) labels.add('Promo');
  for (const type of promoTypes) {
    const normalized = normalizeScryfallTag(type);
    if (normalized.includes('secret lair')) labels.add('Secret Lair');
    if (normalized.includes('commander')) labels.add('Commander');
  }
  for (const effect of frameEffects) {
    const normalized = normalizeScryfallTag(effect);
    if (normalized === 'showcase') labels.add('Showcase');
    if (normalized === 'borderless') labels.add('Borderless');
    if (normalized === 'extended art' || normalized === 'extendedart') labels.add('Extended Art');
    if (normalized === 'retro') labels.add('Retro Frame');
  }
  return [...labels];
}

function normalizeScryfallTag(value: string) {
  return value.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
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

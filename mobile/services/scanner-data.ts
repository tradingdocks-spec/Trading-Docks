import { supabase } from '@/lib/supabase';
import { currentInventoryWorkspace } from '@/services/inventory-workspace';
import { deliverScannerCommand, classifyScannerReplayError } from '@/services/scanner-replay';
import type { InventoryCommand } from '@/services/inventory-command';
import { buildStorageLocation, type StorageLocation } from '@/services/storage-location-manager';
import { appStorage } from '@/services/storage/app-storage';
import { prepareOfflineOperation, findOfflineOperation, processOfflineOperation } from '@/services/storage/offline';
import { loadInventoryQuantityTotal } from '@/services/inventory-quantity-total';
import { MOBILE_CANONICAL_SITE_URL } from '@/services/mobile-release-config';
import { validateScannerInventoryIdentity } from '@/services/scanner-inventory-authority';
import {
  SCANNER_COLLECTION_QUEUE_TYPE,
  buildScannerInventoryCommand,
  scannerIntentFingerprint,
  normalizeScannerCandidate,
  scannerDraftKey,
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
  confirmation, membershipTier, currentTotalQuantity, operationId, mayCreateCommand,
}: {
  confirmation: ScannerConfirmation;
  membershipTier: unknown;
  currentTotalQuantity: number;
  /** Stable persisted session/line identity; never generated by a delivery retry. */
  operationId: string;
  mayCreateCommand: boolean;
}): Promise<ScannerSaveResult> {
  if (!operationId) return { ok: false, error: 'A durable scanner operation identity is required.' };
  const original = JSON.parse(JSON.stringify(confirmation)) as ScannerConfirmation;
  const intentFingerprint = scannerIntentFingerprint(original);
  const operation = await prepareOfflineOperation(SCANNER_COLLECTION_QUEUE_TYPE, confirmation.userId, operationId, async () => {
    if (!mayCreateCommand) return { payload: { confirmation: original, inventoryItemId: operationId, idempotencyKey: operationId, intentFingerprint }, reviewReason: 'Legacy or previously attempted session line has no durable command. Verify its prior outcome.', uncertain: true };
    // Capture the intent before any asynchronous resolution. Later UI edits are
    // separate intent, never a patch of this operation.
    const validation = validateScannerConfirmation(original, { membershipTier, currentTotalQuantity });
    if (!validation.ok) return { payload: { confirmation: original, inventoryItemId: operationId, idempotencyKey: operationId, intentFingerprint }, reviewReason: validation.reason, uncertain: true };
    let command: InventoryCommand | undefined;
    let resolved = original;
    let reviewReason: string | undefined;
    if (original.addToWishlist || original.tradeStatus !== 'not_for_trade') {
      reviewReason = 'Scanner stock plus trade/wishlist changes require review; no part has been sent.';
    } else {
      try {
        if (!supabase) throw new Error('Identity and workspace must be confirmed before delivery.');
        const [{ data: auth }, { data: sessionData }] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);
        if (!auth.user || auth.user.id !== original.userId || !sessionData.session?.access_token) throw new Error('Sign in again to confirm this scan.');
        const workspaceId = await currentInventoryWorkspace(supabase);
        resolved = await validateScannerInventoryIdentity({ confirmation: original, accessToken: sessionData.session.access_token });
        const createdAt = new Date().toISOString();
        command = buildScannerInventoryCommand(resolved, operationId, workspaceId, createdAt);
      } catch {
        reviewReason = 'Identity or workspace could not be authoritatively confirmed. Review before delivery.';
      }
    }
    return { payload: { confirmation: resolved, inventoryItemId: operationId, idempotencyKey: operationId, intentFingerprint, command }, reviewReason, uncertain: !command };
  });
  if (operation.payload.intentFingerprint && operation.payload.intentFingerprint !== intentFingerprint) {
    return { ok: false, error: 'This scan already has a saved command with different details. Review its original outcome before creating a deliberate new inventory action.' };
  }
  if (operation.status === 'committed') {
    if (operation.errorCode === 'discarded_by_user') return { ok: false, error: 'This intent was discarded. Create a deliberate new intent to add another copy.' };
    return { ok: true, inventoryItemId: operationId };
  }
  const outcome = await processOfflineOperation(operationId, confirmation.userId, SCANNER_COLLECTION_QUEUE_TYPE,
    async (claimed) => { await deliverScannerCommand(claimed); },
    { retrySafe: Boolean(operation.payload.command), classify: classifyScannerReplayError });
  const persisted = await findOfflineOperation(operationId, confirmation.userId, SCANNER_COLLECTION_QUEUE_TYPE);
  if (outcome.status === 'committed' || (persisted?.status === 'committed' && !persisted.errorCode)) {
    // Draft cleanup is not part of mutation success; a cleanup failure cannot
    // recreate stock or demote a durable server acknowledgement.
    await clearScannerDraft(confirmation.userId).catch(() => {});
    return { ok: true, inventoryItemId: operationId };
  }
  return { ok: true, queued: true, inventoryItemId: operationId,
    warning: persisted?.status === 'review_required' ? 'Scan preserved for review. No automatic resubmission or new key.' : 'Original scanner command retained for safe retry.' };
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

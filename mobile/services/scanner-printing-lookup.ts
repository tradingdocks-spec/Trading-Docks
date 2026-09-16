import { normalizeScannerCandidate, type ScannerCardCandidate, type ScannerRecognitionResult } from './scanner-foundation.ts';

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

const printingLookupCache = new Map<string, { fetchedAt: number; candidates: ScannerCardCandidate[] }>();
const PRINTING_LOOKUP_CACHE_TTL_MS = 5 * 60 * 1000;

export async function lookupScannerPrintings(input: {
  oracleId?: string | null;
  online?: boolean;
}): Promise<ScannerRecognitionResult> {
  const online = input.online ?? true;
  const key = input.oracleId ? `oracle:${input.oracleId}` : 'oracle:missing';
  const cached = printingLookupCache.get(key);
  if (cached && Date.now() - cached.fetchedAt <= PRINTING_LOOKUP_CACHE_TTL_MS) {
    return { ok: true, candidates: cached.candidates, assisted: false };
  }
  if (!online) return { ok: false, reason: 'Printing lookup needs internet unless this card was opened earlier in the session.', offline: true };
  if (!input.oracleId) {
    return { ok: false, reason: 'Printing review requires a canonical card identity.' };
  }
  try {
    const query = `oracleid:${input.oracleId} game:paper`;
    const url = `https://api.scryfall.com/cards/search?${new URLSearchParams({
      q: query,
      unique: 'prints',
      order: 'released',
      dir: 'desc',
    }).toString()}`;
    const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'TradingDocksMobile/1.0 exact-printing-lookup' } });
    if (!response.ok) return { ok: false, reason: 'No other Scryfall printings were found.' };
    const payload = await response.json() as { data?: ScryfallCard[] };
    const candidates = (payload.data ?? []).map(cardToCandidate).filter((candidate): candidate is ScannerCardCandidate => Boolean(candidate));
    const invalid = candidates.filter((candidate) => candidate.oracleId !== input.oracleId);
    if (invalid.length > 0) {
      logPrintingLookup({
        requestedOracleId: input.oracleId,
        queryType: 'oracle_id',
        returnedCount: candidates.length,
        returnedNames: candidates.map((candidate) => candidate.name),
        returnedOracleIds: candidates.map((candidate) => candidate.oracleId).filter((value): value is string => Boolean(value)),
      });
      if (process.env.NODE_ENV !== 'production') {
        console.error('TD_PRINTING_LOOKUP_INVALID', {
          requestedOracleId: input.oracleId,
          invalidReturnedOracleIds: invalid.map((candidate) => candidate.oracleId),
          returnedNames: candidates.map((candidate) => candidate.name),
        });
      }
      return { ok: false, reason: 'Printing review returned mismatched card identities.' };
    }
    logPrintingLookup({
      requestedOracleId: input.oracleId,
      queryType: 'oracle_id',
      returnedCount: candidates.length,
      returnedNames: candidates.map((candidate) => candidate.name),
      returnedOracleIds: candidates.map((candidate) => candidate.oracleId).filter((value): value is string => Boolean(value)),
    });
    printingLookupCache.set(key, { fetchedAt: Date.now(), candidates });
    return { ok: true, candidates, assisted: false };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'Printing lookup is unavailable.', offline: true };
  }
}

export function clearScannerPrintingLookupCache() {
  printingLookupCache.clear();
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

function logPrintingLookup(input: {
  requestedOracleId: string;
  queryType: 'oracle_id';
  returnedCount: number;
  returnedNames: string[];
  returnedOracleIds: string[];
}) {
  if (process.env.NODE_ENV === 'production') return;
  console.info('TD_PRINTING_LOOKUP', input);
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

function normalizeScryfallTag(value: string) {
  return value.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
}

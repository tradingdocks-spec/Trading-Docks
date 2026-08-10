import {
  editScannerSessionLine,
  type ContinuousScannerSession,
  type ScannerSessionLine,
} from './continuous-offer-scanner.ts';
import type { CardFinish } from './collector-workspace.ts';
import type { ScannerCardCandidate } from './scanner-foundation.ts';

export type ScannerPriceEnrichmentResult =
  | { status: 'updated'; session: ContinuousScannerSession; price: number; source: 'scryfall'; trace: ScannerPricingTrace }
  | { status: 'unavailable' | 'stale' | 'already_priced'; session: ContinuousScannerSession; price: null; source: null; trace: ScannerPricingTrace };

export type ScannerPricingTrace = {
  captureId: string;
  sessionRowId: string;
  scryfallCardId: string;
  oracleId: string | null;
  cardName: string;
  setCode: string | null;
  collectorNumber: string | null;
  finish: string;
  pricesUsd: number | null;
  pricesUsdFoil: number | null;
  pricesUsdEtched: number | null;
  selectedPriceField: 'usd' | 'usd_foil' | 'usd_etched' | 'none';
  parsedValue: number | null;
  pricingOutcome: 'updated' | 'unavailable' | 'stale' | 'already_priced';
  enrichmentTargetRowId: string;
  persistenceResult: 'pending_react_state_persist' | 'not_attempted';
  offerRecalculationResult: 'recalculated' | 'not_recalculated';
  pricingLatencyMs: number | null;
};

export function selectScryfallScannerPrice(candidate: ScannerCardCandidate, finish: CardFinish | string) {
  const prices = candidate.marketPrice;
  if (!prices || prices.source !== 'scryfall') return null;
  const amount = finish === 'foil'
    ? prices.usdFoil
    : finish === 'etched'
      ? prices.usdEtched
      : prices.usd;
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

export function enrichScannerSessionLinePrice(input: {
  session: ContinuousScannerSession;
  lineId: string;
  stableScanId: string;
  candidate: ScannerCardCandidate;
  finish: CardFinish | string;
  fetchedAt?: string | null;
  startedAt?: number | null;
  now?: () => number;
}): ScannerPriceEnrichmentResult {
  const traceBase = createPricingTrace(input, 'none', null, 'not_attempted', 'not_recalculated');
  const line = input.session.lines.find((item) => item.id === input.lineId);
  if (!line || line.stableScanId !== input.stableScanId || !samePrinting(line, input.candidate)) {
    return { status: 'stale', session: input.session, price: null, source: null, trace: { ...traceBase, pricingOutcome: 'stale' } };
  }
  if (line.marketPrice !== null) return { status: 'already_priced', session: input.session, price: null, source: null, trace: { ...traceBase, pricingOutcome: 'already_priced' } };
  const selectedField = selectedScryfallPriceField(input.finish, input.candidate.marketPrice ?? null);
  const price = selectScryfallScannerPrice(input.candidate, input.finish);
  const trace = createPricingTrace(input, selectedField, price, 'pending_react_state_persist', price === null ? 'not_recalculated' : 'recalculated');
  if (price === null) {
    return {
      status: 'unavailable',
      session: editScannerSessionLine(input.session, input.lineId, { priceSource: 'unavailable', priceTimestamp: input.fetchedAt ?? input.candidate.marketPrice?.fetchedAt ?? new Date().toISOString() }),
      price: null,
      source: null,
      trace: { ...trace, pricingOutcome: 'unavailable' },
    };
  }
  return {
    status: 'updated',
    session: editScannerSessionLine(input.session, input.lineId, {
      marketPrice: price,
      priceSource: 'scryfall',
      priceTimestamp: input.fetchedAt ?? input.candidate.marketPrice?.fetchedAt ?? new Date().toISOString(),
    }),
    price,
    source: 'scryfall',
    trace: { ...trace, pricingOutcome: 'updated' },
  };
}

function samePrinting(line: ScannerSessionLine, candidate: ScannerCardCandidate) {
  return line.exactPrintingId === candidate.id
    && line.setCode === candidate.setCode
    && line.collectorNumber === candidate.collectorNumber;
}

function selectedScryfallPriceField(finish: CardFinish | string, prices: ScannerCardCandidate['marketPrice']) {
  if (!prices) return 'none';
  if (finish === 'etched' && prices.usdEtched !== null) return 'usd_etched';
  if (finish === 'foil' && prices.usdFoil !== null) return 'usd_foil';
  if (finish !== 'foil' && finish !== 'etched' && prices.usd !== null) return 'usd';
  return 'none';
}

function createPricingTrace(
  input: Parameters<typeof enrichScannerSessionLinePrice>[0],
  selectedPriceField: ScannerPricingTrace['selectedPriceField'],
  parsedValue: number | null,
  persistenceResult: ScannerPricingTrace['persistenceResult'],
  offerRecalculationResult: ScannerPricingTrace['offerRecalculationResult'],
): ScannerPricingTrace {
  const now = input.now?.() ?? null;
  return {
    captureId: input.stableScanId,
    sessionRowId: input.lineId,
    scryfallCardId: input.candidate.id,
    oracleId: input.candidate.oracleId ?? null,
    cardName: input.candidate.name,
    setCode: input.candidate.setCode,
    collectorNumber: input.candidate.collectorNumber,
    finish: String(input.finish),
    pricesUsd: input.candidate.marketPrice?.usd ?? null,
    pricesUsdFoil: input.candidate.marketPrice?.usdFoil ?? null,
    pricesUsdEtched: input.candidate.marketPrice?.usdEtched ?? null,
    selectedPriceField,
    parsedValue,
    pricingOutcome: 'unavailable',
    enrichmentTargetRowId: input.lineId,
    persistenceResult,
    offerRecalculationResult,
    pricingLatencyMs: typeof input.startedAt === 'number' && typeof now === 'number' ? Math.round(Math.max(0, now - input.startedAt)) : null,
  };
}

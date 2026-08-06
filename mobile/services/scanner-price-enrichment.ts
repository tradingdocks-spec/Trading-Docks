import {
  editScannerSessionLine,
  type ContinuousScannerSession,
  type ScannerSessionLine,
} from './continuous-offer-scanner.ts';
import type { CardFinish } from './collector-workspace.ts';
import type { ScannerCardCandidate } from './scanner-foundation.ts';

export type ScannerPriceEnrichmentResult =
  | { status: 'updated'; session: ContinuousScannerSession; price: number; source: 'scryfall' }
  | { status: 'unavailable' | 'stale' | 'already_priced'; session: ContinuousScannerSession; price: null; source: null };

export function selectScryfallScannerPrice(candidate: ScannerCardCandidate, finish: CardFinish | string) {
  const prices = candidate.marketPrice;
  if (!prices || prices.source !== 'scryfall') return null;
  const amount = finish === 'foil'
    ? prices.usdFoil ?? prices.usd
    : finish === 'etched'
      ? prices.usdEtched ?? prices.usdFoil ?? prices.usd
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
}): ScannerPriceEnrichmentResult {
  const line = input.session.lines.find((item) => item.id === input.lineId);
  if (!line || line.stableScanId !== input.stableScanId || !samePrinting(line, input.candidate)) {
    return { status: 'stale', session: input.session, price: null, source: null };
  }
  if (line.marketPrice !== null) return { status: 'already_priced', session: input.session, price: null, source: null };
  const price = selectScryfallScannerPrice(input.candidate, input.finish);
  if (price === null) return { status: 'unavailable', session: input.session, price: null, source: null };
  return {
    status: 'updated',
    session: editScannerSessionLine(input.session, input.lineId, {
      marketPrice: price,
      priceSource: 'scryfall',
      priceTimestamp: input.fetchedAt ?? input.candidate.marketPrice?.fetchedAt ?? new Date().toISOString(),
    }),
    price,
    source: 'scryfall',
  };
}

function samePrinting(line: ScannerSessionLine, candidate: ScannerCardCandidate) {
  return line.exactPrintingId === candidate.id
    && line.setCode === candidate.setCode
    && line.collectorNumber === candidate.collectorNumber;
}

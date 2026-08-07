import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addRecognitionToSession,
  calculateSessionTotals,
  createContinuousScannerSession,
  createRecognitionPipelineReport,
} from '../services/continuous-offer-scanner.ts';
import { enrichScannerSessionLinePrice, selectScryfallScannerPrice } from '../services/scanner-price-enrichment.ts';
import type { ScannerCardCandidate } from '../services/scanner-foundation.ts';

const candidate: ScannerCardCandidate = {
  id: 'sf-1',
  oracleId: 'oracle-1',
  name: 'Rhystic Study',
  setCode: 'WOT',
  setName: 'Wilds of Eldraine Enchanting Tales',
  collectorNumber: '25',
  finishes: ['normal', 'foil'],
  language: 'en',
  imageUrl: null,
  confidence: 0.95,
  recognitionMode: 'assisted_capture',
  marketPrice: { usd: 41.24, usdFoil: 65.5, usdEtched: null, source: 'scryfall', fetchedAt: '2026-08-06T00:00:00.000Z' },
};

const recognition = createRecognitionPipelineReport({
  detectedGame: 'magic',
  candidates: [candidate],
  confidence: {
    overall: 92,
    threshold: 82,
    requiresConfirmation: true,
    conflicts: [],
    signals: [],
  },
  recognitionMethod: 'metadata_assisted',
});

test('Scryfall scanner price selection respects finish and never returns zero', () => {
  assert.equal(selectScryfallScannerPrice(candidate, 'normal'), 41.24);
  assert.equal(selectScryfallScannerPrice(candidate, 'foil'), 65.5);
  assert.equal(selectScryfallScannerPrice({ ...candidate, finishes: ['etched'], marketPrice: { ...candidate.marketPrice!, usdEtched: 72.34 } }, 'etched'), 72.34);
  assert.equal(selectScryfallScannerPrice({ ...candidate, marketPrice: { ...candidate.marketPrice!, usd: 0, usdFoil: null } }, 'normal'), null);
  assert.equal(selectScryfallScannerPrice({ ...candidate, marketPrice: { ...candidate.marketPrice!, usdFoil: null } }, 'foil'), null);
});

test('scanner price enrichment updates the exact inserted nonfoil row and recalculates totals', () => {
  const session = addRecognitionToSession(createContinuousScannerSession({ id: 'session-1', userId: 'user-1', name: 'Session', mode: 'card_show_purchase' }), {
    stableScanId: 'scan-1',
    candidate,
    recognition,
    marketPrice: null,
    priceSource: 'pricing_pending',
    finish: 'normal',
  });
  const line = session.lines[0];

  const result = enrichScannerSessionLinePrice({ session, lineId: line.id, stableScanId: line.stableScanId, candidate, finish: 'normal', startedAt: 10, now: () => 35 });

  assert.equal(result.status, 'updated');
  assert.equal(result.price, 41.24);
  assert.equal(result.session.lines[0].id, line.id);
  assert.equal(result.session.lines[0].marketPrice, 41.24);
  assert.equal(result.session.lines[0].priceSource, 'scryfall');
  assert.equal(result.session.lines[0].cashOffer, 28.87);
  assert.equal(calculateSessionTotals(result.session).marketValue, 41.24);
  assert.equal(calculateSessionTotals(result.session).cashOffer, 28.87);
  assert.equal(result.trace.scryfallCardId, 'sf-1');
  assert.equal(result.trace.oracleId, 'oracle-1');
  assert.equal(result.trace.selectedPriceField, 'usd');
  assert.equal(result.trace.parsedValue, 41.24);
  assert.equal(result.trace.pricingLatencyMs, 25);
});

test('scanner price enrichment uses foil and etched Scryfall fields', () => {
  const foilSession = addRecognitionToSession(createContinuousScannerSession({ id: 'session-foil', userId: 'user-1', name: 'Session', mode: 'card_show_purchase' }), {
    stableScanId: 'scan-foil',
    candidate,
    recognition,
    marketPrice: null,
    finish: 'foil',
  });
  const etchedCandidate = { ...candidate, finishes: ['etched' as const], marketPrice: { ...candidate.marketPrice!, usdEtched: 72.34 } };
  const etchedSession = addRecognitionToSession(createContinuousScannerSession({ id: 'session-etched', userId: 'user-1', name: 'Session', mode: 'card_show_purchase' }), {
    stableScanId: 'scan-etched',
    candidate: etchedCandidate,
    recognition,
    marketPrice: null,
    finish: 'etched',
  });

  const foil = enrichScannerSessionLinePrice({ session: foilSession, lineId: foilSession.lines[0].id, stableScanId: 'scan-foil', candidate, finish: 'foil' });
  const etched = enrichScannerSessionLinePrice({ session: etchedSession, lineId: etchedSession.lines[0].id, stableScanId: 'scan-etched', candidate: etchedCandidate, finish: 'etched' });

  assert.equal(foil.session.lines[0].marketPrice, 65.5);
  assert.equal(foil.trace.selectedPriceField, 'usd_foil');
  assert.equal(etched.session.lines[0].marketPrice, 72.34);
  assert.equal(etched.trace.selectedPriceField, 'usd_etched');
});

test('scanner price enrichment survives persisted session reload and refreshes review totals', () => {
  const session = addRecognitionToSession(createContinuousScannerSession({ id: 'session-persist', userId: 'user-1', name: 'Session', mode: 'card_show_purchase' }), {
    stableScanId: 'scan-1',
    candidate,
    recognition,
    marketPrice: null,
  });
  const enriched = enrichScannerSessionLinePrice({ session, lineId: session.lines[0].id, stableScanId: 'scan-1', candidate, finish: 'normal' }).session;
  const reloaded = JSON.parse(JSON.stringify(enriched)) as typeof enriched;

  assert.equal(reloaded.lines[0].marketPrice, 41.24);
  assert.equal(reloaded.lines[0].cashOffer, 28.87);
  assert.equal(calculateSessionTotals(reloaded).marketValue, 41.24);
});

test('scanner price enrichment does not overwrite manual prices or stale rows', () => {
  const session = addRecognitionToSession(createContinuousScannerSession({ id: 'session-2', userId: 'user-1', name: 'Session', mode: 'card_show_purchase' }), {
    stableScanId: 'scan-1',
    candidate,
    recognition,
    marketPrice: 12,
    priceSource: 'manual',
  });
  const line = session.lines[0];

  const alreadyPriced = enrichScannerSessionLinePrice({ session, lineId: line.id, stableScanId: line.stableScanId, candidate, finish: 'normal' });
  const stale = enrichScannerSessionLinePrice({ session, lineId: line.id, stableScanId: 'different-scan', candidate, finish: 'normal' });
  const wrongCandidate = enrichScannerSessionLinePrice({ session, lineId: line.id, stableScanId: line.stableScanId, candidate: { ...candidate, id: 'sf-other' }, finish: 'normal' });

  assert.equal(alreadyPriced.status, 'already_priced');
  assert.equal(alreadyPriced.session.lines[0].marketPrice, 12);
  assert.equal(alreadyPriced.session.lines[0].priceSource, 'manual');
  assert.equal(stale.status, 'stale');
  assert.equal(stale.session.lines[0].marketPrice, 12);
  assert.equal(wrongCandidate.status, 'stale');
  assert.equal(wrongCandidate.session.lines[0].marketPrice, 12);
});

test('scanner price enrichment preserves unavailable prices as null', () => {
  const unpricedCandidate = { ...candidate, marketPrice: null };
  const session = addRecognitionToSession(createContinuousScannerSession({ id: 'session-3', userId: 'user-1', name: 'Session', mode: 'card_show_purchase' }), {
    stableScanId: 'scan-1',
    candidate: unpricedCandidate,
    recognition,
    marketPrice: null,
  });
  const line = session.lines[0];

  const result = enrichScannerSessionLinePrice({ session, lineId: line.id, stableScanId: line.stableScanId, candidate: unpricedCandidate, finish: 'normal' });

  assert.equal(result.status, 'unavailable');
  assert.equal(result.session.lines[0].marketPrice, null);
  assert.equal(result.session.lines[0].cashOffer, null);
  assert.equal(result.session.lines[0].priceSource, 'unavailable');
});

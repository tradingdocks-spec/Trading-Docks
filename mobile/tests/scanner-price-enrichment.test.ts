import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addRecognitionToSession,
  createContinuousScannerSession,
  createRecognitionPipelineReport,
} from '../services/continuous-offer-scanner.ts';
import { enrichScannerSessionLinePrice, selectScryfallScannerPrice } from '../services/scanner-price-enrichment.ts';
import type { ScannerCardCandidate } from '../services/scanner-foundation.ts';

const candidate: ScannerCardCandidate = {
  id: 'sf-1',
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
  assert.equal(selectScryfallScannerPrice({ ...candidate, marketPrice: { ...candidate.marketPrice!, usd: 0, usdFoil: null } }, 'normal'), null);
});

test('scanner price enrichment updates the intended unpriced session line', () => {
  const session = addRecognitionToSession(createContinuousScannerSession({ id: 'session-1', userId: 'user-1', name: 'Session', mode: 'card_show_purchase' }), {
    stableScanId: 'scan-1',
    candidate,
    recognition,
    marketPrice: null,
  });
  const line = session.lines[0];

  const result = enrichScannerSessionLinePrice({ session, lineId: line.id, stableScanId: line.stableScanId, candidate, finish: 'foil' });

  assert.equal(result.status, 'updated');
  assert.equal(result.price, 65.5);
  assert.equal(result.session.lines[0].marketPrice, 65.5);
  assert.equal(result.session.lines[0].priceSource, 'scryfall');
  assert.equal(result.session.lines[0].cashOffer, 45.85);
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

  assert.equal(alreadyPriced.status, 'already_priced');
  assert.equal(alreadyPriced.session.lines[0].marketPrice, 12);
  assert.equal(alreadyPriced.session.lines[0].priceSource, 'manual');
  assert.equal(stale.status, 'stale');
  assert.equal(stale.session.lines[0].marketPrice, 12);
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
});

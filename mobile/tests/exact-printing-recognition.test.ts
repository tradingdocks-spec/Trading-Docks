import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addRecognitionToSession,
  createContinuousScannerSession,
  createRecognitionPipelineReport,
  updateScannerSessionLineFinish,
  updateScannerSessionLinePrinting,
} from '../services/continuous-offer-scanner.ts';
import {
  defaultFinishForPrinting,
  evaluateListPrintingConsistency,
  parseBottomLeftPrintingText,
  refineExactPrintingConfidence,
  supportedVisibleFinishes,
} from '../services/exact-printing-recognition.ts';
import { clearScannerPrintingLookupCache, lookupScannerPrintings } from '../services/scanner-printing-lookup.ts';
import { selectScryfallScannerPrice } from '../services/scanner-price-enrichment.ts';
import type { ScannerCardCandidate } from '../services/scanner-foundation.ts';
import type { RecognitionConfidence } from '../services/scanner-intelligence.ts';

const listCandidate: ScannerCardCandidate = {
  id: 'sf-list',
  oracleId: 'oracle-brainstorm',
  name: 'Brainstorm',
  setCode: 'PLST',
  setName: 'The List',
  collectorNumber: '123',
  finishes: ['normal', 'foil'],
  language: 'en',
  imageUrl: 'https://img.example/list.jpg',
  confidence: 0.92,
  recognitionMode: 'assisted_capture',
  marketPrice: { usd: 3.25, usdFoil: 9.5, usdEtched: null, source: 'scryfall', fetchedAt: '2026-08-06T00:00:00.000Z' },
  specialPrintingLabels: ['The List'],
  scryfallMetadata: { releasedAt: '2024-01-01', setType: 'memorabilia', promo: false, promoTypes: [], frameEffects: [], layout: 'normal' },
};

const regularCandidate: ScannerCardCandidate = {
  ...listCandidate,
  id: 'sf-regular',
  setCode: 'STA',
  setName: 'Strixhaven Mystical Archive',
  collectorNumber: '13',
  specialPrintingLabels: [],
  scryfallMetadata: { releasedAt: '2021-04-23', setType: 'expansion', promo: false, promoTypes: [], frameEffects: [], layout: 'normal' },
};

const etchedCandidate: ScannerCardCandidate = {
  ...regularCandidate,
  id: 'sf-etched',
  finishes: ['normal', 'foil', 'etched'],
  marketPrice: { usd: 4, usdFoil: 10, usdEtched: 22, source: 'scryfall', fetchedAt: '2026-08-06T00:00:00.000Z' },
};

const confidence: RecognitionConfidence = {
  overall: 88,
  threshold: 82,
  requiresConfirmation: false,
  conflicts: [],
  signals: [
    { key: 'name_ocr', label: 'Name OCR', score: 94, weight: 0.22, evidence: 'Brainstorm' },
  ],
};

test('bottom-left printing parser extracts collector number set code and language from noisy OCR', () => {
  const parsed = parseBottomLeftPrintingText('  * PLST 123 EN  The List ');
  assert.equal(parsed.parsedSetCode, 'PLST');
  assert.equal(parsed.parsedCollectorNumber, '123');
  assert.equal(parsed.parsedLanguage, 'en');
  assert.equal(parsed.listIndicatorObserved, true);
});

test('empty bottom-left region remains non-blocking missing evidence', () => {
  const parsed = parseBottomLeftPrintingText('');
  assert.equal(parsed.parsedSetCode, null);
  assert.equal(parsed.parsedCollectorNumber, null);
  assert.equal(parsed.listIndicatorObserved, false);
});

test('The List signal is validated against Scryfall metadata and conflicts mark review', () => {
  const evidence = parseBottomLeftPrintingText('THE LIST PLST 123 EN');
  assert.equal(evaluateListPrintingConsistency(listCandidate, evidence), 'consistent');
  assert.equal(evaluateListPrintingConsistency(regularCandidate, evidence), 'conflict');
  const refined = refineExactPrintingConfidence({ candidate: regularCandidate, confidence, evidence });
  assert.equal(refined.listConsistency, 'conflict');
  assert.equal(refined.confidence.requiresConfirmation, true);
  assert.ok(refined.confidence.conflicts.some((entry) => /The List/.test(entry)));
});

test('no visual list signal does not invent The List, but list candidate still needs review', () => {
  const evidence = parseBottomLeftPrintingText('STA 13 EN');
  assert.equal(evaluateListPrintingConsistency(regularCandidate, evidence), 'not_observed');
  assert.equal(evaluateListPrintingConsistency(listCandidate, evidence), 'candidate_not_list');
});

test('finish selector only exposes supported visible finishes and exact price fields', () => {
  assert.deepEqual(supportedVisibleFinishes(etchedCandidate), ['normal', 'foil', 'etched']);
  assert.equal(selectScryfallScannerPrice(etchedCandidate, 'normal'), 4);
  assert.equal(selectScryfallScannerPrice(etchedCandidate, 'foil'), 10);
  assert.equal(selectScryfallScannerPrice(etchedCandidate, 'etched'), 22);
  assert.equal(selectScryfallScannerPrice({ ...etchedCandidate, marketPrice: { ...etchedCandidate.marketPrice!, usdFoil: null } }, 'foil'), null);
});

test('finish changes update the same session row and recalculate offer', () => {
  const session = addRecognitionToSession(createContinuousScannerSession({ id: 's1', userId: 'u1', name: 'Review', mode: 'card_show_purchase' }), {
    stableScanId: 'scan-1',
    candidate: etchedCandidate,
    recognition: createRecognitionPipelineReport({ detectedGame: 'magic', candidates: [etchedCandidate], confidence, recognitionMethod: 'metadata_assisted' }),
    finish: 'normal',
    marketPrice: 4,
  });
  const line = session.lines[0];
  const updated = updateScannerSessionLineFinish(session, line.id, 'foil').session;
  assert.equal(updated.lines[0].id, line.id);
  assert.equal(updated.lines[0].finish, 'foil');
  assert.equal(updated.lines[0].marketPrice, 10);
  assert.equal(updated.lines[0].cashOffer, 7);
});

test('selecting another printing updates the same row and preserves unsupported finish as unresolved', () => {
  const foilOnly = { ...regularCandidate, finishes: ['foil' as const], marketPrice: { ...regularCandidate.marketPrice!, usdFoil: 12 } };
  const session = addRecognitionToSession(createContinuousScannerSession({ id: 's2', userId: 'u1', name: 'Review', mode: 'card_show_purchase' }), {
    stableScanId: 'scan-2',
    candidate: etchedCandidate,
    recognition: createRecognitionPipelineReport({ detectedGame: 'magic', candidates: [etchedCandidate], confidence, recognitionMethod: 'metadata_assisted' }),
    finish: 'etched',
    marketPrice: 22,
  });
  const line = session.lines[0];
  const fallback = defaultFinishForPrinting(foilOnly, 'etched');
  const updated = updateScannerSessionLinePrinting(session, line.id, foilOnly);
  assert.equal(fallback.finish, 'unknown');
  assert.equal(updated.session.lines[0].id, line.id);
  assert.equal(updated.session.lines[0].exactPrintingId, 'sf-regular');
  assert.equal(updated.session.lines[0].finish, 'unknown');
  assert.match(updated.fallbackMessage ?? '', /Review required/);
});

test('other-printings lookup caches repeated Scryfall responses', async () => {
  const previousFetch = globalThis.fetch;
  clearScannerPrintingLookupCache();
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return {
      ok: true,
      json: async () => ({ data: [{ id: 'sf-cache', oracle_id: 'oracle-cache', name: 'Brainstorm', set: 'STA', set_name: 'Strixhaven', collector_number: '13', lang: 'en', finishes: ['nonfoil'], prices: { usd: '1.23' } }] }),
    } as Response;
  }) as typeof fetch;
  try {
    const first = await lookupScannerPrintings({ oracleId: 'oracle-cache', name: 'Brainstorm' });
    const second = await lookupScannerPrintings({ oracleId: 'oracle-cache', name: 'Brainstorm' });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';

import type { ScannerCardCandidate } from '../services/scanner-foundation.ts';
import type { RecognitionConfidence } from '../services/scanner-intelligence.ts';
import {
  DEFAULT_CONTINUOUS_SCANNER_THRESHOLDS,
  TRADING_CARD_GUIDE_RATIO,
  addRecognitionToSession,
  bulkConfirmReviewedCards,
  buildContinuousScannerCsvRows,
  buildScannerCollectionConfirmation,
  calculateCardGuideLayout,
  calculateSessionTotals,
  classifyContinuousConfidence,
  continuousScannerSessionKey,
  createContinuousScannerRuntime,
  createContinuousScannerSession,
  createRecognitionPipelineReport,
  activeSessionFilterSummary,
  defaultSessionReviewFilters,
  editScannerSessionLine,
  evaluateBoundaryQuality,
  filterSessionReviewLines,
  formatSessionReviewMoney,
  hasAdvancedSessionFilters,
  filterScannerSessionLines,
  isDuplicateScan,
  markCaptureStarted,
  markReadyForNext,
  markScanResult,
  nextContinuousScannerRuntime,
  nextReviewLine,
  removeScannerSessionLine,
  reviewedProgressLabel,
  scannerModeUsesOfferWorkspace,
  serializeContinuousScannerCsv,
  sessionFinalizeEligibility,
  sessionReviewMetrics,
  shouldAutoCapture,
  undoMostRecentScan,
  type CardBoundaryObservation,
  type ContinuousScannerSession,
} from '../services/continuous-offer-scanner.ts';

const candidate: ScannerCardCandidate = {
  id: 'scryfall-1',
  name: 'Rhystic Study',
  setCode: 'WOT',
  setName: 'Wilds of Eldraine',
  collectorNumber: '25',
  finishes: ['normal', 'foil'],
  language: 'en',
  confidence: 0.91,
  recognitionMode: 'assisted_capture',
};

const confidence: RecognitionConfidence = {
  overall: 91,
  threshold: 82,
  requiresConfirmation: false,
  conflicts: [],
  signals: [
    { key: 'name_ocr', label: 'Name OCR', score: 92, weight: 0.2, evidence: 'Rhystic Study' },
    { key: 'collector_number', label: 'Collector number', score: 91, weight: 0.16, evidence: '25' },
  ],
};

test('card guide uses standard 63 by 88 portrait ratio and stays centered', () => {
  const layout = calculateCardGuideLayout({ containerWidth: 390, containerHeight: 700, safeTop: 24, safeBottom: 34 });
  assert.equal(Number(layout.ratio.toFixed(3)), Number(TRADING_CARD_GUIDE_RATIO.toFixed(3)));
  assert.ok(Math.abs((layout.width / layout.height) - TRADING_CARD_GUIDE_RATIO) < 0.003);
  assert.ok(layout.left > 0);
  assert.ok(layout.top >= 24);
});

test('boundary quality reports card not fully visible and edge guidance', () => {
  const quality = evaluateBoundaryQuality(observation({ fullyInsideGuide: false, cornersVisible: false }));
  assert.equal(quality.ready, false);
  assert.ok(quality.missingChecks.includes('four_corners'));
  assert.ok(quality.guidance.includes('Card edge not visible'));
  assert.ok(quality.guidance.includes('Center the card'));
});

test('motion blur lighting and glare produce distinct non-color guidance', () => {
  const quality = evaluateBoundaryQuality(observation({
    motionScore: 0.7,
    blurScore: 0.5,
    lightingScore: 0.2,
    glareScore: 0.8,
  }));
  assert.equal(quality.ready, false);
  assert.ok(quality.guidance.includes('Hold steady'));
  assert.ok(quality.guidance.includes('Improve lighting'));
  assert.ok(quality.guidance.includes('Reduce glare'));
});

test('stable quality frame becomes eligible for auto capture', () => {
  const runtime = createContinuousScannerRuntime({ scanId: 'scan-1' });
  const next = nextContinuousScannerRuntime(runtime, observation());
  assert.equal(next.state, 'capturing');
  assert.equal(shouldAutoCapture(next), true);
});

test('manual capture fallback can enter recognizing state without quality gates', () => {
  const runtime = createContinuousScannerRuntime({ scanId: 'scan-manual' });
  assert.equal(markCaptureStarted(runtime).state, 'recognizing');
});

test('cooldown and same-card duplicate protection prevent repeated scan frames', () => {
  let runtime = createContinuousScannerRuntime({ scanId: 'scan-1' });
  runtime = markScanResult(runtime, { printingId: candidate.id, fingerprint: 'frame-abc', now: 1000 });
  assert.equal(runtime.duplicateProtection.awaitingCardRemoval, true);
  assert.equal(isDuplicateScan(runtime.duplicateProtection, { printingId: candidate.id, fingerprint: 'frame-abc', now: 1500 }), true);
  const next = nextContinuousScannerRuntime(runtime, observation({ observedAt: 1600 }), DEFAULT_CONTINUOUS_SCANNER_THRESHOLDS, 1600);
  assert.equal(next.state, 'cooldown');
});

test('card removal detection makes scanner ready for next card', () => {
  const runtime = markScanResult(createContinuousScannerRuntime({ scanId: 'scan-1' }), { printingId: candidate.id, fingerprint: 'frame-abc', now: 1000 });
  const removed = nextContinuousScannerRuntime(runtime, observation({ cardPresent: false, guideFillRatio: 0, observedAt: 2500 }), DEFAULT_CONTINUOUS_SCANNER_THRESHOLDS, 2500);
  const ready = markReadyForNext(removed, 'scan-2');
  assert.equal(ready.duplicateProtection.awaitingCardRemoval, false);
  assert.equal(ready.state, 'ready_for_next');
});

test('high-confidence recognition is suggested by default instead of silently finalized', () => {
  const session = createContinuousScannerSession({ id: 'session-1', userId: 'user-1', name: 'Show buy', mode: 'card_show_purchase' });
  const recognition = createRecognitionPipelineReport({ detectedGame: 'magic', candidates: [candidate], confidence, recognitionMethod: 'metadata_assisted' });
  const next = addRecognitionToSession(session, { stableScanId: 'scan-1', candidate, recognition, marketPrice: 20, createdAt: '2026-08-05T00:00:00.000Z' });
  assert.equal(next.lines[0].reviewStatus, 'suggested');
  assert.equal(next.lines[0].cashOffer, 14);
  assert.equal(next.lines[0].tradeValue, 16);
});

test('ambiguous recognition enters review queue and missing signals are explicit', () => {
  const lowConfidence = { ...confidence, overall: 61, requiresConfirmation: true, signals: [{ ...confidence.signals[0], score: null, evidence: 'Missing name signal' }] };
  const recognition = createRecognitionPipelineReport({ detectedGame: 'magic', candidates: [candidate], confidence: lowConfidence, recognitionMethod: 'metadata_assisted' });
  const session = addRecognitionToSession(createContinuousScannerSession({ id: 'session-1', userId: 'user-1', name: 'Trade', mode: 'trade_evaluation' }), { stableScanId: 'scan-1', candidate, recognition });
  assert.equal(recognition.confidenceState, 'manual_review_required');
  assert.deepEqual(recognition.missingSignals, ['Name OCR']);
  assert.equal(session.lines[0].reviewStatus, 'needs_review');
});

test('failed recognition can be represented without invented printing or price', () => {
  const recognition = createRecognitionPipelineReport({ detectedGame: 'unknown', candidates: [], confidence: { ...confidence, overall: 0, requiresConfirmation: true, conflicts: ['No candidates resolved.'], signals: [] }, recognitionMethod: 'unavailable' });
  const session = addRecognitionToSession(createContinuousScannerSession({ id: 'session-1', userId: 'user-1', name: 'Mixed', mode: 'mixed_tcg_intake' }), { stableScanId: 'scan-1', candidate: null, recognition });
  assert.equal(session.lines[0].cardName, 'Unrecognized card');
  assert.equal(session.lines[0].marketPrice, null);
  assert.equal(calculateSessionTotals(session).missingPriceItems, 1);
});

test('foil evidence remains indeterminate without benchmarked frames', () => {
  const recognition = createRecognitionPipelineReport({ detectedGame: 'magic', candidates: [candidate], confidence, recognitionMethod: 'metadata_assisted' });
  assert.equal(recognition.finish.finish, 'indeterminate');
  assert.equal(classifyContinuousConfidence({ overall: 75, requiresConfirmation: true, conflicts: [] }), 'ambiguous');
});

test('percentage changes recalculate cash and trade values without using missing price as zero', () => {
  const session = addRecognitionToSession(
    createContinuousScannerSession({ id: 'session-1', userId: 'user-1', name: 'Offer', mode: 'collection_purchase' }),
    { stableScanId: 'scan-1', candidate, recognition: createRecognitionPipelineReport({ detectedGame: 'magic', candidates: [candidate], confidence, recognitionMethod: 'metadata_assisted' }), marketPrice: 20 },
  );
  const edited = editScannerSessionLine(session, session.lines[0].id, { purchasePercentage: 65, marketPrice: null });
  assert.equal(edited.lines[0].cashOffer, null);
  assert.equal(calculateSessionTotals(edited).marketValue, null);
});

test('session persistence key is user scoped', () => {
  assert.notEqual(continuousScannerSessionKey('user-1'), continuousScannerSessionKey('user-2'));
  assert.ok(continuousScannerSessionKey('user-1').includes('user-1'));
});

test('undo, remove, filters, and bulk confirm operate on session lines', () => {
  const recognition = createRecognitionPipelineReport({ detectedGame: 'magic', candidates: [candidate], confidence: { ...confidence, overall: 70, requiresConfirmation: true }, recognitionMethod: 'metadata_assisted' });
  let session: ContinuousScannerSession = addRecognitionToSession(createContinuousScannerSession({ id: 'session-1', userId: 'user-1', name: 'Review', mode: 'card_show_purchase' }), { stableScanId: 'scan-1', candidate, recognition });
  assert.equal(filterScannerSessionLines(session.lines, { status: 'needs_review' }).length, 1);
  session = bulkConfirmReviewedCards(session);
  assert.equal(session.lines[0].reviewStatus, 'confirmed');
  const undone = undoMostRecentScan(session);
  assert.equal(undone.lines.length, 0);
  assert.equal(undone.undoneLines.length, 1);
  const removed = removeScannerSessionLine(session, session.lines[0].id);
  assert.equal(removed.lines.length, 0);
});

test('session review summary exposes at most four primary metrics and never substitutes missing price as zero', () => {
  const recognition = createRecognitionPipelineReport({ detectedGame: 'magic', candidates: [candidate], confidence, recognitionMethod: 'metadata_assisted' });
  const session = addRecognitionToSession(createContinuousScannerSession({ id: 'session-1', userId: 'user-1', name: 'Review', mode: 'card_show_purchase' }), { stableScanId: 'scan-1', candidate, recognition, marketPrice: null });
  const metrics = sessionReviewMetrics(calculateSessionTotals(session));
  assert.equal(metrics.length, 4);
  assert.deepEqual(metrics.map((metric) => metric.id), ['cards', 'needs_review', 'missing_price', 'offer_total']);
  assert.equal(metrics.find((metric) => metric.id === 'offer_total')?.value, '—');
  assert.equal(formatSessionReviewMoney(null), '—');
});

test('session review advanced filters stay separate from default status tabs', () => {
  const defaults = defaultSessionReviewFilters();
  assert.equal(defaults.status, 'all');
  assert.equal(defaults.game, 'all');
  assert.equal(defaults.confidence, 'all');
  assert.equal(defaults.missingPriceOnly, false);
  assert.equal(hasAdvancedSessionFilters(defaults), false);
  const filtered = { ...defaults, game: 'magic' as const, status: 'needs_review' as const, missingPriceOnly: true };
  assert.equal(hasAdvancedSessionFilters(filtered), true);
  assert.equal(activeSessionFilterSummary(filtered), 'Magic • Needs review • Missing price');
});

test('session review filtering sorting and review-next prioritize unresolved cards', () => {
  const high = createRecognitionPipelineReport({ detectedGame: 'magic', candidates: [candidate], confidence, recognitionMethod: 'metadata_assisted' });
  const low = createRecognitionPipelineReport({ detectedGame: 'pokemon', candidates: [{ ...candidate, id: 'pk-1', name: 'Pikachu', setCode: 'SVI' }], confidence: { ...confidence, overall: 65, requiresConfirmation: true }, recognitionMethod: 'future_visual_provider' });
  let session: ContinuousScannerSession = createContinuousScannerSession({ id: 'session-1', userId: 'user-1', name: 'Review', mode: 'card_show_purchase' });
  session = addRecognitionToSession(session, { stableScanId: 'scan-1', candidate, recognition: high, marketPrice: 10, createdAt: '2026-08-05T00:00:00.000Z' });
  session = addRecognitionToSession(session, { stableScanId: 'scan-2', candidate: low.topCandidate, recognition: low, marketPrice: null, createdAt: '2026-08-05T00:01:00.000Z' });
  const defaults = defaultSessionReviewFilters();
  const visible = filterSessionReviewLines(session.lines, defaults);
  assert.equal(visible[0].reviewStatus, 'needs_review');
  assert.equal(nextReviewLine(session.lines)?.cardName, 'Pikachu');
  assert.equal(reviewedProgressLabel(session), '1 of 2 reviewed');
  assert.equal(filterSessionReviewLines(session.lines, { ...defaults, game: 'magic' }).length, 1);
  assert.equal(filterSessionReviewLines(session.lines, { ...defaults, missingPriceOnly: true }).length, 1);
});

test('session review finalization requires all unresolved cards to be reviewed', () => {
  const high = createRecognitionPipelineReport({ detectedGame: 'magic', candidates: [candidate], confidence, recognitionMethod: 'metadata_assisted' });
  const low = createRecognitionPipelineReport({ detectedGame: 'magic', candidates: [candidate], confidence: { ...confidence, overall: 65, requiresConfirmation: true }, recognitionMethod: 'metadata_assisted' });
  let session: ContinuousScannerSession = createContinuousScannerSession({ id: 'session-1', userId: 'user-1', name: 'Review', mode: 'card_show_purchase' });
  session = addRecognitionToSession(session, { stableScanId: 'scan-1', candidate, recognition: high, marketPrice: 10 });
  session = addRecognitionToSession(session, { stableScanId: 'scan-2', candidate, recognition: low, marketPrice: 10 });
  assert.equal(sessionFinalizeEligibility(session).canFinalize, false);
  session = editScannerSessionLine(session, session.lines[1].id, { reviewStatus: 'confirmed' });
  const eligibility = sessionFinalizeEligibility(session);
  assert.equal(eligibility.canFinalize, true);
  assert.equal(eligibility.readyCount, 2);
});

test('confirmed collection destination can produce scanner confirmation payload', () => {
  const recognition = createRecognitionPipelineReport({ detectedGame: 'magic', candidates: [candidate], confidence, recognitionMethod: 'metadata_assisted' });
  let session: ContinuousScannerSession = addRecognitionToSession(createContinuousScannerSession({ id: 'session-1', userId: 'user-1', name: 'Collection', mode: 'collection_intake', autoConfirm: 'auto_confirm_high_confidence' }), { stableScanId: 'scan-1', candidate, recognition, destination: 'collection', storageLocationId: 'loc-1' });
  session = bulkConfirmReviewedCards(session);
  const confirmation = buildScannerCollectionConfirmation(session.lines[0], 'user-1');
  assert.equal(confirmation?.candidate.id, candidate.id);
  assert.equal(confirmation?.storageLocationId, 'loc-1');
});

test('CSV export includes offer session fields and keeps missing prices blank', () => {
  const recognition = createRecognitionPipelineReport({ detectedGame: 'magic', candidates: [candidate], confidence, recognitionMethod: 'metadata_assisted' });
  const session = addRecognitionToSession(createContinuousScannerSession({ id: 'session-1', userId: 'user-1', name: 'CSV', mode: 'card_show_purchase' }), { stableScanId: 'scan-1', candidate, recognition, marketPrice: null, notes: 'Needs review' });
  const rows = buildContinuousScannerCsvRows(session);
  const csv = serializeContinuousScannerCsv(rows);
  assert.match(csv, /"Card Show Purchase"/);
  assert.match(csv, /"Pricing unavailable"|,,/);
  assert.match(csv, /"Needs review"/);
});

test('mixed-game session totals include each detected game', () => {
  const magic = createRecognitionPipelineReport({ detectedGame: 'magic', candidates: [candidate], confidence, recognitionMethod: 'metadata_assisted' });
  const pokemon = createRecognitionPipelineReport({ detectedGame: 'pokemon', candidates: [{ ...candidate, id: 'pk-1', name: 'Pikachu', setCode: 'SVI' }], confidence, recognitionMethod: 'future_visual_provider' });
  let session: ContinuousScannerSession = createContinuousScannerSession({ id: 'session-1', userId: 'user-1', name: 'Mixed', mode: 'mixed_tcg_intake' });
  session = addRecognitionToSession(session, { stableScanId: 'scan-1', candidate, recognition: magic, quantity: 2 });
  session = addRecognitionToSession(session, { stableScanId: 'scan-2', candidate: pokemon.topCandidate, recognition: pokemon, quantity: 1 });
  const totals = calculateSessionTotals(session);
  assert.equal(totals.gameTotals.magic?.quantity, 2);
  assert.equal(totals.gameTotals.pokemon?.quantity, 1);
  assert.equal(scannerModeUsesOfferWorkspace('card_show_purchase'), true);
});

function observation(overrides: Partial<CardBoundaryObservation> & { cornersVisible?: boolean } = {}): CardBoundaryObservation {
  const visible = overrides.cornersVisible ?? true;
  return {
    corners: [
      { x: 0.15, y: 0.1, visible },
      { x: 0.85, y: 0.1, visible },
      { x: 0.85, y: 0.9, visible },
      { x: 0.15, y: 0.9, visible },
    ],
    fullyInsideGuide: true,
    guideFillRatio: 0.76,
    perspectiveScore: 0.08,
    motionScore: 0.05,
    blurScore: 0.08,
    glareScore: 0.1,
    lightingScore: 0.82,
    stabilityMs: 750,
    cardPresent: true,
    orientation: 'portrait',
    imageFingerprint: 'frame-abc',
    observedAt: 1000,
    ...overrides,
  };
}

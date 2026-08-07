import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyScannerFastIdentity,
  createScannerFastIdentityPlan,
  scannerFastIdentityLatency,
} from '../services/scanner-fast-identity-pipeline.ts';

const candidate = {
  id: 'sf-brainstorm',
  oracleId: 'oracle-brainstorm',
  name: 'Brainstorm',
  setCode: 'STA',
  setName: 'Strixhaven Mystical Archive',
  collectorNumber: '13',
  finishes: ['normal'],
  language: 'en',
  imageUrl: null,
  confidence: 0.91,
  recognitionMode: 'assisted_capture' as const,
  marketPrice: null,
};

function scan(overall: number, withPrintingEvidence: boolean, candidates = [candidate]) {
  return {
    ok: true as const,
    candidates,
    recognition: {
      ok: true as const,
      candidates,
      selected: candidates[0] ?? null,
      source: 'injected' as const,
      confidence: {
        overall,
        threshold: 82,
        requiresConfirmation: !withPrintingEvidence,
        conflicts: [],
        signals: [],
      },
      explanation: [],
    },
    signals: {
      collectorInfo: withPrintingEvidence ? { setCode: 'STA', collectorNumber: '13', language: 'en', confidence: 80 } : null,
    },
  };
}

test('strong name plus printing evidence classifies as Exact', () => {
  assert.equal(classifyScannerFastIdentity(scan(91, true)), 'exact');
});

test('strong name without printing evidence classifies as Suggested', () => {
  assert.equal(classifyScannerFastIdentity(scan(69, false)), 'suggested');
});

test('weak but present candidate classifies as Needs Review', () => {
  assert.equal(classifyScannerFastIdentity(scan(40, false)), 'needs_review');
});

test('missing candidate classifies as Failed', () => {
  assert.equal(classifyScannerFastIdentity(scan(0, false, [])), 'failed');
  assert.equal(classifyScannerFastIdentity({ ok: false }), 'failed');
});

test('fast identity plan inserts before collector OCR and pricing refinement', () => {
  const plan = createScannerFastIdentityPlan({
    scan: scan(69, false),
    captureStartedAt: 100,
    titleOcrCompletedAt: 160,
    lookupCompletedAt: 210,
    sessionInsertedAt: 235,
    collectorRefinementStartedAt: 250,
    pricingStartedAt: 260,
  });
  const latency = scannerFastIdentityLatency(plan.timing);

  assert.equal(plan.canInsertBeforeRefinement, true);
  assert.deepEqual(plan.eventOrder, [
    'capture_started',
    'title_ocr_completed',
    'lookup_completed',
    'session_inserted',
    'collector_refinement_started',
    'pricing_started',
  ]);
  assert.equal(latency.captureToInsertMs, 135);
  assert.equal(latency.collectorStartedAfterInsert, true);
  assert.equal(latency.pricingStartedAfterInsert, true);
});

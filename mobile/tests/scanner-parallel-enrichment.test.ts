import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createScannerParallelEnrichmentSchedule,
  runScannerParallelEnrichment,
} from '../services/scanner-parallel-enrichment.ts';

test('parallel enrichment requires an inserted session line', () => {
  const blocked = createScannerParallelEnrichmentSchedule({
    sessionInserted: false,
    lineId: null,
    stableScanId: null,
    candidateId: null,
    hasPriceMetadata: true,
    hasCollectorEvidence: false,
  });

  assert.equal(blocked.canRun, false);
  assert.deepEqual(blocked.tasks, []);
});

test('parallel enrichment schedules collector refinement and pricing after insertion', () => {
  const schedule = createScannerParallelEnrichmentSchedule({
    sessionInserted: true,
    lineId: 'line-1',
    stableScanId: 'scan-1',
    candidateId: 'sf-brainstorm',
    hasPriceMetadata: true,
    hasCollectorEvidence: false,
  });

  assert.equal(schedule.canRun, true);
  assert.deepEqual(schedule.tasks, ['thumbnail', 'collector_refinement', 'printing_disambiguation', 'finish_inference', 'pricing']);
});

test('parallel enrichment updates the same row and preserves failure details', async () => {
  const order: string[] = [];
  type TestSession = { rows: { id: string; price: number | null; refined: boolean }[] };
  const result = await runScannerParallelEnrichment({
    session: { rows: [{ id: 'line-1', price: null, refined: false }] } as TestSession,
    lineId: 'line-1',
    stableScanId: 'scan-1',
    tasks: [
      {
        name: 'pricing',
        run: ({ session }) => {
          order.push('pricing');
          return { rows: session.rows.map((row) => row.id === 'line-1' ? { ...row, price: 3.21 } : row) };
        },
      },
      {
        name: 'collector_refinement',
        run: () => {
          order.push('collector_refinement');
          throw new Error('collector OCR unavailable');
        },
      },
    ],
  });

  assert.deepEqual(order.sort(), ['collector_refinement', 'pricing']);
  assert.equal(result.completed.includes('pricing'), true);
  assert.equal(result.failed[0].name, 'collector_refinement');
  assert.equal(result.session.rows[0].price, 3.21);
  assert.equal(result.session.rows.length, 1);
});

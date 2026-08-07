import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BoundedTtlCache,
  createCachedMagicCatalogSearch,
  prewarmScannerServices,
} from '../services/scanner-cache-prewarming.ts';
import type { RecognitionCandidate } from '../services/scanner-intelligence.ts';

const brainstorm: RecognitionCandidate = {
  id: 'sf-brainstorm',
  oracleId: 'oracle-brainstorm',
  name: 'Brainstorm',
  setCode: 'STA',
  setName: 'Strixhaven Mystical Archive',
  collectorNumber: '13',
  finishes: ['normal'],
  legalFinishes: ['normal'],
  language: 'en',
  imageUrl: null,
  confidence: 0.95,
  recognitionMode: 'assisted_capture',
  marketPrice: null,
  layout: 'normal',
  colorIdentity: ['U'],
};

test('bounded TTL cache expires and evicts least recently touched entries', () => {
  let now = 1000;
  const cache = new BoundedTtlCache<string, number>({ maxEntries: 2, ttlMs: 100, now: () => {
    now += 1;
    return now;
  } });

  cache.set('a', 1);
  cache.set('b', 2);
  assert.equal(cache.get('a'), 1);
  cache.set('c', 3);
  assert.equal(cache.get('b'), null);
  assert.equal(cache.get('a'), 1);
  now = 1200;
  assert.equal(cache.get('a'), null);
  assert.equal(cache.size(), 1);
});

test('cached Magic catalog search avoids duplicate normalized lookups', async () => {
  let calls = 0;
  const search = createCachedMagicCatalogSearch({
    search: async () => {
      calls += 1;
      return [brainstorm];
    },
    maxEntries: 4,
    ttlMs: 1000,
  });

  const first = await search({ name: ' Brainstorm ', setCode: 'STA', collectorNumber: '13' });
  const second = await search({ name: 'brainstorm', setCode: 'sta', collectorNumber: '13' });

  assert.equal(calls, 1);
  assert.equal(first[0].id, 'sf-brainstorm');
  assert.equal(second[0].id, 'sf-brainstorm');
  assert.notEqual(first[0], second[0]);
});

test('scanner prewarming reports latency without private data', async () => {
  let now = 100;
  const results = await prewarmScannerServices({
    now: () => {
      now += 5;
      return now;
    },
    targets: [
      { target: 'ocr_provider', warm: () => undefined },
      { target: 'pricing_service', warm: () => { throw new Error('pricing unavailable'); } },
    ],
  });

  assert.equal(results[0].status, 'warmed');
  assert.equal(results[1].status, 'failed');
  assert.equal(results[1].reason, 'pricing unavailable');
  assert.ok(results.every((result) => result.latencyMs >= 0));
});

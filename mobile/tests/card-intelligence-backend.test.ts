import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeScannerCandidate } from '../services/scanner-foundation.ts';
import { recognizeTradingDocksMagicSignals } from '../services/magic-recognition-provider.ts';

test('unified mobile candidates preserve multi-provider provenance', () => {
  const candidate = normalizeScannerCandidate({ id: 'x', name: 'Pikachu', providerSource: 'multiple', providerSources: ['tcgtracking', 'tcgplayer'] });
  assert.equal(candidate?.providerSource, 'multiple');
  assert.deepEqual(candidate?.providerSources, ['tcgtracking', 'tcgplayer']);
});

test('backend recognition failure returns empty candidates for existing fallback path', async () => {
  const candidates = await recognizeTradingDocksMagicSignals({ cardName: 'Lightning Bolt', visualCandidates: [{ printingId: 'x', similarity: .9 }] }, async () => new Response('{}', { status: 503 }));
  assert.deepEqual(candidates, []);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  catalogDiagnostics,
  matchMagicCardName,
  normalizeMagicNameForIdentity,
  prewarmMagicNameIndex,
  resetMagicNameIndexForTests,
} from '../services/magic-card-identity.ts';

const representativeNames = [
  'Incinerate',
  'Lightning Bolt',
  'Sol Ring',
  'Rhystic Study',
  'Swords to Plowshares',
  'Birds of Paradise',
  'Krark-Clan Ironworks',
  'Runed Stalactite',
  'Ulalek, Fused Atrocity',
];

test('local Magic catalog prewarms from bundled Scryfall oracle names', () => {
  resetMagicNameIndexForTests();
  let now = 100;
  const index = prewarmMagicNameIndex(() => {
    now += 7;
    return now;
  });
  const diagnostics = catalogDiagnostics(index);
  assert.equal(diagnostics.catalogLoaded, true);
  assert.equal(diagnostics.indexReady, true);
  assert.ok(diagnostics.catalogCardCount > 30000);
  assert.equal(diagnostics.prewarmMs, 7);
});

test('Incinerate and representative cards resolve from local catalog without network', () => {
  const index = prewarmMagicNameIndex();
  for (const name of representativeNames) {
    const match = matchMagicCardName(index, name);
    assert.equal(match.entry?.name, name);
    assert.equal(match.confidenceBand, 'high');
  }
});

test('Incinerate normalization variants resolve correctly', () => {
  const index = prewarmMagicNameIndex();
  for (const text of ['Incinerate', 'INCINERATE', 'incinerate']) {
    const match = matchMagicCardName(index, text);
    assert.equal(match.entry?.name, 'Incinerate');
    assert.equal(match.score, 1);
  }
});

test('shared fuzzy matcher tolerates common OCR variants conservatively', () => {
  const index = prewarmMagicNameIndex();
  assert.equal(matchMagicCardName(index, 'Swords to Piowshares').entry?.name, 'Swords to Plowshares');
  assert.equal(matchMagicCardName(index, 'Krark Clan Ironworks').entry?.name, 'Krark-Clan Ironworks');
  assert.equal(matchMagicCardName(index, 'Ulalek Fused Atrocity').entry?.name, 'Ulalek, Fused Atrocity');
  assert.equal(matchMagicCardName(index, 'Iightning BoIt').entry?.name, 'Lightning Bolt');
});

test('normalizer removes punctuation and preserves split-name matching keys', () => {
  assert.equal(normalizeMagicNameForIdentity("Krark-Clan Ironworks"), 'krark clan ironworks');
  assert.equal(normalizeMagicNameForIdentity("Ulalek, Fused Atrocity"), 'ulalek fused atrocity');
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { matchMagicCardName, prewarmMagicNameIndex, resetMagicNameIndexForTests } from '../services/magic-card-identity.ts';

test('partial OCR fragments resolve local Magic name candidates', () => {
  resetMagicNameIndexForTests();
  const index = prewarmMagicNameIndex();

  assert.equal(matchMagicCardName(index, 'lay').entry?.name, 'Lay Bare');
  assert.equal(matchMagicCardName(index, 'Sla').entry?.name, 'Slay');
  assert.equal(matchMagicCardName(index, 'Slav').entry?.name, 'Slave of Bolas');
  assert.ok(matchMagicCardName(index, 'Slay').entry, 'expected a candidate for exact short title fragment');
});

test('required real-device acceptance names exist in the local index', () => {
  resetMagicNameIndexForTests();
  const index = prewarmMagicNameIndex();

  assert.ok(index.records.some((record) => record.name === 'Goblin Electromancer'));
  assert.ok(index.records.some((record) => record.name === 'Raff Security Officer'));
  assert.ok(index.records.some((record) => record.name === 'Chastise'));
});

test('fuzzy title fragments resolve the observed acceptance cards', () => {
  resetMagicNameIndexForTests();
  const index = prewarmMagicNameIndex();

  assert.equal(matchMagicCardName(index, 'Goblin Electro').entry?.name, 'Goblin Electromancer');
  assert.equal(matchMagicCardName(index, 'Raff Security Off').entry?.name, 'Raff Security Officer');
  assert.equal(matchMagicCardName(index, 'Chasti').entry?.name, 'Chastise');
});

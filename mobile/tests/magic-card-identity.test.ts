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

import assert from 'node:assert/strict';
import test from 'node:test';

import { sumInventoryQuantityPages } from '../services/inventory-quantity-total.ts';

test('inventory quantity total keeps paging until the final partial page', async () => {
  const calls: Array<[number, number]> = [];
  const rows = Array.from({ length: 2501 }, (_, index) => ({ quantity: index === 2500 ? 2 : 1 }));

  const total = await sumInventoryQuantityPages(async (from, to) => {
    calls.push([from, to]);
    return rows.slice(from, to + 1);
  }, 1000);

  assert.equal(total, 2502);
  assert.deepEqual(calls, [
    [0, 999],
    [1000, 1999],
    [2000, 2999],
  ]);
});

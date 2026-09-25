import assert from 'node:assert/strict';
import test from 'node:test';
import { availableMoney, totalInventoryValue, trustedInventoryValue, summarizeInventoryValues } from '../src/lib/intelligence-provenance.ts';
import { mappingForTemplate, CSV_TEMPLATES, inventoryValueForCsvRow } from '../src/lib/csv-conversion/templates.ts';

test('valuation: known unit quotes become total row value; zero remains known', () => {
  assert.equal(totalInventoryValue(10, 3), 30);
  assert.equal(totalInventoryValue(10, 1), 10);
  assert.equal(totalInventoryValue(0, 3), 0);
});
test('valuation: missing and malformed money never become zero', () => {
  for (const value of [null, undefined, '', ' ', 'bad', '10bad', -1, NaN, Infinity]) {
    assert.equal(availableMoney(value), null);
    assert.equal(totalInventoryValue(value, 3), null);
  }
});
test('valuation: portfolio subtotal preserves unknown rows and all-unpriced state', () => {
  assert.deepEqual(summarizeInventoryValues([10, null, 20]), { value:30, knownSubtotal:30, unpricedRows:1, coverage:2/3, status:'INSUFFICIENT_DATA' });
  assert.equal(summarizeInventoryValues([null, null]).value, null);
  assert.equal(summarizeInventoryValues([0]).value, 0);
});
test('valuation: legacy ambiguity is excluded without changing the stored object', () => {
  const legacy = { inventory_value:30, data:{quantity:3} };
  const before=JSON.stringify(legacy);
  assert.equal(trustedInventoryValue(legacy),null);
  assert.equal(JSON.stringify(legacy),before);
  assert.equal(trustedInventoryValue({inventory_value:30,data:{inventoryValueSemantics:'total_row_v1'}}),30);
});
test('CSV total price and asking price have distinct mapping fields', () => {
  const total = mappingForTemplate(['Total Price','Total Qty'], CSV_TEMPLATES.find((t) => t.id === 'deck-builder'));
  assert.equal(total.totalInventoryValue, 'Total Price');
  assert.equal(total.marketPrice, '');
  const asking=mappingForTemplate(['TCG Marketplace Price'], CSV_TEMPLATES.find((t) => t.id === 'tcgplayer'));
  assert.equal(asking.askingPrice,'TCG Marketplace Price');
});

import { buildCollectionCards, priceLabel } from '../mobile/services/collector-workspace.ts';
test('shared collection keeps explicit zero priced and legacy amounts unavailable', () => {
 const [zero, legacy] = buildCollectionCards({items:[
  {id:'zero',card_name:'Known zero',quantity:3,inventory_value:0,data:{inventoryValueSemantics:'total_row_v1'}},
  {id:'legacy',card_name:'Unknown legacy',quantity:3,inventory_value:30,data:{}}
 ]});
 assert.equal(zero.marketPrice.amount,0);
 assert.equal(priceLabel(zero),'$0.00');
 assert.equal(legacy.marketPrice.amount,null);
});

test('CSV import normalizes explicit totals and unit quotes without double multiplication', () => {
 assert.equal(inventoryValueForCsvRow({totalInventoryValue:'30',marketPrice:'12'},3),30);
 assert.equal(inventoryValueForCsvRow({marketPrice:'10'},3),30);
 assert.equal(inventoryValueForCsvRow({},3),null);
 assert.equal(inventoryValueForCsvRow({totalInventoryValue:'bad',marketPrice:'10'},3),null);
 assert.equal(inventoryValueForCsvRow({marketPrice:'bad'},3),null);
 assert.equal(inventoryValueForCsvRow({marketPrice:'0'},3),0);
 assert.equal(inventoryValueForCsvRow({totalInventoryValue:'0',marketPrice:'10'},3),0);
});

import test from "node:test";
import assert from "node:assert/strict";
import { previewCart } from "../src/lib/pos/pricing.ts";
import type { CartLine } from "../src/lib/pos/domain.ts";
const line = (id: string, price: number, quantity = 1): CartLine => ({
  item: {
    id,
    name: id,
    sku: id,
    set_code: null,
    collector_number: null,
    condition: null,
    finish: null,
    language: null,
    location_id: "case",
    location: "Case",
    unit_price_minor: price,
    available: 10,
    taxable: true,
    positions: [],
  },
  quantity,
  discountBps: 0,
});
test("price override, fixed line discount and cart discount precede per-line tax", () => {
  assert.deepEqual(
    previewCart(
      [{ ...line("a", 100, 3), overrideMinor: 150, discountMinor: 50 }],
      850,
      25,
    ),
    { subtotal: 450, discount: 75, tax: 32, total: 407 },
  );
});
test("cart allocation conserves odd cents and ignores scan ordering", () => {
  const cart = [line("b", 101), line("a", 101), line("c", 101)];
  assert.deepEqual(
    previewCart(cart, 850, 1),
    previewCart([...cart].reverse(), 850, 1),
  );
  assert.equal(previewCart(cart, 850, 1).discount, 1);
  assert.equal(previewCart(cart, 850, 1).tax, 27);
});
test("discount combinations and out-of-range values fail closed", () => {
  assert.throws(() => previewCart([line("a", 1)], 0, 2));
  assert.throws(() =>
    previewCart(
      [{ ...line("a", 100), discountBps: 1000, discountMinor: 1 }],
      0,
    ),
  );
  assert.throws(() => previewCart([line("a", 100)], 0, 1, 100));
});
test("integer drawer example totals 33578 minor units", () => {
  assert.equal(20000 + 42578 - 2500 + 5000 - 1500 - 30000, 33578);
});
test("cart penny allocation uses database code-point order across mixed-case IDs", () => {
  const cart = [
    line("a", 6),
    { ...line("Z", 6), item: { ...line("Z", 6).item, taxable: false } },
  ];
  // C order is Z, a: the penny is allocated to taxable a, moving tax from 1 to 0.
  assert.deepEqual(previewCart(cart, 850, 1), {
    subtotal: 12,
    discount: 1,
    tax: 0,
    total: 11,
  });
});

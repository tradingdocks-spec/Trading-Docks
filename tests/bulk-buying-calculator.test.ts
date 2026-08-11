import assert from "node:assert/strict";
import test from "node:test";

import {
  BULK_RATE_PRESETS,
  calculateBulkRowOffer,
  summarizeBulkOffer,
  type BulkOfferRow,
} from "../src/lib/bulk-buying-calculator.ts";

test("per-thousand bulk calculation pays 40,000 cards at $8 per 1,000 as $320", () => {
  assert.equal(
    calculateBulkRowOffer({
      category: "Commons / Uncommons",
      quantity: 40_000,
      rate: 8,
      basis: "per1000",
    }),
    320,
  );
});

test("each-rate calculation pays 3,000 cards at $0.15 each as $450", () => {
  assert.equal(
    calculateBulkRowOffer({
      category: "Bulk Rares",
      quantity: 3_000,
      rate: 0.15,
      basis: "each",
    }),
    450,
  );
});

test("each-rate foil calculation pays 5,000 cards at $0.05 each as $250", () => {
  assert.equal(
    calculateBulkRowOffer({
      category: "Foils",
      quantity: 5_000,
      rate: 0.05,
      basis: "each",
    }),
    250,
  );
});

test("combined worksheet totals 48,000 cards and $1,020", () => {
  const rows: BulkOfferRow[] = [
    {
      category: "Commons / Uncommons",
      quantity: 40_000,
      rate: 8,
      basis: "per1000",
    },
    {
      category: "Bulk Rares",
      quantity: 3_000,
      rate: 0.15,
      basis: "each",
    },
    {
      category: "Foils",
      quantity: 5_000,
      rate: 0.05,
      basis: "each",
    },
  ];

  const summary = summarizeBulkOffer(rows);

  assert.equal(summary.totalCards, 48_000);
  assert.equal(summary.subtotal, 1_020);
  assert.equal(summary.finalOffer, 1_020);
  assert.equal(summary.categoryCount, 3);
});

test("per-hundred basis is supported", () => {
  assert.equal(
    calculateBulkRowOffer({
      category: "Sorted bulk",
      quantity: 2_500,
      rate: 3,
      basis: "per100",
    }),
    75,
  );
});

test("editable rates are reflected in the calculated offer", () => {
  const original = calculateBulkRowOffer({
    category: "Basic Lands",
    quantity: 4_000,
    rate: 4,
    basis: "per1000",
  });
  const edited = calculateBulkRowOffer({
    category: "Basic Lands",
    quantity: 4_000,
    rate: 6,
    basis: "per1000",
  });

  assert.equal(original, 16);
  assert.equal(edited, 24);
});

test("custom categories participate in totals", () => {
  const summary = summarizeBulkOffer([
    {
      category: "Japanese bulk",
      quantity: "1,250",
      rate: "12",
      basis: "per1000",
    },
  ]);

  assert.equal(summary.totalCards, 1_250);
  assert.equal(summary.subtotal, 15);
  assert.equal(summary.categoryCount, 1);
});

test("empty rows and negative values do not contribute", () => {
  const summary = summarizeBulkOffer([
    { category: "", quantity: "", rate: "", basis: "each" },
    { category: "Bad quantity", quantity: -10, rate: 1, basis: "each" },
    { category: "Bad rate", quantity: 10, rate: -1, basis: "each" },
  ]);

  assert.equal(summary.totalCards, 10);
  assert.equal(summary.subtotal, 0);
  assert.equal(summary.categoryCount, 0);
});

test("amount adjustments update the final offer and average per card", () => {
  const summary = summarizeBulkOffer(
    [{ category: "Bulk Rares", quantity: 100, rate: 0.1, basis: "each" }],
    { mode: "amount", value: "-2.50", label: "Round down" },
  );

  assert.equal(summary.subtotal, 10);
  assert.equal(summary.adjustmentAmount, -2.5);
  assert.equal(summary.finalOffer, 7.5);
  assert.equal(summary.averagePerCard, 0.075);
});

test("percent adjustments update the final offer", () => {
  const summary = summarizeBulkOffer(
    [{ category: "Bulk Rares", quantity: 100, rate: 0.1, basis: "each" }],
    { mode: "percent", value: "10", label: "Store credit bump" },
  );

  assert.equal(summary.adjustmentAmount, 1);
  assert.equal(summary.finalOffer, 11);
});

test("reset-compatible empty worksheet returns a zero summary", () => {
  const summary = summarizeBulkOffer([
    { category: "", quantity: "", rate: "", basis: "each" },
  ]);

  assert.deepEqual(summary, {
    totalCards: 0,
    subtotal: 0,
    adjustmentAmount: 0,
    finalOffer: 0,
    averagePerCard: 0,
    categoryCount: 0,
  });
});

test("presets remain optional editable starting points", () => {
  assert.deepEqual(BULK_RATE_PRESETS, [
    { category: "Commons / Uncommons", rate: 10, basis: "per1000" },
    { category: "Bulk Rares", rate: 0.1, basis: "each" },
    { category: "Bulk Mythics", rate: 0.25, basis: "each" },
    { category: "Basic Lands", rate: 4, basis: "per1000" },
    { category: "Foils", rate: 0.05, basis: "each" },
  ]);
});

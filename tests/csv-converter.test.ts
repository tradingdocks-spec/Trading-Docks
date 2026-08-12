import assert from "node:assert/strict";
import test from "node:test";

import {
  blockingIssues,
  exportCsv,
  normalizeRows,
  parseCsv,
  unsupportedExportIssues,
} from "../src/lib/csv-converter.ts";

test("CSV converter keeps Magic rows on the existing TCGplayer export path", () => {
  const rows = normalizeRows(parseCsv([
    "Game,Name,Set Code,Collector Number,Quantity,Condition,Finish,Language,TCGplayer Id",
    "Magic,Lightning Bolt,SLD,123,2,NM,Foil,en,123456",
  ].join("\n")), "generic");

  assert.equal(rows[0].game, "magic");
  assert.equal(rows[0].productType, "card");
  assert.equal(blockingIssues(rows, "tcgplayer"), 0);
  assert.match(exportCsv(rows, "tcgplayer"), /Magic,.*,Lightning Bolt/);
});

test("CSV converter rejects Pokemon rows for Magic-only exports instead of guessing", () => {
  const rows = normalizeRows(parseCsv([
    "Game,Product Type,Name,Set Code,Collector Number,Quantity,Condition,Variant,Language,TCGplayer Id",
    "Pokemon,Card,Pikachu ex,SV08,057/191,1,Near Mint,Holofoil,English,553927",
  ].join("\n")), "generic");

  assert.equal(rows[0].game, "pokemon");
  assert.equal(rows[0].variant, "Holofoil");
  assert.equal(blockingIssues(rows, "tcgplayer"), 1);
  assert.match(unsupportedExportIssues(rows, "tcgplayer")[0], /Magic-only/);
  assert.throws(() => exportCsv(rows, "tcgplayer"), /Magic-only/);
});

test("CSV converter rejects sealed inventory for card export formats", () => {
  const rows = normalizeRows(parseCsv([
    "Game,Product Type,Name,Quantity,Condition,Finish,TCGplayer Id",
    "Magic,Sealed,Commander Masters Collector Booster Box,1,Near Mint,Normal,900001",
  ].join("\n")), "generic");

  assert.equal(rows[0].productType, "sealed");
  assert.equal(blockingIssues(rows, "tcgplayer"), 1);
  assert.throws(() => exportCsv(rows, "tcgplayer"), /sealed inventory/);
});

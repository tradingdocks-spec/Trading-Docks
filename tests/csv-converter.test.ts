import assert from "node:assert/strict";
import test from "node:test";
import { CANONICAL_FIELDS, outputForTemplate, type CanonicalRow } from "../src/lib/csv-conversion/templates.ts";

import {
  blockingIssues,
  exportCsv,
  normalizeRows,
  parseCsv,
  unsupportedExportIssues,
} from "../src/lib/csv-converter.ts";

function canonicalPriceRow(overrides: Partial<CanonicalRow> = {}) {
  return {
    marketPrice: "",
    lowPrice: "1.76",
    directLowPrice: "",
    ...overrides,
  } as CanonicalRow;
}

test("review exporter uses catalog printing fields only for TCGplayer and retains compound import identity", () => {
  const base = Object.fromEntries(CANONICAL_FIELDS.map(({ key }) => [key, ""])) as CanonicalRow;
  const row = { ...base, name: "Belfry Spirit", set: "plst", setName: "The List", collectorNumber: "GK2-29", tcgplayerId: "900030", tcgplayerPrinting: { name: "Belfry Spirit", setName: "The List Reprints", collectorNumber: "029/133" } };
  const tcg = outputForTemplate([row], "tcgplayer");
  assert.equal(tcg.values[0][tcg.headers.indexOf("Number")], "029/133");
  assert.equal(tcg.values[0][tcg.headers.indexOf("Set Name")], "The List Reprints");
  const manabox = outputForTemplate([row], "manabox");
  assert.equal(manabox.values[0][manabox.headers.indexOf("Collector number")], "GK2-29");
  assert.equal(row.collectorNumber, "GK2-29");
});

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

test("TCGplayer export fills required marketplace price from the lowest available price", () => {
  const output = outputForTemplate([canonicalPriceRow()], "tcgplayer");
  const marketplacePriceIndex = output.headers.indexOf("TCG Marketplace Price");
  assert.equal(output.values[0][marketplacePriceIndex], "1.76");
  assert.equal(
    outputForTemplate([canonicalPriceRow({ marketPrice: "2.10" })], "tcgplayer")
      .values[0][marketplacePriceIndex],
    "2.10",
  );
});

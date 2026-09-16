import assert from "node:assert/strict";
import test from "node:test";
import { csvValue, parseSimpleCsv } from "../src/lib/csv-simple.ts";

test("simple CSV parser preserves quoted commas and maps common fields", () => {
  const rows = parseSimpleCsv('Name,Set,Collector Number,Quantity\n"Lightning, Bolt",M11,149,2');
  assert.equal(rows.length, 1);
  assert.equal(csvValue(rows[0].values, "name", "card name"), "Lightning, Bolt");
  assert.equal(csvValue(rows[0].values, "collector number"), "149");
});

test("CSV intake keeps duplicate rows and exposes invalid rows for review", () => {
  const rows = parseSimpleCsv(
    "Name,Set,Collector Number,Quantity,Language\n" +
      "Bolt,M11,149,2,en\n" +
      "Bolt,M11,149,3,en\n" +
      "Unresolved,,,,",
  );
  assert.equal(rows.length, 3);
  assert.equal(csvValue(rows[0].values, "quantity"), "2");
  assert.equal(csvValue(rows[1].values, "quantity"), "3");
  assert.equal(csvValue(rows[2].values, "set"), "");
});

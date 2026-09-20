import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLabelDocument,
  code128,
  physicalSize,
} from "../src/lib/label-studio/print-document.ts";
import { retailPresets } from "../src/lib/label-studio/retail-presets.ts";
import {
  templateFromRow,
  templateToRow,
  type LabelStudioTemplateRow,
} from "../src/lib/label-studio/persistence.ts";
import { validateLabelTemplate } from "../src/lib/label-studio/label-templates.ts";
import { addScan, type PosItem } from "../src/lib/pos/domain.ts";
import type { LabelTarget } from "../src/lib/label-studio/print-settings.ts";
const target: LabelTarget = {
  key: "p1",
  itemId: "item",
  positionId: "p1",
  name: "Charizard ex",
  set: "OBF",
  number: "125/197",
  condition: "NM",
  finish: "Holo",
  language: "EN",
  location: "Showcase A",
  batch: "B-1042",
  quantity: 3,
  price: 18.99,
  sku: "TD-K9X2-A81M",
  identityId: "identity",
  qrToken: "opaque",
};
test("six retail presets use canonical template schema", () => {
  const presets = retailPresets("workspace");
  assert.equal(presets.length, 6);
  for (const t of presets) assert.equal(validateLabelTemplate(t).ok, true);
});
test("Code 128 encodes actual payload and preserves safe dimensions", () => {
  const a = code128(target.sku!, 60),
    b = code128("TD-AAAA-BBBB", 60);
  assert.notEqual(a, b);
  assert.match(a, /viewBox="0 0 187 /);
  assert.match(a, /height="8mm"/);
  assert.match(a, /shape-rendering="crispEdges"/);
  assert.throws(() => code128(target.sku!, 20), /Choose wider stock/);
});
test("current label fields render without putting price in barcode", async () => {
  const html = await buildLabelDocument(retailPresets("w")[1], [
    { target, copies: 1 },
  ]);
  for (const text of [
    "Charizard ex",
    "OBF 125/197",
    "NM · EN · Holo",
    "$18.99",
    "TD-K9X2-A81M",
  ])
    assert.ok(html.includes(text));
  assert.match(html, /aria-label="TD-K9X2-A81M"/);
});
test("hidden fields and symbols do not render", async () => {
  const t = retailPresets("w")[1];
  t.print!.fields = ["name"];
  t.print!.humanReadable = false;
  t.barcodeEnabled = false;
  t.qrEnabled = false;
  const html = await buildLabelDocument(t, [{ target, copies: 1 }]);
  assert.ok(!html.includes("$18.99"));
  assert.ok(!html.includes("TD-K9X2-A81M"));
  assert.ok(!html.includes("<svg"));
});
test("untrusted long names are escaped and bounded without shrinking bars", async () => {
  const html = await buildLabelDocument(retailPresets("w")[0], [
    {
      target: {
        ...target,
        name: "<script>alert(1)</script>" + "very long ".repeat(100),
      },
      copies: 1,
    },
  ]);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.match(html, /text-overflow:ellipsis/);
  assert.match(html, /height="8mm"/);
});
test("custom physical dimensions and structured settings round trip", () => {
  const t = retailPresets("w")[1];
  t.id = "uuid";
  t.width = 57.15;
  t.height = 31.75;
  t.unit = "mm";
  t.sizePresetId = "custom";
  t.print!.fields = ["price", "name"];
  const row = { id: t.id, ...templateToRow(t, "w") } as LabelStudioTemplateRow;
  assert.deepEqual(templateFromRow(row).print, t.print);
  assert.deepEqual(physicalSize(templateFromRow(row)), {
    width: 57.15,
    height: 31.75,
  });
});
test("invalid dimensions, sheets and copy counts fail closed", async () => {
  const t = retailPresets("w")[0];
  await assert.rejects(
    buildLabelDocument({ ...t, width: Infinity }, [{ target, copies: 1 }]),
    /Invalid/,
  );
  await assert.rejects(
    buildLabelDocument(t, [{ target, copies: 1.5 }]),
    /copies/,
  );
  t.print!.mode = "sheet";
  t.print!.sheet.columns = 10;
  await assert.rejects(
    buildLabelDocument(t, [{ target, copies: 1 }]),
    /do not fit/,
  );
});
test("roll markup has exact counts and no dashboard shell", async () => {
  for (const count of [1, 2, 5, 10, 100]) {
    const html = await buildLabelDocument(retailPresets("w")[0], [
      { target, copies: count },
    ]);
    assert.equal((html.match(/class="page"/g) ?? []).length, count);
    assert.equal((html.match(/data-label="p1"/g) ?? []).length, count);
    assert.match(html, /@page\{size:50.8mm 25.4mm;margin:0/);
    assert.ok(!html.includes("<nav"));
    assert.ok(!html.includes("visibility:hidden"));
  }
});
test("sheet pagination is distinct from roll pagination", async () => {
  const t = retailPresets("w")[0];
  t.print!.mode = "sheet";
  const html = await buildLabelDocument(t, [{ target, copies: 31 }]);
  assert.equal((html.match(/class="page"/g) ?? []).length, 2);
  assert.match(html, /@page\{size:215.9mm 279.4mm/);
});
test("editing preview renders one label for a 500-copy queue", async () => {
  const html = await buildLabelDocument(
    retailPresets("w")[0],
    [{ target, copies: 500 }],
    true,
  );
  assert.equal((html.match(/data-label=/g) ?? []).length, 1);
});
test("same item in different positions remains separate in POS cart", () => {
  const item = {
    id: "item",
    positionId: "p1",
    name: "Card",
    unit_price_minor: 1999,
    available: 3,
  } as PosItem;
  const cart = addScan(
    addScan(addScan([], item), { ...item, positionId: "p2" }),
    item,
  );
  assert.equal(cart.length, 2);
  assert.equal(cart[0].quantity, 2);
  assert.equal(cart[0].positionId, "p1");
  assert.equal(cart[1].positionId, "p2");
});
test("sealed product labels may encode a server-approved UPC while retaining the internal SKU", async () => {
  const html = await buildLabelDocument(retailPresets("w")[3], [
    { target: { ...target, upc: "012345678901" }, copies: 1 },
  ]);
  assert.match(html, /aria-label="012345678901"/);
  assert.ok(html.includes("012345678901 · TD-K9X2-A81M"));
});

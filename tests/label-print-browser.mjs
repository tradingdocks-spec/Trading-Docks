import { chromium } from "@playwright/test";
import { buildLabelDocument } from "../src/lib/label-studio/print-document.ts";
import { retailPresets } from "../src/lib/label-studio/retail-presets.ts";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const dir = ".local-fixtures/label-print";
mkdirSync(dir, { recursive: true });
const target = {
  key: "p1",
  itemId: "item",
  positionId: "p1",
  name: "Charizard ex — extremely long printing name to verify clipping remains within the label",
  set: "OBF",
  number: "125/197",
  condition: "NM",
  finish: "Holo",
  language: "EN",
  location: "Showcase A",
  batch: "B-1042",
  quantity: 500,
  price: 18.99,
  sku: "TD-K9X2-A81M",
  identityId: "identity",
  qrToken: "opaque",
};
const browser = await chromium.launch({ channel: process.argv.includes("--edge") ? "msedge" : "chrome", headless: true });
let passed = 0;
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const count of [1, 2, 5, 10, 50, 100, 250, 500, 1000]) {
    const start = performance.now();
    const html = await buildLabelDocument(retailPresets("w")[0], [
      { target, copies: count },
    ]);
    await page.setContent(html);
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator(".label").count(), count);
    assert.equal(await page.locator("nav,table,iframe").count(), 0);
    const overflow = await page
      .locator(".label")
      .evaluateAll((labels) =>
        labels.some(
          (label) =>
            label.scrollHeight > label.clientHeight + 1 ||
            label.scrollWidth > label.clientWidth + 1,
        ),
      );
    assert.equal(overflow, false);
    const pdf = await page.pdf({
      path: `${dir}/roll-${count}.pdf`,
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: false,
    });
    const raw = pdf.toString("latin1");
    assert.equal((raw.match(/\/Type\s*\/Page\b/g) ?? []).length, count);
    const box = raw.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/);
    assert.ok(box);
    assert.ok(Math.abs((Number(box[1]) * 25.4) / 72 - 50.8) < 0.5);
    assert.ok(Math.abs((Number(box[2]) * 25.4) / 72 - 25.4) < 0.5);
    console.log(
      `PASS roll ${count}: ${pdf.length} bytes, ${Math.round(performance.now() - start)}ms, exact count and 50.8×25.4mm`,
    );
    passed++;
  }
  const sheet = retailPresets("w")[0];
  sheet.print.mode = "sheet";
  await page.setContent(
    await buildLabelDocument(sheet, [{ target, copies: 31 }]),
  );
  const pdf = await page.pdf({
    path: `${dir}/sheet-31.pdf`,
    preferCSSPageSize: true,
    printBackground: true,
  });
  const raw = pdf.toString("latin1");
  assert.equal((raw.match(/\/Type\s*\/Page\b/g) ?? []).length, 2);
  const box = raw.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/);
  assert.ok(Math.abs(Number(box[1]) - 612) < 1);
  assert.ok(Math.abs(Number(box[2]) - 792) < 1);
  passed++;
  for (const template of retailPresets("w")) {
    await page.setContent(
      await buildLabelDocument(template, [{ target, copies: 1 }], true),
    );
    assert.equal(await page.locator('.label').evaluate(label=>label.scrollHeight>label.clientHeight+1||label.scrollWidth>label.clientWidth+1),false,template.name);
    await page.screenshot({ path: `${dir}/${template.id}.png` });
  }
  assert.deepEqual(errors, []);
  console.log(
    `Label PDF checks: ${passed} passed; six preset screenshots saved.`,
  );
} finally {
  await browser.close();
}

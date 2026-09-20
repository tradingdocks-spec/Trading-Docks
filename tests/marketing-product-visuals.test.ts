import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildRenderSpec, CREATIVE_FORMATS, renderCreativeSvg, validateRenderSpec } from "../src/lib/marketing/creative-renderer.ts";
import { getMarketingDemoFixture } from "../src/lib/marketing/marketing-demo-fixtures.ts";

const product = "data:image/png;base64,product-proof";
const logo = "data:image/png;base64,approved-logo";

test("Chaos Sort capture includes product-looking primary, workflow, review, and inventory-result fixtures", () => {
  for (const state of ["primary", "workflow", "review", "inventory-result"]) assert.ok(getMarketingDemoFixture("chaos-sort", state));
  const page = readFileSync("src/components/marketing/MarketingProductShell.tsx", "utf8");
  assert.match(page, /Recognition session/);
  assert.match(page, /Needs review/);
  assert.match(page, /Inventory updated/);
  assert.match(page, /Scan/);
  assert.doesNotMatch(page, /Synthetic record|Synthetic demo state|No customer records|Internal fixture/);
});

test("creative direction families use real proof, approved logo, and exact social dimensions", () => {
  const cases = [
    ["product", "product_hero", "instagram_square"],
    ["transformation", "before_after", "instagram_portrait"],
    ["editorial", "editorial_tcg", "instagram_story"],
  ] as const;
  for (const [direction, composition, platform] of cases) {
    const spec = buildRenderSpec({ platform, composition, featureName: "Chaos Sort", headline: "Sort the chaos.", subheadline: "Turn unsorted cards into organized, trackable inventory.", cta: "See Chaos Sort", productAssetUrl: product, logoAssetUrl: logo, conceptDirection: direction });
    const svg = renderCreativeSvg(spec);
    assert.equal(spec.width, CREATIVE_FORMATS[platform].width);
    assert.equal(spec.height, CREATIVE_FORMATS[platform].height);
    assert.match(svg, /data:image\/png;base64,product-proof/);
    assert.match(svg, /data:image\/png;base64,approved-logo/);
    assert.doesNotMatch(svg, /Synthetic record|Synthetic demo state|No customer records|Internal fixture/);
    assert.deepEqual(validateRenderSpec(spec), []);
  }
});

test("capture page keeps the ready marker server-rendered and removes debug fixture copy", () => {
  const page = readFileSync("src/app/internal/marketing-capture/[feature]/[state]/page.tsx", "utf8");
  assert.match(page, /<main data-marketing-capture-ready="true"/);
  assert.doesNotMatch(page, /Synthetic record|Synthetic demo state|No customer records|Internal fixture/);
});

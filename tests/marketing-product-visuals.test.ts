import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildRenderSpec, computeCreativeLayout, CREATIVE_FORMATS, renderCreativeSvg, validateRenderSpec } from "../src/lib/marketing/creative-renderer.ts";
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
  assert.match(page, /data-marketing-product-capture="true"/);
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
  const shell = readFileSync("src/components/marketing/MarketingProductShell.tsx", "utf8");
  assert.match(page, /ProductCaptureShell/);
  assert.match(shell, /data-marketing-capture-ready="true" data-marketing-product-capture="true"/);
  assert.doesNotMatch(page, /Synthetic record|Synthetic demo state|No customer records|Internal fixture/);
});

test("product capture is element-scoped and rejects recursive campaign content", () => {
  const runner = readFileSync("src/lib/marketing/canonical-capture-runner.ts", "utf8");
  assert.match(runner, /data-marketing-product-capture/);
  assert.match(runner, /productRegion\.screenshot/);
  assert.doesNotMatch(runner, /fullPage:\s*true/);
  assert.match(runner, /PRODUCT_CAPTURE_REGION_MISSING/);
  assert.match(runner, /PRODUCT_CAPTURE_RECURSIVE_CONTENT/);
});

test("quality gate rejects deliberately bad copy and keeps transformation layers separated", () => {
  const bad = { ...buildRenderSpec({ platform: "instagram_square", featureName: "Chaos Sort", headline: "Sort the chaos.", subheadline: "Turn unsorted cards into organized, trackable inventory.", cta: "See Chaos Sort", productAssetUrl: product, logoAssetUrl: logo, conceptDirection: "product" as const }), headline: "This headline is intentionally much too long to fit inside the assigned safe region without clipping or becoming unreadable" };
  assert.ok(validateRenderSpec(bad).some((issue) => issue === "headline_does_not_fit" || issue === "headline_too_long"));
  const transformation = buildRenderSpec({ platform: "instagram_portrait", composition: "before_after", featureName: "Chaos Sort", headline: "Collections do not arrive organized.", subheadline: "Move from unsorted intake to identifiable, trackable inventory.", cta: "See Chaos Sort", productAssetUrl: product, logoAssetUrl: logo, conceptDirection: "transformation" });
  const layout = computeCreativeLayout(transformation);
  assert.deepEqual(layout.issues, []);
  assert.ok(layout.occupancy >= .4);
  const square = computeCreativeLayout(buildRenderSpec({ platform: "instagram_square", featureName: "Chaos Sort", headline: "Organize every intake.", subheadline: "A clearer workflow for card teams.", cta: "Open Chaos Sort", productAssetUrl: product, logoAssetUrl: logo, conceptDirection: "product" }));
  assert.equal(square.cta.x, Math.round(1080 * .07));
  assert.ok(square.logo.x > square.cta.x + square.cta.width);
});

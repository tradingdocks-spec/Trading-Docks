import test from "node:test";
import assert from "node:assert/strict";
import { buildRenderSpec, CREATIVE_FORMATS, renderCreativeSvg, validateRenderSpec } from "../src/lib/marketing/creative-renderer.ts";
import { readFileSync } from "node:fs";

test("creative render specs use exact platform dimensions", () => {
  for (const [platform, format] of Object.entries(CREATIVE_FORMATS)) {
    const spec = buildRenderSpec({ platform: platform as keyof typeof CREATIVE_FORMATS, featureName: "Chaos Sort", headline: "Sort the chaos.", subheadline: "Real product copy.", cta: "See Chaos Sort" });
    assert.equal(spec.width, format.width);
    assert.equal(spec.height, format.height);
    assert.match(renderCreativeSvg(spec), new RegExp(`width="${format.width}" height="${format.height}"`));
  }
});

test("renderer is deterministic and reports missing product proof", () => {
  const spec = buildRenderSpec({ platform: "instagram_square", featureName: "Chaos Sort", headline: "Sort the chaos.", subheadline: "Turn unsorted cards into organized inventory.", cta: "See Chaos Sort" });
  assert.equal(renderCreativeSvg(spec), renderCreativeSvg(spec));
  assert.deepEqual(validateRenderSpec(spec), ["product_screenshot_unavailable"]);
});

test("asset and renderer routes are admin-only and approval-gated", () => {
  const assetRoute = readFileSync("src/app/api/admin/marketing/assets/route.ts", "utf8");
  const renderRoute = readFileSync("src/app/api/admin/marketing/creative/renderer/route.ts", "utf8");
  assert.match(assetRoute, /requireServerPlatformRole\("admin"\)/);
  assert.match(assetRoute, /marketingUseApproved !== true/);
  assert.match(renderRoute, /approval_status.*approved/);
  assert.match(renderRoute, /marketing_use_approved.*true/);
});

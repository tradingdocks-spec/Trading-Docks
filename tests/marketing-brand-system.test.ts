import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_MARKETING_BRAND_TOKENS, generateCreativeDirections, hasBlockingBrandIssues, runBrandQualityChecks, validateMarketingBrandTokens } from "../src/lib/marketing/brand-system.ts";

test("brand tokens use the existing Trading Docks dark/cyan visual language", () => {
  assert.equal(validateMarketingBrandTokens(DEFAULT_MARKETING_BRAND_TOKENS).length, 0);
  assert.equal(DEFAULT_MARKETING_BRAND_TOKENS.colors.accent, "#35cafa");
});

test("invalid brand color and spacing tokens are rejected", () => {
  const invalid = structuredClone(DEFAULT_MARKETING_BRAND_TOKENS);
  invalid.colors.accent = "cyan";
  invalid.spacing.safeMargin = 4;
  assert.deepEqual(validateMarketingBrandTokens(invalid), ["invalid_color_token", "unsafe_spacing_token"]);
});

test("creative director returns exactly three meaningfully different directions", () => {
  const concepts = generateCreativeDirections({ featureName: "Chaos Sort", customerDescription: "Turn unsorted cards into organized inventory.", cta: "See Chaos Sort" });
  assert.equal(concepts.length, 3);
  assert.deepEqual(concepts.map((concept) => concept.direction), ["product", "transformation", "editorial"]);
  assert.equal(new Set(concepts.map((concept) => concept.compositionFamily)).size, 3);
  assert.ok(concepts.every((concept) => concept.brandSignatureElements.length >= 3));
});

test("creative director keeps CTA language approved and feature-specific", () => {
  const concept = generateCreativeDirections({ featureName: "Inventory Management", cta: "BUY NOW" })[0];
  assert.equal(concept.cta, "See Trading Docks");
  assert.match(concept.primaryMessage, /inventory/i);
});

test("brand quality blocks missing proof and passes an authentic product creative", () => {
  const missing = runBrandQualityChecks({ headline: "Sort the chaos.", subheadline: "Turn unsorted cards into organized inventory.", cta: "See Chaos Sort", platform: "instagram_square", productAssetApproved: false, logoAssetApproved: false, hasFeatureCopy: true });
  assert.equal(hasBlockingBrandIssues(missing), true);
  const ready = runBrandQualityChecks({ headline: "Sort the chaos.", subheadline: "Turn unsorted cards into organized inventory.", cta: "See Chaos Sort", platform: "instagram_square", productAssetApproved: true, logoAssetApproved: true, hasFeatureCopy: true });
  assert.equal(hasBlockingBrandIssues(ready), false);
});

test("brand system and creative direction routes remain admin-only", () => {
  for (const path of ["src/app/api/admin/marketing/brand-system/route.ts", "src/app/api/admin/marketing/creative/directions/route.ts"]) {
    assert.match(readFileSync(path, "utf8"), /requireServerPlatformRole\("admin"\)/, path);
  }
});

test("brand migration preserves existing stores and versions creative provenance", () => {
  const migration = readFileSync("supabase/migrations/20260919202910_marketing_brand_system.sql", "utf8");
  assert.match(migration, /alter table public\.marketing_brand_rules/);
  assert.match(migration, /alter table public\.marketing_creatives/);
  assert.match(migration, /campaign_visual_family_id/);
  assert.match(migration, /brand_profile_version/);
  assert.match(migration, /gold_standard/);
});

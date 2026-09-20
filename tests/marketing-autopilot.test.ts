import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildMarketingAutopilotPackage } from "../src/lib/marketing/marketing-autopilot.ts";
import { MARKETING_PRODUCT_REGISTRY } from "../src/lib/marketing/product-marketing-registry.ts";

const proof = { id: "capture-1", name: "Chaos Sort primary capture", featureIds: ["chaos-sort"], role: "primary", source: "canonical_product_capture", approved: true, marketingApproved: true, archived: false };

test("Marketing Autopilot builds a deterministic package from approved product data", () => {
  const result = buildMarketingAutopilotPackage(MARKETING_PRODUCT_REGISTRY, [proof], [], [], { audience: "local_game_store", objective: "awareness", channel: "multi_channel" });
  assert.equal(result.feature.slug, "chaos-sort");
  assert.equal(result.directions.length, 3);
  assert.equal(result.recommendedDirection, "product");
  assert.ok(result.copy.primaryHeadline);
  assert.ok(result.variants.some((item) => item.filename.includes("1080x1080")));
  assert.ok(result.autonomousActions.includes("no_email_send"));
});

test("Autopilot stays on the approved-claim and synthetic-data boundary", () => {
  const source = readFileSync("src/lib/marketing/marketing-autopilot.ts", "utf8");
  const route = readFileSync("src/app/api/admin/marketing/autopilot/route.ts", "utf8");
  assert.doesNotMatch(source, /marketing_prospects|inventory_items|orders|customers|payments/);
  assert.match(route, /requireServerPlatformRole\("admin"\)/);
  assert.match(route, /marketing_outbound_campaigns/);
  assert.match(route, /marketing_creative_briefs/);
  assert.match(source, /no_email_send/);
});

test("canonical capture has a browser runner and automatic Asset Vault registration boundary", () => {
  const runner = readFileSync("src/lib/marketing/canonical-capture-runner.ts", "utf8");
  const route = readFileSync("src/app/api/admin/marketing/intelligence/capture/route.ts", "utf8");
  const registration = readFileSync("src/lib/marketing/canonical-capture-registration.ts", "utf8");
  assert.match(runner, /chromium\.launch/);
  assert.match(runner, /document\.fonts\.ready/);
  assert.match(runner, /page\.screenshot/);
  assert.match(route, /marketing-assets/);
  assert.match(registration, /upsert/);
  assert.match(route, /canonical_product_capture/);
});

test("Autopilot is a primary admin navigation surface", () => {
  const navigation = readFileSync("src/components/dashboard/navigation.ts", "utf8");
  assert.match(navigation, /Marketing Overview[\s\S]*Marketing Autopilot[\s\S]*Marketing Intelligence/);
  assert.match(navigation, /\/dashboard\/admin\/marketing\/autopilot/);
});

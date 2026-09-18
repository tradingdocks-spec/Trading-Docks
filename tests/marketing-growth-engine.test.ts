import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { buildCreativeBrief, buildFeatureFits, buildOutreachDraft, mockProviderMessageId } from "../src/lib/marketing/growth-engine.ts";
import { createGrowthEmailProvider } from "../src/lib/marketing/growth-email-provider.ts";

const feature = { id: "f1", slug: "chaos-sort", name: "Chaos Sort", customer_description: "Turn unsorted cards into identifiable, trackable inventory.", relevant_cta: "See Chaos Sort", landing_url: "/dashboard/imports/chaos-sort", approved_claims: [{ claim: "Supports card intake and batches." }] };

test("feature fit uses explicit signals and preserves unknowns", () => {
  const fits = buildFeatureFits([feature], [
    { signal: "sells_singles", value: "true", confidence: "verified", source_type: "website" },
    { signal: "buys_collections", value: "true", confidence: "high", source_type: "admin" },
  ]);
  assert.equal(fits[0].relevance, "high");
  assert.match(fits[0].reasons[0].explanation, /signal/);
  assert.equal(buildFeatureFits([feature], [])[0].relevance, "unknown");
});

test("creative brief and outreach copy stay tied to approved feature facts", () => {
  const reasons = [{ signal: "sells_singles", explanation: "Public or admin-provided signal: sells singles." }];
  const prospect = { id: "p1", business_name: "Example Games", city: "Phoenix", state: "AZ", category: "local game store" };
  const brief = buildCreativeBrief(feature, prospect, reasons);
  const draft = buildOutreachDraft(feature, prospect, reasons);
  assert.equal(brief.featureId, "chaos-sort");
  assert.match(draft.bodyText, /Example Games/);
  assert.doesNotMatch(draft.bodyText, /10x|guarantee|revolutionize|game-changing/i);
});

test("mock provider IDs are deterministic and do not imply live delivery", () => {
  assert.equal(mockProviderMessageId("mock:draft-1"), mockProviderMessageId("mock:draft-1"));
  assert.match(mockProviderMessageId("mock:draft-1"), /^mock_/);
});

test("growth email provider is mock-only and does not report external delivery", async () => {
  const result = await createGrowthEmailProvider().send({ idempotencyKey: "draft:1", recipient: "store@example.com", subject: "Review", bodyText: "Review" });
  assert.equal(result.provider, "mock");
  assert.equal(result.delivered, false);
});

test("growth APIs are admin-only and mock-send only", () => {
  const root = process.cwd();
  for (const route of [
    "src/app/api/admin/marketing/growth/route.ts",
    "src/app/api/admin/marketing/fit/route.ts",
    "src/app/api/admin/marketing/creative/route.ts",
    "src/app/api/admin/marketing/outreach/route.ts",
  ]) {
    const source = readFileSync(join(root, route), "utf8");
    assert.match(source, /requireServerPlatformRole\("admin"\)/, route);
  }
  const outreach = readFileSync(join(root, "src/app/api/admin/marketing/outreach/route.ts"), "utf8");
  assert.match(outreach, /mock_send/);
  assert.doesNotMatch(outreach, /resend|postmark|fetch\(/i);
  const contactDiscovery = readFileSync(join(root, "src/app/api/admin/marketing/contact-discovery/route.ts"), "utf8");
  assert.match(contactDiscovery, /marketing_prospect_contacts/);
});

test("growth migration is additive, admin-only, and contains no credential storage", () => {
  const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260918231733_marketing_growth_engine_foundation.sql"), "utf8");
  assert.match(migration, /marketing_feature_library/);
  assert.match(migration, /marketing_prospect_feature_fit/);
  assert.match(migration, /marketing_outreach_drafts/);
  assert.match(migration, /marketing_outbound_suppressions/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /public\.is_admin\(''admin''\)/);
  assert.doesNotMatch(migration, /client_secret|api_key|access_token|refresh_token/i);
  assert.doesNotMatch(migration, /drop table|truncate table|delete from/i);
});

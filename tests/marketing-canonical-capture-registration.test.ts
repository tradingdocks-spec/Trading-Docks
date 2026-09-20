import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/lib/marketing/canonical-capture-registration.ts", "utf8");

test("canonical capture registration uploads PNGs idempotently and avoids partial-index upsert inference", () => {
  assert.match(source, /storage\.from\("marketing-assets"\)\.upload/);
  assert.match(source, /upsert: true/);
  assert.match(source, /\.eq\("slug", metadata\.slug\)\.maybeSingle\(\)/);
  assert.match(source, /\.update\(\{ \.\.\.row, updated_at/);
  assert.match(source, /\.insert\(row\)/);
  assert.doesNotMatch(source, /\.upsert\([^\n]*onConflict:\s*["']slug/);
});

test("canonical registration preserves real Asset Vault screenshot metadata", () => {
  for (const field of ["asset_type: \"product_screenshot\"", "source: \"canonical_product_capture\"", "feature_ids: metadata.featureIds", "approval_status: \"approved\"", "approved_for_marketing: true", "marketing_use_approved: true", "screenshot_role: metadata.screenshotRole", "safe_crop: true", "mime_type: \"image/png\""]) assert.match(source, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /capture_version:/);
  assert.match(source, /screenshot_role:/);
  assert.match(source, /safe_crop:true/);
});

test("canonical registration retries a concurrent duplicate by slug and keeps errors safe", () => {
  assert.match(source, /23505/);
  assert.match(source, /duplicate key\|unique constraint\|marketing_assets_slug/i);
  assert.match(source, /duplicate_requery/);
  assert.match(source, /ASSET_REGISTRATION_FAILED/);
  assert.match(source, /ASSET_STORAGE_UPLOAD_FAILED/);
  assert.match(source, /service\[_ -\]\?role|supabase\[_ -\]\?key/);
  assert.doesNotMatch(source, /console\.(log|error)\([^)]*png/);
});

test("health capture diagnostics report storage and registered asset state", () => {
  const health = readFileSync("src/app/api/admin/marketing/autopilot/health/route.ts", "utf8");
  assert.match(health, /registerCanonicalCapture/);
  assert.match(health, /storageUpload/);
  assert.match(health, /assetRegistration/);
  assert.match(health, /assetId/);
});

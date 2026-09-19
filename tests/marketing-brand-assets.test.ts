import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { isKnownRepoBrandAsset, isRedundantLegacyBrandAsset, REPO_BRAND_ASSET_MANIFEST, resolveAssetPreviewUrl } from "../src/lib/marketing/repo-brand-assets.ts";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("repo-owned brand assets use the exact public PNG paths and classifications", () => {
    assert.deepEqual(REPO_BRAND_ASSET_MANIFEST.map((asset) => asset.storagePath), [
      "/trading-docks-mark.png", "/trading-docks-logo.png", "/trading-docks-horizontal.png", "/icon-1024.png",
      "/icon-512.png", "/icon-256.png", "/icon-192.png", "/mstile-270x270.png",
    ]);
    assert.equal(REPO_BRAND_ASSET_MANIFEST.slice(0, 3).every((asset) => asset.assetType === "logo"), true);
    assert.equal(REPO_BRAND_ASSET_MANIFEST.slice(3).every((asset) => asset.assetType === "icon"), true);
    assert.deepEqual(REPO_BRAND_ASSET_MANIFEST.map((asset) => asset.brandRole), ["logo_icon", "logo_primary", "logo_wordmark", "app_icon_primary", null, null, null, null]);
});

test("repo-owned brand assets use direct public paths and signed URLs only for storage-backed assets", () => {
    assert.equal(resolveAssetPreviewUrl("/trading-docks-mark.png", "https://signed.example/should-not-win"), "/trading-docks-mark.png");
    assert.equal(resolveAssetPreviewUrl("uploads/asset.png", "https://signed.example/asset"), "https://signed.example/asset");
    assert.equal(resolveAssetPreviewUrl("uploads/asset.png", null), null);
});

test("repo-owned brand registration is idempotent and admin-only", () => {
    const source = read("src/app/api/admin/marketing/assets/register-repo-brand/route.ts");
    assert.match(source, /\.update\(\{ \.\.\.updateRow/);
    assert.match(source, /\.insert\(row\)/);
    assert.match(source, /requireServerPlatformRole\("admin"\)/);
    assert.match(source, /REPO_BRAND_ASSET_MANIFEST/);
});

test("unknown public files are not auto-approved", () => {
    assert.equal(isKnownRepoBrandAsset("trading-docks-mark"), true);
    assert.equal(isKnownRepoBrandAsset("unknown-public-file.png"), false);
    const source = read("src/app/api/admin/marketing/assets/register-repo-brand/route.ts");
    assert.doesNotMatch(source, /readdir/);
    assert.doesNotMatch(source, /list public/);
});

test("Brand System resolves canonical brand roles", () => {
    const source = read("src/app/api/admin/marketing/brand-system/route.ts");
    assert.match(source, /logo_primary/);
    assert.match(source, /logo_wordmark/);
    assert.match(source, /logo_icon/);
    assert.match(source, /app_icon_primary/);
    assert.match(source, /canonicalAssets/);
});

test("legacy icon drafts are excluded from the curated default view", () => {
  const source = read("src/app/api/admin/marketing/assets/route.ts");
  assert.match(source, /view === "curated"/);
  assert.match(source, /return !legacy/);
  assert.match(source, /isRedundantLegacyBrandAsset/);
});

test("archive cleanup only matches known redundant drafts and is idempotent", () => {
  const legacy = { name: "favicon-32", slug: "favicon-32", assetType: "icon", approvalStatus: "draft", source: "admin_uploaded", brandRole: null };
  assert.equal(isRedundantLegacyBrandAsset(legacy), true);
  assert.equal(isRedundantLegacyBrandAsset(legacy), isRedundantLegacyBrandAsset(legacy));
  assert.equal(isRedundantLegacyBrandAsset({ ...legacy, approvalStatus: "archived" }), false);
  assert.equal(isRedundantLegacyBrandAsset({ ...legacy, source: "repo_owned" }), false);
});

test("canonical assets, user assets, and approved product screenshots are preserved", () => {
  for (const asset of REPO_BRAND_ASSET_MANIFEST) {
    assert.equal(isRedundantLegacyBrandAsset({ name: asset.name, slug: asset.slug, assetType: asset.assetType, approvalStatus: "approved", source: "repo_owned", brandRole: asset.brandRole }), false);
  }
  assert.equal(isRedundantLegacyBrandAsset({ name: "custom-store-icon", slug: "custom-store-icon", assetType: "icon", approvalStatus: "draft", source: "admin_uploaded", brandRole: null }), false);
  assert.equal(isRedundantLegacyBrandAsset({ name: "favicon-32", slug: "favicon-32", assetType: "icon", approvalStatus: "approved", source: "admin_uploaded", brandRole: null }), false);
  assert.equal(isRedundantLegacyBrandAsset({ name: "storefront", slug: "storefront", assetType: "product_screenshot", approvalStatus: "approved", source: "admin_uploaded", brandRole: null }), false);
});

test("legacy archive endpoint is admin-only and never deletes storage", () => {
  const source = read("src/app/api/admin/marketing/assets/archive-legacy/route.ts");
  assert.match(source, /requireServerPlatformRole\("admin"\)/);
  assert.match(source, /approval_status: "archived"/);
  assert.match(source, /Storage files were not deleted/);
  assert.doesNotMatch(source, /\.remove\(/);
});

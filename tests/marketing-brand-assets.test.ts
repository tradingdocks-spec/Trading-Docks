import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { isKnownRepoBrandAsset, REPO_BRAND_ASSET_MANIFEST, resolveAssetPreviewUrl } from "../src/lib/marketing/repo-brand-assets.ts";

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

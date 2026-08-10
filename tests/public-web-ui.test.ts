import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PUBLIC_WEB_ROOTS = [
  "src/app/page.tsx",
  "src/app/pricing/page.tsx",
  "src/app/sign-in/page.tsx",
  "src/app/sign-up/page.tsx",
  "src/app/forgot-password/page.tsx",
  "src/app/update-password/page.tsx",
  "src/components/landing",
];

const DASHBOARD_UI_ROOTS = [
  "src/components/dashboard/common/PageScaffold.tsx",
  "src/components/dashboard/shared/PageScaffold.tsx",
];

test("public web surface avoids dead signup links invalid sizing utilities and mojibake", () => {
  const files = PUBLIC_WEB_ROOTS.flatMap((entry) => listSourceFiles(path.join(repoRoot, entry)));

  assert.ok(files.length > 10, "expected public web surface files");

  for (const file of files) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const source = readFileSync(file, "utf8");

    assert.doesNotMatch(source, /\/signup(?:\?|["'`/#])/i, `${relative} links to the inactive /signup route`);
    assert.doesNotMatch(source, /\bh-13\b/, `${relative} uses invalid Tailwind height utility h-13`);
    assert.doesNotMatch(source, /(?:Ã|Â|â[€”]|�)/, `${relative} contains visible encoding artifacts`);
  }
});

test("public web metadata is production-ready and auth utility pages stay out of search", () => {
  const layout = readFileSync(path.join(repoRoot, "src/app/layout.tsx"), "utf8");
  assert.match(layout, /metadataBase:\s*new URL\("https:\/\/www\.tradingdocks\.com"\)/);
  assert.match(layout, /openGraph:\s*{/);
  assert.match(layout, /twitter:\s*{/);
  assert.match(layout, /alternates:\s*{/);

  const noindexRoutes = [
    "src/app/sign-in/page.tsx",
    "src/app/forgot-password/page.tsx",
    "src/app/update-password/page.tsx",
  ];

  for (const route of noindexRoutes) {
    const source = readFileSync(path.join(repoRoot, route), "utf8");
    assert.match(source, /robots:\s*{[\s\S]*index:\s*false/, `${route} should not be indexed`);
  }

  const signUp = readFileSync(path.join(repoRoot, "src/app/sign-up/page.tsx"), "utf8");
  assert.match(signUp, /title:\s*"Create Your Workspace"/);
  assert.doesNotMatch(signUp, /index:\s*false/, "sign-up should remain a crawlable conversion route");
});

test("dashboard scaffolds use production empty-state copy", () => {
  const files = DASHBOARD_UI_ROOTS.flatMap((entry) => listSourceFiles(path.join(repoRoot, entry)));

  for (const file of files) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const source = readFileSync(file, "utf8");

    assert.doesNotMatch(source, /placeholder/i, `${relative} exposes placeholder language`);
    assert.match(source, /workspace records activity/, `${relative} should describe the real empty state`);
  }
});

function listSourceFiles(target: string): string[] {
  const stat = statSync(target);
  if (stat.isFile()) return target.endsWith(".tsx") || target.endsWith(".ts") ? [target] : [];

  const files: string[] = [];
  for (const entry of readdirSync(target)) {
    files.push(...listSourceFiles(path.join(target, entry)));
  }
  return files;
}

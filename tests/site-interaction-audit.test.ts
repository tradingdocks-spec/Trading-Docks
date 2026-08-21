import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getAccountAwareNavigationGroups } from "../src/components/dashboard/navigation.ts";
import {
  getTopbarCreateActions,
  topbarCreateActions,
} from "../src/components/dashboard/shell/create-menu-actions.ts";
import { ROUTE_ACCESS_REGISTRY, hasRouteAccess } from "../src/lib/platform/route-access.ts";
import {
  resolvePlatformAccessContext,
  type PlatformAccessContext,
} from "../mobile/services/platform-access.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ROUTE_SMOKE_PATHS = [
  "/",
  "/pricing",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/update-password",
  "/dashboard",
  "/dashboard/inventory",
  "/dashboard/label-studio",
  "/dashboard/admin",
  "/dashboard/admin/catalog/tcgplayer",
  "/dashboard/tools/csv-converter",
  "/share/binder/sample-token",
  "/share/portfolio/sample-token",
  "/q/sample-token",
  "/collectors/sample-user",
  "/api/webhooks/revenuecat",
  "/api/admin/tcgplayer-catalog",
] as const;

const STATIC_LINK_SOURCE_ROOTS = [
  "src/app/page.tsx",
  "src/app/pricing/page.tsx",
  "src/app/sign-in/page.tsx",
  "src/app/sign-up/page.tsx",
  "src/app/forgot-password/page.tsx",
  "src/app/update-password/page.tsx",
  "src/app/dashboard/layout.tsx",
  "src/app/dashboard/page.tsx",
  "src/components/landing",
  "src/components/legal",
  "src/components/navigation",
  "src/components/dashboard/navigation.ts",
  "src/components/dashboard/shell",
  "src/components/dashboard/workspace/ModularWorkspace.tsx",
  "src/components/dashboard/admin",
  "src/components/dashboard/collector-workspace",
  "src/components/dashboard/business-command-center",
  "src/components/dashboard/marketplaces",
  "src/components/dashboard/purchasing",
] as const;

type AccountFixture = {
  tier: "free" | "collector" | "seller" | "store";
  platformRole?: "owner" | "admin" | "support" | "analyst" | "user";
  authority?: "trusted" | "client";
};

function access({
  tier,
  platformRole = "user",
  authority = platformRole === "user" ? "client" : "trusted",
}: AccountFixture): PlatformAccessContext {
  return resolvePlatformAccessContext({
    userId: "site-audit-user",
    authenticated: true,
    platformRole,
    platformRoleAuthority: authority,
    accountType: tier,
    effectiveMembershipTier: tier,
    billingStatus: "active",
    workspaceRole: tier === "store" ? "manager" : "member",
  });
}

test("active app route inventory contains production public shared dashboard and API routes", () => {
  const routes = appRoutePatterns();

  assert.ok(routes.length >= 100, `expected broad route inventory, found ${routes.length}`);

  for (const smokePath of ROUTE_SMOKE_PATHS) {
    assert.ok(matchesKnownRoute(smokePath, routes), `${smokePath} is missing from the app route inventory`);
  }
});

test("account-aware dashboard navigation links resolve to actual routes", () => {
  const routes = appRoutePatterns();
  const fixtures: AccountFixture[] = [
    { tier: "free" },
    { tier: "collector" },
    { tier: "seller" },
    { tier: "store" },
    { tier: "free", platformRole: "owner" },
    { tier: "free", platformRole: "admin" },
  ];

  for (const fixture of fixtures) {
    const groups = getAccountAwareNavigationGroups(
      fixture.tier,
      fixture.platformRole === "owner" || fixture.platformRole === "admin",
      access(fixture),
    );
    const hrefs = groups.flatMap((group) => group.items.map((item) => item.href));
    assert.ok(hrefs.length >= 4, `${fixture.tier} navigation should contain usable links`);

    for (const href of hrefs) {
      assert.ok(matchesKnownRoute(href, routes), `${fixture.tier} navigation links to missing route ${href}`);
    }
  }
});

test("static public and dashboard shell links resolve and avoid placeholder hrefs", () => {
  const routes = appRoutePatterns();
  const files = STATIC_LINK_SOURCE_ROOTS.flatMap((entry) => listSourceFiles(path.join(repoRoot, entry)));
  const badHrefPattern = /href=\{?["'](?:#|javascript:|)["']|javascript:void|href=\{?["']\s*["']/;

  assert.ok(files.length > 20, "expected a meaningful static link audit surface");

  for (const file of files) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, badHrefPattern, `${relative} contains a placeholder href`);

    for (const href of staticInternalHrefs(source)) {
      assert.ok(matchesKnownRoute(href, routes), `${relative} links to missing route ${href}`);
    }
  }
});

test("role-gated route matrix preserves public shared owner seller store and free behavior", () => {
  const free = access({ tier: "free" });
  const collector = access({ tier: "collector" });
  const seller = access({ tier: "seller" });
  const store = access({ tier: "store" });
  const owner = access({ tier: "free", platformRole: "owner" });
  const clientSpoofedOwner = access({ tier: "free", platformRole: "owner", authority: "client" });

  assert.equal(hasRouteAccess(free, "/dashboard/inventory"), true);
  assert.equal(hasRouteAccess(free, "/dashboard/orders"), false);
  assert.equal(hasRouteAccess(collector, "/dashboard/deck-vault"), true);
  assert.equal(hasRouteAccess(collector, "/dashboard/orders"), false);
  assert.equal(hasRouteAccess(seller, "/dashboard/orders"), true);
  assert.equal(hasRouteAccess(seller, "/dashboard/employees"), false);
  assert.equal(hasRouteAccess(store, "/dashboard/employees"), true);
  assert.equal(hasRouteAccess(owner, "/dashboard/admin"), true);
  assert.equal(hasRouteAccess(owner, "/dashboard/label-studio"), true);
  assert.equal(hasRouteAccess(owner, "/dashboard/employees"), true);
  assert.equal(hasRouteAccess(clientSpoofedOwner, "/dashboard/admin"), false);
  assert.equal(hasRouteAccess(clientSpoofedOwner, "/dashboard/orders"), false);

  for (const publicPath of ["/", "/pricing", "/share/binder/token", "/share/portfolio/token", "/collectors/user"]) {
    assert.equal(hasRouteAccess(free, publicPath), true);
  }
});

test("route access registry classifies every concrete dashboard page", () => {
  const pages = appPageRoutes().filter((route) => route.startsWith("/dashboard"));
  const unclassified = pages.filter((route) => {
    const match = ROUTE_ACCESS_REGISTRY.find((rule) => rule.pattern.test(route));
    return !match || match.kind === "blocked";
  });

  assert.deepEqual(unclassified, []);
});

test("global Create menu actions resolve to real non-placeholder destinations", () => {
  const routes = appRoutePatterns();

  assert.ok(topbarCreateActions.length >= 2, "Create menu should expose primary actions");

  for (const action of topbarCreateActions) {
    assert.ok(action.href.trim(), `${action.label} should have a destination`);
    assert.notEqual(action.href, "#", `${action.label} must not use a placeholder href`);
    assert.doesNotMatch(action.href, /javascript:|void\(0\)/i, `${action.label} must not use a script href`);
    assert.ok(matchesKnownRoute(action.href, routes), `${action.label} links to missing route ${action.href}`);
  }

  assert.equal(
    topbarCreateActions.find((item) => item.id === "add-inventory-card")?.href,
    "/dashboard/purchasing-intelligence?action=add-inventory",
  );
  assert.equal(
    topbarCreateActions.find((item) => item.id === "create-deck")?.href,
    "/dashboard/deck-vault/new",
  );
});

test("global Create menu tier filtering avoids unauthorized dead actions", () => {
  assert.deepEqual(
    getTopbarCreateActions("free").map((item) => item.id),
    ["add-inventory-card", "create-deck"],
  );
  assert.ok(getTopbarCreateActions("collector").some((item) => item.id === "create-storage-location"));
  assert.ok(getTopbarCreateActions("seller").some((item) => item.id === "create-marketplace-listing"));
  assert.ok(getTopbarCreateActions("store").some((item) => item.id === "record-store-expense"));
});

test("active Collection workspace honors storage route query for Create menu location actions", () => {
  const source = readFileSync(
    path.join(repoRoot, "src/components/dashboard/collector-workspace/CollectorWorkspace.tsx"),
    "utf8",
  );

  assert.match(source, /useSearchParams/);
  assert.match(source, /searchParams\.get\("section"\)/);
  assert.match(source, /isCollectionSection\(requestedSection\)/);
});

test("shared scaffold surfaces do not render fake action buttons", () => {
  const commonSource = readFileSync(
    path.join(repoRoot, "src/components/dashboard/common/PageScaffold.tsx"),
    "utf8",
  );
  const sharedSource = readFileSync(
    path.join(repoRoot, "src/components/dashboard/shared/PageScaffold.tsx"),
    "utf8",
  );

  assert.match(commonSource, /export \{ PageScaffold \} from "\.\.\/shared\/PageScaffold"/);

  for (const source of [commonSource, sharedSource]) {
    assert.doesNotMatch(source, /actions\s*=\s*\["Open workspace",\s*"View activity"\]/);
    assert.doesNotMatch(source, /<button[\s\S]{0,220}\{action\}/);
  }

  for (const source of [sharedSource]) {
    assert.match(source, /primaryAction \|\| secondaryActions\.length/);
    assert.match(source, /href=\{action\.href\}/);
  }
});

test("settings data privacy actions are support-assisted or real destinations", () => {
  const source = readFileSync(
    path.join(repoRoot, "src/components/dashboard/settings/SettingsCenter.tsx"),
    "utf8",
  );

  assert.match(source, /function DataSettings\(\{ email \}/);
  assert.match(source, /accountDeletionRequestHref\(email\)/);
  assert.match(source, /mailto:tradingdocks@gmail\.com/);
  assert.match(source, /Support-assisted/);
  assert.match(source, /href="\/dashboard\/tools\/csv-converter"/);
  assert.doesNotMatch(source, /<button[^>]*>\s*Request account deletion\s*<\/button>/);
  assert.doesNotMatch(source, /<button[^>]*>\s*Export account data\s*<\/button>/);
  assert.doesNotMatch(source, /<button[^>]*>\s*Download inventory backup\s*<\/button>/);
});

test("Card Shows purchase drafts persist through account documents not localStorage authority", () => {
  const source = readFileSync(
    path.join(repoRoot, "src/components/dashboard/card-shows/CardShowsWorkspace.tsx"),
    "utf8",
  );

  assert.match(source, /loadAccountDocument<PurchaseOrderDraft>\("card-shows:buying-cart:v1"\)/);
  assert.match(source, /saveAccountDocument\("card-shows:buying-cart:v1"/);
  assert.match(source, /deleteAccountDocument\("card-shows:buying-cart:v1"\)/);
  assert.doesNotMatch(source, /localStorage\.setItem\(\s*["']td-card-show-buying-cart-v1["']/);
  assert.match(source, /localStorage\.getItem\("td-card-show-buying-cart-v1"\)/);
  assert.match(source, /localStorage\.removeItem\("td-card-show-buying-cart-v1"\)/);
});

function appRoutePatterns(): RegExp[] {
  return appRoutesFromFiles(["page.tsx", "route.ts"]).map(routeToPattern);
}

function appPageRoutes(): string[] {
  return appRoutesFromFiles(["page.tsx"]);
}

function appRoutesFromFiles(routeFileNames: string[]): string[] {
  return listSourceFiles(path.join(repoRoot, "src/app"))
    .filter((file) => routeFileNames.includes(path.basename(file)))
    .map((file) => fileToRoute(file))
    .sort();
}

function fileToRoute(file: string): string {
  const relative = path.relative(path.join(repoRoot, "src/app"), file).replace(/\\/g, "/");
  const withoutFile = relative
    .replace(/\/(?:page|route)\.tsx?$/, "")
    .replace(/^(?:page|route)\.tsx?$/, "");
  const withoutRouteGroups = withoutFile
    .split("/")
    .filter((segment) => !segment.startsWith("(") || !segment.endsWith(")"))
    .join("/");
  return normalizePath(`/${withoutRouteGroups}`);
}

function routeToPattern(route: string): RegExp {
  const escaped = route
    .split("/")
    .map((segment) => {
      if (!segment) return "";
      if (segment.startsWith("[") && segment.endsWith("]")) return "[^/]+";
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return new RegExp(`^${escaped === "" ? "/" : escaped}/?$`);
}

function matchesKnownRoute(href: string, routes: RegExp[]): boolean {
  const normalized = normalizePath(stripQueryAndHash(href));
  return routes.some((route) => route.test(normalized));
}

function staticInternalHrefs(source: string): string[] {
  const hrefs = new Set<string>();
  const staticHrefPattern = /\bhref=(?:\{)?["'`]([^"'`]+)["'`](?:\})?/g;
  for (const match of source.matchAll(staticHrefPattern)) {
    const href = match[1];
    if (!href?.startsWith("/")) continue;
    if (href.startsWith("//")) continue;
    hrefs.add(stripQueryAndHash(href));
  }
  return [...hrefs];
}

function stripQueryAndHash(href: string): string {
  return href.split(/[?#]/)[0] ?? href;
}

function normalizePath(value: string): string {
  const normalized = value.replace(/\/+/g, "/").replace(/\/$/, "");
  return normalized === "" ? "/" : normalized;
}

function listSourceFiles(target: string): string[] {
  const stat = statSync(target);
  if (stat.isFile()) return target.endsWith(".tsx") || target.endsWith(".ts") ? [target] : [];

  const files: string[] = [];
  for (const entry of readdirSync(target)) {
    if (entry === ".next" || entry === "node_modules") continue;
    if (entry.includes("backup")) continue;
    files.push(...listSourceFiles(path.join(target, entry)));
  }
  return files;
}

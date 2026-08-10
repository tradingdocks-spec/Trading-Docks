import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  defaultSidebarOpenSections,
  normalizeSidebarOpenSections,
  openSidebarSectionsForPath,
  parseSidebarOpenSections,
  serializeSidebarOpenSections,
  toggleSidebarSection,
} from "../src/lib/navigation/sidebar-sections.ts";
import { getAccountAwareNavigationGroups } from "../src/components/dashboard/navigation.ts";
import {
  clientAccessFromTier,
  resolvePlatformAccessContext,
  type PlatformAccessContext,
} from "../mobile/services/platform-access.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function hrefsFor(groups: ReturnType<typeof getAccountAwareNavigationGroups>) {
  return groups.flatMap((group) => group.items.map((item) => item.href));
}

function access(input: {
  tier: "free" | "collector" | "seller" | "store";
  platformRole?: "owner" | "admin" | "support" | "analyst" | "user";
  workspaceRole?: "owner" | "admin" | "manager" | "member" | "viewer" | null;
}): PlatformAccessContext {
  return resolvePlatformAccessContext({
    userId: "test-user",
    authenticated: true,
    platformRole: input.platformRole ?? "user",
    platformRoleAuthority: input.platformRole && input.platformRole !== "user" ? "trusted" : "client",
    accountType: input.tier,
    effectiveMembershipTier: input.tier,
    billingStatus: "active",
    workspaceRole: input.workspaceRole ?? null,
  });
}

test("sidebar section helpers open and close non-active sections", () => {
  const seller = clientAccessFromTier("seller", { workspaceRole: "member" });
  const groups = getAccountAwareNavigationGroups("seller", false, seller);
  const opened = toggleSidebarSection(groups, ["collector"], "purchasing");

  assert.deepEqual(opened, ["collector", "purchasing"]);

  const closed = toggleSidebarSection(groups, opened, "purchasing");

  assert.deepEqual(closed, ["collector"]);
});

test("active sidebar section opens on route load and may be manually collapsed", () => {
  const seller = clientAccessFromTier("seller", { workspaceRole: "member" });
  const groups = getAccountAwareNavigationGroups("seller", false, seller);
  const normalized = openSidebarSectionsForPath(groups, ["collector"], "/dashboard/orders");

  assert.ok(normalized.includes("collector"));
  assert.ok(normalized.includes("selling"));

  const toggled = toggleSidebarSection(groups, normalized, "selling");

  assert.equal(toggled.includes("selling"), false);
});

test("persisted sidebar section state is parsed safely and keeps the active section visible", () => {
  const store = clientAccessFromTier("store", { workspaceRole: "manager" });
  const groups = getAccountAwareNavigationGroups("store", false, store);
  const raw = serializeSidebarOpenSections(["operations", "tools"]);
  const parsed = openSidebarSectionsForPath(
    groups,
    parseSidebarOpenSections(raw, groups),
    "/dashboard/customers",
  );

  assert.ok(parsed.includes("operations"));
  assert.ok(parsed.includes("tools"));
  assert.ok(parsed.includes("crm"));
  assert.deepEqual(
    openSidebarSectionsForPath(groups, parseSidebarOpenSections("{broken", groups), "/dashboard"),
    ["collector"],
  );
});

test("collapsed active section stays collapsed until navigation enters a section", () => {
  const seller = clientAccessFromTier("seller", { workspaceRole: "member" });
  const groups = getAccountAwareNavigationGroups("seller", false, seller);
  const initial = openSidebarSectionsForPath(groups, ["collector"], "/dashboard/orders");
  const manuallyCollapsed = toggleSidebarSection(groups, initial, "selling");

  assert.equal(manuallyCollapsed.includes("selling"), false);
  assert.equal(normalizeSidebarOpenSections(groups, manuallyCollapsed).includes("selling"), false);

  const afterNavigation = openSidebarSectionsForPath(
    groups,
    manuallyCollapsed,
    "/dashboard/buylist-connections",
  );

  assert.ok(afterNavigation.includes("purchasing"));
  assert.equal(afterNavigation.includes("selling"), false);
});

test("manual sidebar normalization allows every section to be collapsed", () => {
  const seller = clientAccessFromTier("seller", { workspaceRole: "member" });
  const groups = getAccountAwareNavigationGroups("seller", false, seller);

  assert.deepEqual(normalizeSidebarOpenSections(groups, []), []);
  assert.deepEqual(defaultSidebarOpenSections(groups, "/dashboard"), ["collector"]);
});

test("Owner navigation still receives every eligible module after sidebar sections collapse", () => {
  const owner = access({
    tier: "free",
    platformRole: "owner",
    workspaceRole: null,
  });
  const groups = getAccountAwareNavigationGroups("free", true, owner);
  const hrefs = hrefsFor(groups);

  assert.ok(hrefs.includes("/dashboard/admin"));
  assert.ok(hrefs.includes("/dashboard/orders"));
  assert.ok(hrefs.includes("/dashboard/employees"));
  assert.ok(hrefs.includes("/dashboard/label-studio"));
  assert.ok(hrefs.includes("/dashboard/buylist-connections"));

  const visibleWithOnlyCollectorOpen = hrefsFor(groups);

  assert.deepEqual(visibleWithOnlyCollectorOpen, hrefs);
});

test("paid and free membership visibility is unchanged by collapsible section state", () => {
  const freeGroups = getAccountAwareNavigationGroups("free", false, access({ tier: "free" }));
  const collectorGroups = getAccountAwareNavigationGroups("collector", false, access({ tier: "collector" }));
  const sellerGroups = getAccountAwareNavigationGroups("seller", false, access({ tier: "seller", workspaceRole: "member" }));
  const storeGroups = getAccountAwareNavigationGroups("store", false, access({ tier: "store", workspaceRole: "manager" }));

  assert.ok(hrefsFor(freeGroups).includes("/dashboard/inventory"));
  assert.equal(hrefsFor(freeGroups).includes("/dashboard/orders"), false);
  assert.equal(hrefsFor(collectorGroups).includes("/dashboard/orders"), false);
  assert.ok(hrefsFor(sellerGroups).includes("/dashboard/orders"));
  assert.equal(hrefsFor(sellerGroups).includes("/dashboard/employees"), false);
  assert.ok(hrefsFor(storeGroups).includes("/dashboard/employees"));
});

test("collapsing sections does not remove routes from the navigation catalog", () => {
  const store = clientAccessFromTier("store", { workspaceRole: "manager" });
  const groups = getAccountAwareNavigationGroups("store", false, store);
  const catalogBefore = hrefsFor(groups);
  const openSections = toggleSidebarSection(groups, ["collector"], "operations");

  assert.ok(openSections.includes("operations"));
  assert.deepEqual(hrefsFor(groups), catalogBefore);
});

test("TieredSidebar renders accessible collapsible section controls", () => {
  const source = readFileSync(
    path.join(repoRoot, "src/components/dashboard/shell/TieredSidebar.tsx"),
    "utf8",
  );

  assert.match(source, /SIDEBAR_SECTION_STORAGE_KEY/);
  assert.match(source, /type="button"[\s\S]*aria-expanded=\{open\}/);
  assert.match(source, /ChevronDown/);
  assert.match(source, /focus-visible:ring-2/);
  assert.match(source, /open=\{collapsed \|\| openSectionIds\.includes\(group\.id\)\}/);
});

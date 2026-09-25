import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CAPABILITY_REGISTRY,
  clientAccessFromTier,
  hasCapability,
  normalizeAccountType,
  normalizeMembershipTier,
  normalizeWorkspaceRole,
  resolvePlatformAccessContext,
  type PlatformAccessContext,
  type PlatformCapability,
  type WorkspaceRole,
} from "../mobile/services/platform-access.ts";
import {
  hasRouteAccess,
  requiredMembershipForRoute,
  routeAccessRuleForPath,
} from "../src/lib/platform/route-access.ts";
import { apiAccessRuleForPath, apiCapabilityDecision } from "../src/lib/platform/api-access.ts";
import { getAccountAwareNavigationGroups } from "../src/components/dashboard/navigation.ts";
import { resolveWorkspaceAccessFromRows } from "../src/lib/platform/workspace-resolution.ts";
import {
  canAccessHiddenDeckArchitect,
  DECK_ARCHITECT_VISIBLE,
} from "../src/lib/product-visibility.ts";
import {
  availableDashboardLayouts,
  canUseDashboardWidget,
} from "../src/lib/dashboard-entitlements.ts";
import { summarizeAnalyticsInventory } from "../src/lib/dashboard/analytics-summary.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function access(input: Partial<PlatformAccessContext> & { tier?: string } = {}) {
  return resolvePlatformAccessContext({
    userId: input.authenticated === false ? null : "user-1",
    authenticated: input.authenticated ?? true,
    platformRole: input.platformRole ?? "user",
    accountType: input.accountType ?? input.tier ?? "collector",
    effectiveMembershipTier: input.membershipTier ?? input.tier ?? "free",
    billingStatus: input.billingStatus ?? "active",
    workspaceRole: input.workspaceRole ?? null,
    suspended: input.suspended ?? false,
  });
}

function navigationHrefsFor(accessContext: PlatformAccessContext) {
  return getAccountAwareNavigationGroups(
    accessContext.membershipTier,
    accessContext.platformRole !== "user",
    accessContext,
  )
    .flatMap((group) => group.items)
    .map((item) => item.href);
}

function navigationLabelsFor(accessContext: PlatformAccessContext) {
  return getAccountAwareNavigationGroups(
    accessContext.membershipTier,
    accessContext.platformRole !== "user",
    accessContext,
  )
    .flatMap((group) => group.items)
    .map((item) => item.label);
}

test("admin control center follows the canonical administration information architecture", () => {
  const source = readFileSync(
    path.join(repoRoot, "src/components/dashboard/admin/AdminControlCenterWithPreview.tsx"),
    "utf8",
  );

  const labels = [
    "Overview",
    "Users",
    "Trials & Promotions",
    "Plans & Limits",
    "Plan Preview",
    "Feature Access",
    "Categories",
    "Customer Support",
    "Billing & Credits",
    "Announcements",
    "System Health",
    "Data & Backups",
    "Catalog Management",
    "TCGplayer Catalog",
    "Product Analytics",
    "Feedback & Beta",
    "Integrations",
    "Security",
    "Audit Log",
  ];

  let cursor = -1;
  for (const label of labels) {
    const next = source.indexOf(`label: "${label}"`);
    assert.ok(next > cursor, `${label} should appear in the canonical admin order`);
    cursor = next;
  }

  assert.match(source, /href:\s*"\/dashboard\/admin\/catalog\/tcgplayer"/);
  assert.match(source, /tab === "catalog"/);
});

test("capability registry uses action names and canonical tier boundaries", () => {
  const capabilities = Object.keys(CAPABILITY_REGISTRY) as PlatformCapability[];

  assert.equal(capabilities.includes("collection.read"), true);
  assert.equal(capabilities.includes("orders.manage"), true);
  assert.equal(capabilities.includes("platform.admin"), true);
  assert.equal(capabilities.some((capability) => capability.startsWith("/dashboard")), false);
  assert.equal(CAPABILITY_REGISTRY["collection.read"].minimumTier, "free");
  assert.equal(CAPABILITY_REGISTRY["binder.manage"].minimumTier, "collector");
  assert.equal(CAPABILITY_REGISTRY["orders.manage"].minimumTier, "seller");
  assert.equal(CAPABILITY_REGISTRY["employees.manage"].minimumTier, "store");
});

test("canonical tier normalization keeps business as a compatibility alias only", () => {
  assert.equal(normalizeMembershipTier("business"), "store");
  assert.equal(normalizeAccountType("business"), "store");
  assert.equal(normalizeMembershipTier("store"), "store");
  assert.equal(normalizeAccountType("store"), "store");
});

test("unauthenticated users fail protected capabilities", () => {
  const guest = access({ authenticated: false });

  assert.equal(hasCapability(guest, "collection.read"), false);
  assert.deepEqual(apiCapabilityDecision(guest, "collection.read"), {
    allowed: false,
    status: 401,
    error: "Authentication required.",
  });
});

test("Free Collector Seller and Store capabilities follow the audited matrix", () => {
  const free = access({ tier: "free" });
  const collector = access({ tier: "collector" });
  const seller = access({ tier: "seller" });
  const store = access({ tier: "store", workspaceRole: "owner" });

  assert.equal(hasCapability(free, "collection.read"), true);
  assert.equal(hasCapability(free, "crm.manage"), false);
  assert.equal(hasCapability(free, "employees.manage"), false);

  assert.equal(hasCapability(collector, "binder.manage"), true);
  assert.equal(hasCapability(collector, "wishlist.manage"), true);
  assert.equal(hasCapability(collector, "orders.manage"), false);

  assert.equal(hasCapability(seller, "inventory.manage"), true);
  assert.equal(hasCapability(seller, "orders.manage"), true);
  assert.equal(hasCapability(seller, "employees.manage"), false);

  assert.equal(hasCapability(store, "employees.manage"), true);
  assert.equal(hasCapability(store, "workspace.members.manage"), true);
});

test("trusted platform Owner receives full effective access without changing billing tier", () => {
  for (const tier of ["free", "collector", "seller", "store"] as const) {
    const owner = access({
      tier,
      platformRole: "owner",
      platformRoleAuthority: "trusted",
      workspaceRole: null,
    });

    assert.equal(owner.platformRole, "owner");
    assert.equal(owner.platformRoleAuthority, "trusted");
    assert.equal(owner.membershipTier, tier);
    for (const capability of Object.keys(CAPABILITY_REGISTRY) as PlatformCapability[]) {
      assert.equal(hasCapability(owner, capability), true, `${tier} Owner should receive ${capability}`);
    }
    assert.equal(hasRouteAccess(owner, "/dashboard/orders"), true);
    assert.equal(hasRouteAccess(owner, "/dashboard/employees"), true);
    assert.equal(apiCapabilityDecision(owner, "marketplaces.manage").status, 200);
  }
});

test("trusted platform Admin receives full effective access without changing billing tier", () => {
  for (const tier of ["free", "collector", "seller", "store"] as const) {
    const admin = access({
      tier,
      platformRole: "admin",
      platformRoleAuthority: "trusted",
      workspaceRole: null,
    });

    assert.equal(admin.platformRole, "admin");
    assert.equal(admin.platformRoleAuthority, "trusted");
    assert.equal(admin.membershipTier, tier);
    for (const capability of Object.keys(CAPABILITY_REGISTRY) as PlatformCapability[]) {
      assert.equal(hasCapability(admin, capability), true, `${tier} Admin should receive ${capability}`);
    }
    assert.equal(hasRouteAccess(admin, "/dashboard/orders"), true);
    assert.equal(hasRouteAccess(admin, "/dashboard/employees"), true);
    assert.equal(apiCapabilityDecision(admin, "marketplaces.manage").status, 200);
  }
});

test("client-created access objects cannot self-escalate to Owner access", () => {
  const manipulated = clientAccessFromTier("free", {
    platformRole: "owner",
    entitlements: [
      "deal-desk",
      "employee-accounts",
      "admin.command-center",
    ],
    workspaceRole: "owner",
  });

  assert.equal(manipulated.platformRole, "user");
  assert.equal(manipulated.platformRoleAuthority, "client");
  assert.equal(hasCapability(manipulated, "platform.admin"), false);
  assert.equal(hasCapability(manipulated, "orders.manage"), false);
  assert.equal(hasCapability(manipulated, "employees.manage"), false);
  assert.equal(hasRouteAccess(manipulated, "/dashboard/admin"), false);
});

test("workspace roles do not grant platform admin or paid membership by themselves", () => {
  const manager = access({ tier: "free", workspaceRole: "manager" });
  const owner = access({ tier: "free", workspaceRole: "owner" });

  assert.equal(manager.membershipTier, "free");
  assert.equal(hasCapability(manager, "platform.admin"), false);
  assert.equal(hasCapability(manager, "employees.manage"), false);
  assert.equal(owner.membershipTier, "free");
  assert.equal(hasCapability(owner, "billing.manage"), true);
  assert.equal(hasCapability(owner, "orders.manage"), false);
});

test("workspace role ordering is normalized and capability scoped", () => {
  const roles: WorkspaceRole[] = ["viewer", "member", "manager", "admin", "owner"];
  for (const role of roles) assert.equal(normalizeWorkspaceRole(role), role);
  assert.equal(normalizeWorkspaceRole("employee"), "employee");

  const storeMember = access({ tier: "store", workspaceRole: "member" });
  const storeManager = access({ tier: "store", workspaceRole: "manager" });

  assert.equal(hasCapability(storeMember, "supplies.manage"), true);
  assert.equal(hasCapability(storeMember, "employees.manage"), false);
  assert.equal(hasCapability(storeManager, "employees.manage"), true);
  assert.equal(hasCapability(storeManager, "billing.manage"), false);
});

test("employee POS entry does not grant paid inventory administration", () => {
  for (const workspaceRole of ['employee', 'member'] as const) {
    const employee = access({ tier: "free", workspaceRole });
    assert.equal(hasCapability(employee, "pos.sell"), true);
    assert.equal(hasCapability(employee, "employees.manage"), false);
    assert.equal(hasCapability(employee, "orders.manage"), false);
    assert.equal(hasCapability(employee, "label.manage_templates"), false);
  }
  assert.equal(hasCapability(access({ tier: 'free', workspaceRole: 'viewer' }), 'pos.sell'), false);
});

test("trusted platform admin receives full access and does not corrupt normal membership identity", () => {
  const admin = access({ tier: "free", platformRole: "admin", platformRoleAuthority: "trusted", accountType: "collector" });

  assert.equal(admin.membershipTier, "free");
  assert.equal(admin.accountType, "collector");
  assert.equal(hasCapability(admin, "platform.admin"), true);
  assert.equal(hasCapability(admin, "orders.manage"), true);
  assert.equal(hasCapability(admin, "employees.manage"), true);
});

test("dashboard module filtering uses effective entitlements instead of raw billing tier", () => {
  const free = access({ tier: "free" });
  const collector = access({ tier: "collector" });
  const seller = access({ tier: "seller" });
  const store = access({ tier: "store", workspaceRole: "owner" });
  const ownerFree = access({
    tier: "free",
    platformRole: "owner",
    platformRoleAuthority: "trusted",
    workspaceRole: null,
  });
  const adminFree = access({
    tier: "free",
    platformRole: "admin",
    platformRoleAuthority: "trusted",
    workspaceRole: null,
  });
  const manipulated = clientAccessFromTier("free", {
    platformRole: "owner",
    entitlements: ["deal-desk", "employee-accounts"],
    workspaceRole: "owner",
  });

  assert.equal(canUseDashboardWidget("free", "revenue", free), false);
  assert.equal(canUseDashboardWidget("collector", "collection-growth", collector), true);
  assert.equal(canUseDashboardWidget("collector", "orders", collector), false);
  assert.equal(canUseDashboardWidget("seller", "orders", seller), true);
  assert.equal(canUseDashboardWidget("seller", "team", seller), false);
  assert.equal(canUseDashboardWidget("store", "team", store), true);
  assert.equal(canUseDashboardWidget("free", "revenue", ownerFree), true);
  assert.equal(canUseDashboardWidget("free", "team", ownerFree), true);
  assert.equal(canUseDashboardWidget("free", "ai", adminFree), true);
  assert.equal(canUseDashboardWidget("free", "revenue", manipulated), false);
  assert.equal(availableDashboardLayouts("free", ownerFree).has("business"), true);
  assert.equal(availableDashboardLayouts("free", manipulated).has("business"), false);
});

test("dashboard chrome consumes canonical platform access instead of raw billing plan", () => {
  const layoutSource = readFileSync(path.join(repoRoot, "src/app/dashboard/layout.tsx"), "utf8");
  const shellSource = readFileSync(
    path.join(repoRoot, "src/components/dashboard/shell/TieredDashboardShell.tsx"),
    "utf8",
  );
  const topbarSource = readFileSync(
    path.join(repoRoot, "src/components/dashboard/shell/Topbar.tsx"),
    "utf8",
  );
  const mobileNavSource = readFileSync(
    path.join(repoRoot, "src/components/dashboard/shell/MobileBottomNav.tsx"),
    "utf8",
  );

  assert.match(layoutSource, /const clientAccess = toClientSafeAccess\(platformAccess\)/);
  assert.match(layoutSource, /hasCapability\(clientAccess, "platform\.admin"\)/);
  assert.match(shellSource, /<Topbar[\s\S]*clientAccess=\{clientAccess\}/);
  assert.match(shellSource, /<MobileBottomNav[\s\S]*clientAccess=\{clientAccess\}/);
  assert.match(topbarSource, /hasCapability\(clientAccess, "platform\.admin"\)/);
  assert.match(topbarSource, /hasTrustedFullPlatformAccess\(clientAccess\)/);
  assert.match(topbarSource, /Full platform access/);
  assert.doesNotMatch(topbarSource, /Free plan[\s\S]{0,160}Admin Control Center/);
  assert.match(mobileNavSource, /getAccountAwareNavigationGroups\(accountType, isOwner, clientAccess\)/);
});

test("analytics workspace composes Owner/Admin access from platform authority", () => {
  const pageSource = readFileSync(path.join(repoRoot, "src/app/dashboard/analytics/page.tsx"), "utf8");
  const componentSource = readFileSync(
    path.join(repoRoot, "src/components/dashboard/analytics/AnalyticsCommandCenter.tsx"),
    "utf8",
  );

  assert.match(pageSource, /resolvePlatformAccessForUser/);
  assert.match(pageSource, /hasTrustedFullPlatformAccess\(access\)/);
  assert.match(pageSource, /fullPlatformAccess=\{hasTrustedFullPlatformAccess\(access\)\}/);
  assert.match(componentSource, /const sellerView = fullPlatformAccess \|\| plan === "seller" \|\| plan === "store"/);
  assert.match(componentSource, /Owner full access/);
  assert.doesNotMatch(componentSource, /Live priorities/);
});

test("analytics inventory edits do not establish acquisition", () => {
  const now = Date.parse("2026-08-15T12:00:00.000Z");

  assert.deepEqual(
    summarizeAnalyticsInventory(
      [
        {
          quantity: 3,
          inventory_value: 12.5,
          data: null,
          updated_at: "2026-08-10T12:00:00.000Z",
        },
        {
          quantity: null,
          inventory_value: null,
          data: { quantity: 2, value: 7.25 },
          updated_at: "2026-07-01T12:00:00.000Z",
        },
      ],
      now,
    ),
    { units: 5, value: 19.75, skus: 2, addedLast30Days: null },
  );
});

test("representative route registry maps public auth tier and platform routes", () => {
  const guest = access({ authenticated: false });
  const collector = access({ tier: "collector" });
  const seller = access({ tier: "seller" });
  const storeOwner = access({ tier: "store", workspaceRole: "owner" });
  const admin = access({ tier: "free", platformRole: "admin", platformRoleAuthority: "trusted" });

  assert.equal(routeAccessRuleForPath("/")?.kind, "public");
  assert.equal(hasRouteAccess(guest, "/"), true);
  assert.equal(hasRouteAccess(guest, "/dashboard"), false);
  assert.equal(hasRouteAccess(collector, "/dashboard/inventory"), true);
  assert.equal(hasRouteAccess(collector, "/dashboard/orders"), false);
  assert.equal(hasRouteAccess(seller, "/dashboard/orders"), true);
  const labelStudioRouteRule = routeAccessRuleForPath("/dashboard/label-studio");
  assert.equal(labelStudioRouteRule?.kind, "capability");
  assert.equal(labelStudioRouteRule?.kind === "capability" ? labelStudioRouteRule.capability : null, "label.view");
  assert.equal(hasRouteAccess(collector, "/dashboard/label-studio"), false);
  assert.equal(hasRouteAccess(seller, "/dashboard/label-studio"), true);
  assert.equal(hasRouteAccess(seller, "/dashboard/employees"), false);
  assert.equal(hasRouteAccess(storeOwner, "/dashboard/employees"), true);
  assert.equal(hasRouteAccess(admin, "/dashboard/admin"), true);
  assert.equal(hasRouteAccess(collector, "/dev/design-system", "production"), false);
  assert.equal(hasRouteAccess(collector, "/dev/design-system", "development"), true);
  assert.equal(hasRouteAccess(storeOwner, "/dashboard/unclassified-future-tool"), false);
});

test("navigation visibility server route access and API decisions agree", () => {
  const sellerClient = clientAccessFromTier("seller", { workspaceRole: "manager" });
  const collectorClient = clientAccessFromTier("collector");

  assert.equal(hasRouteAccess(sellerClient, "/dashboard/orders"), true);
  assert.equal(apiCapabilityDecision(sellerClient, "orders.manage").status, 200);
  assert.equal(hasRouteAccess(collectorClient, "/dashboard/orders"), false);
  assert.equal(apiCapabilityDecision(collectorClient, "orders.manage").status, 403);
  assert.equal(requiredMembershipForRoute("/dashboard/orders"), "seller");
});

test("Label Studio is an Operations navigation item gated by route access", () => {
  const navigationSource = readFileSync(path.join(repoRoot, "src/components/dashboard/navigation.ts"), "utf8");
  const sidebarSource = readFileSync(path.join(repoRoot, "src/components/dashboard/shell/TieredSidebar.tsx"), "utf8");
  const sellerClient = clientAccessFromTier("seller", { workspaceRole: "member" });
  const collectorClient = clientAccessFromTier("collector");
  const sellingNavStart = navigationSource.indexOf("export const SELLING_NAV");
  const operationsNavStart = navigationSource.indexOf("export const OPERATIONS_NAV");
  const sellingNavBlock = navigationSource.slice(sellingNavStart, operationsNavStart);
  const operationsNavBlock = navigationSource.slice(operationsNavStart);

  assert.match(operationsNavBlock, /label:\s*"Operate"[\s\S]*label:\s*"Label Studio"/);
  assert.doesNotMatch(sellingNavBlock, /label:\s*"Label Studio"/);
  assert.match(sidebarSource, /item\.href === LABEL_STUDIO_ROUTE && !allowed/);
  assert.equal(hasRouteAccess(sellerClient, "/dashboard/label-studio"), true);
  assert.equal(hasRouteAccess(collectorClient, "/dashboard/label-studio"), false);
  const operationsRouteRule = routeAccessRuleForPath("/dashboard/label-studio");
  assert.equal(operationsRouteRule?.kind === "capability" ? operationsRouteRule.capability : null, "label.view");
});

test("dashboard navigation preserves the full account-aware feature surface", () => {
  const navigationSource = readFileSync(path.join(repoRoot, "src/components/dashboard/navigation.ts"), "utf8");
  const missionControlPreviewPage = readFileSync(
    path.join(repoRoot, "src/app/dashboard/mission-control-preview/page.tsx"),
    "utf8",
  );
  const free = access({ tier: "free" });
  const collector = access({ tier: "collector" });
  const seller = access({ tier: "seller" });
  const store = access({ tier: "store", workspaceRole: "owner" });
  const owner = access({
    tier: "free",
    platformRole: "owner",
    platformRoleAuthority: "trusted",
    workspaceRole: null,
  });
  const admin = access({
    tier: "free",
    platformRole: "admin",
    platformRoleAuthority: "trusted",
    workspaceRole: null,
  });

  const freeHrefs = navigationHrefsFor(free);
  assert.ok(freeHrefs.includes("/dashboard/inventory"));
  assert.ok(freeHrefs.includes("/dashboard/deck-vault"));
  assert.equal(freeHrefs.includes("/dashboard/orders"), false);
  assert.equal(freeHrefs.includes("/dashboard/deck-architect"), false);

  const collectorHrefs = navigationHrefsFor(collector);
  assert.equal(collectorHrefs.includes("/dashboard/collector-portfolio"), false);
  assert.equal(collectorHrefs.includes("/dashboard/orders"), false);
  assert.equal(collectorHrefs.includes("/dashboard/deck-architect"), false);

  const sellerHrefs = navigationHrefsFor(seller);
  for (const href of [
    "/dashboard/collection-buying",
    "/dashboard/sealed-buying",
    "/dashboard/bulk-buying",
    "/dashboard/purchase-history",
    "/dashboard/buying-rules",
    "/dashboard/buying-recommendations",
    "/dashboard/buylist-intelligence",
    "/dashboard/buylist-connections",
    "/dashboard/card-shows",
    "/dashboard/marketplaces",
    "/dashboard/sell-optimizer",
    "/dashboard/orders",
    "/dashboard/analytics",
    "/dashboard/automation",
    "/dashboard/tools/csv-converter",
    "/dashboard/label-studio",
  ]) {
    assert.ok(sellerHrefs.includes(href), `Seller navigation missing ${href}`);
  }
  assert.equal(sellerHrefs.includes("/dashboard/employees"), false);
  assert.equal(sellerHrefs.includes("/dashboard/deck-architect"), false);

  const storeHrefs = navigationHrefsFor(store);
  for (const href of [
    "/dashboard/collection-buying",
    "/dashboard/orders",
    "/dashboard/customers",
    "/dashboard/calendar",
    "/dashboard/employees",
    "/dashboard/payroll",
    "/dashboard/tasks",
    "/dashboard/vendors",
    "/dashboard/supplies",
    "/dashboard/reports",
  ]) {
    assert.ok(storeHrefs.includes(href), `Store navigation missing ${href}`);
  }
  assert.equal(storeHrefs.includes("/dashboard/deck-architect"), false);

  const ownerHrefs = navigationHrefsFor(owner);
  const ownerLabels = navigationLabelsFor(owner);
  const adminHrefs = navigationHrefsFor(admin);
  for (const href of [
    "/dashboard/collection-buying",
    "/dashboard/sealed-buying",
    "/dashboard/bulk-buying",
    "/dashboard/buylist-intelligence",
    "/dashboard/marketplaces",
    "/dashboard/orders",
    "/dashboard/employees",
    "/dashboard/payroll",
    "/dashboard/label-studio",
    "/dashboard/admin",
  ]) {
    assert.ok(ownerHrefs.includes(href), `Owner navigation missing ${href}`);
    assert.ok(adminHrefs.includes(href), `Admin navigation missing ${href}`);
  }
  assert.ok(ownerHrefs.includes("/dashboard/showcase"));
  assert.ok(ownerHrefs.includes("/dashboard/showcase/kiosks"));
  assert.ok(ownerLabels.includes("Kiosk"));
  assert.ok(ownerLabels.includes("Command Center"));
  assert.equal(ownerHrefs.includes("/dashboard/deck-architect"), false);
  assert.equal(adminHrefs.includes("/dashboard/deck-architect"), false);
  assert.ok(adminHrefs.includes("/dashboard/admin/marketing/intelligence"));
  assert.equal(freeHrefs.includes("/dashboard/admin/marketing/intelligence"), false);
  assert.equal(collectorHrefs.includes("/dashboard/admin/marketing/intelligence"), false);
  assert.equal(sellerHrefs.includes("/dashboard/admin/marketing/intelligence"), false);
  assert.equal(storeHrefs.includes("/dashboard/admin/marketing/intelligence"), false);

  assert.equal(sellerHrefs.includes("/dashboard/mission-control-preview"), false);
  assert.equal(ownerHrefs.includes("/dashboard/mission-control-preview"), false);
  assert.doesNotMatch(navigationSource, /Mission Control Preview/);
  assert.match(missionControlPreviewPage, /redirect\("\/dashboard"\)/);
  assert.doesNotMatch(missionControlPreviewPage, /orderCount:\s*284|revenue:\s*18426|profit:\s*6284/);
});

test("Deck Architect is hidden from normal navigation but remains admin-accessible directly", () => {
  const free = access({ tier: "free" });
  const collector = access({ tier: "collector" });
  const seller = access({ tier: "seller" });
  const store = access({ tier: "store", workspaceRole: "owner" });
  const owner = access({
    tier: "free",
    platformRole: "owner",
    platformRoleAuthority: "trusted",
    workspaceRole: null,
  });
  const admin = access({
    tier: "free",
    platformRole: "admin",
    platformRoleAuthority: "trusted",
    workspaceRole: null,
  });
  const routeSource = readFileSync(path.join(repoRoot, "src/app/dashboard/deck-architect/page.tsx"), "utf8");
  const contractSource = readFileSync(path.join(repoRoot, "src/lib/navigation/contract.ts"), "utf8");

  assert.equal(DECK_ARCHITECT_VISIBLE, false);
  for (const context of [free, collector, seller, store, owner, admin]) {
    assert.equal(navigationHrefsFor(context).includes("/dashboard/deck-architect"), false);
    assert.equal(navigationLabelsFor(context).includes("Deck Architect"), false);
  }
  assert.match(contractSource, /isDeckArchitectRoute\(item\.href\)/);
  assert.match(contractSource, /shouldShowDeckArchitectEntry\(\)/);
  assert.equal(canAccessHiddenDeckArchitect(free), false);
  assert.equal(canAccessHiddenDeckArchitect(owner), true);
  assert.equal(canAccessHiddenDeckArchitect(admin), true);
  assert.match(routeSource, /DECK_ARCHITECT_VISIBLE/);
  assert.match(routeSource, /canAccessHiddenDeckArchitect\(access\)/);
  assert.match(routeSource, /redirect\("\/dashboard\/deck-vault"\)/);
});

test("Showcase and Kiosk navigation entries have distinct active scopes", () => {
  const source = readFileSync(path.join(repoRoot, "src/components/dashboard/navigation.ts"), "utf8");
  const sidebar = readFileSync(path.join(repoRoot, "src/components/dashboard/shell/TieredSidebar.tsx"), "utf8");
  const mobile = readFileSync(path.join(repoRoot, "src/components/dashboard/shell/MobileBottomNav.tsx"), "utf8");
  assert.match(source, /href: "\/dashboard\/showcase",[\s\S]*exact: true/);
  assert.match(source, /href: "\/dashboard\/showcase\/kiosks",[\s\S]*label: "Kiosk"/);
  assert.match(sidebar, /item\.exact/);
  assert.match(mobile, /item\.exact/);
});

test("account-aware dashboard navigation does not duplicate route entries", () => {
  const contexts = [
    ["Free", access({ tier: "free" })],
    ["Collector", access({ tier: "collector" })],
    ["Seller", access({ tier: "seller" })],
    ["Store", access({ tier: "store", workspaceRole: "owner" })],
    ["Owner", access({
      tier: "free",
      platformRole: "owner",
      platformRoleAuthority: "trusted",
      workspaceRole: null,
    })],
    ["Admin", access({
      tier: "free",
      platformRole: "admin",
      platformRoleAuthority: "trusted",
      workspaceRole: null,
    })],
  ] as const;

  for (const [label, context] of contexts) {
    const hrefs = navigationHrefsFor(context);
    assert.deepEqual(
      hrefs,
      Array.from(new Set(hrefs)),
      `${label} navigation should not repeat routes across sections`,
    );
  }
});

test("server workspace access resolves only valid active or unambiguous memberships", () => {
  assert.deepEqual(
    resolveWorkspaceAccessFromRows(null, [{ workspace_id: "workspace-a", role: "owner" }]),
    { workspaceId: "workspace-a", workspaceRole: "owner" },
  );

  assert.deepEqual(
    resolveWorkspaceAccessFromRows("workspace-b", [
      { workspace_id: "workspace-a", role: "member" },
      { workspace_id: "workspace-b", role: "manager" },
    ]),
    { workspaceId: "workspace-b", workspaceRole: "manager" },
  );

  assert.deepEqual(
    resolveWorkspaceAccessFromRows(null, [
      { workspace_id: "workspace-a", role: "owner" },
      { workspace_id: "workspace-b", role: "member" },
    ]),
    { workspaceId: null, workspaceRole: null },
  );

  assert.deepEqual(
    resolveWorkspaceAccessFromRows("workspace-z", [
      { workspace_id: "workspace-a", role: "owner" },
      { workspace_id: "workspace-b", role: "member" },
    ]),
    { workspaceId: null, workspaceRole: null },
  );
});

test("all dashboard page routes are explicitly classified", () => {
  const dashboardPages = listFiles([path.join(repoRoot, "src/app/dashboard")])
    .filter((file) => file.endsWith("page.tsx"))
    .map(dashboardPathFromPage)
    .sort();

  assert.ok(dashboardPages.length > 20, "expected active dashboard routes");
  for (const route of dashboardPages) {
    const rule = routeAccessRuleForPath(route);
    assert.ok(rule, `${route} is missing a route access rule`);
    assert.notEqual(rule.id, "dashboard-fallback", `${route} is using the fail-closed fallback`);
    assert.notEqual(rule.kind, "blocked", `${route} is blocked instead of explicitly classified`);
  }
});

test("all API route handlers are classified in the API access registry", () => {
  const apiRoutes = listFiles([path.join(repoRoot, "src/app/api")])
    .filter((file) => file.endsWith("route.ts"))
    .map(apiPathFromRoute)
    .sort();

  assert.ok(apiRoutes.length > 40, "expected active API routes");
  for (const route of apiRoutes) {
    const rule = apiAccessRuleForPath(route);
    assert.ok(rule, `${route} is missing an API access rule`);
    assert.notEqual(rule.id, "api-fallback", `${route} is using the server-only fallback`);
  }
});

test("active marketplace server routes use the canonical marketplaces capability guard", () => {
  const guardedApiRoutes = [
    "src/app/api/marketplaces/catalog/enrich/route.ts",
    "src/app/api/marketplaces/ebay/import/route.ts",
    "src/app/api/marketplaces/ebay/reconciliation/route.ts",
    "src/app/api/marketplaces/manapool/import/route.ts",
  ];

  for (const route of guardedApiRoutes) {
    const source = readFileSync(path.join(repoRoot, route), "utf8");
    assert.match(source, /requireApiCapability\("marketplaces\.manage"\)/, route);
  }

  const redirectRoutes = [
    "src/app/api/marketplaces/ebay/authorize/route.ts",
    "src/app/api/marketplaces/[marketplace]/callback/route.ts",
  ];

  for (const route of redirectRoutes) {
    const source = readFileSync(path.join(repoRoot, route), "utf8");
    assert.match(source, /hasCapability\(access, "marketplaces\.manage"\)/, route);
    assert.match(source, /marketplace_access/, route);
  }
});

test("workspace role boundaries are distinct from store membership", () => {
  const storeViewer = access({ tier: "store", workspaceRole: "viewer" });
  const storeMember = access({ tier: "store", workspaceRole: "member" });
  const storeManager = access({ tier: "store", workspaceRole: "manager" });
  const storeAdmin = access({ tier: "store", workspaceRole: "admin" });
  const storeOwner = access({ tier: "store", workspaceRole: "owner" });

  assert.equal(hasRouteAccess(storeViewer, "/dashboard/employees"), false);
  assert.equal(hasRouteAccess(storeMember, "/dashboard/supplies"), true);
  assert.equal(hasRouteAccess(storeManager, "/dashboard/vendors"), true);
  assert.equal(hasRouteAccess(storeAdmin, "/dashboard/payroll"), true);
  assert.equal(hasCapability(storeOwner, "billing.manage"), true);
  assert.equal(hasCapability(storeManager, "billing.manage"), false);
});

test("legacy guardrails do not introduce new active business branching or email owner checks", () => {
  const mobileAuthorityFiles = [
    path.join(repoRoot, "mobile/services/access-model.ts"),
    path.join(repoRoot, "mobile/services/platform-access.ts"),
    path.join(repoRoot, "mobile/services/membership-catalog.ts"),
    path.join(repoRoot, "mobile/services/revenuecat.ts"),
  ];
  const authorityFiles = listFiles([
    path.join(repoRoot, "src/lib/platform"),
    path.join(repoRoot, "src/lib/identity"),
    path.join(repoRoot, "src/app/dashboard/admin"),
    path.join(repoRoot, "src/app/api/admin"),
  ]).filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
  const activeFiles = [...authorityFiles, ...mobileAuthorityFiles];

  const capabilityDefinitions = activeFiles.filter((file) =>
    /export\s+const\s+CAPABILITY_REGISTRY/.test(readFileSync(file, "utf8")),
  );
  assert.deepEqual(capabilityDefinitions.map((file) => path.relative(repoRoot, file).replace(/\\/g, "/")), [
    "mobile/services/platform-access.ts",
  ]);

  for (const file of activeFiles) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const source = readFileSync(file, "utf8");
    if (relative === "mobile/services/membership-catalog.ts") continue;
    assert.equal(
      /(accountType|membershipTier|billingPlan|plan)\s*(?:={2,3}|!==?)\s*['"]business['"]/.test(source),
      false,
      `${relative} contains active business tier branching`,
    );
  }

  for (const file of authorityFiles) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const source = readFileSync(file, "utf8");
    assert.equal(/tradingdocks@gmail\.com/.test(source), false, `${relative} contains email-based admin authority`);
  }

  const apiFiles = listFiles([path.join(repoRoot, "src/app/api")]).filter((file) => file.endsWith(".ts"));
  for (const file of apiFiles) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const source = readFileSync(file, "utf8");
    assert.equal(/hasPlanAccess|getEffectivePlan/.test(source), false, `${relative} contains legacy plan access checks`);
  }
});

function dashboardPathFromPage(file: string) {
  const relative = path.relative(path.join(repoRoot, "src/app/dashboard"), file).replace(/\\/g, "/");
  const route = relative.replace(/\/page\.tsx$/, "").replace(/^page\.tsx$/, "");
  return route ? `/dashboard/${route}` : "/dashboard";
}

function apiPathFromRoute(file: string) {
  const relative = path.relative(path.join(repoRoot, "src/app/api"), file).replace(/\\/g, "/");
  const route = relative.replace(/\/route\.ts$/, "").replace(/^route\.ts$/, "");
  return route ? `/api/${route}` : "/api";
}

function listFiles(roots: string[]) {
  const files: string[] = [];
  for (const root of roots) walk(root, files);
  return files;
}

function walk(current: string, files: string[]) {
  const stat = statSync(current);
  if (stat.isFile()) {
    files.push(current);
    return;
  }
  for (const entry of readdirSync(current)) {
    const child = path.join(current, entry);
    const childStat = statSync(child);
    if (childStat.isDirectory()) walk(child, files);
    else files.push(child);
  }
}

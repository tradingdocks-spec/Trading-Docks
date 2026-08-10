import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveAccess,
  type AccessResolutionInput,
} from "../mobile/services/access-model.ts";

function access(input: AccessResolutionInput = {}) {
  return resolveAccess({
    userId: "user-1",
    accountType: "collector",
    billingPlan: "free",
    billingStatus: "free",
    ...input,
  });
}

test("owner role resolves admin authority without upgrading membership", () => {
  const resolved = access({ platformRole: "owner", platformRoleAuthority: "trusted" });

  assert.equal(resolved.platformRole, "owner");
  assert.equal(resolved.platformRoleAuthority, "trusted");
  assert.equal(resolved.isAdmin, true);
  assert.equal(resolved.membershipTier, "free");
  assert.equal(resolved.canAccessCommandCenter, true);
  assert.equal(resolved.hasFullPlatformAccess, true);
  assert.equal(resolved.entitlementKeys.includes("deal-desk"), true);
  assert.equal(resolved.entitlementKeys.includes("employee-accounts"), true);
});

test("admin role resolves command-center access", () => {
  const resolved = access({ platformRole: "admin", membershipOverride: "free" });

  assert.equal(resolved.platformRole, "admin");
  assert.equal(resolved.canAccessCommandCenter, true);
  assert.equal(resolved.membershipTier, "free");
  assert.equal(resolved.hasFullPlatformAccess, true);
});

test("support role resolves limited platform authority", () => {
  const resolved = access({ platformRole: "support" });

  assert.equal(resolved.platformRole, "support");
  assert.equal(resolved.isAdmin, true);
  assert.equal(resolved.entitlementKeys.includes("admin.command-center"), true);
});

test("analyst role resolves read-oriented platform authority", () => {
  const resolved = access({ platformRole: "analyst" });

  assert.equal(resolved.platformRole, "analyst");
  assert.equal(resolved.canAccessCommandCenter, true);
});

test("normal user has no admin route access", () => {
  const resolved = access({ platformRole: "user" });

  assert.equal(resolved.platformRole, "user");
  assert.equal(resolved.isAdmin, false);
  assert.equal(resolved.canAccessCommandCenter, false);
});

test("missing role falls back to normal user", () => {
  const resolved = access({ platformRole: null });

  assert.equal(resolved.platformRole, "user");
  assert.equal(resolved.warnings.includes("missing_role"), true);
});

test("suspended account loses entitlement and admin route access", () => {
  const resolved = access({ platformRole: "owner", platformRoleAuthority: "trusted", suspended: true });

  assert.equal(resolved.isSuspended, true);
  assert.equal(resolved.entitlementKeys.length, 0);
  assert.equal(resolved.canAccessCommandCenter, false);
  assert.equal(resolved.hasFullPlatformAccess, false);
});

test("trusted admin with Free membership receives full platform access without changing membership", () => {
  const resolved = access({ platformRole: "admin", membershipOverride: "free" });

  assert.equal(resolved.membershipTier, "free");
  assert.equal(resolved.entitlementKeys.includes("purchasing"), true);
  assert.equal(resolved.entitlementKeys.includes("employee-accounts"), true);
  assert.equal(resolved.entitlementKeys.includes("admin.command-center"), true);
});

test("seller without admin role receives seller entitlements only", () => {
  const resolved = access({
    platformRole: "user",
    accountType: "seller",
    billingPlan: "seller",
    billingStatus: "active",
  });

  assert.equal(resolved.isAdmin, false);
  assert.equal(resolved.membershipTier, "seller");
  assert.equal(resolved.entitlementKeys.includes("purchasing"), true);
  assert.equal(resolved.entitlementKeys.includes("admin.command-center"), false);
});

test("unauthorized web admin route is denied", () => {
  assert.equal(access({ platformRole: "user" }).canAccessCommandCenter, false);
});

test("authorized web admin route is allowed for user_roles admin", () => {
  const resolved = access({ platformRole: "admin" });

  assert.equal(resolved.platformRole, "admin");
  assert.equal(resolved.canAccessCommandCenter, true);
});

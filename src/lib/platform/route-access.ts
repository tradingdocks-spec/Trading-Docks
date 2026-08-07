import {
  hasCapability,
  type ClientSafePlatformAccess,
  type PlatformAccessContext,
  type PlatformCapability,
  type PlatformRole,
} from "../platform-access";

export type RouteAccessRule =
  | { kind: "public" }
  | { kind: "authenticated"; redirectTo?: string }
  | {
      kind: "capability";
      capability: PlatformCapability;
      minimumRole?: Exclude<PlatformRole, "user">;
      redirectTo?: string;
    };

type RouteRuleEntry = {
  path: string;
  rule: RouteAccessRule;
};

const ROUTE_RULES: RouteRuleEntry[] = [
  { path: "/dashboard/admin", rule: { kind: "capability", capability: "platform.admin" } },
  { path: "/api/admin", rule: { kind: "capability", capability: "platform.admin" } },
];

export function routeAccessRuleForPath(pathname: string): RouteAccessRule | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const match = ROUTE_RULES
    .filter((entry) => normalized === entry.path || normalized.startsWith(`${entry.path}/`))
    .sort((left, right) => right.path.length - left.path.length)[0];

  return match ? match.rule : null;
}

export function hasRouteAccess(
  access: PlatformAccessContext | ClientSafePlatformAccess,
  pathname: string,
) {
  const rule = routeAccessRuleForPath(pathname);
  if (!rule || rule.kind === "public") return true;
  if (!access.authenticated) return false;
  if (rule.kind === "authenticated") return true;

  if (rule.minimumRole) {
    return access.platformRole !== "user" &&
      PlatformRoleRank[access.platformRole] >= PlatformRoleRank[rule.minimumRole];
  }

  return hasCapability(access, rule.capability);
}

const PlatformRoleRank: Record<PlatformRole, number> = {
  user: 0,
  analyst: 1,
  support: 2,
  admin: 3,
  owner: 4,
};

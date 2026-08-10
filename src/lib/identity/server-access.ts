import {
  hasPlatformRole,
  resolveAccess,
  type PlatformRole,
  type ResolvedAccess,
} from "./access-model";
import { resolvePlatformAccessForUser } from "@/lib/platform/server-access";

type AuthUser = {
  id: string;
  banned_until?: string | null;
};

export async function resolveServerAccess(
  supabase: unknown,
  user: AuthUser | null,
): Promise<ResolvedAccess> {
  const access = await resolvePlatformAccessForUser(supabase, user);
  return resolveAccess({
    userId: access.userId,
    platformRole: access.platformRole,
    accountType: access.accountType,
    effectiveMembershipTier: access.membershipTier,
    billingStatus: access.billingStatus,
    suspended: access.suspended,
  });
}

export function canAccessAdminRoute(access: ResolvedAccess) {
  return access.canAccessCommandCenter;
}

export function canPerformPlatformAction(
  access: ResolvedAccess,
  minimumRole: Exclude<PlatformRole, "user">,
) {
  return !access.isSuspended && hasPlatformRole(access.platformRole, minimumRole);
}

import { createClient } from "@/lib/supabase/server";
import {
  canPerformPlatformAction,
  resolveServerAccess,
} from "@/lib/identity/server-access";
import type { PlatformRole } from "@/lib/identity/access-model";

export async function requireServerPlatformRole(
  minimumRole: Exclude<PlatformRole, "user">,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const access = await resolveServerAccess(supabase, user);
  if (!canPerformPlatformAction(access, minimumRole)) return null;
  return { user, supabase, access };
}

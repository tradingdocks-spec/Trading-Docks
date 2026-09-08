import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  persistentAuthCookieOptions,
  REMEMBER_ME_COOKIE,
} from "@/lib/supabase/auth-cookie-policy";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

function withSignInEntrance(path: string) {
  const url = new URL(path, "https://tradingdocks.local");
  url.searchParams.set("td_enter", "1");
  return `${url.pathname}${url.search}${url.hash}`;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));

  if (code) {
    // OAuth and recovery callbacks should remain persistent after the exchange.
    const cookieStore = await cookies();
    cookieStore.set(REMEMBER_ME_COOKIE, "true", {
      ...persistentAuthCookieOptions({}, true),
      httpOnly: true,
    });
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      const employeeWorkspaceId = typeof user?.user_metadata?.employee_workspace_id === "string"
        ? user.user_metadata.employee_workspace_id
        : "";
      if (user && employeeWorkspaceId) {
        try {
          const admin = createAdminClient();
          await admin.from("workspace_employees").update({ account_status: "active" }).eq("workspace_id", employeeWorkspaceId).eq("linked_user_id", user.id);
          await admin.from("workspace_members").upsert({ workspace_id: employeeWorkspaceId, user_id: user.id, role: "employee" }, { onConflict: "workspace_id,user_id" });
          await admin.from("user_preferences").upsert({ user_id: user.id, active_workspace_id: employeeWorkspaceId }, { onConflict: "user_id" });
        } catch {
          // Invitation activation should not block an otherwise valid auth callback.
        }
      }
      return NextResponse.redirect(
        new URL(withSignInEntrance(next), requestUrl.origin),
      );
    }
  }

  const isPasswordRecovery = next === "/update-password";
  const errorUrl = new URL(
    isPasswordRecovery ? "/forgot-password" : "/sign-in",
    requestUrl.origin,
  );
  errorUrl.searchParams.set(
    "error",
    isPasswordRecovery
      ? "This password reset link is invalid or has expired. Request a new link below."
      : "This sign-in link is invalid or has expired. Please try again.",
  );
  return NextResponse.redirect(errorUrl);
}

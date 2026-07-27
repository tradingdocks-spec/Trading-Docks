import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));

  if (code) {
    // OAuth and recovery callbacks should remain persistent after the exchange.
    const supabase = await createClient({ rememberMe: true });
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
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

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { decryptMarketplaceCredentials } from "@/lib/marketplaces/credentials";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ marketplace: string }> },
) {
  const { marketplace } = await context.params;
  const destination = new URL("/dashboard/marketplaces", request.url);
  destination.searchParams.set("connector", marketplace);
  if (marketplace !== "ebay") {
    destination.searchParams.set("error", "unsupported");
    return NextResponse.redirect(destination);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const callback = new URL(request.url);
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("td_ebay_oauth_state")?.value;
  cookieStore.delete("td_ebay_oauth_state");
  if (!user || !expectedState || callback.searchParams.get("state") !== expectedState) {
    destination.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(destination);
  }
  const code = callback.searchParams.get("code");
  if (!code) {
    destination.searchParams.set("error", callback.searchParams.get("error") ?? "authorization");
    return NextResponse.redirect(destination);
  }

  try {
    const admin = createAdminClient();
    let { data, error } = await admin
      .from("platform_marketplace_integrations")
      .select("encrypted_payload,iv,auth_tag")
      .eq("marketplace_id", "ebay")
      .eq("enabled", true)
      .maybeSingle();
    if (!data) {
      const legacy = await admin.from("marketplace_credentials")
        .select("encrypted_payload,iv,auth_tag")
        .eq("user_id", user.id)
        .eq("marketplace_id", "ebay")
        .single();
      data = legacy.data;
      error = legacy.error;
    }
    if (error) throw error;
    if (!data) throw new Error("The eBay platform integration is not configured.");
    const credentials = decryptMarketplaceCredentials(data);
    const sandbox = credentials.environment === "sandbox";
    const response = await fetch(
      sandbox
        ? "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
        : "https://api.ebay.com/identity/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: credentials.ruName,
        }),
      },
    );
    const token = await response.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      refresh_token_expires_in?: number;
      error_description?: string;
    };
    if (!response.ok || !token.refresh_token) {
      throw new Error(token.error_description ?? "eBay did not return a refresh token.");
    }
    const { error: tokenError } = await admin.from("marketplace_oauth_tokens").upsert({
      user_id: user.id,
      marketplace_id: "ebay",
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      access_token_expires_at: new Date(Date.now() + (token.expires_in ?? 7200) * 1000).toISOString(),
      refresh_token_expires_at: token.refresh_token_expires_in
        ? new Date(Date.now() + token.refresh_token_expires_in * 1000).toISOString()
        : null,
      scopes: [],
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,marketplace_id" });
    if (tokenError) throw tokenError;
    await admin.from("marketplace_connections").upsert({
      user_id: user.id,
      marketplace_id: "ebay",
      connection_method: "api",
      status: "ready",
      sync_mode: "read_only",
      health: "healthy",
      settings: {
        credentials_saved: true,
        authorized: true,
        environment: sandbox ? "sandbox" : "production",
        authorized_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,marketplace_id" });
    destination.searchParams.set("authorization", "connected");
  } catch {
    destination.searchParams.set("error", "token_exchange");
  }
  return NextResponse.redirect(destination);
}

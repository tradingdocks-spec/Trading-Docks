import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { decryptMarketplaceCredentials } from "@/lib/marketplaces/credentials";

export const runtime = "nodejs";

const SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
];

export async function GET(request: Request) {
  const destination = new URL("/dashboard/marketplaces", request.url);
  destination.searchParams.set("connector", "ebay");

  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      destination.searchParams.set("error", "server_service_key");
      return NextResponse.redirect(destination);
    }
    if (!process.env.MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY) {
      destination.searchParams.set("error", "server_encryption_key");
      return NextResponse.redirect(destination);
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const signIn = new URL("/sign-in", request.url);
      signIn.searchParams.set("next", "/dashboard/marketplaces?connector=ebay");
      return NextResponse.redirect(signIn);
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("marketplace_credentials")
      .select("encrypted_payload,iv,auth_tag")
      .eq("user_id", user.id)
      .eq("marketplace_id", "ebay")
      .maybeSingle();
    if (error || !data) {
      destination.searchParams.set("error", "credentials");
      return NextResponse.redirect(destination);
    }

    let credentials: Record<string, string>;
    try {
      credentials = decryptMarketplaceCredentials(data);
    } catch {
      destination.searchParams.set("error", "credentials_key_changed");
      return NextResponse.redirect(destination);
    }

    if (!credentials.clientId || !credentials.clientSecret || !credentials.ruName) {
      destination.searchParams.set("error", "credentials_incomplete");
      return NextResponse.redirect(destination);
    }

    const environment = credentials.environment === "sandbox" ? "sandbox" : "production";
    const state = randomBytes(32).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set("td_ebay_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/marketplaces/ebay/callback",
      maxAge: 600,
    });

    const authorization = new URL(
      environment === "sandbox"
        ? "https://auth.sandbox.ebay.com/oauth2/authorize"
        : "https://auth.ebay.com/oauth2/authorize",
    );
    authorization.searchParams.set("client_id", credentials.clientId);
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("redirect_uri", credentials.ruName);
    authorization.searchParams.set("scope", SCOPES.join(" "));
    authorization.searchParams.set("state", state);
    return NextResponse.redirect(authorization);
  } catch (error) {
    console.error("Could not start eBay authorization", error);
    destination.searchParams.set("error", "authorization_setup");
    return NextResponse.redirect(destination);
  }
}

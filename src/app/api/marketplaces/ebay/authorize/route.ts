import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptMarketplaceCredentials } from "@/lib/marketplaces/credentials";
import { currentEbayDeploymentEnvironment, ebayAuthEndpoint, resolveEbayEnvironment } from "@/lib/marketplaces/ebay-environment";
import { hasCapability } from "@/lib/platform/client-access";
import { resolveCurrentPlatformAccess } from "@/lib/platform/server-access";

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

    const { user, access } = await resolveCurrentPlatformAccess();
    if (!user) {
      const signIn = new URL("/sign-in", request.url);
      signIn.searchParams.set("next", "/dashboard/marketplaces?connector=ebay");
      return NextResponse.redirect(signIn);
    }
    if (!hasCapability(access, "marketplaces.manage")) {
      destination.searchParams.set("error", "marketplace_access");
      return NextResponse.redirect(destination);
    }

    const admin = createAdminClient();
    let { data, error } = await admin
      .from("platform_marketplace_integrations")
      .select("encrypted_payload,iv,auth_tag")
      .eq("marketplace_id", "ebay")
      .eq("enabled", true)
      .maybeSingle();
    // Temporary migration fallback for the platform owner's previously saved v112 credentials.
    if (!data) {
      const legacy = await admin.from("marketplace_credentials")
        .select("encrypted_payload,iv,auth_tag")
        .eq("user_id", user.id)
        .eq("marketplace_id", "ebay")
        .maybeSingle();
      data = legacy.data;
      error = legacy.error;
    }
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

    const environment = resolveEbayEnvironment(credentials, currentEbayDeploymentEnvironment());
    const state = randomBytes(32).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set("td_ebay_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/marketplaces/ebay/callback",
      maxAge: 600,
    });

    const authorization = new URL(ebayAuthEndpoint(environment));
    authorization.searchParams.set("client_id", credentials.clientId);
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("redirect_uri", credentials.ruName);
    authorization.searchParams.set("scope", SCOPES.join(" "));
    authorization.searchParams.set("state", state);
    return NextResponse.redirect(authorization);
  } catch (error) {
    const blocked = error instanceof Error && error.message.startsWith("eBay configuration blocked:");
    console.error("Could not start eBay authorization");
    destination.searchParams.set("error", blocked ? "configuration_blocked" : "authorization_setup");
    return NextResponse.redirect(destination);
  }
}

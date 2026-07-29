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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in", request.url));

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("marketplace_credentials")
    .select("encrypted_payload,iv,auth_tag")
    .eq("user_id", user.id)
    .eq("marketplace_id", "ebay")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.redirect(new URL("/dashboard/marketplaces?connector=ebay&error=credentials", request.url));
  }

  const credentials = decryptMarketplaceCredentials(data);
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
}

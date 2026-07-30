import { createAdminClient } from "@/lib/supabase/admin";
import { decryptMarketplaceCredentials } from "@/lib/marketplaces/credentials";

type EbayCredentials = {
  clientId: string;
  clientSecret: string;
  ruName: string;
  environment: string;
};

export async function getEbayAccess(userId: string) {
  const admin = createAdminClient();
  const [{ data: integration, error: integrationError }, { data: tokenRow, error: tokenError }] =
    await Promise.all([
      admin.from("platform_marketplace_integrations")
        .select("encrypted_payload,iv,auth_tag")
        .eq("marketplace_id", "ebay")
        .eq("enabled", true)
        .single(),
      admin.from("marketplace_oauth_tokens")
        .select("access_token,refresh_token,access_token_expires_at")
        .eq("user_id", userId)
        .eq("marketplace_id", "ebay")
        .single(),
    ]);

  if (integrationError || !integration) throw new Error("The eBay platform integration is not enabled.");
  if (tokenError || !tokenRow?.refresh_token) throw new Error("Connect your eBay seller account before importing.");

  const credentials = decryptMarketplaceCredentials(integration) as EbayCredentials;
  const sandbox = credentials.environment === "sandbox";
  const apiBase = sandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
  const expiresAt = tokenRow.access_token_expires_at
    ? new Date(tokenRow.access_token_expires_at).getTime()
    : 0;

  if (tokenRow.access_token && expiresAt > Date.now() + 120_000) {
    return { admin, accessToken: tokenRow.access_token, apiBase };
  }

  const response = await fetch(`${apiBase}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenRow.refresh_token,
      scope: [
        "https://api.ebay.com/oauth/api_scope",
        "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
        "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
      ].join(" "),
    }),
    cache: "no-store",
  });
  const refreshed = await response.json() as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !refreshed.access_token) {
    throw new Error(refreshed.error_description ?? "eBay authorization expired. Reconnect the seller account.");
  }

  await admin.from("marketplace_oauth_tokens").update({
    access_token: refreshed.access_token,
    access_token_expires_at: new Date(Date.now() + (refreshed.expires_in ?? 7200) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId).eq("marketplace_id", "ebay");

  return { admin, accessToken: refreshed.access_token, apiBase };
}

export async function ebayJson<T>(
  apiBase: string,
  accessToken: string,
  path: string,
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as {
    errors?: Array<{
      errorId?: number;
      domain?: string;
      category?: string;
      message?: string;
      longMessage?: string;
    }>;
  };
  if (!response.ok) {
    const error = body.errors?.[0];
    const detail = error?.longMessage ?? error?.message;
    const requestName = path.split("?")[0];
    throw new Error(
      detail
        ? `eBay ${requestName} request failed: ${detail}${error?.errorId ? ` (error ${error.errorId})` : ""}`
        : `eBay ${requestName} request failed (${response.status}).`,
    );
  }
  return body as T;
}

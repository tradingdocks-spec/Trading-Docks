import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  encryptMarketplaceCredentials,
  decryptMarketplaceCredentials,
  type EncryptedMarketplaceCredential,
} from "../../../marketplaces/credentials.ts";
import {
  SQUARE_BASE_URL,
  SQUARE_RETURN_PATH,
  SQUARE_SCOPES,
  type SquareConfig,
} from "./config.ts";
import { SquareHttp, object, type SquareObject } from "./http.ts";
export type SquareStore = (
  action: string,
  body: SquareObject,
) => Promise<SquareObject>;
export type CredentialContext = {
  connection: { id: string; workspace_id: string; merchant_id: string };
  credential: { encrypted: EncryptedMarketplaceCredential; expires_at: string };
};
export function stateHash(state: string) {
  return createHash("sha256").update(state).digest("hex");
}
export function locations(result: SquareObject) {
  if (!Array.isArray(result.locations)) throw Error("CONFIGURATION_ERROR");
  return result.locations.map(object).map((l) => {
    if (typeof l.id !== "string" || typeof l.name !== "string")
      throw Error("CONFIGURATION_ERROR");
    const address = object(l.address);
    return {
      id: l.id,
      name: l.name.slice(0, 200),
      status:
        l.status !== "ACTIVE"
          ? "INACTIVE"
          : l.currency === "USD"
            ? "ACTIVE"
            : "UNSUPPORTED_CURRENCY",
      address: [
        address.locality,
        address.administrative_district_level_1,
        address.country,
      ]
        .filter((x) => typeof x === "string")
        .join(", ")
        .slice(0, 200),
    };
  });
}
export class SquareAccounts {
  store: SquareStore;
  config: SquareConfig;
  http: SquareHttp;
  constructor(
    store: SquareStore,
    config: SquareConfig,
    http = new SquareHttp(),
  ) {
    this.store = store;
    this.config = config;
    this.http = http;
  }
  async start(workspaceId: string, actorId: string, terminal = false) {
    const state = randomBytes(32).toString("base64url");
    await this.store("oauth_start", {
      workspaceId,
      actorId,
      hash: stateHash(state),
    });
    const url = new URL("/oauth2/authorize", SQUARE_BASE_URL);
    url.search = new URLSearchParams({
      client_id: this.config.applicationId,
      scope: [...SQUARE_SCOPES, ...(terminal ? ["DEVICE_CREDENTIAL_MANAGEMENT"] : [])].join(" "),
      state,
      redirect_uri: this.config.redirectUrl,
      session: "false",
    }).toString();
    return url.toString();
  }
  async callback(workspaceId: string, actorId: string, query: URLSearchParams) {
    const state = query.get("state");
    if (!state || !/^[A-Za-z0-9_-]{43}$/.test(state))
      throw Error("OAUTH_STATE_INVALID");
    await this.store("oauth_consume", {
      workspaceId,
      actorId,
      hash: stateHash(state),
    });
    if (query.has("error")) return SQUARE_RETURN_PATH + "?square=denied";
    const code = query.get("code");
    if (!code || code.length > 2048) throw Error("OAUTH_STATE_INVALID");
    const tokens = await this.http.request("/oauth2/token", undefined, {
      client_id: this.config.applicationId,
      client_secret: this.config.applicationSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: this.config.redirectUrl,
    });
    this.validateTokens(tokens);
    const merchant = object(
      (
        await this.http.request(
          "/v2/merchants/" + encodeURIComponent(String(tokens.merchant_id)),
          String(tokens.access_token),
        )
      ).merchant,
    );
    if (
      merchant.id !== tokens.merchant_id ||
      merchant.status !== "ACTIVE" ||
      typeof merchant.business_name !== "string"
    )
      throw Error("CONFIGURATION_ERROR");
    const cached = locations(
      await this.http.request("/v2/locations", String(tokens.access_token)),
    );
    const authorization = await this.http.request("/oauth2/token/status", String(tokens.access_token), {});
    await this.store("connect", {
      scopes: Array.isArray(authorization.scopes) ? authorization.scopes : [],
      workspaceId,
      actorId,
      merchantId: merchant.id,
      displayName: merchant.business_name,
      country: merchant.country,
      accountStatus: merchant.status,
      locations: cached,
      encrypted: encryptMarketplaceCredentials({
        access_token: String(tokens.access_token),
        refresh_token: String(tokens.refresh_token),
      }),
      expiresAt: tokens.expires_at,
    });
    return SQUARE_RETURN_PATH + "?square=connected";
  }
  validateTokens(tokens: SquareObject) {
    if (
      typeof tokens.access_token !== "string" ||
      typeof tokens.refresh_token !== "string" ||
      typeof tokens.merchant_id !== "string" ||
      typeof tokens.expires_at !== "string" ||
      !Number.isFinite(Date.parse(tokens.expires_at)) ||
      Date.parse(tokens.expires_at) <= Date.now()
    )
      throw Error("UNAUTHORIZED_PROVIDER_ACCOUNT");
  }
  async token(context: CredentialContext): Promise<string> {
    const { connection, credential } = context;
    let decrypted = decryptMarketplaceCredentials(credential.encrypted);
    if (Date.parse(credential.expires_at) > Date.now() + 23 * 86400000)
      return decrypted.access_token;
    const body = {
      workspaceId: connection.workspace_id,
      connectionId: connection.id,
    };
    const lease = randomUUID();
    const claimed = await this.store("refresh_claim", { ...body, lease });
    if (!claimed.connection_id) {
      // Another process owns the refresh. A still-valid token is safe to use; no busy loop.
      if (Date.parse(credential.expires_at) > Date.now() + 60000)
        return decrypted.access_token;
      throw Error("TEMPORARY_ERROR");
    }
    decrypted = decryptMarketplaceCredentials(
      claimed.encrypted as EncryptedMarketplaceCredential,
    );
    try {
      const tokens = await this.http.request("/oauth2/token", undefined, {
        client_id: this.config.applicationId,
        client_secret: this.config.applicationSecret,
        grant_type: "refresh_token",
        redirect_uri: this.config.redirectUrl,
        refresh_token: decrypted.refresh_token,
      });
      this.validateTokens(tokens);
      if (tokens.merchant_id !== connection.merchant_id)
        throw Error("UNAUTHORIZED_PROVIDER_ACCOUNT");
      await this.store("refresh_save", {
        ...body,
        lease,
        encrypted: encryptMarketplaceCredentials({
          access_token: String(tokens.access_token),
          refresh_token: String(tokens.refresh_token),
        }),
        expiresAt: tokens.expires_at,
      });
      return String(tokens.access_token);
    } catch (e) {
      if (e instanceof Error && e.message === "UNAUTHORIZED_PROVIDER_ACCOUNT")
        await this.store("attention", body);
      throw e;
    }
  }
  async manage(
    action: "check" | "disconnect",
    workspaceId: string,
    actorId: string,
    connectionId: string,
  ) {
    const body = { workspaceId, actorId, connectionId };
    const context = (await this.store(
      "manage_credentials",
      body,
    )) as unknown as CredentialContext;
    try {
      const token = await this.token(context);
      if (action === "disconnect") {
        await this.http.request(
          "/oauth2/revoke",
          this.config.applicationSecret,
          {
            client_id: this.config.applicationId,
            access_token: token,
            revoke_only_access_token: false,
          },
          "Client",
        );
        await this.store("disconnect", body);
      } else {
        const authorization = await this.http.request("/oauth2/token/status", token, {});
        const cached = locations(
          await this.http.request("/v2/locations", token),
        );
        await this.store("health", { ...body, locations: cached, scopes: Array.isArray(authorization.scopes) ? authorization.scopes : [] });
      }
    } catch (e) {
      if (e instanceof Error && e.message === "UNAUTHORIZED_PROVIDER_ACCOUNT") {
        await this.store(
          action === "disconnect" ? "disconnect" : "attention",
          body,
        );
        if (action === "disconnect") return;
      }
      throw e;
    }
  }
}

import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  squareConfig,
  SQUARE_API_VERSION,
  SQUARE_BASE_URL,
  type SquareConfig,
} from "../src/lib/pos/payments/square/config.ts";
import {
  SquareHttp,
  paymentStatus,
  refundStatus,
  safeSquareMetadata,
} from "../src/lib/pos/payments/square/http.ts";
import {
  SquareAccounts,
  locations,
  stateHash,
  type SquareStore,
} from "../src/lib/pos/payments/square/service.ts";
import { squareWebhook } from "../src/lib/pos/payments/square/webhook.ts";
import {
  encryptMarketplaceCredentials,
  decryptMarketplaceCredentials,
} from "../src/lib/marketplaces/credentials.ts";
const config: SquareConfig = {
  environment: "SANDBOX",
  applicationId: "sandbox-test",
  applicationSecret: "test-secret",
  redirectUrl: "https://test.example/callback",
  webhookKey: "test-signature-key",
  notificationUrl: "https://test.example/hook",
};
const expires = new Date(Date.now() + 30 * 86400000).toISOString();
const tokens = {
  access_token: "secret-access",
  refresh_token: "secret-refresh",
  merchant_id: "merchant",
  expires_at: expires,
};
process.env.MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY =
  "phase5-test-only-encryption-key-32-bytes";
test("Square refuses missing, production and mixed environment configuration", () => {
  const env = {
    SQUARE_ENVIRONMENT: "SANDBOX",
    SQUARE_APPLICATION_ID: config.applicationId,
    SQUARE_APPLICATION_SECRET: config.applicationSecret,
    SQUARE_OAUTH_REDIRECT_URL: config.redirectUrl,
    SQUARE_WEBHOOK_SIGNATURE_KEY: config.webhookKey,
    SQUARE_WEBHOOK_NOTIFICATION_URL: config.notificationUrl,
    MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY:
      process.env.MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY,
  };
  assert.equal(squareConfig(env).environment, "SANDBOX");
  for (const changed of [
    { SQUARE_ENVIRONMENT: "PRODUCTION" },
    { SQUARE_APPLICATION_ID: "production-id" },
    { SQUARE_OAUTH_REDIRECT_URL: "https://evil.example/?return=elsewhere" },
    { SQUARE_WEBHOOK_NOTIFICATION_URL: "http://test.example" },
  ])
    assert.throws(() => squareConfig({ ...env, ...changed }), /CONFIGURATION/);
  assert.throws(() => squareConfig({}), /CONFIGURATION/);
});
test("Square normalization is conservative and strips sensitive metadata", () => {
  assert.equal(paymentStatus("COMPLETED"), "SUCCEEDED");
  assert.equal(
    locations({
      locations: [
        {
          id: "L",
          name: "Foreign currency",
          status: "ACTIVE",
          currency: "CAD",
        },
      ],
    })[0].status,
    "UNSUPPORTED_CURRENCY",
  );
  assert.equal(
    locations({
      locations: [
        { id: "L", name: "USD store", status: "ACTIVE", currency: "USD" },
      ],
    })[0].status,
    "ACTIVE",
  );
  assert.equal(paymentStatus("new_status"), "UNKNOWN");
  assert.equal(refundStatus("COMPLETED"), "SUCCEEDED");
  assert.equal(refundStatus("new_status"), "UNKNOWN");
  const metadata = safeSquareMetadata({
    location_id: "L",
    card_details: {
      card: {
        card_brand: "VISA",
        last_4: "1234",
        pan: "sensitive",
        cvv: "123",
      },
    },
    access_token: "secret",
  });
  assert.equal(metadata.last4, "1234");
  assert.ok(!JSON.stringify(metadata).includes("sensitive"));
  assert.ok(!JSON.stringify(metadata).includes("secret"));
});
test("Square HTTP pins Sandbox/version and bounds Retry-After backoff", async () => {
  const waits: number[] = [];
  let calls = 0;
  const http = new SquareHttp(
    async (url, init) => {
      assert.equal(String(url), SQUARE_BASE_URL + "/v2/payments");
      assert.equal(
        (init!.headers as Record<string, string>)["Square-Version"],
        SQUARE_API_VERSION,
      );
      calls++;
      return calls < 3
        ? new Response("{}", { status: 429, headers: { "Retry-After": "1" } })
        : Response.json({ payment: { id: "p" } });
    },
    async (ms) => {
      waits.push(ms);
    },
  );
  await http.request("/v2/payments", "token", { idempotency_key: "stable" });
  assert.deepEqual(waits, [1000, 1000]);
  assert.equal(calls, 3);
  const limited = new SquareHttp(
    async () =>
      new Response("{}", { status: 429, headers: { "Retry-After": "120" } }),
    async () => assert.fail("long retry must return"),
  );
  await assert.rejects(
    limited.request("/v2/payments", "token"),
    /TEMPORARY_ERROR/,
  );
});
test("Square HTTP hides raw provider errors and network failures", async () => {
  for (const [status, expected] of [
    [401, "UNAUTHORIZED_PROVIDER_ACCOUNT"],
    [500, "TEMPORARY_ERROR"],
    [400, "CONFIGURATION_ERROR"],
  ] as const) {
    const h = new SquareHttp(
      async () =>
        Response.json(
          { errors: [{ detail: "secret-provider-payload" }] },
          { status },
        ),
      async () => {},
    );
    await assert.rejects(
      h.request("/v2/payments", "token"),
      (e) => e instanceof Error && e.message === expected,
    );
  }
  const h = new SquareHttp(async () => {
    throw Error("secret-network-info");
  });
  await assert.rejects(h.request("/v2/payments", "token"), /NETWORK_ERROR/);
});
test("credentials use randomized authenticated encryption; tampering fails", () => {
  const a = encryptMarketplaceCredentials(tokens),
    b = encryptMarketplaceCredentials(tokens);
  assert.notEqual(a.encrypted_payload, b.encrypted_payload);
  assert.equal(
    decryptMarketplaceCredentials(a).access_token,
    tokens.access_token,
  );
  assert.ok(!JSON.stringify(a).includes(tokens.access_token));
  assert.throws(() =>
    decryptMarketplaceCredentials({
      ...a,
      auth_tag: Buffer.alloc(16).toString("base64"),
    }),
  );
});
test("OAuth state is strong, hashed, actor-bound, consumed before exchange; deny never exchanges", async () => {
  const flows = new Map<string, Record<string, unknown>>();
  let requests = 0;
  const store: SquareStore = async (action, b) => {
    if (action === "oauth_start") {
      flows.set(String(b.hash), b);
      return {};
    }
    const row = flows.get(String(b.hash));
    if (action === "oauth_consume") {
      if (
        !row ||
        row.actorId !== b.actorId ||
        row.workspaceId !== b.workspaceId
      )
        throw Error("OAUTH_STATE_INVALID");
      flows.delete(String(b.hash));
      return {};
    }
    return {};
  };
  const accounts = new SquareAccounts(
    store,
    config,
    new SquareHttp(async () => {
      requests++;
      return Response.json(tokens);
    }),
  );
  const url = new URL(await accounts.start("w", "u"));
  const state = url.searchParams.get("state")!;
  assert.equal(state.length, 43);
  assert.ok(flows.has(stateHash(state)));
  assert.ok(!url.toString().includes(config.applicationSecret));
  await assert.rejects(
    accounts.callback(
      "w",
      "other",
      new URLSearchParams({ state, code: "code" }),
    ),
    /STATE/,
  );
  assert.equal(requests, 0);
  assert.match(
    await accounts.callback(
      "w",
      "u",
      new URLSearchParams({ state, error: "access_denied" }),
    ),
    /denied/,
  );
  assert.equal(requests, 0);
  await assert.rejects(
    accounts.callback("w", "u", new URLSearchParams({ state, code: "code" })),
    /STATE/,
  );
});
test("OAuth only saves complete merchant and location retrieval with encrypted credentials", async () => {
  for (const failure of ["token", "merchant", "locations", null]) {
    const saved: Record<string, unknown>[] = [];
    const accounts = new SquareAccounts(
      async (a, b) => {
        if (a === "connect") saved.push(b);
        return {};
      },
      config,
      new SquareHttp(async (url) => {
        const path = new URL(String(url)).pathname;
        if (path.includes(failure ?? "NEVER"))
          return new Response("{}", { status: 400 });
        return Response.json(
          path === "/oauth2/token"
            ? tokens
            : path.startsWith("/v2/merchants")
              ? {
                  merchant: {
                    id: "merchant",
                    business_name: "Test shop",
                    country: "US",
                    status: "ACTIVE",
                  },
                }
              : { locations: [{ id: "L", name: "Shop", status: "ACTIVE" }] },
        );
      }),
    );
    const query = new URLSearchParams({ state: "a".repeat(43), code: "code" });
    if (failure) await assert.rejects(accounts.callback("w", "u", query));
    else {
      assert.match(await accounts.callback("w", "u", query), /connected/);
      assert.equal(saved.length, 1);
      assert.ok(!JSON.stringify(saved).includes(tokens.access_token));
    }
    if (failure) assert.equal(saved.length, 0);
  }
});
test("official Square signature accepts exact raw bytes and rejects body URL and signature spoofing", async () => {
  const raw = JSON.stringify({
    event_id: "e",
    merchant_id: "m",
    type: "unknown.event",
    data: { id: "p" },
  });
  const signature = createHmac("sha256", config.webhookKey)
    .update(config.notificationUrl + raw)
    .digest("base64");
  let calls = 0;
  const accounts = new SquareAccounts(async () => {
    calls++;
    return { processed: true };
  }, config);
  await squareWebhook(accounts, Buffer.from(raw), signature);
  assert.equal(calls, 1);
  for (const [body, sig] of [
    [raw + " ", signature],
    [raw, "spoof"],
  ])
    await assert.rejects(
      squareWebhook(accounts, Buffer.from(body), sig),
      /SIGNATURE/,
    );
  accounts.config = { ...config, notificationUrl: "https://different.example" };
  await assert.rejects(
    squareWebhook(accounts, Buffer.from(raw), signature),
    /SIGNATURE/,
  );
  assert.equal(calls, 1);
});
test("refresh lease loser never issues another refresh; failed auth marks attention", async () => {
  const context = {
    connection: { id: "c", workspace_id: "w", merchant_id: "merchant" },
    credential: {
      encrypted: encryptMarketplaceCredentials(tokens),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    },
  };
  const loser = new SquareAccounts(
    async () => ({}),
    config,
    new SquareHttp(async () => assert.fail("lease loser must not refresh")),
  );
  assert.equal(await loser.token(context), tokens.access_token);
  const actions: string[] = [];
  const winner = new SquareAccounts(
    async (a) => {
      actions.push(a);
      return a === "refresh_claim"
        ? { connection_id: "c", encrypted: context.credential.encrypted }
        : {};
    },
    config,
    new SquareHttp(async () => new Response("{}", { status: 401 })),
  );
  await assert.rejects(winner.token(context), /UNAUTHORIZED/);
  assert.deepEqual(actions, ["refresh_claim", "attention"]);
});

test("successful token refresh persists only ciphertext under the database lease", async () => {
  const credential = {
    encrypted: encryptMarketplaceCredentials(tokens),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  };
  let saved: Record<string, unknown> | undefined;
  const accounts = new SquareAccounts(
    async (action, body) => {
      if (action === "refresh_claim")
        return { connection_id: "c", encrypted: credential.encrypted };
      if (action === "refresh_save") saved = body;
      return {};
    },
    config,
    new SquareHttp(async (_url, init) => {
      void _url;
      const body = JSON.parse(String(init!.body));
      assert.equal(body.grant_type, "refresh_token");
      assert.equal(body.redirect_uri, config.redirectUrl);
      return Response.json({ ...tokens, access_token: "renewed-secret" });
    }),
  );
  assert.equal(
    await accounts.token({
      connection: { id: "c", workspace_id: "w", merchant_id: "merchant" },
      credential,
    }),
    "renewed-secret",
  );
  assert.ok(saved?.lease);
  assert.ok(!JSON.stringify(saved).includes("renewed-secret"));
});
test("verified webhook processing failure retains retry state; unknown events are harmless", async () => {
  for (const type of ["payment.updated", "unknown.event"]) {
    const actions: string[] = [];
    const accounts = new SquareAccounts(async (action, body) => {
      actions.push(action);
      if (action === "event") return {};
      if (action === "event_done" && type === "payment.updated")
        assert.equal(body.retry, true);
      return {};
    }, config);
    const raw = JSON.stringify({
      event_id: "failure",
      merchant_id: "merchant",
      type,
      data: {
        id: "provider-id",
        object: { payment: { reference_id: "local-reference" } },
      },
    });
    const signature = createHmac("sha256", config.webhookKey)
      .update(config.notificationUrl + raw)
      .digest("base64");
    if (type === "payment.updated")
      await assert.rejects(
        squareWebhook(accounts, Buffer.from(raw), signature),
        /UNKNOWN_STATUS/,
      );
    else await squareWebhook(accounts, Buffer.from(raw), signature);
    assert.deepEqual(actions, ["event", "event_done"]);
  }
});

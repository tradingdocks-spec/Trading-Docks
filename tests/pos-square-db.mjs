import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { squareWebhook } from "../src/lib/pos/payments/square/webhook.ts";
import { SquareAccounts } from "../src/lib/pos/payments/square/service.ts";
import { SquareHttp } from "../src/lib/pos/payments/square/http.ts";
import { SquarePaymentProvider } from "../src/lib/pos/payments/square/provider.ts";
import { PaymentOrchestrator } from "../src/lib/pos/payments/orchestrator.ts";
import { encryptMarketplaceCredentials } from "../src/lib/marketplaces/credentials.ts";
export async function verifySquare({
  admin,
  a,
  b,
  stranger,
  command,
  workspace,
  owner,
  setup,
  check,
}) {
  process.env.MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY =
    "phase5-database-test-only-encryption-key";
  const service = async (action, body) =>
    (
      await admin.query("select public.pos_square_service($1,$2) result", [
        action,
        body,
      ])
    ).rows[0].result;
  const settings = async (client, action = "get", body = {}) =>
    (
      await client.query("select public.pos_square_settings($1,$2,$3) result", [
        workspace,
        action,
        body,
      ])
    ).rows[0].result;
  const store =
    (client) =>
    async (action, body = {}, refund = false) =>
      (
        await client.query(
          `select public.${refund ? "pos_payment_refund_command" : "pos_payment_command"}($1,$2,$3) result`,
          [workspace, action, body],
        )
      ).rows[0].result;
  const pay = store(a);
  const configuration = {
    environment: "SANDBOX",
    applicationId: "sandbox-test",
    applicationSecret: "test",
    redirectUrl: "https://test.example/callback",
    notificationUrl: "https://test.example/hook",
    webhookKey: "test",
  };
  const encrypted = encryptMarketplaceCredentials({
    access_token: "fixture-token",
    refresh_token: "fixture-refresh",
  });
  const body = {
    workspaceId: workspace,
    actorId: owner,
    merchantId: "merchant-a",
    displayName: "Square Test Shop",
    country: "US",
    accountStatus: "ACTIVE",
    encrypted,
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    locations: [
      { id: "square-location", name: "Test location", status: "ACTIVE" },
      { id: "inactive", name: "Closed location", status: "INACTIVE" },
    ],
  };
  let connection;
  await check(
    "Square OAuth state expiry replay and actor/tenant boundaries",
    async () => {
      await service("oauth_start", {
        workspaceId: workspace,
        actorId: owner,
        hash: "state",
      });
      await assert.rejects(
        service("oauth_consume", {
          workspaceId: workspace,
          actorId: owner,
          hash: "wrong",
        }),
        /STATE/,
      );
      await service("oauth_consume", {
        workspaceId: workspace,
        actorId: owner,
        hash: "state",
      });
      await assert.rejects(
        service("oauth_consume", {
          workspaceId: workspace,
          actorId: owner,
          hash: "state",
        }),
        /STATE/,
      );
      await service("oauth_start", {
        workspaceId: workspace,
        actorId: owner,
        hash: "expired",
      });
      await admin.query(
        "update pos_private.square_oauth set expires_at=now()-interval '1 second' where state_hash='expired'",
      );
      await assert.rejects(
        service("oauth_consume", {
          workspaceId: workspace,
          actorId: owner,
          hash: "expired",
        }),
        /STATE/,
      );
      await assert.rejects(
        service("oauth_start", {
          workspaceId: workspace,
          actorId: "22222222-2222-4222-8222-222222222222",
          hash: "other",
        }),
        /FORBIDDEN/,
      );
    },
  );
  await check(
    "Square connection secrets denied; safe settings contain no tokens",
    async () => {
      connection = await service("connect", body);
      await assert.rejects(
        a.query("select * from pos_private.square_credentials"),
        /permission denied/,
      );
      await assert.rejects(
        a.query("select public.pos_square_service('credential',$1)", [
          { workspaceId: workspace, connectionId: connection.id },
        ]),
        /permission denied/,
      );
      await assert.rejects(settings(stranger), /FORBIDDEN/);
      const safe = await settings(a);
      assert.equal(safe.connections[0].display_name, "Square Test Shop");
      assert.ok(!JSON.stringify(safe).includes("encrypted"));
      assert.ok(!JSON.stringify(safe).includes("fixture-token"));
    },
  );
  const reg = await command(a, "configure_register", {
    siteId: setup.siteId,
    name: "Square tests",
  });
  const session = await command(a, "open", {
    registerId: reg.id,
    openingMinor: 0,
  });
  await a.query(
    "insert into inventory_items(id,user_id,workspace_id,location_id,card_name,sku,quantity,asking_price,data) values('square-stock',$1,$2,'case','Square stock','SQUARE-STOCK',100,1,'{}')",
    [owner, workspace],
  );
  const request = () => ({
    key: randomUUID(),
    provider: "SQUARE",
    intent: {
      key: randomUUID(),
      siteId: setup.siteId,
      sessionId: session.id,
      expectedMinor: 217,
      cashMinor: 217,
      lines: [{ ownerId: owner, itemId: "square-stock", quantity: 2 }],
    },
  });
  await check(
    "Square unmapped and inactive locations denied; mapping is tenant scoped",
    async () => {
      await assert.rejects(pay("create", request()), /POS_SQUARE_UNAVAILABLE/);
      await assert.rejects(
        settings(a, "map", {
          connectionId: connection.id,
          siteId: setup.siteId,
          locationId: "inactive",
        }),
        /CONFIGURATION/,
      );
      await assert.rejects(
        settings(stranger, "map", {
          connectionId: connection.id,
          siteId: setup.siteId,
          locationId: "square-location",
        }),
        /FORBIDDEN/,
      );
      await settings(a, "map", {
        connectionId: connection.id,
        siteId: setup.siteId,
        locationId: "square-location",
      });
      await assert.rejects(
        pay("create", { ...request(), locationId: "arbitrary" }),
        /POS_INVALID/,
      );
    },
  );
  const remotePayments = new Map(),
    remoteRefunds = new Map();
  let lose = false;
  let remoteStatus = "COMPLETED";
  let calls = 0;
  const http = new SquareHttp(async (url, init) => {
    const path = new URL(String(url)).pathname;
    const input = init.body ? JSON.parse(init.body) : {};
    calls++;
    if (path === "/v2/payments") {
      if (remoteStatus === "DECLINED")
        return Response.json(
          {
            errors: [
              { category: "PAYMENT_METHOD_ERROR", code: "CARD_DECLINED" },
            ],
          },
          { status: 400 },
        );
      assert.equal(input.location_id, "square-location");
      assert.equal(input.source_id, "cnon:card-nonce-ok");
      if (!remotePayments.has(input.idempotency_key))
        remotePayments.set(input.idempotency_key, {
          id: "square-" + input.idempotency_key,
          reference_id: input.reference_id,
          status: remoteStatus,
          location_id: input.location_id,
          amount_money: input.amount_money,
          card_details: { card: { card_brand: "VISA", last_4: "4242" } },
        });
      if (lose) {
        lose = false;
        throw Error("lost response");
      }
      return Response.json({
        payment: remotePayments.get(input.idempotency_key),
      });
    }
    if (path.startsWith("/v2/payments/"))
      return Response.json({
        payment: [...remotePayments.values()].find((p) => path.endsWith(p.id)),
      });
    if (path === "/v2/refunds") {
      if (!remoteRefunds.has(input.idempotency_key))
        remoteRefunds.set(input.idempotency_key, {
          id: "refund-" + input.idempotency_key,
          payment_id: input.payment_id,
          status: "COMPLETED",
          amount_money: input.amount_money,
        });
      if (lose) {
        lose = false;
        throw Error("lost refund response");
      }
      return Response.json({
        refund: remoteRefunds.get(input.idempotency_key),
      });
    }
    if (path.startsWith("/v2/refunds/"))
      return Response.json({
        refund: [...remoteRefunds.values()].find((p) => path.endsWith(p.id)),
      });
    if (path === "/oauth2/revoke") return Response.json({ success: true });
    assert.fail("Unexpected Square path " + path);
  });
  const accounts = new SquareAccounts(service, configuration, http);
  const engine = (client) =>
    new PaymentOrchestrator(store(client), "test", {
      SQUARE: new SquarePaymentProvider(
        store(client),
        accounts,
        workspace,
        owner,
        "test",
      ),
    });
  const orchestrator = engine(a);
  let paid;
  await check(
    "Square lost response and concurrent reconciliation produce one sale receipt and decrement",
    async () => {
      const req = request();
      lose = true;
      await assert.rejects(orchestrator.begin(req), /NETWORK_ERROR/);
      const attempt = await pay("create", req);
      assert.equal(attempt.status, "PENDING");
      await pay("observe", { id: attempt.id, status: "SUCCEEDED" });
      assert.equal((await pay("get", { id: attempt.id })).status, "PENDING");
      const results = await Promise.all([
        orchestrator.check(attempt.id),
        engine(b).check(attempt.id),
      ]);
      paid = results[0];
      assert.equal(paid.saleId, results[1].saleId);
      assert.equal(paid.saleState, "COMPLETED");
      assert.equal(paid.metadata.environment, "SANDBOX");
      assert.equal(remotePayments.size, 1);
      const count = (
        await admin.query("select count(*)::int n from pos_sales where id=$1", [
          paid.saleId,
        ])
      ).rows[0].n;
      assert.equal(count, 1);
      assert.equal(
        (
          await admin.query(
            "select quantity from inventory_items where id='square-stock' and user_id=$1",
            [owner],
          )
        ).rows[0].quantity,
        98,
      );
      assert.equal(
        (
          await admin.query("select pos_private.expected_cash($1) n", [
            session.id,
          ])
        ).rows[0].n,
        "0",
      );
    },
  );
  await check(
    "Square partial refund lost response recovers once with cumulative cap",
    async () => {
      const line = (
        await admin.query("select id from pos_sale_items where sale_id=$1", [
          paid.saleId,
        ])
      ).rows[0];
      const input = {
        key: randomUUID(),
        paymentId: paid.id,
        intent: {
          key: randomUUID(),
          saleId: paid.saleId,
          sessionId: session.id,
          reason: "Sandbox return",
          expectedMinor: 108,
          lines: [{ saleItemId: line.id, quantity: 1, returnInventory: false }],
        },
      };
      lose = true;
      await assert.rejects(orchestrator.refund(input), /NETWORK_ERROR/);
      const pending = await pay("create", input, true);
      const recovered = await orchestrator.checkRefund(pending.id);
      assert.equal(recovered.status, "SUCCEEDED");
      assert.ok(recovered.refund_id);
      assert.equal(remoteRefunds.size, 1);
      assert.equal(
        (await orchestrator.checkRefund(pending.id)).refund_id,
        recovered.refund_id,
      );
      assert.equal(
        (await pay("get", { id: paid.id })).status,
        "PARTIALLY_REFUNDED",
      );
      await assert.rejects(
        orchestrator.refund({
          ...input,
          key: randomUUID(),
          intent: {
            ...input.intent,
            key: randomUUID(),
            lines: [
              { saleItemId: line.id, quantity: 2, returnInventory: false },
            ],
          },
        }),
        /REFUND|INVALID/,
      );
    },
  );
  await check(
    "Square event deduplication retry and revocation preserve history and stop new charges",
    async () => {
      const event = {
        eventId: "event-1",
        merchantId: "merchant-a",
        type: "payment.updated",
        resourceId: paid.providerReference,
      };
      assert.equal((await service("event", event)).payment.id, paid.id);
      await service("event_done", { eventId: "event-1", retry: true });
      assert.equal((await service("event", event)).processed, false);
      await service("event_done", { eventId: "event-1" });
      assert.equal((await service("event", event)).processed, true);
      await service("event", {
        eventId: "revoked-1",
        merchantId: "merchant-a",
        type: "oauth.authorization.revoked",
      });
      assert.equal((await settings(a)).connections[0].status, "REVOKED");
      assert.equal(
        (
          await admin.query(
            "select count(*)::int n from pos_private.square_credentials",
          )
        ).rows[0].n,
        0,
      );
      const before = calls;
      await assert.rejects(orchestrator.begin(request()), /POS_SQUARE_UNAVAILABLE/);
      assert.equal(calls, before);
      assert.equal((await pay("get", { id: paid.id })).saleId, paid.saleId);
      assert.equal((await pay("capabilities", {})).squareSites.length, 0);
    },
  );
  await check(
    "Square reauthorization retains merchant identity; replacement is explicit",
    async () => {
      assert.equal((await service("connect", body)).id, connection.id);
      await assert.rejects(
        service("connect", { ...body, merchantId: "merchant-b" }),
        /REPLACEMENT/,
      );
      const replacement = await service("connect", {
        ...body,
        merchantId: "merchant-b",
        replaceConfirmed: true,
      });
      assert.notEqual(replacement.id, connection.id);
      assert.equal(
        (
          await admin.query(
            "select provider_account_id from pos_payment_attempts where id=$1",
            [paid.id],
          )
        ).rows[0].provider_account_id,
        connection.id,
      );
      assert.equal(
        (await pay("get", { id: paid.id })).metadata.locationId,
        "square-location",
      );
    },
  );
  await check(
    "Square unknown provider status never finalizes; subsequent status reconciles",
    async () => {
      // Same-merchant reauthorization of original account following replacement is deliberately explicit.
      await service("disconnect", {
        workspaceId: workspace,
        actorId: owner,
        connectionId: (await settings(a)).connections.find(
          (c) => c.status === "CONNECTED",
        ).id,
      });
      const current = await service("connect", body);
      await settings(a, "map", {
        connectionId: current.id,
        siteId: setup.siteId,
        locationId: "square-location",
      });
      remoteStatus = "FUTURE_STATUS";
      const p = await orchestrator.begin(request());
      assert.equal(p.status, "UNKNOWN");
      assert.equal(p.saleId, null);
      remotePayments.get(p.id).status = "COMPLETED";
      assert.equal((await orchestrator.check(p.id)).saleState, "COMPLETED");
    },
  );
  await check(
    "Square signed webhook and cashier poll race converge; replay cannot duplicate sale",
    async () => {
      remoteStatus = "PENDING";
      const p = await orchestrator.begin(request());
      remotePayments.get(p.id).status = "COMPLETED";
      const raw = JSON.stringify({
        event_id: "signed-race",
        merchant_id: "merchant-a",
        type: "payment.updated",
        data: {
          id: p.providerReference,
          object: { payment: { reference_id: p.id } },
        },
      });
      const signature = createHmac("sha256", configuration.webhookKey)
        .update(configuration.notificationUrl + raw)
        .digest("base64");
      await Promise.all([
        squareWebhook(accounts, Buffer.from(raw), signature),
        engine(b).check(p.id),
      ]);
      const completed = await orchestrator.check(p.id);
      assert.equal(completed.saleState, "COMPLETED");
      await squareWebhook(accounts, Buffer.from(raw), signature);
      assert.equal((await orchestrator.check(p.id)).saleId, completed.saleId);
    },
  );
  await check(
    "Square refresh database lease permits one owner and rejects stale saves",
    async () => {
      const current = (await settings(a)).connections.find(
        (c) => c.status === "CONNECTED",
      );
      await admin.query(
        "update pos_private.square_credentials set expires_at=now()+interval '1 day' where connection_id=$1",
        [current.id],
      );
      const first = randomUUID(),
        second = randomUUID();
      assert.ok(
        (
          await service("refresh_claim", {
            workspaceId: workspace,
            connectionId: current.id,
            lease: first,
          })
        ).connection_id,
      );
      assert.deepEqual(
        await service("refresh_claim", {
          workspaceId: workspace,
          connectionId: current.id,
          lease: second,
        }),
        {},
      );
      await service("refresh_save", {
        workspaceId: workspace,
        connectionId: current.id,
        lease: first,
        encrypted,
        expiresAt: body.expiresAt,
      });
      const stored = (
        await admin.query(
          "select version,refresh_lease from pos_private.square_credentials where connection_id=$1",
          [current.id],
        )
      ).rows[0];
      assert.equal(stored.refresh_lease, null);
    },
  );
  await check(
    "Square cashier and anonymous cannot administer or reach trusted observation RPC",
    async () => {
      const employee = randomUUID();
      await admin.query("insert into auth.users(id) values($1)", [employee]);
      await admin.query("insert into workspace_members values($1,$2,'employee')", [
        workspace,
        employee,
      ]);
      await b.query("select set_config('request.jwt.claim.sub',$1,false)", [
        employee,
      ]);
      try {
        await assert.rejects(settings(b), /FORBIDDEN/);
        await assert.rejects(
          b.query("select public.pos_square_service('observe','{}')"),
          /permission denied/,
        );
        await admin.query("update workspace_members set role='manager' where workspace_id=$1 and user_id=$2",[workspace,employee]);
        await assert.rejects(settings(b),/FORBIDDEN/);
        await admin.query("update workspace_members set role='admin' where workspace_id=$1 and user_id=$2",[workspace,employee]);
        assert.ok((await settings(b)).connections.length);
        await admin.query("update workspace_members set role='employee' where workspace_id=$1 and user_id=$2",[workspace,employee]);
        await admin.query("insert into workspace_employees(workspace_id,linked_user_id,employment_status) values($1,$2,'active')",[workspace,employee]);
        await command(a,'staff_permissions',{employeeId:employee,permissions:{'pos.sell':true}});
        await command(a,'grant',{siteId:setup.siteId,employeeId:employee,capabilities:['sell']});
        remoteStatus='COMPLETED';
        const employeeEngine=new PaymentOrchestrator(store(b),'test',{SQUARE:new SquarePaymentProvider(store(b),accounts,workspace,employee,'test')});
        const employeeSale=await employeeEngine.begin(request());assert.equal(employeeSale.saleState,'COMPLETED');
        assert.equal((await admin.query('select actor_id from pos_sales where id=$1',[employeeSale.saleId])).rows[0].actor_id,employee);
      } finally {
        await b.query("select set_config('request.jwt.claim.sub',$1,false)", [
          owner,
        ]);
      }
      await admin.query("set role anon");
      try {
        await assert.rejects(
          admin.query("select public.pos_square_settings($1,$2,$3)", [
            workspace,
            "get",
            {},
          ]),
          /permission denied/,
        );
        await assert.rejects(
          admin.query("select public.pos_square_service('credential','{}')"),
          /permission denied/,
        );
      } finally {
        await admin.query("reset role");
      }
    },
  );
  remoteStatus = "COMPLETED";
  await check(
    "Square authorization revoked during pending payment preserves one attempt until reconnect",
    async () => {
      remoteStatus = "PENDING";
      const pending = await orchestrator.begin(request());
      const before = remotePayments.size;
      await service("event", {
        eventId: "revoked-during-payment",
        merchantId: "merchant-a",
        type: "oauth.authorization.revoked",
      });
      await assert.rejects(orchestrator.check(pending.id), /UNAUTHORIZED/);
      assert.equal(remotePayments.size, before);
      await service("connect", body);
      remotePayments.get(pending.id).status = "COMPLETED";
      assert.equal(
        (await orchestrator.check(pending.id)).saleState,
        "COMPLETED",
      );
      assert.equal(remotePayments.size, before);
      remoteStatus = "COMPLETED";
    },
  );
  await check(
    "Square cannot persist arbitrary card-input fields and reports separate Square money",
    async () => {
      await assert.rejects(
        pay("create", { ...request(), cardNumber: "forbidden-input" }),
        /POS_INVALID/,
      );
      const daily = await command(a, "daily", { siteId: setup.siteId });
      assert.ok(daily.squareSalesMinor > 0);
      assert.equal(daily.squareRefundsMinor, 108);
    },
  );
  await check(
    "Square decline releases checkout without sale or stock decrement",
    async () => {
      remoteStatus = "DECLINED";
      const declined = await orchestrator.begin(request());
      assert.equal(declined.status, "DECLINED");
      assert.equal(declined.saleId, null);
      assert.equal(declined.saleState, "PAYABLE");
      remoteStatus = "COMPLETED";
    },
  );
  await command(a, "close", { registerId: reg.id, sessionId: session.id });
  return {
    accounts,
    providerFactory: (store) => ({
      SQUARE: new SquarePaymentProvider(
        store,
        accounts,
        workspace,
        owner,
        "test",
      ),
    }),
  };
}

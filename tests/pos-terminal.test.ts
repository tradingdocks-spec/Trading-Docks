import test from "node:test";
import assert from "node:assert/strict";
import {
  terminalPayment,
  terminalRefund,
  terminalStatus,
  terminalScoped,
  TERMINAL_SCOPES,
  observeCode,
} from "../src/lib/pos/payments/square/terminal.ts";
import {
  SquareAccounts,
  type SquareStore,
} from "../src/lib/pos/payments/square/service.ts";
import {
  SquareHttp,
  safeSquareMetadata,
  type SquareObject,
} from "../src/lib/pos/payments/square/http.ts";
import { encryptMarketplaceCredentials } from "../src/lib/marketplaces/credentials.ts";
const config = {
  environment: "SANDBOX" as const,
  applicationId: "sandbox-test",
  applicationSecret: "test",
  redirectUrl: "https://example.test/cb",
  notificationUrl: "https://example.test/hook",
  webhookKey: "test",
};
process.env.MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY =
  "phase6-terminal-unit-only-encryption-key";
function fixture(fetcher: typeof fetch) {
  const calls: { action: string; body: SquareObject }[] = [];
  const store: SquareStore = async (action, body) => {
    calls.push({ action, body });
    return action === "terminal_context"
      ? { terminal: { provider_device_id: "DEVICE", location_id: "LOCATION" } }
      : {};
  };
  const accounts = new SquareAccounts(store, config, new SquareHttp(fetcher));
  const ctx = {
    connection: {
      id: "c",
      workspace_id: "w",
      merchant_id: "m",
      authorized_scopes: TERMINAL_SCOPES,
    },
    credential: {
      encrypted: encryptMarketplaceCredentials({
        access_token: "test",
        refresh_token: "test",
      }),
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    },
    payment: {
      id: "attempt",
      workspace_id: "w",
      amount_minor: 8437,
      currency: "USD",
      provider_payment_id: "PAYMENT",
    },
  };
  return { accounts, ctx, calls };
}
const checkout = {
  id: "CHECKOUT",
  reference_id: "attempt",
  amount_money: { amount: 8437, currency: "USD" },
  device_options: { device_id: "DEVICE" },
  location_id: "LOCATION",
  status: "COMPLETED",
  payment_ids: ["PAYMENT"],
};
const payment = {
  id: "PAYMENT",
  reference_id: "attempt",
  amount_money: { amount: 8437, currency: "USD" },
  location_id: "LOCATION",
  status: "COMPLETED",
  card_details: {
    card: { card_brand: "VISA", last_4: "1234", pan: "NEVER_STORE" },
  },
};
test("Terminal status conservatively handles cancel requested, completion and future states", () => {
  assert.equal(terminalStatus("PENDING"), "AWAITING_CUSTOMER");
  assert.equal(terminalStatus("IN_PROGRESS"), "PROCESSING");
  assert.equal(terminalStatus("CANCEL_REQUESTED"), "PROCESSING");
  assert.equal(terminalStatus("CANCELED"), "CANCELED");
  assert.equal(terminalStatus("COMPLETED"), "UNKNOWN");
  assert.equal(terminalStatus("FUTURE"), "UNKNOWN");
  assert.equal(terminalScoped(TERMINAL_SCOPES), true);
  assert.equal(terminalScoped(TERMINAL_SCOPES.slice(0, 3)), false);
});
test("Terminal creates exact immutable amount and verifies Payment before success with safe metadata", async () => {
  const f = fixture(async (url, init) => {
    if (String(url).endsWith("/v2/terminals/checkouts")) {
      const b = JSON.parse(String(init?.body));
      assert.equal(b.idempotency_key, "attempt");
      assert.deepEqual(b.checkout.amount_money, {
        amount: 8437,
        currency: "USD",
      });
      assert.equal(b.checkout.device_options.device_id, "DEVICE");
      assert.equal(b.checkout.device_options.tip_settings.allow_tipping, false);
      assert.equal(b.checkout.device_options.skip_receipt_screen, true);
      assert.equal(b.checkout.deadline_duration, undefined);
      return Response.json({ checkout });
    }
    assert.ok(String(url).endsWith("/v2/payments/PAYMENT"));
    return Response.json({ payment });
  });
  await terminalPayment(f.accounts, f.ctx);
  const observed = f.calls.find((c) => c.action === "observe")!.body;
  assert.equal(observed.status, "SUCCEEDED");
  assert.equal(observed.providerId, "PAYMENT");
  assert.ok(!JSON.stringify(observed).includes("NEVER_STORE"));
});
test("Terminal never succeeds for mismatched payment identity amount currency location or reference", async () => {
  for (const field of [
    { id: "other" },
    { reference_id: "other" },
    { location_id: "other" },
    { amount_money: { amount: 1, currency: "USD" } },
    { amount_money: { amount: 8437, currency: "CAD" } },
  ]) {
    const f = fixture(async (url) =>
      Response.json(
        String(url).includes("/payments/")
          ? { payment: { ...payment, ...field } }
          : { checkout },
      ),
    );
    await assert.rejects(terminalPayment(f.accounts, f.ctx), /UNKNOWN_STATUS/);
    assert.ok(!f.calls.some((c) => c.action === "observe"));
  }
});
test("Terminal completion with absent or multiple payment IDs cannot finalize", async () => {
  for (const payment_ids of [[], ["one", "two"], undefined]) {
    const f = fixture(async () =>
      Response.json({ checkout: { ...checkout, payment_ids } }),
    );
    await assert.rejects(terminalPayment(f.accounts, f.ctx), /UNKNOWN_STATUS/);
    assert.ok(!f.calls.some((c) => c.action === "observe"));
  }
});
test("Terminal missing scopes stops before provider network", async () => {
  const f = fixture(async () => assert.fail("must not call Square"));
  f.ctx.connection.authorized_scopes = [];
  await assert.rejects(
    terminalPayment(f.accounts, f.ctx),
    /SQUARE_TERMINAL_SCOPE/,
  );
});
test("Terminal network loss preserves unresolved attempt and same logical identity", async () => {
  const keys: string[] = [];
  const f = fixture(async (_url, init) => {
    keys.push(JSON.parse(String(init?.body)).idempotency_key);
    throw Error("disconnect");
  });
  for (let i = 0; i < 2; i++)
    await assert.rejects(terminalPayment(f.accounts, f.ctx), /NETWORK_ERROR/);
  assert.deepEqual(keys, ["attempt", "attempt"]);
  assert.ok(!f.calls.some((c) => c.action === "observe"));
});
test("Terminal cancellation request is not confirmation", async () => {
  const f = fixture(async (url) => {
    assert.ok(String(url).endsWith("/v2/terminals/checkouts/CHECKOUT/cancel"));
    return Response.json({
      checkout: { ...checkout, status: "CANCEL_REQUESTED" },
    });
  });
  await terminalPayment(f.accounts, f.ctx, true, "CHECKOUT");
  assert.equal(
    f.calls.find((c) => c.action === "observe")?.body.status,
    "PROCESSING",
  );
});
test("Device-code observation rejects wrong location and code identity", async () => {
  const f = fixture(async () => assert.fail());
  await assert.rejects(
    observeCode(
      f.accounts,
      { provider_location_id: "l", provider_device_code_id: "c" },
      { id: "c", product_type: "TERMINAL_API", location_id: "other" },
    ),
    /UNKNOWN_STATUS/,
  );
  await assert.rejects(
    observeCode(
      f.accounts,
      { provider_location_id: "l", provider_device_code_id: "c" },
      { id: "other", product_type: "TERMINAL_API", location_id: "l" },
    ),
    /UNKNOWN_STATUS/,
  );
  assert.equal(f.calls.length, 0);
});
test("Card-presence refund uses separate Terminal refund identity then authoritative Refund", async () => {
  const f = fixture(async (url, init) => {
    if (String(url).endsWith("/v2/terminals/refunds")) {
      const b = JSON.parse(String(init?.body));
      assert.equal(b.idempotency_key, "refund");
      assert.equal(b.refund.payment_id, "PAYMENT");
      return Response.json({
        refund: {
          id: "TERMINAL_REFUND",
          refund_id: "REFUND",
          payment_id: "PAYMENT",
          device_id: "DEVICE",
          location_id: "LOCATION",
          amount_money: { amount: 100, currency: "CAD" },
          status: "COMPLETED",
        },
      });
    }
    assert.ok(String(url).endsWith("/v2/refunds/REFUND"));
    return Response.json({
      refund: {
        id: "REFUND",
        payment_id: "PAYMENT",
        amount_money: { amount: 100, currency: "CAD" },
        status: "COMPLETED",
      },
    });
  });
  f.ctx.payment.currency = "CAD";
  await terminalRefund(f.accounts, {
    ...f.ctx,
    refund: { id: "refund", amount_minor: 100 },
  });
  assert.equal(
    f.calls.find((c) => c.action === "terminal_refund_save")?.body.checkoutId,
    "TERMINAL_REFUND",
  );
  assert.equal(
    f.calls.find((c) => c.action === "observe_refund")?.body.providerId,
    "REFUND",
  );
});

test("Square card-presence refund flag comes from safe card_details metadata", () => {
  assert.equal(
    safeSquareMetadata({
      card_details: {
        refund_requires_card_presence: true,
        card: { pan: "secret" },
      },
    }).refundRequiresCardPresence,
    true,
  );
  assert.ok(
    !JSON.stringify(
      safeSquareMetadata({ card_details: { card: { pan: "secret" } } }),
    ).includes("secret"),
  );
});

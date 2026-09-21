import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeProviderError,
  canTransition,
  paymentStates,
  tenderBalance,
  safeMetadata,
  assertMockEnvironment,
  paymentErrors,
} from "../src/lib/pos/payments/domain.ts";
import {
  MockPaymentProvider,
  providerFor,
  type PaymentStore,
} from "../src/lib/pos/payments/provider.ts";
import { PaymentOrchestrator } from "../src/lib/pos/payments/orchestrator.ts";
import { renderReceipt } from "../src/lib/pos/receipt.ts";
import type { Receipt } from "../src/lib/pos/domain.ts";
test("payment transition terminal states cannot regress or become charged", () => {
  for (const from of ["DECLINED", "FAILED", "CANCELED", "REFUNDED"] as const)
    for (const to of paymentStates)
      assert.equal(canTransition(from, to), from === to);
  assert.equal(canTransition("UNKNOWN", "SUCCEEDED"), true);
  assert.equal(canTransition("TIMED_OUT", "DECLINED"), true);
  assert.equal(canTransition("SUCCEEDED", "UNKNOWN"), false);
  assert.equal(canTransition("SUCCEEDED", "PARTIALLY_REFUNDED"), true);
});
test("multi-tender and partial refund foundation uses bounded integer cents", () => {
  assert.equal(tenderBalance(10000, [2500, 7500]), 0);
  assert.equal(tenderBalance(10000, [2500]), 7500);
  assert.throws(() => tenderBalance(10000, [10001]));
  assert.throws(() => tenderBalance(10, [0.1]));
  assert.throws(() => tenderBalance(-1, []));
});
test("provider metadata allowlist removes card secrets and unbounded fields", () => {
  assert.deepEqual(
    safeMetadata({
      brand: "Mock",
      last4: "4242",
      pan: "4111111111111111",
      cvv: "123",
      token: "secret",
      raw: {},
    }),
    { brand: "Mock", last4: "4242" },
  );
  assert.deepEqual(
    safeMetadata({ last4: "12345", brand: "x".repeat(100) }),
    {},
  );
});
test("mock production gate rejects before any persistence or provider request", async () => {
  let calls = 0;
  const store: PaymentStore = async <T>() => {
    calls++;
    return {} as T;
  };
  assert.throws(
    () => new MockPaymentProvider(store, "production"),
    /POS_MOCK_DISABLED/,
  );
  assert.throws(() => assertMockEnvironment(undefined));
  assert.doesNotThrow(() => assertMockEnvironment("test"));
  await assert.rejects(
    new PaymentOrchestrator(store, "production").begin({ provider: "MOCK" }),
    /POS_MOCK_DISABLED/,
  );
  assert.equal(calls, 0);
  assert.throws(
    () => providerFor("SQUARE", store, "test"),
    /CONFIGURATION_ERROR/,
  );
});
test("unsigned mock webhook is never accepted as verified payment", async () => {
  const store: PaymentStore = async <T>() => ({}) as T;
  const provider = new MockPaymentProvider(store, "test");
  await assert.rejects(
    new PaymentOrchestrator(store, "test").ingest(
      provider,
      new Uint8Array(),
      new Headers(),
    ),
    /CONFIGURATION_ERROR/,
  );
});
test("provider errors use reusable safe merchant messages", () => {
  assert.match(
    paymentErrors.NETWORK_ERROR,
    /Verify payment status before trying again/,
  );
  assert.match(paymentErrors.UNKNOWN_STATUS, /verified/);
  assert.doesNotMatch(
    Object.values(paymentErrors).join(" "),
    /ECONNRESET|secret|stack/,
  );
});
test("receipt shows safe mock tender without invented cash or raw card data", () => {
  const r = {
    version: 3,
    number: "TEST",
    site: "Store",
    register: "Front",
    actorId: "private",
    createdAt: "2026-09-20T00:00:00Z",
    currency: "USD",
    lines: [],
    subtotalMinor: 100,
    discountMinor: 0,
    taxMinor: 0,
    totalMinor: 100,
    cashMinor: 0,
    changeMinor: 0,
    payment: {
      provider: "MOCK",
      status: "SUCCEEDED",
      metadata: { brand: "Mock", last4: "4242", verification: "Simulated" },
    },
  } satisfies Receipt;
  const html = renderReceipt(r);
  assert.match(html, /Mock •••• 4242/);
  assert.match(html, /Simulated/);
  assert.doesNotMatch(html, /Cash \$|Change \$|private/);
});

test("raw provider transport errors normalize without leaking payloads", () => {
  assert.equal(
    normalizeProviderError(
      Object.assign(Error("secret processor body"), { code: "ECONNRESET" }),
    ).category,
    "NETWORK_ERROR",
  );
  assert.equal(
    normalizeProviderError(Error("REFUND_FAILED")).category,
    "REFUND_FAILED",
  );
  assert.equal(
    normalizeProviderError(Error("token=private; card data")).category,
    "UNKNOWN_STATUS",
  );
  assert.doesNotMatch(
    normalizeProviderError(Error("token=private")).message,
    /token|private/,
  );
});

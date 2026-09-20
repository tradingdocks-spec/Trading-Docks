import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export async function verifyPayments({
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
  const pay = async (client, action, body = {}, refund = false) =>
    (
      await client.query(
        "select public." +
          (refund ? "pos_payment_refund_command" : "pos_payment_command") +
          "($1,$2,$3) result",
        [workspace, action, body],
      )
    ).rows[0].result;
  const reg = await command(a, "configure_register", {
    siteId: setup.siteId,
    name: "Payment tests",
  });
  const session = await command(a, "open", {
    registerId: reg.id,
    openingMinor: 20000,
  });
  await a.query(
    "insert into inventory_items(id,user_id,workspace_id,location_id,card_name,sku,quantity,asking_price,data) values('payment-stock',$1,$2,'case','Payment stock','PAY-STOCK',100,1,'{}')",
    [owner, workspace],
  );
  const intent = () => ({
    key: randomUUID(),
    siteId: setup.siteId,
    sessionId: session.id,
    expectedMinor: 217,
    cashMinor: 217,
    lines: [{ ownerId: owner, itemId: "payment-stock", quantity: 2 }],
  });
  const request = (outcome = "APPROVE") => ({
    key: randomUUID(),
    provider: "MOCK",
    outcome,
    intent: intent(),
  });
  const settle = async (id, client = a) => {
    await pay(client, "observe", { id });
    return pay(client, "finalize", { id });
  };
  let first;
  await check("mock is disabled at database authority by default", async () => {
    await assert.rejects(pay(a, "create", request()), /POS_MOCK_DISABLED/);
  });
  await admin.query("update pos_private.payment_test_config set enabled=true");
  await check(
    "concurrent payment initiation is one attempt and immutable snapshot",
    async () => {
      const body = request();
      const results = await Promise.all([
        pay(a, "create", body),
        pay(b, "create", body),
      ]);
      assert.equal(results[0].id, results[1].id);
      first = results[0];
      await assert.rejects(
        pay(a, "create", { ...body, outcome: "DECLINE" }),
        /POS_IDEMPOTENCY_CONFLICT/,
      );
      await assert.rejects(
        pay(a, "create", { ...body, key: randomUUID() }),
        /POS_PAYMENT_ACTIVE/,
      );
      await assert.rejects(
        a.query("update pos_payment_checkouts set amount_minor=1"),
        /permission denied/,
      );
    },
  );
  await check(
    "provider success is durable before one concurrent finalization",
    async () => {
      await Promise.all([
        pay(a, "dispatch", { id: first.id }),
        pay(b, "dispatch", { id: first.id }),
      ]);
      const pending = await pay(a, "get", { id: first.id });
      assert.equal(pending.status, "PENDING");
      assert.equal(pending.saleId, null);
      await Promise.all([
        pay(a, "observe", { id: first.id, eventId: "success-event" }),
        pay(b, "observe", { id: first.id, eventId: "success-event" }),
      ]);
      const done = await Promise.all([
        pay(a, "finalize", { id: first.id }),
        pay(b, "finalize", { id: first.id }),
      ]);
      assert.equal(done[0].saleId, done[1].saleId);
      first = done[0];
      assert.equal(first.saleState, "COMPLETED");
      assert.equal(first.receipt.payment.provider, "MOCK");
      assert.equal(
        Number(
          (
            await admin.query(
              "select quantity from inventory_items where id='payment-stock' and user_id=$1",
              [owner],
            )
          ).rows[0].quantity,
        ),
        98,
      );
      assert.equal(
        Number(
          (
            await admin.query("select pos_private.expected_cash($1) n", [
              session.id,
            ])
          ).rows[0].n,
        ),
        20000,
      );
      assert.equal(
        (
          await admin.query(
            "select * from pos_tenders where payment_attempt_id=$1",
            [first.id],
          )
        ).rowCount,
        1,
      );
    },
  );
  await check(
    "decline cancel and timeout preserve no-sale inventory boundary",
    async () => {
      for (const outcome of ["DECLINE", "CANCEL", "TIMEOUT"]) {
        const p = await pay(a, "create", request(outcome));
        await pay(a, "dispatch", { id: p.id });
        const o = await pay(a, "observe", { id: p.id });
        assert.equal(o.saleId, null);
        await assert.rejects(
          pay(a, "finalize", { id: p.id }),
          /POS_PAYMENT_UNCERTAIN/,
        );
        if (outcome === "TIMEOUT") {
          await assert.rejects(
            command(a, "begin_close", {
              registerId: reg.id,
              sessionId: session.id,
            }),
            /POS_PAYMENT_ACTIVE/,
          );
          await pay(a, "provider_cancel", { id: p.id });
          await pay(a, "observe", { id: p.id });
        }
      }
    },
  );
  await check(
    "unknown success decline and delayed results reconcile without duplicate attempts",
    async () => {
      for (const outcome of [
        "UNKNOWN_THEN_SUCCESS",
        "UNKNOWN_THEN_DECLINE",
        "DELAYED_SUCCESS",
      ]) {
        const p = await pay(a, "create", request(outcome));
        await pay(a, "dispatch", { id: p.id });
        let o = await pay(a, "observe", { id: p.id });
        assert.ok(["UNKNOWN", "PROCESSING"].includes(o.status));
        await pay(a, "provider_get", { id: p.id });
        await pay(a, "observe", { id: p.id });
        await pay(a, "provider_get", { id: p.id });
        o = await pay(a, "observe", { id: p.id });
        assert.equal(
          o.status,
          outcome === "UNKNOWN_THEN_DECLINE" ? "DECLINED" : "SUCCEEDED",
        );
        if (o.status === "SUCCEEDED") await pay(a, "finalize", { id: p.id });
      }
    },
  );
  await check(
    "success and price failure retain recovery and cannot charge again",
    async () => {
      const body = request();
      const p = await pay(a, "create", body);
      await pay(a, "dispatch", { id: p.id });
      await pay(a, "observe", { id: p.id });
      await a.query(
        "update inventory_items set asking_price=2 where user_id=$1 and id='payment-stock'",
        [owner],
      );
      let o = await pay(a, "finalize", { id: p.id });
      assert.equal(o.status, "SUCCEEDED");
      assert.equal(o.saleState, "RECOVERY_REQUIRED");
      await assert.rejects(
        pay(a, "create", { ...body, key: randomUUID() }),
        /POS_PAYMENT_ACTIVE/,
      );
      await a.query(
        "update inventory_items set asking_price=1 where user_id=$1 and id='payment-stock'",
        [owner],
      );
      o = await pay(a, "finalize", { id: p.id });
      assert.equal(o.saleState, "COMPLETED");
    },
  );
  await check(
    "provider refund retry is one refund and no cash-ledger mutation",
    async () => {
      const detail = await command(a, "receipt", { saleId: first.saleId });
      const body = {
        key: randomUUID(),
        paymentId: first.id,
        intent: {
          saleId: first.saleId,
          sessionId: session.id,
          expectedMinor: 108,
          reason: "Partial return",
          lines: [
            {
              saleItemId: detail.items[0].id,
              quantity: 1,
              returnInventory: false,
            },
          ],
        },
      };
      await assert.rejects(
        command(a, "refund", body.intent),
        /POS_PROVIDER_REFUND_REQUIRED/,
      );
      const r = await pay(a, "create", body, true);
      assert.equal((await pay(b, "create", body, true)).id, r.id);
      await pay(a, "dispatch", { id: r.id }, true);
      const pair = await Promise.all([
        pay(a, "finalize", { id: r.id }, true),
        pay(b, "finalize", { id: r.id }, true),
      ]);
      assert.equal(pair[0].refund_id, pair[1].refund_id);
      assert.ok(pair[0].refund_id);
      assert.equal(
        (await pay(a, "get", { id: first.id })).status,
        "PARTIALLY_REFUNDED",
      );
      assert.equal(
        Number(
          (
            await admin.query("select pos_private.expected_cash($1) n", [
              session.id,
            ])
          ).rows[0].n,
        ),
        20000,
      );
      await assert.rejects(
        pay(
          a,
          "create",
          {
            ...body,
            key: randomUUID(),
            intent: {
              ...body.intent,
              lines: [{ ...body.intent.lines[0], quantity: 2 }],
            },
          },
          true,
        ),
        /POS_REFUND_EXCEEDED/,
      );
    },
  );
  await check(
    "unknown refund reconciles once and restores only chosen stock",
    async () => {
      const detail = await command(a, "receipt", { saleId: first.saleId });
      const body = {
        key: randomUUID(),
        paymentId: first.id,
        intent: {
          saleId: first.saleId,
          sessionId: session.id,
          expectedMinor: 109,
          reason: "Remaining return",
          mockOutcome: "REFUND_UNKNOWN_THEN_SUCCESS",
          lines: [
            {
              saleItemId: detail.items[0].id,
              quantity: 1,
              returnInventory: true,
            },
          ],
        },
      };
      const r = await pay(a, "create", body, true);
      assert.equal(
        (await pay(a, "dispatch", { id: r.id }, true)).status,
        "UNKNOWN",
      );
      await Promise.all([
        pay(a, "reconcile", { id: r.id }, true),
        pay(b, "reconcile", { id: r.id }, true),
      ]);
      const done = await pay(a, "finalize", { id: r.id }, true);
      assert.ok(done.refund_id);
      assert.equal((await pay(a, "get", { id: first.id })).status, "REFUNDED");
    },
  );
  await check(
    "manual tender is explicitly external and never affects drawer cash",
    async () => {
      const p = await pay(a, "create", {
        key: randomUUID(),
        provider: "EXTERNAL",
        method: "check",
        reference: "CHECK-1",
        intent: intent(),
      });
      await pay(a, "dispatch", { id: p.id });
      const done = await settle(p.id);
      assert.equal(
        done.receipt.payment.metadata.verification,
        "Externally recorded",
      );
      assert.equal(done.saleState, "COMPLETED");
    },
  );
  await check(
    "payment tenant anon and private provider bypasses are denied",
    async () => {
      await assert.rejects(
        pay(stranger, "get", { id: first.id }),
        /POS_FORBIDDEN/,
      );
      for (const table of [
        "pos_payment_attempts",
        "pos_payment_events",
        "pos_payment_refund_attempts",
        "pos_payment_audit",
      ])
        await assert.rejects(
          a.query("select * from " + table),
          /permission denied/,
        );
      await assert.rejects(
        a.query("update pos_private.mock_payments set status='SUCCEEDED'"),
        /permission denied/,
      );
    },
  );
  await check(
    "provider contract survives retries retrieval cancellation and refund failure",
    async () => {
      const { PaymentOrchestrator } = await import(
        "../src/lib/pos/payments/orchestrator.ts"
      );
      const store = (action, body, refund = false) =>
        pay(a, action, body, refund);
      const service = new PaymentOrchestrator(store, "test");
      const body = request();
      const p = await service.begin(body);
      assert.equal(p.saleState, "COMPLETED");
      assert.equal((await service.begin(body)).saleId, p.saleId);
      assert.equal((await service.check(p.id)).saleId, p.saleId);
      const detail = await command(a, "receipt", { saleId: p.saleId });
      const refund = {
        key: randomUUID(),
        paymentId: p.id,
        intent: {
          saleId: p.saleId,
          sessionId: session.id,
          expectedMinor: 108,
          reason: "Provider rejects",
          mockOutcome: "REFUND_FAIL",
          lines: [
            {
              saleItemId: detail.items[0].id,
              quantity: 1,
              returnInventory: false,
            },
          ],
        },
      };
      const failed = await service.refund(refund);
      assert.equal(failed.status, "FAILED");
      assert.equal(failed.refund_id, null);
      assert.equal((await service.refund(refund)).id, failed.id);
      const unknown = await service.begin(request("TIMEOUT"));
      assert.equal(unknown.status, "TIMED_OUT");
      assert.equal((await service.cancel(unknown.id)).status, "CANCELED");
    },
  );
  await check(
    "successful unfulfillable payment is retained then refunded without a sale",
    async () => {
      const p = await pay(a, "create", request());
      await pay(a, "dispatch", { id: p.id });
      await pay(a, "observe", { id: p.id });
      await a.query(
        "update inventory_items set asking_price=3 where user_id=$1 and id='payment-stock'",
        [owner],
      );
      assert.equal(
        (await pay(a, "finalize", { id: p.id })).saleState,
        "RECOVERY_REQUIRED",
      );
      const r = await pay(
        a,
        "create",
        {
          key: randomUUID(),
          paymentId: p.id,
          intent: { reason: "Cannot fulfill" },
        },
        true,
      );
      await pay(a, "dispatch", { id: r.id }, true);
      await pay(a, "finalize", { id: r.id }, true);
      const done = await pay(a, "get", { id: p.id });
      assert.equal(done.status, "REFUNDED");
      assert.equal(done.saleState, "VOIDED");
      assert.equal(done.saleId, null);
      await a.query(
        "update inventory_items set asking_price=1 where user_id=$1 and id='payment-stock'",
        [owner],
      );
    },
  );
  await check(
    "client status injection and invalid database transitions fail closed",
    async () => {
      const p = await pay(a, "create", request("DECLINE"));
      await pay(a, "dispatch", { id: p.id });
      const declined = await pay(a, "observe", {
        id: p.id,
        status: "SUCCEEDED",
        amountMinor: 1,
      });
      assert.equal(declined.status, "DECLINED");
      await assert.rejects(
        admin.query(
          "update pos_payment_attempts set status='SUCCEEDED' where id=$1",
          [p.id],
        ),
        /POS_PAYMENT_TRANSITION/,
      );
      await assert.rejects(
        admin.query(
          "update pos_payment_checkouts set snapshot='{}' where id=$1",
          [p.checkoutId],
        ),
        /POS_IMMUTABLE/,
      );
      await admin.query("set role anon");
      try {
        await assert.rejects(
          admin.query("select public.pos_payment_command($1,'list','{}')", [
            workspace,
          ]),
          /permission denied/,
        );
      } finally {
        await admin.query("reset role");
      }
    },
  );
  await check(
    "payment preflight rejects unknown exact position before contacting provider",
    async () => {
      const body = request();
      body.intent.lines[0].positionId = "missing-position";
      await assert.rejects(pay(a, "create", body), /POS_STOCK_UNAVAILABLE/);
      assert.equal(
        (
          await admin.query(
            "select * from pos_payment_attempts where idempotency_key=$1",
            [body.key],
          )
        ).rowCount,
        0,
      );
    },
  );
  await check(
    "grant revocation after provider success preserves money and blocks stock",
    async () => {
      const employee = "22222222-2222-4222-8222-222222222222";
      await admin.query(
        "insert into workspace_members values($1,$2,'employee')",
        [workspace, employee],
      );
      const grant = await command(a, "grant", {
        siteId: setup.siteId,
        employeeId: employee,
        capabilities: ["sell", "return"],
      });
      const p = await pay(stranger, "create", request());
      await pay(stranger, "dispatch", { id: p.id });
      await pay(stranger, "observe", { id: p.id });
      await command(a, "revoke", { id: grant.id });
      const result = await pay(stranger, "finalize", { id: p.id });
      assert.equal(result.status, "SUCCEEDED");
      assert.equal(result.saleState, "RECOVERY_REQUIRED");
      assert.equal(result.saleId, null);
      const r = await pay(
        a,
        "create",
        {
          key: randomUUID(),
          paymentId: p.id,
          intent: { reason: "Delegation revoked; cannot fulfill" },
        },
        true,
      );
      await pay(a, "dispatch", { id: r.id }, true);
      await pay(a, "finalize", { id: r.id }, true);
      assert.equal((await pay(a, "get", { id: p.id })).saleState, "VOIDED");
      await admin.query(
        "delete from workspace_members where workspace_id=$1 and user_id=$2",
        [workspace, employee],
      );
    },
  );
  await check(
    "declined checkout preserves attempt history when another attempt succeeds",
    async () => {
      const body = request("DECLINE");
      const failed = await pay(a, "create", body);
      await pay(a, "dispatch", { id: failed.id });
      await pay(a, "observe", { id: failed.id });
      const next = await pay(a, "create", {
        ...body,
        key: randomUUID(),
        outcome: "APPROVE",
        checkoutId: failed.checkoutId,
      });
      assert.equal(next.checkoutId, failed.checkoutId);
      await pay(a, "dispatch", { id: next.id });
      await settle(next.id);
      assert.equal((await pay(a, "get", { id: failed.id })).status, "DECLINED");
    },
  );
  await check(
    "provider success versus close serializes without orphan payment or sale",
    async () => {
      const p = await pay(a, "create", request());
      await pay(a, "dispatch", { id: p.id });
      await pay(a, "observe", { id: p.id });
      const results = await Promise.allSettled([
        pay(a, "finalize", { id: p.id }),
        command(b, "begin_close", {
          registerId: reg.id,
          sessionId: session.id,
        }),
      ]);
      assert.equal(results[0].status, "fulfilled");
      assert.equal(results[0].value.saleState, "COMPLETED");
      if (results[1].status === "fulfilled")
        await command(a, "resume", {
          registerId: reg.id,
          sessionId: session.id,
        });
      else assert.match(results[1].reason.message, /POS_PAYMENT_ACTIVE/);
    },
  );
  await check(
    "rollout disable prevents first provider dispatch while unpaid cancellation stays safe",
    async () => {
      const p = await pay(a, "create", request());
      await admin.query(
        "update pos_workspace_settings set enabled=false where workspace_id=$1",
        [workspace],
      );
      try {
        await assert.rejects(pay(a, "dispatch", { id: p.id }), /POS_DISABLED/);
        assert.equal(
          (
            await admin.query(
              "select * from pos_private.mock_payments where payment_id=$1",
              [p.id],
            )
          ).rowCount,
          0,
        );
        await pay(a, "provider_cancel", { id: p.id });
        assert.equal(
          (await pay(a, "observe", { id: p.id })).status,
          "CANCELED",
        );
      } finally {
        await admin.query(
          "update pos_workspace_settings set enabled=true where workspace_id=$1",
          [workspace],
        );
      }
    },
  );
  await command(a, "close", { registerId: reg.id, sessionId: session.id });
  return { pay, first, reg, session };
}

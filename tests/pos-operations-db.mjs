import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyOperations({
  admin,
  a,
  b,
  staff,
  command,
  workspace,
  owner,
  other,
  setup,
  check,
  createClient,
}) {
  const register = await command(a, "configure_register", {
    siteId: setup.siteId,
    name: "Operations test",
  });
  let session;
  const expected = async () =>
    Number(
      (
        await admin.query("select pos_private.expected_cash($1) n", [
          session.id,
        ])
      ).rows[0].n,
    );
  const sell = (quantity = 1) => ({
    key: randomUUID(),
    siteId: setup.siteId,
    sessionId: session.id,
    expectedMinor: 109 * quantity,
    cashMinor: 10000,
    lines: [{ ownerId: owner, itemId: "ops-stock", quantity }],
  });
  await a.query(
    "insert into inventory_items(id,user_id,workspace_id,location_id,card_name,sku,quantity,asking_price,data) values('ops-stock',$1,$2,'case','Operations stock','OPS-STOCK',100,1,'{}')",
    [owner, workspace],
  );
  await check(
    "opening replay creates one float; concurrent opens cannot share a new shift",
    async () => {
      const payload = {
        key: randomUUID(),
        registerId: register.id,
        openingMinor: 20000,
      };
      const pair = await Promise.all([
        command(a, "open", payload),
        command(b, "open", payload),
      ]);
      assert.equal(pair[0].id, pair[1].id);
      session = pair[0];
      assert.equal(await expected(), 20000);
      await assert.rejects(
        command(b, "open", { registerId: register.id, openingMinor: 0 }),
        /POS_REGISTER_BUSY/,
      );
    },
  );
  let sale;
  await check(
    "cash sale records applied amount without subtracting change twice",
    async () => {
      sale = await command(a, "checkout", sell());
      assert.equal(await expected(), 20109);
      assert.equal(sale.receipt.changeMinor, 9891);
    },
  );
  await check(
    "duplicate paid out is atomic and reasoned; changed intent is rejected",
    async () => {
      const payload = {
        key: randomUUID(),
        registerId: register.id,
        sessionId: session.id,
        kind: "PAID_OUT",
        amountMinor: 1500,
        reasonType: "PETTY_CASH",
        reason: "Courier",
      };
      const pair = await Promise.all([
        command(a, "cash_event", payload),
        command(b, "cash_event", payload),
      ]);
      assert.equal(pair[0].id, pair[1].id);
      assert.equal(await expected(), 18609);
      await assert.rejects(
        command(a, "cash_event", { ...payload, amountMinor: 1600 }),
        /POS_IDEMPOTENCY_CONFLICT/,
      );
    },
  );
  await check(
    "paid in, drop and signed adjustment calculate drawer expectation",
    async () => {
      for (const [kind, amountMinor, reasonType] of [
        ["PAID_IN", 5000, "CHANGE_FLOAT"],
        ["CASH_DROP", 3000, "SAFE"],
        ["CASH_ADJUSTMENT", -9, "CORRECTION"],
      ])
        await command(a, "cash_event", {
          registerId: register.id,
          sessionId: session.id,
          kind,
          amountMinor,
          reasonType,
          reason: "Counted movement",
        });
      assert.equal(await expected(), 20600);
    },
  );
  await check(
    "refund retry restores canonical stock once and creates one cash outflow",
    async () => {
      const detail = await command(a, "receipt", { saleId: sale.saleId });
      const payload = {
        key: randomUUID(),
        saleId: sale.saleId,
        sessionId: session.id,
        expectedMinor: 109,
        reason: "Customer return unchanged",
        lines: [
          {
            saleItemId: detail.items[0].id,
            quantity: 1,
            returnInventory: true,
          },
        ],
      };
      const pair = await Promise.all([
        command(a, "refund", payload),
        command(b, "refund", payload),
      ]);
      assert.equal(pair[0].id, pair[1].id);
      assert.equal(await expected(), 20491);
      assert.equal(
        (
          await admin.query(
            "select quantity from inventory_items where user_id=$1 and id='ops-stock'",
            [owner],
          )
        ).rows[0].quantity,
        100,
      );
      await assert.rejects(
        command(a, "refund", { ...payload, key: randomUUID() }),
        /POS_REFUND_EXCEEDED/,
      );
      await assert.rejects(
        admin.query(
          "update inventory_events set quantity_change=0 where related_entity_type='pos_refund'",
        ),
        /POS_IMMUTABLE|append-only/,
      );
    },
  );
  await check(
    "partial refunds allocate rounded tax exactly and can avoid restocking",
    async () => {
      const request = sell(3);
      request.expectedMinor = 326;
      const completed = await command(a, "checkout", request);
      const detail = await command(a, "receipt", { saleId: completed.saleId });
      for (const amount of [108, 109, 109])
        await command(a, "refund", {
          saleId: completed.saleId,
          sessionId: session.id,
          expectedMinor: amount,
          reason: "Damaged, no restock",
          lines: [
            {
              saleItemId: detail.items[0].id,
              quantity: 1,
              returnInventory: false,
            },
          ],
        });
      assert.equal(await expected(), 20491);
      assert.equal(
        (
          await admin.query(
            "select quantity from inventory_items where user_id=$1 and id='ops-stock'",
            [owner],
          )
        ).rows[0].quantity,
        97,
      );
    },
  );
  await check(
    "fixed, percentage, cart discounts and override follow deterministic pricing",
    async () => {
      const payload = {
        ...sell(3),
        discountReason: "Approved markdown",
        cartDiscountMinor: 25,
        lines: [
          {
            ownerId: owner,
            itemId: "ops-stock",
            quantity: 3,
            overrideMinor: 150,
            discountMinor: 50,
          },
        ],
      };
      const quote = await command(a, "quote", payload);
      assert.equal(quote.subtotalMinor, 450);
      assert.equal(quote.discountMinor, 75);
      assert.equal(quote.taxMinor, 32);
      assert.equal(quote.totalMinor, 407);
      const completed = await command(a, "checkout", {
        ...payload,
        expectedMinor: 407,
      });
      assert.equal(completed.receipt.lines[0].originalUnitPriceMinor, 100);
      assert.equal(completed.receipt.lines[0].cartDiscountMinor, 25);
    },
  );
  await check(
    "closing blocks checkout and cash events, manager can resume before close",
    async () => {
      await command(a, "begin_close", {
        registerId: register.id,
        sessionId: session.id,
      });
      await assert.rejects(
        command(b, "checkout", sell()),
        /POS_SESSION_CLOSED/,
      );
      await assert.rejects(
        command(b, "cash_event", {
          registerId: register.id,
          sessionId: session.id,
          kind: "PAID_IN",
          amountMinor: 1,
          reasonType: "OTHER",
          reason: "Blocked",
        }),
        /POS_SESSION_CLOSED/,
      );
      await command(a, "resume", {
        registerId: register.id,
        sessionId: session.id,
      });
    },
  );
  await check(
    "close requires variance reason and concurrent closes produce one record",
    async () => {
      await assert.rejects(
        command(a, "close", {
          registerId: register.id,
          sessionId: session.id,
          countedMinor: 0,
        }),
        /POS_REASON_REQUIRED/,
      );
      const amount = await expected();
      const pair = await Promise.allSettled([
        command(a, "close", {
          registerId: register.id,
          sessionId: session.id,
          countedMinor: amount + 250,
          reason: "Extra float found",
        }),
        command(b, "close", {
          registerId: register.id,
          sessionId: session.id,
          countedMinor: amount + 250,
          reason: "Extra float found",
        }),
      ]);
      assert.equal(pair.filter((x) => x.status === "fulfilled").length, 1);
      const closed = pair.find((x) => x.status === "fulfilled").value;
      assert.equal(Number(closed.variance_minor), 250);
      assert.equal(closed.status, "CLOSED");
      await assert.rejects(
        command(a, "resume", {
          registerId: register.id,
          sessionId: session.id,
        }),
        /POS_SESSION_CLOSED/,
      );
    },
  );
  await check(
    "new shift is distinct; sale-close race cannot create an orphan sale",
    async () => {
      const old = session.id;
      session = await command(a, "open", {
        registerId: register.id,
        openingMinor: 0,
      });
      assert.notEqual(session.id, old);
      const pair = await Promise.allSettled([
        command(a, "checkout", sell()),
        command(b, "close", {
          registerId: register.id,
          sessionId: session.id,
          countedMinor: 0,
          reason: "Race test",
        }),
      ]);
      assert.equal(pair[1].status, "fulfilled");
      const total = await expected();
      const stored = (
        await admin.query(
          "select expected_minor from pos_register_sessions where id=$1",
          [session.id],
        )
      ).rows[0];
      assert.equal(Number(stored.expected_minor), total);
      assert.equal(total, pair[0].status === "fulfilled" ? 109 : 0);
    },
  );
  await check(
    "daily, session history and detail use site timezone and ledger data",
    async () => {
      const report = await command(a, "daily", { siteId: setup.siteId });
      assert.equal(report.timezone, "America/Phoenix");
      assert.ok(Number(report.sales.count) > 0);
      assert.ok(report.byHour.length);
      const sessions = await command(a, "sessions", {
        siteId: setup.siteId,
        varianceOnly: "true",
      });
      assert.ok(sessions.some((s) => s.variance_minor !== null));
      const detail = await command(a, "session_detail", {
        siteId: setup.siteId,
        sessionId: session.id,
      });
      assert.ok(detail.events.length >= 2);
    },
  );
  await check(
    "cash and approval tables deny direct authenticated access",
    async () => {
      for (const table of [
        "pos_cash_events",
        "pos_refunds",
        "pos_refund_items",
        "pos_approval_requests",
        "pos_approval_decisions",
        "pos_operation_receipts",
      ])
        await assert.rejects(
          staff.query(`select * from ${table}`),
          /permission denied/,
        );
    },
  );
  // Restore a valid employee grant for independently authenticated approval tests.
  await admin.query("insert into workspace_members values($1,$2,'employee')", [
    workspace,
    other,
  ]);
  await command(a, "grant", {
    siteId: setup.siteId,
    employeeId: other,
    capabilities: ["sell", "return"],
  });
  session = await command(a, "open", {
    registerId: register.id,
    openingMinor: 0,
  });
  await check(
    "one register sells delegated inventory from two canonical owners",
    async () => {
      const partner = randomUUID();
      await admin.query("insert into auth.users(id) values($1)", [partner]);
      await admin.query("insert into profiles values($1)", [partner]);
      await admin.query(
        "insert into user_preferences(user_id,active_workspace_id) values($1,$2)",
        [partner, workspace],
      );
      await admin.query(
        "insert into admin_membership_overrides values($1,'store')",
        [partner],
      );
      await admin.query(
        "insert into workspace_members values($1,$2,'manager')",
        [workspace, partner],
      );
      const p = await createClient(partner);
      try {
        await p.query(
          "insert into inventory_locations(id,user_id,name) values('partner-case',$1,'Partner case')",
          [partner],
        );
        await p.query(
          "insert into inventory_items(id,user_id,workspace_id,location_id,card_name,sku,quantity,asking_price) values('ops-stock',$1,$2,'partner-case','Partner stock','PARTNER-STOCK',2,1)",
          [partner, workspace],
        );
        await command(p, "join_site", {
          siteId: setup.siteId,
          locationId: "partner-case",
        });
        await assert.rejects(
          command(staff, "checkout", {
            ...sell(),
            lines: [{ ownerId: partner, itemId: "ops-stock", quantity: 1 }],
          }),
          /POS_FORBIDDEN/,
        );
        await command(p, "grant", {
          siteId: setup.siteId,
          employeeId: other,
          capabilities: ["sell"],
        });
        const mixed = await command(staff, "checkout", {
          ...sell(),
          expectedMinor: 218,
          lines: [
            { ownerId: partner, itemId: "ops-stock", quantity: 1 },
            { ownerId: owner, itemId: "ops-stock", quantity: 1 },
          ],
        });
        const rows = (
          await admin.query(
            "select inventory_user_id,inventory_item_id from pos_sale_items where sale_id=$1 order by inventory_user_id",
            [mixed.saleId],
          )
        ).rows;
        assert.equal(rows.length, 2);
        assert.deepEqual(
          rows.map((x) => x.inventory_user_id).sort(),
          [owner, partner].sort(),
        );
        const events = (
          await admin.query(
            "select user_id,metadata from inventory_events where related_entity_id=$1",
            [mixed.saleId],
          )
        ).rows;
        assert.equal(events.length, 2);
        assert.ok(events.every((e) => e.metadata.actor_id === other));
      } finally {
        await p.end();
      }
    },
  );
  await check(
    "cashier discount needs real manager approval bound to exact intent",
    async () => {
      const payload = {
        ...sell(),
        discountReason: "Manager review",
        expectedMinor: 54,
        lines: [
          {
            ownerId: owner,
            itemId: "ops-stock",
            quantity: 1,
            discountBps: 5000,
          },
        ],
      };
      await assert.rejects(
        command(staff, "checkout", payload),
        /POS_APPROVAL_REQUIRED/,
      );
      const requested = await command(staff, "request_approval", {
        siteId: setup.siteId,
        operation: "checkout",
        intent: payload,
        reason: "Markdown requested",
      });
      await assert.rejects(
        command(staff, "approve", { siteId: setup.siteId, id: requested.id }),
        /POS_FORBIDDEN/,
      );
      await command(a, "approve", { siteId: setup.siteId, id: requested.id });
      await assert.rejects(
        command(staff, "checkout", {
          ...payload,
          approvalId: requested.id,
          cashMinor: 9999,
        }),
        /POS_APPROVAL_REQUIRED/,
      );
      const done = await command(staff, "checkout", {
        ...payload,
        approvalId: requested.id,
      });
      assert.equal(done.receipt.actorId, other);
      const decision = (
        await admin.query(
          "select approved_by from pos_approval_decisions where request_id=$1",
          [requested.id],
        )
      ).rows[0];
      assert.equal(decision.approved_by, owner);
      await assert.rejects(
        command(staff, "daily", { siteId: setup.siteId }),
        /POS_FORBIDDEN/,
      );
    },
  );
  await check(
    "approval rejects changed original price even when override preserves total",
    async () => {
      const payload = {
        ...sell(),
        discountReason: "Fixed price review",
        lines: [
          {
            ownerId: owner,
            itemId: "ops-stock",
            quantity: 1,
            overrideMinor: 100,
          },
        ],
      };
      const requested = await command(staff, "request_approval", {
        siteId: setup.siteId,
        operation: "checkout",
        intent: payload,
        reason: "Override review",
      });
      await command(a, "approve", { siteId: setup.siteId, id: requested.id });
      await a.query(
        "update inventory_items set asking_price=2 where user_id=$1 and id='ops-stock'",
        [owner],
      );
      try {
        await assert.rejects(
          command(staff, "checkout", { ...payload, approvalId: requested.id }),
          /POS_APPROVAL_REQUIRED/,
        );
      } finally {
        await a.query(
          "update inventory_items set asking_price=1 where user_id=$1 and id='ops-stock'",
          [owner],
        );
      }
    },
  );
  await check(
    "sell delegation does not imply refund capability; delegated refund retains owner and actor",
    async () => {
      const completed = await command(staff, "checkout", sell());
      const detail = await command(staff, "receipt", {
        saleId: completed.saleId,
      });
      const payload = {
        saleId: completed.saleId,
        sessionId: session.id,
        expectedMinor: 109,
        reason: "Return test",
        lines: [
          {
            saleItemId: detail.items[0].id,
            quantity: 1,
            returnInventory: true,
          },
        ],
      };
      await assert.rejects(command(staff, "refund", payload), /POS_FORBIDDEN/);
      await command(a, "staff_permissions", {
        employeeId: other,
        permissions: { "pos.refund": true },
      });
      const returned = await command(staff, "refund", payload);
      assert.equal(returned.totalMinor, 109);
      const event = (
        await admin.query(
          "select user_id,metadata from inventory_events where related_entity_type='pos_refund' and related_entity_id=$1",
          [returned.id],
        )
      ).rows[0];
      assert.equal(event.user_id, owner);
      assert.equal(event.metadata.actor_id, other);
      const restored=(await admin.query("select user_id,workspace_id from inventory_items where user_id=$1 and id='ops-stock'",[owner])).rows[0];
      assert.equal(restored.user_id,owner);
      assert.equal(restored.workspace_id,workspace);
    },
  );
  await check(
    "expired and revoked grants reject refunds despite current POS permission",
    async () => {
      const completed = await command(staff, "checkout", sell());
      const detail = await command(staff, "receipt", {
        saleId: completed.saleId,
      });
      const payload = {
        saleId: completed.saleId,
        sessionId: session.id,
        expectedMinor: 109,
        reason: "Expired authorization",
        lines: [
          {
            saleItemId: detail.items[0].id,
            quantity: 1,
            returnInventory: false,
          },
        ],
      };
      const expired = await command(a, "grant", {
        siteId: setup.siteId,
        employeeId: other,
        capabilities: ["sell", "return"],
        validUntil: "2000-01-01T00:00:00Z",
      });
      await assert.rejects(command(staff, "refund", payload), /POS_FORBIDDEN/);
      await command(a, "revoke", { id: expired.id });
      await assert.rejects(command(staff, "refund", payload), /POS_FORBIDDEN/);
      await command(a, "grant", {
        siteId: setup.siteId,
        employeeId: other,
        capabilities: ["sell", "return"],
      });
    },
  );
  await check(
    "changed condition blocks automatic restock with atomic cash rollback",
    async () => {
      const completed = await command(a, "checkout", sell());
      const detail = await command(a, "receipt", { saleId: completed.saleId });
      await a.query(
        "update inventory_items set data=jsonb_build_object('condition','Damaged') where user_id=$1 and id='ops-stock'",
        [owner],
      );
      const before = await expected();
      await assert.rejects(
        command(a, "refund", {
          saleId: completed.saleId,
          sessionId: session.id,
          expectedMinor: 109,
          reason: "Changed condition",
          lines: [
            {
              saleItemId: detail.items[0].id,
              quantity: 1,
              returnInventory: true,
            },
          ],
        }),
        /POS_PROVENANCE_CONFLICT/,
      );
      assert.equal(await expected(), before);
      await a.query(
        "update inventory_items set data='{}' where user_id=$1 and id='ops-stock'",
        [owner],
      );
    },
  );
  await check("refund and close serialize on processing session", async () => {
    const completed = await command(a, "checkout", sell());
    const detail = await command(a, "receipt", { saleId: completed.saleId });
    const before = await expected();
    const pair = await Promise.allSettled([
      command(a, "refund", {
        saleId: completed.saleId,
        sessionId: session.id,
        expectedMinor: 109,
        reason: "Refund-close race",
        lines: [
          {
            saleItemId: detail.items[0].id,
            quantity: 1,
            returnInventory: false,
          },
        ],
      }),
      command(b, "close", {
        registerId: register.id,
        sessionId: session.id,
        countedMinor: before,
        reason: "Concurrent refund review",
      }),
    ]);
    assert.equal(pair[1].status, "fulfilled");
    assert.equal(Number(pair[1].value.expected_minor), await expected());
    assert.equal(
      await expected(),
      before - (pair[0].status === "fulfilled" ? 109 : 0),
    );
  });
  session = await command(a, "open", {
    registerId: register.id,
    openingMinor: 10000,
  });
  await check(
    "blind count and variance threshold require independent manager decision",
    async () => {
      const currentSite = (await command(a, "bootstrap")).sites.find(
        (s) => s.id === setup.siteId,
      );
      await command(a, "settings", {
        siteId: setup.siteId,
        timezone: "America/Phoenix",
        settings: {
          ...currentSite.settings,
          blindClose: true,
          noteThresholdMinor: 100,
          approvalThresholdMinor: 500,
        },
      });
      const close = {
        registerId: register.id,
        sessionId: session.id,
        countedMinor: 9000,
        reason: "Short after recount",
      };
      const begin = await command(staff, "begin_close", {
        registerId: register.id,
        sessionId: session.id,
      });
      assert.equal(begin.expectedMinor, null);
      await assert.rejects(
        command(staff, "close", close),
        /POS_APPROVAL_REQUIRED/,
      );
      const req = await command(staff, "request_approval", {
        siteId: setup.siteId,
        operation: "close",
        intent: close,
        reason: close.reason,
      });
      await command(a, "approve", { siteId: setup.siteId, id: req.id });
      const closed = await command(staff, "close", {
        ...close,
        approvalId: req.id,
      });
      assert.equal(Number(closed.variance_minor), -1000);
      assert.equal(closed.closed_by, other);
      await command(a, "settings", {
        siteId: setup.siteId,
        timezone: "America/Phoenix",
        settings: currentSite.settings,
      });
    },
  );
  session = await command(a, "open", {
    registerId: register.id,
    openingMinor: 0,
  });
  await command(a, "close", { registerId: register.id, sessionId: session.id });
  await admin.query(
    "delete from workspace_members where workspace_id=$1 and user_id=$2",
    [workspace, other],
  );
}

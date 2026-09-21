import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Audit regression only: exercise the accepted owner-only architecture, without
// changing its production authorization functions or grants.
export async function verifyStaffingBoundary({
  admin,
  staff,
  ownerClient,
  owner,
  other,
  workspace,
  setup,
  request,
  command,
  check,
  extended = false,
}) {
  await admin.query("insert into workspace_members values($1,$2,'employee')", [
    workspace,
    other,
  ]);
  try {
    if (!extended) {
      await check(
        "invited employee role cannot currently enter POS",
        async () => {
          await assert.rejects(command(staff, "bootstrap"), /POS_FORBIDDEN/);
        },
      );
      await admin.query(
        "update workspace_members set role='manager' where workspace_id=$1 and user_id=$2",
        [workspace, other],
      );
      await check(
        "same-workspace manager cannot operate another inventory owner register",
        async () => {
          const bootstrap = await command(staff, "bootstrap");
          assert.deepEqual(bootstrap.sites, []);
          assert.deepEqual(bootstrap.registers, []);
          await assert.rejects(
            command(staff, "open", { registerId: setup.registerId }),
            /POS_FORBIDDEN/,
          );
          await assert.rejects(
            command(staff, "checkout", request()),
            /POS_FORBIDDEN/,
          );
        },
      );
      await check(
        "canonical trigger rejects foreign-owner mutation even with SQL RLS bypass",
        async () => {
          const before = (
            await admin.query(
              "select quantity from inventory_items where user_id=$1 and id='bolt'",
              [owner],
            )
          ).rows[0].quantity;
          // The privileged local fixture connection isolates the trigger from RLS.
          // Its auth.uid() remains the real manager, as in a SECURITY DEFINER RPC.
          await admin.query("begin");
          try {
            await admin.query(
              "select set_config('request.jwt.claim.sub',$1,true)",
              [other],
            );
            // The existing service fallback cannot override an authenticated actor.
            await admin.query(
              "select set_config('app.collector_authorized_user_id',$1,true)",
              [owner],
            );
            await assert.rejects(
              admin.query(
                "update inventory_items set quantity=quantity-1 where user_id=$1 and id='bolt'",
                [owner],
              ),
              /TD_COLLECTOR_UNAUTHORIZED/,
            );
          } finally {
            await admin.query("rollback");
          }
          assert.equal(
            (
              await admin.query(
                "select quantity from inventory_items where user_id=$1 and id='bolt'",
                [owner],
              )
            ).rows[0].quantity,
            before,
          );
          assert.equal(
            (await admin.query("select count(*)::int n from pos_sales")).rows[0]
              .n,
            0,
          );
        },
      );
      return;
    }
    await admin.query(
      "insert into workspace_employees(workspace_id,linked_user_id,employment_status) values($1,$2,'active')",
      [workspace, other],
    );
    await admin.query(
      "update workspace_members set role='member' where workspace_id=$1 and user_id=$2",
      [workspace, other],
    );
    await ownerClient.query(
      "insert into inventory_items(id,user_id,workspace_id,location_id,card_name,sku,quantity,asking_price) values('delegated',$1,$2,'case','Delegated card','DELEGATED',4,1)",
      [owner, workspace],
    );
    let grant;
    await check(
      "owner grants inventory scope without granting employee checkout permission",
      async () => {
        grant = await command(ownerClient, "grant", {
          siteId: setup.siteId,
          employeeId: other,
          capabilities: ["sell"],
        });
        assert.equal(grant.inventory_user_id, owner);
        await assert.rejects(
          command(staff, "search", {
            siteId: setup.siteId,
            query: "DELEGATED",
            exact: true,
          }),
          /POS_FORBIDDEN/,
        );
        await command(ownerClient, "staff_permissions", {
          employeeId: other,
          permissions: { "pos.sell": true },
        });
      },
    );
    await check(
      "delegated employee sells owner stock with separate authenticated attribution",
      async () => {
        const rows = await command(staff, "search", {
          siteId: setup.siteId,
          query: "DELEGATED",
          exact: true,
        });
        assert.equal(rows[0].ownerId, owner);
        const sale = await command(staff, "checkout", {
          ...request(),
          expectedMinor: 109,
          lines: [{ itemId: "delegated", ownerId: owner, quantity: 1 }],
        });
        assert.equal(sale.receipt.actorId, other);
        assert.equal(sale.receipt.lines[0].ownerId, owner);
        assert.equal(sale.receipt.lines[0].costBasis, undefined);
        assert.equal(
          (
            await admin.query(
              "select quantity from inventory_items where user_id=$1 and id='delegated'",
              [owner],
            )
          ).rows[0].quantity,
          3,
        );
        const event = (
          await admin.query(
            "select user_id,metadata from inventory_events where related_entity_id=$1",
            [sale.saleId],
          )
        ).rows[0];
        assert.equal(event.user_id, owner);
        assert.equal(event.metadata.actor_id, other);
      },
    );
    await check(
      "employee cannot self-grant, widen scope or write private permits",
      async () => {
        await assert.rejects(
          command(staff, "grant", {
            siteId: setup.siteId,
            employeeId: other,
            capabilities: ["sell", "return"],
          }),
          /POS_FORBIDDEN/,
        );
        await assert.rejects(
          staff.query("select * from pos_inventory_delegations"),
          /permission denied/,
        );
        await assert.rejects(
          staff.query("select * from pos_private.stock_permits"),
          /permission denied/,
        );
        await assert.rejects(
          staff
            .query(
              "update inventory_items set quantity=0 where user_id=$1 and id='delegated' returning id",
              [owner],
            )
            .then((r) => {
              if (!r.rowCount) throw Error("DENIED");
            }),
          /DENIED|permission denied|TD_COLLECTOR_UNAUTHORIZED/,
        );
        assert.equal(
          (
            await admin.query(
              "select count(*)::int n from pos_private.stock_permits",
            )
          ).rows[0].n,
          0,
        );
      },
    );
    await check(
      "revocation denies a previously scanned cart and retains grant history",
      async () => {
        await command(ownerClient, "revoke", { id: grant.id });
        await assert.rejects(
          command(staff, "checkout", {
            ...request(),
            expectedMinor: 109,
            lines: [{ itemId: "delegated", ownerId: owner, quantity: 1 }],
          }),
          /POS_FORBIDDEN/,
        );
        const record = (
          await admin.query(
            "select * from pos_inventory_delegations where id=$1",
            [grant.id],
          )
        ).rows[0];
        assert.equal(record.revoked_by, owner);
        assert.ok(record.revoked_at);
        assert.equal(
          (
            await admin.query(
              "select count(*)::int n from pos_access_events where snapshot->>'id'=$1",
              [grant.id],
            )
          ).rows[0].n,
          2,
        );
      },
    );
    grant = await command(ownerClient, "grant", {
      siteId: setup.siteId,
      employeeId: other,
      capabilities: ["sell"],
    });
    await check(
      "site grant cannot read or sell stock mapped to another site",
      async () => {
        await ownerClient.query(
          "insert into inventory_locations(id,user_id,name) values('staff-other-site',$1,'Other store case')",
          [owner],
        );
        const elsewhere = await command(ownerClient, "setup", {
          name: "Scottsdale",
          registerName: "Remote",
          locationId: "staff-other-site",
          taxBps: 0,
        });
        await ownerClient.query(
          "insert into inventory_items(id,user_id,workspace_id,location_id,card_name,sku,quantity,asking_price) values('remote-card',$1,$2,'staff-other-site','Remote card','REMOTE-CARD',2,1)",
          [owner, workspace],
        );
        const target = (
          await ownerClient.query(
            "select public.label_targets($1,$2,null,'',true) result",
            [workspace, ["remote-card"]],
          )
        ).rows[0].result[0];
        await assert.rejects(
          command(staff, "search", {
            siteId: elsewhere.siteId,
            query: "REMOTE-CARD",
            exact: true,
          }),
          /POS_FORBIDDEN/,
        );
        await assert.rejects(
          command(staff, "search", {
            siteId: setup.siteId,
            query: target.sku,
            exact: true,
          }),
          /POS_BARCODE_INACTIVE/,
        );
        await assert.rejects(
          command(staff, "checkout", {
            ...request(),
            expectedMinor: 109,
            lines: [{ itemId: "remote-card", ownerId: owner, quantity: 1 }],
          }),
          /POS_STOCK_UNAVAILABLE/,
        );
        assert.deepEqual(
          await command(staff, "search", {
            siteId: setup.siteId,
            query: "Remote",
          }),
          [],
        );
      },
    );
    await check(
      "delegated exact-position scan and sale preserve owner batch provenance",
      async () => {
        const batch = randomUUID();
        await admin.query(
          "insert into chaos_sort_batches(id,user_id,batch_code,current_quantity,initial_quantity) values($1,$2,'STAFF',2,2)",
          [batch, owner],
        );
        await ownerClient.query(
          "insert into chaos_sort_inventory_positions(id,user_id,batch_id,item_id,quantity,location_id) values('staff-position',$1,$2,'delegated',2,'case')",
          [owner, batch],
        );
        const target = (
          await ownerClient.query(
            "select public.label_targets($1,$2,null,'',true) result",
            [workspace, ["position:staff-position"]],
          )
        ).rows[0].result[0];
        const resolved = await command(staff, "search", {
          siteId: setup.siteId,
          query: target.sku,
          exact: true,
        });
        assert.equal(resolved[0].positionId, "staff-position");
        const sale = await command(staff, "checkout", {
          ...request(),
          expectedMinor: 109,
          lines: [
            {
              itemId: "delegated",
              ownerId: owner,
              positionId: "staff-position",
              quantity: 1,
            },
          ],
        });
        const allocation = (
          await admin.query(
            "select * from pos_sale_allocations where sale_id=$1",
            [sale.saleId],
          )
        ).rows[0];
        assert.equal(allocation.inventory_user_id, owner);
        assert.equal(allocation.position_id, "staff-position");
      },
    );
    await check(
      "revocation transaction wins before blocked checkout authorization",
      async () => {
        await ownerClient.query("begin");
        let attempt;
        try {
          await command(ownerClient, "revoke", { id: grant.id });
          attempt = command(staff, "checkout", {
            ...request(),
            expectedMinor: 109,
            lines: [{ itemId: "delegated", ownerId: owner, quantity: 1 }],
          }).then(
            (value) => ({ value }),
            (error) => ({ error }),
          );
          // Wait for the actual advisory-lock wait, rather than assuming timing.
          let blocked = false;
          for (let i = 0; i < 50; i++) {
            blocked = (
              await admin.query(
                "select exists(select 1 from pg_stat_activity where wait_event_type='Lock' and query like '%public.pos_command%') yes",
              )
            ).rows[0].yes;
            if (blocked) break;
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          assert.equal(blocked, true);
          await ownerClient.query("commit");
          const result = await attempt;
          assert.match(result.error?.message ?? "", /POS_FORBIDDEN/);
        } finally {
          await ownerClient.query("rollback");
          if (attempt) await attempt;
        }
      },
    );
    await check(
      "grant history and canonical stock permissions remain immutable",
      async () => {
        await assert.rejects(
          admin.query("delete from pos_inventory_delegations where id=$1", [
            grant.id,
          ]),
          /POS_IMMUTABLE/,
        );
        await assert.rejects(
          admin.query("update pos_access_events set action='changed'"),
          /POS_IMMUTABLE/,
        );
        await assert.rejects(
          command(staff, "search", {
            siteId: setup.siteId,
            query: "DELEGATED",
            exact: true,
          }),
          /POS_FORBIDDEN/,
        );
      },
    );
  } finally {
    await admin.query(
      "delete from workspace_members where workspace_id=$1 and user_id=$2",
      [workspace, other],
    );
  }
}

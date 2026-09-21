import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export async function verifyLabels({
  admin,
  a,
  stranger,
  command,
  workspace,
  otherWorkspace,
  owner,
  other,
  check,
}) {
  const batch = randomUUID();
  await a.query(
    `insert into inventory_items(id,user_id,workspace_id,location_id,card_name,sku,quantity,asking_price,data) values('label-card',$1,$2,'case','Charizard ex','CARD-TEST',4,18.99,'{"condition":"NM","finish":"Holo","language":"EN"}'),('label-ambiguous-a',$1,$2,'case','A','AMB-A',1,1,'{}'),('label-ambiguous-b',$1,$2,'case','B','AMB-B',1,1,'{}')`,
    [owner, workspace],
  );
  await admin.query(
    `insert into chaos_sort_batches(id,user_id,batch_code,status,current_quantity,initial_quantity) values($1,$2,'LABEL-1042','committed',4,4)`,
    [batch, owner],
  );
  await a.query(
    `insert into chaos_sort_inventory_positions(id,user_id,batch_id,item_id,quantity,location_id) values('label-p1',$1,$2,'label-card',2,'case'),('label-p2',$1,$2,'label-card',2,'case')`,
    [owner, batch],
  );
  const targets = async (
    ids = ["label-card"],
    issue = true,
    c = a,
    w = workspace,
  ) =>
    (
      await c.query("select label_targets($1,$2,null,'',$3) result", [
        w,
        ids,
        issue,
      ])
    ).rows[0].result;
  const site = (await command(a, "bootstrap")).sites[0];
  const reg = (await command(a, "bootstrap")).registers.find(
    (r) => r.site_id === site.id,
  );
  const session = await command(a, "open", { registerId: reg.id });
  const scan = (code) =>
    command(a, "search", { siteId: site.id, query: code, exact: true });
  const rows = await targets();
  await check(
    "labels bind separate stable identities to actual positions",
    async () => {
      assert.equal(rows.length, 2);
    assert.equal(rows[0].key,"position:label-p1");
    assert.equal((await targets([rows[0].key]))[0].positionId,"label-p1");
      assert.notEqual(rows[0].sku, rows[1].sku);
      assert.deepEqual(
        (await targets()).map((r) => r.sku),
        rows.map((r) => r.sku),
      );
      assert.equal(
        (await scan(rows[0].sku.toLowerCase()))[0].positionId,
        "label-p1",
      );
    },
  );
  await check(
    "label identity survives price and metadata changes",
    async () => {
      await a.query(
        "update inventory_items set asking_price=19.99,data=data||'{\"condition\":\"LP\"}' where id='label-card'",
      );
      const found = (await scan(rows[0].sku))[0];
      assert.equal(found.unit_price_minor, 1999);
      assert.equal(found.condition, "LP");
      assert.equal((await targets())[0].sku, rows[0].sku);
    },
  );
  await check(
    "external alias resolves exact position and cannot be retargeted",
    async () => {
      await a.query("select assign_label_barcode($1,$2,$3,$4)", [
        workspace,
        rows[0].identityId,
        "012345678901",
        "upc_ean",
      ]);
      assert.equal((await scan("012345678901"))[0].positionId, "label-p1");
      await assert.rejects(
        a.query("select assign_label_barcode($1,$2,$3,$4)", [
          workspace,
          rows[1].identityId,
          "012345678901",
          "upc_ean",
        ]),
        /POS_BARCODE_AMBIGUOUS/,
      );
    },
  );
  await check(
    "ambiguous legacy UPC never returns a sale candidate",
    async () => {
      await a.query(
        "update inventory_items set upc='999999999999' where id like 'label-ambiguous-%'",
      );
      await assert.rejects(scan("999999999999"), /POS_BARCODE_AMBIGUOUS/);
      assert.deepEqual(await scan("UNKNOWN-LABEL-XYZ"), []);
    },
  );
  await check("inactive aliases fail closed", async () => {
    await a.query("select assign_label_barcode($1,$2,$3,$4,false)", [
      workspace,
      rows[0].identityId,
      "012345678901",
      "upc_ean",
    ]);
    await assert.rejects(scan("012345678901"), /POS_BARCODE_INACTIVE/);
    await a.query("select assign_label_barcode($1,$2,$3,$4,true)", [
      workspace,
      rows[0].identityId,
      "012345678901",
      "upc_ean",
    ]);
  });
  await check(
    "cashier may issue own labels but cannot assign aliases",
    async () => {
      // This identity was linked as an employee by the suspension regression.
      // A hosted member-role cashier now needs explicit selling permission.
      await admin.query("update workspace_employees set permissions=permissions||'{\"pos.sell\":true}'::jsonb where workspace_id=$1 and linked_user_id=$2", [workspace, owner]);
      await admin.query(
        "update workspace_members set role='member' where user_id=$1",
        [owner],
      );
      assert.equal((await targets()).length, 2);
      await assert.rejects(
        a.query("select assign_label_barcode($1,$2,$3,$4)", [
          workspace,
          rows[0].identityId,
          "CASHIER",
          "sku",
        ]),
        /POS_FORBIDDEN/,
      );
      await admin.query(
        "update workspace_members set role='owner' where user_id=$1",
        [owner],
      );
    },
  );
  await check(
    "label targets and aliases cannot cross workspace or inventory owner",
    async () => {
      await assert.rejects(
        targets(["label-card"], true, stranger, workspace),
        /POS_FORBIDDEN/,
      );
      assert.deepEqual(
        await targets(["label-card"], true, stranger, otherWorkspace),
        [],
      );
      await admin.query(
        "insert into workspace_members values($1,$2,'manager')",
        [workspace, other],
      );
      assert.deepEqual(
        await targets(["label-card"], true, stranger, workspace),
        [],
      );
      await assert.rejects(
        stranger.query("select assign_label_barcode($1,$2,$3,$4)", [
          workspace,
          rows[0].identityId,
          "OTHER",
          "sku",
        ]),
        /POS_FORBIDDEN/,
      );
      await admin.query(
        "delete from workspace_members where workspace_id=$1 and user_id=$2",
        [workspace, other],
      );
    },
  );
  await check(
    "internal printed identity is immutable through direct SQL",
    async () => {
      await assert.rejects(
        a.query(
          "update inventory_label_identities set inventory_position_id='label-p2' where id=$1",
          [rows[0].identityId],
        ),
        /LABEL_IMMUTABLE/,
      );
      await assert.rejects(
        a.query("delete from inventory_label_identities where id=$1", [
          rows[0].identityId,
        ]),
        /permission denied/,
      );
    },
  );
  await check(
    "internal barcode uniqueness is enforced by the database",
    async () => {
      await assert.rejects(
        a.query(
          "insert into inventory_label_identities(workspace_id,inventory_user_id,inventory_item_id,target_type,sku,qr_token) values($1,$2,'label-ambiguous-b','single',$3,'')",
          [workspace, owner, rows[0].sku],
        ),
        /duplicate key/,
      );
    },
  );
  await check("anonymous label RPC execution is denied", async () => {
    await admin.query("set role anon");
    try {
      await assert.rejects(
        admin.query("select label_targets($1)", [workspace]),
        /permission denied/,
      );
      await assert.rejects(
        admin.query("select label_locations($1)", [workspace]),
        /permission denied/,
      );
      await assert.rejects(
        admin.query("select * from label_templates"),
        /permission denied/,
      );
    } finally {
      await admin.query("reset role");
    }
  });
  await check(
    "moves and batch renames retain barcode identity and resolve current location",
    async () => {
      await admin.query(
        "insert into pos_location_inventory_locations(workspace_id,site_id,inventory_user_id,location_id) values($1,$2,$3,'spare') on conflict do nothing",
        [workspace, site.id, owner],
      );
      await a.query("begin");
      try {
        await a.query(
          "update inventory_items set location_id='spare' where id='label-card'",
        );
        await a.query(
          "update chaos_sort_inventory_positions set location_id='spare' where item_id='label-card'",
        );
        await a.query("commit");
      } catch (error) {
        await a.query("rollback");
        throw error;
      }
      await admin.query(
        "update chaos_sort_batches set batch_code='LABEL-RENAMED' where id=$1",
        [batch],
      );
      assert.equal((await scan(rows[0].sku))[0].location, "Spare");
      assert.equal((await targets())[0].sku, rows[0].sku);
      await a.query("begin");
      await a.query(
        "update inventory_items set location_id='case' where id='label-card'",
      );
      await a.query(
        "update chaos_sort_inventory_positions set location_id='case' where item_id='label-card'",
      );
      await a.query("commit");
    },
  );
  await check(
    "two exact positions of one item sell atomically without merging provenance",
    async () => {
      const body = {
        key: randomUUID(),
        siteId: site.id,
        sessionId: session.id,
        expectedMinor: 4338,
        cashMinor: 5000,
        lines: rows.map((r) => ({
          itemId: r.itemId,
          positionId: r.positionId,
          quantity: 1,
          discountBps: 0,
        })),
      };
      const sale = await command(a, "checkout", body);
      assert.equal(sale.receipt.lines.length, 2);
      assert.equal((await command(a, "checkout", body)).saleId, sale.saleId);
      assert.deepEqual(
        (
          await admin.query(
            "select quantity from chaos_sort_inventory_positions where item_id='label-card' order by id",
          )
        ).rows.map((r) => r.quantity),
        [1, 1],
      );
      assert.equal(
        (
          await admin.query(
            "select count(*)::int n from inventory_events where inventory_item_id='label-card'",
          )
        ).rows[0].n,
        2,
      );
      for (const event of (
        await admin.query(
          "select metadata from inventory_events where inventory_item_id='label-card'",
        )
      ).rows)
        assert.equal(
          event.metadata.allocations.reduce((n, a) => n + a.quantity, 0),
          1,
        );
    },
  );
  await check("wrong label target class is rejected", async () => {
    await a.query(
      "update inventory_label_identities set target_type='storage' where id=$1",
      [rows[1].identityId],
    );
    await assert.rejects(scan(rows[1].sku), /POS_BARCODE_WRONG_CLASS/);
    await a.query(
      "update inventory_label_identities set target_type='single' where id=$1",
      [rows[1].identityId],
    );
  });
  await check(
    "deleted positions cannot silently reuse a printed identity",
    async () => {
      await a.query(
        "delete from chaos_sort_inventory_positions where id='label-p2'",
      );
      await assert.rejects(scan(rows[1].sku), /POS_BARCODE_INACTIVE/);
    },
  );
  await check(
    "deleted item labels remain recognizable as inactive",
    async () => {
      const id = (await targets(["label-ambiguous-a"]))[0];
      await a.query("delete from inventory_items where id='label-ambiguous-a'");
    await assert.rejects(scan(id.sku), /POS_BARCODE_INACTIVE/);
    await assert.rejects(a.query("insert into inventory_label_identities(workspace_id,inventory_user_id,inventory_item_id,target_type,sku,qr_token) values($1,$2,'label-ambiguous-b','single','',$3)",[workspace,owner,id.qrToken]),/LABEL_IMMUTABLE/);
    await assert.rejects(a.query('select assign_label_barcode($1,$2,$3,$4)',[workspace,rows[0].identityId,id.qrToken,'external']),/POS_BARCODE_INACTIVE/);
    },
  );
  await check(
    "label aliases are inaccessible through direct table access",
    async () => {
      await assert.rejects(
        a.query("select * from inventory_barcode_aliases"),
        /permission denied/,
      );
    },
  );
  await check(
    "real location identity is stable and never sellable",
    async () => {
      const loc = (
        await a.query("select label_locations($1,$2,true) result", [
          workspace,
          ["case"],
        ])
      ).rows[0].result[0];
      assert.ok(loc.sku);
      await assert.rejects(scan(loc.sku), /POS_BARCODE_WRONG_CLASS/);
      const again = (
        await a.query("select label_locations($1,$2,true) result", [
          workspace,
          ["case"],
        ])
      ).rows[0].result[0];
      assert.equal(again.sku, loc.sku);
    },
  );
  await check(
    "template RLS isolates tenants and suspended employees",
    async () => {
      const t = (
        await a.query(
          `insert into label_templates(workspace_id,name,category,width,height,unit,orientation,template_data) values($1,'Exact mm','single',57.150123,31.750321,'mm','landscape','{"print":{"mode":"roll"}}') returning id,width,height`,
          [workspace],
        )
      ).rows[0];
      assert.equal(Number(t.width), 57.150123);
      assert.equal(Number(t.height), 31.750321);
      assert.equal(
        (
          await stranger.query("select * from label_templates where id=$1", [
            t.id,
          ])
        ).rowCount,
        0,
      );
      await a.query("select set_default_label_template($1,$2)", [
        workspace,
        t.id,
      ]);
      assert.equal(
        (
          await a.query(
            "select template_data from label_templates where id=$1",
            [t.id],
          )
        ).rows[0].template_data.isDefault,
        true,
      );
      await admin.query(
        "update workspace_employees set employment_status='inactive' where linked_user_id=$1",
        [owner],
      );
      assert.equal(
        (await a.query("select * from label_templates where id=$1", [t.id]))
          .rowCount,
        0,
      );
      await assert.rejects(targets(), /POS_FORBIDDEN/);
      await admin.query(
        "update workspace_employees set employment_status='active' where linked_user_id=$1",
        [owner],
      );
    },
  );
  await check(
    "sealed product UPC printing falls back to its internal code if UPC becomes ambiguous",
    async () => {
      await a.query(
        "insert into inventory_items(id,user_id,workspace_id,location_id,card_name,sku,quantity,asking_price,item_kind,upc) values('label-sealed',$1,$2,'case','Sealed product','ETB',2,54.99,'sealed','036000291452')",
        [owner, workspace],
      );
      const product = (await targets(["label-sealed"]))[0];
      assert.equal(product.positionId, null);
      assert.equal(product.upc, "036000291452");
      assert.equal((await scan(product.upc))[0].id, "label-sealed");
      await a.query(
        "update inventory_items set upc='036000291452' where id='label-ambiguous-b'",
      );
      assert.equal((await targets(["label-sealed"]))[0].upc, null);
      assert.equal((await scan(product.sku))[0].id, "label-sealed");
    },
  );
  await command(a, "close", { registerId: reg.id });
}

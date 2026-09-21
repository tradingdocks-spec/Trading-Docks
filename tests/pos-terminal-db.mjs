import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { TerminalEmulator } from "./square-terminal-emulator.mjs";
import { SquareAccounts } from "../src/lib/pos/payments/square/service.ts";
import { SquareHttp } from "../src/lib/pos/payments/square/http.ts";
import { SquarePaymentProvider } from "../src/lib/pos/payments/square/provider.ts";
import { PaymentOrchestrator } from "../src/lib/pos/payments/orchestrator.ts";
import {
  terminalPair,
  TERMINAL_SCOPES,
} from "../src/lib/pos/payments/square/terminal.ts";
import { squareWebhook } from "../src/lib/pos/payments/square/webhook.ts";
export async function verifyTerminal({
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
  const service = async (action, body) =>
    (
      await admin.query("select public.pos_square_service($1,$2) result", [
        action,
        body,
      ])
    ).rows[0].result;
  const hardware = async (action, body = {}, client = a) =>
    (
      await client.query(
        "select public.pos_terminal_devices($1,$2,$3) result",
        [workspace, action, body],
      )
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
  const config = {
    environment: "SANDBOX",
    applicationId: "sandbox-test",
    applicationSecret: "test",
    redirectUrl: "https://test.example/callback",
    notificationUrl: "https://test.example/hook",
    webhookKey: "test",
  };
  const em = new TerminalEmulator(),
    accounts = new SquareAccounts(service, config, new SquareHttp(em.fetch));
  const providerFactory = (pay) => ({
    SQUARE: new SquarePaymentProvider(pay, accounts, workspace, owner, "test"),
  });
  const pay = store(a),
    engine = new PaymentOrchestrator(pay, "test", providerFactory(pay));
  const connection = (
    await admin.query(
      "select * from pos_private.square_connections where workspace_id=$1 and status='CONNECTED'",
      [workspace],
    )
  ).rows[0];
  const reg = await command(a, "configure_register", {
    siteId: setup.siteId,
    name: "Terminal test register",
  });
  const session = await command(a, "open", {
    registerId: reg.id,
    openingMinor: 10000,
  });
  const d = { id: randomUUID(), name: "Front Terminal", siteId: setup.siteId };
  const req = () => ({
    key: randomUUID(),
    provider: "SQUARE",
    method: "square_terminal",
    intent: {
      key: randomUUID(),
      siteId: setup.siteId,
      sessionId: session.id,
      expectedMinor: 217,
      lines: [{ ownerId: owner, itemId: "square-stock", quantity: 2 }],
    },
  });
  const hook = async (
    type,
    resourceId,
    payload = {},
    eventId = randomUUID(),
    merchantId = connection.merchant_id,
  ) => {
    const raw = JSON.stringify({
      event_id: eventId,
      merchant_id: merchantId,
      type,
      data: { id: resourceId, object: payload },
    });
    const sig = createHmac("sha256", config.webhookKey)
      .update(config.notificationUrl + raw)
      .digest("base64");
    await squareWebhook(accounts, Buffer.from(raw), sig);
    return eventId;
  };
  await check(
    "Terminal pairing requires verified scopes, mapped location and owner/admin",
    async () => {
      await assert.rejects(
        terminalPair(accounts, workspace, owner, d, true),
        /SQUARE_TERMINAL_SCOPE/,
      );
      await admin.query(
        "update pos_private.square_connections set authorized_scopes=$2 where id=$1",
        [connection.id, TERMINAL_SCOPES],
      );
      await assert.rejects(
        terminalPair(
          accounts,
          workspace,
          owner,
          { ...d, siteId: randomUUID() },
          true,
        ),
        /UNAVAILABLE/,
      );
      await assert.rejects(
        terminalPair(
          accounts,
          workspace,
          "22222222-2222-4222-8222-222222222222",
          d,
          true,
        ),
        /FORBIDDEN/,
      );
      const code = await terminalPair(accounts, workspace, owner, d, true);
      assert.equal(code.code, "EBCARJ");
      await terminalPair(accounts, workspace, owner, d, true);
      assert.equal(em.codes.size, 1);
      await assert.rejects(
        hardware("rename", { id: d.id, name: "Injected" }, stranger),
        /FORBIDDEN/,
      );
      await assert.rejects(
        a.query("select * from public.pos_payment_devices"),
        /permission denied/,
      );
      await assert.rejects(
        a.query("select public.pos_square_service('terminal_context','{}')"),
        /permission denied/,
      );
    },
  );
  await check(
    "Terminal authoritative polling and duplicate paired webhook store permanent device ID",
    async () => {
      const remote = em.pair(d.id);
      const event = await hook("device.code.paired", d.id, {
        device_code: remote,
      });
      await hook("device.code.paired", d.id, { device_code: remote }, event);
      await terminalPair(accounts, workspace, owner, d);
      const row = (
        await admin.query(
          "select * from public.pos_payment_devices where id=$1",
          [d.id],
        )
      ).rows[0];
      assert.equal(row.provider_device_id, "device-" + d.id);
      assert.notEqual(row.provider_device_id, row.provider_device_code_id);
      assert.equal(
        (
          await admin.query(
            "select count(*) from pos_private.square_hardware_audit where device_id=$1 and action='paired'",
            [d.id],
          )
        ).rows[0].count,
        "1",
      );
      await hardware("assign", { id: d.id, registerId: reg.id });
      await hardware("rename", { id: d.id, name: "Front Terminal" });
      assert.equal(
        (await hardware("get")).devices.find((x) => x.id === d.id).eligible,
        true,
      );
    },
  );
  await check(
    "Terminal expired pairing code hidden; new code has distinct identity",
    async () => {
      const expired = { ...d, id: randomUUID(), name: "Expired" };
      await terminalPair(accounts, workspace, owner, expired, true);
      em.codes.get(expired.id).pair_by = new Date(
        Date.now() - 1000,
      ).toISOString();
      assert.deepEqual(
        await terminalPair(accounts, workspace, owner, expired),
        {},
      );
      assert.equal(
        (await hardware("get")).devices.find((x) => x.id === expired.id)
          .pairingStatus,
        "EXPIRED",
      );
      await assert.rejects(
        hardware("assign", { id: expired.id, registerId: reg.id }),
        /FORBIDDEN/,
      );
    },
  );
  await check(
    "Terminal cross-site assignment, mapping mismatch and duplicate register are denied",
    async () => {
      const site = (
        await admin.query(
          "insert into pos_store_locations(workspace_id,inventory_user_id,name,tax_bps) values($1,$2,'Other Terminal site',0) returning id",
          [workspace, owner],
        )
      ).rows[0];
      const otherReg=(await admin.query("insert into pos_registers(workspace_id,site_id,name) values($1,$2,'Other Terminal register') returning id",[workspace,site.id])).rows[0];
      await assert.rejects(
        hardware("assign", { id: d.id, registerId: otherReg.id }),
        /FORBIDDEN/,
      );
      await admin.query(
        "insert into pos_private.square_locations values($1,'other-active','Other location','ACTIVE',null)",
        [connection.id],
      );
      await admin.query(
        "update pos_private.square_mappings set location_id='other-active' where connection_id=$1 and site_id=$2",
        [connection.id, setup.siteId],
      );
      await assert.rejects(engine.begin(req()), /TERMINAL_UNAVAILABLE/);
      await admin.query(
        "update pos_private.square_mappings set location_id='square-location' where connection_id=$1 and site_id=$2",
        [connection.id, setup.siteId],
      );
      const second = { ...d, id: randomUUID(), name: "Second Terminal" };
      await terminalPair(accounts, workspace, owner, second, true);
      em.pair(second.id);
      await terminalPair(accounts, workspace, owner, second);
      await assert.rejects(
        hardware("assign", { id: second.id, registerId: reg.id }),
        /unique/,
      );
      await hardware("disable", { id: second.id });
    },
  );
  let successful;
  await check(
    "Terminal lost create response, same-key retry, webhook race and original finalizer converge once",
    async () => {
      const request = req();
      const before = (
        await admin.query(
          "select quantity from inventory_items where id='square-stock' and user_id=$1",
          [owner],
        )
      ).rows[0].quantity;
      em.lose = true;
      await assert.rejects(engine.begin(request), /NETWORK_ERROR/);
      const p = await pay("create", request);
      assert.equal(em.checkouts.size, 1);
      await assert.rejects(
        hardware("assign", { id: d.id, registerId: "" }),
        /DEVICE_BUSY/,
      );
      await assert.rejects(
        command(a, "close", { registerId: reg.id }),
        /PAYMENT_ACTIVE/,
      );
      await assert.rejects(engine.begin(req()), /TERMINAL_BUSY/);
      const waiting = await engine.begin(request);
      assert.equal(waiting.status, "AWAITING_CUSTOMER");
      assert.equal(em.checkouts.size, 1);
      em.set(p.id, "COMPLETED");
      const event = await hook("terminal.checkout.updated", p.id, {
        checkout: em.checkouts.get(p.id),
      });
      assert.equal((await pay("get", { id: p.id })).saleState, "PAYING");
      successful = await engine.check(p.id);
      assert.equal(successful.saleState, "COMPLETED");
      assert.equal(successful.metadata.terminalName, "Front Terminal");
      assert.equal(successful.providerReference, "payment-" + p.id);
      await hook(
        "terminal.checkout.updated",
        p.id,
        { checkout: em.checkouts.get(p.id) },
        event,
      );
      await hook("terminal.checkout.created", p.id, {
        checkout: { ...em.checkouts.get(p.id), status: "PENDING" },
      });
      assert.equal((await engine.check(p.id)).saleId, successful.saleId);
      assert.equal(
        (
          await admin.query(
            "select quantity from inventory_items where id='square-stock' and user_id=$1",
            [owner],
          )
        ).rows[0].quantity,
        before - 2,
      );
      assert.equal(
        (
          await admin.query(
            "select count(*) from pos_cash_events where session_id=$1 and kind='CASH_SALE'",
            [session.id],
          )
        ).rows[0].count,
        "0",
      );
    },
  );
  await check("Terminal cashier can use assignment but cannot manage hardware; owner cannot finalize cashier sale",async()=>{
    const employee=randomUUID();await admin.query("insert into auth.users(id) values($1)",[employee]);
    await admin.query("insert into workspace_members values($1,$2,'employee')",[workspace,employee]);
    await admin.query("insert into workspace_employees(workspace_id,linked_user_id,employment_status) values($1,$2,'active')",[workspace,employee]);
    await command(a,'staff_permissions',{employeeId:employee,permissions:{'pos.sell':true}});await command(a,'grant',{siteId:setup.siteId,employeeId:employee,capabilities:['sell']});
    await b.query("select set_config('request.jwt.claim.sub',$1,false)",[employee]);
    try{
      const view=await hardware('get',{},b);assert.equal(view.canManage,false);assert.ok(view.devices.some(v=>v.id===d.id));assert.ok(!JSON.stringify(view).includes('fixture-token'));
      await assert.rejects(hardware('disable',{id:d.id},b),/FORBIDDEN/);
      await assert.rejects(terminalPair(accounts,workspace,employee,{...d,id:randomUUID()},true),/FORBIDDEN/);
      const employeeEngine=new PaymentOrchestrator(store(b),'test',{SQUARE:new SquarePaymentProvider(store(b),accounts,workspace,employee,'test')});
      const attempt=await employeeEngine.begin(req());em.set(attempt.id,'COMPLETED');
      const observed=await engine.check(attempt.id);assert.equal(observed.status,'SUCCEEDED');assert.notEqual(observed.saleState,'COMPLETED');
      const sale=await employeeEngine.check(attempt.id);assert.equal(sale.saleState,'COMPLETED');
      assert.equal((await admin.query('select actor_id from pos_sales where id=$1',[sale.saleId])).rows[0].actor_id,employee);
    }finally{await b.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);}
    await admin.query('set role anon');try{await assert.rejects(admin.query("select public.pos_terminal_devices($1,'get','{}')",[workspace]),/permission denied/);}finally{await admin.query('reset role');}
  });
  await check(
    "Terminal cancel, unknown timeout, busy and offline never create sales",
    async () => {
      const cancel = await engine.begin(req());
      assert.equal((await engine.cancel(cancel.id)).status, "CANCELED");
      const unknown = await engine.begin(req());
      em.set(unknown.id, "FUTURE_STATUS");
      assert.equal((await engine.check(unknown.id)).status, "UNKNOWN");
      em.set(unknown.id, "CANCELED");
      em.checkouts.get(unknown.id).cancel_reason = "TIMED_OUT";
      assert.equal((await engine.check(unknown.id)).saleState, "PAYABLE");
      em.busy = true;
      const busy = await engine.begin(req());
      assert.equal(busy.status, "FAILED");
      assert.equal(busy.metadata.terminalError, "DEVICE_BUSY");
      em.busy = false;
      em.offline = true;
      const offline = await engine.begin(req());
      assert.equal(offline.status, "FAILED");
      assert.equal(offline.saleId, null);
      em.offline = false;
    },
  );
  await check(
    "Terminal immutable location, disabled reconciliation, unassigned and injected routing denial",
    async () => {
      await assert.rejects(
        pay("create", { ...req(), deviceId: "arbitrary" }),
        /POS_INVALID/,
      );
      await admin.query(
        "update pos_private.square_mappings set location_id='inactive' where connection_id=$1 and site_id=$2",
        [connection.id, setup.siteId],
      );
      await assert.rejects(engine.begin(req()), /SQUARE_UNAVAILABLE/);
      await admin.query(
        "update pos_private.square_mappings set location_id='square-location' where connection_id=$1 and site_id=$2",
        [connection.id, setup.siteId],
      );
      const p = await engine.begin(req());
      await hardware("disable", { id: d.id });
      em.set(p.id, "COMPLETED");
      assert.equal((await engine.check(p.id)).saleState, "COMPLETED");
      await assert.rejects(engine.begin(req()), /TERMINAL_UNAVAILABLE/);
    },
  );
  await check(
    "Terminal signed unknown and wrong-merchant events retry; invalid signature never records",
    async () => {
      await assert.rejects(
        hook("terminal.checkout.updated", "unknown", {
          checkout: { reference_id: successful.id },
        }),
        /UNKNOWN_STATUS/,
      );
      await assert.rejects(
        hook(
          "terminal.checkout.updated",
          successful.id,
          { checkout: { reference_id: successful.id } },
          randomUUID(),
          "wrong-merchant",
        ),
        /UNKNOWN_STATUS/,
      );
      await assert.rejects(
        squareWebhook(accounts, Buffer.from("{}"), "invalid"),
        /SIGNATURE/,
      );
    },
  );
  await check(
    "Terminal US refund still uses normal Refunds API and leaves cash untouched",
    async () => {
      const detail = await command(a, "receipt", { saleId: successful.saleId });
      const result = await engine.refund({
        key: randomUUID(),
        paymentId: successful.id,
        intent: {
          key: randomUUID(),
          siteId: setup.siteId,
          sessionId: session.id,
          saleId: successful.saleId,
          reason: "Terminal test refund",
          lines: [
            {
              saleItemId: detail.items[0].id,
              quantity: 1,
              returnInventory: true,
            },
          ],
          expectedMinor: 108,
        },
      });
      assert.equal(result.status, "SUCCEEDED");
      assert.ok(em.calls.some((x) => x.path === "/v2/refunds"));
      assert.ok(!em.calls.some((x) => x.path === "/v2/terminals/refunds"));
    },
  );
  await command(a, "close", { registerId: reg.id });
  return { accounts, em, providerFactory, hardware, connection, hook };
}

import { paymentHttp } from "./pos-payment-http.mjs";
import http from "node:http";
import { readFileSync } from "node:fs";
import { build } from "../.local-fixtures/pos-db/node_modules/esbuild/lib/main.js";
import { chromium, expect } from "@playwright/test";

export async function verifyPaymentsBrowser({
  admin,
  a,
  command,
  workspace,
  owner,
  other,
  setup,
  squareFixture,
}) {
  const reg = await command(a, "configure_register", {
    siteId: setup.siteId,
    name: "Payment browser drawer",
  });
  await a.query(
    "insert into inventory_items(id,user_id,workspace_id,location_id,card_name,sku,quantity,asking_price) values('pay-browser',$1,$2,'case','Payment browser card','PAY-BROWSER',10,10)",
    [owner, workspace],
  );
  const session = await command(a, "open", {
    registerId: reg.id,
    openingMinor: 10000,
  });
  let loseResponse = false;
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {Register} from './src/components/pos/Register';import {Operations} from './src/components/pos/Operations';import {RefundPanel} from './src/components/pos/RefundPanel';import {PaymentHistory} from './src/components/pos/PaymentHistory';import {SquareSettings} from './src/components/pos/SquareSettings';const d=window.seed;createRoot(document.getElementById('app')).render(d.mode==='settings'?<SquareSettings/>:d.mode==='payments'?<PaymentHistory/>:d.mode==='register'?<Register data={d.data} workspaceId="${workspace}" actorId={d.actor}/>:d.mode==='refund'?<RefundPanel data={d.data} items={d.items} saleId={d.saleId} scope={'${workspace}.'+d.actor}/>:<Operations data={d.data} scope={'${workspace}.'+d.actor} mode={d.mode}/>);`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"test"' },
    plugins: [
      {
        name: "test-link",
        setup(b) {
          b.onResolve({ filter: /^next\/link$/ }, () => ({
            path: "link",
            namespace: "test",
          }));
          b.onLoad({ filter: /.*/, namespace: "test" }, () => ({
            contents:
              "import React from 'react';export default function Link(props){return React.createElement('a',props)}",
            loader: "js",
            resolveDir: process.cwd(),
          }));
        },
      },
    ],
  });
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1:4204");
      const isStaff = (req.headers.cookie ?? "").includes("actor=staff");
      const client = a;
      if (url.pathname === "/bundle.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(bundle.outputFiles[0].text);
        return;
      }
      if (url.pathname === "/api/pos/payments/square") {
        let body={};if(req.method==='POST'){let raw='';for await(const chunk of req)raw+=chunk;body=JSON.parse(raw);}
        if(body.action==='check'||body.action==='disconnect')await squareFixture.accounts.manage(body.action,workspace,owner,body.connectionId);
        const result=(await a.query('select public.pos_square_settings($1,$2,$3) result',[workspace,body.action==='map'?'map':'get',body])).rows[0].result;
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify({...result,configured:true}));return;
      }
      if (url.pathname.startsWith("/api/pos/payments")) {
        const lose = loseResponse && req.method === "POST";
        loseResponse = false;
        if (
          await paymentHttp(req, res, url, client, workspace, {
            loseResponse: lose,
            providerFactory: squareFixture?.providerFactory,
          })
        )
          return;
      }
      if (url.pathname === "/api/pos") {
        let body = Object.fromEntries(url.searchParams);
        if (req.method === "POST") {
          let raw = "";
          for await (const chunk of req) raw += chunk;
          body = JSON.parse(raw);
        }
        const { action, ...payload } = body;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(await command(client, action, payload)));
        return;
      }
      const data = await command(client, "bootstrap");
      data.registers = data.registers.filter((r) => r.id === reg.id);
      const mode = url.searchParams.get("mode") ?? "register";
      const saleId = url.searchParams.get("saleId");
      const detail =
        mode === "refund" ? await command(client, "receipt", { saleId }) : {};
      res.setHeader("Content-Type", "text/html");
      res.end(
        `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>body{font-family:Arial;color:#16222a;background:#f5f7f9;--td-text-primary:#16222a;--td-background-secondary:white;--td-action-primary:#007d86;--td-on-accent:white}${readFileSync("src/app/dashboard/pos/pos.css", "utf8")}</style></head><body><main class="pos-workspace"><h1>Trading Docks POS</h1><div id="app"></div></main><script>window.seed=${JSON.stringify({ mode, data, actor: isStaff ? other : owner, saleId, items: detail.items }).replace(/</g, "\\u003c")}</script><script src="/bundle.js"></script></body></html>`,
      );
    } catch (error) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message, code: error.message }));
    }
  });
  await new Promise((resolve) => server.listen(4204, "127.0.0.1", resolve));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    async function cart(outcome = "APPROVE") {
      await page.goto("http://127.0.0.1:4204");
      await page
        .getByLabel("Scan barcode or search inventory")
        .fill("PAY-BROWSER");
      await page.getByLabel("Scan barcode or search inventory").press("Enter");
      await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue(
        "1",
      );
      await page
        .getByLabel("Payment method", { exact: true })
        .selectOption("MOCK");
      await page.getByLabel("Mock outcome").selectOption(outcome);
    }
    await cart();
    await page
      .getByRole("button", { name: "Pay with Mock Card", exact: true })
      .click();
    await expect(
      page.getByText("Payment Complete", { exact: true }),
    ).toBeVisible();
    console.log("PASS browser mock approval completes one sale");
    for (const outcome of ["DECLINE", "CANCEL"]) {
      await cart(outcome);
      await page
        .getByRole("button", { name: "Pay with Mock Card", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Try Another Payment Method" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Try Another Payment Method" })
        .click();
      await expect(page.getByLabel("Quantity", { exact: true })).toBeEnabled();
    }
    console.log("PASS browser decline and cancellation safely release cart");
    for (const outcome of [
      "TIMEOUT",
      "UNKNOWN_THEN_SUCCESS",
      "DELAYED_SUCCESS",
    ]) {
      await cart(outcome);
      await page
        .getByRole("button", { name: "Pay with Mock Card", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Check Payment Status", exact: true }),
      ).toBeVisible();
      await expect(page.getByLabel("Quantity", { exact: true })).toBeDisabled();
      if (outcome === "TIMEOUT") {
        await page
          .getByRole("button", { name: "Cancel payment", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Try Another Payment Method" })
          .click();
      } else {
        await page
          .getByRole("button", { name: "Check Payment Status", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Check Payment Status", exact: true })
          .click();
        await expect(
          page.getByText("Payment Complete", { exact: true }),
        ).toBeVisible();
      }
    }
    console.log(
      "PASS browser timeout unknown and delayed success block duplicate payment",
    );
    await cart();
    await page.getByLabel("Quantity", { exact: true }).fill("2");
    loseResponse = true;
    await page
      .getByRole("button", { name: "Pay with Mock Card", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("Response lost");
    const count = Number(
      (
        await admin.query(
          "select count(*) n from pos_sales where register_id=$1",
          [reg.id],
        )
      ).rows[0].n,
    );
    await page.reload();
    const secondTab = await page.context().newPage();
    await secondTab.goto('http://127.0.0.1:4204');
    const seenTabs = new Set();
    let retryRequests = 0;
    const throttleOnce = async route => {
      const tab = route.request().frame().page();
      retryRequests++;
      if (!seenTabs.has(tab)) {
        seenTabs.add(tab);
        return route.fulfill({ status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '1' }, body: JSON.stringify({ code: 'POS_RATE_LIMIT' }) });
      }
      return route.continue();
    };
    await page.context().route(/\/api\/pos\/payments(?:\/[^/]+\/check)?$/, throttleOnce);
    await Promise.all([page, secondTab].map(tab => tab.getByRole('button', { name: 'Check Payment Status', exact: true }).click()));
    await Promise.all([page, secondTab].map(tab => expect(tab.getByRole('alert')).toContainText('Payment status checks are temporarily limited. Trading Docks will retry shortly.')));
    await Promise.all([page, secondTab].map(tab => expect(tab.getByText('Payment Complete', { exact: true })).toBeVisible()));
    expect(retryRequests).toBe(4);
    await page.context().unroute(/\/api\/pos\/payments(?:\/[^/]+\/check)?$/, throttleOnce);
    await secondTab.close();
    console.log('PASS two browser tabs retain one payment through 429 bounded retry and local completion');
    await expect(
      page.getByText("Payment Complete", { exact: true }),
    ).toBeVisible();
    expect(
      Number(
        (
          await admin.query(
            "select count(*) n from pos_sales where register_id=$1",
            [reg.id],
          )
        ).rows[0].n,
      ),
    ).toBe(count);
    await page.screenshot({
      path: ".local-fixtures/pos-db/payment-complete.png",
      fullPage: true,
    });
    console.log(
      "PASS browser provider success with lost response survives reload without duplicate sale",
    );
    const sale = (
      await admin.query(
        "select id from pos_sales where register_id=$1 order by created_at desc limit 1",
        [reg.id],
      )
    ).rows[0];
    await page.goto(`http://127.0.0.1:4204?mode=refund&saleId=${sale.id}`);
    await page.getByLabel("Processing drawer").selectOption(session.id);
    await page.getByRole("spinbutton").fill("1");
    await page.getByLabel("Inventory decision").selectOption("false");
    loseResponse = true;
    await page.getByRole("button", { name: "Request provider refund" }).click();
    await expect(page.getByRole("alert")).toContainText("Response lost");
    await page.reload();
    await page.getByRole("button", { name: "Check Refund Status" }).click();
    await expect(
      page.getByText("Refund recorded.", { exact: false }),
    ).toBeVisible();
    expect(
      Number(
        (
          await admin.query(
            "select count(*) n from pos_refunds where sale_id=$1",
            [sale.id],
          )
        ).rows[0].n,
      ),
    ).toBe(1);
    console.log(
      "PASS browser provider refund lost-response retry records one refund",
    );
    await page.goto("http://127.0.0.1:4204?mode=payments");
    await page.getByLabel("Payment status").selectOption("PARTIALLY_REFUNDED");
    await expect(page.getByRole("heading", { level: 3 }).first()).toContainText(
      "PARTIALLY_REFUNDED",
    );
    await page.getByLabel("Payment provider").selectOption("EXTERNAL");
    await expect(page.getByText("No matching payment attempts.")).toBeVisible();
    console.log(
      "PASS browser payment method and status filters after partial refund",
    );
    await page.setViewportSize({ width: 768, height: 1024 });
    await cart("UNKNOWN_THEN_SUCCESS");
    await page
      .getByRole("button", { name: "Pay with Mock Card", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Check Payment Status", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: ".local-fixtures/pos-db/payment-unknown-tablet.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Cancel payment", exact: true })
      .click();
    if(squareFixture) {
      await page.getByRole('button',{name:'Try Another Payment Method'}).click();
      await cart();
      await page.getByLabel('Payment method',{exact:true}).selectOption('SQUARE');
      await expect(page.getByText('SANDBOX — No real money is processed.',{exact:false})).toBeVisible();
      loseResponse=true;
      await page.getByRole('button',{name:'Run Square Sandbox payment'}).click();
      await expect(page.getByRole('alert')).toContainText('Response lost');
      const before=(await admin.query("select count(*)::int n from pos_sales where register_id=$1",[reg.id])).rows[0].n;
      await page.reload();await page.getByRole('button',{name:'Check Payment Status',exact:true}).click();
      await expect(page.getByText('Payment Complete',{exact:true})).toBeVisible();
      expect((await admin.query("select count(*)::int n from pos_sales where register_id=$1",[reg.id])).rows[0].n).toBe(before);
      await page.screenshot({path:'.local-fixtures/pos-db/square-sandbox-complete.png',fullPage:true});
      console.log('PASS browser Square Sandbox lost response reload recovers one sale');
      await page.goto('http://127.0.0.1:4204?mode=settings');
      await expect(page.getByRole('heading',{name:'Square Test Shop'})).toBeVisible();
      await expect(page.getByLabel(/Square location for/).first()).toHaveValue('square-location');
      await page.screenshot({path:'.local-fixtures/pos-db/square-settings-tablet.png',fullPage:true});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
      page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Disconnect Square',exact:true}).click();
      await expect(page.getByRole('button',{name:'Connect Square Sandbox'})).toBeVisible();
      console.log('PASS Square settings mapping, tablet layout and confirmed disconnect');
    }
    expect(errors).toEqual([]);
    console.log("PASS payment tablet layout and no page errors");
    if (process.argv.includes('--mixed-shift')) {
      const { verifyMixedShiftBrowser } = await import('./pos-mixed-shift-browser.mjs');
      await verifyMixedShiftBrowser({page,admin,a,command,owner,workspace,setup,reg,priorSession:session});
      console.log('PASS 100 mixed browser sales, refund, accounting, positions, batches, locations and memory');
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
  if (!process.argv.includes('--mixed-shift')) await command(a, "close", { registerId: reg.id, sessionId: session.id });
}

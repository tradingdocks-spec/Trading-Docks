import http from "node:http";
import { readFileSync } from "node:fs";
import { build } from "../.local-fixtures/pos-db/node_modules/esbuild/lib/main.js";
import { chromium, expect } from "@playwright/test";

export async function verifyOperationsBrowser({
  admin,
  a,
  staff,
  command,
  workspace,
  owner,
  other,
  setup,
}) {
  const reg = await command(a, "configure_register", {
    siteId: setup.siteId,
    name: "Browser drawer",
  });
  await a.query(
    "insert into inventory_items(id,user_id,workspace_id,location_id,card_name,sku,quantity,asking_price) values('ops-browser',$1,$2,'case','Browser card','BROWSER-CARD',10,10)",
    [owner, workspace],
  );
  await admin.query("insert into workspace_members values($1,$2,'employee')", [
    workspace,
    other,
  ]);
  await command(a, "grant", {
    siteId: setup.siteId,
    employeeId: other,
    capabilities: ["sell", "return"],
  });
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {Register} from './src/components/pos/Register';import {Operations} from './src/components/pos/Operations';import {RefundPanel} from './src/components/pos/RefundPanel';const d=window.seed;createRoot(document.getElementById('app')).render(d.mode==='register'?<Register data={d.data} workspaceId="${workspace}" actorId={d.actor}/>:d.mode==='refund'?<RefundPanel data={d.data} items={d.items} saleId={d.saleId} scope={'${workspace}.'+d.actor}/>:<Operations data={d.data} scope={'${workspace}.'+d.actor} mode={d.mode}/>);`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
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
      const url = new URL(req.url, "http://127.0.0.1:4203");
      const isStaff = (req.headers.cookie ?? "").includes("actor=staff");
      const client = isStaff ? staff : a;
      if (url.pathname === "/bundle.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(bundle.outputFiles[0].text);
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
  await new Promise((resolve) => server.listen(4203, "127.0.0.1", resolve));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const ownerContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const staffContext = await browser.newContext({
      viewport: { width: 1024, height: 900 },
    });
    await staffContext.addCookies([
      { name: "actor", value: "staff", url: "http://127.0.0.1:4203" },
    ]);
    const page = await ownerContext.newPage();
    const cashier = await staffContext.newPage();
    const errors = [];
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.error("Operations browser:", e.message);
    });
    cashier.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:4203");
    await page.getByLabel("Register", { exact: true }).selectOption(reg.id);
    await page.getByLabel("Opening cash").fill("200.00");
    await page
      .getByRole("button", { name: "Open register", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Close register", exact: true }),
    ).toBeVisible();
    await page.goto("http://127.0.0.1:4203?mode=registers");
    await page.getByLabel("Register", { exact: true }).selectOption(reg.id);
    await page.getByLabel("Amount", { exact: true }).fill("50");
    await page
      .getByLabel("Reason", { exact: true })
      .fill("Additional change float");
    await page
      .getByRole("button", { name: "Record movement", exact: true })
      .click();
    await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("");
    await page.screenshot({
      path: ".local-fixtures/pos-db/operations-desktop.png",
      fullPage: true,
    });
    await page.goto("http://127.0.0.1:4203");
    await page.getByLabel("Register", { exact: true }).selectOption(reg.id);
    await page
      .getByLabel("Scan barcode or search inventory")
      .fill("BROWSER-CARD");
    await page.getByLabel("Scan barcode or search inventory").press("Enter");
    await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("1");
    await page.getByLabel("Cash received").fill("20");
    await page
      .getByRole("button", { name: "Complete cash sale", exact: true })
      .click();
    await expect(page.getByText("Paid $10.85 · Change $9.15")).toBeVisible();
    const sale = (
      await admin.query(
        "select id,session_id from pos_sales where register_id=$1 order by created_at desc limit 1",
        [reg.id],
      )
    ).rows[0];
    await page.goto(`http://127.0.0.1:4203?mode=refund&saleId=${sale.id}`);
    await page.getByLabel("Processing drawer").selectOption(sale.session_id);
    await page.getByRole("spinbutton").fill("1");
    await page.getByLabel("Inventory decision").selectOption("true");
    await page
      .getByRole("button", { name: "Record cash refund", exact: true })
      .click();
    await expect(
      page.getByText("Refund recorded.", { exact: false }),
    ).toBeVisible();
    await page.goto("http://127.0.0.1:4203");
    await page.getByLabel("Register", { exact: true }).selectOption(reg.id);
    await page
      .getByRole("button", { name: "Close register", exact: true })
      .click();
    await page.getByLabel("Counted cash").fill("250");
    await page
      .getByRole("button", { name: "Confirm drawer close", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Open register", exact: true }),
    ).toBeVisible();
    const closed = (
      await admin.query(
        "select expected_minor,counted_minor,variance_minor from pos_register_sessions where id=$1",
        [sale.session_id],
      )
    ).rows[0];
    expect(Number(closed.expected_minor)).toBe(25000);
    expect(Number(closed.variance_minor)).toBe(0);
    console.log(
      "PASS browser opening float → paid in → sale → explicit restock refund → counted close",
    );
    const shift = await command(a, "open", {
      registerId: reg.id,
      openingMinor: 0,
    });
    await cashier.goto("http://127.0.0.1:4203");
    await cashier.getByLabel("Register", { exact: true }).selectOption(reg.id);
    await cashier
      .getByLabel("Scan barcode or search inventory")
      .fill("BROWSER-CARD");
    await cashier.getByLabel("Scan barcode or search inventory").press("Enter");
    await expect(cashier.getByLabel("Quantity", { exact: true })).toHaveValue(
      "1",
    );
    await cashier.getByLabel("Discount %", { exact: true }).fill("50");
    await cashier.getByLabel("Discount reason").fill("Reviewed markdown");
    await cashier.getByLabel("Cash received").fill("10");
    await cashier
      .getByRole("button", { name: "Complete cash sale", exact: true })
      .click();
    await expect(
      cashier.getByText("Checkout needs confirmation"),
    ).toBeVisible();
    await cashier
      .getByRole("button", { name: "Request manager approval", exact: true })
      .click();
    await expect(
      cashier.getByRole("button", { name: "Approval requested", exact: true }),
    ).toBeVisible();
    await page.goto("http://127.0.0.1:4203?mode=registers");
    await page
      .getByRole("button", { name: "Approve this request", exact: true })
      .last()
      .click();
    await expect(
      page.getByRole("button", { name: "Approve this request", exact: true }),
    ).toHaveCount(0);
    await cashier
      .getByRole("button", { name: "Retry original checkout", exact: true })
      .click();
    await expect(cashier.getByText("Paid $5.43 · Change $4.57")).toBeVisible();
    expect(
      (
        await admin.query(
          "select actor_id from pos_sales where session_id=$1",
          [shift.id],
        )
      ).rows[0].actor_id,
    ).toBe(other);
    await command(a, "close", { registerId: reg.id, sessionId: shift.id });
    console.log(
      "PASS browser cashier restriction → separately authenticated manager approval → original cashier sale",
    );
    await page.goto("http://127.0.0.1:4203?mode=daily");
    await expect(
      page.getByRole("heading", { name: "By employee", exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 768, height: 1024 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".local-fixtures/pos-db/daily-tablet.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
    console.log(
      "PASS browser store-local daily report, tablet width and no page errors",
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await admin.query(
      "delete from workspace_members where workspace_id=$1 and user_id=$2",
      [workspace, other],
    );
  }
}

import { paymentHttp } from "./pos-payment-http.mjs";
import { terminalPair } from "../src/lib/pos/payments/square/terminal.ts";
import { randomUUID } from "node:crypto";
import http from "node:http";
import { readFileSync } from "node:fs";
import { build } from "../.local-fixtures/pos-db/node_modules/esbuild/lib/main.js";
import { chromium, expect } from "@playwright/test";
export async function verifyTerminalBrowser({
  admin,
  a,
  command,
  workspace,
  owner,
  setup,
  terminalFixture: f,
}) {
  const reg = await command(a, "configure_register", {
    siteId: setup.siteId,
    name: "Terminal browser register",
  });
  const session = await command(a, "open", {
    registerId: reg.id,
    openingMinor: 10000,
  });
  await a.query(
    "insert into inventory_items(id,user_id,workspace_id,location_id,card_name,sku,quantity,asking_price) values('terminal-browser',$1,$2,'case','Terminal browser card','TERMINAL-BROWSER',30,1),('terminal-browser-two',$1,$2,'case','Second Terminal card','TERMINAL-TWO',30,1)",
    [owner, workspace],
  );
  const device = {
    id: randomUUID(),
    name: "Browser Terminal",
    siteId: setup.siteId,
  };
  let lose = false;
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {Register} from './src/components/pos/Register';import {Terminals} from './src/components/pos/Terminals';import {PaymentHistory} from './src/components/pos/PaymentHistory';const d=window.seed;createRoot(document.getElementById('app')).render(d.mode==='hardware'?<Terminals/>:d.mode==='history'?<PaymentHistory/>:<Register data={d.data} workspaceId="${workspace}" actorId="${owner}"/>);`,
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
              "import React from 'react';export default function Link(p){return React.createElement('a',p)}",
            loader: "js",
            resolveDir: process.cwd(),
          }));
        },
      },
    ],
  });
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1:4205");
      if (url.pathname === "/bundle.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(bundle.outputFiles[0].text);
        return;
      }
      if (url.pathname === "/api/pos/payments/terminals") {
        let body = {};
        if (req.method === "POST") {
          let raw = "";
          for await (const chunk of req) raw += chunk;
          body = JSON.parse(raw);
        }
        let pairing;
        if (body.action === "pair" || body.action === "check")
          pairing = await terminalPair(
            f.accounts,
            workspace,
            owner,
            body,
            body.action === "pair",
          );
        const data = await f.hardware(
          ["assign", "disable", "rename"].includes(body.action)
            ? body.action
            : "get",
          body,
        );
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ...data, pairing }));
        return;
      }
      if (url.pathname.startsWith("/api/pos/payments")) {
        const lost = lose && req.method === "POST";
        if (lost) lose = false;
        if (
          await paymentHttp(req, res, url, a, workspace, {
            loseResponse: lost,
            providerFactory: f.providerFactory,
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
        res.end(JSON.stringify(await command(a, action, payload)));
        return;
      }
      const data = await command(a, "bootstrap");
      data.registers = data.registers.filter((r) => r.id === reg.id);
      res.setHeader("Content-Type", "text/html");
      res.end(
        `<html><head><style>body{font-family:Arial;color:#16222a;background:#f5f7f9;--td-text-primary:#16222a;--td-background-secondary:white;--td-action-primary:#007d86;--td-on-accent:white}${readFileSync("src/app/dashboard/pos/pos.css", "utf8")}</style></head><body><main class="pos-workspace"><h1>Trading Docks POS</h1><div id="app"></div></main><script>window.seed=${JSON.stringify({ mode: url.searchParams.get("mode"), data })}</script><script src="/bundle.js"></script></body></html>`,
      );
    } catch (e) {
      res.statusCode = 409;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: e.message, code: e.message }));
    }
  });
  await new Promise((r) => server.listen(4205, "127.0.0.1", r));
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  const latest = () => [...f.em.checkouts.values()].at(-1);
  const count = async () =>
    Number(
      (
        await admin.query(
          "select count(*) from pos_sales where register_id=$1",
          [reg.id],
        )
      ).rows[0].count,
    );
  async function cart(two = false) {
    await page.goto("http://127.0.0.1:4205");
    const scan = page.getByLabel("Scan barcode or search inventory");
    await scan.fill("TERMINAL-BROWSER");
    await scan.press("Enter");
    await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("1");
    if (two) {
      await scan.fill("TERMINAL-TWO");
      await scan.press("Enter");
      await expect(page.getByLabel("Quantity", { exact: true })).toHaveCount(2);
    }
    await page
      .getByLabel("Payment method", { exact: true })
      .selectOption("SQUARE_TERMINAL");
    await page
      .getByRole("button", { name: "Pay with Square Terminal", exact: true })
      .click();
  }
  try {
    await page.goto("http://127.0.0.1:4205?mode=hardware");
    await page.getByLabel("Terminal name", { exact: true }).fill(device.name);
    await page
      .getByLabel("Store location", { exact: true })
      .selectOption(setup.siteId);
    await page
      .getByRole("button", { name: /Add Square Terminal|Generate New Code/ })
      .click();
    await expect(page.getByText("EBCARJ", { exact: true })).toBeVisible();
    const remote = [...f.em.codes.values()].at(-1);
    device.id = remote.id;
    f.em.pair(device.id);
    await f.hook("device.code.paired", device.id, { device_code: remote });
    await page.reload();
    await page.getByLabel("Register for Browser Terminal").selectOption(reg.id);
    await expect(
      page.getByText("Square ·", { exact: false }).last(),
    ).toBeVisible();
    await page.screenshot({
      path: ".local-fixtures/pos-db/terminal-hardware.png",
      fullPage: true,
    });
    console.log("PASS browser Terminal pairing webhook and assignment");
    await cart(true);
    await expect(
      page.getByText("Waiting for customer", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Quantity", { exact: true }).first(),
    ).toBeDisabled();
    await page.screenshot({
      path: ".local-fixtures/pos-db/terminal-waiting.png",
      fullPage: true,
    });
    const closing = await page.evaluate(async (id) => {
      const r = await fetch("/api/pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", registerId: id }),
      });
      return r.json();
    }, reg.id);
    expect(closing.error).toContain("POS_PAYMENT_ACTIVE");
    const first = latest();
    f.em.set(first.id, "COMPLETED");
    await f.hook("terminal.checkout.updated", first.id, { checkout: first });
    await page
      .getByRole("button", { name: "Check Payment Status", exact: true })
      .click();
    await expect(
      page.getByText("Payment Complete", { exact: true }),
    ).toBeVisible();
    expect(await count()).toBe(1);
    expect(
      (
        await admin.query(
          "select quantity from inventory_items where id='terminal-browser' and user_id=$1",
          [owner],
        )
      ).rows[0].quantity,
    ).toBe(29);
    expect(
      (
        await admin.query("select pos_private.expected_cash($1) n", [
          session.id,
        ])
      ).rows[0].n,
    ).toBe("10000");
    await page.screenshot({
      path: ".local-fixtures/pos-db/terminal-receipt.png",
      fullPage: true,
    });
    console.log(
      "PASS browser Terminal two-item approval receipt inventory and unchanged drawer",
    );
    await cart();
    await page
      .getByRole("button", { name: "Cancel payment", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Try Another Payment Method" }),
    ).toBeVisible();
    expect(await count()).toBe(1);
    await page
      .getByRole("button", { name: "Try Another Payment Method" })
      .click();
    await expect(page.getByLabel("Quantity", { exact: true })).toBeEnabled();
    console.log("PASS browser cashier cancel confirmed and cart payable");
    // Definitive card rejection uses the same provider normalization as a declined payment response.
    const fetch = f.em.fetch;
    f.accounts.http.fetcher = async (url, init) =>
      String(url).endsWith("/v2/terminals/checkouts")
        ? Response.json(
            {
              errors: [
                { category: "PAYMENT_METHOD_ERROR", code: "CARD_DECLINED" },
              ],
            },
            { status: 400 },
          )
        : fetch(url, init);
    await cart();
    await expect(
      page.getByText("Payment was declined.", { exact: true }),
    ).toBeVisible();
    expect(await count()).toBe(1);
    await page
      .getByRole("button", { name: "Try Another Payment Method" })
      .click();
    await page
      .getByLabel("Payment method", { exact: true })
      .selectOption("CASH");
    f.accounts.http.fetcher = fetch;
    await page.getByLabel("Cash received").fill("2.00");
    await page.getByRole("button", { name: /Complete cash sale/i }).click();
    await expect(
      page.getByText("Payment Complete", { exact: true }),
    ).toBeVisible();
    expect(await count()).toBe(2);
    console.log(
      "PASS browser Terminal decline preserves cart and cash succeeds",
    );
    lose = true;
    await cart();
    await expect(page.getByRole("alert")).toContainText("Response lost");
    const lost = latest();
    f.em.set(lost.id, "COMPLETED");
    await page.reload();
    await page
      .getByRole("button", { name: "Check Payment Status", exact: true })
      .click();
    await expect(
      page.getByText("Payment Complete", { exact: true }),
    ).toBeVisible();
    expect(await count()).toBe(3);
    console.log(
      "PASS browser lost response reload reconciles one Terminal sale",
    );
    f.em.busy = true;
    await cart();
    await expect(
      page.getByText(
        "Browser Terminal is already processing another transaction.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(await count()).toBe(3);
    f.em.busy = false;
    await page
      .getByRole("button", { name: "Try Another Payment Method" })
      .click();
    await page.goto("http://127.0.0.1:4205?mode=history");
    await expect(page.getByText(/Browser Terminal/).first()).toBeVisible();
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto("http://127.0.0.1:4205?mode=hardware");
    await page.screenshot({
      path: ".local-fixtures/pos-db/terminal-tablet.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    console.log(
      "PASS browser busy device, history and tablet hardware without runtime errors",
    );
  } catch (e) {
    console.error(await page.locator("body").innerText());
    await page.screenshot({
      path: ".local-fixtures/pos-db/terminal-failure.png",
      fullPage: true,
    });
    throw e;
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
}

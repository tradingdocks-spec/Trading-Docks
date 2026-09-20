// Production Label Studio + Register + renderer + SQL, loopback transport only.
// Does not claim hosted Supabase cookie/PostgREST validation.
import http from "node:http";
import { readFileSync } from "node:fs";
import { build } from "../.local-fixtures/pos-db/node_modules/esbuild/lib/main.js";
import { chromium, expect } from "@playwright/test";
import { buildLabelDocument } from "../src/lib/label-studio/print-document.ts";
export async function verifyLabelWorkflow({
  a,
  admin,
  command,
  workspace,
  owner,
}) {
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {Register} from './src/components/pos/Register';import {LabelStudioWorkspace} from './src/components/dashboard/label-studio/LabelStudioWorkspace';createRoot(document.getElementById('app')).render(location.pathname.includes('label-studio')?<LabelStudioWorkspace/>:<Register data={window.bootstrap} workspaceId="${workspace}" actorId="${owner}"/>);`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    outdir: ".local-fixtures/label-print/bundle",
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
  const targets = async (ids, issue = false) =>
    (
      await a.query("select label_targets($1,$2,null,'',$3) result", [
        workspace,
        ids,
        issue,
      ])
    ).rows[0].result;
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1:4201");
      let body = {};
      if (req.method === "POST") {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        body = JSON.parse(raw);
      }
      const json = (data) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(data));
      };
      if (url.pathname === "/bundle.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(bundle.outputFiles.find((f) => f.path.endsWith(".js")).text);
        return;
      }
      if (url.pathname === "/api/label-studio") {
        json({
          workspaceId: workspace,
          templates: [],
          priceReviews: [],
          capabilities: { canPrint: true, canManageTemplates: true },
        });
        return;
      }
      if (url.pathname === "/api/label-studio/targets") {
        json(
          await targets(
            body.ids ??
              (url.searchParams.get("ids") ?? "").split(",").filter(Boolean),
            req.method === "POST",
          ),
        );
        return;
      }
      if (url.pathname === "/api/label-studio/print") {
        const rows = await targets(
          body.queue.map((r) => r.key),
          true,
        );
        const queue = body.queue.map((row) => ({
          target: rows.find((t) => t.key === row.key),
          copies: row.copies,
        }));
        res.setHeader("Content-Type", "text/html");
        res.end(
          await buildLabelDocument(body.template, queue, body.preview === true),
        );
        return;
      }
      if (url.pathname === "/api/pos") {
        const value =
          req.method === "POST" ? body : Object.fromEntries(url.searchParams);
        const { action, ...payload } = value;
        json(await command(action, payload));
        return;
      }
      const bootstrap = await command("bootstrap", {});
      res.setHeader("Content-Type", "text/html");
      const css =
        readFileSync(
          "src/components/dashboard/label-studio/label-studio.css",
          "utf8",
        ) + readFileSync("src/app/dashboard/pos/pos.css", "utf8");
      res.end(
        `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>body{font-family:Arial;background:#f5f7f9;color:#16222a;--td-background-secondary:white;--td-text-primary:#16222a;--td-action-primary:#007d86;--td-on-accent:white}${css}</style></head><body><h1>Local inventory QA</h1>${url.pathname === "/inventory" ? '<a href="/dashboard/label-studio?source=inventory&ids=label-p1">Print selected inventory labels</a>' : '<div id="app"></div><script>window.bootstrap=' + JSON.stringify(bootstrap).replace(/</g, "\\u003c") + '</script><script src="/bundle.js"></script>'}</body></html>`,
      );
    } catch (error) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message, code: error.message }));
    }
  });
  await new Promise((resolve) => server.listen(4201, "127.0.0.1", resolve));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:4201/inventory");
    await page
      .getByRole("link", { name: "Print selected inventory labels" })
      .click();
    await expect(
      page.getByRole("button", { name: "Prepare 1 labels", exact: true }),
    ).toBeVisible();
    await expect(
      page.frameLocator("iframe").getByText("Charizard ex", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Refresh prices / identities" })
      .click();
    const target = (await targets(["label-p1"], true))[0];
    await expect(page.getByText(new RegExp(target.sku)).first()).toBeVisible();
    await page.getByLabel("Copies Charizard ex").fill("5");
    const popupPromise = page.waitForEvent("popup");
    await page
      .getByRole("button", { name: "Prepare 5 labels", exact: true })
      .click();
    const popup = await popupPromise;
    await expect(popup.locator(".label")).toHaveCount(5);
    await expect(
      popup.getByRole("button", { name: "Print 5 labels", exact: true }),
    ).toBeVisible();
    const pdf = await popup.pdf({
      path: ".local-fixtures/label-print/workflow-five.pdf",
      preferCSSPageSize: true,
    });
    expect(
      (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length,
    ).toBe(5);
    await page
      .getByRole("button", { name: "Prepare 5 labels", exact: true })
      .click();
    expect(page.context().pages().length).toBe(2);
    await popup.close();
    await page.screenshot({
      path: ".local-fixtures/label-print/studio-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({
      path: ".local-fixtures/label-print/studio-tablet.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("link", { name: "POS register", exact: true }).click();
    await page
      .getByRole("button", { name: "Open register", exact: true })
      .click();
    await page.locator("h1").click();
    await page.keyboard.type(target.sku, { delay: 5 });
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Batch position")).toHaveValue("label-p1");
    await expect(page.getByLabel("Batch position")).toBeDisabled();
    await page.getByLabel("Cash received").fill("25");
    await page
      .getByRole("button", { name: "Complete cash sale", exact: true })
      .click();
    await expect(page.getByText("Paid $21.69 · Change $3.31")).toBeVisible();
    expect(
      (
        await admin.query(
          "select quantity from chaos_sort_inventory_positions where id='label-p1'",
        )
      ).rows[0].quantity,
    ).toBe(0);
    expect(
      (
        await admin.query(
          "select metadata from inventory_events where inventory_item_id='label-card' order by created_at desc limit 1",
        )
      ).rows[0].metadata.allocations[0].position_id,
    ).toBe("label-p1");
    await page.getByRole('button', { name: 'New Sale', exact: true }).click();
    await page.getByRole('button', { name: 'Close register', exact: true }).click();
    await page.getByLabel('Counted cash').fill('21.69');
    await page.getByRole('button', { name: 'Confirm drawer close', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Open register', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    console.log(
      "PASS browser inventory selection → canonical Label Studio → five-page PDF → exact position scan → cash sale → provenance event; duplicate-window guard and tablet layout",
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

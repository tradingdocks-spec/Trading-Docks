// Component integration fixture: no Auth, remote database, credentials or physical-device claims.
import { build } from "../.local-fixtures/pos-db/node_modules/esbuild/lib/main.js";
import { chromium, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const result = await build({
  stdin: {
    contents: `
import React from 'react';import {createRoot} from 'react-dom/client';
import {Hardware} from './src/components/pos/Hardware';
import {PosSetup} from './src/components/pos/PosSetup';
import {HardwareRecommendations,HardwareCatalog} from './src/components/hardware/HardwareCatalog';
import {hardwareCatalog} from './src/lib/hardware/catalog';
import {purchaseLink,defaultDisclosure} from './src/lib/hardware/links';
const mode=new URL(location.href).searchParams.get('mode');
const item={...hardwareCatalog[0],purchase:{retailer:'AMAZON_US',destination:'https://www.amazon.com/dp/B012345678?th=1',active:true,region:'US'}};
const views=[{item,purchase:purchaseLink(item,{enabled:mode==='affiliate',amazonTag:'fixture-20',disclosure:defaultDisclosure}),disclosure:defaultDisclosure}];
const tiers=['TESTED','COMPATIBLE','BEST_EFFORT','PENDING_TEST'].map(certification=>({...views[0],item:{...item,id:certification,certification,evidence:{testedAt:'2026-09-21',version:'fixture',browser:'Chrome',os:'Windows',notes:'synthetic test only',report:'fixture'}}}));
createRoot(document.getElementById('root')).render(mode==='hardware'?<Hardware/>:mode==='onboarding'?<><PosSetup data={{locations:[],canManage:true}}/><HardwareRecommendations source="pos_onboarding"/></>:<HardwareCatalog views={mode==='tiers'?tiers:mode==='inactive'?[{...views[0],item:{...item,active:false}}]:views}/>);
`,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  bundle: true,
  write: false,
  outdir: ".local-fixtures/hardware-browser",
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"test"' },
  plugins: [
    {
      name: "next-test-adapters",
      setup(b) {
        b.onResolve({ filter: /^next\/(link|image|navigation)$/ }, (a) => ({
          path: a.path,
          namespace: "adapter",
        }));
        b.onLoad({ filter: /.*/, namespace: "adapter" }, (a) => ({
          contents: a.path.endsWith("navigation")
            ? "export const useRouter=()=>({push(){},refresh(){}});"
            : a.path.endsWith("image")
              ? 'import React from "react";export default function Image({unoptimized,...props}){return React.createElement("img",props)}'
              : 'import React from "react";export default function Link(props){return React.createElement("a",props)}',
          loader: "js",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
const js = result.outputFiles.find((f) => f.path.endsWith(".js")).text;
const css = result.outputFiles.find((f) => f.path.endsWith(".css")).text;
const server = createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        devices: [],
        canManage: false,
        sites: [],
        registers: [],
      }),
    );
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(
    `<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${readFileSync("src/app/theme.css", "utf8")} body{margin:0;padding:16px;background:var(--td-background-primary);color:var(--td-text-primary);font-family:Arial}*{box-sizing:border-box} ${readFileSync("src/app/dashboard/pos/pos.css", "utf8")} ${css}</style><body><main class="pos-workspace" id="root"></main><script>${js}</script></body></html>`,
  );
});
await new Promise((r) => server.listen(4320, "127.0.0.1", r));
const browser = await chromium.launch({ channel: "chrome", headless: true });
mkdirSync(".local-fixtures/hardware-browser", { recursive: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const mode of ["onboarding", "hardware", "affiliate", "disabled"]) {
      await page.goto(`http://127.0.0.1:4320/?mode=${mode}`);
      await expect(
        page.getByRole("heading", { name: "Zebra DS2208", exact: true }),
      ).toBeVisible();
      if (["onboarding", "hardware"].includes(mode)) {
        await expect(page.locator("article")).toHaveCount(
          mode === "hardware" ? 7 : 4,
        );
        await expect(page.locator("[data-tier=TESTED]")).toHaveCount(0);
        if (mode === "hardware") {
          await page.getByLabel("Dedicated scanner input").fill("TD-FIXTURE");
          await page
            .getByRole("button", { name: "Test input", exact: true })
            .click();
          await expect(page.getByText("Received: TD-FIXTURE")).toBeVisible();
        }
        if (mode === "onboarding")
          await expect(
            page.getByRole("button", { name: "Create location and register" }),
          ).toBeDisabled();
      } else {
        await expect(
          page.getByText("As an Amazon Associate", { exact: false }),
        ).toHaveCount(mode === "affiliate" ? 1 : 0);
        const purchase = page.getByRole("link", {
          name: /View current price on Amazon/,
        });
        assert.equal(
          (await purchase.getAttribute("rel")).includes("sponsored"),
          mode === "affiliate",
        );
      }
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${mode} ${width} overflow`,
      );
      await page.screenshot({
        path: `.local-fixtures/hardware-browser/${mode}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await page.goto("http://127.0.0.1:4320/?mode=tiers");
  for (const tier of ["TESTED", "COMPATIBLE", "BEST_EFFORT", "PENDING_TEST"])
    await expect(page.locator(`[data-tier=${tier}]`)).toHaveCount(1);
  await page.goto("http://127.0.0.1:4320/?mode=inactive");
  await expect(page.locator("article")).toHaveCount(0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS public cards/disclosure on/off, tier rendering, inactive hidden, onboarding, POS Hardware/scanner, 390/1280 widths, no overflow or runtime errors",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}

import { chromium } from "@playwright/test";
import { renderReceipt } from "../src/lib/pos/receipt.ts";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const dir = ".local-fixtures/pos-receipts";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  for (const provider of ["CASH", "MOCK", "SQUARE"])
    for (const width of ["58", "80", "Letter"])
      for (const count of [1, 25]) {
        const receipt = {
          ...(provider !== "CASH"
            ? {
                payment: {
                  provider,
                  status: "SUCCEEDED",
                  metadata: {
                    brand: provider === "MOCK" ? "Mock" : "VISA",
                    last4: "4242",
                    verification: provider === "MOCK" ? "Simulated" : "Square Sandbox",
                  },
                },
              }
            : {}),
          version: 2,
          number: "TD-TEST-RECEIPT",
          site: "Phoenix Trading Docks",
          register: "Front",
          actorId: "never-print-internal-id",
          employeeName: "Sarah",
          createdAt: "2026-09-20T16:00:00Z",
          timezone: "America/Phoenix",
          currency: "USD",
          settings: {
            receiptWidth: width,
            address: "123 Example Avenue\nPhoenix, AZ",
            footer: "Thank you for shopping with us.",
            returnPolicy: "Returns require this receipt.",
            showEmployee: true,
            showSku: true,
          },
          lines: Array.from({ length: count }, () => ({
            itemId: "internal-item",
            name: "Charizard ex — extended product name with full printing information",
            sku: "TD-ABCD-EFGH",
            quantity: 1,
            unitPriceMinor: 1000,
            discountMinor: 100,
            taxMinor: 77,
            lineTotalMinor: 977,
            setCode: "OBF",
            collectorNumber: "125/197",
            condition: "NM",
            finish: "Holo",
            language: "EN",
            locationId: "internal-location",
          })),
          subtotalMinor: 1000 * count,
          discountMinor: 100 * count,
          taxMinor: 77 * count,
          totalMinor: 977 * count,
          cashMinor: 1000 * count,
          changeMinor: 23 * count,
        };
        await page.setContent(renderReceipt(receipt));
        await page.evaluate(() => document.fonts.ready);
        await page.emulateMedia({ media: "print" });
        await page.evaluate(() =>
          window.dispatchEvent(new Event("beforeprint")),
        );
        const text = await page.locator("body").innerText();
        if (provider === "MOCK") {
          assert.ok(text.includes("Mock •••• 4242"));
          assert.ok(!text.includes("Change $"));
        }
        if(provider === "SQUARE") { assert.ok(text.includes("VISA •••• 4242")); assert.ok(text.includes("Square Sandbox")); assert.ok(!text.includes("Change $")); }
        assert.ok(!text.includes("never-print-internal-id"));
        assert.ok(!text.includes("internal-item"));
        assert.ok(!text.includes("internal-location"));
        assert.equal(
          await page
            .locator(".receipt")
            .evaluate((e) => e.scrollWidth > e.clientWidth + 1),
          false,
        );
        const pdf = await page.pdf({
          path: `${dir}/${provider}-${width}-${count}.pdf`,
          preferCSSPageSize: true,
          printBackground: true,
        });
        const raw = pdf.toString("latin1");
        const pages = (raw.match(/\/Type\s*\/Page\b/g) ?? []).length;
        if (width !== "Letter") assert.equal(pages, 1);
        else assert.equal(pages, count === 1 ? 1 : 3);
        const box = raw.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/);
        assert.ok(box);
        assert.ok(
          Math.abs(
            (Number(box[1]) * 25.4) / 72 -
              (width === "Letter" ? 215.9 : Number(width)),
          ) < 0.5,
        );
        if (count === 1)
          await page.screenshot({
            path: `${dir}/${provider}-${width}.png`,
            fullPage: true,
          });
        console.log(
          `PASS ${provider} ${width} receipt, ${count} lines, ${pages} PDF page(s), no internal IDs or horizontal overflow`,
        );
      }
} finally {
  await browser.close();
}

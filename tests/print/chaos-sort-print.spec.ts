import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

const first = "00000000-0000-4000-8000-000000000001";
const second = "00000000-0000-4000-8000-000000000002";
const printPath = (id = first) => `/dashboard/inventory/chaos-sort/labels/${id}/print`;

test("the normal batch action leaves the full contents page and prints once after readiness", async ({ page }) => {
  await page.addInitScript(() => { Object.assign(window, { printCalls: 0 }); window.print = () => { (window as unknown as { printCalls: number }).printCalls++; }; });
  await page.goto(`/dashboard/inventory/batches/${first}`);
  await expect(page.locator("tbody tr")).toHaveCount(300);
  await expect.poll(() => page.getByRole("img", { name: /Label preview for/ }).evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.getByRole("link", { name: "Print label", exact: true }).click();
  await expect(page).toHaveURL(/\/labels\/[^/]+\/print\?.*autoprint=1/);
  await expect(page.locator("html")).toHaveAttribute("data-label-ready", "true");
  await expect.poll(() => page.evaluate(() => (window as unknown as { printCalls: number }).printCalls)).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("load")));
  await expect(page.locator(".chaos-sort-label-print-root")).toHaveCount(1);
  await expect(page.locator("iframe, table, nav")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { printCalls: number }).printCalls)).toBe(1);
  await page.goto(`/dashboard/inventory/batches/${second}`);
  await page.getByRole("link", { name: "Print label", exact: true }).click();
  await expect(page.locator(".chaos-sort-label-print-root")).toHaveAttribute("data-batch-id", second);
  await expect.poll(() => page.evaluate(() => (window as unknown as { printCalls: number }).printCalls)).toBe(1);
});

for (const [media, width, height] of [["dk1201", 29, 90], ["dk1208", 38, 90], ["dk1202", 62, 100], ["custom", 57.15, 31.75]] as const) {
  for (const position of ["top", "center", "bottom"]) test(`${media} ${position} produces exactly one correctly sized PDF page`, async ({ page }, info) => {
    await page.goto(`${printPath(second)}?media=${media}&width=${width}&height=${height}&position=${position}&copies=999&all=true`);
    await expect(page.locator("html")).toHaveAttribute("data-label-ready", "true");
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Print one label", exact: true })).toBeHidden();
    await expect(page.locator(".chaos-sort-label-print-root")).toHaveCount(1);
    const directory = ".local-fixtures/chaos-sort-print";
    await fs.mkdir(directory, { recursive: true });
    const pdf = await page.pdf({ path: `${directory}/${info.project.name}-${media}-${position}.pdf`, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
    const raw = pdf.toString("latin1");
    expect(raw.match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
    const box = raw.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
    expect(box).not.toBeNull();
    expect(Math.abs(Number(box![1]) / 72 * 25.4 - width)).toBeLessThan(0.5);
    expect(Math.abs(Number(box![2]) / 72 * 25.4 - height)).toBeLessThan(0.5);
  });
}

test("embedded preview never auto-prints, while an explicit reprint remains one label", async ({ page }) => {
  await page.addInitScript(() => { Object.assign(window, { printCalls: 0 }); window.print = () => { (window as unknown as { printCalls: number }).printCalls++; }; });
  await page.goto(`${printPath()}?preview=1&autoprint=1`);
  await expect(page.locator("html")).toHaveAttribute("data-label-ready", "true");
  expect(await page.evaluate(() => (window as unknown as { printCalls: number }).printCalls)).toBe(0);
  await page.goto(printPath());
  await page.getByRole("button", { name: "Print one label", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { printCalls: number }).printCalls)).toBe(1);
  await expect(page.locator(".chaos-sort-label-print-root")).toHaveCount(1);
});


test("automatic printing waits for fonts and only starts once", async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as unknown as { printCalls: number; releaseFonts: () => void };
    state.printCalls = 0;
    window.print = () => { state.printCalls++; };
    const ready = new Promise<void>(resolve => { state.releaseFonts = resolve; });
    Object.defineProperty(document.fonts, "ready", { value: ready });
  });
  await page.goto(`${printPath()}?autoprint=1`);
  expect(await page.evaluate(() => (window as unknown as { printCalls: number }).printCalls)).toBe(0);
  await expect(page.locator("#print-label")).toBeDisabled();
  await page.evaluate(() => (window as unknown as { releaseFonts: () => void }).releaseFonts());
  await expect.poll(() => page.evaluate(() => (window as unknown as { printCalls: number }).printCalls)).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("load")));
  expect(await page.evaluate(() => (window as unknown as { printCalls: number }).printCalls)).toBe(1);
});

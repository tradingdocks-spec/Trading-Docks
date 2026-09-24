import { test, expect, chromium } from "@playwright/test";
import { mock, pair } from "../helpers/mock-scanner-bridge";

test.beforeEach(async ({ request }) => { expect((await request.post("/api/reset-fixture")).ok()).toBe(true); });
async function draft(page: import("@playwright/test").Page) {
  const response = await page.request.post("/api/chaos-sort/scans", { data: { action: "create", payload: { requestId: crypto.randomUUID(), destinationId: "scanner-fixture-location", intakeMode: "upload" } } });
  expect(response.ok()).toBe(true);
  return response.json();
}
const selector = (page: import("@playwright/test").Page, name: string) => page.getByRole("button", { name, exact: true });
async function select(page: import("@playwright/test").Page, name: string) {
  await selector(page, name).click();
  await expect(selector(page, name)).toHaveAttribute("aria-pressed", "true");
  await expect(selector(page, name)).toBeEnabled();
}
test("synchronized existing draft switches cloud mode, preserves pairing, destination and identity across browsers", async ({ page }) => {
  const state = await mock(page); state.external = true;
  const album = await draft(page);
  const before = await (await page.request.get("/api/evidence")).json();
  await page.goto("/");
  for (const name of ["Live Scan", "Upload Images", "CSV"]) await expect(selector(page, name)).toBeEnabled();
  await select(page, "Live Scan");
  await expect(page.getByRole("heading", { name: "Live Scanner", exact: true })).toBeVisible();
  await pair(page);
  await select(page, "Upload Images");
  await expect(selector(page, "Add images")).toBeEnabled();
  await select(page, "Live Scan");
  await expect(page.getByRole("combobox", { name: "Installed scanner" })).toHaveValue("opaque-fixture");
  await expect(selector(page, "Start Live Scanning")).toBeEnabled();
  await page.reload();
  await expect(selector(page, "Live Scan")).toHaveAttribute("aria-pressed", "true");
  // A genuinely separate browser profile reads the same server mode, not localStorage.
  const second = await chromium.launch();
  try {
    const remote = await second.newPage();
    await remote.goto("http://127.0.0.1:4321/");
    await expect(selector(remote, "Live Scan")).toHaveAttribute("aria-pressed", "true");
    await select(remote, "CSV");
    await expect(selector(remote, "Add CSV")).toBeEnabled();
    await page.reload();
    await expect(selector(page, "CSV")).toHaveAttribute("aria-pressed", "true");
  } finally { await second.close(); }
  const after = await (await page.request.get("/api/chaos-sort/scans")).json();
  expect(after.album).toMatchObject({ id: album.id, batch_code: album.batch_code, intake_mode: "csv", destination_id: album.destination_id });
  expect(after.captures).toHaveLength(0);
  expect(await (await page.request.get("/api/evidence")).json()).toEqual(before);
});

test("pending/failed mode save never opens a local-only mode or starts intake", async ({ page }) => {
  await draft(page); await page.goto("/");
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/chaos-sort/scans", async route => {
    if (route.request().method() === "POST" && route.request().postDataJSON()?.action === "mode") {
      await held; await route.fulfill({ status: 409, json: { error: "SCAN_MODE_CONFLICT: reload cloud draft" } });
    } else await route.continue();
  });
  await selector(page, "Live Scan").click();
  await expect(selector(page, "Live Scan")).toBeDisabled();
  await expect(selector(page, "Upload Images")).toHaveAttribute("aria-pressed", "true");
  await expect(selector(page, "Add images")).toBeDisabled();
  release();
  await expect(page.getByText("SCAN_MODE_CONFLICT: reload cloud draft", { exact: true })).toBeVisible();
  await expect(selector(page, "Upload Images")).toBeEnabled();
  expect((await (await page.request.get("/api/chaos-sort/scans")).json()).album.intake_mode).toBe("upload");
});

test("staged uploads, active recognition and scanner commands block mode switches", async ({ page }) => {
  const state = await mock(page); state.hold = true;
  await draft(page); await page.goto("/");
  await expect(selector(page, "Add images")).toBeEnabled();
  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAHUlEQVQokWP4TyJgGNVABGAgRhEyGNVADKB9KAEAr639H8LdEzEAAAAASUVORK5CYII=", "base64");
  await page.locator('input[accept="image/jpeg,image/png,image/webp"]').setInputFiles({ name: "card.png", mimeType: "image/png", buffer: image });
  await expect(page.getByText("1 scans ready", { exact: true })).toBeVisible();
  for (const name of ["Live Scan", "Upload Images", "CSV"]) await expect(selector(page, name)).toBeDisabled();
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/purchasing/card-photo-scan", async route => { await held; await route.continue(); });
  await selector(page, "Start Batch").click();
  await expect(selector(page, "Live Scan")).toBeDisabled();
  release();
  await expect(selector(page, "Live Scan")).toBeEnabled({ timeout: 60_000 });
  await select(page, "Live Scan"); await pair(page);
  await selector(page, "Start Live Scanning").click();
  await expect(selector(page, "Pause Scanner")).toBeVisible();
  for (const name of ["Live Scan", "Upload Images", "CSV"]) await expect(selector(page, name)).toBeDisabled();
  await selector(page, "Pause Scanner").click();
  await expect(selector(page, "Upload Images")).toBeEnabled();
  await select(page, "Upload Images");
  expect((await (await page.request.get("/api/evidence")).json()).cards).toBe(0);
});

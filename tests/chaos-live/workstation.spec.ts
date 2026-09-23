import { test, expect, type Page } from "@playwright/test";
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=", "base64");
const fixture = (name = "card.png") => ({ name, mimeType: "image/png", buffer: image });
async function setup(page: Page) {
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.goto("/");
  await page.getByRole("combobox", { name: "Destination storage location", exact: true }).selectOption("scanner-fixture-location");
  await page.getByRole("button", { name: "Live Scan", exact: true }).click();
  await page.getByRole("button", { name: "Connect Scanner", exact: true }).click();
  await page.getByRole("button", { name: "Scanner Settings", exact: true }).click();
}
test("100-card station: history, review, exact capacity, real authoritative commit, next batch", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await setup(page);
  const baseline = await (await page.request.get("/api/evidence")).json();
  const history = page.getByRole("button", { name: /Batch History/ });
  await expect(history).toHaveAttribute("aria-expanded", "false");
  await history.click(); await expect(page.getByRole("link", { name: "Reprint label" })).toHaveAttribute("href", "/dashboard/inventory/batches/historical-fixture");
  await history.click(); await expect(history).toHaveAttribute("aria-expanded", "false");
  await page.getByLabel("Scanner image fixtures", { exact: true }).setInputFiles(Array.from({ length: 100 }, (_, n) => fixture(n === 99 ? "review.png" : `card-${n}.png`)));
  const started = Date.now();
  await page.getByRole("button", { name: "Resume Scanner", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100", { timeout: 90_000 });
  await expect(page.getByRole("button", { name: "Resume Scanner", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Scan One", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Resolve 1 Items", exact: true })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole("button", { name: "Resolve 1 Items", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).filter({ visible: true }).click();
  const commit = page.getByRole("button", { name: "Commit 100 Cards to Inventory", exact: true });
  await expect(commit).toBeEnabled();
  const posted = page.waitForRequest(request => request.method() === "POST" && request.url().endsWith("/api/chaos-sort"));
  await commit.click();
  const payload = (await posted).postDataJSON();
  await expect(page.getByRole("heading", { name: "100 cards added", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Scan One", exact: true })).toBeDisabled();
  const evidence = await page.request.get("/api/evidence");
  const after = { cards: baseline.cards + 100, positions: baseline.positions + 100, events: baseline.events + 100, batches: baseline.batches + 1, enabled: 0 };
  expect(await evidence.json()).toEqual(after);
  const replay = await page.request.post("/api/chaos-sort", { data: payload });
  // Current repaired RPC allocates the unique session before its closed-batch
  // replay check; it rejects this retry atomically instead of writing twice.
  expect(replay.status()).toBe(409);
  expect((await replay.json()).error).toContain("commit already exists or conflicted");
  expect(await (await page.request.get("/api/evidence")).json()).toEqual(after);
  const overCapacity = await page.request.post("/api/chaos-sort", { data: { ...payload, batch: { ...payload.batch, id: crypto.randomUUID(), batchCode: `CS-REJECT-${Date.now()}` }, items: [...payload.items, { ...payload.items[0], id: "extra-copy" }] } });
  expect(overCapacity.status()).toBe(400);
  expect(await (await page.request.get("/api/evidence")).json()).toEqual(after);
  console.log(`100 physical cards recognized/reviewed/committed in ${Date.now() - started} ms`);
  await page.getByRole("button", { name: "Start Next 100", exact: true }).first().click();
  await page.getByRole("button", { name: "Keep destination", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByRole("combobox", { name: "Destination storage location", exact: true })).toHaveValue("scanner-fixture-location");
  await expect(page.getByRole("button", { name: "Scan One", exact: true })).toBeEnabled();
  await expect(page.getByText("Scanner: Simulated scanner — not hardware", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
for (const size of [1, 25, 50]) test(`${size} sequential cards remain usable in the station`, async ({ page }) => {
  await setup(page); await page.getByLabel("Scanner image fixtures", { exact: true }).setInputFiles(fixture());
  for (let n = 0; n < size; n++) {
    await page.getByRole("button", { name: "Scan One", exact: true }).click();
    await expect(page.getByRole("button", { name: "Scan One", exact: true })).toBeEnabled();
  }
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", String(size));
  await expect(page.getByRole("button", { name: `Commit ${size} Cards to Inventory`, exact: true })).toBeEnabled();
});
test("test scan consumes no slot, auto-confirm opt-out and unknown printing correction stay inline", async ({ page }) => {
  await setup(page); await page.getByLabel("Scanner image fixtures", { exact: true }).setInputFiles(fixture());
  await page.getByRole("button", { name: "Test Scan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Test Scan", exact: true })).toBeEnabled();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  await page.getByRole("checkbox", { name: /Auto-confirm high confidence/ }).uncheck();
  await page.getByRole("button", { name: "Scan One", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resolve 1 Items", exact: true })).toBeEnabled();
  await page.getByLabel("Scanner image fixtures", { exact: true }).setInputFiles(fixture("unknown.png"));
  await page.getByRole("button", { name: "Scan One", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resolve 2 Items", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Correct / Review latest", exact: true }).click();
  await page.getByLabel("Search / correct printing").fill("Sol Ring");
  await page.getByRole("button", { name: "Find printings", exact: true }).click();
  await page.getByRole("button", { name: "Fixture Sol Ring · CMM #396", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole("button", { name: "Resolve 1 Items", exact: true })).toBeEnabled();
});
test("mobile retains CSV physical counts and location QR assignment", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/");
  await expect(page.getByRole("button", { name: /Batch History/ })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("textbox", { name: "Location QR value", exact: true }).fill("TDLOC:scanner-fixture-location");
  await page.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Destination storage location", exact: true })).toHaveValue("scanner-fixture-location");
  await page.locator('input[accept=".csv,text/csv"]').setInputFiles({ name: "cards.csv", mimeType: "text/csv", buffer: Buffer.from('name,set,collector number,quantity,condition,finish\nFixture Sol Ring,CMM,396,5,NM,nonfoil') });
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "5");
  await expect(page.getByRole("button", { name: "Commit 5 Cards to Inventory", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test("history preference persists and existing image upload still recognizes cards", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Batch History/ }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: /Batch History/ })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("combobox", { name: "Destination storage location", exact: true }).selectOption("scanner-fixture-location");
  await page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]').setInputFiles(fixture("upload-card.png"));
  await page.getByRole("button", { name: "Start Batch", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  await expect(page.getByRole("button", { name: "Commit 1 Cards to Inventory", exact: true })).toBeEnabled();
});

test("capture failure, jam, disconnect, pause, rescan and removal preserve a draft", async ({ page }) => {
  await setup(page);
  await page.getByLabel("Scanner image fixtures", { exact: true }).setInputFiles(fixture());
  await page.getByRole("button", { name: "Scan One", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  await expect(page.getByRole("button", { name: "Scan One", exact: true })).toBeEnabled();
  for (const scenario of ["failure", "jam", "disconnect"]) {
    await page.getByRole("combobox", { name: "Simulation scenario" }).selectOption(scenario);
    await page.getByRole("button", { name: "Scan One", exact: true }).click();
    await expect(page.getByRole("button", { name: /^(Reconnect|Connect Scanner)$/ })).toBeEnabled();
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    await page.getByRole("button", { name: /^(Reconnect|Connect Scanner)$/ }).click();
  }
  await page.getByRole("combobox", { name: "Simulation scenario" }).selectOption("slow");
  await page.getByRole("button", { name: "Resume Scanner", exact: true }).click();
  await page.getByRole("button", { name: "Pause Scanner", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resume Scanner", exact: true })).toBeEnabled();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  await page.getByRole("combobox", { name: "Simulation scenario" }).selectOption("duplicate");
  await page.getByRole("button", { name: "Rescan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Scan One", exact: true })).toBeEnabled();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  await page.getByRole("button", { name: "Scan One", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
  await expect(page.getByRole("button", { name: "Remove latest", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Remove latest", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
});

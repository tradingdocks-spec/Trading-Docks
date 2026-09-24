import { test, expect, chromium } from "@playwright/test";
import { mock, open, pair } from "../helpers/mock-scanner-bridge";
test("private scan album: 100 uploads, review, immutable commit, print gate, next batch retains connection", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  page.on("response", async response => { if (response.url().includes("/api/chaos-sort/scans") && response.status() >= 400) console.log("ALBUM ERROR", await response.text()); });
  const state = await mock(page); state.external = true;
  let scans = 0;
  const reviewed = new Set<string>(); let lost = false;
  await page.route("**/api/chaos-sort/scans", async route => {
    const request = route.request();
    if (request.headers()["content-type"]?.includes("application/json")) {
      const body = request.postDataJSON();
      if (body.action === "review") {
        reviewed.add(body.payload.captureId);
        if (reviewed.size === 10 && !lost) { lost = true; await route.fetch(); await route.abort("connectionreset"); return; }
      }
    }
    await route.continue();
  });
  await page.route("**/api/purchasing/card-photo-scan", async route => {
    const response = await route.fetch(); const body = await response.json();
    if (++scans === 100) { body.requiresConfirmation = true; body.identification.confidence = 0.6; }
    await route.fulfill({ response, json: body });
  });
  await open(page); await pair(page);
  await page.getByRole("button", { name: "Start Live Scanning", exact: true }).click();
  await expect.poll(() => lost, { timeout: 60_000 }).toBe(true);
  await expect(page.getByRole("button", { name: "Start Live Scanning", exact: true })).toBeEnabled();
  expect(state.captures).toBe(10); expect(state.ack).toBe(9);
  await page.reload();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "10");
  await expect(page.getByRole("button", { name: "Recover pending capture", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Recover pending capture", exact: true }).click();
  await expect.poll(() => state.ack).toBe(10);
  expect(state.captures).toBe(10);
  await page.getByRole("button", { name: "Start Live Scanning", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100", { timeout: 240_000 });
  await expect(page.getByRole("button", { name: "Scan One", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Resolve 1 Items", exact: true })).toBeEnabled();
  expect(state.captures).toBe(100); expect(state.ack).toBe(100);
  const evidence = await (await page.request.get("/api/evidence")).json();
  expect(evidence).toMatchObject({ captures: 100, objects: 100, cards: 0, closed: 0 });
  const id = (await (await page.request.get("/api/chaos-sort/scans")).json()).album.id;
  const album = await (await page.request.get(`/api/chaos-sort/scans?batchId=${id}`)).json();
  expect(album.captures).toHaveLength(100); expect(new Set(album.captures.map((c: { capture_id: string }) => c.capture_id)).size).toBe(100);
  const source = await page.request.get(`/api/chaos-sort/scans?captureId=${album.captures[0].capture_id}`);
  expect(source.ok()).toBe(true); expect(source.headers()["content-type"]).toBe("image/jpeg"); expect(source.headers()["cache-control"]).toContain("private");
  const overflow = await page.request.post("/api/chaos-sort/scans", { multipart: { batchId: id!, captureId: crypto.randomUUID(), image: { name: "overflow.jpg", mimeType: "image/jpeg", buffer: await source.body() } } });
  expect(overflow.status()).toBe(409); expect((await overflow.json()).error).toContain("SCAN_BATCH_FULL");
  await page.getByRole("button", { name: "Resolve 1 Items", exact: true }).click(); await page.getByRole("button", { name: "Confirm", exact: true }).filter({ visible: true }).click();
  await page.getByRole("button", { name: "Commit 100 Cards to Inventory", exact: true }).click();
  await expect(page.getByRole("heading", { name: "100 cards added", exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("link", { name: "Print Batch Label", exact: true })).toHaveAttribute("href", `/dashboard/inventory/chaos-sort/labels/${id}/print`);
  await expect(page.getByRole("button", { name: "Start Next 100", exact: true })).toHaveCount(0);
  const closed = await page.request.post("/api/chaos-sort/scans", { data: { action: "review", payload: { batchId: id, captureId: album.captures[0].capture_id, item: album.captures[0].item } } }); expect(closed.status()).toBe(409);
  await page.getByRole("button", { name: "Label printed and batch filed", exact: true }).click();
  state.hold = true;
  await page.getByRole("button", { name: "Start Next 100", exact: true }).first().click(); await page.getByRole("button", { name: "Keep destination", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByRole("combobox", { name: "Installed scanner" })).toHaveValue("opaque-fixture");
  await expect(page.getByRole("combobox", { name: "Destination storage location", exact: true })).toHaveValue("scanner-fixture-location");
  await expect.poll(async () => (await (await page.request.get("/api/chaos-sort/scans")).json()).album?.id).not.toBe(id);
  expect(await (await page.request.get("/api/evidence")).json()).toMatchObject({ captures: 100, objects: 100, cards: 100, closed: 1 });
  await page.getByRole("button", { name: "Pause Scanner", exact: true }).click();
  // The next draft survives losing the entire originating browser profile.
  const nextId = (await (await page.request.get("/api/chaos-sort/scans")).json()).album.id;
  for (let index = 0; index < 42; index++) {
    const uploaded = await page.request.post("/api/chaos-sort/scans", { multipart: { batchId: nextId, captureId: crypto.randomUUID(), image: { name: `${index}.jpg`, mimeType: "image/jpeg", buffer: await source.body() } } });
    expect(uploaded.ok()).toBe(true);
  }
  for (const channel of ["chrome", "msedge"] as const) {
    const browser = await chromium.launch({ channel });
    try {
      const remote = await browser.newPage();
      await remote.goto("http://127.0.0.1:4321/");
      await expect(remote.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
      expect(await remote.evaluate(() => localStorage.getItem("td-chaos-sort-batch-sequence"))).toBeNull();
      expect(await remote.evaluate(() => localStorage.getItem("td.chaos.album.v2"))).toBeNull();
      const resumed = await (await remote.request.get("http://127.0.0.1:4321/api/chaos-sort/scans")).json();
      expect(resumed.album.id).toBe(nextId); expect(resumed.physicalCount).toBe(42);
    } finally { await browser.close(); }
  }

  state.offline = true;
  const fortyThree = await page.request.post("/api/chaos-sort/scans", { multipart: { batchId: nextId, captureId: crypto.randomUUID(), image: { name: "43.jpg", mimeType: "image/jpeg", buffer: await source.body() } } });
  expect(fortyThree.ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "43");
  state.offline = false;
  await page.reload();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "43");
  const pending = await (await page.request.get("/api/chaos-sort/scans")).json();
  for (const capture of pending.captures) {
    const item = { ...album.captures[0].item, id: capture.capture_id, captureId: capture.capture_id, batchId: nextId, humanState: "confirmed", processingState: "ready" };
    expect((await page.request.post("/api/chaos-sort/scans", { data: { action: "review", payload: { batchId: nextId, captureId: capture.capture_id, item, revision: 0 } } })).ok()).toBe(true);
  }
  expect((await page.request.post("/api/chaos-sort/scans", { data: { action: "commit", payload: { batchId: nextId } } })).ok()).toBe(true);
  expect((await page.request.post("/api/chaos-sort/scans", { data: { action: "label", payload: { batchId: nextId } } })).ok()).toBe(true);
  const csvAlbum = await (await page.request.post("/api/chaos-sort/scans", { data: { action: "create", payload: { requestId: crypto.randomUUID(), destinationId: "scanner-fixture-location", intakeMode: "csv" } } })).json();
  await page.reload();
  await expect(page.getByRole("button", { name: "CSV", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.locator("summary").filter({ hasText: "Batch summary" }).click();
  await page.getByLabel("Batch title", { exact: true }).fill("Persisted CSV draft");
  await page.getByLabel("Acquisition cost", { exact: true }).fill("2.50");
  await page.locator('input[accept=".csv,text/csv"]').setInputFiles({ name: "cloud.csv", mimeType: "text/csv", buffer: Buffer.from("name,set,collector_number,quantity,condition,finish,language\nCloud CSV,KTK,204,2,NM,nonfoil,en") });
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
  await expect.poll(async () => (await (await page.request.get("/api/chaos-sort/scans")).json()).album.settings.title).toBe("Persisted CSV draft");
  await page.reload();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
  await page.locator("summary").filter({ hasText: "Batch summary" }).click();
  await expect(page.getByLabel("Batch title", { exact: true })).toHaveValue("Persisted CSV draft");
  await expect(page.getByLabel("Acquisition cost", { exact: true })).toHaveValue("2.5");
  await expect(page.getByRole("button", { name: "CSV", exact: true })).toHaveAttribute("aria-pressed", "true");
  const csvSnapshot = await (await page.request.get("/api/chaos-sort/scans")).json();
  expect(csvSnapshot.album.id).toBe(csvAlbum.id);
  expect(csvSnapshot.captures.every((capture: { item: { language: string }; source_kind: string }) => capture.source_kind === "csv" && capture.item.language === "en")).toBe(true);
  await page.screenshot({ path: ".local-fixtures/cloud-authority-workstation.png", fullPage: true });
  expect(errors).toEqual([]);
});

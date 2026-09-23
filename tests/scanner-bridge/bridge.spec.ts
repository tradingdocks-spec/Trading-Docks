import { test, expect, type Page } from "@playwright/test";
import { createPublicKey, verify, createHash } from "node:crypto";
const validImage = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=";
async function mock(page: Page) {
  page.on("console", m => { if (m.type() === "error") console.log("BROWSER:", m.text()); });
  page.on("requestfailed", r => console.log("REQUEST:", r.url(), r.failure()?.errorText));
  const state = { captures: 0, ack: 0, version: 1, offline: false, missing: false, fail: "", cancelled: 0, hold: false };
  let key: ReturnType<typeof createPublicKey>, challenge: string;
  const ids = new Map<string, string>(), nonces = new Set<string>(), acknowledged = new Set<string>();
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.route("https://127.0.0.1:47391/**", async route => {
    if (state.offline) return route.abort("connectionrefused");
    const request = route.request(), path = new URL(request.url()).pathname, body = request.postData() ?? "", data = body ? JSON.parse(body) : {};
    const headers = request.headers();
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json, headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:4320", "Cache-Control": "no-store" } });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:4320", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,X-TD-Credential,X-TD-Timestamp,X-TD-Nonce,X-TD-Proof" } });
    expect(headers.origin).toBe("http://127.0.0.1:4320");
    if (path === "/v1/health") return reply({ running: true, bridgeVersion: "1.0.0", protocolVersion: state.version });
    if (path === "/v1/pair/start") { key = createPublicKey({ key: Buffer.from(data.publicKey, "base64"), format: "der", type: "spki" }); challenge = data.challenge; return reply({ id: "mock-local-approved" }); }
    if (path === "/v1/pair/finish") { expect(data.challenge).toBe(challenge); return data.code === "123456" ? reply({ credentialId: "browser-fixture", workstationId: "mock-local", expires: new Date(Date.now() + 86400000).toISOString() }) : reply({ error: "PAIR_EXPIRED_OR_INVALID" }, 403); }
    expect(headers["x-td-credential"]).toBe("browser-fixture");
    const nonce = headers["x-td-nonce"]; expect(nonces.has(nonce)).toBe(false); nonces.add(nonce);
    const canonical = `${request.method()}\n${path}\n${headers["x-td-timestamp"]}\n${nonce}\n${createHash("sha256").update(body).digest("hex")}`;
    expect(verify("sha256", Buffer.from(canonical), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(headers["x-td-proof"], "base64"))).toBe(true);
    if (path === "/v1/devices") return reply({ devices: state.missing ? [] : [{ id: "opaque-fixture", displayName: "Mock WIA scanner", manufacturer: "Fixture", model: "Protocol simulator", connection: "USB (simulated)", backend: "WIA mock", capabilities: { dpi: [300, 600], sources: ["flatbed", "feeder"], colorModes: ["color"], duplex: false, autoCrop: false } }] });
    if (path === "/v1/capture") { if (!ids.has(data.requestId)) { ids.set(data.requestId, crypto.randomUUID()); state.captures++; } return reply({ captureId: ids.get(data.requestId) }); }
    if (path.endsWith("/ack")) { if (!acknowledged.has(path)) { state.ack++; acknowledged.add(path); } return reply({ ok: true }); }
    if (path.endsWith("/cancel")) { state.cancelled++; return reply({ ok: true }); }
    if (path.startsWith("/v1/capture/")) return reply(state.fail ? { status: "failed", error: state.fail } : state.hold ? { status: "capturing" } : { status: "ready", image: validImage, mimeType: "image/png", width: 1, height: 1 });
    return reply({ ok: true });
  });
  return state;
}
async function open(page: Page) { await page.goto("/"); await page.getByRole("combobox", { name: "Destination storage location", exact: true }).selectOption("scanner-fixture-location"); await page.getByRole("button", { name: "Live Scan", exact: true }).click(); }
async function pair(page: Page) {
  await page.getByRole("button", { name: "Pair this workstation", exact: true }).click();
  await page.getByLabel("One-time pairing code").fill("123456"); await page.getByRole("button", { name: "Confirm pairing", exact: true }).click();
  await page.getByRole("combobox", { name: "Installed scanner" }).selectOption("opaque-fixture");
  await expect(page.getByRole("button", { name: "Test Scan", exact: true })).toBeEnabled();
}
test("signed bridge protocol: pairing, profiles, test scan, 100 cards, review, real commit, next batch", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const state = await mock(page); await open(page); await pair(page);
  const baseline = await (await page.request.get("/api/evidence")).json();
  await page.getByRole("combobox", { name: "Scanner profile" }).selectOption("quality"); await expect(page.getByText(/600 DPI/)).toBeVisible();
  await page.getByRole("button", { name: "Scanner Settings", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Scanner DPI" })).toHaveValue("600"); await expect(page.getByRole("checkbox", { name: "Duplex", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Test Scan", exact: true }).click(); await expect(page.getByRole("button", { name: "Looks Good", exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0"); await page.getByRole("button", { name: "Looks Good", exact: true }).click();
  let recognized = 0;
  await page.route("**/api/purchasing/card-photo-scan", async route => { const response = await route.fetch(); const result = await response.json(); recognized++; if (recognized === 100) result.requiresConfirmation = true; await route.fulfill({ response, json: result }); });
  await page.getByRole("button", { name: "Start Live Scanning", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100", { timeout: 120_000 });
  await expect(page.getByRole("button", { name: "Start Live Scanning", exact: true })).toBeDisabled(); await expect(page.getByRole("button", { name: "Scan One", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Resolve 1 Items", exact: true })).toBeEnabled(); await page.getByRole("button", { name: "Resolve 1 Items", exact: true }).click(); await page.getByRole("button", { name: "Confirm", exact: true }).filter({ visible: true }).click();
  expect(state.captures).toBe(101); expect(state.ack).toBe(101);
  await page.getByRole("button", { name: "Commit 100 Cards to Inventory", exact: true }).click(); await expect(page.getByRole("heading", { name: "100 cards added", exact: true })).toBeVisible({ timeout: 30_000 });
  expect(await (await page.request.get("/api/evidence")).json()).toEqual({ cards: baseline.cards + 100, positions: baseline.positions + 100, events: baseline.events + 100, batches: baseline.batches + 1, enabled: 0 });
  await page.getByRole("button", { name: "Start Next 100", exact: true }).first().click(); await page.getByRole("button", { name: "Keep destination", exact: true }).click(); await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByRole("combobox", { name: "Installed scanner" })).toHaveValue("opaque-fixture"); expect(errors).toEqual([]);
});
test("remembered scanner, missing device, jam, cancellation and disconnect retain draft", async ({ page }) => {
  const state = await mock(page); await open(page); await pair(page); await page.reload(); await page.getByRole("button", { name: "Live Scan", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Installed scanner" })).toHaveValue("opaque-fixture");
  await page.getByRole("combobox", { name: "Destination storage location", exact: true }).selectOption("scanner-fixture-location");
  await page.getByRole("button", { name: "Scan One", exact: true }).click(); await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1"); await expect(page.getByRole("button", { name: "Scan One", exact: true })).toBeEnabled();
  state.fail = "PAPER_JAM"; await page.getByRole("button", { name: "Scan One", exact: true }).click(); await expect(page.getByText(/Paper\/card jam/)).toBeVisible(); state.fail = "";
  state.hold = true; await page.getByRole("button", { name: "Start Live Scanning", exact: true }).click(); await page.getByRole("button", { name: "Cancel Current Scan", exact: true }).click(); await expect(page.getByRole("button", { name: "Scan One", exact: true })).toBeEnabled(); expect(state.cancelled).toBeGreaterThan(0); state.hold = false;
  state.missing = true; await page.getByRole("button", { name: "Refresh Devices", exact: true }).click(); await expect(page.getByText(/Previously selected scanner not found/)).toBeVisible(); await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  state.missing = false; await page.getByRole("button", { name: "Refresh Devices", exact: true }).click(); await expect(page.getByRole("button", { name: "Scan One", exact: true })).toBeEnabled();
  state.offline = true; await page.getByRole("button", { name: "Scan One", exact: true }).click(); await expect(page.getByText(/not reachable/)).toBeVisible(); await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
});
test("absent and incompatible bridge preserve Upload and CSV", async ({ page }) => {
  const state = await mock(page); state.offline = true; await open(page); await expect(page.getByText("Connect a physical scanner", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Upload Images", exact: true }).click(); await expect(page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]')).toHaveCount(1);
  state.offline = false; state.version = 0; await page.getByRole("button", { name: "Live Scan", exact: true }).click(); await expect(page.getByText("Scanner Bridge update required.", { exact: true })).toBeVisible();
});
test("mobile device selection and settings fit the workstation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await mock(page); await open(page); await pair(page);
  await page.getByRole("button", { name: "Scanner Settings", exact: true }).click();
  await page.getByRole("combobox", { name: "Scanner DPI" }).selectOption("600");
  await expect(page.getByRole("combobox", { name: "Scanner profile" })).toHaveValue("custom");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("combobox", { name: "Installed scanner" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".playwright-results/scanner-bridge-mobile.png" });
});

import { expect, type Page } from "@playwright/test";
import { createPublicKey, verify, createHash } from "node:crypto";
const validImage = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAHUlEQVQokWP4TyJgGNVABGAgRhEyGNVADKB9KAEAr639H8LdEzEAAAAASUVORK5CYII=";
export async function mock(page: Page) {
  page.on("console", m => { if (m.type() === "error") console.log("BROWSER:", m.text()); });
  page.on("requestfailed", r => console.log("REQUEST:", r.url(), r.failure()?.errorText));
  const cancelledIds = new Set<string>();
  const state = { captures: 0, ack: 0, version: 1, offline: false, missing: false, fail: "", cancelled: 0, hold: false, external: false };
  let key: ReturnType<typeof createPublicKey>, challenge: string;
  const ids = new Map<string, string>(), nonces = new Set<string>(), acknowledged = new Set<string>();
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.route("https://127.0.0.1:47391/**", async route => {
    if (state.offline) return route.abort("connectionrefused");
    const request = route.request(), path = new URL(request.url()).pathname, body = request.postData() ?? "", data = body ? JSON.parse(body) : {};
    const headers = request.headers();
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json, headers: { "Access-Control-Allow-Origin": new URL(page.url()).origin, "Cache-Control": "no-store" } });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": new URL(page.url()).origin, "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,X-TD-Credential,X-TD-Timestamp,X-TD-Nonce,X-TD-Proof" } });
    expect(headers.origin).toBe(new URL(page.url()).origin);
    if (path === "/v1/health") return reply({ running: true, bridgeVersion: "1.2.0", protocolVersion: state.version, automaticInbox: true });
    if (path === "/v1/pair/start") { key = createPublicKey({ key: Buffer.from(data.publicKey, "base64"), format: "der", type: "spki" }); challenge = data.challenge; return reply({ id: "mock-local-approved" }); }
    if (path === "/v1/pair/finish") { expect(data.challenge).toBe(challenge); return data.code === "123456" ? reply({ credentialId: "browser-fixture", workstationId: "mock-local", expires: new Date(Date.now() + 86400000).toISOString() }) : reply({ error: "PAIR_EXPIRED_OR_INVALID" }, 403); }
    expect(headers["x-td-credential"]).toBe("browser-fixture");
    const nonce = headers["x-td-nonce"]; expect(nonces.has(nonce)).toBe(false); nonces.add(nonce);
    const canonical = `${request.method()}\n${path}\n${headers["x-td-timestamp"]}\n${nonce}\n${createHash("sha256").update(body).digest("hex")}`;
    expect(verify("sha256", Buffer.from(canonical), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(headers["x-td-proof"], "base64"))).toBe(true);
    if (path === "/v1/devices") return reply({ devices: state.missing ? [] : [{ id: "opaque-fixture", displayName: state.external ? "ScanSnap iX500 (mock)" : "Mock WIA scanner", manufacturer: "Fixture", model: "Protocol simulator", connection: "USB (simulated)", backend: state.external ? "SCANSNAP" : "WIA mock", capabilities: { dpi: state.external ? [300] : [300, 600], sources: state.external ? ["feeder"] : ["flatbed", "feeder"], colorModes: ["color"], duplex: false, autoCrop: false, externalSettings: state.external, captureInstruction: state.external ? "Waiting for ScanSnap: place card in feeder and press Scan on the iX500. Save to the exact capture destination shown in the local bridge window." : undefined } }] });
    if (path === "/v1/capture") { if (!ids.has(data.requestId)) { ids.set(data.requestId, crypto.randomUUID()); state.captures++; } return reply({ captureId: ids.get(data.requestId) }); }
    if (path.endsWith("/ack")) { if (!acknowledged.has(path)) { state.ack++; acknowledged.add(path); } return reply({ ok: true }); }
    if (path.endsWith("/cancel")) { if (state.hold) cancelledIds.add(path.split("/")[3]); state.cancelled++; return reply({ ok: true }); }
    if (path.startsWith("/v1/capture/")) return reply(cancelledIds.has(path.split("/")[3]) ? { status: "cancelled", error: "CAPTURE_CANCELLED" } : state.fail ? { status: "failed", error: state.fail } : state.hold ? { status: "capturing" } : { status: "ready", image: validImage, mimeType: "image/png", width: 1, height: 1 });
    return reply({ ok: true });
  });
  return state;
}
export async function open(page: Page) { await page.goto("/"); await page.getByRole("combobox", { name: "Destination storage location", exact: true }).selectOption("scanner-fixture-location"); await page.getByRole("button", { name: "Live Scan", exact: true }).click(); }
export async function pair(page: Page) {
  await page.getByRole("button", { name: "Pair this workstation", exact: true }).click();
  await page.getByLabel("One-time pairing code").fill("123456"); await page.getByRole("button", { name: "Confirm pairing", exact: true }).click();
  await page.getByRole("combobox", { name: "Installed scanner" }).selectOption("opaque-fixture");
  await expect(page.getByRole("button", { name: "Test Scan", exact: true })).toBeEnabled();
}

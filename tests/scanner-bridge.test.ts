import test from "node:test";
import assert from "node:assert/strict";
import { TradingDocksLocalScannerProvider, defaultScanSettings, type BridgeStorage } from "../src/lib/chaos-sort/local-scanner-provider.ts";

const caps = { dpi: [300, 600], colorModes: ["color"], sources: ["flatbed"], duplex: false, autoCrop: false, cancelCapture: false };
function fixture(cancelledStatus?: "cancelled" | "ready" | "interrupted" | "unreachable") {
  let credential: Awaited<ReturnType<BridgeStorage["get"]>>;
  const storage: BridgeStorage = { get: async () => credential, set: async value => { credential = value; }, clear: async () => { credential = undefined; } };
  const requests: { path: string; body: Record<string, unknown>; headers: Headers }[] = [];
  let publicKey: CryptoKey, pairChallenge: string;
  let captures = 0, ackFailure = false, startFailure = false, version = 1, cancelled = false, deviceAvailable = true;
  const captureIds = new Map<string, string>();
  const nonces = new Set<string>();
  const request: typeof fetch = async (url, init) => {
    const path = new URL(String(url)).pathname, headers = new Headers(init?.headers), raw = String(init?.body ?? ""), body = raw ? JSON.parse(raw) : {};
    requests.push({ path, body, headers });
    assert.equal(new URL(String(url)).origin, "https://127.0.0.1:47391"); assert.equal(init?.credentials, "omit"); assert.equal(init?.redirect, "error");
    const respond = (data: unknown, status = 200) => Response.json(data, { status });
    if (path === "/v1/health") return respond({ running: true, protocolVersion: version, bridgeVersion: "1.0.0" });
    if (path === "/v1/pair/start") { pairChallenge = body.challenge; publicKey = await crypto.subtle.importKey("spki", Buffer.from(body.publicKey, "base64"), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]); return respond({ id: "pair" }); }
    if (path === "/v1/pair/finish") { assert.equal(body.challenge, pairChallenge); return body.code === "123456" ? respond({ credentialId: "credential", expires: new Date(Date.now() + 86400000).toISOString(), workstationId: "local-test" }) : respond({ error: "PAIR_EXPIRED_OR_INVALID" }, 403); }
    assert.equal(headers.get("X-TD-Credential"), "credential");
    const nonce = headers.get("X-TD-Nonce")!; assert.match(nonce, /^[a-f0-9]{64}$/); assert.equal(nonces.has(nonce), false); nonces.add(nonce);
    const digest = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw))).toString("hex");
    const canonical = `${init?.method}\n${path}\n${headers.get("X-TD-Timestamp")}\n${nonce}\n${digest}`;
    assert.equal(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, Buffer.from(headers.get("X-TD-Proof")!, "base64"), new TextEncoder().encode(canonical)), true);
    if (path === "/v1/devices") return respond({ devices: deviceAvailable ? [{ id: "opaque", displayName: "Fixture WIA", manufacturer: "Fixture", model: "Mock", connection: "Driver-managed", backend: "WIA", capabilities: caps }] : [] });
    if (path === "/v1/capture") { if (!captureIds.has(body.requestId)) { captures++; captureIds.set(body.requestId, crypto.randomUUID()); } if (startFailure) { startFailure = false; throw new TypeError("response lost"); } return respond({ captureId: captureIds.get(body.requestId) }); }
    if (path.endsWith("/ack")) { if (ackFailure) { ackFailure = false; throw new TypeError("ack response lost"); } return respond({ ok: true }); }
    if (path.endsWith("/cancel")) { cancelled = true; return respond({ ok: true }); }
    if (path.startsWith("/v1/capture/")) {
      if (cancelledStatus && !cancelled) provider.cancelCapture();
      if (cancelledStatus === "unreachable") throw new TypeError("response lost");
      return deviceAvailable ? respond({ status: cancelledStatus ?? "ready", image: "aW1hZ2U=", mimeType: "image/png", width: 600, height: 800 }) : respond({ status: "failed", error: "DEVICE_OFFLINE" });
    }
    return respond({ ok: true });
  };
  const provider = new TradingDocksLocalScannerProvider(storage, request);
  const connect = async () => { await provider.startPairing(); await provider.finishPairing("123456"); const [device] = await provider.detect(); await provider.selectDevice(device); await provider.connect(); };
  return { provider, storage, requests, connect, reload: () => new TradingDocksLocalScannerProvider(storage, request), count: () => captures, credential: () => credential, cancelled: () => cancelled, loseAck: () => { ackFailure = true; }, loseStart: () => { startFailure = true; }, oldVersion: () => { version = 0; }, disconnectDevice: () => { deviceAvailable = false; } };
}
test("bridge pairs with nonextractable proof key, remembers local device, captures and acknowledges", async () => {
  const f = fixture(); await f.connect(); assert.equal(f.credential()?.privateKey.extractable, false);
  assert.equal(await f.provider.rememberedDevice(), "opaque"); const image = await f.provider.capture(); assert.equal(image.file.type, "image/png"); assert.equal(f.count(), 1);
  assert.ok(f.requests.some(r => r.path.endsWith("/ack"))); await f.provider.unpair(); assert.equal(await f.provider.paired(), false);
});
test("lost capture response reuses original request and never rescans", async () => {
  const f = fixture(); await f.connect(); f.loseStart(); await assert.rejects(f.provider.capture(), /not reachable/);
  await f.provider.connect(); await f.provider.capture(); assert.equal(f.count(), 1);
  const starts = f.requests.filter(r => r.path === "/v1/capture"); assert.deepEqual(starts[0].body, starts[1].body);
});
test("lost acknowledgement still delivers captured image once and retries ack before next scan", async () => {
  const f = fixture(); await f.connect(); f.loseAck(); const first = await f.provider.capture(); assert.equal(first.file.size, 5);
  await f.provider.connect(); const next = await f.provider.capture(); assert.notEqual(first.captureId, next.captureId); assert.equal(f.count(), 2);
  assert.equal(f.requests.filter(r => r.path.endsWith(`/${first.captureId}/ack`)).length, 2);
});
test("unpaired browser cannot invoke device enumeration", async () => { const f = fixture(); await assert.rejects(f.provider.detect(), /expired or was revoked/); assert.equal(f.requests.length, 0); });
test("incompatible bridge rejected before capture", async () => { const f = fixture(); f.oldVersion(); await assert.rejects(f.provider.health(), /update required/); assert.equal(f.count(), 0); });
test("wrong pairing code cannot establish trust", async () => { const f = fixture(); await f.provider.startPairing(); await assert.rejects(f.provider.finishPairing("000000"), /incorrect/); assert.equal(await f.provider.paired(), false); });
test("profiles negotiate available capabilities and unsupported duplex stays blocked", async () => {
  const f = fixture(); await f.connect(); assert.equal(defaultScanSettings(caps).dpi, 300); assert.equal(defaultScanSettings(caps, true).dpi, 600);
  assert.throws(() => f.provider.configure({ settings: { ...defaultScanSettings(caps), duplex: true } }), /does not support/);
});
test("cancelled input starts no hardware capture", async () => { const f = fixture(); await f.connect(); const abort = new AbortController(); abort.abort(); await assert.rejects(f.provider.capture(abort.signal), /cancelled/); assert.equal(f.count(), 0); });
test("agent reports disconnect during capture and disables the next scan", async () => {
  const f = fixture(); await f.connect(); f.disconnectDevice();
  await assert.rejects(f.provider.capture(), /disconnected/);
  assert.equal(f.provider.getStatus(), "disconnected");
  assert.deepEqual(await f.provider.detect(), []);
  assert.equal(f.provider.getStatus(), "disconnected");
});

const recoverySession = { id: "album", userId: "user", workspaceId: "workspace", batchId: "batch", destinationId: "destination", workstationId: "local-test", deviceId: "opaque", limit: 100 as const };
for (const status of ["cancelled", "ready", "interrupted", "unreachable"] as const) {
  test(`cancel recovery persists only when agent status ${status} is not terminal cancellation`, async () => {
    const f = fixture(status); await f.connect(); await f.provider.startSession(recoverySession);
    await assert.rejects(f.provider.capture());
    assert.equal(await f.provider.hasPendingCapture(), status !== "cancelled");
    const next = await reloadConnected(f);
    assert.equal(await next.hasPendingCapture(), status !== "cancelled");
  });
}
async function reloadConnected(f: ReturnType<typeof fixture>) {
  const provider = f.reload(); const [device] = await provider.detect(); await provider.selectDevice(device); await provider.connect(); return provider;
}
test("browser reload recovers persisted request without new capture and denies another workspace", async () => {
  const f = fixture(); await f.connect(); await f.provider.startSession(recoverySession); f.loseStart(); await assert.rejects(f.provider.capture());
  const next = await reloadConnected(f); assert.equal(await next.hasPendingCapture(), true);
  await assert.rejects(next.startSession({ ...recoverySession, workspaceId: "other" }), /another batch or workspace/);
  await next.startSession(recoverySession); const image = await next.recoverPendingCapture(); assert.ok(image); assert.equal(image.preview, false); assert.equal(f.count(), 1);
  await next.acknowledge(image.captureId); assert.equal(await next.hasPendingCapture(), false);
});
test("recovered test scan stays preview-only with original session identity", async () => {
  const f = fixture(); await f.connect(); await f.provider.startSession({ ...recoverySession, id: "preview-session", preview: true }); f.loseStart(); await assert.rejects(f.provider.capture());
  const next = await reloadConnected(f); await next.startSession(recoverySession);
  const image = await next.recoverPendingCapture(); assert.equal(image?.preview, true); assert.equal(f.credential()?.liveSession?.id, "preview-session"); assert.equal(f.count(), 1);
});
test("cloud accepted capture with lost ack retries only acknowledgement after browser reload", async () => {
  const f = fixture(); await f.connect(); await f.provider.startSession(recoverySession); const image = await f.provider.capture(); f.loseAck(); await assert.rejects(f.provider.acknowledge(image.captureId));
  const next = await reloadConnected(f); await next.startSession(recoverySession); assert.equal(await next.recoverPendingCapture(), null); assert.equal(f.count(), 1); assert.equal(await next.hasPendingCapture(), false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { issueCapturePermit } from "../src/lib/chaos-sort/capture-permit.ts";
const scope = { userId: "user", workspaceId: "workspace", batchId: "batch", workstationId: "workstation", sessionId: "session", destinationId: "location", deviceId: "device", captureId: "capture", purpose: "capture" as const };
test("cloud permit signs all scope fields with a two-minute lifetime and distinct acknowledgement purpose", () => {
  const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pem = keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const [payload, signature] = issueCapturePermit(scope, pem, 100000).split(".");
  assert.equal(verify("sha256", Buffer.from(payload), { key: keys.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url")), true);
  assert.deepEqual(JSON.parse(Buffer.from(payload, "base64url").toString()), { ...scope, audience: "trading-docks-scanner", issuedAt: 100, expiresAt: 220 });
  const ack = issueCapturePermit({ ...scope, purpose: "ack" }, pem, 100000); assert.notEqual(ack, `${payload}.${signature}`);
  assert.equal(verify("sha256", Buffer.from(payload + "A"), { key: keys.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url")), false);
});
test("missing scope and incorrect signing algorithm fail closed", () => {
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 }); const pem = keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  assert.throws(() => issueCapturePermit(scope, pem), /Invalid capture signing key/);
  assert.throws(() => issueCapturePermit({ ...scope, userId: "" }, pem), /Invalid capture scope/);
});

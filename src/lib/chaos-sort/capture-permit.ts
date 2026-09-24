import { createPrivateKey, sign } from "node:crypto";

export type CapturePermitScope = { userId: string; workspaceId: string; batchId: string; workstationId: string; sessionId: string; destinationId: string; deviceId: string; captureId: string; purpose: "capture" | "ack" | "preview" };

// The private signing key is server-only. Installers pin the corresponding
// public key; neither a service-role key nor a shared signing secret ships locally.
export function issueCapturePermit(scope: CapturePermitScope, privatePem: string, now = Date.now()) {
  if (!Object.values(scope).every(value => typeof value === "string" && value.length > 0 && value.length <= 200)) throw new Error("Invalid capture scope.");
  const key = createPrivateKey(privatePem);
  if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") throw new Error("Invalid capture signing key.");
  const payload = Buffer.from(JSON.stringify({ ...scope, audience: "trading-docks-scanner", issuedAt: Math.floor(now / 1000), expiresAt: Math.floor(now / 1000) + 120 })).toString("base64url");
  return `${payload}.${sign("sha256", Buffer.from(payload), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}

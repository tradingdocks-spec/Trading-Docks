import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getMarketingDemoFixture } from "./marketing-demo-fixtures.ts";
import { registryFeatureFor } from "./product-marketing-registry.ts";

const TOKEN_VERSION = "v1";
const DEFAULT_TTL_SECONDS = 5 * 60;

type CanonicalCaptureClaims = { feature: string; state: string; exp: number; nonce: string };

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function isRegisteredCapture(feature: string, state: string) {
  return Boolean(registryFeatureFor(feature) && getMarketingDemoFixture(feature, state));
}

export function createCanonicalCaptureToken(feature: string, state: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret) throw new Error("Marketing capture signing is not configured.");
  if (!isRegisteredCapture(feature, state)) throw new Error("Unknown canonical capture fixture.");
  const claims: CanonicalCaptureClaims = { feature, state, exp: nowSeconds + DEFAULT_TTL_SECONDS, nonce: randomBytes(16).toString("hex") };
  const payload = encode(JSON.stringify(claims));
  return `${TOKEN_VERSION}.${payload}.${sign(payload, secret)}`;
}

export function verifyCanonicalCaptureToken(token: string, feature: string, state: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!token || !secret || !isRegisteredCapture(feature, state)) return false;
  const [version, payload, signature] = token.split(".");
  if (version !== TOKEN_VERSION || !payload || !signature) return false;
  const expected = sign(payload, secret);
  const receivedBytes = Buffer.from(signature, "base64url");
  const expectedBytes = Buffer.from(expected, "base64url");
  if (receivedBytes.length !== expectedBytes.length || !timingSafeEqual(receivedBytes, expectedBytes)) return false;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<CanonicalCaptureClaims>;
    return claims.feature === feature && claims.state === state && typeof claims.exp === "number" && claims.exp >= nowSeconds && typeof claims.nonce === "string" && claims.nonce.length >= 16;
  } catch {
    return false;
  }
}

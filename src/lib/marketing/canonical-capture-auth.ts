import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getMarketingDemoFixture } from "./marketing-demo-fixtures.ts";
import { registryFeatureFor } from "./product-marketing-registry.ts";

const TOKEN_VERSION = "v1";
const DEFAULT_TTL_SECONDS = 5 * 60;

type CanonicalCaptureClaims = { feature: string; state: string; exp: number; nonce: string; issuerDeploymentId?: string; issuerHost?: string };

export type CanonicalCaptureTokenReason =
  | "VALID"
  | "TOKEN_MISSING"
  | "SECRET_MISSING"
  | "FIXTURE_UNREGISTERED"
  | "TOKEN_FORMAT_INVALID"
  | "TOKEN_VERSION_INVALID"
  | "SIGNATURE_LENGTH_INVALID"
  | "SIGNATURE_INVALID"
  | "PAYLOAD_INVALID"
  | "FEATURE_MISMATCH"
  | "STATE_MISMATCH"
  | "TOKEN_EXPIRED"
  | "NONCE_INVALID"
  | "CAPTURE_DEPLOYMENT_MISMATCH";

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
  const claims: CanonicalCaptureClaims = {
    feature,
    state,
    exp: nowSeconds + DEFAULT_TTL_SECONDS,
    nonce: randomBytes(16).toString("hex"),
    ...(process.env.VERCEL_DEPLOYMENT_ID ? { issuerDeploymentId: process.env.VERCEL_DEPLOYMENT_ID } : {}),
    ...(process.env.VERCEL_URL ? { issuerHost: normalizeHost(process.env.VERCEL_URL) } : {}),
  };
  const payload = encode(JSON.stringify(claims));
  return `${TOKEN_VERSION}.${payload}.${sign(payload, secret)}`;
}

export function verifyCanonicalCaptureToken(token: string, feature: string, state: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  return verifyCanonicalCaptureTokenDetailed(token, feature, state, secret, nowSeconds).code === "VALID";
}

function normalizeHost(value: string) {
  try { return new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase(); } catch { return value.toLowerCase(); }
}

export function captureSecretFingerprint(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex").slice(0, 8);
}

export function verifyCanonicalCaptureTokenDetailed(token: string, feature: string, state: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): { code: CanonicalCaptureTokenReason } {
  if (!token) return { code: "TOKEN_MISSING" };
  if (!secret) return { code: "SECRET_MISSING" };
  if (!isRegisteredCapture(feature, state)) return { code: "FIXTURE_UNREGISTERED" };

  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1] || !parts[2]) return { code: "TOKEN_FORMAT_INVALID" };
  const [version, payload, signature] = parts;
  if (version !== TOKEN_VERSION) return { code: "TOKEN_VERSION_INVALID" };
  if (!/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]+$/.test(signature)) return { code: "TOKEN_FORMAT_INVALID" };

  const expected = sign(payload, secret);
  const receivedBytes = Buffer.from(signature, "base64url");
  const expectedBytes = Buffer.from(expected, "base64url");
  if (receivedBytes.length !== expectedBytes.length) return { code: "SIGNATURE_LENGTH_INVALID" };
  if (!timingSafeEqual(receivedBytes, expectedBytes)) return { code: "SIGNATURE_INVALID" };

  let claims: Partial<CanonicalCaptureClaims>;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<CanonicalCaptureClaims>;
  } catch {
    return { code: "PAYLOAD_INVALID" };
  }
  if (claims.feature !== feature) return { code: "FEATURE_MISMATCH" };
  if (claims.state !== state) return { code: "STATE_MISMATCH" };
  if (typeof claims.exp !== "number" || !Number.isFinite(claims.exp)) return { code: "PAYLOAD_INVALID" };
  if (claims.exp < nowSeconds) return { code: "TOKEN_EXPIRED" };
  if (typeof claims.nonce !== "string" || !/^[a-f0-9]{32}$/i.test(claims.nonce)) return { code: "NONCE_INVALID" };

  const verifierDeploymentId = process.env.VERCEL_DEPLOYMENT_ID;
  const verifierHost = process.env.VERCEL_URL ? normalizeHost(process.env.VERCEL_URL) : undefined;
  if (claims.issuerDeploymentId && verifierDeploymentId && claims.issuerDeploymentId !== verifierDeploymentId) return { code: "CAPTURE_DEPLOYMENT_MISMATCH" };
  if (claims.issuerHost && verifierHost && claims.issuerHost !== verifierHost) return { code: "CAPTURE_DEPLOYMENT_MISMATCH" };
  return { code: "VALID" };
}

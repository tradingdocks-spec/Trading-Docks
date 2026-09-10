import { createHash } from "node:crypto";

/** Pairing codes are text: preserve leading zeroes and ignore display formatting. */
export function normalizeShowcasePairingCode(value: unknown): string {
  return String(value ?? "").replace(/[^0-9]/g, "");
}

export function hashShowcasePairingCode(value: unknown): string {
  return createHash("sha256").update(normalizeShowcasePairingCode(value), "utf8").digest("hex");
}

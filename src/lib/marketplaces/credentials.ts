import { createDecipheriv, createHash } from "node:crypto";

export type EncryptedMarketplaceCredential = {
  encrypted_payload: string;
  iv: string;
  auth_tag: string;
};

function key() {
  const secret = process.env.MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("Marketplace credential encryption is not configured.");
  }
  return createHash("sha256").update(secret).digest();
}

export function decryptMarketplaceCredentials(
  row: EncryptedMarketplaceCredential,
): Record<string, string> {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(row.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(row.encrypted_payload, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as Record<string, string>;
}

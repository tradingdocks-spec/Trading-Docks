import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type EncryptedMarketplaceCredential = {
  encrypted_payload: string;
  iv: string;
  auth_tag: string;
  encryption_algorithm?: string | null;
  encryption_key_version?: string | null;
};

export const MARKETPLACE_CREDENTIAL_ALGORITHM = "aes-256-gcm";
export const DEFAULT_MARKETPLACE_CREDENTIAL_KEY_VERSION = "v1";

export function encryptMarketplaceCredentials(credentials: Record<string, string>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(MARKETPLACE_CREDENTIAL_ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ]);
  return {
    encrypted_payload: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    auth_tag: cipher.getAuthTag().toString("base64"),
    encryption_algorithm: MARKETPLACE_CREDENTIAL_ALGORITHM,
    encryption_key_version:
      process.env.MARKETPLACE_CREDENTIAL_KEY_VERSION?.trim() ||
      DEFAULT_MARKETPLACE_CREDENTIAL_KEY_VERSION,
  };
}

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
  if (
    row.encryption_algorithm &&
    row.encryption_algorithm !== MARKETPLACE_CREDENTIAL_ALGORITHM
  ) {
    throw new Error("Unsupported marketplace credential encryption algorithm.");
  }

  const decipher = createDecipheriv(
    MARKETPLACE_CREDENTIAL_ALGORITHM,
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

import { readFile } from "node:fs/promises";
import sharp from "sharp";

import { createTcgTrackingClient } from "../src/lib/providers/tcgtracking/client.ts";

const MAX_BYTES = 100_000;
const inputPath = process.argv[2];

if (!inputPath) throw new Error("Usage: node --experimental-strip-types scripts/tcgtracking-direct-diagnostic.ts <image-path>");

const source = await readFile(inputPath);
const normalized = await sharp(source)
  .rotate()
  .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
  .jpeg({ quality: 82 })
  .toBuffer();
const metadata = await sharp(normalized).metadata();

console.log("TARGET URL", "https://tcgtracking.com/tcgapi/v1/scan");
console.log("NORMALIZED IMAGE BYTES", normalized.byteLength);
console.log("WIDTH / HEIGHT", metadata.width ?? null, "/", metadata.height ?? null);
console.log("MIME TYPE", "image/jpeg");
if (normalized.byteLength > MAX_BYTES) throw new Error(`Normalized image exceeds ${MAX_BYTES} bytes.`);

const client = createTcgTrackingClient({ retries: 0 });
const scan = await client.scanCardImage({ image: normalized, gameId: 1, limit: 5, captureResponseBody: true });
console.log("HTTP STATUS", scan.httpStatus ?? (scan.status === "provider_failed" ? "transport error" : 200));
console.log("RESPONSE CONTENT-TYPE", scan.responseContentType ?? "<none>");
console.log("FULL PROVIDER RESPONSE BODY", scan.rawResponseBody ?? "<unavailable: transport error before response>");

if (scan.status === "provider_failed") process.exitCode = 1;
else if (!scan.candidates.length) console.log("success", true, "candidates_scanned", scan.candidatesScanned ?? 0);
else {
  const candidate = scan.candidates[0];
  console.log("success", true, "candidates_scanned", scan.candidatesScanned ?? scan.candidates.length, "product_id", candidate?.providerProductId ?? null, "score", Math.round((candidate?.confidence ?? 0) * 100));
  if (candidate?.providerProductId) {
    const product = await client.product(candidate.providerProductId);
    console.log("PRODUCT", product ? { name: product.name, set_name: product.setName ?? null, set_abbr: product.setCode ?? null, number: product.collectorNumber ?? null, scryfall_id: product.scryfallId ?? null } : null);
  }
}

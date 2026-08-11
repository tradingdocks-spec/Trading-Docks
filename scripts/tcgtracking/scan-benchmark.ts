import { readFile, writeFile } from "node:fs/promises";

import {
  createTcgTrackingClient,
  normalizeTcgTrackingScanManifest,
  summarizeTcgTrackingScanBenchmark,
} from "../../src/lib/providers/tcgtracking/index.ts";

const manifestPath = flagValue("--manifest");
const outputPath = flagValue("--output");
const allowUpload = process.argv.includes("--allow-upload");

if (!manifestPath) {
  throw new Error("Usage: node --experimental-strip-types scripts/tcgtracking/scan-benchmark.ts --manifest <private-manifest.json> --allow-upload [--output report.json]");
}

if (!allowUpload) {
  throw new Error("TCGTracking scanner benchmark uploads fixture images to the provider. Re-run with --allow-upload only for private fixtures you are allowed to send.");
}

const manifest = normalizeTcgTrackingScanManifest(
  JSON.parse(await readFile(manifestPath, "utf8")),
  { manifestPath },
);

const client = createTcgTrackingClient({ timeoutMs: 20_000, retries: 0 });
const results = [];

for (const fixture of manifest.fixtures) {
  const started = Date.now();
  const image = await readFile(fixture.imagePath);
  const scan = await client.scanCardImage({ image, category: "magic" });
  const topCandidates = scan.candidates.slice(0, 3);
  const top1 = topCandidates[0] ?? null;
  const top3Match = topCandidates.some((candidate) =>
    (fixture.expectedTcgplayerProductId != null && candidate.tcgplayerProductId === fixture.expectedTcgplayerProductId) ||
    namesMatch(candidate.name, fixture.expectedName),
  );
  const top1Match = top1
    ? (fixture.expectedTcgplayerProductId != null && top1.tcgplayerProductId === fixture.expectedTcgplayerProductId) ||
      namesMatch(top1.name, fixture.expectedName)
    : false;

  results.push({
    fixtureId: fixture.id,
    treatment: fixture.treatment,
    expectedName: fixture.expectedName,
    expectedSetName: fixture.expectedSetName,
    expectedCollectorNumber: fixture.expectedCollectorNumber,
    expectedTcgplayerProductId: fixture.expectedTcgplayerProductId,
    status: scan.status,
    latencyMs: scan.latencyMs ?? Date.now() - started,
    top1Match,
    top3Match,
    unresolved: scan.status === "unresolved",
    incorrectPrinting:
      fixture.expectedTcgplayerProductId != null &&
      top1 != null &&
      top1.tcgplayerProductId !== fixture.expectedTcgplayerProductId,
    candidateCount: scan.candidates.length,
    topCandidates: topCandidates.map((candidate) => ({
      tcgplayerProductId: candidate.tcgplayerProductId,
      name: candidate.name,
      setName: candidate.setName,
      setCode: candidate.setCode,
      collectorNumber: candidate.collectorNumber,
      confidence: candidate.confidence,
    })),
  });
}

const report = {
  fixtureSetId: manifest.fixtureSetId,
  generatedAt: new Date().toISOString(),
  ...summarizeTcgTrackingScanBenchmark(results),
  results,
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) await writeFile(outputPath, serialized, "utf8");
else process.stdout.write(serialized);

function namesMatch(left: string | undefined, right: string) {
  return normalize(left) === normalize(right);
}

function normalize(value: string | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function flagValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

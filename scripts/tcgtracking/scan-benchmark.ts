import { readFile, writeFile } from "node:fs/promises";

import { createTcgTrackingClient } from "../../src/lib/providers/tcgtracking/index.ts";

type Fixture = {
  id: string;
  localImagePath: string;
  expectedName: string;
  expectedSetName?: string;
  expectedCollectorNumber?: string;
  expectedTcgplayerProductId?: number;
  notes?: string;
};

type Manifest = {
  fixtureSetId: string;
  fixtures: Fixture[];
};

const manifestPath = flagValue("--manifest");
const outputPath = flagValue("--output");
const allowUpload = process.argv.includes("--allow-upload");

if (!manifestPath) {
  throw new Error("Usage: node --experimental-strip-types scripts/tcgtracking/scan-benchmark.ts --manifest <private-manifest.json> --allow-upload [--output report.json]");
}

if (!allowUpload) {
  throw new Error("TCGTracking scanner benchmark uploads fixture images to the provider. Re-run with --allow-upload only for private fixtures you are allowed to send.");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
if (!Array.isArray(manifest.fixtures)) {
  throw new Error("Manifest must include a fixtures array.");
}

const client = createTcgTrackingClient({ timeoutMs: 20_000, retries: 0 });
const results = [];

for (const fixture of manifest.fixtures) {
  const started = Date.now();
  const image = await readFile(fixture.localImagePath);
  const scan = await client.scanCardImage({ image, category: "magic" });
  const topCandidates = scan.candidates.slice(0, 5);
  const top1 = topCandidates[0] ?? null;
  const topNMatch = topCandidates.some((candidate) =>
    (fixture.expectedTcgplayerProductId != null && candidate.tcgplayerProductId === fixture.expectedTcgplayerProductId) ||
    namesMatch(candidate.name, fixture.expectedName),
  );

  results.push({
    fixtureId: fixture.id,
    expectedName: fixture.expectedName,
    expectedSetName: fixture.expectedSetName,
    expectedCollectorNumber: fixture.expectedCollectorNumber,
    status: scan.status,
    latencyMs: scan.latencyMs ?? Date.now() - started,
    top1Match: top1
      ? (fixture.expectedTcgplayerProductId != null && top1.tcgplayerProductId === fixture.expectedTcgplayerProductId) ||
        namesMatch(top1.name, fixture.expectedName)
      : false,
    topNMatch,
    unresolved: scan.status === "unresolved",
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
  imagePathsExported: false,
  fixtureCount: results.length,
  top1Accuracy: ratio(results.filter((result) => result.top1Match).length, results.length),
  topNAccuracy: ratio(results.filter((result) => result.topNMatch).length, results.length),
  unresolvedRate: ratio(results.filter((result) => result.unresolved).length, results.length),
  averageLatencyMs: average(results.map((result) => result.latencyMs)),
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

function ratio(count: number, total: number) {
  return total > 0 ? count / total : null;
}

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function flagValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

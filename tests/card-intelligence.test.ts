import assert from "node:assert/strict";
import test from "node:test";

import { rankPrintingCandidates } from "../src/lib/card-intelligence/ranking.ts";
import { recognizeCard } from "../src/lib/card-intelligence/service.ts";
import type { CanonicalPrinting, CardCatalogProvider } from "../src/lib/card-intelligence/types.ts";
import { parseRecognitionRequest } from "../src/lib/card-intelligence/request.ts";
import { sanitizedIntelligenceResponse } from "../src/lib/card-intelligence/api-response.ts";
import { TcgTrackingCatalogProvider } from "../src/lib/card-intelligence/tcgtracking-provider.ts";
import { validateInventoryPrinting } from "../src/lib/card-intelligence/inventory-validation.ts";
import { calculateScannerBenchmark } from "../src/lib/card-intelligence/benchmark.ts";
import { readFile } from "node:fs/promises";

const boltM10 = printing({ printingId: "m10-146", canonicalCardId: "oracle-bolt", name: "Lightning Bolt", setCode: "M10", setName: "Magic 2010", collectorNumber: "146", finishes: ["nonfoil", "foil"] });
const boltClb = printing({ printingId: "clb-187", canonicalCardId: "oracle-bolt", name: "Lightning Bolt", setCode: "CLB", setName: "Commander Legends", collectorNumber: "187", finishes: ["nonfoil", "foil"] });
const shockM20 = printing({ printingId: "m20-160", canonicalCardId: "oracle-shock", name: "Shock", setCode: "M20", setName: "Core Set 2020", collectorNumber: "160" });

test("exact set and collector number deterministically resolve an exact printing", () => {
  const ranked = rankPrintingCandidates({ game: "magic", cardName: "Lightning Bolt", setCode: "M10", collectorNumber: "146", finish: "nonfoil" }, [boltClb, boltM10]);
  assert.equal(ranked[0].printingId, boltM10.printingId);
  assert.equal(ranked[0].confidenceTier, "high");
  assert.equal(ranked[0].requiresConfirmation, false);
});

test("same canonical card with many printings is not collapsed", () => {
  const ranked = rankPrintingCandidates({ game: "magic", cardName: "Lightning Bolt" }, [boltM10, boltClb]);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].canonicalCardId, ranked[1].canonicalCardId);
  assert.notEqual(ranked[0].printingId, ranked[1].printingId);
  assert.equal(ranked[0].requiresConfirmation, true);
});

test("OCR typo can rank a candidate but cannot create high confidence", () => {
  const ranked = rankPrintingCandidates({ game: "magic", ocrText: "Lightnig Bolt", ocrConfidence: 0.91 }, [shockM20, boltM10]);
  assert.equal(ranked[0].printingId, boltM10.printingId);
  assert.notEqual(ranked[0].confidenceTier, "high");
});

test("visual and OCR disagreement is explicit and conservative", () => {
  const ranked = rankPrintingCandidates({ game: "magic", cardName: "Shock", visualPrintingId: boltM10.printingId, visualSimilarity: 0.95 }, [boltM10, shockM20]);
  assert.ok(ranked.every((candidate) => candidate.requiresConfirmation));
  assert.ok(ranked.some((candidate) => candidate.conflictingSignals.includes("name")));
  assert.ok(ranked.some((candidate) => candidate.conflictingSignals.includes("visual")));
});

test("foil, language, and set contradictions prevent certainty", () => {
  const japaneseFoil = printing({ ...boltM10, printingId: "m10-ja", language: "ja", finishes: ["foil"] });
  const ranked = rankPrintingCandidates({ cardName: "Lightning Bolt", setCode: "CLB", collectorNumber: "146", language: "en", finish: "nonfoil" }, [japaneseFoil]);
  assert.equal(ranked[0].confidenceTier, "low");
  assert.deepEqual(new Set(ranked[0].conflictingSignals), new Set(["set", "language", "finish"]));
});

test("missing set and collector number returns close candidates for confirmation", async () => {
  const result = await recognizeCard({ game: "magic", cardName: "Lightning Bolt" }, { providers: [provider("catalog", [boltM10, boltClb])] });
  assert.equal(result.candidates.length, 2);
  assert.equal(result.selectedPrintingId, null);
  assert.equal(result.requiresConfirmation, true);
});

test("exact provider ID outranks conflicting fuzzy name", () => {
  const ranked = rankPrintingCandidates({ cardName: "Shock", providerIds: { scryfall: boltM10.providerIds.scryfall } }, [shockM20, boltM10]);
  assert.equal(ranked[0].printingId, boltM10.printingId);
  assert.ok(ranked[0].conflictingSignals.includes("name"));
  assert.equal(ranked[0].requiresConfirmation, true);
});

test("provider failure is isolated and disagreement stays explainable", async () => {
  const failed: CardCatalogProvider = { id: "timeout", search: async () => { throw new Error("timeout"); }, printing: async () => null };
  const result = await recognizeCard({ cardName: "Lightning Bolt", setCode: "M10", collectorNumber: "146" }, { providers: [failed, provider("catalog-a", [boltM10]), provider("catalog-b", [boltClb])] });
  assert.equal(result.candidates[0].printingId, boltM10.printingId);
  assert.equal(result.providers.find((entry) => entry.id === "timeout")?.status, "failed");
  assert.ok(result.candidates.some((candidate) => candidate.conflictingSignals.includes("set")));
});

test("unknown card never invents a printing", async () => {
  const result = await recognizeCard({ game: "magic", cardName: "Definitely Not A Card" }, { providers: [provider("empty", [])] });
  assert.deepEqual(result.candidates, []);
  assert.equal(result.selectedPrintingId, null);
  assert.equal(result.requiresConfirmation, true);
});

test("multi-TCG printing identities remain game-aware", () => {
  const pikachu = printing({ printingId: "pokemon:sv-025", canonicalCardId: "pokemon:pikachu", game: "pokemon", name: "Pikachu", setCode: "SV", collectorNumber: "025/198" });
  const ranked = rankPrintingCandidates({ game: "pokemon", cardName: "Pikachu", setCode: "SV", collectorNumber: "025/198" }, [pikachu]);
  assert.equal(ranked[0].game, "pokemon");
  assert.equal(ranked[0].printingId, "pokemon:sv-025");
});

test("mobile and web payload shapes feed the same authoritative resolver", async () => {
  const catalog = provider("fixture", [boltM10, boltClb]);
  const mobileSignals = { game: "magic" as const, cardName: "Lightning Bolt", setCode: "M10", collectorNumber: "146", ocrConfidence: 0.93 };
  const parsed = parseRecognitionRequest({ signals: mobileSignals, limit: 5 });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const mobile = await recognizeCard(parsed.signals, { providers: [catalog] });
  const web = await recognizeCard({ game: "magic", cardName: "Lightning Bolt", setCode: "M10", collectorNumber: "146" }, { providers: [catalog] });
  assert.equal(mobile.candidates[0].printingId, web.candidates[0].printingId);
  assert.equal(mobile.selectedPrintingId, web.selectedPrintingId);
});

test("recognition input rejects images, invalid games, and identity-free payloads", () => {
  assert.equal(parseRecognitionRequest({ image: "secret-backed-provider-input" }).ok, false);
  assert.equal(parseRecognitionRequest({ signals: { game: "unsupported", cardName: "x" } }).ok, false);
  assert.equal(parseRecognitionRequest({ signals: { game: "magic" } }).ok, false);
});

test("TCGTracking route returns sanitized intelligence data without provider errors", async () => {
  const response = sanitizedIntelligenceResponse(await recognizeCard({ cardName: "Lightning Bolt", setCode: "M10", collectorNumber: "146", finish: "nonfoil" }, { providers: [provider("fixture", [boltM10])] }));
  assert.equal(response?.candidates[0].printingId, boltM10.printingId);
  assert.equal("error" in (response?.providers[0] ?? {}), false);
  const route = await readFile(new URL("../src/app/api/scanner/tcgtracking/route.ts", import.meta.url), "utf8");
  assert.match(route, /intelligence:\s*sanitizedIntelligenceResponse\(intelligence\)/);
});

test("visual top-K separation supports text agreement and forces disagreement review", () => {
  const agreeing = rankPrintingCandidates({ cardName: "Lightning Bolt", setCode: "M10", collectorNumber: "146", finish: "nonfoil", visualCandidates: [{ printingId: boltM10.printingId, similarity: .96 }, { printingId: boltClb.printingId, similarity: .78 }] }, [boltM10, boltClb]);
  assert.equal(agreeing[0].printingId, boltM10.printingId);
  assert.equal(agreeing[0].confidenceTier, "high");
  const disagreeing = rankPrintingCandidates({ cardName: "Shock", visualCandidates: [{ printingId: boltM10.printingId, similarity: .96 }, { printingId: shockM20.printingId, similarity: .93 }] }, [boltM10, shockM20]);
  assert.ok(disagreeing.every((entry) => entry.requiresConfirmation));
});

test("visual or synthetic IDs cannot masquerade as exact provider identity", () => {
  const synthetic = { ...boltM10, printingId: "synthetic:bolt", canonicalCardId: "synthetic:bolt", providerIds: {}, provenance: ["trading-docks"], identityAuthority: "synthetic_fallback" as const };
  const ranked = rankPrintingCandidates({ cardName: "Lightning Bolt", providerIds: { scryfall: "synthetic:bolt" }, visualCandidates: [{ printingId: "synthetic:bolt", similarity: .99 }] }, [synthetic]);
  assert.notEqual(ranked[0].confidenceTier, "high");
  assert.equal(ranked[0].requiresConfirmation, true);
});

test("supported finishes are not mistaken for observed physical finish", () => {
  const ranked = rankPrintingCandidates({ cardName: "Lightning Bolt", setCode: "M10", collectorNumber: "146" }, [boltM10]);
  assert.equal(ranked[0].requiresConfirmation, true);
  assert.equal(ranked[0].finishes.includes("foil"), true);
});

test("Pokemon provider resolves exact TCGTracking printing IDs honestly", async () => {
  const fakeClient = { product: async (id: string) => id === "p-25" ? { providerProductId: id, categoryId: "3", tcgplayerProductId: 123, name: "Pikachu", setName: "Scarlet & Violet", setCode: "SVI", collectorNumber: "025/198", rarity: "Common", imageUrl: "https://example.test/pika.jpg", finishes: ["Normal", "Reverse Holofoil"], colors: [], raw: {} } : null, sets: async () => [], cards: async () => [] };
  const exact = await new TcgTrackingCatalogProvider(fakeClient).printing("tcgtracking:p-25");
  assert.equal(exact?.printingId, "tcgplayer:123");
  assert.equal(exact?.canonicalCardId, "pokemon-product:tcgplayer:123");
  assert.equal(exact?.identityAuthority, "provider_confirmed");
  assert.equal(await new TcgTrackingCatalogProvider(fakeClient).printing("tcgtracking:missing"), null);
});

test("authoritative inventory validation rejects name-only and synthetic identity", async () => {
  assert.equal(await validateInventoryPrinting({ printingId: "synthetic:bolt", game: "magic" }, [provider("fixture", [boltM10])]), null);
  const valid = await validateInventoryPrinting({ printingId: boltM10.printingId, game: "magic", finish: "foil" }, [provider("fixture", [boltM10])]);
  assert.equal(valid?.canonicalInventoryIdentity.printingId, boltM10.printingId);
  assert.equal(valid?.canonicalInventoryIdentity.name, boltM10.name);
  assert.equal(valid?.canonicalInventoryIdentity.identityAuthority, "provider_confirmed");
  assert.deepEqual(valid?.canonicalInventoryIdentity.providerIds, boltM10.providerIds);
  assert.equal(await validateInventoryPrinting({ printingId: boltM10.printingId, game: "magic", finish: "etched" }, [provider("fixture", [boltM10])]), null);
  assert.equal(await validateInventoryPrinting({ printingId: boltM10.printingId, game: "pokemon" }, [provider("fixture", [boltM10])]), null);
  assert.equal(await validateInventoryPrinting({ printingId: boltM10.printingId, game: "magic", providerIds: { scryfall: "wrong" } }, [provider("fixture", [boltM10])]), null);
});

test("benchmark infrastructure reports null metrics without real evaluated fixtures", () => {
  const report = calculateScannerBenchmark([{ id: "fixture-1", game: "magic", exactPrintingId: boltM10.printingId, cardName: boltM10.name }], []);
  assert.equal(report.evaluatedCount, 0);
  assert.equal(report.top1Accuracy, null);
});

function printing(overrides: Partial<CanonicalPrinting> & Pick<CanonicalPrinting, "printingId" | "canonicalCardId" | "name">): CanonicalPrinting {
  return {
    game: "magic", setName: null, setCode: null, collectorNumber: null, language: "en", finishes: ["nonfoil"], rarity: "common",
    imageUrl: null, providerIds: { scryfall: overrides.printingId }, provenance: ["scryfall"], identityAuthority: "provider_confirmed", prices: [], ...overrides,
  };
}

function provider(id: string, candidates: CanonicalPrinting[]): CardCatalogProvider {
  return { id, search: async () => candidates, printing: async (printingId) => candidates.find((candidate) => candidate.printingId === printingId) ?? null };
}

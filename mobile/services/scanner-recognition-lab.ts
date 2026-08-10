import {
  analyzeRecognitionImage,
  compareFeaturePrints,
  generateFeaturePrint,
  recognizeText,
  type NativeImageAnalysisResult,
  type NativeOcrResult,
} from '../modules/trading-docks-vision-ocr/index.ts';
import type { ScannerCardCandidate } from './scanner-foundation.ts';
import { createOcrIdentitySignal, defaultMagicVisualReferenceIndex, matchVisualDescriptorTopK, type VisualRankedMatch } from './scanner-multi-signal-recognition.ts';

export type ScannerRecognitionEngineId = 'ocr_accurate' | 'phash_luma_8x8' | 'apple_vision_feature_print';
export type ScannerRecognitionOutcome = 'identity_correct' | 'identity_wrong' | 'no_result' | 'input_quality';

export type ScannerRecognitionLabCandidate = {
  name: string;
  oracleId: string | null;
  scryfallId: string | null;
  score: number | null;
  distance: number | null;
};

export type ScannerRecognitionEngineResult = {
  engine: ScannerRecognitionEngineId;
  outcome: ScannerRecognitionOutcome;
  durationMs: number;
  top1: ScannerRecognitionLabCandidate | null;
  top5: ScannerRecognitionLabCandidate[];
  rawText?: string | null;
  confidence?: number | null;
  matchScore?: number | null;
  candidatesConsidered?: number | null;
  notes: string[];
};

export type ScannerRecognitionLabReport = {
  imageUri: string;
  expectedName: string | null;
  expectedOracleId: string | null;
  capturedQuality: {
    resolution: string | null;
    sharpness: number | null;
    exposure: number | null;
    cardCoverage: number | null;
    perspectiveScore: number | null;
    lumaHash: string | null;
  };
  engines: Record<ScannerRecognitionEngineId, ScannerRecognitionEngineResult>;
  summary: {
    accuracyPct: number | null;
    missPct: number | null;
    falsePositivePct: number | null;
    medianLatencyMs: number | null;
    p95LatencyMs: number | null;
  };
  debugArtifacts: null | {
    normalizedCardCropUri: string;
    titleRegions: readonly { id: string; x: number; y: number; width: number; height: number }[];
    engineCandidates: Record<ScannerRecognitionEngineId, ScannerRecognitionLabCandidate[]>;
  };
};

type LabDeps = {
  recognizeText?: typeof recognizeText;
  analyzeRecognitionImage?: typeof analyzeRecognitionImage;
  generateFeaturePrint?: typeof generateFeaturePrint;
  compareFeaturePrints?: typeof compareFeaturePrints;
  downloadReferenceImage?: (candidate: ScannerCardCandidate) => Promise<string | null>;
  now?: () => number;
};

const OCR_REGIONS = [
  { id: 'upper_card', regionType: 'name' as const, x: 0.04, y: 0.02, width: 0.92, height: 0.5 },
  { id: 'title_zone', regionType: 'name' as const, x: 0.08, y: 0.055, width: 0.7, height: 0.105 },
  { id: 'expanded_title_zone', regionType: 'name' as const, x: 0.04, y: 0.035, width: 0.84, height: 0.16 },
] as const;

const REGRESSION_NAMES = [
  'Incinerate',
  'Goblin War Strike',
  'Lightning Bolt',
  'Sol Ring',
  'Birds of Paradise',
  'Rhystic Study',
  'Runed Stalactite',
  'Krark-Clan Ironworks',
  'Ulalek, Fused Atrocity',
] as const;

export async function buildScannerLabReferenceSet(selected: ScannerCardCandidate | null, maxReferences = 250) {
  const { searchScannerPrintings } = await import('./scanner-data.ts');
  const byId = new Map<string, ScannerCardCandidate>();
  if (selected) byId.set(selected.id, selected);
  for (const name of REGRESSION_NAMES) {
    if (byId.size >= maxReferences) break;
    const result = await searchScannerPrintings(name, true);
    if (!result.ok) continue;
    for (const candidate of result.candidates.slice(0, 20)) {
      if (byId.size >= maxReferences) break;
      byId.set(candidate.id, candidate);
    }
  }
  return [...byId.values()].filter((candidate) => candidate.imageUrl);
}

export async function runScannerRecognitionLab(input: {
  imageUri: string;
  expectedName?: string | null;
  expectedOracleId?: string | null;
  referenceCandidates: readonly ScannerCardCandidate[];
  includeDebugArtifacts?: boolean;
}, deps: LabDeps = {}): Promise<ScannerRecognitionLabReport> {
  const analyze = deps.analyzeRecognitionImage ?? analyzeRecognitionImage;
  const ocrEngine = deps.recognizeText ?? recognizeText;
  const featureEngine = deps.generateFeaturePrint ?? generateFeaturePrint;
  const distanceEngine = deps.compareFeaturePrints ?? compareFeaturePrints;
  const download = deps.downloadReferenceImage ?? downloadReferenceImage;

  const quality = await analyze({ imageUri: input.imageUri });
  const ocr = await runOcrAccurate({ imageUri: input.imageUri, expectedOracleId: input.expectedOracleId ?? null, ocrEngine });
  const phash = runPHashBaseline({ quality, expectedOracleId: input.expectedOracleId ?? null, ocrOracleId: ocr.top1?.oracleId ?? null });
  const feature = await runFeaturePrintPrototype({
    imageUri: input.imageUri,
    expectedOracleId: input.expectedOracleId ?? null,
    referenceCandidates: input.referenceCandidates.slice(0, 500),
    featureEngine,
    distanceEngine,
    download,
  });
  const engines = {
    ocr_accurate: ocr,
    phash_luma_8x8: phash,
    apple_vision_feature_print: feature,
  };
  return {
    imageUri: input.imageUri,
    expectedName: input.expectedName ?? null,
    expectedOracleId: input.expectedOracleId ?? null,
    capturedQuality: quality.ok ? {
      resolution: `${quality.width}x${quality.height}`,
      sharpness: quality.sharpness,
      exposure: quality.exposure,
      cardCoverage: null,
      perspectiveScore: null,
      lumaHash: quality.lumaHash,
    } : {
      resolution: null,
      sharpness: null,
      exposure: null,
      cardCoverage: null,
      perspectiveScore: null,
      lumaHash: null,
    },
    engines,
    summary: summarizeRecognitionLab(Object.values(engines)),
    debugArtifacts: input.includeDebugArtifacts ? {
      normalizedCardCropUri: input.imageUri,
      titleRegions: OCR_REGIONS.map(({ id, x, y, width, height }) => ({ id, x, y, width, height })),
      engineCandidates: {
        ocr_accurate: ocr.top5,
        phash_luma_8x8: phash.top5,
        apple_vision_feature_print: feature.top5,
      },
    } : null,
  };
}

export function summarizeRecognitionLab(results: readonly ScannerRecognitionEngineResult[]) {
  const measured = results.filter((result) => result.outcome !== 'input_quality');
  const latencies = measured.map((result) => result.durationMs).sort((a, b) => a - b);
  const correct = measured.filter((result) => result.outcome === 'identity_correct').length;
  const misses = measured.filter((result) => result.outcome === 'no_result').length;
  const wrong = measured.filter((result) => result.outcome === 'identity_wrong').length;
  return {
    accuracyPct: measured.length ? pct(correct, measured.length) : null,
    missPct: measured.length ? pct(misses, measured.length) : null,
    falsePositivePct: measured.length ? pct(wrong, measured.length) : null,
    medianLatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
  };
}

async function runOcrAccurate(input: {
  imageUri: string;
  expectedOracleId: string | null;
  ocrEngine: typeof recognizeText;
}): Promise<ScannerRecognitionEngineResult> {
  const result = await input.ocrEngine({
    imageUri: input.imageUri,
    recognitionLevel: 'accurate',
    languages: ['en-US'],
    regions: OCR_REGIONS.map((region) => ({ ...region })),
  });
  if (!result.ok) return noResult('ocr_accurate', result.latencyMs, result.message);
  const rawText = result.observations.map((observation) => observation.text).join('\n');
  const identity = createOcrIdentitySignal({
    rawText,
    normalizedText: rawText,
    confidence: bestOcrConfidence(result),
  });
  const candidate = identity.match.entry ? {
    name: identity.match.entry.name,
    oracleId: identity.match.entry.oracleId,
    scryfallId: identity.match.entry.scryfallId,
    score: identity.match.score,
    distance: null,
  } : null;
  return {
    engine: 'ocr_accurate',
    outcome: outcomeFor(candidate?.oracleId ?? null, input.expectedOracleId),
    durationMs: result.latencyMs,
    top1: candidate,
    top5: candidate ? [candidate] : [],
    rawText,
    confidence: bestOcrConfidence(result),
    matchScore: identity.match.score,
    candidatesConsidered: result.observations.length,
    notes: result.warnings,
  };
}

function runPHashBaseline(input: {
  quality: NativeImageAnalysisResult;
  expectedOracleId: string | null;
  ocrOracleId: string | null;
}): ScannerRecognitionEngineResult {
  if (!input.quality.ok) return noResult('phash_luma_8x8', input.quality.durationMs, input.quality.message);
  const started = Date.now();
  const index = defaultMagicVisualReferenceIndex();
  const globalMatches = matchVisualDescriptorTopK(index, { algorithm: 'luma_phash_8x8_v1', hash: input.quality.lumaHash, source: 'captured_normalized_crop' }, 5);
  const narrowedMatches = input.ocrOracleId
    ? matchVisualDescriptorTopK(index, { algorithm: 'luma_phash_8x8_v1', hash: input.quality.lumaHash, source: 'captured_normalized_crop' }, 5, { oracleIds: [input.ocrOracleId] })
    : [];
  const matches = narrowedMatches.length ? narrowedMatches : globalMatches;
  const top5 = matches.map(candidateFromVisualMatch);
  return {
    engine: 'phash_luma_8x8',
    outcome: outcomeFor(top5[0]?.oracleId ?? null, input.expectedOracleId),
    durationMs: Date.now() - started + input.quality.durationMs,
    top1: top5[0] ?? null,
    top5,
    candidatesConsidered: matches[0]?.candidatesConsidered ?? 0,
    notes: narrowedMatches.length ? ['OCR-narrowed visual lookup was used.'] : ['Global visual lookup was used.'],
  };
}

async function runFeaturePrintPrototype(input: {
  imageUri: string;
  expectedOracleId: string | null;
  referenceCandidates: readonly ScannerCardCandidate[];
  featureEngine: typeof generateFeaturePrint;
  distanceEngine: typeof compareFeaturePrints;
  download: (candidate: ScannerCardCandidate) => Promise<string | null>;
}): Promise<ScannerRecognitionEngineResult> {
  const started = Date.now();
  const source = await input.featureEngine({ imageUri: input.imageUri });
  if (!source.ok) return noResult('apple_vision_feature_print', source.durationMs, source.message);
  const ranked: ScannerRecognitionLabCandidate[] = [];
  let descriptorBytes = source.descriptorBytes;
  for (const candidate of input.referenceCandidates) {
    const localUri = await input.download(candidate);
    if (!localUri) continue;
    const reference = await input.featureEngine({ imageUri: localUri });
    if (!reference.ok) continue;
    descriptorBytes += reference.descriptorBytes;
    const distance = await input.distanceEngine({ leftFeaturePrint: source.featurePrint, rightFeaturePrint: reference.featurePrint });
    if (!distance.ok) continue;
    ranked.push({
      name: candidate.name,
      oracleId: candidate.oracleId ?? null,
      scryfallId: candidate.id,
      score: null,
      distance: distance.distance,
    });
  }
  const top5 = ranked.sort((left, right) => (left.distance ?? Number.POSITIVE_INFINITY) - (right.distance ?? Number.POSITIVE_INFINITY)).slice(0, 5);
  return {
    engine: 'apple_vision_feature_print',
    outcome: top5.length ? outcomeFor(top5[0].oracleId, input.expectedOracleId) : 'no_result',
    durationMs: Date.now() - started,
    top1: top5[0] ?? null,
    top5,
    candidatesConsidered: input.referenceCandidates.length,
    notes: [`Feature print bytes generated in this run: ${descriptorBytes}.`, 'Prototype reference set is capped at 500 candidates.'],
  };
}

async function downloadReferenceImage(candidate: ScannerCardCandidate) {
  if (!candidate.imageUrl) return null;
  try {
    const FileSystem = await import('expo-file-system') as unknown as {
      cacheDirectory?: string | null;
      default?: { cacheDirectory?: string | null; downloadAsync?: (from: string, to: string) => Promise<{ uri: string }> };
      downloadAsync?: (from: string, to: string) => Promise<{ uri: string }>;
    };
    const cacheDirectory = FileSystem.cacheDirectory ?? FileSystem.default?.cacheDirectory;
    const downloadAsync = FileSystem.downloadAsync ?? FileSystem.default?.downloadAsync;
    if (!cacheDirectory || !downloadAsync) return null;
    const target = `${cacheDirectory}td-feature-print-${candidate.id.replace(/[^a-z0-9-]/gi, '')}.jpg`;
    const result = await downloadAsync(candidate.imageUrl, target);
    return result.uri;
  } catch {
    return null;
  }
}

function noResult(engine: ScannerRecognitionEngineId, durationMs: number, reason: string): ScannerRecognitionEngineResult {
  return {
    engine,
    outcome: 'no_result',
    durationMs,
    top1: null,
    top5: [],
    candidatesConsidered: 0,
    notes: [reason],
  };
}

function candidateFromVisualMatch(match: VisualRankedMatch): ScannerRecognitionLabCandidate {
  return {
    name: match.record.name,
    oracleId: match.record.oracleId,
    scryfallId: match.record.scryfallId,
    score: match.similarity,
    distance: match.distance,
  };
}

function outcomeFor(actualOracleId: string | null, expectedOracleId: string | null): ScannerRecognitionOutcome {
  if (!actualOracleId) return 'no_result';
  if (!expectedOracleId) return 'no_result';
  return actualOracleId === expectedOracleId ? 'identity_correct' : 'identity_wrong';
}

function bestOcrConfidence(result: Extract<NativeOcrResult, { ok: true }>) {
  return result.observations.reduce((best, observation) => Math.max(best, observation.confidence), 0);
}

function pct(count: number, total: number) {
  return Number(((count / total) * 100).toFixed(2));
}

function percentile(values: readonly number[], quantile: number) {
  if (!values.length) return null;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * quantile) - 1));
  return values[index];
}

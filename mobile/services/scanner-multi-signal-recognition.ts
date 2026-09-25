import type { ScannerVisionResult } from './scanner-vision-engine.ts';
import type { NormalizedCardCrop } from './live-card-recognition.ts';
import type { RecognitionCandidate, RecognitionConfidence, RecognitionSignalScore } from './scanner-intelligence.ts';
import type { ScannerCardCandidate } from './scanner-foundation.ts';
import {
  matchMagicCardName,
  prewarmMagicNameIndex,
  type MagicNameIndex,
  type MagicNameMatch,
} from './magic-card-identity.ts';
import {
  MAGIC_VISUAL_DESCRIPTOR_INDEX_SOURCE,
  MAGIC_VISUAL_DESCRIPTOR_INDEX_STATS,
  MAGIC_VISUAL_DESCRIPTOR_RECORDS,
} from './generated/magic-visual-descriptor-index.ts';

export type VisualDescriptorAlgorithm = 'luma_phash_8x8_v1';
export type RecognitionApproach = 'ocr_only' | 'visual_fingerprint_ocr' | 'compact_embedding_ocr';
export type MultiSignalDecisionStatus = 'append_identity' | 'review' | 'continue_scanning' | 'reject_frame';
export type MultiSignalConfidenceBand = 'high' | 'medium' | 'low';

export type CardGeometryEvidence = {
  cardDetected: boolean;
  geometryScore: number;
  qualityScore: number;
  perspectiveCorrected: boolean;
  normalizedCrop: NormalizedCardCrop | null;
  blockers: string[];
};

export type VisualDescriptor = {
  algorithm: VisualDescriptorAlgorithm;
  hash: string;
  source: 'live_normalized_crop' | 'captured_normalized_crop' | 'reference_image';
};

export type VisualReferenceRecord = {
  oracleId: string;
  scryfallId: string;
  name: string;
  setCode: string | null;
  collectorNumber: string | null;
  descriptor: VisualDescriptor;
};

export type VisualReferenceIndex = {
  algorithm: VisualDescriptorAlgorithm;
  records: readonly VisualReferenceRecord[];
  buckets: ReadonlyMap<string, readonly VisualReferenceRecord[]>;
  recordCount: number;
  storageBytesEstimate: number;
  lookupComplexity: 'bucketed_hamming_scan';
};

export type VisualMatch = {
  record: VisualReferenceRecord | null;
  similarity: number;
  distance: number | null;
  candidatesConsidered: number;
  algorithm: VisualDescriptorAlgorithm;
};

export type VisualRankedMatch = VisualMatch & {
  record: VisualReferenceRecord;
};

export type OcrIdentitySignal = {
  rawText: string | null;
  normalizedText: string | null;
  confidence: number | null;
  match: MagicNameMatch;
};

export type MultiSignalRecognitionInput = {
  geometry: CardGeometryEvidence;
  descriptor: VisualDescriptor | null;
  visualIndex: VisualReferenceIndex | null;
  ocr: OcrIdentitySignal;
  printingCandidates?: readonly RecognitionCandidate[];
};

export type MultiSignalRecognitionResult = {
  status: MultiSignalDecisionStatus;
  identityName: string | null;
  oracleId: string | null;
  confidenceBand: MultiSignalConfidenceBand;
  confidence: RecognitionConfidence;
  visual: VisualMatch | null;
  visualCandidates: VisualRankedMatch[];
  ocr: OcrIdentitySignal;
  printing: PrintingRefinementResult;
  diagnostics: {
    approach: RecognitionApproach;
    visualCandidate: string | null;
    visualSimilarity: number | null;
    ocrCandidate: string | null;
    ocrScore: number | null;
    conflict: boolean;
    decisionReason: string;
    blockers: string[];
  };
};

export type PrintingRefinementResult = {
  selected: RecognitionCandidate | null;
  candidates: readonly RecognitionCandidate[];
  ambiguous: boolean;
  reason: string;
};

export type BestFrameBufferEntry = {
  frameId: string;
  capturedAt: number;
  geometry: CardGeometryEvidence;
  descriptor: VisualDescriptor | null;
};

export type RecognitionBenchmarkSample = {
  id: string;
  expectedName: string;
  ocrOnly: { name: string | null; latencyMs: number };
  visualFingerprintOcr: { name: string | null; latencyMs: number; indexBytes: number };
  compactEmbeddingOcr?: { name: string | null; latencyMs: number; indexBytes: number; nativeRuntimeAvailable: boolean };
};

export type RecognitionBenchmarkReport = {
  samples: number;
  approaches: Record<RecognitionApproach, {
    measured: boolean;
    top1Accuracy: number | null;
    averageLatencyMs: number | null;
    averageIndexBytes: number | null;
    rejectedReason: string | null;
  }>;
};

export type ActiveScannerRecognitionTiming = {
  geometryMs: number | null;
  descriptorMs: number | null;
  visualLookupMs: number | null;
  ocrMs: number | null;
  fusionMs: number | null;
  identityMs: number | null;
  printingRefinementMs: number | null;
  rearmMs: number | null;
};

export type ActiveScannerRecognitionDiagnostics = MultiSignalRecognitionResult['diagnostics'] & {
  geometryQuality: number;
  bestFrameScore: number | null;
  fusedCandidate: string | null;
  fusedConfidence: number;
  printingCandidate: string | null;
  finalDecision: MultiSignalDecisionStatus;
  timings: ActiveScannerRecognitionTiming;
  visualIndexRecordCount: number;
  visualIndexVersion: string;
};

export type ScannerMultiSignalIndexMetadata = {
  provider: string;
  source: string;
  bulkDataType: string;
  sourceUpdatedAt: string | null;
  generatedAt: string;
  schemaVersion: number;
  descriptorVersion: VisualDescriptorAlgorithm;
  normalizationVersion: string;
  imageVersion: string;
  algorithm: VisualDescriptorAlgorithm;
  refreshCommand: string;
  recordCount: number;
  storageBytes: number;
  oracleIdentityCount: number;
  uniqueArtworkCount: number;
  printingCount: number;
  failedImageCount: number;
  notes: string;
};

const VISUAL_STRONG_SIMILARITY = 0.88;
const VISUAL_USABLE_SIMILARITY = 0.74;
const OCR_HIGH_SCORE = 0.9;
const OCR_USABLE_SCORE = 0.72;
const MIN_FRAME_QUALITY = 0.62;
const HASH_BITS = 64;
let cachedDefaultMagicVisualIndex: VisualReferenceIndex | null = null;

export function defaultMagicVisualReferenceIndex(): VisualReferenceIndex {
  if (!cachedDefaultMagicVisualIndex) {
    cachedDefaultMagicVisualIndex = buildVisualReferenceIndex(MAGIC_VISUAL_DESCRIPTOR_RECORDS.map((record) => ({
      oracleId: record.o,
      scryfallId: record.s,
      name: record.n,
      setCode: record.c,
      collectorNumber: record.cn,
      descriptor: { algorithm: 'luma_phash_8x8_v1', hash: record.h, source: 'reference_image' },
    })));
  }
  return cachedDefaultMagicVisualIndex;
}

export function defaultMagicVisualReferenceIndexMetadata(): ScannerMultiSignalIndexMetadata {
  return {
    provider: MAGIC_VISUAL_DESCRIPTOR_INDEX_SOURCE.provider,
    source: MAGIC_VISUAL_DESCRIPTOR_INDEX_SOURCE.source,
    bulkDataType: MAGIC_VISUAL_DESCRIPTOR_INDEX_SOURCE.bulkDataType,
    sourceUpdatedAt: MAGIC_VISUAL_DESCRIPTOR_INDEX_SOURCE.sourceUpdatedAt,
    generatedAt: MAGIC_VISUAL_DESCRIPTOR_INDEX_SOURCE.generatedAt,
    schemaVersion: MAGIC_VISUAL_DESCRIPTOR_INDEX_SOURCE.schemaVersion,
    descriptorVersion: MAGIC_VISUAL_DESCRIPTOR_INDEX_SOURCE.descriptorVersion,
    normalizationVersion: MAGIC_VISUAL_DESCRIPTOR_INDEX_SOURCE.normalizationVersion,
    imageVersion: MAGIC_VISUAL_DESCRIPTOR_INDEX_SOURCE.imageVersion,
    algorithm: MAGIC_VISUAL_DESCRIPTOR_INDEX_SOURCE.descriptorVersion,
    refreshCommand: MAGIC_VISUAL_DESCRIPTOR_INDEX_SOURCE.refreshCommand,
    recordCount: MAGIC_VISUAL_DESCRIPTOR_INDEX_STATS.recordCount,
    storageBytes: MAGIC_VISUAL_DESCRIPTOR_INDEX_STATS.storageBytes,
    oracleIdentityCount: MAGIC_VISUAL_DESCRIPTOR_INDEX_STATS.oracleIdentityCount,
    uniqueArtworkCount: MAGIC_VISUAL_DESCRIPTOR_INDEX_STATS.uniqueArtworkCount,
    printingCount: MAGIC_VISUAL_DESCRIPTOR_INDEX_STATS.printingCount,
    failedImageCount: MAGIC_VISUAL_DESCRIPTOR_INDEX_STATS.failedImageCount,
    notes: MAGIC_VISUAL_DESCRIPTOR_INDEX_SOURCE.notes,
  };
}

export function geometryEvidenceFromVision(result: ScannerVisionResult): CardGeometryEvidence {
  const blockers: string[] = [];
  if (!result.detection.cardPresent) blockers.push('NO_CARD');
  if (result.detection.confidence < 0.65) blockers.push('LOW_GEOMETRY_CONFIDENCE');
  if (!result.crop) blockers.push('NO_NORMALIZED_CROP');
  if (result.quality.blur > 0.7) blockers.push('BLUR');
  if (result.quality.glare > 0.55) blockers.push('GLARE');
  if (result.quality.lighting < 0.38) blockers.push('LOW_LIGHT');
  if (result.detection.perspectiveScore > 0.5) blockers.push('EXTREME_PERSPECTIVE');
  return {
    cardDetected: result.detection.cardPresent,
    geometryScore: clamp01(result.detection.confidence * 0.55 + (1 - result.detection.perspectiveScore) * 0.25 + result.detection.edgeVisibility * 0.2),
    qualityScore: result.quality.confidence,
    perspectiveCorrected: Boolean(result.crop?.perspectiveCorrected),
    normalizedCrop: result.crop,
    blockers,
  };
}

export function descriptorFromNormalizedCrop(crop: NormalizedCardCrop | null): VisualDescriptor | null {
  if (!crop?.fingerprint) return null;
  return {
    algorithm: 'luma_phash_8x8_v1',
    hash: normalizeHash(crop.fingerprint),
    source: 'live_normalized_crop',
  };
}

export function buildVisualReferenceIndex(records: readonly VisualReferenceRecord[]): VisualReferenceIndex {
  const buckets = new Map<string, VisualReferenceRecord[]>();
  for (const record of records) {
    const key = bucketKey(record.descriptor.hash);
    const bucket = buckets.get(key) ?? [];
    bucket.push({ ...record, descriptor: { ...record.descriptor, hash: normalizeHash(record.descriptor.hash) } });
    buckets.set(key, bucket);
  }
  return {
    algorithm: 'luma_phash_8x8_v1',
    records,
    buckets,
    recordCount: records.length,
    storageBytesEstimate: records.reduce((sum, record) => sum + record.name.length + (record.setCode?.length ?? 0) + (record.collectorNumber?.length ?? 0) + 64, 0),
    lookupComplexity: 'bucketed_hamming_scan',
  };
}

export function matchVisualDescriptor(
  index: VisualReferenceIndex | null,
  descriptor: VisualDescriptor | null,
  options: { oracleIds?: readonly string[] } = {},
): VisualMatch | null {
  if (!index || !descriptor) return null;
  const hash = normalizeHash(descriptor.hash);
  const primaryBucket = index.buckets.get(bucketKey(hash)) ?? [];
  const scopedOracleIds = new Set((options.oracleIds ?? []).filter(Boolean));
  const scopedBucket = scopedOracleIds.size
    ? primaryBucket.filter((record) => scopedOracleIds.has(record.oracleId))
    : primaryBucket;
  const candidates = scopedBucket.length
    ? scopedBucket
    : primaryBucket.length
      ? primaryBucket
      : scopedOracleIds.size
        ? index.records.filter((record) => scopedOracleIds.has(record.oracleId))
        : index.records;
  let best: { record: VisualReferenceRecord; distance: number } | null = null;
  for (const record of candidates) {
    const distance = hammingDistance(hash, record.descriptor.hash);
    if (!best || distance < best.distance) best = { record, distance };
  }
  return {
    record: best?.record ?? null,
    distance: best?.distance ?? null,
    similarity: best ? clamp01(1 - best.distance / HASH_BITS) : 0,
    candidatesConsidered: candidates.length,
    algorithm: index.algorithm,
  };
}

export function matchVisualDescriptorTopK(
  index: VisualReferenceIndex | null,
  descriptor: VisualDescriptor | null,
  limit = 5,
  options: { oracleIds?: readonly string[] } = {},
): VisualRankedMatch[] {
  if (!index || !descriptor || limit <= 0) return [];
  const hash = normalizeHash(descriptor.hash);
  const primaryBucket = index.buckets.get(bucketKey(hash)) ?? [];
  const scopedOracleIds = new Set((options.oracleIds ?? []).filter(Boolean));
  const scopedBucket = scopedOracleIds.size
    ? primaryBucket.filter((record) => scopedOracleIds.has(record.oracleId))
    : primaryBucket;
  const candidates = scopedBucket.length
    ? scopedBucket
    : primaryBucket.length
      ? primaryBucket
      : scopedOracleIds.size
        ? index.records.filter((record) => scopedOracleIds.has(record.oracleId))
        : index.records;
  return candidates
    .map((record) => {
      const distance = hammingDistance(hash, record.descriptor.hash);
      return {
        record,
        distance,
        similarity: clamp01(1 - distance / HASH_BITS),
        candidatesConsidered: candidates.length,
        algorithm: index.algorithm,
      };
    })
    .sort((left, right) => (left.distance ?? HASH_BITS) - (right.distance ?? HASH_BITS))
    .slice(0, limit);
}

export function createOcrIdentitySignal(input: {
  rawText: string | null;
  normalizedText: string | null;
  confidence: number | null;
  nameIndex?: MagicNameIndex;
}): OcrIdentitySignal {
  const normalizedText = input.normalizedText?.trim() || null;
  return {
    rawText: input.rawText?.trim() || null,
    normalizedText,
    confidence: input.confidence,
    match: normalizedText
      ? matchMagicCardName(input.nameIndex ?? prewarmMagicNameIndex(), normalizedText)
      : {
        entry: null,
        normalizedQuery: '',
        score: 0,
        exact: false,
        confidenceBand: 'low',
        failureCode: 'NO_TEXT',
        evidence: ['No OCR text was available.'],
      },
  };
}

export function recognizeWithMultiSignal(input: MultiSignalRecognitionInput): MultiSignalRecognitionResult {
  const ocrScopedOracleIds = ocrOracleScope(input.ocr);
  const visual = matchVisualDescriptor(input.visualIndex, input.descriptor, { oracleIds: ocrScopedOracleIds });
  const visualCandidates = matchVisualDescriptorTopK(input.visualIndex, input.descriptor, 5, { oracleIds: ocrScopedOracleIds });
  const visualName = visual?.record?.name ?? null;
  const visualOracleId = visual?.record?.oracleId ?? null;
  const ocrName = input.ocr.match.entry?.name ?? null;
  const ocrOracleId = input.ocr.match.entry?.oracleId ?? null;
  const visualStrong = Boolean(visual?.record && visual.similarity >= VISUAL_STRONG_SIMILARITY);
  const visualUsable = Boolean(visual?.record && visual.similarity >= VISUAL_USABLE_SIMILARITY);
  const ocrStrong = Boolean(input.ocr.match.entry && input.ocr.match.score >= OCR_HIGH_SCORE && (input.ocr.confidence ?? 0) >= 65);
  const ocrUsable = Boolean(input.ocr.match.entry && input.ocr.match.score >= OCR_USABLE_SCORE);
  const namesAgree = Boolean(visualName && ocrName && visualName === ocrName);
  const conflict = Boolean(visualOracleId && ocrOracleId && visualOracleId !== ocrOracleId && !namesAgree && visualUsable && ocrUsable);
  const frameUsable = input.geometry.cardDetected && input.geometry.qualityScore >= MIN_FRAME_QUALITY && Boolean(input.geometry.normalizedCrop);

  let status: MultiSignalDecisionStatus = 'continue_scanning';
  let identityName: string | null = null;
  let oracleId: string | null = null;
  let confidenceBand: MultiSignalConfidenceBand = 'low';
  let decisionReason = 'Both visual and OCR evidence are below identity threshold.';

  if (!frameUsable) {
    status = 'reject_frame';
    decisionReason = 'Frame geometry or quality is not suitable for recognition.';
  } else if (conflict) {
    status = 'review';
    identityName = visualStrong ? visualName : ocrName;
    oracleId = visualStrong ? visualOracleId : ocrOracleId;
    confidenceBand = 'medium';
    decisionReason = 'Visual and OCR candidates conflict; user review is required.';
  } else if (visualStrong && ocrStrong) {
    status = 'append_identity';
    identityName = visualName ?? ocrName;
    oracleId = visualOracleId ?? ocrOracleId;
    confidenceBand = 'high';
    decisionReason = 'Visual and OCR signals agree with high confidence.';
  } else if (visualStrong) {
    status = 'append_identity';
    identityName = visualName;
    oracleId = visualOracleId;
    confidenceBand = 'high';
    decisionReason = 'Visual fingerprint is strong enough to identify the card while OCR remains supporting evidence.';
  } else if (ocrStrong && visualUsable) {
    status = 'append_identity';
    identityName = ocrName;
    oracleId = ocrOracleId;
    confidenceBand = 'high';
    decisionReason = 'OCR is strong and visual evidence supports the same identity.';
  } else if (ocrStrong || visualUsable || ocrUsable) {
    status = 'review';
    identityName = visualUsable ? visualName : ocrName;
    oracleId = visualUsable ? visualOracleId : ocrOracleId;
    confidenceBand = 'medium';
    decisionReason = 'One identity signal is usable but not enough for automatic append.';
  }

  const printing = refinePrintingCandidates({ oracleId, name: identityName, candidates: input.printingCandidates ?? [], visual });
  const confidence = fusedConfidence({ visual, ocr: input.ocr, geometry: input.geometry, conflict, status });
  return {
    status,
    identityName,
    oracleId,
    confidenceBand,
    confidence,
    visual,
    visualCandidates,
    ocr: input.ocr,
    printing,
    diagnostics: {
      approach: 'visual_fingerprint_ocr',
      visualCandidate: visualName,
      visualSimilarity: visual?.similarity ?? null,
      ocrCandidate: ocrName,
      ocrScore: input.ocr.match.score,
      conflict,
      decisionReason,
      blockers: input.geometry.blockers,
    },
  };
}

export function recognizeScannerFrameWithFusion(input: {
  vision: ScannerVisionResult;
  rawOcrText: string | null;
  normalizedOcrText: string | null;
  ocrConfidence: number | null;
  ocrDurationMs?: number | null;
  printingCandidates?: readonly RecognitionCandidate[];
  visualIndex?: VisualReferenceIndex | null;
  nameIndex?: MagicNameIndex;
  now?: () => number;
}): MultiSignalRecognitionResult & { activeDiagnostics: ActiveScannerRecognitionDiagnostics } {
  const now = input.now ?? (() => Date.now());
  const identityStartedAt = now();
  const geometryStartedAt = now();
  const geometry = geometryEvidenceFromVision(input.vision);
  const geometryMs = Math.max(0, now() - geometryStartedAt);
  const descriptorStartedAt = now();
  const descriptor = descriptorFromNormalizedCrop(geometry.normalizedCrop);
  const descriptorMs = Math.max(0, now() - descriptorStartedAt);
  const ocr = createOcrIdentitySignal({
    rawText: input.rawOcrText,
    normalizedText: input.normalizedOcrText,
    confidence: input.ocrConfidence,
    nameIndex: input.nameIndex,
  });
  const visualIndex = input.visualIndex ?? defaultMagicVisualReferenceIndex();
  const metadata = defaultMagicVisualReferenceIndexMetadata();
  const visualLookupStartedAt = now();
  matchVisualDescriptor(visualIndex, descriptor, { oracleIds: ocrOracleScope(ocr) });
  const visualLookupMs = Math.max(0, now() - visualLookupStartedAt);
  const fusionStartedAt = now();
  const result = recognizeWithMultiSignal({
    geometry,
    descriptor,
    visualIndex,
    ocr,
    printingCandidates: input.printingCandidates,
  });
  const fusionMs = Math.max(0, now() - fusionStartedAt);
  const identityMs = Math.max(0, now() - identityStartedAt);
  return {
    ...result,
    activeDiagnostics: {
      ...result.diagnostics,
      geometryQuality: geometry.qualityScore,
      bestFrameScore: frameScore({ frameId: input.vision.frameId, capturedAt: input.vision.observedAt, geometry, descriptor }),
      fusedCandidate: result.identityName,
      fusedConfidence: result.confidence.overall,
      printingCandidate: result.printing.selected?.name ?? result.printing.candidates[0]?.name ?? null,
      finalDecision: result.status,
      timings: {
        geometryMs,
        descriptorMs,
        visualLookupMs,
        ocrMs: input.ocrDurationMs ?? null,
        fusionMs,
        identityMs,
        printingRefinementMs: fusionMs,
        rearmMs: null,
      },
      visualIndexRecordCount: visualIndex.recordCount,
      visualIndexVersion: metadata.descriptorVersion,
    },
  };
}

export function scannerCandidateFromVisualRecord(record: VisualReferenceRecord, confidence = 0.72): ScannerCardCandidate {
  return {
    id: record.scryfallId,
    oracleId: record.oracleId,
    name: record.name,
    setCode: record.setCode,
    setName: null,
    collectorNumber: record.collectorNumber,
    finishes: [],
    language: null,
    imageUrl: null,
    confidence,
    recognitionMode: 'assisted_capture',
    marketPrice: null,
  };
}

export function refinePrintingCandidates(input: {
  oracleId: string | null;
  name: string | null;
  candidates: readonly RecognitionCandidate[];
  visual: VisualMatch | null;
}): PrintingRefinementResult {
  if (!input.oracleId && !input.name) {
    return { selected: null, candidates: [], ambiguous: true, reason: 'Card identity is not resolved yet.' };
  }
  const scoped = input.candidates.filter((candidate) => {
    const candidateOracle = candidate.oracleId ?? null;
    return input.oracleId ? candidateOracle === input.oracleId || candidate.name === input.name : candidate.name === input.name;
  });
  if (!scoped.length) {
    return { selected: null, candidates: [], ambiguous: true, reason: 'No printing candidates are available for the resolved identity.' };
  }
  const visualPrinting = input.visual?.record?.scryfallId
    ? scoped.find((candidate) => candidate.id === input.visual?.record?.scryfallId)
    : null;
  if (visualPrinting && (input.visual?.similarity ?? 0) >= VISUAL_STRONG_SIMILARITY) {
    return { selected: visualPrinting, candidates: scoped.slice(0, 3), ambiguous: false, reason: 'Visual reference matched a known printing.' };
  }
  return {
    selected: scoped.length === 1 ? scoped[0] : null,
    candidates: scoped.slice(0, 3),
    ambiguous: scoped.length !== 1,
    reason: scoped.length === 1 ? 'Only one printing candidate remains after identity scoping.' : 'Multiple printings remain after identity scoping.',
  };
}

export function selectBestFrameBufferEntry(entries: readonly BestFrameBufferEntry[]): BestFrameBufferEntry | null {
  return [...entries]
    .filter((entry) => entry.geometry.cardDetected && entry.geometry.normalizedCrop)
    .sort((a, b) => frameScore(b) - frameScore(a) || b.capturedAt - a.capturedAt)[0] ?? null;
}

export function benchmarkRecognitionApproaches(samples: readonly RecognitionBenchmarkSample[]): RecognitionBenchmarkReport {
  return {
    samples: samples.length,
    approaches: {
      ocr_only: summarizeApproach(samples, (sample) => sample.ocrOnly),
      visual_fingerprint_ocr: summarizeApproach(samples, (sample) => sample.visualFingerprintOcr),
      compact_embedding_ocr: summarizeEmbedding(samples),
    },
  };
}

function fusedConfidence(input: {
  visual: VisualMatch | null;
  ocr: OcrIdentitySignal;
  geometry: CardGeometryEvidence;
  conflict: boolean;
  status: MultiSignalDecisionStatus;
}): RecognitionConfidence {
  const visualScore = input.visual?.record ? Math.round(input.visual.similarity * 100) : null;
  const ocrScore = input.ocr.match.entry ? Math.round(input.ocr.match.score * 100) : null;
  const geometryScore = Math.round(input.geometry.geometryScore * 100);
  const qualityScore = Math.round(input.geometry.qualityScore * 100);
  const signals: RecognitionSignalScore[] = [
    signal('artwork', 'Visual fingerprint', visualScore, 0.36, input.visual?.record?.name ?? 'No visual candidate'),
    signal('name_ocr', 'Title OCR', ocrScore, 0.28, input.ocr.normalizedText ?? 'No title OCR'),
    signal('layout', 'Card geometry', geometryScore, 0.2, input.geometry.normalizedCrop ? 'Normalized crop available' : 'No normalized crop'),
    signal('set_symbol', 'Frame quality', qualityScore, 0.16, input.geometry.blockers.length ? input.geometry.blockers.join(', ') : 'Frame quality usable'),
  ];
  const conflicts = input.conflict ? ['Visual and OCR identity candidates do not agree.'] : [];
  const scored = signals.filter((entry) => entry.score !== null);
  const weightTotal = scored.reduce((sum, entry) => sum + entry.weight, 0);
  const overall = weightTotal
    ? Math.round(scored.reduce((sum, entry) => sum + (entry.score ?? 0) * entry.weight, 0) / weightTotal)
    : 0;
  return {
    overall,
    threshold: 82,
    requiresConfirmation: input.status !== 'append_identity' || conflicts.length > 0,
    signals,
    conflicts,
  };
}

function ocrOracleScope(ocr: OcrIdentitySignal) {
  if (!ocr.match.entry) return [];
  if (ocr.match.score >= OCR_USABLE_SCORE) return [ocr.match.entry.oracleId];
  return [];
}

function signal(key: RecognitionSignalScore['key'], label: string, score: number | null, weight: number, evidence: string): RecognitionSignalScore {
  return { key, label, score, weight, evidence };
}

function summarizeApproach(
  samples: readonly RecognitionBenchmarkSample[],
  pick: (sample: RecognitionBenchmarkSample) => { name: string | null; latencyMs: number; indexBytes?: number },
) {
  if (!samples.length) {
    return { measured: false, top1Accuracy: null, averageLatencyMs: null, averageIndexBytes: null, rejectedReason: 'No benchmark samples were provided.' };
  }
  const results = samples.map(pick);
  return {
    measured: true,
    top1Accuracy: ratio(samples.filter((sample, index) => results[index].name === sample.expectedName).length, samples.length),
    averageLatencyMs: average(results.map((result) => result.latencyMs)),
    averageIndexBytes: average(results.map((result) => result.indexBytes ?? 0)),
    rejectedReason: null,
  };
}

function summarizeEmbedding(samples: readonly RecognitionBenchmarkSample[]) {
  const measured = samples.filter((sample) => sample.compactEmbeddingOcr?.nativeRuntimeAvailable);
  if (!measured.length) {
    return {
      measured: false,
      top1Accuracy: null,
      averageLatencyMs: null,
      averageIndexBytes: null,
      rejectedReason: 'No native compact-embedding runtime is available in this branch.',
    };
  }
  return summarizeApproach(measured, (sample) => sample.compactEmbeddingOcr ?? { name: null, latencyMs: 0, indexBytes: 0 });
}

function frameScore(entry: BestFrameBufferEntry) {
  return entry.geometry.geometryScore * 0.35
    + entry.geometry.qualityScore * 0.45
    + (entry.geometry.perspectiveCorrected ? 0.2 : 0.08);
}

function hammingDistance(left: string, right: string) {
  const leftBits = hexToBigInt(left);
  const rightBits = hexToBigInt(right);
  let value = leftBits ^ rightBits;
  let count = 0;
  while (value > 0n) {
    count += Number(value & 1n);
    value >>= 1n;
  }
  return count;
}

function hexToBigInt(value: string) {
  return BigInt(`0x${normalizeHash(value)}`);
}

function normalizeHash(value: string) {
  return value.replace(/[^a-f0-9]/gi, '').toLowerCase().padStart(16, '0').slice(-16);
}

function bucketKey(hash: string) {
  return normalizeHash(hash).slice(0, 4);
}

function ratio(count: number, total: number) {
  return total ? Number((count / total).toFixed(4)) : null;
}

function average(values: readonly number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

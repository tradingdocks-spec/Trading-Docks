import type {
  MagicBenchmarkFixtureManifest,
  MagicBenchmarkFixtureManifestEntry,
  MagicBenchmarkFrameType,
  MagicBenchmarkReport,
} from './magic-recognition-provider.ts';
import {
  runMagicBenchmark,
  validateMagicBenchmarkFixtureManifest,
} from './magic-recognition-provider.ts';
import type { ScannerCardCandidate } from './scanner-foundation.ts';

export const SCANNER_BENCHMARK_BUILDER_FLAG = 'EXPO_PUBLIC_ENABLE_SCANNER_BENCHMARK_BUILDER';
export const SCANNER_BENCHMARK_FIXTURE_ROOT = [
  'mobile',
  'fixtures',
  ['magic', 'scanner', 'private'].join('-'),
].join('/');
export const SCANNER_BENCHMARK_OUTPUT_ROOT = [
  'mobile',
  ['benchmark', 'output'].join('-'),
  'magic-scanner',
].join('/');

export type BenchmarkSleeveStatus = 'unsleeved' | 'single_sleeved' | 'double_sleeved' | 'toploader' | 'unknown';
export type BenchmarkLightingCondition = 'controlled' | 'glare' | 'low_light' | 'mixed' | 'unknown';
export type BenchmarkAngle = 'flat' | 'slight_angle' | 'steep_angle' | 'unknown';
export type BenchmarkCardFace = 'front' | 'back';
export type BenchmarkDamageState = 'normal' | 'damaged';

export type BenchmarkDataset = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  privacyAcknowledged: boolean;
  manifest: MagicBenchmarkFixtureManifest;
  lastBackupJson: string | null;
  lastBenchmarkReport: MagicBenchmarkReport | null;
};

export type BenchmarkFixtureInput = {
  selectedPrinting: ScannerCardCandidate | null;
  expectedFinish: MagicBenchmarkFixtureManifestEntry['expectedFinish'];
  frameType: MagicBenchmarkFrameType;
  sleeveStatus: BenchmarkSleeveStatus;
  lightingCondition: BenchmarkLightingCondition;
  angle: BenchmarkAngle;
  cardFace: BenchmarkCardFace;
  damageState: BenchmarkDamageState;
  notes: string;
  capturedImageUri: string | null;
};

export type BenchmarkDatasetSummary = {
  totalFixtures: number;
  completeFixtures: number;
  incompleteFixtures: number;
  categoriesRepresented: number;
  frameTypes: Record<string, number>;
  foilFixtures: number;
  sleevedFixtures: number;
  difficultLightingFixtures: number;
  unsupportedFixtures: number;
  incompleteLabels: string[];
  benchmarkReady: boolean;
};

export type BenchmarkExecutionResult =
  | { ok: true; mode: 'executed'; report: MagicBenchmarkReport }
  | { ok: true; mode: 'desktop_command'; command: string; reason: string }
  | { ok: false; error: string };

export function isScannerBenchmarkBuilderEnabled(env: Record<string, string | undefined> = process.env) {
  return env.NODE_ENV !== 'production' && env[SCANNER_BENCHMARK_BUILDER_FLAG] === 'true';
}

export function createBenchmarkDataset(input: { name: string; now?: string; privacyAcknowledged?: boolean }): BenchmarkDataset {
  const now = input.now ?? new Date().toISOString();
  const id = stableDatasetId(input.name, now);
  return {
    id,
    name: input.name.trim() || 'Magic Scanner Benchmark',
    createdAt: now,
    updatedAt: now,
    privacyAcknowledged: input.privacyAcknowledged ?? false,
    manifest: {
      schemaVersion: 1,
      fixtureSetId: id,
      createdAt: now,
      fixtures: [],
    },
    lastBackupJson: null,
    lastBenchmarkReport: null,
  };
}

export function acknowledgeBenchmarkPrivacy(dataset: BenchmarkDataset, now = new Date().toISOString()): BenchmarkDataset {
  return { ...dataset, privacyAcknowledged: true, updatedAt: now };
}

export function buildBenchmarkFixtureEntry(dataset: BenchmarkDataset, input: BenchmarkFixtureInput): { ok: true; fixture: MagicBenchmarkFixtureManifestEntry } | { ok: false; error: string } {
  if (!dataset.privacyAcknowledged) return { ok: false, error: 'Acknowledge the local-only privacy warning before capture.' };
  if (!input.selectedPrinting) return { ok: false, error: 'Select and confirm an exact Magic printing before saving a fixture.' };
  if (!input.capturedImageUri) return { ok: false, error: 'Capture or retake a local image before saving a fixture.' };
  if (!input.selectedPrinting.id || !input.selectedPrinting.name || !input.selectedPrinting.setCode || !input.selectedPrinting.collectorNumber) {
    return { ok: false, error: 'Selected printing is missing required Scryfall metadata.' };
  }
  const fixtureId = buildStableFixtureId(dataset.id, input.selectedPrinting, input.frameType, input.cardFace);
  const localImagePath = buildRelativeFixtureImagePath(dataset.id, fixtureId);
  return {
    ok: true,
    fixture: {
      id: fixtureId,
      localImagePath,
      expectedCardName: input.selectedPrinting.name,
      expectedSetCode: input.selectedPrinting.setCode,
      expectedCollectorNumber: input.selectedPrinting.collectorNumber,
      expectedScryfallId: input.selectedPrinting.id,
      expectedLanguage: input.selectedPrinting.language ?? 'en',
      expectedFinish: input.expectedFinish,
      frameType: input.frameType,
      lightingCondition: input.lightingCondition,
      sleeveStatus: input.sleeveStatus,
      angle: input.angle,
      notes: appendConditionNotes(input.notes, input.cardFace, input.damageState),
    },
  };
}

export function appendBenchmarkFixture(dataset: BenchmarkDataset, input: BenchmarkFixtureInput, now = new Date().toISOString()): { ok: true; dataset: BenchmarkDataset; fixture: MagicBenchmarkFixtureManifestEntry } | { ok: false; error: string } {
  const built = buildBenchmarkFixtureEntry(dataset, input);
  if (!built.ok) return built;
  if (dataset.manifest.fixtures.some((fixture) => fixture.id === built.fixture.id)) {
    return { ok: false, error: 'A fixture with this stable id already exists. Retake or edit the existing fixture.' };
  }
  const next = replaceManifest(dataset, {
    ...dataset.manifest,
    fixtures: [...dataset.manifest.fixtures, built.fixture],
  }, now);
  return { ok: true, dataset: next, fixture: built.fixture };
}

export function editBenchmarkFixture(dataset: BenchmarkDataset, fixtureId: string, patch: Partial<Pick<MagicBenchmarkFixtureManifestEntry, 'expectedFinish' | 'frameType' | 'lightingCondition' | 'sleeveStatus' | 'angle' | 'notes'>>, now = new Date().toISOString()) {
  const fixtures = dataset.manifest.fixtures.map((fixture) => fixture.id === fixtureId ? { ...fixture, ...patch } : fixture);
  return replaceManifest(dataset, { ...dataset.manifest, fixtures }, now);
}

export function retakeBenchmarkFixture(dataset: BenchmarkDataset, fixtureId: string, capturedImageUri: string | null, now = new Date().toISOString()): { ok: true; dataset: BenchmarkDataset; localImagePath: string } | { ok: false; error: string } {
  if (!capturedImageUri) return { ok: false, error: 'Capture a replacement image before retaking this fixture.' };
  const target = dataset.manifest.fixtures.find((fixture) => fixture.id === fixtureId);
  if (!target) return { ok: false, error: 'Fixture was not found.' };
  const fixtures = dataset.manifest.fixtures.map((fixture) => fixture.id === fixtureId ? { ...fixture, localImagePath: buildRelativeFixtureImagePath(dataset.id, fixtureId) } : fixture);
  const next = replaceManifest(dataset, { ...dataset.manifest, fixtures }, now);
  return { ok: true, dataset: next, localImagePath: buildRelativeFixtureImagePath(dataset.id, fixtureId) };
}

export function removeBenchmarkFixture(dataset: BenchmarkDataset, fixtureId: string, now = new Date().toISOString()): { ok: true; dataset: BenchmarkDataset; imagePathToDelete: string } | { ok: false; error: string } {
  const target = dataset.manifest.fixtures.find((fixture) => fixture.id === fixtureId);
  if (!target) return { ok: false, error: 'Fixture was not found.' };
  const next = replaceManifest(dataset, { ...dataset.manifest, fixtures: dataset.manifest.fixtures.filter((fixture) => fixture.id !== fixtureId) }, now);
  return { ok: true, dataset: next, imagePathToDelete: target.localImagePath };
}

export function deleteBenchmarkDataset(dataset: BenchmarkDataset, confirm: string): { ok: true; datasetId: string; fixturePaths: string[] } | { ok: false; error: string } {
  if (confirm !== dataset.name) return { ok: false, error: 'Type the dataset name to confirm deletion.' };
  return { ok: true, datasetId: dataset.id, fixturePaths: dataset.manifest.fixtures.map((fixture) => fixture.localImagePath) };
}

export function summarizeBenchmarkDataset(dataset: BenchmarkDataset): BenchmarkDatasetSummary {
  const incompleteLabels: string[] = [];
  const frameTypes: Record<string, number> = {};
  for (const fixture of dataset.manifest.fixtures) {
    frameTypes[fixture.frameType] = (frameTypes[fixture.frameType] ?? 0) + 1;
    const validation = validateFixtureComplete(fixture);
    if (!validation.ok) incompleteLabels.push(`${fixture.id}: ${validation.errors.join(', ')}`);
  }
  const totalFixtures = dataset.manifest.fixtures.length;
  const incompleteFixtures = incompleteLabels.length;
  return {
    totalFixtures,
    completeFixtures: totalFixtures - incompleteFixtures,
    incompleteFixtures,
    categoriesRepresented: Object.keys(frameTypes).length,
    frameTypes,
    foilFixtures: dataset.manifest.fixtures.filter((fixture) => fixture.expectedFinish === 'likely_foil' || fixture.expectedFinish === 'likely_etched' || fixture.frameType === 'foil' || fixture.frameType === 'etched_foil' || fixture.frameType === 'special_finish').length,
    sleevedFixtures: dataset.manifest.fixtures.filter((fixture) => fixture.sleeveStatus !== 'unsleeved' && fixture.sleeveStatus !== 'unknown').length,
    difficultLightingFixtures: dataset.manifest.fixtures.filter((fixture) => fixture.lightingCondition === 'glare' || fixture.lightingCondition === 'low_light').length,
    unsupportedFixtures: dataset.manifest.fixtures.filter((fixture) => fixture.frameType === 'token' || fixture.frameType === 'unsupported_card').length,
    incompleteLabels,
    benchmarkReady: totalFixtures > 0 && incompleteFixtures === 0,
  };
}

export function validateBenchmarkDatasetManifest(dataset: BenchmarkDataset) {
  const manifestValidation = validateMagicBenchmarkFixtureManifest(dataset.manifest);
  const localErrors = dataset.manifest.fixtures
    .filter((fixture) => !isRelativeLocalBenchmarkPath(fixture.localImagePath))
    .map((fixture) => `${fixture.id}.localImagePath must stay under ${SCANNER_BENCHMARK_FIXTURE_ROOT}.`);
  return manifestValidation.ok && localErrors.length === 0
    ? { ok: true as const }
    : { ok: false as const, errors: [...(manifestValidation.ok ? [] : manifestValidation.errors), ...localErrors] };
}

export function recoverBenchmarkDatasetFromWrite(input: { primaryJson: string | null; backupJson: string | null }): { ok: true; dataset: BenchmarkDataset; recoveredFrom: 'primary' | 'backup' } | { ok: false; error: string } {
  const primary = parseDatasetJson(input.primaryJson);
  if (primary.ok) return { ...primary, recoveredFrom: 'primary' };
  const backup = parseDatasetJson(input.backupJson);
  if (backup.ok) return { ...backup, recoveredFrom: 'backup' };
  return { ok: false, error: 'No valid benchmark dataset manifest could be recovered.' };
}

export async function runBenchmarkForDataset(dataset: BenchmarkDataset, platform: 'web' | 'ios' | 'android' | 'desktop', now = new Date().toISOString()): Promise<BenchmarkExecutionResult> {
  const validation = validateBenchmarkDatasetManifest(dataset);
  if (!validation.ok) return { ok: false, error: validation.errors.join(' ') };
  if (!summarizeBenchmarkDataset(dataset).benchmarkReady) return { ok: false, error: 'Complete required labels before running the benchmark.' };
  if (platform !== 'desktop' && platform !== 'web') {
    return {
      ok: true,
      mode: 'desktop_command',
      command: `cd mobile && npm run benchmark:magic-scanner -- --manifest ${SCANNER_BENCHMARK_FIXTURE_ROOT}/${dataset.id}/manifest.json`,
      reason: 'Native apps cannot spawn the local Node benchmark runner. The dataset is ready; run the command on desktop.',
    };
  }
  const report = await runMagicBenchmark(dataset.manifest, { generatedAt: now });
  return { ok: true, mode: 'executed', report };
}

export function isRelativeLocalBenchmarkPath(value: string) {
  const normalized = value.replaceAll('\\', '/');
  return normalized.startsWith(`${SCANNER_BENCHMARK_FIXTURE_ROOT}/`) && !normalized.includes('..') && !/^[a-z]:\//i.test(normalized) && !normalized.startsWith('/');
}

export function benchmarkBuilderDoesNotUpload() {
  return {
    uploadsImages: false,
    writesPhotoLibraryByDefault: false,
    analyticsEnabled: false,
    normalNavigationExposed: false,
  };
}

function replaceManifest(dataset: BenchmarkDataset, manifest: MagicBenchmarkFixtureManifest, now: string): BenchmarkDataset {
  return {
    ...dataset,
    updatedAt: now,
    lastBackupJson: JSON.stringify(dataset.manifest, null, 2),
    manifest,
  };
}

function buildStableFixtureId(datasetId: string, selectedPrinting: ScannerCardCandidate, frameType: MagicBenchmarkFrameType, cardFace: BenchmarkCardFace) {
  return [
    datasetId,
    slug(selectedPrinting.name),
    selectedPrinting.setCode?.toLowerCase() ?? 'set',
    slug(selectedPrinting.collectorNumber ?? 'number'),
    slug(frameType),
    cardFace,
  ].join('-').slice(0, 120);
}

function buildRelativeFixtureImagePath(datasetId: string, fixtureId: string) {
  return `${SCANNER_BENCHMARK_FIXTURE_ROOT}/${datasetId}/images/${fixtureId}.jpg`;
}

function stableDatasetId(name: string, now: string) {
  return `${slug(name || 'magic-scanner-benchmark')}-${now.slice(0, 10).replaceAll('-', '')}`;
}

function appendConditionNotes(notes: string, cardFace: BenchmarkCardFace, damageState: BenchmarkDamageState) {
  return [notes.trim(), `face=${cardFace}`, `condition=${damageState}`].filter(Boolean).join(' | ');
}

function validateFixtureComplete(fixture: MagicBenchmarkFixtureManifestEntry) {
  const errors: string[] = [];
  if (!fixture.expectedCardName) errors.push('expected card name');
  if (!fixture.expectedSetCode) errors.push('expected set code');
  if (!fixture.expectedCollectorNumber) errors.push('expected collector number');
  if (!fixture.expectedScryfallId) errors.push('expected Scryfall id');
  if (!fixture.expectedLanguage) errors.push('expected language');
  if (!fixture.expectedFinish) errors.push('expected finish');
  if (!fixture.localImagePath || !isRelativeLocalBenchmarkPath(fixture.localImagePath)) errors.push('local image path');
  return errors.length ? { ok: false as const, errors } : { ok: true as const };
}

function parseDatasetJson(value: string | null): { ok: true; dataset: BenchmarkDataset } | { ok: false; error: string } {
  if (!value) return { ok: false, error: 'Missing dataset JSON.' };
  try {
    const dataset = JSON.parse(value) as BenchmarkDataset;
    const validation = validateMagicBenchmarkFixtureManifest(dataset.manifest);
    return validation.ok ? { ok: true, dataset } : { ok: false, error: validation.errors.join(' ') };
  } catch {
    return { ok: false, error: 'Dataset JSON is not valid.' };
  }
}

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

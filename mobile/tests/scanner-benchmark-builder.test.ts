import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCANNER_BENCHMARK_BUILDER_FLAG,
  SCANNER_BENCHMARK_FIXTURE_ROOT,
  acknowledgeBenchmarkPrivacy,
  appendBenchmarkFixture,
  benchmarkBuilderDoesNotUpload,
  createBenchmarkDataset,
  deleteBenchmarkDataset,
  editBenchmarkFixture,
  isRelativeLocalBenchmarkPath,
  isScannerBenchmarkBuilderEnabled,
  recoverBenchmarkDatasetFromWrite,
  removeBenchmarkFixture,
  retakeBenchmarkFixture,
  runBenchmarkForDataset,
  summarizeBenchmarkDataset,
  validateBenchmarkDatasetManifest,
} from '../services/scanner-benchmark-builder.ts';
import type { ScannerCardCandidate } from '../services/scanner-foundation.ts';

test('feature flag disables the benchmark builder by default', () => {
  assert.equal(isScannerBenchmarkBuilderEnabled({}), false);
  assert.equal(isScannerBenchmarkBuilderEnabled({ [SCANNER_BENCHMARK_BUILDER_FLAG]: 'true' }), true);
});

test('create dataset initializes an empty manifest and privacy gate', () => {
  const dataset = createBenchmarkDataset({ name: 'August Fixtures', now: '2026-08-05T00:00:00.000Z' });

  assert.equal(dataset.id, 'august-fixtures-20260805');
  assert.equal(dataset.privacyAcknowledged, false);
  assert.equal(dataset.manifest.fixtures.length, 0);
});

test('resume dataset can recover from primary manifest JSON', () => {
  const dataset = acknowledgeBenchmarkPrivacy(createBenchmarkDataset({ name: 'Recover Me', now: '2026-08-05T00:00:00.000Z' }));
  const recovered = recoverBenchmarkDatasetFromWrite({ primaryJson: JSON.stringify(dataset), backupJson: null });

  assert.equal(recovered.ok, true);
  if (!recovered.ok) return;
  assert.equal(recovered.recoveredFrom, 'primary');
  assert.equal(recovered.dataset.id, dataset.id);
});

test('interrupted manifest recovery falls back to backup JSON', () => {
  const dataset = acknowledgeBenchmarkPrivacy(createBenchmarkDataset({ name: 'Backup Me', now: '2026-08-05T00:00:00.000Z' }));
  const recovered = recoverBenchmarkDatasetFromWrite({ primaryJson: '{ bad json', backupJson: JSON.stringify(dataset) });

  assert.equal(recovered.ok, true);
  if (!recovered.ok) return;
  assert.equal(recovered.recoveredFrom, 'backup');
});

test('exact printing and privacy acknowledgment are required before saving a fixture', () => {
  const privateDataset = createBenchmarkDataset({ name: 'No Privacy', now: '2026-08-05T00:00:00.000Z' });
  const acknowledged = acknowledgeBenchmarkPrivacy(privateDataset);

  assert.equal(appendBenchmarkFixture(privateDataset, fixtureInput({ selectedPrinting: printing(), capturedImageUri: 'file://capture.jpg' })).ok, false);
  assert.equal(appendBenchmarkFixture(acknowledged, fixtureInput({ selectedPrinting: null, capturedImageUri: 'file://capture.jpg' })).ok, false);
});

test('save fixture creates a stable local-only fixture id and path', () => {
  const dataset = acknowledgeBenchmarkPrivacy(createBenchmarkDataset({ name: 'Stable Fixtures', now: '2026-08-05T00:00:00.000Z' }));
  const saved = appendBenchmarkFixture(dataset, fixtureInput({ selectedPrinting: printing(), capturedImageUri: 'file://capture.jpg' }), '2026-08-05T00:01:00.000Z');

  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.fixture.id, 'stable-fixtures-20260805-rhystic-study-wot-25-modern-frame-front');
  assert.equal(saved.fixture.localImagePath, `${SCANNER_BENCHMARK_FIXTURE_ROOT}/${dataset.id}/images/${saved.fixture.id}.jpg`);
  assert.equal(isRelativeLocalBenchmarkPath(saved.fixture.localImagePath), true);
});

test('duplicate fixture ids are prevented', () => {
  const dataset = acknowledgeBenchmarkPrivacy(createBenchmarkDataset({ name: 'Dupes', now: '2026-08-05T00:00:00.000Z' }));
  const first = appendBenchmarkFixture(dataset, fixtureInput({ selectedPrinting: printing(), capturedImageUri: 'file://capture.jpg' }));
  assert.equal(first.ok, true);
  if (!first.ok) return;

  const duplicate = appendBenchmarkFixture(first.dataset, fixtureInput({ selectedPrinting: printing(), capturedImageUri: 'file://capture-two.jpg' }));
  assert.equal(duplicate.ok, false);
});

test('edit metadata updates fixture labels without changing image path', () => {
  const saved = savedDataset();
  const before = saved.manifest.fixtures[0];
  const edited = editBenchmarkFixture(saved, before.id, { notes: 'Updated label', lightingCondition: 'glare' });
  const after = edited.manifest.fixtures[0];

  assert.equal(after.localImagePath, before.localImagePath);
  assert.equal(after.notes, 'Updated label');
  assert.equal(after.lightingCondition, 'glare');
});

test('retake image preserves stable fixture id and local path', () => {
  const saved = savedDataset();
  const fixtureId = saved.manifest.fixtures[0].id;
  const retaken = retakeBenchmarkFixture(saved, fixtureId, 'file://new-capture.jpg');

  assert.equal(retaken.ok, true);
  if (!retaken.ok) return;
  assert.equal(retaken.dataset.manifest.fixtures[0].id, fixtureId);
  assert.match(retaken.localImagePath, /magic-scanner-private/);
});

test('remove fixture returns the local image path that should be deleted', () => {
  const saved = savedDataset();
  const fixtureId = saved.manifest.fixtures[0].id;
  const removed = removeBenchmarkFixture(saved, fixtureId);

  assert.equal(removed.ok, true);
  if (!removed.ok) return;
  assert.equal(removed.dataset.manifest.fixtures.length, 0);
  assert.match(removed.imagePathToDelete, /magic-scanner-private/);
});

test('delete dataset requires confirmation by dataset name', () => {
  const saved = savedDataset();

  assert.equal(deleteBenchmarkDataset(saved, 'wrong').ok, false);
  const deleted = deleteBenchmarkDataset(saved, saved.name);
  assert.equal(deleted.ok, true);
  if (!deleted.ok) return;
  assert.equal(deleted.fixturePaths.length, 1);
});

test('local-only path enforcement rejects absolute and traversal paths', () => {
  const saved = savedDataset();
  const unsafeAbsolute = { ...saved, manifest: { ...saved.manifest, fixtures: [{ ...saved.manifest.fixtures[0], localImagePath: 'C:/private/card.jpg' }] } };
  const unsafeTraversal = { ...saved, manifest: { ...saved.manifest, fixtures: [{ ...saved.manifest.fixtures[0], localImagePath: `${SCANNER_BENCHMARK_FIXTURE_ROOT}/../card.jpg` }] } };

  assert.equal(validateBenchmarkDatasetManifest(unsafeAbsolute).ok, false);
  assert.equal(validateBenchmarkDatasetManifest(unsafeTraversal).ok, false);
});

test('no upload behavior is explicit', () => {
  const privacy = benchmarkBuilderDoesNotUpload();

  assert.equal(privacy.uploadsImages, false);
  assert.equal(privacy.writesPhotoLibraryByDefault, false);
  assert.equal(privacy.analyticsEnabled, false);
});

test('summary reports incomplete labels and category counts', () => {
  const saved = savedDataset();
  const incomplete = {
    ...saved,
    manifest: { ...saved.manifest, fixtures: [{ ...saved.manifest.fixtures[0], expectedScryfallId: '' }] },
  };

  assert.equal(summarizeBenchmarkDataset(saved).benchmarkReady, true);
  assert.equal(summarizeBenchmarkDataset(saved).categoriesRepresented, 1);
  assert.equal(summarizeBenchmarkDataset(incomplete).incompleteFixtures, 1);
});

test('native benchmark execution falls back to exact desktop command', async () => {
  const saved = savedDataset();
  const result = await runBenchmarkForDataset(saved, 'ios');

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.mode, 'desktop_command');
  assert.match(result.command, /npm run benchmark:magic-scanner/);
});

function savedDataset() {
  const dataset = acknowledgeBenchmarkPrivacy(createBenchmarkDataset({ name: 'Stable Fixtures', now: '2026-08-05T00:00:00.000Z' }));
  const saved = appendBenchmarkFixture(dataset, fixtureInput({ selectedPrinting: printing(), capturedImageUri: 'file://capture.jpg' }));
  if (!saved.ok) throw new Error(saved.error);
  return saved.dataset;
}

function fixtureInput(overrides: Partial<Parameters<typeof appendBenchmarkFixture>[1]>): Parameters<typeof appendBenchmarkFixture>[1] {
  return {
    selectedPrinting: Object.hasOwn(overrides, 'selectedPrinting') ? overrides.selectedPrinting ?? null : printing(),
    expectedFinish: overrides.expectedFinish ?? 'nonfoil',
    frameType: overrides.frameType ?? 'modern_frame',
    sleeveStatus: overrides.sleeveStatus ?? 'unsleeved',
    lightingCondition: overrides.lightingCondition ?? 'controlled',
    angle: overrides.angle ?? 'flat',
    cardFace: overrides.cardFace ?? 'front',
    damageState: overrides.damageState ?? 'normal',
    notes: overrides.notes ?? '',
    capturedImageUri: Object.hasOwn(overrides, 'capturedImageUri') ? overrides.capturedImageUri ?? null : 'file://capture.jpg',
  };
}

function printing(overrides: Partial<ScannerCardCandidate> = {}): ScannerCardCandidate {
  return {
    id: overrides.id ?? 'sf-wot-25',
    name: overrides.name ?? 'Rhystic Study',
    setCode: overrides.setCode ?? 'WOT',
    setName: overrides.setName ?? 'Wilds of Eldraine',
    collectorNumber: overrides.collectorNumber ?? '25',
    finishes: overrides.finishes ?? ['normal'],
    language: overrides.language ?? 'en',
    imageUrl: overrides.imageUrl ?? null,
    confidence: overrides.confidence ?? 0.9,
    recognitionMode: overrides.recognitionMode ?? 'manual_search',
  };
}

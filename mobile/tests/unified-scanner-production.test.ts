import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const mobileRoot = process.cwd().replace(/\\/g, '/').endsWith('/mobile') ? process.cwd() : join(process.cwd(), 'mobile');
const scanner = readFileSync(join(mobileRoot, 'components', 'scanner', 'automatic-scanner-screen.tsx'), 'utf8');
const scanTab = readFileSync(join(mobileRoot, 'app', '(tabs)', 'scan.tsx'), 'utf8');
const automaticRoute = readFileSync(join(mobileRoot, 'app', 'scan', 'automatic.tsx'), 'utf8');
const singleRoute = readFileSync(join(mobileRoot, 'app', 'scan', 'single.tsx'), 'utf8');

test('production exposes one scanner entry and keeps single scan as a compatibility alias', () => {
  assert.match(scanTab, /Trading Docks Scanner/);
  assert.match(scanTab, /Open scanner/);
  assert.match(automaticRoute, /scanner-engine-screen/);
  assert.match(singleRoute, /scanner-engine-screen/);
  assert.doesNotMatch(automaticRoute, /automatic-scanner-screen/);
  assert.doesNotMatch(singleRoute, /automatic-scanner-screen/);
  assert.doesNotMatch(scanTab, /Automatic Scan|Single Scan|Scan Mode|Capture fallback/);
  assert.doesNotMatch(singleRoute, /SingleResultSheet|recognizeMagicStillCapture|ScannerCamera/);
});

test('Auto ON and Auto OFF use the same still-capture recognition path', () => {
  assert.match(scanner, /const captureStill = useCallback\(async \(options: \{ source\?: 'manual' \| 'automatic_fallback' \} = \{\}\) =>/);
  assert.match(scanner, /onCapture=\{captureStill\}/);
  assert.match(scanner, /captureStillRef\.current\(\)/);
  assert.match(scanner, /nextAppleVisionAutoCaptureRuntime\([\s\S]*autoEnabled: autoCaptureEnabled/);
  assert.match(scanner, /recognizeMagicStillCapture\(\{/);
  assert.match(scanner, /scanCardSightWithFallback/);
  assert.match(scanner, /isCardSightScannerEnabled/);
  assert.match(scanner, /preview: previewDimensions \?\? \{ width: previewWidth, height: cameraStageHeight \}/);
  assert.match(scanner, /deferCleanup: true/);
  assert.match(scanner, /source: 'automatic_fallback'/);
  assert.match(scanner, /includeCollectorOcr: isAutomaticFallback/);
  assert.match(scanner, /scannerCameraPreferenceKey\(context\.userId\)/);
  assert.match(scanner, /label="Auto Scan"/);
  assert.doesNotMatch(scanner, /label="Auto Capture"|label="Scan Mode"|ScannerScanMode/);
});

test('production scanner uses bounded rapid live OCR while preserving still-capture fallback', () => {
  assert.match(scanner, /runRapidLiveTitleOcr/);
  assert.match(scanner, /createScannerLiveInferenceState|sampleScannerLiveInference|updateScannerLiveInference/);
  assert.match(scanner, /defaultMagicVisualReferenceIndex/);
  assert.match(scanner, /recognizeMagicStillCapture\(\{/);
  assert.match(scanner, /ScannerStatus/);
  assert.match(scanner, /recognitionStage === 'reading_title'/);
  assert.match(scanner, /recognitionStage === 'finding_card'/);
  assert.doesNotMatch(scanner, /runMultiSignalRecognition|matchVisualDescriptor|Feature Print/i);
});

test('scanner preserves candidate fallback, batch review, and duplicate rearm behavior', () => {
  assert.match(scanner, /setCandidates\(resolvedCandidates\)/);
  assert.match(scanner, /setSelected\(resolvedCandidate\)/);
  assert.match(scanner, /setMagicRecognition\(recognition\)/);
  assert.match(scanner, /addCandidateToBatch/);
  assert.match(scanner, /ScannerSessionStrip/);
  assert.match(scanner, /duplicateProtection\.awaitingCardRemoval/);
  assert.match(scanner, /markCaptureStarted/);
  assert.match(scanner, /markScanResult/);
});

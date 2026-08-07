import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const scanModes = readFileSync(join(process.cwd(), 'app', '(tabs)', 'scan.tsx'), 'utf8');
const automatic = readFileSync(join(process.cwd(), 'components', 'scanner', 'automatic-scanner-screen.tsx'), 'utf8');
const automaticRoute = readFileSync(join(process.cwd(), 'app', 'scan', 'automatic.tsx'), 'utf8');
const single = readFileSync(join(process.cwd(), 'app', 'scan', 'single.tsx'), 'utf8');

test('Scan tab opens premium Scan Modes instead of the immersive camera', () => {
  assert.match(scanModes, /Automatic Scan/);
  assert.match(scanModes, /Hands-free scanning for fast intake/);
  assert.match(scanModes, /Single Scan/);
  assert.match(scanModes, /Review List/);
  assert.doesNotMatch(scanModes, /ScannerCamera/);
});

test('Grid Scan is hidden until supported and has no fake route', () => {
  assert.doesNotMatch(scanModes, /Grid Scan/);
  assert.doesNotMatch(scanModes, /planned but not enabled/);
  assert.doesNotMatch(scanModes, /\/scan\/grid/);
});

test('Review List count is loaded from the user-scoped scanner session', () => {
  assert.match(scanModes, /loadReviewListCount/);
  assert.match(scanModes, /continuousScannerSessionKey\(userId\)/);
  assert.match(scanModes, /session\.userId !== userId/);
});

test('Automatic Scan route reuses the existing native scanner infrastructure', () => {
  assert.match(automaticRoute, /AutomaticScannerScreen/);
  assert.match(automatic, /ScannerCamera/);
  assert.match(automatic, /recognizeMagicStillCapture/);
  assert.match(automatic, /canAutoCaptureNative/);
  assert.match(automatic, /enrichScannerSessionLinePrice/);
});

test('Automatic Scan presents no permanent result card or price UI', () => {
  assert.match(automatic, /Automatic Scan/);
  assert.match(automatic, /Capture fallback/);
  assert.match(automatic, /ScannerSessionStrip/);
  assert.doesNotMatch(automatic, /Market \$|Offer \$/);
  assert.doesNotMatch(automatic, /Market \{compactScannerMoney|Offer \{compactScannerMoney/);
});

test('Automatic Scan keeps one visible instruction source', () => {
  assert.match(automatic, /function ScannerStatus/);
  assert.equal((automatic.match(/<ScannerStatus/g) ?? []).length, 1);
});

test('Single Scan is manual capture with a focused result sheet', () => {
  assert.match(single, /Single Scan/);
  assert.match(single, /Capture/);
  assert.match(single, /SingleResultSheet/);
  assert.match(single, /Add card/);
  assert.match(single, /Retake/);
  assert.match(single, /Single Scan Settings/);
  assert.match(single, /createSingleScanQualityAnalyzer/);
  assert.match(single, /singleScanUserFacingFailure/);
  assert.match(single, /sequentialTitleOcr/);
  assert.match(single, /addRecognitionToSession/);
  assert.match(single, /continuousScannerSessionKey/);
  assert.match(single, /parseScannerSession/);
  assert.doesNotMatch(single, /canAutoCaptureNative/);
});

test('Single Scan uses view dimensions for still-crop mapping instead of native preview resolution', () => {
  assert.match(single, /preview: \{ width, height \}/);
  assert.doesNotMatch(single, /preview: previewResolution \?\? \{ width, height \}/);
});

test('Single Scan treats poor capture quality as advisory before OCR', () => {
  assert.match(single, /currentQuality\.guidance/);
  assert.match(single, /disabled=\{!canCapture\}/);
  assert.match(single, /resolveScannerManualCapturePolicy/);
  assert.match(single, /createScannerCaptureDiagnostic/);
  assert.match(single, /lastCaptureDiagnostic\.forced/);
  assert.doesNotMatch(single, /setMessage\(captureQuality\.guidance\)/);
});

test('scanner settings use simple rows with advanced disclosure', () => {
  assert.match(automatic, /label="Mode"/);
  assert.match(automatic, /label="Camera"/);
  assert.match(automatic, /label="Auto Capture"/);
  assert.match(automatic, /label="Default condition"/);
  assert.match(automatic, /label="Cash Offer"/);
  assert.match(automatic, /label="Sound"/);
  assert.match(automatic, /label="Haptics"/);
  assert.match(automatic, /label="Advanced Settings"/);
  assert.match(automatic, /label="Camera QA"/);
});

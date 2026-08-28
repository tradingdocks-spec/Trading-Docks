import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const scanModes = readFileSync(join(process.cwd(), 'app', '(tabs)', 'scan.tsx'), 'utf8');
const automatic = readFileSync(join(process.cwd(), 'components', 'scanner', 'automatic-scanner-screen.tsx'), 'utf8');
const automaticRoute = readFileSync(join(process.cwd(), 'app', 'scan', 'automatic.tsx'), 'utf8');
const single = readFileSync(join(process.cwd(), 'app', 'scan', 'single.tsx'), 'utf8');

test('Scan tab opens one unified scanner instead of separate production scanner modes', () => {
  assert.match(scanModes, /Trading Docks Scanner/);
  assert.match(scanModes, /describeScanLockState/);
  assert.match(scanModes, /Place card\. Hold steady\. Review exact printing\./);
  assert.match(scanModes, /Review List/);
  assert.doesNotMatch(scanModes, /Automatic Scan/);
  assert.doesNotMatch(scanModes, /Single Scan/);
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

test('unified scanner route reuses the existing native scanner infrastructure', () => {
  assert.match(automaticRoute, /prebuilt-scanner-screen/);
  assert.match(automatic, /ScannerCamera/);
  assert.match(automatic, /recognizeMagicStillCapture/);
  assert.match(automatic, /nextAppleVisionAutoCaptureRuntime/);
  assert.match(automatic, /enrichScannerSessionLinePrice/);
});

test('unified scanner presents compact batch review UI without split scanner copy', () => {
  assert.match(automatic, />Scanner<\/TDText>/);
  assert.match(automatic, /label="Capture card"/);
  assert.match(automatic, /ScannerSessionStrip/);
  assert.doesNotMatch(automatic, /Capture fallback/);
  assert.match(automatic, /runRapidLiveTitleOcr/);
  assert.match(automatic, /ScannerStatus/);
  assert.match(automatic, /cameraLiveStatus/);
  assert.doesNotMatch(automatic, /Market \$|Offer \$/);
  assert.doesNotMatch(automatic, /Market \{compactScannerMoney|Offer \{compactScannerMoney/);
});

test('Automatic Scan keeps one visible instruction source', () => {
  assert.match(automatic, /function ScannerStatus/);
  assert.equal((automatic.match(/<ScannerStatus/g) ?? []).length, 1);
});

test('Single Scan route is a compatibility alias to the unified scanner', () => {
  assert.match(single, /prebuilt-scanner-screen/);
  assert.doesNotMatch(single, /automatic-scanner-screen/);
  assert.doesNotMatch(single, /SingleResultSheet/);
  assert.doesNotMatch(single, /recognizeMagicStillCapture/);
});

test('scanner settings use simple rows with advanced disclosure', () => {
  assert.match(automatic, /label="Mode"/);
  assert.match(automatic, /label="Camera"/);
  assert.match(automatic, /label="Auto Scan"/);
  assert.match(automatic, /label="Default condition"/);
  assert.match(automatic, /label="Cash Offer"/);
  assert.match(automatic, /label="Sound"/);
  assert.match(automatic, /label="Haptics"/);
  assert.match(automatic, /label="Advanced Settings"/);
  assert.match(automatic, /label="Camera QA"/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const routeSource = readFileSync(resolve('app/dev/camera-qa.tsx'), 'utf8');

test('Camera QA route is gated behind scanner diagnostics', () => {
  assert.match(routeSource, /isScannerDiagnosticsEnabled\(\)/);
  assert.match(routeSource, /Camera QA unavailable/);
});

test('Camera QA route avoids OCR session pricing scanner flows', () => {
  assert.doesNotMatch(routeSource, /recognizeMagicStillCapture|recognizeMagicCard|addRecognitionToSession|enrichScannerSessionLinePrice/);
  assert.doesNotMatch(routeSource, /pricing|billing|membership/i);
});

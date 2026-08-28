import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd().replace(/\\/g, '/').endsWith('/mobile') ? process.cwd() : join(process.cwd(), 'mobile');

test('prebuilt scanner bakeoff route stays native-only and uses the Scanbot capture stack', () => {
  const route = readFileSync(join(root, 'app', 'dev', 'scanner-bakeoff.native.tsx'), 'utf8');
  const screen = readFileSync(join(root, 'components', 'scanner', 'prebuilt-scanner-bakeoff-screen.native.tsx'), 'utf8');
  const service = readFileSync(join(root, 'services', 'scanner-prebuilt-bakeoff.ts'), 'utf8');
  const cameraQa = readFileSync(join(root, 'app', 'dev', 'camera-qa.tsx'), 'utf8');
  const appConfig = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;

  assert.match(route, /isScannerDiagnosticsEnabled/);
  assert.match(route, /PrebuiltScannerBakeoffScreen/);
  assert.match(screen, /ScanbotDocumentScannerView/);
  assert.match(screen, /runPrebuiltScannerBakeoff/);
  assert.match(screen, /TD_SCANNER_PROVIDER/);
  assert.match(screen, /freezeCamera/);
  assert.match(screen, /snapDocument/);
  assert.match(screen, /finderAspectRatio/);
  assert.match(screen, /CardSight bakeoff/);
  assert.match(service, /runScannerRecognitionLab/);
  assert.match(service, /scanCardSightWithFallback/);
  assert.match(service, /scanPreparedImageWithTcgTracking/);
  assert.match(cameraQa, /Open Scanbot bakeoff/);
  assert.ok(Array.isArray(appConfig.plugins));
  assert.match(JSON.stringify(appConfig.plugins), /react-native-scanbot-sdk/);
});

test('prebuilt scanner comparison keeps provider-specific inputs separate and preserves the dev-only gate', () => {
  const service = readFileSync(join(root, 'services', 'scanner-prebuilt-bakeoff.ts'), 'utf8');
  const screen = readFileSync(join(root, 'components', 'scanner', 'prebuilt-scanner-bakeoff-screen.native.tsx'), 'utf8');

  assert.match(service, /provider: 'local' \| 'cardsight' \| 'tcgtracking'/);
  assert.match(service, /winner: PrebuiltScannerBakeoffVariant \| null/);
  assert.match(screen, /licenseLabel/);
  assert.match(screen, /scanner diagnostics/gi);
});

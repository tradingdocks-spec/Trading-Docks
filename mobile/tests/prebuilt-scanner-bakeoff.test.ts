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
  const config = readFileSync(join(root, 'services', 'prebuilt-scanbot-config.ts'), 'utf8');

  assert.match(service, /provider: 'local' \| 'cardsight' \| 'tcgtracking'/);
  assert.match(service, /winner: PrebuiltScannerBakeoffVariant \| null/);
  assert.match(screen, /licenseLabel/);
  assert.match(screen, /scanner diagnostics/gi);
  assert.match(screen, /TD_PREBUILT_SCANNER/);
  assert.doesNotMatch(screen, /Use legacy scanner/);
  assert.match(screen, /acceptedSizeScore=\{PREBUILT_SCANBOT_ACCEPTED_SIZE_SCORE\}/);
  assert.match(screen, /acceptedAngleScore=\{PREBUILT_SCANBOT_ACCEPTED_ANGLE_SCORE\}/);
  assert.match(screen, /autoSnappingSensitivity=\{PREBUILT_SCANBOT_AUTO_SNAPPING_SENSITIVITY\}/);
  assert.match(screen, /autoSnappingDelay=\{PREBUILT_SCANBOT_AUTO_SNAPPING_DELAY_SECONDS\}/);
  assert.match(screen, /photoQualityPrioritization=\{PREBUILT_SCANBOT_PHOTO_QUALITY_PRIORITIZATION\}/);
  assert.match(screen, /Card detected/);
  assert.match(screen, /Capturing\.\.\./);
  assert.match(screen, /Checking card\.\.\./);
  assert.doesNotMatch(screen, /fallbackProvider:/);
  assert.match(config, /PREBUILT_SCANBOT_ACCEPTED_SIZE_SCORE = 45/);
  assert.match(config, /PREBUILT_SCANBOT_ACCEPTED_ANGLE_SCORE = 55/);
  assert.match(config, /PREBUILT_SCANBOT_AUTO_SNAPPING_ENABLED = true/);
  assert.match(config, /PREBUILT_SCANBOT_AUTO_SNAPPING_SENSITIVITY = 1\.0/);
  assert.match(config, /PREBUILT_SCANBOT_AUTO_SNAPPING_DELAY_SECONDS = 0\.1/);
  assert.match(config, /PREBUILT_SCANBOT_PHOTO_QUALITY_PRIORITIZATION = 'BALANCED'/);
});

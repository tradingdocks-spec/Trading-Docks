import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { resolveScannerEngineMode } from '../services/scanner-engine.ts';

const root = process.cwd().replace(/\\/g, '/').endsWith('/mobile') ? process.cwd() : join(process.cwd(), 'mobile');

test('scanner engine defaults to prebuilt and keeps legacy as dev-only fallback', () => {
  assert.equal(resolveScannerEngineMode({ NODE_ENV: 'development' }), 'prebuilt');
  assert.equal(resolveScannerEngineMode({ NODE_ENV: 'development', EXPO_PUBLIC_SCANNER_ENGINE: 'legacy' }), 'prebuilt');
  assert.equal(resolveScannerEngineMode({ NODE_ENV: 'production', EXPO_PUBLIC_SCANNER_ENGINE: 'legacy' }), 'prebuilt');
  assert.equal(resolveScannerEngineMode({ NODE_ENV: 'production' }), 'prebuilt');
});

test('normal scanner routes resolve directly to the prebuilt scanner and expose legacy only in dev', () => {
  const automatic = readFileSync(join(root, 'app', 'scan', 'automatic.tsx'), 'utf8');
  const single = readFileSync(join(root, 'app', 'scan', 'single.tsx'), 'utf8');
  const legacyRoute = readFileSync(join(root, 'app', 'dev', 'legacy-scanner.native.tsx'), 'utf8');
  const nativeSelector = readFileSync(join(root, 'components', 'scanner', 'scanner-engine-screen.native.tsx'), 'utf8');
  const webSelector = readFileSync(join(root, 'components', 'scanner', 'scanner-engine-screen.tsx'), 'utf8');
  const productionScreen = readFileSync(join(root, 'components', 'scanner', 'prebuilt-scanner-screen.native.tsx'), 'utf8');

  assert.match(automatic, /prebuilt-scanner-screen/);
  assert.match(single, /prebuilt-scanner-screen/);
  assert.match(legacyRoute, /AutomaticScannerScreen/);
  assert.match(legacyRoute, /__DEV__/);
  assert.match(nativeSelector, /PrebuiltScannerScreen/);
  assert.doesNotMatch(nativeSelector, /AutomaticScannerScreen/);
  assert.match(webSelector, /AutomaticScannerScreen/);
  assert.match(productionScreen, /mode="production"/);
});

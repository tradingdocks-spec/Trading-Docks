import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  createScannerLifecycleGuard,
  shouldApplyScannerAsyncResult,
} from '../services/scanner-camera-lifecycle.ts';

const root = process.cwd();

test('scanner lifecycle guard rejects async results after exit and unmount', () => {
  const snapshots: string[] = [];
  const guard = createScannerLifecycleGuard((snapshot) => {
    snapshots.push(`${snapshot.phase}:${snapshot.pendingOperations}:${snapshot.activeOperationId ?? 'none'}`);
  });

  assert.equal(guard.beginOperation('capture-1'), true);
  assert.equal(shouldApplyScannerAsyncResult(guard, 'capture-1'), true);

  guard.dispose();
  assert.equal(shouldApplyScannerAsyncResult(guard, 'capture-1'), false);
  assert.equal(guard.pendingOperations, 0);

  guard.unmount();
  assert.equal(guard.beginOperation('capture-2'), false);
  assert.equal(shouldApplyScannerAsyncResult(guard), false);
  assert.deepEqual(snapshots, [
    'mounted:1:capture-1',
    'exiting:0:none',
    'unmounted:0:none',
  ]);
});

test('Single Scan route disables camera and ignores stale async work on exit', () => {
  const source = readFileSync(join(root, 'app', 'scan', 'single.tsx'), 'utf8');

  assert.match(source, /createScannerLifecycleGuard/);
  assert.match(source, /exitSingleScan/);
  assert.match(source, /setCameraActive\(false\)/);
  assert.match(source, /active=\{cameraActive\}/);
  assert.match(source, /includeCollectorOcr: false/);
  assert.match(source, /onStage: \(nextStage\) => \{\s*if \(scannerLive\(captureId\)\)/);
  assert.match(source, /if \(!scannerLive\(captureId\)\) return/);
  assert.match(source, /clearTimeout\(focusReticleTimerRef\.current\)/);
});

test('ScannerCamera wrapper rejects stale native callbacks when inactive', () => {
  const source = readFileSync(join(root, 'components', 'scanner-camera.tsx'), 'utf8');

  assert.match(source, /mountedRef/);
  assert.match(source, /activeRef/);
  assert.match(source, /if \(!mountedRef\.current \|\| !activeRef\.current\) return/);
  assert.match(source, /throw new Error\('Camera capture was cancelled\.'\)/);
  assert.match(source, /onPreviewStopped\?\.\(\)/);
});

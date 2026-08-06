import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const repo = join(process.cwd(), '..');

test('active Scan route remains manual still-capture until native frame signals are wired', () => {
  const scan = readFileSync(join(process.cwd(), 'app', '(tabs)', 'scan.tsx'), 'utf8');

  assert.match(scan, /from 'expo-camera'/);
  assert.match(scan, /takePictureAsync/);
  assert.match(scan, /NO_NATIVE_VISUAL_SIGNALS/);
  assert.doesNotMatch(scan, /useFrameProcessor|VisionCamera/);
});

test('native auto-capture plan documents honest blockers and implementation gates', () => {
  const plan = readFileSync(join(repo, 'docs', 'SCANNER_AUTO_CAPTURE_NATIVE_PLAN.md'), 'utf8');

  assert.match(plan, /Status: Planned/);
  assert.match(plan, /does not yet feed live VisionCamera frames/);
  assert.match(plan, /No fake signal, fake FPS, or fake readiness/);
  assert.match(plan, /same stationary card cannot scan twice/i);
  assert.match(plan, /Physical iOS and Android tests/);
});

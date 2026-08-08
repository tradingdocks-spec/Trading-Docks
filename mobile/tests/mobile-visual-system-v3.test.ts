import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

test('Trading Docks material system V3 exposes canonical material classes', () => {
  const designSystem = readFileSync(join(root, 'components', 'design-system.tsx'), 'utf8');

  for (const material of ['canvas', 'structuralDock', 'insetBay', 'raisedControl', 'collectibleObject', 'activeInstrument']) {
    assert.match(designSystem, new RegExp(`'${material}'`));
  }
  assert.match(designSystem, /materialStyle/);
});

test('Home uses shared material primitives for instrument and dock rail surfaces', () => {
  const home = readFileSync(join(root, 'app', '(tabs)', 'index.tsx'), 'utf8');

  assert.match(home, /material="activeInstrument"/);
  assert.match(home, /material="raisedControl"/);
  assert.match(home, /DockRail compact/);
  assert.doesNotMatch(home, /generic dark React Native/i);
});

test('Collection keeps plan usage compact and elevates storage location chips', () => {
  const collection = readFileSync(join(root, 'app', '(tabs)', 'collection.tsx'), 'utf8');

  assert.match(collection, /healthStrip/);
  assert.match(collection, /LocationBreadcrumb/);
  assert.match(collection, /Free plan card limit/);
  assert.doesNotMatch(collection, /Current signals/);
});

test('Scan hub uses scanner instrument and Reduce Motion aware animation', () => {
  const scan = readFileSync(join(root, 'app', '(tabs)', 'scan.tsx'), 'utf8');

  assert.match(scan, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(scan, /Animated\.loop/);
  assert.match(scan, /aperture/);
  assert.match(scan, /Start scanning/);
});

test('Account uses pass-like collectible material and connected inset groups', () => {
  const account = readFileSync(join(root, 'app', '(tabs)', 'profile.tsx'), 'utf8');

  assert.match(account, /material="collectibleObject"/);
  assert.match(account, /material="insetBay"/);
  assert.match(account, /Current plan:/);
});

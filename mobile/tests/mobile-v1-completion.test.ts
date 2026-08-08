import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

function routeExists(route: string) {
  const normalized = route.replace(/\?.*$/, '');
  if (normalized === '/' || normalized === '/(tabs)') return existsSync(join(root, 'app', '(tabs)', 'index.tsx'));
  if (normalized === '/scan') return existsSync(join(root, 'app', '(tabs)', 'scan.tsx'));
  if (normalized.startsWith('/(tabs)/')) return existsSync(join(root, 'app', '(tabs)', `${normalized.replace('/(tabs)/', '')}.tsx`));
  if (normalized === '/collection/[cardId]') return existsSync(join(root, 'app', 'collection', '[cardId].tsx'));
  const parts = normalized.split('/').filter(Boolean);
  if (!parts.length) return existsSync(join(root, 'app', 'index.tsx'));
  return existsSync(join(root, 'app', ...parts) + '.tsx') || existsSync(join(root, 'app', ...parts, 'index.tsx'));
}

test('production mobile routes documented in the completion audit exist or are deliberate handoffs', () => {
  const audit = readFileSync(join(root, '..', 'docs', 'MOBILE_PRODUCT_COMPLETION_AUDIT.md'), 'utf8');
  const matrix = readFileSync(join(root, '..', 'docs', 'MOBILE_V1_RELEASE_MATRIX.md'), 'utf8');

  for (const route of [
    '/welcome',
    '/auth',
    '/onboarding',
    '/(tabs)',
    '/(tabs)/collection',
    '/collection/[cardId]',
    '/storage-locations',
    '/trade-binder',
    '/wishlist',
    '/(tabs)/scan',
    '/scan/automatic',
    '/scan/single',
    '/scanner-session',
    '/scanner-recovery',
    '/(tabs)/sell',
    '/deal-desk',
    '/(tabs)/profile',
    '/plans',
    '/settings',
    '/account-delete',
  ]) {
    assert.equal(routeExists(route), true, `${route} should resolve to a mobile route file`);
    assert.match(audit, new RegExp(route.replace(/[()[\]/]/g, '\\$&')));
  }

  assert.match(matrix, /Headquarters-only/);
});

test('visible production route actions point to existing mobile routes', () => {
  const files = [
    'app/welcome.tsx',
    'app/onboarding.tsx',
    'app/(tabs)/index.tsx',
    'app/(tabs)/collection.tsx',
    'app/(tabs)/scan.tsx',
    'app/(tabs)/sell.tsx',
    'app/(tabs)/profile.tsx',
    'app/settings.tsx',
    'app/scan/single.tsx',
    'components/scanner/automatic-scanner-screen.tsx',
  ];
  const routePattern = /router\.(?:push|replace)\('([^']+)'/g;

  for (const file of files) {
    const content = source(file);
    for (const match of content.matchAll(routePattern)) {
      const route = match[1];
      if (route.startsWith('/dev/')) continue;
      assert.equal(routeExists(route), true, `${file} routes to missing ${route}`);
    }
  }
});

test('mobile v1 production surfaces avoid unfinished visible controls', () => {
  const home = source('app/(tabs)/index.tsx');
  const intelligence = source('app/(tabs)/sell.tsx');
  const settings = source('app/settings.tsx');
  const adminLayout = source('app/admin/_layout.tsx');

  assert.doesNotMatch(home, /Notifications unavailable/);
  assert.match(intelligence, /Current signals/);
  assert.match(intelligence, /buildCollectionIntelligence/);
  assert.doesNotMatch(intelligence, /value="Soon"|Coming soon|will appear only after/);
  assert.doesNotMatch(settings, /Switch|useState\(initialValues\)|foundation preferences/);
  assert.match(settings, /Settings only show production-backed behavior/);
  assert.match(adminLayout, /Command Center is web-only/);
  assert.match(adminLayout, /Open Headquarters/);
  assert.doesNotMatch(adminLayout, /<Slot/);
});

test('development tools remain gated and out of production navigation', () => {
  const releaseUx = source('services/mobile-release-ux.ts');
  const scan = source('components/scanner/automatic-scanner-screen.tsx');
  const profile = source('app/(tabs)/profile.tsx');

  assert.match(releaseUx, /isMobileDevRouteEnabled/);
  assert.match(releaseUx, /MOBILE_PUBLIC_ENV_KEYS\.designSystemShowcase/);
  assert.match(releaseUx, /MOBILE_PUBLIC_ENV_KEYS\.scannerBenchmarkBuilder/);
  assert.match(releaseUx, /MOBILE_PUBLIC_ENV_KEYS\.scannerDiagnostics/);
  assert.doesNotMatch(profile, /\/admin\//);
  assert.match(scan, /diagnosticsEnabled \? <TDButton label="Camera QA"/);
});

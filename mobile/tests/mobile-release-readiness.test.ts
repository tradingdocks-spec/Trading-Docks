import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  MOBILE_PRODUCTION_ANDROID_PACKAGE,
  MOBILE_PRODUCTION_IOS_BUNDLE_ID,
  getMobileReleaseLinks,
  isDevelopmentToolEnabled,
  publicEnvLooksSecret,
} from '../services/mobile-release-config.ts';
import { SCANNER_DIAGNOSTICS_DEV_FLAG, isScannerDiagnosticsEnabled } from '../services/native-scanner-calibration.ts';
import { SCANNER_BENCHMARK_BUILDER_FLAG, isScannerBenchmarkBuilderEnabled } from '../services/scanner-benchmark-builder.ts';

const require = createRequire(import.meta.url);
const root = process.cwd();
type JsonObject = Record<string, unknown>;
const { verifyProductionRelease } = require('../scripts/verify-production-release.js') as {
  verifyProductionRelease: (input?: {
    appConfig?: JsonObject;
    easConfig?: JsonObject;
    packageConfig?: JsonObject;
    env?: Record<string, string | undefined>;
  }) => { ok: boolean; errors: string[] };
};

test('production app identifiers are canonical and not placeholders', () => {
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;

  assert.equal(app.ios.bundleIdentifier, MOBILE_PRODUCTION_IOS_BUNDLE_ID);
  assert.equal(app.android.package, MOBILE_PRODUCTION_ANDROID_PACKAGE);
  assert.notEqual(app.android.package, 'com.placeholder.appid');
  assert.equal(app.ios.buildNumber, '7');
  assert.equal(app.android.versionCode, 1);
});

test('development tools are disabled in production even when flags are set', () => {
  const env = {
    NODE_ENV: 'production',
    [SCANNER_DIAGNOSTICS_DEV_FLAG]: 'true',
    [SCANNER_BENCHMARK_BUILDER_FLAG]: 'true',
    EXPO_PUBLIC_ENABLE_DESIGN_SYSTEM_SHOWCASE: 'true',
  };

  assert.equal(isScannerDiagnosticsEnabled(env), false);
  assert.equal(isScannerBenchmarkBuilderEnabled(env), false);
  assert.equal(isDevelopmentToolEnabled('EXPO_PUBLIC_ENABLE_DESIGN_SYSTEM_SHOWCASE', env), false);
});

test('dev route entries redirect when production gates are closed', () => {
  const design = readFileSync(join(root, 'app', 'dev', 'design-system.tsx'), 'utf8');
  const camera = readFileSync(join(root, 'app', 'dev', 'camera-qa.tsx'), 'utf8');
  const benchmark = readFileSync(join(root, 'app', 'dev', 'scanner-benchmark.tsx'), 'utf8');

  for (const source of [design, camera, benchmark]) {
    assert.match(source, /<Redirect href="\/\(tabs\)" \/>/);
  }
});

test('account deletion route is a request contract, not client-side destructive deletion', () => {
  const source = readFileSync(join(root, 'app', 'account-delete.tsx'), 'utf8');

  assert.match(source, /Request account deletion/);
  assert.match(source, /Backend self-service deletion is Planned/);
  assert.doesNotMatch(source, /deleteUser|auth\.admin|from\('.*'\)\.delete/);
});

test('profile and settings expose legal support delete account and version surfaces', () => {
  const profile = readFileSync(join(root, 'app', '(tabs)', 'profile.tsx'), 'utf8');
  const settings = readFileSync(join(root, 'app', 'settings.tsx'), 'utf8');

  for (const source of [profile, settings]) {
    assert.match(source, /Support/);
    assert.match(source, /Privacy Policy/);
    assert.match(source, /Terms of Service/);
    assert.match(source, /Delete Account/);
    assert.match(source, /getMobileAppVersionInfo/);
  }
});

test('root error boundary avoids raw implementation details', () => {
  const rootLayout = readFileSync(join(root, 'app', '_layout.tsx'), 'utf8');

  assert.match(rootLayout, /Something went wrong/);
  assert.match(rootLayout, /Try again/);
  assert.match(rootLayout, /Go Home/);
  assert.doesNotMatch(rootLayout, /error\.message|stack|file path|Supabase|Scryfall/);
});

test('release links use documented defaults without localhost or development URLs', () => {
  const links = getMobileReleaseLinks({});

  assert.equal(links.privacy.url, 'https://www.tradingdocks.com/privacy');
  assert.equal(links.terms.url, 'https://www.tradingdocks.com/terms');
  assert.equal(links.support.url, 'mailto:tradingdocks@gmail.com');
  for (const link of Object.values(links)) {
    assert.doesNotMatch(link.url, /localhost|tradingdocks\.local/i);
  }
});

test('public env secret detection catches service role and secret keys', () => {
  assert.equal(publicEnvLooksSecret('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'sb_publishable_123'), false);
  assert.equal(publicEnvLooksSecret('EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY', 'abc'), true);
  assert.equal(publicEnvLooksSecret('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'sb_secret_123'), true);
});

test('production release validator fails unsafe inputs and passes canonical config', () => {
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
  const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

  const ok = verifyProductionRelease({
    appConfig: app,
    easConfig: eas,
    packageConfig: pkg,
    env: {
      NODE_ENV: 'production',
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_example',
      EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'appl_public_example',
      EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'goog_public_example',
    },
  });
  assert.equal(ok.ok, true);

  const bad = verifyProductionRelease({
    appConfig: { ...app, android: { ...app.android, package: 'com.placeholder.appid' } },
    easConfig: eas,
    packageConfig: pkg,
    env: {
      NODE_ENV: 'production',
      EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS: 'true',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_bad',
    },
  });
  assert.equal(bad.ok, false);
  assert.match(bad.errors.join(' '), /placeholder|diagnostics|SUPABASE_URL|Forbidden/);
});

test('production release validator requires public RevenueCat SDK configuration once purchases are enabled', () => {
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
  const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

  const result = verifyProductionRelease({
    appConfig: app,
    easConfig: eas,
    packageConfig: pkg,
    env: {
      NODE_ENV: 'production',
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_example',
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /EXPO_PUBLIC_REVENUECAT_IOS_API_KEY/);
  assert.match(result.errors.join(' '), /EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY/);
});

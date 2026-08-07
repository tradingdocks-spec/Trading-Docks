#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const APP_JSON = path.join(PROJECT_ROOT, 'app.json');
const EAS_JSON = path.join(PROJECT_ROOT, 'eas.json');
const PACKAGE_JSON = path.join(PROJECT_ROOT, 'package.json');

const IOS_BUNDLE_ID = 'com.tradingdocks.app';
const ANDROID_PACKAGE = 'com.tradingdocks.app';
const FORBIDDEN_PUBLIC_ENV = /SERVICE_ROLE|SUPABASE_SERVICE_ROLE|SUPABASE_SECRET|sb_secret/i;
const DEV_FLAGS = [
  'EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS',
  'EXPO_PUBLIC_ENABLE_SCANNER_BENCHMARK_BUILDER',
  'EXPO_PUBLIC_ENABLE_DESIGN_SYSTEM_SHOWCASE',
];
const REQUIRED_PRODUCTION_ENV = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
];

function verifyProductionRelease({
  appConfig,
  easConfig,
  packageConfig,
  env = process.env,
  strictEnv = env.NODE_ENV === 'production',
} = {}) {
  const app = appConfig ?? readJson(APP_JSON).expo;
  const eas = easConfig ?? readJson(EAS_JSON);
  const pkg = packageConfig ?? readJson(PACKAGE_JSON);
  const errors = [];
  const warnings = [];

  if (app.ios?.bundleIdentifier !== IOS_BUNDLE_ID) errors.push(`iOS bundle identifier must be ${IOS_BUNDLE_ID}.`);
  if (app.android?.package !== ANDROID_PACKAGE) errors.push(`Android package must be ${ANDROID_PACKAGE}.`);
  if (app.android?.package === 'com.placeholder.appid') errors.push('Android package still uses the Expo placeholder identifier.');
  if (!app.version || !/^\d+\.\d+\.\d+$/.test(app.version)) errors.push('Expo version must be a semantic version.');
  if (!app.ios?.buildNumber) errors.push('iOS buildNumber is required.');
  if (!Number.isInteger(app.android?.versionCode) || app.android.versionCode < 1) errors.push('Android versionCode must be a positive integer.');

  for (const profile of ['development', 'preview', 'production']) {
    if (!eas.build?.[profile]) errors.push(`EAS build profile "${profile}" is missing.`);
  }
  if (!eas.build?.production?.autoIncrement) warnings.push('Production EAS profile should auto-increment builds.');

  if (!pkg.scripts?.['verify:production-release']) errors.push('package.json must expose npm run verify:production-release.');

  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('EXPO_PUBLIC_') && FORBIDDEN_PUBLIC_ENV.test(`${key}=${value ?? ''}`)) {
      errors.push(`Forbidden public environment value detected: ${key}.`);
    }
  }

  for (const flag of DEV_FLAGS) {
    if (env[flag] === 'true') errors.push(`${flag} must not be enabled for production release validation.`);
  }

  if (strictEnv) {
    for (const key of REQUIRED_PRODUCTION_ENV) {
      if (!env[key]) errors.push(`${key} is required for a production mobile build.`);
    }
  } else {
    warnings.push('Production env checks were not strict because NODE_ENV is not production.');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    identifiers: {
      iosBundleIdentifier: app.ios?.bundleIdentifier ?? null,
      androidPackage: app.android?.package ?? null,
      version: app.version ?? null,
      iosBuildNumber: app.ios?.buildNumber ?? null,
      androidVersionCode: app.android?.versionCode ?? null,
    },
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function runCli() {
  const result = verifyProductionRelease();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

if (require.main === module) runCli();

module.exports = { verifyProductionRelease };

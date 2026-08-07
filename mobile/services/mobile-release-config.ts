export const MOBILE_PRODUCTION_IOS_BUNDLE_ID = 'com.tradingdocks.app';
export const MOBILE_PRODUCTION_ANDROID_PACKAGE = 'com.tradingdocks.app';
export const MOBILE_CANONICAL_SITE_URL = 'https://www.tradingdocks.com';

export const MOBILE_PUBLIC_ENV_KEYS = {
  supabaseUrl: 'EXPO_PUBLIC_SUPABASE_URL',
  supabaseAnonKey: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  supportUrl: 'EXPO_PUBLIC_SUPPORT_URL',
  privacyUrl: 'EXPO_PUBLIC_PRIVACY_URL',
  termsUrl: 'EXPO_PUBLIC_TERMS_URL',
  scannerDiagnostics: 'EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS',
  scannerBenchmarkBuilder: 'EXPO_PUBLIC_ENABLE_SCANNER_BENCHMARK_BUILDER',
  designSystemShowcase: 'EXPO_PUBLIC_ENABLE_DESIGN_SYSTEM_SHOWCASE',
} as const;

export type MobileReleaseLinkKey = 'support' | 'privacy' | 'terms';

export type MobileReleaseLink = {
  key: MobileReleaseLinkKey;
  label: string;
  url: string;
  configuredFromEnv: boolean;
  releaseStatus: 'configured' | 'uses_documented_default';
};

export type MobileAppVersionInfo = {
  name: string;
  version: string;
  build: string;
  iosBundleIdentifier: string | null;
  androidPackage: string | null;
};

type ExpoReleaseConfig = {
  name?: string;
  version?: string;
  ios?: {
    buildNumber?: string;
    bundleIdentifier?: string;
  };
  android?: {
    versionCode?: number;
    package?: string;
  };
};

type ExpoConstantsShape = {
  expoConfig?: ExpoReleaseConfig;
  applicationId?: string | null;
  nativeBuildVersion?: string | null;
};

export function isProductionRuntime(env: Record<string, string | undefined> = process.env) {
  return env.NODE_ENV === 'production';
}

export function isDevelopmentToolEnabled(flagName: string, env: Record<string, string | undefined> = process.env) {
  return !isProductionRuntime(env) && env[flagName] === 'true';
}

export function getMobileReleaseLinks(env: Record<string, string | undefined> = process.env): Record<MobileReleaseLinkKey, MobileReleaseLink> {
  return {
    support: releaseLink('support', 'Support', env[MOBILE_PUBLIC_ENV_KEYS.supportUrl], 'mailto:tradingdocks@gmail.com'),
    privacy: releaseLink('privacy', 'Privacy Policy', env[MOBILE_PUBLIC_ENV_KEYS.privacyUrl], `${MOBILE_CANONICAL_SITE_URL}/privacy`),
    terms: releaseLink('terms', 'Terms of Service', env[MOBILE_PUBLIC_ENV_KEYS.termsUrl], `${MOBILE_CANONICAL_SITE_URL}/terms`),
  };
}

export function getMobileAppVersionInfo(): MobileAppVersionInfo {
  const Constants = loadExpoConstants();
  const expoConfig = Constants.expoConfig;
  const applicationId = Constants.applicationId ?? null;
  const nativeBuildVersion = Constants.nativeBuildVersion ?? expoConfig?.ios?.buildNumber ?? String(expoConfig?.android?.versionCode ?? '');
  return {
    name: expoConfig?.name ?? 'Trading Docks',
    version: expoConfig?.version ?? '0.0.0',
    build: nativeBuildVersion || 'unavailable',
    iosBundleIdentifier: expoConfig?.ios?.bundleIdentifier ?? (applicationId?.startsWith('com.') ? applicationId : null),
    androidPackage: expoConfig?.android?.package ?? applicationId,
  };
}

export function publicEnvLooksSecret(key: string, value: string | undefined) {
  const normalized = `${key}=${value ?? ''}`.toLowerCase();
  return normalized.includes('service_role')
    || normalized.includes('supabase_service_role')
    || normalized.includes('supabase_secret')
    || normalized.includes('sb_secret');
}

function releaseLink(
  key: MobileReleaseLinkKey,
  label: string,
  configured: string | undefined,
  fallback: string,
): MobileReleaseLink {
  const trimmed = configured?.trim();
  return {
    key,
    label,
    url: trimmed || fallback,
    configuredFromEnv: Boolean(trimmed),
    releaseStatus: trimmed ? 'configured' : 'uses_documented_default',
  };
}

function loadExpoConstants(): ExpoConstantsShape {
  try {
    // Keep Expo runtime metadata lazy so pure release-config tests can run in Node without loading Expo internals.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const constantsModule = require('expo-constants') as typeof import('expo-constants');
    return constantsModule.default as ExpoConstantsShape;
  } catch {
    return {
      expoConfig: {
        name: 'Trading Docks',
        version: '0.0.0',
      },
      applicationId: null,
      nativeBuildVersion: null,
    };
  }
}

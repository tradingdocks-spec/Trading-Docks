import { isDevelopmentToolEnabled } from './mobile-release-config.ts';

export type ScannerProviderKind = 'recognition' | 'normalization' | 'pricing' | 'metadata';

export type ScannerProviderAvailability =
  | 'available'
  | 'disabled'
  | 'requires_credentials'
  | 'requires_reference_dataset'
  | 'requires_development_build'
  | 'unavailable';

export type ScannerProviderDocsLink = {
  label: string;
  url: string;
};

export type ScannerProviderManifest = {
  id: string;
  name: string;
  kind: ScannerProviderKind;
  availability: ScannerProviderAvailability;
  featureFlag: string | null;
  requiresServerSideSecrets: boolean;
  requiresReferenceDataset: boolean;
  requiresDevelopmentBuild: boolean;
  networkRequired: boolean;
  cropRequirement: 'raw' | 'normalized_crop' | 'reference_dataset' | 'server_image' | 'unknown';
  costModel: 'per_request' | 'per_reference_dataset' | 'license' | 'mixed' | 'unknown';
  docs: ScannerProviderDocsLink[];
  notes: string;
};

export type ScannerProviderFlagMatrix = {
  cardsightEnabled: boolean;
  tcgtrackingEnabled: boolean;
  tineyeEnabled: boolean;
  scanbotNormalizerEnabled: boolean;
  dynamsoftNormalizerEnabled: boolean;
};

export const SCANNER_PROVIDER_FLAG_KEYS = {
  cardsight: 'SCANNER_PROVIDER_CARDSIGHT_ENABLED',
  tcgtracking: 'SCANNER_PROVIDER_TCGTRACKING_ENABLED',
  tineye: 'SCANNER_PROVIDER_TINEYE_ENABLED',
  scanbotNormalizer: 'SCANNER_NORMALIZER_SCANBOT_ENABLED',
  dynamsoftNormalizer: 'SCANNER_NORMALIZER_DYNAMSOFT_ENABLED',
} as const;

export const SCANNER_PROVIDER_DOCS = {
  cardsight: [
    { label: 'Developer docs', url: 'https://cardsight.ai/documentation' },
    { label: 'Identification overview', url: 'https://cardsight.ai/solutions/identification' },
    { label: 'Developer portal', url: 'https://cardsight.ai/for-developers' },
  ],
  tineye: [
    { label: 'Developer docs', url: 'https://services.tineye.com/developers/cardsearchengine/' },
    { label: 'How it works', url: 'https://help.tineye.com/article/307-how-cardsearchengine-works' },
    { label: 'Getting started', url: 'https://help.tineye.com/article/308-before-you-get-started' },
  ],
  scanbot: [
    { label: 'React Native docs', url: 'https://docs.scanbot.io/react-native/document-scanner-sdk/introduction/' },
    { label: 'Expo quick start', url: 'https://docs.scanbot.io/react-native/document-scanner-sdk/quick-start/' },
    { label: 'React Native product page', url: 'https://scanbot.io/developer/react-native-document-scanner/' },
  ],
  dynamsoft: [
    { label: 'Capture Vision docs', url: 'https://www.dynamsoft.com/capture-vision/docs/core/' },
    { label: 'React Native product page', url: 'https://www.dynamsoft.com/capture-vision/react-native/' },
    { label: 'React Native samples', url: 'https://www.dynamsoft.com/capture-vision/docs/mobile/programming/react-native/samples/' },
  ],
  tcgtracking: [
    { label: 'Current Trading Docks integration', url: 'https://www.tradingdocks.com/api/scanner/tcgtracking' },
  ],
} as const;

export function resolveScannerProviderFlags(env: Record<string, string | undefined> = process.env): ScannerProviderFlagMatrix {
  return {
    cardsightEnabled: isTruthyEnv(env[SCANNER_PROVIDER_FLAG_KEYS.cardsight]),
    tcgtrackingEnabled: isTruthyEnv(env[SCANNER_PROVIDER_FLAG_KEYS.tcgtracking]),
    tineyeEnabled: isTruthyEnv(env[SCANNER_PROVIDER_FLAG_KEYS.tineye]),
    scanbotNormalizerEnabled: isTruthyEnv(env[SCANNER_PROVIDER_FLAG_KEYS.scanbotNormalizer]),
    dynamsoftNormalizerEnabled: isTruthyEnv(env[SCANNER_PROVIDER_FLAG_KEYS.dynamsoftNormalizer]),
  };
}

export function buildScannerProviderManifest(flags: ScannerProviderFlagMatrix): ScannerProviderManifest[] {
  return [
    {
      id: 'trading-docks-local',
      name: 'Trading Docks local OCR + visual pipeline',
      kind: 'recognition',
      availability: 'available',
      featureFlag: null,
      requiresServerSideSecrets: false,
      requiresReferenceDataset: false,
      requiresDevelopmentBuild: false,
      networkRequired: false,
      cropRequirement: 'normalized_crop',
      costModel: 'unknown',
      docs: [{ label: 'Internal pipeline', url: 'https://www.tradingdocks.com' }],
      notes: 'Current baseline. Keeps the existing OCR, visual index, Scryfall authority, and inventory validation.',
    },
    {
      id: 'tcgtracking',
      name: 'TCGTracking scan provider',
      kind: 'recognition',
      availability: flags.tcgtrackingEnabled ? 'available' : 'disabled',
      featureFlag: SCANNER_PROVIDER_FLAG_KEYS.tcgtracking,
      requiresServerSideSecrets: false,
      requiresReferenceDataset: false,
      requiresDevelopmentBuild: false,
      networkRequired: true,
      cropRequirement: 'normalized_crop',
      costModel: 'per_request',
      docs: [...SCANNER_PROVIDER_DOCS.tcgtracking],
      notes: 'Existing provider-backed fallback. Requires a reasonably clean cropped card image.',
    },
    {
      id: 'cardsight',
      name: 'CardSight AI',
      kind: 'recognition',
      availability: flags.cardsightEnabled ? 'requires_credentials' : 'disabled',
      featureFlag: SCANNER_PROVIDER_FLAG_KEYS.cardsight,
      requiresServerSideSecrets: true,
      requiresReferenceDataset: false,
      requiresDevelopmentBuild: false,
      networkRequired: true,
      cropRequirement: 'normalized_crop',
      costModel: 'per_request',
      docs: [...SCANNER_PROVIDER_DOCS.cardsight],
      notes: 'Official docs advertise a trading-card identification API and pricing/search endpoints. Keep credentials server-side.',
    },
    {
      id: 'tineye-cardsearchengine',
      name: 'TinEye CardSearchEngine',
      kind: 'recognition',
      availability: flags.tineyeEnabled ? 'requires_reference_dataset' : 'disabled',
      featureFlag: SCANNER_PROVIDER_FLAG_KEYS.tineye,
      requiresServerSideSecrets: true,
      requiresReferenceDataset: true,
      requiresDevelopmentBuild: false,
      networkRequired: true,
      cropRequirement: 'reference_dataset',
      costModel: 'per_request',
      docs: [...SCANNER_PROVIDER_DOCS.tineye],
      notes: 'TinEye returns a filepath into your own reference corpus rather than card metadata. Treat it as a visual matching layer only.',
    },
    {
      id: 'scanbot-normalizer',
      name: 'Scanbot normalizer',
      kind: 'normalization',
      availability: flags.scanbotNormalizerEnabled ? 'requires_development_build' : 'disabled',
      featureFlag: SCANNER_PROVIDER_FLAG_KEYS.scanbotNormalizer,
      requiresServerSideSecrets: false,
      requiresReferenceDataset: false,
      requiresDevelopmentBuild: true,
      networkRequired: false,
      cropRequirement: 'normalized_crop',
      costModel: 'license',
      docs: [...SCANNER_PROVIDER_DOCS.scanbot],
      notes: 'Expo support is documented for development builds, with automatic capture and auto-cropping.',
    },
    {
      id: 'dynamsoft-normalizer',
      name: 'Dynamsoft Document Normalizer',
      kind: 'normalization',
      availability: flags.dynamsoftNormalizerEnabled ? 'requires_development_build' : 'disabled',
      featureFlag: SCANNER_PROVIDER_FLAG_KEYS.dynamsoftNormalizer,
      requiresServerSideSecrets: false,
      requiresReferenceDataset: false,
      requiresDevelopmentBuild: true,
      networkRequired: false,
      cropRequirement: 'normalized_crop',
      costModel: 'license',
      docs: [...SCANNER_PROVIDER_DOCS.dynamsoft],
      notes: 'Capture Vision aggregates normalizer and camera enhancer modules for on-device document geometry and perspective correction.',
    },
  ];
}

export function scannerProviderSummary(manifest: readonly ScannerProviderManifest[]) {
  return {
    recognitionProviders: manifest.filter((provider) => provider.kind === 'recognition').length,
    normalizers: manifest.filter((provider) => provider.kind === 'normalization').length,
    availableProviders: manifest.filter((provider) => provider.availability === 'available').length,
    gatedProviders: manifest.filter((provider) => provider.availability !== 'available').length,
  };
}

function isTruthyEnv(value: string | undefined) {
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

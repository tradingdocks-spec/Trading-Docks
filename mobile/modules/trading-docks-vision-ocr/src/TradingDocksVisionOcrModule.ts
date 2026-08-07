import type { CardRegionType, OCRObservation } from '../../../services/scanner-intelligence';

declare const require: (moduleName: string) => unknown;

export type NativeOcrRecognitionLevel = 'fast' | 'accurate';

export type NativeOcrRegion = {
  id: string;
  regionType: Extract<CardRegionType, 'name' | 'type_line' | 'collector_info' | 'collector_number' | 'language_rarity' | 'bottom_left_printing'> | 'bottom_left' | 'bottom_right';
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NativeOcrRequest = {
  imageUri: string;
  regions: NativeOcrRegion[];
  languages?: string[];
  recognitionLevel?: NativeOcrRecognitionLevel;
};

export type NativeOcrObservation = OCRObservation & {
  id: string;
  requestedRegionId: string;
  rawText: string;
  bounds: { x: number; y: number; width: number; height: number };
};

export type NativeOcrResult =
  | {
    ok: true;
    provider: 'apple_vision';
    fullText: string;
    observations: NativeOcrObservation[];
    latencyMs: number;
    orientationUsed: string;
    warnings: string[];
  }
  | {
    ok: false;
    provider: 'apple_vision' | 'unsupported_platform' | 'native_module_unavailable';
    code:
      | 'unsupported_platform'
      | 'native_module_unavailable'
      | 'invalid_request'
      | 'image_load_failed'
      | 'vision_unavailable'
      | 'vision_failed'
      | 'empty_result';
    message: string;
    latencyMs: number;
    warnings: string[];
  };

type NativeModuleShape = {
  recognizeText(request: NativeOcrRequest): Promise<NativeOcrResult>;
  getDiagnostics?: () => Promise<NativeOcrRuntimeDiagnostics>;
};

export type NativeOcrRuntimeDiagnostics = {
  moduleLinked: boolean;
  runtimeModuleName: 'TradingDocksVisionOcr';
  nativeModuleVersion: string;
  platform: string;
};

export async function recognizeText(request: NativeOcrRequest, nativeModule?: NativeModuleShape | null, platform = currentPlatform()): Promise<NativeOcrResult> {
  const validation = validateNativeOcrRequest(request);
  if (!validation.ok) return validation.result;
  if (platform !== 'ios') {
    return {
      ok: false,
      provider: 'unsupported_platform',
      code: 'unsupported_platform',
      message: 'Trading Docks native OCR v1 is implemented for iOS Apple Vision only.',
      latencyMs: 0,
      warnings: ['Android and web OCR are explicitly unsupported in this branch.'],
    };
  }
  const resolvedNativeModule = nativeModule === undefined ? loadNativeModule(platform) : nativeModule;
  if (!resolvedNativeModule) {
    return {
      ok: false,
      provider: 'native_module_unavailable',
      code: 'native_module_unavailable',
      message: 'TradingDocksVisionOcr native module is not available. Install a new EAS development build.',
      latencyMs: 0,
      warnings: ['The source image URI was not logged or uploaded.'],
    };
  }
  return resolvedNativeModule.recognizeText({
    ...request,
    languages: request.languages?.length ? request.languages : ['en-US'],
    recognitionLevel: request.recognitionLevel ?? 'accurate',
  });
}

export function validateNativeOcrRequest(request: NativeOcrRequest): { ok: true } | { ok: false; result: NativeOcrResult } {
  const invalidRegion = request.regions.find((region) => (
    !region.id ||
    !Number.isFinite(region.x) ||
    !Number.isFinite(region.y) ||
    !Number.isFinite(region.width) ||
    !Number.isFinite(region.height) ||
    region.x < 0 ||
    region.y < 0 ||
    region.width <= 0 ||
    region.height <= 0 ||
    region.x + region.width > 1 ||
    region.y + region.height > 1
  ));
  if (!request.imageUri || !request.imageUri.startsWith('file://')) {
    return {
      ok: false,
      result: {
        ok: false,
        provider: 'apple_vision',
        code: 'invalid_request',
        message: 'OCR requires a local file:// image URI.',
        latencyMs: 0,
        warnings: [],
      },
    };
  }
  if (!request.regions.length || invalidRegion) {
    return {
      ok: false,
      result: {
        ok: false,
        provider: 'apple_vision',
        code: 'invalid_request',
        message: 'OCR regions must be normalized, in-bounds rectangles.',
        latencyMs: 0,
        warnings: [],
      },
    };
  }
  return { ok: true };
}

export async function getVisionOcrRuntimeDiagnostics(nativeModule?: NativeModuleShape | null, platform = currentPlatform()): Promise<NativeOcrRuntimeDiagnostics> {
  const resolvedNativeModule = nativeModule === undefined ? loadNativeModule(platform) : nativeModule;
  if (platform !== 'ios' || !resolvedNativeModule?.getDiagnostics) {
    return {
      moduleLinked: false,
      runtimeModuleName: 'TradingDocksVisionOcr',
      nativeModuleVersion: 'unavailable',
      platform,
    };
  }
  try {
    return await resolvedNativeModule.getDiagnostics();
  } catch {
    return {
      moduleLinked: false,
      runtimeModuleName: 'TradingDocksVisionOcr',
      nativeModuleVersion: 'unavailable',
      platform,
    };
  }
}

function loadNativeModule(platform: string): NativeModuleShape | null {
  if (platform !== 'ios') return null;
  try {
    // Keep this dynamic so Android/web imports stay safe.
    const { requireNativeModule } = require('expo-modules-core') as { requireNativeModule(name: string): NativeModuleShape };
    return requireNativeModule('TradingDocksVisionOcr');
  } catch {
    return null;
  }
}

function currentPlatform() {
  try {
    const reactNative = require('react-native') as { Platform?: { OS?: string } };
    return reactNative.Platform?.OS ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

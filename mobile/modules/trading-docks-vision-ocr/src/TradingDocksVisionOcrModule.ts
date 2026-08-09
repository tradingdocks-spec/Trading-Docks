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

export type NativeLiveTitleOcrRequest = {
  frameId: string;
  width: number;
  height: number;
  pixels: number[];
  roi: { x: number; y: number; width: number; height: number };
  languages?: string[];
  recognitionLevel?: NativeOcrRecognitionLevel;
  orientation?: 'portrait' | 'landscape';
};

export type NativeImageAnalysisRequest = {
  imageUri: string;
};

export type NativeImageAnalysisResult =
  | {
    ok: true;
    provider: 'apple_vision';
    imageUri: string;
    width: number;
    height: number;
    lumaHash: string;
    sharpness: number;
    exposure: number;
    durationMs: number;
    warnings: string[];
  }
  | {
    ok: false;
    provider: 'apple_vision' | 'unsupported_platform' | 'native_module_unavailable';
    code: 'unsupported_platform' | 'native_module_unavailable' | 'invalid_request' | 'image_load_failed' | 'vision_failed';
    message: string;
    durationMs: number;
    warnings: string[];
  };

export type NativeFeaturePrintRequest = {
  imageUri: string;
};

export type NativeFeaturePrintResult =
  | {
    ok: true;
    provider: 'apple_vision_feature_print';
    imageUri: string;
    featurePrint: string;
    descriptorBytes: number;
    durationMs: number;
    warnings: string[];
  }
  | {
    ok: false;
    provider: 'apple_vision_feature_print' | 'unsupported_platform' | 'native_module_unavailable';
    code: 'unsupported_platform' | 'native_module_unavailable' | 'invalid_request' | 'image_load_failed' | 'vision_unavailable' | 'vision_failed';
    message: string;
    durationMs: number;
    warnings: string[];
  };

export type NativeFeaturePrintDistanceRequest = {
  leftFeaturePrint: string;
  rightFeaturePrint: string;
};

export type NativeFeaturePrintDistanceResult =
  | {
    ok: true;
    provider: 'apple_vision_feature_print';
    distance: number;
    durationMs: number;
    warnings: string[];
  }
  | {
    ok: false;
    provider: 'apple_vision_feature_print' | 'unsupported_platform' | 'native_module_unavailable';
    code: 'unsupported_platform' | 'native_module_unavailable' | 'invalid_request' | 'vision_unavailable' | 'vision_failed';
    message: string;
    durationMs: number;
    warnings: string[];
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

export type NativeLiveTitleOcrResult =
  | {
    ok: true;
    provider: 'apple_vision';
    frameId: string;
    text: string;
    confidence: number;
    durationMs: number;
    roi: NativeLiveTitleOcrRequest['roi'];
    warnings: string[];
  }
  | {
    ok: false;
    provider: 'apple_vision' | 'unsupported_platform' | 'native_module_unavailable';
    frameId: string;
    code:
      | 'unsupported_platform'
      | 'native_module_unavailable'
      | 'invalid_request'
      | 'vision_unavailable'
      | 'vision_failed'
      | 'empty_result';
    message: string;
    durationMs: number;
    warnings: string[];
  };

type NativeModuleShape = {
  recognizeText(request: NativeOcrRequest): Promise<NativeOcrResult>;
  recognizeFrameTitle?: (request: NativeLiveTitleOcrRequest) => Promise<NativeLiveTitleOcrResult>;
  analyzeRecognitionImage?: (request: NativeImageAnalysisRequest) => Promise<NativeImageAnalysisResult>;
  generateFeaturePrint?: (request: NativeFeaturePrintRequest) => Promise<NativeFeaturePrintResult>;
  compareFeaturePrints?: (request: NativeFeaturePrintDistanceRequest) => Promise<NativeFeaturePrintDistanceResult>;
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

export async function recognizeFrameTitle(request: NativeLiveTitleOcrRequest, nativeModule?: NativeModuleShape | null, platform = currentPlatform()): Promise<NativeLiveTitleOcrResult> {
  const validation = validateNativeLiveTitleOcrRequest(request);
  if (!validation.ok) return validation.result;
  if (platform !== 'ios') {
    return {
      ok: false,
      provider: 'unsupported_platform',
      frameId: request.frameId,
      code: 'unsupported_platform',
      message: 'Trading Docks live frame title OCR is implemented for iOS Apple Vision only.',
      durationMs: 0,
      warnings: ['Android and web live OCR are explicitly unsupported in this branch.'],
    };
  }
  const resolvedNativeModule = nativeModule === undefined ? loadNativeModule(platform) : nativeModule;
  if (!resolvedNativeModule?.recognizeFrameTitle) {
    return {
      ok: false,
      provider: 'native_module_unavailable',
      frameId: request.frameId,
      code: 'native_module_unavailable',
      message: 'TradingDocksVisionOcr live frame OCR is not available. Install a new EAS development build.',
      durationMs: 0,
      warnings: ['No frame image was logged, uploaded, or retained.'],
    };
  }
  return resolvedNativeModule.recognizeFrameTitle({
    ...request,
    languages: request.languages?.length ? request.languages : ['en-US'],
    recognitionLevel: request.recognitionLevel ?? 'fast',
  });
}

export async function analyzeRecognitionImage(request: NativeImageAnalysisRequest, nativeModule?: NativeModuleShape | null, platform = currentPlatform()): Promise<NativeImageAnalysisResult> {
  const validation = validateNativeImageRequest(request, 'analysis');
  if (!validation.ok) return validation.result as NativeImageAnalysisResult;
  if (platform !== 'ios') {
    return {
      ok: false,
      provider: 'unsupported_platform',
      code: 'unsupported_platform',
      message: 'Trading Docks recognition image analysis is implemented for iOS Apple Vision only.',
      durationMs: 0,
      warnings: ['No image was uploaded or retained.'],
    };
  }
  const resolvedNativeModule = nativeModule === undefined ? loadNativeModule(platform) : nativeModule;
  if (!resolvedNativeModule?.analyzeRecognitionImage) {
    return {
      ok: false,
      provider: 'native_module_unavailable',
      code: 'native_module_unavailable',
      message: 'TradingDocksVisionOcr image analysis is not available. Install a new EAS development build.',
      durationMs: 0,
      warnings: ['No image was uploaded or retained.'],
    };
  }
  return resolvedNativeModule.analyzeRecognitionImage(request);
}

export async function generateFeaturePrint(request: NativeFeaturePrintRequest, nativeModule?: NativeModuleShape | null, platform = currentPlatform()): Promise<NativeFeaturePrintResult> {
  const validation = validateNativeImageRequest(request, 'feature_print');
  if (!validation.ok) return validation.result as NativeFeaturePrintResult;
  if (platform !== 'ios') {
    return {
      ok: false,
      provider: 'unsupported_platform',
      code: 'unsupported_platform',
      message: 'Apple Vision feature prints are available on iOS only in this prototype.',
      durationMs: 0,
      warnings: ['No image was uploaded or retained.'],
    };
  }
  const resolvedNativeModule = nativeModule === undefined ? loadNativeModule(platform) : nativeModule;
  if (!resolvedNativeModule?.generateFeaturePrint) {
    return {
      ok: false,
      provider: 'native_module_unavailable',
      code: 'native_module_unavailable',
      message: 'TradingDocksVisionOcr feature prints are not available. Install a new EAS development build.',
      durationMs: 0,
      warnings: ['No image was uploaded or retained.'],
    };
  }
  return resolvedNativeModule.generateFeaturePrint(request);
}

export async function compareFeaturePrints(request: NativeFeaturePrintDistanceRequest, nativeModule?: NativeModuleShape | null, platform = currentPlatform()): Promise<NativeFeaturePrintDistanceResult> {
  if (!request.leftFeaturePrint || !request.rightFeaturePrint) {
    return {
      ok: false,
      provider: 'apple_vision_feature_print',
      code: 'invalid_request',
      message: 'Feature print comparison requires two encoded feature prints.',
      durationMs: 0,
      warnings: [],
    };
  }
  if (platform !== 'ios') {
    return {
      ok: false,
      provider: 'unsupported_platform',
      code: 'unsupported_platform',
      message: 'Apple Vision feature print comparison is available on iOS only in this prototype.',
      durationMs: 0,
      warnings: [],
    };
  }
  const resolvedNativeModule = nativeModule === undefined ? loadNativeModule(platform) : nativeModule;
  if (!resolvedNativeModule?.compareFeaturePrints) {
    return {
      ok: false,
      provider: 'native_module_unavailable',
      code: 'native_module_unavailable',
      message: 'TradingDocksVisionOcr feature print comparison is not available. Install a new EAS development build.',
      durationMs: 0,
      warnings: [],
    };
  }
  return resolvedNativeModule.compareFeaturePrints(request);
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

export function validateNativeLiveTitleOcrRequest(request: NativeLiveTitleOcrRequest): { ok: true } | { ok: false; result: Extract<NativeLiveTitleOcrResult, { ok: false }> } {
  const invalidRoi = (
    !request.roi ||
    !Number.isFinite(request.roi.x) ||
    !Number.isFinite(request.roi.y) ||
    !Number.isFinite(request.roi.width) ||
    !Number.isFinite(request.roi.height) ||
    request.roi.x < 0 ||
    request.roi.y < 0 ||
    request.roi.width <= 0 ||
    request.roi.height <= 0 ||
    request.roi.x + request.roi.width > 1 ||
    request.roi.y + request.roi.height > 1
  );
  const expectedPixels = Math.floor(request.width) * Math.floor(request.height);
  if (
    !request.frameId ||
    !Number.isFinite(request.width) ||
    !Number.isFinite(request.height) ||
    request.width <= 0 ||
    request.height <= 0 ||
    !Array.isArray(request.pixels) ||
    request.pixels.length !== expectedPixels ||
    invalidRoi
  ) {
    return {
      ok: false,
      result: {
        ok: false,
        provider: 'apple_vision',
        frameId: request.frameId || 'unknown-frame',
        code: 'invalid_request',
        message: 'Live title OCR requires normalized ROI and a bounded luma frame.',
        durationMs: 0,
        warnings: [],
      },
    };
  }
  return { ok: true };
}

export function validateNativeImageRequest(request: NativeImageAnalysisRequest, provider: 'analysis' | 'feature_print'): { ok: true } | { ok: false; result: NativeImageAnalysisResult | NativeFeaturePrintResult } {
  if (!request.imageUri || !request.imageUri.startsWith('file://')) {
    return {
      ok: false,
      result: {
        ok: false,
        provider: provider === 'analysis' ? 'apple_vision' : 'apple_vision_feature_print',
        code: 'invalid_request',
        message: 'Recognition image analysis requires a local file:// image URI.',
        durationMs: 0,
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

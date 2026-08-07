export type ScannerCameraLensMode = 'auto' | 'macro' | 'standard' | 'telephoto';
export type ScannerCameraSelectionMode = ScannerCameraLensMode | 'raw';

export type ScannerCameraPoint = {
  x: number;
  y: number;
};

export type ScannerCameraSize = {
  width: number;
  height: number;
};

export type ScannerPhysicalDeviceType =
  | 'ultra-wide-angle'
  | 'wide-angle'
  | 'telephoto'
  | 'true-depth'
  | 'lidar-depth'
  | 'time-of-flight-depth'
  | 'external'
  | 'continuity'
  | string;

export type ScannerCameraDeviceLike = {
  id: string;
  localizedName?: string;
  modelID?: string;
  type?: ScannerPhysicalDeviceType;
  position?: 'front' | 'back' | 'external' | string;
  physicalDevices?: ScannerCameraDeviceLike[];
  isVirtualDevice?: boolean;
  minZoom?: number;
  maxZoom?: number;
  neutralZoom?: number;
  zoomLensSwitchFactors?: number[];
  minFocusDistance?: number;
  focalLength?: number;
  supportsFocusMetering?: boolean;
  supportsFocusLocking?: boolean;
  supportsSmoothAutoFocus?: boolean;
  hasTorch?: boolean;
  supportedFPSRanges?: { min: number; max: number }[];
  getSupportedResolutions?: (outputStreamType: 'photo' | 'video' | 'stream' | 'depth-photo' | 'depth-stream') => ScannerCameraSize[];
};

export type ScannerCameraDeviceSummary = {
  id: string;
  name: string;
  position: string | null;
  physicalDevices: ScannerPhysicalDeviceType[];
  formatsCount: number | null;
  maxPhotoResolution: ScannerCameraSize | null;
  maxVideoResolution: ScannerCameraSize | null;
  fpsRanges: { min: number; max: number }[];
  minZoom: number | null;
  neutralZoom: number | null;
  maxZoom: number | null;
  minFocusDistance: number | null;
  supportsFocus: boolean;
  hasTorch: boolean;
};

export type ScannerCameraQualityProfile = {
  selectedFormatLabel: string;
  targetFps: number;
  photoResolution: ScannerCameraSize;
  frameResolution: ScannerCameraSize;
  previewResolution: ScannerCameraSize | null;
  constraints: {
    fps: number;
    binned: boolean;
    photoBias: boolean;
    frameBias: boolean;
  };
  defaultZoom: number | null;
};

export type ScannerCameraLensOption = {
  mode: ScannerCameraLensMode;
  label: string;
  shortLabel: string;
  supported: boolean;
  deviceId: string | null;
  effectiveZoom: number | null;
  mappingReason: string;
  warning?: string;
};

export type ScannerCameraLensSelection = {
  requestedMode: ScannerCameraSelectionMode;
  resolvedMode: ScannerCameraSelectionMode;
  selectedDevice: ScannerCameraDeviceLike | undefined;
  selectedDeviceSummary: ScannerCameraDeviceSummary | null;
  options: ScannerCameraLensOption[];
  rearDevices: ScannerCameraDeviceSummary[];
  qualityProfile: ScannerCameraQualityProfile | null;
};

export type ScannerFocusRequestInput = {
  active: boolean;
  appForegrounded: boolean;
  processing: boolean;
  supportsFocus: boolean;
};

export type ScannerFocusBlockReason = 'inactive' | 'backgrounded' | 'processing' | 'unsupported';

export type ScannerFocusRequestState = {
  allowed: boolean;
  reason: ScannerFocusBlockReason | null;
};

export type ScannerFocusConversionInput = {
  point: ScannerCameraPoint;
  view: ScannerCameraSize;
  source?: ScannerCameraSize | null;
  mirrored?: boolean;
  resizeMode?: 'cover' | 'contain';
};

export type ScannerFocusConversion = {
  insidePreview: boolean;
  viewPoint: ScannerCameraPoint | null;
  normalizedPoint: ScannerCameraPoint | null;
  renderedSource: {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  };
};

export type ScannerTorchStateInput = {
  requested: boolean;
  active: boolean;
  appForegrounded: boolean;
  deviceHasTorch: boolean;
};

export type ScannerTorchState = {
  torchEnabled: boolean;
  torchSupported: boolean;
  torchActive: boolean;
  torchProp: 'on' | 'off';
  photoFlashMode: 'on' | 'off';
};

export type ScannerTorchTransition = {
  at: number;
  state: 'on' | 'off';
  reason: ScannerCameraEventReason;
};

export type ScannerCameraEventReason =
  | 'user'
  | 'device_change'
  | 'lifecycle'
  | 'camera_error'
  | 'app_state'
  | 'processing'
  | 'frame_processor'
  | 'auto_capture'
  | 'capture'
  | 'session'
  | 'pricing'
  | 'unknown';

export type ScannerCameraRuntimeEvent = {
  id: string;
  at: number;
  type:
    | 'camera_mount'
    | 'camera_unmount'
    | 'device_change'
    | 'is_active_change'
    | 'torch_change'
    | 'app_state_change'
    | 'processing_change'
    | 'frame_processor_change'
    | 'auto_capture_change'
    | 'session_change'
    | 'pricing_change'
    | 'focus_request';
  oldValue: string;
  newValue: string;
  reason: ScannerCameraEventReason;
};

export type ScannerFrameMetricsInput = {
  frameCount: number;
  firstFrameAt: number | null;
  latestFrameAt: number | null;
  cardPresence: boolean;
  cornersVisible: number | null;
  guideFill: number | null;
  aspectRatio: number | null;
  centerOffset: number | null;
  blur: number | null;
  motion: number | null;
  lighting: number | null;
  glare: number | null;
  stableDurationMs: number | null;
  removalState: 'clear' | 'awaiting_removal' | 'unavailable';
  processing: boolean;
  duplicateBlocked: boolean;
  cameraReady: boolean;
};

export type ScannerAutoCaptureReadiness = {
  ready: boolean;
  label: 'READY' | 'BLOCKED';
  reasons: string[];
  effectiveFps: number | null;
};

export const SCANNER_CAMERA_LENS_LABELS: Record<ScannerCameraLensMode, { label: string; shortLabel: string }> = {
  auto: { label: 'Auto', shortLabel: 'Auto' },
  macro: { label: 'Close-up', shortLabel: 'Close' },
  standard: { label: 'Standard', shortLabel: 'Std' },
  telephoto: { label: 'Telephoto', shortLabel: 'Tele' },
};

export const SCANNER_FOCUS_RETICLE_MS = 700;
export const SCANNER_FOCUS_RETICLE_REDUCED_MOTION_MS = 450;
export const SCANNER_TORCH_THRASH_WINDOW_MS = 1200;

export function summarizeScannerCameraDevice(device: ScannerCameraDeviceLike | undefined): ScannerCameraDeviceSummary | null {
  if (!device) return null;
  return {
    id: device.id,
    name: device.localizedName ?? device.modelID ?? device.id,
    position: device.position ?? null,
    physicalDevices: scannerCameraDeviceTypes(device),
    formatsCount: null,
    maxPhotoResolution: maxResolution(readSupportedResolutions(device, 'photo')),
    maxVideoResolution: maxResolution(readSupportedResolutions(device, 'video')),
    fpsRanges: normalizeFpsRanges(device.supportedFPSRanges),
    minZoom: finiteOrNull(device.minZoom),
    neutralZoom: finiteOrNull(device.neutralZoom),
    maxZoom: finiteOrNull(device.maxZoom),
    minFocusDistance: finiteOrNull(device.minFocusDistance),
    supportsFocus: scannerCameraSupportsFocus(device),
    hasTorch: Boolean(device.hasTorch),
  };
}

export function scannerCameraSupportsFocus(device: ScannerCameraDeviceLike | undefined): boolean {
  return Boolean(device?.supportsFocusMetering || device?.supportsFocusLocking);
}

export function scannerCameraDeviceTypes(device: ScannerCameraDeviceLike): ScannerPhysicalDeviceType[] {
  const physicalTypes = (device.physicalDevices ?? [])
    .map((physical) => physical.type)
    .filter((type): type is ScannerPhysicalDeviceType => Boolean(type));
  return Array.from(new Set([device.type, ...physicalTypes].filter((type): type is ScannerPhysicalDeviceType => Boolean(type))));
}

export function resolveScannerCameraLensSelection(
  devices: ScannerCameraDeviceLike[],
  requestedMode: ScannerCameraSelectionMode,
  rawDeviceId?: string | null,
): ScannerCameraLensSelection {
  const backDevices = devices.filter((device) => device.position === 'back');
  const rearDevices = backDevices.map((device) => summarizeScannerCameraDevice(device)).filter((device): device is ScannerCameraDeviceSummary => Boolean(device));
  const autoDevice = selectAutoScannerDevice(backDevices);
  const macroDevice = selectCloseUpScannerDevice(backDevices);
  const standardDevice = selectScannerDeviceByType(backDevices, 'wide-angle') ?? autoDevice;
  const telephotoDevice = selectScannerDeviceByType(backDevices, 'telephoto');
  const rawDevice = rawDeviceId ? backDevices.find((device) => device.id === rawDeviceId) : undefined;
  const optionMap: Record<ScannerCameraLensMode, ScannerCameraDeviceLike | undefined> = {
    auto: autoDevice,
    macro: macroDevice,
    standard: standardDevice,
    telephoto: telephotoDevice,
  };
  const options = (Object.keys(SCANNER_CAMERA_LENS_LABELS) as ScannerCameraLensMode[]).map((mode) => {
    const device = optionMap[mode];
    const labels = SCANNER_CAMERA_LENS_LABELS[mode];
    return {
      mode,
      label: labels.label,
      shortLabel: labels.shortLabel,
      supported: Boolean(device),
      deviceId: device?.id ?? null,
      effectiveZoom: scannerCameraEffectiveZoom(device),
      mappingReason: scannerCameraLensMappingReason(mode, device),
      warning: mode === 'telephoto' && device ? 'Telephoto may need more distance for close card scanning.' : undefined,
    };
  });
  const requestedDevice = requestedMode === 'raw' ? rawDevice : optionMap[requestedMode];
  const resolvedMode = requestedDevice ? requestedMode : 'auto';
  const selectedDevice = requestedDevice ?? autoDevice;
  return {
    requestedMode,
    resolvedMode,
    selectedDevice,
    selectedDeviceSummary: summarizeScannerCameraDevice(selectedDevice),
    options,
    rearDevices,
    qualityProfile: selectedDevice ? buildScannerCameraQualityProfile(selectedDevice) : null,
  };
}

export function scannerCameraPreferenceKey(userId: string) {
  return `scanner:camera-preferences:${userId}`;
}

export function normalizeScannerCameraLensMode(value: unknown): ScannerCameraLensMode {
  return value === 'macro' || value === 'standard' || value === 'telephoto' ? value : 'auto';
}

export function normalizeScannerCameraSelectionMode(value: unknown): ScannerCameraSelectionMode {
  return value === 'raw' ? 'raw' : normalizeScannerCameraLensMode(value);
}

export function resolveScannerFocusRequest(input: ScannerFocusRequestInput): ScannerFocusRequestState {
  if (!input.active) return { allowed: false, reason: 'inactive' };
  if (!input.appForegrounded) return { allowed: false, reason: 'backgrounded' };
  if (input.processing) return { allowed: false, reason: 'processing' };
  if (!input.supportsFocus) return { allowed: false, reason: 'unsupported' };
  return { allowed: true, reason: null };
}

export function convertPreviewTapToCameraPoint(input: ScannerFocusConversionInput): ScannerFocusConversion {
  const view = clampSize(input.view);
  const source = clampSize(input.source ?? input.view);
  const scale = input.resizeMode === 'contain'
    ? Math.min(view.width / source.width, view.height / source.height)
    : Math.max(view.width / source.width, view.height / source.height);
  const renderedWidth = source.width * scale;
  const renderedHeight = source.height * scale;
  const offsetX = (view.width - renderedWidth) / 2;
  const offsetY = (view.height - renderedHeight) / 2;
  const sourceX = (input.point.x - offsetX) / renderedWidth;
  const sourceY = (input.point.y - offsetY) / renderedHeight;
  const normalizedX = input.mirrored ? 1 - sourceX : sourceX;
  const insidePreview = sourceX >= 0 && sourceX <= 1 && sourceY >= 0 && sourceY <= 1;
  return {
    insidePreview,
    viewPoint: insidePreview ? { x: input.point.x, y: input.point.y } : null,
    normalizedPoint: insidePreview ? { x: clamp01(normalizedX), y: clamp01(sourceY) } : null,
    renderedSource: {
      width: renderedWidth,
      height: renderedHeight,
      offsetX,
      offsetY,
    },
  };
}

export function scannerFocusReticleDuration(reduceMotion: boolean) {
  return reduceMotion ? SCANNER_FOCUS_RETICLE_REDUCED_MOTION_MS : SCANNER_FOCUS_RETICLE_MS;
}

export function resolveScannerTorchState(input: ScannerTorchStateInput): ScannerTorchState {
  const torchSupported = input.deviceHasTorch;
  const torchActive = input.requested && input.active && input.appForegrounded && torchSupported;
  return {
    torchEnabled: input.requested,
    torchSupported,
    torchActive,
    torchProp: torchActive ? 'on' : 'off',
    photoFlashMode: 'off',
  };
}

export function buildScannerCameraQualityProfile(device: ScannerCameraDeviceLike): ScannerCameraQualityProfile {
  const photoResolution = bestScannerResolution(readSupportedResolutions(device, 'photo'), { width: 3024, height: 4032 });
  const frameResolution = { width: 640, height: 480 };
  const targetFps = bestScannerFps(normalizeFpsRanges(device.supportedFPSRanges));
  const defaultZoom = finiteOrNull(device.neutralZoom) ?? finiteOrNull(device.minZoom);
  return {
    selectedFormatLabel: `quality-first ${targetFps}fps ${photoResolution.width}x${photoResolution.height}`,
    targetFps,
    photoResolution,
    frameResolution,
    previewResolution: null,
    constraints: {
      fps: targetFps,
      binned: false,
      photoBias: true,
      frameBias: true,
    },
    defaultZoom,
  };
}

export function appendScannerCameraEvent(
  events: ScannerCameraRuntimeEvent[],
  event: Omit<ScannerCameraRuntimeEvent, 'id'>,
  limit = 80,
): ScannerCameraRuntimeEvent[] {
  return [{
    ...event,
    id: `${event.type}-${Math.round(event.at)}-${events.length}`,
  }, ...events].slice(0, limit);
}

export function isApprovedTorchTransitionReason(reason: ScannerCameraEventReason) {
  return reason === 'user' || reason === 'app_state' || reason === 'device_change' || reason === 'camera_error' || reason === 'lifecycle';
}

export function resolveAutoCaptureReadiness(input: ScannerFrameMetricsInput): ScannerAutoCaptureReadiness {
  const reasons: string[] = [];
  if (!input.cameraReady) reasons.push('camera not ready');
  if (input.processing) reasons.push('scanner processing');
  if (input.duplicateBlocked) reasons.push('duplicate protection awaiting removal');
  if (!input.cardPresence) reasons.push('card presence unavailable');
  if (input.cornersVisible !== null && input.cornersVisible < 3) reasons.push('card boundary incomplete');
  if (input.guideFill === null) reasons.push('guide fill unavailable');
  else if (input.guideFill < 0.38) reasons.push('move closer');
  else if (input.guideFill > 0.92) reasons.push('move away');
  if (input.centerOffset === null) reasons.push('center offset unavailable');
  else if (input.centerOffset > 0.24) reasons.push('center card');
  if (input.blur === null) reasons.push('blur unavailable');
  else if (input.blur < 0.42) reasons.push('blur too high');
  if (input.motion === null) reasons.push('motion unavailable');
  else if (input.motion > 0.34) reasons.push('motion too high');
  if (input.lighting === null) reasons.push('lighting unavailable');
  else if (input.lighting < 0.22) reasons.push('lighting too low');
  if (input.glare === null) reasons.push('glare unavailable');
  else if (input.glare > 0.5) reasons.push('reduce glare');
  if (input.stableDurationMs === null) reasons.push('stability unavailable');
  else if (input.stableDurationMs < 420) reasons.push('hold steady');
  if (input.removalState === 'awaiting_removal') reasons.push('remove previous card');
  const effectiveFps = input.firstFrameAt !== null && input.latestFrameAt !== null && input.latestFrameAt > input.firstFrameAt
    ? Math.round((input.frameCount / ((input.latestFrameAt - input.firstFrameAt) / 1000)) * 10) / 10
    : null;
  return {
    ready: reasons.length === 0,
    label: reasons.length === 0 ? 'READY' : 'BLOCKED',
    reasons,
    effectiveFps,
  };
}

export function shouldWarnAboutTorchThrash(transitions: ScannerTorchTransition[], now: number): boolean {
  const recent = transitions.filter((transition) => now - transition.at <= SCANNER_TORCH_THRASH_WINDOW_MS);
  if (recent.length < 3) return false;
  return recent.some((transition) => transition.reason === 'unknown');
}

export function shouldIgnoreFrameAfterLensSwitch(input: {
  frameCapturedAt: number;
  switchStartedAt: number | null;
  cameraReady: boolean;
}) {
  if (!input.switchStartedAt) return false;
  if (!input.cameraReady) return true;
  return input.frameCapturedAt < input.switchStartedAt;
}

function selectAutoScannerDevice(devices: ScannerCameraDeviceLike[]) {
  return [...devices].sort((a, b) => scannerDeviceScore(b) - scannerDeviceScore(a))[0];
}

function selectCloseUpScannerDevice(devices: ScannerCameraDeviceLike[]) {
  const withFocusDistance = devices
    .filter((device) => finiteOrNull(device.minFocusDistance) !== null)
    .sort((a, b) => (finiteOrNull(a.minFocusDistance) ?? Number.POSITIVE_INFINITY) - (finiteOrNull(b.minFocusDistance) ?? Number.POSITIVE_INFINITY))[0];
  return withFocusDistance ?? selectScannerDeviceByType(devices, 'ultra-wide-angle');
}

function selectScannerDeviceByType(devices: ScannerCameraDeviceLike[], type: ScannerPhysicalDeviceType) {
  return [...devices]
    .filter((device) => scannerCameraDeviceTypes(device).includes(type))
    .sort((a, b) => scannerDeviceScore(b) - scannerDeviceScore(a))[0];
}

function scannerDeviceScore(device: ScannerCameraDeviceLike) {
  const types = scannerCameraDeviceTypes(device);
  let score = 0;
  if (scannerCameraSupportsFocus(device)) score += 8;
  if (device.hasTorch) score += 3;
  if (finiteOrNull(device.minFocusDistance) !== null) score += Math.max(0, 6 - (finiteOrNull(device.minFocusDistance) ?? 6));
  if (types.includes('ultra-wide-angle')) score += 3;
  if (types.includes('wide-angle')) score += 2;
  if (!device.isVirtualDevice) score += 2;
  const photo = maxResolution(readSupportedResolutions(device, 'photo'));
  if (photo) score += Math.min(4, (photo.width * photo.height) / 4_000_000);
  return score;
}

function scannerCameraEffectiveZoom(device: ScannerCameraDeviceLike | undefined) {
  return finiteOrNull(device?.neutralZoom) ?? finiteOrNull(device?.minZoom);
}

function scannerCameraLensMappingReason(mode: ScannerCameraLensMode, device: ScannerCameraDeviceLike | undefined) {
  if (!device) return `${SCANNER_CAMERA_LENS_LABELS[mode].label} is unavailable on discovered rear cameras.`;
  const summary = summarizeScannerCameraDevice(device);
  const types = summary?.physicalDevices.join(', ') || device.type || 'unknown optics';
  const focus = summary?.minFocusDistance === null
    ? 'unknown close-focus distance'
    : `${summary?.minFocusDistance} minimum focus distance`;
  const focusSupport = summary?.supportsFocus ? 'focus metering supported' : 'focus metering unavailable';
  if (mode === 'macro') return `Selected ${summary?.name ?? device.id} for close-up scanning from ${types}; ${focus}; ${focusSupport}.`;
  if (mode === 'standard') return `Selected ${summary?.name ?? device.id} as the primary wide-angle scanner camera from ${types}.`;
  if (mode === 'telephoto') return `Selected ${summary?.name ?? device.id} because a real telephoto device is exposed from ${types}.`;
  return `Selected ${summary?.name ?? device.id} by scanner score using close focus, focus support, preview stability, torch, and photo quality.`;
}

function readSupportedResolutions(device: ScannerCameraDeviceLike, stream: 'photo' | 'video' | 'stream' | 'depth-photo' | 'depth-stream') {
  try {
    return device.getSupportedResolutions?.(stream) ?? [];
  } catch {
    return [];
  }
}

function maxResolution(resolutions: ScannerCameraSize[]) {
  return [...resolutions].sort((a, b) => (b.width * b.height) - (a.width * a.height))[0] ?? null;
}

function bestScannerResolution(resolutions: ScannerCameraSize[], fallback: ScannerCameraSize) {
  const candidates = resolutions.length ? resolutions : [fallback];
  return [...candidates].sort((a, b) => {
    const aPixels = a.width * a.height;
    const bPixels = b.width * b.height;
    const targetPixels = fallback.width * fallback.height;
    return Math.abs(aPixels - targetPixels) - Math.abs(bPixels - targetPixels);
  })[0];
}

function normalizeFpsRanges(ranges: unknown): { min: number; max: number }[] {
  if (!Array.isArray(ranges)) return [];
  return ranges
    .map((range) => {
      if (!range || typeof range !== 'object') return null;
      const candidate = range as { min?: unknown; max?: unknown };
      const min = finiteOrNull(candidate.min);
      const max = finiteOrNull(candidate.max);
      return min === null || max === null ? null : { min, max };
    })
    .filter((range): range is { min: number; max: number } => Boolean(range));
}

function bestScannerFps(ranges: { min: number; max: number }[]) {
  if (ranges.some((range) => range.min <= 30 && range.max >= 30)) return 30;
  const max = ranges.reduce((current, range) => Math.max(current, range.max), 0);
  return max >= 24 ? Math.min(max, 30) : 30;
}

function finiteOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clampSize(size: ScannerCameraSize): ScannerCameraSize {
  return {
    width: Math.max(1, size.width),
    height: Math.max(1, size.height),
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

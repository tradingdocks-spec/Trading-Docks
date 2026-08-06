export type ScannerCameraLensMode = 'auto' | 'macro' | 'standard' | 'telephoto';

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
};

export type ScannerCameraDeviceSummary = {
  id: string;
  name: string;
  physicalDevices: ScannerPhysicalDeviceType[];
  minZoom: number | null;
  neutralZoom: number | null;
  maxZoom: number | null;
  minFocusDistance: number | null;
  supportsFocus: boolean;
  hasTorch: boolean;
};

export type ScannerCameraLensOption = {
  mode: ScannerCameraLensMode;
  label: string;
  shortLabel: string;
  supported: boolean;
  deviceId: string | null;
  warning?: string;
};

export type ScannerCameraLensSelection = {
  requestedMode: ScannerCameraLensMode;
  resolvedMode: ScannerCameraLensMode;
  selectedDevice: ScannerCameraDeviceLike | undefined;
  selectedDeviceSummary: ScannerCameraDeviceSummary | null;
  options: ScannerCameraLensOption[];
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
  reason: 'user' | 'device_change' | 'lifecycle' | 'camera_error' | 'capture' | 'unknown';
};

export const SCANNER_CAMERA_LENS_LABELS: Record<ScannerCameraLensMode, { label: string; shortLabel: string }> = {
  auto: { label: 'Auto', shortLabel: 'Auto' },
  macro: { label: 'Macro / Close-up', shortLabel: '0.5x' },
  standard: { label: 'Standard', shortLabel: '1x' },
  telephoto: { label: 'Telephoto', shortLabel: '2x' },
};

export const SCANNER_FOCUS_RETICLE_MS = 700;
export const SCANNER_FOCUS_RETICLE_REDUCED_MOTION_MS = 450;
export const SCANNER_TORCH_THRASH_WINDOW_MS = 1200;

export function summarizeScannerCameraDevice(device: ScannerCameraDeviceLike | undefined): ScannerCameraDeviceSummary | null {
  if (!device) return null;
  return {
    id: device.id,
    name: device.localizedName ?? device.modelID ?? device.id,
    physicalDevices: scannerCameraDeviceTypes(device),
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
  requestedMode: ScannerCameraLensMode,
): ScannerCameraLensSelection {
  const backDevices = devices.filter((device) => device.position === 'back');
  const autoDevice = selectAutoScannerDevice(backDevices);
  const macroDevice = selectScannerDeviceByType(backDevices, 'ultra-wide-angle');
  const standardDevice = selectScannerDeviceByType(backDevices, 'wide-angle') ?? autoDevice;
  const telephotoDevice = selectScannerDeviceByType(backDevices, 'telephoto');
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
      warning: mode === 'telephoto' && device ? 'Telephoto may need more distance for close card scanning.' : undefined,
    };
  });
  const requestedDevice = optionMap[requestedMode];
  const resolvedMode = requestedDevice ? requestedMode : 'auto';
  const selectedDevice = requestedDevice ?? autoDevice;
  return {
    requestedMode,
    resolvedMode,
    selectedDevice,
    selectedDeviceSummary: summarizeScannerCameraDevice(selectedDevice),
    options,
  };
}

export function scannerCameraPreferenceKey(userId: string) {
  return `scanner:camera-preferences:${userId}`;
}

export function normalizeScannerCameraLensMode(value: unknown): ScannerCameraLensMode {
  return value === 'macro' || value === 'standard' || value === 'telephoto' ? value : 'auto';
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

function selectScannerDeviceByType(devices: ScannerCameraDeviceLike[], type: ScannerPhysicalDeviceType) {
  return [...devices]
    .filter((device) => scannerCameraDeviceTypes(device).includes(type))
    .sort((a, b) => scannerDeviceScore(b) - scannerDeviceScore(a))[0];
}

function scannerDeviceScore(device: ScannerCameraDeviceLike) {
  const types = scannerCameraDeviceTypes(device);
  let score = 0;
  if (scannerCameraSupportsFocus(device)) score += 4;
  if (device.hasTorch) score += 3;
  if (types.includes('wide-angle')) score += 2;
  if (types.includes('ultra-wide-angle')) score += 1;
  if (!device.isVirtualDevice) score += 1;
  return score;
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

import type { CameraPictureOptions, CameraViewProps } from 'expo-camera';

import type { ScannerGuideLayout } from './continuous-offer-scanner';

export const SCANNER_CAMERA_MIN_STAGE_HEIGHT = 520;
export const SCANNER_CAMERA_COMPACT_HEIGHT = 620;
export const SCANNER_CAMERA_BOTTOM_CONTROL_RESERVE = 96;
export const SCANNER_CAMERA_MIN_BOTTOM_GUIDE_CLEARANCE = 88;
export const SCANNER_CAMERA_MAX_BOTTOM_GUIDE_CLEARANCE = 144;
export const SCANNER_CAMERA_TOP_INSET_LIMIT = 72;

export type ScannerCameraFramingInput = {
  viewportWidth: number;
  viewportHeight: number;
  safeTop?: number;
  safeBottom?: number;
};

export type ScannerCameraFraming = {
  cameraStageHeight: number;
  guideLayoutInput: {
    containerWidth: number;
    containerHeight: number;
    safeTop: number;
    safeBottom: number;
    reservedVerticalSpace: number;
  };
};

export function scannerCameraStageHeight(viewportHeight: number) {
  return Math.max(SCANNER_CAMERA_MIN_STAGE_HEIGHT, Math.round(viewportHeight));
}

export function scannerCaptureOptions(): CameraPictureOptions {
  return {
    quality: 1,
    skipProcessing: false,
  };
}

export function scannerCameraViewQualityProps(): Pick<
  CameraViewProps,
  'animateShutter' | 'autofocus' | 'responsiveOrientationWhenOrientationLocked'
> {
  return {
    animateShutter: true,
    autofocus: 'on',
    responsiveOrientationWhenOrientationLocked: true,
  };
}

export function scannerCameraFraming(input: ScannerCameraFramingInput): ScannerCameraFraming {
  const cameraStageHeight = scannerCameraStageHeight(input.viewportHeight);
  const safeTop = clamp(input.safeTop ?? 0, 0, SCANNER_CAMERA_TOP_INSET_LIMIT);
  const safeBottom = clamp(
    (input.safeBottom ?? 0) + SCANNER_CAMERA_BOTTOM_CONTROL_RESERVE,
    SCANNER_CAMERA_MIN_BOTTOM_GUIDE_CLEARANCE,
    SCANNER_CAMERA_MAX_BOTTOM_GUIDE_CLEARANCE,
  );
  const reservedVerticalSpace = cameraStageHeight < SCANNER_CAMERA_COMPACT_HEIGHT ? 40 : 64;

  return {
    cameraStageHeight,
    guideLayoutInput: {
      containerWidth: Math.round(input.viewportWidth),
      containerHeight: cameraStageHeight,
      safeTop,
      safeBottom,
      reservedVerticalSpace,
    },
  };
}

export function scannerGuideHasUsableCaptureArea(guide: ScannerGuideLayout) {
  return guide.width >= 180 && guide.height >= 250;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

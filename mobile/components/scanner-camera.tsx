import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Camera,
  useCameraDevices,
  useFrameOutput,
  usePhotoOutput,
  type CameraRef,
  type CameraDevice,
  type Constraint,
} from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import {
  resolveScannerCameraLensSelection,
  resolveScannerTorchState,
  scannerCameraSupportsFocus,
} from '@/services/scanner-camera-controls';
import { scannerNativeFrameSampling, scannerNativePhotoTarget } from '@/services/scanner-camera-quality';
import type { ScannerCameraFrame, ScannerCameraHandle, ScannerCameraProps, ScannerCameraSessionSummary } from './scanner-camera-contract';
export type { ScannerCameraFrame, ScannerCameraHandle, ScannerCameraPhoto, ScannerCameraProps, ScannerCameraSessionSummary } from './scanner-camera-contract';

const frameSampling = scannerNativeFrameSampling();
const fallbackPhotoTarget = scannerNativePhotoTarget();

export const ScannerCamera = forwardRef<ScannerCameraHandle, ScannerCameraProps>(function ScannerCamera(
  {
    active,
    torchEnabled,
    lensMode,
    rawDeviceId,
    appForegrounded,
    focusEnabled,
    userId,
    onReady,
    onFrameAnalysis,
    onLensOptionsChange,
    onCameraInventoryChange,
    onDeviceDiagnosticsChange,
    onQualityProfileChange,
    onSessionConfigChange,
    onTorchStateChange,
    onPreviewStopped,
  },
  ref,
) {
  const cameraRef = useRef<CameraRef>(null);
  const mountedRef = useRef(false);
  const activeRef = useRef(active && appForegrounded);
  const devices = useCameraDevices();
  const lensSelection = useMemo(
    () => resolveScannerCameraLensSelection(devices, rawDeviceId ? 'raw' : lensMode, rawDeviceId),
    [devices, lensMode, rawDeviceId],
  );
  const device = lensSelection.selectedDevice as CameraDevice | undefined;
  const deviceSummary = lensSelection.selectedDeviceSummary;
  const qualityProfile = lensSelection.qualityProfile;
  const torchState = useMemo(
    () => resolveScannerTorchState({
      requested: torchEnabled,
      active,
      appForegrounded,
      deviceHasTorch: Boolean(device?.hasTorch),
    }),
    [active, appForegrounded, device?.hasTorch, torchEnabled],
  );
  const supportsFocus = scannerCameraSupportsFocus(device);
  const handleSessionConfigSelected = useCallback((config: unknown) => {
    const candidate = config as {
      photo?: { width?: number; height?: number };
      video?: { width?: number; height?: number };
      fps?: number;
      frameRate?: number;
    };
    const photoResolution = sizeFromUnknown(candidate.photo);
    const videoResolution = sizeFromUnknown(candidate.video);
    const fps = typeof candidate.fps === 'number'
      ? candidate.fps
      : typeof candidate.frameRate === 'number'
        ? candidate.frameRate
        : qualityProfile?.targetFps ?? null;
    const summary: ScannerCameraSessionSummary = {
      selectedFormat: qualityProfile?.selectedFormatLabel ?? 'VisionCamera selected config',
      photoResolution,
      videoResolution,
      fps,
    };
    onSessionConfigChange?.(summary);
  }, [onSessionConfigChange, qualityProfile]);
  const handleFrameAnalysis = useCallback((nativeFrame: ScannerCameraFrame) => {
    if (!mountedRef.current || !activeRef.current) return;
    onFrameAnalysis(nativeFrame);
  }, [onFrameAnalysis]);
  const photoTarget = qualityProfile?.photoResolution ?? { width: fallbackPhotoTarget.width, height: fallbackPhotoTarget.height };
  const frameTarget = qualityProfile?.frameResolution ?? { width: frameSampling.width, height: frameSampling.height };
  const photoOutput = usePhotoOutput({
    targetResolution: photoTarget,
    quality: fallbackPhotoTarget.quality,
    qualityPrioritization: fallbackPhotoTarget.qualityPrioritization,
  });
  const frameOutput = useFrameOutput({
    targetResolution: frameTarget,
    pixelFormat: frameSampling.pixelFormat,
    enablePreviewSizedOutputBuffers: frameSampling.previewSizedBuffers,
    enablePhysicalBufferRotation: true,
    dropFramesWhileBusy: true,
    onFrame: (nativeCameraFrame) => {
      'worklet';
      try {
        const bucket = Math.floor(nativeCameraFrame.timestamp * frameSampling.targetFps);
        const globalKey = '__tradingDocksScannerLastFrameBucket';
        const globalState = globalThis as unknown as Record<string, number>;
        if (globalState[globalKey] === bucket) {
          nativeCameraFrame.dispose();
          return;
        }
        globalState[globalKey] = bucket;
        if (!nativeCameraFrame.hasPixelBuffer) {
          nativeCameraFrame.dispose();
          return;
        }
        const planes = nativeCameraFrame.isPlanar ? nativeCameraFrame.getPlanes() : [];
        const plane = planes[0];
        const sourceWidth = plane?.width ?? nativeCameraFrame.width;
        const sourceHeight = plane?.height ?? nativeCameraFrame.height;
        const bytesPerRow = plane?.bytesPerRow ?? nativeCameraFrame.bytesPerRow ?? sourceWidth;
        const buffer = plane ? plane.getPixelBuffer() : nativeCameraFrame.getPixelBuffer();
        const source = new Uint8Array(buffer);
        const pixels: number[] = [];
        for (let y = 0; y < frameSampling.height; y += 1) {
          const sourceY = Math.min(sourceHeight - 1, Math.floor((y + 0.5) * sourceHeight / frameSampling.height));
          for (let x = 0; x < frameSampling.width; x += 1) {
            const sourceX = Math.min(sourceWidth - 1, Math.floor((x + 0.5) * sourceWidth / frameSampling.width));
            pixels.push(source[sourceY * bytesPerRow + sourceX] ?? 0);
          }
        }
        const sample: ScannerCameraFrame = {
          id: `native-frame-${Math.round(nativeCameraFrame.timestamp * 1000)}`,
          userId,
          capturedAt: Math.round(nativeCameraFrame.timestamp * 1000),
          width: frameSampling.width,
          height: frameSampling.height,
          pixels,
          pixelFormat: 'luma8',
          orientation: frameSampling.width > frameSampling.height ? 'landscape' : 'portrait',
          source: 'vision-camera',
          previewResolution: { width: nativeCameraFrame.width, height: nativeCameraFrame.height },
        };
        scheduleOnRN(handleFrameAnalysis, sample);
        nativeCameraFrame.dispose();
      } catch {
        nativeCameraFrame.dispose();
      }
    },
  });
  const constraints = useMemo<Constraint[]>(() => {
    if (!qualityProfile) return [];
    return [
      { fps: qualityProfile.constraints.fps },
      { binned: qualityProfile.constraints.binned },
      { resolutionBias: photoOutput },
      { resolutionBias: frameOutput },
    ];
  }, [frameOutput, photoOutput, qualityProfile]);

  useEffect(() => {
    onLensOptionsChange?.(lensSelection.options);
  }, [lensSelection.options, onLensOptionsChange]);

  useEffect(() => {
    onCameraInventoryChange?.(lensSelection);
  }, [lensSelection, onCameraInventoryChange]);

  useEffect(() => {
    onDeviceDiagnosticsChange?.(deviceSummary);
  }, [deviceSummary, onDeviceDiagnosticsChange]);

  useEffect(() => {
    onQualityProfileChange?.(qualityProfile);
  }, [onQualityProfileChange, qualityProfile]);

  useEffect(() => {
    onTorchStateChange?.(torchState);
  }, [onTorchStateChange, torchState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      activeRef.current = false;
      mountedRef.current = false;
      onPreviewStopped?.();
    };
  }, [onPreviewStopped]);

  useEffect(() => {
    activeRef.current = active && appForegrounded;
  }, [active, appForegrounded]);

  useImperativeHandle(ref, () => ({
    async capturePhoto() {
      if (!mountedRef.current || !activeRef.current) throw new Error('Camera is not active.');
      const photo = await photoOutput.capturePhoto({
        flashMode: torchState.photoFlashMode,
        enableShutterSound: false,
        enableDistortionCorrection: fallbackPhotoTarget.distortionCorrection,
        enableVirtualDeviceFusion: fallbackPhotoTarget.virtualDeviceFusion,
      }, {});
      try {
        const path = await photo.saveToTemporaryFileAsync();
        if (!mountedRef.current || !activeRef.current) throw new Error('Camera capture was cancelled.');
        return {
          uri: path.startsWith('file://') ? path : `file://${path}`,
          width: photo.width,
          height: photo.height,
          source: 'vision-camera',
        };
      } finally {
        photo.dispose();
      }
    },
    async focusAt(point) {
      if (!mountedRef.current || !activeRef.current || !cameraRef.current || !supportsFocus || !focusEnabled) return;
      await cameraRef.current.focusTo(point, {
        modes: ['AF', 'AE'],
        autoResetAfter: 2,
      });
    },
  }), [focusEnabled, photoOutput, supportsFocus, torchState.photoFlashMode]);

  if (!device) return <View style={StyleSheet.absoluteFill} />;
  const cameraKey = [
    device.id,
    qualityProfile?.selectedFormatLabel ?? 'default-profile',
    qualityProfile?.targetFps ?? 'fps-auto',
  ].join(':');

  return (
    <Camera
      key={cameraKey}
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      device={device}
      outputs={[photoOutput, frameOutput]}
      constraints={constraints}
      isActive={active}
      torchMode={torchState.torchProp}
      zoom={qualityProfile?.defaultZoom ?? undefined}
      onSessionConfigSelected={handleSessionConfigSelected}
      resizeMode="cover"
      enableNativeTapToFocusGesture={focusEnabled && supportsFocus}
      onStarted={onReady}
      onPreviewStarted={onReady}
      onPreviewStopped={onPreviewStopped}
    />
  );
});

function sizeFromUnknown(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { width?: unknown; height?: unknown };
  if (typeof candidate.width !== 'number' || typeof candidate.height !== 'number') return null;
  return { width: candidate.width, height: candidate.height };
}

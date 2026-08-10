import { CameraView } from 'expo-camera';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';

import { scannerCameraViewQualityProps, scannerCaptureOptions } from '@/services/scanner-camera-quality';
import type { ScannerCameraHandle, ScannerCameraProps } from './scanner-camera-contract';

export type { ScannerCameraFrame, ScannerCameraHandle, ScannerCameraPhoto, ScannerCameraProps, ScannerCameraSessionSummary } from './scanner-camera-contract';

export const ScannerCamera = forwardRef<ScannerCameraHandle, ScannerCameraProps>(function ScannerCamera(
  { torchEnabled, onReady, onLensOptionsChange, onCameraInventoryChange, onDeviceDiagnosticsChange, onQualityProfileChange, onSessionConfigChange, onTorchStateChange },
  ref,
) {
  const cameraRef = useRef<CameraView | null>(null);
  useImperativeHandle(ref, () => ({
    async capturePhoto() {
      if (!cameraRef.current) throw new Error('Camera is not ready.');
      const photo = await cameraRef.current.takePictureAsync(scannerCaptureOptions());
      return { uri: photo.uri, width: photo.width, height: photo.height, source: 'expo-camera' };
    },
    async focusAt() {
      return undefined;
    },
  }), []);

  useEffect(() => {
    onLensOptionsChange?.([{ mode: 'auto', label: 'Auto', shortLabel: 'Auto', supported: true, deviceId: 'web-back-camera', effectiveZoom: null, mappingReason: 'Web camera fallback uses the browser-selected video input.' }]);
  }, [onLensOptionsChange]);

  useEffect(() => {
    const summary = {
      id: 'web-back-camera',
      name: 'Browser camera',
      position: 'back',
      physicalDevices: ['wide-angle'],
      formatsCount: null,
      maxPhotoResolution: null,
      maxVideoResolution: null,
      fpsRanges: [],
      minZoom: null,
      neutralZoom: null,
      maxZoom: null,
      minFocusDistance: null,
      supportsFocus: false,
      hasTorch: torchEnabled,
    };
    onDeviceDiagnosticsChange?.(summary);
    onCameraInventoryChange?.({
      requestedMode: 'auto',
      resolvedMode: 'auto',
      resolvedCameraMode: 'auto',
      selectedDevice: undefined,
      selectedDeviceSummary: summary,
      options: [{ mode: 'auto', label: 'Auto', shortLabel: 'Auto', supported: true, deviceId: 'web-back-camera', effectiveZoom: null, mappingReason: 'Web camera fallback uses the browser-selected video input.' }],
      rearDevices: [summary],
      qualityProfile: null,
    });
    onQualityProfileChange?.(null);
    onSessionConfigChange?.(null);
  }, [onCameraInventoryChange, onDeviceDiagnosticsChange, onQualityProfileChange, onSessionConfigChange, torchEnabled]);

  useEffect(() => {
    onTorchStateChange?.({
      torchEnabled,
      torchSupported: torchEnabled,
      torchActive: torchEnabled,
      torchProp: torchEnabled ? 'on' : 'off',
      photoFlashMode: 'off',
    });
  }, [onTorchStateChange, torchEnabled]);

  return (
    <CameraView
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      facing="back"
      enableTorch={torchEnabled}
      {...scannerCameraViewQualityProps()}
      onCameraReady={onReady}
    />
  );
});

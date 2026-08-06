import { CameraView } from 'expo-camera';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';

import { scannerCameraViewQualityProps, scannerCaptureOptions } from '@/services/scanner-camera-quality';
import type { ScannerCameraHandle, ScannerCameraProps } from './scanner-camera-contract';

export type { ScannerCameraFrame, ScannerCameraHandle, ScannerCameraPhoto, ScannerCameraProps } from './scanner-camera-contract';

export const ScannerCamera = forwardRef<ScannerCameraHandle, ScannerCameraProps>(function ScannerCamera(
  { torchEnabled, onReady },
  ref,
) {
  const cameraRef = useRef<CameraView | null>(null);
  useImperativeHandle(ref, () => ({
    async capturePhoto() {
      if (!cameraRef.current) throw new Error('Camera is not ready.');
      const photo = await cameraRef.current.takePictureAsync(scannerCaptureOptions());
      return { uri: photo.uri, width: photo.width, height: photo.height, source: 'expo-camera' };
    },
  }), []);

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

import { forwardRef, useCallback, useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useFrameOutput,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import { scannerNativeFrameSampling, scannerNativePhotoTarget } from '@/services/scanner-camera-quality';
import type { ScannerCameraFrame, ScannerCameraHandle, ScannerCameraProps } from './scanner-camera-contract';
export type { ScannerCameraFrame, ScannerCameraHandle, ScannerCameraPhoto, ScannerCameraProps } from './scanner-camera-contract';

const frameSampling = scannerNativeFrameSampling();
const photoTarget = scannerNativePhotoTarget();

export const ScannerCamera = forwardRef<ScannerCameraHandle, ScannerCameraProps>(function ScannerCamera(
  { active, torchEnabled, userId, onReady, onFrameAnalysis },
  ref,
) {
  const device = useCameraDevice('back', { physicalDevices: ['wide-angle'] });
  const handleFrameAnalysis = useCallback((nativeFrame: ScannerCameraFrame) => {
    onFrameAnalysis(nativeFrame);
  }, [onFrameAnalysis]);
  const photoOutput = usePhotoOutput({
    targetResolution: { width: photoTarget.width, height: photoTarget.height },
    quality: photoTarget.quality,
    qualityPrioritization: photoTarget.qualityPrioritization,
  });
  const frameOutput = useFrameOutput({
    targetResolution: CommonResolutions.VGA_4_3,
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

  useImperativeHandle(ref, () => ({
    async capturePhoto() {
      const photo = await photoOutput.capturePhoto({
        flashMode: torchEnabled ? 'on' : 'off',
        enableShutterSound: false,
        enableDistortionCorrection: photoTarget.distortionCorrection,
        enableVirtualDeviceFusion: photoTarget.virtualDeviceFusion,
      }, {});
      try {
        const path = await photo.saveToTemporaryFileAsync();
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
  }), [photoOutput, torchEnabled]);

  if (!device) return <View style={StyleSheet.absoluteFill} />;

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      outputs={[photoOutput, frameOutput]}
      isActive={active}
      torchMode={torchEnabled ? 'on' : 'off'}
      resizeMode="cover"
      enableNativeTapToFocusGesture
      onStarted={onReady}
      onPreviewStarted={onReady}
    />
  );
});

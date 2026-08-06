import type { LiveFrameSample } from '@/services/live-card-recognition';

export type ScannerCameraPhoto = {
  uri: string;
  width: number;
  height: number;
  source: 'vision-camera' | 'expo-camera';
};

export type ScannerCameraHandle = {
  capturePhoto: () => Promise<ScannerCameraPhoto>;
};

export type ScannerCameraFrame = LiveFrameSample & {
  source: 'vision-camera';
  previewResolution: { width: number; height: number };
};

export type ScannerCameraProps = {
  active: boolean;
  torchEnabled: boolean;
  userId: string;
  onReady: () => void;
  onFrame: (frame: ScannerCameraFrame) => void;
};


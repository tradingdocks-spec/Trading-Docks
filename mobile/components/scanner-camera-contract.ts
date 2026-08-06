import type { LiveFrameSample } from '@/services/live-card-recognition';
import type {
  ScannerCameraDeviceSummary,
  ScannerCameraLensMode,
  ScannerCameraLensOption,
  ScannerCameraPoint,
  ScannerTorchState,
} from '@/services/scanner-camera-controls';

export type ScannerCameraPhoto = {
  uri: string;
  width: number;
  height: number;
  source: 'vision-camera' | 'expo-camera';
};

export type ScannerCameraHandle = {
  capturePhoto: () => Promise<ScannerCameraPhoto>;
  focusAt: (point: ScannerCameraPoint) => Promise<void>;
};

export type ScannerCameraFrame = LiveFrameSample & {
  source: 'vision-camera';
  previewResolution: { width: number; height: number };
};

export type ScannerCameraProps = {
  active: boolean;
  torchEnabled: boolean;
  lensMode: ScannerCameraLensMode;
  appForegrounded: boolean;
  focusEnabled: boolean;
  userId: string;
  onReady: () => void;
  onFrameAnalysis: (frame: ScannerCameraFrame) => void;
  onLensOptionsChange?: (options: ScannerCameraLensOption[]) => void;
  onDeviceDiagnosticsChange?: (summary: ScannerCameraDeviceSummary | null) => void;
  onTorchStateChange?: (state: ScannerTorchState) => void;
  onPreviewStopped?: () => void;
};

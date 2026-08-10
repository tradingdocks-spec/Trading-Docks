import type { LiveFrameSample } from '@/services/live-card-recognition';
import type {
  ScannerCameraDeviceSummary,
  ScannerCameraLensSelection,
  ScannerCameraLensMode,
  ScannerCameraLensOption,
  ScannerCameraPoint,
  ScannerCameraQualityProfile,
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

export type ScannerCameraSessionSummary = {
  selectedFormat: string;
  photoResolution: { width: number; height: number } | null;
  videoResolution: { width: number; height: number } | null;
  fps: number | null;
};

export type ScannerCameraProps = {
  active: boolean;
  torchEnabled: boolean;
  lensMode: ScannerCameraLensMode;
  rawDeviceId?: string | null;
  appForegrounded: boolean;
  focusEnabled: boolean;
  userId: string;
  onReady: () => void;
  onFrameAnalysis: (frame: ScannerCameraFrame) => void;
  onLensOptionsChange?: (options: ScannerCameraLensOption[]) => void;
  onCameraInventoryChange?: (selection: ScannerCameraLensSelection) => void;
  onDeviceDiagnosticsChange?: (summary: ScannerCameraDeviceSummary | null) => void;
  onQualityProfileChange?: (profile: ScannerCameraQualityProfile | null) => void;
  onSessionConfigChange?: (summary: ScannerCameraSessionSummary | null) => void;
  onTorchStateChange?: (state: ScannerTorchState) => void;
  onPreviewStopped?: () => void;
};

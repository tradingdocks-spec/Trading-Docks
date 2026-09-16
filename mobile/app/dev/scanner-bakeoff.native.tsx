import { Redirect } from 'expo-router';

import { isScannerDiagnosticsEnabled } from '@/services/native-scanner-calibration';

import PrebuiltScannerBakeoffScreen from '@/components/scanner/prebuilt-scanner-bakeoff-screen.native';

export default function ScannerBakeoffRoute() {
  if (!isScannerDiagnosticsEnabled()) {
    return <Redirect href="/(tabs)" />;
  }

  return <PrebuiltScannerBakeoffScreen />;
}

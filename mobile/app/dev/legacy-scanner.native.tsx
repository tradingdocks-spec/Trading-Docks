import { Redirect } from 'expo-router';

import AutomaticScannerScreen from '@/components/scanner/automatic-scanner-screen';

export default function LegacyScannerRoute() {
  if (!__DEV__) {
    return <Redirect href="/(tabs)" />;
  }

  return <AutomaticScannerScreen />;
}

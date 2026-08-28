import { useState } from 'react';

import AutomaticScannerScreen from '@/components/scanner/automatic-scanner-screen';
import PrebuiltScannerScreen from '@/components/scanner/prebuilt-scanner-screen.native';
import { resolveScannerEngineMode } from '@/services/scanner-engine';

export default function ScannerEngineScreen() {
  const [engine, setEngine] = useState(() => resolveScannerEngineMode());

  if (engine === 'legacy') {
    return <AutomaticScannerScreen />;
  }

  return <PrebuiltScannerScreen onUseLegacyFallback={() => setEngine('legacy')} />;
}

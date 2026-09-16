export type ScannerEngineMode = 'prebuilt' | 'legacy';

export const SCANNER_ENGINE_FLAG = 'EXPO_PUBLIC_SCANNER_ENGINE';

export function resolveScannerEngineMode(env: Record<string, string | undefined> = process.env): ScannerEngineMode {
  return 'prebuilt';
}

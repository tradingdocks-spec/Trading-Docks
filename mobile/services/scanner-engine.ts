import { isProductionRuntime } from './mobile-release-config.ts';

export type ScannerEngineMode = 'prebuilt' | 'legacy';

export const SCANNER_ENGINE_FLAG = 'EXPO_PUBLIC_SCANNER_ENGINE';

export function resolveScannerEngineMode(env: Record<string, string | undefined> = process.env): ScannerEngineMode {
  if (isProductionRuntime(env)) return 'prebuilt';
  const mode = env[SCANNER_ENGINE_FLAG]?.trim().toLowerCase();
  if (mode === 'legacy') return 'legacy';
  if (mode === 'prebuilt') return 'prebuilt';
  return 'prebuilt';
}

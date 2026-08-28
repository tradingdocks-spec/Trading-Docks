import PrebuiltScannerBakeoffScreen from '@/components/scanner/prebuilt-scanner-bakeoff-screen.native';

export default function PrebuiltScannerScreen({
  onUseLegacyFallback,
}: {
  onUseLegacyFallback?: () => void;
} = {}) {
  return <PrebuiltScannerBakeoffScreen mode="production" onUseLegacyFallback={onUseLegacyFallback} />;
}

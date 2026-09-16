import { Redirect } from 'expo-router';

export default function LegacyScannerFallbackRoute() {
  return <Redirect href="/(tabs)" />;
}

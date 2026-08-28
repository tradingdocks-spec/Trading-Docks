import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { TDText } from '@/components/design-system';
import { color, space } from '@/design';

export default function PrebuiltScannerScreen() {
  return (
    <View style={styles.screen}>
      <Ionicons name="camera-outline" size={36} color={color.textMuted} />
      <TDText variant="title">Scanner available in the mobile app</TDText>
      <TDText tone="muted">Open this screen on an iPhone dev build to use the Scanbot prebuilt scanner.</TDText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.lg,
    backgroundColor: '#020A12',
  },
});

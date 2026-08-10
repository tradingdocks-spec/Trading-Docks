import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { TDButton, TDCard, TDScreen, TDText } from '@/components/design-system';
import { space } from '@/design';

export default function ModalScreen() {
  return (
    <TDScreen style={styles.screen}>
      <TDCard variant="floating" style={styles.card}>
        <TDText variant="title">Workspace notice</TDText>
        <TDText variant="small" tone="muted">
          This view is not available from the current workspace.
        </TDText>
        <TDButton label="Return Home" iconName="home-outline" onPress={() => router.replace('/(tabs)')} />
      </TDCard>
    </TDScreen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center' },
  card: { gap: space.md },
});

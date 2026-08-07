import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { TDButton, TDCard, TDScreen, TDText } from '@/components/design-system';
import { space } from '@/design';

export default function NotFoundScreen() {
  return (
    <TDScreen style={styles.screen}>
      <TDCard variant="floating" style={styles.card}>
        <TDText variant="title">Screen not found</TDText>
        <TDText variant="small" tone="muted">
          This Trading Docks screen is not available in the current build.
        </TDText>
        <TDButton label="Go Home" iconName="home-outline" onPress={() => router.replace('/(tabs)')} />
      </TDCard>
    </TDScreen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center' },
  card: { gap: space.md },
});

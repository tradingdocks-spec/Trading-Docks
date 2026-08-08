import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DockAction,
  DockHeader,
  DockRail,
  DockSurface,
  TDButton,
  TDText,
} from '@/components/design-system';
import { color, radius, space } from '@/design';
import { supabase } from '@/lib/supabase';
import { useAccount } from '@/providers/account';
import {
  continuousScannerSessionKey,
  type ContinuousScannerSession,
} from '@/services/continuous-offer-scanner';
import { getMobileScrollBottomInset } from '@/services/navigation-contract';
import { appStorage } from '@/services/storage/app-storage';

export default function ScanModesScreen() {
  const insets = useSafeAreaInsets();
  const { accountType } = useAccount();
  const bottomInset = getMobileScrollBottomInset(insets.bottom);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    void loadReviewListCount()
      .then((count) => {
        if (mounted) setReviewCount(count);
      })
      .catch(() => {
        if (mounted) setReviewCount(0);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingBottom: bottomInset }]}>
      <View style={s.header}>
        <TDText variant="caption" tone="info">{accountType === 'store' ? 'Store intake' : accountType === 'seller' ? 'Seller intake' : 'Collection intake'}</TDText>
        <TDText variant="display">Scan</TDText>
        <TDText variant="small" tone="muted">Automatic Scan is the fastest path. Single Scan and Review stay close when you need control.</TDText>
      </View>

      <DockSurface style={s.modeList}>
        <PrimaryScanMode
          count={reviewCount}
          onStart={() => router.push('/scan/automatic' as never)}
          onSingle={() => router.push('/scan/single' as never)}
          onReview={() => router.push('/scanner-session' as never)}
        />
      </DockSurface>

      <TDText variant="caption" tone="muted" style={s.footer}>
        {accountType === 'store' ? 'Store workspace' : accountType === 'seller' ? 'Seller workspace' : 'Collection workspace'}
      </TDText>
    </ScrollView>
  );
}

async function loadReviewListCount() {
  if (!supabase) return 0;
  const { data, error } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (error || !userId) return 0;
  const rawSession = await appStorage.getItem(continuousScannerSessionKey(userId));
  if (!rawSession) return 0;
  try {
    const session = JSON.parse(rawSession) as ContinuousScannerSession;
    if (session.userId !== userId) return 0;
    return session.lines.length;
  } catch {
    return 0;
  }
}

function PrimaryScanMode({
  count,
  onStart,
  onSingle,
  onReview,
}: {
  count: number;
  onStart: () => void;
  onSingle: () => void;
  onReview: () => void;
}) {
  return (
    <View style={s.primaryCard}>
      <View style={s.primaryTop}>
        <View style={s.primaryIcon}>
          <Ionicons name="scan-outline" size={26} color={color.text} />
        </View>
        <DockHeader
          title="Automatic Scan"
          subtitle="Hands-free capture, exact-printing review, and rapid add flow."
          style={s.modeText}
        />
      </View>
      <TDButton label="Start scanning" iconName="scan-outline" onPress={onStart} />
      <DockRail compact>
        <DockAction label="Single Scan" iconName="radio-button-on-outline" onPress={onSingle} />
        <DockAction label={count > 0 ? `Review ${count}` : 'Review List'} iconName="list-outline" selected={count > 0} onPress={onReview} />
      </DockRail>
    </View>
  );
}

const s = StyleSheet.create({
  content: {
    gap: space.md,
    paddingHorizontal: space.md,
    paddingTop: space.lg,
  },
  screen: {
    flex: 1,
    backgroundColor: color.canvas,
  },
  header: {
    gap: space.xs,
  },
  modeList: { gap: space.md },
  primaryCard: {
    gap: space.md,
  },
  primaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  primaryIcon: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.primaryBright,
  },
  modeText: {
    flex: 1,
    minWidth: 0,
  },
  footer: {
    textAlign: 'center',
  },
});

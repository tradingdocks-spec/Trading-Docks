import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DockAction,
  DockHeader,
  DockRail,
  DockSurface,
  TDButton,
  TDStatusIndicator,
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
import { describeScanLockState } from '@/services/signature-experience';
import { appStorage } from '@/services/storage/app-storage';

export default function ScanModesScreen() {
  const insets = useSafeAreaInsets();
  const { accountType } = useAccount();
  const bottomInset = getMobileScrollBottomInset(insets.bottom);
  const [reviewCount, setReviewCount] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [scanLine] = useState(() => new Animated.Value(0));

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

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(scanLine, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, scanLine]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={[s.content, { paddingBottom: bottomInset }]}>
      <View style={s.header}>
        <TDText variant="caption" tone="info">{accountType === 'store' ? 'Store intake' : accountType === 'seller' ? 'Seller intake' : 'Collection intake'}</TDText>
        <TDText variant="display">Scan</TDText>
        <TDText variant="small" tone="muted">Place card. Hold steady. Review exact printing.</TDText>
      </View>

      <DockSurface material="activeInstrument" level="raised" style={s.modeList}>
        <PrimaryScanMode
          count={reviewCount}
          scanLine={scanLine}
          reduceMotion={reduceMotion}
          onStart={() => router.push('/scan/automatic' as never)}
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
  scanLine,
  reduceMotion,
  onStart,
  onReview,
}: {
  count: number;
  scanLine: Animated.Value;
  reduceMotion: boolean;
  onStart: () => void;
  onReview: () => void;
}) {
  const lock = describeScanLockState('ready');
  return (
    <View style={s.primaryCard}>
      <View style={s.instrument}>
        <View style={s.aperture}>
          <View style={s.apertureCorner} />
          <View style={[s.apertureCorner, s.apertureCornerRight]} />
          <View style={[s.apertureCorner, s.apertureCornerBottom]} />
          <View style={[s.apertureCorner, s.apertureCornerBottomRight]} />
          {!reduceMotion ? (
            <Animated.View
              pointerEvents="none"
              style={[
                s.scanLine,
                {
                  transform: [{
                    translateY: scanLine.interpolate({ inputRange: [0, 1], outputRange: [-42, 42] }),
                  }],
                },
              ]}
            />
          ) : null}
          <TDStatusIndicator tone={lock.tone} label={lock.label} />
        </View>
      </View>
      <View style={s.primaryTop}>
        <View style={s.primaryIcon}>
          <Ionicons name="scan-outline" size={26} color={color.text} />
        </View>
        <DockHeader
          title="Trading Docks Scanner"
          subtitle={lock.instruction}
          style={s.modeText}
        />
      </View>
      <TDButton label="Open scanner" iconName="scan-outline" onPress={onStart} size="lg" />
      <DockRail compact>
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
  instrument: { minHeight: 214, justifyContent: 'center' },
  aperture: {
    minHeight: 180,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: color.canvas + 'AA',
    borderWidth: 1,
    borderTopColor: color.primaryBright + '48',
    borderColor: color.primaryBright + '22',
  },
  apertureCorner: { position: 'absolute', top: 22, left: 22, width: 42, height: 42, borderTopWidth: 2, borderLeftWidth: 2, borderColor: color.primaryBright, borderTopLeftRadius: radius.md },
  apertureCornerRight: { left: undefined, right: 22, borderLeftWidth: 0, borderRightWidth: 2, borderTopRightRadius: radius.md },
  apertureCornerBottom: { top: undefined, bottom: 22, borderTopWidth: 0, borderBottomWidth: 2, borderBottomLeftRadius: radius.md },
  apertureCornerBottomRight: { top: undefined, left: undefined, right: 22, bottom: 22, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 2, borderBottomWidth: 2, borderBottomRightRadius: radius.md },
  scanLine: { position: 'absolute', left: 34, right: 34, height: 2, borderRadius: 2, backgroundColor: color.primaryBright + '88' },
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
